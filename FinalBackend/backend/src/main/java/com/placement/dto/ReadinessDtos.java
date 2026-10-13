package com.placement.dto;

import java.util.List;
import java.util.Map;

public class ReadinessDtos {
    public record ReadinessResponse(Double overallScore, String readinessLevel,
                                     Map<String, Double> categoryBreakdown, List<String> weakAreas, List<String> strengths) {}
    public record SkillGapResponse(String targetRole, List<String> matchedSkills, List<String> missingSkills, Double matchPercentage,
                                    List<CategoryGap> categoryBreakdown, List<MissingSkillAction> missingSkillActions, boolean noRoleSet) {
        public SkillGapResponse(String targetRole, List<String> matchedSkills, List<String> missingSkills, Double matchPercentage, List<CategoryGap> categoryBreakdown, List<MissingSkillAction> missingSkillActions) {
            this(targetRole, matchedSkills, missingSkills, matchPercentage, categoryBreakdown, missingSkillActions, false);
        }
    }
    public record CategoryGap(String category, List<String> matched, List<String> missing, Double matchPercentage) {}
    /** Section 3: each missing skill is actionable - a real link to where the candidate can do
     *  something about it, not just a static label. */
    public record MissingSkillAction(String skill, String category, String actionLabel, String href) {}
    public record RecommendationResponse(List<String> recommendedTopics, List<String> recommendedQuestionCategories,
                                          List<String> recommendedRoles, List<RoadmapItem> roadmap) {}
    public record RoadmapItem(int week, String focusArea, String goal) {}
}
