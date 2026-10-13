package com.placement.service;

/**
 * Pluggable computer-vision analysis abstraction for the interview module.
 * Serves two purposes:
 *  1. Behavioural confidence scoring (face visibility / eye contact / posture -> confidenceScore)
 *  2. Malpractice / proctoring signals (faceCount, suspiciousObjectDetected) used by
 *     {@link ProctoringService} to flag multiple-people-in-frame, no-face-detected, or a
 *     phone/second-screen in view.
 *
 * The default implementation is a deterministic MOCK — it does not run any real CV model.
 * To go live, implement this against a real pipeline (e.g. MediaPipe Face Mesh + Pose for
 * face/gaze/posture, plus a lightweight object detector for phones/books/screens) and
 * register it as the primary Spring bean. Nothing else needs to change.
 */
public interface VideoAnalysisService {
    VideoSignals analyze(byte[] videoFrameOrClip);

    com.placement.dto.ProctoringDtos.DressAnalysisResult analyzeClothingFrames(java.util.List<byte[]> frames);

    record VideoSignals(
            double faceVisibilityScore,   // 0-100: how consistently a face was detected
            double eyeContactScore,       // 0-100: gaze-on-camera proxy
            double postureScore,          // 0-100: pose stability proxy
            double confidenceScore,       // 0-100: fused behavioural confidence score
            int faceCount,                // number of faces detected in the frame (proctoring signal)
            boolean suspiciousObjectDetected, // e.g. phone / book / second screen in view (proctoring signal)
            boolean formalAttireDetected, // true if candidate is wearing formal wear
            double attireScore            // 0-100
    ) {
        public VideoSignals(double faceVisibilityScore, double eyeContactScore, double postureScore, double confidenceScore, int faceCount, boolean suspiciousObjectDetected) {
            this(faceVisibilityScore, eyeContactScore, postureScore, confidenceScore, faceCount, suspiciousObjectDetected, true, 85.0);
        }
    }
}
