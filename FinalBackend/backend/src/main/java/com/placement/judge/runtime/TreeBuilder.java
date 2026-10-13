package com.placement.judge.runtime;

import java.util.*;

public final class TreeBuilder {
    private TreeBuilder() { }
    public static TreeNode fromLevelOrder(List<Integer> values) {
        if (values == null || values.isEmpty() || values.get(0) == null) return null;
        TreeNode root = new TreeNode(values.get(0));
        Queue<TreeNode> queue = new ArrayDeque<>(); queue.add(root);
        for (int i = 1; !queue.isEmpty() && i < values.size();) {
            TreeNode parent = queue.remove();
            if (values.get(i) != null) { parent.left = new TreeNode(values.get(i)); queue.add(parent.left); } i++;
            if (i < values.size() && values.get(i) != null) { parent.right = new TreeNode(values.get(i)); queue.add(parent.right); } i++;
        }
        return root;
    }
}
