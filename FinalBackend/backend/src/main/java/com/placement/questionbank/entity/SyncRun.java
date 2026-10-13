package com.placement.questionbank.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/**
 * Structured, queryable record of every sync attempt against a source. This is what powers the
 * "synchronization status" admin view and lets one failing source be diagnosed without touching
 * the others - each source gets its own SyncRun row per sync cycle.
 */
@Entity
@Table(name = "sync_run")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SyncRun {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private QuestionSource source;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private SyncRunStatus status = SyncRunStatus.RUNNING;

    private Instant startedAt;
    private Instant finishedAt;

    @Builder.Default
    private int questionsFetched = 0;
    @Builder.Default
    private int questionsCreated = 0;
    @Builder.Default
    private int questionsUpdated = 0;
    @Builder.Default
    private int questionsUnchanged = 0;
    @Builder.Default
    private int duplicatesAutoMerged = 0;
    @Builder.Default
    private int duplicatesFlaggedForReview = 0;
    @Builder.Default
    private int retryCount = 0;

    @Column(length = 2000)
    private String errorMessage;

    @PrePersist
    void onCreate() {
        startedAt = Instant.now();
    }
}
