package com.placement.codinglab.entity;

/** The six practical coding categories (Section 1). Each is a data value, not a code branch -
 *  behavior differs only via {@link CodingAssessment#getLanguage()} (which sandbox image/toolchain
 *  runs it) and {@link CodingAssessment#getRunCommand()} (how it's built/tested), so adding a
 *  seventh category later never requires touching the execution or AI-hint engines. */
public enum CodingType {
    BACKEND,
    FRONTEND,
    MACHINE_LEARNING,
    AI,
    GENERATIVE_AI,
    RAG
}
