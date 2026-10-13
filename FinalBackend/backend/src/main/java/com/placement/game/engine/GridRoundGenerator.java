package com.placement.game.engine;

import com.placement.game.entity.GameType;
import org.springframework.stereotype.Component;

import java.util.*;

/**
 * Grid Challenge (spec Section 8 / 21 - the game that was previously "not visible properly").
 * Renders an N x N Latin-square matrix (every row and every column contains each symbol from an
 * N-symbol alphabet exactly once - "no row or column should have similar symbols") with exactly
 * one blanked cell for the student to fill.
 *
 * <p>The matrix is built as a proper Latin square by permuting the rows, columns and symbol
 * labels of the canonical cyclic square {@code base[r][c] = (r + c) mod n}, which is itself
 * always a valid Latin square - permuting rows/columns/labels of a valid Latin square always
 * yields another valid Latin square, so this never needs a solver or a rejection-sampling loop.
 * Blanking a single cell of a genuine Latin square always has exactly one valid solution: the row
 * already contains N-1 of the N symbols, so exactly one is missing (Section 8: "Make sure the
 * generated puzzle always has exactly one valid solution").
 *
 * <p>Level scaling: grid/alphabet size grows 3x3 (3 symbols) -> 6x6 (6 symbols); at higher levels
 * some symbols share a shape and are only distinguished by color ("color + shape combinations"),
 * making the matrix visually harder to scan even though the underlying logic is unchanged.
 */
@Component
public class GridRoundGenerator implements RoundGenerator {

    private static final List<String> SHAPES = List.of("TRIANGLE", "CIRCLE", "SQUARE", "CROSS", "STAR", "DIAMOND");
    private static final List<String> COLORS = List.of("BLUE", "GREEN", "RED", "PURPLE", "ORANGE", "TEAL");

    private record Symbol(String id, String shape, String color) {
        Map<String, Object> toMap() {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", id);
            m.put("shape", shape);
            m.put("color", color);
            return m;
        }
    }

    @Override
    public GameType supports() {
        return GameType.GRID;
    }

    @Override
    public Map<String, Object> generateRound(int roundIndex, int level, Map<String, Object> gameConfig,
                                              int roundDurationSeconds, Random random) {
        int configured = GameEngineUtil.configInt(gameConfig, "gridSize", 0);
        int n = configured >= 3 ? clamp(configured, 3, 6) : sizeForLevel(level);
        boolean colorVariants = level >= 6;

        List<Symbol> alphabet = buildAlphabet(n, colorVariants, random);
        String[][] grid = buildLatinSquare(n, alphabet, random);

        int blankRow = random.nextInt(n);
        int blankCol = random.nextInt(n);
        String correctSymbolId = grid[blankRow][blankCol];

        List<List<String>> cells = new ArrayList<>();
        for (int r = 0; r < n; r++) {
            List<String> row = new ArrayList<>();
            for (int c = 0; c < n; c++) {
                row.add((r == blankRow && c == blankCol) ? null : grid[r][c]);
            }
            cells.add(row);
        }

        List<Symbol> shuffledAlphabet = GameEngineUtil.shuffled(alphabet, random);
        List<Map<String, Object>> options = new ArrayList<>();
        String correctOptionId = null;
        for (Symbol s : shuffledAlphabet) {
            String optId = "opt_" + s.id();
            options.add(GameEngineUtil.option(optId, s.toMap()));
            if (s.id().equals(correctSymbolId)) correctOptionId = optId;
        }

        Map<String, Object> meta = new LinkedHashMap<>();
        meta.put("gridSize", n);
        meta.put("alphabet", alphabet.stream().map(Symbol::toMap).toList());
        meta.put("cells", cells);
        meta.put("blankRow", blankRow);
        meta.put("blankCol", blankCol);

        int timeLimit = Math.max(15, roundDurationSeconds - GameEngineUtil.levelFactor(level) * 3);
        return GameEngineUtil.baseRound(roundIndex,
                "No row or column repeats a symbol. Pick the symbol that belongs in the highlighted cell.",
                meta, options, correctOptionId, timeLimit, level);
    }

    private int sizeForLevel(int level) {
        if (level <= 2) return 3;
        if (level <= 4) return 4;
        if (level <= 6) return 5;
        return 6;
    }

    private List<Symbol> buildAlphabet(int n, boolean colorVariants, Random random) {
        List<Symbol> alphabet = new ArrayList<>();
        if (!colorVariants) {
            List<String> shapes = GameEngineUtil.shuffled(SHAPES, random);
            for (int i = 0; i < n; i++) {
                alphabet.add(new Symbol("sym_" + i, shapes.get(i % shapes.size()), COLORS.get(0)));
            }
            return alphabet;
        }
        // Deliberately reuse shapes across a couple of symbols, disambiguated only by color, so
        // the alphabet is visually harder to scan at a glance while every symbol id stays unique.
        Set<String> used = new HashSet<>();
        int guard = 0;
        while (alphabet.size() < n && guard++ < 500) {
            String shape = SHAPES.get(random.nextInt(SHAPES.size()));
            String color = COLORS.get(random.nextInt(COLORS.size()));
            String key = shape + "|" + color;
            if (used.add(key)) alphabet.add(new Symbol("sym_" + alphabet.size(), shape, color));
        }
        int s = 0, c = 0;
        while (alphabet.size() < n) {
            String key = SHAPES.get(s % SHAPES.size()) + "|" + COLORS.get(c % COLORS.size());
            s++;
            if (s % SHAPES.size() == 0) c++;
            if (used.add(key)) {
                String[] parts = key.split("\\|");
                alphabet.add(new Symbol("sym_" + alphabet.size(), parts[0], parts[1]));
            }
        }
        return alphabet;
    }

    /** Canonical cyclic Latin square with randomly permuted rows, columns and symbol labels -
     *  still guaranteed to be a valid Latin square (see class javadoc). */
    private String[][] buildLatinSquare(int n, List<Symbol> alphabet, Random random) {
        int[] rowPerm = randomIndexPermutation(n, random);
        int[] colPerm = randomIndexPermutation(n, random);
        int[] symPerm = randomIndexPermutation(n, random);

        String[][] grid = new String[n][n];
        for (int r = 0; r < n; r++) {
            for (int c = 0; c < n; c++) {
                int base = (rowPerm[r] + colPerm[c]) % n;
                grid[r][c] = alphabet.get(symPerm[base]).id();
            }
        }
        return grid;
    }

    private int[] randomIndexPermutation(int n, Random random) {
        List<Integer> values = new ArrayList<>();
        for (int i = 0; i < n; i++) values.add(i);
        List<Integer> shuffled = GameEngineUtil.shuffled(values, random);
        int[] arr = new int[n];
        for (int i = 0; i < n; i++) arr[i] = shuffled.get(i);
        return arr;
    }

    private int clamp(int v, int min, int max) {
        return Math.max(min, Math.min(max, v));
    }
}
