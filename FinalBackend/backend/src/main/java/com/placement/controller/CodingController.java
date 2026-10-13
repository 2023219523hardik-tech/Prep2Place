package com.placement.controller;

import com.placement.dto.CodingDtos.*;
import com.placement.dto.DataFrameProblemDtos;
import com.placement.dto.SqlProblemDtos;
import com.placement.entity.CodingProblem;
import com.placement.exception.ApiException;
import com.placement.redis.RateLimitService;
import com.placement.service.CodingService;
import com.placement.service.CurrentUserService;
import com.placement.service.DataFrameProblemService;
import com.placement.service.SqlProblemService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/coding")
@RequiredArgsConstructor
public class CodingController {

    private final CodingService codingService;
    private final CurrentUserService currentUserService;
    private final RateLimitService rateLimitService;
    private final SqlProblemService sqlProblemService;
    private final DataFrameProblemService dataFrameProblemService;

    /** Each call to /run or /submit* spins up a real Docker container per test case - unlimited
     *  calls per user is a resource-exhaustion path on the host, not just an abuse-of-the-feature
     *  one. Cooldowns are deliberately short: this is host protection, not a merchandising limit -
     *  a real candidate iterating on a solution should barely notice it. /submit and /submissions
     *  share one bucket (both trigger a full grading run against the same problem) so alternating
     *  between the two endpoints isn't a loophole around the limit. */
    @Value("${app.coding.rate-limit.run-cooldown-seconds:2}")
    private int runCooldownSeconds;

    @Value("${app.coding.rate-limit.submit-cooldown-seconds:5}")
    private int submitCooldownSeconds;

    @GetMapping("/problems")
    public List<CodingProblem> problems() { return codingService.listProblems(); }

    @GetMapping("/languages")
    public List<LanguageConfig> languages() { return codingService.supportedLanguages(); }

    @GetMapping("/problems/{problemId}")
    public CodingProblem problem(@PathVariable Long problemId) { return codingService.getProblem(problemId); }

    @GetMapping("/problems/{problemId}/metadata")
    public ProblemMetadataResponse problemMetadata(@PathVariable Long problemId) {
        return codingService.problemMetadata(problemId);
    }

    @PostMapping("/run")
    public RunCodeResponse run(@RequestBody RunCodeRequest request) {
        enforceRateLimit("coding:run:", runCooldownSeconds);
        return codingService.runVisibleTests(request);
    }

    @PostMapping("/submit")
    public SubmitCodeResponse submitCode(@RequestBody SubmitCodeRequest request) {
        enforceRateLimit("coding:submit:", submitCooldownSeconds);
        return codingService.submitCode(currentUserService.getCurrentUser(), request);
    }

    @PostMapping("/submissions")
    public SubmissionResponse submit(@RequestBody SubmitCodeRequest request) {
        enforceRateLimit("coding:submit:", submitCooldownSeconds);
        return codingService.submit(currentUserService.getCurrentUser(), request);
    }

    @GetMapping("/submissions/{submissionId}")
    public SubmissionResponse submission(@PathVariable Long submissionId) {
        return codingService.history(currentUserService.getCurrentUser().getId()).stream()
                .filter(s -> s.submissionId().equals(submissionId)).findFirst()
                .orElseThrow(() -> com.placement.exception.ApiException.notFound("Submission not found"));
    }

    @GetMapping("/history")
    public List<SubmissionResponse> history() { return codingService.history(currentUserService.getCurrentUser().getId()); }

    @GetMapping("/progress")
    public Map<String, Double> progress() { return codingService.progressByTopic(currentUserService.getCurrentUser().getId()); }

    private void enforceRateLimit(String keyPrefix, int cooldownSeconds) {
        Long userId = currentUserService.getCurrentUser().getId();
        if (!rateLimitService.tryAcquire(keyPrefix + userId, cooldownSeconds)) {
            throw ApiException.tooManyRequests(
                    "You're running/submitting code too quickly. Please wait a couple of seconds and try again.");
        }
    }

    @GetMapping(params = "mode")
    public Object problemsByMode(
            @RequestParam String mode,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        String upperMode = mode == null ? "" : mode.toUpperCase().trim();
        switch (upperMode) {
            case "DSA":
                return codingService.listProblems();
            case "SQL":
                return sqlProblemService.listStudent(page, size);
            case "DATAFRAME":
                return dataFrameProblemService.listStudent(page, size);
            default:
                throw ApiException.badRequest("Invalid mode: " + mode + ". Expected DSA, SQL, or DATAFRAME.");
        }
    }
}
