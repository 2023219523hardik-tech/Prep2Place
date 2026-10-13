package com.placement.jobs.dto;

import jakarta.validation.constraints.NotBlank;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;

public class CompanyAdminDtos {

    public record CompanyInfo(
            Long id,
            String slug,
            String name,
            String logoUrl,
            String description,
            String website
    ) {}

    public record CompanyLoginRequest(
            @NotBlank String email,
            @NotBlank String password
    ) {}

    public record CompanyAdminUser(
            Long id,
            String email,
            String fullName,
            String role,
            boolean emailVerified,
            boolean premium
    ) {}

    public record CompanyLoginResponse(
            String token,
            String refreshToken,
            CompanyAdminUser user,
            CompanyInfo company
    ) {}

    public record CompanyDashboardStats(
            long totalJobs,
            long activeJobs,
            long totalApplications,
            long eligibleCandidates,
            long shortlistedCandidates,
            long inAssessment,
            long inInterview,
            long selectedCandidates,
            long rejectedCandidates,
            Map<String, Long> funnelStages
    ) {}

    public record HiringRoundDto(
            Long id,
            Integer roundOrder,
            String name,
            String roundType,
            Integer durationMinutes,
            Double passingScore,
            Double weightage,
            Integer maxAttempts,
            Boolean repeatable,
            Boolean autoUnlock,
            String managementMode,
            String assessmentConfig,
            String roundStatus,
            LocalDate startDate,
            LocalTime startTime,
            LocalDate endDate,
            LocalTime endTime,
            String timezone,
            Boolean isActivated,
            String proctoringConfig
    ) {
        public HiringRoundDto(
                Long id,
                Integer roundOrder,
                String name,
                String roundType,
                Integer durationMinutes,
                Double passingScore,
                Double weightage,
                Integer maxAttempts,
                Boolean repeatable,
                Boolean autoUnlock,
                String managementMode,
                String assessmentConfig
        ) {
            this(id, roundOrder, name, roundType, durationMinutes, passingScore, weightage,
                    maxAttempts, repeatable, autoUnlock, managementMode, assessmentConfig,
                    "DRAFT", null, null, null, null, "Asia/Kolkata", false, null);
        }
    }

    public record ScheduleConflictDto(
            String previousRound,
            String previousEnd,
            String nextRound,
            String nextStart,
            String suggestedEarliestStart,
            String message
    ) {}

    public record ScheduleConflictResponse(
            String code,
            String message,
            List<ScheduleConflictDto> conflicts
    ) {}

    public record CompanyJobUpsertRequest(
            @NotBlank String title,
            String slug,
            String location,
            String employmentType,
            String experienceLevel,
            String department,
            Integer openings,
            Double salaryMinLpa,
            Double salaryMaxLpa,
            Double stipend,
            String description,
            String responsibilities,
            String requiredSkills,
            String niceToHaveSkills,
            String benefits,
            Double minCgpa,
            Integer maxBacklogs,
            Integer graduationYear,
            Integer minGraduationYear,
            Integer maxGraduationYear,
            String branches,
            String allowedDegrees,
            String requiredCertifications,
            String applyUrl,
            LocalDate closesAt,
            String status,
            String pipelineManagementMode,
            String schedulingPolicy,
            Boolean atsScreeningEnabled,
            Double atsMinimumScore,
            Boolean autoShortlistEnabled,
            Boolean manualReviewRequired,
            String atsScoringWeights,
            List<HiringRoundDto> rounds
    ) {}

    public record CompanyJobDetail(
            Long id,
            String slug,
            String title,
            String company,
            CompanyInfo companyInfo,
            String location,
            String employmentType,
            String experienceLevel,
            String department,
            Integer openings,
            Double salaryMinLpa,
            Double salaryMaxLpa,
            Double stipend,
            String description,
            String responsibilities,
            String requiredSkills,
            String niceToHaveSkills,
            String benefits,
            Double minCgpa,
            Integer maxBacklogs,
            Integer graduationYear,
            Integer minGraduationYear,
            Integer maxGraduationYear,
            String branches,
            String allowedDegrees,
            String requiredCertifications,
            String applyUrl,
            LocalDateTime postedAt,
            LocalDate closesAt,
            String status,
            boolean active,
            String pipelineManagementMode,
            String schedulingPolicy,
            Boolean atsScreeningEnabled,
            Double atsMinimumScore,
            Boolean autoShortlistEnabled,
            Boolean manualReviewRequired,
            String atsScoringWeights,
            long applicantCount,
            List<HiringRoundDto> rounds
    ) {}

    public record RoundAttemptDetail(
            Long id,
            Long roundId,
            String roundName,
            String roundType,
            Integer roundOrder,
            Integer attemptNumber,
            Double score,
            Double passingScore,
            Boolean passed,
            String status,
            String feedback,
            String notes,
            LocalDateTime interviewScheduledAt,
            String interviewerMeetingLink,
            String evaluatedByName,
            LocalDateTime completedAt
    ) {}

    public record CandidateApplicationDetail(
            Long applicationId,
            Long jobId,
            String jobTitle,
            Long applicantId,
            String applicantName,
            String applicantEmail,
            String applicantPhone,
            String applicantCollege,
            String applicantDegree,
            String applicantBranch,
            Integer applicantGraduationYear,
            Double applicantCgpa,
            String applicationStatus,
            LocalDateTime appliedAt,
            String resumeText,
            String resumeFileName,
            String coverNote,
            Long currentRoundId,
            String currentRoundName,
            String currentRoundType,
            Double overallScore,
            String finalDecision,
            Double atsScore,
            String atsParsingStatus,
            Boolean eligibilityPassed,
            String eligibilityFailureReason,
            String atsScoreBreakdown,
            String recruiterAuditNotes,
            List<RoundAttemptDetail> roundAttempts
    ) {
        public CandidateApplicationDetail(
                Long applicationId, Long jobId, String jobTitle,
                Long applicantId, String applicantName, String applicantEmail,
                String applicantPhone, String applicantCollege, String applicantDegree,
                String applicantBranch, Integer applicantGraduationYear, Double applicantCgpa,
                String applicationStatus, LocalDateTime appliedAt, String resumeText,
                String coverNote, Long currentRoundId, String currentRoundName,
                String currentRoundType, Double overallScore, String finalDecision,
                Double atsScore, String atsParsingStatus, Boolean eligibilityPassed,
                String eligibilityFailureReason, String atsScoreBreakdown,
                String recruiterAuditNotes, List<RoundAttemptDetail> roundAttempts
        ) {
            this(applicationId, jobId, jobTitle, applicantId, applicantName, applicantEmail,
                    applicantPhone, applicantCollege, applicantDegree, applicantBranch,
                    applicantGraduationYear, applicantCgpa, applicationStatus, appliedAt,
                    resumeText, "Resume.pdf", coverNote, currentRoundId, currentRoundName, currentRoundType,
                    overallScore, finalDecision, atsScore, atsParsingStatus, eligibilityPassed,
                    eligibilityFailureReason, atsScoreBreakdown, recruiterAuditNotes, roundAttempts);
        }

        public CandidateApplicationDetail(
                Long applicationId, Long jobId, String jobTitle,
                Long applicantId, String applicantName, String applicantEmail,
                String applicantPhone, String applicantCollege, String applicantDegree,
                String applicantBranch, Integer applicantGraduationYear, Double applicantCgpa,
                String applicationStatus, LocalDateTime appliedAt, String resumeText,
                String coverNote, Long currentRoundId, String currentRoundName,
                String currentRoundType, Double overallScore, String finalDecision,
                List<RoundAttemptDetail> roundAttempts
        ) {
            this(applicationId, jobId, jobTitle, applicantId, applicantName, applicantEmail,
                    applicantPhone, applicantCollege, applicantDegree, applicantBranch,
                    applicantGraduationYear, applicantCgpa, applicationStatus, appliedAt,
                    resumeText, "Resume.pdf", coverNote, currentRoundId, currentRoundName, currentRoundType,
                    overallScore, finalDecision, null, "PARSED", true, null, null, null, roundAttempts);
        }
    }

    public record EvaluateRoundRequest(
            Double score,
            Boolean passed,
            String feedback,
            String notes
    ) {}

    public record ScheduleInterviewRequest(
            LocalDateTime interviewScheduledAt,
            String interviewerMeetingLink,
            String notes
    ) {}

    public record DecisionRequest(
            String decision
    ) {}

    public record LiveCandidateDto(
            Long applicationId,
            Long candidateId,
            String candidateName,
            String candidateEmail,
            Long jobId,
            String jobTitle,
            String roundName,
            String roundType,
            LocalDateTime startedAt,
            Integer durationMinutes,
            Integer remainingSeconds,
            String status,
            int violationsCount,
            boolean active
    ) {}

    public record TimelineEventDto(
            Long id,
            String title,
            String description,
            LocalDateTime timestamp,
            String eventType,
            String status,
            Double score
    ) {}

    public record CandidateActionRequest(
            String action,
            String notes,
            Double score
    ) {}

    public record CompanyInterviewReportDto(
            Long applicationId,
            Long candidateId,
            String candidateName,
            String candidateEmail,
            Long jobId,
            String jobTitle,
            String roundName,
            String roundType,
            LocalDateTime scheduledAt,
            LocalDateTime completedAt,
            Double score,
            Double passingScore,
            Boolean passed,
            String status,
            String meetingLink,
            String notes
    ) {}

    public record AtsScreeningStats(
            long totalApplicants,
            long eligibleCandidates,
            long ineligibleCandidates,
            long shortlistedCandidates,
            long underReviewCandidates,
            long belowCutoffCandidates,
            double averageAtsScore,
            double highestAtsScore,
            double lowestAtsScore,
            double configuredCutoff
    ) {}

    public record AtsOverrideRequest(
            @NotBlank String action, // SHORTLIST, REJECT, SEND_FOR_REVIEW, OVERRIDE_ELIGIBILITY
            String notes
    ) {}

    public record RoundLifecycleRequest(
            @NotBlank String status, // DRAFT, SCHEDULED, READY, LIVE, PAUSED, COMPLETED, CLOSED
            Boolean isActivated
    ) {}
}
