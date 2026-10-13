package com.placement.managedtest.entity;

/**
 * Where a ManagedTestQuestion came from. QUESTION_BANK rows keep sourceType/sourceQuestionId for
 * usage counts and traceability, but still carry a full payload snapshot - editing the copy inside
 * a test never writes back to the Question Bank row.
 */
public enum QuestionOrigin { QUESTION_BANK, CUSTOM }
