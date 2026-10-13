package com.placement.game.engine;

import com.placement.game.entity.GameType;
import org.springframework.stereotype.Component;

import java.util.*;

/**
 * Switch Challenge (spec Section 5): a top row of N distinct shape tiles is rearranged into a
 * bottom row; the student must pick the digit sequence (e.g. "2413") that correctly describes the
 * rearrangement, where digit at position i names which SOURCE (top-row) position was placed into
 * TARGET (bottom-row) position i.
 *
 * <p>Every tile is guaranteed visually unique (shape, or shape+color once repeats are introduced
 * at higher levels) so any two different permutation strings necessarily produce two different
 * bottom rows - this is what guarantees exactly one of the offered permutation strings can be
 * correct, without needing to re-derive/verify it after the fact.
 *
 * <p>Level scaling: sequence length 4 -> 7, single-color tiles -> repeated shapes disambiguated
 * only by color ("repeated visual attributes"), a single shuffle -> a composition of 2-3 shuffles
 * applied in sequence ("two-step switching"), and more (closer, adjacent-swap) distractor options.
 */
@Component
public class SwitchRoundGenerator implements RoundGenerator {

    private static final List<String> SHAPES =
            List.of("SQUARE", "CROSS", "TRIANGLE", "CIRCLE", "STAR", "HEXAGON", "DIAMOND");
    private static final List<String> COLORS = List.of("GREEN", "BLUE", "RED", "PURPLE", "ORANGE");

    private record Tile(String shape, String color) {
        Map<String, Object> toMap() {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("shape", shape);
            m.put("color", color);
            return m;
        }
    }

    @Override
    public GameType supports() {
        return GameType.SWITCH;
    }

    @Override
    public Map<String, Object> generateRound(int roundIndex, int level, Map<String, Object> gameConfig,
                                              int roundDurationSeconds, Random random) {
        int n = Math.min(7, 4 + (level - 1) / 2);
        int steps = level >= 8 ? 3 : level >= 6 ? 2 : 1;
        int optionCount = level >= 8 ? 6 : level >= 6 ? 5 : 4;
        boolean allowRepeatedShapes = level >= 5;

        List<Tile> source = buildDistinctTiles(n, allowRepeatedShapes, random);

        int[] permutation = identity(n);
        for (int s = 0; s < steps; s++) {
            permutation = compose(permutation, randomPermutation(n, random));
        }
        int[] correctPermutation = permutation;

        List<Tile> target = new ArrayList<>();
        for (int i = 0; i < n; i++) target.add(source.get(correctPermutation[i] - 1));

        String correctString = toDigitString(correctPermutation);
        Set<String> optionStrings = new LinkedHashSet<>();
        optionStrings.add(correctString);
        int guard = 0;
        while (optionStrings.size() < optionCount && guard++ < 300) {
            int[] candidate = correctPermutation.clone();
            boolean nearMiss = level >= 6;
            if (nearMiss) {
                // Swap two adjacent digits so the distractor "reads" almost like the real answer.
                int i = random.nextInt(n - 1);
                swap(candidate, i, i + 1);
            } else {
                int i = random.nextInt(n);
                int j = random.nextInt(n);
                swap(candidate, i, j);
            }
            optionStrings.add(toDigitString(candidate));
        }
        while (optionStrings.size() < optionCount) {
            optionStrings.add(toDigitString(randomPermutation(n, random)));
        }

        List<String> shuffledOptions = GameEngineUtil.shuffled(new ArrayList<>(optionStrings), random);
        List<String> optionIds = new ArrayList<>();
        for (int i = 0; i < shuffledOptions.size(); i++) optionIds.add("opt_" + i);
        List<Map<String, Object>> options = new ArrayList<>();
        String correctOptionId = null;
        for (int i = 0; i < shuffledOptions.size(); i++) {
            options.add(GameEngineUtil.option(optionIds.get(i), shuffledOptions.get(i)));
            if (shuffledOptions.get(i).equals(correctString) && correctOptionId == null) {
                correctOptionId = optionIds.get(i);
            }
        }

        Map<String, Object> meta = new LinkedHashMap<>();
        meta.put("topSequence", source.stream().map(Tile::toMap).toList());
        meta.put("bottomSequence", target.stream().map(Tile::toMap).toList());
        meta.put("sequenceLength", n);
        meta.put("transformationSteps", steps);

        int timeLimit = Math.max(8, roundDurationSeconds - GameEngineUtil.levelFactor(level));
        String prompt = steps > 1
                ? "The top row was rearranged into the bottom row through more than one switch. "
                + "Pick the number sequence that describes the final rearrangement."
                : "The top row was rearranged into the bottom row. Pick the number sequence that "
                + "describes the rearrangement.";
        return GameEngineUtil.baseRound(roundIndex, prompt, meta, options, correctOptionId, timeLimit, level);
    }

    private List<Tile> buildDistinctTiles(int n, boolean allowRepeatedShapes, Random random) {
        List<Tile> tiles = new ArrayList<>();
        Set<String> used = new HashSet<>();
        int guard = 0;
        while (tiles.size() < n && guard++ < 500) {
            String shape = SHAPES.get(random.nextInt(Math.min(SHAPES.size(), allowRepeatedShapes ? SHAPES.size() : n)));
            String color = COLORS.get(random.nextInt(allowRepeatedShapes ? COLORS.size() : 1));
            String key = shape + "|" + color;
            if (used.add(key)) tiles.add(new Tile(shape, color));
        }
        // Defensive pad (only reachable if the random search above couldn't find enough distinct
        // shape+color combinations within the guard budget).
        int shapeIdx = 0;
        int colorIdx = 0;
        while (tiles.size() < n) {
            String key;
            do {
                key = SHAPES.get(shapeIdx % SHAPES.size()) + "|" + COLORS.get(colorIdx % COLORS.size());
                shapeIdx++;
                if (shapeIdx % SHAPES.size() == 0) colorIdx++;
            } while (used.contains(key));
            used.add(key);
            String[] parts = key.split("\\|");
            tiles.add(new Tile(parts[0], parts[1]));
        }
        return tiles;
    }

    private int[] identity(int n) {
        int[] p = new int[n];
        for (int i = 0; i < n; i++) p[i] = i + 1;
        return p;
    }

    private int[] randomPermutation(int n, Random random) {
        List<Integer> values = new ArrayList<>();
        for (int i = 1; i <= n; i++) values.add(i);
        List<Integer> shuffled = GameEngineUtil.shuffled(values, random);
        int[] p = new int[n];
        for (int i = 0; i < n; i++) p[i] = shuffled.get(i);
        return p;
    }

    /** Applies `second` to the result of `first`: composed[i] = first[second[i] - 1]. */
    private int[] compose(int[] first, int[] second) {
        int n = first.length;
        int[] result = new int[n];
        for (int i = 0; i < n; i++) result[i] = first[second[i] - 1];
        return result;
    }

    private void swap(int[] arr, int i, int j) {
        int tmp = arr[i];
        arr[i] = arr[j];
        arr[j] = tmp;
    }

    private String toDigitString(int[] permutation) {
        StringBuilder sb = new StringBuilder();
        for (int v : permutation) sb.append(v);
        return sb.toString();
    }
}
