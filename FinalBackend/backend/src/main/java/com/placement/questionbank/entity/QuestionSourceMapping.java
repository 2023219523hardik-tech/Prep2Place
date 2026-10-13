package com.placement.questionbank.entity;

import com.fasterxml.jackson.annotation.JsonBackReference;
import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/**
 * One row per (canonical question, source) pair. A single canonical question can have up to one
 * mapping per source (TUF/LeetCode/HackerRank/GFG/internal); that's what lets the platform say
 * "this is the same problem on 3 platforms" instead of storing three separate questions.
 */
@Entity
@Table(name = "question_source_mapping", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"source", "source_question_id"})
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class QuestionSourceMapping {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "canonical_question_id", nullable = false)
    @JsonBackReference
    private CanonicalQuestion canonicalQuestion;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private QuestionSource source;

    /** The source platform's own identifier for this question (slug, numeric id, etc.) */
    @Column(name = "source_question_id", nullable = false, length = 300)
    private String sourceQuestionId;

    @Column(length = 500)
    private String sourceTitle;

    @Column(length = 1000, nullable = false)
    private String sourceUrl;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private SourceIntegrationMode integrationMode = SourceIntegrationMode.METADATA_REFERENCE_ONLY;

    @Column(length = 500)
    private String attribution; // e.g. "Problem statement (c) GeeksforGeeks - view on source site"

    private Instant lastSyncedAt;
    private Instant lastSeenAvailableAt;

    @Builder.Default
    private boolean sourceAvailable = true;
}
