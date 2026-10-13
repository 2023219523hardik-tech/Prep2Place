package com.placement.game.config;

import com.placement.entity.User;
import com.placement.game.entity.*;
import com.placement.game.repository.GameAttemptRepository;
import com.placement.game.repository.GameRepository;
import com.placement.game.service.GameEngineService;
import com.placement.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Seeds the Game-Based Assessment catalog: one published game per cognitive-game type (plus a
 * second Deductive variant at a different difficulty), and a couple of sample attempts for the
 * demo student account so the "completed" and "abandoned" states in the UI/analytics aren't
 * empty. Attempts are produced by actually driving {@link GameEngineService} (start -> answer ->
 * complete/abandon) rather than hand-crafted JSON, so the seed data is guaranteed internally
 * consistent with the real scoring engine (Section 21).
 */
@Component
@Order(21) // right after AssessmentProfileSeedLoader
@RequiredArgsConstructor
@Slf4j
public class GameSeedLoader implements CommandLineRunner {

    private final GameRepository gameRepository;
    private final GameAttemptRepository gameAttemptRepository;
    private final GameEngineService gameEngineService;
    private final UserRepository userRepository;

    /** Was previously "if (gameRepository.count() > 0) return;" - an all-or-nothing guard that
     *  meant a game type added after an environment was first seeded (exactly what happened with
     *  Math Challenge) would silently never appear, because the loader stopped running entirely
     *  the moment ANY game existed. Each game is now inserted independently, by name, only if
     *  missing - so adding a 7th game later "just works" on every environment without needing a
     *  matching data migration each time. */
    @Override
    public void run(String... args) {
        List<Game> existing = gameRepository.findAll();
        Set<String> existingNames = existing.stream().map(Game::getName).collect(Collectors.toSet());
        boolean freshDatabase = existing.isEmpty();

        Game deductiveEasy = upsertIfMissing(existingNames, Game.builder()
                .name("Deductive Challenge")
                .gameType(GameType.DEDUCTIVE)
                .description("Spot the hidden rule behind a family of symbol cards and apply it.")
                .difficulty(GameDifficulty.EASY)
                .status(GameStatus.PUBLISHED)
                .roundCount(5)
                .roundDurationSeconds(45)
                .build());

        upsertIfMissing(existingNames, Game.builder()
                .name("Deductive Challenge - Advanced")
                .gameType(GameType.DEDUCTIVE)
                .description("A harder set of hidden-rule deductions for high performers.")
                .difficulty(GameDifficulty.HARD)
                .status(GameStatus.PUBLISHED)
                .roundCount(6)
                .roundDurationSeconds(40)
                .negativeMarkingEnabled(true)
                .negativeMarkingPenalty(0.25)
                .build());

        Game switchGame = upsertIfMissing(existingNames, Game.builder()
                .name("Switch Challenge")
                .gameType(GameType.SWITCH)
                .description("React fast to a rule that governs Shape + Color + Number - then adapt when it switches.")
                .difficulty(GameDifficulty.MEDIUM)
                .status(GameStatus.PUBLISHED)
                .roundCount(9)
                .roundDurationSeconds(10)
                .gameConfig(Map.of("switchEveryRounds", 3))
                .build());

        upsertIfMissing(existingNames, Game.builder()
                .name("Grid Challenge")
                .gameType(GameType.GRID)
                .description("No row or column repeats a symbol - work out what belongs in the missing cell.")
                .difficulty(GameDifficulty.MEDIUM)
                .status(GameStatus.PUBLISHED)
                .roundCount(6)
                .roundDurationSeconds(30)
                .build());

        upsertIfMissing(existingNames, Game.builder()
                .name("Inductive Challenge")
                .gameType(GameType.INDUCTIVE)
                .description("Two grids share a hidden rule - find the two candidates that follow it too.")
                .difficulty(GameDifficulty.MEDIUM)
                .status(GameStatus.PUBLISHED)
                .roundCount(6)
                .roundDurationSeconds(35)
                .build());

        upsertIfMissing(existingNames, Game.builder()
                .name("Motion Challenge")
                .gameType(GameType.MOTION)
                .description("Track a moving object across the board and pick where it ends up.")
                .difficulty(GameDifficulty.MEDIUM)
                .status(GameStatus.PUBLISHED)
                .roundCount(6)
                .roundDurationSeconds(20)
                .build());

        upsertIfMissing(existingNames, Game.builder()
                .name("Math Challenge")
                .gameType(GameType.MATH)
                .description("Calculate each expression and click the circles from highest value to lowest.")
                .difficulty(GameDifficulty.MEDIUM)
                .status(GameStatus.PUBLISHED)
                .roundCount(8)
                .roundDurationSeconds(25)
                .build());

        // Demo attempts are only ever generated once, against a genuinely empty database - never
        // replayed on top of an environment that already has real (or previously-seeded) data.
        if (freshDatabase && deductiveEasy != null && switchGame != null) {
            userRepository.findByEmail("student@placement.io").ifPresent(student -> {
                playToCompletion(student, deductiveEasy, true);
                playAndAbandon(student, switchGame, 3);
            });
        }

        log.info("Game catalog seed check complete; {} games total", gameRepository.count());
    }

    private Game upsertIfMissing(Set<String> existingNames, Game candidate) {
        if (existingNames.contains(candidate.getName())) return null;
        return gameRepository.save(candidate);
    }

    /** Drives a full attempt through the real engine, mostly-correct with varied response times,
     *  so the resulting score/accuracy/streak numbers are genuine rather than fabricated. Rounds
     *  are now generated one at a time (Section 3: adaptive difficulty), so - unlike the old
     *  pre-generated-snapshot version of this loader - each round is only fetched right before
     *  it's answered, after the previous answer has already caused the next one to be built. */
    private void playToCompletion(User student, Game game, boolean mostlyCorrect) {
        GameAttempt attempt = gameEngineService.start(student, game.getId());
        for (int i = 0; i < attempt.getTotalRounds(); i++) {
            GameAttempt current = gameAttemptRepository.findById(attempt.getId()).orElseThrow();
            if (current.getStatus() != GameAttemptStatus.STARTED || i >= current.getRoundsSnapshot().size()) break;
            Map<String, Object> round = current.getRoundsSnapshot().get(i);
            boolean answerCorrectly = mostlyCorrect ? (i % 4 != 0) : (i % 3 == 0);
            List<String> chosen = answerCorrectly ? correctAnswerFor(round) : incorrectAnswerFor(round);
            long responseTimeMs = 2500 + (i * 400L);
            gameEngineService.submitAnswer(student, attempt.getId(), i, chosen, responseTimeMs);
        }
    }

    private void playAndAbandon(User student, Game game, int roundsToAnswer) {
        GameAttempt attempt = gameEngineService.start(student, game.getId());
        for (int i = 0; i < roundsToAnswer && i < attempt.getTotalRounds(); i++) {
            GameAttempt current = gameAttemptRepository.findById(attempt.getId()).orElseThrow();
            if (current.getStatus() != GameAttemptStatus.STARTED || i >= current.getRoundsSnapshot().size()) break;
            Map<String, Object> round = current.getRoundsSnapshot().get(i);
            gameEngineService.submitAnswer(student, attempt.getId(), i, correctAnswerFor(round), 3000);
        }
        gameEngineService.abandon(student, attempt.getId());
    }

    @SuppressWarnings("unchecked")
    private List<String> correctAnswerFor(Map<String, Object> round) {
        String answerMode = String.valueOf(round.getOrDefault("answerMode", "SINGLE"));
        if ("SINGLE".equals(answerMode)) {
            return List.of(String.valueOf(round.get("correctOptionId")));
        }
        return new ArrayList<>((List<String>) round.get("correctOptionIds"));
    }

    @SuppressWarnings("unchecked")
    private List<String> incorrectAnswerFor(Map<String, Object> round) {
        String answerMode = String.valueOf(round.getOrDefault("answerMode", "SINGLE"));
        List<Map<String, Object>> options = (List<Map<String, Object>>) round.get("options");
        List<String> correct = correctAnswerFor(round);
        if ("ORDERED_SEQUENCE".equals(answerMode)) {
            // Every id is technically "correct" in some position - reversing the true order is
            // guaranteed wrong for any round with more than one option (Math always has 3+).
            List<String> reversed = new ArrayList<>(correct);
            Collections.reverse(reversed);
            return reversed;
        }
        if ("MULTI_UNORDERED".equals(answerMode)) {
            List<String> wrong = new ArrayList<>(options.stream().map(o -> String.valueOf(o.get("id")))
                    .filter(id -> !correct.contains(id))
                    .limit(correct.size())
                    .collect(Collectors.toList()));
            if (wrong.size() < correct.size()) wrong.addAll(correct.subList(0, correct.size() - wrong.size()));
            return wrong;
        }
        return options.stream().map(o -> String.valueOf(o.get("id")))
                .filter(id -> !correct.contains(id))
                .findFirst().map(List::of).orElse(correct);
    }
}