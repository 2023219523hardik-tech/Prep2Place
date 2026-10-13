package com.placement.game.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

/**
 * One structured record per meaningful gameplay event (Section 16), for any GameAttempt. Mirrors
 * {@code com.placement.assessment.entity.IntegrityEvent}'s pattern: a dedicated table (rather
 * than folding events into the attempt's JSON) so admin analytics can query/aggregate across
 * attempts cheaply.
 */
@Entity
@Table(name = "game_event")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GameEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "attempt_id", nullable = false)
    private Long attemptId;

    @Column(name = "game_id", nullable = false)
    private Long gameId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private GameEventType eventType;

    @Column(nullable = false)
    private Instant occurredAt;

    /** Null for events not tied to a specific round (e.g. GAME_PAUSED). */
    private Integer roundIndex;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    @Builder.Default
    private Map<String, Object> payload = new HashMap<>();

    @PrePersist
    void onCreate() {
        if (occurredAt == null) occurredAt = Instant.now();
    }
}
