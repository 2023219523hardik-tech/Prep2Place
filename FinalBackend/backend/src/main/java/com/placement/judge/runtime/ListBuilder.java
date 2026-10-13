package com.placement.judge.runtime;

public final class ListBuilder {
    private ListBuilder() { }
    public static ListNode fromArray(int[] values) { ListNode head = null, tail = null; for (int value : values) { ListNode node = new ListNode(value); if (head == null) head = node; else tail.next = node; tail = node; } return head; }
}
