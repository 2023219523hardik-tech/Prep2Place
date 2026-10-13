package com.placement.assessment.aptitude;

import lombok.*;

import java.util.List;
import java.util.Map;

public class AptitudeMockTestDtos {

    @Getter @Setter @Builder
    public static class QuestionView {
        private int index;
        private Long canonicalQuestionId;
        private String text;
        private String topic;
        private String difficulty;
        private String optionA;
        private String optionB;
        private String optionC;
        private String optionD;
        private String selectedOption; // candidate's currently saved answer, null if unanswered
    }

    @Getter @Setter @Builder
    public static class WorkspaceView {
        private long attemptId;
        private long remainingSeconds;
        private int totalQuestions;
        private int answeredCount;
        private List<QuestionView> questions;
    }

    @Getter @Setter
    public static class SaveAnswerRequest {
        private int index;
        private String selectedOption; // "A" | "B" | "C" | "D", or null to clear
    }

    @Getter @Setter @Builder
    public static class QuestionResult {
        private int index;
        private String yourAnswer;
        private String correctAnswer;
        private boolean correct;
        private boolean unanswered;
        private String explanation;
        private String topic;
        private String difficulty;
    }

    @Getter @Setter @Builder
    public static class TopicBreakdown {
        private String topic;
        private int total;
        private int correct;
        private double accuracyPercent;
    }

    @Getter @Setter @Builder
    public static class SubmitResult {
        private double rawScore;
        private double maxPossibleScore;
        private double scorePercent;
        private int correctCount;
        private int incorrectCount;
        private int unansweredCount;
        private List<TopicBreakdown> topicBreakdown;
        private List<QuestionResult> questionResults;
    }
}
