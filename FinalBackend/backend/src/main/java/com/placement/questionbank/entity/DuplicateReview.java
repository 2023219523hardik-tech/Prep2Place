package com.placement.questionbank.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/**
 * A candidate duplicate match the deduplication engine wasn't confident enough to auto-merge.
 * Sits in a queue for an admin to approve (merge) or reject (keep as two separate canonical questions).
 */
@Entity
@Table(name = "duplicate_review")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DuplicateReview {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "question_a_id", nullable = false)
    private Long questionAId;

    @Column(name = "question_b_id", nullable = false)
    private Long questionBId;

    /** 0.0 - 1.0 combined similarity score (title + tags + constraints structure). */
    @Column(nullable = false)
    private double confidenceScore;

    @Column(length = 1000)
    private String matchReason; // e.g. "title similarity 0.91, shared topics [Arrays, Two Pointers]"

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private DuplicateReviewStatus status = DuplicateReviewStatus.PENDING;

    private String resolvedByAdminEmail;
    private Instant resolvedAt;
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        createdAt = Instant.now();
    }
}
