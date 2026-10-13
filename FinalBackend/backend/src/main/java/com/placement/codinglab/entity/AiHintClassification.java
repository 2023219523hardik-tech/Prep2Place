package com.placement.codinglab.entity;

/** Output of the guardrail intent classifier (Section 17) - decided BEFORE any hint text is
 *  generated, so a RESTRICTED_SOLVE_REQUEST never reaches the free-form hint generator at all. */
public enum AiHintClassification {
    ALLOWED_HINT,
    RESTRICTED_SOLVE_REQUEST
}
