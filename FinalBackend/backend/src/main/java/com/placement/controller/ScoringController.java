package com.placement.controller;

import com.placement.dto.InterviewDtos.InterviewReportResponse;
import com.placement.dto.ReadinessDtos.ReadinessResponse;
import com.placement.service.CurrentUserService;
import com.placement.service.InterviewService;
import com.placement.service.ReadinessService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
public class ScoringController {

    private final InterviewService interviewService;
    private final ReadinessService readinessService;
    private final CurrentUserService currentUserService;

    @GetMapping("/api/scoring/interview/{sessionId}")
    public InterviewReportResponse interviewScore(@PathVariable Long sessionId) {
        return interviewService.getReport(sessionId, currentUserService.getCurrentUser());
    }

    @GetMapping("/api/scoring/student/{studentId}")
    public ReadinessResponse studentScore(@PathVariable Long studentId) {
        return readinessService.analyze(currentUserService.getCurrentUser());
    }

    @GetMapping("/api/feedback/interview/{sessionId}")
    public InterviewReportResponse interviewFeedback(@PathVariable Long sessionId) {
        return interviewService.getReport(sessionId, currentUserService.getCurrentUser());
    }

    @GetMapping("/api/feedback/student/{studentId}")
    public ReadinessResponse studentFeedback(@PathVariable Long studentId) {
        return readinessService.analyze(currentUserService.getCurrentUser());
    }
}
