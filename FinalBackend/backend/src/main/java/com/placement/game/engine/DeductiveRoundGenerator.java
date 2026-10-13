package com.placement.game.engine;

import com.placement.game.entity.GameType;
import org.springframework.stereotype.Component;

import java.util.*;

/**
 * Deductive Challenge (spec Section 4): a hidden rule - one or more attribute constraints ANDed
 * together - governs a family of symbol cards (shape + fill + color + size + count). The student
 * sees a few example cards that all satisfy the rule, then must pick the one option (out of four)
 * that is also consistent with it.
 *
 * <p>Rule complexity (number of ANDed clauses, and which attribute dimensions are in play) scales
 * with level per Section 4's progression table: Level 1 is a single property; Level 8 combines up
 * to four interacting clauses across shape/fill/color/size/count with distractors that violate
 * only ONE clause each, making them "highly similar" to the correct answer.
 *
 * <p>Every clause knows how to force a card to satisfy it and how to force a card to violate it,
 * touching only its own attribute field(s). Clauses in one rule are chosen to have disjoint
 * fields, so cards are built <em>constructively</em> (not by rejection sampling) - this is what
 * guarantees "every question must have exactly one valid answer" even as rule complexity grows,
 * without ever needing an unbounded search loop.
 */
@Component
public class DeductiveRoundGenerator implements RoundGenerator {

    private enum Field { SHAPE, FILL, COLOR, COUNT, SIZE }

    private static final List<String> COLORS = List.of("RED", "BLUE", "GREEN", "PURPLE", "ORANGE");
    private static final List<String> SIZES = List.of("SMALL", "MEDIUM", "LARGE");

    private static final Map<String, Integer> SHAPE_SIDES = Map.of(
            "CIRCLE", 1, "TRIANGLE", 3, "SQUARE", 4, "RECTANGLE", 4,
            "HEXAGON", 6, "PENTAGON", 5, "STAR", 5, "CROSS", 4, "DIAMOND", 4);

    private static final class Card {
        String shape, fill, color, size;
        int count;

        Card copy() {
            Card c = new Card();
            c.shape = shape; c.fill = fill; c.color = color; c.size = size; c.count = count;
            return c;
        }

        boolean sameAs(Card o) {
            return Objects.equals(shape, o.shape) && Objects.equals(fill, o.fill)
                    && Objects.equals(color, o.color) && Objects.equals(size, o.size) && count == o.count;
        }

        Map<String, Object> toMap() {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("shape", shape);
            m.put("fill", fill);
            m.put("color", color);
            m.put("size", size);
            m.put("count", count);
            return m;
        }
    }

    private interface Clause {
        Set<Field> fields();
        boolean test(Card c);
        void forceSatisfy(Card c, Random random);
        void forceViolate(Card c, Random random);
    }

    @Override
    public GameType supports() {
        return GameType.DEDUCTIVE;
    }

    @Override
    public Map<String, Object> generateRound(int roundIndex, int level, Map<String, Object> gameConfig,
                                              int roundDurationSeconds, Random random) {
        List<String> shapes = shapesForLevel(level);
        List<String> fills = fillsForLevel(level);
        int maxCount = maxCountForLevel(level);

        List<Clause> pool = buildClausePool(level, shapes, fills, maxCount, random);
        int clauseCount = clauseCountForLevel(level);
        List<Clause> rule = pickDisjointClauses(pool, clauseCount, random);

        int exampleCount = level >= 5 ? 4 : 3;
        List<Card> examples = new ArrayList<>();
        for (int i = 0; i < exampleCount; i++) {
            examples.add(buildSatisfying(rule, shapes, fills, maxCount, random));
        }

        Card correctCard = buildSatisfying(rule, shapes, fills, maxCount, random);
        List<Card> candidates = new ArrayList<>();
        candidates.add(correctCard);
        int guard = 0;
        while (candidates.size() < 4 && guard++ < 200) {
            Card distractor = buildViolating(rule, shapes, fills, maxCount, random);
            boolean duplicate = candidates.stream().anyMatch(c -> c.sameAs(distractor));
            if (!duplicate) candidates.add(distractor);
        }
        while (candidates.size() < 4) {
            candidates.add(buildViolating(rule, shapes, fills, maxCount, random));
        }

        List<String> optionIds = List.of("opt_0", "opt_1", "opt_2", "opt_3");
        List<Card> shuffledCandidates = GameEngineUtil.shuffled(candidates, random);
        List<Map<String, Object>> options = new ArrayList<>();
        String correctOptionId = null;
        for (int i = 0; i < shuffledCandidates.size() && i < 4; i++) {
            Card c = shuffledCandidates.get(i);
            options.add(GameEngineUtil.option(optionIds.get(i), c.toMap()));
            if (c.sameAs(correctCard) && correctOptionId == null) correctOptionId = optionIds.get(i);
        }

        Map<String, Object> meta = new LinkedHashMap<>();
        meta.put("examples", examples.stream().map(Card::toMap).toList());
        meta.put("ruleComplexity", clauseCount);

        int timeLimit = Math.max(12, roundDurationSeconds - GameEngineUtil.levelFactor(level) * 4);
        return GameEngineUtil.baseRound(roundIndex,
                "Every example card below follows one hidden rule. Pick the option that also follows it.",
                meta, options, correctOptionId, timeLimit, level);
    }

    // ------------------------------------------------------------------------------- pools --

    private List<String> shapesForLevel(int level) {
        List<String> pool = new ArrayList<>(List.of("CIRCLE", "SQUARE", "TRIANGLE", "HEXAGON"));
        if (level >= 3) pool.addAll(List.of("DIAMOND", "STAR"));
        if (level >= 6) pool.addAll(List.of("PENTAGON", "CROSS", "RECTANGLE"));
        return pool;
    }

    private List<String> fillsForLevel(int level) {
        List<String> pool = new ArrayList<>(List.of("FILLED", "OUTLINE"));
        if (level >= 4) pool.addAll(List.of("STRIPED", "DOTTED"));
        return pool;
    }

    private int maxCountForLevel(int level) {
        return Math.min(7, 4 + level / 2);
    }

    private int clauseCountForLevel(int level) {
        if (level <= 2) return 1;
        if (level <= 4) return 2;
        if (level <= 6) return 3;
        return 4;
    }

    // ----------------------------------------------------------------------------- clauses --

    private List<Clause> buildClausePool(int level, List<String> shapes, List<String> fills,
                                          int maxCount, Random random) {
        List<Clause> pool = new ArrayList<>();
        pool.add(shapeIsClause(shapes.get(random.nextInt(shapes.size())), shapes));
        pool.add(fillIsClause(fills.get(random.nextInt(fills.size())), fills));
        pool.add(countParityClause(random.nextBoolean()));
        int threshold = 2 + random.nextInt(Math.max(1, maxCount - 2));
        pool.add(countAtLeastClause(threshold, maxCount));
        if (level >= 4) {
            pool.add(fillImpliesCountParityClause(fills.get(random.nextInt(fills.size())),
                    random.nextBoolean(), maxCount));
        }
        if (level >= 5) {
            pool.add(colorIsClause(COLORS.get(random.nextInt(COLORS.size()))));
        }
        if (level >= 6) {
            pool.add(sizeIsClause(SIZES.get(random.nextInt(SIZES.size()))));
            pool.add(shapeSidesEqualCountClause(shapes, maxCount));
        }
        if (level >= 7) {
            pool.add(shapeImpliesColorClause(shapes.get(random.nextInt(shapes.size())),
                    COLORS.get(random.nextInt(COLORS.size()))));
        }
        return pool;
    }

    private List<Clause> pickDisjointClauses(List<Clause> pool, int k, Random random) {
        List<Clause> shuffledPool = GameEngineUtil.shuffled(pool, random);
        List<Clause> chosen = new ArrayList<>();
        Set<Field> used = new HashSet<>();
        for (Clause c : shuffledPool) {
            if (chosen.size() >= k) break;
            if (Collections.disjoint(used, c.fields())) {
                chosen.add(c);
                used.addAll(c.fields());
            }
        }
        if (chosen.isEmpty() && !shuffledPool.isEmpty()) chosen.add(shuffledPool.get(0));
        return chosen;
    }

    private Clause shapeIsClause(String shape, List<String> pool) {
        return new Clause() {
            public Set<Field> fields() { return EnumSet.of(Field.SHAPE); }
            public boolean test(Card c) { return c.shape.equals(shape); }
            public void forceSatisfy(Card c, Random r) { c.shape = shape; }
            public void forceViolate(Card c, Random r) {
                List<String> others = pool.stream().filter(s -> !s.equals(shape)).toList();
                c.shape = others.get(r.nextInt(others.size()));
            }
        };
    }

    private Clause fillIsClause(String fill, List<String> pool) {
        return new Clause() {
            public Set<Field> fields() { return EnumSet.of(Field.FILL); }
            public boolean test(Card c) { return c.fill.equals(fill); }
            public void forceSatisfy(Card c, Random r) { c.fill = fill; }
            public void forceViolate(Card c, Random r) {
                List<String> others = pool.stream().filter(f -> !f.equals(fill)).toList();
                c.fill = others.get(r.nextInt(others.size()));
            }
        };
    }

    private Clause colorIsClause(String color) {
        return new Clause() {
            public Set<Field> fields() { return EnumSet.of(Field.COLOR); }
            public boolean test(Card c) { return c.color.equals(color); }
            public void forceSatisfy(Card c, Random r) { c.color = color; }
            public void forceViolate(Card c, Random r) {
                List<String> others = COLORS.stream().filter(col -> !col.equals(color)).toList();
                c.color = others.get(r.nextInt(others.size()));
            }
        };
    }

    private Clause sizeIsClause(String size) {
        return new Clause() {
            public Set<Field> fields() { return EnumSet.of(Field.SIZE); }
            public boolean test(Card c) { return c.size.equals(size); }
            public void forceSatisfy(Card c, Random r) { c.size = size; }
            public void forceViolate(Card c, Random r) {
                List<String> others = SIZES.stream().filter(s -> !s.equals(size)).toList();
                c.size = others.get(r.nextInt(others.size()));
            }
        };
    }

    private Clause countParityClause(boolean requireEven) {
        return new Clause() {
            public Set<Field> fields() { return EnumSet.of(Field.COUNT); }
            public boolean test(Card c) { return (c.count % 2 == 0) == requireEven; }
            public void forceSatisfy(Card c, Random r) {
                if ((c.count % 2 == 0) != requireEven) c.count = Math.max(1, c.count + 1);
            }
            public void forceViolate(Card c, Random r) {
                if ((c.count % 2 == 0) == requireEven) c.count = Math.max(1, c.count + 1);
            }
        };
    }

    private Clause countAtLeastClause(int threshold, int maxCount) {
        return new Clause() {
            public Set<Field> fields() { return EnumSet.of(Field.COUNT); }
            public boolean test(Card c) { return c.count >= threshold; }
            public void forceSatisfy(Card c, Random r) { c.count = Math.max(c.count, threshold); }
            public void forceViolate(Card c, Random r) { c.count = Math.min(threshold - 1, maxCount); }
        };
    }

    /** "The count always equals the shape's number of sides" - a shape<->count relationship. */
    private Clause shapeSidesEqualCountClause(List<String> shapes, int maxCount) {
        return new Clause() {
            public Set<Field> fields() { return EnumSet.of(Field.SHAPE, Field.COUNT); }
            public boolean test(Card c) { return c.count == SHAPE_SIDES.getOrDefault(c.shape, -1); }
            public void forceSatisfy(Card c, Random r) {
                c.count = Math.min(maxCount, SHAPE_SIDES.getOrDefault(c.shape, 3));
            }
            public void forceViolate(Card c, Random r) {
                int sides = SHAPE_SIDES.getOrDefault(c.shape, 3);
                c.count = sides + 1 > maxCount ? Math.max(1, sides - 1) : sides + 1;
            }
        };
    }

    /** "If the fill is X, the count must be even/odd" - a fill<->count relationship. */
    private Clause fillImpliesCountParityClause(String fill, boolean requireEven, int maxCount) {
        return new Clause() {
            public Set<Field> fields() { return EnumSet.of(Field.FILL, Field.COUNT); }
            public boolean test(Card c) {
                if (!c.fill.equals(fill)) return true; // vacuously true when the fill doesn't apply
                return (c.count % 2 == 0) == requireEven;
            }
            public void forceSatisfy(Card c, Random r) {
                if (c.fill.equals(fill) && (c.count % 2 == 0) != requireEven) {
                    c.count = Math.min(maxCount, Math.max(1, c.count + 1));
                }
            }
            public void forceViolate(Card c, Random r) {
                c.fill = fill;
                if ((c.count % 2 == 0) == requireEven) c.count = Math.min(maxCount, Math.max(1, c.count + 1));
            }
        };
    }

    /** "Every X shape is colored Y" - a shape<->color relationship (Section 4's "hidden
     *  relationship between examples"). */
    private Clause shapeImpliesColorClause(String shape, String color) {
        return new Clause() {
            public Set<Field> fields() { return EnumSet.of(Field.SHAPE, Field.COLOR); }
            public boolean test(Card c) {
                if (!c.shape.equals(shape)) return true;
                return c.color.equals(color);
            }
            public void forceSatisfy(Card c, Random r) {
                if (c.shape.equals(shape)) c.color = color;
            }
            public void forceViolate(Card c, Random r) {
                c.shape = shape;
                List<String> others = COLORS.stream().filter(col -> !col.equals(color)).toList();
                c.color = others.get(r.nextInt(others.size()));
            }
        };
    }

    // ------------------------------------------------------------------------ card builders --

    private Card randomCard(List<String> shapes, List<String> fills, int maxCount, Random random) {
        Card c = new Card();
        c.shape = shapes.get(random.nextInt(shapes.size()));
        c.fill = fills.get(random.nextInt(fills.size()));
        c.color = COLORS.get(random.nextInt(COLORS.size()));
        c.size = SIZES.get(random.nextInt(SIZES.size()));
        c.count = 1 + random.nextInt(maxCount);
        return c;
    }

    /** Builds a card that satisfies every clause. Clauses in a rule have disjoint fields, so
     *  applying forceSatisfy for each in turn can never undo an earlier one - this is what makes
     *  the whole generator constructive rather than a rejection-sampling loop. */
    private Card buildSatisfying(List<Clause> rule, List<String> shapes, List<String> fills,
                                  int maxCount, Random random) {
        Card c = randomCard(shapes, fills, maxCount, random);
        for (Clause clause : rule) clause.forceSatisfy(c, random);
        return c;
    }

    /** Builds a card that satisfies every clause EXCEPT one randomly chosen one, which it
     *  deliberately violates - a distractor that differs from a valid card in exactly one
     *  dimension ("highly similar distractors", Section 4 Level 8). */
    private Card buildViolating(List<Clause> rule, List<String> shapes, List<String> fills,
                                 int maxCount, Random random) {
        Card c = buildSatisfying(rule, shapes, fills, maxCount, random);
        Clause toBreak = rule.get(random.nextInt(rule.size()));
        toBreak.forceViolate(c, random);
        return c;
    }
}
