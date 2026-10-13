package com.placement.managedtest.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.placement.entity.Difficulty;
import com.placement.entity.JobRole;
import com.placement.entity.User;
import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * An admin-authored assessment: the root of Test -> Sections -> Questions -> Attempts -> Answers.
 *
 * Soft-deleted only (archived + active=false). Attempts keep referencing archived tests so history
 * and analytics never lose rows.
 */
@Entity
@Table(name = "managed_test", indexes = {
        @Index(name = "idx_managed_test_status", columnList = "status"),
        @Index(name = "idx_managed_test_type", columnList = "test_type"),
        @Index(name = "idx_managed_test_created_at", columnList = "created_at"),
        @Index(name = "idx_managed_test_window", columnList = "starts_at,ends_at")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ManagedTest {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 250)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(name = "test_type", nullable = false, length = 40)
    private TestType testType;

    @Column(length = 2000)
    private String description;

    @Column(columnDefinition = "TEXT")
    private String instructions;

    // ---- targeting (UNIVERSITY_TEST / COMPANY_TEST / PLACEMENT_TEST) ----
    /** University, college or company name. Matched against StudentProfile.college for eligibility. */
    @Column(length = 200)
    private String organizationName;

    @Column(length = 50)
    private String organizationCode;

    /** Graduation year as a label, e.g. "2027". Kept as text so "2027-A" style batches also work. */
    @Column(length = 50)
    private String batch;

    /** Course / branch, matched against StudentProfile.branch. */
    @Column(length = 100)
    private String branch;

    /** Matched against StudentProfile.graduationYear when present. */
    private Integer graduationYear;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "target_job_role_id")
    private JobRole targetJobRole;

    // ---- structure / scoring ----
    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private Difficulty difficulty;

    /** Overall timer in minutes. Section timers, where configured, run inside this budget. */
    @Builder.Default
    private int durationMinutes = 60;

    /** Denormalized sum of section marks, recomputed on every structural change. */
    @Builder.Default
    private double totalMarks = 0d;

    @Builder.Default
    private double passingPercentage = 40d;

    @Builder.Default
    private boolean negativeMarkingEnabled = false;

    /** Default penalty per wrong answer, used when a question/section does not override it. */
    @Builder.Default
    private double defaultNegativeMarks = 0.25d;

    /** When true the overall timer is authoritative; when false each section's own timer is. */
    @Builder.Default
    private boolean overallTimerEnabled = true;

    @Builder.Default
    private boolean sectionTimersEnabled = false;

    /** 0 = unlimited. */
    @Builder.Default
    private int attemptLimit = 1;

    @Builder.Default
    private boolean shuffleSections = false;

    /** Whether results are visible to the candidate immediately after submit. */
    @Builder.Default
    private boolean showResultToStudent = true;

    // ---- availability ----
    @Column(name = "starts_at")
    private Instant startsAt;

    @Column(name = "ends_at")
    private Instant endsAt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private TestStatus status = TestStatus.DRAFT;

    // ---- proctoring ----
    @Builder.Default
    private boolean proctored = false;

    @Builder.Default
    private boolean fullscreenRequired = false;

    @Builder.Default
    private boolean webcamRequired = false;

    /** Violations recorded before the attempt is auto-terminated. 0 = never terminate on count. */
    @Builder.Default
    private int violationCountThreshold = 0;

    // ---- audit / soft delete ----
    @Builder.Default
    @Column(nullable = false)
    private boolean active = true;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by_id")
    private User createdBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at")
    private Instant updatedAt;

    private Instant publishedAt;
    private Instant archivedAt;

    @OneToMany(mappedBy = "test", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @Builder.Default
    @JsonIgnore
    private List<ManagedTestSection> sections = new ArrayList<>();

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        if (createdAt == null) createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void onUpdate() { updatedAt = Instant.now(); }

    @Transient
    public List<ManagedTestSection> orderedSections() {
        List<ManagedTestSection> copy = new ArrayList<>(sections);
        copy.sort(Comparator.comparingInt(ManagedTestSection::getDisplayOrder));
        return copy;
    }

    /** Availability window check used by both the student API and the derived-status refresh. */
    @Transient
    public boolean isWithinWindow(Instant at) {
        if (startsAt != null && at.isBefore(startsAt)) return false;
        return endsAt == null || !at.isAfter(endsAt);
    }

    @Transient
    public boolean isOpenForAttempts(Instant at) {
        return active
                && (status == TestStatus.PUBLISHED || status == TestStatus.SCHEDULED || status == TestStatus.ACTIVE)
                && isWithinWindow(at);
    }
}
