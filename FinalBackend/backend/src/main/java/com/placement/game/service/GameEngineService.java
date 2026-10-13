package com.placement.game.service;

import com.placement.entity.StudentProfile;
import com.placement.entity.User;
import com.placement.exception.ApiException;
import com.placement.game.dto.GameDtos;
import com.placement.game.engine.AdaptiveDifficulty;
import com.placement.game.entity.*;
import com.placement.game.engine.RoundGenerator;
import com.placement.game.repository.GameAttemptRepository;
import com.placement.game.repository.GameEventRepository;
import com.placement.game.repository.GameRepository;
import com.placement.repository.StudentProfileRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Orchestrates the full game-attempt lifecycle: eligibility, start (first-round generation),
 * answer submission (grading + adaptive-difficulty update + next-round generation), pause/resume,
 * completion/expiry, and the student-safe view of an in-progress attempt. This is the single place
 * that is allowed to see a round's hidden correct answer while an attempt is still open -
 * controllers must always go through {@link #publicRound}.
 *
 * <p>Unlike the previous version, rounds are NOT all pre-generated at a fixed difficulty when the
 * attempt starts. Only round 0 is generated (always at Level 1). After every answer,
 * {@link AdaptiveDifficulty} recomputes the student's live difficulty score/level from the
 * outcome, and the NEXT round is generated at that new level and appended to
 * {@link GameAttempt#getRoundsSnapshot()}. This is what makes difficulty genuinely adaptive rather
 * than a fixed label chosen once at start time (spec Section 3: "THIS IS VERY IMPORTANT").
 */
@Service
@RequiredArgsConstructor
public class GameEngineService {

    private final GameRepository gameRepository;
    private final GameAttemptRepository gameAttemptRepository;
    private final GameEventRepository gameEventRepository;
    private final StudentProfileRepository studentProfileRepository;
    private final List<RoundGenerator> roundGenerators;
    private final GameScoringService scoringService;

    private Map<GameType, RoundGenerator> generatorsByType;

    private Map<GameType, RoundGenerator> generators() {
        if (generatorsByType == null) {
            generatorsByType = roundGenerators.stream()
                    .collect(Collectors.toMap(RoundGenerator::supports, g -> g));
        }
        return generatorsByType;
    }

    // ------------------------------------------------------------------ eligibility / listing --

    public List<Game> listAvailableForStudent(User candidate) {
        List<Game> published = gameRepository.findByStatus(GameStatus.PUBLISHED);
        StudentProfile profile = studentProfileRepository.findByUser(candidate).orElse(null);
        return published.stream()
                .filter(Game::isCurrentlyAvailable)
                .filter(g -> isEligible(g, profile))
                .toList();
    }

    private boolean isEligible(Game game, StudentProfile profile) {
        if (isBlank(game.getTargetUniversity()) && isBlank(game.getTargetCompany())
                && isBlank(game.getTargetJobRole())) {
            return true;
        }
        if (profile == null) return false;
        if (!isBlank(game.getTargetUniversity())) {
            String college = profile.getCollege();
            if (college == null || !college.toLowerCase().contains(game.getTargetUniversity().toLowerCase())) {
                return false;
            }
        }
        if (!isBlank(game.getTargetCompany())) {
            String preferred = profile.getPreferredCompanies();
            if (preferred == null || !preferred.toLowerCase().contains(game.getTargetCompany().toLowerCase())) {
                return false;
            }
        }
        if (!isBlank(game.getTargetJobRole())) {
            String roleTitle = profile.getTargetRole() != null ? profile.getTargetRole().getTitle() : null;
            if (roleTitle == null || !roleTitle.equalsIgnoreCase(game.getTargetJobRole())) {
                return false;
            }
        }
        return true;
    }

    private boolean isBlank(String s) {
        return s == null || s.isBlank();
    }

    public Game getGameOrThrow(Long id) {
        return gameRepository.findById(id).orElseThrow(() -> ApiException.notFound("Game not found"));
    }

    private boolean isPausable(Game game) {
        Map<String, Object> config = game.getGameConfig();
        if (config == null) return true;
        Object v = config.get("pausable");
        return !(v instanceof Boolean b) || b;
    }

    // -------------------------------------------------------------------------------- starting --

    @Transactional
    public GameAttempt start(User candidate, Long gameId) {
        Game game = getGameOrThrow(gameId);
        StudentProfile profile = studentProfileRepository.findByUser(candidate).orElse(null);
        if (!game.isCurrentlyAvailable() || !isEligible(game, profile)) {
            throw ApiException.forbidden("This game is not currently available to you");
        }

        Optional<GameAttempt> inProgress = gameAttemptRepository.findInProgress(candidate, game);
        if (inProgress.isPresent()) {
            GameAttempt existing = inProgress.get();
            expireIfNeeded(existing);
            if (existing.getStatus() == GameAttemptStatus.STARTED) {
                return existing; // resume rather than fork a second concurrent attempt
            }
        }

        RoundGenerator generator = generators().get(game.getGameType());
        if (generator == null) {
            throw ApiException.badRequest("No round generator registered for " + game.getGameType());
        }

        Random random = new SecureRandom();
        List<Map<String, Object>> rounds = new ArrayList<>();
        rounds.add(generator.generateRound(0, AdaptiveDifficulty.MIN_LEVEL, game.getGameConfig(),
                game.getRoundDurationSeconds(), random));

        // Best-case ceiling for "% of max score" displays: simulate an always-correct run so every
        // round's max score reflects the level a perfect player would actually reach by then,
        // without needing to know in advance how THIS student will perform.
        double maxScore = 0;
        double simScore = AdaptiveDifficulty.MIN_SCORE;
        for (int i = 0; i < game.getRoundCount(); i++) {
            maxScore += scoringService.maxPossibleScoreForRound(game, AdaptiveDifficulty.levelForScore(simScore));
            simScore = AdaptiveDifficulty.nextScore(simScore, true);
        }

        int totalDurationSeconds = game.getRoundCount() * game.getRoundDurationSeconds() + 30; // grace buffer
        Instant now = Instant.now();

        GameAttempt attempt = GameAttempt.builder()
                .candidate(candidate)
                .game(game)
                .gameType(game.getGameType())
                .difficulty(game.getDifficulty())
                .status(GameAttemptStatus.STARTED)
                .roundsSnapshot(rounds)
                .totalRounds(game.getRoundCount())
                .maxPossibleScore(maxScore)
                .startedAt(now)
                .lastActivityAt(now)
                .expiresAt(now.plusSeconds(totalDurationSeconds))
                .build();
        attempt = gameAttemptRepository.save(attempt);

        recordEvent(attempt, GameEventType.ROUND_STARTED, 0, Map.of("level", AdaptiveDifficulty.MIN_LEVEL));
        return attempt;
    }

    // -------------------------------------------------------------------------------- answering --

    public record AnswerOutcome(GameAttempt attempt, boolean correct, String correctOptionId,
                                 List<String> correctOptionIds, double roundScore, boolean levelUp,
                                 int previousLevel, int newLevel) {}

    @Transactional
    public AnswerOutcome submitAnswer(User candidate, Long attemptId, int roundIndex,
                                       List<String> submittedOptionIds, long responseTimeMs) {
        GameAttempt attempt = getOwnedAttemptOrThrow(attemptId, candidate);
        expireIfNeeded(attempt);
        if (attempt.getStatus() != GameAttemptStatus.STARTED) {
            throw ApiException.conflict("This attempt is no longer active (" + attempt.getStatus() + ")");
        }
        if (attempt.getPausedAt() != null) {
            throw ApiException.conflict("Resume the game before submitting an answer");
        }
        if (roundIndex != attempt.getCurrentRoundIndex()) {
            throw ApiException.conflict("Rounds must be answered in order; expected round "
                    + attempt.getCurrentRoundIndex());
        }
        if (roundIndex >= attempt.getRoundsSnapshot().size()) {
            throw ApiException.badRequest("Invalid round index");
        }

        Map<String, Object> round = attempt.getRoundsSnapshot().get(roundIndex);
        String answerMode = String.valueOf(round.getOrDefault("answerMode", "SINGLE"));
        String correctOptionId = round.get("correctOptionId") != null
                ? String.valueOf(round.get("correctOptionId")) : null;
        @SuppressWarnings("unchecked")
        List<String> correctOptionIds = round.get("correctOptionIds") != null
                ? (List<String>) round.get("correctOptionIds") : List.of();
        int timeLimitSeconds = ((Number) round.get("timeLimitSeconds")).intValue();
        int roundLevel = round.get("level") != null
                ? ((Number) round.get("level")).intValue() : attempt.getCurrentLevel();

        List<String> submitted = submittedOptionIds == null ? List.of() : submittedOptionIds;
        boolean correct = switch (answerMode) {
            case "MULTI_UNORDERED" -> !submitted.isEmpty()
                    && new HashSet<>(submitted).equals(new HashSet<>(correctOptionIds));
            case "ORDERED_SEQUENCE" -> !submitted.isEmpty() && submitted.equals(correctOptionIds);
            default -> submitted.size() == 1 && submitted.get(0).equals(correctOptionId);
        };

        attempt.setCurrentStreak(correct ? attempt.getCurrentStreak() + 1 : 0);
        attempt.setBestStreak(Math.max(attempt.getBestStreak(), attempt.getCurrentStreak()));
        GameScoringService.RoundScore roundScore = scoringService.scoreRound(attempt.getGame(),
                roundLevel, timeLimitSeconds, correct, responseTimeMs, attempt.getCurrentStreak());

        if (correct) attempt.setCorrectCount(attempt.getCorrectCount() + 1);
        else attempt.setIncorrectCount(attempt.getIncorrectCount() + 1);

        int answered = attempt.getAnswerLog().size() + 1;
        double totalResponseTime = attempt.getAverageResponseTimeMs() * (answered - 1) + responseTimeMs;
        attempt.setAverageResponseTimeMs(totalResponseTime / answered);
        attempt.setScore(attempt.getScore() + roundScore.total());

        // Adaptive difficulty update (Section 3/4): the very core of the adaptive engine.
        int previousLevel = attempt.getCurrentLevel();
        double newScore = AdaptiveDifficulty.nextScore(attempt.getDifficultyScore(), correct);
        int newLevel = AdaptiveDifficulty.levelForScore(newScore);
        attempt.setDifficultyScore(newScore);
        attempt.setCurrentLevel(newLevel);
        attempt.setHighestLevelReached(Math.max(attempt.getHighestLevelReached(), newLevel));
        boolean levelUp = newLevel > previousLevel;

        Map<String, Object> logEntry = new LinkedHashMap<>();
        logEntry.put("roundIndex", roundIndex);
        logEntry.put("level", roundLevel);
        logEntry.put("submittedOptionIds", submitted);
        logEntry.put("correct", correct);
        logEntry.put("responseTimeMs", responseTimeMs);
        logEntry.put("submittedAt", Instant.now().toString());
        logEntry.put("streakAfter", attempt.getCurrentStreak());
        logEntry.put("difficultyScoreAfter", newScore);
        logEntry.put("levelAfter", newLevel);
        logEntry.put("roundScore", scoringService.toMap(roundScore));
        attempt.getAnswerLog().add(logEntry);

        attempt.setCurrentRoundIndex(roundIndex + 1);
        attempt.setLastActivityAt(Instant.now());

        recordEvent(attempt, GameEventType.ANSWER_SUBMITTED, roundIndex,
                Map.of("correct", correct, "level", roundLevel));
        recordEvent(attempt, GameEventType.ROUND_COMPLETED, roundIndex, Map.of("score", roundScore.total()));

        if (attempt.getCurrentRoundIndex() >= attempt.getTotalRounds()) {
            finalizeAttempt(attempt, GameAttemptStatus.COMPLETED);
        } else {
            RoundGenerator generator = generators().get(attempt.getGameType());
            Map<String, Object> nextRound = generator.generateRound(attempt.getCurrentRoundIndex(), newLevel,
                    attempt.getGame().getGameConfig(), attempt.getGame().getRoundDurationSeconds(),
                    new SecureRandom());
            attempt.getRoundsSnapshot().add(nextRound);
            recordEvent(attempt, GameEventType.ROUND_STARTED, attempt.getCurrentRoundIndex(),
                    Map.of("level", newLevel));
        }

        gameAttemptRepository.save(attempt);
        return new AnswerOutcome(attempt, correct, correctOptionId, correctOptionIds, roundScore.total(),
                levelUp, previousLevel, newLevel);
    }

    // ---------------------------------------------------------------------------- pause / resume --

    @Transactional
    public GameAttempt pause(User candidate, Long attemptId) {
        GameAttempt attempt = getOwnedAttemptOrThrow(attemptId, candidate);
        if (attempt.getStatus() != GameAttemptStatus.STARTED) return attempt;
        if (!isPausable(attempt.getGame())) {
            throw ApiException.badRequest("This assessment cannot be paused");
        }
        if (attempt.getPausedAt() == null) {
            attempt.setPausedAt(Instant.now());
            recordEvent(attempt, GameEventType.GAME_PAUSED, attempt.getCurrentRoundIndex(), Map.of());
            gameAttemptRepository.save(attempt);
        }
        return attempt;
    }

    @Transactional
    public GameAttempt resume(User candidate, Long attemptId) {
        GameAttempt attempt = getOwnedAttemptOrThrow(attemptId, candidate);
        if (attempt.getPausedAt() != null) {
            long pausedMs = Duration.between(attempt.getPausedAt(), Instant.now()).toMillis();
            attempt.setTotalPausedMs(attempt.getTotalPausedMs() + pausedMs);
            if (attempt.getExpiresAt() != null) attempt.setExpiresAt(attempt.getExpiresAt().plusMillis(pausedMs));
            attempt.setPausedAt(null);
            attempt.setLastActivityAt(Instant.now());
            recordEvent(attempt, GameEventType.GAME_RESUMED, attempt.getCurrentRoundIndex(), Map.of());
            gameAttemptRepository.save(attempt);
        }
        return attempt;
    }

    // -------------------------------------------------------------------------------- finishing --

    @Transactional
    public GameAttempt complete(User candidate, Long attemptId) {
        GameAttempt attempt = getOwnedAttemptOrThrow(attemptId, candidate);
        expireIfNeeded(attempt);
        if (attempt.getStatus() == GameAttemptStatus.STARTED) {
            finalizeAttempt(attempt, GameAttemptStatus.COMPLETED);
            gameAttemptRepository.save(attempt);
        }
        return attempt;
    }

    @Transactional
    public GameAttempt abandon(User candidate, Long attemptId) {
        GameAttempt attempt = getOwnedAttemptOrThrow(attemptId, candidate);
        if (attempt.getStatus() == GameAttemptStatus.STARTED) {
            finalizeAttempt(attempt, GameAttemptStatus.ABANDONED);
            gameAttemptRepository.save(attempt);
        }
        return attempt;
    }

    private void expireIfNeeded(GameAttempt attempt) {
        if (attempt.getStatus() == GameAttemptStatus.STARTED && attempt.getPausedAt() == null
                && attempt.getExpiresAt() != null && Instant.now().isAfter(attempt.getExpiresAt())) {
            finalizeAttempt(attempt, GameAttemptStatus.EXPIRED);
            gameAttemptRepository.save(attempt);
        }
    }

    private void finalizeAttempt(GameAttempt attempt, GameAttemptStatus finalStatus) {
        attempt.setStatus(finalStatus);
        attempt.setCompletedAt(Instant.now());
        int answered = attempt.getAnswerLog().size();
        attempt.setAccuracy(answered == 0 ? 0.0 : (double) attempt.getCorrectCount() / answered);

        Map<String, Object> details = new LinkedHashMap<>();
        details.put("roundsAnswered", answered);
        details.put("totalRounds", attempt.getTotalRounds());
        details.put("correctCount", attempt.getCorrectCount());
        details.put("incorrectCount", attempt.getIncorrectCount());
        details.put("accuracy", attempt.getAccuracy());
        details.put("score", attempt.getScore());
        details.put("maxPossibleScore", attempt.getMaxPossibleScore());
        details.put("bestStreak", attempt.getBestStreak());
        details.put("averageResponseTimeMs", attempt.getAverageResponseTimeMs());
        details.put("highestLevelReached", attempt.getHighestLevelReached());
        details.put("finalLevel", attempt.getCurrentLevel());
        details.put("performanceByLevel", performanceByLevel(attempt));
        details.put("status", finalStatus.name());
        attempt.setResultDetails(details);

        recordEvent(attempt, GameEventType.GAME_COMPLETED, null, Map.of("status", finalStatus.name()));
    }

    /** Section 16 "Performance by Difficulty": accuracy grouped by the level each answered round
     *  was actually generated at, derived straight from the append-only answer log. */
    private List<Map<String, Object>> performanceByLevel(GameAttempt attempt) {
        Map<Integer, int[]> tally = new TreeMap<>(); // level -> [correct, total]
        for (Map<String, Object> entry : attempt.getAnswerLog()) {
            Object levelObj = entry.get("level");
            if (levelObj == null) continue;
            int level = ((Number) levelObj).intValue();
            boolean correct = Boolean.TRUE.equals(entry.get("correct"));
            int[] counts = tally.computeIfAbsent(level, k -> new int[2]);
            counts[1]++;
            if (correct) counts[0]++;
        }
        List<Map<String, Object>> result = new ArrayList<>();
        for (Map.Entry<Integer, int[]> e : tally.entrySet()) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("level", e.getKey());
            m.put("levelLabel", AdaptiveDifficulty.levelLabel(e.getKey()));
            m.put("total", e.getValue()[1]);
            m.put("correct", e.getValue()[0]);
            m.put("accuracy", e.getValue()[1] == 0 ? 0.0 : (double) e.getValue()[0] / e.getValue()[1]);
            result.add(m);
        }
        return result;
    }

    // ---------------------------------------------------------------------------------- reads --

    public GameAttempt getOwnedAttemptOrThrow(Long attemptId, User candidate) {
    return gameAttemptRepository
            .findByIdAndCandidateWithGame(attemptId, candidate)
            .orElseThrow(() ->
                    new IllegalArgumentException("Game attempt not found"));
    }

    public GameAttempt getInProgressOrThrow(User candidate, Long gameId) {
        Game game = getGameOrThrow(gameId);
        GameAttempt attempt = gameAttemptRepository.findInProgress(candidate, game)
                .orElseThrow(() -> ApiException.notFound("No in-progress attempt for this game. Start it first."));
        expireIfNeeded(attempt);
        if (attempt.getStatus() != GameAttemptStatus.STARTED) {
            throw ApiException.conflict("This attempt is no longer active (" + attempt.getStatus() + ")");
        }
        return attempt;
    }

    public List<GameAttempt> historyForStudent(User candidate) {
        return gameAttemptRepository.findByCandidateOrderByCreatedAtDesc(candidate);
    }

    /** Strips the hidden correct answer(s) from a round for any round the student has not yet
     *  reached, and reveals them for rounds already answered (immediate per-round feedback). Never
     *  used for future/unanswered rounds - that would violate "students cannot access answers". */
    public Map<String, Object> publicRound(GameAttempt attempt, int index) {
        Map<String, Object> round = attempt.getRoundsSnapshot().get(index);
        Map<String, Object> view = new LinkedHashMap<>(round);
        boolean answered = index < attempt.getCurrentRoundIndex();
        if (!answered) {
            view.remove("correctOptionId");
            view.remove("correctOptionIds");
        }
        return view;
    }

    private void recordEvent(GameAttempt attempt, GameEventType type, Integer roundIndex, Map<String, Object> payload) {
        gameEventRepository.save(GameEvent.builder()
                .attemptId(attempt.getId())
                .gameId(attempt.getGame().getId())
                .eventType(type)
                .occurredAt(Instant.now())
                .roundIndex(roundIndex)
                .payload(payload)
                .build());
    }

    @SuppressWarnings("unchecked")
    public GameDtos.AttemptView toAttemptView(GameAttempt attempt) {
        GameDtos.RoundView currentRound = null;
        if (attempt.getStatus() == GameAttemptStatus.STARTED
                && attempt.getCurrentRoundIndex() < attempt.getRoundsSnapshot().size()) {
            Map<String, Object> round = publicRound(attempt, attempt.getCurrentRoundIndex());
            currentRound = new GameDtos.RoundView(
                    (int) round.get("roundIndex"),
                    (String) round.get("prompt"),
                    (Map<String, Object>) round.get("meta"),
                    (List<Map<String, Object>>) round.get("options"),
                    String.valueOf(round.getOrDefault("answerMode", "SINGLE")),
                    round.get("requiredSelectionCount") != null
                            ? ((Number) round.get("requiredSelectionCount")).intValue() : 1,
                    (int) round.get("timeLimitSeconds"),
                    round.get("level") != null ? ((Number) round.get("level")).intValue() : attempt.getCurrentLevel(),
                    null, null, null);
        }
        return new GameDtos.AttemptView(attempt.getId(), attempt.getGame().getId(), attempt.getGame().getName(),
                attempt.getGameType(), attempt.getDifficulty(), attempt.getStatus(), attempt.getCurrentRoundIndex(),
                attempt.getTotalRounds(), attempt.getScore(), attempt.getMaxPossibleScore(), attempt.getAccuracy(),
                attempt.getCorrectCount(), attempt.getIncorrectCount(), attempt.getCurrentStreak(),
                attempt.getBestStreak(), attempt.getAverageResponseTimeMs(), attempt.getCurrentLevel(),
                attempt.getDifficultyScore(), attempt.getHighestLevelReached(), attempt.getPausedAt() != null,
                attempt.getStartedAt(), attempt.getExpiresAt(), attempt.getCompletedAt(), currentRound);
    }

    /** Scheduled sweep for attempts nobody ever came back to finish; see GameMaintenanceScheduler.
     *  The repository query already excludes paused attempts. */
    @Transactional
    public int expireStaleAttempts() {
        List<GameAttempt> stale = gameAttemptRepository.findExpiredButStillOpen();
        for (GameAttempt attempt : stale) {
            finalizeAttempt(attempt, GameAttemptStatus.EXPIRED);
        }
        gameAttemptRepository.saveAll(stale);
        return stale.size();
    }
}
