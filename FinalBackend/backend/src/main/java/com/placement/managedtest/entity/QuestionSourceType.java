package com.placement.managedtest.entity;

/** Which Question Bank pool a QUESTION_BANK-origin question was drawn from. */
public enum QuestionSourceType {
    TECHNICAL_MCQ,  // com.placement.questionbank.entity.TechnicalMcqQuestion
    APTITUDE,       // com.placement.entity.AptitudeQuestion
    CANONICAL       // com.placement.questionbank.entity.CanonicalQuestion (coding / DSA)
}
