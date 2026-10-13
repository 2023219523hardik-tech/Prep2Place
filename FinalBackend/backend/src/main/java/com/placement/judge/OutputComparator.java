package com.placement.judge;

import com.placement.judge.runtime.OutputSerializer;
import java.math.BigDecimal;

public final class OutputComparator {
    private OutputComparator() { }
    public static boolean matches(Object actual, String expected) {
        String left = canonical(OutputSerializer.serialize(actual)); String right = canonical(expected);
        if (left.equals(right)) return true;
        try { return new BigDecimal(left).subtract(new BigDecimal(right)).abs().compareTo(new BigDecimal("0.000001")) <= 0; }
        catch (NumberFormatException ignored) { return false; }
    }
    public static boolean matchesText(String actual, String expected) { return canonical(actual).equals(canonical(expected)); }
    private static String canonical(String value) { return value == null ? "" : value.trim().replaceAll("\\s+", "").replace("\"", ""); }
}
