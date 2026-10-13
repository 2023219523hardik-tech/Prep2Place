package com.placement.jobs.controller;

import com.placement.jobs.dto.CompanyAdminDtos.*;
import com.placement.jobs.dto.JobDtos.PageResponse;
import com.placement.jobs.service.CompanyAdminService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/company/{companySlug}/admin")
@RequiredArgsConstructor
public class CompanyAdminController {

    private final CompanyAdminService companyAdminService;

    /**
     * Public login endpoint for company administrators.
     */
    @PostMapping("/login")
    public CompanyLoginResponse login(
            @PathVariable String companySlug,
            @RequestBody @Valid CompanyLoginRequest req
    ) {
        return companyAdminService.login(companySlug, req);
    }

    /**
     * Dashboard overview metrics and hiring funnel.
     */
    @GetMapping("/dashboard")
    @PreAuthorize("hasAnyRole('ADMIN', 'COMPANY_ADMIN')")
    public CompanyDashboardStats dashboard(@PathVariable String companySlug) {
        return companyAdminService.getDashboard(companySlug);
    }

    /**
     * List company job postings.
     */
    @GetMapping("/jobs")
    @PreAuthorize("hasAnyRole('ADMIN', 'COMPANY_ADMIN')")
    public PageResponse<CompanyJobDetail> listJobs(
            @PathVariable String companySlug,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "15") int size
    ) {
        return companyAdminService.listJobs(companySlug, search, status, page, size);
    }

    /**
     * Create a new job opportunity with pipeline.
     */
    @PostMapping("/jobs")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('ADMIN', 'COMPANY_ADMIN')")
    public CompanyJobDetail createJob(
            @PathVariable String companySlug,
            @RequestBody @Valid CompanyJobUpsertRequest req
    ) {
        return companyAdminService.createJob(companySlug, req);
    }

    /**
     * Retrieve job detail with rounds.
     */
    @GetMapping("/jobs/{jobId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'COMPANY_ADMIN')")
    public CompanyJobDetail getJob(
            @PathVariable String companySlug,
            @PathVariable Long jobId
    ) {
        return companyAdminService.getJobDetail(companySlug, jobId);
    }

    /**
     * Update job posting and its pipeline rounds.
     */
    @PutMapping("/jobs/{jobId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'COMPANY_ADMIN')")
    public CompanyJobDetail updateJob(
            @PathVariable String companySlug,
            @PathVariable Long jobId,
            @RequestBody @Valid CompanyJobUpsertRequest req
    ) {
        return companyAdminService.updateJob(companySlug, jobId, req);
    }

    /**
     * Change job status: DRAFT | PUBLISHED | CLOSED | ARCHIVED.
     */
    @PatchMapping("/jobs/{jobId}/status")
    @PreAuthorize("hasAnyRole('ADMIN', 'COMPANY_ADMIN')")
    public void updateJobStatus(
            @PathVariable String companySlug,
            @PathVariable Long jobId,
            @RequestParam String status
    ) {
        companyAdminService.updateJobStatus(companySlug, jobId, status);
    }

    /**
     * Delete a job opportunity.
     */
    @DeleteMapping("/jobs/{jobId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAnyRole('ADMIN', 'COMPANY_ADMIN')")
    public void deleteJob(
            @PathVariable String companySlug,
            @PathVariable Long jobId
    ) {
        companyAdminService.deleteJob(companySlug, jobId);
    }

    /**
     * Get hiring pipeline for a job.
     */
    @GetMapping("/jobs/{jobId}/pipeline")
    @PreAuthorize("hasAnyRole('ADMIN', 'COMPANY_ADMIN')")
    public List<HiringRoundDto> getPipeline(
            @PathVariable String companySlug,
            @PathVariable Long jobId
    ) {
        return companyAdminService.getJobDetail(companySlug, jobId).rounds();
    }

    /**
     * Update or reorder hiring rounds for a job.
     */
    @PutMapping("/jobs/{jobId}/pipeline")
    @PreAuthorize("hasAnyRole('ADMIN', 'COMPANY_ADMIN')")
    public List<HiringRoundDto> configurePipeline(
            @PathVariable String companySlug,
            @PathVariable Long jobId,
            @RequestBody List<HiringRoundDto> rounds
    ) {
        return companyAdminService.configurePipeline(companySlug, jobId, rounds);
    }

    /**
     * List applications for a specific job.
     */
    @GetMapping("/jobs/{jobId}/applications")
    @PreAuthorize("hasAnyRole('ADMIN', 'COMPANY_ADMIN')")
    public PageResponse<CandidateApplicationDetail> listJobApplications(
            @PathVariable String companySlug,
            @PathVariable Long jobId,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        return companyAdminService.listApplications(companySlug, jobId, status, page, size);
    }

    /**
     * List all applications across all jobs for this company.
     */
    @GetMapping({"/jobs/applications", "/applications"})
    @PreAuthorize("hasAnyRole('ADMIN', 'COMPANY_ADMIN')")
    public PageResponse<CandidateApplicationDetail> listAllApplications(
            @PathVariable String companySlug,
            @RequestParam(required = false) Long jobId,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        if (jobId != null) {
            return companyAdminService.listApplications(companySlug, jobId, status, page, size);
        }
        return companyAdminService.listCandidates(companySlug, null, page, size);
    }

    /**
     * List candidate applicants across all company jobs.
     */
    @GetMapping("/candidates")
    @PreAuthorize("hasAnyRole('ADMIN', 'COMPANY_ADMIN')")
    public PageResponse<CandidateApplicationDetail> listCandidates(
            @PathVariable String companySlug,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        return companyAdminService.listCandidates(companySlug, search, page, size);
    }

    /**
     * Retrieve single application detail with round history.
     */
    @GetMapping("/applications/{applicationId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'COMPANY_ADMIN')")
    public CandidateApplicationDetail getApplication(
            @PathVariable String companySlug,
            @PathVariable Long applicationId
    ) {
        return companyAdminService.getApplicationDetail(companySlug, applicationId);
    }

    /**
     * Download or view candidate original resume document.
     */
    @GetMapping("/applications/{applicationId}/resume/download")
    @PreAuthorize("hasAnyRole('ADMIN', 'COMPANY_ADMIN')")
    public ResponseEntity<byte[]> downloadCandidateResume(
            @PathVariable String companySlug,
            @PathVariable Long applicationId
    ) {
        return companyAdminService.downloadCandidateResume(companySlug, applicationId);
    }

    /**
     * Manual evaluation of a candidate round attempt.
     */
    @PostMapping("/rounds/{attemptId}/evaluate")
    @PreAuthorize("hasAnyRole('ADMIN', 'COMPANY_ADMIN')")
    public RoundAttemptDetail evaluateRound(
            @PathVariable String companySlug,
            @PathVariable Long attemptId,
            @RequestBody @Valid EvaluateRoundRequest req
    ) {
        return companyAdminService.evaluateRoundAttempt(companySlug, attemptId, req);
    }

    /**
     * Schedule a live candidate interview.
     */
    @PostMapping("/rounds/{attemptId}/schedule-interview")
    @PreAuthorize("hasAnyRole('ADMIN', 'COMPANY_ADMIN')")
    public RoundAttemptDetail scheduleInterview(
            @PathVariable String companySlug,
            @PathVariable Long attemptId,
            @RequestBody @Valid ScheduleInterviewRequest req
    ) {
        return companyAdminService.scheduleInterview(companySlug, attemptId, req);
    }

    /**
     * Update final candidate decision (OFFER, SELECTED, REJECTED).
     */
    @PatchMapping("/applications/{applicationId}/decision")
    @PreAuthorize("hasAnyRole('ADMIN', 'COMPANY_ADMIN')")
    public CandidateApplicationDetail updateDecision(
            @PathVariable String companySlug,
            @PathVariable Long applicationId,
            @RequestBody @Valid DecisionRequest req
    ) {
        return companyAdminService.updateDecision(companySlug, applicationId, req);
    }

    /**
     * Real-time candidate live monitoring during assessments/interviews.
     */
    @GetMapping("/live-monitoring")
    @PreAuthorize("hasAnyRole('ADMIN', 'COMPANY_ADMIN')")
    public List<LiveCandidateDto> getLiveMonitoring(@PathVariable String companySlug) {
        return companyAdminService.getLiveMonitoring(companySlug);
    }

    /**
     * Candidate hiring journey timeline.
     */
    @GetMapping("/applications/{applicationId}/timeline")
    @PreAuthorize("hasAnyRole('ADMIN', 'COMPANY_ADMIN')")
    public List<TimelineEventDto> getTimeline(
            @PathVariable String companySlug,
            @PathVariable Long applicationId
    ) {
        return companyAdminService.getApplicationTimeline(companySlug, applicationId);
    }

    /**
     * Handle manual recruiter actions: advance, pass, fail, reattempt, hold, reject, notes.
     */
    @PostMapping("/applications/{applicationId}/action")
    @PreAuthorize("hasAnyRole('ADMIN', 'COMPANY_ADMIN')")
    public CandidateApplicationDetail handleCandidateAction(
            @PathVariable String companySlug,
            @PathVariable Long applicationId,
            @RequestBody @Valid CandidateActionRequest req
    ) {
        return companyAdminService.handleCandidateAction(companySlug, applicationId, req);
    }

    /**
     * List company interviews across roles.
     */
    @GetMapping("/interviews")
    @PreAuthorize("hasAnyRole('ADMIN', 'COMPANY_ADMIN')")
    public List<CompanyInterviewReportDto> getInterviews(@PathVariable String companySlug) {
        return companyAdminService.getInterviews(companySlug);
    }

    /**
     * List completed candidate evaluation reports.
     */
    @GetMapping("/reports")
    @PreAuthorize("hasAnyRole('ADMIN', 'COMPANY_ADMIN')")
    public List<CompanyInterviewReportDto> getReports(@PathVariable String companySlug) {
        return companyAdminService.getReports(companySlug);
    }

    /**
     * ATS resume screening statistics and candidate distribution for a job.
     */
    @GetMapping("/jobs/{jobId}/ats-stats")
    @PreAuthorize("hasAnyRole('ADMIN', 'COMPANY_ADMIN')")
    public AtsScreeningStats getAtsStats(
            @PathVariable String companySlug,
            @PathVariable Long jobId
    ) {
        return companyAdminService.getAtsScreeningStats(companySlug, jobId);
    }

    /**
     * Recruiter manual action/override on ATS candidate screening.
     */
    @PostMapping("/applications/{applicationId}/ats-override")
    @PreAuthorize("hasAnyRole('ADMIN', 'COMPANY_ADMIN')")
    public CandidateApplicationDetail overrideCandidateAts(
            @PathVariable String companySlug,
            @PathVariable Long applicationId,
            @RequestBody @Valid AtsOverrideRequest req
    ) {
        return companyAdminService.overrideCandidateAts(companySlug, applicationId, req);
    }

    /**
     * Round lifecycle management: DRAFT, SCHEDULED, READY, LIVE, PAUSED, COMPLETED, CLOSED.
     */
    @PatchMapping("/rounds/{roundId}/lifecycle")
    @PreAuthorize("hasAnyRole('ADMIN', 'COMPANY_ADMIN')")
    public HiringRoundDto updateRoundLifecycle(
            @PathVariable String companySlug,
            @PathVariable Long roundId,
            @RequestBody @Valid RoundLifecycleRequest req
    ) {
        return companyAdminService.updateRoundLifecycle(companySlug, roundId, req);
    }
}
