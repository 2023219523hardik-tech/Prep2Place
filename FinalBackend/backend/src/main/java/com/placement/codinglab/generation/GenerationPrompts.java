package com.placement.codinglab.generation;

import com.placement.codinglab.dto.CodingLabDtos.GenerateRequest;
import com.placement.codinglab.entity.CodingRuntime;
import com.placement.codinglab.entity.CodingType;
import com.placement.codinglab.model.ValidationIssue;

import java.util.List;

/** Prompt text for AI question generation. Kept separate so it can be tuned without touching the pipeline. */
final class GenerationPrompts {

    private GenerationPrompts() {}

    static final String SYSTEM = """
            You are an expert author of hands-on, project-style coding assessments for a campus-placement platform.
            You produce exactly ONE assessment as a single JSON object - no prose, no markdown fences, nothing else.

            Candidate code runs in an OFFLINE sandbox (no network, no external services, no GPU) and is graded by
            automated tests. A machine validates your output against the contract below and RUNS your reference
            solution against your tests, so every rule matters.

            JSON contract (every key required):
            {
              "title": string, 5-100 chars,
              "summary": string, one sentence, at most 200 chars,
              "problemStatement": string, Markdown, 150-2000 chars. Describe the scenario and the task: exact file names,
                                  class/function names and signatures to implement, inputs/outputs, error handling and
                                  edge cases. Never reveal the solution and never mention hidden tests.,
              "technology": string (e.g. "Java 21 + JUnit 5"),
              "skills": [string], 3-6 items,
              "timeLimitMinutes": integer (EASY 20-30, MEDIUM 30-45, HARD 45-60),
              "requirements": [ { "id": "R1", "title": string, "description": string, "weight": number } ],   // 3-6 items, ids R1..Rn
              "starterFiles":    { "<path>": "<content>" },  // compiles/parses but implements NOTHING (stubs with TODO)
              "referenceFiles":  { "<path>": "<content>" },  // complete correct solution; SAME paths as the starter files it replaces
              "publicTestFiles": { "tests/public/<file>": "<content>" },  // 1-2 files: the basics of EVERY requirement
              "hiddenTestFiles": { "tests/hidden/<file>": "<content>" }   // 1-2 files: edge cases and stricter checks for EVERY requirement
            }

            Rules:
            1. Every test name MUST contain the id of the requirement it checks (R1, R2, ...) using the naming style of the
               runtime below. Every requirement needs at least one public OR hidden test; no test may be untagged.
            2. The reference solution must pass ALL tests. The starter must build but must FAIL at least one public test.
            3. Tests are deterministic and offline: no real time/sleeps beyond a few ms, no randomness without a fixed seed,
               no network, no reading files outside the project, and finish in a few seconds in total.
            4. Public and hidden tests must not duplicate each other; hidden tests probe boundaries, error handling and
               anything a lazy solution would miss.
            5. Paths use forward slashes, only letters/digits/._- , no leading dots. Starter/reference files must NOT be under tests/.
            6. Keep each file under 12000 characters and the whole answer compact. Realistic scenario, small surface.
            7. Only use the libraries listed for the runtime. Do not require any dependency installation.
            8. Output raw JSON only.
            """;

    static String userPrompt(GenerateRequest r, CodingRuntime runtime, int requirementCount) {
        StringBuilder sb = new StringBuilder();
        sb.append("Create one assessment with these parameters:\n");
        sb.append("- Track: ").append(trackLabel(r.codingType())).append('\n');
        sb.append("- Difficulty: ").append(r.difficulty()).append('\n');
        sb.append("- Runtime: ").append(runtime).append(" - ").append(runtime.description()).append('\n');
        sb.append("- Topic: ").append(blankTo(r.topic(), "choose a realistic, interview-relevant topic for this track")).append('\n');
        if (notBlank(r.scenario())) sb.append("- Scenario / context: ").append(r.scenario().strip()).append('\n');
        if (notBlank(r.targetJobRole())) sb.append("- Target job role: ").append(r.targetJobRole().strip()).append('\n');
        if (r.skills() != null && !r.skills().isEmpty()) sb.append("- Skills to assess: ").append(String.join(", ", r.skills())).append('\n');
        if (r.timeLimitMinutes() != null) sb.append("- Time limit for the candidate: ").append(r.timeLimitMinutes()).append(" minutes\n");
        sb.append("- Number of requirements: exactly ").append(requirementCount).append('\n');
        if (notBlank(r.extraInstructions())) sb.append("- Additional instructions from the administrator: ").append(r.extraInstructions().strip()).append('\n');
        sb.append("\nRuntime notes:\n").append(kit(runtime, r.codingType()));
        sb.append("\nReturn the JSON object now.");
        return sb.toString();
    }

    static String repairPrompt(String previousJson, List<ValidationIssue> issues, String parseProblem) {
        StringBuilder sb = new StringBuilder("Your previous assessment did not pass the automated checks.\n");
        if (parseProblem != null) sb.append("Your answer was not valid JSON for the contract: ").append(parseProblem).append('\n');
        int n = 0;
        for (ValidationIssue i : issues) {
            if (i.severity() != ValidationIssue.Severity.ERROR) continue;
            if (n++ >= 12) break;
            sb.append("- [").append(i.field()).append("] ").append(i.message()).append('\n');
        }
        sb.append("\nFix every problem and return the COMPLETE corrected assessment as one JSON object (same contract, all keys). ")
                .append("Do not explain. Previous answer:\n")
                .append(previousJson.length() > 40_000 ? previousJson.substring(0, 40_000) : previousJson);
        return sb.toString();
    }

    private static String kit(CodingRuntime rt, CodingType type) {
        return switch (rt) {
            case JAVA_JUNIT -> """
                    - JDK 21. Libraries available: JUnit 5 (org.junit.jupiter.api.*), AssertJ, Mockito, Jackson. NO Spring, NO other libraries.
                    - Put production code under src/main/java/<package path>/ with a matching `package` line (e.g. package com.example.ratelimit;).
                    - Test files live under tests/public/ and tests/hidden/ (any file name, e.g. FooPublicTest.java / FooHiddenTest.java), declare the
                      same package as the code under test, and use unique class names. Test classes/methods may be package-private.
                    - Name every test method r<N>_<what> (e.g. `void r2_rejectsUnknownClient()`); the token r<N> must stand alone between underscores.
                    - Do not use @DisplayName for the requirement id (only the method name is read).
                    """;
            case NODE_TEST -> type == CodingType.FRONTEND ? """
                    - Node 22 with ES modules. Libraries available: react 18, react-dom, @testing-library/react, @testing-library/dom,
                      @testing-library/user-event, jsdom (a DOM is provided globally). Write components as function components in .jsx files under src/.
                    - Tests use the built-in runner: `import { test, afterEach } from "node:test"; import assert from "node:assert/strict";`
                      and MUST register `afterEach(cleanup)` (cleanup from @testing-library/react). Import student code with relative paths, e.g. "../../src/Foo.jsx".
                    - Name every test "[R1] does something" inside test("...", () => {...}). No CSS/image imports, no fetch: pass data via props.
                    - Prefer stable queries (getByRole / getByTestId with data-testid attributes that the problem statement explicitly requires).
                    """ : """
                    - Node 22 with ES modules and the built-in test runner: `import { test } from "node:test"; import assert from "node:assert/strict";`.
                    - Put code under src/ (e.g. src/solution.js) and import it from tests with relative paths like "../../src/solution.js".
                    - Name every test "[R1] does something" inside test("...", () => {...}). No npm packages beyond Node's standard library.
                    """;
            case PYTHON_PYTEST -> """
                    - Python 3.12 with pytest. Libraries available: numpy, pandas, scikit-learn (and the standard library). NO torch/tensorflow/transformers, NO network or downloads.
                    - Put code at the project root or under src/ (e.g. solution.py) and import it in tests by module name (`from solution import foo`).
                    - Name every test function test_r<N>_<what> (e.g. `def test_r2_rejects_unknown_client():`).
                    - For GenAI/RAG/LLM topics test against fake, in-memory stand-ins (a stub LLM callable, toy embeddings or TF-IDF implemented in the code) - never call real APIs.
                    - Use fixed random seeds; compare floats with tolerances.
                    """;
        };
    }

    private static String trackLabel(CodingType t) {
        return switch (t) {
            case BACKEND -> "Backend development";
            case FRONTEND -> "Frontend development";
            case MACHINE_LEARNING -> "Machine learning";
            case AI -> "Artificial intelligence (classical AI / search / planning / agents)";
            case GENERATIVE_AI -> "Generative AI (LLM application plumbing)";
            case RAG -> "Retrieval-augmented generation";
        };
    }

    private static boolean notBlank(String s) { return s != null && !s.isBlank(); }

    private static String blankTo(String s, String fallback) { return notBlank(s) ? s.strip() : fallback; }
}
