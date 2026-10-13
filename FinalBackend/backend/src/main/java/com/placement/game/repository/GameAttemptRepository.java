package com.placement.game.repository;

import com.placement.entity.User;
import com.placement.game.entity.Game;
import com.placement.game.entity.GameAttempt;
import com.placement.game.entity.GameAttemptStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface GameAttemptRepository extends JpaRepository<GameAttempt, Long> {

    /**
     * Student history.
     *
     * GameAttempt.game is intentionally LAZY, so fetch Game explicitly
     * because the history DTO accesses game.id and game.name.
     */
    @Query("""
        select a
        from GameAttempt a
        join fetch a.game
        where a.candidate = :candidate
        order by a.createdAt desc
        """)
    List<GameAttempt> findByCandidateOrderByCreatedAtDesc(
            @Param("candidate") User candidate
    );

    /**
     * Secure ownership lookup.
     *
     * Fetches the associated Game in the same persistence context.
     * This is required because AttemptView/ResultView accesses Game
     * information after the repository call.
     */
    @Query("""
        select a
        from GameAttempt a
        join fetch a.game
        where a.id = :id
          and a.candidate = :candidate
        """)
    Optional<GameAttempt> findByIdAndCandidateWithGame(
            @Param("id") Long id,
            @Param("candidate") User candidate
    );

    /**
     * Simple ownership lookup.
     *
     * Keep this available for use cases that do not need the Game
     * relationship initialized.
     */
    Optional<GameAttempt> findByIdAndCandidate(
            Long id,
            User candidate
    );

    List<GameAttempt> findByCandidateAndGame(
            User candidate,
            Game game
    );

    List<GameAttempt> findByGame(
            Game game
    );

    List<GameAttempt> findByGameAndStatus(
            Game game,
            GameAttemptStatus status
    );

    /**
     * Find an active attempt for a particular student/game.
     */
    @Query("""
        select a
        from GameAttempt a
        where a.candidate = :candidate
          and a.game = :game
          and a.status = com.placement.game.entity.GameAttemptStatus.STARTED
        """)
    Optional<GameAttempt> findInProgress(
            @Param("candidate") User candidate,
            @Param("game") Game game
    );

    /**
     * Finds active attempts that have expired while not paused.
     */
    @Query("""
        select a
        from GameAttempt a
        where a.status = com.placement.game.entity.GameAttemptStatus.STARTED
          and a.pausedAt is null
          and a.expiresAt < CURRENT_TIMESTAMP
        """)
    List<GameAttempt> findExpiredButStillOpen();


    @Query("""
    select a
    from GameAttempt a
    join fetch a.game
    """)
    List<GameAttempt> findAllWithGame();
}