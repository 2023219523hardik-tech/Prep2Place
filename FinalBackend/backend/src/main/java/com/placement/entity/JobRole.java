package com.placement.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;

import java.util.ArrayList;
import java.util.List;

/**
 * UPDATED: title / domain / description / requiredSkills / questions are unchanged, so every
 * existing reader keeps working. The new columns (department, preferredSkills, experienceLevel,
 * minReadinessScore, active) are all nullable-or-defaulted and added by migration V5.
 *
 * `domain` is kept as the legacy name and `department` is the newer, more precise label; the seed
 * loader populates both with the same value so neither reader is ever empty.
 */
@Entity
@Table(name = "job_role")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class JobRole {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String title; // e.g. "Backend Developer"

    private String domain; // e.g. "Software Development"

    /** Organisational department. Populated alongside `domain` by the seed loader. */
    @Column(length = 120)
    private String department;

    @Column(length = 2000)
    private String description;

    /** Comma separated required skills, e.g. "Java,Spring Boot,SQL,DSA" */
    @Column(length = 1000)
    private String requiredSkills;

    /** Comma separated nice-to-have skills, same format as requiredSkills. */
    @Column(length = 1000)
    private String preferredSkills;

    /** FRESHER | ENTRY | MID | SENIOR - kept as text so new bands need no migration. */
    @Column(length = 40)
    private String experienceLevel;

    /** Readiness score (0-100) below which a student is not considered ready for this role. */
    private Integer minReadinessScore;

    @Builder.Default
    @Column(nullable = false)
    private boolean active = true;

    @Builder.Default
    @JsonIgnore
    @OneToMany(mappedBy = "role", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Question> questions = new ArrayList<>();
}
