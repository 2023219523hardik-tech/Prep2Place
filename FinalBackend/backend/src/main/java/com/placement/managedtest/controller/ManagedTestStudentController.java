package com.placement.managedtest.controller;

import com.placement.entity.User;
import com.placement.managedtest.dto.ManagedTestDtos.*;
import com.placement.managedtest.entity.TestType;
import com.placement.managedtest.service.ManagedTestAnalyticsService;
import com.placement.managedtest.service.ManagedTestAttemptService;
import com.placement.service.CurrentUserService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Student-facing assessment API.
 *
 * Backward compatibility: this is a NEW route prefix (/api/student/tests). The existing
 * /api/mock-tests, /api/aptitude, /api/coding and /api/assessments endpoints are untouched, so any
 * client on the old flows keeps working unchanged.
 */
@RestController
@RequestMapping("/api/student/tests")
@RequiredArgsConstructor
public class ManagedTestStudentController {

    private final ManagedTestAttemptService attemptService;
    private final ManagedTestAnalyticsService analyticsService;
    private final CurrentUserService currentUserService;

    /** Assigned + cohort-eligible tests. Optional ?testType= filters the tabs on the student page. */
    @GetMapping
    public List<StudentTestCardResponse> available(@RequestParam(required = false) TestType testType) {
        return attemptService.availableTests(currentUserService.getCurrentUser(), testType);
    }

    @PostMapping("/{testId}/start")
    public AttemptViewResponse start(@PathVariable Long testId, HttpServletRequest request) {
        User student = currentUserService.getCurrentUser();
        return attemptService.start(student, testId, clientIp(request), request.getHeader("User-Agent"));
    }

    /** Authoritative attempt state. The client re-reads this on every refresh/reconnect. */
    @GetMapping("/attempts/{attemptId}")
    public AttemptViewResponse attempt(@PathVariable Long attemptId) {
        return attemptService.getAttempt(currentUserService.getCurrentUser(), attemptId);
    }

    @PostMapping("/attempts/{attemptId}/answers")
    public ResponseEntity<Map<String, String>> saveAnswer(@PathVariable Long attemptId,
                                                          @Valid @RequestBody SaveAnswerRequest request) {
        attemptService.saveAnswer(currentUserService.getCurrentUser(), attemptId, request);
        return ResponseEntity.ok(Map.of("message", "Saved"));
    }

    /** Batched autosave, so a runner with several dirty answers makes one request instead of five. */
    @PostMapping("/attempts/{attemptId}/answers/bulk")
    public ResponseEntity<Map<String, String>> saveAnswers(@PathVariable Long attemptId,
                                                           @Valid @RequestBody BulkSaveRequest request) {
        attemptService.saveAnswers(currentUserService.getCurrentUser(), attemptId, request.answers());
        return ResponseEntity.ok(Map.of("message", "Saved"));
    }

    @PostMapping("/attempts/{attemptId}/sections/submit")
    public ResponseEntity<Map<String, String>> submitSection(@PathVariable Long attemptId,
                                                              @Valid @RequestBody SubmitSectionRequest request) {
        attemptService.submitSection(currentUserService.getCurrentUser(), attemptId, request.sectionId());
        return ResponseEntity.ok(Map.of("message", "Section submitted"));
    }

    @PostMapping("/attempts/{attemptId}/submit")
    public AttemptResultResponse submit(@PathVariable Long attemptId) {
        return attemptService.submit(currentUserService.getCurrentUser(), attemptId);
    }

    @GetMapping("/attempts/{attemptId}/result")
    public AttemptResultResponse result(@PathVariable Long attemptId) {
        return attemptService.studentResult(currentUserService.getCurrentUser(), attemptId);
    }

    /** Proctoring signal reported by the runner. Returns the updated integrity state. */
    @PostMapping("/attempts/{attemptId}/violations")
    public Map<String, Object> reportViolation(@PathVariable Long attemptId,
                                               @Valid @RequestBody ViolationReportRequest request) {
        return attemptService.reportViolation(currentUserService.getCurrentUser(), attemptId, request);
    }

    /** The student's own history and progress. Scoped to the caller; no studentId parameter exists. */
    @GetMapping("/progress")
    public StudentProgressResponse progress() {
        return analyticsService.studentProgress(currentUserService.getCurrentUser().getId());
    }

    private String clientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) return forwarded.split(",")[0].trim();
        return request.getRemoteAddr();
    }
}
