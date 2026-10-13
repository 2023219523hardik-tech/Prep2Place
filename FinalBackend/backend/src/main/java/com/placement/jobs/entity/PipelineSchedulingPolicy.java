package com.placement.jobs.entity;

/**
 * Hiring pipeline round scheduling policy.
 * SEQUENTIAL: Candidates progress linearly; next round cannot start before previous round finishes.
 * INDEPENDENT: Rounds can overlap when configured for separate candidate groups or independent participation.
 */
public enum PipelineSchedulingPolicy {
    SEQUENTIAL,
    INDEPENDENT
}
