package com.placement.managedtest.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.placement.entity.Difficulty;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

/**
 * A question as it exists *inside* a test. Always a self-contained snapshot, whether it was picked
 * from the Question Bank or typed in by the admin.
 *
 * The snapshot is the point: a Question Bank question that is later edited, retired or deduplicated
 * must not silently change a published test, and an admin editing the copy inside a test must not
 * write back to the shared bank. sourceType/sourceQuestionId are kept only for traceability and for
 * the "used in N tests" counter shown in the picker.
 */
@Entity
@Table(name = "managed_test_question", indexes = {
        @Index(name = "idx_mt_question_section", columnList = "section_id"),
        @Index(name = "idx_mt_question_order", columnList = "section_id,display_order"),
        @Index(name = "idx_mt_question_source", columnList = "source_type,source_question_id")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ManagedTestQuestion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "section_id", nullable = false)
    @JsonIgnore
    private ManagedTestSection section;

    @Enumerated(EnumType.STRING)
    @Column(name = "question_type", nullable = false, length = 20)
    private TestQuestionType questionType;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private QuestionOrigin origin = QuestionOrigin.CUSTOM;

    @Enumerated(EnumType.STRING)
    @Column(name = "source_type", length = 20)
    private QuestionSourceType sourceType;

    @Column(name = "source_question_id")
    private Long sourceQuestionId;

    @Column(nullable = false, length = 500)
    private String title;

    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private Difficulty difficulty;

    @Column(length = 120)
    private String topic;

    @Column(length = 120)
    private String subtopic;

    @Builder.Default
    private double marks = 1d;

    @Builder.Default
    private double negativeMarks = 0d;

    @Builder.Default
    private int estimatedTimeSeconds = 60;

    @Column(name = "display_order", nullable = false)
    @Builder.Default
    private int displayOrder = 0;

    /**
     * The full question body, shaped by questionType. Kept as JSONB rather than 30 nullable columns
     * because MCQ / CODING / SQL / DATAFRAME have almost nothing in common beyond the title.
     *
     * MCQ_SINGLE / MCQ_MULTI:
     *   { "body": "...", "options": [{"key":"A","text":"..."}, ...],
     *     "correctOptions": ["A"], "explanation": "..." }
     * CODING:
     *   { "body": "...", "inputFormat": "...", "outputFormat": "...", "constraints": "...",
     *     "examples": [...], "testCases": [{"input":"...","expectedOutput":"...","hidden":true}],
     *     "starterCode": {"java":"..."}, "languages": ["java","python"], "functionSignature": "..." }
     * SQL:
     *   { "body": "...", "schemaDdl": "...", "sampleData": "...", "expectedOutput": "...",
     *     "evaluation": "EXACT_ROWS" | "ORDERED_ROWS" | "MANUAL" }
     * DATAFRAME:
     *   { "body": "...", "datasetRef": "...", "expectedOutput": "...", "requirements": "..." }
     */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb", nullable = false)
    @Builder.Default
    private Map<String, Object> payload = new HashMap<>();

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
    public boolean isMcq() {
        return questionType == TestQuestionType.MCQ_SINGLE || questionType == TestQuestionType.MCQ_MULTI;
    }
}
