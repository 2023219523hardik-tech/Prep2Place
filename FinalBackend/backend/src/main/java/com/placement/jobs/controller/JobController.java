package com.placement.jobs.controller;

import com.placement.jobs.dto.JobDtos.*;
import com.placement.jobs.service.JobService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/jobs")
@RequiredArgsConstructor
public class JobController {

    private final JobService jobService;

    @GetMapping
    public PageResponse<JobSummary> list(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String employmentType,
            @RequestParam(required = false) String experienceLevel,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return jobService.listActive(search, employmentType, experienceLevel, page, size);
    }

    @GetMapping("/{jobId}")
    public JobDetail get(@PathVariable Long jobId) {
        return jobService.getJob(jobId);
    }

    @PostMapping("/{jobId}/apply")
    public ApplicationResponse apply(@PathVariable Long jobId, @RequestBody(required = false) ApplyRequest req) {
        return jobService.apply(jobId, req != null ? req : new ApplyRequest(null, null));
    }

    @GetMapping("/applications/me")
    public PageResponse<ApplicationResponse> myApplications(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return jobService.myApplications(page, size);
    }

    @DeleteMapping("/applications/{applicationId}")
    public void withdraw(@PathVariable Long applicationId) {
        jobService.withdraw(applicationId);
    }

    @GetMapping("/{jobId}/pipeline")
    public java.util.List<com.placement.jobs.dto.CompanyAdminDtos.HiringRoundDto> getPipeline(@PathVariable Long jobId) {
        return jobService.getPipelineForJob(jobId);
    }

    @GetMapping("/applications/{applicationId}/progress")
    public com.placement.jobs.dto.CompanyAdminDtos.CandidateApplicationDetail getApplicationProgress(@PathVariable Long applicationId) {
        return jobService.getApplicationProgress(applicationId);
    }

    @PostMapping("/applications/{applicationId}/rounds/{roundId}/start")
    public StartRoundAssessmentResponse startRoundAssessment(
            @PathVariable Long applicationId,
            @PathVariable Long roundId) {
        return jobService.startRoundAssessment(applicationId, roundId);
    }

    @PostMapping("/applications/{applicationId}/rounds/{roundId}/submit")
    public SubmitRoundAssessmentResponse submitRoundAssessment(
            @PathVariable Long applicationId,
            @PathVariable Long roundId,
            @RequestBody SubmitRoundAssessmentRequest req) {
        return jobService.submitRoundAssessment(applicationId, roundId, req);
    }
}

