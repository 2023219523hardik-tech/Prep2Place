package com.placement.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.placement.entity.CodingProblem;
import com.placement.entity.Difficulty;
import com.placement.entity.ExecutionMode;
import com.placement.entity.ParameterSpec;
import com.placement.entity.ProblemConstraint;
import com.placement.entity.ProblemExample;
import com.placement.repository.CodingProblemRepository;
import com.placement.repository.CodingSubmissionRepository;
import com.placement.repository.DataFrameProblemRepository;
import com.placement.repository.SqlProblemRepository;
import lombok.Builder;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
@Slf4j
@RequiredArgsConstructor
public class QuestionSeedImportService {

    private final SqlProblemRepository sqlProblemRepository;
    private final DataFrameProblemRepository dataFrameProblemRepository;
    private final CodingProblemRepository codingProblemRepository;
    private final CodingSubmissionRepository submissionRepository;
    private final ObjectMapper objectMapper;

    @Data
    @Builder
    public static class SeedImportResult {
        private int totalProcessed;
        private int inserted;
        private int updated;
        private int skipped;
        private int duplicatesRemoved;
        private String category;
        private String message;
    }

    /**
     * Imports DSA coding questions from flexible JSON array or object.
     * Supports duplicate strategies: UPDATE (upsert), SKIP, INSERT_NEW.
     */
    @Transactional
    public SeedImportResult importDsa(JsonNode rootNode, String duplicateStrategy) {
        List<JsonNode> items = extractItems(rootNode);
        int inserted = 0;
        int updated = 0;
        int skipped = 0;

        List<CodingProblem> allExisting = codingProblemRepository.findAll();
        Map<String, CodingProblem> globalBySourceId = new HashMap<>();
        Map<String, CodingProblem> bySourceId = new HashMap<>();
        Map<String, CodingProblem> byNormalizedTitle = new HashMap<>();

        for (CodingProblem p : allExisting) {
            if (p.getSourceQuestionId() != null && !p.getSourceQuestionId().isBlank()) {
                globalBySourceId.put(p.getSourceQuestionId().trim().toLowerCase(), p);
            }
            boolean isDsa = p.getCategory() == null || "DSA".equalsIgnoreCase(p.getCategory())
                    || (!"SQL".equalsIgnoreCase(p.getCategory()) && !"DATAFRAME".equalsIgnoreCase(p.getCategory()));
            if (isDsa) {
                if (p.getSourceQuestionId() != null && !p.getSourceQuestionId().isBlank()) {
                    bySourceId.put(p.getSourceQuestionId().trim().toLowerCase(), p);
                }
                if (p.getTitle() != null && !p.getTitle().isBlank()) {
                    byNormalizedTitle.put(normalizeTitle(p.getTitle()), p);
                }
            }
        }

        for (int i = 0; i < items.size(); i++) {
            JsonNode item = items.get(i);
            String title = extractTitle(item);
            if (title == null || title.isBlank()) {
                title = "Coding Challenge #" + (i + 1);
            }

            String sourceQuestionId = extractText(item, "sourceQuestionId", "slug", "id", "questionId", "leetcodeId", "problemId");
            if (sourceQuestionId == null || sourceQuestionId.isBlank()) {
                sourceQuestionId = normalizeSlug(title);
            }
            String candidateSlugKey = (sourceQuestionId != null && !sourceQuestionId.isBlank())
                    ? sourceQuestionId.trim().toLowerCase()
                    : normalizeSlug(title);

            String statement = extractDsaStatement(item, title);
            Difficulty difficulty = extractDifficulty(item);
            String topic = extractText(item, "topic", "category", "tag");
            String[] topics = extractStringArray(item, "topics");
            String[] subtopics = extractStringArray(item, "subtopics");
            String[] tags = extractStringArray(item, "tags");
            String[] companies = extractStringArray(item, "companies");
            String companyTags = extractText(item, "companyTags", "company_tags");
            if (companyTags == null && companies.length > 0) {
                companyTags = String.join(", ", companies);
            }

            String sourceUrl = extractText(item, "sourceUrl", "url", "link");
            String sampleInput = extractText(item, "sampleInput", "sample_input", "input");
            String sampleOutput = extractText(item, "sampleOutput", "sample_output", "output");
            String methodName = extractText(item, "methodName", "method_name", "functionName", "function_name");
            String returnType = extractText(item, "returnType", "return_type", "type", "outputType", "output_type");
            List<ParameterSpec> parameters = new ArrayList<>();

            if (item.has("execution") && item.get("execution").has("java")) {
                JsonNode javaExec = item.get("execution").get("java");
                if (javaExec.isObject()) {
                    if ((methodName == null || methodName.isBlank()) && javaExec.has("methodName") && !javaExec.get("methodName").isNull()) {
                        methodName = javaExec.get("methodName").asText();
                    }
                    if ((returnType == null || returnType.isBlank()) && javaExec.has("returnType") && !javaExec.get("returnType").isNull()) {
                        returnType = javaExec.get("returnType").asText();
                    }
                    if (javaExec.has("parameters") && javaExec.get("parameters").isArray()) {
                        for (JsonNode pNode : javaExec.get("parameters")) {
                            String pName = pNode.has("name") ? pNode.get("name").asText() : "arg";
                            String pType = pNode.has("type") ? pNode.get("type").asText() : "int";
                            String pDoc = pNode.has("structure") ? pNode.get("structure").asText() : pName;
                            parameters.add(new ParameterSpec(pName, pType, pDoc));
                        }
                    }
                }
            }

            if (methodName == null || methodName.isBlank()) {
                methodName = deriveMethodName(title);
            }
            if (returnType == null || returnType.isBlank()) {
                returnType = deriveReturnType(item);
            }

            String modeStr = extractText(item, "executionMode", "execution_mode", "mode");
            ExecutionMode executionMode = ExecutionMode.METHOD;
            if (modeStr != null) {
                try {
                    executionMode = ExecutionMode.valueOf(modeStr.trim().toUpperCase());
                } catch (Exception ignored) {}
            }

            String executionConfig = extractSerialized(item, "executionConfig", "execution");
            String testCasesJson = extractSerialized(item, "testCasesJson", "testCases", "test_cases");
            String explanation = extractText(item, "explanation", "notes", "solutionExplanation");
            Map<String, String> templates = extractTemplates(item);
            String starterCode = extractText(item, "starterCode", "starter_code", "starterQuery", "solution");
            if (templates.isEmpty() && starterCode != null && !starterCode.isBlank()) {
                templates.put("java", starterCode);
                templates.put("python", starterCode);
            }

            if (templates.containsKey("java") && templates.get("java") != null) {
                String[] methodAndReturn = new String[]{methodName, returnType};
                parseJavaTemplateSignature(templates.get("java"), parameters, methodAndReturn);
                methodName = methodAndReturn[0];
                returnType = methodAndReturn[1];
            }

            Integer timeLimitMs = extractInt(item, 1000, "timeLimitMs", "time_limit", "timeLimit");
            Integer memoryLimitMb = extractInt(item, 256, "memoryLimitMb", "memory_limit", "memoryLimit");
            Double acceptanceRate = extractDouble(item, 56.4, "acceptanceRate", "acceptance_rate");
            boolean active = item.has("active") ? item.get("active").asBoolean(true) : true;

            CodingProblem target = null;
            if (!candidateSlugKey.isBlank()) {
                target = bySourceId.get(candidateSlugKey);
            }
            if (target == null) {
                target = byNormalizedTitle.get(normalizeTitle(title));
            }
            if (target == null && !candidateSlugKey.isBlank()) {
                target = globalBySourceId.get(candidateSlugKey);
            }

            boolean isSkip = "SKIP".equalsIgnoreCase(duplicateStrategy);
            boolean isInsertNew = "INSERT_NEW".equalsIgnoreCase(duplicateStrategy) || "ALLOW".equalsIgnoreCase(duplicateStrategy);

            if (isSkip && (target != null || byNormalizedTitle.containsKey(normalizeTitle(title)) || (!candidateSlugKey.isBlank() && globalBySourceId.containsKey(candidateSlugKey)))) {
                skipped++;
                continue;
            }

            if (target != null && !isInsertNew) {
                // Update in place (default "UPDATE" / "UPSERT")
                target.setCategory("DSA");
                target.setExecutionMode(executionMode);
                target.setTitle(title);
                if (statement != null && !statement.isBlank()) target.setStatement(statement);
                target.setDifficulty(difficulty);
                if (topic != null && !topic.isBlank()) target.setTopic(topic);
                if (topics.length > 0) target.setTopics(topics);
                if (subtopics.length > 0) target.setSubtopics(subtopics);
                if (tags.length > 0) target.setTags(tags);
                if (companies.length > 0) target.setCompanies(companies);
                if (companyTags != null) target.setCompanyTags(companyTags);
                if (sourceUrl != null) target.setSourceUrl(sourceUrl);
                if (sampleInput != null) target.setSampleInput(sampleInput);
                if (sampleOutput != null) target.setSampleOutput(sampleOutput);
                if (methodName != null) target.setMethodName(methodName);
                if (returnType != null) target.setReturnType(returnType);
                if (!parameters.isEmpty()) target.setParameters(parameters);
                if (executionConfig != null) target.setExecutionConfig(executionConfig);
                if (testCasesJson != null) target.setTestCasesJson(testCasesJson);
                if (explanation != null) target.setExplanation(explanation);
                if (!templates.isEmpty()) target.setTemplates(templates);
                target.setTimeLimitMs(timeLimitMs);
                target.setMemoryLimitMb(memoryLimitMb);
                target.setAcceptanceRate(acceptanceRate);
                target.setActive(active);
                populateDsaExamplesAndConstraints(target, item);
                CodingProblem saved = codingProblemRepository.saveAndFlush(target);
                if (saved.getSourceQuestionId() != null) {
                    globalBySourceId.put(saved.getSourceQuestionId().trim().toLowerCase(), saved);
                    bySourceId.put(saved.getSourceQuestionId().trim().toLowerCase(), saved);
                }
                byNormalizedTitle.put(normalizeTitle(title), saved);
                updated++;
            } else {
                // Insert new: guarantee unique sourceQuestionId against global index
                String baseSlug = candidateSlugKey.isBlank() ? "dsa-problem-" + (i + 1) : candidateSlugKey;
                String uniqueSlug = baseSlug;
                int suffix = 1;
                while (globalBySourceId.containsKey(uniqueSlug)) {
                    uniqueSlug = baseSlug + "-" + suffix;
                    suffix++;
                }
                sourceQuestionId = uniqueSlug;

                CodingProblem newProblem = CodingProblem.builder()
                        .category("DSA")
                        .executionMode(executionMode)
                        .sourceQuestionId(sourceQuestionId)
                        .title(title)
                        .statement(statement)
                        .difficulty(difficulty)
                        .topic(topic)
                        .topics(topics)
                        .subtopics(subtopics)
                        .tags(tags)
                        .companies(companies)
                        .companyTags(companyTags)
                        .sourceUrl(sourceUrl)
                        .sampleInput(sampleInput)
                        .sampleOutput(sampleOutput)
                        .methodName(methodName)
                        .returnType(returnType)
                        .parameters(!parameters.isEmpty() ? parameters : new ArrayList<>())
                        .executionConfig(executionConfig)
                        .testCasesJson(testCasesJson != null ? testCasesJson : "[]")
                        .explanation(explanation)
                        .templates(templates)
                        .timeLimitMs(timeLimitMs)
                        .memoryLimitMb(memoryLimitMb)
                        .acceptanceRate(acceptanceRate)
                        .active(active)
                        .build();
                CodingProblem saved = codingProblemRepository.save(newProblem);
                populateDsaExamplesAndConstraints(saved, item);
                saved = codingProblemRepository.saveAndFlush(saved);
                globalBySourceId.put(uniqueSlug, saved);
                bySourceId.put(uniqueSlug, saved);
                byNormalizedTitle.put(normalizeTitle(title), saved);
                inserted++;
            }
        }

        int duplicatesRemoved = 0;
        try {
            duplicatesRemoved = deduplicateCategory("DSA");
        } catch (Exception ex) {
            log.warn("Deduplication after DSA seed encountered warning: {}", ex.getMessage());
        }

        return SeedImportResult.builder()
                .category("DSA")
                .totalProcessed(items.size())
                .inserted(inserted)
                .updated(updated)
                .skipped(skipped)
                .duplicatesRemoved(duplicatesRemoved)
                .message("Successfully processed " + items.size() + " DSA questions (" + inserted + " inserted, " + updated + " updated, " + skipped + " skipped, " + duplicatesRemoved + " duplicates removed).")
                .build();
    }

    @Transactional
    public SeedImportResult importDsa(JsonNode rootNode) {
        return importDsa(rootNode, "UPDATE");
    }

    /**
     * Imports SQL questions from flexible JSON array or object.
     */
    @Transactional
    public SeedImportResult importSql(JsonNode rootNode, String duplicateStrategy) {
        List<JsonNode> items = extractItems(rootNode);
        int inserted = 0;
        int updated = 0;
        int skipped = 0;

        List<CodingProblem> allExisting = codingProblemRepository.findAll();
        Map<String, CodingProblem> globalBySourceId = new HashMap<>();
        Map<String, CodingProblem> bySourceId = new HashMap<>();
        Map<String, CodingProblem> byNormalizedTitle = new HashMap<>();

        for (CodingProblem p : allExisting) {
            if (p.getSourceQuestionId() != null && !p.getSourceQuestionId().isBlank()) {
                globalBySourceId.put(p.getSourceQuestionId().trim().toLowerCase(), p);
            }
            if ("SQL".equalsIgnoreCase(p.getCategory())) {
                if (p.getSourceQuestionId() != null && !p.getSourceQuestionId().isBlank()) {
                    bySourceId.put(p.getSourceQuestionId().trim().toLowerCase(), p);
                }
                if (p.getTitle() != null && !p.getTitle().isBlank()) {
                    byNormalizedTitle.put(normalizeTitle(p.getTitle()), p);
                }
            }
        }

        for (int i = 0; i < items.size(); i++) {
            JsonNode item = items.get(i);
            String title = extractTitle(item);
            if (title == null || title.isBlank()) {
                title = "SQL Query #" + (i + 1);
            }

            String sourceQuestionId = extractText(item, "sourceQuestionId", "slug", "id");
            if (sourceQuestionId == null || sourceQuestionId.isBlank()) {
                sourceQuestionId = normalizeSlug(title);
            }
            String candidateSlugKey = (sourceQuestionId != null && !sourceQuestionId.isBlank())
                    ? sourceQuestionId.trim().toLowerCase()
                    : normalizeSlug(title);

            String statement = extractStatement(item);
            if (statement == null || statement.isBlank()) {
                statement = title;
            }
            Difficulty difficulty = extractDifficulty(item);
            String[] topics = extractStringArray(item, "topics");
            String[] subtopics = extractStringArray(item, "subtopics");
            String[] tags = extractStringArray(item, "tags");
            String[] companies = extractStringArray(item, "companies");
            String sourceUrl = extractText(item, "sourceUrl", "url", "link");
            String starterQuery = extractText(item, "starterQuery", "starterCode", "starter_query", "solution", "initialQuery");
            String explanation = extractText(item, "explanation", "notes");
            String executionConfig = extractSerialized(item, "executionConfig", "execution");
            String testCasesJson = extractSerialized(item, "testCasesJson", "testCases", "test_cases");
            boolean active = item.has("active") ? item.get("active").asBoolean(true) : true;

            CodingProblem target = null;
            if (!candidateSlugKey.isBlank()) {
                target = bySourceId.get(candidateSlugKey);
            }
            if (target == null) {
                target = byNormalizedTitle.get(normalizeTitle(title));
            }
            if (target == null && !candidateSlugKey.isBlank()) {
                target = globalBySourceId.get(candidateSlugKey);
            }

            boolean isSkip = "SKIP".equalsIgnoreCase(duplicateStrategy);
            boolean isInsertNew = "INSERT_NEW".equalsIgnoreCase(duplicateStrategy) || "ALLOW".equalsIgnoreCase(duplicateStrategy);

            if (isSkip && (target != null || byNormalizedTitle.containsKey(normalizeTitle(title)) || (!candidateSlugKey.isBlank() && globalBySourceId.containsKey(candidateSlugKey)))) {
                skipped++;
                continue;
            }

            if (target != null && !isInsertNew) {
                // Update in place
                target.setCategory("SQL");
                target.setExecutionMode(ExecutionMode.SQL);
                target.setTitle(title);
                if (statement != null && !statement.isBlank()) target.setStatement(statement);
                target.setDifficulty(difficulty);
                if (topics.length > 0) target.setTopics(topics);
                if (subtopics.length > 0) target.setSubtopics(subtopics);
                if (tags.length > 0) target.setTags(tags);
                if (companies.length > 0) target.setCompanies(companies);
                if (sourceUrl != null) target.setSourceUrl(sourceUrl);
                if (executionConfig != null) target.setExecutionConfig(executionConfig);
                if (testCasesJson != null) target.setTestCasesJson(testCasesJson);
                if (starterQuery != null) target.setStarterQuery(starterQuery);
                if (explanation != null) target.setExplanation(explanation);
                target.setActive(active);
                CodingProblem saved = sqlProblemRepository.save(target);
                if (saved.getSourceQuestionId() != null) {
                    globalBySourceId.put(saved.getSourceQuestionId().trim().toLowerCase(), saved);
                    bySourceId.put(saved.getSourceQuestionId().trim().toLowerCase(), saved);
                }
                byNormalizedTitle.put(normalizeTitle(title), saved);
                updated++;
            } else {
                // Insert new: guarantee unique sourceQuestionId against global index
                String baseSlug = candidateSlugKey.isBlank() ? "sql-problem-" + (i + 1) : candidateSlugKey;
                String uniqueSlug = baseSlug;
                int suffix = 1;
                while (globalBySourceId.containsKey(uniqueSlug)) {
                    uniqueSlug = baseSlug + "-" + suffix;
                    suffix++;
                }
                sourceQuestionId = uniqueSlug;

                CodingProblem newProblem = CodingProblem.builder()
                        .category("SQL")
                        .executionMode(ExecutionMode.SQL)
                        .sourceQuestionId(sourceQuestionId)
                        .title(title)
                        .statement(statement)
                        .difficulty(difficulty)
                        .topics(topics)
                        .subtopics(subtopics)
                        .tags(tags)
                        .companies(companies)
                        .sourceUrl(sourceUrl)
                        .executionConfig(executionConfig)
                        .testCasesJson(testCasesJson != null ? testCasesJson : "[]")
                        .starterQuery(starterQuery)
                        .explanation(explanation)
                        .active(active)
                        .build();
                CodingProblem saved = sqlProblemRepository.save(newProblem);
                globalBySourceId.put(uniqueSlug, saved);
                bySourceId.put(uniqueSlug, saved);
                byNormalizedTitle.put(normalizeTitle(title), saved);
                inserted++;
            }
        }

        int duplicatesRemoved = 0;
        try {
            duplicatesRemoved = deduplicateCategory("SQL");
        } catch (Exception ex) {
            log.warn("Deduplication after SQL seed encountered warning: {}", ex.getMessage());
        }

        return SeedImportResult.builder()
                .category("SQL")
                .totalProcessed(items.size())
                .inserted(inserted)
                .updated(updated)
                .skipped(skipped)
                .duplicatesRemoved(duplicatesRemoved)
                .message("Successfully processed " + items.size() + " SQL questions (" + inserted + " inserted, " + updated + " updated, " + skipped + " skipped, " + duplicatesRemoved + " duplicates removed).")
                .build();
    }

    @Transactional
    public SeedImportResult importSql(JsonNode rootNode) {
        return importSql(rootNode, "UPDATE");
    }

    /**
     * Imports DataFrame questions from flexible JSON array or object.
     */
    @Transactional
    public SeedImportResult importDataFrame(JsonNode rootNode, String duplicateStrategy) {
        List<JsonNode> items = extractItems(rootNode);
        int inserted = 0;
        int updated = 0;
        int skipped = 0;

        List<CodingProblem> allExisting = codingProblemRepository.findAll();
        Map<String, CodingProblem> globalBySourceId = new HashMap<>();
        Map<String, CodingProblem> bySourceId = new HashMap<>();
        Map<String, CodingProblem> byNormalizedTitle = new HashMap<>();

        for (CodingProblem p : allExisting) {
            if (p.getSourceQuestionId() != null && !p.getSourceQuestionId().isBlank()) {
                globalBySourceId.put(p.getSourceQuestionId().trim().toLowerCase(), p);
            }
            if ("DATAFRAME".equalsIgnoreCase(p.getCategory())) {
                if (p.getSourceQuestionId() != null && !p.getSourceQuestionId().isBlank()) {
                    bySourceId.put(p.getSourceQuestionId().trim().toLowerCase(), p);
                }
                if (p.getTitle() != null && !p.getTitle().isBlank()) {
                    byNormalizedTitle.put(normalizeTitle(p.getTitle()), p);
                }
            }
        }

        for (int i = 0; i < items.size(); i++) {
            JsonNode item = items.get(i);
            String title = extractTitle(item);
            if (title == null || title.isBlank()) {
                title = "DataFrame Challenge #" + (i + 1);
            }

            String sourceQuestionId = extractText(item, "sourceQuestionId", "slug", "id");
            if (sourceQuestionId == null || sourceQuestionId.isBlank()) {
                sourceQuestionId = normalizeSlug(title);
            }
            String candidateSlugKey = (sourceQuestionId != null && !sourceQuestionId.isBlank())
                    ? sourceQuestionId.trim().toLowerCase()
                    : normalizeSlug(title);

            String statement = extractStatement(item);
            if (statement == null || statement.isBlank()) {
                statement = title;
            }
            Difficulty difficulty = extractDifficulty(item);
            String[] topics = extractStringArray(item, "topics");
            String[] subtopics = extractStringArray(item, "subtopics");
            String[] tags = extractStringArray(item, "tags");
            String[] companies = extractStringArray(item, "companies");
            String sourceUrl = extractText(item, "sourceUrl", "url", "link");
            String starterCode = extractText(item, "starterCode", "starter_code", "starterQuery", "solution");
            String explanation = extractText(item, "explanation", "notes");
            String executionConfig = extractSerialized(item, "executionConfig", "execution");
            String testCasesJson = extractSerialized(item, "testCasesJson", "testCases", "test_cases");
            boolean active = item.has("active") ? item.get("active").asBoolean(true) : true;

            CodingProblem target = null;
            if (!candidateSlugKey.isBlank()) {
                target = bySourceId.get(candidateSlugKey);
            }
            if (target == null) {
                target = byNormalizedTitle.get(normalizeTitle(title));
            }
            if (target == null && !candidateSlugKey.isBlank()) {
                target = globalBySourceId.get(candidateSlugKey);
            }

            boolean isSkip = "SKIP".equalsIgnoreCase(duplicateStrategy);
            boolean isInsertNew = "INSERT_NEW".equalsIgnoreCase(duplicateStrategy) || "ALLOW".equalsIgnoreCase(duplicateStrategy);

            if (isSkip && (target != null || byNormalizedTitle.containsKey(normalizeTitle(title)) || (!candidateSlugKey.isBlank() && globalBySourceId.containsKey(candidateSlugKey)))) {
                skipped++;
                continue;
            }

            if (target != null && !isInsertNew) {
                // Update in place
                target.setCategory("DATAFRAME");
                target.setExecutionMode(ExecutionMode.DATAFRAME);
                target.setTitle(title);
                if (statement != null && !statement.isBlank()) target.setStatement(statement);
                target.setDifficulty(difficulty);
                if (topics.length > 0) target.setTopics(topics);
                if (subtopics.length > 0) target.setSubtopics(subtopics);
                if (tags.length > 0) target.setTags(tags);
                if (companies.length > 0) target.setCompanies(companies);
                if (sourceUrl != null) target.setSourceUrl(sourceUrl);
                if (executionConfig != null) target.setExecutionConfig(executionConfig);
                if (testCasesJson != null) target.setTestCasesJson(testCasesJson);
                if (starterCode != null) target.setStarterQuery(starterCode);
                if (explanation != null) target.setExplanation(explanation);
                target.setActive(active);
                CodingProblem saved = dataFrameProblemRepository.save(target);
                if (saved.getSourceQuestionId() != null) {
                    globalBySourceId.put(saved.getSourceQuestionId().trim().toLowerCase(), saved);
                    bySourceId.put(saved.getSourceQuestionId().trim().toLowerCase(), saved);
                }
                byNormalizedTitle.put(normalizeTitle(title), saved);
                updated++;
            } else {
                // Insert new: guarantee unique sourceQuestionId against global index
                String baseSlug = candidateSlugKey.isBlank() ? "df-problem-" + (i + 1) : candidateSlugKey;
                String uniqueSlug = baseSlug;
                int suffix = 1;
                while (globalBySourceId.containsKey(uniqueSlug)) {
                    uniqueSlug = baseSlug + "-" + suffix;
                    suffix++;
                }
                sourceQuestionId = uniqueSlug;

                CodingProblem newProblem = CodingProblem.builder()
                        .category("DATAFRAME")
                        .executionMode(ExecutionMode.DATAFRAME)
                        .sourceQuestionId(sourceQuestionId)
                        .title(title)
                        .statement(statement)
                        .difficulty(difficulty)
                        .topics(topics)
                        .subtopics(subtopics)
                        .tags(tags)
                        .companies(companies)
                        .sourceUrl(sourceUrl)
                        .executionConfig(executionConfig)
                        .testCasesJson(testCasesJson != null ? testCasesJson : "[]")
                        .starterQuery(starterCode)
                        .explanation(explanation)
                        .active(active)
                        .build();
                CodingProblem saved = dataFrameProblemRepository.save(newProblem);
                globalBySourceId.put(uniqueSlug, saved);
                bySourceId.put(uniqueSlug, saved);
                byNormalizedTitle.put(normalizeTitle(title), saved);
                inserted++;
            }
        }

        int duplicatesRemoved = 0;
        try {
            duplicatesRemoved = deduplicateCategory("DATAFRAME");
        } catch (Exception ex) {
            log.warn("Deduplication after DataFrame seed encountered warning: {}", ex.getMessage());
        }

        return SeedImportResult.builder()
                .category("DATAFRAME")
                .totalProcessed(items.size())
                .inserted(inserted)
                .updated(updated)
                .skipped(skipped)
                .duplicatesRemoved(duplicatesRemoved)
                .message("Successfully processed " + items.size() + " DataFrame questions (" + inserted + " inserted, " + updated + " updated, " + skipped + " skipped, " + duplicatesRemoved + " duplicates removed).")
                .build();
    }

    @Transactional
    public SeedImportResult importDataFrame(JsonNode rootNode) {
        return importDataFrame(rootNode, "UPDATE");
    }

    /**
     * Removes duplicate problems for a category by preserving the best record in each group:
     * - Preserves the one with submissions if any
     * - Preserves the one with non-empty test cases or execution config
     * - Preserves the lowest ID
     * - Soft-archives duplicates by deactivating and suffixing the slug, preventing unique constraint conflicts and FK errors.
     */
    @Transactional
    public int deduplicateCategory(String category) {
        List<CodingProblem> all;
        if ("SQL".equalsIgnoreCase(category)) {
            all = sqlProblemRepository.findAllByCategory("SQL");
        } else if ("DATAFRAME".equalsIgnoreCase(category)) {
            all = dataFrameProblemRepository.findAllByCategory("DATAFRAME");
        } else {
            // DSA category
            all = codingProblemRepository.findAll().stream()
                    .filter(p -> p.getCategory() == null || "DSA".equalsIgnoreCase(p.getCategory())
                            || (!"SQL".equalsIgnoreCase(p.getCategory()) && !"DATAFRAME".equalsIgnoreCase(p.getCategory())))
                    .toList();
        }

        Map<String, List<CodingProblem>> groups = new LinkedHashMap<>();
        for (CodingProblem p : all) {
            String key = normalizeTitle(p.getTitle());
            if (key.isBlank() && p.getSourceQuestionId() != null) {
                key = p.getSourceQuestionId().trim().toLowerCase();
            }
            if (!key.isBlank()) {
                groups.computeIfAbsent(key, k -> new ArrayList<>()).add(p);
            }
        }

        int removed = 0;
        for (Map.Entry<String, List<CodingProblem>> entry : groups.entrySet()) {
            List<CodingProblem> group = entry.getValue();
            if (group.size() <= 1) continue;

            // Pick the best one to keep
            CodingProblem keep = group.stream().min((a, b) -> {
                long subsA = submissionRepository.countByProblem_Id(a.getId());
                long subsB = submissionRepository.countByProblem_Id(b.getId());
                if (subsA != subsB) return Long.compare(subsB, subsA); // higher submissions first

                int lenA = (a.getTestCasesJson() != null ? a.getTestCasesJson().length() : 0) + (a.getExecutionConfig() != null ? a.getExecutionConfig().length() : 0);
                int lenB = (b.getTestCasesJson() != null ? b.getTestCasesJson().length() : 0) + (b.getExecutionConfig() != null ? b.getExecutionConfig().length() : 0);
                if (lenA != lenB) return Integer.compare(lenB, lenA); // more data first

                return Long.compare(a.getId(), b.getId()); // lowest id first
            }).orElse(group.get(0));

            for (CodingProblem p : group) {
                if (!p.getId().equals(keep.getId())) {
                    p.setActive(false);
                    if (p.getSourceQuestionId() != null && !p.getSourceQuestionId().contains("-archived-")) {
                        p.setSourceQuestionId(p.getSourceQuestionId() + "-archived-" + p.getId());
                    } else if (p.getSourceQuestionId() == null) {
                        p.setSourceQuestionId("archived-" + p.getId());
                    }
                    try {
                        codingProblemRepository.saveAndFlush(p);
                        removed++;
                    } catch (Exception ex) {
                        log.warn("Could not archive duplicate problem id {}: {}", p.getId(), ex.getMessage());
                    }
                }
            }
        }

        log.info("Deduplication for {}: removed/archived {} duplicate records.", category, removed);
        return removed;
    }

    private List<JsonNode> extractItems(JsonNode root) {
        List<JsonNode> result = new ArrayList<>();
        if (root == null || root.isNull()) return result;

        if (root.isArray()) {
            for (JsonNode elem : root) {
                if (elem != null && !elem.isNull()) result.add(elem);
            }
        } else if (root.isObject()) {
            String[] arrayKeys = {"problems", "questions", "data", "items", "content", "rows"};
            boolean found = false;
            for (String key : arrayKeys) {
                if (root.has(key) && root.get(key).isArray()) {
                    for (JsonNode elem : root.get(key)) {
                        if (elem != null && !elem.isNull()) result.add(elem);
                    }
                    found = true;
                    break;
                }
            }
            if (!found) {
                result.add(root);
            }
        }
        return result;
    }

    private String extractTitle(JsonNode item) {
        return extractText(item, "title", "name", "question", "problemName", "problem_title");
    }

    private String extractStatement(JsonNode item) {
        return extractText(item, "problemStatement", "statement", "description", "question", "prompt", "body", "content");
    }

    private String extractDsaStatement(JsonNode item, String title) {
        String stmt = extractStatement(item);
        if (stmt != null && !stmt.isBlank()) return stmt;
        return title != null ? title : "Problem statement not provided.";
    }

    private String extractText(JsonNode item, String... keys) {
        for (String k : keys) {
            if (item.has(k) && !item.get(k).isNull()) {
                String val = item.get(k).asText();
                if (val != null && !val.isBlank()) {
                    return val.trim();
                }
            }
        }
        return null;
    }

    private Difficulty extractDifficulty(JsonNode item) {
        String val = extractText(item, "difficulty", "level");
        if (val == null) return Difficulty.MEDIUM;
        try {
            return Difficulty.valueOf(val.trim().toUpperCase());
        } catch (Exception ignored) {
            return Difficulty.MEDIUM;
        }
    }

    private String[] extractStringArray(JsonNode item, String key) {
        if (!item.has(key) || item.get(key).isNull()) {
            return new String[0];
        }
        JsonNode node = item.get(key);
        if (node.isArray()) {
            List<String> list = new ArrayList<>();
            for (JsonNode n : node) {
                if (n != null && !n.isNull() && !n.asText().isBlank()) {
                    list.add(n.asText().trim());
                }
            }
            return list.toArray(new String[0]);
        } else if (node.isTextual() && !node.asText().isBlank()) {
            return Arrays.stream(node.asText().split(","))
                    .map(String::trim)
                    .filter(s -> !s.isEmpty())
                    .toArray(String[]::new);
        }
        return new String[0];
    }

    private String extractSerialized(JsonNode item, String... keys) {
        for (String k : keys) {
            if (item.has(k) && !item.get(k).isNull()) {
                JsonNode n = item.get(k);
                if (n.isTextual()) {
                    return n.asText();
                } else {
                    try {
                        return objectMapper.writeValueAsString(n);
                    } catch (JsonProcessingException e) {
                        return n.toString();
                    }
                }
            }
        }
        return null;
    }

    private Map<String, String> extractTemplates(JsonNode item) {
        Map<String, String> map = new HashMap<>();
        if (item.has("templates") && item.get("templates").isObject()) {
            JsonNode tNode = item.get("templates");
            tNode.fieldNames().forEachRemaining(k -> {
                if (tNode.get(k).isTextual()) {
                    map.put(k, tNode.get(k).asText());
                }
            });
        }
        return map;
    }

    private Integer extractInt(JsonNode item, int fallback, String... keys) {
        for (String k : keys) {
            if (item.has(k) && !item.get(k).isNull()) {
                if (item.get(k).isNumber()) return item.get(k).asInt();
                try {
                    return Integer.parseInt(item.get(k).asText().trim());
                } catch (Exception ignored) {}
            }
        }
        return fallback;
    }

    private Double extractDouble(JsonNode item, double fallback, String... keys) {
        for (String k : keys) {
            if (item.has(k) && !item.get(k).isNull()) {
                if (item.get(k).isNumber()) return item.get(k).asDouble();
                try {
                    return Double.parseDouble(item.get(k).asText().trim());
                } catch (Exception ignored) {}
            }
        }
        return fallback;
    }

    private String deriveMethodName(String title) {
        if (title == null || title.isBlank()) return "solve";
        String clean = title.replaceAll("[^a-zA-Z0-9 ]", " ").trim();
        if (clean.isBlank()) return "solve";
        String[] words = clean.split("\\s+");
        if (words.length == 0) return "solve";
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < words.length; i++) {
            String w = words[i].toLowerCase();
            if (w.isEmpty()) continue;
            if (sb.length() == 0) {
                if (Character.isDigit(w.charAt(0))) {
                    sb.append("solve").append(Character.toUpperCase(w.charAt(0))).append(w.substring(1));
                } else {
                    sb.append(w);
                }
            } else {
                sb.append(Character.toUpperCase(w.charAt(0))).append(w.substring(1));
            }
        }
        return sb.length() > 0 ? sb.toString() : "solve";
    }

    private String deriveReturnType(JsonNode item) {
        String val = extractText(item, "returnType", "return_type", "type", "outputType", "output_type");
        if (val != null && !val.isBlank()) return val.trim();
        String sampleOutput = extractText(item, "sampleOutput", "sample_output", "output");
        if (sampleOutput != null) {
            String trimmed = sampleOutput.trim();
            if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
                return "int[]";
            }
            if ("true".equalsIgnoreCase(trimmed) || "false".equalsIgnoreCase(trimmed)) {
                return "boolean";
            }
            if (trimmed.matches("^-?\\d+$")) {
                return "int";
            }
            if (trimmed.matches("^-?\\d*\\.\\d+$")) {
                return "double";
            }
            if (trimmed.startsWith("\"") && trimmed.endsWith("\"")) {
                return "String";
            }
        }
        return "int";
    }

    private String normalizeSlug(String title) {
        if (title == null) return "problem-" + System.currentTimeMillis();
        String slug = title.toLowerCase().replaceAll("[^a-z0-9]+", "-").replaceAll("^-|-$", "");
        return slug.isBlank() ? "problem-" + System.currentTimeMillis() : slug;
    }

    private String normalizeTitle(String title) {
        if (title == null) return "";
        return title.trim().toLowerCase().replaceAll("[^a-z0-9]", "");
    }

    private void populateDsaExamplesAndConstraints(CodingProblem problem, JsonNode item) {
        if (item.has("testCases") && item.get("testCases").isArray() && !item.get("testCases").isEmpty()) {
            problem.getExamples().clear();
            JsonNode tcs = item.get("testCases");
            int max = Math.min(3, tcs.size());
            for (int i = 0; i < max; i++) {
                JsonNode tc = tcs.get(i);
                String inStr = formatJsonValue(tc.get("input"));
                String outStr = formatJsonValue(tc.get("expectedOutput"));
                String exp = tc.has("explanation") && !tc.get("explanation").isNull() ? tc.get("explanation").asText() : null;
                problem.getExamples().add(ProblemExample.builder()
                        .problem(problem)
                        .ordinal(i)
                        .title("Example " + (i + 1))
                        .input(inStr)
                        .output(outStr)
                        .explanation(exp)
                        .hidden(false)
                        .build());
                if (i == 0) {
                    problem.setSampleInput(inStr);
                    problem.setSampleOutput(outStr);
                }
            }
        } else if (item.has("examples") && item.get("examples").isArray() && !item.get("examples").isEmpty()) {
            problem.getExamples().clear();
            JsonNode exs = item.get("examples");
            for (int i = 0; i < exs.size(); i++) {
                JsonNode ex = exs.get(i);
                String title = ex.has("title") ? ex.get("title").asText() : ("Example " + (i + 1));
                String inStr = ex.has("input") ? (ex.get("input").isTextual() ? ex.get("input").asText() : ex.get("input").toString()) : "";
                String outStr = ex.has("output") ? (ex.get("output").isTextual() ? ex.get("output").asText() : ex.get("output").toString()) : "";
                String exp = ex.has("explanation") && !ex.get("explanation").isNull() ? ex.get("explanation").asText() : null;
                problem.getExamples().add(ProblemExample.builder()
                        .problem(problem)
                        .ordinal(i)
                        .title(title)
                        .input(inStr)
                        .output(outStr)
                        .explanation(exp)
                        .hidden(false)
                        .build());
                if (i == 0 && (problem.getSampleInput() == null || problem.getSampleInput().isBlank())) {
                    problem.setSampleInput(inStr);
                    problem.setSampleOutput(outStr);
                }
            }
        }

        if (item.has("constraints") && item.get("constraints").isArray() && !item.get("constraints").isEmpty()) {
            problem.getConstraints().clear();
            JsonNode cs = item.get("constraints");
            for (int i = 0; i < cs.size(); i++) {
                String text = cs.get(i).asText();
                if (text != null && !text.isBlank()) {
                    problem.getConstraints().add(ProblemConstraint.builder()
                            .problem(problem)
                            .ordinal(i)
                            .text(text.trim())
                            .build());
                }
            }
        }
    }

    private String formatJsonValue(JsonNode node) {
        if (node == null || node.isNull()) return "";
        if (node.isTextual()) return node.asText();
        if (node.isNumber() || node.isBoolean()) return node.asText();
        if (node.isObject()) {
            StringBuilder sb = new StringBuilder();
            Iterator<Map.Entry<String, JsonNode>> fields = node.fields();
            while (fields.hasNext()) {
                Map.Entry<String, JsonNode> entry = fields.next();
                if (sb.length() > 0) sb.append(", ");
                sb.append(entry.getKey()).append(" = ").append(formatJsonValue(entry.getValue()));
            }
            return sb.toString();
        }
        return node.toString();
    }

    private static void parseJavaTemplateSignature(
            String javaTemplate,
            List<ParameterSpec> parameters,
            String[] methodAndReturn) {
        if (javaTemplate == null || javaTemplate.isBlank()) return;
        Pattern pattern = Pattern.compile("(?:public|protected|private)?\\s*(?:static)?\\s*([\\w<>\\[\\],]+)\\s+([a-zA-Z_]\\w*)\\s*\\(([^)]*)\\)");
        Matcher matcher = pattern.matcher(javaTemplate);
        while (matcher.find()) {
            String ret = matcher.group(1).trim();
            String name = matcher.group(2).trim();
            String rawParams = matcher.group(3).trim();

            if ("Solution".equals(name) || "Main".equals(name) || "main".equals(name) || "class".equals(ret)) {
                continue;
            }

            if (methodAndReturn[0] == null || methodAndReturn[0].isBlank() || "solve".equalsIgnoreCase(methodAndReturn[0])) {
                methodAndReturn[0] = name;
            }
            if (methodAndReturn[1] == null || methodAndReturn[1].isBlank() || "void".equalsIgnoreCase(methodAndReturn[1])) {
                methodAndReturn[1] = ret;
            }

            if (parameters.isEmpty() && !rawParams.isEmpty()) {
                for (String part : splitTopLevel(rawParams)) {
                    String p = part.trim();
                    if (p.isEmpty()) continue;
                    int lastSpace = p.lastIndexOf(' ');
                    if (lastSpace > 0) {
                        String pType = p.substring(0, lastSpace).trim();
                        String pName = p.substring(lastSpace + 1).trim();
                        parameters.add(new ParameterSpec(pName, pType, pName));
                    }
                }
            }
            break;
        }
    }

    private static List<String> splitTopLevel(String raw) {
        List<String> out = new ArrayList<>();
        if (raw == null || raw.isBlank()) return out;
        int depth = 0;
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < raw.length(); i++) {
            char c = raw.charAt(i);
            if (c == '<' || c == '[' || c == '(') depth++;
            else if (c == '>' || c == ']' || c == ')') depth--;
            else if (c == ',' && depth == 0) {
                out.add(sb.toString().trim());
                sb.setLength(0);
                continue;
            }
            sb.append(c);
        }
        if (sb.length() > 0) {
            out.add(sb.toString().trim());
        }
        return out;
    }
}

