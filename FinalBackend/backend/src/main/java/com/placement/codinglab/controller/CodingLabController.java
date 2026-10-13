package com.placement.codinglab.controller;

import com.placement.codinglab.dto.CodingLabDtos.*;
import com.placement.codinglab.service.AiHintService;
import com.placement.codinglab.service.CodingLabService;
import com.placement.entity.User;
import com.placement.service.CurrentUserService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Student-facing Coding Lab API, mounted at {@code /api/coding-lab} (the {@code /api/coding/*} prefix belongs to the
 * LeetCode-style judge).
 *
 * <p><b>Deliberately not {@code @Transactional}</b>: {@code run}/{@code submit} execute code in a sandbox for
 * seconds and must not hold a database connection. The service layer opens short transactions itself and returns
 * fully-mapped DTOs, so nothing lazy escapes a session.
 */
@RestController
@RequestMapping("/api/coding-lab")
@RequiredArgsConstructor
public class CodingLabController {

    private final CodingLabService codingLabService;
    private final AiHintService aiHintService;
    private final CurrentUserService currentUserService;

    @GetMapping("/assessments")
    public List<AssessmentSummaryView> listAssessments() {
        return codingLabService.listAvailable(currentUserService.getCurrentUser());
    }

    @GetMapping("/history")
    public List<AttemptHistoryView> history() { return codingLabService.history(currentUserService.getCurrentUser()); }

    @PostMapping("/assessments/{id}/start")
    public WorkspaceView start(@PathVariable Long id) { return codingLabService.start(user(), id); }

    @GetMapping("/attempts/{attemptId}")
    public WorkspaceView workspace(@PathVariable Long attemptId) { return codingLabService.workspace(user(), attemptId); }

    /** Autosave. Small acknowledgement instead of the whole workspace - it is called every few seconds. */
    @PatchMapping("/attempts/{attemptId}/files")
    public SaveAck saveFiles(@PathVariable Long attemptId, @RequestBody SaveFilesRequest request) {
        return codingLabService.save(user(), attemptId, request.files());
    }

    /** Public tests only. Unlimited, never scored. Supports both /run and /execute */
    @PostMapping(value = {"/attempts/{attemptId}/run", "/attempts/{attemptId}/execute"})
    public RunResultView run(@PathVariable Long attemptId, @RequestBody RunRequest request) {
        return codingLabService.run(user(), attemptId, request.files());
    }

    /** Public + hidden tests, scored per requirement. Best score across submissions counts. */
    @PostMapping("/attempts/{attemptId}/submit")
    public RunResultView submit(@PathVariable Long attemptId, @RequestBody RunRequest request) {
        return codingLabService.submit(user(), attemptId, request.files());
    }

    @PostMapping("/attempts/{attemptId}/finish")
    public WorkspaceView finish(@PathVariable Long attemptId) { return codingLabService.finish(user(), attemptId); }

    @PostMapping("/attempts/{attemptId}/abandon")
    public WorkspaceView abandon(@PathVariable Long attemptId) { return codingLabService.abandon(user(), attemptId); }

    @GetMapping("/attempts/{attemptId}/submissions")
    public List<SubmissionSummaryView> submissions(@PathVariable Long attemptId) {
        return codingLabService.submissions(user(), attemptId);
    }

    @GetMapping("/attempts/{attemptId}/submissions/{submissionId}")
    public RunResultView submission(@PathVariable Long attemptId, @PathVariable Long submissionId) {
        return codingLabService.submissionDetail(user(), attemptId, submissionId);
    }

    @PostMapping("/attempts/{attemptId}/ai/hint")
    public HintResponseView requestHint(@PathVariable Long attemptId, @RequestBody HintRequest request) {
        return aiHintService.requestHint(user(), attemptId, request.message());
    }

    @GetMapping("/attempts/{attemptId}/ai/usage")
    public AiUsageView aiUsage(@PathVariable Long attemptId) { return aiHintService.usage(user(), attemptId); }

    private User user() { return currentUserService.getCurrentUser(); }
}
