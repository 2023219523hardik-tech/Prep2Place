package com.placement.codinglab.model;

import java.util.LinkedHashMap;
import java.util.Map;

/** One executed test, normalised from whichever runner produced it. {@code suite} is "public" or "hidden". */
public record TestCaseResult(String suite, String name, String requirementId, CaseStatus status, String message, int timeMs) {

    public enum CaseStatus { PASSED, FAILED, ERROR, SKIPPED }

    public boolean passed() { return status == CaseStatus.PASSED; }

    public boolean hidden() { return "hidden".equals(suite); }

    public Map<String, Object> toMap() {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("suite", suite);
        m.put("name", name);
        m.put("requirementId", requirementId);
        m.put("status", status.name());
        m.put("message", message == null ? "" : message);
        m.put("timeMs", timeMs);
        return m;
    }

    public static TestCaseResult fromMap(Map<String, Object> m) {
        Object t = m.get("timeMs");
        return new TestCaseResult(String.valueOf(m.get("suite")), String.valueOf(m.get("name")),
                m.get("requirementId") == null ? null : String.valueOf(m.get("requirementId")),
                CaseStatus.valueOf(String.valueOf(m.get("status"))),
                m.get("message") == null ? "" : String.valueOf(m.get("message")),
                t instanceof Number n ? n.intValue() : 0);
    }
}
