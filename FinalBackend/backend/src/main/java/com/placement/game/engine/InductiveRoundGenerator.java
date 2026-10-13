package com.placement.game.engine;

import com.placement.game.entity.GameType;
import org.springframework.stereotype.Component;

import java.util.*;

/**
 * Inductive Challenge (spec Section 7): two example 3x3 symbol grids share a hidden rule; the
 * student is shown four candidate grids and must select exactly the two that follow the same
 * rule. Uses the same constructive, field(cell)-disjoint clause approach as
 * {@link DeductiveRoundGenerator} so "exactly two candidates are correct" is guaranteed by
 * construction rather than verified after the fact: every example/correct-candidate grid is built
 * to satisfy every active clause, every incorrect-candidate grid is built to satisfy all but one
 * (deliberately broken) clause.
 */
@Component
public class InductiveRoundGenerator implements RoundGenerator {

    private record Symbol(String shape, String color) {
        Map<String, Object> toMap() {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("shape", shape);
            m.put("color", color);
            return m;
        }
    }

    private static final List<Symbol> PALETTE = List.of(
            new Symbol("CIRCLE", "PURPLE"), new Symbol("CROSS", "ORANGE"),
            new Symbol("SQUARE", "GREEN"), new Symbol("TRIANGLE", "BLUE"),
            new Symbol("STAR", "RED"), new Symbol("DIAMOND", "TEAL"));

    private interface Clause {
        Set<Integer> cells(); // 0-8, row-major index into the 3x3 grid
        void forceSatisfy(int[][] g, Random random, int poolSize);
        void forceViolate(int[][] g, Random random, int poolSize);
    }

    @Override
    public GameType supports() {
        return GameType.INDUCTIVE;
    }

    @Override
    public Map<String, Object> generateRound(int roundIndex, int level, Map<String, Object> gameConfig,
                                              int roundDurationSeconds, Random random) {
        int poolSize = poolSizeForLevel(level);
        List<Symbol> palette = PALETTE.subList(0, poolSize);

        List<Clause> clauses = buildClausePool(level, poolSize, random);
        int clauseCount = clauseCountForLevel(level);
        List<Clause> rule = pickDisjointClauses(clauses, clauseCount, random);

        int[][] example1 = buildSatisfying(rule, poolSize, random);
        int[][] example2 = buildSatisfying(rule, poolSize, random);

        int[][] correctA = buildSatisfying(rule, poolSize, random);
        int[][] correctB = buildSatisfying(rule, poolSize, random);
        int guard = 0;
        while (Arrays.deepEquals(correctA, correctB) && guard++ < 50) {
            correctB = buildSatisfying(rule, poolSize, random);
        }

        int[][] wrongA = buildViolating(rule, poolSize, random);
        int[][] wrongB = buildViolating(rule, poolSize, random);
        guard = 0;
        while (Arrays.deepEquals(wrongA, wrongB) && guard++ < 50) {
            wrongB = buildViolating(rule, poolSize, random);
        }

        record Candidate(String id, int[][] grid, boolean correct) {}
        List<Candidate> candidates = new ArrayList<>(List.of(
                new Candidate("cand_0", correctA, true),
                new Candidate("cand_1", correctB, true),
                new Candidate("cand_2", wrongA, false),
                new Candidate("cand_3", wrongB, false)));
        List<Candidate> shuffledCandidates = GameEngineUtil.shuffled(candidates, random);

        List<Map<String, Object>> options = new ArrayList<>();
        List<String> correctOptionIds = new ArrayList<>();
        for (int i = 0; i < shuffledCandidates.size(); i++) {
            Candidate cand = shuffledCandidates.get(i);
            String optId = "opt_" + i;
            options.add(GameEngineUtil.option(optId, gridToCells(cand.grid(), palette)));
            if (cand.correct()) correctOptionIds.add(optId);
        }

        Map<String, Object> meta = new LinkedHashMap<>();
        meta.put("exampleGrids", List.of(gridToCells(example1, palette), gridToCells(example2, palette)));
        meta.put("gridSize", 3);

        int timeLimit = Math.max(15, roundDurationSeconds - GameEngineUtil.levelFactor(level) * 3);
        return GameEngineUtil.multiRound(roundIndex,
                "These two grids follow a rule. Which two of these grids follow the same rule?",
                meta, options, correctOptionIds, "MULTI_UNORDERED", 2, timeLimit, level);
    }

    // -------------------------------------------------------------------------- level tuning --

    private int poolSizeForLevel(int level) {
        if (level <= 2) return 3;
        if (level <= 4) return 4;
        if (level <= 6) return 5;
        return 6;
    }

    private int clauseCountForLevel(int level) {
        if (level <= 3) return 1;
        if (level <= 5) return 2;
        if (level <= 6) return 3;
        return 4;
    }

    // ----------------------------------------------------------------------------- clauses --

    private List<Clause> buildClausePool(int level, int poolSize, Random random) {
        List<Clause> pool = new ArrayList<>();
        pool.add(horizontalMirrorClause());
        pool.add(verticalMirrorClause());
        if (level >= 2) pool.add(countOfSymbolClause(random.nextInt(poolSize), 2 + random.nextInt(2)));
        if (level >= 3) {
            pool.add(lineUniformClause(true, random.nextInt(3), random.nextInt(poolSize)));
            pool.add(lineUniformClause(false, random.nextInt(3), random.nextInt(poolSize)));
        }
        if (level >= 4) pool.add(cornersUniformClause(random.nextInt(poolSize)));
        if (level >= 6) {
            pool.add(centerIsClause(random.nextInt(poolSize)));
            pool.add(diagonalUniformClause(random.nextBoolean(), random.nextInt(poolSize)));
        }
        return pool;
    }

    private List<Clause> pickDisjointClauses(List<Clause> pool, int k, Random random) {
        List<Clause> shuffledPool = GameEngineUtil.shuffled(pool, random);
        List<Clause> chosen = new ArrayList<>();
        Set<Integer> used = new HashSet<>();
        for (Clause c : shuffledPool) {
            if (chosen.size() >= k) break;
            if (Collections.disjoint(used, c.cells())) {
                chosen.add(c);
                used.addAll(c.cells());
            }
        }
        if (chosen.isEmpty() && !shuffledPool.isEmpty()) chosen.add(shuffledPool.get(0));
        return chosen;
    }

    private Clause centerIsClause(int symbolIdx) {
        return new Clause() {
            public Set<Integer> cells() { return Set.of(4); }
            public void forceSatisfy(int[][] g, Random r, int poolSize) { g[1][1] = symbolIdx; }
            public void forceViolate(int[][] g, Random r, int poolSize) {
                g[1][1] = otherSymbol(symbolIdx, poolSize, r);
            }
        };
    }

    private Clause cornersUniformClause(int symbolIdx) {
        return new Clause() {
            public Set<Integer> cells() { return Set.of(0, 2, 6, 8); }
            public void forceSatisfy(int[][] g, Random r, int poolSize) {
                g[0][0] = symbolIdx; g[0][2] = symbolIdx; g[2][0] = symbolIdx; g[2][2] = symbolIdx;
            }
            public void forceViolate(int[][] g, Random r, int poolSize) {
                g[0][0] = symbolIdx; g[0][2] = symbolIdx; g[2][0] = symbolIdx;
                g[2][2] = otherSymbol(symbolIdx, poolSize, r);
            }
        };
    }

    private Clause lineUniformClause(boolean isRow, int index, int symbolIdx) {
        Set<Integer> cellSet = isRow
                ? Set.of(index * 3, index * 3 + 1, index * 3 + 2)
                : Set.of(index, index + 3, index + 6);
        return new Clause() {
            public Set<Integer> cells() { return cellSet; }
            public void forceSatisfy(int[][] g, Random r, int poolSize) {
                for (int cell : cellSet) g[cell / 3][cell % 3] = symbolIdx;
            }
            public void forceViolate(int[][] g, Random r, int poolSize) {
                for (int cell : cellSet) g[cell / 3][cell % 3] = symbolIdx;
                int broken = new ArrayList<>(cellSet).get(r.nextInt(cellSet.size()));
                g[broken / 3][broken % 3] = otherSymbol(symbolIdx, poolSize, r);
            }
        };
    }

    private Clause diagonalUniformClause(boolean mainDiagonal, int symbolIdx) {
        Set<Integer> cellSet = mainDiagonal ? Set.of(0, 4, 8) : Set.of(2, 4, 6);
        return new Clause() {
            public Set<Integer> cells() { return cellSet; }
            public void forceSatisfy(int[][] g, Random r, int poolSize) {
                for (int cell : cellSet) g[cell / 3][cell % 3] = symbolIdx;
            }
            public void forceViolate(int[][] g, Random r, int poolSize) {
                for (int cell : cellSet) g[cell / 3][cell % 3] = symbolIdx;
                int broken = new ArrayList<>(cellSet).get(r.nextInt(cellSet.size()));
                g[broken / 3][broken % 3] = otherSymbol(symbolIdx, poolSize, r);
            }
        };
    }

    /** Row 0 mirrors row 2, cell for cell - relational only, doesn't care what the actual
     *  symbols are. */
    private Clause horizontalMirrorClause() {
        return new Clause() {
            public Set<Integer> cells() { return Set.of(0, 1, 2, 6, 7, 8); }
            public void forceSatisfy(int[][] g, Random r, int poolSize) {
                for (int c = 0; c < 3; c++) g[2][c] = g[0][c];
            }
            public void forceViolate(int[][] g, Random r, int poolSize) {
                for (int c = 0; c < 3; c++) g[2][c] = g[0][c];
                int col = r.nextInt(3);
                g[2][col] = otherSymbol(g[0][col], poolSize, r);
            }
        };
    }

    private Clause verticalMirrorClause() {
        return new Clause() {
            public Set<Integer> cells() { return Set.of(0, 3, 6, 2, 5, 8); }
            public void forceSatisfy(int[][] g, Random r, int poolSize) {
                for (int row = 0; row < 3; row++) g[row][2] = g[row][0];
            }
            public void forceViolate(int[][] g, Random r, int poolSize) {
                for (int row = 0; row < 3; row++) g[row][2] = g[row][0];
                int row = r.nextInt(3);
                g[row][2] = otherSymbol(g[row][0], poolSize, r);
            }
        };
    }

    /** Exactly `count` cells (out of 9) show the given symbol. Claims the whole grid as its
     *  footprint, so the pool only offers it at levels where it's picked alone. */
    private Clause countOfSymbolClause(int symbolIdx, int count) {
        return new Clause() {
            public Set<Integer> cells() { return Set.of(0, 1, 2, 3, 4, 5, 6, 7, 8); }
            public void forceSatisfy(int[][] g, Random r, int poolSize) {
                List<Integer> allCells = new ArrayList<>();
                for (int i = 0; i < 9; i++) allCells.add(i);
                List<Integer> chosen = GameEngineUtil.shuffled(allCells, r).subList(0, count);
                for (int i = 0; i < 9; i++) {
                    boolean target = chosen.contains(i);
                    int rr = i / 3, cc = i % 3;
                    if (target) g[rr][cc] = symbolIdx;
                    else if (g[rr][cc] == symbolIdx) g[rr][cc] = otherSymbol(symbolIdx, poolSize, r);
                }
            }
            public void forceViolate(int[][] g, Random r, int poolSize) {
                forceSatisfy(g, r, poolSize);
                // Flip one non-target cell to the target symbol (or remove one target instance),
                // so the count is off by exactly one - a close, plausible distractor.
                int flip = r.nextInt(9);
                int rr = flip / 3, cc = flip % 3;
                g[rr][cc] = g[rr][cc] == symbolIdx ? otherSymbol(symbolIdx, poolSize, r) : symbolIdx;
            }
        };
    }

    private int otherSymbol(int current, int poolSize, Random random) {
        if (poolSize <= 1) return current;
        int candidate;
        do {
            candidate = random.nextInt(poolSize);
        } while (candidate == current);
        return candidate;
    }

    // ------------------------------------------------------------------------- grid builders --

    private int[][] randomGrid(int poolSize, Random random) {
        int[][] g = new int[3][3];
        for (int r = 0; r < 3; r++) for (int c = 0; c < 3; c++) g[r][c] = random.nextInt(poolSize);
        return g;
    }

    private int[][] buildSatisfying(List<Clause> rule, int poolSize, Random random) {
        int[][] g = randomGrid(poolSize, random);
        for (Clause clause : rule) clause.forceSatisfy(g, random, poolSize);
        return g;
    }

    private int[][] buildViolating(List<Clause> rule, int poolSize, Random random) {
        int[][] g = buildSatisfying(rule, poolSize, random);
        Clause toBreak = rule.get(random.nextInt(rule.size()));
        toBreak.forceViolate(g, random, poolSize);
        return g;
    }

    private List<List<Map<String, Object>>> gridToCells(int[][] g, List<Symbol> palette) {
        List<List<Map<String, Object>>> rows = new ArrayList<>();
        for (int r = 0; r < 3; r++) {
            List<Map<String, Object>> row = new ArrayList<>();
            for (int c = 0; c < 3; c++) row.add(palette.get(g[r][c] % palette.size()).toMap());
            rows.add(row);
        }
        return rows;
    }
}
