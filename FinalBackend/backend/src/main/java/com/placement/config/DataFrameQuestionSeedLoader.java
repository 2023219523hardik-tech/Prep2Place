package com.placement.config;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.placement.dto.DataFrameProblemDtos;
import com.placement.entity.CodingProblem;
import com.placement.repository.CodingProblemRepository;
import com.placement.repository.DataFrameProblemRepository;
import com.placement.service.DataFrameProblemService;
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
public class DataFrameQuestionSeedLoader {

    private final DataFrameProblemService dataFrameProblemService;
    private final CodingProblemRepository codingProblemRepository;
    private final DataFrameProblemRepository dataFrameProblemRepository;
    private final ObjectMapper objectMapper;

    @Value("${app.seed.dataframe.path:#{null}}")
    private String configuredPath;

    private static final String[] CANDIDATE_PATHS = {
        "./dataframe-questions.json",
        "../dataframe-questions.json",
        "../../dataframe-questions.json",
        "FinalBackend/dataframe-questions.json",
        "../FinalBackend/dataframe-questions.json",
    };

    @EventListener(ApplicationReadyEvent.class)
    public void onApplicationReady() {
        deduplicateDatabaseDataFrameProblems();

        JsonNode root = loadJsonRoot();
        if (root == null || !root.isArray()) {
            log.warn("DataFrame Seed: no valid JSON array seed found, skipping seed load.");
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
                log.warn("DataFrame Seed: failed to process question sourceQuestionId='{}': {}", id, e.getMessage());
            }
        }

        deduplicateDatabaseDataFrameProblems();
        log.info("DataFrame Seed: inserted={}, updated={}, failed={}", inserted, updated, failed);
    }

    private JsonNode loadJsonRoot() {
        String path = resolvePath();
        if (path != null) {
            File file = new File(path);
            if (file.exists()) {
                try {
                    log.info("DataFrame Seed: reading seed file from disk: {}", path);
                    return objectMapper.readTree(file);
                } catch (Exception e) {
                    log.warn("DataFrame Seed: failed to parse disk file '{}': {}", path, e.getMessage());
                }
            }
        }

        try (java.io.InputStream is = getClass().getResourceAsStream("/dataframe-questions.json")) {
            if (is != null) {
                log.info("DataFrame Seed: reading seed file from classpath resource /dataframe-questions.json");
                return objectMapper.readTree(is);
            }
        } catch (Exception e) {
            log.warn("DataFrame Seed: failed to read from classpath resource: {}", e.getMessage());
        }

        return null;
    }

    private void deduplicateDatabaseDataFrameProblems() {
        try {
            List<CodingProblem> existing = dataFrameProblemRepository.findAllByCategory("DATAFRAME");
            if (existing == null || existing.isEmpty()) return;

            java.util.Map<String, List<CodingProblem>> byKey = new java.util.LinkedHashMap<>();
            for (CodingProblem p : existing) {
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

            int removedCount = 0;
            for (List<CodingProblem> duplicates : byKey.values()) {
                if (duplicates.size() > 1) {
                    duplicates.sort((a, b) -> Long.compare(b.getId(), a.getId()));
                    for (int i = 1; i < duplicates.size(); i++) {
                        dataFrameProblemRepository.delete(duplicates.get(i));
                        removedCount++;
                    }
                }
            }

            if (removedCount > 0) {
                log.info("DataFrame Seed deduplication: removed {} duplicate problems from database", removedCount);
            }
        } catch (Exception e) {
            log.warn("DataFrame Seed deduplication skipped: {}", e.getMessage());
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
        String starterCode = node.path("starterCode").asText(node.path("starterQuery").asText(""));
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

        boolean existed = sourceQuestionId != null
                && codingProblemRepository.existsBySourceQuestionId(sourceQuestionId);

        DataFrameProblemDtos.DataFrameProblemUpsertRequest request = new DataFrameProblemDtos.DataFrameProblemUpsertRequest(
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
                starterCode,
                explanation,
                true
        );

        dataFrameProblemService.upsertBySourceId(request);
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
