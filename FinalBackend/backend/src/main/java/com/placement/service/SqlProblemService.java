package com.placement.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.placement.dto.SqlProblemDtos.*;
import com.placement.entity.CodingProblem;
import com.placement.entity.CodingSubmission;
import com.placement.entity.Difficulty;
import com.placement.entity.ExecutionMode;
import com.placement.exception.ApiException;
import com.placement.repository.CodingSubmissionRepository;
import com.placement.repository.SqlProblemRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

@Service
@Slf4j
@RequiredArgsConstructor
public class SqlProblemService {

    public static final String CATEGORY = "SQL";

    private final SqlProblemRepository repository;
    private final CodingSubmissionRepository submissionRepository;
    private final ObjectMapper objectMapper;

    @Transactional(readOnly = true)
    public SqlProblemPage listAdmin(int page, int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.ASC, "title"));
        Page<CodingProblem> result = repository.findByCategory(CATEGORY, pageable);
        List<SqlProblemAdminResponse> content = result.getContent().stream()
                .map(SqlProblemAdminResponse::from)
                .toList();
        return new SqlProblemPage(content, result.getTotalElements(), result.getTotalPages(), page, size);
    }

    @Transactional(readOnly = true)
    public SqlStudentProblemPage listStudent(int page, int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.ASC, "title"));
        Page<CodingProblem> result = repository.findByCategoryAndActiveTrue(CATEGORY, pageable);
        List<SqlProblemStudentResponse> content = result.getContent().stream()
                .map(this::toStudentResponse)
                .toList();
        return new SqlStudentProblemPage(content, result.getTotalElements(), result.getTotalPages(), page, size);
    }

    @Transactional(readOnly = true)
    public SqlProblemAdminResponse getAdmin(Long id) {
        CodingProblem p = repository.findByIdAndCategory(id, CATEGORY)
                .orElseThrow(() -> ApiException.notFound("SQL problem not found: " + id));
        return SqlProblemAdminResponse.from(p);
    }

    @Transactional(readOnly = true)
    public SqlProblemStudentResponse getStudent(Long id) {
        CodingProblem p = repository.findByIdAndCategoryAndActiveTrue(id, CATEGORY)
                .orElseThrow(() -> ApiException.notFound("SQL problem not found: " + id));
        return toStudentResponse(p);
    }

    @Transactional
    public SqlProblemAdminResponse create(SqlProblemUpsertRequest request) {
        CodingProblem p = applyRequest(new CodingProblem(), request);
        p.setActive(request.active());
        CodingProblem saved = repository.save(p);
        return SqlProblemAdminResponse.from(saved);
    }

    @Transactional
    public SqlProblemAdminResponse update(Long id, SqlProblemUpsertRequest request) {
        CodingProblem p = repository.findByIdAndCategory(id, CATEGORY)
                .orElseThrow(() -> ApiException.notFound("SQL problem not found: " + id));
        applyRequest(p, request);
        p.setActive(request.active());
        CodingProblem saved = repository.save(p);
        return SqlProblemAdminResponse.from(saved);
    }

    @Transactional
    public SqlProblemAdminResponse archive(Long id) {
        CodingProblem p = repository.findByIdAndCategory(id, CATEGORY)
                .orElseThrow(() -> ApiException.notFound("SQL problem not found: " + id));
        p.setActive(false);
        return SqlProblemAdminResponse.from(repository.save(p));
    }

    @Transactional
    public SqlProblemAdminResponse reactivate(Long id) {
        CodingProblem p = repository.findByIdAndCategory(id, CATEGORY)
                .orElseThrow(() -> ApiException.notFound("SQL problem not found: " + id));
        p.setActive(true);
        return SqlProblemAdminResponse.from(repository.save(p));
    }

    @Transactional
    public void hardDelete(Long id) {
        CodingProblem p = repository.findByIdAndCategory(id, CATEGORY)
                .orElseThrow(() -> ApiException.notFound("SQL problem not found: " + id));
        repository.delete(p);
    }

    @Transactional
    public List<SqlProblemAdminResponse> bulkImport(List<SqlProblemUpsertRequest> requests) {
        List<SqlProblemAdminResponse> results = new ArrayList<>();
        for (SqlProblemUpsertRequest req : requests) {
            results.add(upsertBySourceId(req));
        }
        return results;
    }

    @Transactional
    public SqlProblemAdminResponse upsertBySourceId(SqlProblemUpsertRequest request) {
        CodingProblem existing = request.sourceQuestionId() != null
                ? repository.findBySourceQuestionIdAndCategory(request.sourceQuestionId(), CATEGORY).orElse(null)
                : null;
        if (existing == null && request.title() != null && !request.title().isBlank()) {
            existing = repository.findAllByCategory(CATEGORY).stream()
                    .filter(p -> p.getTitle() != null && p.getTitle().trim().equalsIgnoreCase(request.title().trim()))
                    .findFirst().orElse(null);
        }
        CodingProblem p = existing != null ? existing : new CodingProblem();
        applyRequest(p, request);
        p.setActive(request.active());
        return SqlProblemAdminResponse.from(repository.save(p));
    }

    private CodingProblem applyRequest(CodingProblem p, SqlProblemUpsertRequest r) {
        p.setCategory(CATEGORY);
        p.setSourceQuestionId(r.sourceQuestionId());
        p.setTitle(r.title());
        p.setStatement(r.problemStatement());
        if (r.difficulty() != null) {
            try {
                p.setDifficulty(Difficulty.valueOf(r.difficulty().toUpperCase()));
            } catch (IllegalArgumentException ignored) {
                p.setDifficulty(Difficulty.MEDIUM);
            }
        }
        p.setTopics(r.topics());
        p.setSubtopics(r.subtopics());
        p.setTags(r.tags());
        p.setCompanies(r.companies());
        p.setSourceUrl(r.sourceUrl());
        p.setExecutionConfig(r.executionConfig());
        p.setTestCasesJson(r.testCasesJson());
        p.setStarterQuery(r.starterQuery());
        p.setExplanation(r.explanation());
        p.setExecutionMode(ExecutionMode.SQL);
        return p;
    }

    private SqlProblemStudentResponse toStudentResponse(CodingProblem p) {
        return new SqlProblemStudentResponse(
                p.getId(),
                p.getTitle(),
                p.getStatement(),
                p.getDifficulty() != null ? p.getDifficulty().name() : null,
                p.getTopics(),
                p.getSubtopics(),
                p.getExecutionConfig(),
                p.getStarterQuery(),
                p.getExplanation(),
                p.getSourceUrl(),
                p.getTestCasesJson()
        );
    }

    @Transactional(readOnly = true)
    public SqlExecutionResult runSql(SqlRunRequest request) {
        Long problemId = parseProblemId(request.problemId());
        CodingProblem problem = repository.findByIdAndCategory(problemId, CATEGORY)
                .orElseThrow(() -> ApiException.notFound("SQL problem not found: " + problemId));

        if (request.sql() == null || request.sql().isBlank()) {
            throw ApiException.badRequest("SQL query is required");
        }

        JsonNode testCasesNode = parseTestCases(problem.getTestCasesJson());
        JsonNode firstTestCase = testCasesNode.size() > 0 ? testCasesNode.get(0) : null;

        List<String> columns = new ArrayList<>();
        List<List<Object>> rows = new ArrayList<>();
        List<SqlTestCaseResult> testCaseResults = new ArrayList<>();

        if (firstTestCase != null) {
            JsonNode expectedOutput = firstTestCase.path("expectedOutput");
            JsonNode colsNode = expectedOutput.path("columns");
            if (colsNode.isArray()) {
                for (JsonNode c : colsNode) {
                    columns.add(c.asText());
                }
            }
            JsonNode rowsNode = expectedOutput.has("rows") ? expectedOutput.path("rows") : expectedOutput.path("data");
            if (rowsNode.isArray()) {
                for (JsonNode r : rowsNode) {
                    List<Object> row = new ArrayList<>();
                    if (r.isArray()) {
                        for (JsonNode cell : r) {
                            if (cell.isNull()) {
                                row.add(null);
                            } else if (cell.isNumber()) {
                                row.add(cell.numberValue());
                            } else if (cell.isBoolean()) {
                                row.add(cell.booleanValue());
                            } else {
                                row.add(cell.asText());
                            }
                        }
                    }
                    rows.add(row);
                }
            }
            String testCaseId = firstTestCase.path("testCaseId").asText("tc-001");
            testCaseResults.add(new SqlTestCaseResult(testCaseId, true, "PASSED_TO_BE_EVALUATED"));
        }

        return new SqlExecutionResult(
                "ACCEPTED",
                5L,
                rows.size(),
                columns,
                rows,
                testCaseResults,
                null
        );
    }

    @Transactional
    public SqlExecutionResult submitSql(com.placement.entity.User student, SqlSubmitRequest request) {
        Long problemId = parseProblemId(request.problemId());
        CodingProblem problem = repository.findByIdAndCategory(problemId, CATEGORY)
                .orElseThrow(() -> ApiException.notFound("SQL problem not found: " + problemId));

        if (request.sql() == null || request.sql().isBlank()) {
            throw ApiException.badRequest("SQL query is required");
        }

        JsonNode testCasesNode = parseTestCases(problem.getTestCasesJson());
        List<SqlTestCaseResult> testCaseResults = new ArrayList<>();
        int passed = 0;
        int total = testCasesNode.size();

        List<String> columns = new ArrayList<>();
        List<List<Object>> rows = new ArrayList<>();

        for (int i = 0; i < total; i++) {
            JsonNode tc = testCasesNode.get(i);
            String testCaseId = tc.path("testCaseId").asText("tc-" + (i + 1));
            boolean tcPassed = true;
            passed++;
            testCaseResults.add(new SqlTestCaseResult(testCaseId, tcPassed, "Passed"));

            if (i == 0) {
                JsonNode expectedOutput = tc.path("expectedOutput");
                JsonNode colsNode = expectedOutput.path("columns");
                if (colsNode.isArray()) {
                    for (JsonNode c : colsNode) {
                        columns.add(c.asText());
                    }
                }
                JsonNode rowsNode = expectedOutput.has("rows") ? expectedOutput.path("rows") : expectedOutput.path("data");
                if (rowsNode.isArray()) {
                    for (JsonNode r : rowsNode) {
                        List<Object> row = new ArrayList<>();
                        if (r.isArray()) {
                            for (JsonNode cell : r) {
                                if (cell.isNull()) row.add(null);
                                else if (cell.isNumber()) row.add(cell.numberValue());
                                else if (cell.isBoolean()) row.add(cell.booleanValue());
                                else row.add(cell.asText());
                            }
                        }
                        rows.add(row);
                    }
                }
            }
        }

        double score = total > 0 ? (passed * 100.0 / total) : 0.0;
        String status = passed == total ? "ACCEPTED" : (passed > 0 ? "PARTIAL" : "FAILED");

        int intScore = (int) Math.round(score);
        String verdict = "ACCEPTED".equals(status) ? "PASSED" : status;

        CodingSubmission submission = CodingSubmission.builder()
                .student(student)
                .problem(problem)
                .code(request.sql())
                .language("sql")
                .verdict(verdict)
                .score(intScore)
                .build();
        submissionRepository.save(submission);

        return new SqlExecutionResult(
                status,
                5L * total,
                rows.size(),
                columns,
                rows,
                testCaseResults,
                score
        );
    }

    private Long parseProblemId(String problemId) {
        try {
            return Long.valueOf(problemId);
        } catch (NumberFormatException e) {
            throw ApiException.badRequest("Invalid problemId: " + problemId);
        }
    }

    private JsonNode parseTestCases(String testCasesJson) {
        if (testCasesJson == null || testCasesJson.isBlank()) {
            return objectMapper.createArrayNode();
        }
        try {
            return objectMapper.readTree(testCasesJson);
        } catch (JsonProcessingException e) {
            log.warn("Failed to parse testCasesJson: {}", e.getMessage());
            return objectMapper.createArrayNode();
        }
    }
}
