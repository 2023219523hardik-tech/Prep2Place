package com.placement.game.dto;

import com.placement.game.entity.*;

import java.time.Instant;
import java.util.List;
import java.util.Map;

public class GameDtos {

    private GameDtos() {}

    // -------------------------------------------------------------------------------- student --

    public record GameSummaryView(Long id, String name, GameType gameType, String description,
                                   GameDifficulty difficulty, int roundCount, int roundDurationSeconds) {
        public static GameSummaryView from(Game g) {
            return new GameSummaryView(g.getId(), g.getName(), g.getGameType(), g.getDescription(),
                    g.getDifficulty(), g.getRoundCount(), g.getRoundDurationSeconds());
        }
    }

    public record RoundView(int roundIndex, String prompt, Map<String, Object> meta,
                             List<Map<String, Object>> options, String answerMode,
                             int requiredSelectionCount, int timeLimitSeconds, int level,
                             Boolean correct, String correctOptionId, List<String> correctOptionIds) {
    }

    public record AttemptView(Long id, Long gameId, String gameName, GameType gameType,
                               GameDifficulty difficulty, GameAttemptStatus status,
                               int currentRoundIndex, int totalRounds, double score,
                               double maxPossibleScore, double accuracy, int correctCount,
                               int incorrectCount, int currentStreak, int bestStreak,
                               double averageResponseTimeMs, int currentLevel, double difficultyScore,
                               int highestLevelReached, boolean paused, Instant startedAt,
                               Instant expiresAt, Instant completedAt, RoundView currentRound) {
    }

    public record AttemptSummaryView(Long id, Long gameId, String gameName, GameType gameType,
                                      GameAttemptStatus status, double score, double accuracy,
                                      Instant startedAt, Instant completedAt) {
        public static AttemptSummaryView from(GameAttempt a) {
            return new AttemptSummaryView(a.getId(), a.getGame().getId(), a.getGame().getName(),
                    a.getGameType(), a.getStatus(), a.getScore(), a.getAccuracy(),
                    a.getStartedAt(), a.getCompletedAt());
        }
    }

    /** {@code optionIds} holds one id for a SINGLE-answer round, exactly the required-count ids
     *  (order irrelevant) for MULTI_UNORDERED, or every option id in the student's chosen order
     *  for ORDERED_SEQUENCE. An empty list represents "no answer" (e.g. a client-side timeout). */
    public record AnswerSubmitRequest(int roundIndex, List<String> optionIds, long responseTimeMs) {}

    public record AnswerResultView(boolean correct, String correctOptionId, List<String> correctOptionIds,
                                    double roundScore, boolean levelUp, int previousLevel, int newLevel,
                                    AttemptView attempt) {}

    // ---------------------------------------------------------------------------------- admin --

    public record GameAdminView(Long id, String name, GameType gameType, String description,
                                 GameDifficulty difficulty, GameStatus status, int roundCount,
                                 int roundDurationSeconds, boolean randomizeRounds,
                                 boolean negativeMarkingEnabled, double negativeMarkingPenalty,
                                 Map<String, Double> scoringConfig, Map<String, Object> gameConfig,
                                 String targetUniversity, String targetCompany, String targetJobRole,
                                 Instant availableFrom, Instant availableTo, Instant createdAt,
                                 Instant updatedAt) {
        public static GameAdminView from(Game g) {
            return new GameAdminView(g.getId(), g.getName(), g.getGameType(), g.getDescription(),
                    g.getDifficulty(), g.getStatus(), g.getRoundCount(), g.getRoundDurationSeconds(),
                    g.isRandomizeRounds(), g.isNegativeMarkingEnabled(), g.getNegativeMarkingPenalty(),
                    g.getScoringConfig(), g.getGameConfig(), g.getTargetUniversity(), g.getTargetCompany(),
                    g.getTargetJobRole(), g.getAvailableFrom(), g.getAvailableTo(), g.getCreatedAt(),
                    g.getUpdatedAt());
        }
    }

    public record GameUpsertRequest(String name, GameType gameType, String description,
                                     GameDifficulty difficulty, Integer roundCount,
                                     Integer roundDurationSeconds, Boolean randomizeRounds,
                                     Boolean negativeMarkingEnabled, Double negativeMarkingPenalty,
                                     Map<String, Double> scoringConfig, Map<String, Object> gameConfig,
                                     String targetUniversity, String targetCompany, String targetJobRole,
                                     Instant availableFrom, Instant availableTo) {}

    public record GamePreviewView(GameType gameType, GameDifficulty difficulty,
                                   List<Map<String, Object>> rounds) {}

    public record GameAttemptAdminView(Long id, Long candidateId, String candidateName,
                                        GameAttemptStatus status, double score, double accuracy,
                                        int correctCount, int incorrectCount,
                                        double averageResponseTimeMs, Instant startedAt,
                                        Instant completedAt) {
        public static GameAttemptAdminView from(GameAttempt a) {
            String name = a.getCandidate() != null ? a.getCandidate().getFullName() : null;
            return new GameAttemptAdminView(a.getId(), a.getCandidate().getId(), name, a.getStatus(),
                    a.getScore(), a.getAccuracy(), a.getCorrectCount(), a.getIncorrectCount(),
                    a.getAverageResponseTimeMs(), a.getStartedAt(), a.getCompletedAt());
        }
    }

    public record GameAnalyticsView(long gamesAttempted, long gamesCompleted, double averageScore,
                                     double averageAccuracy, double averageResponseTimeMs,
                                     Map<GameType, Double> averageScoreByType,
                                     Map<GameDifficulty, Double> averageScoreByDifficulty,
                                     List<Map<String, Object>> mostAttemptedGames,
                                     List<Map<String, Object>> mostDifficultGames) {}

    public record StudentGameAnalyticsView(Map<GameType, Double> scoreByType, double overallScore,
                                            double overallAccuracy,
                                            List<Map<String, Object>> responseTimeTrend) {}
}
