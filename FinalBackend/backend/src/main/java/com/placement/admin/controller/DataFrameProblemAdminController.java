package com.placement.admin.controller;

import com.placement.dto.DataFrameProblemDtos.*;
import com.placement.service.DataFrameProblemService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/dataframe-problems")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class DataFrameProblemAdminController {

    private final DataFrameProblemService service;

    @GetMapping
    public DataFrameProblemPage list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return service.listAdmin(page, size);
    }

    @GetMapping("/{id}")
    public DataFrameProblemAdminResponse get(@PathVariable Long id) {
        return service.getAdmin(id);
    }

    @PostMapping
    public DataFrameProblemAdminResponse create(@RequestBody DataFrameProblemUpsertRequest request) {
        return service.create(request);
    }

    @PutMapping("/{id}")
    public DataFrameProblemAdminResponse update(@PathVariable Long id, @RequestBody DataFrameProblemUpsertRequest request) {
        return service.update(id, request);
    }

    @DeleteMapping("/{id}")
    public DataFrameProblemAdminResponse archive(@PathVariable Long id) {
        return service.archive(id);
    }

    private final com.placement.service.QuestionSeedImportService seedImportService;

    @PostMapping({"/bulk-import", "/seed"})
    public ResponseEntity<com.placement.service.QuestionSeedImportService.SeedImportResult> bulkImport(
            @RequestBody com.fasterxml.jackson.databind.JsonNode request) {
        return ResponseEntity.ok(seedImportService.importDataFrame(request));
    }

    @PostMapping("/deduplicate")
    public ResponseEntity<Map<String, Object>> deduplicate() {
        int removed = seedImportService.deduplicateCategory("DATAFRAME");
        return ResponseEntity.ok(Map.of("message", "Deduplication completed", "duplicatesRemoved", removed));
    }

    @PatchMapping("/{id}/reactivate")
    public DataFrameProblemAdminResponse reactivate(@PathVariable Long id) {
        return service.reactivate(id);
    }

    @DeleteMapping("/{id}/permanent")
    public ResponseEntity<Map<String, String>> permanentDelete(@PathVariable Long id) {
        service.hardDelete(id);
        return ResponseEntity.ok(Map.of("message", "DataFrame problem permanently deleted"));
    }
}
