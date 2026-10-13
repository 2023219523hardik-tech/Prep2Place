package com.placement.assessment.service;

import com.placement.assessment.aptitude.AptitudeMockTestService;
import com.placement.assessment.entity.*;
import com.placement.assessment.repository.AssessmentAttemptRepository;
import com.placement.assessment.repository.AssessmentProfileRepository;
import com.placement.assessment.repository.IntegrityEventRepository;
import com.placement.entity.Difficulty;
import com.placement.entity.User;
import com.placement.exception.ApiException;
import com.placement.questionbank.entity.CanonicalQuestion;
import com.placement.questionbank.service.QuestionBankQueryService;
import com.placement.service.StudentProfileService;
import com.placement.repository.AptitudeQuestionRepository;
import com.placement.questionbank.config.InternalAptitudeQuestionSyncService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Shared assessment lifecycle engine used by Coding Mock Tests, Aptitude Mock Tests, and AI
 * Interviews. Owns: question-set generation + locking, server-authoritative timer, autosave,
 * submission, violation-policy enforcement, and auto-expiry. Module-specific scoring/question
 * rendering is layered on top by each module's own service (see CodingMockTestService,
 * AptitudeMockTestService) - this class never needs to know DSA-specific or aptitude-specific
 * details, only CanonicalQuestion ids.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AssessmentEngineService {

    private final AssessmentAttemptRepository attemptRepository;
    private final AssessmentProfileRepository profileRepository;
    private final IntegrityEventRepository integrityEventRepository;
    private final QuestionBankQueryService questionBankQueryService;
    private final ViolationPolicyService violationPolicyService;
    private final StudentProfileService studentProfileService;
    private final ObjectProvider<AptitudeMockTestService> aptitudeMockTestServiceProvider;
    private final AptitudeQuestionRepository aptitudeQuestionRepository;
    private final InternalAptitudeQuestionSyncService aptitudeQuestionSyncService;

    private static final int RECENT_ATTEMPT_WINDOW = 5; // how many past attempts of the same type to pull "recently seen" questions from

    @Transactional
    public AssessmentAttempt startOrResume(User candidate, Long profileId, String ip, String userAgent) {
        AssessmentProfile profile = profileRepository.findById(profileId)
                .orElseThrow(() -> ApiException.notFound("Assessment profile " + profileId + " not found"));
        if (!profile.isActive()) {
            throw ApiException.badRequest("This assessment profile is not currently active");
        }

        // Resume: if the candidate already has a live attempt on this exact profile, hand that back
        // untouched rather than generating a new question set - refresh/reconnect must never reshuffle.
        Optional<AssessmentAttempt> existing = attemptRepository.findFirstByCandidateIdAndProfileIdAndStatusIn(
                candidate.getId(), profileId, List.of(AttemptStatus.NOT_STARTED, AttemptStatus.IN_PROGRESS, AttemptStatus.PAUSED));
        if (existing.isPresent()) {
            AssessmentAttempt attempt = existing.get();
            expireIfNeeded(attempt);
            if (!attempt.isTerminalState()) {
                return attempt;
            }
            // fell through: it just expired on this very check - a fresh attempt is allowed below
            // only if the profile's resume policy permits creating a new one after auto-submit.
        }

        // Only require complete profile for AI Interview (where resume is required for prompt generation).
        // For practice coding and aptitude mock tests, do not block students if profile is partial.
        if (profile.getAssessmentType() == AssessmentType.AI_INTERVIEW) {
            studentProfileService.requireCompleteProfile(candidate);
        } else {
            try {
                studentProfileService.requireCompleteProfile(candidate);
            } catch (Exception e) {
                log.info("Student {} starting mock test with partial profile: {}", candidate.getEmail(), e.getMessage());
            }
        }

        List<Long> questionIds = generateQuestionSet(candidate, profile);

        Instant now = Instant.now();
        AssessmentAttempt attempt = AssessmentAttempt.builder()
                .candidate(candidate)
                .profile(profile)
                .assessmentType(profile.getAssessmentType())
                .status(AttemptStatus.IN_PROGRESS)
                .selectedQuestionIds(questionIds)
                .configSnapshot(snapshotConfig(profile))
                .startedAt(now)
                .serverExpiresAt(now.plus(profile.getDurationMinutes(), ChronoUnit.MINUTES))
                .startIpAddress(ip)
                .startUserAgent(userAgent)
                .maxPossibleScore(questionIds.size() * profile.getPointsPerCorrect())
                .build();

        return attemptRepository.save(attempt);
    }

    private List<Long> generateQuestionSet(User candidate, AssessmentProfile profile) {
        com.placement.questionbank.entity.QuestionDomain domain = domainFor(profile.getAssessmentType());
        Set<Long> recentlyAttempted = recentlyAttemptedQuestionIds(candidate.getId(), profile.getAssessmentType());
        List<Long> selected = new ArrayList<>();

        Map<String, Integer> distribution = profile.getDifficultyDistribution();
        if (distribution == null || distribution.isEmpty()) {
            distribution = Map.of("MEDIUM", profile.getQuestionCount());
        }

        for (Map.Entry<String, Integer> entry : distribution.entrySet()) {
            Difficulty difficulty;
            try {
                difficulty = Difficulty.valueOf(entry.getKey().toUpperCase());
            } catch (Exception e) {
                continue;
            }
            int needed = entry.getValue();
            if (needed <= 0) continue;

            Set<Long> excludeForThisPick = new HashSet<>(recentlyAttempted);
            excludeForThisPick.addAll(selected); // never duplicate a canonical question within the same attempt
            List<CanonicalQuestion> picked = questionBankQueryService.selectRandom(domain, difficulty, needed, excludeForThisPick, profile.getTopicFocus());

            if (picked.size() < needed) {
                // Not enough unseen questions at this difficulty - fall back to allowing recently-seen
                // ones (still excluding what's already in this attempt) rather than under-filling the test.
                Set<Long> onlyExcludeSelected = new HashSet<>(selected);
                picked = questionBankQueryService.selectRandom(domain, difficulty, needed, onlyExcludeSelected, profile.getTopicFocus());
            }
            selected.addAll(picked.stream().map(CanonicalQuestion::getId).toList());
        }

        // Top up with any-difficulty questions if the configured distribution didn't produce enough
        // (e.g. thin question bank) - still never duplicating an id already chosen. Topic scope is
        // intentionally dropped for this fallback pass only, so a narrow profile degrades to "fill
        // the test" rather than failing outright when its topic pool is thinner than questionCount.
        if (selected.size() < profile.getQuestionCount()) {
            int stillNeeded = profile.getQuestionCount() - selected.size();
            Set<Long> exclude = new HashSet<>(selected);
            List<CanonicalQuestion> topUp = questionBankQueryService.selectRandom(domain, null, stillNeeded, exclude);
            selected.addAll(topUp.stream().map(CanonicalQuestion::getId).toList());
        }

        // Direct fallback for Aptitude if canonical questions were thin or not yet synced
        if (domain == com.placement.questionbank.entity.QuestionDomain.APTITUDE && selected.size() < profile.getQuestionCount()) {
            List<com.placement.entity.AptitudeQuestion> activePool = new ArrayList<>(aptitudeQuestionRepository.findByActiveTrue());
            Collections.shuffle(activePool);
            for (com.placement.entity.AptitudeQuestion aq : activePool) {
                if (selected.size() >= profile.getQuestionCount()) break;
                Long cid = aq.getCanonicalQuestionId();
                if (cid == null) {
                    try {
                        aptitudeQuestionSyncService.syncQuestion(aq);
                        cid = aq.getCanonicalQuestionId();
                    } catch (Exception e) {
                        log.warn("On-demand sync failed for aptitude question {}: {}", aq.getId(), e.getMessage());
                    }
                }
                if (cid != null && !selected.contains(cid)) {
                    selected.add(cid);
                }
            }
        }

        if (selected.isEmpty()) {
            throw ApiException.badRequest("No available questions matched this assessment profile's configuration. " +
                    "The question bank may need more active questions for the configured topics/difficulties.");
        }

        return selected;
    }

    private com.placement.questionbank.entity.QuestionDomain domainFor(AssessmentType type) {
        return type == AssessmentType.APTITUDE_MOCK_TEST
                ? com.placement.questionbank.entity.QuestionDomain.APTITUDE
                : com.placement.questionbank.entity.QuestionDomain.CODING; // CODING_MOCK_TEST and AI_INTERVIEW's technical/DSA segment both draw from the coding pool
    }

    private Set<Long> recentlyAttemptedQuestionIds(Long candidateId, AssessmentType type) {
        return attemptRepository.findByCandidateIdAndAssessmentTypeOrderByCreatedAtDesc(candidateId, type).stream()
                .limit(RECENT_ATTEMPT_WINDOW)
                .flatMap(a -> a.getSelectedQuestionIds().stream())
                .collect(Collectors.toSet());
    }

    private Map<String, Object> snapshotConfig(AssessmentProfile profile) {
        Map<String, Object> snapshot = new HashMap<>();
        snapshot.put("durationMinutes", profile.getDurationMinutes());
        snapshot.put("pointsPerCorrect", profile.getPointsPerCorrect());
        snapshot.put("negativeMarkingEnabled", profile.isNegativeMarkingEnabled());
        snapshot.put("negativeMarkingPenalty", profile.getNegativeMarkingPenalty());
        snapshot.put("cameraRequired", profile.isCameraRequired());
        snapshot.put("microphoneRequired", profile.isMicrophoneRequired());
        snapshot.put("screenShareRequired", profile.isScreenShareRequired());
        snapshot.put("fullscreenRequired", profile.isFullscreenRequired());
        snapshot.put("allowCopy", profile.isAllowCopy());
        snapshot.put("allowPaste", profile.isAllowPaste());
        snapshot.put("allowContextMenu", profile.isAllowContextMenu());
        snapshot.put("tabSwitchPolicy", profile.getTabSwitchPolicy().name());
        snapshot.put("violationCountThreshold", profile.getViolationCountThreshold());
        snapshot.put("allowedLanguages", profile.getAllowedLanguages());
        return snapshot;
    }

    public AssessmentAttempt getOwnedAttempt(User candidate, Long attemptId) {
        AssessmentAttempt attempt = attemptRepository.findById(attemptId)
                .orElseThrow(() -> ApiException.notFound("Attempt " + attemptId + " not found"));
        if (!attempt.getCandidate().getId().equals(candidate.getId())) {
            throw ApiException.forbidden("This attempt does not belong to the current candidate");
        }
        expireIfNeeded(attempt);
        return attempt;
    }

    /** Checked on every read: if the server-side expiry has passed and the attempt is still live, auto-submit it now. */
    @Transactional
    public void expireIfNeeded(AssessmentAttempt attempt) {
        if (attempt.isTerminalState()) return;
        if (attempt.getServerExpiresAt() != null && Instant.now().isAfter(attempt.getServerExpiresAt())) {
            attempt.setStatus(AttemptStatus.AUTO_SUBMITTED);
            attempt.setSubmittedAt(Instant.now());
            attemptRepository.save(attempt);
            integrityEventRepository.save(IntegrityEvent.builder()
                    .attemptId(attempt.getId())
                    .eventType(IntegrityEventType.TIME_EXPIRATION)
                    .classification(IntegrityEventClassification.DETECTED_SIGNAL)
                    .details("Server-side expiry reached; attempt auto-submitted.")
                    .severity(1)
                    .build());
            gradeIfAptitude(attempt);
        }
    }

    /** Aptitude scores are computed at submit/termination time (unlike coding which accumulates live).
     *  On auto-expiry we must run the same grading so the persisted result is not a blank zero.
     *  Uses ObjectProvider to break the circular dependency with AptitudeMockTestService. */
    private void gradeIfAptitude(AssessmentAttempt attempt) {
        if (attempt.getAssessmentType() == AssessmentType.APTITUDE_MOCK_TEST) {
            AptitudeMockTestService aptitudeService = aptitudeMockTestServiceProvider.getIfAvailable();
            if (aptitudeService != null) {
                try {
                    aptitudeService.finalizeOnTermination(attempt);
                } catch (Exception e) {
                    log.error("Failed to grade auto-expired aptitude attempt {}: {}", attempt.getId(), e.getMessage(), e);
                }
            }
        }
    }

    @Transactional
    public AssessmentAttempt autosave(User candidate, Long attemptId, Map<String, Object> answerDelta, Map<String, String> languageDelta) {
        AssessmentAttempt attempt = getOwnedAttempt(candidate, attemptId);
        if (attempt.isTerminalState()) {
            throw ApiException.conflict("Cannot autosave: this attempt is already " + attempt.getStatus());
        }
        if (answerDelta != null) attempt.getAnswerState().putAll(answerDelta);
        if (languageDelta != null) attempt.getLanguageState().putAll(languageDelta);
        attempt.setLastAutosaveAt(Instant.now());
        return attemptRepository.save(attempt);
    }

    @Transactional
    public AssessmentAttempt submit(User candidate, Long attemptId) {
        AssessmentAttempt attempt = getOwnedAttempt(candidate, attemptId);
        if (attempt.isTerminalState()) {
            // Idempotent: submitting an already-terminal attempt just returns its current state
            // rather than erroring, so a flaky network retry can't cause a confusing failure.
            return attempt;
        }
        attempt.setStatus(AttemptStatus.SUBMITTED);
        attempt.setSubmittedAt(Instant.now());
        return attemptRepository.save(attempt);
    }

    /** Scans for anything past its server expiry that a client never came back to submit/read. Runs every 30s. */
    @org.springframework.scheduling.annotation.Scheduled(fixedRate = 30_000)
    @Transactional
    public void sweepExpiredAttempts() {
        List<AssessmentAttempt> live = attemptRepository.findByStatusAndServerExpiresAtBefore(AttemptStatus.IN_PROGRESS, Instant.now());
        for (AssessmentAttempt attempt : live) {
            expireIfNeeded(attempt);
        }
        if (!live.isEmpty()) {
            log.info("Auto-submitted {} expired assessment attempt(s) on scheduled sweep.", live.size());
        }
    }
}
