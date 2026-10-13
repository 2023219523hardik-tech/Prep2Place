package com.placement.assessment.entity;

/**
 * The single authoritative lifecycle every assessment attempt (coding mock test, aptitude mock
 * test, AI interview) moves through. The backend is the only thing allowed to transition an
 * attempt's status - the frontend reports events/answers, it never asserts a new status directly.
 */
public enum AttemptStatus {
    NOT_STARTED,
    IN_PROGRESS,
    PAUSED,          // only reachable when the profile explicitly permits pausing
    SUBMITTED,        // candidate-initiated submit
    AUTO_SUBMITTED,    // server-side timer expiry submit
    TERMINATED,         // violation-policy termination; cannot resume
    TAB_SWITCH_TERMINATED, // terminated due to tab switch in secure mock test
    AUTO_SUBMITTED_TAB_SWITCH, // auto submitted due to tab switch in secure mock test
    LOCKED               // administratively locked (e.g. suspected integrity issue under review)
}
