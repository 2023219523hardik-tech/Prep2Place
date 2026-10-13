package com.placement.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "interview_session")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class InterviewSession {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "student_id", nullable = false)
    private User student;

    @ManyToOne
    @JoinColumn(name = "role_id")
    private JobRole role;

    private String level; // Beginner / Intermediate / Advanced

    @Column(columnDefinition = "TEXT")
    private String resumeText;

    @Column(columnDefinition = "TEXT")
    private String jobDescription;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private InterviewStatus status = InterviewStatus.CREATED;

    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();

    private LocalDateTime completedAt;

    /** Last time the candidate interacted with the session (heartbeat). Used by the abandonment
     *  sweeper to detect sessions left IN_PROGRESS after a browser close or network drop. */
    private LocalDateTime lastSeenAt;

    // Aggregate scores, filled in on completion
    private Double technicalScore;
    private Double behavioralScore;
    private Double confidenceScore;
    private Double overallScore;

    // Proctoring / integrity signals, filled in on completion (see ProctoringService)
    @Builder.Default
    private Double integrityScore = 100.0;

    @Builder.Default
    private boolean flaggedForReview = false;

    @Builder.Default
    private Integer fillerWordCount = 0;

    @Builder.Default
    private Integer movementEventCount = 0;

    @Builder.Default
    private Integer postureFlagCount = 0;

    @Builder.Default
    private Integer tabSwitchCount = 0;

    // Strict Pre-Interview Protocol & Proctoring Verification
    @Enumerated(EnumType.STRING)
    @Builder.Default
    private ProctoringState proctoringStatus = ProctoringState.NOT_STARTED;

    @Builder.Default
    private boolean cameraChecked = false;

    @Builder.Default
    private boolean micChecked = false;

    @Builder.Default
    private boolean screenShareChecked = false;

    @Builder.Default
    private boolean tabMonitoringChecked = false;

    @Builder.Default
    private boolean backgroundChecked = false;

    @Builder.Default
    private boolean formalDressChecked = false;

    @Builder.Default
    private boolean faceDetectionChecked = false;

    @Builder.Default
    private boolean identityChecked = false;

    @Builder.Default
    private boolean proctoringCompleted = false;

    private Double formalDressConfidence;
    private String formalDressClassification; // FORMAL, CASUAL, UNCERTAIN, NO_PERSON

    public boolean isProctoringCompleted() {
        return proctoringCompleted;
    }

    /** Set only when status becomes TERMINATED_VIOLATION (Section 6). Deliberately generic
     *  ("Session ended due to a policy violation...") rather than naming the exact detection
     *  rule/threshold, so a terminated candidate isn't handed a roadmap for evading it next time. */
    private String terminationReason;
    private LocalDateTime terminatedAt;

    // Section 9: domain-specific mid-interview timed coding challenge tracking.
    private Long codingChallengeProblemId;
    @Enumerated(EnumType.STRING)
    private CodingChallengeStatus codingChallengeStatus;
    private LocalDateTime codingChallengeDeadline;
    @Column(columnDefinition = "TEXT")
    private String codingChallengeCode;
    private String codingChallengeLanguage;
    private Double codingChallengeScorePercent;
    private String codingChallengeVerdict;

    public enum CodingChallengeStatus { NOT_ASSIGNED, ASSIGNED, SUBMITTED, EXPIRED }

    // Section 12: running sums for the report's behavioral/posture analysis - updated on every
    // sampled webcam frame (see ProctoringService#analyzeFrame) so the report can show genuine
    // session-wide averages ("74% eye contact") instead of a single-frame snapshot or, worse, a
    // fabricated number with nothing behind it.
    @Builder.Default
    private Integer framesAnalyzedCount = 0;
    @Builder.Default
    private Double eyeContactScoreSum = 0.0;
    @Builder.Default
    private Double postureScoreSum = 0.0;

    @Builder.Default
    private String currentDifficulty = "EASY";

    @Builder.Default
    @OneToMany(mappedBy = "session", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<InterviewAnswer> answers = new ArrayList<>();
}
