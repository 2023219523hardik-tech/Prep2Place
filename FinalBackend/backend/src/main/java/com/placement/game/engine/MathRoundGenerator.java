package com.placement.game.engine;

import com.placement.game.entity.GameType;
import org.springframework.stereotype.Component;

import java.util.*;

/**
 * Math Challenge (spec Section 9 - new game). The student sees a set of unevaluated arithmetic
 * expressions as circular buttons and must click them in descending order of their computed
 * value. This is an {@code ORDERED_SEQUENCE} round: every option must be submitted, in the exact
 * order the student clicked them.
 *
 * <p>Security note (spec: "the frontend must NOT receive a field explicitly saying
 * correctOrder"): the computed value of each expression exists only inside this generator, used
 * once to sort {@code correctOptionIds} into the true descending order. It is never written into
 * {@code options} (which only ever carries the expression's display label) or into any other part
 * of the round that survives {@code GameEngineService#publicRound}.
 */
@Component
public class MathRoundGenerator implements RoundGenerator {

    private record Expr(String label, double value) {}

    private interface Template {
        Expr generate(Random random);
    }

    @Override
    public GameType supports() {
        return GameType.MATH;
    }

    @Override
    public Map<String, Object> generateRound(int roundIndex, int level, Map<String, Object> gameConfig,
                                              int roundDurationSeconds, Random random) {
        int count = countForLevel(level);
        List<Template> pool = poolForLevel(level);

        List<Expr> exprs = new ArrayList<>();
        Set<String> seenValues = new HashSet<>();
        int guard = 0;
        while (exprs.size() < count && guard++ < 500) {
            Template t = pool.get(random.nextInt(pool.size()));
            Expr e = t.generate(random);
            if (seenValues.add(String.format(Locale.ROOT, "%.4f", e.value()))) exprs.add(e);
        }
        // Extremely unlikely fallback: pad with a trivially distinct, self-consistent expression
        // rather than risk any label/value mismatch.
        while (exprs.size() < count) {
            int bump = 1000 + exprs.size();
            exprs.add(new Expr(bump + " + 0", bump));
        }

        List<Expr> displayOrder = GameEngineUtil.shuffled(exprs, random);
        List<String> ids = new ArrayList<>();
        for (int i = 0; i < displayOrder.size(); i++) ids.add("opt_" + i);

        List<Map<String, Object>> options = new ArrayList<>();
        for (int i = 0; i < displayOrder.size(); i++) {
            options.add(GameEngineUtil.option(ids.get(i), displayOrder.get(i).label()));
        }

        List<Expr> sortedDescending = new ArrayList<>(exprs);
        sortedDescending.sort((a, b) -> Double.compare(b.value(), a.value()));
        List<String> correctOrder = new ArrayList<>();
        for (Expr e : sortedDescending) {
            correctOrder.add(ids.get(displayOrder.indexOf(e)));
        }

        Map<String, Object> meta = new LinkedHashMap<>();
        meta.put("instruction", "HIGH_TO_LOW");
        meta.put("expressionCount", count);

        int timeLimit = Math.max(8, roundDurationSeconds - GameEngineUtil.levelFactor(level) * 3);
        return GameEngineUtil.multiRound(roundIndex, "Click circles from HIGH to LOW.", meta, options,
                correctOrder, "ORDERED_SEQUENCE", count, timeLimit, level);
    }

    private int countForLevel(int level) {
        if (level <= 2) return 3;
        if (level <= 4) return 4;
        if (level <= 6) return 5;
        return 6;
    }

    // ------------------------------------------------------------------------------- pools --

    private List<Template> poolForLevel(int level) {
        List<Template> pool = new ArrayList<>();
        if (level == 1) {
            pool.add(r -> additionExpr(1, 50, r));
            pool.add(r -> subtractionExpr(1, 50, r));
            return pool;
        }
        if (level == 2) {
            pool.add(r -> additionExpr(50, 500, r));
            pool.add(r -> subtractionExpr(50, 500, r));
            return pool;
        }
        if (level == 3) {
            pool.add(r -> multiplicationExpr(2, 20, r));
            pool.add(r -> divisionExpr(2, 50, 2, 20, r));
            return pool;
        }
        // Level 4+: cumulative pool, mixing every operator learned so far.
        pool.add(r -> additionExpr(20, 400, r));
        pool.add(r -> subtractionAllowNegativeExpr(20, 400, r));
        pool.add(r -> multiplicationExpr(2, 25, r));
        pool.add(r -> divisionExpr(2, 60, 2, 20, r));
        if (level >= 5) pool.add(r -> twoStepExpr(10, 100, r));
        if (level >= 6) pool.add(r -> divisionDecimalExpr(20, 900, r));
        if (level >= 7) {
            pool.add(this::percentageExpr);
            pool.add(this::powerExpr);
        }
        if (level >= 8) pool.add(this::powerMinusExpr);
        return pool;
    }

    // -------------------------------------------------------------------------- templates --

    private Expr additionExpr(int min, int max, Random r) {
        int a = min + r.nextInt(max - min + 1);
        int b = min + r.nextInt(max - min + 1);
        return new Expr(a + " + " + b, a + b);
    }

    /** Subtraction kept non-negative for the early, gentle levels. */
    private Expr subtractionExpr(int min, int max, Random r) {
        int a = min + r.nextInt(max - min + 1);
        int b = min + r.nextInt(max - min + 1);
        if (b > a) { int tmp = a; a = b; b = tmp; }
        return new Expr(a + " - " + b, a - b);
    }

    private Expr subtractionAllowNegativeExpr(int min, int max, Random r) {
        int a = min + r.nextInt(max - min + 1);
        int b = min + r.nextInt(max - min + 1);
        return new Expr(a + " - " + b, a - b);
    }

    private Expr multiplicationExpr(int minFactor, int maxFactor, Random r) {
        int a = minFactor + r.nextInt(maxFactor - minFactor + 1);
        int b = minFactor + r.nextInt(maxFactor - minFactor + 1);
        return new Expr(a + " \u00d7 " + b, (double) (a * b));
    }

    /** Divisor always divides the dividend exactly, so the result is a clean integer. */
    private Expr divisionExpr(int quotientMin, int quotientMax, int divisorMin, int divisorMax, Random r) {
        int divisor = divisorMin + r.nextInt(divisorMax - divisorMin + 1);
        int quotient = quotientMin + r.nextInt(quotientMax - quotientMin + 1);
        int dividend = divisor * quotient;
        return new Expr(dividend + " \u00f7 " + divisor, quotient);
    }

    /** Divisor usually does NOT divide the dividend exactly - a real decimal result, matching
     *  "800 / 7" in the reference screenshot. */
    private Expr divisionDecimalExpr(int min, int max, Random r) {
        int a = min + r.nextInt(max - min + 1);
        int b = 2 + r.nextInt(11);
        return new Expr(a + " \u00f7 " + b, (double) a / (double) b);
    }

    /** "(a op1 b) op2 c" - a two-step expression the student must fully evaluate. */
    private Expr twoStepExpr(int min, int max, Random r) {
        String[] innerOps = {"+", "-", "\u00d7"};
        int a = min + r.nextInt(max - min + 1);
        int b = 2 + r.nextInt(12);
        String op1 = innerOps[r.nextInt(innerOps.length)];
        double inner = switch (op1) {
            case "+" -> a + b;
            case "-" -> a - b;
            default -> (double) a * b;
        };
        int c = min + r.nextInt(max - min + 1);
        boolean plus = r.nextBoolean();
        double value = plus ? inner + c : inner - c;
        String label = "(" + a + " " + op1 + " " + b + ") " + (plus ? "+" : "-") + " " + c;
        return new Expr(label, value);
    }

    private Expr percentageExpr(Random r) {
        int[] percents = {10, 15, 20, 25, 30, 40, 50, 60, 72, 75, 80, 90};
        int p = percents[r.nextInt(percents.length)];
        int base = 50 + r.nextInt(451);
        return new Expr(p + "% of " + base, p / 100.0 * base);
    }

    private Expr powerExpr(Random r) {
        int base = 3 + r.nextInt(13);
        return new Expr(base + "\u00b2", (double) (base * base));
    }

    private Expr powerMinusExpr(Random r) {
        int base = 4 + r.nextInt(12);
        int square = base * base;
        int subtract = 1 + r.nextInt(Math.max(1, square - 1));
        return new Expr(base + "\u00b2 - " + subtract, square - subtract);
    }
}
