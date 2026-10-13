package com.placement.controller;

import com.placement.dto.InterviewDtos.*;
import com.placement.service.CurrentUserService;
import com.placement.service.InterviewService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;

@RestController
@RequestMapping("/api/interviews")
@RequiredArgsConstructor
public class InterviewController {

    private final InterviewService interviewService;
    private final CurrentUserService currentUserService;

    @PostMapping
    public SessionResponse create(@RequestBody StartInterviewRequest request) {
        return interviewService.startInterview(currentUserService.getCurrentUser(), request);
    }

    @GetMapping("/{sessionId}")
    public SessionResponse get(@PathVariable Long sessionId) {
        return interviewService.getSession(sessionId, currentUserService.getCurrentUser());
    }

    @PostMapping("/{sessionId}/start")
    public SessionResponse start(@PathVariable Long sessionId) {
        return interviewService.getSession(sessionId, currentUserService.getCurrentUser());
    }

    @GetMapping("/{sessionId}/next-question")
    public QuestionResponse nextQuestion(@PathVariable Long sessionId) {
        return interviewService.nextQuestion(sessionId, currentUserService.getCurrentUser());
    }

    /** DSA/coding-stage question sourced from the same centralized question bank Coding Mock Tests use. */
    @GetMapping("/{sessionId}/next-dsa-question")
    public QuestionResponse nextDsaQuestion(@PathVariable Long sessionId) {
        return interviewService.nextDsaQuestion(sessionId, currentUserService.getCurrentUser());
    }

    // --- Section 9: mid-interview domain-specific timed coding challenge ---
    public record CodingChallengeCodeRequest(String language, String code) {}

    @PostMapping("/{sessionId}/coding-challenge/run")
    public com.placement.dto.CodingDtos.RunCodeResponse runCodingChallenge(@PathVariable Long sessionId, @RequestBody CodingChallengeCodeRequest request) {
        return interviewService.runCodingChallenge(sessionId, currentUserService.getCurrentUser(), request.language(), request.code());
    }

    @PostMapping("/{sessionId}/coding-challenge/submit")
    public CodingChallengeResultResponse submitCodingChallenge(@PathVariable Long sessionId, @RequestBody CodingChallengeCodeRequest request) {
        return interviewService.submitCodingChallenge(sessionId, currentUserService.getCurrentUser(), request.language(), request.code());
    }

    @PostMapping("/{sessionId}/answers")
    public AnswerEvaluationResponse submitAnswer(@PathVariable Long sessionId, @RequestBody SubmitAnswerRequest request) {
        return interviewService.submitAnswer(sessionId, currentUserService.getCurrentUser(), request, false, null);
    }

    @PostMapping(value = "/{sessionId}/audio", consumes = "multipart/form-data")
    public AnswerEvaluationResponse submitAudio(@PathVariable Long sessionId, @RequestParam Long questionId,
                                                 @RequestParam("file") MultipartFile file) throws IOException {
        SubmitAnswerRequest request = new SubmitAnswerRequest(questionId, null,null);
        return interviewService.submitAnswer(sessionId, currentUserService.getCurrentUser(), request, true, file.getBytes());
    }

    @PostMapping("/{sessionId}/complete")
    public InterviewReportResponse complete(@PathVariable Long sessionId) {
        return interviewService.completeInterview(sessionId, currentUserService.getCurrentUser());
    }

    @PostMapping("/{sessionId}/pause")
    public SessionResponse pause(@PathVariable Long sessionId) {
        return interviewService.pauseInterview(sessionId, currentUserService.getCurrentUser());
    }

    @PostMapping("/{sessionId}/resume")
    public SessionResponse resume(@PathVariable Long sessionId) {
        return interviewService.resumeInterview(sessionId, currentUserService.getCurrentUser());
    }

    @PostMapping("/{sessionId}/exit")
    public SessionResponse exit(@PathVariable Long sessionId) {
        return interviewService.exitInterview(sessionId, currentUserService.getCurrentUser());
    }

    @PostMapping("/{sessionId}/heartbeat")
    public void heartbeat(@PathVariable Long sessionId) {
        interviewService.heartbeat(sessionId, currentUserService.getCurrentUser());
    }

    @PostMapping("/{sessionId}/submit")
    public InterviewReportResponse submit(@PathVariable Long sessionId) {
        return interviewService.submitInterview(sessionId, currentUserService.getCurrentUser());
    }

    @GetMapping("/{sessionId}/report")
    public InterviewReportResponse report(@PathVariable Long sessionId) {
        return interviewService.getReport(sessionId, currentUserService.getCurrentUser());
    }

    @GetMapping("/history")
    public List<SessionResponse> history() { return interviewService.history(currentUserService.getCurrentUser()); }
}
