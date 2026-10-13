package com.placement.game.entity;

/** Mirrors the spirit of {@code com.placement.assessment.entity.AttemptStatus} but scoped to the
 *  simpler game lifecycle called for in the spec (Section 15). The backend is the only thing
 *  allowed to transition this - the frontend reports round answers/events, it never asserts a
 *  new status directly. */
public enum GameAttemptStatus {
    STARTED,
    COMPLETED,
    ABANDONED,
    EXPIRED
}
