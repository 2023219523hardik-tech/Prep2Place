package com.placement.jobs.service;

import com.placement.entity.Role;
import com.placement.entity.StudentProfile;
import com.placement.entity.User;
import com.placement.exception.ApiException;
import com.placement.jobs.dto.CompanyAdminDtos.*;
import com.placement.jobs.dto.JobDtos.PageResponse;
import com.placement.jobs.entity.*;
import com.placement.jobs.repository.*;
import com.placement.questionbank.entity.Company;
import com.placement.questionbank.repository.CompanyRepository;
import com.placement.repository.StudentProfileRepository;
import com.placement.repository.UserRepository;
import com.placement.security.JwtUtil;
import com.placement.service.CurrentUserService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class CompanyAdminService {

    private final CompanySecurityService securityService;
    private final CompanyRepository companyRepository;
    private final UserRepository userRepository;
    private final StudentProfileRepository studentProfileRepository;
    private final JobOpportunityRepository jobRepository;
    private final JobApplicationRepository applicationRepository;
    private final HiringRoundRepository hiringRoundRepository;
    private final RoundAttemptRepository roundAttemptRepository;
    private final CurrentUserService currentUserService;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final CandidateReminderService reminderService;
    private final RoundScheduleValidator scheduleValidator;

    /**
     * Authenticates a company admin for the company identified by companySlug.
     */
    @Transactional(readOnly = true)
    public CompanyLoginResponse login(String companySlug, CompanyLoginRequest req) {
        Company company = securityService.getCompanyBySlug(companySlug);

        User user = userRepository.findByEmail(req.email().trim().toLowerCase())
                .orElseThrow(() -> ApiException.unauthorized("Invalid email or password"));

        if (!passwordEncoder.matches(req.password(), user.getPassword())) {
            throw ApiException.unauthorized("Invalid email or password");
        }

        if (!user.isActive()) {
            throw ApiException.unauthorized("Account has been deactivated");
        }

        // Validate user role and company match
        if (user.getRole() != Role.ADMIN) {
            if (user.getRole() != Role.COMPANY_ADMIN) {
                throw ApiException.forbidden("You do not have Company Administrator access");
            }
            if (user.getCompany() == null ||
                (!user.getCompany().getId().equals(company.getId()) &&
                 !user.getCompany().getSlug().equalsIgnoreCase(company.getSlug()))) {
                throw ApiException.forbidden("You are not an administrator for " + company.getName());
            }
        }

        String accessToken = jwtUtil.generateAccessToken(user.getEmail(), Map.of(
                "role", user.getRole().name(),
                "userId", user.getId(),
                "companyId", company.getId(),
                "companySlug", company.getSlug()
        ));
        String refreshToken = jwtUtil.generateRefreshToken(user.getEmail());

        CompanyAdminUser userDto = new CompanyAdminUser(
                user.getId(),
                user.getEmail(),
                user.getFullName(),
                user.getRole().name(),
                user.isEmailVerified(),
                user.isPremium()
        );

        CompanyInfo companyInfo = toCompanyInfo(company);
        return new CompanyLoginResponse(accessToken, refreshToken, userDto, companyInfo);
    }

    /**
     * Dashboard statistics and hiring funnel for company admin.
     */
    @Transactional(readOnly = true)
    public CompanyDashboardStats getDashboard(String companySlug) {
        Company company = securityService.validateCompanyAdminAccess(companySlug);
        Long companyId = company.getId();
        String companyName = company.getName();

        long totalJobs = jobRepository.countByCompanyRefId(companyId);
        long activeJobs = jobRepository.countByCompanyRefIdAndActiveTrue(companyId);
        long totalApps = applicationRepository.countByCompany(companyId, companyName);

        long eligible = applicationRepository.countByCompanyAndStatus(companyId, companyName, JobApplicationStatus.ELIGIBLE);
        long shortlisted = applicationRepository.countByCompanyAndStatus(companyId, companyName, JobApplicationStatus.SHORTLISTED);
        long inAssessment = applicationRepository.countByCompanyAndStatus(companyId, companyName, JobApplicationStatus.ASSESSMENT_PENDING)
                + applicationRepository.countByCompanyAndStatus(companyId, companyName, JobApplicationStatus.IN_PROGRESS);
        long inInterview = applicationRepository.countByCompanyAndStatus(companyId, companyName, JobApplicationStatus.INTERVIEW)
                + applicationRepository.countByCompanyAndStatus(companyId, companyName, JobApplicationStatus.INTERVIEW_SCHEDULED);
        long selected = applicationRepository.countByCompanyAndStatus(companyId, companyName, JobApplicationStatus.SELECTED)
                + applicationRepository.countByCompanyAndStatus(companyId, companyName, JobApplicationStatus.OFFER)
                + applicationRepository.countByCompanyAndStatus(companyId, companyName, JobApplicationStatus.OFFER_RELEASED)
                + applicationRepository.countByCompanyAndStatus(companyId, companyName, JobApplicationStatus.OFFER_ACCEPTED);
        long rejected = applicationRepository.countByCompanyAndStatus(companyId, companyName, JobApplicationStatus.REJECTED);

        Map<String, Long> funnel = new LinkedHashMap<>();
        funnel.put("APPLICATIONS", totalApps);
        funnel.put("ELIGIBLE", eligible + shortlisted + inAssessment + inInterview + selected);
        funnel.put("SHORTLISTED", shortlisted + inAssessment + inInterview + selected);
        funnel.put("ASSESSMENT", inAssessment + inInterview + selected);
        funnel.put("INTERVIEW", inInterview + selected);
        funnel.put("SELECTED", selected);

        return new CompanyDashboardStats(
                totalJobs,
                activeJobs,
                totalApps,
                eligible,
                shortlisted,
                inAssessment,
                inInterview,
                selected,
                rejected,
                funnel
        );
    }

    /**
     * List all jobs posted by this company.
     */
    @Transactional(readOnly = true)
    public PageResponse<CompanyJobDetail> listJobs(String companySlug, String search, String status, int page, int size) {
        Company company = securityService.validateCompanyAdminAccess(companySlug);
        Pageable pageable = PageRequest.of(page, size);

        Page<JobOpportunity> result = jobRepository.searchByCompany(
                company.getId(),
                company.getName(),
                (search != null && !search.isBlank()) ? search.trim() : null,
                (status != null && !status.isBlank()) ? status.trim().toUpperCase() : null,
                pageable
        );

        List<CompanyJobDetail> content = result.getContent().stream()
                .map(j -> toJobDetail(j, company))
                .toList();

        return new PageResponse<>(content, result.getTotalElements(), result.getNumber(), result.getSize());
    }

    /**
     * Retrieve a specific job detail belonging to this company.
     */
    @Transactional(readOnly = true)
    public CompanyJobDetail getJobDetail(String companySlug, Long jobId) {
        JobOpportunity job = securityService.validateJobOwnership(companySlug, jobId);
        Company company = securityService.getCompanyBySlug(companySlug);
        return toJobDetail(job, company);
    }

    /**
     * Create a new Job Opportunity and configure its initial hiring pipeline.
     */
    @Transactional
    public CompanyJobDetail createJob(String companySlug, CompanyJobUpsertRequest req) {
        Company company = securityService.validateCompanyAdminAccess(companySlug);
        User adminUser = currentUserService.getCurrentUser();

        String slug = req.slug();
        if (slug == null || slug.isBlank()) {
            slug = generateSlug(req.title(), company.getSlug());
        }

        JobOpportunity job = JobOpportunity.builder()
                .title(req.title().trim())
                .slug(slug)
                .company(company.getName())
                .companyRef(company)
                .location(req.location())
                .employmentType(req.employmentType() != null ? req.employmentType() : "FULL_TIME")
                .experienceLevel(req.experienceLevel() != null ? req.experienceLevel() : "ENTRY")
                .department(req.department())
                .openings(req.openings() != null ? req.openings() : 1)
                .salaryMinLpa(req.salaryMinLpa())
                .salaryMaxLpa(req.salaryMaxLpa())
                .stipend(req.stipend())
                .description(req.description())
                .responsibilities(req.responsibilities())
                .requiredSkills(req.requiredSkills())
                .niceToHaveSkills(req.niceToHaveSkills())
                .benefits(req.benefits())
                .minCgpa(req.minCgpa())
                .maxBacklogs(req.maxBacklogs())
                .graduationYear(req.graduationYear())
                .minGraduationYear(req.minGraduationYear())
                .maxGraduationYear(req.maxGraduationYear())
                .branches(req.branches())
                .allowedDegrees(req.allowedDegrees())
                .requiredCertifications(req.requiredCertifications())
                .applyUrl(req.applyUrl())
                .closesAt(req.closesAt())
                .status(req.status() != null ? req.status().toUpperCase() : "PUBLISHED")
                .active(!"CLOSED".equalsIgnoreCase(req.status()) && !"ARCHIVED".equalsIgnoreCase(req.status()))
                .pipelineManagementMode(req.pipelineManagementMode() != null ? PipelineExecutionMode.valueOf(req.pipelineManagementMode().toUpperCase()) : PipelineExecutionMode.PREP2PLACE_MANAGED)
                .schedulingPolicy(parseSchedulingPolicy(req.schedulingPolicy()))
                .atsScreeningEnabled(req.atsScreeningEnabled() != null ? req.atsScreeningEnabled() : true)
                .atsMinimumScore(req.atsMinimumScore() != null ? req.atsMinimumScore() : 75.0)
                .autoShortlistEnabled(req.autoShortlistEnabled() != null ? req.autoShortlistEnabled() : true)
                .manualReviewRequired(req.manualReviewRequired() != null ? req.manualReviewRequired() : false)
                .atsScoringWeights(req.atsScoringWeights())
                .postedBy(adminUser)
                .postedAt(LocalDateTime.now())
                .build();

        job = jobRepository.save(job);

        // Save hiring pipeline rounds
        List<HiringRoundDto> roundsDto = req.rounds();
        if (roundsDto == null || roundsDto.isEmpty()) {
            roundsDto = createDefaultPipeline();
        }
        savePipelineRounds(job, roundsDto);

        return toJobDetail(job, company);
    }

    /**
     * Update an existing job and its pipeline.
     */
    @Transactional
    public CompanyJobDetail updateJob(String companySlug, Long jobId, CompanyJobUpsertRequest req) {
        JobOpportunity job = securityService.validateJobOwnership(companySlug, jobId);
        Company company = securityService.getCompanyBySlug(companySlug);

        job.setTitle(req.title().trim());
        if (req.slug() != null && !req.slug().isBlank()) job.setSlug(req.slug().trim());
        job.setLocation(req.location());
        if (req.employmentType() != null) job.setEmploymentType(req.employmentType());
        if (req.experienceLevel() != null) job.setExperienceLevel(req.experienceLevel());
        job.setDepartment(req.department());
        if (req.openings() != null) job.setOpenings(req.openings());
        job.setSalaryMinLpa(req.salaryMinLpa());
        job.setSalaryMaxLpa(req.salaryMaxLpa());
        job.setStipend(req.stipend());
        job.setDescription(req.description());
        job.setResponsibilities(req.responsibilities());
        job.setRequiredSkills(req.requiredSkills());
        job.setNiceToHaveSkills(req.niceToHaveSkills());
        job.setBenefits(req.benefits());
        job.setMinCgpa(req.minCgpa());
        job.setMaxBacklogs(req.maxBacklogs());
        job.setGraduationYear(req.graduationYear());
        job.setMinGraduationYear(req.minGraduationYear());
        job.setMaxGraduationYear(req.maxGraduationYear());
        job.setBranches(req.branches());
        job.setAllowedDegrees(req.allowedDegrees());
        job.setRequiredCertifications(req.requiredCertifications());
        job.setApplyUrl(req.applyUrl());
        job.setClosesAt(req.closesAt());
        if (req.pipelineManagementMode() != null) {
            try { job.setPipelineManagementMode(PipelineExecutionMode.valueOf(req.pipelineManagementMode().toUpperCase())); } catch (Exception ignored) {}
        }
        if (req.schedulingPolicy() != null && !req.schedulingPolicy().isBlank()) {
            job.setSchedulingPolicy(parseSchedulingPolicy(req.schedulingPolicy()));
        }
        if (req.atsScreeningEnabled() != null) job.setAtsScreeningEnabled(req.atsScreeningEnabled());
        if (req.atsMinimumScore() != null) job.setAtsMinimumScore(req.atsMinimumScore());
        if (req.autoShortlistEnabled() != null) job.setAutoShortlistEnabled(req.autoShortlistEnabled());
        if (req.manualReviewRequired() != null) job.setManualReviewRequired(req.manualReviewRequired());
        if (req.atsScoringWeights() != null) job.setAtsScoringWeights(req.atsScoringWeights());
        if (req.status() != null) {
            job.setStatus(req.status().toUpperCase());
            job.setActive(!"CLOSED".equalsIgnoreCase(req.status()) && !"ARCHIVED".equalsIgnoreCase(req.status()));
        }

        job = jobRepository.save(job);

        if (req.rounds() != null && !req.rounds().isEmpty()) {
            savePipelineRounds(job, req.rounds());
        }

        return toJobDetail(job, company);
    }

    /**
     * Change job publishing status: DRAFT | PUBLISHED | CLOSED | ARCHIVED
     */
    @Transactional
    public void updateJobStatus(String companySlug, Long jobId, String status) {
        JobOpportunity job = securityService.validateJobOwnership(companySlug, jobId);
        String s = status.trim().toUpperCase();
        job.setStatus(s);
        job.setActive("PUBLISHED".equals(s));
        jobRepository.save(job);
    }

    /**
     * Delete a job opportunity.
     */
    @Transactional
    public void deleteJob(String companySlug, Long jobId) {
        JobOpportunity job = securityService.validateJobOwnership(companySlug, jobId);
        jobRepository.delete(job);
    }

    /**
     * Configures/replaces the entire hiring pipeline for a job.
     */
    @Transactional
    public List<HiringRoundDto> configurePipeline(String companySlug, Long jobId, List<HiringRoundDto> rounds) {
        JobOpportunity job = securityService.validateJobOwnership(companySlug, jobId);
        savePipelineRounds(job, rounds);
        return hiringRoundRepository.findByJobIdOrderByRoundOrderAsc(job.getId()).stream()
                .map(this::toRoundDto)
                .toList();
    }

    /**
     * List applications for a specific company job.
     */
    @Transactional(readOnly = true)
    public PageResponse<CandidateApplicationDetail> listApplications(
            String companySlug, Long jobId, String status, int page, int size) {
        Company company = securityService.validateCompanyAdminAccess(companySlug);
        if (jobId != null) {
            securityService.validateJobOwnership(companySlug, jobId);
        }

        Pageable pageable = PageRequest.of(page, size);
        JobApplicationStatus st = (status != null && !status.isBlank())
                ? JobApplicationStatus.valueOf(status.trim().toUpperCase()) : null;

        Page<JobApplication> result = applicationRepository.findByCompanyAndFilters(
                company.getId(), company.getName(), jobId, st, pageable);

        List<CandidateApplicationDetail> content = result.getContent().stream()
                .map(this::toCandidateDetail)
                .toList();

        return new PageResponse<>(content, result.getTotalElements(), result.getNumber(), result.getSize());
    }

    /**
     * List all candidate applicants across all company jobs.
     */
    @Transactional(readOnly = true)
    public PageResponse<CandidateApplicationDetail> listCandidates(
            String companySlug, String search, int page, int size) {
        Company company = securityService.validateCompanyAdminAccess(companySlug);
        Pageable pageable = PageRequest.of(page, size);

        Page<JobApplication> result = applicationRepository.searchCandidatesByCompany(
                company.getId(), company.getName(), (search != null && !search.isBlank()) ? search.trim() : null, pageable);

        List<CandidateApplicationDetail> content = result.getContent().stream()
                .map(this::toCandidateDetail)
                .toList();

        return new PageResponse<>(content, result.getTotalElements(), result.getNumber(), result.getSize());
    }

    /**
     * Get candidate application detail including round attempts.
     */
    @Transactional(readOnly = true)
    public CandidateApplicationDetail getApplicationDetail(String companySlug, Long applicationId) {
        Company company = securityService.validateCompanyAdminAccess(companySlug);
        JobApplication app = applicationRepository.findById(applicationId)
                .orElseThrow(() -> ApiException.notFound("Application not found: " + applicationId));

        // Validate company ownership
        if (app.getJob().getCompanyRef() != null &&
            !app.getJob().getCompanyRef().getId().equals(company.getId()) &&
            !app.getJob().getCompanyRef().getSlug().equalsIgnoreCase(company.getSlug())) {
            throw ApiException.forbidden("Application does not belong to this company");
        }

        return toCandidateDetail(app);
    }

    /**
     * Evaluates a round attempt: scores candidate, notes feedback, and advances candidate if passed.
     */
    @Transactional
    public RoundAttemptDetail evaluateRoundAttempt(String companySlug, Long attemptId, EvaluateRoundRequest req) {
        Company company = securityService.validateCompanyAdminAccess(companySlug);
        User admin = currentUserService.getCurrentUser();

        RoundAttempt attempt = roundAttemptRepository.findById(attemptId)
                .orElseThrow(() -> ApiException.notFound("Round attempt not found: " + attemptId));

        JobApplication app = attempt.getApplication();
        HiringRound round = attempt.getRound();

        attempt.setScore(req.score());
        attempt.setPassed(req.passed() != null ? req.passed() : (req.score() != null && round.getPassingScore() != null && req.score() >= round.getPassingScore()));
        attempt.setFeedback(req.feedback());
        attempt.setNotes(req.notes());
        attempt.setEvaluatedBy(admin);
        attempt.setCompletedAt(LocalDateTime.now());
        attempt.setStatus(Boolean.TRUE.equals(attempt.getPassed()) ? RoundAttemptStatus.PASSED : RoundAttemptStatus.FAILED);
        attempt = roundAttemptRepository.save(attempt);

        // Update overall application status and progress pipeline
        if (Boolean.TRUE.equals(attempt.getPassed())) {
            // Find next round in pipeline
            List<HiringRound> allRounds = hiringRoundRepository.findByJobIdOrderByRoundOrderAsc(round.getJob().getId());
            int currentIndex = allRounds.indexOf(round);
            if (currentIndex >= 0 && currentIndex < allRounds.size() - 1) {
                HiringRound nextRound = allRounds.get(currentIndex + 1);
                app.setCurrentRound(nextRound);
                app.setStatus(JobApplicationStatus.IN_PROGRESS);

                // If auto-unlock is enabled, create initial attempt for next round
                if (nextRound.isAutoUnlock()) {
                    RoundAttempt nextAttempt = RoundAttempt.builder()
                            .application(app)
                            .round(nextRound)
                            .attemptNumber(1)
                            .status(RoundAttemptStatus.NOT_STARTED)
                            .createdAt(LocalDateTime.now())
                            .build();
                    roundAttemptRepository.save(nextAttempt);
                }
            } else {
                // Completed all rounds successfully
                app.setStatus(JobApplicationStatus.QUALIFIED);
                app.setFinalDecision("QUALIFIED");
            }
        } else {
            // Candidate failed round
            app.setStatus(JobApplicationStatus.REJECTED);
            app.setFinalDecision("REJECTED");
        }

        app.setUpdatedAt(LocalDateTime.now());
        applicationRepository.save(app);

        return toRoundAttemptDetail(attempt);
    }

    /**
     * Schedules a live technical or HR interview with meeting details.
     */
    @Transactional
    public RoundAttemptDetail scheduleInterview(String companySlug, Long attemptId, ScheduleInterviewRequest req) {
        securityService.validateCompanyAdminAccess(companySlug);

        RoundAttempt attempt = roundAttemptRepository.findById(attemptId)
                .orElseThrow(() -> ApiException.notFound("Round attempt not found: " + attemptId));

        attempt.setInterviewScheduledAt(req.interviewScheduledAt());
        attempt.setInterviewerMeetingLink(req.interviewerMeetingLink());
        if (req.notes() != null) attempt.setNotes(req.notes());
        attempt.setStatus(RoundAttemptStatus.SCHEDULED);
        attempt = roundAttemptRepository.save(attempt);

        JobApplication app = attempt.getApplication();
        app.setStatus(JobApplicationStatus.INTERVIEW_SCHEDULED);
        app.setUpdatedAt(LocalDateTime.now());
        applicationRepository.save(app);

        // Schedule automated idempotent candidate reminders
        if (attempt.getRound() != null && req.interviewScheduledAt() != null) {
            reminderService.scheduleRemindersForRound(attempt.getRound(), req.interviewScheduledAt());
        }

        return toRoundAttemptDetail(attempt);
    }

    /**
     * Updates final hiring decision: SELECTED | OFFER_RELEASED | REJECTED | ON_HOLD
     */
    @Transactional
    public CandidateApplicationDetail updateDecision(String companySlug, Long applicationId, DecisionRequest req) {
        Company company = securityService.validateCompanyAdminAccess(companySlug);
        JobApplication app = applicationRepository.findById(applicationId)
                .orElseThrow(() -> ApiException.notFound("Application not found: " + applicationId));

        String dec = req.decision().trim().toUpperCase();
        app.setFinalDecision(dec);
        try {
            app.setStatus(JobApplicationStatus.valueOf(dec));
        } catch (IllegalArgumentException e) {
            // map common decision strings to enum
            if ("OFFER".equalsIgnoreCase(dec)) app.setStatus(JobApplicationStatus.OFFER);
            else if ("SELECTED".equalsIgnoreCase(dec)) app.setStatus(JobApplicationStatus.SELECTED);
            else if ("REJECTED".equalsIgnoreCase(dec)) app.setStatus(JobApplicationStatus.REJECTED);
        }
        app.setUpdatedAt(LocalDateTime.now());
        app = applicationRepository.save(app);

        return toCandidateDetail(app);
    }

    // --- Helpers ---

    private void savePipelineRounds(JobOpportunity job, List<HiringRoundDto> dtos) {
        if (dtos == null || dtos.isEmpty()) {
            return;
        }

        // Validate schedule conflicts before persisting
        scheduleValidator.validatePipelineSchedule(dtos, job.getSchedulingPolicy());
        List<HiringRoundDto> normalized = scheduleValidator.normalizeRoundSchedules(dtos);

        hiringRoundRepository.deleteByJobId(job.getId());

        int order = 1;
        for (HiringRoundDto r : normalized) {
            HiringRoundType type;
            try {
                type = HiringRoundType.valueOf(r.roundType().toUpperCase());
            } catch (Exception e) {
                type = HiringRoundType.APTITUDE;
            }

            RoundManagementMode mode = RoundManagementMode.AUTOMATIC;
            if (r.managementMode() != null) {
                try {
                    mode = RoundManagementMode.valueOf(r.managementMode().toUpperCase());
                } catch (Exception ignored) {}
            }

            RoundLifecycleStatus rStatus = RoundLifecycleStatus.DRAFT;
            if (r.roundStatus() != null) {
                try {
                    rStatus = RoundLifecycleStatus.valueOf(r.roundStatus().toUpperCase());
                } catch (Exception ignored) {}
            }

            boolean activated = Boolean.TRUE.equals(r.isActivated()) || rStatus == RoundLifecycleStatus.LIVE;

            HiringRound round = HiringRound.builder()
                    .job(job)
                    .roundOrder(order++)
                    .name(r.name() != null ? r.name().trim() : ("Round " + order + ": " + type.name()))
                    .roundType(type)
                    .durationMinutes(r.durationMinutes() != null ? r.durationMinutes() : 60)
                    .passingScore(r.passingScore() != null ? r.passingScore() : 60.0)
                    .weightage(r.weightage() != null ? r.weightage() : 25.0)
                    .maxAttempts(r.maxAttempts() != null ? r.maxAttempts() : 1)
                    .repeatable(Boolean.TRUE.equals(r.repeatable()))
                    .autoUnlock(r.autoUnlock() != null ? r.autoUnlock() : true)
                    .managementMode(mode)
                    .assessmentConfig(r.assessmentConfig())
                    .roundStatus(rStatus)
                    .startDate(r.startDate())
                    .startTime(r.startTime())
                    .endDate(r.endDate())
                    .endTime(r.endTime())
                    .timezone(r.timezone() != null && !r.timezone().isBlank() ? r.timezone() : "Asia/Kolkata")
                    .isActivated(activated)
                    .proctoringConfig(r.proctoringConfig())
                    .build();

            round = hiringRoundRepository.save(round);

            // Sync reminder schedules
            if (round.getStartDate() != null && round.getStartTime() != null) {
                LocalDateTime startZdt = LocalDateTime.of(round.getStartDate(), round.getStartTime());
                reminderService.rescheduleRemindersForRound(round.getId(), startZdt);
                reminderService.scheduleRemindersForRound(round, startZdt);
            } else {
                reminderService.cancelRemindersForRound(round.getId());
            }
        }
    }

    private List<HiringRoundDto> createDefaultPipeline() {
        return List.of(
                new HiringRoundDto(null, 1, "Round 1: Online Aptitude Assessment", "APTITUDE", 60, 60.0, 20.0, 1, false, true, "AUTOMATIC", null, "DRAFT", null, null, null, null, "Asia/Kolkata", false, "{\"webcam\":true,\"mic\":true,\"screenShare\":true,\"fullScreen\":true,\"tabLimit\":3,\"multiFace\":true,\"seb\":false}"),
                new HiringRoundDto(null, 2, "Round 2: Technical MCQ & Core Concepts", "TECHNICAL_MCQ", 45, 65.0, 25.0, 1, false, true, "AUTOMATIC", null, "DRAFT", null, null, null, null, "Asia/Kolkata", false, "{\"webcam\":true,\"mic\":true,\"screenShare\":true,\"fullScreen\":true,\"tabLimit\":3,\"multiFace\":true,\"seb\":false}"),
                new HiringRoundDto(null, 3, "Round 3: DSA & Problem Solving Lab", "DSA", 90, 70.0, 30.0, 1, false, true, "AUTOMATIC", null, "DRAFT", null, null, null, null, "Asia/Kolkata", false, "{\"webcam\":true,\"mic\":true,\"screenShare\":true,\"fullScreen\":true,\"tabLimit\":3,\"multiFace\":true,\"seb\":false}"),
                new HiringRoundDto(null, 4, "Round 4: Technical & System Discussion", "TECHNICAL_INTERVIEW", 45, 70.0, 25.0, 1, false, false, "SCHEDULED_INTERVIEW", null, "DRAFT", null, null, null, null, "Asia/Kolkata", false, null)
        );
    }

    private CompanyJobDetail toJobDetail(JobOpportunity j, Company company) {
        long count = applicationRepository.countByJobId(j.getId());
        List<HiringRoundDto> rounds = hiringRoundRepository.findByJobIdOrderByRoundOrderAsc(j.getId()).stream()
                .map(this::toRoundDto)
                .toList();

        return new CompanyJobDetail(
                j.getId(),
                j.getSlug(),
                j.getTitle(),
                j.getCompany(),
                toCompanyInfo(company),
                j.getLocation(),
                j.getEmploymentType(),
                j.getExperienceLevel(),
                j.getDepartment(),
                j.getOpenings(),
                j.getSalaryMinLpa(),
                j.getSalaryMaxLpa(),
                j.getStipend(),
                j.getDescription(),
                j.getResponsibilities(),
                j.getRequiredSkills(),
                j.getNiceToHaveSkills(),
                j.getBenefits(),
                j.getMinCgpa(),
                j.getMaxBacklogs(),
                j.getGraduationYear(),
                j.getMinGraduationYear(),
                j.getMaxGraduationYear(),
                j.getBranches(),
                j.getAllowedDegrees(),
                j.getRequiredCertifications(),
                j.getApplyUrl(),
                j.getPostedAt(),
                j.getClosesAt(),
                j.getStatus(),
                j.isActive(),
                j.getPipelineManagementMode() != null ? j.getPipelineManagementMode().name() : "PREP2PLACE_MANAGED",
                j.getSchedulingPolicy() != null ? j.getSchedulingPolicy().name() : "SEQUENTIAL",
                j.isAtsScreeningEnabled(),
                j.getAtsMinimumScore(),
                j.isAutoShortlistEnabled(),
                j.isManualReviewRequired(),
                j.getAtsScoringWeights(),
                count,
                rounds
        );
    }

    private HiringRoundDto toRoundDto(HiringRound r) {
        return new HiringRoundDto(
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
                r.getManagementMode() != null ? r.getManagementMode().name() : "AUTOMATIC",
                r.getAssessmentConfig(),
                r.getRoundStatus() != null ? r.getRoundStatus().name() : "DRAFT",
                r.getStartDate(),
                r.getStartTime(),
                r.getEndDate(),
                r.getEndTime(),
                r.getTimezone(),
                r.isActivated(),
                r.getProctoringConfig()
        );
    }

    private RoundAttemptDetail toRoundAttemptDetail(RoundAttempt a) {
        return new RoundAttemptDetail(
                a.getId(),
                a.getRound().getId(),
                a.getRound().getName(),
                a.getRound().getRoundType().name(),
                a.getRound().getRoundOrder(),
                a.getAttemptNumber(),
                a.getScore(),
                a.getRound().getPassingScore(),
                a.getPassed(),
                a.getStatus().name(),
                a.getFeedback(),
                a.getNotes(),
                a.getInterviewScheduledAt(),
                a.getInterviewerMeetingLink(),
                a.getEvaluatedBy() != null ? a.getEvaluatedBy().getFullName() : null,
                a.getCompletedAt()
        );
    }

    private CandidateApplicationDetail toCandidateDetail(JobApplication a) {
        User applicant = a.getApplicant();
        StudentProfile profile = studentProfileRepository.findByUserId(applicant.getId()).orElse(null);
        List<RoundAttemptDetail> attempts = roundAttemptRepository
                .findByApplicationIdOrderByRoundRoundOrderAscAttemptNumberAsc(a.getId()).stream()
                .map(this::toRoundAttemptDetail)
                .toList();

        String resumeFileName = (profile != null && profile.getResumeFileName() != null && !profile.getResumeFileName().isBlank())
                ? profile.getResumeFileName()
                : (applicant.getFullName().replaceAll("[^a-zA-Z0-9_.-]", "_") + "_Resume.pdf");

        return new CandidateApplicationDetail(
                a.getId(),
                a.getJob().getId(),
                a.getJob().getTitle(),
                applicant.getId(),
                applicant.getFullName(),
                applicant.getEmail(),
                profile != null ? profile.getPhone() : null,
                profile != null ? profile.getCollege() : null,
                profile != null ? profile.getDegree() : null,
                profile != null ? profile.getBranch() : null,
                profile != null ? profile.getGraduationYear() : null,
                profile != null ? profile.getCgpa() : null,
                a.getStatus().name(),
                a.getAppliedAt(),
                a.getResumeText(),
                resumeFileName,
                a.getCoverNote(),
                a.getCurrentRound() != null ? a.getCurrentRound().getId() : null,
                a.getCurrentRound() != null ? a.getCurrentRound().getName() : null,
                a.getCurrentRound() != null ? a.getCurrentRound().getRoundType().name() : null,
                a.getOverallScore(),
                a.getFinalDecision(),
                a.getAtsScore(),
                a.getAtsParsingStatus(),
                a.isEligibilityPassed(),
                a.getEligibilityFailureReason(),
                a.getAtsScoreBreakdown(),
                a.getRecruiterAuditNotes(),
                attempts
        );
    }

    private CompanyInfo toCompanyInfo(Company c) {
        return new CompanyInfo(
                c.getId(),
                c.getSlug(),
                c.getName(),
                c.getLogoUrl(),
                c.getDescription(),
                c.getWebsite()
        );
    }

    private String generateSlug(String title, String companySlug) {
        String base = (companySlug + "-" + title).toLowerCase()
                .replaceAll("[^a-z0-9]+", "-")
                .replaceAll("^-+|-+$", "");
        return base + "-" + System.currentTimeMillis() % 10000;
    }

    /**
     * Live Candidate Monitoring: active candidates undergoing assessments or interviews.
     */
    @Transactional(readOnly = true)
    public List<LiveCandidateDto> getLiveMonitoring(String companySlug) {
        Company company = securityService.validateCompanyAdminAccess(companySlug);
        List<RoundAttempt> attempts = roundAttemptRepository.findActiveAttemptsByCompany(
                company.getId(), company.getName(),
                List.of(RoundAttemptStatus.IN_PROGRESS, RoundAttemptStatus.NOT_STARTED, RoundAttemptStatus.SCHEDULED)
        );

        List<LiveCandidateDto> list = new ArrayList<>();
        LocalDateTime now = LocalDateTime.now();

        for (RoundAttempt a : attempts) {
            JobApplication app = a.getApplication();
            User applicant = app.getApplicant();
            HiringRound round = a.getRound();
            int durationMinutes = (round != null && round.getDurationMinutes() != null) ? round.getDurationMinutes() : 60;
            LocalDateTime startedAt = a.getCreatedAt() != null ? a.getCreatedAt() : now;
            long elapsedSeconds = java.time.Duration.between(startedAt, now).getSeconds();
            int remainingSeconds = Math.max(0, (int) (durationMinutes * 60 - elapsedSeconds));

            int violations = 0;
            if (a.getNotes() != null && a.getNotes().toLowerCase().contains("violation")) {
                violations = 1;
            }

            list.add(new LiveCandidateDto(
                    app.getId(),
                    applicant.getId(),
                    applicant.getFullName(),
                    applicant.getEmail(),
                    app.getJob().getId(),
                    app.getJob().getTitle(),
                    round != null ? round.getName() : "Assessment Round",
                    (round != null && round.getRoundType() != null) ? round.getRoundType().name() : "ONLINE_ASSESSMENT",
                    startedAt,
                    durationMinutes,
                    remainingSeconds,
                    a.getStatus().name(),
                    violations,
                    a.getStatus() == RoundAttemptStatus.IN_PROGRESS
            ));
        }

        return list;
    }

    /**
     * Candidate timeline history for company admin view.
     */
    @Transactional(readOnly = true)
    public List<TimelineEventDto> getApplicationTimeline(String companySlug, Long applicationId) {
        Company company = securityService.validateCompanyAdminAccess(companySlug);
        JobApplication app = applicationRepository.findById(applicationId)
                .orElseThrow(() -> ApiException.notFound("Application not found: " + applicationId));

        List<TimelineEventDto> events = new ArrayList<>();
        events.add(new TimelineEventDto(
                1L,
                "Application Submitted",
                "Applied for " + app.getJob().getTitle(),
                app.getAppliedAt(),
                "APPLICATION",
                app.getStatus().name(),
                null
        ));

        List<RoundAttempt> attempts = roundAttemptRepository.findByApplicationIdOrderByRoundRoundOrderAscAttemptNumberAsc(applicationId);
        long eventId = 2L;
        for (RoundAttempt a : attempts) {
            String title = (a.getRound() != null ? a.getRound().getName() : "Round") + " (Attempt " + a.getAttemptNumber() + ")";
            String desc = a.getFeedback() != null ? a.getFeedback() : "Round status: " + a.getStatus().name();
            LocalDateTime time = a.getCompletedAt() != null ? a.getCompletedAt() : a.getCreatedAt();
            events.add(new TimelineEventDto(
                    eventId++,
                    title,
                    desc,
                    time != null ? time : LocalDateTime.now(),
                    "ROUND_ATTEMPT",
                    a.getStatus().name(),
                    a.getScore()
            ));
        }

        if (app.getFinalDecision() != null) {
            events.add(new TimelineEventDto(
                    eventId++,
                    "Final Decision: " + app.getFinalDecision(),
                    "Decision registered by recruitment team",
                    app.getUpdatedAt() != null ? app.getUpdatedAt() : LocalDateTime.now(),
                    "DECISION",
                    app.getFinalDecision(),
                    app.getOverallScore()
            ));
        }

        return events;
    }

    /**
     * Manual company admin candidate actions:
     * ADVANCE_ROUND, MANUAL_PASS, MANUAL_FAIL, ALLOW_REATTEMPT, PUT_ON_HOLD, SHORTLIST, REJECT, ADD_NOTE
     */
    @Transactional
    public CandidateApplicationDetail handleCandidateAction(String companySlug, Long applicationId, CandidateActionRequest req) {
        Company company = securityService.validateCompanyAdminAccess(companySlug);
        JobApplication app = applicationRepository.findById(applicationId)
                .orElseThrow(() -> ApiException.notFound("Application not found: " + applicationId));

        String action = req.action() != null ? req.action().trim().toUpperCase() : "";
        List<HiringRound> allRounds = hiringRoundRepository.findByJobIdOrderByRoundOrderAsc(app.getJob().getId());

        switch (action) {
            case "ADVANCE_ROUND":
            case "MANUAL_PASS": {
                if (app.getCurrentRound() != null) {
                    int idx = allRounds.indexOf(app.getCurrentRound());
                    if (idx >= 0 && idx < allRounds.size() - 1) {
                        HiringRound next = allRounds.get(idx + 1);
                        app.setCurrentRound(next);
                        app.setStatus(JobApplicationStatus.IN_PROGRESS);

                        RoundAttempt nextAttempt = RoundAttempt.builder()
                                .application(app)
                                .round(next)
                                .attemptNumber(1)
                                .status(RoundAttemptStatus.NOT_STARTED)
                                .createdAt(LocalDateTime.now())
                                .build();
                        roundAttemptRepository.save(nextAttempt);
                    } else {
                        app.setStatus(JobApplicationStatus.SELECTED);
                        app.setFinalDecision("SELECTED");
                    }
                }
                break;
            }
            case "MANUAL_FAIL":
            case "REJECT": {
                app.setStatus(JobApplicationStatus.REJECTED);
                app.setFinalDecision("REJECTED");
                break;
            }
            case "SHORTLIST": {
                app.setStatus(JobApplicationStatus.SHORTLISTED);
                break;
            }
            case "SCREEN_ELIGIBLE": {
                app.setStatus(JobApplicationStatus.ELIGIBLE);
                break;
            }
            case "SCREEN_NOT_ELIGIBLE": {
                app.setStatus(JobApplicationStatus.NOT_ELIGIBLE);
                break;
            }
            case "DISQUALIFY": {
                app.setStatus(JobApplicationStatus.DISQUALIFIED);
                app.setFinalDecision("DISQUALIFIED");
                if (req.notes() != null && !req.notes().isBlank()) {
                    String existing = app.getCoverNote() != null ? app.getCoverNote() + "\n" : "";
                    app.setCoverNote(existing + "[Disqualification Audit]: " + req.notes().trim());
                }
                // Invalidate any open or in-progress attempts for this application
                var attempts = roundAttemptRepository.findByApplicationId(applicationId);
                for (RoundAttempt ra : attempts) {
                    if (ra.getStatus() == RoundAttemptStatus.IN_PROGRESS || ra.getStatus() == RoundAttemptStatus.NOT_STARTED || ra.getStatus() == RoundAttemptStatus.SCHEDULED) {
                        ra.setStatus(RoundAttemptStatus.FAILED);
                        ra.setPassed(false);
                        ra.setNotes("Disqualified by company recruiter: " + (req.notes() != null ? req.notes() : "Policy violation"));
                        roundAttemptRepository.save(ra);
                    }
                }
                break;
            }
            case "PUT_ON_HOLD": {
                app.setStatus(JobApplicationStatus.ON_HOLD);
                break;
            }
            case "ALLOW_REATTEMPT": {
                if (app.getCurrentRound() != null) {
                    var latestOpt = roundAttemptRepository.findTopByApplicationIdAndRoundIdOrderByAttemptNumberDesc(
                            applicationId, app.getCurrentRound().getId());
                    int nextNum = latestOpt.map(r -> r.getAttemptNumber() + 1).orElse(2);
                    RoundAttempt newAttempt = RoundAttempt.builder()
                            .application(app)
                            .round(app.getCurrentRound())
                            .attemptNumber(nextNum)
                            .status(RoundAttemptStatus.NOT_STARTED)
                            .createdAt(LocalDateTime.now())
                            .build();
                    roundAttemptRepository.save(newAttempt);
                    app.setStatus(JobApplicationStatus.IN_PROGRESS);
                }
                break;
            }
            case "ADD_NOTE": {
                if (req.notes() != null && !req.notes().isBlank()) {
                    String existing = app.getCoverNote() != null ? app.getCoverNote() + "\n" : "";
                    app.setCoverNote(existing + "[Admin Note]: " + req.notes().trim());
                }
                break;
            }
            default:
                break;
        }

        if (req.score() != null) {
            app.setOverallScore(req.score());
        }
        app.setUpdatedAt(LocalDateTime.now());
        app = applicationRepository.save(app);

        return toCandidateDetail(app);
    }

    /**
     * List all interviews across jobs for this company.
     */
    @Transactional(readOnly = true)
    public List<CompanyInterviewReportDto> getInterviews(String companySlug) {
        Company company = securityService.validateCompanyAdminAccess(companySlug);
        List<RoundAttempt> attempts = roundAttemptRepository.findInterviewsByCompany(company.getId(), company.getName());

        List<CompanyInterviewReportDto> list = new ArrayList<>();
        for (RoundAttempt a : attempts) {
            JobApplication app = a.getApplication();
            User applicant = app.getApplicant();
            HiringRound round = a.getRound();
            list.add(new CompanyInterviewReportDto(
                    app.getId(),
                    applicant.getId(),
                    applicant.getFullName(),
                    applicant.getEmail(),
                    app.getJob().getId(),
                    app.getJob().getTitle(),
                    round != null ? round.getName() : "Interview",
                    (round != null && round.getRoundType() != null) ? round.getRoundType().name() : "TECHNICAL_INTERVIEW",
                    a.getInterviewScheduledAt() != null ? a.getInterviewScheduledAt() : a.getCreatedAt(),
                    a.getCompletedAt(),
                    a.getScore(),
                    round != null ? round.getPassingScore() : null,
                    a.getPassed(),
                    a.getStatus().name(),
                    a.getInterviewerMeetingLink(),
                    a.getNotes()
            ));
        }
        return list;
    }

    /**
     * List all candidate reports across jobs for this company.
     */
    @Transactional(readOnly = true)
    public List<CompanyInterviewReportDto> getReports(String companySlug) {
        Company company = securityService.validateCompanyAdminAccess(companySlug);
        List<RoundAttempt> attempts = roundAttemptRepository.findCompletedAttemptsByCompany(company.getId(), company.getName());

        List<CompanyInterviewReportDto> list = new ArrayList<>();
        for (RoundAttempt a : attempts) {
            JobApplication app = a.getApplication();
            User applicant = app.getApplicant();
            HiringRound round = a.getRound();
            list.add(new CompanyInterviewReportDto(
                    app.getId(),
                    applicant.getId(),
                    applicant.getFullName(),
                    applicant.getEmail(),
                    app.getJob().getId(),
                    app.getJob().getTitle(),
                    round != null ? round.getName() : "Assessment",
                    (round != null && round.getRoundType() != null) ? round.getRoundType().name() : "ONLINE_ASSESSMENT",
                    a.getCreatedAt(),
                    a.getCompletedAt(),
                    a.getScore(),
                    round != null ? round.getPassingScore() : null,
                    a.getPassed(),
                    a.getStatus().name(),
                    a.getInterviewerMeetingLink(),
                    a.getFeedback()
            ));
        }
        return list;
    }

    /**
     * ATS screening statistics and cutoff evaluation for a job.
     */
    @Transactional(readOnly = true)
    public AtsScreeningStats getAtsScreeningStats(String companySlug, Long jobId) {
        JobOpportunity job = securityService.validateJobOwnership(companySlug, jobId);
        List<JobApplication> apps = applicationRepository.findByJobId(jobId);

        double cutoff = (job.getAtsMinimumScore() != null) ? job.getAtsMinimumScore() : 75.0;

        long total = apps.size();
        long eligible = apps.stream().filter(JobApplication::isEligibilityPassed).count();
        long ineligible = total - eligible;
        long shortlisted = apps.stream().filter(a -> a.getStatus() == JobApplicationStatus.SHORTLISTED).count();
        long underReview = apps.stream().filter(a -> a.getStatus() == JobApplicationStatus.UNDER_REVIEW).count();
        long belowCutoff = apps.stream().filter(a -> a.getAtsScore() != null && a.getAtsScore() < cutoff).count();

        List<Double> scores = apps.stream()
                .map(JobApplication::getAtsScore)
                .filter(Objects::nonNull)
                .toList();

        double avg = scores.isEmpty() ? 0.0 : Math.round(scores.stream().mapToDouble(Double::doubleValue).average().orElse(0.0) * 10.0) / 10.0;
        double max = scores.isEmpty() ? 0.0 : scores.stream().mapToDouble(Double::doubleValue).max().orElse(0.0);
        double min = scores.isEmpty() ? 0.0 : scores.stream().mapToDouble(Double::doubleValue).min().orElse(0.0);

        return new AtsScreeningStats(total, eligible, ineligible, shortlisted, underReview, belowCutoff, avg, max, min, cutoff);
    }

    /**
     * Recruiter manual ATS override action: SHORTLIST, REJECT, SEND_FOR_REVIEW, OVERRIDE_ELIGIBILITY.
     */
    @Transactional
    public CandidateApplicationDetail overrideCandidateAts(String companySlug, Long applicationId, AtsOverrideRequest req) {
        Company company = securityService.validateCompanyAdminAccess(companySlug);
        JobApplication app = applicationRepository.findById(applicationId)
                .orElseThrow(() -> ApiException.notFound("Application not found: " + applicationId));

        if (app.getJob().getCompanyRef() != null &&
            !app.getJob().getCompanyRef().getId().equals(company.getId()) &&
            !app.getJob().getCompanyRef().getSlug().equalsIgnoreCase(company.getSlug())) {
            throw ApiException.forbidden("Application does not belong to this company");
        }

        String action = req.action().trim().toUpperCase();
        String notePrefix = "[" + LocalDateTime.now() + " - Recruiter Action]: ";
        String currentNotes = app.getRecruiterAuditNotes() != null ? app.getRecruiterAuditNotes() : "";

        switch (action) {
            case "SHORTLIST" -> {
                app.setStatus(JobApplicationStatus.SHORTLISTED);
                app.setRecruiterAuditNotes(currentNotes + "\n" + notePrefix + "Shortlisted candidate manually. Notes: " + (req.notes() != null ? req.notes() : "None"));
            }
            case "REJECT" -> {
                app.setStatus(JobApplicationStatus.REJECTED);
                app.setFinalDecision("REJECTED");
                app.setRecruiterAuditNotes(currentNotes + "\n" + notePrefix + "Rejected candidate manually. Reason: " + (req.notes() != null ? req.notes() : "None"));
            }
            case "SEND_FOR_REVIEW" -> {
                app.setStatus(JobApplicationStatus.UNDER_REVIEW);
                app.setRecruiterAuditNotes(currentNotes + "\n" + notePrefix + "Sent for manual review. Notes: " + (req.notes() != null ? req.notes() : "None"));
            }
            case "OVERRIDE_ELIGIBILITY" -> {
                app.setEligibilityPassed(true);
                app.setStatus(JobApplicationStatus.SHORTLISTED);
                app.setRecruiterAuditNotes(currentNotes + "\n" + notePrefix + "Academic eligibility criteria overridden by recruiter. Notes: " + (req.notes() != null ? req.notes() : "Authorized exception"));
            }
            default -> throw ApiException.badRequest("Unknown action: " + action + ". Supported: SHORTLIST, REJECT, SEND_FOR_REVIEW, OVERRIDE_ELIGIBILITY");
        }

        app.setUpdatedAt(LocalDateTime.now());
        app = applicationRepository.save(app);
        return toCandidateDetail(app);
    }

    /**
     * Transitions round lifecycle state and activates/deactivates assessment round.
     */
    @Transactional
    public HiringRoundDto updateRoundLifecycle(String companySlug, Long roundId, RoundLifecycleRequest req) {
        Company company = securityService.validateCompanyAdminAccess(companySlug);
        HiringRound round = hiringRoundRepository.findById(roundId)
                .orElseThrow(() -> ApiException.notFound("Round not found: " + roundId));

        if (round.getJob().getCompanyRef() != null &&
            !round.getJob().getCompanyRef().getId().equals(company.getId()) &&
            !round.getJob().getCompanyRef().getSlug().equalsIgnoreCase(company.getSlug())) {
            throw ApiException.forbidden("Round does not belong to this company");
        }

        RoundLifecycleStatus parsedStatus;
        try {
            parsedStatus = RoundLifecycleStatus.valueOf(req.status().trim().toUpperCase());
        } catch (Exception e) {
            throw ApiException.badRequest("Invalid round status: " + req.status());
        }
        final RoundLifecycleStatus status = parsedStatus;

        final Long targetRoundId = round.getId();
        final boolean willBeActivated = req.isActivated() != null ? req.isActivated() : (status == RoundLifecycleStatus.LIVE);

        // Before activating or setting LIVE/SCHEDULED, validate pipeline schedule to prevent conflicting active rounds
        if (willBeActivated || status == RoundLifecycleStatus.LIVE || status == RoundLifecycleStatus.SCHEDULED) {
            List<HiringRound> allRounds = hiringRoundRepository.findByJobIdOrderByRoundOrderAsc(round.getJob().getId());
            List<HiringRoundDto> dtos = allRounds.stream().map(r -> {
                if (r.getId().equals(targetRoundId)) {
                    return new HiringRoundDto(r.getId(), r.getRoundOrder(), r.getName(),
                            r.getRoundType() != null ? r.getRoundType().name() : "APTITUDE",
                            r.getDurationMinutes(), r.getPassingScore(), r.getWeightage(), r.getMaxAttempts(),
                            r.isRepeatable(), r.isAutoUnlock(),
                            r.getManagementMode() != null ? r.getManagementMode().name() : "AUTOMATIC",
                            r.getAssessmentConfig(), status.name(), r.getStartDate(), r.getStartTime(),
                            r.getEndDate(), r.getEndTime(), r.getTimezone(), willBeActivated, r.getProctoringConfig());
                }
                return toRoundDto(r);
            }).toList();

            scheduleValidator.validatePipelineSchedule(dtos, round.getJob().getSchedulingPolicy());
        }

        round.setRoundStatus(status);
        if (req.isActivated() != null) {
            round.setActivated(req.isActivated());
        } else if (status == RoundLifecycleStatus.LIVE) {
            round.setActivated(true);
        } else if (status == RoundLifecycleStatus.COMPLETED || status == RoundLifecycleStatus.CLOSED || status == RoundLifecycleStatus.CANCELLED) {
            round.setActivated(false);
        }

        round.setUpdatedAt(LocalDateTime.now());
        HiringRound savedRound = hiringRoundRepository.save(round);

        // Sync reminders if scheduled
        if (savedRound.getStartDate() != null && savedRound.getStartTime() != null) {
            LocalDateTime startZdt = LocalDateTime.of(savedRound.getStartDate(), savedRound.getStartTime());
            if (savedRound.isActivated() || savedRound.getRoundStatus() == RoundLifecycleStatus.LIVE || savedRound.getRoundStatus() == RoundLifecycleStatus.SCHEDULED) {
                reminderService.rescheduleRemindersForRound(savedRound.getId(), startZdt);
                reminderService.scheduleRemindersForRound(savedRound, startZdt);
            } else if (savedRound.getRoundStatus() == RoundLifecycleStatus.CANCELLED || savedRound.getRoundStatus() == RoundLifecycleStatus.CLOSED) {
                reminderService.cancelRemindersForRound(savedRound.getId());
            }
        }

        return toRoundDto(savedRound);
    }

    /**
     * Download or view candidate original resume document.
     */
    @Transactional(readOnly = true)
    public ResponseEntity<byte[]> downloadCandidateResume(String companySlug, Long applicationId) {
        Company company = securityService.validateCompanyAdminAccess(companySlug);
        JobApplication app = applicationRepository.findById(applicationId)
                .orElseThrow(() -> ApiException.notFound("Application not found: " + applicationId));

        if (app.getJob().getCompanyRef() != null &&
            !app.getJob().getCompanyRef().getId().equals(company.getId()) &&
            !app.getJob().getCompanyRef().getSlug().equalsIgnoreCase(company.getSlug())) {
            throw ApiException.forbidden("Application does not belong to this company");
        }

        User applicant = app.getApplicant();
        StudentProfile profile = studentProfileRepository.findByUserId(applicant.getId()).orElse(null);

        String fileName = (profile != null && profile.getResumeFileName() != null && !profile.getResumeFileName().isBlank())
                ? profile.getResumeFileName()
                : (applicant.getFullName().replaceAll("[^a-zA-Z0-9_.-]", "_") + "_Resume.txt");

        StringBuilder doc = new StringBuilder();
        doc.append("================================================================================\n");
        doc.append("                         CANDIDATE RESUME DOSSIER                               \n");
        doc.append("================================================================================\n\n");
        doc.append("CANDIDATE:        ").append(applicant.getFullName()).append("\n");
        doc.append("EMAIL:            ").append(applicant.getEmail()).append("\n");
        if (profile != null && profile.getPhone() != null) {
            doc.append("PHONE:            ").append(profile.getPhone()).append("\n");
        }
        if (profile != null && profile.getCollege() != null) {
            doc.append("INSTITUTION:      ").append(profile.getCollege()).append("\n");
        }
        if (profile != null && profile.getDegree() != null) {
            doc.append("DEGREE & BRANCH:  ").append(profile.getDegree()).append(" - ").append(profile.getBranch() != null ? profile.getBranch() : "").append("\n");
        }
        if (profile != null && profile.getCgpa() != null) {
            doc.append("CGPA:             ").append(profile.getCgpa()).append("\n");
        }
        if (profile != null && profile.getGraduationYear() != null) {
            doc.append("GRADUATION YEAR:  ").append(profile.getGraduationYear()).append("\n");
        }
        doc.append("APPLIED FOR:      ").append(app.getJob().getTitle()).append("\n");
        doc.append("APPLICATION DATE: ").append(app.getAppliedAt()).append("\n");
        if (app.getAtsScore() != null) {
            doc.append("ATS MATCH SCORE:  ").append(app.getAtsScore()).append("%\n");
        }
        doc.append("ELIGIBILITY:      ").append(app.isEligibilityPassed() ? "PASSED" : "FAILED (" + app.getEligibilityFailureReason() + ")").append("\n");
        if (app.getCoverNote() != null && !app.getCoverNote().isBlank()) {
            doc.append("\n--- COVER NOTE ---\n").append(app.getCoverNote()).append("\n");
        }
        doc.append("\n================================================================================\n");
        doc.append("                         ORIGINAL ATTACHED RESUME CONTENT                       \n");
        doc.append("================================================================================\n\n");
        doc.append(app.getResumeText() != null ? app.getResumeText() : "(No text content attached)");
        doc.append("\n\n================================================================================\n");

        byte[] bytes = doc.toString().getBytes(StandardCharsets.UTF_8);

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + fileName + "\"")
                .contentType(MediaType.TEXT_PLAIN)
                .body(bytes);
    }

    private PipelineSchedulingPolicy parseSchedulingPolicy(String policyStr) {
        if (policyStr != null && !policyStr.isBlank()) {
            try {
                return PipelineSchedulingPolicy.valueOf(policyStr.trim().toUpperCase());
            } catch (Exception ignored) {}
        }
        return PipelineSchedulingPolicy.SEQUENTIAL;
    }
}
