package com.placement.managedtest.entity;

/** How a section's questions are populated. */
public enum SelectionStrategy {
    MANUAL,  // admin picked every question explicitly
    RANDOM,  // resolved per candidate at attempt start from the auto-selection rules
    FIXED,   // rules resolved once at build time; every candidate sees the same set
    HYBRID   // manual picks + the remainder filled from the rules
}
