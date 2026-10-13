package com.placement.dto;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

public class ProctoringDtos {

    /** One entry in the violation log, as shown in the consolidated violations panel/report.
     *  evidenceUrl is only populated when evidence was actually captured and stored - the client
     *  must not assume evidence exists just because the event does. */
    public record ProctoringEventResponse(
            Long id, String eventType, String details, LocalDateTime occurredAt,
            Integer severity, Double durationSeconds, Double confidenceScore,
            boolean evidenceAvailable, String evidenceUrl, String evidenceUnavailableReason, String evidenceSource,
            /** Universal anti-cheat (Section 6): true when logging this event caused the session to
             *  be auto-terminated. The frontend must lock the screen the instant this is true. */
            boolean sessionTerminated, String terminationReason
    ) {}

    /** Result of analyzing one submitted webcam frame during the interview. Distinct flags per
     *  signal so the caller logs the violation type that actually happened (see
     *  ProctoringService#analyzeFrame) instead of reusing one type for everything. */
    public record FrameAnalysisResponse(
            int faceCount, boolean multipleFacesDetected, boolean noFaceDetected,
            boolean suspiciousObjectDetected, boolean eyeRoamingDetected, boolean postureDriftDetected,
            boolean readingDetected, Double currentIntegrityScore,
            boolean formalAttireDetected, String attireType, Double attireScore
    ) {
        public FrameAnalysisResponse(int faceCount, boolean multipleFacesDetected, boolean noFaceDetected,
                                     boolean suspiciousObjectDetected, boolean eyeRoamingDetected, boolean postureDriftDetected,
                                     boolean readingDetected, Double currentIntegrityScore) {
            this(faceCount, multipleFacesDetected, noFaceDetected, suspiciousObjectDetected, eyeRoamingDetected,
                    postureDriftDetected, readingDetected, currentIntegrityScore, true, "FORMAL", 85.0);
        }
    }

    public record ProctoringSummaryResponse(
            Double integrityScore,
            boolean flaggedForReview,
            Map<String, Long> eventCounts,
            Double totalCheatTimeSeconds,
            List<ProctoringEventResponse> events
    ) {}

    public record PreInterviewCheckRequest(
            boolean camera,
            boolean microphone,
            boolean screenShare,
            boolean tabMonitoring,
            boolean backgroundCheck,
            boolean formalDressCheck,
            boolean faceDetection,
            boolean identityCheck,
            Double formalDressConfidence,
            String formalDressClassification
    ) {}

    public record PreInterviewCheckResponse(
            String proctoringStatus,
            boolean camera,
            boolean microphone,
            boolean screenShare,
            boolean tabMonitoring,
            boolean backgroundCheck,
            boolean formalDressCheck,
            boolean faceDetection,
            boolean identityCheck,
            boolean proctoringCompleted,
            String message
    ) {}

    public record DressAnalysisResult(
            String classification, // FORMAL, CASUAL, UNCERTAIN, NO_PERSON
            Double confidence,
            String message,
            boolean passed,
            int totalFramesAnalyzed,
            int formalFramesCount,
            int casualFramesCount
    ) {}
}
