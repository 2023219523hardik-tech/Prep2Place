package com.placement.game.service;

import com.placement.game.engine.AdaptiveDifficulty;
import com.placement.game.entity.Game;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Section 12/14: "Correct: +1 base score, Incorrect: -1 base score", scaled by how hard the round
 * actually was (its adaptive level, 1-8) plus configurable speed/streak bonuses, with the exact
 * weights configurable per game via {@link Game#getScoringConfig()}. Kept as its own bean (rather
 * than inlined in the engine) so an admin-facing "score preview" feature could call it directly
 * without touching attempt state.
 *
 * <p>Base points now scale with the student's live 1-8 adaptive level rather than a fixed
 * EASY/MEDIUM/HARD tier, so answering correctly at Level 8 is worth meaningfully more than
 * answering correctly at Level 1 - exactly like a real cognitive assessment should reward reaching
 * (and holding) a harder difficulty.
 */
@Service
public class GameScoringService {

    public record RoundScore(double correctnessScore, double speedBonus, double streakBonus,
                              double penalty, double total) {}

    /** Level 1 (Easy) is worth 5 base points, Level 8 (Expert+) is worth 40 - a straight line
     *  through the old EASY=5/MEDIUM=10/HARD=15 anchors, extended out to 8 levels. */
    public double basePointsForLevel(int level) {
        return 5.0 * AdaptiveDifficulty.clampLevel(level);
    }

    public double weight(Game game, String key, double fallback) {
        Map<String, Double> config = game.getScoringConfig();
        if (config == null) return fallback;
        Double v = config.get(key);
        return v != null ? v : fallback;
    }

    public RoundScore scoreRound(Game game, int level, int timeLimitSeconds, boolean correct,
                                  long responseTimeMs, int streakAfterAnswer) {
        double basePoints = basePointsForLevel(level);
        double correctnessWeight = weight(game, "correctnessWeight", 1.0);
        double speedBonusWeight = weight(game, "speedBonusWeight", 0.5);
        double streakBonusWeight = weight(game, "streakBonusWeight", 0.2);
        double penaltyWeight = weight(game, "penaltyWeight", 1.0);

        if (!correct) {
            double penalty = game.isNegativeMarkingEnabled()
                    ? basePoints * game.getNegativeMarkingPenalty() * penaltyWeight : 0.0;
            return new RoundScore(0, 0, 0, penalty, -penalty);
        }

        double correctnessScore = basePoints * correctnessWeight;
        long timeLimitMs = Math.max(1, (long) timeLimitSeconds * 1000L);
        double speedFraction = Math.max(0.0, Math.min(1.0, (timeLimitMs - responseTimeMs) / (double) timeLimitMs));
        double speedBonus = speedFraction * basePoints * speedBonusWeight;
        double streakBonus = Math.min(streakAfterAnswer, 5) * streakBonusWeight;
        double total = correctnessScore + speedBonus + streakBonus;
        return new RoundScore(correctnessScore, speedBonus, streakBonus, 0, total);
    }

    public double maxPossibleScoreForRound(Game game, int level) {
        // Best case: correct, instant response (full speed bonus), streak already at cap.
        double basePoints = basePointsForLevel(level);
        double correctnessWeight = weight(game, "correctnessWeight", 1.0);
        double speedBonusWeight = weight(game, "speedBonusWeight", 0.5);
        double streakBonusWeight = weight(game, "streakBonusWeight", 0.2);
        return basePoints * correctnessWeight + basePoints * speedBonusWeight + 5 * streakBonusWeight;
    }

    public Map<String, Object> toMap(RoundScore s) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("correctnessScore", s.correctnessScore());
        m.put("speedBonus", s.speedBonus());
        m.put("streakBonus", s.streakBonus());
        m.put("penalty", s.penalty());
        m.put("total", s.total());
        return m;
    }
}
