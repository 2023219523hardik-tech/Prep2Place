package com.placement.managedtest.service;

import com.placement.managedtest.dto.ManagedTestDtos.*;
import com.placement.managedtest.entity.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Entity -> DTO conversion in one place, so no controller ever serializes an entity directly (which
 * would leak lazy proxies and, for questions, the correct answers).
 */
@Component
@RequiredArgsConstructor
public class ManagedTestMapper {

    /** Payload keys that must never reach a candidate before their attempt is in a terminal state. */
    private static final Set<String> SOLUTION_KEYS =
            Set.of("correctOptions", "explanation", "expectedOutput", "solution", "referenceSolution");

    public TestSummaryResponse toSummary(ManagedTest test, int questionCount, int assignedCount, long attemptCount) {
        return new TestSummaryResponse(
                test.getId(), test.getName(), test.getTestType(), test.getStatus(),
                test.getOrganizationName(), test.getBatch(), test.getBranch(), test.getGraduationYear(),
                test.getDifficulty(), test.getDurationMinutes(), test.getTotalMarks(), test.getPassingPercentage(),
                test.getSections().size(), questionCount, assignedCount, attemptCount,
                test.getStartsAt(), test.getEndsAt(), test.getCreatedAt(), test.getUpdatedAt(),
                test.getCreatedBy() != null ? test.getCreatedBy().getFullName() : null
        );
    }

    public SectionResponse toSection(ManagedTestSection section, boolean includeSolutions) {
        List<QuestionResponse> questions = section.orderedQuestions().stream()
                .map(q -> toQuestion(q, includeSolutions))
                .toList();
        return new SectionResponse(
                section.getId(), section.getName(), section.getSectionType(), section.getInstructions(),
                section.getDisplayOrder(), section.getQuestionCount(), section.getQuestions().size(),
                section.getDurationMinutes(), section.getMarksPerQuestion(), section.getNegativeMarks(),
                section.getPassingPercentage(), section.isMandatory(), section.isRandomizeQuestions(),
                section.isRandomizeOptions(), section.isAllowBackNavigation(), section.getSelectionStrategy(),
                section.getSelectionRules(), section.attachedMarks(), questions
        );
    }

    public QuestionResponse toQuestion(ManagedTestQuestion q, boolean includeSolutions) {
        Map<String, Object> payload = includeSolutions ? q.getPayload() : stripSolutions(q.getPayload());
        return new QuestionResponse(
                q.getId(), q.getQuestionType(), q.getOrigin(), q.getSourceType(), q.getSourceQuestionId(),
                q.getTitle(), q.getDifficulty(), q.getTopic(), q.getSubtopic(),
                q.getMarks(), q.getNegativeMarks(), q.getEstimatedTimeSeconds(), q.getDisplayOrder(),
                payload
        );
    }

    /**
     * Removes correct answers, explanations and expected outputs, and drops hidden test cases.
     * Applied to every question the candidate can see while the attempt is still open - the runner
     * literally cannot cheat off a payload it was never sent.
     */
    public Map<String, Object> stripSolutions(Map<String, Object> payload) {
        if (payload == null) return Map.of();
        Map<String, Object> copy = new HashMap<>(payload);
        SOLUTION_KEYS.forEach(copy::remove);
        Object cases = copy.get("testCases");
        if (cases instanceof List<?> list) {
            copy.put("testCases", list.stream()
                    .filter(tc -> !(tc instanceof Map<?, ?> m && Boolean.TRUE.equals(m.get("hidden"))))
                    .toList());
        }
        return copy;
    }

    /** The inverse: just the solution-bearing keys, for post-submission review. */
    public Map<String, Object> solutionOf(Map<String, Object> payload) {
        if (payload == null) return Map.of();
        Map<String, Object> out = new HashMap<>();
        SOLUTION_KEYS.forEach(k -> {
            if (payload.containsKey(k)) out.put(k, payload.get(k));
        });
        return out;
    }
}
