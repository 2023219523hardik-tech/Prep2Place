package com.placement.config;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.placement.entity.CodingProblem;
import com.placement.entity.Difficulty;
import com.placement.entity.ExecutionMode;
import com.placement.entity.ParameterSpec;
import com.placement.entity.ProblemConstraint;
import com.placement.entity.ProblemExample;
import com.placement.questionbank.config.CompanyVaultProperties;
import com.placement.repository.CodingProblemRepository;
import lombok.Getter;
import lombok.Setter;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.core.io.Resource;
import org.springframework.core.io.ResourceLoader;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

import java.io.InputStream;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@Slf4j
@Component
@Order(14)
public class LeetCodeCodingProblemSeedLoader implements CommandLineRunner {

    private final CompanyVaultProperties companyVaultProperties;
    private final CodingProblemRepository codingProblemRepository;
    private final ResourceLoader resourceLoader;
    private final TransactionTemplate transactionTemplate;

    @org.springframework.beans.factory.annotation.Autowired
    public LeetCodeCodingProblemSeedLoader(
            CompanyVaultProperties companyVaultProperties,
            CodingProblemRepository codingProblemRepository,
            ResourceLoader resourceLoader,
            TransactionTemplate transactionTemplate) {
        this.companyVaultProperties = companyVaultProperties;
        this.codingProblemRepository = codingProblemRepository;
        this.resourceLoader = resourceLoader;
        this.transactionTemplate = transactionTemplate;
    }

    /**
     * Backward-compatible constructor for existing unit tests that instantiate
     * the loader with the original three dependencies. Production Spring
     * injection uses the generated four-argument constructor.
     */
    public LeetCodeCodingProblemSeedLoader(
            CompanyVaultProperties companyVaultProperties,
            CodingProblemRepository codingProblemRepository,
            ResourceLoader resourceLoader) {
        this(companyVaultProperties, codingProblemRepository, resourceLoader, null);
    }

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    public void run(String... args) {
        try {
            runInternal();
        } catch (Exception e) {
            log.error("LeetCode CodingProblem seed loader failed: {}", rootMessage(e), e);
        }
    }

    private void runInternal() {
        String path = companyVaultProperties.getSeedJsonPath();
        Resource resource = resolve(path);
        if (resource == null || !resource.exists()) {
            log.info("LeetCode seed JSON not found at '{}' - skipping CodingProblem pool seed.", path);
            return;
        }

        List<SeedEntry> entries;
        try (InputStream in = resource.getInputStream()) {
            entries = objectMapper.readValue(in,
                    objectMapper.getTypeFactory().constructCollectionType(List.class, SeedEntry.class));
        } catch (Exception e) {
            log.warn("Failed to parse LeetCode seed JSON '{}': {}", path, e.getMessage());
            return;
        }

        int created = 0, updated = 0, skipped = 0;
        for (SeedEntry entry : entries) {
        if (entry.getSourceQuestionId() == null || entry.getSourceQuestionId().isBlank()
                || entry.getTitle() == null || entry.getTitle().isBlank()) {
                skipped++;
                continue;
            }
            try {
                boolean isNew = upsertInNewTransaction(entry);
                if (isNew) created++; else updated++;
            } catch (Exception e) {
                skipped++;
                log.warn("Skipping LeetCode seed entry sourceQuestionId='{}', title='{}': {}",
                        entry.getSourceQuestionId(), entry.getTitle(), rootMessage(e));
            }
        }
        log.info("LeetCode CodingProblem seed: {} total entries -> {} created, {} updated, {} skipped (sourceQuestionId upsert).",
                entries.size(), created, updated, skipped);

        deduplicateDsaProblems();
        enrichAllActiveDsaProblems();
    }

    private boolean upsertInNewTransaction(SeedEntry entry) {
        // Unit tests using the legacy three-argument constructor do not have a
        // TransactionTemplate. In production Spring always injects one.
        if (transactionTemplate == null) {
            return upsert(entry);
        }
        Boolean result = transactionTemplate.execute(status -> upsert(entry));
        return Boolean.TRUE.equals(result);
    }

    private boolean upsert(SeedEntry entry) {
        CodingProblem existingBySlug = codingProblemRepository.findBySourceQuestionId(entry.getSourceQuestionId()).orElse(null);
        CodingProblem existingByTitle = (entry.getTitle() != null && !entry.getTitle().isBlank())
                ? codingProblemRepository.findFirstByTitleIgnoreCase(entry.getTitle().trim()).orElse(null)
                : null;

        CodingProblem problem;
        boolean isNew;
        if (existingBySlug != null && existingByTitle != null && !existingBySlug.getId().equals(existingByTitle.getId())) {
            CodingProblem keep = existingByTitle.getId() < existingBySlug.getId() ? existingByTitle : existingBySlug;
            CodingProblem dup = keep == existingByTitle ? existingBySlug : existingByTitle;
            dup.setActive(false);
            dup.setSourceQuestionId(entry.getSourceQuestionId() + "-archived-" + dup.getId());
            codingProblemRepository.saveAndFlush(dup);
            problem = keep;
            isNew = false;
        } else if (existingBySlug != null) {
            problem = existingBySlug;
            isNew = false;
        } else if (existingByTitle != null) {
            problem = existingByTitle;
            isNew = false;
        } else {
            problem = new CodingProblem();
            isNew = true;
        }

        problem.setSourceQuestionId(entry.getSourceQuestionId());
        problem.setCategory("DSA");
        problem.setActive(true);

        String title = firstNonBlank(entry.getTitle(), entry.getSourceQuestionId());
        problem.setTitle(title);

        Difficulty difficulty = parseDifficulty(entry.getDifficulty());
        problem.setDifficulty(difficulty);

        String topic = deriveTopic(entry, title);
        problem.setTopic(topic);

        ProblemShape shape = deriveShape(title, entry);

        // Problem Statement: prefer rich problemStatement from seed if present
        String fullStatement = firstNonBlank(entry.getProblemStatement(), entry.getStatement());
        if (fullStatement != null && !fullStatement.isBlank()) {
            problem.setStatement(fullStatement);
        } else if (problem.getStatement() == null || problem.getStatement().isBlank() || problem.getStatement().startsWith("Solve the following problem:")) {
            problem.setStatement(shape.statement);
        }

        // Method signature & parameters: prefer execution block from seed if present
        String methodName = shape.methodName;
        String returnType = shape.returnType;
        List<ParameterSpec> parameters = shape.parameters;

        if (entry.getExecution() != null && entry.getExecution().containsKey("java")) {
            Object javaExecObj = entry.getExecution().get("java");
            if (javaExecObj instanceof Map<?, ?> javaMap) {
                if (javaMap.get("methodName") instanceof String m && !m.isBlank()) {
                    methodName = m;
                }
                if (javaMap.get("returnType") instanceof String r && !r.isBlank()) {
                    returnType = r;
                }
                if (javaMap.get("parameters") instanceof List<?> paramList) {
                    List<ParameterSpec> parsedParams = new ArrayList<>();
                    for (Object pObj : paramList) {
                        if (pObj instanceof Map<?, ?> pMap) {
                            Object nVal = pMap.get("name");
                            Object tVal = pMap.get("type");
                            Object sVal = pMap.get("structure");
                            String pName = nVal != null ? String.valueOf(nVal) : "arg";
                            String pType = tVal != null ? String.valueOf(tVal) : "int";
                            String pDoc = sVal != null ? String.valueOf(sVal) : pName;
                            parsedParams.add(new ParameterSpec(pName, pType, pDoc));
                        }
                    }
                    if (!parsedParams.isEmpty()) {
                        parameters = parsedParams;
                    }
                }
            }
        }

        problem.setMethodName(methodName);
        problem.setReturnType(returnType);
        problem.setParameters(parameters);
        problem.setTemplates(buildTemplates(methodName, returnType, parameters));
        problem.setExecutionMode(ExecutionMode.METHOD);

        if (problem.getTimeLimitMs() == null) problem.setTimeLimitMs(1000);
        if (problem.getMemoryLimitMb() == null) problem.setMemoryLimitMb(256);
        if (problem.getAcceptanceRate() == null) problem.setAcceptanceRate(56.4);

        problem.setCompanyTags(companyTags(entry));

        // Populate examples and constraints in place
        populateExamplesAndConstraints(problem, entry, shape);

        codingProblemRepository.saveAndFlush(problem);
        return isNew;
    }

    private void populateExamplesAndConstraints(CodingProblem problem, SeedEntry entry, ProblemShape shape) {
        // 1. Examples
        problem.getExamples().clear();
        int ord = 0;

        if (entry.getTestCases() != null && !entry.getTestCases().isEmpty()) {
            int maxExamples = Math.min(3, entry.getTestCases().size());
            for (int i = 0; i < maxExamples; i++) {
                Map<String, Object> tc = entry.getTestCases().get(i);
                String inStr = formatTestCaseInput(tc.get("input"));
                String outStr = formatTestCaseOutput(tc.get("expectedOutput"));
                String explanation = tc.get("explanation") instanceof String s ? s : null;

                problem.getExamples().add(ProblemExample.builder()
                        .problem(problem)
                        .ordinal(ord++)
                        .title("Example " + (i + 1))
                        .input(inStr)
                        .output(outStr)
                        .explanation(explanation)
                        .hidden(false)
                        .build());

                if (i == 0) {
                    problem.setSampleInput(inStr);
                    problem.setSampleOutput(outStr);
                }
            }
        } else if (entry.getExamples() != null && !entry.getExamples().isEmpty()) {
            for (int i = 0; i < entry.getExamples().size(); i++) {
                Map<String, Object> exMap = entry.getExamples().get(i);
                String title = exMap.get("title") instanceof String s ? s : ("Example " + (i + 1));
                String inStr = String.valueOf(exMap.getOrDefault("input", ""));
                String outStr = String.valueOf(exMap.getOrDefault("output", ""));
                String exp = exMap.get("explanation") instanceof String s ? s : null;

                problem.getExamples().add(ProblemExample.builder()
                        .problem(problem)
                        .ordinal(ord++)
                        .title(title)
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
        } else if (shape.sampleInput() != null || shape.sampleOutput() != null) {
            String sIn = shape.sampleInput() != null ? shape.sampleInput() : "";
            String sOut = shape.sampleOutput() != null ? shape.sampleOutput() : "";
            problem.getExamples().add(ProblemExample.builder()
                    .problem(problem)
                    .ordinal(ord++)
                    .title("Example 1")
                    .input(sIn)
                    .output(sOut)
                    .explanation(null)
                    .hidden(false)
                    .build());
            problem.setSampleInput(sIn);
            problem.setSampleOutput(sOut);
        }

        // 2. Constraints
        problem.getConstraints().clear();
        int cOrd = 0;
        if (entry.getConstraints() != null && !entry.getConstraints().isEmpty()) {
            for (String c : entry.getConstraints()) {
                if (c != null && !c.isBlank()) {
                    problem.getConstraints().add(ProblemConstraint.builder()
                            .problem(problem)
                            .ordinal(cOrd++)
                            .text(c)
                            .build());
                }
            }
        } else {
            List<String> defaults = deriveDefaultConstraints(problem);
            for (String c : defaults) {
                problem.getConstraints().add(ProblemConstraint.builder()
                        .problem(problem)
                        .ordinal(cOrd++)
                        .text(c)
                        .build());
            }
        }
    }

    private String formatTestCaseInput(Object inputObj) {
        if (inputObj == null) return "";
        if (inputObj instanceof Map<?, ?> map) {
            List<String> parts = new ArrayList<>();
            for (Map.Entry<?, ?> e : map.entrySet()) {
                String k = String.valueOf(e.getKey());
                String v = formatValue(e.getValue());
                parts.add(k + " = " + v);
            }
            return String.join(", ", parts);
        }
        return formatValue(inputObj);
    }

    private String formatTestCaseOutput(Object outputObj) {
        if (outputObj == null) return "";
        if (outputObj instanceof Map<?, ?> map) {
            if (map.containsKey("value")) {
                return formatValue(map.get("value"));
            }
        }
        return formatValue(outputObj);
    }

    private String formatValue(Object val) {
        if (val == null) return "null";
        try {
            return objectMapper.writeValueAsString(val);
        } catch (Exception e) {
            return String.valueOf(val);
        }
    }

    private List<String> deriveDefaultConstraints(CodingProblem problem) {
        List<String> constraints = new ArrayList<>();
        String topic = problem.getTopic() != null ? problem.getTopic().toLowerCase(Locale.ROOT) : "";
        boolean isMatrix = topic.contains("matrix") ||
                (problem.getParameters() != null && problem.getParameters().stream().anyMatch(p -> p.type().contains("[][]")));

        if (isMatrix) {
            constraints.add("1 <= m, n <= 100 where m is rows and n is columns");
            constraints.add("Matrix elements fit in a standard 32-bit signed integer or character range");
            constraints.add("Handle non-square and boundary edge cases gracefully");
        } else if (topic.contains("tree")) {
            constraints.add("The number of nodes in the tree is in the range [0, 5000]");
            constraints.add("-10^4 <= Node.val <= 10^4");
        } else if (topic.contains("list")) {
            constraints.add("The number of nodes in the list is in the range [0, 5000]");
            constraints.add("-10^4 <= Node.val <= 10^4");
        } else if (topic.contains("string")) {
            constraints.add("1 <= s.length <= 10^5");
            constraints.add("s consists of printable English characters");
        } else {
            constraints.add("1 <= nums.length <= 10^5");
            constraints.add("-10^9 <= nums[i] <= 10^9");
            constraints.add("Expected time complexity: O(n) or O(n log n)");
        }
        return constraints;
    }

    private static String rootMessage(Throwable throwable) {
        Throwable current = throwable;
        Throwable last = throwable;
        while (current != null) {
            last = current;
            current = current.getCause();
        }
        String message = last.getMessage();
        return message == null || message.isBlank()
                ? last.getClass().getSimpleName()
                : message;
    }

    // -------- Source-file resolution --------

    private Resource resolve(String path) {
        if (path == null) return null;
        List<String> candidates = new ArrayList<>();
        candidates.add(path);
        if (path.contains("dsa-questions.json")) {
            candidates.add("file:../../dsa-questions.json");
            candidates.add("file:../dsa-questions.json");
            candidates.add("file:dsa-questions.json");
            candidates.add("file:/Users/sarthak/Downloads/Prep2Place-dev/Prep2Place-dev/dsa-questions.json");
            candidates.add("classpath:dsa-questions.json");
        } else if (!path.startsWith("file:")) {
            candidates.add("file:./" + path);
            candidates.add("file:../" + path);
            candidates.add("file:../../" + path);
        }
        for (String candidate : candidates) {
            try {
                Resource r = resourceLoader.getResource(candidate);
                if (r != null && r.exists()) {
                    log.info("Resolved seed JSON at '{}'", candidate);
                    return r;
                }
            } catch (Exception ignored) {}
        }
        return null;
    }

    // -------- Difficulty / tags / topic helpers --------

    private Difficulty parseDifficulty(String d) {
        if (d == null) return Difficulty.MEDIUM;
        try { return Difficulty.valueOf(d.toUpperCase(Locale.ROOT)); }
        catch (IllegalArgumentException ignored) { return Difficulty.MEDIUM; }
    }

    private String companyTags(SeedEntry entry) {
        if (entry.getCompanies() == null || entry.getCompanies().isEmpty()) return null;
        Set<String> unique = new java.util.TreeSet<>(String.CASE_INSENSITIVE_ORDER);
        entry.getCompanies().stream()
                .filter(c -> c != null && !c.isBlank())
                .map(String::trim)
                .forEach(unique::add);
        return unique.isEmpty() ? null : String.join(", ", unique);
    }

    private String deriveTopic(SeedEntry entry, String title) {
        if (entry.getTopics() != null && !entry.getTopics().isEmpty()) {
            return capitalize(entry.getTopics().get(0));
        }
        String lower = title.toLowerCase(Locale.ROOT);
        for (Map.Entry<String, String[]> kv : TOPIC_KEYWORDS.entrySet()) {
            for (String kw : kv.getValue()) {
                if (lower.contains(kw)) return kv.getKey();
            }
        }
        return "Arrays";
    }

    // -------- Method signature + sample I/O derivation --------

    private ProblemShape deriveShape(String title, SeedEntry entry) {
        ProblemShape known = KNOWN_PROBLEMS.get(normalizeKey(title));
        if (known != null) return known;
        return heuristicShape(title, entry);
    }

    private ProblemShape heuristicShape(String title, SeedEntry entry) {
        String lower = title.toLowerCase(Locale.ROOT);
        String methodName = toCamelCase(title);
        String returnType = "int";
        List<ParameterSpec> parameters = List.of(new ParameterSpec("nums", "int[]", "input array"));
        String sampleInput = "[1,2,3]";
        String sampleOutput = "0";
        String statement = "Solve the following problem: " + title + ".";

        if (lower.contains("sum")) {
            returnType = "int[]";
            parameters = List.of(
                    new ParameterSpec("nums", "int[]", "array of integers"),
                    new ParameterSpec("target", "int", "target value"));
            sampleInput = "[2,7,11,15], target=9";
            sampleOutput = "[0,1]";
            statement = "Given an array of integers `nums` and an integer `target`, return indices of the two numbers such that they add up to `target`.";
        } else if (lower.contains("longest") || lower.contains("length")) {
            returnType = "int";
            parameters = List.of(new ParameterSpec("s", "string", "input string"));
            sampleInput = "\"abcabcbb\"";
            sampleOutput = "3";
            statement = "Given a string, find the length of the longest relevant substring/subsequence.";
        } else if (lower.contains("palindrome")) {
            returnType = "boolean";
            parameters = List.of(new ParameterSpec("s", "string", "input string"));
            sampleInput = "\"A man, a plan\"";
            sampleOutput = "true";
            statement = "Determine whether the input is a palindrome.";
        } else if (lower.contains("reverse")) {
            returnType = lower.contains("string") ? "string" : "int[]";
            parameters = List.of(new ParameterSpec("input", returnType, "value to reverse"));
            sampleInput = "[1,2,3]";
            sampleOutput = "[3,2,1]";
            statement = "Reverse the given input.";
        } else if (lower.contains("valid") || lower.contains("is ")) {
            returnType = "boolean";
            parameters = List.of(new ParameterSpec("s", "string", "input"));
            sampleInput = "\"()[]{}\"";
            sampleOutput = "true";
            statement = "Determine if the given input satisfies the validity condition.";
        } else if (lower.contains("max") || lower.contains("largest")) {
            returnType = "int";
            parameters = List.of(new ParameterSpec("nums", "int[]", "array of integers"));
            sampleInput = "[-2,1,-3,4,-1,2,1,-5,4]";
            sampleOutput = "6";
            statement = "Find the maximum value as defined by the problem statement.";
        } else if (lower.contains("merge") || lower.contains("interval")) {
            returnType = "int[][]";
            parameters = List.of(new ParameterSpec("intervals", "int[][]", "array of intervals"));
            sampleInput = "[[1,3],[2,6],[8,10],[15,18]]";
            sampleOutput = "[[1,6],[8,10],[15,18]]";
            statement = "Merge overlapping intervals.";
        } else if (lower.contains("tree") || lower.contains("binary")) {
            returnType = "list<int>";
            parameters = List.of(new ParameterSpec("root", "treenode", "root of the tree"));
            sampleInput = "root = [1,null,2,3]";
            sampleOutput = "[1,2,3]";
            statement = "Traverse or process the binary tree.";
        } else if (lower.contains("matrix") || lower.contains("image") || lower.contains("rotate")) {
            returnType = "int[][]";
            parameters = List.of(new ParameterSpec("matrix", "int[][]", "2D matrix"));
            sampleInput = "[[1,2,3],[4,5,6],[7,8,9]]";
            sampleOutput = "[[7,4,1],[8,5,2],[9,6,3]]";
            statement = "Transform the given 2D matrix.";
        } else if (lower.contains("island") || lower.contains("graph") || lower.contains("number of")) {
            returnType = "int";
            parameters = List.of(new ParameterSpec("grid", "char[][]", "input grid"));
            sampleInput = "[[\"1\",\"1\",\"0\"],[\"1\",\"1\",\"0\"],[\"0\",\"0\",\"1\"]]";
            sampleOutput = "2";
            statement = "Count occurrences in the graph/grid.";
        } else if (lower.contains("string") || lower.contains("anagram")) {
            returnType = "boolean";
            parameters = List.of(
                    new ParameterSpec("s", "string", "first string"),
                    new ParameterSpec("t", "string", "second string"));
            sampleInput = "s=\"anagram\", t=\"nagaram\"";
            sampleOutput = "true";
            statement = "Compare or transform the given strings.";
        }

        return new ProblemShape(statement, methodName, returnType, parameters, sampleInput, sampleOutput, buildTemplates(methodName, returnType, parameters));
    }

    private Map<String, String> buildTemplates(String methodName, String returnType, List<ParameterSpec> parameters) {
        Map<String, String> t = new HashMap<>();
        StringBuilder javaParams = new StringBuilder();
        StringBuilder javaCallArgs = new StringBuilder();
        for (int i = 0; i < parameters.size(); i++) {
            ParameterSpec p = parameters.get(i);
            String jt = javaType(p.type());
            if (i > 0) { javaParams.append(", "); javaCallArgs.append(", "); }
            javaParams.append(jt).append(" ").append(p.name());
            javaCallArgs.append(p.name());
        }
        String javaRet = javaType(returnType);
        String javaDefault = defaultJavaValue(returnType);
        t.put("java", "class Solution {\n    public %s %s(%s) {\n        return %s;\n    }\n}\n".formatted(javaRet, methodName, javaParams, javaDefault));
        t.put("python", "class Solution:\n    def %s(self, %s):\n        pass\n".formatted(methodName,
                parameters.stream().map(ParameterSpec::name).reduce((a, b) -> a + ", " + b).orElse("")));
        t.put("javascript", "/**\n * @return %s\n */\nvar %s = function(%s) {\n    return null;\n};\n".formatted(returnType, methodName,
                parameters.stream().map(ParameterSpec::name).reduce((a, b) -> a + ", " + b).orElse("")));
        t.put("cpp", "class Solution {\npublic:\n    %s %s(%s) {\n        return %s;\n    }\n};\n".formatted(cppType(returnType), methodName,
                parameters.stream().map(p -> cppType(p.type()) + " " + p.name()).reduce((a, b) -> a + ", " + b).orElse(""),
                defaultCppValue(returnType)));
        return t;
    }

    private String javaType(String logical) {
        return switch (logical.toLowerCase(Locale.ROOT)) {
            case "int" -> "int";
            case "int[]" -> "int[]";
            case "int[][]" -> "int[][]";
            case "string" -> "String";
            case "boolean" -> "boolean";
            case "long" -> "long";
            case "double" -> "double";
            case "list<int>" -> "List<Integer>";
            case "list<list<int>>" -> "List<List<Integer>>";
            case "char[][]" -> "char[][]";
            case "listnode" -> "ListNode";
            case "treenode" -> "TreeNode";
            default -> "Object";
        };
    }

    private String cppType(String logical) {
        return switch (logical.toLowerCase(Locale.ROOT)) {
            case "int" -> "int";
            case "int[]" -> "vector<int>";
            case "int[][]" -> "vector<vector<int>>";
            case "string" -> "string";
            case "boolean" -> "bool";
            case "long" -> "long long";
            case "double" -> "double";
            case "list<int>" -> "vector<int>";
            case "list<list<int>>" -> "vector<vector<int>>";
            case "char[][]" -> "vector<vector<char>>";
            case "listnode" -> "ListNode*";
            case "treenode" -> "TreeNode*";
            default -> "auto";
        };
    }

    private String defaultJavaValue(String logical) {
        String l = logical.toLowerCase(Locale.ROOT);
        if (l.equals("int") || l.equals("long")) return "0";
        if (l.equals("boolean")) return "false";
        if (l.equals("double")) return "0.0";
        return "null";
    }

    private String defaultCppValue(String logical) {
        String l = logical.toLowerCase(Locale.ROOT);
        if (l.equals("int") || l.equals("long")) return "0";
        if (l.equals("boolean")) return "false";
        if (l.equals("double")) return "0.0";
        return "{}";
    }

    // -------- String helpers --------

    private static String firstNonBlank(String a, String b) {
        if (a != null && !a.isBlank()) return a;
        return b;
    }

    private static String capitalize(String s) {
        if (s == null || s.isEmpty()) return s;
        return Character.toUpperCase(s.charAt(0)) + s.substring(1);
    }

    private static String normalizeKey(String s) {
        if (s == null) return "";
        return s.toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]", " ")
                .replaceAll("\\s+", " ")
                .trim();
    }

    private static String toCamelCase(String s) {
        if (s == null || s.isEmpty()) return "solve";
        String[] parts = s.replaceAll("[^A-Za-z0-9 ]", " ").split("\\s+");
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < parts.length; i++) {
            if (parts[i].isEmpty()) continue;
            String p = parts[i].toLowerCase(Locale.ROOT);
            if (sb.isEmpty()) {
                sb.append(p);
            } else {
                sb.append(Character.toUpperCase(p.charAt(0)));
                if (p.length() > 1) sb.append(p.substring(1));
            }
        }
        return sb.isEmpty() ? "solve" : sb.toString();
    }

    // -------- Keyword / known-problem dictionaries --------

    private static final Map<String, String[]> TOPIC_KEYWORDS = new HashMap<>();
    static {
        TOPIC_KEYWORDS.put("Arrays", new String[]{"array", "sum", "subarray", "rotate", "matrix", "image", "interval", "merge", "permutation", "duplicate", "sorted", "maximum", "minimum"});
        TOPIC_KEYWORDS.put("Strings", new String[]{"string", "palindrome", "anagram", "parentheses", "bracket", "substring", "longest common", "word", "text"});
        TOPIC_KEYWORDS.put("Dynamic Programming", new String[]{"dp", "dynamic", "knapsack", "subsequence", "edit distance", "climb", "coin change", "unique path", "word break"});
        TOPIC_KEYWORDS.put("Linked List", new String[]{"linked list", "listnode", "reverse list", "merge list", "cycle", "node"});
        TOPIC_KEYWORDS.put("Stack", new String[]{"stack", "valid parentheses", "bracket", "queue"});
        TOPIC_KEYWORDS.put("Binary Tree", new String[]{"tree", "treenode", "binary tree", "bst", "invert", "traverse", "symmetric", "balanced"});
        TOPIC_KEYWORDS.put("Graphs", new String[]{"island", "graph", "course schedule", "clone graph", "network", "topological", "dfs", "bfs"});
        TOPIC_KEYWORDS.put("Hash Table", new String[]{"hash", "map", "anagram", "group anagram", "count"});
        TOPIC_KEYWORDS.put("Greedy", new String[]{"greedy", "jump game", "gas station", "partition", "interval schedule"});
        TOPIC_KEYWORDS.put("Binary Search", new String[]{"binary search", "search insert", "find minimum", "peak", "median"});
        TOPIC_KEYWORDS.put("Sliding Window", new String[]{"sliding", "window", "longest substring", "minimum window"});
        TOPIC_KEYWORDS.put("Backtracking", new String[]{"combination", "permutation", "subset", "n-queen", "backtrack", "word search"});
    }

    private static final Map<String, ProblemShape> KNOWN_PROBLEMS = new HashMap<>();
    static {
        ProblemShape twoSum = new ProblemShape(
                "Given an array of integers `nums` and an integer `target`, return indices of the two numbers such that they add up to `target`. You may assume that each input would have exactly one solution, and you may not use the same element twice.",
                "twoSum", "int[]",
                List.of(new ParameterSpec("nums", "int[]", "array of integers"),
                        new ParameterSpec("target", "int", "target sum")),
                "[2,7,11,15], target=9", "[0,1]", null);

        ProblemShape lruCache = new ProblemShape(
                "Design a data structure that follows the constraints of a Least Recently Used (LRU) cache. Implement the LRUCache class with get(key) and put(key, value) operations.",
                "get", "int",
                List.of(new ParameterSpec("key", "int", "cache key")),
                "put(1,1); put(2,2); get(1)", "1", null);

        ProblemShape criticalConnections = new ProblemShape(
                "There are n servers numbered from 0 to n - 1 connected by undirected server-to-server connections forming a network. A critical connection is a connection that, if removed, will make some servers unable to reach some other server. Return all critical connections in the network in any order.",
                "criticalConnections", "list<list<int>>",
                List.of(new ParameterSpec("n", "int", "number of servers"),
                        new ParameterSpec("connections", "int[][]", "server connections")),
                "n=4, connections=[[0,1],[1,2],[2,0],[1,3]]", "[[1,3]]", null);

        ProblemShape kClosest = new ProblemShape(
                "Given an array of `points` where points[i] = [xi, yi] represents a point on the X-Y plane and an integer `k`, return the `k` closest points to the origin (0, 0).",
                "kClosest", "int[][]",
                List.of(new ParameterSpec("points", "int[][]", "points on plane"),
                        new ParameterSpec("k", "int", "number of points to return")),
                "points=[[1,3],[-2,2]], k=1", "[[-2,2]]", null);

        ProblemShape reorderLogFiles = new ProblemShape(
                "You are given an array of logs. Each log is a space-delimited string of words, where the first word is the identifier. Reorder these logs so that: 1) Letter-logs come before all digit-logs; 2) Letter-logs are sorted lexicographically by their contents, then by their identifier; 3) Digit-logs maintain their relative ordering.",
                "reorderLogFiles", "string[]",
                List.of(new ParameterSpec("logs", "string[]", "array of log entries")),
                "[\"dig1 8 1 5 1\",\"let1 art can\",\"dig2 3 6\",\"let2 own kit dig\",\"let3 art zero\"]",
                "[\"let1 art can\",\"let3 art zero\",\"let2 own kit dig\",\"dig1 8 1 5 1\",\"dig2 3 6\"]", null);

        ProblemShape reverseLinkedList = new ProblemShape(
                "Given the head of a singly linked list, reverse the list, and return the reversed list.",
                "reverseList", "listnode",
                List.of(new ParameterSpec("head", "listnode", "head of the list")),
                "1->2->3->4->5", "5->4->3->2->1", null);

        ProblemShape longestCommonSubseq = new ProblemShape(
                "Given two strings `text1` and `text2`, return the length of their longest common subsequence. If there is no common subsequence, return 0.",
                "longestCommonSubsequence", "int",
                List.of(new ParameterSpec("text1", "string", "first string"),
                        new ParameterSpec("text2", "string", "second string")),
                "abcde, ace", "3", null);

        ProblemShape kadane = new ProblemShape(
                "Given an integer array `nums`, find the subarray with the largest sum, and return its sum.",
                "maxSubArray", "int",
                List.of(new ParameterSpec("nums", "int[]", "array of integers")),
                "[-2,1,-3,4,-1,2,1,-5,4]", "6", null);

        ProblemShape removeDuplicates = new ProblemShape(
                "Given an integer array `nums` sorted in non-decreasing order, remove the duplicates in-place such that each unique element appears only once. Return the number of unique elements.",
                "removeDuplicates", "int",
                List.of(new ParameterSpec("nums", "int[]", "sorted array")),
                "[1,1,2,2,3]", "3", null);

        ProblemShape validParen = new ProblemShape(
                "Given a string `s` containing just the characters '(', ')', '{', '}', '[' and ']', determine if the input string is valid. An input string is valid if: 1) Open brackets must be closed by the same type of brackets; 2) Open brackets must be closed in the correct order; 3) Every close bracket has a corresponding open bracket of the same type.",
                "isValid", "boolean",
                List.of(new ParameterSpec("s", "string", "string of brackets")),
                "()[]{}", "true", null);

        ProblemShape nextPerm = new ProblemShape(
                "Given an array of integers `nums`, find the next lexicographical permutation of `nums`.",
                "nextPermutation", "int[]",
                List.of(new ParameterSpec("nums", "int[]", "array of integers")),
                "[1,2,3]", "[1,3,2]", null);

        ProblemShape threeSum = new ProblemShape(
                "Given an integer array `nums`, return all the triplets [nums[i], nums[j], nums[k]] such that i != j, i != k, and j != k, and nums[i] + nums[j] + nums[k] == 0.",
                "threeSum", "list<list<int>>",
                List.of(new ParameterSpec("nums", "int[]", "array of integers")),
                "[-1,0,1,2,-1,-4]", "[[-1,-1,2],[-1,0,1]]", null);

        ProblemShape mergeIntervals = new ProblemShape(
                "Given an array of `intervals` where intervals[i] = [starti, endi], merge all overlapping intervals, and return an array of the non-overlapping intervals that cover all the intervals in the input.",
                "merge", "int[][]",
                List.of(new ParameterSpec("intervals", "int[][]", "array of intervals")),
                "[[1,3],[2,6],[8,10],[15,18]]", "[[1,6],[8,10],[15,18]]", null);

        ProblemShape rotateImage = new ProblemShape(
                "You are given an `n x n` 2D `matrix` representing an image, rotate the image by 90 degrees (clockwise).\n\nYou have to rotate the image in-place, which means you have to modify the input 2D matrix directly. DO NOT allocate another 2D matrix and do the rotation.",
                "rotate", "int[][]",
                List.of(new ParameterSpec("matrix", "int[][]", "n x n matrix")),
                "[[1,2,3],[4,5,6],[7,8,9]]", "[[7,4,1],[8,5,2],[9,6,3]]", null,
                List.of(
                        new ExampleDef("Example 1", "matrix = [[1,2,3],[4,5,6],[7,8,9]]", "[[7,4,1],[8,5,2],[9,6,3]]", "Rotate the matrix clockwise by 90 degrees."),
                        new ExampleDef("Example 2", "matrix = [[5,1,9,11],[2,4,8,10],[13,3,6,7],[15,14,12,16]]", "[[15,13,2,5],[14,3,4,1],[12,6,8,9],[16,7,10,11]]", "Rotate the 4x4 matrix clockwise by 90 degrees.")
                ),
                List.of(
                        "n == matrix.length == matrix[i].length",
                        "1 <= n <= 20",
                        "-1000 <= matrix[i][j] <= 1000"
                ));

        ProblemShape setZeroes = new ProblemShape(
                "Given an `m x n` integer matrix `matrix`, if an element is `0`, set its entire row and column to `0`'s.\n\nYou must do it in place.\n\nAn efficient in-place solution uses the first row and first column of the matrix itself as markers to track which rows and columns should be zeroed, achieving `O(1)` auxiliary space complexity.",
                "setZeroes", "int[][]",
                List.of(new ParameterSpec("matrix", "int[][]", "m x n matrix")),
                "[[1,1,1],[1,0,1],[1,1,1]]", "[[1,0,1],[0,0,0],[1,0,1]]", null,
                List.of(
                        new ExampleDef("Example 1", "matrix = [[1,1,1],[1,0,1],[1,1,1]]", "[[1,0,1],[0,0,0],[1,0,1]]", "Element at (1,1) is 0, so row 1 and column 1 are set to 0."),
                        new ExampleDef("Example 2", "matrix = [[0,1,2,0],[3,4,5,2],[1,3,1,5]]", "[[0,0,0,0],[0,4,5,0],[0,3,1,0]]", "Elements at (0,0) and (0,3) are 0, so row 0, column 0, and column 3 are set to 0.")
                ),
                List.of(
                        "m == matrix.length",
                        "n == matrix[0].length",
                        "1 <= m, n <= 200",
                        "-2^31 <= matrix[i][j] <= 2^31 - 1"
                ));

        ProblemShape floodFill = new ProblemShape(
                "An image is represented by an `m x n` integer grid `image` where `image[i][j]` represents the pixel value of the image. You are also given three integers `sr`, `sc`, and `color`. You should perform a flood fill on the image starting from the pixel `image[sr][sc]`.\n\nTo perform a flood fill, consider the starting pixel, plus any pixels connected 4-directionally to the starting pixel of the same color as the starting pixel, plus any pixels connected 4-directionally to those pixels (also with the same color), and so on. Replace the color of all of the aforementioned pixels with `color`.\n\nReturn the modified image after performing the flood fill.",
                "floodFill", "int[][]",
                List.of(new ParameterSpec("image", "int[][]", "image grid"),
                        new ParameterSpec("sr", "int", "starting row"),
                        new ParameterSpec("sc", "int", "starting column"),
                        new ParameterSpec("color", "int", "new color")),
                "image = [[1,1,1],[1,1,0],[1,0,1]], sr = 1, sc = 1, color = 2", "[[2,2,2],[2,2,0],[2,0,1]]", null,
                List.of(
                        new ExampleDef("Example 1", "image = [[1,1,1],[1,1,0],[1,0,1]], sr = 1, sc = 1, color = 2", "[[2,2,2],[2,2,0],[2,0,1]]", "From the center pixel (1, 1), all connected pixels of color 1 are replaced with 2."),
                        new ExampleDef("Example 2", "image = [[0,0,0],[0,0,0]], sr = 0, sc = 0, color = 0", "[[0,0,0],[0,0,0]]", "Starting pixel is already color 0, so no changes are made.")
                ),
                List.of(
                        "m == image.length, n == image[i].length",
                        "1 <= m, n <= 50",
                        "0 <= image[i][j], color < 2^16",
                        "0 <= sr < m, 0 <= sc < n"
                ));

        ProblemShape wordSearch = new ProblemShape(
                "Given an `m x n` grid of characters `board` and a string `word`, return `true` if `word` exists in the grid.\n\nThe word can be constructed from letters of sequentially adjacent cells, where adjacent cells are horizontally or vertically neighboring. The same letter cell may not be used more than once.",
                "exist", "boolean",
                List.of(new ParameterSpec("board", "char[][]", "character grid"),
                        new ParameterSpec("word", "string", "target word")),
                "board = [[\"A\",\"B\",\"C\",\"E\"],[\"S\",\"F\",\"C\",\"S\"],[\"A\",\"D\",\"E\",\"E\"]], word = \"ABCCED\"", "true", null,
                List.of(
                        new ExampleDef("Example 1", "board = [[\"A\",\"B\",\"C\",\"E\"],[\"S\",\"F\",\"C\",\"S\"],[\"A\",\"D\",\"E\",\"E\"]], word = \"ABCCED\"", "true", "The word ABCCED is formed along the path."),
                        new ExampleDef("Example 2", "board = [[\"A\",\"B\",\"C\",\"E\"],[\"S\",\"F\",\"C\",\"S\"],[\"A\",\"D\",\"E\",\"E\"]], word = \"SEE\"", "true", "The word SEE is formed along the path."),
                        new ExampleDef("Example 3", "board = [[\"A\",\"B\",\"C\",\"E\"],[\"S\",\"F\",\"C\",\"S\"],[\"A\",\"D\",\"E\",\"E\"]], word = \"ABCB\"", "false", "The letter B cannot be reused.")
                ),
                List.of(
                        "m == board.length, n == board[i].length",
                        "1 <= m, n <= 6",
                        "1 <= word.length <= 15",
                        "board and word consist of only lowercase and uppercase English letters."
                ));

        ProblemShape numIslands = new ProblemShape(
                "Given an `m x n` 2D binary grid `grid` which represents a map of `'1'`s (land) and `'0'`s (water), return the number of islands.\n\nAn island is surrounded by water and is formed by connecting adjacent lands horizontally or vertically. You may assume all four edges of the grid are all surrounded by water.",
                "numIslands", "int",
                List.of(new ParameterSpec("grid", "char[][]", "binary grid")),
                "[[\"1\",\"1\",\"1\",\"1\",\"0\"],[\"1\",\"1\",\"0\",\"1\",\"0\"],[\"1\",\"1\",\"0\",\"0\",\"0\"],[\"0\",\"0\",\"0\",\"0\",\"0\"]]", "1", null,
                List.of(
                        new ExampleDef("Example 1", "grid = [[\"1\",\"1\",\"1\",\"1\",\"0\"],[\"1\",\"1\",\"0\",\"1\",\"0\"],[\"1\",\"1\",\"0\",\"0\",\"0\"],[\"0\",\"0\",\"0\",\"0\",\"0\"]]", "1", "All connected 1s form a single island."),
                        new ExampleDef("Example 2", "grid = [[\"1\",\"1\",\"0\",\"0\",\"0\"],[\"1\",\"1\",\"0\",\"0\",\"0\"],[\"0\",\"0\",\"1\",\"0\",\"0\"],[\"0\",\"0\",\"0\",\"1\",\"1\"]]", "3", "There are three separate islands.")
                ),
                List.of(
                        "m == grid.length",
                        "n == grid[i].length",
                        "1 <= m, n <= 300",
                        "grid[i][j] is '0' or '1'"
                ));

        ProblemShape minPathSum = new ProblemShape(
                "Given a `m x n` grid filled with non-negative numbers, find a path from top left to bottom right, which minimizes the sum of all numbers along its path.\n\nNote: You can only move either down or right at any point in time.",
                "minPathSum", "int",
                List.of(new ParameterSpec("grid", "int[][]", "non-negative grid")),
                "grid = [[1,3,1],[1,5,1],[4,2,1]]", "7", null,
                List.of(
                        new ExampleDef("Example 1", "grid = [[1,3,1],[1,5,1],[4,2,1]]", "7", "Because the path 1 -> 3 -> 1 -> 1 -> 1 minimizes the sum."),
                        new ExampleDef("Example 2", "grid = [[1,2,3],[4,5,6]]", "12", "The path 1 -> 2 -> 3 -> 6 minimizes the sum.")
                ),
                List.of(
                        "m == grid.length",
                        "n == grid[i].length",
                        "1 <= m, n <= 200",
                        "0 <= grid[i][j] <= 200"
                ));

        ProblemShape shortestPathBinaryMatrix = new ProblemShape(
                "Given an `n x n` binary matrix `grid`, return the length of the shortest clear path in the matrix. If there is no clear path, return `-1`.\n\nA clear path in a binary matrix is a path from the top-left cell `(0, 0)` to the bottom-right cell `(n - 1, n - 1)` such that all visited cells are `0`, and all adjacent cells in the path are 8-directionally connected (sharing an edge or corner).\n\nThe length of a clear path is the number of visited cells of this path.",
                "shortestPathBinaryMatrix", "int",
                List.of(new ParameterSpec("grid", "int[][]", "binary matrix")),
                "grid = [[0,1],[1,0]]", "2", null,
                List.of(
                        new ExampleDef("Example 1", "grid = [[0,1],[1,0]]", "2", "Path: (0,0) -> (1,1)."),
                        new ExampleDef("Example 2", "grid = [[0,0,0],[1,1,0],[1,1,0]]", "4", "Path: (0,0) -> (0,1) -> (0,2) -> (1,2) -> (2,2)."),
                        new ExampleDef("Example 3", "grid = [[1,0,0],[1,1,0],[1,1,0]]", "-1", "Starting cell is 1, so no clear path exists.")
                ),
                List.of(
                        "n == grid.length == grid[i].length",
                        "1 <= n <= 100",
                        "grid[i][j] is 0 or 1"
                ));

        ProblemShape spiralMatrix = new ProblemShape(
                "Given an `m x n` matrix, return all of its elements in spiral order, starting from the top-left corner and moving clockwise.",
                "spiralOrder", "list<int>",
                List.of(new ParameterSpec("matrix", "int[][]", "m x n matrix")),
                "matrix = [[1,2,3],[4,5,6],[7,8,9]]", "[1,2,3,6,9,8,7,4,5]", null,
                List.of(
                        new ExampleDef("Example 1", "matrix = [[1,2,3],[4,5,6],[7,8,9]]", "[1,2,3,6,9,8,7,4,5]", "Spiral traversal starting from top-left."),
                        new ExampleDef("Example 2", "matrix = [[1,2,3,4],[5,6,7,8],[9,10,11,12]]", "[1,2,3,4,8,12,11,10,9,5,6,7]", "Spiral traversal of 3x4 matrix.")
                ),
                List.of(
                        "m == matrix.length",
                        "n == matrix[i].length",
                        "1 <= m, n <= 10",
                        "-100 <= matrix[i][j] <= 100"
                ));

        ProblemShape validAnagram = new ProblemShape(
                "Given two strings `s` and `t`, return true if `t` is an anagram of `s`, and false otherwise. An Anagram is a word or phrase formed by rearranging the letters of a different word or phrase, typically using all the original letters exactly once.",
                "isAnagram", "boolean",
                List.of(new ParameterSpec("s", "string", "first string"),
                        new ParameterSpec("t", "string", "second string")),
                "s=\"anagram\", t=\"nagaram\"", "true", null);

        putKnown("two sum", twoSum);
        putKnown("lru cache", lruCache);
        putKnown("number of islands", numIslands);
        putKnown("critical connections in a network", criticalConnections);
        putKnown("k closest points to origin", kClosest);
        putKnown("reorder data in log files", reorderLogFiles);
        putKnown("reverse a linked list", reverseLinkedList);
        putKnown("reverse linked list", reverseLinkedList);
        putKnown("longest common subsequence", longestCommonSubseq);
        putKnown("maximum subarray", kadane);
        putKnown("maximum subarray kadane s", kadane);
        putKnown("remove duplicates from sorted array", removeDuplicates);
        putKnown("valid parentheses", validParen);
        putKnown("next permutation", nextPerm);
        putKnown("3sum", threeSum);
        putKnown("merge intervals", mergeIntervals);
        putKnown("rotate image", rotateImage);
        putKnown("set matrix zeroes", setZeroes);
        putKnown("flood fill", floodFill);
        putKnown("word search", wordSearch);
        putKnown("minimum path sum", minPathSum);
        putKnown("shortest path in binary matrix", shortestPathBinaryMatrix);
        putKnown("striver a2z shortest path in binary matrix", shortestPathBinaryMatrix);
        putKnown("spiral matrix", spiralMatrix);
        putKnown("valid anagram", validAnagram);
    }

    private static void putKnown(String key, ProblemShape shape) {
        if (shape.templates() == null) {
            Map<String, String> templates = new LeetCodeCodingProblemSeedLoader(null, null, null, null)
                    .buildTemplates(shape.methodName(), shape.returnType(), shape.parameters());
            shape = new ProblemShape(shape.statement(), shape.methodName(), shape.returnType(),
                    shape.parameters(), shape.sampleInput(), shape.sampleOutput(), templates,
                    shape.examples(), shape.constraints());
        }
        KNOWN_PROBLEMS.put(key, shape);
    }

    // -------- DTOs / data shapes --------

    public record ExampleDef(String title, String input, String output, String explanation) {}

    @Getter
    @Setter
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class SeedEntry {
        private String sourceQuestionId;
        private String title;
        private String sourceUrl;
        private String platform;
        private String alternatePlatformUrl;
        private String difficulty;
        private String problemStatement;
        private String statement;
        private Map<String, Object> execution;
        private List<Map<String, Object>> testCases = new ArrayList<>();
        private List<Map<String, Object>> examples = new ArrayList<>();
        private List<String> constraints = new ArrayList<>();
        private List<String> topics = new ArrayList<>();
        private List<String> subtopics = new ArrayList<>();
        private List<String> tags = new ArrayList<>();
        private List<String> supportedLanguages = new ArrayList<>();
        private List<String> companies = new ArrayList<>();
        private Double frequencyScore;
        private List<String> sheets = new ArrayList<>();
        private List<Object> sheetSteps = new ArrayList<>();
    }

    private record ProblemShape(
            String statement,
            String methodName,
            String returnType,
            List<ParameterSpec> parameters,
            String sampleInput,
            String sampleOutput,
            Map<String, String> templates,
            List<ExampleDef> examples,
            List<String> constraints
    ) {
        public ProblemShape(String statement, String methodName, String returnType, List<ParameterSpec> parameters,
                            String sampleInput, String sampleOutput, Map<String, String> templates) {
            this(statement, methodName, returnType, parameters, sampleInput, sampleOutput, templates, List.of(), List.of());
        }
    }

    private void deduplicateDsaProblems() {
        if (transactionTemplate == null) {
            deduplicateDsaProblemsInternal();
            return;
        }
        transactionTemplate.execute(status -> {
            deduplicateDsaProblemsInternal();
            return null;
        });
    }

    private void deduplicateDsaProblemsInternal() {
        List<CodingProblem> all = codingProblemRepository.findAll();
        Map<String, List<CodingProblem>> groups = new LinkedHashMap<>();
        for (CodingProblem p : all) {
            boolean isDsa = (p.getCategory() == null || "DSA".equalsIgnoreCase(p.getCategory()))
                    && p.getExecutionMode() != ExecutionMode.SQL && p.getExecutionMode() != ExecutionMode.DATAFRAME;
            if (!isDsa) continue;

            String norm = normalizeTitle(p.getTitle());
            if (!norm.isBlank()) {
                groups.computeIfAbsent(norm, k -> new ArrayList<>()).add(p);
            }
        }

        int archived = 0;
        for (List<CodingProblem> group : groups.values()) {
            if (group.size() <= 1) continue;

            // Sort by ID ascending so the lowest ID (original problem) is kept
            group.sort(Comparator.comparingLong(CodingProblem::getId));
            CodingProblem keep = group.get(0);

            for (int i = 1; i < group.size(); i++) {
                CodingProblem dup = group.get(i);
                String dupSlug = dup.getSourceQuestionId();
                dup.setActive(false);
                if (dupSlug != null && !dupSlug.contains("-archived-")) {
                    dup.setSourceQuestionId(dupSlug + "-archived-" + dup.getId());
                } else if (dupSlug == null) {
                    dup.setSourceQuestionId("archived-" + dup.getId());
                }
                codingProblemRepository.saveAndFlush(dup);

                if (keep.getSourceQuestionId() == null || keep.getSourceQuestionId().isBlank() || keep.getSourceQuestionId().startsWith("archived-")) {
                    if (dupSlug != null && !dupSlug.isBlank()) {
                        keep.setSourceQuestionId(dupSlug);
                    }
                }
                mergeRichData(keep, dup);
                archived++;
            }
            keep.setActive(true);
            keep.setCategory("DSA");
            codingProblemRepository.saveAndFlush(keep);
        }
        if (archived > 0) {
            log.info("Deduplicated DSA questions: archived {} duplicate rows, consolidated rich metadata into canonical questions.", archived);
        }
    }

    private void enrichAllActiveDsaProblems() {
        if (transactionTemplate == null) {
            enrichAllActiveDsaProblemsInternal();
            return;
        }
        transactionTemplate.execute(status -> {
            enrichAllActiveDsaProblemsInternal();
            return null;
        });
    }

    private void enrichAllActiveDsaProblemsInternal() {
        List<CodingProblem> activeDsa = codingProblemRepository.findActiveDsaProblems();
        int enriched = 0;
        for (CodingProblem p : activeDsa) {
            boolean modified = false;
            if (p.getCategory() == null || p.getCategory().isBlank()) {
                p.setCategory("DSA");
                modified = true;
            }
            ProblemShape shape = KNOWN_PROBLEMS.get(normalizeKey(p.getTitle()));

            if (shape != null) {
                if (p.getStatement() == null || p.getStatement().length() < shape.statement().length()) {
                    p.setStatement(shape.statement());
                    modified = true;
                }
                if (p.getExamples().isEmpty() && !shape.examples().isEmpty()) {
                    int ord = 0;
                    for (ExampleDef ex : shape.examples()) {
                        p.getExamples().add(ProblemExample.builder()
                                .problem(p)
                                .ordinal(ord++)
                                .title(ex.title())
                                .input(ex.input())
                                .output(ex.output())
                                .explanation(ex.explanation())
                                .hidden(false)
                                .build());
                    }
                    if (p.getSampleInput() == null || p.getSampleInput().isBlank()) {
                        p.setSampleInput(shape.sampleInput());
                        p.setSampleOutput(shape.sampleOutput());
                    }
                    modified = true;
                }
                if (p.getConstraints().isEmpty() && !shape.constraints().isEmpty()) {
                    int cOrd = 0;
                    for (String c : shape.constraints()) {
                        p.getConstraints().add(ProblemConstraint.builder()
                                .problem(p)
                                .ordinal(cOrd++)
                                .text(c)
                                .build());
                    }
                    modified = true;
                }
            }

            // Universal fallback for any DSA problem that still has no examples
            if (p.getExamples().isEmpty() && (p.getSampleInput() != null || p.getSampleOutput() != null)) {
                String sIn = p.getSampleInput() != null ? p.getSampleInput() : "";
                String sOut = p.getSampleOutput() != null ? p.getSampleOutput() : "";
                p.getExamples().add(ProblemExample.builder()
                        .problem(p)
                        .ordinal(0)
                        .title("Example 1")
                        .input(sIn)
                        .output(sOut)
                        .explanation(null)
                        .hidden(false)
                        .build());
                modified = true;
            }

            // Universal fallback for any DSA problem that still has no constraints
            if (p.getConstraints().isEmpty()) {
                List<String> defaults = deriveDefaultConstraints(p);
                int cOrd = 0;
                for (String c : defaults) {
                    p.getConstraints().add(ProblemConstraint.builder()
                            .problem(p)
                            .ordinal(cOrd++)
                            .text(c)
                            .build());
                }
                modified = true;
            }

            // Populate parameters, methodName, returnType from java template if missing
            if ((p.getParameters() == null || p.getParameters().isEmpty()) && p.getTemplates() != null && p.getTemplates().containsKey("java")) {
                String javaCode = p.getTemplates().get("java");
                if (javaCode != null && !javaCode.isBlank()) {
                    java.util.regex.Pattern pattern = java.util.regex.Pattern.compile("(?:public|protected|private)?\\s*(?:static)?\\s*([\\w<>\\[\\],]+)\\s+([a-zA-Z_]\\w*)\\s*\\(([^)]*)\\)");
                    java.util.regex.Matcher matcher = pattern.matcher(javaCode);
                    while (matcher.find()) {
                        String ret = matcher.group(1).trim();
                        String name = matcher.group(2).trim();
                        String rawParams = matcher.group(3).trim();
                        if ("Solution".equals(name) || "Main".equals(name) || "main".equals(name) || "class".equals(ret)) continue;
                        if (p.getMethodName() == null || p.getMethodName().isBlank() || "solve".equalsIgnoreCase(p.getMethodName())) {
                            p.setMethodName(name);
                        }
                        if (p.getReturnType() == null || p.getReturnType().isBlank() || "void".equalsIgnoreCase(p.getReturnType())) {
                            p.setReturnType(ret);
                        }
                        List<ParameterSpec> params = parseJavaParameters(rawParams);
                        if (!params.isEmpty()) {
                            p.setParameters(params);
                        }
                        modified = true;
                        break;
                    }
                }
            }

            if (modified) {
                codingProblemRepository.saveAndFlush(p);
                enriched++;
            }
        }
        if (enriched > 0) {
            log.info("Enriched {} active DSA problems with rich statements, examples, and constraints.", enriched);
        }
    }

    private static List<ParameterSpec> parseJavaParameters(String rawParams) {
        List<ParameterSpec> list = new ArrayList<>();
        if (rawParams == null || rawParams.isBlank()) return list;
        int depth = 0;
        StringBuilder sb = new StringBuilder();
        List<String> parts = new ArrayList<>();
        for (int i = 0; i < rawParams.length(); i++) {
            char c = rawParams.charAt(i);
            if (c == '<' || c == '[' || c == '(') depth++;
            else if (c == '>' || c == ']' || c == ')') depth--;
            else if (c == ',' && depth == 0) {
                parts.add(sb.toString().trim());
                sb.setLength(0);
                continue;
            }
            sb.append(c);
        }
        if (sb.length() > 0) parts.add(sb.toString().trim());

        for (String part : parts) {
            String p = part.trim();
            if (p.isEmpty()) continue;
            int lastSpace = p.lastIndexOf(' ');
            if (lastSpace > 0) {
                String pType = p.substring(0, lastSpace).trim();
                String pName = p.substring(lastSpace + 1).trim();
                list.add(new ParameterSpec(pName, pType, pName));
            }
        }
        return list;
    }

    private static String normalizeTitle(String title) {
        if (title == null) return "";
        return title.trim().toLowerCase().replaceAll("[^a-z0-9]", "");
    }

    private void mergeRichData(CodingProblem target, CodingProblem source) {
        if (source.getStatement() != null && !source.getStatement().isBlank()
                && (target.getStatement() == null || target.getStatement().isBlank() || target.getStatement().length() < source.getStatement().length())) {
            target.setStatement(source.getStatement());
        }
        if (source.getMethodName() != null && !source.getMethodName().isBlank()) {
            target.setMethodName(source.getMethodName());
        }
        if (source.getReturnType() != null && !source.getReturnType().isBlank()) {
            target.setReturnType(source.getReturnType());
        }
        if (source.getParameters() != null && !source.getParameters().isEmpty()) {
            target.setParameters(new ArrayList<>(source.getParameters()));
        }
        if (source.getTestCasesJson() != null && !source.getTestCasesJson().isBlank()) {
            target.setTestCasesJson(source.getTestCasesJson());
        }
        if (source.getExecutionConfig() != null && !source.getExecutionConfig().isBlank()) {
            target.setExecutionConfig(source.getExecutionConfig());
        }
        if ((target.getExamples() == null || target.getExamples().isEmpty()) && source.getExamples() != null && !source.getExamples().isEmpty()) {
            for (ProblemExample ex : source.getExamples()) {
                target.getExamples().add(ProblemExample.builder()
                        .problem(target)
                        .ordinal(ex.getOrdinal())
                        .title(ex.getTitle())
                        .input(ex.getInput())
                        .output(ex.getOutput())
                        .explanation(ex.getExplanation())
                        .hidden(ex.isHidden())
                        .build());
            }
        }
        if ((target.getConstraints() == null || target.getConstraints().isEmpty()) && source.getConstraints() != null && !source.getConstraints().isEmpty()) {
            for (ProblemConstraint c : source.getConstraints()) {
                target.getConstraints().add(ProblemConstraint.builder()
                        .problem(target)
                        .ordinal(c.getOrdinal())
                        .text(c.getText())
                        .build());
            }
        }
        if (source.getSampleInput() != null && !source.getSampleInput().isBlank()) target.setSampleInput(source.getSampleInput());
        if (source.getSampleOutput() != null && !source.getSampleOutput().isBlank()) target.setSampleOutput(source.getSampleOutput());
    }
}
