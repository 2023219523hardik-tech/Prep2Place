package com.placement.controller;

import com.placement.entity.User;
import com.placement.entity.Role;
import com.placement.repository.UserRepository;
import com.placement.exception.ApiException;
import com.placement.dto.ReadinessDtos.SkillGapResponse;
import com.placement.service.CurrentUserService;
import com.placement.service.RecommendationService;
import com.placement.service.SkillGapService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/skills")
@RequiredArgsConstructor
public class SkillController {

    private final SkillGapService skillGapService;
    private final RecommendationService recommendationService;
    private final CurrentUserService currentUserService;
    private final UserRepository userRepository;

    @PostMapping("/analyze")
    public SkillGapResponse analyze(@RequestParam(required = false) Long roleId) {
        return skillGapService.analyze(currentUserService.getCurrentUser(), roleId);
    }

    @GetMapping("/gaps")
    public SkillGapResponse gaps() { return skillGapService.analyze(currentUserService.getCurrentUser(), null); }

    @GetMapping("/gaps/{studentId}")
    public SkillGapResponse gapsForStudent(@PathVariable Long studentId) {
        User caller = currentUserService.getCurrentUser();
        User target = caller;
        if (caller.getRole() == Role.ADMIN) {
            target = userRepository.findById(studentId).orElseThrow(() -> ApiException.notFound("Student not found"));
        } else if (!caller.getId().equals(studentId)) {
            throw ApiException.forbidden("Cannot access other student's data");
        }
        return skillGapService.analyze(target, null);
    }

    @GetMapping("/recommendations")
    public java.util.List<String> recommendations() {
        return skillGapService.analyze(currentUserService.getCurrentUser(), null).missingSkills();
    }

    @GetMapping("/roadmap")
    public Object roadmap() { return recommendationService.recommend(currentUserService.getCurrentUser()); }
}
