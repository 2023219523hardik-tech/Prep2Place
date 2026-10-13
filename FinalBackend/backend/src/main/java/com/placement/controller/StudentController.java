package com.placement.controller;

import com.placement.dto.ProfileDtos.*;
import com.placement.service.CurrentUserService;
import com.placement.service.StudentProfileService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/students")
@RequiredArgsConstructor
public class StudentController {

    private final StudentProfileService profileService;
    private final CurrentUserService currentUserService;

    @GetMapping("/profile")
    public ProfileResponse getProfile() { return profileService.getProfile(currentUserService.getCurrentUser()); }

    @PutMapping("/profile")
    public ProfileResponse updateProfile(@RequestBody UpdateProfileRequest request) {
        return profileService.updateProfile(currentUserService.getCurrentUser(), request);
    }

    @GetMapping("/{studentId}/skills")
    public List<SkillDto> getSkills(@PathVariable Long studentId) {
        return profileService.getProfileByStudentId(studentId).skills();
    }

    @PutMapping("/{studentId}/skills")
    public List<SkillDto> updateSkills(@PathVariable Long studentId, @RequestBody List<SkillDto> skills) {
        return profileService.updateSkills(currentUserService.getCurrentUser(), skills);
    }

    @GetMapping("/{studentId}/education")
    public EducationDto getEducation(@PathVariable Long studentId) {
        ProfileResponse p = profileService.getProfileByStudentId(studentId);
        return new EducationDto(p.college(), p.degree(), p.branch(), p.graduationYear(), p.cgpa());
    }

    @PutMapping("/{studentId}/education")
    public ProfileResponse updateEducation(@PathVariable Long studentId, @RequestBody EducationDto dto) {
        UpdateProfileRequest req = new UpdateProfileRequest(null, dto.college(), dto.degree(), dto.branch(),
                dto.graduationYear(), dto.cgpa(), null, null, null, null, null);
        return profileService.updateProfile(currentUserService.getCurrentUser(), req);
    }

    @GetMapping("/{studentId}/projects")
    public List<ProjectDto> getProjects(@PathVariable Long studentId) {
        return profileService.getProfileByStudentId(studentId).projects();
    }

    @PostMapping("/{studentId}/projects")
    public ProjectDto addProject(@PathVariable Long studentId, @RequestBody ProjectDto dto) {
        return profileService.addProject(currentUserService.getCurrentUser(), dto);
    }

    @PutMapping("/{studentId}/projects/{projectId}")
    public ProjectDto updateProject(@PathVariable Long studentId, @PathVariable Long projectId, @RequestBody ProjectDto dto) {
        return profileService.updateProject(currentUserService.getCurrentUser(), projectId, dto);
    }

    @DeleteMapping("/{studentId}/projects/{projectId}")
    public void deleteProject(@PathVariable Long studentId, @PathVariable Long projectId) {
        profileService.deleteProject(currentUserService.getCurrentUser(), projectId);
    }

    @GetMapping("/{studentId}/certifications")
    public List<CertificationDto> getCertifications(@PathVariable Long studentId) {
        return profileService.getProfileByStudentId(studentId).certifications();
    }

    @PostMapping("/{studentId}/certifications")
    public CertificationDto addCertification(@PathVariable Long studentId, @RequestBody CertificationDto dto) {
        return profileService.addCertification(currentUserService.getCurrentUser(), dto);
    }

    @DeleteMapping("/{studentId}/certifications/{id}")
    public void deleteCertification(@PathVariable Long studentId, @PathVariable Long id) {
        profileService.deleteCertification(currentUserService.getCurrentUser(), id);
    }

    // --- Section 2 additions: resume upload (text already extracted client-side) + avatar ---

    @PostMapping("/{studentId}/resume")
    public ResumeUploadResponse uploadResume(@PathVariable Long studentId, @RequestBody ResumeUploadRequest request) {
        return profileService.uploadResume(currentUserService.getCurrentUser(), request);
    }

    @PostMapping(value = "/{studentId}/avatar", consumes = "multipart/form-data")
    public ProfileResponse uploadAvatar(@PathVariable Long studentId,
                                         @org.springframework.web.bind.annotation.RequestParam("file") org.springframework.web.multipart.MultipartFile file) throws java.io.IOException {
        if (file.getSize() > 2 * 1024 * 1024) {
            throw com.placement.exception.ApiException.badRequest("Profile photo must be under 2 MB");
        }
        var user = currentUserService.getCurrentUser();
        profileService.uploadAvatar(user, file.getBytes(), file.getContentType());
        return profileService.getProfile(user);
    }

    /** Access-controlled like violation evidence (Section 1.1) - never a public URL. */
    @GetMapping("/{studentId}/avatar")
    public org.springframework.http.ResponseEntity<byte[]> getAvatar(@PathVariable Long studentId) {
        var payload = profileService.getAvatar(currentUserService.getCurrentUser(), studentId);
        return org.springframework.http.ResponseEntity.ok()
                .contentType(org.springframework.http.MediaType.parseMediaType(payload.contentType()))
                .header(org.springframework.http.HttpHeaders.CACHE_CONTROL, "private, max-age=300")
                .body(payload.bytes());
    }
}
