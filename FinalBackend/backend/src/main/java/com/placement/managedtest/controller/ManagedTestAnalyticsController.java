package com.placement.managedtest.controller;

import com.placement.managedtest.dto.ManagedTestDtos.*;
import com.placement.managedtest.service.ManagedTestAnalyticsService;
import com.placement.managedtest.service.ManagedTestAttemptService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Admin analytics + per-attempt drill-down. Kept separate from the authoring controller so the
 * dashboard's read paths and the builder's write paths don't share a class.
 *
 * Routes here intentionally sit alongside the existing /api/admin/dashboard endpoints rather than
 * replacing them - the existing AdminController response shape is untouched.
 */
@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class ManagedTestAnalyticsController {

    private final ManagedTestAnalyticsService analyticsService;
    private final ManagedTestAttemptService attemptService;

    @GetMapping("/dashboard/test-analytics")
    public TestAnalyticsResponse testAnalytics() { return analyticsService.testAnalytics(); }

    @GetMapping("/dashboard/test-activity")
    public TestActivityResponse testActivity() { return analyticsService.activity(); }

    @GetMapping("/dashboard/integrity")
    public IntegritySummaryResponse integrity() { return analyticsService.integrity(); }

    @GetMapping("/students/{studentId}/tests")
    public Page<AttemptSummaryResponse> studentTests(@PathVariable Long studentId,
                                                     @RequestParam(defaultValue = "0") int page,
                                                     @RequestParam(defaultValue = "20") int size) {
        return analyticsService.attemptsForStudent(studentId, page, size);
    }

    @GetMapping("/students/{studentId}/test-attempts")
    public Page<AttemptSummaryResponse> studentAttempts(@PathVariable Long studentId,
                                                        @RequestParam(defaultValue = "0") int page,
                                                        @RequestParam(defaultValue = "20") int size) {
        return analyticsService.attemptsForStudent(studentId, page, size);
    }

    @GetMapping("/students/{studentId}/test-progress")
    public StudentProgressResponse studentProgress(@PathVariable Long studentId) {
        return analyticsService.studentProgress(studentId);
    }

    /** Full question-wise report for one attempt, including the answer key. */
    @GetMapping("/test-attempts/{attemptId}")
    public AttemptResultResponse attempt(@PathVariable Long attemptId) {
        return attemptService.adminResult(attemptId);
    }

    @GetMapping("/test-attempts/{attemptId}/violations")
    public List<ViolationRow> attemptViolations(@PathVariable Long attemptId) {
        return analyticsService.attemptViolations(attemptId);
    }
}
