package com.placement.assessment.report;

import com.placement.assessment.entity.AssessmentType;
import com.placement.assessment.entity.IntegrityEventClassification;
import com.placement.assessment.entity.IntegrityEventType;
import lombok.*;

import java.time.Instant;
import java.util.List;

public class ReportDtos {

    public record FeedbackDetail(String section, String message, String severity) {
        public FeedbackDetail(String section, String message) {
            this(section, message, "INFO");
        }
    }

    @Getter @Setter @Builder
    public static class EvidenceCard {
        private IntegrityEventType eventType;
        private String label;
        private IntegrityEventClassification classification;
        private int severity;
        private Double confidenceScore;
        private Instant occurredAt;
        private Double durationSeconds;
        private boolean evidenceAvailable;
        private String evidenceRef;
        private String evidenceUnavailableReason;
        private String whatWasDetected;
        private String howToImprove;
    }

    @Getter @Setter @Builder
    public static class CodingMistakeCard {
        private int questionIndex;
        private String questionTitle;
        private List<String> topics;
        private String difficulty;
        private String verdict;
        private int scorePercent;
        private List<FailedTest> failedTests;
        private String howToImprove;
        /** Section 8 (partial completion): true when this question has no submission at all -
         *  distinct from "attempted but failed". Never silently omitted from the report just
         *  because nothing was submitted (e.g. the attempt was terminated before reaching it). */
        private boolean unattempted;
    }

    @Getter @Setter @Builder
    public static class FailedTest {
        private String name;
        private String input;
        private String expected;
        private String actual;
        private String error;
    }

    @Getter @Setter @Builder
    public static class AptitudeMistakeCard {
        private int questionIndex;
        private String questionText;
        private String topic;
        private String difficulty;
        private String yourAnswer;
        private String correctAnswer;
        private boolean unanswered;
        private String explanation;
        private String howToImprove;
    }

    @Getter @Setter @Builder
    public static class RepeatedIssue {
        private String issueKey;
        private String label;
        private int recentCount;   // most recent 3 attempts of this type
        private int olderCount;    // the 3 before that
        private String trend;      // IMPROVING | WORSENING | STABLE | NEW
    }

    @Getter @Setter @Builder
    public static class AttemptReport {
        private Long attemptId;
        private AssessmentType assessmentType;
        private String status;
        private double rawScore;
        private double maxPossibleScore;
        private double scorePercent;
        private int integrityScore;
        private int violationCount;
        private String overallSummary;
        private List<String> strengths;
        private List<String> weaknesses;
        private List<EvidenceCard> evidenceCards;
        private List<CodingMistakeCard> codingMistakes;
        private List<AptitudeMistakeCard> aptitudeMistakes;
        private List<RepeatedIssue> repeatedIssues;
        private List<FeedbackDetail> feedback;
    }
}
