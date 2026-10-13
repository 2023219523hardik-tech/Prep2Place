package com.placement.dto;

import java.time.LocalDateTime;
import java.util.List;

public class InterviewDtos {
    public record StartInterviewRequest(Long roleId, String level, Integer numQuestions,
                                        String resumeText, String jobDescription) {}
    public record SessionResponse(Long sessionId, String status, String roleTitle, String level,
                                   LocalDateTime createdAt, Integer questionsAnswered, Integer totalQuestions,
                                   Double overallScore) {}
    /** type is "TEXT" (normal spoken/typed Q&A) or "CODING" (Section 9's mid-interview domain
     *  challenge) - codingChallenge is only populated for the latter. Kept as one response shape
     *  rather than two endpoints so the frontend's existing "fetch next question" flow doesn't
     *  need a second code path to know which kind it got. */
    public record QuestionResponse(Long questionId, String text, String category, String difficulty,
                                    String type, CodingChallengeResponse codingChallenge) {
        public QuestionResponse(Long questionId, String text, String category, String difficulty) {
            this(questionId, text, category, difficulty, "TEXT", null);
        }
    }
    public record CodingChallengeResponse(Long problemId, String title, String statement, List<String> constraints,
                                           String difficulty, String methodName, String returnType,
                                           List<com.placement.dto.CodingDtos.ProblemExample> examples,
                                           java.util.Map<String, String> templates,
                                           java.util.List<com.placement.dto.CodingDtos.LanguageConfig> supportedLanguages,
                                           String savedCode, String savedLanguage, java.time.LocalDateTime deadline,
                                           String status) {}
    public record CodingChallengeResultResponse(String verdict, Double scorePercent, Integer passed, Integer total) {}
    /** durationSeconds: real elapsed time the candidate spent on this answer (from question
     *  presented to submit), measured client-side - used for Section 12's speech-pace analysis
     *  (words per minute). Optional/nullable so older clients don't break this endpoint. */
    public record SubmitAnswerRequest(Long questionId, String transcript, Double durationSeconds) {}
    public record AnswerEvaluationResponse(Long questionId, Double correctness, Double relevance, Double depth,
                                            Double clarity, Double grammar, Double confidence, Double structure,
                                            Double weightedScore, String feedback) {}
    public record ProctoringSummary(String eventType, Long count, List<String> topDetails) {}

    /** Report is split into two independently-readable halves per Section 1: technical/interview
     *  performance (technicalScore..answers/weakTopics/summary) and the integrity/violation
     *  summary (integrityScore..violationLog), so a reviewer can assess either on its own. */
    @com.fasterxml.jackson.annotation.JsonIgnoreProperties(ignoreUnknown = true)
    public record InterviewReportResponse(Long sessionId, String roleTitle, String level, Double technicalScore,
                                           Double behavioralScore, Double confidenceScore, Double overallScore,
                                           List<AnswerEvaluationResponse> answers, List<String> weakTopics, String summary,
                                           Double integrityScore, Boolean flaggedForReview,
                                           Integer fillerWordCount, Integer movementEventCount,
                                           Integer postureFlagCount, Integer tabSwitchCount,
                                           List<ProctoringSummary> proctoringSummaries,
                                           /** Every raw violation event, timestamped, with evidence links where
                                            *  captured - the ground truth the summary counts above must match exactly. */
                                           List<com.placement.dto.ProctoringDtos.ProctoringEventResponse> violationLog,
                                           /** Aggregate "time spent attempting to cheat" across all suspicious signals. */
                                           Double totalCheatTimeSeconds,
                                           /** Section 6/8: "COMPLETED" (finished normally), "EXITED", or
                                            *  "TERMINATED_VIOLATION" (auto-ended for a policy violation - see
                                            *  terminationReason). A reviewer should never have to infer which
                                            *  of these happened from the scores alone. */
                                           String completionState, String terminationReason,
                                           /** Section 9: the mid-interview domain-specific timed coding
                                            *  challenge, presented as its own distinct section - null if
                                            *  the interview never reached the trigger point (e.g. ended early). */
                                           CodingChallengeSummary codingChallenge,
                                           BehavioralAnalysisSummary behavioralAnalysis,
                                           SpeechDeliverySummary speechDelivery,
                                           LanguageQualitySummary languageQuality,
                                           String reportStatus, String exitReason) {

        public InterviewReportResponse(Long sessionId, String roleTitle, String level, Double technicalScore,
                                       Double behavioralScore, Double confidenceScore, Double overallScore,
                                       List<AnswerEvaluationResponse> answers, List<String> weakTopics, String summary,
                                       Double integrityScore, Boolean flaggedForReview,
                                       Integer fillerWordCount, Integer movementEventCount,
                                       Integer postureFlagCount, Integer tabSwitchCount,
                                       List<ProctoringSummary> proctoringSummaries,
                                       List<com.placement.dto.ProctoringDtos.ProctoringEventResponse> violationLog,
                                       Double totalCheatTimeSeconds,
                                       String completionState, String terminationReason,
                                       CodingChallengeSummary codingChallenge,
                                       BehavioralAnalysisSummary behavioralAnalysis,
                                       SpeechDeliverySummary speechDelivery,
                                       LanguageQualitySummary languageQuality) {
            this(sessionId, roleTitle, level, technicalScore, behavioralScore, confidenceScore, overallScore,
                 answers, weakTopics, summary, integrityScore, flaggedForReview, fillerWordCount, movementEventCount,
                 postureFlagCount, tabSwitchCount, proctoringSummaries, violationLog, totalCheatTimeSeconds,
                 completionState, terminationReason, codingChallenge, behavioralAnalysis, speechDelivery,
                 languageQuality, "GENERATED", terminationReason);
        }
    }
    public record CodingChallengeSummary(String problemTitle, String domain, String status, String verdict,
                                          Double scorePercent, String language, java.time.LocalDateTime deadline) {}

    /** Section 12: derived from real per-frame webcam samples (see ProctoringService#analyzeFrame),
     *  never a placeholder - framesAnalyzed=0 means no samples were taken, and the frontend should
     *  say so honestly rather than showing a fabricated percentage. */
    public record BehavioralAnalysisSummary(Integer framesAnalyzed, Double avgEyeContactScore, Double avgPostureScore,
                                             Double eyeContactPercentSessionTime, Integer postureIssueCount, Integer eyeRoamingCount) {}

    public record SpeechDeliverySummary(Integer fillerWordCount, Double avgWordsPerMinute, Double paceFluctuation,
                                         Integer possibleHesitationAnswerCount, List<AnswerPaceEntry> perAnswerPace) {}
    public record AnswerPaceEntry(Long questionId, Integer wordCount, Double durationSeconds, Double wordsPerMinute) {}

    public record LanguageQualitySummary(Double avgGrammarScore, Integer totalIssuesFound,
                                          List<AnswerLanguageIssues> perAnswerIssues) {}
    public record AnswerLanguageIssues(Long questionId, List<com.placement.service.support.LanguageQualityAnalyzer.LanguageIssue> issues) {}
}
