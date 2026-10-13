package com.placement.codinglab.controller;

import com.placement.codinglab.dto.CodingLabDtos.*;
import com.placement.codinglab.entity.AiHintInteraction;
import com.placement.codinglab.entity.CodingAssessmentStatus;
import com.placement.codinglab.entity.CodingType;
import com.placement.codinglab.generation.AssessmentGenerationService;
import com.placement.codinglab.model.AssessmentBlueprint;
import com.placement.codinglab.runner.SandboxExecutor;
import com.placement.codinglab.service.CodingAssessmentAdminService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;
import java.util.Map;

/**
 * Admin authoring API (covered by the app-wide {@code /api/admin/**} ADMIN / PLACEMENT_ADMIN rule).
 *
 * <p>Two ways to create a question, one gate:
 * <ul>
 *   <li><b>Manual</b> - {@code POST /} (form / editor), or {@code POST /import} (blueprint JSON);</li>
 *   <li><b>AI</b> - {@code POST /generate} (async job) which produces the same kind of DRAFT.</li>
 * </ul>
 * Either way a question must pass {@code POST /{id}/verify} (sandbox run) before {@code POST /{id}/publish} accepts it.
 *
 * <p>Deliberately NOT {@code @Transactional} at class level: verification and generation run the sandbox / call an LLM
 * and must not hold a database connection; the service layer opens short transactions itself.
 */
@RestController
@RequestMapping("/api/admin/coding-assessments")
@RequiredArgsConstructor
public class CodingAssessmentAdminController {

    private final CodingAssessmentAdminService service;
    private final AssessmentGenerationService generation;

    // ---- discovery: "what do I have to provide?" ----------------------------------------------------------

    @GetMapping("/schema")
    public AuthoringSchema schema() { return service.schema(); }

    @GetMapping("/runner/status")
    public SandboxExecutor.RunnerStatus runnerStatus() { return service.runnerStatus(); }

    // ---- CRUD ---------------------------------------------------------------------------------------------

    @GetMapping
    public List<AssessmentAdminSummary> list(@RequestParam(required = false) CodingAssessmentStatus status,
                                             @RequestParam(required = false) CodingType type) {
        return service.list(status, type);
    }

    @GetMapping("/{id}")
    public AssessmentAdminView get(@PathVariable Long id) { return service.get(id); }

    @PostMapping
    public AssessmentAdminView create(@RequestBody AssessmentUpsertRequest req, Principal principal) {
        return service.create(req, principal == null ? null : principal.getName());
    }

    @PutMapping("/{id}")
    public AssessmentAdminView update(@PathVariable Long id, @RequestBody AssessmentUpsertRequest req) {
        return service.update(id, req);
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable Long id) { service.delete(id); }

    // ---- lifecycle ----------------------------------------------------------------------------------------

    @PostMapping("/{id}/validate")
    public List<Map<String, Object>> validate(@PathVariable Long id) { return service.validate(id); }

    /** Async: returns a job; poll {@code GET /jobs/{jobId}}. The result is also stored on the question. */
    @PostMapping("/{id}/verify")
    public JobView verify(@PathVariable Long id) { return service.startVerification(id); }

    @PostMapping("/{id}/publish")
    public AssessmentAdminView publish(@PathVariable Long id) { return service.publish(id); }

    @PostMapping("/{id}/unpublish")
    public AssessmentAdminView unpublish(@PathVariable Long id) { return service.unpublish(id); }

    @PostMapping("/{id}/archive")
    public AssessmentAdminView archive(@PathVariable Long id) { return service.archive(id); }

    @PostMapping("/{id}/duplicate")
    public AssessmentAdminView duplicate(@PathVariable Long id) { return service.duplicate(id); }

    // ---- AI generation & import / export -------------------------------------------------------------------

    @PostMapping("/generate")
    public JobView generate(@RequestBody GenerateRequest req, Principal principal) {
        return generation.start(req, principal == null ? null : principal.getName());
    }

    @GetMapping("/jobs/{jobId}")
    public JobView job(@PathVariable String jobId) { return service.job(jobId); }

    @GetMapping("/{id}/export")
    public AssessmentBlueprint export(@PathVariable Long id) { return service.export(id); }

    @PostMapping("/import")
    public AssessmentAdminView importBlueprint(@RequestBody AssessmentBlueprint blueprint, Principal principal) {
        return service.importBlueprint(blueprint, principal == null ? null : principal.getName());
    }

    // ---- results ------------------------------------------------------------------------------------------

    @GetMapping("/{id}/submissions")
    public List<SubmissionAdminView> submissions(@PathVariable Long id) { return service.submissions(id); }

    @GetMapping("/{id}/ai-audit")
    public List<AiHintInteraction> aiAudit(@PathVariable Long id) { return service.aiAudit(id); }

    @GetMapping("/analytics/overview")
    public CodingAnalyticsView analyticsOverview() { return service.analytics(); }
}
