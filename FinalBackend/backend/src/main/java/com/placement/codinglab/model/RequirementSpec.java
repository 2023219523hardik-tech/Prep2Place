package com.placement.codinglab.model;

import java.util.*;

/** One acceptance criterion of a question. Tests are tied to it by carrying its id (R1, R2, ...) in their name,
 *  and the score is the weighted pass-rate across requirements. */
public record RequirementSpec(String id, String title, String description, Double weight) {

    public double weightOrDefault() { return weight == null || weight <= 0 ? 1.0 : weight; }

    public Map<String, Object> toMap() {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", id);
        m.put("title", title);
        m.put("description", description == null ? "" : description);
        m.put("weight", weightOrDefault());
        return m;
    }

    public static RequirementSpec fromMap(Map<String, Object> m) {
        Object w = m.get("weight");
        Double weight = w instanceof Number n ? n.doubleValue() : null;
        return new RequirementSpec(str(m.get("id")), str(m.get("title")), str(m.get("description")), weight);
    }

    public static List<RequirementSpec> fromMaps(List<Map<String, Object>> maps) {
        if (maps == null) return List.of();
        return maps.stream().map(RequirementSpec::fromMap).toList();
    }

    public static List<Map<String, Object>> toMaps(List<RequirementSpec> specs) {
        if (specs == null) return new ArrayList<>();
        return new ArrayList<>(specs.stream().map(RequirementSpec::toMap).toList());
    }

    private static String str(Object o) { return o == null ? null : String.valueOf(o); }
}
