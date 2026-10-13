package com.placement.assessment.coding;

import com.placement.assessment.coding.CodingMockTestDtos.*;
import com.placement.dto.CodingDtos.RunCodeResponse;
import com.placement.entity.User;
import com.placement.service.CurrentUserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * Candidate-facing coding mock test workspace. All endpoints operate on an AssessmentAttempt
 * (see /api/assessments for start/resume/autosave/submit/violations) plus a question index within
 * it; ownership and attempt-status validation happen in CodingMockTestService on every call.
 */
@RestController
@RequestMapping("/api/coding-mock/{attemptId}/questions/{index}")
@RequiredArgsConstructor
public class CodingMockTestController {

    private final CodingMockTestService service;
    private final CurrentUserService currentUserService;

    @GetMapping
    public ResponseEntity<WorkspaceView> workspace(@PathVariable Long attemptId, @PathVariable int index) {
        User candidate = currentUserService.getCurrentUser();
        return ResponseEntity.ok(service.getWorkspace(candidate, attemptId, index));
    }

    @PostMapping("/run")
    public ResponseEntity<RunCodeResponse> run(@PathVariable Long attemptId, @PathVariable int index, @RequestBody RunRequest request) {
        User candidate = currentUserService.getCurrentUser();
        return ResponseEntity.ok(service.runCode(candidate, attemptId, index, request));
    }

    @PostMapping("/submit")
    public ResponseEntity<SubmitResult> submit(@PathVariable Long attemptId, @PathVariable int index, @RequestBody SubmitRequest request) {
        User candidate = currentUserService.getCurrentUser();
        return ResponseEntity.ok(service.submitCode(candidate, attemptId, index, request));
    }
}
