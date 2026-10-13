package com.placement.judge.runtime;

import java.lang.reflect.Array;
import java.util.*;

public final class OutputSerializer {
    private OutputSerializer() { }
    public static String serialize(Object value) {
        if (value == null) return "null";
        if (value instanceof TreeNode tree) return TreeSerializer.levelOrder(tree).toString();
        if (value instanceof ListNode list) return ListSerializer.toList(list).toString();
        if (value.getClass().isArray()) { int length = Array.getLength(value); List<String> values = new ArrayList<>(); for (int i = 0; i < length; i++) values.add(serialize(Array.get(value, i))); return "[" + String.join(",", values) + "]"; }
        if (value instanceof Collection<?> collection) { List<String> values = new ArrayList<>(); for (Object item : collection) values.add(serialize(item)); return "[" + String.join(",", values) + "]"; }
        return String.valueOf(value);
    }
}
