package com.placement.codinglab.runner;

import com.placement.codinglab.model.RequirementSpec;
import com.placement.codinglab.model.TestCaseResult;

import java.util.*;

/**
 * Score = maxScore x weighted pass-rate across requirements. A requirement's pass-rate is
 * (passed tests tagged with it) / (all tests tagged with it), public and hidden combined.
 * Untagged tests (should not exist in a verified question) form a "General" bucket with average weight so a
 * failing untagged test can never be ignored. With no requirement tags at all it degrades to plain passed/total.
 */
public final class RequirementScorer {

    private RequirementScorer() {}

    public record RequirementResult(String id, String title, String description, double weight, int passed, int total, String status) {
        public java.util.Map<String, Object> toMap() {
            java.util.Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", id);
            m.put("title", title);
            m.put("description", description == null ? "" : description);
            m.put("weight", weight);
            m.put("passed", passed);
            m.put("total", total);
            m.put("status", status);
            return m;
        }
    }

    public record ScoreReport(double score, double maxScore, int total, int passed, List<RequirementResult> requirements) {}

    public static ScoreReport compute(List<RequirementSpec> requirements, List<TestCaseResult> cases, double maxScore) {
        int total = cases.size();
        int passed = (int) cases.stream().filter(TestCaseResult::passed).count();

        Map<String, int[]> buckets = new LinkedHashMap<>(); // id -> {passed,total}
        for (RequirementSpec r : requirements) buckets.put(r.id(), new int[]{0, 0});
        int[] general = {0, 0};
        for (TestCaseResult c : cases) {
            int[] b = c.requirementId() != null ? buckets.get(c.requirementId()) : null;
            if (b == null) b = general;
            b[1]++;
            if (c.passed()) b[0]++;
        }

        List<RequirementResult> results = new ArrayList<>();
        double weightSum = 0, earned = 0;
        double avgWeight = requirements.isEmpty() ? 1.0
                : requirements.stream().mapToDouble(RequirementSpec::weightOrDefault).average().orElse(1.0);
        boolean anyTagged = buckets.values().stream().anyMatch(b -> b[1] > 0);

        for (RequirementSpec r : requirements) {
            int[] b = buckets.get(r.id());
            double w = r.weightOrDefault();
            if (!anyTagged && requirements.size() == 1 && total > 0) {
                b[0] = passed;
                b[1] = total;
            }
            results.add(new RequirementResult(r.id(), r.title(), r.description(), w, b[0], b[1], status(b)));
            if (b[1] > 0) { weightSum += w; earned += w * b[0] / b[1]; }
        }
        if (general[1] > 0 && anyTagged) {
            results.add(new RequirementResult("GENERAL", "Other tests", "", avgWeight, general[0], general[1], status(general)));
            weightSum += avgWeight;
            earned += avgWeight * general[0] / general[1];
        }

        double score;
        if (anyTagged && weightSum > 0) score = maxScore * earned / weightSum;
        else score = total == 0 ? 0 : maxScore * passed / total;
        return new ScoreReport(Math.round(score * 100.0) / 100.0, maxScore, total, passed, results);
    }

    private static String status(int[] b) {
        if (b[1] == 0) return "NO_TESTS";
        if (b[0] == b[1]) return "PASSED";
        return b[0] == 0 ? "FAILED" : "PARTIAL";
    }
}
