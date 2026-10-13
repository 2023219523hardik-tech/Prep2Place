package com.placement.codinglab.runner;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Ties a test to a requirement by NAME - the one convention that works identically across JUnit, pytest and
 * node:test: the test's name contains a standalone token {@code R<number>} (case-insensitive), e.g.
 * {@code r2_rejectsUnknownClient()}, {@code test_r2_rejects_unknown}, {@code "[R2] rejects unknown"}.
 */
public final class TestNaming {

    private static final Pattern REQ = Pattern.compile("(?<![A-Za-z0-9])[Rr](\\d{1,2})(?![A-Za-z0-9])");

    private TestNaming() {}

    /** Normalised requirement id ("R3") or null when the name carries no tag. */
    public static String requirementId(String testName) {
        if (testName == null) return null;
        Matcher m = REQ.matcher(testName);
        return m.find() ? "R" + Integer.parseInt(m.group(1)) : null;
    }

    /** Human-friendly form: drops JUnit's trailing "(...)" and sandbox-internal paths. */
    public static String clean(String testName) {
        if (testName == null) return "";
        String n = testName.replace("/tmp/p2p-out/", "").replaceAll("\\(.*\\)$", "").trim();
        return n.length() > 160 ? n.substring(0, 160) : n;
    }
}
