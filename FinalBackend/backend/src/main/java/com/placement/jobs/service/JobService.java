package com.placement.jobs.service;

import com.placement.entity.Role;
import com.placement.entity.User;
import com.placement.exception.ApiException;
import com.placement.jobs.dto.JobDtos.*;
import com.placement.jobs.entity.JobApplication;
import com.placement.jobs.entity.JobApplicationStatus;
import com.placement.jobs.entity.JobOpportunity;
import com.placement.jobs.repository.JobApplicationRepository;
import com.placement.jobs.repository.JobOpportunityRepository;
import com.placement.service.CurrentUserService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.placement.entity.StudentProfile;
import com.placement.jobs.entity.HiringRound;
import com.placement.jobs.entity.HiringRoundType;
import com.placement.jobs.entity.RoundAttempt;
import com.placement.jobs.entity.RoundAttemptStatus;
import com.placement.jobs.entity.RoundLifecycleStatus;
import com.placement.jobs.repository.HiringRoundRepository;
import com.placement.jobs.repository.RoundAttemptRepository;
import com.placement.repository.StudentProfileRepository;
import com.placement.entity.AptitudeQuestion;
import com.placement.repository.AptitudeQuestionRepository;
import com.placement.questionbank.entity.TechnicalMcqQuestion;
import com.placement.questionbank.repository.TechnicalMcqQuestionRepository;
import com.placement.entity.CodingProblem;
import com.placement.repository.CodingProblemRepository;

import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.JsonNode;

@Service
@RequiredArgsConstructor
public class JobService {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    private final JobOpportunityRepository jobRepository;
    private final JobApplicationRepository applicationRepository;
    private final StudentProfileRepository studentProfileRepository;
    private final HiringRoundRepository hiringRoundRepository;
    private final RoundAttemptRepository roundAttemptRepository;
    private final AtsScoringService atsScoringService;
    private final CurrentUserService currentUserService;
    private final AptitudeQuestionRepository aptitudeQuestionRepository;
    private final TechnicalMcqQuestionRepository technicalMcqQuestionRepository;
    private final CodingProblemRepository codingProblemRepository;

    public PageResponse<JobSummary> listActive(String search, String employmentType,
                                               String experienceLevel, int page, int size) {
        Pageable pageable = PageRequest.of(page, size);
        Page<JobOpportunity> result = jobRepository.searchActive(
                blankToNull(search), blankToNull(employmentType), blankToNull(experienceLevel), pageable);
        List<JobSummary> content = result.getContent().stream().map(this::toSummary).toList();
        return new PageResponse<>(content, result.getTotalElements(), result.getNumber(), result.getSize());
    }

    public PageResponse<JobSummary> listAdmin(String search, Boolean active, int page, int size) {
        Pageable pageable = PageRequest.of(page, size);
        Page<JobOpportunity> result = jobRepository.searchAdmin(blankToNull(search), active, pageable);
        List<JobSummary> content = result.getContent().stream().map(this::toSummary).toList();
        return new PageResponse<>(content, result.getTotalElements(), result.getNumber(), result.getSize());
    }

    public JobDetail getJob(Long jobId) {
        JobOpportunity job = jobRepository.findById(jobId)
                .orElseThrow(() -> ApiException.notFound("Job not found"));
        boolean applied = false;
        var auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.isAuthenticated()
                && !"anonymousUser".equals(auth.getPrincipal())) {
            try {
                User current = currentUserService.getCurrentUser();
                if (current.getRole() == Role.STUDENT) {
                    applied = applicationRepository.existsByJobIdAndApplicantId(jobId, current.getId());
                }
            } catch (ApiException ignored) {
                // user not found - treat as not applied
            }
        }
        long count = applicationRepository.countByJobId(jobId);
        return toDetail(job, applied, count);
    }

    @Transactional
    public ApplicationResponse apply(Long jobId, ApplyRequest req) {
        User user = currentUserService.getCurrentUser();
        if (user.getRole() != Role.STUDENT) {
            throw ApiException.forbidden("Only students can apply");
        }
        JobOpportunity job = jobRepository.findById(jobId)
                .orElseThrow(() -> ApiException.notFound("Job not found"));
        if (!job.isActive()) {
            throw ApiException.badRequest("This job posting is no longer active");
        }

        // Validate mandatory resume: from request or from student profile
        String resolvedResume = (req != null && req.resumeText() != null && !req.resumeText().isBlank())
                ? req.resumeText().trim()
                : studentProfileRepository.findByUserId(user.getId())
                        .map(StudentProfile::getResumeText)
                        .filter(r -> r != null && !r.isBlank())
                        .orElse(null);

        if (resolvedResume == null || resolvedResume.isBlank()) {
            throw ApiException.badRequest("A resume is required to apply. Please upload your resume or add one to your student profile.");
        }

        var existing = applicationRepository.findByJobIdAndApplicantId(jobId, user.getId());
        if (existing.isPresent()) {
            JobApplication app = existing.get();
            app.setResumeText(resolvedResume);
            if (req != null && req.coverNote() != null && !req.coverNote().isBlank()) {
                app.setCoverNote(req.coverNote());
            }
            app.setAppliedAt(java.time.LocalDateTime.now());
            // Re-evaluate ATS
            atsScoringService.evaluateApplication(app, job, user);
            return toApplicationResponse(applicationRepository.save(app));
        }

        List<HiringRound> rounds = hiringRoundRepository.findByJobIdOrderByRoundOrderAsc(job.getId());
        HiringRound firstRound = rounds.isEmpty() ? null : rounds.get(0);

        JobApplication app = JobApplication.builder()
                .job(job)
                .applicant(user)
                .status(JobApplicationStatus.APPLIED)
                .appliedAt(java.time.LocalDateTime.now())
                .resumeText(resolvedResume)
                .coverNote(req != null ? req.coverNote() : null)
                .currentRound(firstRound)
                .build();

        // Run ATS resume screening & eligibility evaluation
        atsScoringService.evaluateApplication(app, job, user);

        app = applicationRepository.save(app);

        // NOTE: We deliberately do NOT auto-create a RoundAttempt here so tests are never activated prematurely.
        // Attempts are created when candidate enters an active, scheduled round.

        return toApplicationResponse(app);
    }

    @Transactional(readOnly = true)
    public PageResponse<ApplicationResponse> myApplications(int page, int size) {
        User user = currentUserService.getCurrentUser();
        Pageable pageable = PageRequest.of(page, size);
        Page<JobApplication> result = applicationRepository.findByApplicantIdOrderByAppliedAtDesc(user.getId(), pageable);
        List<ApplicationResponse> content = result.getContent().stream().map(this::toApplicationResponse).toList();
        return new PageResponse<>(content, result.getTotalElements(), result.getNumber(), result.getSize());
    }

    @Transactional(readOnly = true)
    public PageResponse<ApplicationDetail> applicationsForJob(Long jobId, String status, int page, int size) {
        Pageable pageable = PageRequest.of(page, size);
        JobApplicationStatus st = status != null && !status.isBlank()
                ? JobApplicationStatus.valueOf(status.toUpperCase()) : null;
        Page<JobApplication> result = applicationRepository.findByJobIdAndStatus(jobId, st, pageable);
        List<ApplicationDetail> content = result.getContent().stream().map(this::toApplicationDetail).toList();
        return new PageResponse<>(content, result.getTotalElements(), result.getNumber(), result.getSize());
    }

    @Transactional
    public ApplicationDetail updateApplicationStatus(Long applicationId, String status) {
        JobApplication app = applicationRepository.findById(applicationId)
                .orElseThrow(() -> ApiException.notFound("Application not found"));
        app.setStatus(JobApplicationStatus.valueOf(status.toUpperCase()));
        return toApplicationDetail(applicationRepository.save(app));
    }

    @Transactional
    public void withdraw(Long applicationId) {
        User user = currentUserService.getCurrentUser();
        JobApplication app = applicationRepository.findById(applicationId)
                .orElseThrow(() -> ApiException.notFound("Application not found"));
        if (!app.getApplicant().getId().equals(user.getId())) {
            throw ApiException.forbidden("Cannot withdraw another student's application");
        }
        app.setStatus(JobApplicationStatus.WITHDRAWN);
        applicationRepository.save(app);
    }

    @Transactional
    public JobSummary createJob(JobUpsertRequest req) {
        JobOpportunity job = new JobOpportunity();
        applyUpsert(job, req);
        job.setPostedBy(currentUserService.getCurrentUser());
        return toSummary(jobRepository.save(job));
    }

    @Transactional
    public JobSummary updateJob(Long jobId, JobUpsertRequest req) {
        JobOpportunity job = jobRepository.findById(jobId)
                .orElseThrow(() -> ApiException.notFound("Job not found"));
        applyUpsert(job, req);
        return toSummary(jobRepository.save(job));
    }

    @Transactional
    public void toggleActive(Long jobId, boolean active) {
        JobOpportunity job = jobRepository.findById(jobId)
                .orElseThrow(() -> ApiException.notFound("Job not found"));
        job.setActive(active);
        jobRepository.save(job);
    }

    @Transactional
    public void deleteJob(Long jobId) {
        if (!jobRepository.existsById(jobId)) {
            throw ApiException.notFound("Job not found");
        }
        jobRepository.deleteById(jobId);
    }

    private void applyUpsert(JobOpportunity job, JobUpsertRequest req) {
        job.setTitle(req.title());
        job.setCompany(req.company());
        job.setLocation(req.location());
        job.setEmploymentType(req.employmentType());
        job.setExperienceLevel(req.experienceLevel());
        job.setSalaryMinLpa(req.salaryMinLpa());
        job.setSalaryMaxLpa(req.salaryMaxLpa());
        job.setDescription(req.description());
        job.setRequiredSkills(req.requiredSkills());
        job.setNiceToHaveSkills(req.niceToHaveSkills());
        job.setApplyUrl(req.applyUrl());
        job.setClosesAt(req.closesAt());
        if (req.active() != null) job.setActive(req.active());
    }

    private JobSummary toSummary(JobOpportunity j) {
        long count = applicationRepository.countByJobId(j.getId());
        return new JobSummary(j.getId(), j.getTitle(), j.getCompany(), j.getLocation(),
                j.getEmploymentType(), j.getExperienceLevel(),
                j.getSalaryMinLpa(), j.getSalaryMaxLpa(),
                j.getRequiredSkills(), j.getPostedAt(), j.getClosesAt(), j.isActive(), count);
    }

    private JobDetail toDetail(JobOpportunity j, boolean alreadyApplied, long count) {
        return new JobDetail(j.getId(), j.getTitle(), j.getCompany(), j.getLocation(),
                j.getEmploymentType(), j.getExperienceLevel(),
                j.getSalaryMinLpa(), j.getSalaryMaxLpa(),
                j.getDescription(), j.getRequiredSkills(), j.getNiceToHaveSkills(),
                j.getApplyUrl(), j.getPostedAt(), j.getClosesAt(),
                j.isActive(), alreadyApplied, count);
    }

    private ApplicationResponse toApplicationResponse(JobApplication a) {
        Long currentRoundId = a.getCurrentRound() != null ? a.getCurrentRound().getId() : null;
        String currentRoundName = a.getCurrentRound() != null ? a.getCurrentRound().getName() : null;
        String currentRoundType = (a.getCurrentRound() != null && a.getCurrentRound().getRoundType() != null)
                ? a.getCurrentRound().getRoundType().name() : null;
        Integer currentRoundOrder = a.getCurrentRound() != null ? a.getCurrentRound().getRoundOrder() : 1;

        int totalRounds = 1;
        try {
            long count = hiringRoundRepository.countByJobId(a.getJob().getId());
            if (count > 0) totalRounds = (int) count;
        } catch (Exception ignored) {}

        String nextAvailableRound = currentRoundName != null ? currentRoundName : "Initial Review";
        String deadline = (a.getJob() != null && a.getJob().getClosesAt() != null)
                ? a.getJob().getClosesAt().toString() : null;

        return new ApplicationResponse(
                a.getId(),
                a.getJob().getId(),
                a.getJob().getTitle(),
                a.getJob().getCompany(),
                a.getStatus().name(),
                a.getAppliedAt(),
                a.getCoverNote(),
                currentRoundId,
                currentRoundName,
                currentRoundType,
                a.getOverallScore(),
                a.getFinalDecision(),
                currentRoundOrder,
                totalRounds,
                nextAvailableRound,
                deadline,
                a.getAtsScore(),
                a.isEligibilityPassed(),
                a.getEligibilityFailureReason(),
                a.getAtsParsingStatus(),
                a.getAtsScoreBreakdown()
        );
    }

    private ApplicationDetail toApplicationDetail(JobApplication a) {
        return new ApplicationDetail(a.getId(), a.getJob().getId(), a.getJob().getTitle(),
                a.getJob().getCompany(),
                a.getApplicant().getFullName(), a.getApplicant().getEmail(),
                a.getStatus().name(), a.getAppliedAt(),
                a.getResumeText(), a.getCoverNote(),
                a.getAtsScore(), a.isEligibilityPassed(),
                a.getEligibilityFailureReason());
    }

    private String blankToNull(String s) {
        return (s == null || s.isBlank()) ? null : s;
    }

    @Transactional(readOnly = true)
    public List<com.placement.jobs.dto.CompanyAdminDtos.HiringRoundDto> getPipelineForJob(Long jobId) {
        List<HiringRound> rounds = hiringRoundRepository.findByJobIdOrderByRoundOrderAsc(jobId);
        return rounds.stream().map(r -> new com.placement.jobs.dto.CompanyAdminDtos.HiringRoundDto(
                r.getId(),
                r.getRoundOrder(),
                r.getName(),
                r.getRoundType() != null ? r.getRoundType().name() : "ONLINE_ASSESSMENT",
                r.getDurationMinutes(),
                r.getPassingScore(),
                r.getWeightage(),
                r.getMaxAttempts(),
                r.isRepeatable(),
                r.isAutoUnlock(),
                r.getManagementMode() != null ? r.getManagementMode().name() : "PREP2PLACE_MANAGED",
                r.getAssessmentConfig(),
                r.getRoundStatus() != null ? r.getRoundStatus().name() : "DRAFT",
                r.getStartDate(),
                r.getStartTime(),
                r.getEndDate(),
                r.getEndTime(),
                r.getTimezone(),
                r.isActivated(),
                r.getProctoringConfig()
        )).toList();
    }

    @Transactional(readOnly = true)
    public com.placement.jobs.dto.CompanyAdminDtos.CandidateApplicationDetail getApplicationProgress(Long applicationId) {
        User user = currentUserService.getCurrentUser();
        JobApplication app = applicationRepository.findById(applicationId)
                .orElseThrow(() -> ApiException.notFound("Application not found"));
        if (!app.getApplicant().getId().equals(user.getId()) && user.getRole() != Role.ADMIN) {
            throw ApiException.forbidden("Access denied");
        }

        List<RoundAttempt> attempts = roundAttemptRepository.findByApplicationIdOrderByRoundRoundOrderAscAttemptNumberAsc(applicationId);
        List<com.placement.jobs.dto.CompanyAdminDtos.RoundAttemptDetail> attemptDtos = attempts.stream().map(a -> new com.placement.jobs.dto.CompanyAdminDtos.RoundAttemptDetail(
                a.getId(),
                a.getRound() != null ? a.getRound().getId() : null,
                a.getRound() != null ? a.getRound().getName() : "Round",
                (a.getRound() != null && a.getRound().getRoundType() != null) ? a.getRound().getRoundType().name() : "ONLINE_ASSESSMENT",
                a.getRound() != null ? a.getRound().getRoundOrder() : 1,
                a.getAttemptNumber(),
                a.getScore(),
                a.getRound() != null ? a.getRound().getPassingScore() : null,
                a.getPassed(),
                a.getStatus() != null ? a.getStatus().name() : "NOT_STARTED",
                a.getFeedback(),
                a.getNotes(),
                a.getInterviewScheduledAt(),
                a.getInterviewerMeetingLink(),
                a.getEvaluatedBy() != null ? a.getEvaluatedBy().getFullName() : null,
                a.getCompletedAt()
        )).toList();

        return new com.placement.jobs.dto.CompanyAdminDtos.CandidateApplicationDetail(
                app.getId(),
                app.getJob().getId(),
                app.getJob().getTitle(),
                user.getId(),
                user.getFullName(),
                user.getEmail(),
                null, null, null, null, null, null,
                app.getStatus().name(),
                app.getAppliedAt(),
                app.getResumeText(),
                app.getCoverNote(),
                app.getCurrentRound() != null ? app.getCurrentRound().getId() : null,
                app.getCurrentRound() != null ? app.getCurrentRound().getName() : null,
                app.getCurrentRound() != null && app.getCurrentRound().getRoundType() != null ? app.getCurrentRound().getRoundType().name() : null,
                app.getOverallScore(),
                app.getFinalDecision(),
                app.getAtsScore(),
                app.getAtsParsingStatus(),
                app.isEligibilityPassed(),
                app.getEligibilityFailureReason(),
                app.getAtsScoreBreakdown(),
                app.getRecruiterAuditNotes(),
                attemptDtos
        );
    }

    @Transactional
    public StartRoundAssessmentResponse startRoundAssessment(Long applicationId, Long roundId) {
        User user = currentUserService.getCurrentUser();
        JobApplication app = applicationRepository.findById(applicationId)
                .orElseThrow(() -> ApiException.notFound("Application not found: " + applicationId));

        if (!app.getApplicant().getId().equals(user.getId()) && user.getRole() != Role.ADMIN) {
            throw ApiException.forbidden("Access denied to this application");
        }

        HiringRound round = hiringRoundRepository.findById(roundId)
                .orElseThrow(() -> ApiException.notFound("Round not found: " + roundId));

        if (!round.getJob().getId().equals(app.getJob().getId())) {
            throw ApiException.badRequest("Round does not belong to this job application");
        }

        // 1. Candidate must be shortlisted or eligible
        List<String> eligibleStatuses = List.of(
                "SHORTLISTED", "ASSESSMENT_PENDING", "IN_PROGRESS", "QUALIFIED",
                "INTERVIEW", "INTERVIEW_SCHEDULED", "SELECTED", "OFFER", "OFFER_RELEASED"
        );
        if (!eligibleStatuses.contains(app.getStatus().name())) {
            throw ApiException.badRequest("Application status is " + app.getStatus() + ". Only shortlisted candidates may take round assessments.");
        }

        // 2. Prior round clearance check & sequence protection
        if (round.getRoundOrder() != null && round.getRoundOrder() > 1) {
            List<HiringRound> allRounds = hiringRoundRepository.findByJobIdOrderByRoundOrderAsc(app.getJob().getId());
            for (HiringRound prev : allRounds) {
                if (prev.getRoundOrder() < round.getRoundOrder()) {
                    List<RoundAttempt> prevAttempts = roundAttemptRepository.findByApplicationIdOrderByRoundRoundOrderAscAttemptNumberAsc(app.getId());
                    boolean prevCleared = prevAttempts.stream()
                            .filter(a -> a.getRound() != null && a.getRound().getId().equals(prev.getId()))
                            .anyMatch(a -> Boolean.TRUE.equals(a.getPassed()) || a.getStatus() == RoundAttemptStatus.PASSED);
                    if (!prevCleared) {
                        throw ApiException.badRequest("You must clear previous round '" + prev.getName() + "' before attempting this round.");
                    }

                    // For sequential pipelines, ensure candidate cannot jump into a later round while earlier round window is still ongoing and unsubmitted
                    if (app.getJob().getSchedulingPolicy() != com.placement.jobs.entity.PipelineSchedulingPolicy.INDEPENDENT && prev.getEndDate() != null) {
                        ZoneId prevZone = ZoneId.of(prev.getTimezone() != null && !prev.getTimezone().isBlank() ? prev.getTimezone() : "Asia/Kolkata");
                        LocalTime prevEndTime = prev.getEndTime() != null ? prev.getEndTime() : LocalTime.of(23, 59, 59);
                        LocalDateTime prevWindowEnd = LocalDateTime.of(prev.getEndDate(), prevEndTime);
                        if (LocalDateTime.now(prevZone).isBefore(prevWindowEnd)) {
                            boolean prevSubmittedOrCompleted = prevAttempts.stream()
                                    .filter(a -> a.getRound() != null && a.getRound().getId().equals(prev.getId()))
                                    .anyMatch(a -> a.getStatus() == RoundAttemptStatus.SUBMITTED ||
                                                   a.getStatus() == RoundAttemptStatus.COMPLETED ||
                                                   a.getStatus() == RoundAttemptStatus.EVALUATED ||
                                                   a.getStatus() == RoundAttemptStatus.PASSED);
                            if (!prevSubmittedOrCompleted) {
                                throw ApiException.badRequest("Earlier round '" + prev.getName() + "' is still active and ongoing until " + prevEndTime + ". You must complete it first.");
                            }
                        }
                    }
                }
            }
        }

        // 3. Round Schedule Window Validation (Gating)
        ZoneId zone = ZoneId.of(round.getTimezone() != null && !round.getTimezone().isBlank() ? round.getTimezone() : "Asia/Kolkata");
        LocalDateTime now = LocalDateTime.now(zone);

        if (round.getStartDate() != null) {
            LocalTime startTime = round.getStartTime() != null ? round.getStartTime() : LocalTime.MIDNIGHT;
            LocalDateTime windowStart = LocalDateTime.of(round.getStartDate(), startTime);
            if (now.isBefore(windowStart)) {
                throw ApiException.badRequest("Assessment has not opened yet. Scheduled to start on " + round.getStartDate() + " at " + startTime + " (" + zone.getId() + ").");
            }
        }

        if (round.getEndDate() != null) {
            LocalTime endTime = round.getEndTime() != null ? round.getEndTime() : LocalTime.of(23, 59, 59);
            LocalDateTime windowEnd = LocalDateTime.of(round.getEndDate(), endTime);
            if (now.isAfter(windowEnd)) {
                throw ApiException.badRequest("The assessment window for this round closed on " + round.getEndDate() + " at " + endTime + ".");
            }
        }

        if (round.getRoundStatus() != RoundLifecycleStatus.LIVE) {
            if (round.getRoundStatus() == RoundLifecycleStatus.PAUSED) {
                throw ApiException.badRequest("This assessment has been temporarily PAUSED by the recruiter.");
            } else if (round.getRoundStatus() == RoundLifecycleStatus.CLOSED || round.getRoundStatus() == RoundLifecycleStatus.CANCELLED) {
                throw ApiException.badRequest("This assessment round is CLOSED.");
            } else {
                throw ApiException.badRequest("This round is not currently LIVE (current status: " + round.getRoundStatus() + "). It must be explicitly activated by the recruiter before tests can begin.");
            }
        }
        if (!round.isActivated()) {
            throw ApiException.badRequest("This round has not been activated yet by the Company Admin.");
        }
        if (app.getJob() == null || !app.getJob().isActive() || "DRAFT".equalsIgnoreCase(app.getJob().getStatus())) {
            throw ApiException.badRequest("This job opportunity is in DRAFT status and not yet open for candidate assessments.");
        }

        // 4. Max Attempts check
        int existingAttemptsCount = roundAttemptRepository.countByApplicationIdAndRoundId(app.getId(), round.getId());
        int maxAttempts = round.getMaxAttempts() != null ? round.getMaxAttempts() : 1;

        Optional<RoundAttempt> inProgressAttempt = roundAttemptRepository.findTopByApplicationIdAndRoundIdOrderByAttemptNumberDesc(app.getId(), round.getId())
                .filter(a -> a.getStatus() == RoundAttemptStatus.IN_PROGRESS);

        RoundAttempt attempt;
        if (inProgressAttempt.isPresent()) {
            attempt = inProgressAttempt.get();
        } else {
            if (existingAttemptsCount >= maxAttempts) {
                throw ApiException.badRequest("Maximum attempts (" + maxAttempts + ") exceeded for this round.");
            }
            attempt = RoundAttempt.builder()
                    .application(app)
                    .round(round)
                    .attemptNumber(existingAttemptsCount + 1)
                    .status(RoundAttemptStatus.IN_PROGRESS)
                    .startedAt(LocalDateTime.now())
                    .build();
            attempt = roundAttemptRepository.save(attempt);
        }

        // 5. Source Questions for this test
        List<RoundAssessmentQuestionDto> questions = sourceQuestionsForRound(round);

        return new StartRoundAssessmentResponse(
                attempt.getId(),
                app.getId(),
                round.getId(),
                round.getName(),
                round.getRoundType() != null ? round.getRoundType().name() : "ONLINE_ASSESSMENT",
                round.getDurationMinutes() != null ? round.getDurationMinutes() : 60,
                round.getPassingScore() != null ? round.getPassingScore() : 60.0,
                app.getJob().getCompany(),
                app.getJob().getTitle(),
                round.getProctoringConfig(),
                questions
        );
    }

    @Transactional
    public SubmitRoundAssessmentResponse submitRoundAssessment(Long applicationId, Long roundId, SubmitRoundAssessmentRequest req) {
        User user = currentUserService.getCurrentUser();
        JobApplication app = applicationRepository.findById(applicationId)
                .orElseThrow(() -> ApiException.notFound("Application not found: " + applicationId));

        if (!app.getApplicant().getId().equals(user.getId()) && user.getRole() != Role.ADMIN) {
            throw ApiException.forbidden("Access denied");
        }

        HiringRound round = hiringRoundRepository.findById(roundId)
                .orElseThrow(() -> ApiException.notFound("Round not found: " + roundId));

        RoundAttempt attempt = roundAttemptRepository.findTopByApplicationIdAndRoundIdOrderByAttemptNumberDesc(applicationId, roundId)
                .orElseThrow(() -> ApiException.notFound("No active attempt found for round " + roundId));

        double score = req.score() != null ? Math.max(0.0, Math.min(100.0, req.score())) : 0.0;
        double passingScore = round.getPassingScore() != null ? round.getPassingScore() : 60.0;
        boolean passed = score >= passingScore;

        attempt.setScore(score);
        attempt.setPassed(passed);
        attempt.setStatus(passed ? RoundAttemptStatus.PASSED : RoundAttemptStatus.FAILED);
        attempt.setCompletedAt(LocalDateTime.now());
        attempt.setFeedback(req.feedback() != null ? req.feedback() : (passed ? "Assessment passed cutoff requirements." : "Score did not meet round cutoff (" + passingScore + "%)."));
        roundAttemptRepository.save(attempt);

        Long nextRoundId = null;
        String nextRoundName = null;
        boolean nextRoundUnlocked = false;

        if (passed) {
            // Find next round
            List<HiringRound> allRounds = hiringRoundRepository.findByJobIdOrderByRoundOrderAsc(app.getJob().getId());
            Optional<HiringRound> nextRound = allRounds.stream()
                    .filter(r -> r.getRoundOrder() != null && r.getRoundOrder() > round.getRoundOrder())
                    .findFirst();

            if (nextRound.isPresent()) {
                HiringRound next = nextRound.get();
                nextRoundId = next.getId();
                nextRoundName = next.getName();
                nextRoundUnlocked = true;
                if (Boolean.TRUE.equals(round.isAutoUnlock())) {
                    app.setCurrentRound(next);
                }
            } else {
                // Completed all rounds!
                app.setStatus(JobApplicationStatus.SELECTED);
            }
        }

        // Update overall score average
        List<RoundAttempt> allAttempts = roundAttemptRepository.findByApplicationId(app.getId());
        double avgScore = allAttempts.stream()
                .filter(a -> a.getScore() != null)
                .mapToDouble(RoundAttempt::getScore)
                .average()
                .orElse(score);
        app.setOverallScore(Math.round(avgScore * 10.0) / 10.0);
        app.setUpdatedAt(LocalDateTime.now());
        applicationRepository.save(app);

        return new SubmitRoundAssessmentResponse(
                attempt.getId(),
                score,
                passingScore,
                passed,
                attempt.getStatus().name(),
                attempt.getFeedback(),
                nextRoundId,
                nextRoundName,
                nextRoundUnlocked,
                app.getStatus().name()
        );
    }

    private List<RoundAssessmentQuestionDto> sourceQuestionsForRound(HiringRound round) {
        List<RoundAssessmentQuestionDto> list = new ArrayList<>();
        HiringRoundType type = round.getRoundType() != null ? round.getRoundType() : HiringRoundType.APTITUDE;

        // Parse optional configuration from assessmentConfig or proctoringConfig
        int questionCount = 15;
        List<String> targetTopics = new ArrayList<>();
        String targetDifficulty = null;

        String rawConfig = round.getAssessmentConfig() != null && !round.getAssessmentConfig().isBlank()
                ? round.getAssessmentConfig()
                : round.getProctoringConfig();

        if (rawConfig != null && !rawConfig.isBlank()) {
            try {
                JsonNode root = OBJECT_MAPPER.readTree(rawConfig);

                // If Company Admin uploaded or added custom questions directly for this round, prioritize them
                if (root.has("customQuestions") && root.get("customQuestions").isArray() && !root.get("customQuestions").isEmpty()) {
                    long syntheticId = 1000L;
                    for (JsonNode qNode : root.get("customQuestions")) {
                        Long qId = qNode.has("id") && qNode.get("id").canConvertToLong() ? qNode.get("id").asLong() : ++syntheticId;
                        String qType = qNode.has("type") ? qNode.get("type").asText() : (qNode.has("questionType") ? qNode.get("questionType").asText() : (type == HiringRoundType.DSA || type == HiringRoundType.CODING_LAB ? "CODING" : "MCQ_SINGLE"));
                        String qTitle = qNode.has("title") ? qNode.get("title").asText() : (qNode.has("question") ? qNode.get("question").asText() : "Question " + (list.size() + 1));
                        String qDesc = qNode.has("description") ? qNode.get("description").asText() : (qNode.has("statement") ? qNode.get("statement").asText() : null);
                        String qTopic = qNode.has("topic") ? qNode.get("topic").asText() : "Placement Drive";
                        String qDiff = qNode.has("difficulty") ? qNode.get("difficulty").asText() : "MEDIUM";
                        int qMarks = qNode.has("marks") ? qNode.get("marks").asInt(1) : 1;
                        String qCodeTemplate = qNode.has("codeTemplate") ? qNode.get("codeTemplate").asText() : null;
                        String qConstraints = qNode.has("constraints") ? qNode.get("constraints").asText() : null;

                        List<String> qOptions = new ArrayList<>();
                        if (qNode.has("options") && qNode.get("options").isArray()) {
                            for (JsonNode opt : qNode.get("options")) {
                                if (opt.isTextual()) qOptions.add(opt.asText());
                                else if (opt.has("text")) qOptions.add(opt.get("text").asText());
                            }
                        }
                        List<String> sampleCases = new ArrayList<>();
                        if (qNode.has("sampleTestCases") && qNode.get("sampleTestCases").isArray()) {
                            for (JsonNode sc : qNode.get("sampleTestCases")) sampleCases.add(sc.asText());
                        }

                        list.add(new RoundAssessmentQuestionDto(
                                qId, qType, qTitle, qDesc, qOptions.isEmpty() ? null : qOptions,
                                qTopic, qDiff, qMarks, qCodeTemplate, qConstraints, sampleCases.isEmpty() ? null : sampleCases
                        ));
                    }
                    if (!list.isEmpty()) {
                        return list;
                    }
                }

                if (root.has("questionCount") && root.get("questionCount").canConvertToInt()) {
                    int count = root.get("questionCount").asInt();
                    if (count > 0) questionCount = count;
                }
                if (root.has("difficulty") && !root.get("difficulty").asText().isBlank()) {
                    String diff = root.get("difficulty").asText().trim().toUpperCase();
                    if (!"ALL".equals(diff)) targetDifficulty = diff;
                }
                if (root.has("topics") && root.get("topics").isArray()) {
                    for (JsonNode tNode : root.get("topics")) {
                        if (tNode.isTextual() && !tNode.asText().isBlank()) {
                            targetTopics.add(tNode.asText().trim().toLowerCase());
                        }
                    }
                }
            } catch (Exception ignored) {}
        }

        if (type == HiringRoundType.APTITUDE) {
            List<AptitudeQuestion> pool = aptitudeQuestionRepository.findByActiveTrue();
            if (pool.isEmpty()) pool = aptitudeQuestionRepository.findAll();

            if (!targetTopics.isEmpty()) {
                List<AptitudeQuestion> filtered = pool.stream()
                        .filter(q -> q.getTopic() != null && targetTopics.stream().anyMatch(t -> q.getTopic().toLowerCase().contains(t)))
                        .toList();
                if (!filtered.isEmpty()) pool = filtered;
            }

            if (targetDifficulty != null) {
                final String diffFilter = targetDifficulty;
                List<AptitudeQuestion> diffFiltered = pool.stream()
                        .filter(q -> q.getDifficulty() != null && q.getDifficulty().name().equalsIgnoreCase(diffFilter))
                        .toList();
                if (!diffFiltered.isEmpty()) pool = diffFiltered;
            }

            List<AptitudeQuestion> shuffled = new ArrayList<>(pool);
            Collections.shuffle(shuffled);
            int limit = Math.min(shuffled.size(), Math.max(1, questionCount));
            for (int i = 0; i < limit; i++) {
                AptitudeQuestion q = shuffled.get(i);
                List<String> options = new ArrayList<>();
                if (q.getOptionA() != null) options.add(q.getOptionA());
                if (q.getOptionB() != null) options.add(q.getOptionB());
                if (q.getOptionC() != null) options.add(q.getOptionC());
                if (q.getOptionD() != null) options.add(q.getOptionD());
                list.add(new RoundAssessmentQuestionDto(
                        q.getId(),
                        "MCQ_SINGLE",
                        q.getText(),
                        null,
                        options,
                        q.getTopic() != null ? q.getTopic() : "General Aptitude",
                        q.getDifficulty() != null ? q.getDifficulty().name() : "MEDIUM",
                        1,
                        null, null, null
                ));
            }
        } else if (type == HiringRoundType.TECHNICAL_MCQ) {
            List<TechnicalMcqQuestion> pool = technicalMcqQuestionRepository.findAll();

            if (!targetTopics.isEmpty()) {
                List<TechnicalMcqQuestion> filtered = pool.stream()
                        .filter(q -> {
                            String topic = q.getTopic() != null ? q.getTopic().toLowerCase() : "";
                            String cat = q.getCategory() != null ? q.getCategory().name().toLowerCase() : "";
                            return targetTopics.stream().anyMatch(t -> topic.contains(t) || cat.contains(t));
                        })
                        .toList();
                if (!filtered.isEmpty()) pool = filtered;
            }

            if (targetDifficulty != null) {
                final String diffFilter = targetDifficulty;
                List<TechnicalMcqQuestion> diffFiltered = pool.stream()
                        .filter(q -> q.getDifficulty() != null && q.getDifficulty().name().equalsIgnoreCase(diffFilter))
                        .toList();
                if (!diffFiltered.isEmpty()) pool = diffFiltered;
            }

            List<TechnicalMcqQuestion> shuffled = new ArrayList<>(pool);
            Collections.shuffle(shuffled);
            int limit = Math.min(shuffled.size(), Math.max(1, questionCount));
            for (int i = 0; i < limit; i++) {
                TechnicalMcqQuestion q = shuffled.get(i);
                List<String> options = new ArrayList<>();
                if (q.getOptions() != null) {
                    for (var optMap : q.getOptions()) {
                        String optText = optMap.get("text");
                        if (optText != null && !optText.isBlank()) {
                            options.add(optText);
                        }
                    }
                }
                list.add(new RoundAssessmentQuestionDto(
                        q.getId(),
                        "MCQ_SINGLE",
                        q.getQuestionText(),
                        null,
                        options,
                        q.getTopic() != null ? q.getTopic() : (q.getCategory() != null ? q.getCategory().name() : "Technical"),
                        q.getDifficulty() != null ? q.getDifficulty().name() : "MEDIUM",
                        1,
                        null, null, null
                ));
            }
        } else {
            // DSA / CODING / SQL / DATAFRAME
            List<CodingProblem> pool = codingProblemRepository.findByActiveTrueOrderByTitleAsc();
            if (pool.isEmpty()) pool = codingProblemRepository.findAll();

            if (!targetTopics.isEmpty()) {
                List<CodingProblem> filtered = pool.stream()
                        .filter(p -> {
                            String topic = p.getTopic() != null ? p.getTopic().toLowerCase() : "";
                            String cat = p.getCategory() != null ? p.getCategory().toLowerCase() : "";
                            return targetTopics.stream().anyMatch(t -> topic.contains(t) || cat.contains(t));
                        })
                        .toList();
                if (!filtered.isEmpty()) pool = filtered;
            }

            if (targetDifficulty != null) {
                final String diffFilter = targetDifficulty;
                List<CodingProblem> diffFiltered = pool.stream()
                        .filter(p -> p.getDifficulty() != null && p.getDifficulty().name().equalsIgnoreCase(diffFilter))
                        .toList();
                if (!diffFiltered.isEmpty()) pool = diffFiltered;
            }

            List<CodingProblem> shuffled = new ArrayList<>(pool);
            Collections.shuffle(shuffled);
            int codingCount = questionCount > 10 ? 3 : Math.max(1, questionCount);
            int limit = Math.min(shuffled.size(), codingCount);
            for (int i = 0; i < limit; i++) {
                CodingProblem p = shuffled.get(i);
                List<String> samples = new ArrayList<>();
                if (p.getSampleInput() != null) samples.add("Input: " + p.getSampleInput());
                if (p.getSampleOutput() != null) samples.add("Output: " + p.getSampleOutput());
                String template = (p.getTemplates() != null && p.getTemplates().containsKey("java"))
                        ? p.getTemplates().get("java")
                        : (p.getTemplates() != null && !p.getTemplates().isEmpty() ? p.getTemplates().values().iterator().next() : null);
                list.add(new RoundAssessmentQuestionDto(
                        p.getId(),
                        "CODING",
                        p.getTitle(),
                        p.getStatement(),
                        null,
                        p.getTopic() != null ? p.getTopic() : "Algorithms",
                        p.getDifficulty() != null ? p.getDifficulty().name() : "MEDIUM",
                        10,
                        template,
                        null,
                        samples
                ));
            }
        }

        return list;
    }
}

