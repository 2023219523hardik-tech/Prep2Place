package com.placement.assessment.aptitude;

import com.placement.assessment.aptitude.AptitudeMockTestDtos.*;
import com.placement.assessment.entity.AssessmentAttempt;
import com.placement.assessment.entity.AssessmentProfile;
import com.placement.assessment.entity.AssessmentType;
import com.placement.assessment.repository.AssessmentAttemptRepository;
import com.placement.assessment.service.AssessmentEngineService;
import com.placement.entity.AptitudeQuestion;
import com.placement.exception.ApiException;
import com.placement.repository.AptitudeQuestionRepository;
import com.placement.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Aptitude Mock Test module built on the shared AssessmentEngineService. Unlike coding (per-
 * question Run/Submit), aptitude is answered as a whole set with a single authoritative submit at
 * the end - grading, negative marking, and topic-wise breakdown all happen server-side here, never
 * trusting any score the frontend might compute for itself.
 */
@Service
@RequiredArgsConstructor
public class AptitudeMockTestService {

    private final AssessmentEngineService engineService;
    private final AssessmentAttemptRepository attemptRepository;
    private final AptitudeQuestionRepository aptitudeQuestionRepository;
    private final com.fasterxml.jackson.databind.ObjectMapper objectMapper;

    public WorkspaceView getWorkspace(User candidate, Long attemptId) {
        AssessmentAttempt attempt = requireAptitudeAttempt(candidate, attemptId);
        List<Long> canonicalIds = attempt.getSelectedQuestionIds();

        List<QuestionView> questions = new ArrayList<>();
        int answered = 0;
        for (int i = 0; i < canonicalIds.size(); i++) {
            Long canonicalId = canonicalIds.get(i);
            AptitudeQuestion q = resolveQuestion(canonicalId);
            String selected = (String) attempt.getAnswerState().get(answerKey(canonicalId));
            if (selected != null) answered++;
            questions.add(QuestionView.builder()
                    .index(i)
                    .canonicalQuestionId(canonicalId)
                    .text(q.getText())
                    .topic(q.getTopic())
                    .difficulty(q.getDifficulty() != null ? q.getDifficulty().name() : null)
                    .optionA(q.getOptionA()).optionB(q.getOptionB()).optionC(q.getOptionC()).optionD(q.getOptionD())
                    .selectedOption(selected)
                    .build());
        }

        long remaining = attempt.isTerminalState() ? 0
                : Math.max(0, Instant.now().until(attempt.getServerExpiresAt(), java.time.temporal.ChronoUnit.SECONDS));

        return WorkspaceView.builder()
                .attemptId(attempt.getId())
                .remainingSeconds(remaining)
                .totalQuestions(canonicalIds.size())
                .answeredCount(answered)
                .questions(questions)
                .build();
    }

    public void saveAnswer(User candidate, Long attemptId, SaveAnswerRequest request) {
        AssessmentAttempt attempt = requireAptitudeAttempt(candidate, attemptId);
        if (attempt.isTerminalState()) {
            throw ApiException.conflict("Cannot save an answer: this attempt is already " + attempt.getStatus());
        }
        Long canonicalId = questionIdAt(attempt, request.getIndex());
        engineService.autosave(candidate, attemptId, Map.of(answerKey(canonicalId), request.getSelectedOption() == null ? "" : request.getSelectedOption()), null);
    }

    @Transactional
    public SubmitResult submitTest(User candidate, Long attemptId) {
        AssessmentAttempt attempt = requireAptitudeAttempt(candidate, attemptId);
        if (attempt.isTerminalState() && attempt.getResultDetails().containsKey("graded")) {
            return computeResult(attempt); // idempotent re-read, not re-scored
        }

        SubmitResult result = persistScoring(attempt);

        // Finalize status through the shared engine so it goes through the one authoritative path.
        engineService.submit(candidate, attemptId);

        return result;
    }

    /** Universal anti-cheat -> Section 8 (partial completion): called when a violation
     *  auto-terminates this attempt mid-test, so the report reflects exactly what was
     *  legitimately answered before the trigger point rather than showing a blank/zero result.
     *  Unlike {@link #submitTest}, this does NOT touch attempt status - the caller
     *  (ViolationPolicyService via the violations endpoint) already set it to TERMINATED, and
     *  re-running {@link AssessmentEngineService#submit} here would incorrectly overwrite that
     *  with SUBMITTED. */
    @Transactional
    public void finalizeOnTermination(AssessmentAttempt attempt) {
        if (attempt.getResultDetails().containsKey("graded")) return; // already scored, don't redo
        persistScoring(attempt);
    }

    private SubmitResult persistScoring(AssessmentAttempt attempt) {
        SubmitResult result = computeResult(attempt);
        attempt.setRawScore(result.getRawScore());
        attempt.setMaxPossibleScore(result.getMaxPossibleScore());
        attempt.getResultDetails().put("graded", true);
        attempt.getResultDetails().put("questionResults", objectMapper.convertValue(result.getQuestionResults(), new com.fasterxml.jackson.core.type.TypeReference<List<Map<String, Object>>>() {}));
        attempt.getResultDetails().put("topicBreakdown", objectMapper.convertValue(result.getTopicBreakdown(), new com.fasterxml.jackson.core.type.TypeReference<List<Map<String, Object>>>() {}));
        attemptRepository.save(attempt);
        return result;
    }

    private SubmitResult computeResult(AssessmentAttempt attempt) {
        AssessmentProfile profile = attempt.getProfile();
        List<Long> canonicalIds = attempt.getSelectedQuestionIds();

        int correct = 0, incorrect = 0, unanswered = 0;
        Map<String, int[]> topicTotals = new LinkedHashMap<>(); // topic -> [correct, total]
        List<QuestionResult> questionResults = new ArrayList<>();

        for (int i = 0; i < canonicalIds.size(); i++) {
            Long canonicalId = canonicalIds.get(i);
            AptitudeQuestion q = resolveQuestion(canonicalId);
            String selected = (String) attempt.getAnswerState().get(answerKey(canonicalId));
            boolean isUnanswered = selected == null || selected.isBlank();
            boolean isCorrect = !isUnanswered && selected.equalsIgnoreCase(q.getCorrectOption());

            if (isUnanswered) unanswered++;
            else if (isCorrect) correct++;
            else incorrect++;

            String topic = q.getTopic() != null ? q.getTopic() : "General";
            topicTotals.computeIfAbsent(topic, t -> new int[2]);
            topicTotals.get(topic)[1]++;
            if (isCorrect) topicTotals.get(topic)[0]++;

            questionResults.add(QuestionResult.builder()
                    .index(i).yourAnswer(isUnanswered ? null : selected).correctAnswer(q.getCorrectOption())
                    .correct(isCorrect).unanswered(isUnanswered).explanation(q.getExplanation())
                    .topic(topic).difficulty(q.getDifficulty() != null ? q.getDifficulty().name() : null)
                    .build());
        }

        double points = profile.getPointsPerCorrect();
        double penalty = profile.isNegativeMarkingEnabled() ? profile.getNegativeMarkingPenalty() : 0.0;
        double rawScore = (correct * points) - (incorrect * penalty);
        double maxScore = canonicalIds.size() * points;

        List<TopicBreakdown> breakdown = topicTotals.entrySet().stream()
                .map(e -> TopicBreakdown.builder()
                        .topic(e.getKey())
                        .correct(e.getValue()[0])
                        .total(e.getValue()[1])
                        .accuracyPercent(e.getValue()[1] == 0 ? 0 : Math.round((e.getValue()[0] * 10000.0) / e.getValue()[1]) / 100.0)
                        .build())
                .toList();

        return SubmitResult.builder()
                .rawScore(rawScore)
                .maxPossibleScore(maxScore)
                .scorePercent(maxScore == 0 ? 0 : Math.round((Math.max(0, rawScore) * 10000.0) / maxScore) / 100.0)
                .correctCount(correct).incorrectCount(incorrect).unansweredCount(unanswered)
                .topicBreakdown(breakdown)
                .questionResults(questionResults)
                .build();
    }

    // ---------------------------------------------------------------------------------------

    private AssessmentAttempt requireAptitudeAttempt(User candidate, Long attemptId) {
        AssessmentAttempt attempt = engineService.getOwnedAttempt(candidate, attemptId);
        if (attempt.getAssessmentType() != AssessmentType.APTITUDE_MOCK_TEST) {
            throw ApiException.badRequest("Attempt " + attemptId + " is not an aptitude mock test");
        }
        return attempt;
    }

    private Long questionIdAt(AssessmentAttempt attempt, int index) {
        List<Long> ids = attempt.getSelectedQuestionIds();
        if (index < 0 || index >= ids.size()) {
            throw ApiException.badRequest("Question index " + index + " is out of range for this attempt (" + ids.size() + " questions)");
        }
        return ids.get(index);
    }

    private AptitudeQuestion resolveQuestion(Long canonicalId) {
        return aptitudeQuestionRepository.findByCanonicalQuestionId(canonicalId)
                .orElseThrow(() -> ApiException.badRequest(
                        "This question (canonical id " + canonicalId + ") does not yet have curated aptitude content."));
    }

    private String answerKey(Long canonicalId) { return "opt_" + canonicalId; }
}
