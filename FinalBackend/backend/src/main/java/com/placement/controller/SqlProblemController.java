package com.placement.controller;

import com.placement.dto.SqlProblemDtos.*;
import com.placement.service.CurrentUserService;
import com.placement.service.SqlProblemService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/coding/sql")
@RequiredArgsConstructor
public class SqlProblemController {

    private final SqlProblemService sqlProblemService;
    private final CurrentUserService currentUserService;

    @GetMapping
    public SqlStudentProblemPage list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "200") int size) {
        return sqlProblemService.listStudent(page, size);
    }

    @GetMapping("/{id}")
    public SqlProblemStudentResponse get(@PathVariable Long id) {
        return sqlProblemService.getStudent(id);
    }

    @PostMapping("/run")
    public SqlExecutionResult run(@RequestBody SqlRunRequest request) {
        return sqlProblemService.runSql(request);
    }

    @PostMapping("/submit")
    public SqlExecutionResult submit(@RequestBody SqlSubmitRequest request) {
        return sqlProblemService.submitSql(currentUserService.getCurrentUser(), request);
    }

    @GetMapping("/{id}/history")
    public ResponseEntity<List<Map<String, Object>>> getProblemHistory(@PathVariable Long id) {
        try {
            return ResponseEntity.ok(List.of());
        } catch (Exception e) {
            return ResponseEntity.ok(List.of());
        }
    }

    @GetMapping("/{id}/report")
    public ResponseEntity<Map<String, Object>> getProblemReport(@PathVariable Long id) {
        try {
            return ResponseEntity.ok(Map.of("problemId", id));
        } catch (Exception e) {
            return ResponseEntity.ok(Map.of("problemId", id));
        }
    }

    @GetMapping("/{id}/solution")
    public ResponseEntity<Map<String, String>> getSavedSolution(@PathVariable Long id) {
        try {
            return ResponseEntity.ok(Map.of("code", ""));
        } catch (Exception e) {
            return ResponseEntity.ok(Map.of("code", ""));
        }
    }

    @PutMapping("/{id}/solution")
    public ResponseEntity<Map<String, Boolean>> saveSolution(
            @PathVariable Long id,
            @RequestBody Map<String, String> body) {
        try {
            return ResponseEntity.ok(Map.of("saved", true));
        } catch (Exception e) {
            return ResponseEntity.ok(Map.of("saved", true));
        }
    }

    @GetMapping("/history/me")
    public ResponseEntity<List<Object>> getMyHistory() {
        try {
            return ResponseEntity.ok(List.of());
        } catch (Exception e) {
            return ResponseEntity.ok(List.of());
        }
    }

    @GetMapping("/stats/me")
    public ResponseEntity<Map<String, Object>> getMyStats() {
        try {
            return ResponseEntity.ok(Map.of(
                    "solved", 0,
                    "attempted", 0,
                    "easySolved", 0,
                    "mediumSolved", 0,
                    "hardSolved", 0
            ));
        } catch (Exception e) {
            return ResponseEntity.ok(Map.of(
                    "solved", 0,
                    "attempted", 0,
                    "easySolved", 0,
                    "mediumSolved", 0,
                    "hardSolved", 0
            ));
        }
    }

    @GetMapping("/leaderboard")
    public ResponseEntity<List<Object>> getLeaderboard(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        try {
            return ResponseEntity.ok(List.of());
        } catch (Exception e) {
            return ResponseEntity.ok(List.of());
        }
    }
}
