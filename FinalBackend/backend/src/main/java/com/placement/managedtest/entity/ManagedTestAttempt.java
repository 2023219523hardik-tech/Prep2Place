package com.placement.managedtest.entity;

import com.placement.assessment.entity.AttemptStatus;
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
 * One candidate's run at a {@link ManagedTest}. Created once at start time with the resolved
 * question order and a frozen config snapshot; nothing about its content changes afterwards, only
 * status, answers and timer state. Reuses the existing
 * {@link com.placement.assessment.entity.AttemptStatus} lifecycle rather than inventing a parallel
 * one, so reporting code that already understands AttemptStatus keeps working.
 *
 * Remaining time is always derived from serverExpiresAt - the client never asserts it.
 */
@Entity
@Table(name = "managed_test_attempt",
        uniqueConstraints = @UniqueConstraint(name = "uk_mt_attempt_number",
                columnNames = {"test_id", "student_id", "attempt_number"}),
        indexes = {
                @Index(name = "idx_mt_attempt_student", columnList = "student_id"),
                @Index(name = "idx_mt_attempt_test", columnList = "test_id"),
                @Index(name = "idx_mt_attempt_status", columnList = "status"),
                @Index(name = "idx_mt_attempt_created_at", columnList = "created_at"),
                @Index(name = "idx_mt_attempt_session", columnList = "session_id")
        })
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ManagedTestAttempt {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "test_id", nullable = false)
    private ManagedTest test;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "student_id", nullable = false)
    private User student;

    @Column(name = "attempt_number", nullable = false)
    @Builder.Default
    private int attemptNumber = 1;

    /** Opaque per-attempt session id, reused as the correlation key for proctoring events. */
    @Column(name = "session_id", length = 64)
    private String sessionId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private AttemptStatus status = AttemptStatus.NOT_STARTED;

    /** sectionId (as string) -> ordered list of managed_test_question ids served to this candidate. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "question_order", columnDefinition = "jsonb", nullable = false)
    @Builder.Default
    private Map<String, List<Long>> questionOrder = new HashMap<>();

    /** sectionId -> { "startedAt": epochMillis, "expiresAt": epochMillis, "submitted": bool }. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "section_state", columnDefinition = "jsonb")
    @Builder.Default
    private Map<String, Object> sectionState = new HashMap<>();

    /** Test rules frozen at start, so a later admin edit never changes a running attempt. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "config_snapshot", columnDefinition = "jsonb")
    @Builder.Default
    private Map<String, Object> configSnapshot = new HashMap<>();

    private Instant startedAt;

    /** Authoritative, server-calculated deadline for the overall timer. */
    private Instant serverExpiresAt;

    private Instant submittedAt;
    private Instant lastAutosaveAt;

    // ---- result ----
    @Builder.Default
    private double scoredMarks = 0d;
    @Builder.Default
    private double totalMarks = 0d;
    @Builder.Default
    private double percentage = 0d;
    /** Correct / attempted, as a percentage. Distinct from percentage, which is marks-based. */
    @Builder.Default
    private double accuracy = 0d;
    @Builder.Default
    private int correctCount = 0;
    @Builder.Default
    private int wrongCount = 0;
    @Builder.Default
    private int unattemptedCount = 0;
    @Builder.Default
    private int pendingReviewCount = 0;
    @Builder.Default
    private boolean passed = false;

    /** Percentile among submitted attempts of the same test, recomputed on read. Null until known. */
    private Double percentile;

    // ---- integrity ----
    @Builder.Default
    private int violationCount = 0;
    @Builder.Default
    private int integrityScore = 100;
    private String terminationReason;

    /** Section-wise breakdown, topic-wise accuracy and difficulty-wise counts, written at submit. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "result_details", columnDefinition = "jsonb")
    @Builder.Default
    private Map<String, Object> resultDetails = new HashMap<>();

    private String startIpAddress;
    private String startUserAgent;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
    @Column(name = "updated_at")
    private Instant updatedAt;

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        if (createdAt == null) createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void onUpdate() { updatedAt = Instant.now(); }

    @Transient
    public boolean isTerminal() {
        return status == AttemptStatus.SUBMITTED || status == AttemptStatus.AUTO_SUBMITTED
                || status == AttemptStatus.TERMINATED || status == AttemptStatus.LOCKED;
    }
}
