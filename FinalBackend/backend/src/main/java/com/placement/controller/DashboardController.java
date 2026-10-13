package com.placement.controller;

import com.placement.entity.User;
import com.placement.entity.Role;
import com.placement.repository.UserRepository;
import com.placement.exception.ApiException;
import com.placement.dto.DashboardDtos.DashboardResponse;
import com.placement.dto.DashboardDtos.RecentActivity;
import com.placement.service.CurrentUserService;
import com.placement.service.DashboardService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/dashboard")
@RequiredArgsConstructor
public class DashboardController {

    private final DashboardService dashboardService;
    private final CurrentUserService currentUserService;
    private final UserRepository userRepository;

    private User getTargetUser(Long studentId) {
        User caller = currentUserService.getCurrentUser();
        if (studentId == null) return caller;
        if (caller.getRole() == Role.ADMIN) {
            return userRepository.findById(studentId).orElseThrow(() -> ApiException.notFound("Student not found"));
        } else if (!caller.getId().equals(studentId)) {
            throw ApiException.forbidden("Cannot access other student's data");
        }
        return caller;
    }

    @GetMapping({"", "/{studentId}"})
    public DashboardResponse dashboard(@PathVariable(required = false) Long studentId) { 
        return dashboardService.getDashboard(getTargetUser(studentId)); 
    }

    @GetMapping({"/overview", "/overview/{studentId}"})
    public DashboardResponse overview(@PathVariable(required = false) Long studentId) { 
        return dashboardService.getDashboard(getTargetUser(studentId)); 
    }

    @GetMapping({"/performance", "/performance/{studentId}"})
    public DashboardResponse performance(@PathVariable(required = false) Long studentId) { 
        return dashboardService.getDashboard(getTargetUser(studentId)); 
    }

    @GetMapping({"/skills", "/skills/{studentId}"})
    public java.util.Map<String, Double> skills(@PathVariable(required = false) Long studentId) { 
        return dashboardService.getDashboard(getTargetUser(studentId)).skillBreakdown(); 
    }

    @GetMapping({"/readiness", "/readiness/{studentId}"})
    public Object readiness(@PathVariable(required = false) Long studentId) {
        DashboardResponse d = dashboardService.getDashboard(getTargetUser(studentId));
        return java.util.Map.of("readinessScore", d.readinessScore(), "readinessLevel", d.readinessLevel());
    }

    @GetMapping({"/recent-activity", "/recent-activity/{studentId}"})
    public java.util.List<RecentActivity> recentActivity(@PathVariable(required = false) Long studentId) {
        return dashboardService.getDashboard(getTargetUser(studentId)).recentActivity();
    }
}
