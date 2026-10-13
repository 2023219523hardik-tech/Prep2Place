package com.placement.entity;

public enum InterviewStatus {
    CREATED,
    READY,
    IN_PROGRESS,
    PAUSED,
    EXITED,
    RESUMABLE,
    COMPLETED,
    SUBMITTED,
    REPORT_GENERATING,
    REPORT_READY,
    CANCELLED,
    /** Universal anti-cheat (Section 6): auto-terminated for a tab-switch/window-blur/fullscreen-exit
     *  policy violation. Terminal - the candidate cannot resume without administrator/interviewer
     *  intervention (there is deliberately no candidate-facing "resume" path out of this status). */
    TERMINATED_VIOLATION,
    VIOLATION_DETECTED,
    TIMEOUT,
    ADMIN_TERMINATED
}
