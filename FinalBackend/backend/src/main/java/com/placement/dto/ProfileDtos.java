package com.placement.dto;

import java.time.LocalDate;
import java.util.List;

public class ProfileDtos {
    public record SkillDto(Long id, String name, Integer proficiency, String category) {}
    public record ProjectDto(Long id, String title, String description, String techStack, String link) {}
    public record CertificationDto(Long id, String name, String issuer, LocalDate issueDate, String credentialUrl) {}
    public record EducationDto(String college, String degree, String branch, Integer graduationYear, Double cgpa) {}
    public record ProfileResponse(
            Long id, String fullName, String email, String phone, String college, String degree, String branch,
            Integer graduationYear, Double cgpa, Long targetRoleId, String targetRoleTitle,
            String linkedinUrl, String githubUrl, String preferredCompanies, String experienceLevel,
            String resumeFileName, String resumeText, java.time.LocalDateTime resumeUpdatedAt,
            boolean hasAvatar, String avatarUrl,
            List<SkillDto> skills, List<ProjectDto> projects, List<CertificationDto> certifications,
            // Section 4: mandatory-profile gate. Everything else on this page (skills, projects,
            // certifications, LinkedIn/GitHub, target role, preferred companies, experience level,
            // avatar...) stays optional - only these five ever show up in missingRequiredFields.
            boolean profileComplete, List<String> missingRequiredFields
    ) {}
    public record UpdateProfileRequest(String phone, String college, String degree, String branch,
                                        Integer graduationYear, Double cgpa, Long targetRoleId,
                                        String linkedinUrl, String githubUrl, String preferredCompanies,
                                        String experienceLevel) {}
    /** The frontend extracts text client-side (lib/fileParsing.ts) and posts just the result here -
     *  no raw file upload/parsing on the backend, so this endpoint is simple and dependency-free. */
    public record ResumeUploadRequest(String fileName, String text) {}
    public record ResumeUploadResponse(String fileName, String text, List<String> matchedSkills) {}
}
