package com.placement.assessment.aptitude;

import com.placement.assessment.aptitude.AptitudeMockTestDtos.*;
import com.placement.entity.User;
import com.placement.service.CurrentUserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * Candidate-facing aptitude mock test workspace. Start/resume/timer/violations are handled by the
 * shared /api/assessments endpoints (see AssessmentAttemptController); this controller only covers
 * what's specific to MCQ answering.
 */
@RestController
@RequestMapping("/api/aptitude-mock/{attemptId}")
@RequiredArgsConstructor
public class AptitudeMockTestController {

    private final AptitudeMockTestService service;
    private final CurrentUserService currentUserService;

    @GetMapping
    public ResponseEntity<WorkspaceView> workspace(@PathVariable Long attemptId) {
        User candidate = currentUserService.getCurrentUser();
        return ResponseEntity.ok(service.getWorkspace(candidate, attemptId));
    }

    @PostMapping("/answer")
    public ResponseEntity<Void> saveAnswer(@PathVariable Long attemptId, @RequestBody SaveAnswerRequest request) {
        User candidate = currentUserService.getCurrentUser();
        service.saveAnswer(candidate, attemptId, request);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/submit")
    public ResponseEntity<SubmitResult> submit(@PathVariable Long attemptId) {
        User candidate = currentUserService.getCurrentUser();
        return ResponseEntity.ok(service.submitTest(candidate, attemptId));
    }
}
