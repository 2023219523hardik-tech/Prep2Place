package com.placement.managedtest.entity;

/**
 * Admin-selectable assessment type for a {@link ManagedTest}. Deliberately separate from
 * {@code com.placement.assessment.entity.AssessmentType} (CODING_MOCK_TEST / APTITUDE_MOCK_TEST /
 * AI_INTERVIEW), which drives the existing single-section, rule-generated engine and is pinned by
 * CHECK constraints on assessment_profile and assessment_attempt. Adding values there would have
 * meant rewriting those constraints and changing the meaning of rows already in the database.
 */
public enum TestType {
    STANDARD_MOCK_TEST,
    UNIVERSITY_TEST,
    CUSTOM_TEST,
    TECHNICAL_MCQ_TEST,
    COMPANY_TEST,
    PLACEMENT_TEST
}
