package com.placement.controller;

import com.placement.entity.JobRole;
import com.placement.entity.User;
import com.placement.service.CurrentUserService;
import com.placement.service.JobRoleService;
import com.placement.service.SkillGapService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/roles")
@RequiredArgsConstructor
public class JobRoleController {

    private final JobRoleService jobRoleService;
    private final SkillGapService skillGapService;
    private final CurrentUserService currentUserService;

    @GetMapping
    public List<JobRole> list() { return jobRoleService.listRoles(); }

    @GetMapping("/{roleId}")
    public JobRole get(@PathVariable Long roleId) { return jobRoleService.getRole(roleId); }

    @GetMapping("/{roleId}/skills")
    public List<String> skills(@PathVariable Long roleId) { return jobRoleService.getRoleSkills(roleId); }

    @GetMapping("/{roleId}/questions")
    public Object questions(@PathVariable Long roleId) { return jobRoleService.getRoleQuestions(roleId); }

    @PostMapping("/{roleId}/analyze")
    public Object analyze(@PathVariable Long roleId) {
        User user = currentUserService.getCurrentUser();
        return skillGapService.analyze(user, roleId);
    }
}
