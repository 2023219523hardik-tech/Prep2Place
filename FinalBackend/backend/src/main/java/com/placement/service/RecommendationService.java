package com.placement.service;

import com.placement.dto.ReadinessDtos.*;
import com.placement.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Rule-based recommendation engine: derives study topics, question categories, and a
 * week-by-week roadmap from weak areas (ReadinessService) and skill gaps (SkillGapService).
 * Deterministic and explainable — a natural seam to layer a learned ranking model onto later.
 */
@Service
@RequiredArgsConstructor
public class RecommendationService {

    private final ReadinessService readinessService;
    private final SkillGapService skillGapService;

    private static final Map<String, String> CATEGORY_FOR_WEAK_AREA = Map.of(
            "DSA/Coding", "DSA", "Aptitude", "APTITUDE", "Technical Knowledge", "TECHNICAL",
            "Communication", "COMMUNICATION", "Interview", "INTERVIEW",
            "Projects", "PROJECT_WORK", "Academics", "ACADEMIC_REVIEW"
    );

    public RecommendationResponse recommend(User student) {
        ReadinessResponse readiness = readinessService.analyze(student);

        List<String> topics = new ArrayList<>(readiness.weakAreas());
        List<String> categories = readiness.weakAreas().stream()
                .map(a -> CATEGORY_FOR_WEAK_AREA.getOrDefault(a, "GENERAL")).distinct().toList();

        List<String> roles = List.of();
        try {
            SkillGapResponse gap = skillGapService.analyze(student, null);
            if (!gap.missingSkills().isEmpty()) topics.addAll(gap.missingSkills());
        } catch (Exception ignored) { /* no target role set yet */ }

        List<RoadmapItem> roadmap = new ArrayList<>();
        int week = 1;
        if (topics.isEmpty()) {
            roadmap.add(new RoadmapItem(week, "General Practice", "Keep up regular practice across all modules"));
        } else {
            for (String topic : topics) {
                roadmap.add(new RoadmapItem(week, topic, "Focused practice and mock questions on " + topic));
                week++;
                if (week > 6) break;
            }
        }

        return new RecommendationResponse(topics, categories, roles, roadmap);
    }
}
