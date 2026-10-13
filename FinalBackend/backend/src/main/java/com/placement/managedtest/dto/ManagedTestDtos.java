package com.placement.managedtest.dto;

import com.placement.entity.Difficulty;
import com.placement.managedtest.entity.*;
import jakarta.validation.constraints.*;

import java.time.Instant;
import java.util.List;
import java.util.Map;

/**
 * Request/response records for the managed-test module. Single-file *Dtos container to match the
 * existing convention (AdminDtos, AssessmentDtos, CodingDtos, ...).
 */
public final class ManagedTestDtos {

    private ManagedTestDtos() {}

    // ------------------------------------------------------------------ admin: test CRUD

    public record TestUpsertRequest(
            @NotBlank @Size(max = 250) String name,
            @NotNull TestType testType,
            @Size(max = 2000) String description,
            String instructions,
            @Size(max = 200) String organizationName,
            @Size(max = 50) String organizationCode,
            @Size(max = 50) String batch,
            @Size(max = 100) String branch,
            Integer graduationYear,
            Long targetJobRoleId,
            Difficulty difficulty,
            @Min(1) @Max(600) Integer durationMinutes,
            @DecimalMin("0") @DecimalMax("100") Double passingPercentage,
            Boolean negativeMarkingEnabled,
            @DecimalMin("0") Double defaultNegativeMarks,
            Boolean overallTimerEnabled,
            Boolean sectionTimersEnabled,
            @Min(0) Integer attemptLimit,
            Boolean shuffleSections,
            Boolean showResultToStudent,
            Instant startsAt,
            Instant endsAt,
            Boolean proctored,
            Boolean fullscreenRequired,
            Boolean webcamRequired,
            @Min(0) Integer violationCountThreshold
    ) {}

    public record TestSummaryResponse(
            Long id, String name, TestType testType, TestStatus status, String organizationName,
            String batch, String branch, Integer graduationYear, Difficulty difficulty,
            int durationMinutes, double totalMarks, double passingPercentage,
            int sectionCount, int questionCount, int assignedStudentCount, long attemptCount,
            Instant startsAt, Instant endsAt, Instant createdAt, Instant updatedAt, String createdBy
    ) {}

    public record TestDetailResponse(
            TestSummaryResponse summary,
            String description,
            String instructions,
            Long targetJobRoleId,
            String targetJobRoleTitle,
            boolean negativeMarkingEnabled,
            double defaultNegativeMarks,
            boolean overallTimerEnabled,
            boolean sectionTimersEnabled,
            int attemptLimit,
            boolean shuffleSections,
            boolean showResultToStudent,
            boolean proctored,
            boolean fullscreenRequired,
            boolean webcamRequired,
            int violationCountThreshold,
            List<SectionResponse> sections,
            ValidationReport validation
    ) {}

    // ------------------------------------------------------------------ admin: sections

    public record SectionUpsertRequest(
            @NotBlank @Size(max = 150) String name,
            @NotNull SectionType sectionType,
            @Size(max = 1000) String instructions,
            Integer displayOrder,
            @Min(0) Integer questionCount,
            @Min(0) Integer durationMinutes,
            @DecimalMin("0") Double marksPerQuestion,
            @DecimalMin("0") Double negativeMarks,
            Double passingPercentage,
            Boolean mandatory,
            Boolean randomizeQuestions,
            Boolean randomizeOptions,
            Boolean allowBackNavigation,
            SelectionStrategy selectionStrategy,
            Map<String, Object> selectionRules
    ) {}

    public record SectionResponse(
            Long id, String name, SectionType sectionType, String instructions, int displayOrder,
            int questionCount, int attachedQuestionCount, int durationMinutes,
            double marksPerQuestion, double negativeMarks, Double passingPercentage,
            boolean mandatory, boolean randomizeQuestions, boolean randomizeOptions,
            boolean allowBackNavigation, SelectionStrategy selectionStrategy,
            Map<String, Object> selectionRules, double attachedMarks,
            List<QuestionResponse> questions
    ) {}

    public record SectionReorderRequest(@NotEmpty List<Long> sectionIdsInOrder) {}

    // ------------------------------------------------------------------ admin: questions

    /** Adds existing Question Bank questions to a section. */
    public record AddBankQuestionsRequest(
            @NotNull QuestionSourceType sourceType,
            @NotEmpty List<Long> questionIds,
            Double marksOverride,
            Double negativeMarksOverride
    ) {}

    /** Creates a question that lives inside this test, optionally also pushing it to the bank. */
    public record CustomQuestionRequest(
            @NotNull TestQuestionType questionType,
            @NotBlank @Size(max = 500) String title,
            Difficulty difficulty,
            String topic,
            String subtopic,
            @DecimalMin("0") Double marks,
            @DecimalMin("0") Double negativeMarks,
            @Min(0) Integer estimatedTimeSeconds,
            Integer displayOrder,
            @NotNull Map<String, Object> payload,
            /** When true the question is also written to the Question Bank for future re-use.
             *  The copy inside the test stays independent either way. */
            Boolean saveToQuestionBank,
            /** Required when saveToQuestionBank is true and the type is MCQ. */
            String bankCategory
    ) {}

    public record QuestionResponse(
            Long id, TestQuestionType questionType, QuestionOrigin origin,
            QuestionSourceType sourceType, Long sourceQuestionId,
            String title, Difficulty difficulty, String topic, String subtopic,
            double marks, double negativeMarks, int estimatedTimeSeconds, int displayOrder,
            Map<String, Object> payload
    ) {}

    public record QuestionReorderRequest(@NotEmpty List<Long> questionIdsInOrder) {}

    /** Resolves a section's auto-selection rules and attaches the resulting questions. */
    public record AutoFillRequest(
            QuestionSourceType sourceType,
            Map<String, Integer> difficultyDistribution,
            Map<String, Integer> categoryDistribution,
            List<String> topics,
            List<String> companies,
            @Min(1) Integer count,
            /** Keeps questions already attached and only tops up the shortfall. */
            Boolean keepExisting
    ) {}

    public record AutoFillResponse(int requested, int added, int shortfall, List<String> notes) {}

    // ------------------------------------------------------------------ admin: question bank picker

    public record BankQuestionResponse(
            Long id, QuestionSourceType sourceType, String title, String preview,
            TestQuestionType questionType, String category, String topic, String subtopic,
            Difficulty difficulty, double defaultMarks, double defaultNegativeMarks,
            List<String> companies, List<String> tags, String source, long usageCount,
            boolean alreadyInTest
    ) {}

    public record BankFacetsResponse(
            List<String> technicalCategories,
            List<String> aptitudeTopics,
            List<String> difficulties,
            List<String> sourceTypes,
            Map<String, Long> countsByCategory
    ) {}

    // ------------------------------------------------------------------ publishing / validation

    public record ValidationReport(boolean publishable, List<String> errors, List<String> warnings) {}

    public record AssignRequest(
        @NotEmpty List<Long> studentIds,
        String reason
) {}

public record AssignmentResponse(
        Long id,
        Long studentId,
        String studentName,
        String studentEmail,
        Instant assignedAt,
        String attemptStatus,
        Double bestPercentage,
        boolean active,
        Instant revokedAt,
        String revokedBy,
        String reason
) {}

public record UnassignResponse(
        boolean revoked,
        boolean hasActiveAttempt
) {}

    public record DuplicateRequest(String newName) {}

    // ------------------------------------------------------------------ student-facing

    public record StudentTestCardResponse(
            Long testId, String name, TestType testType, String organizationName,
            int durationMinutes, int sectionCount, int questionCount, double totalMarks,
            double passingPercentage, Instant startsAt, Instant endsAt,
            int attemptLimit, int attemptsUsed, boolean attemptable, String attemptStatus,
            Long activeAttemptId, Double bestPercentage, List<String> sectionNames
    ) {}

    public record StartAttemptRequest(Long testId) {}

    /** The live attempt view. Correct answers and explanations are stripped until submission. */
    public record AttemptViewResponse(
            Long attemptId, Long testId, String testName, TestType testType, String instructions,
            String status, int attemptNumber, Instant startedAt, Instant serverExpiresAt,
            long remainingSeconds, boolean overallTimerEnabled, boolean sectionTimersEnabled,
            boolean proctored, boolean fullscreenRequired, boolean webcamRequired,
            List<AttemptSectionView> sections, Map<String, SavedAnswerView> answers
    ) {}

    public record AttemptSectionView(
            Long sectionId, String name, SectionType sectionType, String instructions,
            int displayOrder, int durationMinutes, Long expiresAtEpochMillis, boolean submitted,
            boolean allowBackNavigation, List<QuestionResponse> questions
    ) {}

    public record SavedAnswerView(Map<String, Object> response, boolean markedForReview, int timeSpentSeconds) {}

    public record SaveAnswerRequest(
            @NotNull Long questionId,
            @NotNull Long sectionId,
            Map<String, Object> response,
            Boolean markedForReview,
            @Min(0) Integer timeSpentSeconds
    ) {}

    public record BulkSaveRequest(@NotEmpty List<SaveAnswerRequest> answers) {}

    public record SubmitSectionRequest(@NotNull Long sectionId) {}

    // ------------------------------------------------------------------ results

    public record AttemptResultResponse(
            Long attemptId, Long testId, String testName, TestType testType,
            Long studentId, String studentName,
            String status, int attemptNumber,
            Instant startedAt, Instant submittedAt, long durationSeconds,
            double scoredMarks, double totalMarks, double percentage, double accuracy,
            int correctCount, int wrongCount, int unattemptedCount, int pendingReviewCount,
            boolean passed, Double percentile, int violationCount, int integrityScore,
            List<SectionResultView> sectionResults,
            List<QuestionResultView> questionResults,
            Map<String, Object> analytics
    ) {}

    public record SectionResultView(
            Long sectionId, String name, SectionType sectionType,
            double scoredMarks, double totalMarks, double percentage, double accuracy,
            int correctCount, int wrongCount, int unattemptedCount, Boolean passed
    ) {}

    public record QuestionResultView(
            Long questionId, Long sectionId, String title, TestQuestionType questionType,
            Difficulty difficulty, String topic,
            double marks, double marksAwarded, Boolean correct, String evaluationStatus,
            Map<String, Object> response, Map<String, Object> solution, String evaluationNote
    ) {}

    public record AttemptSummaryResponse(
            Long attemptId, Long testId, String testName, TestType testType,
            Long studentId, String studentName, String studentEmail,
            String status, int attemptNumber, Instant startedAt, Instant submittedAt,
            double scoredMarks, double totalMarks, double percentage, double accuracy,
            boolean passed, int violationCount, int integrityScore
    ) {}

    // ------------------------------------------------------------------ analytics

    public record TestAnalyticsResponse(
            long totalTests, long publishedTests, long activeTests, long draftTests,
            long universityTests, long customTests, long technicalTests, long completedTests,
            long totalAttempts, double averageScore, double averageAccuracy, double passRate
    ) {}

    public record TestActivityResponse(
            long attemptedToday, long completedToday,
            List<AttemptSummaryResponse> recentSubmissions,
            List<TestLeaderboardRow> mostAttempted,
            List<TestLeaderboardRow> lowestPerforming
    ) {}

    public record TestLeaderboardRow(Long testId, String testName, long attempts, double averagePercentage) {}

    public record IntegritySummaryResponse(
            long totalViolations, long studentsRequiringReview,
            List<ViolationRow> recentViolations, double averageIntegrityScore
    ) {}

    public record ViolationRow(Long eventId, Long attemptId, Long studentId, String studentName,
                               Long testId, String testName, String eventType, int severity,
                               Instant occurredAt, String details) {}

    public record ViolationReportRequest(
            @NotNull String eventType,
            Integer severity,
            String details,
            Double durationSeconds,
            Map<String, Object> metadata
    ) {}

    public record StudentProgressResponse(
            Long studentId, String studentName,
            int testsAttempted, int testsCompleted, int questionsAttempted, int questionsCorrect,
            double overallAccuracy, double averagePercentage,
            Map<String, Double> sectionTypePerformance,
            Map<String, Double> topicPerformance,
            Map<String, Double> difficultyPerformance,
            List<ReadinessPoint> readinessTrend,
            List<AttemptSummaryResponse> recentAttempts
    ) {}

    public record ReadinessPoint(Instant at, String testName, double percentage) {}

    // ------------------------------------------------------------------ live monitoring
    // Previously no live-monitoring surface existed at all in this module. These read the
    // already-existing ManagedTestAttempt/IntegrityEvent data (see
    // ManagedTestLiveMonitoringService's class javadoc) rather than inventing a parallel
    // progress-tracking or proctoring system.

    public record LiveStudentSummary(Long attemptId, Long studentId, String studentName, String studentEmail,
            Instant startedAt, Instant serverExpiresAt, int violationCount, int integrityScore, String status) {}

    public record LiveIntegrityEventView(Long id, String eventType, String classification, Instant occurredAt,
            Integer severity, String details, boolean evidenceAvailable) {}

    public record LiveStudentDetail(Long attemptId, Long studentId, String studentName, String studentEmail,
            Instant startedAt, Instant serverExpiresAt, int violationCount, int integrityScore, String status,
            Map<String, Object> sectionState, List<LiveIntegrityEventView> recentEvents) {}

}