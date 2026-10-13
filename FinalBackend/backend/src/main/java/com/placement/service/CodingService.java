package com.placement.service;

import com.placement.dto.CodingDtos.*;
import com.placement.entity.*;
import com.placement.exception.ApiException;
import com.placement.repository.CodingProblemRepository;
import com.placement.repository.CodingSubmissionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Service
@Slf4j
@RequiredArgsConstructor
public class CodingService {
    private final CodingProblemRepository problemRepository;
    private final CodingSubmissionRepository submissionRepository;
    private final CodingRunnerService codingRunnerService;

    /**
     * Coding Practice is the main-pool view. sourceQuestionId is assigned exclusively by the
     * idempotent leetcode-company-seed importer, so legacy hand-curated/mock-test rows cannot
     * inflate its catalogue or statistics.
     */
    /**
     * Backs GET /api/coding/problems.
     * Strictly filters for active DSA problems (excluding SQL and DataFrame)
     * and deduplicates in-memory by normalized title, picking the richest record.
     */
    public List<CodingProblem> listProblems() {
        List<CodingProblem> list = problemRepository.findActiveDsaProblems();
        Map<String, CodingProblem> unique = new LinkedHashMap<>();
        for (CodingProblem p : list) {
            String norm = normalizeTitle(p.getTitle());
            if (!unique.containsKey(norm)) {
                unique.put(norm, p);
            } else {
                CodingProblem current = unique.get(norm);
                int scoreP = scoreProblem(p);
                int scoreCurrent = scoreProblem(current);
                if (scoreP > scoreCurrent) {
                    unique.put(norm, p);
                }
            }
        }
        return new ArrayList<>(unique.values());
    }

    private static String normalizeTitle(String title) {
        if (title == null) return "";
        return title.trim().toLowerCase().replaceAll("[^a-z0-9]", "");
    }

    private static int scoreProblem(CodingProblem p) {
        int score = 0;
        if (p.getSourceQuestionId() != null && !p.getSourceQuestionId().isBlank()) score += 10;
        if (p.getStatement() != null) score += Math.min(50, p.getStatement().length() / 20);
        if (p.getTestCasesJson() != null && p.getTestCasesJson().length() > 2) score += 20;
        if (p.getExamples() != null && !p.getExamples().isEmpty()) score += p.getExamples().size() * 10;
        if (p.getConstraints() != null && !p.getConstraints().isEmpty()) score += p.getConstraints().size() * 5;
        if (p.getParameters() != null && !p.getParameters().isEmpty()) score += 10;
        return score;
    }

    public CodingProblem getProblem(Long id) {
        return problemRepository.findById(id).orElseThrow(() -> ApiException.notFound("Coding problem not found"));
    }

    public List<LanguageConfig> supportedLanguages() {
        return List.of(
                new LanguageConfig("java", "Java", "21", "java", "", "method"),
                new LanguageConfig("python", "Python", "3.12", "python", "", "method"),
                new LanguageConfig("javascript", "JavaScript", "ES2023", "javascript", "", "method"),
                new LanguageConfig("cpp", "C++", "17", "cpp", "", "method")
        );
    }

    @Transactional(readOnly = true)
    public ProblemMetadataResponse problemMetadata(Long problemId) {
        CodingProblem problem = getProblem(problemId);
        List<String> topics = problem.getTopic() == null || problem.getTopic().isBlank()
                ? List.of("General")
                : List.of(problem.getTopic().split("\\s*,\\s*"));

        // ----- examples: prefer DB entity list, fall back to sampleInput/Output singleton -----
        List<com.placement.dto.CodingDtos.ProblemExample> examples = resolveExamples(problem);

        // ----- constraints: prefer DB entity list, fall back to defaults -----
        List<String> constraints = resolveConstraints(problem);

        // ----- templates: prefer DB JSONB map, fall back to default templates with method sig -----
        Map<String, String> templates = resolveTemplates(problem);

        // ----- time/memory limits, acceptance rate -----
        Integer timeLimitMs = problem.getTimeLimitMs() != null ? problem.getTimeLimitMs() : 1000;
        Integer memoryLimitMb = problem.getMemoryLimitMb() != null ? problem.getMemoryLimitMb() : 256;
        Double acceptanceRate = problem.getAcceptanceRate() != null ? problem.getAcceptanceRate()
                : acceptanceRate(problem.getDifficulty());

        // ----- supported languages -> attach actual templates for convenience -----
        List<LanguageConfig> supported = supportedLanguages().stream()
                .map(lang -> new LanguageConfig(
                        lang.id(), lang.name(), lang.version(), lang.editorLanguage(),
                        templates.getOrDefault(lang.id(), lang.template()),
                        problem.getExecutionMode() != null
                                ? problem.getExecutionMode().name().toLowerCase()
                                : lang.executionMode()))
                .toList();

        Map<String, String> templatesFinal = new LinkedHashMap<>();
        supported.forEach(language -> templatesFinal.put(language.id(), language.template()));

        return new ProblemMetadataResponse(
                problem.getId(),
                problem.getTitle(),
                problem.getDifficulty() == null ? "MEDIUM" : problem.getDifficulty().name(),
                topics,
                safe(problem.getStatement()),
                constraints,
                examples,
                supported,
                templatesFinal,
                timeLimitMs,
                memoryLimitMb,
                acceptanceRate
        );
    }

    public RunCodeResponse runVisibleTests(RunCodeRequest request) {
        CodingProblem problem = getProblem(request.problemId());
        List<CodeTestCase> tests = request.testCases() == null || request.testCases().isEmpty()
                ? List.of(new CodeTestCase("Sample 1", problem.getSampleInput(), problem.getSampleOutput(), false))
                : request.testCases();
        return codingRunnerService.run(problem, request.language(), request.code(), tests, false);
    }

    /** Previously this built a fake "Hidden Aggregate" test by duplicating problem.getSampleInput()/
     *  getSampleOutput() - the exact same case as "Sample 1" - so a submission was graded as if two
     *  independent tests ran when only one ever did, and a student could pass by hardcoding the one
     *  known sample's output. This now runs the single visible sample plus every real hidden example
     *  authored for the problem (ProblemExample.hidden == true via CodingProblem.getExamples()).
     *  Today that second set is typically empty - there is no admin UI yet to author hidden test
     *  cases for this module (a separate, larger gap; see engineering notes) - but the grading is
     *  honest about that rather than fabricating a case that was never real, and the moment hidden
     *  examples exist the runner and buildConsole() already handle them safely (see
     *  CodingRunnerService.buildConsole's comment on why hidden results are redacted there). */
    @Transactional
    public SubmitCodeResponse submitCode(User student, SubmitCodeRequest request) {
        CodingProblem problem = getProblem(request.problemId());
        List<CodeTestCase> tests = new java.util.ArrayList<>();
        tests.add(new CodeTestCase("Sample 1", problem.getSampleInput(), problem.getSampleOutput(), false));
        problem.getExamples().stream()
                .filter(com.placement.entity.ProblemExample::isHidden)
                .forEach(ex -> tests.add(new CodeTestCase(ex.getTitle(), ex.getInput(), ex.getOutput(), true)));

        RunCodeResponse execution = codingRunnerService.run(problem, request.language(), request.code(), tests, true);
        SubmissionResponse saved = saveSubmission(student, problem, request, execution);
        boolean accepted = "SUCCESS".equals(execution.status());
        return new SubmitCodeResponse(accepted ? "ACCEPTED" : execution.status(),
                execution.passed(), execution.total(), execution.runtimeMs(), execution.memoryMb(),
                saved.score(), saved.verdict(), saved.submissionId(), execution.console());
    }

    @Transactional
    public SubmissionResponse submit(User student, SubmitCodeRequest request) {
        CodingProblem problem = getProblem(request.problemId());
        RunCodeResponse execution = codingRunnerService.run(problem, request.language(), request.code(),
                List.of(new CodeTestCase("Sample 1", problem.getSampleInput(), problem.getSampleOutput(), false)),
                false);
        return saveSubmission(student, problem, request, execution);
    }

    private SubmissionResponse saveSubmission(User student, CodingProblem problem, SubmitCodeRequest request, RunCodeResponse execution) {
        int score = execution.total() == null || execution.total() == 0
                ? 0
                : (int) Math.round((execution.passed() * 100.0) / execution.total());
        String verdict = "SUCCESS".equals(execution.status()) ? "PASSED" : execution.status();
        CodingSubmission submission = CodingSubmission.builder()
                .student(student).problem(problem).code(request.code())
                .language(request.language()).verdict(verdict).score(score).build();
        submission = submissionRepository.save(submission);
        return toResponse(submission);
    }

    public List<SubmissionResponse> history(Long studentId) {
        return submissionRepository.findByStudentIdOrderBySubmittedAtDesc(studentId).stream().map(this::toResponse).toList();
    }

    public Map<String, Double> progressByTopic(Long studentId) {
        List<CodingSubmission> submissions = submissionRepository.findByStudentIdOrderBySubmittedAtDesc(studentId);
        return submissions.stream().collect(Collectors.groupingBy(
                s -> s.getProblem().getTopic() == null ? "General" : s.getProblem().getTopic(),
                Collectors.averagingInt(CodingSubmission::getScore)));
    }

    private SubmissionResponse toResponse(CodingSubmission s) {
        return new SubmissionResponse(s.getId(), s.getProblem().getId(), s.getProblem().getTitle(),
                s.getVerdict(), s.getScore(), s.getSubmittedAt().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));
    }

    // =====================================================================================
    // Entity -> DTO resolvers with graceful backward-compat fallback
    // =====================================================================================

    private List<com.placement.dto.CodingDtos.ProblemExample> resolveExamples(CodingProblem problem) {
        List<com.placement.entity.ProblemExample> stored = problem.getExamples();
        if (stored != null && !stored.isEmpty()) {
            return stored.stream()
                    .sorted(Comparator.comparingInt(e -> e.getOrdinal() == null ? 0 : e.getOrdinal()))
                    .map(e -> new com.placement.dto.CodingDtos.ProblemExample(
                            safe(e.getTitle()),
                            safe(e.getInput()),
                            safe(e.getOutput()),
                            safe(e.getExplanation())))
                    .toList();
        }
        // Fallback: synthesize Example 1 from the legacy sampleInput/sampleOutput columns
        List<com.placement.dto.CodingDtos.ProblemExample> out = new ArrayList<>();
        if (problem.getSampleInput() != null || problem.getSampleOutput() != null) {
            out.add(new com.placement.dto.CodingDtos.ProblemExample("Example 1",
                    safe(problem.getSampleInput()), safe(problem.getSampleOutput()), null));
        }
        return out;
    }

    private List<String> resolveConstraints(CodingProblem problem) {
        List<ProblemConstraint> stored = problem.getConstraints();
        if (stored != null && !stored.isEmpty()) {
            return stored.stream()
                    .sorted(Comparator.comparingInt(c -> c.getOrdinal() == null ? 0 : c.getOrdinal()))
                    .map(ProblemConstraint::getText)
                    .filter(Objects::nonNull)
                    .toList();
        }
        return defaultConstraints(problem);
    }

    private Map<String, String> resolveTemplates(CodingProblem problem) {
        Map<String, String> stored = problem.getTemplates();
        Map<String, String> out = new LinkedHashMap<>();
        // There is currently no code path that creates a CodingProblem without methodName/
        // returnType (every DataLoader-seeded problem sets both) - but if a future admin-CRUD or
        // question-bank auto-promotion path ever does, this must be loud, not silent: rendering
        // an unmarked generic "Object solve()" stub is exactly the bug Section 4 exists to kill.
        boolean missingSignature = problem.getMethodName() == null || problem.getReturnType() == null;
        if (missingSignature) {
            log.warn("CodingProblem id={} title=\"{}\" has no authored function signature "
                            + "(methodName={}, returnType={}) - falling back to a generic stub. "
                            + "This problem needs a real signature authored before it's shown to candidates.",
                    problem.getId(), problem.getTitle(), problem.getMethodName(), problem.getReturnType());
        }
        String methodName = problem.getMethodName() != null ? problem.getMethodName() : "solve";
        List<ParameterSpec> params = problem.getParameters() != null ? problem.getParameters() : List.of();
        // Falls back to "object" (not a specific type) only for the handful of legacy problems
        // that predate this field - every problem seeded going forward has a real one.
        String returnType = problem.getReturnType() != null ? problem.getReturnType() : "object";

        for (LanguageConfig lang : supportedLanguages()) {
            String custom = stored != null ? stored.get(lang.id()) : null;
            if (custom != null && !custom.isBlank()) {
                out.put(lang.id(), custom);
                continue;
            }
            switch (lang.id()) {
                case "java" -> out.put(lang.id(), javaTemplate(methodName, params, returnType));
                case "python" -> out.put(lang.id(), pythonTemplate(methodName, params));
                case "javascript" -> out.put(lang.id(), javascriptTemplate(methodName, params));
                case "cpp" -> out.put(lang.id(), cppTemplate(methodName, params, returnType));
                default -> out.put(lang.id(), "");
            }
        }
        return out;
    }

    // =====================================================================================
    // Defaults (backward compat for problems inserted before this entity expansion)
    // =====================================================================================

    private String safe(String value) { return value == null ? "" : value; }

    private List<String> defaultConstraints(CodingProblem problem) {
        return List.of(
                "Use the function signature from the selected language template.",
                "Handle empty, boundary and duplicate cases where applicable.",
                String.format("Expected time and memory limits: %d ms and %d MB.",
                        problem.getTimeLimitMs() != null ? problem.getTimeLimitMs() : 1000,
                        problem.getMemoryLimitMb() != null ? problem.getMemoryLimitMb() : 256),
                "Hidden tests are evaluated server-side when an isolated runner is configured."
        );
    }

    private double acceptanceRate(Difficulty difficulty) {
        if (difficulty == Difficulty.EASY) return 74.2;
        if (difficulty == Difficulty.HARD) return 38.6;
        return 56.4;
    }

    /** Data-structure types (Section 4: "supporting type definitions like ListNode, TreeNode,
     *  GraphNode") referenced by a signature need their class actually defined in the boilerplate,
     *  or the stub won't even compile. Injected as a preamble above `class Solution` only when the
     *  signature actually references them, so simple int/String/array problems stay uncluttered. */
    private static final String JAVA_LIST_NODE = """
            class ListNode {
                int val;
                ListNode next;
                ListNode() {}
                ListNode(int val) { this.val = val; }
                ListNode(int val, ListNode next) { this.val = val; this.next = next; }
            }
            """;
    private static final String JAVA_TREE_NODE = """
            class TreeNode {
                int val;
                TreeNode left;
                TreeNode right;
                TreeNode() {}
                TreeNode(int val) { this.val = val; }
                TreeNode(int val, TreeNode left, TreeNode right) { this.val = val; this.left = left; this.right = right; }
            }
            """;
    private static final String JAVA_GRAPH_NODE = """
            class Node {
                int val;
                List<Node> neighbors;
                Node() { neighbors = new ArrayList<>(); }
                Node(int val) { this.val = val; neighbors = new ArrayList<>(); }
            }
            """;
    private static final String CPP_LIST_NODE = """
            struct ListNode {
                int val;
                ListNode *next;
                ListNode() : val(0), next(nullptr) {}
                ListNode(int x) : val(x), next(nullptr) {}
                ListNode(int x, ListNode *next) : val(x), next(next) {}
            };
            """;
    private static final String CPP_TREE_NODE = """
            struct TreeNode {
                int val;
                TreeNode *left;
                TreeNode *right;
                TreeNode() : val(0), left(nullptr), right(nullptr) {}
                TreeNode(int x) : val(x), left(nullptr), right(nullptr) {}
                TreeNode(int x, TreeNode *left, TreeNode *right) : val(x), left(left), right(right) {}
            };
            """;
    private static final String CPP_GRAPH_NODE = """
            class Node {
            public:
                int val;
                std::vector<Node*> neighbors;
                Node() { val = 0; }
                Node(int _val) { val = _val; }
            };
            """;

    private String javaPreamble(List<ParameterSpec> params, String returnType) {
        StringBuilder sb = new StringBuilder();
        Set<String> types = referencedLogicalTypes(params, returnType);
        if (types.contains("listnode") || types.contains("listnode[]")) sb.append(JAVA_LIST_NODE).append("\n");
        if (types.contains("treenode")) sb.append(JAVA_TREE_NODE).append("\n");
        if (types.contains("graphnode")) sb.append(JAVA_GRAPH_NODE).append("\n");
        return sb.toString();
    }

    private String cppPreamble(List<ParameterSpec> params, String returnType) {
        StringBuilder sb = new StringBuilder();
        Set<String> types = referencedLogicalTypes(params, returnType);
        if (types.contains("listnode") || types.contains("listnode[]")) sb.append(CPP_LIST_NODE).append("\n");
        if (types.contains("treenode")) sb.append(CPP_TREE_NODE).append("\n");
        if (types.contains("graphnode")) sb.append(CPP_GRAPH_NODE).append("\n");
        return sb.toString();
    }

    private Set<String> referencedLogicalTypes(List<ParameterSpec> params, String returnType) {
        Set<String> types = params.stream().map(p -> p.type() == null ? "" : p.type().toLowerCase())
                .collect(Collectors.toCollection(java.util.LinkedHashSet::new));
        types.add(returnType == null ? "" : returnType.toLowerCase());
        return types;
    }

    private String javaTemplate(String methodName, List<ParameterSpec> params, String returnType) {
        String paramList = params.stream()
                .map(p -> String.format("%s %s", javaType(p.type()), p.name()))
                .collect(Collectors.joining(", "));
        return javaPreamble(params, returnType) + String.format("""
                class Solution {
                    public %s %s(%s) {
                        // Implement your solution here
                        return %s;
                    }
                }
                """,
                javaType(returnType),
                methodName,
                paramList,
                javaDefaultReturn(returnType));
    }

    private String pythonTemplate(String methodName, List<ParameterSpec> params) {
        String paramList = "self, " + params.stream()
                .map(ParameterSpec::name)
                .collect(Collectors.joining(", "));
        return String.format("""
                class Solution:
                    def %s(%s):
                        # Implement your solution here
                        return None
                """,
                methodName,
                paramList);
    }

    private String javascriptTemplate(String methodName, List<ParameterSpec> params) {
        String paramList = params.stream()
                .map(ParameterSpec::name)
                .collect(Collectors.joining(", "));
        return String.format("""
                class Solution {
                  %s(%s) {
                    // Implement your solution here
                    return null;
                  }
                }
                """,
                methodName,
                paramList);
    }

    private String cppTemplate(String methodName, List<ParameterSpec> params, String returnType) {
        String paramList = params.stream()
                .map(p -> String.format("%s %s", cppType(p.type()), p.name()))
                .collect(Collectors.joining(", "));
        return cppPreamble(params, returnType) + String.format("""
                class Solution {
                public:
                    %s %s(%s) {
                        // Implement your solution here
                        return %s;
                    }
                };
                """,
                cppType(returnType),
                methodName,
                paramList,
                cppDefaultReturn(returnType));
    }

    /** Logical -> Java type mapping (Section 4). Covers primitives, arrays/2D arrays, common
     *  generic collections, and the injected data-structure classes above - not exhaustive, but
     *  covers every type actually used across the seeded question bank (see DataLoader). */
    private String javaType(String logicalType) {
        if (logicalType == null) return "Object";
        return switch (logicalType.toLowerCase()) {
            case "int", "integer", "number" -> "int";
            case "long" -> "long";
            case "float" -> "float";
            case "double" -> "double";
            case "bool", "boolean" -> "boolean";
            case "string", "str" -> "String";
            case "char[][]", "char grid" -> "char[][]";
            case "int[]", "int array", "array<int>" -> "int[]";
            case "int[][]", "int matrix", "array<array<int>>" -> "int[][]";
            case "string[]" -> "String[]";
            case "list<int>" -> "List<Integer>";
            case "list<string>" -> "List<String>";
            case "list<list<int>>" -> "List<List<Integer>>";
            case "list<list<string>>" -> "List<List<String>>";
            case "listnode" -> "ListNode";
            case "listnode[]" -> "ListNode[]";
            case "treenode" -> "TreeNode";
            case "graphnode" -> "Node";
            case "void" -> "void";
            default -> "Object";
        };
    }

    private String cppType(String logicalType) {
        if (logicalType == null) return "void*";
        return switch (logicalType.toLowerCase()) {
            case "int", "integer", "number" -> "int";
            case "long" -> "long long";
            case "float" -> "float";
            case "double" -> "double";
            case "bool", "boolean" -> "bool";
            case "string", "str" -> "std::string";
            case "char[][]", "char grid" -> "std::vector<std::vector<char>>";
            case "int[]", "int array", "array<int>" -> "std::vector<int>";
            case "int[][]", "int matrix", "array<array<int>>" -> "std::vector<std::vector<int>>";
            case "string[]" -> "std::vector<std::string>";
            case "list<int>" -> "std::vector<int>";
            case "list<string>" -> "std::vector<std::string>";
            case "list<list<int>>" -> "std::vector<std::vector<int>>";
            case "list<list<string>>" -> "std::vector<std::vector<std::string>>";
            case "listnode" -> "ListNode*";
            case "listnode[]" -> "std::vector<ListNode*>";
            case "treenode" -> "TreeNode*";
            case "graphnode" -> "Node*";
            case "void" -> "void";
            default -> "void*";
        };
    }

    /** A syntactically valid placeholder return statement for the boilerplate's TODO body, based
     *  on the real return type - "return null;" for an int would not even compile. */
    private String javaDefaultReturn(String returnType) {
        String t = returnType == null ? "" : returnType.toLowerCase();
        return switch (t) {
            case "int", "integer", "number" -> "0";
            case "long" -> "0L";
            case "float" -> "0f";
            case "double" -> "0.0";
            case "bool", "boolean" -> "false";
            case "list<int>", "list<string>", "list<list<int>>", "list<list<string>>" -> "new ArrayList<>()";
            case "int[]" -> "new int[0]";
            case "int[][]" -> "new int[0][0]";
            case "string[]" -> "new String[0]";
            case "void" -> "";
            default -> "null";
        };
    }

    private String cppDefaultReturn(String returnType) {
        String t = returnType == null ? "" : returnType.toLowerCase();
        return switch (t) {
            case "int", "integer", "number" -> "0";
            case "long" -> "0";
            case "float", "double" -> "0.0";
            case "bool", "boolean" -> "false";
            case "string", "str" -> "\"\"";
            case "list<int>", "int[]" -> "{}";
            case "list<string>", "string[]" -> "{}";
            case "list<list<int>>", "int[][]" -> "{}";
            case "list<list<string>>" -> "{}";
            case "void" -> "";
            default -> "nullptr";
        };
    }
}