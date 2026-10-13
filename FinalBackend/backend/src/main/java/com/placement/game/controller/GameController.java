package com.placement.game.controller;

import com.placement.entity.User;
import com.placement.exception.ApiException;
import com.placement.game.dto.GameDtos.*;
import com.placement.game.entity.Game;
import com.placement.game.entity.GameAttempt;
import com.placement.game.entity.GameAttemptStatus;
import com.placement.game.service.GameEngineService;
import lombok.RequiredArgsConstructor;
import com.placement.service.CurrentUserService;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Student-facing Game-Based Assessment endpoints. All routes here operate on the currently
 * authenticated user (via {@link CurrentUserService}) and never accept a candidate id from the
 * client, so a student can never read or affect another student's attempt (Section 20).
 */
@RestController
@RequestMapping("/api/games")
@RequiredArgsConstructor
public class GameController {

    private final GameEngineService gameEngineService;
    private final CurrentUserService currentUserService;

    @GetMapping
    public List<GameSummaryView> listAvailable() {
        User candidate = currentUserService.getCurrentUser();

        return gameEngineService.listAvailableForStudent(candidate)
                .stream()
                .map(GameSummaryView::from)
                .toList();
    }

    @GetMapping("/{id}")
    public GameSummaryView get(@PathVariable Long id) {
        User candidate = currentUserService.getCurrentUser();

        Game game = gameEngineService.listAvailableForStudent(candidate)
                .stream()
                .filter(g -> g.getId().equals(id))
                .findFirst()
                .orElseThrow(() ->
                        ApiException.notFound(
                                "Game not found or not currently available"
                        ));

        return GameSummaryView.from(game);
    }

    @GetMapping("/history")
    public List<AttemptSummaryView> history() {
        User candidate = currentUserService.getCurrentUser();

        return gameEngineService.historyForStudent(candidate)
                .stream()
                .map(AttemptSummaryView::from)
                .toList();
    }

    @PostMapping("/{id}/start")
    public AttemptView start(@PathVariable Long id) {
        User candidate = currentUserService.getCurrentUser();

        GameAttempt attempt = gameEngineService.start(candidate, id);

        return gameEngineService.toAttemptView(attempt);
    }

    @PostMapping("/{id}/answer")
    public AnswerResultView answer(
            @PathVariable Long id,
            @RequestBody AnswerSubmitRequest request
    ) {
        User candidate = currentUserService.getCurrentUser();

        GameAttempt inProgress =
                gameEngineService.getInProgressOrThrow(candidate, id);

        GameEngineService.AnswerOutcome outcome =
                gameEngineService.submitAnswer(
                        candidate,
                        inProgress.getId(),
                        request.roundIndex(),
                        request.optionIds(),
                        request.responseTimeMs()
                );

        return new AnswerResultView(
                outcome.correct(),
                outcome.correctOptionId(),
                outcome.correctOptionIds(),
                outcome.roundScore(),
                outcome.levelUp(),
                outcome.previousLevel(),
                outcome.newLevel(),
                gameEngineService.toAttemptView(outcome.attempt())
        );
    }

    @PostMapping("/{id}/complete")
    public AttemptView complete(@PathVariable Long id) {
        User candidate = currentUserService.getCurrentUser();

        GameAttempt attempt =
                gameEngineService.getInProgressOrThrow(candidate, id);

        GameAttempt completed =
                gameEngineService.complete(candidate, attempt.getId());

        return gameEngineService.toAttemptView(completed);
    }

    @PostMapping("/attempts/{attemptId}/abandon")
    public AttemptView abandon(@PathVariable Long attemptId) {
        User candidate = currentUserService.getCurrentUser();

        return gameEngineService.toAttemptView(
                gameEngineService.abandon(candidate, attemptId)
        );
    }

    /**
     * Section 14: pause/resume, only when the game's config allows it.
     *
     * The server timer ({@code expiresAt}) is pushed forward by exactly
     * the paused duration on resume, so pausing never costs the student
     * any of their allotted time.
     */
    @PostMapping("/attempts/{attemptId}/pause")
    public AttemptView pause(@PathVariable Long attemptId) {
        User candidate = currentUserService.getCurrentUser();

        return gameEngineService.toAttemptView(
                gameEngineService.pause(candidate, attemptId)
        );
    }

    @PostMapping("/attempts/{attemptId}/resume")
    public AttemptView resume(@PathVariable Long attemptId) {
        User candidate = currentUserService.getCurrentUser();

        return gameEngineService.toAttemptView(
                gameEngineService.resume(candidate, attemptId)
        );
    }

    @GetMapping("/attempts/{attemptId}")
    public AttemptView getAttempt(@PathVariable Long attemptId) {
        User candidate = currentUserService.getCurrentUser();

        GameAttempt attempt =
                gameEngineService.getOwnedAttemptOrThrow(
                        attemptId,
                        candidate
                );

        return gameEngineService.toAttemptView(attempt);
    }

    @GetMapping("/results/{attemptId}")
    public Map<String, Object> getResult(@PathVariable Long attemptId) {
        User candidate = currentUserService.getCurrentUser();

        GameAttempt attempt =
                gameEngineService.getOwnedAttemptOrThrow(
                        attemptId,
                        candidate
                );

        if (attempt.getStatus() == GameAttemptStatus.STARTED) {
            throw ApiException.conflict(
                    "This attempt is not finished yet"
            );
        }

        return attempt.getResultDetails();
    }
}