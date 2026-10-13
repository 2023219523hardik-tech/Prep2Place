package com.placement.service.support;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Section 12 "Language Quality Analysis": detects real, specific grammar/vocabulary issues in a
 * transcript with an example and a corrected suggestion for each - not just a single opaque
 * score. This is a deterministic, rule-based checker (regex patterns for well-known English
 * usage mistakes + structural checks), not an LLM or a licensed grammar-checking service like
 * LanguageTool - that would be a heavier, riskier dependency to add reliably in this pass. Every
 * issue returned here is a genuine match against the candidate's actual words; nothing here is
 * invented or approximated from the numeric grammar score alone.
 */
public final class LanguageQualityAnalyzer {

    private LanguageQualityAnalyzer() {}

    public record LanguageIssue(String category, String example, String issue, String suggestion) {}

    private record Rule(Pattern pattern, String category, String issue, java.util.function.Function<Matcher, String> suggest) {}

    private static final List<Rule> RULES = List.of(
            new Rule(Pattern.compile("\\bcould of\\b", Pattern.CASE_INSENSITIVE), "Grammar",
                    "\"could of\" is a common mishearing of \"could have\"", m -> "could have"),
            new Rule(Pattern.compile("\\bshould of\\b", Pattern.CASE_INSENSITIVE), "Grammar",
                    "\"should of\" is a common mishearing of \"should have\"", m -> "should have"),
            new Rule(Pattern.compile("\\bwould of\\b", Pattern.CASE_INSENSITIVE), "Grammar",
                    "\"would of\" is a common mishearing of \"would have\"", m -> "would have"),
            new Rule(Pattern.compile("\\b(he|she|it)\\s+don't\\b", Pattern.CASE_INSENSITIVE), "Grammar",
                    "subject-verb agreement: singular subjects take \"doesn't\"", m -> m.group(1) + " doesn't"),
            new Rule(Pattern.compile("\\b(I|we|you|they)\\s+doesn't\\b", Pattern.CASE_INSENSITIVE), "Grammar",
                    "subject-verb agreement: plural/first/second-person subjects take \"don't\"", m -> m.group(1) + " don't"),
            new Rule(Pattern.compile("\\bI is\\b"), "Grammar",
                    "subject-verb agreement", m -> "I am"),
            new Rule(Pattern.compile("\\b(he|she|it)\\s+are\\b", Pattern.CASE_INSENSITIVE), "Grammar",
                    "subject-verb agreement: singular subjects take \"is\"", m -> m.group(1) + " is"),
            new Rule(Pattern.compile("\\bdon't have no\\b|\\bdidn't have no\\b|\\bcan't get no\\b", Pattern.CASE_INSENSITIVE), "Grammar",
                    "double negative", m -> m.group().replaceFirst("(?i)no", "any")),
            new Rule(Pattern.compile("\\b(a)\\s+([aeiouAEIOU]\\w*)\\b"), "Grammar",
                    "use \"an\" before a vowel sound", m -> "an " + m.group(2))
    );

    private static final int MAX_ISSUES_PER_ANSWER = 5;

    public static List<LanguageIssue> analyze(String text) {
        List<LanguageIssue> issues = new ArrayList<>();
        if (text == null || text.isBlank()) return issues;
        String trimmed = text.trim();

        if (!Character.isUpperCase(trimmed.charAt(0))) {
            issues.add(new LanguageIssue("Capitalization", firstWords(trimmed, 6),
                    "Sentence doesn't start with a capital letter",
                    Character.toUpperCase(trimmed.charAt(0)) + trimmed.substring(1, Math.min(trimmed.length(), 40))));
        }
        if (!trimmed.matches(".*[.!?]$")) {
            issues.add(new LanguageIssue("Punctuation", lastWords(trimmed, 6),
                    "Answer doesn't end with terminal punctuation (. ! ?)",
                    lastWords(trimmed, 6) + "."));
        }

        // Immediate word repetition ("the the", "is is") - a real, common speech-to-text and
        // typing artifact, not a fabricated example.
        Matcher repeat = Pattern.compile("\\b(\\w+)\\s+\\1\\b", Pattern.CASE_INSENSITIVE).matcher(trimmed);
        while (repeat.find() && issues.size() < MAX_ISSUES_PER_ANSWER) {
            issues.add(new LanguageIssue("Repetition", repeat.group(), "Word repeated immediately", repeat.group(1)));
        }

        for (Rule rule : RULES) {
            if (issues.size() >= MAX_ISSUES_PER_ANSWER) break;
            Matcher m = rule.pattern().matcher(trimmed);
            if (m.find()) {
                issues.add(new LanguageIssue(rule.category(), m.group(), rule.issue(), rule.suggest().apply(m)));
            }
        }
        return issues;
    }

    private static String firstWords(String text, int n) {
        String[] words = text.split("\\s+");
        return String.join(" ", java.util.Arrays.copyOfRange(words, 0, Math.min(n, words.length))) + (words.length > n ? "…" : "");
    }

    private static String lastWords(String text, int n) {
        String[] words = text.split("\\s+");
        int start = Math.max(0, words.length - n);
        return (start > 0 ? "…" : "") + String.join(" ", java.util.Arrays.copyOfRange(words, start, words.length));
    }
}
