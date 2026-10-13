package com.placement.config;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.placement.dto.SqlProblemDtos;
import com.placement.repository.CodingProblemRepository;
import com.placement.service.SqlProblemService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

import java.io.File;
import java.util.ArrayList;
import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class SqlQuestionSeedLoader {

    private final SqlProblemService sqlProblemService;
    private final CodingProblemRepository codingProblemRepository;
    private final com.placement.repository.SqlProblemRepository sqlProblemRepository;
    private final ObjectMapper objectMapper;

    @Value("${app.seed.sql.path:#{null}}")
    private String configuredPath;

    private static final String[] CANDIDATE_PATHS = {
        "./sql-questions.json",
        "../sql-questions.json",
        "../../sql-questions.json",
        "FinalBackend/sql-questions.json",
        "../FinalBackend/sql-questions.json",
    };

    @EventListener(ApplicationReadyEvent.class)
    public void onApplicationReady() {
        deduplicateDatabaseSqlProblems();

        JsonNode root = loadJsonRoot();
        if (root == null || !root.isArray()) {
            log.warn("SQL Seed: no valid JSON array seed found, skipping seed load.");
            return;
        }

        int inserted = 0;
        int updated = 0;
        int failed = 0;

        for (JsonNode node : root) {
            try {
                UpsertResult result = processQuestion(node);
                if (result == UpsertResult.INSERTED) {
                    inserted++;
                } else if (result == UpsertResult.UPDATED) {
                    updated++;
                }
            } catch (Exception e) {
                failed++;
                String id = node.path("sourceQuestionId").asText("unknown");
                log.warn("SQL Seed: failed to process question sourceQuestionId='{}': {}", id, e.getMessage());
            }
        }

        deduplicateDatabaseSqlProblems();
        log.info("SQL Seed: inserted={}, updated={}, failed={}", inserted, updated, failed);
    }

    private JsonNode loadJsonRoot() {
        String path = resolvePath();
        if (path != null) {
            File file = new File(path);
            if (file.exists()) {
                try {
                    log.info("SQL Seed: reading seed file from disk: {}", path);
                    return objectMapper.readTree(file);
                } catch (Exception e) {
                    log.warn("SQL Seed: failed to parse disk file '{}': {}", path, e.getMessage());
                }
            }
        }

        try (java.io.InputStream is = getClass().getResourceAsStream("/sql-questions.json")) {
            if (is != null) {
                log.info("SQL Seed: reading seed file from classpath resource /sql-questions.json");
                return objectMapper.readTree(is);
            }
        } catch (Exception e) {
            log.warn("SQL Seed: failed to read from classpath resource: {}", e.getMessage());
        }

        return null;
    }

    private void deduplicateDatabaseSqlProblems() {
        try {
            List<com.placement.entity.CodingProblem> existing = sqlProblemRepository.findAllByCategory("SQL");
            if (existing == null || existing.isEmpty()) return;

            java.util.Map<String, List<com.placement.entity.CodingProblem>> byKey = new java.util.LinkedHashMap<>();
            for (com.placement.entity.CodingProblem p : existing) {
                String key;
                if (p.getSourceQuestionId() != null && !p.getSourceQuestionId().isBlank()) {
                    key = "id:" + p.getSourceQuestionId().trim().toLowerCase();
                } else if (p.getTitle() != null && !p.getTitle().isBlank()) {
                    key = "title:" + p.getTitle().trim().toLowerCase();
                } else {
                    key = "pk:" + p.getId();
                }
                byKey.computeIfAbsent(key, k -> new ArrayList<>()).add(p);
            }

            List<com.placement.entity.CodingProblem> toDelete = new ArrayList<>();
            for (List<com.placement.entity.CodingProblem> list : byKey.values()) {
                if (list.size() > 1) {
                    list.sort((a, b) -> Long.compare(b.getId() != null ? b.getId() : 0, a.getId() != null ? a.getId() : 0));
                    for (int i = 1; i < list.size(); i++) {
                        toDelete.add(list.get(i));
                    }
                }
            }

            if (!toDelete.isEmpty()) {
                log.info("SQL Seed: removing {} duplicate SQL problems from database", toDelete.size());
                sqlProblemRepository.deleteAll(toDelete);
            }
        } catch (Exception e) {
            log.warn("SQL Seed: error during duplicate cleanup sweep: {}", e.getMessage());
        }
    }

    private String resolvePath() {
        if (configuredPath != null && !configuredPath.isBlank()) {
            File f = new File(configuredPath);
            if (f.exists()) return configuredPath;
        }
        for (String candidate : CANDIDATE_PATHS) {
            File f = new File(candidate);
            if (f.exists()) return f.getAbsolutePath();
        }
        return null;
    }

    private UpsertResult processQuestion(JsonNode node) {
        String sourceQuestionId = node.path("sourceQuestionId").asText(null);
        String title = node.path("title").asText(null);

        String problemStatement = node.path("problemStatement").asText("");
        String difficulty = node.path("difficulty").asText("MEDIUM");
        String sourceUrl = node.path("sourceUrl").asText(null);
        String starterQuery = node.path("starterQuery").asText(node.path("starterCode").asText(""));
        String explanation = node.path("explanation").asText("");

        List<String> topicsList = toStringList(node.path("topics"));
        List<String> subtopicsList = toStringList(node.path("subtopics"));
        List<String> tagsList = toStringList(node.path("tags"));
        List<String> companiesList = toStringList(node.path("companies"));

        String[] topics = topicsList.toArray(new String[0]);
        String[] subtopics = subtopicsList.toArray(new String[0]);
        String[] tags = tagsList.toArray(new String[0]);
        String[] companies = companiesList.toArray(new String[0]);

        String executionConfig;
        try {
            executionConfig = objectMapper.writeValueAsString(node.path("execution"));
        } catch (Exception e) {
            executionConfig = "{}";
        }

        String testCasesJson;
        try {
            testCasesJson = objectMapper.writeValueAsString(node.path("testCases"));
        } catch (Exception e) {
            testCasesJson = "[]";
        }

        // source_question_id is globally unique on coding_problem. upsertBySourceId handles both
        // insert and update by looking up (sourceQuestionId, SQL category), so we always call it
        // and just report whether the row already existed.
        boolean existed = sourceQuestionId != null
                && codingProblemRepository.existsBySourceQuestionId(sourceQuestionId);

        SqlProblemDtos.SqlProblemUpsertRequest request = new SqlProblemDtos.SqlProblemUpsertRequest(
                sourceQuestionId,
                title,
                problemStatement,
                difficulty,
                topics,
                subtopics,
                tags,
                companies,
                sourceUrl,
                executionConfig,
                testCasesJson,
                starterQuery,
                explanation,
                true
        );

        sqlProblemService.upsertBySourceId(request);
        return existed ? UpsertResult.UPDATED : UpsertResult.INSERTED;
    }

    private List<String> toStringList(JsonNode arrayNode) {
        List<String> result = new ArrayList<>();
        if (arrayNode != null && arrayNode.isArray()) {
            for (JsonNode item : arrayNode) {
                if (!item.isNull()) {
                    result.add(item.asText());
                }
            }
        }
        return result;
    }

    private enum UpsertResult {
        INSERTED, UPDATED
    }
}
