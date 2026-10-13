package com.placement.codinglab.entity;

import com.placement.entity.User;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

/**
 * One student's workspace for a {@link CodingAssessment}: current file contents (autosaved),
 * timer, and AI-hint usage counters (server-authoritative - Section 26 "students cannot manipulate
 * scores/timers through client-side requests").
 */
@Entity
@Table(name = "coding_attempt")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CodingAttempt {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "candidate_id", nullable = false)
    private User candidate;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assessment_id", nullable = false)
    private CodingAssessment assessment;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private CodingAttemptStatus status = CodingAttemptStatus.STARTED;

    /** Seeded from assessment.starterFiles at start; overwritten by student autosave/Run/Submit.
     *  Hidden test files are never part of this map. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb", nullable = false)
    @Builder.Default
    private Map<String, String> currentFiles = new HashMap<>();

    @Builder.Default
    private double bestScore = 0.0;

    private Long bestSubmissionId;

    @Builder.Default
    private int aiHintsUsed = 0;

    @Builder.Default
    private int aiRequestsUsed = 0;

    private Instant lastAiRequestAt;

    private Instant startedAt;
    private Instant expiresAt;
    private Instant completedAt;
    private Instant lastActivityAt;

    private Instant createdAt;
    private Instant updatedAt;

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
}
