package com.placement.codinglab.model;

import java.util.LinkedHashMap;
import java.util.Map;

/** A finding about a question definition. ERRORs block publishing; WARNINGs are advice only. */
public record ValidationIssue(Severity severity, String field, String message) {

    public enum Severity { ERROR, WARNING }

    public static ValidationIssue error(String field, String message) { return new ValidationIssue(Severity.ERROR, field, message); }

    public static ValidationIssue warning(String field, String message) { return new ValidationIssue(Severity.WARNING, field, message); }

    public Map<String, Object> toMap() {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("severity", severity.name());
        m.put("field", field);
        m.put("message", message);
        return m;
    }
}
