package com.placement.jobs.controller;

import com.placement.jobs.dto.JobDtos.*;
import com.placement.jobs.service.JobService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin/jobs")
@RequiredArgsConstructor
public class JobAdminController {

    private final JobService jobService;

    @GetMapping
    public PageResponse<JobSummary> list(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) Boolean active,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return jobService.listAdmin(search, active, page, size);
    }

    @GetMapping("/{jobId}")
    public JobDetail get(@PathVariable Long jobId) {
        return jobService.getJob(jobId);
    }

    @PostMapping
    public JobSummary create(@RequestBody JobUpsertRequest req) {
        return jobService.createJob(req);
    }

    @PutMapping("/{jobId}")
    public JobSummary update(@PathVariable Long jobId, @RequestBody JobUpsertRequest req) {
        return jobService.updateJob(jobId, req);
    }

    @PatchMapping("/{jobId}/active")
    public void toggleActive(@PathVariable Long jobId, @RequestParam boolean active) {
        jobService.toggleActive(jobId, active);
    }

    @DeleteMapping("/{jobId}")
    public void delete(@PathVariable Long jobId) {
        jobService.deleteJob(jobId);
    }

    @GetMapping("/{jobId}/applications")
    public PageResponse<ApplicationDetail> applications(
            @PathVariable Long jobId,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return jobService.applicationsForJob(jobId, status, page, size);
    }

    @PatchMapping("/applications/{applicationId}/status")
    public ApplicationDetail updateStatus(@PathVariable Long applicationId,
                                          @RequestBody UpdateStatusRequest req) {
        return jobService.updateApplicationStatus(applicationId, req.status());
    }
}
