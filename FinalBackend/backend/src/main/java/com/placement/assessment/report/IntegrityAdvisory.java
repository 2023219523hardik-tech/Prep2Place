package com.placement.assessment.report;

import com.placement.assessment.entity.IntegrityEventType;

import java.util.Map;

/**
 * What each integrity event type means and how a candidate can avoid it next time. Kept as an
 * explicit, readable table (not an LLM call) so recommendations are deterministic, auditable, and
 * never invent something about the specific event that wasn't actually detected.
 */
public final class IntegrityAdvisory {

    private IntegrityAdvisory() {}

    public record Advisory(String label, String whatItMeansTemplate, String howToImprove) {}

    private static final Map<IntegrityEventType, Advisory> TABLE = Map.ofEntries(
            Map.entry(IntegrityEventType.TAB_SWITCH, new Advisory(
                    "Tab Switch Detected",
                    "The browser tab lost visibility, meaning you navigated away from the assessment.",
                    "Keep the assessment tab active for the full duration. Close other tabs and notifications before you start so nothing pulls focus away.")),
            Map.entry(IntegrityEventType.WINDOW_BLUR, new Advisory(
                    "Window Focus Lost",
                    "The assessment window lost operating-system focus.",
                    "Stay inside the assessment window throughout. If a notification or another app grabs focus, that's flagged even if unintentional - silence notifications beforehand.")),
            Map.entry(IntegrityEventType.FULLSCREEN_EXIT, new Advisory(
                    "Fullscreen Exit",
                    "The assessment left fullscreen mode.",
                    "Stay in fullscreen for the entire assessment. Avoid keyboard shortcuts (Esc, F11, etc.) that exit fullscreen.")),
            Map.entry(IntegrityEventType.COPY_ATTEMPT, new Advisory(
                    "Copy Attempt", "A copy action was attempted while copying was disabled for this assessment.",
                    "Work directly within the provided editor/answer area. Copying is disabled by this assessment's rules.")),
            Map.entry(IntegrityEventType.PASTE_ATTEMPT, new Advisory(
                    "Paste Attempt", "A paste action was attempted while pasting was disabled for this assessment.",
                    "Type your answer directly rather than pasting from another source - this assessment profile disables paste.")),
            Map.entry(IntegrityEventType.CONTEXT_MENU_ATTEMPT, new Advisory(
                    "Right-Click Attempted", "The browser's right-click context menu was opened.",
                    "The right-click menu is disabled during this assessment; use standard keyboard/editor controls instead.")),
            Map.entry(IntegrityEventType.SCREEN_CHANGE_ATTEMPT, new Advisory(
                    "Screen Change Detected", "A change in the shared screen/display was detected.",
                    "Keep your screen-share on the assessment window only, and avoid switching displays or opening new windows.")),
            Map.entry(IntegrityEventType.CAMERA_BLOCKED, new Advisory(
                    "Camera Blocked", "The camera feed was unavailable or blocked during part of the assessment.",
                    "Make sure camera permission stays granted and the camera isn't covered or disconnected for the full duration.")),
            Map.entry(IntegrityEventType.MICROPHONE_BLOCKED, new Advisory(
                    "Microphone Blocked", "The microphone feed was unavailable or blocked during part of the assessment.",
                    "Keep microphone permission granted throughout, especially for interview-style assessments.")),
            Map.entry(IntegrityEventType.FACE_NOT_DETECTED, new Advisory(
                    "Face Not Detected", "The camera did not detect a face in frame for a period of time.",
                    "Stay centered in the camera frame with consistent lighting. Adjust your camera angle so your face is clearly visible throughout.")),
            Map.entry(IntegrityEventType.MULTIPLE_FACES, new Advisory(
                    "Multiple Faces Detected", "More than one face was detected in the camera frame.",
                    "Take the assessment alone in a private space where only you are visible to the camera.")),
            Map.entry(IntegrityEventType.LOOKING_AWAY, new Advisory(
                    "Prolonged Looking Away", "Sustained gaze away from the screen was detected for longer than the configured threshold.",
                    "Maintain natural attention toward the screen/interviewer. Brief thinking glances away are normal, but avoid sustained periods looking elsewhere.")),
            Map.entry(IntegrityEventType.POSTURE_ISSUE, new Advisory(
                    "Posture Issue", "A significant change in posture or camera framing was detected.",
                    "Sit centered and at a consistent distance from the camera. Adjust your chair/camera height for a stable, professional frame.")),
            Map.entry(IntegrityEventType.POTENTIAL_EXTERNAL_REFERENCE, new Advisory(
                    "Potential External Reference", "A pattern consistent with reading from an external source was detected. This is a potential signal, not confirmed misconduct.",
                    "Prepare a distraction-free environment with no reference material in view, and answer independently in your own words.")),
            Map.entry(IntegrityEventType.SUSPICIOUS_KEYBOARD_ACTIVITY, new Advisory(
                    "Suspicious Keyboard Activity", "Keyboard activity matching a disallowed pattern (e.g. a blocked shortcut) was detected.",
                    "Avoid keyboard shortcuts that aren't part of the normal answer flow, including browser/devtools shortcuts.")),
            Map.entry(IntegrityEventType.INACTIVITY, new Advisory(
                    "Inactivity", "No meaningful input was detected for an extended period.",
                    "Keep actively engaging with the assessment. If you need to think, that's fine, but avoid long stretches with zero input.")),
            Map.entry(IntegrityEventType.TIME_EXPIRATION, new Advisory(
                    "Time Expired", "The assessment's server-side timer reached zero and the attempt was automatically submitted.",
                    "Pace yourself against the timer shown in the assessment - budget time per question up front.")),
            Map.entry(IntegrityEventType.TEST_TERMINATED, new Advisory(
                    "Assessment Terminated", "The assessment was ended automatically due to a violation-policy breach.",
                    "Review this assessment's stated rules before your next attempt so the same policy isn't triggered again."))
    );

    public static Advisory forType(IntegrityEventType type) {
        return TABLE.getOrDefault(type, new Advisory(type.name(), "An assessment-integrity signal was recorded.",
                "Review the assessment rules shown before starting to avoid this signal on your next attempt."));
    }
}
