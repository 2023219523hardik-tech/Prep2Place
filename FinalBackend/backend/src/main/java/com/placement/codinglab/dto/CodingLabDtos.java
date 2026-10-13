package com.placement.codinglab.dto;

import com.placement.codinglab.entity.*;
import com.placement.codinglab.model.RequirementSpec;
import com.placement.codinglab.model.TestCaseResult;

import java.time.Instant;
import java.util.*;

public class CodingLabDtos {

    private CodingLabDtos() {}

    // =================================================================================== student ==

    public record RequirementView(String id, String title, String description, double weight) {
        public static RequirementView from(RequirementSpec r) {
            return new RequirementView(r.id(), r.title(), r.description() == null ? "" : r.description(), r.weightOrDefault());
        }
    }

    public record AssessmentSummaryView(Long id, String title, String summary, CodingType codingType,
                                        CodingDifficulty difficulty, CodingRuntime runtime, String technology,
                                        int timeLimitMinutes, double maxScore, boolean aiAssistantEnabled,
                                        List<String> skills, List<String> tags, int requirementCount,
                                        Long activeAttemptId, Double bestScore, int attemptCount) {
        public static AssessmentSummaryView from(CodingAssessment a, Long activeAttemptId, Double bestScore, int attemptCount) {
            return new AssessmentSummaryView(a.getId(), a.getTitle(), a.getDescription(), a.getCodingType(), a.getDifficulty(),
                    a.getRuntime(), a.getTechnology(), a.getTimeLimitMinutes(), a.getMaxScore(), a.isAiAssistantEnabled(),
                    a.getSkills() == null ? List.of() : a.getSkills(), a.getTags() == null ? List.of() : a.getTags(),
                    a.getRequirements() == null ? 0 : a.getRequirements().size(), activeAttemptId, bestScore, attemptCount);
        }
    }

    /** A single test as a candidate may see it. Hidden tests are never represented by this type. */
    public record TestCaseView(String name, String requirementId, String status, String message) {
        public static TestCaseView from(TestCaseResult c) {
            return new TestCaseView(c.name(), c.requirementId(), c.status().name(), c.message());
        }
    }

    public record RequirementResultView(String id, String title, String status, int passed, int total, double weight) {}

    /**
     * Student-safe result of a Run or Submit. Hidden tests appear ONLY as aggregate counts and as part of a
     * requirement's pass-rate; their names, messages and output are never included.
     */
    public record RunResultView(Long submissionId, CodingSubmissionKind kind, CodingSubmissionStatus status,
                                int runtimeMs, double score, double maxScore, int testsTotal, int testsPassed,
                                List<TestCaseView> publicTests, Integer hiddenTotal, Integer hiddenPassed,
                                List<RequirementResultView> requirements, String buildLog, String output,
                                String message, Instant submittedAt) {

        public static RunResultView from(CodingLabSubmission s, double maxScore) {
            List<TestCaseResult> cases = s.cases();
            List<TestCaseView> pub = cases.stream().filter(c -> !c.hidden()).map(TestCaseView::from).toList();
            boolean submit = s.getKind() == CodingSubmissionKind.SUBMIT;
            long hiddenTotal = cases.stream().filter(TestCaseResult::hidden).count();
            long hiddenPassed = cases.stream().filter(c -> c.hidden() && c.passed()).count();
            List<RequirementResultView> reqs = null;
            if (submit && s.getRequirementReport() != null && !s.getRequirementReport().isEmpty()) {
                reqs = s.getRequirementReport().stream().map(m -> new RequirementResultView(
                        String.valueOf(m.get("id")), String.valueOf(m.get("title")), String.valueOf(m.get("status")),
                        num(m.get("passed")), num(m.get("total")), m.get("weight") instanceof Number n ? n.doubleValue() : 1.0)).toList();
            }
            return new RunResultView(s.getId(), s.getKind(), s.getStatus(), s.getRuntimeMs(), s.getScore(), maxScore,
                    s.getTestsTotal(), s.getTestsPassed(), pub, submit ? (int) hiddenTotal : null, submit ? (int) hiddenPassed : null,
                    reqs, s.getCompilationError(), s.getPublicOutput(), s.getRuntimeError(), s.getSubmittedAt());
        }

        private static int num(Object o) { return o instanceof Number n ? n.intValue() : 0; }
    }

    public record WorkspaceView(Long attemptId, Long assessmentId, String title, CodingType codingType, CodingRuntime runtime,
                                String summary, String problemStatement, List<RequirementView> requirements,
                                Map<String, String> files, Map<String, String> publicTestFiles, CodingAttemptStatus status,
                                Instant startedAt, Instant expiresAt, Instant serverNow, int timeLimitMinutes,
                                double maxScore, double bestScore, int aiHintsUsed, int aiHintsRemaining,
                                boolean aiAssistantEnabled, RunResultView lastResult) {
    }

    public record SaveFilesRequest(Map<String, String> files) {}

    public record RunRequest(Map<String, String> files) {}

    public record SaveAck(Instant savedAt) {}

    public record SubmissionSummaryView(Long id, CodingSubmissionKind kind, CodingSubmissionStatus status,
                                        double score, int testsPassed, int testsTotal, Instant submittedAt) {
        public static SubmissionSummaryView from(CodingLabSubmission s) {
            return new SubmissionSummaryView(s.getId(), s.getKind(), s.getStatus(), s.getScore(),
                    s.getTestsPassed(), s.getTestsTotal(), s.getSubmittedAt());
        }
    }

    public record AttemptHistoryView(Long attemptId, Long assessmentId, String title, CodingType codingType,
                                     CodingAttemptStatus status, double bestScore, double maxScore, Instant startedAt,
                                     Instant expiresAt, Instant completedAt) {
        public static AttemptHistoryView from(CodingAttempt a) {
            return new AttemptHistoryView(a.getId(), a.getAssessment().getId(), a.getAssessment().getTitle(),
                    a.getAssessment().getCodingType(), a.getStatus(), a.getBestScore(), a.getAssessment().getMaxScore(),
                    a.getStartedAt(), a.getExpiresAt(), a.getCompletedAt());
        }
    }

    public record HintRequest(String message) {}

    public record HintResponseView(AiHintClassification classification, AiHintResponseType responseType,
                                   String text, int hintsUsed, int hintsRemaining, int requestsRemaining) {}

    public record AiUsageView(int hintsUsed, int maxHints, int requestsUsed, int maxRequests,
                              int cooldownSeconds, List<AiHintInteractionView> interactions) {}

    public record AiHintInteractionView(Instant requestedAt, String studentMessage,
                                        AiHintClassification classification, AiHintResponseType responseType,
                                        boolean blocked) {
        public static AiHintInteractionView from(AiHintInteraction i) {
            return new AiHintInteractionView(i.getRequestedAt(), i.getStudentMessage(), i.getClassification(),
                    i.getResponseType(), i.isBlocked());
        }
    }

    // ===================================================================================== admin ==

    public record AssessmentAdminSummary(Long id, String title, CodingType codingType, CodingDifficulty difficulty,
                                         CodingRuntime runtime, CodingAssessmentStatus status, ValidationStatus validationStatus,
                                         boolean verificationCurrent, AssessmentSource source, int timeLimitMinutes,
                                         int requirementCount, boolean legacy, Instant updatedAt) {
        public static AssessmentAdminSummary from(CodingAssessment a) {
            return new AssessmentAdminSummary(a.getId(), a.getTitle(), a.getCodingType(), a.getDifficulty(), a.getRuntime(),
                    a.getStatus(), a.getValidationStatus(), a.verificationIsCurrent(), a.getSource(), a.getTimeLimitMinutes(),
                    a.getRequirements() == null ? 0 : a.getRequirements().size(), a.isLegacy(), a.getUpdatedAt());
        }
    }

    /** Everything about a question including hidden tests and the reference solution - admin only. */
    public record AssessmentAdminView(Long id, String title, String summary, String problemStatement, CodingType codingType,
                                      CodingDifficulty difficulty, CodingRuntime runtime, CodingAssessmentStatus status,
                                      String technology, String targetJobRole, int timeLimitMinutes, int memoryLimitMb,
                                      int executionTimeoutSeconds, double maxScore, List<RequirementSpec> requirements,
                                      Map<String, String> starterFiles, Map<String, String> publicTestFiles,
                                      Map<String, String> hiddenTestFiles, Map<String, String> referenceFiles,
                                      List<String> skills, List<String> tags, boolean aiAssistantEnabled, int aiMaxHints,
                                      int aiMaxRequests, int aiCooldownSeconds, AssessmentSource source,
                                      Map<String, Object> generationMeta, ValidationStatus validationStatus,
                                      boolean verificationCurrent, Map<String, Object> validationReport, Instant validatedAt,
                                      List<Map<String, Object>> issues, boolean publishable, boolean legacy,
                                      Instant createdAt, Instant updatedAt) {
    }

    /** Partial-update semantics: null = leave unchanged. Only title/codingType/difficulty/runtime are needed to save a draft. */
    public record AssessmentUpsertRequest(String title, CodingType codingType, CodingDifficulty difficulty, CodingRuntime runtime,
                                          String summary, String problemStatement, List<RequirementSpec> requirements,
                                          Map<String, String> starterFiles, Map<String, String> publicTestFiles,
                                          Map<String, String> hiddenTestFiles, Map<String, String> referenceFiles,
                                          String technology, String targetJobRole, List<String> skills, List<String> tags,
                                          Integer timeLimitMinutes, Integer memoryLimitMb, Integer executionTimeoutSeconds,
                                          Double maxScore, Boolean aiAssistantEnabled, Integer aiMaxHints,
                                          Integer aiMaxRequests, Integer aiCooldownSeconds) {}

    public record GenerateRequest(CodingType codingType, CodingDifficulty difficulty, CodingRuntime runtime, String topic,
                                  String scenario, String targetJobRole, List<String> skills, Integer timeLimitMinutes,
                                  Integer requirementCount, String extraInstructions) {}

    public record JobView(String id, String kind, String state, String message, Long assessmentId,
                          Map<String, Object> result, Instant startedAt, Instant finishedAt) {}

    public record SubmissionAdminView(Long id, Long attemptId, Long candidateId, String candidateName,
                                      CodingSubmissionKind kind, CodingSubmissionStatus status, double score,
                                      int testsPassed, int testsTotal, int runtimeMs, Instant submittedAt) {
        public static SubmissionAdminView from(CodingLabSubmission s) {
            String name = s.getCandidate() != null ? s.getCandidate().getFullName() : null;
            return new SubmissionAdminView(s.getId(), s.getAttemptId(), s.getCandidate().getId(), name,
                    s.getKind(), s.getStatus(), s.getScore(), s.getTestsPassed(), s.getTestsTotal(),
                    s.getRuntimeMs(), s.getSubmittedAt());
        }
    }

    public record CodingAnalyticsView(long totalAssessments, long totalSubmissions, double averageScore,
                                      double testPassRate, double averageExecutionTimeMs,
                                      Map<CodingType, Double> performanceByType,
                                      List<Map<String, Object>> mostDifficultAssessments,
                                      long aiHintsGranted, long aiRequestsBlocked) {}

    /** What the admin UI needs in order to ask for the RIGHT things when creating a question. */
    public record AuthoringSchema(List<Map<String, Object>> types, List<Map<String, Object>> runtimes,
                                  Map<String, Object> rules, boolean llmConfigured, String llmProvider, String llmModel) {}
}
