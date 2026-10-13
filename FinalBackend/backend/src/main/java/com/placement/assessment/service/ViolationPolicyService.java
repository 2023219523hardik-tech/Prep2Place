package com.placement.assessment.service;

import com.placement.assessment.entity.*;
import com.placement.assessment.repository.AssessmentAttemptRepository;
import com.placement.assessment.repository.IntegrityEventRepository;
import com.placement.entity.User;
import com.placement.exception.ApiException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Map;
import java.util.Set;

/**
 * Everything about how a reported integrity event turns into (or doesn't turn into) a terminated
 * attempt lives here, server-side, on purpose: a candidate must not be able to bypass a
 * terminate-on-violation policy by refreshing or by never calling a frontend handler. The frontend
 * only ever *reports* what it observed; this service decides what happens next.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ViolationPolicyService {

    private final AssessmentAttemptRepository attemptRepository;
    private final IntegrityEventRepository integrityEventRepository;

    private static final Set<IntegrityEventType> FOCUS_RELATED = Set.of(
            IntegrityEventType.TAB_SWITCH, IntegrityEventType.WINDOW_BLUR, IntegrityEventType.FULLSCREEN_EXIT);

    private static final Map<IntegrityEventType, Integer> DEFAULT_SEVERITY = Map.ofEntries(
            Map.entry(IntegrityEventType.TAB_SWITCH, 3),
            Map.entry(IntegrityEventType.WINDOW_BLUR, 2),
            Map.entry(IntegrityEventType.FULLSCREEN_EXIT, 3),
            Map.entry(IntegrityEventType.COPY_ATTEMPT, 2),
            Map.entry(IntegrityEventType.PASTE_ATTEMPT, 2),
            Map.entry(IntegrityEventType.CONTEXT_MENU_ATTEMPT, 1),
            Map.entry(IntegrityEventType.SCREEN_CHANGE_ATTEMPT, 3),
            Map.entry(IntegrityEventType.CAMERA_BLOCKED, 2),
            Map.entry(IntegrityEventType.MICROPHONE_BLOCKED, 1),
            Map.entry(IntegrityEventType.FACE_NOT_DETECTED, 2),
            Map.entry(IntegrityEventType.MULTIPLE_FACES, 4),
            Map.entry(IntegrityEventType.LOOKING_AWAY, 2),
            Map.entry(IntegrityEventType.POSTURE_ISSUE, 1),
            Map.entry(IntegrityEventType.POTENTIAL_EXTERNAL_REFERENCE, 4),
            Map.entry(IntegrityEventType.SUSPICIOUS_KEYBOARD_ACTIVITY, 3),
            Map.entry(IntegrityEventType.INACTIVITY, 1),
            Map.entry(IntegrityEventType.TIME_EXPIRATION, 1),
            Map.entry(IntegrityEventType.TEST_TERMINATED, 5),
            Map.entry(IntegrityEventType.DEVTOOLS_ATTEMPT, 4),
            Map.entry(IntegrityEventType.BACK_NAVIGATION_ATTEMPT, 2),
            Map.entry(IntegrityEventType.UNAUTHORIZED_SCREEN_SHARE_DETECTED, 5),
            Map.entry(IntegrityEventType.UNAUTHORIZED_SECOND_SHARE, 5),
            Map.entry(IntegrityEventType.POTENTIAL_DISPLAY_CAPTURE, 1),
            Map.entry(IntegrityEventType.EXTENSION_CAPTURE_API_PRESENT, 1)
    );

    @Transactional
    public IntegrityEvent recordAndEnforce(User candidate, Long attemptId, IntegrityEventType type,
                                            Double durationSeconds, Double confidenceScore, String details,
                                            boolean evidenceAvailable, String evidenceRef, String evidenceUnavailableReason) {
        AssessmentAttempt attempt = attemptRepository.findById(attemptId)
                .orElseThrow(() -> ApiException.notFound("Attempt " + attemptId + " not found"));
        if (!attempt.getCandidate().getId().equals(candidate.getId())) {
            throw ApiException.forbidden("This attempt does not belong to the current candidate");
        }
        if (attempt.isTerminalState()) {
            return persistEvent(attempt.getId(), type, durationSeconds, confidenceScore, details,
                    evidenceAvailable, evidenceRef, evidenceUnavailableReason, false);
        }

        int severity = DEFAULT_SEVERITY.getOrDefault(type, 2);
        IntegrityEventClassification classification = confidenceScore != null
                ? (confidenceScore >= 0.75 ? IntegrityEventClassification.HIGH_CONFIDENCE_VIOLATION : IntegrityEventClassification.POTENTIAL_VIOLATION)
                : IntegrityEventClassification.DETECTED_SIGNAL;

        attempt.setViolationCount(attempt.getViolationCount() + 1);
        attempt.setIntegrityScore(Math.max(0, attempt.getIntegrityScore() - (severity * 5)));

        boolean shouldTerminate = decideTermination(attempt, type);

        IntegrityEvent event = IntegrityEvent.builder()
                .attemptId(attempt.getId())
                .eventType(type)
                .classification(classification)
                .durationSeconds(durationSeconds)
                .severity(severity)
                .confidenceScore(confidenceScore)
                .details(details)
                .evidenceAvailable(evidenceAvailable)
                .evidenceRef(evidenceAvailable ? evidenceRef : null)
                .evidenceUnavailableReason(evidenceAvailable ? null : (evidenceUnavailableReason != null ? evidenceUnavailableReason : "No evidence was captured for this event."))
                .contributedToTermination(shouldTerminate)
                .build();
        integrityEventRepository.save(event);

        if (shouldTerminate) {
            terminate(attempt, "Assessment integrity policy violation: " + type);
        }

        attemptRepository.save(attempt);
        return event;
    }

    private boolean decideTermination(AssessmentAttempt attempt, IntegrityEventType type) {
        AssessmentProfile profile = attempt.getProfile();

        if (type == IntegrityEventType.TAB_SWITCH) {
            return true;
        }
        if (FOCUS_RELATED.contains(type) && profile.getTabSwitchPolicy() == AssessmentProfile.TabSwitchPolicy.TERMINATE) {
            return true;
        }
        if (type == IntegrityEventType.FULLSCREEN_EXIT && profile.isTerminateOnFirstFullscreenExit()) {
            return true;
        }
        int threshold = profile.getViolationCountThreshold();
        return threshold > 0 && attempt.getViolationCount() >= threshold;
    }

    @Transactional
    public void terminate(AssessmentAttempt attempt, String reason) {
        boolean tabSwitchTermination = reason != null && reason.toUpperCase().contains("TAB_SWITCH");
        attempt.setStatus(tabSwitchTermination ? AttemptStatus.TAB_SWITCH_TERMINATED : AttemptStatus.TERMINATED);
        attempt.setTerminationReason(tabSwitchTermination ? "TAB_SWITCH" : reason);
        attempt.setSubmittedAt(Instant.now());
        attemptRepository.save(attempt);
        integrityEventRepository.save(IntegrityEvent.builder()
                .attemptId(attempt.getId())
                .eventType(IntegrityEventType.TEST_TERMINATED)
                .classification(IntegrityEventClassification.DETECTED_SIGNAL)
                .severity(5)
                .details(reason)
                .contributedToTermination(true)
                .build());
        log.info("Attempt {} terminated: {}", attempt.getId(), reason);
    }

    @Transactional
    public AssessmentAttempt terminateTabSwitch(User candidate, Long attemptId, String reason) {
        AssessmentAttempt attempt = attemptRepository.findById(attemptId)
                .orElseThrow(() -> ApiException.notFound("Attempt " + attemptId + " not found"));
        if (!attempt.getCandidate().getId().equals(candidate.getId())) {
            throw ApiException.forbidden("This attempt does not belong to the current candidate");
        }
        if (attempt.isTerminalState()) {
            return attempt;
        }

        attempt.setStatus(AttemptStatus.TAB_SWITCH_TERMINATED);
        attempt.setTerminationReason(reason != null && !reason.isBlank() ? reason : "TAB_SWITCH");
        attempt.setSubmittedAt(Instant.now());
        attemptRepository.save(attempt);

        integrityEventRepository.save(IntegrityEvent.builder()
                .attemptId(attempt.getId())
                .eventType(IntegrityEventType.TAB_SWITCH)
                .classification(IntegrityEventClassification.HIGH_CONFIDENCE_VIOLATION)
                .severity(5)
                .details("Tab/window switch detected; mock test terminated immediately.")
                .contributedToTermination(true)
                .build());

        log.info("Attempt {} terminated immediately after tab switch: {}", attempt.getId(), attempt.getTerminationReason());
        return attempt;
    }

    private IntegrityEvent persistEvent(Long attemptId, IntegrityEventType type, Double durationSeconds,
                                         Double confidenceScore, String details, boolean evidenceAvailable,
                                         String evidenceRef, String evidenceUnavailableReason, boolean contributedToTermination) {
        return integrityEventRepository.save(IntegrityEvent.builder()
                .attemptId(attemptId)
                .eventType(type)
                .durationSeconds(durationSeconds)
                .confidenceScore(confidenceScore)
                .details(details)
                .evidenceAvailable(evidenceAvailable)
                .evidenceRef(evidenceAvailable ? evidenceRef : null)
                .evidenceUnavailableReason(evidenceAvailable ? null : evidenceUnavailableReason)
                .contributedToTermination(contributedToTermination)
                .build());
    }
}
