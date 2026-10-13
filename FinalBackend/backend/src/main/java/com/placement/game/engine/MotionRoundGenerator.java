package com.placement.game.engine;

import com.placement.game.entity.GameType;
import org.springframework.stereotype.Component;

import java.util.*;

/**
 * Motion Challenge (spec Section 6). The previous implementation simulated continuous physics on
 * a tiny fixed-size field with no rendered board at all, which is exactly the "board/object is too
 * small" problem called out in the spec. This version generates an explicit, discrete keyframe
 * path per object on an N x N grid - {@code meta.objects[i].path} is a list of {row, col} cells
 * the object visits, in order - so the frontend can animate a large, clearly visible board and
 * then freeze it, hiding all objects, and ask where the tracked object ended up.
 *
 * <p>Level scaling: field size, object count, per-object speed variation, and mid-path direction
 * changes all increase with level; {@code observationWindowMs} (how long the animation plays
 * before freezing) shrinks at higher levels, matching "short observation window" at Level 8.
 */
@Component
public class MotionRoundGenerator implements RoundGenerator {

    private static final List<String> COLORS =
            List.of("RED", "BLUE", "GREEN", "PURPLE", "ORANGE", "TEAL");
    private static final int[][] DIRECTIONS = {{0, 1}, {0, -1}, {1, 0}, {-1, 0}};

    private record Point(int row, int col) {
        Map<String, Object> toMap() {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("row", row);
            m.put("col", col);
            return m;
        }
    }

    @Override
    public GameType supports() {
        return GameType.MOTION;
    }

    @Override
    public Map<String, Object> generateRound(int roundIndex, int level, Map<String, Object> gameConfig,
                                              int roundDurationSeconds, Random random) {
        int fieldSize = fieldSizeForLevel(level);
        int objectCount = objectCountForLevel(level);
        boolean directionChanges = level >= 5;
        boolean varySpeed = level >= 4;
        int pathLength = Math.min(10, 4 + GameEngineUtil.levelFactor(level));
        int observationWindowMs = Math.max(1500, 4500 - GameEngineUtil.levelFactor(level) * 400);

        List<String> colors = GameEngineUtil.shuffled(COLORS, random);
        List<Map<String, Object>> objects = new ArrayList<>();
        List<Point> finalPositions = new ArrayList<>();
        int targetIndex = random.nextInt(objectCount);
        String targetId = null;

        Set<String> occupiedStarts = new HashSet<>();
        for (int i = 0; i < objectCount; i++) {
            List<Point> path = buildPath(fieldSize, pathLength, directionChanges, occupiedStarts, random);
            String id = "obj_" + i;
            if (i == targetIndex) targetId = id;
            int stepIntervalMs = varySpeed ? (300 + random.nextInt(4) * 60) : 420;

            Map<String, Object> obj = new LinkedHashMap<>();
            obj.put("id", id);
            obj.put("color", colors.get(i % colors.size()));
            obj.put("path", path.stream().map(Point::toMap).toList());
            obj.put("stepIntervalMs", stepIntervalMs);
            objects.add(obj);
            finalPositions.add(path.get(path.size() - 1));
        }

        Point correctPosition = finalPositions.get(targetIndex);
        Set<String> usedPositions = new HashSet<>();
        usedPositions.add(correctPosition.row() + "," + correctPosition.col());
        List<Point> distractorPositions = new ArrayList<>();
        int guard = 0;
        while (distractorPositions.size() < 3 && guard++ < 300) {
            int r = random.nextInt(fieldSize);
            int c = random.nextInt(fieldSize);
            String key = r + "," + c;
            if (usedPositions.add(key)) distractorPositions.add(new Point(r, c));
        }
        while (distractorPositions.size() < 3) {
            distractorPositions.add(new Point(random.nextInt(fieldSize), random.nextInt(fieldSize)));
        }

        List<Point> allOptions = new ArrayList<>();
        allOptions.add(correctPosition);
        allOptions.addAll(distractorPositions);
        List<Point> shuffledOptions = GameEngineUtil.shuffled(allOptions, random);

        List<Map<String, Object>> options = new ArrayList<>();
        String correctOptionId = null;
        for (int i = 0; i < shuffledOptions.size(); i++) {
            String optId = "opt_" + i;
            options.add(GameEngineUtil.option(optId, shuffledOptions.get(i).toMap()));
            if (shuffledOptions.get(i).equals(correctPosition) && correctOptionId == null) {
                correctOptionId = optId;
            }
        }

        Map<String, Object> meta = new LinkedHashMap<>();
        meta.put("fieldSize", fieldSize);
        meta.put("objects", objects);
        meta.put("targetObjectId", targetId);
        meta.put("observationWindowMs", observationWindowMs);

        int timeLimit = Math.max(10, roundDurationSeconds - GameEngineUtil.levelFactor(level));
        String prompt = objectCount > 1
                ? "Watch the highlighted object. When the board freezes, pick the cell it ended up in."
                : "Watch the object move. When the board freezes, pick the cell it ended up in.";
        return GameEngineUtil.baseRound(roundIndex, prompt, meta, options, correctOptionId, timeLimit, level);
    }

    private int fieldSizeForLevel(int level) {
        if (level <= 3) return 6;
        if (level <= 6) return 8;
        return 10;
    }

    private int objectCountForLevel(int level) {
        return switch (level) {
            case 1 -> 1;
            case 2 -> 2;
            case 3, 4, 5 -> 3;
            case 6, 7 -> 4;
            default -> 5;
        };
    }

    private List<Point> buildPath(int fieldSize, int steps, boolean directionChanges,
                                   Set<String> occupiedStarts, Random random) {
        int row, col;
        int guard = 0;
        do {
            row = random.nextInt(fieldSize);
            col = random.nextInt(fieldSize);
            guard++;
        } while (occupiedStarts.contains(row + "," + col) && guard < 50);
        occupiedStarts.add(row + "," + col);

        List<Point> path = new ArrayList<>();
        path.add(new Point(row, col));

        int[] dir = DIRECTIONS[random.nextInt(DIRECTIONS.length)];
        int dr = dir[0], dc = dir[1];
        for (int i = 0; i < steps; i++) {
            if (directionChanges && random.nextDouble() < 0.3) {
                int[] newDir = DIRECTIONS[random.nextInt(DIRECTIONS.length)];
                dr = newDir[0];
                dc = newDir[1];
            }
            int nr = row + dr;
            int nc = col + dc;
            if (nr < 0 || nr >= fieldSize) {
                dr = -dr;
                nr = row + dr;
            }
            if (nc < 0 || nc >= fieldSize) {
                dc = -dc;
                nc = col + dc;
            }
            nr = Math.max(0, Math.min(fieldSize - 1, nr));
            nc = Math.max(0, Math.min(fieldSize - 1, nc));
            row = nr;
            col = nc;
            path.add(new Point(row, col));
        }
        return path;
    }
}
