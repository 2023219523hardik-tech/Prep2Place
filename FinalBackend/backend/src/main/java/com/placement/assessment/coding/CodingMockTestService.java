package com.placement.assessment.coding;

import com.placement.assessment.coding.CodingMockTestDtos.*;
import com.placement.assessment.entity.AssessmentAttempt;
import com.placement.assessment.entity.AssessmentType;
import com.placement.assessment.repository.AssessmentAttemptRepository;
import com.placement.assessment.service.AssessmentEngineService;
import com.placement.dto.CodingDtos.*;
import com.placement.entity.CodingProblem;
import com.placement.entity.CodingSubmission;
import com.placement.entity.Difficulty;
import com.placement.entity.User;
import com.placement.exception.ApiException;
import com.placement.questionbank.entity.CanonicalQuestion;
import com.placement.questionbank.repository.CanonicalQuestionRepository;
import com.placement.repository.CodingProblemRepository;
import com.placement.repository.CodingSubmissionRepository;
import com.placement.service.CodingRunnerService;
import com.placement.service.CodingService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.StringJoiner;

/**
 * Adapts the generic AssessmentEngineService + shared coding runner into the specific Coding Mock
 * Test experience: per-question workspace (problem + saved code + submission history + question
 * nav with solved state), Run Code (non-authoritative, visible/custom tests only), and Submit Code
 * (authoritative, server-computed score written onto the AssessmentAttempt - never trusts anything
 * the frontend claims about pass/fail).
 */
@Service
@RequiredArgsConstructor
public class CodingMockTestService {

    private final AssessmentEngineService engineService;
    private final AssessmentAttemptRepository attemptRepository;
    private final CanonicalQuestionRepository canonicalQuestionRepository;
    private final CodingProblemRepository codingProblemRepository;
    private final CodingSubmissionRepository codingSubmissionRepository;
    private final CodingRunnerService codingRunnerService;
    private final CodingService codingService;
    private final com.fasterxml.jackson.databind.ObjectMapper objectMapper;

    public WorkspaceView getWorkspace(User candidate, Long attemptId, int index) {
        AssessmentAttempt attempt = requireCodingAttempt(candidate, attemptId);
        Long canonicalId = questionIdAt(attempt, index);
        CodingProblem problem = resolveGradableProblem(canonicalId);

        String key = answerKey(canonicalId);
        String savedCode = (String) attempt.getAnswerState().get(key);
        String savedLanguage = attempt.getLanguageState().get(key);
        boolean solved = Boolean.TRUE.equals(attempt.getAnswerState().get(solvedKey(canonicalId)));

        List<SubmissionResponse> history = codingSubmissionRepository
                .findByAttemptIdAndProblemIdOrderBySubmittedAtDesc(attemptId, problem.getId())
                .stream().map(this::toResponse).toList();

        return WorkspaceView.builder()
                .index(index)
                .totalQuestions(attempt.getSelectedQuestionIds().size())
                .problem(codingService.problemMetadata(problem.getId()))
                .savedCode(savedCode)
                .savedLanguage(savedLanguage)
                .solved(solved)
                .submissionHistory(history)
                .navigation(buildNavigation(attempt))
                .build();
    }

    public RunCodeResponse runCode(User candidate, Long attemptId, int index, RunRequest request) {
        AssessmentAttempt attempt = requireCodingAttempt(candidate, attemptId);
        if (attempt.isTerminalState()) {
            throw ApiException.conflict("Cannot run code: this attempt is already " + attempt.getStatus());
        }
        Long canonicalId = questionIdAt(attempt, index);
        CodingProblem problem = resolveGradableProblem(canonicalId);

        List<CodeTestCase> visibleTests = new java.util.ArrayList<>();
        visibleTests.add(new CodeTestCase("Sample 1", problem.getSampleInput(), problem.getSampleOutput(), false));
        if (request.getCustomInput() != null && !request.getCustomInput().isBlank()) {
            visibleTests.add(new CodeTestCase("Custom Input", request.getCustomInput(), null, false));
        }

        RunCodeResponse result = codingRunnerService.run(problem, request.getLanguage(), request.getCode(), visibleTests, false);

        // Autosave whatever was run, whether it passed or not - candidates shouldn't lose work.
        engineService.autosave(candidate, attemptId,
                Map.of(answerKey(canonicalId), request.getCode()),
                Map.of(answerKey(canonicalId), request.getLanguage()));

        return result;
    }

    @Transactional
    public SubmitResult submitCode(User candidate, Long attemptId, int index, SubmitRequest request) {
        AssessmentAttempt attempt = requireCodingAttempt(candidate, attemptId);
        if (attempt.isTerminalState()) {
            throw ApiException.conflict("Cannot submit: this attempt is already " + attempt.getStatus());
        }
        Long canonicalId = questionIdAt(attempt, index);
        CodingProblem problem = resolveGradableProblem(canonicalId);

        // Authoritative run: includes the single visible sample plus every real hidden example
        // authored for the problem (ProblemExample.hidden == true). Server decides pass/fail and
        // score - nothing about correctness is ever taken from the request body. Falls back to the
        // sample case only when no hidden examples exist, rather than fabricating a duplicate.
        List<CodeTestCase> tests = new java.util.ArrayList<>();
        tests.add(new CodeTestCase("Sample 1", problem.getSampleInput(), problem.getSampleOutput(), false));
        problem.getExamples().stream()
                .filter(com.placement.entity.ProblemExample::isHidden)
                .forEach(ex -> tests.add(new CodeTestCase(ex.getTitle(), ex.getInput(), ex.getOutput(), true)));

        RunCodeResponse execution = codingRunnerService.run(problem, request.getLanguage(), request.getCode(), tests, true);

        boolean accepted = "SUCCESS".equals(execution.status());
        int scorePercent = execution.total() == null || execution.total() == 0
                ? 0 : (int) Math.round((execution.passed() * 100.0) / execution.total());

        CodingSubmission submission = CodingSubmission.builder()
                .student(candidate).problem(problem).code(request.getCode()).language(request.getLanguage())
                .verdict(accepted ? "PASSED" : execution.status()).score(scorePercent)
                .attemptId(attemptId).attemptQuestionIndex(index)
                .executionDetails(objectMapper.convertValue(execution, new com.fasterxml.jackson.core.type.TypeReference<Map<String, Object>>() {}))
                .build();
        codingSubmissionRepository.save(submission);

        String solvedKey = solvedKey(canonicalId);
        boolean alreadySolved = Boolean.TRUE.equals(attempt.getAnswerState().get(solvedKey));
        boolean firstTimeSolved = accepted && !alreadySolved;

        attempt.getAnswerState().put(answerKey(canonicalId), request.getCode());
        attempt.getLanguageState().put(answerKey(canonicalId), request.getLanguage());
        if (accepted) attempt.getAnswerState().put(solvedKey, true);

        if (firstTimeSolved) {
            double points = ((Number) attempt.getConfigSnapshot().getOrDefault("pointsPerCorrect", 1.0)).doubleValue();
            attempt.setRawScore(attempt.getRawScore() + points);
        }
        attemptRepository.save(attempt);

        return SubmitResult.builder()
                .accepted(accepted)
                .execution(execution)
                .firstTimeSolved(firstTimeSolved)
                .attemptRawScore(attempt.getRawScore())
                .attemptMaxScore(attempt.getMaxPossibleScore())
                .build();
    }

    // ---------------------------------------------------------------------------------------

    private AssessmentAttempt requireCodingAttempt(User candidate, Long attemptId) {
        AssessmentAttempt attempt = engineService.getOwnedAttempt(candidate, attemptId);
        if (attempt.getAssessmentType() != AssessmentType.CODING_MOCK_TEST) {
            throw ApiException.badRequest("Attempt " + attemptId + " is not a coding mock test");
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

    private CodingProblem resolveGradableProblem(Long canonicalId) {
        return codingProblemRepository.findByCanonicalQuestionId(canonicalId)
                .orElseGet(() -> {
                    Optional<CanonicalQuestion> q = canonicalQuestionRepository.findById(canonicalId);
                    String title = q.map(CanonicalQuestion::getCanonicalTitle).orElse("Question " + canonicalId);
                    Difficulty difficulty = q.map(CanonicalQuestion::getDifficulty).orElse(Difficulty.MEDIUM);
                    if (difficulty == null) difficulty = Difficulty.MEDIUM;
                    String statement = q.map(CanonicalQuestion::getDescription).orElse("Question description unavailable for canonical id " + canonicalId + ". This problem was materialized on-demand from the question bank; admin review and editorial content will be added in a future seed refresh.");
                    String sampleInput = q.map(CanonicalQuestion::getInputFormat).orElse(null);
                    String sampleOutput = q.map(CanonicalQuestion::getOutputFormat).orElse(null);
                    String companyCsv = q.filter(cq -> cq.getCompanies() != null && !cq.getCompanies().isEmpty())
                            .map(cq -> {
                                StringJoiner sj = new StringJoiner(", ");
                                cq.getCompanies().forEach(sj::add);
                                return sj.toString();
                            }).orElse(null);
                    String topic = q.filter(cq -> cq.getTopics() != null && !cq.getTopics().isEmpty())
                            .map(cq -> cq.getTopics().get(0)).orElse("General");
                    CodingProblem created = CodingProblem.builder()
                            .canonicalQuestionId(canonicalId)
                            .title(title)
                            .difficulty(difficulty)
                            .statement(statement)
                            .category("DSA")
                            .topic(topic)
                            .sampleInput(sampleInput)
                            .sampleOutput(sampleOutput)
                            .companyTags(companyCsv)
                            .active(true)
                            .acceptanceRate(56.4)
                            .timeLimitMs(1000)
                            .memoryLimitMb(256)
                            .build();
                    return codingProblemRepository.save(created);
                });
    }

    private List<QuestionNavItem> buildNavigation(AssessmentAttempt attempt) {
        List<QuestionNavItem> nav = new java.util.ArrayList<>();
        List<Long> ids = attempt.getSelectedQuestionIds();
        for (int i = 0; i < ids.size(); i++) {
            Long id = ids.get(i);
            Optional<CanonicalQuestion> q = canonicalQuestionRepository.findById(id);
            boolean solved = Boolean.TRUE.equals(attempt.getAnswerState().get(solvedKey(id)));
            boolean attempted = attempt.getAnswerState().containsKey(answerKey(id));
            nav.add(QuestionNavItem.builder()
                    .index(i)
                    .canonicalQuestionId(id)
                    .title(q.map(CanonicalQuestion::getCanonicalTitle).orElse("Question " + id))
                    .difficulty(q.map(cq -> cq.getDifficulty() != null ? cq.getDifficulty().name() : "MEDIUM").orElse("MEDIUM"))
                    .solved(solved)
                    .attempted(attempted)
                    .build());
        }
        return nav;
    }

    private String answerKey(Long canonicalId) { return "code_" + canonicalId; }
    private String solvedKey(Long canonicalId) { return "solved_" + canonicalId; }

    private SubmissionResponse toResponse(CodingSubmission s) {
        return new SubmissionResponse(s.getId(), s.getProblem().getId(), s.getProblem().getTitle(),
                s.getVerdict(), s.getScore(), s.getSubmittedAt().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));
    }
}
