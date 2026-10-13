package com.placement.assessment.coding;

import com.placement.dto.CodingDtos.*;
import lombok.*;

import java.util.List;

public class CodingMockTestDtos {

    @Getter @Setter @Builder
    public static class QuestionNavItem {
        private int index;
        private Long canonicalQuestionId;
        private String title;
        private String difficulty;
        private boolean solved;
        private boolean attempted; // has at least one run/submit, even if not solved
    }

    @Getter @Setter @Builder
    public static class WorkspaceView {
        private int index;
        private int totalQuestions;
        private ProblemMetadataResponse problem;
        private String savedCode;
        private String savedLanguage;
        private boolean solved;
        private List<SubmissionResponse> submissionHistory;
        private List<QuestionNavItem> navigation;
    }

    @Getter @Setter
    public static class RunRequest {
        private String language;
        private String code;
        private String customInput; // optional ad hoc input, run-only, never used for scoring
    }

    @Getter @Setter
    public static class SubmitRequest {
        private String language;
        private String code;
    }

    @Getter @Setter @Builder
    public static class SubmitResult {
        private boolean accepted;
        private RunCodeResponse execution;
        private boolean firstTimeSolved; // true only the first time this question is solved in this attempt
        private double attemptRawScore;
        private double attemptMaxScore;
    }
}
