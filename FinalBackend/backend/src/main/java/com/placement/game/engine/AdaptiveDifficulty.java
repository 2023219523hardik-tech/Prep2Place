package com.placement.game.engine;

/**
 * Pure, stateless adaptive-difficulty calculator (spec Section 3/4: "Implement real adaptive
 * difficulty... do NOT simply change the displayed Level number"). A continuous 1.0-8.0
 * {@code difficultyScore} increases by 1.0 on a correct answer and decreases by 0.5 on an
 * incorrect one, clamped to [1.0, 8.0]; the displayed 1-8 {@code level} is the rounded score.
 *
 * <p>Kept as a standalone, dependency-free class (no Spring, no JPA entities) so the core
 * adaptive-difficulty rule can be unit tested in complete isolation and reused anywhere a level
 * needs to be derived from a running score: live round generation, scoring, and admin preview.
 */
public final class AdaptiveDifficulty {

    public static final double MIN_SCORE = 1.0;
    public static final double MAX_SCORE = 8.0;
    public static final double CORRECT_DELTA = 1.0;
    public static final double INCORRECT_DELTA = -0.5;
    public static final int MIN_LEVEL = 1;
    public static final int MAX_LEVEL = 8;

    private AdaptiveDifficulty() {}

    /** Applies one answer outcome to a running score, clamped to [MIN_SCORE, MAX_SCORE]. */
    public static double nextScore(double currentScore, boolean correct) {
        double delta = correct ? CORRECT_DELTA : INCORRECT_DELTA;
        return clampScore(currentScore + delta);
    }

    public static double clampScore(double score) {
        return Math.max(MIN_SCORE, Math.min(MAX_SCORE, score));
    }

    /** The displayed 1-8 level for a given continuous score (nearest integer, clamped). */
    public static int levelForScore(double score) {
        long rounded = Math.round(clampScore(score));
        return (int) Math.max(MIN_LEVEL, Math.min(MAX_LEVEL, rounded));
    }

    public static int clampLevel(int level) {
        return Math.max(MIN_LEVEL, Math.min(MAX_LEVEL, level));
    }

    /** Section 3 level labels: 1=Easy .. 8=Expert+. */
    public static String levelLabel(int level) {
        return switch (clampLevel(level)) {
            case 1 -> "Easy";
            case 2 -> "Easy+";
            case 3 -> "Medium";
            case 4 -> "Medium+";
            case 5 -> "Hard";
            case 6 -> "Hard+";
            case 7 -> "Expert";
            default -> "Expert+";
        };
    }
}
