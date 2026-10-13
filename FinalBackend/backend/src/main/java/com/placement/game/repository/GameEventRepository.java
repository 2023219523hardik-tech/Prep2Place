package com.placement.game.repository;

import com.placement.game.entity.GameEvent;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface GameEventRepository extends JpaRepository<GameEvent, Long> {
    List<GameEvent> findByAttemptIdOrderByOccurredAtAsc(Long attemptId);
    List<GameEvent> findByGameIdOrderByOccurredAtDesc(Long gameId);
}
