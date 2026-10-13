package com.placement.judge.runtime;

import java.util.*;

public final class ListSerializer {
    private ListSerializer() { }
    public static List<Integer> toList(ListNode head) { List<Integer> values = new ArrayList<>(); for (ListNode node = head; node != null; node = node.next) values.add(node.val); return values; }
}
