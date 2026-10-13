package com.placement.game.repository;

import com.placement.game.entity.Game;
import com.placement.game.entity.GameStatus;
import com.placement.game.entity.GameType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface GameRepository extends JpaRepository<Game, Long> {
    List<Game> findByStatus(GameStatus status);
    List<Game> findByGameType(GameType gameType);
    List<Game> findByStatusAndGameType(GameStatus status, GameType gameType);
}
