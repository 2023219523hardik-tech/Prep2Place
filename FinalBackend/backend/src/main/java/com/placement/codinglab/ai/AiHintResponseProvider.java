package com.placement.codinglab.ai;

import com.placement.codinglab.entity.AiHintClassification;
import com.placement.codinglab.entity.AiHintResponseType;
import com.placement.codinglab.entity.CodingType;

/**
 * Generates the actual hint text for an ALLOWED_HINT (or the refusal text for a
 * RESTRICTED_SOLVE_REQUEST classified by {@link AiHintGuardrailService}). Kept as an interface so
 * a real LLM-backed implementation can be swapped in later (see class javadoc on
 * {@link TemplateHintResponseProvider} for why that's not wired up in this pass) without touching
 * {@code AiHintService}, the guardrail, or the audit log.
 *
 * <p>Section 18 "AI context restrictions": implementations of this interface must only ever be
 * given what {@link HintContext} carries - the public title/description, the student's own
 * message, and their own last compiler/runtime error. Hidden tests, official solutions and other
 * students' code are structurally impossible to reach this interface because
 * {@code AiHintService} never reads them in the first place.
 */
public interface AiHintResponseProvider {

    record HintContext(CodingType codingType, String assessmentTitle, String assessmentDescription,
                        String studentMessage, String lastError, AiHintClassification classification) {}

    record HintResponse(AiHintResponseType responseType, String text) {}

    HintResponse respond(HintContext context);
}
