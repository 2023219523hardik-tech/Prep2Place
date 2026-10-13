package com.placement.codinglab.service;

import com.placement.codinglab.entity.CodingRuntime;
import com.placement.codinglab.entity.CodingType;
import com.placement.codinglab.model.AssessmentBlueprint;
import com.placement.codinglab.model.RequirementSpec;
import com.placement.codinglab.model.TestCaseResult;
import com.placement.codinglab.model.ValidationIssue;
import com.placement.codinglab.runner.AssessmentContentValidator;
import com.placement.codinglab.runner.JUnitXmlParser;
import com.placement.codinglab.runner.SandboxExecutor;
import com.placement.codinglab.runner.SandboxExecutor.Outcome;
import com.placement.codinglab.runner.SandboxExecutor.Suite;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.*;

/**
 * Proves a question is sound BEFORE any candidate sees it, by running it in the real sandbox:
 * <ol>
 *   <li>static checks ({@link AssessmentContentValidator});</li>
 *   <li>starter + reference solution, run against public tests then hidden tests (separate containers, exactly
 *       like a real Submit) - every test must pass, every test must carry a defined requirement tag, every
 *       requirement must have at least one test;</li>
 *   <li>the untouched starter against the public tests - it must build and must NOT already pass everything.</li>
 * </ol>
 * The same pipeline gates manual, AI-generated and imported questions.
 */
@Service
public class AssessmentVerifier {

    private final SandboxExecutor executor;

    public AssessmentVerifier(SandboxExecutor executor) { this.executor = executor; }

    /** @param runnerProblem true when the sandbox itself was unavailable - the question was NOT judged, don't mark it FAILED. */
    public record Verification(boolean ok, boolean runnerProblem, Map<String, Object> report, List<ValidationIssue> issues) {}

    private record Phase(String runnerMessage, boolean buildOk, boolean timedOut, String buildLog, String runLog,
                         List<TestCaseResult> cases, String parseError) {
        boolean runnerProblem() { return runnerMessage != null; }
    }

    public Verification verify(AssessmentBlueprint b, int memoryMb, int timeoutSeconds) {
        long t0 = System.nanoTime();
        List<ValidationIssue> issues = new ArrayList<>(AssessmentContentValidator.validate(b));
        Map<String, Object> report = new LinkedHashMap<>();
        if (AssessmentContentValidator.hasErrors(issues)) {
            report.put("stage", "static");
            return finish(false, false, report, issues, t0);
        }

        CodingRuntime rt = b.runtime();
        boolean dom = b.codingType() == CodingType.FRONTEND;
        Map<String, String> reference = new LinkedHashMap<>(b.starter());
        reference.putAll(b.reference());

        Phase refPublic = run(rt, Suite.PUBLIC, merge(reference, b.publicTests()), dom, memoryMb, timeoutSeconds);
        if (refPublic.runnerProblem()) return runnerProblem(refPublic.runnerMessage(), report, issues, t0);
        Phase refHidden = run(rt, Suite.HIDDEN, merge(reference, b.hiddenTests()), dom, memoryMb, timeoutSeconds);
        if (refHidden.runnerProblem()) return runnerProblem(refHidden.runnerMessage(), report, issues, t0);

        checkReference(b, issues, "public", refPublic);
        checkReference(b, issues, "hidden", refHidden);
        List<TestCaseResult> refCases = new ArrayList<>(refPublic.cases());
        refCases.addAll(refHidden.cases());
        checkTags(b, issues, refCases);

        Phase starter = run(rt, Suite.PUBLIC, merge(b.starter(), b.publicTests()), dom, memoryMb, timeoutSeconds);
        if (starter.runnerProblem()) return runnerProblem(starter.runnerMessage(), report, issues, t0);
        checkStarter(issues, starter);

        Map<String, Object> ref = new LinkedHashMap<>();
        ref.put("buildOk", refPublic.buildOk() && refHidden.buildOk());
        ref.put("publicTotal", refPublic.cases().size());
        ref.put("publicPassed", refPublic.cases().stream().filter(TestCaseResult::passed).count());
        ref.put("hiddenTotal", refHidden.cases().size());
        ref.put("hiddenPassed", refHidden.cases().stream().filter(TestCaseResult::passed).count());
        ref.put("failures", refCases.stream().filter(c -> !c.passed()).limit(20).map(TestCaseResult::toMap).toList());
        report.put("reference", ref);

        Map<String, Object> st = new LinkedHashMap<>();
        st.put("buildOk", starter.buildOk());
        st.put("publicTotal", starter.cases().size());
        st.put("publicFailed", starter.cases().stream().filter(c -> !c.passed()).count());
        report.put("starter", st);

        List<Map<String, Object>> reqs = new ArrayList<>();
        for (RequirementSpec r : b.requirementsOrEmpty()) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", r.id());
            m.put("title", r.title());
            m.put("publicTests", refPublic.cases().stream().filter(c -> r.id().equals(c.requirementId())).count());
            m.put("hiddenTests", refHidden.cases().stream().filter(c -> r.id().equals(c.requirementId())).count());
            reqs.add(m);
        }
        report.put("requirements", reqs);
        report.put("stage", "sandbox");
        boolean ok = !AssessmentContentValidator.hasErrors(issues);
        return finish(ok, false, report, issues, t0);
    }

    // ------------------------------------------------------------------------------------------- checks

    private void checkReference(AssessmentBlueprint b, List<ValidationIssue> issues, String suite, Phase p) {
        String field = suite + "TestFiles";
        if (p.timedOut()) { issues.add(ValidationIssue.error(field, "The reference solution timed out on the " + suite + " tests - make the tests faster or raise the execution timeout.")); return; }
        if (!p.buildOk()) { issues.add(ValidationIssue.error("referenceFiles", "Starter + reference + " + suite + " tests do not build:\n" + excerpt(p.buildLog(), 600))); return; }
        if (p.parseError() != null) { issues.add(ValidationIssue.error(field, "Test report unreadable: " + p.parseError())); return; }
        if (p.cases().isEmpty()) { issues.add(ValidationIssue.error(field, "No " + suite + " tests were executed. Runner output:\n" + excerpt(p.runLog(), 600))); return; }
        p.cases().stream().filter(c -> !c.passed()).limit(5).forEach(c ->
                issues.add(ValidationIssue.error("referenceFiles", "Reference solution fails " + suite + " test '" + c.name() + "'" + (c.message().isBlank() ? "" : ": " + c.message()))));
    }

    private void checkTags(AssessmentBlueprint b, List<ValidationIssue> issues, List<TestCaseResult> cases) {
        Set<String> defined = new HashSet<>();
        b.requirementsOrEmpty().forEach(r -> defined.add(r.id()));
        Set<String> covered = new HashSet<>();
        int reported = 0;
        for (TestCaseResult c : cases) {
            if (c.requirementId() == null || !defined.contains(c.requirementId())) {
                if (reported++ < 5) issues.add(ValidationIssue.error(c.suite() + "TestFiles", "Test '" + c.name() + "' is not tied to a defined requirement. Put the requirement id in the test name (Java: r1_doesX, Python: test_r1_does_x, Node: \"[R1] does x\")."));
            } else {
                covered.add(c.requirementId());
            }
        }
        for (RequirementSpec r : b.requirementsOrEmpty()) {
            if (!covered.contains(r.id())) issues.add(ValidationIssue.error("requirements", "Requirement " + r.id() + " (" + r.title() + ") has no tests - it can never be scored."));
        }
    }

    private void checkStarter(List<ValidationIssue> issues, Phase starter) {
        if (starter.timedOut()) { issues.add(ValidationIssue.error("starterFiles", "The starter code times out on the public tests (e.g. an infinite loop in a stub).")); return; }
        if (!starter.buildOk()) { issues.add(ValidationIssue.error("starterFiles", "The starter files do not build - candidates must start from code that compiles/parses:\n" + excerpt(starter.buildLog(), 600))); return; }
        if (starter.parseError() != null || starter.cases().isEmpty()) { issues.add(ValidationIssue.error("publicTestFiles", "Public tests did not produce results against the starter: " + (starter.parseError() != null ? starter.parseError() : excerpt(starter.runLog(), 400)))); return; }
        if (starter.cases().stream().allMatch(TestCaseResult::passed)) {
            issues.add(ValidationIssue.error("starterFiles", "The starter already passes every public test - candidates would have nothing to fix. Stub out the behaviour under test."));
        }
    }

    // ------------------------------------------------------------------------------------------- plumbing

    private Phase run(CodingRuntime rt, Suite suite, Map<String, String> files, boolean dom, int memoryMb, int timeoutSeconds) {
        SandboxExecutor.Result r = executor.execute(new SandboxExecutor.Request(rt, suite, files, memoryMb, timeoutSeconds, dom));
        if (r.outcome() == Outcome.UNAVAILABLE || r.outcome() == Outcome.BUSY) {
            return new Phase(r.adminMessage() != null ? r.adminMessage() : r.userMessage(), false, false, "", "", List.of(), null);
        }
        List<TestCaseResult> cases = List.of();
        String parseError = null;
        if (r.buildOk() && r.reportXml() != null) {
            try { cases = JUnitXmlParser.parse(r.reportXml(), suite.dir()); }
            catch (IllegalArgumentException e) { parseError = e.getMessage(); }
        }
        return new Phase(null, r.buildOk(), r.outcome() == Outcome.TIMED_OUT, r.buildLog(), r.runLog(), cases, parseError);
    }

    private static Map<String, String> merge(Map<String, String> a, Map<String, String> b) {
        Map<String, String> m = new LinkedHashMap<>(a);
        m.putAll(b);
        return m;
    }

    private Verification runnerProblem(String message, Map<String, Object> report, List<ValidationIssue> issues, long t0) {
        report.put("stage", "runner");
        report.put("runnerMessage", message);
        return finish(false, true, report, issues, t0);
    }

    private Verification finish(boolean ok, boolean runnerProblem, Map<String, Object> report, List<ValidationIssue> issues, long t0) {
        report.put("ok", ok);
        report.put("checkedAt", Instant.now().toString());
        report.put("durationMs", (System.nanoTime() - t0) / 1_000_000);
        report.put("issues", issues.stream().map(ValidationIssue::toMap).toList());
        return new Verification(ok, runnerProblem, report, issues);
    }

    private static String excerpt(String s, int max) {
        if (s == null) return "";
        String t = s.strip();
        return t.length() > max ? t.substring(0, max) + "…" : t;
    }
}
