package com.placement.controller;

import com.placement.dto.ProctoringDtos.*;
import com.placement.service.CurrentUserService;
import com.placement.service.InterviewService;
import com.placement.service.ProctoringService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;

/**
 * "Safe browser" anti-malpractice endpoints for the interview module. The frontend
 * proctoring guard (fullscreen lockdown, tab-switch / copy-paste / devtools detection,
 * periodic webcam frame capture) reports here; this controller enforces that the caller
 * owns the interview session before recording anything against it, and before it can read
 * back any captured evidence.
 */
@RestController
@RequestMapping("/api/interviews/{sessionId}/proctoring")
@RequiredArgsConstructor
public class ProctoringController {

    private final ProctoringService proctoringService;
    private final InterviewService interviewService;
    private final CurrentUserService currentUserService;

    /** Single event-logging endpoint. Evidence (a still frame) is optional and, per Section
     *  1.1, is a multipart part rather than a separate call, so the event and its evidence are
     *  always written together and can never end up out of sync. */
    @PostMapping(value = "/events", consumes = "multipart/form-data")
    public ProctoringEventResponse logEvent(
            @PathVariable Long sessionId,
            @RequestParam("eventType") String eventType,
            @RequestParam(value = "details", required = false) String details,
            @RequestParam(value = "durationSeconds", required = false) Double durationSeconds,
            @RequestParam(value = "source", required = false) String source,
            @RequestParam(value = "evidenceUnavailableReason", required = false) String evidenceUnavailableReason,
            @RequestParam(value = "file", required = false) MultipartFile file
    ) throws IOException {
        interviewService.requireOwnedSession(sessionId, currentUserService.getCurrentUser());
        byte[] evidenceBytes = (file != null && !file.isEmpty()) ? file.getBytes() : null;
        String contentType = file != null ? file.getContentType() : null;
        ProctoringEventResponse response = proctoringService.recordEvent(sessionId, eventType, details, durationSeconds, source,
                evidenceBytes, contentType, evidenceUnavailableReason);
        if (response.sessionTerminated()) {
            // Universal anti-cheat (Section 6 -> Section 8): score only what was legitimately
            // completed before the violation, immediately, so the report is ready the instant the
            // frontend's lock screen appears.
            interviewService.finalizePartialScores(sessionId);
        }
        return response;
    }

    @PostMapping(value = "/frame", consumes = "multipart/form-data")
    public FrameAnalysisResponse analyzeFrame(@PathVariable Long sessionId, @RequestParam("file") MultipartFile file) throws IOException {
        interviewService.requireOwnedSession(sessionId, currentUserService.getCurrentUser());
        return proctoringService.analyzeFrame(sessionId, file.getBytes());
    }

    @GetMapping("/summary")
    public ProctoringSummaryResponse summary(@PathVariable Long sessionId) {
        interviewService.requireOwnedSession(sessionId, currentUserService.getCurrentUser());
        return proctoringService.getSummary(sessionId);
    }

    /** Access-controlled evidence retrieval — not a public/signed URL, but gated behind the
     *  same session-ownership check as every other endpoint here (Section 1.1: "not publicly
     *  accessible URLs — signed/expiring links or access-controlled storage"). Never cached by
     *  intermediate proxies since this is sensitive personal data. */
    @GetMapping("/events/{eventId}/evidence")
    public ResponseEntity<byte[]> getEvidence(@PathVariable Long sessionId, @PathVariable Long eventId) {
        interviewService.requireOwnedSession(sessionId, currentUserService.getCurrentUser());
        ProctoringService.EvidencePayload evidence = proctoringService.getEvidence(sessionId, eventId);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(evidence.contentType()))
                .header(HttpHeaders.CACHE_CONTROL, "private, no-store")
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"evidence-" + eventId + "\"")
                .body(evidence.bytes());
    }

    @PostMapping("/verify-protocol")
    public PreInterviewCheckResponse verifyProtocol(
            @PathVariable Long sessionId,
            @RequestBody PreInterviewCheckRequest request
    ) {
        interviewService.requireOwnedSession(sessionId, currentUserService.getCurrentUser());
        return proctoringService.verifyPreInterviewProtocol(sessionId, request);
    }

    @PostMapping(value = "/verify-dress", consumes = "multipart/form-data")
    public DressAnalysisResult verifyDress(
            @PathVariable Long sessionId,
            @RequestParam("files") List<MultipartFile> files
    ) throws IOException {
        interviewService.requireOwnedSession(sessionId, currentUserService.getCurrentUser());
        return proctoringService.verifyDressFrames(sessionId, files);
    }

    @GetMapping("/status")
    public PreInterviewCheckResponse getStatus(@PathVariable Long sessionId) {
        interviewService.requireOwnedSession(sessionId, currentUserService.getCurrentUser());
        return proctoringService.getPreInterviewStatus(sessionId);
    }
}
