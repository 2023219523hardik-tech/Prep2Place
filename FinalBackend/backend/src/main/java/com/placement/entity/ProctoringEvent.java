package com.placement.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "proctoring_event")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ProctoringEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "session_id", nullable = false)
    private InterviewSession session;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ProctoringEventType eventType;

    @Column(length = 1000)
    private String details;

    /** Still-frame (webcam or screen) captured at detection time, or the first frame of a clip.
     *  Never exposed directly over the API - see ProctoringController's dedicated evidence
     *  endpoint, which is access-controlled per session ownership rather than a public URL. */
    @Lob
    @Basic(fetch = jakarta.persistence.FetchType.LAZY)
    private byte[] frameCapture;

    /** MIME type of frameCapture, e.g. "image/jpeg". Null when no evidence was captured. */
    private String evidenceContentType;

    /** Set only when evidence capture was attempted but unavailable (no camera permission,
     *  capture failed, etc.) so the report can say "evidence unavailable" honestly instead of
     *  silently omitting the field. Null when evidence is present, or when capture wasn't
     *  applicable to this event type. */
    @Column(length = 255)
    private String evidenceUnavailableReason;

    /** Which feed the evidence (if any) was captured from - webcam for posture/eye/reading/face
     *  violations, screen for tab-switch/focus-lost/prohibited-app violations (Section 1.1). */
    @Enumerated(EnumType.STRING)
    private EvidenceSource evidenceSource;

    /** How long the underlying condition lasted, in seconds - e.g. gaze off-screen for 8.4s,
     *  window unfocused for 3.2s. Null for instantaneous events (a single copy attempt, a
     *  single right-click). Used to compute the aggregate "time spent attempting to cheat"
     *  metric on the report; never fabricated when unknown. */
    private Double durationSeconds;

    /** 0.0-1.0, populated only for AI/heuristic-derived signals (eye roaming, reading detection,
     *  posture drift). Null for objectively-measured browser events (tab switch, copy attempt),
     *  since those have no meaningful "confidence" - they either fired or they didn't. */
    private Double confidenceScore;

    @Builder.Default
    @Column(nullable = false)
    private Integer severity = 1;

    @Builder.Default
    private LocalDateTime occurredAt = LocalDateTime.now();

    public enum EvidenceSource { WEBCAM, SCREEN }

    @Transient
    public boolean isEvidenceAvailable() {
        return frameCapture != null && frameCapture.length > 0;
    }
}
