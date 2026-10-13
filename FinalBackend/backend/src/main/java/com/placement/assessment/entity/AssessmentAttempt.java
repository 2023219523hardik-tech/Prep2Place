package com.placement.assessment.entity;

import com.placement.entity.User;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * The single source of truth for one candidate's attempt at an assessment. Created once, at start
 * time, with the exact randomized question set and a config snapshot frozen into it - nothing
 * about the attempt's content can change after creation, only its status/answers/timer state.
 * Refresh/reconnect always re-reads this row; the frontend never re-derives questions or remaining
 * time locally.
 */
@Entity
@Table(name = "assessment_attempt")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AssessmentAttempt {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "candidate_id", nullable = false)
    private User candidate;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "profile_id", nullable = false)
    private AssessmentProfile profile;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private AssessmentType assessmentType;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private AttemptStatus status = AttemptStatus.NOT_STARTED;

    /** Locked at start time. Canonical question ids in the exact order presented to this candidate. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb", nullable = false)
    @Builder.Default
    private List<Long> selectedQuestionIds = new java.util.ArrayList<>();

    /** Frozen copy of the profile's rules at start time, so a later admin edit to the profile never
     *  silently changes the rules of an attempt already in progress. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    @Builder.Default
    private Map<String, Object> configSnapshot = new HashMap<>();

    /** questionId (as string key) -> candidate's saved answer/code/selected-option state. Autosaved. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    @Builder.Default
    private Map<String, Object> answerState = new HashMap<>();

    /** questionId -> last known language used (coding attempts). */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    @Builder.Default
    private Map<String, String> languageState = new HashMap<>();

    private Instant startedAt;

    /** Server-calculated, authoritative. durationMinutes from the config snapshot, fixed at start. */
    private Instant serverExpiresAt;

    private Instant submittedAt;
    private Instant lastAutosaveAt;

    @Builder.Default
    private int violationCount = 0;

    @Builder.Default
    private int integrityScore = 100; // decremented per violation severity; never below 0

    private String terminationReason;

    @Builder.Default
    private double rawScore = 0.0;
    @Builder.Default
    private double maxPossibleScore = 0.0;

    /** Computed result breakdown (topic-wise accuracy, per-question correctness, etc.) written by
     *  each module's grading logic at submit time. Consumed by the reporting/readiness layer. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    @Builder.Default
    private Map<String, Object> resultDetails = new HashMap<>();

    private Instant createdAt;
    private Instant updatedAt;

    /** IP/user-agent captured at start for audit purposes only - never used as a sole integrity signal. */
    private String startIpAddress;
    private String startUserAgent;

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }

    @Transient
    public boolean isTerminalState() {
        return status == AttemptStatus.SUBMITTED || status == AttemptStatus.AUTO_SUBMITTED
                || status == AttemptStatus.TERMINATED || status == AttemptStatus.TAB_SWITCH_TERMINATED
                || status == AttemptStatus.AUTO_SUBMITTED_TAB_SWITCH || status == AttemptStatus.LOCKED;
    }
}
