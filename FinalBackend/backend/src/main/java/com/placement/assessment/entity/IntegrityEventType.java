package com.placement.assessment.entity;

public enum IntegrityEventType {
    TAB_SWITCH,
    WINDOW_BLUR,
    FULLSCREEN_EXIT,
    COPY_ATTEMPT,
    PASTE_ATTEMPT,
    CONTEXT_MENU_ATTEMPT,
    SCREEN_CHANGE_ATTEMPT,
    CAMERA_BLOCKED,
    MICROPHONE_BLOCKED,
    FACE_NOT_DETECTED,
    MULTIPLE_FACES,
    LOOKING_AWAY,
    POSTURE_ISSUE,
    POTENTIAL_EXTERNAL_REFERENCE,
    SUSPICIOUS_KEYBOARD_ACTIVITY,
    INACTIVITY,
    TIME_EXPIRATION,
    TEST_TERMINATED,
    // Section 5: previously missing detection - devtools shortcuts (F12/Ctrl+Shift+I etc.) and
    // browser back-navigation during a running test are real, distinct signals, not a subtype of
    // "suspicious keyboard activity" or anything else already listed.
    DEVTOOLS_ATTEMPT,
    BACK_NAVIGATION_ATTEMPT,
    
    // Unauthorized screen share detection
    UNAUTHORIZED_SCREEN_SHARE_DETECTED,
    UNAUTHORIZED_SECOND_SHARE,
    POTENTIAL_DISPLAY_CAPTURE,
    EXTENSION_CAPTURE_API_PRESENT
}
