package com.placement.dto;

import java.util.List;

public class DataFrameProblemDtos {

    public record DataFrameProblemStudentResponse(
            Long id,
            String title,
            String problemStatement,
            String difficulty,
            String[] topics,
            String[] subtopics,
            String executionConfig,
            String starterCode,
            String explanation,
            String sourceUrl,
            String testCasesJson
    ) {}

    public record DataFrameProblemAdminResponse(
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
            String starterCode,
            String explanation,
            boolean active
    ) {
        public static DataFrameProblemAdminResponse from(com.placement.entity.CodingProblem p) {
            return new DataFrameProblemAdminResponse(
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

    public record DataFrameProblemUpsertRequest(
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
            String starterCode,
            String explanation,
            boolean active
    ) {}

    public record DataFrameRunRequest(
            String problemId,
            String pythonCode,
            String code
    ) {
        public String effectiveCode() {
            if (pythonCode != null && !pythonCode.isBlank()) return pythonCode;
            return code;
        }
    }

    public record DataFrameSubmitRequest(
            String problemId,
            String pythonCode,
            String code
    ) {
        public String effectiveCode() {
            if (pythonCode != null && !pythonCode.isBlank()) return pythonCode;
            return code;
        }
    }

    public record DataFrameTestCaseResult(
            String testCaseId,
            boolean passed,
            String message
    ) {}

    public record DataFrameExecutionResult(
            String status,
            long executionTimeMs,
            int rowsReturned,
            List<String> columns,
            List<List<Object>> rows,
            List<DataFrameTestCaseResult> testCaseResults,
            Double score
    ) {}

    public record DataFrameProblemPage(
            List<DataFrameProblemAdminResponse> content,
            long totalElements,
            int totalPages,
            int page,
            int size
    ) {}

    public record DataFrameStudentProblemPage(
            List<DataFrameProblemStudentResponse> content,
            long totalElements,
            int totalPages,
            int page,
            int size
    ) {}
}
