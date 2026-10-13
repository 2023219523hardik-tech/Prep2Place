package com.placement.judge.runtime;

import java.util.*;

public final class TreeSerializer {
    private TreeSerializer() { }
    public static List<Integer> levelOrder(TreeNode root) {
        if (root == null) return List.of();
        List<Integer> result = new ArrayList<>(); Queue<TreeNode> queue = new LinkedList<>(); queue.add(root);
        while (!queue.isEmpty()) { TreeNode node = queue.remove(); if (node == null) { result.add(null); continue; } result.add(node.val); queue.add(node.left); queue.add(node.right); }
        while (!result.isEmpty() && result.get(result.size() - 1) == null) result.remove(result.size() - 1);
        return result;
    }
}
