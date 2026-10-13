package com.placement.service;

import com.placement.dto.ProfileDtos.*;
import com.placement.entity.*;
import com.placement.exception.ApiException;
import com.placement.repository.JobRoleRepository;
import com.placement.repository.StudentProfileRepository;
import com.placement.service.support.SkillCategorizer;
import lombok.RequiredArgsConstructor;
import org.hibernate.Hibernate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class StudentProfileService {

    private final StudentProfileRepository profileRepository;
    private final JobRoleRepository jobRoleRepository;

    private static String categorize(String skillName) { return SkillCategorizer.categorize(skillName); }

    @Transactional
    public StudentProfile getOrCreateProfile(User user) {
        StudentProfile profile = profileRepository.findByUser(user).orElse(null);
        if (profile == null) {
            profile = profileRepository.save(StudentProfile.builder().user(user).build());
            profile = profileRepository.findByUser(user).orElse(profile);
        }
        hydrate(profile);
        return profile;
    }

    @Transactional(readOnly = true)
    public ProfileResponse getProfile(User user) { return toResponse(getOrCreateProfile(user)); }

    /**
     * Section 4 acceptance criterion: "hitting a protected API route directly, bypassing the UI,
     * with an incomplete profile is rejected server-side." The frontend gate (redirect to
     * /profile) is UX; this is the actual enforcement. Call this from any endpoint that starts a
     * real, gradable session - interview, mock test, coding attempt - not from read-only browsing
     * endpoints, which stay open so the student can see what's locked and why.
     */
    @Transactional
    public void requireCompleteProfile(User user) {
        StudentProfile profile = getOrCreateProfile(user);
        List<String> missing = missingRequiredFields(profile);
        if (!missing.isEmpty()) {
            throw ApiException.badRequest(
                    "Complete your profile before starting this - missing: " + String.join(", ", missing));
        }
    }

    @Transactional(readOnly = true)
    public ProfileResponse getProfileByStudentId(Long userId) {
        StudentProfile profile = profileRepository.findByUserId(userId)
                .orElseThrow(() -> ApiException.notFound("Student profile not found"));
        hydrate(profile);
        return toResponse(profile);
    }

    private static void hydrate(StudentProfile p) {
        Hibernate.initialize(p.getSkills());
        Hibernate.initialize(p.getProjects());
        Hibernate.initialize(p.getCertifications());
        if (p.getTargetRole() != null) {
            Hibernate.initialize(p.getTargetRole());
        }
    }

    @Transactional
    public ProfileResponse updateProfile(User user, UpdateProfileRequest request) {
        StudentProfile profile = getOrCreateProfile(user);
        if (request.phone() != null) profile.setPhone(blankToNull(request.phone()));
        if (request.college() != null) profile.setCollege(request.college());
        if (request.degree() != null) profile.setDegree(request.degree());
        if (request.branch() != null) profile.setBranch(request.branch());
        if (request.graduationYear() != null) profile.setGraduationYear(request.graduationYear());
        if (request.cgpa() != null) {
            if (request.cgpa() < 0 || request.cgpa() > 10) {
                throw ApiException.badRequest("CGPA must be between 0 and 10");
            }
            profile.setCgpa(request.cgpa());
        }
        if (request.targetRoleId() != null) {
            JobRole role = jobRoleRepository.findById(request.targetRoleId())
                    .orElseThrow(() -> ApiException.notFound("Job role not found"));
            profile.setTargetRole(role);
        }
        if (request.linkedinUrl() != null) profile.setLinkedinUrl(blankToNull(request.linkedinUrl()));
        if (request.githubUrl() != null) profile.setGithubUrl(blankToNull(request.githubUrl()));
        if (request.preferredCompanies() != null) profile.setPreferredCompanies(blankToNull(request.preferredCompanies()));
        if (request.experienceLevel() != null) profile.setExperienceLevel(blankToNull(request.experienceLevel()));
        return toResponse(profileRepository.save(profile));
    }

    private static String blankToNull(String s) { return s.isBlank() ? null : s; }

    @Transactional
    public List<SkillDto> updateSkills(User user, List<SkillDto> skills) {
        StudentProfile profile = getOrCreateProfile(user);
        profile.getSkills().clear();
        Set<String> seen = new LinkedHashSet<>();
        for (SkillDto s : skills) {
            String name = s.name() == null ? "" : s.name().trim();
            if (name.isEmpty() || !seen.add(name.toLowerCase())) continue; // skip blanks/dupes
            profile.getSkills().add(Skill.builder().profile(profile).name(name)
                    .proficiency(s.proficiency() == null ? 1 : s.proficiency()).build());
        }
        profileRepository.save(profile);
        return profile.getSkills().stream()
                .map(s -> new SkillDto(s.getId(), s.getName(), s.getProficiency(), categorize(s.getName()))).toList();
    }

    /** Section 2: resume upload with parsed-skill preview. Text is already extracted client-side
     *  (lib/fileParsing.ts) - this just stores it and does a real substring match against the
     *  known skill vocabulary, so the "skills we found" list reflects actual resume content. */
    @Transactional
    public ResumeUploadResponse uploadResume(User user, ResumeUploadRequest request) {
        if (request.text() == null || request.text().isBlank()) {
            throw ApiException.badRequest("No resume text provided");
        }
        StudentProfile profile = getOrCreateProfile(user);
        profile.setResumeFileName(request.fileName());
        profile.setResumeText(request.text());
        profile.setResumeUpdatedAt(LocalDateTime.now());
        profileRepository.save(profile);

        String haystack = " " + request.text().toLowerCase().replaceAll("[^a-z0-9.#+ ]", " ") + " ";
        List<String> matched = SkillCategorizer.knownSkills().stream()
                .filter(skill -> haystack.contains(" " + skill + " "))
                .toList();

        return new ResumeUploadResponse(request.fileName(), request.text(), matched);
    }

    @Transactional
    public void uploadAvatar(User user, byte[] bytes, String contentType) {
        StudentProfile profile = getOrCreateProfile(user);
        profile.setAvatarImage(bytes);
        profile.setAvatarContentType(contentType != null ? contentType : "image/jpeg");
        profileRepository.save(profile);
    }

    public record AvatarPayload(byte[] bytes, String contentType) {}

    @Transactional(readOnly = true)
    public AvatarPayload getAvatar(User requester, Long profileOwnerUserId) {
        StudentProfile profile = profileRepository.findByUserId(profileOwnerUserId)
                .orElseThrow(() -> ApiException.notFound("Student profile not found"));
        boolean isOwner = profile.getUser().getId().equals(requester.getId());
        boolean isStaff = requester.getRole() != Role.STUDENT;
        if (!isOwner && !isStaff) {
            throw ApiException.forbidden("Not authorized to view this profile photo");
        }
        if (profile.getAvatarImage() == null) {
            throw ApiException.notFound("No profile photo uploaded");
        }
        return new AvatarPayload(profile.getAvatarImage(), profile.getAvatarContentType());
    }

    @Transactional
    public ProjectDto addProject(User user, ProjectDto dto) {
        StudentProfile profile = getOrCreateProfile(user);
        ProjectEntry entry = ProjectEntry.builder().profile(profile).title(dto.title())
                .description(dto.description()).techStack(dto.techStack()).link(dto.link()).build();
        profile.getProjects().add(entry);
        profileRepository.save(profile);
        return new ProjectDto(entry.getId(), entry.getTitle(), entry.getDescription(), entry.getTechStack(), entry.getLink());
    }

    @Transactional
    public ProjectDto updateProject(User user, Long projectId, ProjectDto dto) {
        StudentProfile profile = getOrCreateProfile(user);
        ProjectEntry entry = profile.getProjects().stream().filter(p -> p.getId().equals(projectId)).findFirst()
                .orElseThrow(() -> ApiException.notFound("Project not found"));
        if (dto.title() != null) entry.setTitle(dto.title());
        if (dto.description() != null) entry.setDescription(dto.description());
        if (dto.techStack() != null) entry.setTechStack(dto.techStack());
        if (dto.link() != null) entry.setLink(dto.link());
        profileRepository.save(profile);
        return new ProjectDto(entry.getId(), entry.getTitle(), entry.getDescription(), entry.getTechStack(), entry.getLink());
    }

    @Transactional
    public void deleteProject(User user, Long projectId) {
        StudentProfile profile = getOrCreateProfile(user);
        profile.getProjects().removeIf(p -> p.getId().equals(projectId));
        profileRepository.save(profile);
    }

    @Transactional
    public CertificationDto addCertification(User user, CertificationDto dto) {
        StudentProfile profile = getOrCreateProfile(user);
        Certification cert = Certification.builder().profile(profile).name(dto.name()).issuer(dto.issuer())
                .issueDate(dto.issueDate()).credentialUrl(dto.credentialUrl()).build();
        profile.getCertifications().add(cert);
        profileRepository.save(profile);
        return new CertificationDto(cert.getId(), cert.getName(), cert.getIssuer(), cert.getIssueDate(), cert.getCredentialUrl());
    }

    @Transactional
    public void deleteCertification(User user, Long certId) {
        StudentProfile profile = getOrCreateProfile(user);
        profile.getCertifications().removeIf(c -> c.getId().equals(certId));
        profileRepository.save(profile);
    }

    private ProfileResponse toResponse(StudentProfile p) {
        boolean hasAvatar = p.getAvatarImage() != null && p.getAvatarImage().length > 0;
        List<String> missing = missingRequiredFields(p);
        return new ProfileResponse(
                p.getId(), p.getUser().getFullName(), p.getUser().getEmail(), p.getPhone(),
                p.getCollege(), p.getDegree(), p.getBranch(), p.getGraduationYear(), p.getCgpa(),
                p.getTargetRole() == null ? null : p.getTargetRole().getId(),
                p.getTargetRole() == null ? null : p.getTargetRole().getTitle(),
                p.getLinkedinUrl(), p.getGithubUrl(), p.getPreferredCompanies(), p.getExperienceLevel(),
                p.getResumeFileName(), p.getResumeText(), p.getResumeUpdatedAt(),
                hasAvatar, hasAvatar ? "/api/students/" + p.getUser().getId() + "/avatar" : null,
                p.getSkills().stream().map(s -> new SkillDto(s.getId(), s.getName(), s.getProficiency(), categorize(s.getName()))).toList(),
                p.getProjects().stream().map(pr -> new ProjectDto(pr.getId(), pr.getTitle(), pr.getDescription(), pr.getTechStack(), pr.getLink())).toList(),
                p.getCertifications().stream().map(c -> new CertificationDto(c.getId(), c.getName(), c.getIssuer(), c.getIssueDate(), c.getCredentialUrl())).toList(),
                missing.isEmpty(), missing
        );
    }

    /**
     * Section 4: the only fields that gate a new user out of the rest of the app. Name and email
     * come from User and are already NOT NULL at signup (AuthService/registration), so in
     * practice this only ever reports phone/college/resume - but all five are checked here so the
     * rule lives in exactly one place instead of being duplicated (and potentially drifting)
     * between frontend validation and this backend check.
     */
    static List<String> missingRequiredFields(StudentProfile p) {
        List<String> missing = new java.util.ArrayList<>();
        if (isBlank(p.getUser().getFullName())) missing.add("fullName");
        if (isBlank(p.getUser().getEmail())) missing.add("email");
        if (isBlank(p.getPhone())) missing.add("phone");
        if (isBlank(p.getCollege())) missing.add("university");
        if (isBlank(p.getResumeFileName()) || isBlank(p.getResumeText())) missing.add("resume");
        return missing;
    }

    private static boolean isBlank(String s) { return s == null || s.isBlank(); }
}
