package com.placement.assessment.report;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.placement.assessment.entity.*;
import com.placement.assessment.report.ReportDtos.*;
import com.placement.assessment.repository.AssessmentAttemptRepository;
import com.placement.assessment.repository.IntegrityEventRepository;
import com.placement.assessment.service.AssessmentEngineService;
import com.placement.entity.AptitudeQuestion;
import com.placement.entity.CodingProblem;
import com.placement.entity.CodingSubmission;
import com.placement.entity.User;
import com.placement.repository.AptitudeQuestionRepository;
import com.placement.repository.CodingProblemRepository;
import com.placement.repository.CodingSubmissionRepository;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Builds the evidence-based candidate report for a single AssessmentAttempt (coding or aptitude
 * mock test). Every evidence card and mistake card is derived from data actually stored during
 * the attempt - nothing here fabricates a screenshot, a failed test case, or a "cheated" verdict.
 * Where evidence genuinely wasn't captured, the card says so explicitly (see
 * IntegrityEvent.evidenceAvailable / evidenceUnavailableReason).
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ReportingService {

    private final AssessmentEngineService engineService;
    private final AssessmentAttemptRepository attemptRepository;
    private final IntegrityEventRepository integrityEventRepository;
    private final CodingSubmissionRepository codingSubmissionRepository;
    private final CodingProblemRepository codingProblemRepository;
    private final AptitudeQuestionRepository aptitudeQuestionRepository;
    private final ObjectMapper objectMapper;

    private static final int TREND_WINDOW = 3; // attempts per bucket when comparing recent vs older

    @Transactional
    public AttemptReport generateReport(User candidate, Long attemptId) {
        AssessmentAttempt attempt = engineService.getOwnedAttempt(candidate, attemptId);

        if (attempt == null) {
            throw new EntityNotFoundException("Attempt not found");
        }

        List<EvidenceCard> evidence = buildEvidenceCards(attempt);
        List<CodingMistakeCard> codingMistakes = attempt.getAssessmentType() == AssessmentType.CODING_MOCK_TEST
                ? buildCodingMistakes(attempt) : List.of();
        List<AptitudeMistakeCard> aptitudeMistakes = attempt.getAssessmentType() == AssessmentType.APTITUDE_MOCK_TEST
                ? buildAptitudeMistakes(attempt) : List.of();

        List<RepeatedIssue> repeated = buildRepeatedIssues(candidate, attempt);

        double scorePercent = attempt.getMaxPossibleScore() <= 0 ? 0
                : Math.round((Math.max(0, attempt.getRawScore()) * 10000.0) / attempt.getMaxPossibleScore()) / 100.0;

        List<String> strengths = new ArrayList<>();
        List<String> weaknesses = new ArrayList<>();
        if (attempt.getAssessmentType() == AssessmentType.APTITUDE_MOCK_TEST) {
            deriveAptitudeStrengthsWeaknesses(attempt, strengths, weaknesses);
        } else if (attempt.getAssessmentType() == AssessmentType.CODING_MOCK_TEST) {
            for (CodingMistakeCard c : codingMistakes) {
                weaknesses.add(c.isUnattempted()
                        ? c.getQuestionTitle() + " (not attempted)"
                        : c.getQuestionTitle() + " (" + c.getScorePercent() + "%)");
            }
            if (codingMistakes.isEmpty() && !attempt.getSelectedQuestionIds().isEmpty()) strengths.add("All attempted questions passed their evaluated test cases.");
        }
        if (attempt.getViolationCount() == 0) strengths.add("No assessment-integrity violations recorded.");
        else weaknesses.add(attempt.getViolationCount() + " assessment-integrity event(s) recorded - see evidence below.");

        String summary = buildSummary(attempt, scorePercent);

        List<FeedbackDetail> feedback = new ArrayList<>();
        for (String s : strengths) {
            feedback.add(new FeedbackDetail("STRENGTH", s, "SUCCESS"));
        }
        for (String w : weaknesses) {
            feedback.add(new FeedbackDetail("WEAKNESS", w, "WARNING"));
        }
        feedback.add(new FeedbackDetail("SUMMARY", summary, "INFO"));

        return AttemptReport.builder()
                .attemptId(attempt.getId())
                .assessmentType(attempt.getAssessmentType())
                .status(attempt.getStatus().name())
                .rawScore(attempt.getRawScore())
                .maxPossibleScore(attempt.getMaxPossibleScore())
                .scorePercent(scorePercent)
                .integrityScore(attempt.getIntegrityScore())
                .violationCount(attempt.getViolationCount())
                .overallSummary(summary)
                .strengths(strengths)
                .weaknesses(weaknesses)
                .evidenceCards(evidence)
                .codingMistakes(codingMistakes)
                .aptitudeMistakes(aptitudeMistakes)
                .repeatedIssues(repeated)
                .feedback(feedback)
                .build();
    }

    // ---------------------------------------------------------------------------------------

    private List<EvidenceCard> buildEvidenceCards(AssessmentAttempt attempt) {
        return integrityEventRepository.findByAttemptIdOrderByOccurredAtAsc(attempt.getId()).stream()
                .map(event -> {
                    IntegrityAdvisory.Advisory advisory = IntegrityAdvisory.forType(event.getEventType());
                    return EvidenceCard.builder()
                            .eventType(event.getEventType())
                            .label(advisory.label())
                            .classification(event.getClassification())
                            .severity(event.getSeverity())
                            .confidenceScore(event.getConfidenceScore())
                            .occurredAt(event.getOccurredAt())
                            .durationSeconds(event.getDurationSeconds())
                            .evidenceAvailable(event.isEvidenceAvailable())
                            .evidenceRef(event.isEvidenceAvailable() ? event.getEvidenceRef() : null)
                            .evidenceUnavailableReason(event.isEvidenceAvailable() ? null :
                                    (event.getEvidenceUnavailableReason() != null ? event.getEvidenceUnavailableReason() : "No visual evidence was captured for this event."))
                            .whatWasDetected(event.getDetails() != null && !event.getDetails().isBlank() ? event.getDetails() : advisory.whatItMeansTemplate())
                            .howToImprove(advisory.howToImprove())
                            .build();
                })
                .toList();
    }

    @SuppressWarnings("unchecked")
    private List<CodingMistakeCard> buildCodingMistakes(AssessmentAttempt attempt) {
        List<CodingMistakeCard> cards = new ArrayList<>();
        List<Long> canonicalIds = attempt.getSelectedQuestionIds();

        for (int i = 0; i < canonicalIds.size(); i++) {
            Long canonicalId = canonicalIds.get(i);
            Optional<CodingProblem> problemOpt = codingProblemRepository.findByCanonicalQuestionId(canonicalId);
            if (problemOpt.isEmpty()) continue;
            CodingProblem problem = problemOpt.get();

            List<CodingSubmission> submissions = codingSubmissionRepository
                    .findByAttemptIdAndProblemIdOrderBySubmittedAtDesc(attempt.getId(), problem.getId());
            if (submissions.isEmpty()) {
                // Section 8 (partial completion): never silently drop a question the candidate
                // never reached (e.g. the attempt was terminated before getting to it) - a
                // reviewer must be able to tell "not attempted" apart from "attempted, unsolved".
                cards.add(CodingMistakeCard.builder()
                        .questionIndex(i)
                        .questionTitle(problem.getTitle())
                        .topics(splitCsv(problem.getTopic()))
                        .difficulty(problem.getDifficulty() != null ? problem.getDifficulty().name() : null)
                        .verdict("NOT_ATTEMPTED")
                        .scorePercent(0)
                        .failedTests(List.of())
                        .unattempted(true)
                        .howToImprove(attempt.getStatus() == AttemptStatus.TERMINATED
                                ? "This question was never reached - the session was terminated before this point."
                                : "This question was left unattempted. Budget time across all questions so every one gets at least a first attempt.")
                        .build());
                continue;
            }

            CodingSubmission latest = submissions.get(0);
            if ("PASSED".equals(latest.getVerdict())) continue; // solved - no mistake card needed

            List<FailedTest> failedTests = new ArrayList<>();
            if (latest.getExecutionDetails() != null) {
                Object resultsObj = latest.getExecutionDetails().get("results");
                if (resultsObj instanceof List<?> results) {
                    for (Object r : results) {
                        if (!(r instanceof Map)) continue;
                        Map<String, Object> tc = (Map<String, Object>) r;
                        String status = String.valueOf(tc.get("status"));
                        if ("PASSED".equalsIgnoreCase(status)) continue;
                        failedTests.add(FailedTest.builder()
                                .name(String.valueOf(tc.get("name")))
                                .input(str(tc.get("input")))
                                .expected(str(tc.get("expected")))
                                .actual(str(tc.get("actual")))
                                .error(str(tc.get("error")))
                                .build());
                    }
                }
            }

            String improvement = failedTests.stream().anyMatch(f -> f.getError() != null && !f.getError().isBlank())
                    ? "Your code raised a runtime/compile error on at least one test case - check the error message above, and test edge cases (empty input, boundary values) locally before submitting."
                    : "Your code ran but produced the wrong output on at least one test case - compare the expected vs actual output above to find where your logic diverges, and re-check boundary conditions.";

            cards.add(CodingMistakeCard.builder()
                    .questionIndex(i)
                    .questionTitle(problem.getTitle())
                    .topics(splitCsv(problem.getTopic()))
                    .difficulty(problem.getDifficulty() != null ? problem.getDifficulty().name() : null)
                    .verdict(latest.getVerdict())
                    .scorePercent(latest.getScore())
                    .failedTests(failedTests)
                    .howToImprove(improvement)
                    .build());
        }
        return cards;
    }

    @SuppressWarnings("unchecked")
    private List<AptitudeMistakeCard> buildAptitudeMistakes(AssessmentAttempt attempt) {
        Object raw = attempt.getResultDetails().get("questionResults");
        if (!(raw instanceof List<?> list)) return List.of();

        List<AptitudeMistakeCard> cards = new ArrayList<>();
        List<Long> canonicalIds = attempt.getSelectedQuestionIds();

        for (Object o : list) {
            if (!(o instanceof Map)) continue;
            Map<String, Object> qr = (Map<String, Object>) o;
            boolean correct = Boolean.TRUE.equals(qr.get("correct"));
            if (correct) continue;

            int index = ((Number) qr.get("index")).intValue();
            String questionText = index < canonicalIds.size()
                    ? aptitudeQuestionRepository.findByCanonicalQuestionId(canonicalIds.get(index)).map(AptitudeQuestion::getText).orElse("(question unavailable)")
                    : "(question unavailable)";
            boolean unanswered = Boolean.TRUE.equals(qr.get("unanswered"));

            String improvement = unanswered
                    ? "This question was left unanswered. Track remaining time against question count so every question gets at least an attempt."
                    : "Review the explanation below against your working - this is a good candidate for targeted practice on this topic.";

            cards.add(AptitudeMistakeCard.builder()
                    .questionIndex(index)
                    .questionText(questionText)
                    .topic(str(qr.get("topic")))
                    .difficulty(str(qr.get("difficulty")))
                    .yourAnswer(str(qr.get("yourAnswer")))
                    .correctAnswer(str(qr.get("correctAnswer")))
                    .unanswered(unanswered)
                    .explanation(str(qr.get("explanation")))
                    .howToImprove(improvement)
                    .build());
        }
        return cards;
    }

    @SuppressWarnings("unchecked")
    private void deriveAptitudeStrengthsWeaknesses(AssessmentAttempt attempt, List<String> strengths, List<String> weaknesses) {
        Object raw = attempt.getResultDetails().get("topicBreakdown");
        if (!(raw instanceof List<?> list)) return;
        for (Object o : list) {
            if (!(o instanceof Map)) continue;
            Map<String, Object> t = (Map<String, Object>) o;
            double accuracy = ((Number) t.getOrDefault("accuracyPercent", 0)).doubleValue();
            String topic = String.valueOf(t.get("topic"));
            if (accuracy >= 75) strengths.add(topic + " (" + accuracy + "% accuracy)");
            else if (accuracy < 50) weaknesses.add(topic + " (" + accuracy + "% accuracy)");
        }
    }

    /**
     * Compares issue frequency across the candidate's last 2*TREND_WINDOW attempts of the SAME
     * assessment type to show whether a recurring problem is improving, worsening, or steady -
     * driven entirely by stored IntegrityEvent/mistake data, never inferred without evidence.
     */
    private List<RepeatedIssue> buildRepeatedIssues(User candidate, AssessmentAttempt currentAttempt) {
        List<AssessmentAttempt> history = attemptRepository
                .findByCandidateIdAndAssessmentTypeOrderByCreatedAtDesc(candidate.getId(), currentAttempt.getAssessmentType());
        if (history.size() < 2) return List.of();

        List<AssessmentAttempt> recent = history.stream().limit(TREND_WINDOW).toList();
        List<AssessmentAttempt> older = history.stream().skip(TREND_WINDOW).limit((long) TREND_WINDOW).toList();

        Map<String, Integer> recentCounts = countIssueOccurrences(recent);
        Map<String, Integer> olderCounts = countIssueOccurrences(older);

        Set<String> allKeys = new LinkedHashSet<>();
        allKeys.addAll(recentCounts.keySet());
        allKeys.addAll(olderCounts.keySet());

        List<RepeatedIssue> issues = new ArrayList<>();
        for (String key : allKeys) {
            int r = recentCounts.getOrDefault(key, 0);
            int o = olderCounts.getOrDefault(key, 0);
            if (r == 0 && o == 0) continue;
            String trend = o == 0 ? "NEW" : r < o ? "IMPROVING" : r > o ? "WORSENING" : "STABLE";
            issues.add(RepeatedIssue.builder().issueKey(key).label(labelFor(key)).recentCount(r).olderCount(o).trend(trend).build());
        }
        issues.sort(Comparator.comparingInt(RepeatedIssue::getRecentCount).reversed());
        return issues;
    }

    private Map<String, Integer> countIssueOccurrences(List<AssessmentAttempt> attempts) {
        Map<String, Integer> counts = new HashMap<>();
        for (AssessmentAttempt a : attempts) {
            for (IntegrityEvent e : integrityEventRepository.findByAttemptIdOrderByOccurredAtAsc(a.getId())) {
                counts.merge("integrity:" + e.getEventType().name(), 1, Integer::sum);
            }
        }
        return counts;
    }

    private String labelFor(String issueKey) {
        if (issueKey.startsWith("integrity:")) {
            try {
                return IntegrityAdvisory.forType(IntegrityEventType.valueOf(issueKey.substring("integrity:".length()))).label();
            } catch (Exception ignored) { /* fall through */ }
        }
        return issueKey;
    }

    private String buildSummary(AssessmentAttempt attempt, double scorePercent) {
        String scoreLine = scorePercent >= 75
                ? "Strong performance overall."
                : scorePercent >= 50
                ? "A solid attempt with clear room for improvement in the areas below."
                : "This attempt shows significant preparation gaps - focus on the flagged weak areas before your next attempt.";
        // Section 8: make the completion state explicit in plain language, not just the raw
        // status field - a reviewer shouldn't have to infer "was this terminated early?" from
        // the score alone.
        String completionLine = switch (attempt.getStatus()) {
            case TERMINATED -> " This attempt was ended early due to a policy violation" +
                    (attempt.getTerminationReason() != null ? " (" + attempt.getTerminationReason() + ")" : "") +
                    " - the score above reflects only what was legitimately answered before that point.";
            case AUTO_SUBMITTED -> " This attempt was auto-submitted when its time limit expired.";
            case SUBMITTED -> "";
            default -> " This attempt is not yet complete.";
        };
        String integrityLine = attempt.getViolationCount() == 0
                ? " No assessment-integrity issues were recorded."
                : " " + attempt.getViolationCount() + " assessment-integrity event(s) were recorded during this attempt - see the evidence section for detail.";
        return scoreLine + completionLine + integrityLine;
    }

    private List<String> splitCsv(String csv) {
        if (csv == null || csv.isBlank()) return List.of();
        return Arrays.stream(csv.split("\\s*,\\s*")).filter(s -> !s.isBlank()).toList();
    }

    private String str(Object o) { return o == null ? null : String.valueOf(o); }
}
