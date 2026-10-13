package com.placement.entity;

public enum ProctoringEventType {
    TAB_SWITCH,
    WINDOW_BLUR,
    FULLSCREEN_EXIT,
    COPY_PASTE_ATTEMPT,
    RIGHT_CLICK,
    DEVTOOLS_OPENED,
    MULTIPLE_FACES,
    NO_FACE_DETECTED,
    MULTIPLE_VOICES,
    SUSPICIOUS_OBJECT,
    FILLER_WORDS,
    POSTURE_DRIFT,
    MOVEMENT_DETECTED,
    SCREEN_SHARE_START,
    SCREEN_SHARE_STOP,
    AUDIO_MUTED,
    CONTEXT_MISMATCH,
    SUSPICIOUS_FRAME,
    // Added: real per-signal types so violations are logged under the type that actually
    // occurred, instead of being folded into MOVEMENT_DETECTED/POSTURE_DRIFT regardless of
    // what was actually detected (see ProctoringService#analyzeFrame).
    EYE_ROAMING,
    READING_DETECTED,
    // Universal anti-cheat enforcement (Section 6): a best-effort *detection* of an OS/browser
    // screenshot shortcut (never a guarantee of prevention - see ProctoringGuard's disclosure
    // copy) and the audit-trail marker written when a session is auto-terminated for a policy
    // violation, so the termination itself shows up in the same log a reviewer already reads.
    SCREENSHOT_ATTEMPT,
    SESSION_TERMINATED,
    // Section 5 cross-cutting: back-navigation deterrent/detection, mirrored from the mock-test
    // engine's BACK_NAVIGATION_ATTEMPT so both proctoring surfaces log the same kind of event.
    BACK_NAVIGATION_ATTEMPT,
    
    // Unauthorized screen share detection
    UNAUTHORIZED_SCREEN_SHARE_DETECTED,
    UNAUTHORIZED_SECOND_SHARE,
    POTENTIAL_DISPLAY_CAPTURE,
    EXTENSION_CAPTURE_API_PRESENT,

    // Formal dress verification violation
    FORMAL_DRESS_NOT_DETECTED
}
