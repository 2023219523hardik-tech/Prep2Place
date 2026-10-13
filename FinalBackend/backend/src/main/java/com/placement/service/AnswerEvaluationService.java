package com.placement.service;

import com.placement.entity.Question;
import com.placement.entity.ScoreWeightConfig;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.Arrays;
import java.util.HashSet;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Deterministic, rule-based NLP evaluator for interview / practice answers.
 * Real working logic (not a stub) — just not a trained ML model. Scores using keyword
 * overlap against admin-configured expected keywords, length/detail heuristics, and
 * basic clarity/grammar/structure heuristics. Designed as a clean seam to later swap
 * in an LLM- or embedding-based evaluator without changing calling code.
 *
 * When the Python ML microservice is reachable (see {@link PythonNlpClient}), its
 * TF-IDF-based semantic similarity score is blended in for partial credit on answers
 * that paraphrase the right concepts instead of only rewarding literal keyword matches.
 * If the service is unavailable, this silently falls back to the pure-Java heuristic below.
 */
@Service
public class AnswerEvaluationService {

    @Autowired(required = false)
    private PythonNlpClient pythonNlpClient;

    public record Evaluation(double correctness, double relevance, double depth,
                              double clarity, double grammar, double structure, String feedback) {}

    private static final Set<String> STRUCTURE_MARKERS = Set.of(
            "first", "second", "because", "therefore", "however", "for example",
            "in conclusion", "additionally", "furthermore", "next", "finally"
    );

    public Evaluation evaluate(Question question, String transcript) {
        String text = transcript == null ? "" : transcript.trim();

        if (text.isEmpty()) {
            return new Evaluation(0, 0, 0, 0, 0, 0,
                    "No answer was provided. Try to always attempt an answer, even a partial one.");
        }

        double correctness = keywordScore(question.getExpectedKeywords(), text);
        correctness = blendWithSemanticSimilarity(correctness, question.getExpectedKeywords(), text);
        double relevance = correctness;
        double depth = depthScore(text);
        double clarity = clarityScore(text);
        double grammar = grammarScore(text);
        double structure = structureScore(text);

        StringBuilder feedback = new StringBuilder();
        feedback.append(correctness < 50
                ? "Try to cover more of the key concepts expected for this question. "
                : "Good coverage of the expected concepts. ");
        if (depth < 50) feedback.append("Add more detail/examples to strengthen depth. ");
        if (structure < 50) feedback.append("Structure your answer more clearly (intro -> explanation -> example -> conclusion). ");
        if (clarity < 50) feedback.append("Use shorter, clearer sentences for better clarity. ");

        return new Evaluation(correctness, relevance, depth, clarity, grammar, structure, feedback.toString().trim());
    }

    public double weightedScoreWithConfidence(Evaluation e, double confidence, ScoreWeightConfig w) {
        double totalWeight = w.getCorrectnessWeight() + w.getClarityWeight() + w.getConfidenceWeight()
                + w.getStructureWeight() + w.getDepthWeight();
        if (totalWeight <= 0) totalWeight = 100;

        double score = (e.correctness() * w.getCorrectnessWeight()
                + e.clarity() * w.getClarityWeight()
                + confidence * w.getConfidenceWeight()
                + e.structure() * w.getStructureWeight()
                + e.depth() * w.getDepthWeight()) / totalWeight;
        return round(score);
    }

    /** Blends the local keyword-overlap score with the Python service's TF-IDF similarity
     * score when available (70/30 weighting favoring the stricter literal-keyword signal). */
    private double blendWithSemanticSimilarity(double localScore, String expectedKeywords, String text) {
        if (pythonNlpClient == null) return localScore;
        Optional<Double> semantic = pythonNlpClient.semanticSimilarity(text, expectedKeywords);
        return semantic.map(sim -> round(localScore * 0.7 + sim * 0.3)).orElse(localScore);
    }

    private double keywordScore(String expectedKeywordsCsv, String text) {
        if (expectedKeywordsCsv == null || expectedKeywordsCsv.isBlank()) return depthScore(text);
        Set<String> expected = new HashSet<>(Arrays.stream(expectedKeywordsCsv.split(","))
                .map(String::trim).map(String::toLowerCase).filter(s -> !s.isEmpty())
                .collect(Collectors.toSet()));
        if (expected.isEmpty()) return depthScore(text);

        String lower = text.toLowerCase();
        long matched = expected.stream().filter(lower::contains).count();
        return round((matched * 100.0) / expected.size());
    }

    private double depthScore(String text) {
        int words = text.split("\\s+").length;
        return round(Math.min(100, (words / 120.0) * 100));
    }

    private double clarityScore(String text) {
        String[] sentences = text.split("[.!?]+");
        int sentenceCount = Math.max(1, (int) Arrays.stream(sentences).filter(s -> !s.isBlank()).count());
        int words = text.split("\\s+").length;
        double avgWordsPerSentence = (double) words / sentenceCount;
        if (avgWordsPerSentence <= 22) return 100;
        double penalty = (avgWordsPerSentence - 22) * 3;
        return round(Math.max(30, 100 - penalty));
    }

    private double grammarScore(String text) {
        double score = 100;
        if (!text.isEmpty() && !Character.isUpperCase(text.charAt(0))) score -= 10;
        if (!text.matches(".*[.!?]$")) score -= 10;
        String[] words = text.toLowerCase().split("\\s+");
        long distinct = Arrays.stream(words).distinct().count();
        if (words.length > 0) {
            double repetitionRatio = 1 - ((double) distinct / words.length);
            if (repetitionRatio > 0.5) score -= 20;
        }
        return round(Math.max(40, score));
    }

    private double structureScore(String text) {
        String lower = text.toLowerCase();
        long markerHits = STRUCTURE_MARKERS.stream().filter(lower::contains).count();
        double fromMarkers = Math.min(70, markerHits * 20);
        double fromLength = depthScore(text) * 0.3;
        return round(Math.min(100, fromMarkers + fromLength));
    }

    private double round(double v) { return Math.round(v * 10.0) / 10.0; }
}
