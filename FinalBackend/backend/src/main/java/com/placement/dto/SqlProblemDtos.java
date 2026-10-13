package com.placement.dto;

import java.util.List;

public class SqlProblemDtos {

    public record SqlProblemStudentResponse(
            Long id,
            String title,
            String problemStatement,
            String difficulty,
            String[] topics,
            String[] subtopics,
            String executionConfig,
            String starterQuery,
            String explanation,
            String sourceUrl,
            String testCasesJson
    ) {}

    public record SqlProblemAdminResponse(
            Long id,
            String sourceQuestionId,
            String title,
            String problemStatement,
            String difficulty,
            String[] topics,
            String[] subtopics,
            String[] tags,
            String[] companies,
            String sourceUrl,
            String executionConfig,
            String testCasesJson,
            String starterQuery,
            String explanation,
            boolean active
    ) {
        public static SqlProblemAdminResponse from(com.placement.entity.CodingProblem p) {
            return new SqlProblemAdminResponse(
                    p.getId(),
                    p.getSourceQuestionId(),
                    p.getTitle(),
                    p.getStatement() != null ? p.getStatement() : "",
                    p.getDifficulty() != null ? p.getDifficulty().name() : null,
                    p.getTopics(),
                    p.getSubtopics(),
                    p.getTags(),
                    p.getCompanies(),
                    p.getSourceUrl(),
                    p.getExecutionConfig(),
                    p.getTestCasesJson(),
                    p.getStarterQuery(),
                    p.getExplanation(),
                    p.isActive()
            );
        }
    }

    public record SqlProblemUpsertRequest(
            String sourceQuestionId,
            String title,
            String problemStatement,
            String difficulty,
            String[] topics,
            String[] subtopics,
            String[] tags,
            String[] companies,
            String sourceUrl,
            String executionConfig,
            String testCasesJson,
            String starterQuery,
            String explanation,
            boolean active
    ) {}

    public record SqlRunRequest(
            String problemId,
            String sql
    ) {}

    public record SqlSubmitRequest(
            String problemId,
            String sql
    ) {}

    public record SqlTestCaseResult(
            String testCaseId,
            boolean passed,
            String message
    ) {}

    public record SqlExecutionResult(
            String status,
            long executionTimeMs,
            int rowsReturned,
            List<String> columns,
            List<List<Object>> rows,
            List<SqlTestCaseResult> testCaseResults,
            Double score
    ) {}

    public record SqlProblemPage(
            List<SqlProblemAdminResponse> content,
            long totalElements,
            int totalPages,
            int page,
            int size
    ) {}

    public record SqlStudentProblemPage(
            List<SqlProblemStudentResponse> content,
            long totalElements,
            int totalPages,
            int page,
            int size
    ) {}
}
