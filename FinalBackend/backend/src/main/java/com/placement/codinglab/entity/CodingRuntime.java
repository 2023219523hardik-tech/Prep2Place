package com.placement.codinglab.entity;

import java.util.Locale;
import java.util.Set;

/**
 * The execution environments the Coding Lab sandbox can provide. Each maps 1:1 to a Docker image
 * (see backend/docker/coding-lab/) and to one JUnit-XML-emitting test runner, so an assessment never
 * carries a free-form shell command any more - that was the root of the old "runner is broken" bugs.
 */
public enum CodingRuntime {
    JAVA_JUNIT("java", "Java 21 + JUnit 5 (+ AssertJ, Mockito, Jackson)", Set.of("java", "properties", "json", "txt", "md", "xml", "html", "sql")),
    NODE_TEST("node", "Node 22 + node:test (+ React 18, Testing Library, jsdom)", Set.of("js", "jsx", "mjs", "cjs", "ts", "tsx", "json", "css", "scss", "sass", "html", "htm", "svg", "md", "txt", "yaml", "yml")),
    PYTHON_PYTEST("python", "Python 3.12 + pytest (+ numpy, pandas, scikit-learn)", Set.of("py", "json", "txt", "csv", "md", "yaml", "yml", "html", "sql"));

    private final String language;
    private final String description;
    private final Set<String> extensions;

    CodingRuntime(String language, String description, Set<String> extensions) {
        this.language = language;
        this.description = description;
        this.extensions = extensions;
    }

    /** Short language key kept for backwards compatibility with the {@code language} column. */
    public String language() { return language; }

    public String description() { return description; }

    public Set<String> extensions() { return extensions; }

    public boolean allows(String path) {
        int dot = path.lastIndexOf('.');
        if (dot < 0 || dot == path.length() - 1) return false;
        return extensions.contains(path.substring(dot + 1).toLowerCase(Locale.ROOT));
    }

    /** Extensions that can hold executable test code for this runtime. */
    public boolean isTestSource(String path) {
        String p = path.toLowerCase(Locale.ROOT);
        return switch (this) {
            case JAVA_JUNIT -> p.endsWith(".java");
            case NODE_TEST -> p.matches(".*\\.(js|jsx|mjs|cjs|ts|tsx)$");
            case PYTHON_PYTEST -> p.endsWith(".py");
        };
    }
}
