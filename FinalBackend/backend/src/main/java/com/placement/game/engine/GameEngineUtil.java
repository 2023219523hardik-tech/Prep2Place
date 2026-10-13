package com.placement.game.engine;

import java.util.*;

/** Small shared helpers so each {@link RoundGenerator} implementation stays focused on its own
 *  game mechanic instead of re-deriving config/option/round-shape plumbing. */
final class GameEngineUtil {

    private GameEngineUtil() {}

    static int configInt(Map<String, Object> gameConfig, String key, int fallback) {
        if (gameConfig == null) return fallback;
        Object v = gameConfig.get(key);
        if (v instanceof Number n) return n.intValue();
        if (v instanceof String s) {
            try {
                return Integer.parseInt(s);
            } catch (NumberFormatException ignored) {
                return fallback;
            }
        }
        return fallback;
    }

    static boolean configBool(Map<String, Object> gameConfig, String key, boolean fallback) {
        if (gameConfig == null) return fallback;
        Object v = gameConfig.get(key);
        if (v instanceof Boolean b) return b;
        if (v instanceof String s) return Boolean.parseBoolean(s);
        return fallback;
    }

    /** 0-based scaling factor derived from level (1-8 -> 0-7), for generators that want a simple
     *  "how many extra distractors/attributes/board-cells should I add" knob. */
    static int levelFactor(int level) {
        return AdaptiveDifficulty.clampLevel(level) - 1;
    }

    static Map<String, Object> option(String id, Object label) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", id);
        m.put("label", label);
        return m;
    }

    /** Fisher-Yates shuffle using the round's own Random so option order is deterministic per
     *  seed but not predictably tied to which index holds the correct answer. */
    static <T> List<T> shuffled(List<T> list, Random random) {
        List<T> copy = new ArrayList<>(list);
        for (int i = copy.size() - 1; i > 0; i--) {
            int j = random.nextInt(i + 1);
            T tmp = copy.get(i);
            copy.set(i, copy.get(j));
            copy.set(j, tmp);
        }
        return copy;
    }

    /** Single-answer round (Deductive / Switch / Grid / Motion): exactly one correct option. */
    static Map<String, Object> baseRound(int roundIndex, String prompt, Map<String, Object> meta,
                                          List<Map<String, Object>> options, String correctOptionId,
                                          int timeLimitSeconds, int level) {
        Map<String, Object> round = new LinkedHashMap<>();
        round.put("roundIndex", roundIndex);
        round.put("prompt", prompt);
        round.put("meta", meta);
        round.put("options", options);
        round.put("answerMode", "SINGLE");
        round.put("correctOptionId", correctOptionId);
        round.put("correctOptionIds", correctOptionId == null ? List.of() : List.of(correctOptionId));
        round.put("requiredSelectionCount", 1);
        round.put("timeLimitSeconds", timeLimitSeconds);
        round.put("level", level);
        return round;
    }

    /** Multi-answer round: Inductive's "pick exactly two" (MULTI_UNORDERED) or Math's "click
     *  every expression in descending order" (ORDERED_SEQUENCE, requiredSelectionCount ==
     *  options.size()). */
    static Map<String, Object> multiRound(int roundIndex, String prompt, Map<String, Object> meta,
                                           List<Map<String, Object>> options, List<String> correctOptionIds,
                                           String answerMode, int requiredSelectionCount,
                                           int timeLimitSeconds, int level) {
        Map<String, Object> round = new LinkedHashMap<>();
        round.put("roundIndex", roundIndex);
        round.put("prompt", prompt);
        round.put("meta", meta);
        round.put("options", options);
        round.put("answerMode", answerMode);
        round.put("correctOptionId", correctOptionIds.isEmpty() ? null : correctOptionIds.get(0));
        round.put("correctOptionIds", correctOptionIds);
        round.put("requiredSelectionCount", requiredSelectionCount);
        round.put("timeLimitSeconds", timeLimitSeconds);
        round.put("level", level);
        return round;
    }
}
