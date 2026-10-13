package com.placement.questionbank.entity;

import com.placement.entity.Difficulty;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * A reusable technical MCQ in the Question Bank.
 *
 * Modelled as its own table for the same reason AptitudeQuestion is: CanonicalQuestion has no
 * concept of options or a correct answer (it describes coding problems), and bolting eight nullable
 * MCQ columns onto it would have muddied the dedup/sync pipeline that owns that table. The optional
 * canonicalQuestionId back-link mirrors AptitudeQuestion.canonicalQuestionId, so a technical MCQ can
 * still participate in the unified bank when it has been mirrored there.
 */
@Entity
@Table(name = "technical_mcq_question", indexes = {
        @Index(name = "idx_tmq_category", columnList = "category"),
        @Index(name = "idx_tmq_difficulty", columnList = "difficulty"),
        @Index(name = "idx_tmq_topic", columnList = "topic"),
        @Index(name = "idx_tmq_active", columnList = "active")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TechnicalMcqQuestion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String questionText;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private TechnicalCategory category;

    @Column(length = 120)
    private String topic;

    @Column(length = 120)
    private String subtopic;

    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    @Builder.Default
    private Difficulty difficulty = Difficulty.MEDIUM;

    /** [{"key":"A","text":"..."}, ...] - key is what answers reference. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb", nullable = false)
    @Builder.Default
    private List<Map<String, String>> options = new ArrayList<>();

    /** One key for single-correct, several for multi-correct. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "correct_options", columnDefinition = "jsonb", nullable = false)
    @Builder.Default
    private List<String> correctOptions = new ArrayList<>();

    @Builder.Default
    private boolean multipleCorrect = false;

    @Column(columnDefinition = "TEXT")
    private String explanation;

    @Builder.Default
    private double defaultMarks = 1d;

    @Builder.Default
    private double defaultNegativeMarks = 0d;

    @Builder.Default
    private int estimatedTimeSeconds = 60;

    /** Stable natural key used by the seed loader for idempotent upserts. */
    @Column(name = "source_ref", length = 200)
    private String sourceRef;

    /** Optional link to the unified bank, mirroring AptitudeQuestion.canonicalQuestionId. */
    @Column(name = "canonical_question_id")
    private Long canonicalQuestionId;

    @Builder.Default
    @Column(nullable = false)
    private boolean active = true;

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
}
