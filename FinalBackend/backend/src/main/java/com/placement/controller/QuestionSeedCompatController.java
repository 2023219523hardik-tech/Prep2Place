package com.placement.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.placement.dto.CodingDtos.CodingProblemUpsertRequest;
import com.placement.questionbank.service.TechnicalMcqAdminService;
import com.placement.service.CodingProblemAdminService;
import com.placement.service.DataFrameProblemService;
import com.placement.service.QuestionSeedImportService;
import com.placement.service.SqlProblemService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@RestController
@RequiredArgsConstructor
@Slf4j
@PreAuthorize("hasAnyRole('ADMIN', 'PLACEMENT_ADMIN')")
public class QuestionSeedCompatController {

    private final SqlProblemService sqlProblemService;
    private final DataFrameProblemService dataFrameProblemService;
    private final CodingProblemAdminService codingProblemAdminService;
    private final QuestionSeedImportService seedImportService;
    private final TechnicalMcqAdminService technicalMcqAdminService;

    // SQL compatibility endpoints
    @PostMapping({"/api/sql/problems/seed", "/api/coding/sql/seed"})
    public ResponseEntity<QuestionSeedImportService.SeedImportResult> seedSql(
            @RequestBody JsonNode request,
            @RequestParam(name = "duplicateStrategy", defaultValue = "UPDATE") String duplicateStrategy) {
        var results = seedImportService.importSql(request, duplicateStrategy);
        return ResponseEntity.ok(results);
    }

    @PostMapping({"/api/sql/problems/deduplicate", "/api/coding/sql/deduplicate"})
    public ResponseEntity<Map<String, Object>> deduplicateSql() {
        int removed = seedImportService.deduplicateCategory("SQL");
        return ResponseEntity.ok(Map.of("message", "SQL deduplication completed", "duplicatesRemoved", removed));
    }

    @PostMapping({"/api/sql/problems/bulk-delete", "/api/coding/sql/bulk-delete"})
    public ResponseEntity<Map<String, Object>> bulkDeleteSql(@RequestBody JsonNode body) {
        List<Long> ids = parseIds(body);
        for (Long id : ids) {
            sqlProblemService.archive(id);
        }
        return ResponseEntity.ok(Map.of("message", "Archived " + ids.size() + " SQL problems", "count", ids.size()));
    }

    // DataFrame compatibility endpoints
    @PostMapping({"/api/dataframe/problems/seed", "/api/coding/dataframe/seed"})
    public ResponseEntity<QuestionSeedImportService.SeedImportResult> seedDataFrame(
            @RequestBody JsonNode request,
            @RequestParam(name = "duplicateStrategy", defaultValue = "UPDATE") String duplicateStrategy) {
        var results = seedImportService.importDataFrame(request, duplicateStrategy);
        return ResponseEntity.ok(results);
    }

    @PostMapping({"/api/dataframe/problems/deduplicate", "/api/coding/dataframe/deduplicate"})
    public ResponseEntity<Map<String, Object>> deduplicateDataFrame() {
        int removed = seedImportService.deduplicateCategory("DATAFRAME");
        return ResponseEntity.ok(Map.of("message", "DataFrame deduplication completed", "duplicatesRemoved", removed));
    }

    @PostMapping({"/api/dataframe/problems/bulk-delete", "/api/coding/dataframe/bulk-delete"})
    public ResponseEntity<Map<String, Object>> bulkDeleteDataFrame(@RequestBody JsonNode body) {
        List<Long> ids = parseIds(body);
        for (Long id : ids) {
            dataFrameProblemService.archive(id);
        }
        return ResponseEntity.ok(Map.of("message", "Archived " + ids.size() + " DataFrame problems", "count", ids.size()));
    }

    // DSA Coding compatibility endpoints
    @PostMapping({"/api/coding/problems/seed", "/api/coding/problems/bulk-upload"})
    public ResponseEntity<Object> seedCoding(
            @RequestBody JsonNode request,
            @RequestParam(name = "duplicateStrategy", defaultValue = "UPDATE") String duplicateStrategy) {
        var results = seedImportService.importDsa(request, duplicateStrategy);
        return ResponseEntity.ok(results);
    }

    @PostMapping({"/api/coding/problems/deduplicate", "/api/coding/problems/dedup"})
    public ResponseEntity<Map<String, Object>> deduplicateDsa() {
        int removed = seedImportService.deduplicateCategory("DSA");
        return ResponseEntity.ok(Map.of("message", "DSA deduplication completed", "duplicatesRemoved", removed));
    }

    @PostMapping("/api/coding/problems/bulk-delete")
    public ResponseEntity<Map<String, Object>> bulkDeleteCoding(@RequestBody JsonNode body) {
        List<Long> ids = parseIds(body);
        for (Long id : ids) {
            codingProblemAdminService.archive(id);
        }
        return ResponseEntity.ok(Map.of("message", "Archived " + ids.size() + " coding problems", "count", ids.size()));
    }

    // Technical MCQ deduplicate endpoint
    @PostMapping({"/api/technical/questions/deduplicate", "/api/coding/technical/deduplicate", "/api/admin/questionbank/technical-mcq/deduplicate"})
    public ResponseEntity<Map<String, Object>> deduplicateTechnical() {
        int removed = technicalMcqAdminService.deduplicateQuestions();
        return ResponseEntity.ok(Map.of("message", "Technical MCQ deduplication completed", "duplicatesRemoved", removed));
    }

    // Single delete compatibility endpoints
    @DeleteMapping("/api/coding/problems/{id}")
    public ResponseEntity<Map<String, Object>> deleteCodingProblem(@PathVariable Long id) {
        codingProblemAdminService.archive(id);
        return ResponseEntity.ok(Map.of("message", "Coding problem " + id + " archived", "id", id));
    }

    @DeleteMapping({"/api/sql/problems/{id}", "/api/coding/sql/{id}"})
    public ResponseEntity<Map<String, Object>> deleteSqlProblem(@PathVariable Long id) {
        sqlProblemService.archive(id);
        return ResponseEntity.ok(Map.of("message", "SQL problem " + id + " archived", "id", id));
    }

    @DeleteMapping({"/api/dataframe/problems/{id}", "/api/coding/dataframe/{id}"})
    public ResponseEntity<Map<String, Object>> deleteDataFrameProblem(@PathVariable Long id) {
        dataFrameProblemService.archive(id);
        return ResponseEntity.ok(Map.of("message", "DataFrame problem " + id + " archived", "id", id));
    }

    @DeleteMapping("/api/technical/questions/{id}")
    public ResponseEntity<Map<String, Object>> deleteTechnicalQuestion(@PathVariable Long id) {
        technicalMcqAdminService.archive(id);
        return ResponseEntity.ok(Map.of("message", "Technical MCQ " + id + " archived", "id", id));
    }

    // Technical MCQ bulk delete compatibility endpoint
    @PostMapping({"/api/technical/questions/bulk-delete", "/api/coding/technical/bulk-delete"})
    public ResponseEntity<Map<String, Object>> bulkDeleteTechnical(@RequestBody JsonNode body) {
        List<Long> ids = parseIds(body);
        for (Long id : ids) {
            technicalMcqAdminService.archive(id);
        }
        return ResponseEntity.ok(Map.of("message", "Archived " + ids.size() + " technical MCQs", "count", ids.size()));
    }

    private List<Long> parseIds(JsonNode body) {
        List<Long> ids = new ArrayList<>();
        if (body == null || body.isNull()) return ids;

        if (body.isArray()) {
            for (JsonNode n : body) {
                if (n.canConvertToLong()) ids.add(n.asLong());
            }
        } else if (body.isObject()) {
            JsonNode idsNode = body.has("ids") ? body.get("ids") : body.get("problemIds");
            if (idsNode != null && idsNode.isArray()) {
                for (JsonNode n : idsNode) {
                    if (n.canConvertToLong()) ids.add(n.asLong());
                }
            }
        }
        return ids;
    }
}
