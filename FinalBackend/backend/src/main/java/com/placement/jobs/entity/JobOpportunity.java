package com.placement.jobs.entity;

import com.placement.entity.User;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * A placement opportunity posted by an admin/recruiter. Students can browse and apply.
 */
@Entity
@Table(name = "job_opportunity")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class JobOpportunity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(nullable = false, length = 200)
    private String company;

    @Column(length = 200)
    private String location;

    /** FULL_TIME | INTERNSHIP | CONTRACT | PART_TIME */
    @Column(length = 40)
    private String employmentType;

    /** FRESHER | ENTRY | MID | SENIOR */
    @Column(length = 40)
    private String experienceLevel;

    /** Salary in INR LPA (lakhs per annum) - min. */
    private Double salaryMinLpa;

    /** Salary in INR LPA - max. */
    private Double salaryMaxLpa;

    @Column(length = 4000)
    private String description;

    /** Comma separated required skills, e.g. "Java,Spring Boot,SQL" */
    @Column(length = 1000)
    private String requiredSkills;

    @Column(length = 1000)
    private String niceToHaveSkills;

    /** External apply URL. If present, students apply on the company site; otherwise in-app. */
    @Column(length = 500)
    private String applyUrl;

    @Builder.Default
    @Column(nullable = false)
    private LocalDateTime postedAt = LocalDateTime.now();

    /** When the posting closes. Null = open until manually deactivated. */
    private LocalDate closesAt;

    @Column(length = 200)
    private String slug;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "company_id")
    private com.placement.questionbank.entity.Company companyRef;

    @Column(length = 100)
    private String department;

    @Builder.Default
    private Integer openings = 1;

    private Double stipend;

    /** DRAFT | PUBLISHED | CLOSED | ARCHIVED */
    @Builder.Default
    @Column(length = 50)
    private String status = "PUBLISHED";

    private Double minCgpa;
    private Integer maxBacklogs;
    private Integer graduationYear;
    private Integer minGraduationYear;
    private Integer maxGraduationYear;

    @Column(length = 500)
    private String branches;

    @Column(length = 500)
    private String allowedDegrees;

    @Column(length = 1000)
    private String requiredCertifications;

    @Column(length = 2000)
    private String benefits;

    @Column(length = 4000)
    private String responsibilities;

    /** Execution mode: PREP2PLACE_MANAGED | HYBRID | SELF_MANAGED */
    @Enumerated(EnumType.STRING)
    @Builder.Default
    @Column(length = 50)
    private PipelineExecutionMode pipelineManagementMode = PipelineExecutionMode.PREP2PLACE_MANAGED;

    /** Scheduling policy: SEQUENTIAL | INDEPENDENT */
    @Enumerated(EnumType.STRING)
    @Builder.Default
    @Column(length = 50)
    private PipelineSchedulingPolicy schedulingPolicy = PipelineSchedulingPolicy.SEQUENTIAL;

    /** ATS Screening Configuration */
    @Builder.Default
    @Column(nullable = false)
    private boolean atsScreeningEnabled = true;

    @Builder.Default
    private Double atsMinimumScore = 75.0;

    @Builder.Default
    @Column(nullable = false)
    private boolean autoShortlistEnabled = false;

    @Builder.Default
    @Column(nullable = false)
    private boolean manualReviewRequired = true;

    /** JSON string with category weights: requiredSkills, preferredSkills, experience, education, keywords */
    @Column(columnDefinition = "TEXT")
    private String atsScoringWeights;

    @Builder.Default
    @Column(nullable = false)
    private boolean active = true;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "posted_by")
    private User postedBy;
}
