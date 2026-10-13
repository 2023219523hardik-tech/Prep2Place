package com.placement.assessment.controller;

import com.placement.assessment.dto.AssessmentDtos.*;
import com.placement.assessment.entity.AssessmentAttempt;
import com.placement.assessment.entity.IntegrityEvent;
import com.placement.assessment.repository.IntegrityEventRepository;
import com.placement.assessment.service.AssessmentEngineService;
import com.placement.assessment.service.ViolationPolicyService;
import com.placement.entity.User;
import com.placement.service.CurrentUserService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Shared attempt lifecycle endpoints, reused by the coding mock test, aptitude mock test, and AI
 * interview frontends. Every write here re-validates ownership and current status server-side -
 * see AssessmentEngineService / ViolationPolicyService for why the backend, not the client, is
 * the source of truth for state.
 */
@RestController
@RequestMapping("/api/assessments")
@RequiredArgsConstructor
public class AssessmentAttemptController {

    private final AssessmentEngineService engineService;
    private final ViolationPolicyService violationPolicyService;
    private final IntegrityEventRepository integrityEventRepository;
    private final CurrentUserService currentUserService;
    private final com.placement.assessment.repository.AssessmentProfileRepository profileRepository;
    private final com.placement.assessment.aptitude.AptitudeMockTestService aptitudeMockTestService;

    @PostMapping("/start")
    public ResponseEntity<AttemptView> start(@RequestBody StartAttemptRequest request, HttpServletRequest httpRequest) {
        User candidate = currentUserService.getCurrentUser();
        AssessmentAttempt attempt = engineService.startOrResume(
                candidate, request.getProfileId(), clientIp(httpRequest), httpRequest.getHeader("User-Agent"));
        return ResponseEntity.ok(AttemptView.from(attempt));
    }

    @GetMapping("/{attemptId}")
    public ResponseEntity<AttemptView> get(@PathVariable Long attemptId) {
        User candidate = currentUserService.getCurrentUser();
        return ResponseEntity.ok(AttemptView.from(engineService.getOwnedAttempt(candidate, attemptId)));
    }

    @PostMapping("/{attemptId}/autosave")
    public ResponseEntity<AttemptView> autosave(@PathVariable Long attemptId, @RequestBody AutosaveRequest request) {
        User candidate = currentUserService.getCurrentUser();
        AssessmentAttempt attempt = engineService.autosave(candidate, attemptId, request.getAnswerDelta(), request.getLanguageDelta());
        return ResponseEntity.ok(AttemptView.from(attempt));
    }

    @PostMapping("/{attemptId}/submit")
    public ResponseEntity<AttemptView> submit(@PathVariable Long attemptId) {
        User candidate = currentUserService.getCurrentUser();
        AssessmentAttempt attempt = engineService.submit(candidate, attemptId);
        return ResponseEntity.ok(AttemptView.from(attempt));
    }

    @PostMapping("/{attemptId}/violations")
    public ResponseEntity<IntegrityEventView> reportViolation(@PathVariable Long attemptId, @RequestBody ViolationRequest request) {
        User candidate = currentUserService.getCurrentUser();
        IntegrityEvent event = violationPolicyService.recordAndEnforce(
                candidate, attemptId, request.getEventType(), request.getDurationSeconds(), request.getConfidenceScore(),
                request.getDetails(), request.isEvidenceAvailable(), request.getEvidenceRef(), request.getEvidenceUnavailableReason());

        // Universal anti-cheat -> Section 8 (partial completion): the instant a violation
        // terminates the attempt, score exactly what was legitimately answered so far, so the
        // report is never a blank/zero result for a candidate who had genuinely answered part of
        // the test. Coding scores are already accumulated live per accepted submission and need
        // no separate finalization step here.
        if (event.isContributedToTermination()) {
            AssessmentAttempt attempt = engineService.getOwnedAttempt(candidate, attemptId);
            if (attempt.getAssessmentType() == com.placement.assessment.entity.AssessmentType.APTITUDE_MOCK_TEST) {
                aptitudeMockTestService.finalizeOnTermination(attempt);
            }
        }

        return ResponseEntity.ok(IntegrityEventView.from(event));
    }

    @GetMapping("/{attemptId}/violations")
    public ResponseEntity<List<IntegrityEventView>> violations(@PathVariable Long attemptId) {
        User candidate = currentUserService.getCurrentUser();
        engineService.getOwnedAttempt(candidate, attemptId); // ownership check
        List<IntegrityEventView> views = integrityEventRepository.findByAttemptIdOrderByOccurredAtAsc(attemptId)
                .stream().map(IntegrityEventView::from).toList();
        return ResponseEntity.ok(views);
    }

    @GetMapping("/profiles")
    public ResponseEntity<List<com.placement.assessment.entity.AssessmentProfile>> listProfiles(
            @RequestParam(required = false) com.placement.assessment.entity.AssessmentType type) {
        List<com.placement.assessment.entity.AssessmentProfile> profiles = type != null
                ? profileRepository.findByAssessmentTypeAndActiveTrue(type)
                : profileRepository.findByActiveTrue();
        return ResponseEntity.ok(profiles);
    }

    @PostMapping("/{attemptId}/terminate")
    public ResponseEntity<java.util.Map<String, Object>> terminate(@PathVariable Long attemptId,
                                                                    @RequestBody(required = false) java.util.Map<String, String> payload) {
        User candidate = currentUserService.getCurrentUser();
        String reason = payload != null ? payload.getOrDefault("reason", "TAB_SWITCH") : "TAB_SWITCH";
        AssessmentAttempt attempt = violationPolicyService.terminateTabSwitch(candidate, attemptId, reason);

        if (attempt.getAssessmentType() == com.placement.assessment.entity.AssessmentType.APTITUDE_MOCK_TEST
                && !attempt.getResultDetails().containsKey("graded")) {
            aptitudeMockTestService.finalizeOnTermination(attempt);
        }

        return ResponseEntity.ok(java.util.Map.of(
                "status", attempt.getStatus().name(),
                "reason", attempt.getTerminationReason(),
                "terminatedAt", attempt.getSubmittedAt() == null ? null : attempt.getSubmittedAt().toString()
        ));
    }

    private String clientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        return forwarded != null ? forwarded.split(",")[0].trim() : request.getRemoteAddr();
    }
}
