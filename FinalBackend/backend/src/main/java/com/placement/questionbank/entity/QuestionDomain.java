package com.placement.questionbank.entity;

/**
 * Which kind of assessment a canonical question is usable for. Kept separate from
 * com.placement.entity.QuestionCategory (which is a broader interview-question taxonomy) - this
 * one specifically gates what the assessment engine's random-selection pool draws from, so an
 * Aptitude Mock Test can never accidentally receive a coding problem or vice versa.
 */
public enum QuestionDomain {
    CODING,
    APTITUDE
}
