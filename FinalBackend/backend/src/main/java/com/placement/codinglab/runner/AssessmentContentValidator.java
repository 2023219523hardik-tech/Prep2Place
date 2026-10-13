package com.placement.codinglab.runner;

import com.placement.codinglab.entity.CodingRuntime;
import com.placement.codinglab.entity.CodingType;
import com.placement.codinglab.model.AssessmentBlueprint;
import com.placement.codinglab.model.RequirementSpec;
import com.placement.codinglab.model.ValidationIssue;

import java.util.*;
import java.util.regex.Pattern;

/**
 * Static "is this a proper question?" checks - no sandbox needed. This is the single definition of the
 * requirements every question must meet, applied to manual, AI-generated and imported questions alike.
 * (Whether the tests actually behave is checked separately, by running them: {@code AssessmentVerifier}.)
 */
public final class AssessmentContentValidator {

    public static final Pattern REQ_ID = Pattern.compile("R([1-9]\\d?)");
    public static final int MIN_STATEMENT = 80;

    private AssessmentContentValidator() {}

    public static List<ValidationIssue> validate(AssessmentBlueprint b) {
        List<ValidationIssue> out = new ArrayList<>();
        if (b.title() == null || b.title().strip().length() < 5) out.add(ValidationIssue.error("title", "Give the question a clear title (at least 5 characters)."));
        if (b.codingType() == null) out.add(ValidationIssue.error("codingType", "Choose a track: Backend, Frontend, ML, AI, GenAI or RAG."));
        if (b.difficulty() == null) out.add(ValidationIssue.error("difficulty", "Choose a difficulty."));
        CodingRuntime rt = b.runtime();
        if (rt == null) {
            out.add(ValidationIssue.error("runtime", "Choose the runtime the code runs on (Java/JUnit, Node, or Python/pytest)."));
        } else if (b.codingType() == CodingType.FRONTEND && rt != CodingRuntime.NODE_TEST) {
            out.add(ValidationIssue.error("runtime", "Frontend questions must use the Node runtime (it provides React + a DOM for the tests)."));
        } else if (b.codingType() != null && b.codingType() != CodingType.BACKEND && b.codingType() != CodingType.FRONTEND
                && rt != CodingRuntime.PYTHON_PYTEST) {
            out.add(ValidationIssue.warning("runtime", "ML / AI / GenAI / RAG questions normally use Python (numpy, pandas and scikit-learn are installed)."));
        }
        if (b.timeLimitMinutes() != null && (b.timeLimitMinutes() < 10 || b.timeLimitMinutes() > 240)) {
            out.add(ValidationIssue.error("timeLimitMinutes", "Time limit must be between 10 and 240 minutes."));
        }

        String statement = b.problemStatement() == null ? "" : b.problemStatement().strip();
        if (statement.length() < MIN_STATEMENT) {
            out.add(ValidationIssue.error("problemStatement", "Write the scenario and task (at least " + MIN_STATEMENT + " characters): what to build, inputs/outputs, edge cases."));
        }
        if (b.summary() == null || b.summary().isBlank()) out.add(ValidationIssue.warning("summary", "A one-line summary makes the question easier to find in the catalogue."));

        validateRequirements(b, out);

        if (rt != null) {
            fileChecks(out, "starterFiles", b.starter(), null, true, rt);
            fileChecks(out, "referenceFiles", b.reference(), null, true, rt);
            fileChecks(out, "publicTestFiles", b.publicTests(), WorkspaceRules.PUBLIC_DIR, false, rt);
            fileChecks(out, "hiddenTestFiles", b.hiddenTests(), WorkspaceRules.HIDDEN_DIR, false, rt);
            if (b.starter().isEmpty()) out.add(ValidationIssue.error("starterFiles", "Provide starter files - the code the candidate starts from."));
            if (b.reference().isEmpty()) out.add(ValidationIssue.error("referenceFiles", "Provide a reference solution. It is never shown to candidates; it is used to prove the tests can pass."));
            requireTests(out, "publicTestFiles", b.publicTests(), rt, "Provide at least one public test (visible to candidates, run on every Run).");
            requireTests(out, "hiddenTestFiles", b.hiddenTests(), rt, "Provide at least one hidden test (only run on Submit, never shown).");
        }
        return out;
    }

    public static boolean hasErrors(List<ValidationIssue> issues) {
        return issues.stream().anyMatch(i -> i.severity() == ValidationIssue.Severity.ERROR);
    }

    private static void validateRequirements(AssessmentBlueprint b, List<ValidationIssue> out) {
        List<RequirementSpec> reqs = b.requirementsOrEmpty();
        if (reqs.size() < 2 || reqs.size() > 10) {
            out.add(ValidationIssue.error("requirements", "List between 2 and 10 requirements (acceptance criteria) - each one is scored by tests tagged with its id."));
        }
        Set<String> seen = new HashSet<>();
        for (RequirementSpec r : reqs) {
            if (r.id() == null || !REQ_ID.matcher(r.id()).matches()) {
                out.add(ValidationIssue.error("requirements", "Requirement id '" + r.id() + "' is invalid - use R1, R2, R3 ..."));
            } else if (!seen.add(r.id())) {
                out.add(ValidationIssue.error("requirements", "Duplicate requirement id " + r.id()));
            }
            if (r.title() == null || r.title().strip().length() < 5) out.add(ValidationIssue.error("requirements", "Requirement " + r.id() + " needs a title of at least 5 characters."));
            if (r.weight() != null && r.weight() <= 0) out.add(ValidationIssue.error("requirements", "Requirement " + r.id() + " must have a positive weight."));
        }
    }

    private static void fileChecks(List<ValidationIssue> out, String field, Map<String, String> files, String prefix,
                                   boolean forbidTests, CodingRuntime rt) {
        for (String p : WorkspaceRules.checkAuthored(field, files, prefix, forbidTests, rt)) out.add(ValidationIssue.error(field, p));
    }

    private static void requireTests(List<ValidationIssue> out, String field, Map<String, String> files, CodingRuntime rt, String missingMsg) {
        if (files.isEmpty()) { out.add(ValidationIssue.error(field, missingMsg)); return; }
        boolean anyTest = files.entrySet().stream().anyMatch(e -> rt.isTestSource(e.getKey()) && looksLikeTest(rt, e.getValue()));
        if (!anyTest) out.add(ValidationIssue.error(field, "No runnable tests found (" + switch (rt) {
            case JAVA_JUNIT -> "JUnit 5 methods annotated @Test";
            case NODE_TEST -> "node:test test(...) / it(...) calls";
            case PYTHON_PYTEST -> "pytest functions named test_*";
        } + ")."));
    }

    static boolean looksLikeTest(CodingRuntime rt, String content) {
        if (content == null) return false;
        return switch (rt) {
            case JAVA_JUNIT -> content.contains("@Test") || content.contains("@ParameterizedTest");
            case NODE_TEST -> content.contains("test(") || content.contains("it(");
            case PYTHON_PYTEST -> content.contains("def test_");
        };
    }
}
