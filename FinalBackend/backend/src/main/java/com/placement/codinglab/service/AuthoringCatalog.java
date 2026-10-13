package com.placement.codinglab.service;

import com.placement.codinglab.entity.CodingRuntime;
import com.placement.codinglab.entity.CodingType;

import java.util.*;

/** Static guidance the admin UI renders when authoring: what each track/runtime means and a starter template per runtime. */
public final class AuthoringCatalog {

    private AuthoringCatalog() {}

    public static CodingRuntime defaultRuntime(CodingType type) {
        if (type == null) return CodingRuntime.PYTHON_PYTEST;
        return switch (type) {
            case BACKEND -> CodingRuntime.JAVA_JUNIT;
            case FRONTEND -> CodingRuntime.NODE_TEST;
            default -> CodingRuntime.PYTHON_PYTEST;
        };
    }

    public static List<Map<String, Object>> types() {
        List<Map<String, Object>> out = new ArrayList<>();
        for (CodingType t : CodingType.values()) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("value", t.name());
            m.put("track", switch (t) { case BACKEND -> "BACKEND"; case FRONTEND -> "FRONTEND"; default -> "AI_ML"; });
            m.put("label", switch (t) {
                case BACKEND -> "Backend development";
                case FRONTEND -> "Frontend development";
                case MACHINE_LEARNING -> "Machine learning";
                case AI -> "Artificial intelligence";
                case GENERATIVE_AI -> "Generative AI";
                case RAG -> "Retrieval-augmented generation (RAG)";
            });
            m.put("recommendedRuntime", defaultRuntime(t).name());
            out.add(m);
        }
        return out;
    }

    public static List<Map<String, Object>> runtimes() {
        List<Map<String, Object>> out = new ArrayList<>();
        for (CodingRuntime r : CodingRuntime.values()) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("value", r.name());
            m.put("description", r.description());
            m.put("extensions", new TreeSet<>(r.extensions()));
            m.put("template", template(r));
            m.put("testNaming", switch (r) {
                case JAVA_JUNIT -> "Name test methods r1_..., r2_... (e.g. r2_rejectsUnknownClient).";
                case NODE_TEST -> "Name tests \"[R1] ...\", \"[R2] ...\" in test(\"[R1] does x\", ...).";
                case PYTHON_PYTEST -> "Name test functions test_r1_..., test_r2_... (e.g. test_r2_rejects_unknown).";
            });
            out.add(m);
        }
        return out;
    }

    /** A minimal, valid skeleton (starter + one public + one hidden test + reference) the editor can insert. */
    public static Map<String, Map<String, String>> template(CodingRuntime rt) {
        Map<String, Map<String, String>> t = new LinkedHashMap<>();
        switch (rt) {
            case JAVA_JUNIT -> {
                t.put("starterFiles", Map.of("src/main/java/com/example/Solution.java",
                        "package com.example;\n\npublic class Solution {\n    public int add(int a, int b) {\n        // TODO\n        return 0;\n    }\n}\n"));
                t.put("referenceFiles", Map.of("src/main/java/com/example/Solution.java",
                        "package com.example;\n\npublic class Solution {\n    public int add(int a, int b) {\n        return a + b;\n    }\n}\n"));
                t.put("publicTestFiles", Map.of("tests/public/SolutionPublicTest.java",
                        "package com.example;\n\nimport org.junit.jupiter.api.Test;\nimport static org.junit.jupiter.api.Assertions.*;\n\nclass SolutionPublicTest {\n    @Test void r1_addsTwoNumbers() { assertEquals(3, new Solution().add(1, 2)); }\n}\n"));
                t.put("hiddenTestFiles", Map.of("tests/hidden/SolutionHiddenTest.java",
                        "package com.example;\n\nimport org.junit.jupiter.api.Test;\nimport static org.junit.jupiter.api.Assertions.*;\n\nclass SolutionHiddenTest {\n    @Test void r1_addsNegatives() { assertEquals(-5, new Solution().add(-2, -3)); }\n}\n"));
            }
            case NODE_TEST -> {
                t.put("starterFiles", Map.of("src/solution.js", "export function add(a, b) {\n  // TODO\n  return 0;\n}\n"));
                t.put("referenceFiles", Map.of("src/solution.js", "export function add(a, b) {\n  return a + b;\n}\n"));
                t.put("publicTestFiles", Map.of("tests/public/solution.test.js",
                        "import { test } from \"node:test\";\nimport assert from \"node:assert/strict\";\nimport { add } from \"../../src/solution.js\";\n\ntest(\"[R1] adds two numbers\", () => {\n  assert.equal(add(1, 2), 3);\n});\n"));
                t.put("hiddenTestFiles", Map.of("tests/hidden/solution.test.js",
                        "import { test } from \"node:test\";\nimport assert from \"node:assert/strict\";\nimport { add } from \"../../src/solution.js\";\n\ntest(\"[R1] adds negatives\", () => {\n  assert.equal(add(-2, -3), -5);\n});\n"));
            }
            case PYTHON_PYTEST -> {
                t.put("starterFiles", Map.of("solution.py", "def add(a, b):\n    # TODO\n    return 0\n"));
                t.put("referenceFiles", Map.of("solution.py", "def add(a, b):\n    return a + b\n"));
                t.put("publicTestFiles", Map.of("tests/public/test_solution.py",
                        "from solution import add\n\n\ndef test_r1_adds_two_numbers():\n    assert add(1, 2) == 3\n"));
                t.put("hiddenTestFiles", Map.of("tests/hidden/test_solution.py",
                        "from solution import add\n\n\ndef test_r1_adds_negatives():\n    assert add(-2, -3) == -5\n"));
            }
        }
        return t;
    }
}
