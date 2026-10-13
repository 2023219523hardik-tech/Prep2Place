package com.placement.service;

import com.placement.entity.JobRole;
import com.placement.exception.ApiException;
import com.placement.repository.JobRoleRepository;
import com.placement.repository.QuestionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Arrays;
import java.util.List;

@Service
@RequiredArgsConstructor
public class JobRoleService {
    private final JobRoleRepository jobRoleRepository;
    private final QuestionRepository questionRepository;

    @Transactional(readOnly = true)
    public List<JobRole> listRoles() { return jobRoleRepository.findAll(); }

    @Transactional(readOnly = true)
    public JobRole getRole(Long id) {
        return jobRoleRepository.findById(id).orElseThrow(() -> ApiException.notFound("Job role not found"));
    }

    @Transactional(readOnly = true)
    public List<String> getRoleSkills(Long id) {
        JobRole role = getRole(id);
        if (role.getRequiredSkills() == null || role.getRequiredSkills().isBlank()) return List.of();
        return Arrays.stream(role.getRequiredSkills().split(",")).map(String::trim).filter(s -> !s.isEmpty()).toList();
    }

    @Transactional(readOnly = true)
    public Object getRoleQuestions(Long id) { return questionRepository.findByRoleId(id); }
}
