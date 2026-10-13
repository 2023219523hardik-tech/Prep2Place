package com.placement.dto;

import java.util.List;
import java.util.Map;

public class CodingDtos {
    public record SubmitCodeRequest(Long problemId, String code, String language) {}
    public record SubmissionResponse(Long submissionId, Long problemId, String problemTitle, String verdict,
                                      Integer score, String submittedAt) {}
    public record LanguageConfig(String id, String name, String version, String editorLanguage,
                                 String template, String executionMode) {}
    public record ProblemExample(String title, String input, String output, String explanation) {
        public ProblemExample(String title, String input, String output) {
            this(title, input, output, null);
        }
    }
    public record ProblemMetadataResponse(Long id, String title, String difficulty, List<String> topics,
                                          String description, List<String> constraints,
                                          List<ProblemExample> examples,
                                          List<LanguageConfig> supportedLanguages,
                                          Map<String, String> templates,
                                          Integer timeLimitMs, Integer memoryLimitMb,
                                          Double acceptanceRate) {}
    public record CodeTestCase(String name, String input, String expectedOutput, Boolean hidden) {}
    public record RunCodeRequest(Long problemId, String language, String code, List<CodeTestCase> testCases) {}
    /** hidden mirrors the source CodeTestCase's flag, set at construction in CodingRunnerService.
     *  buildConsole() uses it to keep a hidden case's name/input/expected/actual/error out of the
     *  console text sent to the student - see buildConsole's comment for why. */
    public record TestCaseResult(String name, String status, String input, String expected, String actual,
                                 Integer runtimeMs, Double memoryMb, String error, Boolean hidden) {}
    public record RunCodeResponse(String status, List<TestCaseResult> results, String console,
                                  Integer passed, Integer total, Integer runtimeMs, Double memoryMb) {}
    public record SubmitCodeResponse(String status, Integer passed, Integer total, Integer runtimeMs,
                                     Double memoryMb, Integer score, String verdict,
                                     Long submissionId, String console) {}

    // ------------------------------------------------------------------------- admin CRUD ------
    // Previously CodingProblem/ProblemExample/ProblemConstraint had no admin write path at all -
    // same gap as TechnicalMcqQuestion and AptitudeQuestion before them. These DTOs back the new
    // CodingProblemAdminController/CodingProblemAdminService.

    public record ProblemExampleAdminDto(String title, String input, String output, String explanation, boolean hidden) {}
    public record ProblemConstraintAdminDto(String text) {}

    public record CodingProblemAdminView(Long id, String title, String statement, String topic, String difficulty,
            String sampleInput, String sampleOutput, List<ProblemExampleAdminDto> examples,
            List<ProblemConstraintAdminDto> constraints, Map<String, String> templates,
            Integer timeLimitMs, Integer memoryLimitMb, Double acceptanceRate, String companyTags,
            String methodName, String returnType, List<com.placement.entity.ParameterSpec> parameters,
            String executionMode, String schemaDdl, String expectedOutput,
            boolean active, Long canonicalQuestionId, String sourceQuestionId) {

        public static CodingProblemAdminView from(com.placement.entity.CodingProblem p) {
            return new CodingProblemAdminView(
                    p.getId(), p.getTitle(), p.getStatement(), p.getTopic(),
                    p.getDifficulty() == null ? null : p.getDifficulty().name(),
                    p.getSampleInput(), p.getSampleOutput(),
                    p.getExamples().stream()
                            .map(e -> new ProblemExampleAdminDto(e.getTitle(), e.getInput(), e.getOutput(), e.getExplanation(), e.isHidden()))
                            .toList(),
                    p.getConstraints().stream().map(c -> new ProblemConstraintAdminDto(c.getText())).toList(),
                    p.getTemplates(), p.getTimeLimitMs(), p.getMemoryLimitMb(), p.getAcceptanceRate(),
                    p.getCompanyTags(), p.getMethodName(), p.getReturnType(), p.getParameters(),
                    p.getExecutionMode() == null ? null : p.getExecutionMode().name(),
                    p.getSchemaDdl(), p.getExpectedOutput(),
                    p.isActive(), p.getCanonicalQuestionId(), p.getSourceQuestionId());
        }
    }

    /** Create/update payload. canonicalQuestionId/sourceQuestionId are deliberately absent - both
     *  are reserved for the seed/sync loaders (see CodingProblem's own javadoc: "Null for
     *  hand-curated problems created via DataLoader or the admin API"), so an admin-authored
     *  problem never collides with the sourceQuestionId uniqueness index used for idempotent
     *  seed upserts. Every field here overwrites on update, same full-overwrite reasoning as
     *  TechnicalMcqUpsertRequest and AptitudeQuestionUpsertRequest: examples/constraints are one
     *  coherent unit with the rest of the problem, not something to PATCH-merge. */
    public record CodingProblemUpsertRequest(String title, String statement, String topic, String difficulty,
            String sampleInput, String sampleOutput, List<ProblemExampleAdminDto> examples,
            List<ProblemConstraintAdminDto> constraints, Map<String, String> templates,
            Integer timeLimitMs, Integer memoryLimitMb, Double acceptanceRate, String companyTags,
            String methodName, String returnType, List<com.placement.entity.ParameterSpec> parameters,
            String executionMode,
            /** SQL/DATAFRAME modes only - see CodingProblem.schemaDdl/expectedOutput's javadoc. */
            String schemaDdl, String expectedOutput) {}

    public record CodingProblemAdminPage(List<CodingProblemAdminView> content, long totalElements,
                                          int totalPages, int page, int size) {}
}