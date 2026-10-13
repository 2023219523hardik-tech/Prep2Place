package com.placement.managedtest.service;

import com.placement.managedtest.dto.ManagedTestDtos.ValidationReport;
import com.placement.managedtest.entity.*;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Publish-time gate. Returns every problem at once rather than failing on the first, because the
 * builder UI shows them as a checklist and an admin fixing one error at a time is miserable.
 *
 * Errors block publishing; warnings do not.
 */
@Service
public class ManagedTestValidationService {

    public ValidationReport validate(ManagedTest test) {
        List<String> errors = new ArrayList<>();
        List<String> warnings = new ArrayList<>();

        if (test.getName() == null || test.getName().isBlank()) errors.add("Test name is required.");
        if (test.getTestType() == null) errors.add("Test type is required.");
        if (test.getDurationMinutes() <= 0) errors.add("Total duration must be greater than zero.");
        if (test.getPassingPercentage() < 0 || test.getPassingPercentage() > 100)
            errors.add("Passing percentage must be between 0 and 100.");
        if (test.isNegativeMarkingEnabled() && test.getDefaultNegativeMarks() < 0)
            errors.add("Negative marks cannot be negative.");
        if (test.getAttemptLimit() < 0) errors.add("Attempt limit cannot be negative.");

        if (test.getStartsAt() != null && test.getEndsAt() != null && !test.getEndsAt().isAfter(test.getStartsAt()))
            errors.add("Test end time must be after the start time.");

        if (test.getTestType() == TestType.UNIVERSITY_TEST
                && (test.getOrganizationName() == null || test.getOrganizationName().isBlank()))
            errors.add("University tests must specify a university/organization name.");

        List<ManagedTestSection> sections = test.orderedSections();
        if (sections.isEmpty()) {
            errors.add("A test must have at least one section.");
            return new ValidationReport(false, errors, warnings);
        }

        double marksTotal = 0d;
        int sectionMinutesTotal = 0;
        Set<String> bankKeys = new HashSet<>();

        for (ManagedTestSection section : sections) {
            String label = "Section \"" + section.getName() + "\"";

            if (section.getName() == null || section.getName().isBlank()) errors.add("Every section needs a name.");
            if (section.getSectionType() == null) errors.add(label + ": section type is required.");

            List<ManagedTestQuestion> questions = section.orderedQuestions();
            boolean autoFilled = section.getSelectionStrategy() == SelectionStrategy.RANDOM
                    || section.getSelectionStrategy() == SelectionStrategy.HYBRID;

            if (questions.isEmpty() && !autoFilled) {
                errors.add(label + " contains no questions.");
            }
            if (autoFilled && (section.getSelectionRules() == null || section.getSelectionRules().isEmpty())
                    && questions.size() < section.getQuestionCount()) {
                errors.add(label + " uses automatic selection but has no selection rules configured.");
            }
            if (section.getQuestionCount() > 0 && !autoFilled && questions.size() != section.getQuestionCount()) {
                warnings.add(label + " is configured for " + section.getQuestionCount()
                        + " questions but has " + questions.size() + " attached.");
            }
            if (section.getDurationMinutes() < 0) errors.add(label + ": section duration cannot be negative.");
            if (section.getMarksPerQuestion() < 0) errors.add(label + ": marks per question cannot be negative.");
            if (section.getNegativeMarks() < 0) errors.add(label + ": negative marks cannot be negative.");
            if (section.getPassingPercentage() != null
                    && (section.getPassingPercentage() < 0 || section.getPassingPercentage() > 100))
                errors.add(label + ": section passing percentage must be between 0 and 100.");

            sectionMinutesTotal += section.getDurationMinutes();

            for (ManagedTestQuestion q : questions) {
                marksTotal += q.getMarks();
                if (q.getMarks() <= 0) errors.add(label + ": \"" + shortTitle(q) + "\" has no marks assigned.");
                if (q.getNegativeMarks() < 0) errors.add(label + ": \"" + shortTitle(q) + "\" has negative penalty below zero.");
                errors.addAll(validateAnswerable(q, label));

                if (q.getSourceType() != null && q.getSourceQuestionId() != null) {
                    String key = q.getSourceType() + "#" + q.getSourceQuestionId();
                    if (!bankKeys.add(key)) {
                        errors.add("Duplicate question in this test: \"" + shortTitle(q) + "\" appears more than once.");
                    }
                }
            }
        }

        if (test.isSectionTimersEnabled() && sectionMinutesTotal > test.getDurationMinutes()) {
            errors.add("Section durations add up to " + sectionMinutesTotal
                    + " minutes, which exceeds the total test duration of " + test.getDurationMinutes() + " minutes.");
        }
        if (test.isSectionTimersEnabled() && sectionMinutesTotal == 0) {
            errors.add("Section timers are enabled but no section has a duration.");
        }
        if (marksTotal <= 0) errors.add("Total marks must be greater than zero.");

        return new ValidationReport(errors.isEmpty(), errors, warnings);
    }

    /** "Questions must have valid answers" - per type, since what counts as valid differs. */
    private List<String> validateAnswerable(ManagedTestQuestion q, String label) {
        List<String> errors = new ArrayList<>();
        Map<String, Object> p = q.getPayload() == null ? Map.of() : q.getPayload();
        String title = shortTitle(q);

        switch (q.getQuestionType()) {
            case MCQ_SINGLE, MCQ_MULTI -> {
                Object options = p.get("options");
                Object correct = p.get("correctOptions");
                int optionCount = options instanceof List<?> l ? l.size() : 0;
                int correctCount = correct instanceof List<?> l ? l.size() : 0;
                if (optionCount < 2) errors.add(label + ": \"" + title + "\" needs at least two options.");
                if (correctCount == 0) errors.add(label + ": \"" + title + "\" has no correct answer marked.");
                if (q.getQuestionType() == TestQuestionType.MCQ_SINGLE && correctCount > 1)
                    errors.add(label + ": \"" + title + "\" is single-correct but has " + correctCount + " correct options.");
                if (options instanceof List<?> l && correct instanceof List<?> c) {
                    Set<String> keys = new HashSet<>();
                    for (Object o : l) if (o instanceof Map<?, ?> m && m.get("key") != null) keys.add(String.valueOf(m.get("key")));
                    for (Object k : c) if (!keys.contains(String.valueOf(k)))
                        errors.add(label + ": \"" + title + "\" marks option " + k + " correct, but no such option exists.");
                }
            }
            case CODING -> {
                if (isBlank(p.get("body"))) errors.add(label + ": \"" + title + "\" has no problem statement.");
                Object cases = p.get("testCases");
                if (!(cases instanceof List<?> l) || l.isEmpty())
                    errors.add(label + ": \"" + title + "\" has no test cases.");
                Object langs = p.get("languages");
                if (!(langs instanceof List<?> l2) || l2.isEmpty())
                    errors.add(label + ": \"" + title + "\" has no supported languages.");
            }
            case SQL -> {
                if (isBlank(p.get("body"))) errors.add(label + ": \"" + title + "\" has no problem statement.");
                if (isBlank(p.get("schemaDdl"))) errors.add(label + ": \"" + title + "\" has no schema defined.");
                if (isBlank(p.get("expectedOutput")) && !"MANUAL".equals(String.valueOf(p.get("evaluation"))))
                    errors.add(label + ": \"" + title + "\" has no expected output and is not marked for manual review.");
            }
            case DATAFRAME -> {
                if (isBlank(p.get("body"))) errors.add(label + ": \"" + title + "\" has no problem statement.");
                if (isBlank(p.get("expectedOutput")))
                    errors.add(label + ": \"" + title + "\" has no expected output.");
            }
            case DESCRIPTIVE -> {
                if (isBlank(p.get("body"))) errors.add(label + ": \"" + title + "\" has no question body.");
            }
        }
        return errors;
    }

    private boolean isBlank(Object o) {
        return !(o instanceof String s) || s.isBlank();
    }

    private String shortTitle(ManagedTestQuestion q) {
        String t = q.getTitle() == null ? "(untitled)" : q.getTitle();
        return t.length() > 60 ? t.substring(0, 57) + "..." : t;
    }
}
