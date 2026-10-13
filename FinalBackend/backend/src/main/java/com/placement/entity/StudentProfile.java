package com.placement.entity;

import jakarta.persistence.*;
import lombok.*;

import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "student_profile")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StudentProfile {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    private User user;

    private String phone;
    private String college;
    private String degree;
    private String branch;
    private Integer graduationYear;
    private Double cgpa;

    // Section 2 additions - the fields the profile page was missing entirely.
    private String linkedinUrl;
    private String githubUrl;
    /** Comma-separated free text (e.g. "Google, Amazon, Flipkart") - kept simple rather than a
     *  new normalized entity since this is a display/matching hint, not something queried on. */
    private String preferredCompanies;
    private String experienceLevel;

    private String resumeFileName;
    
    @Column(columnDefinition = "TEXT")
    private String resumeText;
    private java.time.LocalDateTime resumeUpdatedAt;

    /** Same access-controlled-storage pattern as violation evidence (Section 1.1) - never a
     *  public URL, served through an authenticated endpoint gated to the profile owner (or admin). */
    @Lob
    @Basic(fetch = jakarta.persistence.FetchType.LAZY)
    private byte[] avatarImage;
    private String avatarContentType;

    @ManyToOne
    @JoinColumn(name = "target_role_id")
    private JobRole targetRole;

    @Builder.Default
    @Column(nullable = false)
    private Integer codingScore = 0;

    @Builder.Default
    @Column(nullable = false)
    private Integer aptitudeScore = 0;

    @Builder.Default
    @Column(nullable = false)
    private Integer interviewScore = 0;

    @Builder.Default
    @OneToMany(mappedBy = "profile", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Skill> skills = new ArrayList<>();

    @Builder.Default
    @OneToMany(mappedBy = "profile", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<ProjectEntry> projects = new ArrayList<>();

    @Builder.Default
    @OneToMany(mappedBy = "profile", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Certification> certifications = new ArrayList<>();
}
