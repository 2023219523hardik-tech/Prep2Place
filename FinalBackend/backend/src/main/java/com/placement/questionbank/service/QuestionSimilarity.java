package com.placement.questionbank.service;

import java.util.*;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Deterministic, dependency-free similarity utilities for cross-source deduplication.
 * Combines normalized-title equality/edit-distance with topic/tag set overlap to produce a single
 * 0.0-1.0 confidence score, per the "deterministic normalization + semantic similarity where
 * required" requirement. No ML/embedding model is used here (nothing requiring network/model
 * downloads); this is intentionally a transparent, explainable scoring function - every score can
 * be traced back to which signal drove it, which matters for the admin review queue.
 */
public final class QuestionSimilarity {

    private static final Pattern NON_ALNUM = Pattern.compile("[^a-z0-9 ]");
    private static final Pattern MULTI_SPACE = Pattern.compile(" +");
    private static final Set<String> STOPWORDS = Set.of(
            "the", "a", "an", "of", "in", "on", "problem", "question", "leetcode", "gfg",
            "hackerrank", "tuf", "geeksforgeeks", "sheet", "practice", "set", "part", "and", "to"
    );

    private QuestionSimilarity() {}

    /** Lowercase, strip punctuation, drop stopwords, collapse whitespace, sort tokens - used as the
     *  dedup lookup key so trivial reordering/casing differences don't create false-new entries. */
    public static String normalizedKey(String title) {
        if (title == null) return "";
        String cleaned = NON_ALNUM.matcher(title.toLowerCase(Locale.ROOT)).replaceAll(" ");
        cleaned = MULTI_SPACE.matcher(cleaned).replaceAll(" ").trim();
        List<String> tokens = Arrays.stream(cleaned.split(" "))
                .filter(t -> !t.isBlank() && !STOPWORDS.contains(t))
                .sorted()
                .collect(Collectors.toList());
        return String.join(" ", tokens);
    }

    /** Normalized Levenshtein similarity in [0,1], 1 = identical. */
    public static double titleEditSimilarity(String a, String b) {
        String x = normalizedKey(a);
        String y = normalizedKey(b);
        if (x.isEmpty() && y.isEmpty()) return 1.0;
        int dist = levenshtein(x, y);
        int maxLen = Math.max(x.length(), y.length());
        if (maxLen == 0) return 1.0;
        return 1.0 - ((double) dist / maxLen);
    }

    public static double jaccard(Collection<String> a, Collection<String> b) {
        Set<String> sa = a.stream().map(s -> s.toLowerCase(Locale.ROOT).trim()).collect(Collectors.toSet());
        Set<String> sb = b.stream().map(s -> s.toLowerCase(Locale.ROOT).trim()).collect(Collectors.toSet());
        if (sa.isEmpty() && sb.isEmpty()) return 0.0; // no signal, not "identical"
        Set<String> intersection = new HashSet<>(sa);
        intersection.retainAll(sb);
        Set<String> union = new HashSet<>(sa);
        union.addAll(sb);
        return union.isEmpty() ? 0.0 : (double) intersection.size() / union.size();
    }

    /**
     * Combined confidence score: title similarity dominates (0.65 weight), topic/tag overlap adds
     * corroborating signal (0.35 weight combined). Weights are conservative on purpose - two
     * unrelated problems sharing tags like "array" should not push confidence over the auto-merge
     * threshold on tag overlap alone.
     */
    public static double combinedConfidence(String titleA, String titleB,
                                             Collection<String> topicsA, Collection<String> topicsB,
                                             Collection<String> tagsA, Collection<String> tagsB) {
        double titleSim = titleEditSimilarity(titleA, titleB);
        double topicSim = jaccard(topicsA, topicsB);
        double tagSim = jaccard(tagsA, tagsB);
        return (titleSim * 0.65) + (topicSim * 0.20) + (tagSim * 0.15);
    }

    private static int levenshtein(String a, String b) {
        int[][] dp = new int[a.length() + 1][b.length() + 1];
        for (int i = 0; i <= a.length(); i++) dp[i][0] = i;
        for (int j = 0; j <= b.length(); j++) dp[0][j] = j;
        for (int i = 1; i <= a.length(); i++) {
            for (int j = 1; j <= b.length(); j++) {
                int cost = a.charAt(i - 1) == b.charAt(j - 1) ? 0 : 1;
                dp[i][j] = Math.min(Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1), dp[i - 1][j - 1] + cost);
            }
        }
        return dp[a.length()][b.length()];
    }
}
