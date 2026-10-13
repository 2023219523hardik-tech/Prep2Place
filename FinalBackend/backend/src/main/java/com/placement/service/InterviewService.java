package com.placement.service;

import com.placement.dto.InterviewDtos.*;
import com.placement.entity.*;
import com.placement.exception.ApiException;
import com.placement.repository.*;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.Locale;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@Slf4j
@RequiredArgsConstructor
public class InterviewService {

    private final InterviewSessionRepository sessionRepository;
    private final QuestionRepository questionRepository;
    private final JobRoleRepository jobRoleRepository;
    private final ScoreWeightConfigRepository weightConfigRepository;
    private final AnswerEvaluationService evaluationService;
    private final SpeechToTextService speechToTextService;
    private final VideoAnalysisService videoAnalysisService;
    private final ProctoringService proctoringService;
    private final ProctoringEventRepository proctoringEventRepository;
    private final com.placement.questionbank.service.QuestionBankQueryService questionBankQueryService;
    private final CodingService codingService;
    private final CodingProblemRepository codingProblemRepository;
    private final StudentProfileService studentProfileService;
    private final InterviewReportService interviewReportService;

    // Section 9: how many answered Q&A questions trigger the mid-interview domain coding
    // challenge. Interviews here are open-ended (no fixed total question count - see
    // questionCountFor), so this is a position, not a fraction of a fixed total.
    private static final int CODING_CHALLENGE_TRIGGER_ANSWER_COUNT = 3;
    private static final int CODING_CHALLENGE_DURATION_MINUTES = 20;
    private static final int ABANDONMENT_TIMEOUT_MINUTES = 10;

    @Transactional
    public SessionResponse startInterview(User student, StartInterviewRequest request) {
        // Section 4: same gate as mock tests (AssessmentEngineService.startOrResume) - a real,
        // gradable session must not be startable with an incomplete profile, whether or not the
        // candidate went through the UI.
        studentProfileService.requireCompleteProfile(student);
        JobRole role = null;
        if (request.roleId() != null) {
            role = jobRoleRepository.findById(request.roleId()).orElseThrow(() -> ApiException.notFound("Job role not found"));
        }
        InterviewSession session = InterviewSession.builder()
                .student(student).role(role).level(request.level() == null ? "Intermediate" : request.level())
            .resumeText(limitContext(request.resumeText()))
            .jobDescription(limitContext(request.jobDescription()))
                .status(InterviewStatus.CREATED)
                .proctoringStatus(com.placement.entity.ProctoringState.NOT_STARTED)
                .proctoringCompleted(false)
                .lastSeenAt(java.time.LocalDateTime.now())
                .build();
        session = sessionRepository.save(session);
        return toSessionResponse(session, questionCountFor(session));
    }

    @Transactional(readOnly = true)
    public SessionResponse getSession(Long sessionId, User student) {
        InterviewSession session = requireOwnedSession(sessionId, student);
        return toSessionResponse(session, questionCountFor(session));
    }

    @Transactional
    public QuestionResponse nextQuestion(Long sessionId, User student) {
        InterviewSession session = requireOwnedSession(sessionId, student);
        if (!session.isProctoringCompleted()) {
            throw ApiException.conflict("PROCTORING_NOT_COMPLETED", "Interview cannot start until all proctoring checks are completed.");
        }
        if (session.getStatus() == InterviewStatus.CREATED || session.getStatus() == InterviewStatus.READY) {
            session.setStatus(InterviewStatus.IN_PROGRESS);
        }
        if (session.getStatus() == InterviewStatus.COMPLETED || session.getStatus() == InterviewStatus.SUBMITTED
            || session.getStatus() == InterviewStatus.REPORT_READY || session.getStatus() == InterviewStatus.EXITED
            || session.getStatus() == InterviewStatus.CANCELLED || session.getStatus() == InterviewStatus.TERMINATED_VIOLATION) {
            throw ApiException.badRequest("Submitted interviews cannot receive new questions");
        }
        session.setLastSeenAt(java.time.LocalDateTime.now());

        // Section 9: mid-interview domain-specific timed coding challenge. Checked first so a
        // page reload while the challenge is active re-shows the SAME challenge (idempotent)
        // instead of silently skipping it or double-assigning a second one.
        expireCodingChallengeIfPastDeadline(session);
        if (session.getCodingChallengeStatus() == InterviewSession.CodingChallengeStatus.ASSIGNED) {
            return buildCodingChallengeQuestionResponse(session);
        }
        if (session.getCodingChallengeStatus() == null
                && session.getAnswers().size() == CODING_CHALLENGE_TRIGGER_ANSWER_COUNT) {
            QuestionResponse assigned = tryAssignCodingChallenge(session);
            if (assigned != null) return assigned;
            // No suitable problem was available (e.g. thin question bank) - fall through to a
            // normal question rather than blocking the interview on a challenge that can't be served.
            session.setCodingChallengeStatus(InterviewSession.CodingChallengeStatus.EXPIRED);
            sessionRepository.save(session);
        }

        List<Question> pool = session.getRole() != null
                ? questionRepository.findByRoleId(session.getRole().getId())
                : questionRepository.findByPublishedTrue();
        List<Long> answeredIds = session.getAnswers().stream().map(a -> a.getQuestion().getId()).toList();
        List<Question> available = pool.stream().filter(q -> !answeredIds.contains(q.getId())).collect(Collectors.toList());
        if (available.isEmpty()) {
            throw ApiException.badRequest("No more questions available for this session");
        }
        Difficulty targetDifficulty = Difficulty.valueOf(session.getCurrentDifficulty() != null
                ? session.getCurrentDifficulty() : "EASY");
        Question next = orderQuestions(available, session).stream()
                .filter(q -> q.getDifficulty() == targetDifficulty)
                .findFirst()
            .orElse(orderQuestions(available, session).get(0));
        String category = (next.getCategory() != null) ? next.getCategory().name() : "GENERAL";
        String difficulty = (next.getDifficulty() != null) ? next.getDifficulty().name() : "MEDIUM";
        return new QuestionResponse(next.getId(), next.getText(), category, difficulty);
    }

    /** SDE roles (and no-role/general interviews) draw from the DSA pool; Data and Machine
     *  Learning roles get a domain-appropriate problem instead - see JobRole.domain, set at seed
     *  time (Section 9). Falls back to "SDE" for any domain string that doesn't match, since DSA
     *  fundamentals are broadly relevant regardless of specific track. */
    private String determineInterviewDomain(InterviewSession session) {
        String domain = session.getRole() != null ? session.getRole().getDomain() : null;
        if (domain == null) return "SDE";
        String lower = domain.toLowerCase(Locale.ROOT);
        if (lower.contains("machine learning") || lower.contains("ml")) return "ML";
        if (lower.contains("data")) return "DATA";
        return "SDE";
    }

    private QuestionResponse tryAssignCodingChallenge(InterviewSession session) {
        String domain = determineInterviewDomain(session);
        String topic = switch (domain) {
            case "DATA" -> "Data Analysis";
            case "ML" -> "Applied ML";
            default -> null; // SDE: any DSA topic
        };
        List<CodingProblem> candidates = topic != null
                ? codingProblemRepository.findAll().stream().filter(p -> topic.equalsIgnoreCase(p.getTopic())).toList()
                : codingProblemRepository.findAll().stream()
                        .filter(p -> !"Data Analysis".equalsIgnoreCase(p.getTopic()) && !"Applied ML".equalsIgnoreCase(p.getTopic()))
                        .toList();
        if (candidates.isEmpty()) return null;
        CodingProblem chosen = candidates.get(new java.util.Random().nextInt(candidates.size()));

        session.setCodingChallengeProblemId(chosen.getId());
        session.setCodingChallengeStatus(InterviewSession.CodingChallengeStatus.ASSIGNED);
        session.setCodingChallengeDeadline(java.time.LocalDateTime.now().plusMinutes(CODING_CHALLENGE_DURATION_MINUTES));
        sessionRepository.save(session);
        return buildCodingChallengeQuestionResponse(session);
    }

    private QuestionResponse buildCodingChallengeQuestionResponse(InterviewSession session) {
        CodingProblem problem = codingProblemRepository.findById(session.getCodingChallengeProblemId())
                .orElseThrow(() -> ApiException.notFound("Coding challenge problem not found"));
        var metadata = codingService.problemMetadata(problem.getId());
        CodingChallengeResponse challenge = new CodingChallengeResponse(
                problem.getId(), metadata.title(), metadata.description(), metadata.constraints(),
                metadata.difficulty(), problem.getMethodName(), problem.getReturnType(),
                metadata.examples(), metadata.templates(), metadata.supportedLanguages(),
                session.getCodingChallengeCode(), session.getCodingChallengeLanguage(),
                session.getCodingChallengeDeadline(), session.getCodingChallengeStatus().name());
        return new QuestionResponse(-problem.getId(), // negative sentinel id - not a real Question row, never collides
                "Domain coding challenge: " + metadata.title(), "TECHNICAL", metadata.difficulty(), "CODING", challenge);
    }

    private void expireCodingChallengeIfPastDeadline(InterviewSession session) {
        if (session.getCodingChallengeStatus() == InterviewSession.CodingChallengeStatus.ASSIGNED
                && session.getCodingChallengeDeadline() != null
                && java.time.LocalDateTime.now().isAfter(session.getCodingChallengeDeadline())) {
            session.setCodingChallengeStatus(InterviewSession.CodingChallengeStatus.EXPIRED);
            session.setCodingChallengeVerdict("EXPIRED_NO_SUBMISSION");
            session.setCodingChallengeScorePercent(0.0);
            sessionRepository.save(session);
        }
    }

    /** Runs the candidate's current code against the challenge's visible test case - never
     *  changes challenge status, purely a "does this work" check like the standalone Coding
     *  module's Run button. */
    @Transactional
    public com.placement.dto.CodingDtos.RunCodeResponse runCodingChallenge(Long sessionId, User student, String language, String code) {
        InterviewSession session = requireOwnedSession(sessionId, student);
        requireActiveCodingChallenge(session);
        session.setCodingChallengeCode(code);
        session.setCodingChallengeLanguage(language);
        sessionRepository.save(session);
        return codingService.runVisibleTests(new com.placement.dto.CodingDtos.RunCodeRequest(
                session.getCodingChallengeProblemId(), language, code, null));
    }

    /** Section 9: auto-submit-and-score, called either by the candidate hitting Submit or by the
     *  frontend's 20:00 countdown firing automatically - same path either way, so a candidate who
     *  lets the timer run out is scored on whatever code was last saved, not zeroed out just
     *  because they didn't click a button. */
    @Transactional
    public CodingChallengeResultResponse submitCodingChallenge(Long sessionId, User student, String language, String code) {
        InterviewSession session = requireOwnedSession(sessionId, student);
        requireActiveCodingChallenge(session);

        var result = codingService.submitCode(student, new com.placement.dto.CodingDtos.SubmitCodeRequest(
                session.getCodingChallengeProblemId(), code, language));

        double scorePercent = result.total() != null && result.total() > 0
                ? Math.round((result.passed() * 1000.0) / result.total()) / 10.0 : 0.0;

        session.setCodingChallengeCode(code);
        session.setCodingChallengeLanguage(language);
        session.setCodingChallengeStatus(InterviewSession.CodingChallengeStatus.SUBMITTED);
        session.setCodingChallengeVerdict(result.status());
        session.setCodingChallengeScorePercent(scorePercent);
        sessionRepository.save(session);

        return new CodingChallengeResultResponse(result.status(), scorePercent, result.passed(), result.total());
    }

    private void requireActiveCodingChallenge(InterviewSession session) {
        expireCodingChallengeIfPastDeadline(session);
        if (session.getCodingChallengeStatus() != InterviewSession.CodingChallengeStatus.ASSIGNED) {
            throw ApiException.badRequest("No active coding challenge for this session");
        }
    }

    /**
     * DSA/coding-stage question, sourced from the centralized Question Intelligence bank
     * (same canonical pool Coding Mock Tests draw from) instead of a separate hand-authored DSA
     * set - per spec: "Technical and DSA questions should use the same centralized DSA question
     * intelligence system instead of maintaining a completely separate question bank."
     *
     * A canonical question is lazily "materialized" into a local Question row the first time it's
     * ever asked in any interview (linked via canonicalQuestionId), because InterviewAnswer requires
     * a Question foreign key - this keeps that referential integrity without duplicating the
     * canonical bank's content by hand.
     */
    @Transactional
    public QuestionResponse nextDsaQuestion(Long sessionId, User student) {
        InterviewSession session = requireOwnedSession(sessionId, student);
        if (!session.isProctoringCompleted()) {
            throw ApiException.conflict("PROCTORING_NOT_COMPLETED", "Interview cannot start until all proctoring checks are completed.");
        }
        if (session.getStatus() != InterviewStatus.IN_PROGRESS) {
            throw ApiException.badRequest("Interview must be in progress to request a DSA question");
        }

        Set<Long> alreadyAskedCanonicalIds = session.getAnswers().stream()
                .map(a -> a.getQuestion().getCanonicalQuestionId())
                .filter(java.util.Objects::nonNull)
                .collect(Collectors.toSet());

        Difficulty targetDifficulty = Difficulty.valueOf(session.getCurrentDifficulty() != null ? session.getCurrentDifficulty() : "EASY");
        List<com.placement.questionbank.entity.CanonicalQuestion> picks = questionBankQueryService.selectRandom(
                com.placement.questionbank.entity.QuestionDomain.CODING, targetDifficulty, 1, alreadyAskedCanonicalIds);
        if (picks.isEmpty()) {
            // fall back to any difficulty within the coding domain rather than failing the interview
            picks = questionBankQueryService.selectRandom(com.placement.questionbank.entity.QuestionDomain.CODING, null, 1, alreadyAskedCanonicalIds);
        }
        if (picks.isEmpty()) {
            throw ApiException.badRequest("No DSA/coding questions are currently available in the question bank");
        }

        com.placement.questionbank.entity.CanonicalQuestion canonical = picks.get(0);
        Question materialized = questionRepository.findByCanonicalQuestionId(canonical.getId())
                .orElseGet(() -> questionRepository.save(Question.builder()
                        .text("DSA / Coding: " + canonical.getCanonicalTitle() +
                                ". Walk through your approach out loud, then explain the time and space complexity of your solution.")
                        .category(QuestionCategory.DSA)
                        .difficulty(canonical.getDifficulty() == null ? Difficulty.MEDIUM : canonical.getDifficulty())
                        .role(session.getRole())
                        .published(true)
                        .canonicalQuestionId(canonical.getId())
                        .build()));

        String category = (materialized.getCategory() != null) ? materialized.getCategory().name() : "GENERAL";
        String difficulty = (materialized.getDifficulty() != null) ? materialized.getDifficulty().name() : "MEDIUM";
        return new QuestionResponse(materialized.getId(), materialized.getText(), category, difficulty);
    }

    @Transactional
    public AnswerEvaluationResponse submitAnswer(Long sessionId, User student, SubmitAnswerRequest request, boolean fromAudio, byte[] mediaBytes) {
        InterviewSession session = requireOwnedSession(sessionId, student);
        if (!session.isProctoringCompleted()) {
            throw ApiException.conflict("PROCTORING_NOT_COMPLETED", "Interview cannot progress until all proctoring checks are completed.");
        }
        if (session.getStatus() == InterviewStatus.COMPLETED || session.getStatus() == InterviewStatus.SUBMITTED
                || session.getStatus() == InterviewStatus.REPORT_READY) {
            throw ApiException.badRequest("Submitted interviews cannot be edited");
        }
        // Universal anti-cheat (Section 6): once terminated for a policy violation, nothing
        // submitted afterward is scored or credited - see Section 8's partial-completion rule.
        if (session.getStatus() == InterviewStatus.TERMINATED_VIOLATION) {
            throw ApiException.badRequest("This session was ended due to a policy violation and cannot accept further answers");
        }
        if (session.getStatus() == InterviewStatus.PAUSED || session.getStatus() == InterviewStatus.EXITED) {
            throw ApiException.badRequest("Resume the interview before submitting an answer");
        }
        session.setLastSeenAt(java.time.LocalDateTime.now());
        Question question = questionRepository.findById(request.questionId()).orElseThrow(() -> ApiException.notFound("Question not found"));

        String transcript = request.transcript();
        if (fromAudio && mediaBytes != null) transcript = speechToTextService.transcribe(mediaBytes, "audio/wav");

        AnswerEvaluationService.Evaluation eval = evaluationService.evaluate(question, transcript);

        double confidence;
        if (mediaBytes != null) {
            confidence = videoAnalysisService.analyze(mediaBytes).confidenceScore();
        } else {
            confidence = Math.round(((eval.clarity() + eval.structure()) / 2.0) * 10.0) / 10.0;
        }

        ScoreWeightConfig weights = currentWeights();
        double weighted = evaluationService.weightedScoreWithConfidence(eval, confidence, weights);

        InterviewAnswer answer = InterviewAnswer.builder()
                .session(session).question(question).transcript(transcript).fromAudio(fromAudio)
                .correctness(eval.correctness()).relevance(eval.relevance()).depth(eval.depth())
                .clarity(eval.clarity()).grammar(eval.grammar()).confidence(confidence).structure(eval.structure())
                .weightedScore(weighted).feedback(eval.feedback()).durationSeconds(request.durationSeconds()).build();

        session.getAnswers().add(answer);

        String current = session.getCurrentDifficulty() != null ? session.getCurrentDifficulty() : "EASY";
        String newDifficulty = current;
        if (weighted >= 75) {
            if ("EASY".equals(current)) newDifficulty = "MEDIUM";
            else if ("MEDIUM".equals(current)) newDifficulty = "HARD";
        } else if (weighted < 40) {
            if ("HARD".equals(current)) newDifficulty = "MEDIUM";
            else if ("MEDIUM".equals(current)) newDifficulty = "EASY";
        }
        session.setCurrentDifficulty(newDifficulty);

        sessionRepository.save(session);

        return new AnswerEvaluationResponse(question.getId(), eval.correctness(), eval.relevance(), eval.depth(),
                eval.clarity(), eval.grammar(), confidence, eval.structure(), weighted, eval.feedback());
    }

    @Transactional
    public InterviewReportResponse completeInterview(Long sessionId, User student) {
        InterviewSession session = requireOwnedSession(sessionId, student);
        if (session.getStatus() == InterviewStatus.SUBMITTED || session.getStatus() == InterviewStatus.REPORT_READY) {
            return interviewReportService.generateOrGetReport(sessionId, student);
        }
        List<InterviewAnswer> answers = session.getAnswers();
        if (answers.isEmpty()) throw ApiException.badRequest("Cannot complete an interview with no answers submitted");

        session.setTechnicalScore(avg(answers, InterviewAnswer::getCorrectness));
        session.setBehavioralScore(avg(answers, InterviewAnswer::getStructure));
        session.setConfidenceScore(avg(answers, InterviewAnswer::getConfidence));
        session.setOverallScore(avg(answers, InterviewAnswer::getWeightedScore));
        session.setStatus(InterviewStatus.COMPLETED);
        session.setCompletedAt(java.time.LocalDateTime.now());
        sessionRepository.save(session);
        proctoringService.finalizeForSession(session);

        return interviewReportService.generateOrGetReport(sessionId, student);
    }

    @Transactional
    public SessionResponse pauseInterview(Long sessionId, User student) {
        InterviewSession session = requireOwnedSession(sessionId, student);
        if (session.getStatus() == InterviewStatus.SUBMITTED || session.getStatus() == InterviewStatus.REPORT_READY) {
            throw ApiException.badRequest("Submitted interviews cannot be paused");
        }
        session.setStatus(InterviewStatus.PAUSED);
        sessionRepository.save(session);
        return toSessionResponse(session, questionCountFor(session));
    }

    @Transactional
    public SessionResponse resumeInterview(Long sessionId, User student) {
        InterviewSession session = requireOwnedSession(sessionId, student);
        if (session.getStatus() != InterviewStatus.PAUSED
                && session.getStatus() != InterviewStatus.RESUMABLE
                && session.getStatus() != InterviewStatus.EXITED) {
            throw ApiException.badRequest("Interview is not resumable");
        }
        session.setStatus(InterviewStatus.IN_PROGRESS);
        session.setLastSeenAt(java.time.LocalDateTime.now());
        sessionRepository.save(session);
        return toSessionResponse(session, questionCountFor(session));
    }

    @Transactional
    public SessionResponse exitInterview(Long sessionId, User student) {
        InterviewSession session = requireOwnedSession(sessionId, student);
        if (session.getStatus() == InterviewStatus.SUBMITTED || session.getStatus() == InterviewStatus.REPORT_READY) {
            throw ApiException.badRequest("Submitted interviews cannot be exited");
        }
        if (session.getStatus() == InterviewStatus.TERMINATED_VIOLATION || session.getStatus() == InterviewStatus.VIOLATION_DETECTED) {
            throw ApiException.badRequest("This session already ended due to a policy violation");
        }
        session.setStatus(InterviewStatus.EXITED);
        session.setCompletedAt(java.time.LocalDateTime.now());
        sessionRepository.save(session);
        finalizePartialScores(sessionId);

        try {
            interviewReportService.generateOrGetReport(sessionId, student);
        } catch (Exception e) {
            log.error("Failed to generate report for exited session {}: {}", sessionId, e.getMessage());
        }

        return toSessionResponse(session, questionCountFor(session));
    }

    /** Lightweight heartbeat so the abandonment sweeper doesn't reap a session the candidate is
     *  actively using. Also called implicitly by nextQuestion/submitAnswer/resume. */
    @Transactional
    public void heartbeat(Long sessionId, User student) {
        InterviewSession session = requireOwnedSession(sessionId, student);
        if (session.getStatus() == InterviewStatus.IN_PROGRESS) {
            session.setLastSeenAt(java.time.LocalDateTime.now());
            sessionRepository.save(session);
        }
    }

    /** Interview abandonment sweeper. A session left IN_PROGRESS with no heartbeat for longer than
     *  the timeout is treated as an exit: scores are finalized from whatever answers exist and the
     *  session is marked EXITED so the candidate can resume or view the report. Runs every 60s. */
    @Scheduled(fixedDelay = 60_000L)
    public void sweepAbandonedSessions() {
        java.time.LocalDateTime cutoff = java.time.LocalDateTime.now().minusMinutes(ABANDONMENT_TIMEOUT_MINUTES);
        List<InterviewSession> stale = sessionRepository
                .findStaleSessions(InterviewStatus.IN_PROGRESS, cutoff);
        if (stale.isEmpty()) return;
        log.info("Interview abandonment sweep: {} stale session(s)", stale.size());
        for (InterviewSession session : stale) {
            try {
                session.setStatus(InterviewStatus.EXITED);
                session.setCompletedAt(java.time.LocalDateTime.now());
                sessionRepository.save(session);
                finalizePartialScores(session.getId());
                log.info("Interview session {} abandoned and finalized", session.getId());
            } catch (Exception e) {
                log.warn("Failed to finalize abandoned interview session {}: {}", session.getId(), e.getMessage());
            }
        }
    }

    @Transactional
    public InterviewReportResponse submitInterview(Long sessionId, User student) {
        InterviewReportResponse report = completeInterview(sessionId, student);
        InterviewSession session = requireOwnedSession(sessionId, student);
        session.setStatus(InterviewStatus.SUBMITTED);
        sessionRepository.save(session);
        session.setStatus(InterviewStatus.REPORT_READY);
        sessionRepository.save(session);
        return interviewReportService.generateOrGetReport(sessionId, student);
    }

    @Transactional
    public InterviewReportResponse getReport(Long sessionId, User student) {
        InterviewSession session = requireOwnedSession(sessionId, student);
        if (!interviewReportService.isTerminalInterviewStatus(session.getStatus())) {
            throw ApiException.badRequest("Interview is not completed yet");
        }
        return interviewReportService.generateOrGetReport(sessionId, student);
    }

    /** Universal anti-cheat (Section 6): called right after a session is auto-terminated for a
     *  policy violation, so a report is immediately available. Scores only what was legitimately
     *  answered before the trigger point (Section 8) - it does not throw on zero answers the way
     *  {@link #completeInterview} does, since "terminated before answering anything" is a valid,
     *  reportable outcome here, not an error. */
    @Transactional
    public void finalizePartialScores(Long sessionId) {
        InterviewSession session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> ApiException.notFound("Interview session not found"));
        List<InterviewAnswer> answers = session.getAnswers();
        if (!answers.isEmpty()) {
            session.setTechnicalScore(avg(answers, InterviewAnswer::getCorrectness));
            session.setBehavioralScore(avg(answers, InterviewAnswer::getStructure));
            session.setConfidenceScore(avg(answers, InterviewAnswer::getConfidence));
            session.setOverallScore(avg(answers, InterviewAnswer::getWeightedScore));
        } else {
            // Section 8 edge case: terminated (or exited) before answering anything is a valid,
            // reportable outcome, not an error - score explicitly as 0 rather than leaving these
            // null, which would otherwise NPE when the report page reads them.
            session.setTechnicalScore(0.0);
            session.setBehavioralScore(0.0);
            session.setConfidenceScore(0.0);
            session.setOverallScore(0.0);
        }
        session.setCompletedAt(java.time.LocalDateTime.now());
        sessionRepository.save(session);
        proctoringService.finalizeForSession(session);

        try {
            interviewReportService.generateOrGetReport(sessionId, null);
        } catch (Exception e) {
            log.error("Failed to generate report in finalizePartialScores for session {}: {}", sessionId, e.getMessage());
        }
    }

    @Transactional(readOnly = true)
    public List<SessionResponse> history(User student) {
        return sessionRepository.findByStudentIdOrderByCreatedAtDesc(student.getId()).stream()
                .map(s -> toSessionResponse(s, questionCountFor(s))).toList();
    }

    private InterviewReportResponse buildReport(InterviewSession session) {
        if (session == null) {
            throw new EntityNotFoundException("Session not found");
        }
        return interviewReportService.generateOrGetReport(session.getId(), null);
    }

    /** Exposed so other services (e.g. ProctoringController) can enforce the same ownership check. */
    public InterviewSession requireOwnedSession(Long sessionId, User student) {
        InterviewSession session = sessionRepository.findEagerById(sessionId)
                .orElseThrow(() -> ApiException.notFound("Interview session not found"));
        if (!session.getStudent().getId().equals(student.getId()) && student.getRole() == Role.STUDENT) {
            throw ApiException.forbidden("You do not have access to this interview session");
        }
        return session;
    }

    private int questionCountFor(InterviewSession session) {
        return session.getRole() != null ? questionRepository.findByRoleId(session.getRole().getId()).size()
                : questionRepository.findByPublishedTrue().size();
    }

    private List<Question> orderQuestions(List<Question> questions, InterviewSession session) {
        String context = ((session.getResumeText() == null ? "" : session.getResumeText()) + " "
                + (session.getJobDescription() == null ? "" : session.getJobDescription())).toLowerCase(Locale.ROOT);
        Set<String> contextTerms = terms(context);
        boolean technicalTurn = session.getAnswers().size() % 2 == 0;

        return questions.stream()
                .sorted(Comparator
                        .comparingInt((Question question) -> categoryMatch(question, technicalTurn)).reversed()
                        .thenComparingInt((Question question) -> relevance(question, contextTerms)).reversed()
                        .thenComparing(Question::getId))
                .toList();
    }

    private int categoryMatch(Question question, boolean technicalTurn) {
        boolean technical = question.getCategory() == QuestionCategory.DSA
                || question.getCategory() == QuestionCategory.CODING
                || question.getCategory() == QuestionCategory.TECHNICAL;
        boolean hr = question.getCategory() == QuestionCategory.HR
                || question.getCategory() == QuestionCategory.COMMUNICATION
                || question.getCategory() == QuestionCategory.INTERVIEW;
        return (technicalTurn && technical) || (!technicalTurn && hr) ? 1 : (technical || hr ? 0 : -1);
    }

    private int relevance(Question question, Set<String> contextTerms) {
        if (contextTerms.isEmpty()) return 0;
        return terms((question.getText() == null ? "" : question.getText()) + " "
                + (question.getExpectedKeywords() == null ? "" : question.getExpectedKeywords())).stream()
                .mapToInt(term -> contextTerms.contains(term) ? 1 : 0)
                .sum();
    }

    private Set<String> terms(String text) {
        Set<String> terms = new HashSet<>();
        for (String term : text.split("[^a-z0-9+#]+")) {
            if (term.length() >= 3) terms.add(term);
        }
        return terms;
    }

    private String limitContext(String text) {
        if (text == null) return null;
        return text.length() > 100000 ? text.substring(0, 100000) : text;
    }

    private SessionResponse toSessionResponse(InterviewSession session, int totalQuestions) {
        return new SessionResponse(session.getId(), session.getStatus().name(),
                session.getRole() != null ? session.getRole().getTitle() : "General",
                session.getLevel(), session.getCreatedAt(), session.getAnswers().size(), totalQuestions,
                session.getOverallScore());
    }

    private double avg(List<InterviewAnswer> answers, java.util.function.ToDoubleFunction<InterviewAnswer> fn) {
        return Math.round(answers.stream().mapToDouble(fn).average().orElse(0) * 10.0) / 10.0;
    }

    ScoreWeightConfig currentWeights() {
        return weightConfigRepository.findAll().stream().findFirst()
                .orElseGet(() -> weightConfigRepository.save(ScoreWeightConfig.builder().build()));
    }
}
