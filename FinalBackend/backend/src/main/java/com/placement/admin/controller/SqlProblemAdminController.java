package com.placement.admin.controller;

import com.placement.dto.SqlProblemDtos.*;
import com.placement.service.SqlProblemService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/sql-problems")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class SqlProblemAdminController {

    private final SqlProblemService service;

    @GetMapping
    public SqlProblemPage list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return service.listAdmin(page, size);
    }

    @GetMapping("/{id}")
    public SqlProblemAdminResponse get(@PathVariable Long id) {
        return service.getAdmin(id);
    }

    @PostMapping
    public SqlProblemAdminResponse create(@RequestBody SqlProblemUpsertRequest request) {
        return service.create(request);
    }

    @PutMapping("/{id}")
    public SqlProblemAdminResponse update(@PathVariable Long id, @RequestBody SqlProblemUpsertRequest request) {
        return service.update(id, request);
    }

    @DeleteMapping("/{id}")
    public SqlProblemAdminResponse archive(@PathVariable Long id) {
        return service.archive(id);
    }

    private final com.placement.service.QuestionSeedImportService seedImportService;

    @PostMapping({"/bulk-import", "/seed"})
    public ResponseEntity<com.placement.service.QuestionSeedImportService.SeedImportResult> bulkImport(
            @RequestBody com.fasterxml.jackson.databind.JsonNode request) {
        return ResponseEntity.ok(seedImportService.importSql(request));
    }

    @PostMapping("/deduplicate")
    public ResponseEntity<Map<String, Object>> deduplicate() {
        int removed = seedImportService.deduplicateCategory("SQL");
        return ResponseEntity.ok(Map.of("message", "Deduplication completed", "duplicatesRemoved", removed));
    }

    @PatchMapping("/{id}/reactivate")
    public SqlProblemAdminResponse reactivate(@PathVariable Long id) {
        return service.reactivate(id);
    }

    @DeleteMapping("/{id}/permanent")
    public ResponseEntity<Map<String, String>> permanentDelete(@PathVariable Long id) {
        service.hardDelete(id);
        return ResponseEntity.ok(Map.of("message", "SQL problem permanently deleted"));
    }
}
