package com.placement.controller;

import com.placement.entity.User;
import com.placement.entity.Role;
import com.placement.repository.UserRepository;
import com.placement.exception.ApiException;
import com.placement.dto.ReadinessDtos.ReadinessResponse;
import com.placement.service.CurrentUserService;
import com.placement.service.ReadinessService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/placement/readiness")
@RequiredArgsConstructor
public class PlacementController {

    private final ReadinessService readinessService;
    private final CurrentUserService currentUserService;
    private final UserRepository userRepository;

    @GetMapping
    public ReadinessResponse get() { return readinessService.analyze(currentUserService.getCurrentUser()); }

    @PostMapping("/analyze")
    public ReadinessResponse analyze() { return readinessService.analyze(currentUserService.getCurrentUser()); }

    @GetMapping("/history")
    public java.util.List<ReadinessResponse> history() {
        return java.util.List.of(readinessService.analyze(currentUserService.getCurrentUser()));
    }

    private User getTargetUser(Long studentId) {
        User caller = currentUserService.getCurrentUser();
        if (caller.getRole() == Role.ADMIN || caller.getRole() == Role.RECRUITER) {
            return userRepository.findById(studentId).orElseThrow(() -> ApiException.notFound("Student not found"));
        } else if (!caller.getId().equals(studentId)) {
            throw ApiException.forbidden("Cannot access other student's data");
        }
        return caller;
    }

    @GetMapping("/{studentId}")
    public ReadinessResponse forStudent(@PathVariable Long studentId) {
        return readinessService.analyze(getTargetUser(studentId));
    }

    @GetMapping("/{studentId}/breakdown")
    public java.util.Map<String, Double> breakdown(@PathVariable Long studentId) {
        return readinessService.analyze(getTargetUser(studentId)).categoryBreakdown();
    }
}
