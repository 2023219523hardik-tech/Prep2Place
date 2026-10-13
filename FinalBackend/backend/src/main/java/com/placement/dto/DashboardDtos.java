package com.placement.dto;

import java.util.List;
import java.util.Map;

public class DashboardDtos {
    public record DashboardResponse(String studentName, Double readinessScore, String readinessLevel,
                                     Double avgCodingScore, Double avgAptitudeScore, Double avgInterviewScore,
                                     Integer totalInterviews, Integer totalCodingSubmissions, Integer totalAptitudeAttempts,
                                     Map<String, Double> skillBreakdown, List<RecentActivity> recentActivity) {}
    public record RecentActivity(String type, String description, String timestamp) {}
}
