package com.placement.assessment.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/**
 * One structured server-side record per assessment-integrity signal, for any assessment type.
 * Distinct from the legacy interview-only {@code com.placement.entity.ProctoringEvent} - this is
 * the shared engine's version, generalized to any AssessmentAttempt (coding mock test, aptitude
 * mock test, or AI interview) rather than only InterviewSession.
 *
 * Evidence handling: `evidenceAvailable` is only ever true when a frame/clip was actually captured
 * and stored (see {@link #evidenceRef}). If a client reports an event without evidence (e.g. no
 * camera permission, or the capture failed), evidenceAvailable stays false and the reporting layer
 * must say evidence was unavailable rather than fabricating anything - never flip this flag without
 * real stored bytes/reference behind it.
 */
@Entity
@Table(name = "integrity_event")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class IntegrityEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "attempt_id", nullable = false)
    private Long attemptId;

    /**
     * Which attempt table {@link #attemptId} points at. The column has no FK precisely because it
     * now spans two attempt tables, so this discriminator is what keeps the two streams separable.
     * Existing rows are backfilled to ASSESSMENT by V5, so nothing that reads integrity_event today
     * changes behaviour - but every reader that cares about only one kind must filter on it.
     */
    @Enumerated(EnumType.STRING)
    @Column(name = "attempt_kind", nullable = false, length = 20)
    @Builder.Default
    private AttemptKind attemptKind = AttemptKind.ASSESSMENT;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private IntegrityEventType eventType;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private IntegrityEventClassification classification = IntegrityEventClassification.DETECTED_SIGNAL;

    @Column(nullable = false)
    private Instant occurredAt;

    /** Null when the event is instantaneous (e.g. a single copy attempt) rather than duration-based
     *  (e.g. looking away for 8.4s, focus lost for 3.2s). */
    private Double durationSeconds;

    @Builder.Default
    private int severity = 1; // 1 (low) - 5 (high), configurable per event type by the violation policy

    /** 0.0-1.0, only populated for AI/heuristic-derived events. Null for objectively-measured browser events. */
    private Double confidenceScore;

    @Column(length = 2000)
    private String details; // human-readable description of exactly what was detected

    // ---- evidence ----
    @Builder.Default
    private boolean evidenceAvailable = false;

    /** Opaque reference to stored evidence (file path / object storage key) - a frame image or a
     *  short event-centered clip. Null when evidenceAvailable is false. Actual capture (getUserMedia
     *  frame grab, clip encoding, and durable storage) is a frontend + storage-infra concern layered
     *  on top of this field, not implemented by this backend service on its own. */
    private String evidenceRef;

    private String evidenceUnavailableReason; // e.g. "camera permission not granted", "capture failed"

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private ProcessingStatus processingStatus = ProcessingStatus.RECORDED;

    @Builder.Default
    private boolean contributedToTermination = false;

    @PrePersist
    void onCreate() {
        if (occurredAt == null) occurredAt = Instant.now();
    }

    /** ASSESSMENT -> assessment_attempt (legacy engine); MANAGED_TEST -> managed_test_attempt. */
    public enum AttemptKind { ASSESSMENT, MANAGED_TEST }

    public enum ProcessingStatus {
        RECORDED,       // stored as-reported, no further processing needed
        PENDING_REVIEW,  // queued for admin/recruiter review
        REVIEWED           // an admin has looked at this event
    }
}
