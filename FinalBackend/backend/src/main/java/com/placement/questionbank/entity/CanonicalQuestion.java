package com.placement.questionbank.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.placement.entity.Difficulty;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "canonical_question")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CanonicalQuestion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 500)
    private String canonicalTitle;

    /**
     * Normalized title used for duplicate/deduplication matching.
     */
    @Column(length = 500)
    private String normalizedTitleKey;

    /**
     * PostgreSQL TEXT is preferable to @Lob for String fields.
     */
    @Column(columnDefinition = "TEXT")
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private QuestionDomain domain = QuestionDomain.CODING;

    @Enumerated(EnumType.STRING)
    private Difficulty difficulty;

    @ElementCollection
    @CollectionTable(
            name = "canonical_question_topic",
            joinColumns = @JoinColumn(name = "question_id")
    )
    @Column(name = "topic")
    @Builder.Default
    private List<String> topics = new ArrayList<>();

    @ElementCollection
    @CollectionTable(
            name = "canonical_question_subtopic",
            joinColumns = @JoinColumn(name = "question_id")
    )
    @Column(name = "subtopic")
    @Builder.Default
    private List<String> subtopics = new ArrayList<>();

    @ElementCollection
    @CollectionTable(
            name = "canonical_question_company",
            joinColumns = @JoinColumn(name = "question_id")
    )
    @Column(name = "company")
    @Builder.Default
    private List<String> companies = new ArrayList<>();

    @ElementCollection
    @CollectionTable(
            name = "canonical_question_tag",
            joinColumns = @JoinColumn(name = "question_id")
    )
    @Column(name = "tag")
    @Builder.Default
    private List<String> tags = new ArrayList<>();

    @ElementCollection
    @CollectionTable(
            name = "canonical_question_language",
            joinColumns = @JoinColumn(name = "question_id")
    )
    @Column(name = "language")
    @Builder.Default
    private List<String> supportedLanguages = new ArrayList<>();

    @Column(length = 2000)
    private String constraints;

    @Column(length = 1000)
    private String inputFormat;

    @Column(length = 1000)
    private String outputFormat;

    /**
     * Stored as PostgreSQL JSONB.
     */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    @Builder.Default
    private List<String> examples = new ArrayList<>();

    @Column(length = 2000)
    private String hints;

    @Column(length = 500)
    private String expectedComplexity;

    @Builder.Default
    @Column(nullable = false)
    private boolean active = true;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private QuestionAvailabilityState availabilityState =
            QuestionAvailabilityState.AVAILABLE;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    private Instant lastSyncedAt;

    private Instant updatedAt;

    /**
     * If this question was merged into another canonical question,
     * this points to the surviving canonical question.
     */
    @Column(name = "merged_into_id")
    private Long mergedIntoId;

    @OneToMany(
            mappedBy = "canonicalQuestion",
            cascade = CascadeType.ALL,
            orphanRemoval = true,
            fetch = FetchType.LAZY
    )
    @Builder.Default
    @JsonIgnore
    private List<QuestionSourceMapping> sourceMappings = new ArrayList<>();

    @PrePersist
    protected void onCreate() {
        Instant now = Instant.now();

        if (createdAt == null) {
            createdAt = now;
        }

        if (updatedAt == null) {
            updatedAt = now;
        }
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = Instant.now();
    }
}