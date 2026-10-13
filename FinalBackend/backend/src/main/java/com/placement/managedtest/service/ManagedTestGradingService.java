package com.placement.managedtest.service;

import com.placement.managedtest.entity.*;
import org.springframework.stereotype.Service;

import java.util.*;

/**
 * Deterministic grading. Runs entirely server-side at submit time from the frozen question
 * snapshots, so a client that lies about its answers still gets graded against the real key.
 *
 * What is auto-graded and what is not:
 *   - MCQ single/multi: fully auto-graded. Multi-correct requires an exact set match (no partial
 *     credit) - partial credit needs a per-test policy this module does not yet model, and silently
 *     inventing one would misreport scores.
 *   - SQL / DataFrame: auto-graded by normalized comparison against expectedOutput when the question
 *     declares one and is not marked MANUAL. This is an output comparison, not query execution.
 *   - CODING: NOT auto-graded here. The platform already has a judge
 *     (com.placement.service.CodingRunnerService); wiring it in is a follow-up, so coding answers are
 *     recorded as PENDING_REVIEW and their marks are excluded from the auto score rather than being
 *     counted as wrong.
 */
@Service
public class ManagedTestGradingService {

    public GradedAnswer grade(ManagedTestQuestion question, ManagedTestAnswer answer) {
        if (answer == null || !answer.isAttempted()) {
            return new GradedAnswer(null, 0d, AnswerEvaluationStatus.AUTO_GRADED, "Not attempted", Outcome.UNATTEMPTED);
        }
        return switch (question.getQuestionType()) {
            case MCQ_SINGLE, MCQ_MULTI -> gradeMcq(question, answer);
            case SQL -> gradeTextOutput(question, answer, "query");
            case DATAFRAME -> gradeTextOutput(question, answer, "code");
            case CODING -> new GradedAnswer(null, 0d, AnswerEvaluationStatus.PENDING_REVIEW,
                    "Coding answers are queued for evaluation.", Outcome.PENDING);
            case DESCRIPTIVE -> new GradedAnswer(null, 0d, AnswerEvaluationStatus.PENDING_REVIEW,
                    "Descriptive answers require manual review.", Outcome.PENDING);
        };
    }

    private GradedAnswer gradeMcq(ManagedTestQuestion question, ManagedTestAnswer answer) {
        Set<String> correct = new HashSet<>(stringSet(question.getPayload().get("correctOptions")));
        Set<String> selected = new HashSet<>(stringSet(answer.getResponse().get("selectedOptions")));

        if (correct.isEmpty()) {
            return new GradedAnswer(null, 0d, AnswerEvaluationStatus.PENDING_REVIEW,
                    "No answer key stored for this question.", Outcome.PENDING);
        }
        boolean isCorrect = correct.equals(selected);
        double marks = isCorrect ? question.getMarks() : -question.getNegativeMarks();
        return new GradedAnswer(isCorrect, marks, AnswerEvaluationStatus.AUTO_GRADED,
                isCorrect ? "Correct" : "Expected " + String.join(", ", new TreeSet<>(correct)),
                isCorrect ? Outcome.CORRECT : Outcome.WRONG);
    }

    private GradedAnswer gradeTextOutput(ManagedTestQuestion question, ManagedTestAnswer answer, String responseKey) {
        Object expected = question.getPayload().get("expectedOutput");
        String evaluation = String.valueOf(question.getPayload().getOrDefault("evaluation", "EXACT_ROWS"));
        if ("MANUAL".equals(evaluation) || !(expected instanceof String expectedText) || expectedText.isBlank()) {
            return new GradedAnswer(null, 0d, AnswerEvaluationStatus.PENDING_REVIEW,
                    "Queued for manual review.", Outcome.PENDING);
        }
        Object submittedRaw = answer.getResponse().get(responseKey);
        Object outputRaw = answer.getResponse().get("output");
        // Prefer a captured output if the runner produced one; otherwise compare the submission text.
        String candidate = outputRaw instanceof String s && !s.isBlank() ? s : String.valueOf(submittedRaw);

        boolean ordered = "ORDERED_ROWS".equals(evaluation);
        boolean matches = ordered
                ? normalize(candidate).equals(normalize(expectedText))
                : normalizedRows(candidate).equals(normalizedRows(expectedText));

        double marks = matches ? question.getMarks() : -question.getNegativeMarks();
        return new GradedAnswer(matches, marks, AnswerEvaluationStatus.AUTO_GRADED,
                matches ? "Output matched" : "Output did not match the expected result",
                matches ? Outcome.CORRECT : Outcome.WRONG);
    }

    private String normalize(String s) {
        return s == null ? "" : s.trim().replaceAll("\\s+", " ").toLowerCase();
    }

    /** Row-set comparison: whitespace-insensitive and order-insensitive. */
    private Set<String> normalizedRows(String s) {
        if (s == null) return Set.of();
        Set<String> rows = new TreeSet<>();
        for (String line : s.split("\\r?\\n")) {
            String normalized = normalize(line);
            if (!normalized.isEmpty()) rows.add(normalized);
        }
        return rows;
    }

    @SuppressWarnings("unchecked")
    private List<String> stringSet(Object raw) {
        if (raw instanceof Collection<?> c) return c.stream().map(String::valueOf).toList();
        if (raw instanceof String s && !s.isBlank()) return List.of(s);
        return List.of();
    }

    public enum Outcome { CORRECT, WRONG, UNATTEMPTED, PENDING }

    public record GradedAnswer(Boolean correct, double marksAwarded,
                               AnswerEvaluationStatus status, String note, Outcome outcome) {}
}
