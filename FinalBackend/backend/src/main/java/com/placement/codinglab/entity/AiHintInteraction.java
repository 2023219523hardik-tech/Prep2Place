package com.placement.codinglab.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/**
 * One row per AI Hint Assistant interaction. Consolidates the spec's AIHintSession / AIHintRequest
 * / AIHintResponse / AIAssistanceAudit entities (Section 24) into a single append-only log table -
 * every field those four would hold (studentId/assessmentId/attemptId/timestamp/request/
 * classification/responseType/hintCount/blocked) is present here, and a session is just "the
 * attempt's interactions ordered by requestedAt", so a separate session row would carry no
 * information a query over this table doesn't already give you.
 */
@Entity
@Table(name = "ai_hint_interaction")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AiHintInteraction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "attempt_id", nullable = false)
    private Long attemptId;

    @Column(name = "candidate_id", nullable = false)
    private Long candidateId;

    @Column(name = "assessment_id", nullable = false)
    private Long assessmentId;

    @Column(nullable = false)
    private Instant requestedAt;

    @Column(length = 2000, nullable = false)
    private String studentMessage;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private AiHintClassification classification;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private AiHintResponseType responseType;

    @Column(length = 3000, nullable = false)
    private String responseText;

    @Column(nullable = false)
    private boolean blocked;

    /** Cumulative allowed-hint count for the attempt AFTER this interaction. */
    private int hintCountAfter;

    @PrePersist
    void onCreate() {
        if (requestedAt == null) requestedAt = Instant.now();
    }
}
