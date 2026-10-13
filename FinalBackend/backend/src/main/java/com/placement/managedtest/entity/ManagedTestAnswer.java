package com.placement.managedtest.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

/**
 * One row per (attempt, question) the candidate interacted with. Autosaved during the attempt and
 * graded in place at submit, which is what makes question-wise review possible afterwards.
 *
 * The correct answer is never part of this row's response payload, and the read APIs strip it from
 * the question payload until the attempt is in a terminal state.
 */
@Entity
@Table(name = "managed_test_answer",
        uniqueConstraints = @UniqueConstraint(name = "uk_mt_answer", columnNames = {"attempt_id", "question_id"}),
        indexes = {
                @Index(name = "idx_mt_answer_attempt", columnList = "attempt_id"),
                @Index(name = "idx_mt_answer_question", columnList = "question_id"),
                @Index(name = "idx_mt_answer_section", columnList = "section_id")
        })
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ManagedTestAnswer {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "attempt_id", nullable = false)
    @JsonIgnore
    private ManagedTestAttempt attempt;

    @Column(name = "question_id", nullable = false)
    private Long questionId;

    @Column(name = "section_id", nullable = false)
    private Long sectionId;

    /**
     * Shaped by the question type:
     *   MCQ:       { "selectedOptions": ["A","C"] }
     *   CODING:    { "code": "...", "language": "java" }
     *   SQL:       { "query": "..." }
     *   DATAFRAME: { "code": "..." }
     */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    @Builder.Default
    private Map<String, Object> response = new HashMap<>();

    @Builder.Default
    private boolean markedForReview = false;

    @Builder.Default
    private int timeSpentSeconds = 0;

    // ---- grading (written at submit) ----
    /** Null while the answer is ungraded or awaiting manual review. */
    private Boolean correct;

    @Builder.Default
    private double marksAwarded = 0d;

    @Enumerated(EnumType.STRING)
    @Column(name = "evaluation_status", length = 20)
    @Builder.Default
    private AnswerEvaluationStatus evaluationStatus = AnswerEvaluationStatus.AUTO_GRADED;

    @Column(length = 1000)
    private String evaluationNote;

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
    public boolean isAttempted() {
        if (response == null || response.isEmpty()) return false;
        Object sel = response.get("selectedOptions");
        if (sel instanceof java.util.Collection<?> c) return !c.isEmpty();
        for (String key : new String[]{"code", "query", "text"}) {
            Object v = response.get(key);
            if (v instanceof String s && !s.isBlank()) return true;
        }
        return sel != null;
    }
}
