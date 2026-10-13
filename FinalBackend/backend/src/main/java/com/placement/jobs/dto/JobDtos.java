package com.placement.jobs.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public class JobDtos {

    public record JobListRequest(String search, String employmentType, String experienceLevel,
                                 Integer page, Integer size) {}

    public record JobSummary(Long id, String title, String company, String location,
                             String employmentType, String experienceLevel,
                             Double salaryMinLpa, Double salaryMaxLpa,
                             String requiredSkills, LocalDateTime postedAt,
                             LocalDate closesAt, boolean active, long applicantCount) {}

    public record JobDetail(Long id, String title, String company, String location,
                            String employmentType, String experienceLevel,
                            Double salaryMinLpa, Double salaryMaxLpa,
                            String description, String requiredSkills, String niceToHaveSkills,
                            String applyUrl, LocalDateTime postedAt, LocalDate closesAt,
                            boolean active, boolean alreadyApplied, long applicantCount) {}

    public record JobUpsertRequest(String title, String company, String location,
                                   String employmentType, String experienceLevel,
                                   Double salaryMinLpa, Double salaryMaxLpa,
                                   String description, String requiredSkills,
                                   String niceToHaveSkills, String applyUrl,
                                   LocalDate closesAt, Boolean active) {}

    public record ApplyRequest(String resumeText, String coverNote) {}

    public record ApplicationResponse(
            Long id,
            Long jobId,
            String jobTitle,
            String company,
            String status,
            LocalDateTime appliedAt,
            String coverNote,
            Long currentRoundId,
            String currentRoundName,
            String currentRoundType,
            Double overallScore,
            String finalDecision,
            Integer currentRoundOrder,
            Integer totalRounds,
            String nextAvailableRound,
            String deadline,
            Double atsScore,
            Boolean eligibilityPassed,
            String eligibilityFailureReason,
            String atsParsingStatus,
            String atsScoreBreakdown
    ) {
        public ApplicationResponse(Long id, Long jobId, String jobTitle, String company, String status, LocalDateTime appliedAt, String coverNote) {
            this(id, jobId, jobTitle, company, status, appliedAt, coverNote, null, null, null, null, null, 1, 1, null, null, null, true, null, "PARSED", null);
        }
    }

    public record ApplicationDetail(Long id, Long jobId, String jobTitle, String company,
                                    String applicantName, String applicantEmail,
                                    String status, LocalDateTime appliedAt,
                                    String resumeText, String coverNote,
                                    Double atsScore, Boolean eligibilityPassed,
                                    String eligibilityFailureReason) {
        public ApplicationDetail(Long id, Long jobId, String jobTitle, String company,
                                 String applicantName, String applicantEmail,
                                 String status, LocalDateTime appliedAt,
                                 String resumeText, String coverNote) {
            this(id, jobId, jobTitle, company, applicantName, applicantEmail, status, appliedAt, resumeText, coverNote, null, true, null);
        }
    }

    public record UpdateStatusRequest(String status) {}

    public record PageResponse<T>(List<T> content, long total, int page, int size) {}

    public record RoundAssessmentQuestionDto(
            Long id,
            String questionType,
            String title,
            String description,
            List<String> options,
            String topic,
            String difficulty,
            Integer marks,
            String codeTemplate,
            String constraints,
            List<String> sampleTestCases
    ) {}

    public record StartRoundAssessmentResponse(
            Long attemptId,
            Long applicationId,
            Long roundId,
            String roundName,
            String roundType,
            Integer durationMinutes,
            Double passingScore,
            String companyName,
            String jobTitle,
            String proctoringConfig,
            List<RoundAssessmentQuestionDto> questions
    ) {}

    public record SubmitRoundAssessmentRequest(
            Double score,
            Integer answeredCount,
            Integer totalQuestions,
            Integer proctoringViolations,
            String feedback
    ) {}

    public record SubmitRoundAssessmentResponse(
            Long attemptId,
            Double score,
            Double passingScore,
            Boolean passed,
            String status,
            String feedback,
            Long nextRoundId,
            String nextRoundName,
            Boolean nextRoundUnlocked,
            String applicationStatus
    ) {}
}

