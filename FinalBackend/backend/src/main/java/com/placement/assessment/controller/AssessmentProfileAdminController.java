package com.placement.assessment.controller;

import com.placement.assessment.entity.AssessmentProfile;
import com.placement.assessment.entity.AssessmentType;
import com.placement.assessment.repository.AssessmentProfileRepository;
import com.placement.exception.ApiException;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** Admin-only (covered by SecurityConfig's /api/admin/** rule). Lets admins define/edit reusable
 *  assessment profiles - generic mock tests, aptitude tests, interview scopes, or named company
 *  profiles - without any code changes. */
@RestController
@RequestMapping("/api/admin/assessment-profiles")
@RequiredArgsConstructor
public class AssessmentProfileAdminController {

    private final AssessmentProfileRepository repository;

    @GetMapping
    public List<AssessmentProfile> list(@RequestParam(required = false) AssessmentType type) {
        return type != null ? repository.findByAssessmentTypeAndActiveTrue(type) : repository.findAll();
    }

    @GetMapping("/{id}")
    public AssessmentProfile get(@PathVariable Long id) {
        return repository.findById(id).orElseThrow(() -> ApiException.notFound("Profile " + id + " not found"));
    }

    @PostMapping
    public AssessmentProfile create(@RequestBody AssessmentProfile profile) {
        profile.setId(null);
        return repository.save(profile);
    }

    @PutMapping("/{id}")
    public AssessmentProfile update(@PathVariable Long id, @RequestBody AssessmentProfile updated) {
        AssessmentProfile existing = repository.findById(id).orElseThrow(() -> ApiException.notFound("Profile " + id + " not found"));
        updated.setId(existing.getId());
        return repository.save(updated);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deactivate(@PathVariable Long id) {
        AssessmentProfile existing = repository.findById(id).orElseThrow(() -> ApiException.notFound("Profile " + id + " not found"));
        existing.setActive(false); // soft delete - attempts already referencing this profile must keep working
        repository.save(existing);
        return ResponseEntity.ok().build();
    }
}
