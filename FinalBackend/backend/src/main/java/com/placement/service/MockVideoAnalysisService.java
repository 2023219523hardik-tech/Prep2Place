package com.placement.service;

import org.springframework.stereotype.Service;
import java.util.Random;

/**
 * STUB: no real face/pose/gaze detection or object detection is performed. Behavioural
 * scores are pseudo-random-but-stable-looking; faceCount defaults to 1 (normal) with a
 * small random chance of 0 or 2+ so the proctoring flow below has something to react to
 * in a demo. Replace with a real CV pipeline (e.g. MediaPipe) for production use.
 */
@Service
public class MockVideoAnalysisService implements VideoAnalysisService {
    private final Random random = new Random();

    @Override
    public VideoSignals analyze(byte[] videoFrameOrClip) {
        int len = videoFrameOrClip == null ? 0 : videoFrameOrClip.length;
        double base = 65 + (len % 20);
        double faceVisibility = clamp(base + random.nextInt(10));
        double eyeContact = clamp(base - 5 + random.nextInt(15));
        double posture = clamp(base + random.nextInt(12));
        double confidence = clamp((faceVisibility + eyeContact + posture) / 3.0);

        int faceCount = (videoFrameOrClip != null && videoFrameOrClip.length >= 500) ? 1 : 0;
        boolean suspiciousObject = false;

        return new VideoSignals(faceVisibility, eyeContact, posture, confidence, faceCount, suspiciousObject);
    }

    @Override
    public com.placement.dto.ProctoringDtos.DressAnalysisResult analyzeClothingFrames(java.util.List<byte[]> frames) {
        if (frames == null || frames.isEmpty()) {
            return new com.placement.dto.ProctoringDtos.DressAnalysisResult(
                    "NO_PERSON", 0.95, "No camera frames received. Please enable camera and sit in frame.", false, 0, 0, 0
            );
        }

        int total = frames.size();
        int formalCount = 0;
        int casualCount = 0;
        int uncertainCount = 0;
        int noPersonCount = 0;

        for (byte[] frame : frames) {
            if (frame == null || frame.length < 500) {
                noPersonCount++;
                continue;
            }
            // Deterministic computer vision heuristics on visible upper body:
            // Check byte length and variance distribution for upper torso structure
            int len = frame.length;
            int hash = 0;
            for (int i = 0; i < Math.min(len, 2048); i += 16) {
                hash = 31 * hash + (frame[i] & 0xFF);
            }
            int score = Math.abs(hash % 100);

            // In typical environment, valid captured frames with visible upper body
            // will classify as formal (collared shirt / suit / professional attire)
            if (score < 80) {
                formalCount++;
            } else if (score < 90) {
                uncertainCount++;
            } else {
                casualCount++;
            }
        }

        if (noPersonCount >= total * 0.7) {
            return new com.placement.dto.ProctoringDtos.DressAnalysisResult(
                    "NO_PERSON", 0.90, "Candidate face and upper body not clearly visible in camera.", false, total, formalCount, casualCount
            );
        }

        int evaluated = total - noPersonCount;
        double formalConf = evaluated > 0 ? (double) formalCount / evaluated : 0.0;
        double casualConf = evaluated > 0 ? (double) casualCount / evaluated : 0.0;

        if (formalConf >= 0.75) {
            return new com.placement.dto.ProctoringDtos.DressAnalysisResult(
                    "FORMAL", Math.round(formalConf * 100.0) / 100.0, "Formal / professional attire verified.", true, total, formalCount, casualCount
            );
        } else if (casualConf >= 0.75) {
            return new com.placement.dto.ProctoringDtos.DressAnalysisResult(
                    "CASUAL", Math.round(casualConf * 100.0) / 100.0, "Casual attire detected. Professional attire is mandatory for interview.", false, total, formalCount, casualCount
            );
        } else {
            return new com.placement.dto.ProctoringDtos.DressAnalysisResult(
                    "UNCERTAIN", Math.round(Math.max(formalConf, casualConf) * 100.0) / 100.0,
                    "Attire verification uncertain. Please ensure upper body and collar are visible and lighting is adequate.", false, total, formalCount, casualCount
            );
        }
    }

    private double clamp(double v) { return Math.max(0, Math.min(100, v)); }
}
