package com.placement.controller;

import com.placement.dto.InterviewDtos.*;
import com.placement.service.CurrentUserService;
import com.placement.service.InterviewService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/evaluation")
@RequiredArgsConstructor
public class EvaluationController {

    private final InterviewService interviewService;
    private final CurrentUserService currentUserService;

    @PostMapping("/answer")
    public AnswerEvaluationResponse evaluateAnswer(@RequestParam Long sessionId, @RequestBody SubmitAnswerRequest request) {
        return interviewService.submitAnswer(sessionId, currentUserService.getCurrentUser(), request, false, null);
    }

    @PostMapping("/interview/{sessionId}")
    public InterviewReportResponse evaluateInterview(@PathVariable Long sessionId) {
        return interviewService.completeInterview(sessionId, currentUserService.getCurrentUser());
    }

    @GetMapping("/{sessionId}")
    public InterviewReportResponse getEvaluation(@PathVariable Long sessionId) {
        return interviewService.getReport(sessionId, currentUserService.getCurrentUser());
    }
}
