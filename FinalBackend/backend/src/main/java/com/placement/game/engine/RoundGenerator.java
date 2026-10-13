package com.placement.game.engine;

import com.placement.game.entity.GameType;

import java.util.Map;
import java.util.Random;

/**
 * One implementation per {@link GameType} (Section 8/19: "reusable architecture" - adding a game
 * type means adding one class here plus one enum value, nothing else in the module changes).
 * Implementations must be pure/deterministic given the same {@link Random} seed, so admins can
 * reliably preview a game before publishing it.
 *
 * <p>{@code level} is the student's current adaptive difficulty level (1 = Easy .. 8 = Expert+,
 * see {@link AdaptiveDifficulty}), recomputed by {@code GameEngineService} after every answer and
 * passed into the generator that builds the next round. Every implementation must make the
 * generated puzzle <em>genuinely</em> more complex as level increases - more attributes, more
 * distractors, a bigger board, tighter timing - never just a relabeled copy of the level-1 puzzle
 * (Section 3: "THIS IS VERY IMPORTANT").
 *
 * <p>The returned map is the full server-side round record, built via {@link GameEngineUtil},
 * and always contains at least:
 * <ul>
 *   <li>{@code prompt} (String) - instruction text shown to the student</li>
 *   <li>{@code meta} (Map) - stimulus data safe to show the student (grid, symbols, sequence...)</li>
 *   <li>{@code options} (List&lt;Map&gt; of {@code id}/{@code label}) - selectable answers, with
 *       no hint of correctness baked into ordering or ids</li>
 *   <li>{@code answerMode} (String) - one of:
 *     <ul>
 *       <li>{@code SINGLE} - exactly one correct option id (Deductive, Switch, Grid, Motion)</li>
 *       <li>{@code MULTI_UNORDERED} - a fixed-size correct subset, order doesn't matter
 *           (Inductive: pick exactly 2 of 4)</li>
 *       <li>{@code ORDERED_SEQUENCE} - every option must be submitted, in a specific order
 *           (Math: click every expression, highest value first)</li>
 *     </ul>
 *   </li>
 *   <li>{@code correctOptionId} / {@code correctOptionIds} - NEVER sent to the client before the
 *       round is answered; stripped by {@code GameEngineService#publicRound}</li>
 *   <li>{@code requiredSelectionCount} (int)</li>
 *   <li>{@code timeLimitSeconds} (int)</li>
 *   <li>{@code level} (int) - echoed back for the HUD and analytics</li>
 * </ul>
 */
public interface RoundGenerator {

    GameType supports();

    Map<String, Object> generateRound(int roundIndex, int level, Map<String, Object> gameConfig,
                                       int roundDurationSeconds, Random random);
}
