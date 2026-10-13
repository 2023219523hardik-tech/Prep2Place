package com.placement.game.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

/**
 * A reusable, admin-configurable Game-Based (cognitive) Assessment definition - the
 * game-module equivalent of {@code com.placement.assessment.entity.AssessmentProfile}. One row
 * covers every game of a given type (e.g. "Deductive Challenge - Standard"); students who start
 * it each get a freshly randomized {@link GameAttempt}, so no code changes are needed to add a
 * new game, only a new row (Section 8/9: "reusable architecture", "do not hardcode every game as
 * a separate unrelated system").
 */
@Entity
@Table(name = "game")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Game {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 200)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private GameType gameType;

    @Column(length = 2000)
    private String description;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private GameDifficulty difficulty = GameDifficulty.MEDIUM;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private GameStatus status = GameStatus.DRAFT;

    @Builder.Default
    private int roundCount = 5;

    /** Per-round time limit. Total attempt duration is roundCount * roundDurationSeconds unless
     *  the round generator declares a different limit for a specific round. */
    @Builder.Default
    private int roundDurationSeconds = 60;

    @Builder.Default
    private boolean randomizeRounds = true;

    @Builder.Default
    private boolean negativeMarkingEnabled = false;

    @Builder.Default
    private double negativeMarkingPenalty = 0.25;

    /** Weights consumed by GameScoringService: correctnessWeight, speedBonusWeight,
     *  streakBonusWeight, penaltyWeight. Missing keys fall back to sane defaults so admins only
     *  need to override what they care about. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    @Builder.Default
    private Map<String, Double> scoringConfig = new HashMap<>();

    /** Game-type-specific generation parameters (e.g. gridSize/symbolSetSize/sequenceLength).
     *  Interpreted by the matching {@code RoundGenerator}; unknown/absent keys fall back to
     *  generator-internal defaults. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    @Builder.Default
    private Map<String, Object> gameConfig = new HashMap<>();

    // ---- targeting/availability (Section 10) - null/blank means "available to everyone" ----
    private String targetUniversity;
    private String targetCompany;
    private String targetJobRole;

    private Instant availableFrom;
    private Instant availableTo;

    private String createdBy;

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
    public boolean isCurrentlyAvailable() {
        Instant now = Instant.now();
        if (status != GameStatus.PUBLISHED) return false;
        if (availableFrom != null && now.isBefore(availableFrom)) return false;
        if (availableTo != null && now.isAfter(availableTo)) return false;
        return true;
    }
}
