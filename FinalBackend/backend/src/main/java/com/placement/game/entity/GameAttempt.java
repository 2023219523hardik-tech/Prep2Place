package com.placement.game.entity;

import com.placement.entity.User;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * The single source of truth for one student's attempt at a {@link Game}, mirroring
 * {@code AssessmentAttempt}'s "frozen at start, server is authoritative" design (Section 20
 * javadoc there applies here too). The full round set - including hidden correct answers - is
 * generated once at start time and frozen into {@link #roundsSnapshot}; the API layer is
 * responsible for never serializing the hidden fields back to the student (see
 * GameDtos.RoundView / GameEngineService#publicRound).
 */
@Entity
@Table(name = "game_attempt")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GameAttempt {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "candidate_id", nullable = false)
    private User candidate;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "game_id", nullable = false)
    private Game game;

    /** Snapshot of the game's type/difficulty at start time, so a later admin edit to the Game
     *  never silently changes the rules of an attempt already in progress. */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private GameType gameType;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private GameDifficulty difficulty;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private GameAttemptStatus status = GameAttemptStatus.STARTED;

    /** Live adaptive-difficulty state (spec Section 3/4): a continuous 1.0-8.0 score, +1.0 on a
     *  correct answer / -0.5 on an incorrect one, clamped. {@link #currentLevel} is always the
     *  rounded {@link #difficultyScore} and is what the next round is generated at - see
     *  {@code com.placement.game.engine.AdaptiveDifficulty}. Rounds are therefore generated one at
     *  a time, just before they're needed, rather than all up front at a fixed difficulty. */
    @Builder.Default
    private double difficultyScore = 1.0;

    @Builder.Default
    private int currentLevel = 1;

    @Builder.Default
    private int highestLevelReached = 1;

    /** Non-null while the attempt is paused; {@link #totalPausedMs} accumulates paused time so it
     *  can be added back onto {@link #expiresAt} on resume (Section 14: pausing must not cost the
     *  student their timer). */
    private Instant pausedAt;

    @Builder.Default
    private long totalPausedMs = 0;

    /** Every round generated server-side so far, in presentation order - initially just round 0;
     *  {@code GameEngineService#submitAnswer} appends the next round (generated at the
     *  just-updated level) after each answer. Each entry includes the hidden correct answer -
     *  NEVER return this field verbatim from a controller; always go through
     *  GameEngineService#publicRound. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb", nullable = false)
    @Builder.Default
    private List<Map<String, Object>> roundsSnapshot = new ArrayList<>();

    /** One entry per answered round: roundIndex, submittedOptionId, correct, responseTimeMs,
     *  submittedAt, streakAtSubmit, roundScore. Append-only. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    @Builder.Default
    private List<Map<String, Object>> answerLog = new ArrayList<>();

    /** Score/accuracy breakdown written at completion time (Section 14/17 analytics). */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    @Builder.Default
    private Map<String, Object> resultDetails = new HashMap<>();

    @Builder.Default
    private int currentRoundIndex = 0;

    @Builder.Default
    private int totalRounds = 0;

    @Builder.Default
    private int correctCount = 0;

    @Builder.Default
    private int incorrectCount = 0;

    @Builder.Default
    private int currentStreak = 0;

    @Builder.Default
    private int bestStreak = 0;

    @Builder.Default
    private double averageResponseTimeMs = 0.0;

    @Builder.Default
    private double accuracy = 0.0;

    @Builder.Default
    private double score = 0.0;

    @Builder.Default
    private double maxPossibleScore = 0.0;

    private Instant startedAt;
    private Instant expiresAt;
    private Instant completedAt;
    private Instant lastActivityAt;

    private Instant createdAt;
    private Instant updatedAt;

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }

    @Transient
    public boolean isTerminalState() {
        return status == GameAttemptStatus.COMPLETED || status == GameAttemptStatus.ABANDONED
                || status == GameAttemptStatus.EXPIRED;
    }
}
