package com.placement.codinglab.ai;

import com.placement.codinglab.entity.AiHintClassification;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Locale;

/**
 * Section 17: "Student Request -> AI Intent Classification -> Policy Engine -> Allowed Hint OR
 * Restricted Response". Deliberately simple and deterministic (keyword/phrase matching, no LLM
 * call) so the "never solve the assessment" guarantee does not depend on an LLM correctly
 * following instructions - a request that matches is blocked in Java code before any response
 * generator (template-based or LLM-based) ever sees it.
 */
@Component
public class AiHintGuardrailService {

    private static final List<String> RESTRICTED_PHRASES = List.of(
            "solve this", "solve the assessment", "solve the problem", "solve it for me",
            "give me the complete", "give the complete", "complete solution", "full solution",
            "entire solution", "write full solution", "write the full solution",
            "write the entire", "write the complete", "generate the full project",
            "generate the project", "generate full code", "complete this function",
            "complete the function", "complete my function", "finish this function",
            "finish the function", "fix everything", "fix all the", "fix all my",
            "provide final answer", "final answer for", "implement everything",
            "implement the whole", "implement all of", "write all files",
            "write all the files", "do it for me", "do the assessment for me",
            "code it for me", "write the code for me", "just give me the code",
            "give me the answer", "give me the code", "copy paste", "copy-paste",
            "rewrite my entire", "rewrite the entire", "hand me the solution",
            "official solution", "hidden test", "hidden tests", "expected output for the hidden"
    );

    public AiHintClassification classify(String studentMessage) {
        if (studentMessage == null) return AiHintClassification.ALLOWED_HINT;
        String normalized = studentMessage.toLowerCase(Locale.ROOT).replaceAll("\\s+", " ").trim();
        for (String phrase : RESTRICTED_PHRASES) {
            if (normalized.contains(phrase)) {
                return AiHintClassification.RESTRICTED_SOLVE_REQUEST;
            }
        }
        return AiHintClassification.ALLOWED_HINT;
    }
}
