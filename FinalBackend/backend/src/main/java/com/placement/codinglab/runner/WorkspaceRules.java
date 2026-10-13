package com.placement.codinglab.runner;

import com.placement.codinglab.entity.CodingRuntime;

import java.util.*;
import java.util.regex.Pattern;

/**
 * Path / size rules shared by student saves and admin authoring. Everything that ends up on the sandbox's
 * disk goes through {@link #normalizePath}, so traversal ("../"), absolute paths and the runner's own
 * {@code .p2p/} protocol directory can never be written by a student or a generated question.
 */
public final class WorkspaceRules {

    public static final String TESTS_DIR = "tests/";
    public static final String PUBLIC_DIR = "tests/public/";
    public static final String HIDDEN_DIR = "tests/hidden/";
    public static final int MAX_FILES = 40;
    public static final int MAX_FILE_CHARS = 64_000;
    public static final int MAX_TOTAL_CHARS = 300_000;
    private static final int MAX_PATH = 160;
    /** A segment must start with a letter/digit/underscore, so "..", ".p2p", ".git", ".env" are all rejected. */
    private static final Pattern SEGMENT = Pattern.compile("[A-Za-z0-9_][A-Za-z0-9._\\-]*");

    private WorkspaceRules() {}

    public static String normalizePath(String raw) {
        if (raw == null || raw.isBlank()) throw new IllegalArgumentException("A file path is empty");
        String p = raw.trim().replace('\\', '/');
        if (p.length() > MAX_PATH) throw new IllegalArgumentException("File path is too long: " + shorten(p));
        if (p.startsWith("/")) throw new IllegalArgumentException("File paths must be relative: " + shorten(p));
        for (String seg : p.split("/", -1)) {
            if (!SEGMENT.matcher(seg).matches()) {
                throw new IllegalArgumentException("Invalid file path '" + shorten(p) + "' (letters, digits, . _ - and / only; no leading dots)");
            }
        }
        return p;
    }

    public static boolean isTestPath(String normalizedPath) { return normalizedPath.startsWith(TESTS_DIR); }

    /** Cleans a student-submitted file map. Anything under tests/ is silently dropped (tests are server-owned);
     *  anything else invalid is rejected with a message the UI can show. */
    public static Map<String, String> sanitizeStudentFiles(Map<String, String> in, CodingRuntime runtime) {
        Map<String, String> out = new LinkedHashMap<>();
        if (in == null) return out;
        int total = 0;
        for (Map.Entry<String, String> e : in.entrySet()) {
            String path = normalizePath(e.getKey());
            if (isTestPath(path)) continue;
            if (!runtime.allows(path)) throw new IllegalArgumentException("File type not allowed for this assessment: " + path);
            String content = e.getValue() == null ? "" : e.getValue();
            if (content.length() > MAX_FILE_CHARS) throw new IllegalArgumentException(path + " is too large (limit " + MAX_FILE_CHARS + " characters)");
            total += content.length();
            out.put(path, content);
        }
        if (out.size() > MAX_FILES) throw new IllegalArgumentException("Too many files (limit " + MAX_FILES + ")");
        if (total > MAX_TOTAL_CHARS) throw new IllegalArgumentException("Project is too large (limit " + MAX_TOTAL_CHARS + " characters)");
        return out;
    }

    /** Structural check for admin/LLM-authored maps. Returns human-readable problems (empty = fine). */
    public static List<String> checkAuthored(String field, Map<String, String> files, String requiredPrefix,
                                             boolean forbidTestsDir, CodingRuntime runtime) {
        List<String> problems = new ArrayList<>();
        if (files == null) return problems;
        int total = 0;
        if (files.size() > MAX_FILES) problems.add(field + ": too many files (limit " + MAX_FILES + ")");
        for (Map.Entry<String, String> e : files.entrySet()) {
            String path;
            try {
                path = normalizePath(e.getKey());
            } catch (IllegalArgumentException ex) {
                problems.add(field + ": " + ex.getMessage());
                continue;
            }
            if (!path.equals(e.getKey())) problems.add(field + ": path '" + e.getKey() + "' must be written as '" + path + "'");
            if (requiredPrefix != null && !path.startsWith(requiredPrefix)) problems.add(field + ": '" + path + "' must be under " + requiredPrefix);
            if (forbidTestsDir && isTestPath(path)) problems.add(field + ": '" + path + "' must not be under tests/ (tests are separate)");
            if (runtime != null && !runtime.allows(path)) problems.add(field + ": file type not allowed for " + runtime + ": " + path);
            String content = e.getValue() == null ? "" : e.getValue();
            if (content.length() > MAX_FILE_CHARS) problems.add(field + ": '" + path + "' is too large (limit " + MAX_FILE_CHARS + " characters)");
            if (content.contains(".p2p")) problems.add(field + ": '" + path + "' must not reference the runner's .p2p directory");
            total += content.length();
        }
        if (total > MAX_TOTAL_CHARS) problems.add(field + ": total size exceeds " + MAX_TOTAL_CHARS + " characters");
        return problems;
    }

    private static String shorten(String s) { return s.length() > 60 ? s.substring(0, 60) + "…" : s; }
}
