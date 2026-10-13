package com.placement.service.support;

import java.util.LinkedHashMap;
import java.util.Map;

/** Single source of truth for "what category is this skill" - used by both the profile page's
 *  skill chips (Section 2) and the skill-gap analysis breakdown (Section 3), so a skill is
 *  always categorized the same way everywhere it appears. Not exhaustive by design - broad
 *  enough to be useful, small enough to stay maintainable without a database table for this. */
public final class SkillCategorizer {

    private SkillCategorizer() {}

    private static final Map<String, String> SKILL_CATEGORY = new LinkedHashMap<>();
    static {
        for (String s : new String[]{"java", "python", "javascript", "typescript", "c++", "c", "c#", "go", "rust",
                "kotlin", "swift", "ruby", "php", "scala", "r", "sql", "html", "css", "dsa",
                "data structures", "algorithms"}) SKILL_CATEGORY.put(s, "DSA & Languages");
        for (String s : new String[]{"spring", "spring boot", "django", "flask", "fastapi", "react", "angular",
                "vue", "next.js", "node.js", "express", "nestjs", ".net", "rails", "laravel",
                "rest api", "microservices", "graphql"}) SKILL_CATEGORY.put(s, "Backend & Frameworks");
        for (String s : new String[]{"mysql", "postgresql", "mongodb", "redis", "oracle", "sqlite", "cassandra",
                "elasticsearch", "dynamodb"}) SKILL_CATEGORY.put(s, "Databases");
        for (String s : new String[]{"git", "docker", "kubernetes", "aws", "azure", "gcp", "jenkins", "ci/cd",
                "terraform", "linux", "kafka", "rabbitmq", "junit", "postman", "jira", "figma"}) SKILL_CATEGORY.put(s, "Tools & DevOps");
    }

    public static String categorize(String skillName) {
        if (skillName == null) return "Other";
        return SKILL_CATEGORY.getOrDefault(skillName.trim().toLowerCase(), "Other");
    }

    public static java.util.Set<String> knownSkills() { return SKILL_CATEGORY.keySet(); }
}
