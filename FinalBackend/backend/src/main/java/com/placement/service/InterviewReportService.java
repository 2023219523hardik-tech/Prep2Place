package com.placement.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.placement.dto.InterviewDtos.*;
import com.placement.dto.ProctoringDtos.ProctoringEventResponse;
import com.placement.entity.*;
import com.placement.exception.ApiException;
import com.placement.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@Slf4j
@RequiredArgsConstructor
public class InterviewReportService {

    private final InterviewSessionRepository sessionRepository;
    private final InterviewReportRepository reportRepository;
    private final ProctoringEventRepository proctoringEventRepository;
    private final ProctoringService proctoringService;
    private final CodingProblemRepository codingProblemRepository;
    private final ObjectMapper objectMapper;

    private static final Set<InterviewStatus> TERMINAL_STATUSES = Set.of(
            InterviewStatus.COMPLETED,
            InterviewStatus.SUBMITTED,
            InterviewStatus.REPORT_READY,
            InterviewStatus.EXITED,
            InterviewStatus.TERMINATED_VIOLATION,
            InterviewStatus.VIOLATION_DETECTED,
            InterviewStatus.TIMEOUT,
            InterviewStatus.ADMIN_TERMINATED,
            InterviewStatus.CANCELLED
    );

    public boolean isTerminalInterviewStatus(InterviewStatus status) {
        return status != null && TERMINAL_STATUSES.contains(status);
    }

    /**
     * Idempotent report generation and retrieval.
     * If an existing GENERATED report exists, it is returned immediately.
     * Otherwise, a report is generated, persisted with GENERATED status, and returned.
     * If generation fails, report status is marked FAILED without rolling back session status.
     */
    @Transactional
    public InterviewReportResponse generateOrGetReport(Long sessionId, User requester) {
        InterviewSession session = sessionRepository.findEagerById(sessionId)
                .orElseThrow(() -> ApiException.notFound("Interview session not found with id: " + sessionId));

        if (requester != null && requester.getRole() == Role.STUDENT) {
            if (!session.getStudent().getId().equals(requester.getId())) {
                throw ApiException.forbidden("You do not have access to this interview session");
            }
        }

        // Idempotent check: if report already generated, return cached response
        Optional<InterviewReport> existingOpt = reportRepository.findBySessionId(sessionId);
        if (existingOpt.isPresent()) {
            InterviewReport existing = existingOpt.get();
            if (existing.getStatus() == ReportStatus.GENERATED && existing.getReportData() != null && !existing.getReportData().isBlank()) {
                try {
                    return objectMapper.readValue(existing.getReportData(), InterviewReportResponse.class);
                } catch (Exception e) {
                    log.warn("Failed to deserialize cached reportData for session {}, regenerating: {}", sessionId, e.getMessage());
                }
            } else if (existing.getStatus() == ReportStatus.FAILED && requester != null && requester.getRole() == Role.STUDENT) {
                // If previously failed, let's attempt to regenerate it transparently
                log.info("Retrying report generation for previously failed session {}", sessionId);
            }
        }

        return generateAndPersistReport(session);
    }

    /**
     * Safe retry mechanism for administrators or students on a FAILED report.
     */
    @Transactional
    public InterviewReportResponse retryReport(Long sessionId, User requester) {
        InterviewSession session = sessionRepository.findEagerById(sessionId)
                .orElseThrow(() -> ApiException.notFound("Interview session not found with id: " + sessionId));

        if (requester != null && requester.getRole() == Role.STUDENT) {
            if (!session.getStudent().getId().equals(requester.getId())) {
                throw ApiException.forbidden("You do not have access to this interview session");
            }
        }

        log.info("Explicit report retry requested for interview session {}", sessionId);
        return generateAndPersistReport(session);
    }

    /**
     * Core generation logic. Highly resilient to null values, missing answers,
     * or missing proctoring data.
     */
    private InterviewReportResponse generateAndPersistReport(InterviewSession session) {
        Long sessionId = session.getId();
        InterviewReport report = reportRepository.findBySessionId(sessionId)
                .orElseGet(() -> InterviewReport.builder()
                        .session(session)
                        .student(session.getStudent())
                        .status(ReportStatus.GENERATING)
                        .terminalStatus(session.getStatus() != null ? session.getStatus().name() : "COMPLETED")
                        .exitReason(session.getTerminationReason())
                        .build());

        report.setStatus(ReportStatus.GENERATING);
        report = reportRepository.save(report);

        try {
            InterviewReportResponse response = buildResilientReport(session);

            // Persist report data and summary fields
            report.setStatus(ReportStatus.GENERATED);
            report.setTerminalStatus(session.getStatus() != null ? session.getStatus().name() : "COMPLETED");
            report.setExitReason(response.exitReason());
            report.setTechnicalScore(response.technicalScore());
            report.setBehavioralScore(response.behavioralScore());
            report.setConfidenceScore(response.confidenceScore());
            report.setOverallScore(response.overallScore());
            report.setCodingScore(session.getCodingChallengeScorePercent() != null ? session.getCodingChallengeScorePercent() : 0.0);
            report.setIntegrityScore(response.integrityScore());
            report.setViolationCount(response.violationLog() != null ? response.violationLog().size() : 0);
            report.setFailureReason(null);
            report.setReportData(objectMapper.writeValueAsString(response));

            reportRepository.save(report);
            log.info("Interview report successfully generated and persisted for session {}", sessionId);
            return response;
        } catch (Exception e) {
            log.error("Interview ID: {} Status: {} Report generation failed Reason: {}",
                    sessionId, session.getStatus(), e.getMessage(), e);

            report.setStatus(ReportStatus.FAILED);
            report.setFailureReason(e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName());
            try {
                reportRepository.save(report);
            } catch (Exception saveEx) {
                log.error("Failed to save report failure status for session {}: {}", sessionId, saveEx.getMessage());
            }

            throw ApiException.internal("Report generation failed: " + e.getMessage());
        }
    }

    /**
     * Resilient report construction handling all edge cases (null fields, partial answers,
     * proctoring events, and coding challenges).
     */
    public InterviewReportResponse buildResilientReport(InterviewSession session) {
        if (session == null) {
            throw ApiException.notFound("Interview session is null");
        }

        List<InterviewAnswer> answers = session.getAnswers() != null ? session.getAnswers() : Collections.emptyList();

        List<AnswerEvaluationResponse> answerResponses = answers.stream()
                .map(a -> {
                    Long qid = a.getQuestion() != null ? a.getQuestion().getId() : -1L;
                    Double correctness = a.getCorrectness() != null ? a.getCorrectness() : 0.0;
                    Double relevance = a.getRelevance() != null ? a.getRelevance() : 0.0;
                    Double depth = a.getDepth() != null ? a.getDepth() : 0.0;
                    Double clarity = a.getClarity() != null ? a.getClarity() : 0.0;
                    Double grammar = a.getGrammar() != null ? a.getGrammar() : 0.0;
                    Double confidence = a.getConfidence() != null ? a.getConfidence() : 0.0;
                    Double structure = a.getStructure() != null ? a.getStructure() : 0.0;
                    Double weightedScore = a.getWeightedScore() != null ? a.getWeightedScore() : 0.0;
                    String feedback = a.getFeedback() != null ? a.getFeedback() : "No feedback recorded";
                    return new AnswerEvaluationResponse(qid, correctness, relevance, depth, clarity,
                            grammar, confidence, structure, weightedScore, feedback);
                }).toList();

        List<String> weakTopics = answers.stream()
                .filter(a -> a.getWeightedScore() != null && a.getWeightedScore() < 60)
                .map(a -> {
                    QuestionCategory raw = a.getQuestion() != null ? a.getQuestion().getCategory() : null;
                    return (raw != null ? raw.name() : "GENERAL");
                })
                .distinct().toList();

        // Safe aggregate scores
        Double technicalScore = session.getTechnicalScore();
        Double behavioralScore = session.getBehavioralScore();
        Double confidenceScore = session.getConfidenceScore();
        Double overallScore = session.getOverallScore();

        if (overallScore == null) {
            if (!answers.isEmpty()) {
                technicalScore = Math.round(answers.stream().mapToDouble(a -> a.getCorrectness() != null ? a.getCorrectness() : 0.0).average().orElse(0.0) * 10.0) / 10.0;
                behavioralScore = Math.round(answers.stream().mapToDouble(a -> a.getStructure() != null ? a.getStructure() : 0.0).average().orElse(0.0) * 10.0) / 10.0;
                confidenceScore = Math.round(answers.stream().mapToDouble(a -> a.getConfidence() != null ? a.getConfidence() : 0.0).average().orElse(0.0) * 10.0) / 10.0;
                overallScore = Math.round(answers.stream().mapToDouble(a -> a.getWeightedScore() != null ? a.getWeightedScore() : 0.0).average().orElse(0.0) * 10.0) / 10.0;
            } else {
                technicalScore = 0.0;
                behavioralScore = 0.0;
                confidenceScore = 0.0;
                overallScore = 0.0;
            }
        }

        InterviewStatus status = session.getStatus() != null ? session.getStatus() : InterviewStatus.COMPLETED;
        String completionState = status.name();
        String exitReason;

        if (status == InterviewStatus.TERMINATED_VIOLATION || status == InterviewStatus.VIOLATION_DETECTED) {
            exitReason = session.getTerminationReason() != null ? session.getTerminationReason() : "Policy violation detected";
        } else if (status == InterviewStatus.EXITED) {
            exitReason = session.getTerminationReason() != null ? session.getTerminationReason() : "Candidate exited early";
        } else if (status == InterviewStatus.TIMEOUT) {
            exitReason = "Session timed out due to inactivity";
        } else if (status == InterviewStatus.ADMIN_TERMINATED) {
            exitReason = "Terminated by administrator";
        } else {
            exitReason = "Completed normally";
        }

        String summary;
        if (status == InterviewStatus.TERMINATED_VIOLATION || status == InterviewStatus.VIOLATION_DETECTED) {
            summary = (answerResponses.isEmpty()
                    ? "This session was ended due to a policy violation before any question was answered."
                    : "This session was ended due to a policy violation after " + answerResponses.size()
                    + " question(s) were answered — scores reflect work legitimately completed prior to violation.")
                    + " (" + exitReason + ")";
        } else if (status == InterviewStatus.EXITED) {
            summary = answerResponses.isEmpty()
                    ? "This interview was exited before answering questions. Safe defaults recorded."
                    : "Candidate exited interview after answering " + answerResponses.size()
                    + " question(s). Partial scores computed from submitted responses.";
        } else {
            summary = overallScore >= 75
                    ? "Strong performance overall. Demonstrates solid technical proficiency."
                    : overallScore >= 50
                    ? "Solid attempt with room for improvement in recommended weak areas."
                    : "Significant preparation gaps detected — focus on suggested topics before retrying.";
        }

        // Proctoring data collection
        List<ProctoringEvent> allEvents = proctoringEventRepository.findBySessionIdOrderByOccurredAtAsc(session.getId());
        boolean casualAttireRecorded = allEvents.stream()
                .anyMatch(e -> e.getEventType() == ProctoringEventType.FORMAL_DRESS_NOT_DETECTED)
                || "CASUAL".equalsIgnoreCase(session.getFormalDressClassification());
        if (casualAttireRecorded) {
            summary = summary + " (Note: Candidate attended interview in casual attire; dress code penalty of -5 marks was deducted from integrity).";
        }

        Map<ProctoringEventType, List<ProctoringEvent>> eventsByType = allEvents.stream()
                .collect(Collectors.groupingBy(ProctoringEvent::getEventType));

        List<ProctoringSummary> proctoringSummaries = new ArrayList<>();
        for (Map.Entry<ProctoringEventType, List<ProctoringEvent>> entry : eventsByType.entrySet()) {
            String eventType = entry.getKey().name();
            long count = entry.getValue().size();
            List<String> topDetails = entry.getValue().stream()
                    .map(ProctoringEvent::getDetails)
                    .filter(d -> d != null && !d.isBlank())
                    .sorted(Comparator.reverseOrder())
                    .limit(3)
                    .toList();
            proctoringSummaries.add(new ProctoringSummary(eventType, count, topDetails));
        }
        proctoringSummaries.sort(Comparator.comparingLong((ProctoringSummary s) -> s.count()).reversed());

        Integer fillerWordCount = session.getFillerWordCount() != null ? session.getFillerWordCount() : 0;
        Integer movementEventCount = session.getMovementEventCount() != null ? session.getMovementEventCount() : 0;
        Integer postureFlagCount = session.getPostureFlagCount() != null ? session.getPostureFlagCount() : 0;
        Integer tabSwitchCount = session.getTabSwitchCount() != null ? session.getTabSwitchCount() : 0;

        List<ProctoringEventResponse> violationLog = allEvents.stream()
                .map(proctoringService::toResponse)
                .toList();
        Double totalCheatTimeSeconds = proctoringService.computeTotalCheatTimeSeconds(allEvents);

        // Behavioral webcam analysis
        BehavioralAnalysisSummary behavioralAnalysis = null;
        int framesAnalyzed = session.getFramesAnalyzedCount() != null ? session.getFramesAnalyzedCount() : 0;
        if (framesAnalyzed > 0) {
            double avgEyeContact = (session.getEyeContactScoreSum() != null ? session.getEyeContactScoreSum() : 0.0) / framesAnalyzed;
            double avgPosture = (session.getPostureScoreSum() != null ? session.getPostureScoreSum() : 0.0) / framesAnalyzed;
            long eyeRoamCount = allEvents.stream().filter(e -> e.getEventType() == ProctoringEventType.EYE_ROAMING).count();
            long postureIssueCount = allEvents.stream().filter(e -> e.getEventType() == ProctoringEventType.POSTURE_DRIFT).count();
            double eyeContactPercent = Math.round((1.0 - ((double) eyeRoamCount / framesAnalyzed)) * 1000) / 10.0;
            behavioralAnalysis = new BehavioralAnalysisSummary(framesAnalyzed,
                    Math.round(avgEyeContact * 10) / 10.0, Math.round(avgPosture * 10) / 10.0,
                    Math.max(0, eyeContactPercent), (int) postureIssueCount, (int) eyeRoamCount);
        }

        // Speech delivery analysis
        List<AnswerPaceEntry> paceEntries = new ArrayList<>();
        for (InterviewAnswer a : answers) {
            if (a.getDurationSeconds() == null || a.getDurationSeconds() <= 0 || a.getTranscript() == null || a.getTranscript().isBlank()) continue;
            int wordCount = a.getTranscript().trim().split("\\s+").length;
            double wpm = Math.round((wordCount / (a.getDurationSeconds() / 60.0)) * 10) / 10.0;
            Long qid = a.getQuestion() != null ? a.getQuestion().getId() : -1L;
            paceEntries.add(new AnswerPaceEntry(qid, wordCount, a.getDurationSeconds(), wpm));
        }
        SpeechDeliverySummary speechDelivery = null;
        if (!paceEntries.isEmpty() || fillerWordCount > 0) {
            double avgWpm = paceEntries.isEmpty() ? 0 :
                    Math.round(paceEntries.stream().mapToDouble(AnswerPaceEntry::wordsPerMinute).average().orElse(0) * 10) / 10.0;
            double fluctuation = 0;
            if (paceEntries.size() > 1) {
                double mean = avgWpm;
                double variance = paceEntries.stream().mapToDouble(p -> Math.pow(p.wordsPerMinute() - mean, 2)).sum() / paceEntries.size();
                fluctuation = Math.round(Math.sqrt(variance) * 10) / 10.0;
            }
            long hesitationCount = paceEntries.stream().filter(p -> p.wordsPerMinute() < 80).count();
            speechDelivery = new SpeechDeliverySummary(fillerWordCount, avgWpm, fluctuation, (int) hesitationCount, paceEntries);
        }

        // Language analysis
        List<AnswerLanguageIssues> languageIssuesList = new ArrayList<>();
        int totalIssues = 0;
        for (InterviewAnswer a : answers) {
            if (a.getTranscript() != null && !a.getTranscript().isBlank()) {
                var issues = com.placement.service.support.LanguageQualityAnalyzer.analyze(a.getTranscript());
                if (!issues.isEmpty()) {
                    Long qid = a.getQuestion() != null ? a.getQuestion().getId() : -1L;
                    languageIssuesList.add(new AnswerLanguageIssues(qid, issues));
                    totalIssues += issues.size();
                }
            }
        }
        LanguageQualitySummary languageQuality = answers.isEmpty() ? null : new LanguageQualitySummary(
                Math.round(answers.stream().filter(a -> a.getGrammar() != null)
                        .mapToDouble(InterviewAnswer::getGrammar).average().orElse(0) * 10) / 10.0,
                totalIssues, languageIssuesList);

        // Coding challenge summary
        CodingChallengeSummary codingChallengeSummary = null;
        if (session.getCodingChallengeStatus() != null) {
            String title = null;
            if (session.getCodingChallengeProblemId() != null) {
                title = codingProblemRepository.findById(session.getCodingChallengeProblemId())
                        .map(CodingProblem::getTitle).orElse(null);
            }
            codingChallengeSummary = new CodingChallengeSummary(
                    title,
                    session.getRole() != null && session.getRole().getDomain() != null ? session.getRole().getDomain() : "SDE",
                    session.getCodingChallengeStatus().name(),
                    session.getCodingChallengeVerdict(),
                    session.getCodingChallengeScorePercent(),
                    session.getCodingChallengeLanguage(),
                    session.getCodingChallengeDeadline());
        }

        Double integrityScoreVal = session.getIntegrityScore() != null ? session.getIntegrityScore() : 100.0;
        String roleTitle = session.getRole() != null ? session.getRole().getTitle() : "General";
        String levelVal = session.getLevel() != null ? session.getLevel() : "Intermediate";

        return new InterviewReportResponse(
                session.getId(),
                roleTitle,
                levelVal,
                technicalScore,
                behavioralScore,
                confidenceScore,
                overallScore,
                answerResponses,
                weakTopics,
                summary,
                integrityScoreVal,
                session.isFlaggedForReview(),
                fillerWordCount,
                movementEventCount,
                postureFlagCount,
                tabSwitchCount,
                proctoringSummaries,
                violationLog,
                totalCheatTimeSeconds != null ? totalCheatTimeSeconds : 0.0,
                completionState,
                session.getTerminationReason(),
                codingChallengeSummary,
                behavioralAnalysis,
                speechDelivery,
                languageQuality,
                "GENERATED",
                exitReason
        );
    }
}
