package com.placement.controller;

import com.placement.dto.CodingDtos.*;
import com.placement.entity.Difficulty;
import com.placement.service.CodingProblemAdminService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

/**
 * Admin CRUD for the legacy coding module (CodingProblem + ProblemExample + ProblemConstraint).
 * Gated by the existing "/api/admin/**" -> hasAnyRole("ADMIN","PLACEMENT_ADMIN") rule in
 * SecurityConfig (verified, not assumed - same check already done for the other two admin CRUDs
 * added this session). A dedicated controller, following the same convention already used for
 * this codebase's other bounded contexts (QuestionBankAdminController, CodingAssessmentAdminController)
 * rather than growing the already-large general-purpose AdminController further.
 */
@RestController
@RequestMapping("/api/admin/coding-problems")
@RequiredArgsConstructor
public class CodingProblemAdminController {

    private final CodingProblemAdminService service;

    @GetMapping
    public CodingProblemAdminPage list(
            @RequestParam(required = false) String topic,
            @RequestParam(required = false) Difficulty difficulty,
            @RequestParam(required = false) Boolean active,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return service.search(topic, difficulty, active, search, page, size);
    }

    @GetMapping("/{id}")
    public CodingProblemAdminView get(@PathVariable Long id) {
        return service.get(id);
    }

    @PostMapping
    public CodingProblemAdminView create(@RequestBody CodingProblemUpsertRequest request) {
        return service.create(request);
    }

    /** Bulk import: a JSON array of the same shape POST / accepts, one element per problem. */
    @PostMapping("/bulk-upload")
    public java.util.List<CodingProblemAdminView> bulkUpload(@RequestBody java.util.List<CodingProblemUpsertRequest> requests) {
        return service.bulkCreate(requests);
    }

    @PutMapping("/{id}")
    public CodingProblemAdminView update(@PathVariable Long id, @RequestBody CodingProblemUpsertRequest request) {
        return service.update(id, request);
    }

    /** Soft delete by default - see CodingProblemAdminService.archive(). */
    @DeleteMapping("/{id}")
    public CodingProblemAdminView archive(@PathVariable Long id) {
        return service.archive(id);
    }

    @PatchMapping("/{id}/reactivate")
    public CodingProblemAdminView reactivate(@PathVariable Long id) {
        return service.reactivate(id);
    }

    /** Genuinely destructive; refused with a clear message when the problem has submissions - see
     *  CodingProblemAdminService.hardDelete(). Deliberately a distinct path from DELETE above,
     *  same pattern as the other two admin CRUDs added this session. */
    @DeleteMapping("/{id}/permanent")
    public java.util.Map<String, String> hardDelete(@PathVariable Long id) {
        service.hardDelete(id);
        return java.util.Map.of("message", "Coding problem permanently deleted");
    }
}