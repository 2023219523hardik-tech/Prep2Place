package com.placement.game.controller;

import com.placement.exception.ApiException;
import com.placement.game.dto.GameDtos.*;
import com.placement.game.entity.*;
import com.placement.game.engine.RoundGenerator;
import com.placement.game.repository.GameAttemptRepository;
import com.placement.game.repository.GameRepository;
import com.placement.game.service.GameEngineService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.security.SecureRandom;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Admin authoring, publish-lifecycle, attempts and analytics for Games (Section 10/17/18). Every
 * route here already sits under the app-wide {@code /api/admin/**} ADMIN/PLACEMENT_ADMIN
 * authorization rule in SecurityConfig - no additional security wiring needed.
 */
@RestController
@RequestMapping("/api/admin/games")
@RequiredArgsConstructor
public class GameAdminController {

    private final GameRepository gameRepository;
    private final GameAttemptRepository gameAttemptRepository;
    private final GameEngineService gameEngineService;
    private final List<RoundGenerator> roundGenerators;

    @GetMapping
    public List<GameAdminView> list(@RequestParam(required = false) GameStatus status,
                                     @RequestParam(required = false) GameType type) {
        List<Game> games;
        if (status != null && type != null) games = gameRepository.findByStatusAndGameType(status, type);
        else if (status != null) games = gameRepository.findByStatus(status);
        else if (type != null) games = gameRepository.findByGameType(type);
        else games = gameRepository.findAll();
        return games.stream().map(GameAdminView::from).toList();
    }

    @GetMapping("/{id}")
    public GameAdminView get(@PathVariable Long id) {
        return GameAdminView.from(gameEngineService.getGameOrThrow(id));
    }

    @PostMapping
    public GameAdminView create(@RequestBody GameUpsertRequest req) {
        if (req.name() == null || req.name().isBlank()) throw ApiException.badRequest("name is required");
        if (req.gameType() == null) throw ApiException.badRequest("gameType is required");
        Game game = Game.builder().status(GameStatus.DRAFT).build();
        apply(game, req);
        return GameAdminView.from(gameRepository.save(game));
    }

    @PutMapping("/{id}")
    public GameAdminView update(@PathVariable Long id, @RequestBody GameUpsertRequest req) {
        Game game = gameEngineService.getGameOrThrow(id);
        apply(game, req);
        return GameAdminView.from(gameRepository.save(game));
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable Long id) {
        Game game = gameEngineService.getGameOrThrow(id);
        if (!gameAttemptRepository.findByGame(game).isEmpty()) {
            // Preserve attempt history/analytics integrity - archive instead of hard-deleting.
            game.setStatus(GameStatus.ARCHIVED);
            gameRepository.save(game);
            return;
        }
        gameRepository.delete(game);
    }

    @PostMapping("/{id}/publish")
    public GameAdminView publish(@PathVariable Long id) {
        Game game = gameEngineService.getGameOrThrow(id);
        game.setStatus(GameStatus.PUBLISHED);
        return GameAdminView.from(gameRepository.save(game));
    }

    @PostMapping("/{id}/unpublish")
    public GameAdminView unpublish(@PathVariable Long id) {
        Game game = gameEngineService.getGameOrThrow(id);
        game.setStatus(GameStatus.DRAFT);
        return GameAdminView.from(gameRepository.save(game));
    }

    @PostMapping("/{id}/archive")
    public GameAdminView archive(@PathVariable Long id) {
        Game game = gameEngineService.getGameOrThrow(id);
        game.setStatus(GameStatus.ARCHIVED);
        return GameAdminView.from(gameRepository.save(game));
    }

    @PostMapping("/{id}/duplicate")
    public GameAdminView duplicate(@PathVariable Long id) {
        Game source = gameEngineService.getGameOrThrow(id);
        Game copy = Game.builder()
                .name(source.getName() + " (Copy)")
                .gameType(source.getGameType())
                .description(source.getDescription())
                .difficulty(source.getDifficulty())
                .status(GameStatus.DRAFT)
                .roundCount(source.getRoundCount())
                .roundDurationSeconds(source.getRoundDurationSeconds())
                .randomizeRounds(source.isRandomizeRounds())
                .negativeMarkingEnabled(source.isNegativeMarkingEnabled())
                .negativeMarkingPenalty(source.getNegativeMarkingPenalty())
                .scoringConfig(new HashMap<>(source.getScoringConfig()))
                .gameConfig(new HashMap<>(source.getGameConfig()))
                .targetUniversity(source.getTargetUniversity())
                .targetCompany(source.getTargetCompany())
                .targetJobRole(source.getTargetJobRole())
                .build();
        return GameAdminView.from(gameRepository.save(copy));
    }

    /** Renders a fresh, non-persisted round set (including correct answers) so an admin can sanity
     *  check a game before publishing it - Section 10/11 "Admin should be able to preview". Rounds
     *  are generated across a spread of adaptive levels (1 through 8, repeating if roundCount > 8)
     *  rather than at one fixed difficulty, so the admin can see for themselves that Level 8 is
     *  substantially harder than Level 1 before it ever reaches a student. */
    @PostMapping("/{id}/preview")
    public GamePreviewView preview(@PathVariable Long id) {
        Game game = gameEngineService.getGameOrThrow(id);
        RoundGenerator generator = roundGenerators.stream()
                .filter(g -> g.supports() == game.getGameType()).findFirst()
                .orElseThrow(() -> ApiException.badRequest("No round generator registered for " + game.getGameType()));
        Random random = new SecureRandom();
        List<Map<String, Object>> rounds = new ArrayList<>();
        int count = Math.max(1, game.getRoundCount());
        for (int i = 0; i < count; i++) {
            int level = 1 + (i * 7 / Math.max(1, count - 1 == 0 ? 1 : count - 1));
            level = Math.min(8, Math.max(1, level));
            rounds.add(generator.generateRound(i, level, game.getGameConfig(),
                    game.getRoundDurationSeconds(), random));
        }
        return new GamePreviewView(game.getGameType(), game.getDifficulty(), rounds);
    }

    @GetMapping("/{id}/attempts")
    public List<GameAttemptAdminView> attempts(@PathVariable Long id) {
        Game game = gameEngineService.getGameOrThrow(id);
        return gameAttemptRepository.findByGame(game).stream()
                .map(GameAttemptAdminView::from).toList();
    }

    @GetMapping("/{id}/analytics")
    public GameAnalyticsView analytics(@PathVariable Long id) {
        Game game = gameEngineService.getGameOrThrow(id);
        List<GameAttempt> attempts = gameAttemptRepository.findByGame(game);
        return aggregate(attempts);
    }

    /** Dashboard-wide analytics across every game, for the Admin Dashboard "Game Analytics"
     *  panel (Section 17). */
    @GetMapping("/analytics/overview")
    public GameAnalyticsView analyticsOverview() {
        List<GameAttempt> attempts = gameAttemptRepository.findAllWithGame();
        return aggregate(attempts);
    }

    /** Section 18: Admin -> Student -> Games detail panel. */
    @GetMapping("/students/{candidateId}/attempts")
    public List<GameAttemptAdminView> studentAttempts(@PathVariable Long candidateId) {
        return gameAttemptRepository.findAllWithGame().stream()
                .filter(a -> a.getCandidate().getId().equals(candidateId))
                .map(GameAttemptAdminView::from).toList();
    }

    @GetMapping("/students/{candidateId}/analytics")
    public StudentGameAnalyticsView studentAnalytics(@PathVariable Long candidateId) {
        List<GameAttempt> completed = gameAttemptRepository.findAllWithGame().stream()
                .filter(a -> a.getCandidate().getId().equals(candidateId))
                .filter(a -> a.getStatus() == GameAttemptStatus.COMPLETED)
                .sorted(Comparator.comparing(GameAttempt::getCompletedAt))
                .toList();
        Map<GameType, Double> byType = completed.stream()
                .collect(Collectors.groupingBy(GameAttempt::getGameType,
                        Collectors.averagingDouble(GameAttempt::getScore)));
        double overallScore = completed.stream().mapToDouble(GameAttempt::getScore).average().orElse(0);
        double overallAccuracy = completed.stream().mapToDouble(GameAttempt::getAccuracy).average().orElse(0);
        List<Map<String, Object>> trend = completed.stream().map(a -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("completedAt", a.getCompletedAt());
            m.put("averageResponseTimeMs", a.getAverageResponseTimeMs());
            m.put("gameType", a.getGameType());
            return m;
        }).toList();
        return new StudentGameAnalyticsView(byType, overallScore, overallAccuracy, trend);
    }

    private GameAnalyticsView aggregate(List<GameAttempt> attempts) {
        long attempted = attempts.size();
        List<GameAttempt> completed = attempts.stream()
                .filter(a -> a.getStatus() == GameAttemptStatus.COMPLETED).toList();
        double avgScore = completed.stream().mapToDouble(GameAttempt::getScore).average().orElse(0);
        double avgAccuracy = completed.stream().mapToDouble(GameAttempt::getAccuracy).average().orElse(0);
        double avgResponseTime = completed.stream().mapToDouble(GameAttempt::getAverageResponseTimeMs).average().orElse(0);

        Map<GameType, Double> byType = completed.stream()
                .collect(Collectors.groupingBy(GameAttempt::getGameType,
                        Collectors.averagingDouble(GameAttempt::getScore)));
        Map<GameDifficulty, Double> byDifficulty = completed.stream()
                .collect(Collectors.groupingBy(GameAttempt::getDifficulty,
                        Collectors.averagingDouble(GameAttempt::getScore)));

        Map<Long, List<GameAttempt>> byGame = attempts.stream()
                .collect(Collectors.groupingBy(a -> a.getGame().getId()));
        List<Map<String, Object>> mostAttempted = byGame.entrySet().stream()
                .sorted((a, b) -> b.getValue().size() - a.getValue().size())
                .limit(5)
                .map(e -> gameStat(e.getValue()))
                .toList();
        List<Map<String, Object>> mostDifficult = byGame.entrySet().stream()
                .map(e -> gameStat(e.getValue()))
                .sorted(Comparator.comparingDouble(m -> (double) m.get("averageAccuracy")))
                .limit(5)
                .toList();

        return new GameAnalyticsView(attempted, completed.size(), avgScore, avgAccuracy, avgResponseTime,
                byType, byDifficulty, mostAttempted, mostDifficult);
    }

    private Map<String, Object> gameStat(List<GameAttempt> attemptsForGame) {
        Game game = attemptsForGame.get(0).getGame();
        double avgAccuracy = attemptsForGame.stream()
                .filter(a -> a.getStatus() == GameAttemptStatus.COMPLETED)
                .mapToDouble(GameAttempt::getAccuracy).average().orElse(0);
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("gameId", game.getId());
        m.put("gameName", game.getName());
        m.put("attempts", attemptsForGame.size());
        m.put("averageAccuracy", avgAccuracy);
        return m;
    }

    private void apply(Game game, GameUpsertRequest req) {
        if (req.name() != null) game.setName(req.name());
        if (req.gameType() != null) game.setGameType(req.gameType());
        if (req.description() != null) game.setDescription(req.description());
        if (req.difficulty() != null) game.setDifficulty(req.difficulty());
        if (req.roundCount() != null) game.setRoundCount(req.roundCount());
        if (req.roundDurationSeconds() != null) game.setRoundDurationSeconds(req.roundDurationSeconds());
        if (req.randomizeRounds() != null) game.setRandomizeRounds(req.randomizeRounds());
        if (req.negativeMarkingEnabled() != null) game.setNegativeMarkingEnabled(req.negativeMarkingEnabled());
        if (req.negativeMarkingPenalty() != null) game.setNegativeMarkingPenalty(req.negativeMarkingPenalty());
        if (req.scoringConfig() != null) game.setScoringConfig(req.scoringConfig());
        if (req.gameConfig() != null) game.setGameConfig(req.gameConfig());
        game.setTargetUniversity(req.targetUniversity());
        game.setTargetCompany(req.targetCompany());
        game.setTargetJobRole(req.targetJobRole());
        game.setAvailableFrom(req.availableFrom());
        game.setAvailableTo(req.availableTo());
    }
}
