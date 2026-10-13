package com.placement.assessment.dto;

import com.placement.assessment.entity.*;
import lombok.*;

import java.time.Instant;
import java.util.List;
import java.util.Map;

public class AssessmentDtos {

    @Getter @Setter
    public static class StartAttemptRequest {
        private Long profileId;
    }

    @Getter @Setter @Builder
    public static class AttemptView {
        private Long id;
        private AssessmentType assessmentType;
        private AttemptStatus status;
        private List<Long> selectedQuestionIds;
        private Map<String, Object> answerState;
        private Map<String, String> languageState;
        private Map<String, Object> configSnapshot;
        private Instant startedAt;
        private Instant serverExpiresAt;
        private long remainingSeconds;
        private int violationCount;
        private int integrityScore;
        private String terminationReason;

        public static AttemptView from(AssessmentAttempt a) {
            long remaining = 0;
            if (a.getServerExpiresAt() != null && !a.isTerminalState()) {
                remaining = Math.max(0, Instant.now().until(a.getServerExpiresAt(), java.time.temporal.ChronoUnit.SECONDS));
            }
            return AttemptView.builder()
                    .id(a.getId())
                    .assessmentType(a.getAssessmentType())
                    .status(a.getStatus())
                    .selectedQuestionIds(a.getSelectedQuestionIds())
                    .answerState(a.getAnswerState())
                    .languageState(a.getLanguageState())
                    .configSnapshot(a.getConfigSnapshot())
                    .startedAt(a.getStartedAt())
                    .serverExpiresAt(a.getServerExpiresAt())
                    .remainingSeconds(remaining)
                    .violationCount(a.getViolationCount())
                    .integrityScore(a.getIntegrityScore())
                    .terminationReason(a.getTerminationReason())
                    .build();
        }
    }

    @Getter @Setter
    public static class AutosaveRequest {
        private Map<String, Object> answerDelta;
        private Map<String, String> languageDelta;
    }

    @Getter @Setter
    public static class ViolationRequest {
        private IntegrityEventType eventType;
        private Double durationSeconds;
        private Double confidenceScore; // omit/null for objectively-measured browser events
        private String details;
        private boolean evidenceAvailable;
        private String evidenceRef;
        private String evidenceUnavailableReason;
    }

    @Getter @Setter @Builder
    public static class IntegrityEventView {
        private Long id;
        private IntegrityEventType eventType;
        private IntegrityEventClassification classification;
        private Instant occurredAt;
        private Double durationSeconds;
        private int severity;
        private Double confidenceScore;
        private String details;
        private boolean evidenceAvailable;
        private String evidenceRef;
        private String evidenceUnavailableReason;
        private boolean contributedToTermination;

        public static IntegrityEventView from(IntegrityEvent e) {
            return IntegrityEventView.builder()
                    .id(e.getId()).eventType(e.getEventType()).classification(e.getClassification())
                    .occurredAt(e.getOccurredAt()).durationSeconds(e.getDurationSeconds()).severity(e.getSeverity())
                    .confidenceScore(e.getConfidenceScore()).details(e.getDetails())
                    .evidenceAvailable(e.isEvidenceAvailable()).evidenceRef(e.getEvidenceRef())
                    .evidenceUnavailableReason(e.getEvidenceUnavailableReason())
                    .contributedToTermination(e.isContributedToTermination())
                    .build();
        }
    }
}
