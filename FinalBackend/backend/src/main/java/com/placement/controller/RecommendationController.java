package com.placement.controller;

import com.placement.dto.ReadinessDtos.RecommendationResponse;
import com.placement.service.CurrentUserService;
import com.placement.service.RecommendationService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/recommendations")
@RequiredArgsConstructor
public class RecommendationController {

    private final RecommendationService recommendationService;
    private final CurrentUserService currentUserService;

    @GetMapping
    public RecommendationResponse recommendations() { return recommendationService.recommend(currentUserService.getCurrentUser()); }

    @GetMapping("/topics")
    public java.util.List<String> topics() { return recommendationService.recommend(currentUserService.getCurrentUser()).recommendedTopics(); }

    @GetMapping("/questions")
    public java.util.List<String> questions() { return recommendationService.recommend(currentUserService.getCurrentUser()).recommendedQuestionCategories(); }

    @GetMapping("/roles")
    public java.util.List<String> roles() { return recommendationService.recommend(currentUserService.getCurrentUser()).recommendedRoles(); }

    @GetMapping("/roadmap")
    public RecommendationResponse roadmap() { return recommendationService.recommend(currentUserService.getCurrentUser()); }
}
