package com.placement.service;

import com.placement.entity.ParameterSpec;

import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Parses one test case's raw input string (e.g. {@code "[2,7,11,15], target=9"}) into a list of
 * typed Java values, one per {@link ParameterSpec}, in declaration order.
 *
 * <p><b>Why this exists.</b> Before this class, each language's harness in
 * {@link CodingRunnerService} tried to parse the raw input string itself at runtime
 * (Java's bracket-only {@code InputParser}, Python's {@code ast.literal_eval}, JS's
 * {@code JSON.parse}) and only ever produced a single positional argument. That breaks for every
 * multi-parameter problem DataLoader seeds - e.g. "Two Sum"'s {@code "[2,7,11,15], target=9"} needs
 * two arguments (an {@code int[]} and an {@code int}), not one. Parsing happens exactly once, here,
 * in Java, before any per-language source is generated - each language's harness generator then
 * only has to emit a source-code literal for an already-correctly-typed value, not parse text at
 * runtime. That also means a C++ harness needs no runtime parsing at all, which is what made a real
 * C++ METHOD-mode harness tractable in the first place.
 *
 * <p><b>Input format actually used by DataLoader's seed data</b> (verified against every
 * {@code CodingProblem} it seeds): top-level comma-separated segments, where each segment is either
 * <ul>
 *   <li>positional - a bare literal ({@code [2,7,11,15]}, {@code "abcde"}, {@code 9}, {@code true})
 *       matched to the next not-yet-filled parameter in declaration order, or</li>
 *   <li>named - {@code name=value} (e.g. {@code target=9}), matched to the parameter with that
 *       name regardless of position.</li>
 * </ul>
 * A problem can mix both (e.g. {@code "[1,2,3,4,5], n=2"} - positional {@code head}, named
 * {@code n}).
 *
 * <p><b>What this deliberately refuses to guess.</b> Some of DataLoader's seeded sample inputs
 * don't actually fit the "one input string maps onto this method's parameters" model at all:
 * <ul>
 *   <li>{@code graphnode} - cycle-safe graph construction/serialization is a materially different,
 *       harder problem than everything else here; unsupported, reported clearly rather than
 *       attempted.</li>
 *   <li>"Min Stack"'s {@code "push -2, push 0, push -3, getMin"} describes a sequence of operations
 *       against a single {@code int[] pushValues} parameter - not a value that parses into an
 *       {@code int[]} at all.</li>
 *   <li>"Linked List Cycle"'s {@code "head = [3,2,0,-4], pos=1"} has a {@code pos} segment with no
 *       corresponding parameter on {@code hasCycle(ListNode head)} - there's no way to use it to
 *       actually wire up a cycle through this parameter list.</li>
 *   <li>"Merge Intervals" and "Rotate Image"'s sample inputs are simply missing their closing
 *       {@code ]} (a one-character typo in DataLoader) - bracket-balance checking below catches
 *       this as malformed rather than mis-parsing a truncated array.</li>
 * </ul>
 * All four fail with a specific, actionable {@link ParseResult#error()} instead of silently
 * producing a wrong value - see {@code TestInputValueParserTest} for exactly what each produces.
 */
public final class TestInputValueParser {

    private TestInputValueParser() {}

    /** Types no emitter in {@link CodingRunnerService} knows how to construct/serialize yet. */
    private static final Set<String> UNSUPPORTED_TYPES = Set.of("graphnode", "listnode[]", "char[][]", "char grid");

    private static final Pattern NAMED_SEGMENT = Pattern.compile("^([A-Za-z_][A-Za-z0-9_]*)\\s*=\\s*(.*)$", Pattern.DOTALL);

    public record ParseResult(List<Object> values, String error) {
        static ParseResult ok(List<Object> values) { return new ParseResult(values, null); }
        static ParseResult fail(String error) { return new ParseResult(null, error); }
        public boolean isOk() { return error == null; }
    }

    public static ParseResult parse(List<ParameterSpec> params, String rawInput) {
        List<ParameterSpec> parameters = params == null ? List.of() : params;

        for (ParameterSpec p : parameters) {
            String type = p.type() == null ? "" : p.type().toLowerCase(Locale.ROOT);
            if (UNSUPPORTED_TYPES.contains(type)) {
                return ParseResult.fail("Parameter '" + p.name() + "' has type '" + p.type()
                        + "', which this runner does not support constructing test input for yet.");
            }
        }

        if (parameters.isEmpty()) {
            return ParseResult.ok(List.of());
        }

        String input = rawInput == null ? "" : rawInput.trim();
        List<String> segments = splitTopLevel(input, ',');

        Set<String> paramNamesLower = new HashSet<>();
        for (ParameterSpec p : parameters) paramNamesLower.add(p.name().toLowerCase(Locale.ROOT));

        Map<String, String> named = new LinkedHashMap<>();
        Deque<String> positional = new ArrayDeque<>();

        for (String rawSegment : segments) {
            String segment = rawSegment.trim();
            if (segment.isEmpty()) continue;
            Matcher m = NAMED_SEGMENT.matcher(segment);
            if (m.matches() && paramNamesLower.contains(m.group(1).toLowerCase(Locale.ROOT))) {
                named.put(m.group(1).toLowerCase(Locale.ROOT), m.group(2).trim());
            } else {
                positional.add(segment);
            }
        }

        List<Object> values = new ArrayList<>();
        for (ParameterSpec p : parameters) {
            String key = p.name().toLowerCase(Locale.ROOT);
            String raw;
            if (named.containsKey(key)) {
                raw = named.remove(key);
            } else if (!positional.isEmpty()) {
                raw = positional.poll();
            } else {
                return ParseResult.fail("Missing test-input value for parameter '" + p.name() + "'.");
            }
            try {
                values.add(parseValue(raw, p.type()));
            } catch (Exception e) {
                return ParseResult.fail("Could not parse parameter '" + p.name() + "' (declared type '"
                        + p.type() + "') from '" + raw + "': " + e.getMessage());
            }
        }

        if (!positional.isEmpty() || !named.isEmpty()) {
            List<String> leftover = new ArrayList<>(positional);
            named.forEach((k, v) -> leftover.add(k + "=" + v));
            return ParseResult.fail("Test input has extra value(s) that don't match this problem's parameters: "
                    + String.join(", ", leftover));
        }

        return ParseResult.ok(values);
    }

    private static Object parseValue(String raw, String type) {
        String t = type == null ? "" : type.toLowerCase(Locale.ROOT);
        String v = raw.trim();
        return switch (t) {
            case "int", "integer", "number" -> Integer.parseInt(v);
            case "long" -> Long.parseLong(v);
            case "float", "double" -> Double.parseDouble(v);
            case "bool", "boolean" -> parseBool(v);
            case "string", "str" -> unquote(v);
            case "int[]", "int array", "array<int>" -> parseIntArray(v);
            case "int[][]", "int matrix", "array<array<int>>" -> parseIntMatrix(v);
            case "string[]" -> parseStringArray(v);
            case "list<int>" -> new ArrayList<>(Arrays.asList(toBoxed(parseIntArray(v))));
            case "list<string>" -> new ArrayList<>(Arrays.asList(parseStringArray(v)));
            case "list<list<int>>" -> toListOfLists(parseIntMatrix(v));
            case "list<list<string>>" -> parseStringMatrix(v);
            // Parsed as a flat int[] regardless of nulls - a linked list has no "missing node"
            // concept the way a tree does. Each language's harness turns this into an actual
            // ListNode chain at the call site.
            case "listnode" -> parseIntArray(v);
            // Level-order with "null" placeholders - LeetCode's standard tree serialization, and
            // exactly what DataLoader's treenode sampleInputs use (e.g. "[3,9,20,null,null,15,7]").
            case "treenode" -> parseNullableIntList(v);
            default -> throw new IllegalArgumentException("unsupported parameter type '" + type + "'");
        };
    }

    // --- scalar parsing -----------------------------------------------------------------------

    private static Boolean parseBool(String v) {
        if (v.equalsIgnoreCase("true")) return Boolean.TRUE;
        if (v.equalsIgnoreCase("false")) return Boolean.FALSE;
        throw new IllegalArgumentException("expected true/false, got '" + v + "'");
    }

    private static String unquote(String v) {
        if (v.length() >= 2) {
            char first = v.charAt(0);
            char last = v.charAt(v.length() - 1);
            if ((first == '"' && last == '"') || (first == '\'' && last == '\'')) {
                return v.substring(1, v.length() - 1);
            }
        }
        return v;
    }

    // --- array / matrix parsing ----------------------------------------------------------------

    private static int[] parseIntArray(String v) {
        String body = stripBrackets(v);
        List<String> parts = splitTopLevel(body, ',');
        int[] result = new int[parts.size()];
        for (int i = 0; i < parts.size(); i++) {
            result[i] = Integer.parseInt(parts.get(i).trim());
        }
        return result;
    }

    private static int[][] parseIntMatrix(String v) {
        String body = stripBrackets(v);
        List<String> rows = splitTopLevel(body, ',');
        int[][] result = new int[rows.size()][];
        for (int i = 0; i < rows.size(); i++) {
            result[i] = parseIntArray(rows.get(i).trim());
        }
        return result;
    }

    private static String[] parseStringArray(String v) {
        String body = stripBrackets(v);
        List<String> parts = splitTopLevel(body, ',');
        String[] result = new String[parts.size()];
        for (int i = 0; i < parts.size(); i++) {
            result[i] = unquote(parts.get(i).trim());
        }
        return result;
    }

    @SuppressWarnings("unchecked")
    private static List<List<String>> parseStringMatrix(String v) {
        String body = stripBrackets(v);
        List<String> rows = splitTopLevel(body, ',');
        List<List<String>> result = new ArrayList<>();
        for (String row : rows) {
            result.add(new ArrayList<>(Arrays.asList(parseStringArray(row.trim()))));
        }
        return result;
    }

    private static List<List<Integer>> toListOfLists(int[][] matrix) {
        List<List<Integer>> result = new ArrayList<>();
        for (int[] row : matrix) {
            List<Integer> r = new ArrayList<>();
            for (int x : row) r.add(x);
            result.add(r);
        }
        return result;
    }

    private static Integer[] toBoxed(int[] arr) {
        Integer[] out = new Integer[arr.length];
        for (int i = 0; i < arr.length; i++) out[i] = arr[i];
        return out;
    }

    /** LeetCode-style level-order tree array: {@code [3,9,20,null,null,15,7]}. "null" (any case)
     *  becomes a null element - boxed Integer supports that directly. */
    private static List<Integer> parseNullableIntList(String v) {
        String body = stripBrackets(v);
        List<String> parts = splitTopLevel(body, ',');
        List<Integer> result = new ArrayList<>();
        for (String part : parts) {
            String p = part.trim();
            result.add(p.equalsIgnoreCase("null") ? null : Integer.parseInt(p));
        }
        return result;
    }

    /** Strips one layer of {@code [...]}, first verifying the brackets in the WHOLE string are
     *  balanced (not just that it starts with "[" and ends with "]" - a truncated
     *  {@code "[[1,3],[2,6],[8,10],[15,18]"} still ends with "]" from its last inner array, but is
     *  missing its outer close). Catches the exact typo in DataLoader's "Merge Intervals" and
     *  "Rotate Image" sample inputs instead of silently mis-parsing them. */
    private static String stripBrackets(String v) {
        if (!v.startsWith("[") || !v.endsWith("]")) {
            throw new IllegalArgumentException("expected a bracketed value like '[1,2,3]', got '" + v + "'");
        }
        int depth = 0;
        for (int i = 0; i < v.length(); i++) {
            char c = v.charAt(i);
            if (c == '[') depth++;
            else if (c == ']') {
                depth--;
                if (depth < 0) {
                    throw new IllegalArgumentException("unbalanced brackets (unexpected ']' at position " + i + ")");
                }
            }
        }
        if (depth != 0) {
            throw new IllegalArgumentException("unbalanced brackets (missing " + depth + " closing ']')");
        }
        return v.substring(1, v.length() - 1).trim();
    }

    /** Splits on {@code delimiter} only at nesting depth 0, so {@code "[1,2],[3,4]"} splits into
     *  two segments instead of four, and quoted strings containing the delimiter are never split. */
    static List<String> splitTopLevel(String s, char delimiter) {
        List<String> parts = new ArrayList<>();
        if (s.isEmpty()) return parts;

        int depth = 0;
        boolean inQuotes = false;
        char quoteChar = 0;
        StringBuilder current = new StringBuilder();

        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);

            if (inQuotes) {
                current.append(c);
                if (c == quoteChar) inQuotes = false;
                continue;
            }

            if (c == '"' || c == '\'') {
                inQuotes = true;
                quoteChar = c;
                current.append(c);
                continue;
            }

            if (c == '[' || c == '(') {
                depth++;
                current.append(c);
                continue;
            }

            if (c == ']' || c == ')') {
                depth--;
                current.append(c);
                continue;
            }

            if (c == delimiter && depth == 0) {
                parts.add(current.toString());
                current.setLength(0);
                continue;
            }

            current.append(c);
        }

        parts.add(current.toString());
        return parts;
    }
}
