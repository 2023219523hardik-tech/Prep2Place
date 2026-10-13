package com.placement.managedtest.service;

import com.placement.assessment.entity.AttemptStatus;
import com.placement.assessment.entity.IntegrityEvent;
import com.placement.assessment.entity.IntegrityEventType;
import com.placement.assessment.repository.IntegrityEventRepository;
import com.placement.entity.StudentProfile;
import com.placement.entity.User;
import com.placement.exception.ApiException;
import com.placement.managedtest.dto.ManagedTestDtos.*;
import com.placement.managedtest.entity.*;
import com.placement.managedtest.repository.*;
import com.placement.repository.StudentProfileRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.*;

/**
 * The student-facing lifecycle: what tests they can see, starting an attempt, autosaving, section
 * submission, final submission, auto-submit on expiry, and violation reporting.
 *
 * Every security rule from the spec lives here rather than in the controller, so there is exactly
 * one place to audit: assignment/eligibility, attempt limits, availability windows, duplicate
 * submission, and answer-key concealment.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ManagedTestAttemptService {

    private final ManagedTestRepository testRepository;
    private final ManagedTestSectionRepository sectionRepository;
    private final ManagedTestAttemptRepository attemptRepository;
    private final ManagedTestAnswerRepository answerRepository;
    private final ManagedTestAssignmentRepository assignmentRepository;
    private final ManagedTestQuestionRepository questionRepository;
    private final StudentProfileRepository studentProfileRepository;
    private final IntegrityEventRepository integrityEventRepository;
    private final TestQuestionSourcingService sourcingService;
    private final ManagedTestGradingService gradingService;
    private final ManagedTestAdminService adminService;
    private final ManagedTestMapper mapper;

    /** Grace period after the server deadline before a late autosave is rejected outright. */
    private static final Duration SUBMIT_GRACE = Duration.ofSeconds(30);

    // ------------------------------------------------------------------ discovery

    @Transactional
    public List<StudentTestCardResponse> availableTests(User student, TestType filterType) {
        adminService.refreshDerivedStatuses();
        Instant now = Instant.now();

        Map<Long, ManagedTest> eligible = new LinkedHashMap<>();
        assignmentRepository.findByStudentIdAndActiveTrue(student.getId()).stream()
                .map(ManagedTestAssignment::getTest)
                .filter(t -> t.isActive() && t.getStatus() != TestStatus.DRAFT && t.getStatus() != TestStatus.ARCHIVED)
                .forEach(t -> eligible.put(t.getId(), t));

        StudentProfile profile = studentProfileRepository.findByUserId(student.getId()).orElse(null);
        testRepository.findCohortTargeted(now,
                        profile != null ? profile.getCollege() : null,
                        profile != null ? profile.getBranch() : null,
                        profile != null ? profile.getGraduationYear() : null)
                .forEach(t -> eligible.putIfAbsent(t.getId(), t));

        return eligible.values().stream()
                .filter(t -> filterType == null || t.getTestType() == filterType)
                .map(t -> toCard(t, student, now))
                .toList();
    }

    private StudentTestCardResponse toCard(ManagedTest test, User student, Instant now) {
        List<ManagedTestSection> sections = sectionRepository.findByTestIdOrderByDisplayOrderAsc(test.getId());
        int questionCount = sections.stream().mapToInt(s -> (int) questionRepository.countBySectionId(s.getId())).sum();

        List<ManagedTestAttempt> attempts = attemptRepository.findByTestIdAndStudentId(test.getId(), student.getId());
        ManagedTestAttempt active = attempts.stream()
                .filter(a -> a.getStatus() == AttemptStatus.IN_PROGRESS)
                .findFirst().orElse(null);
        Double best = attempts.stream()
                .filter(ManagedTestAttempt::isTerminal)
                .map(ManagedTestAttempt::getPercentage)
                .max(Double::compareTo).orElse(null);

        boolean attemptable = test.isOpenForAttempts(now)
                && (test.getAttemptLimit() == 0 || attempts.size() < test.getAttemptLimit() || active != null);

        String status = active != null ? "IN_PROGRESS"
                : attempts.isEmpty() ? "NOT_STARTED"
                : attempts.get(attempts.size() - 1).getStatus().name();

        return new StudentTestCardResponse(
                test.getId(), test.getName(), test.getTestType(), test.getOrganizationName(),
                test.getDurationMinutes(), sections.size(), questionCount, test.getTotalMarks(),
                test.getPassingPercentage(), test.getStartsAt(), test.getEndsAt(),
                test.getAttemptLimit(), attempts.size(), attemptable, status,
                active != null ? active.getId() : null, best,
                sections.stream().map(ManagedTestSection::getName).toList()
        );
    }

    // ------------------------------------------------------------------ start

    @Transactional
    public AttemptViewResponse start(User student, Long testId, String ip, String userAgent) {
        ManagedTest test = testRepository.findById(testId)
                .orElseThrow(() -> ApiException.notFound("Test not found"));

        assertEligible(test, student);

        Instant now = Instant.now();
        if (!test.isOpenForAttempts(now)) {
            throw ApiException.badRequest("This test is not currently available.");
        }

        // Resume rather than start a second attempt - refreshing the page must never burn an attempt.
        Optional<ManagedTestAttempt> existing = attemptRepository
                .findFirstByTestIdAndStudentIdAndStatus(testId, student.getId(), AttemptStatus.IN_PROGRESS);
        if (existing.isPresent()) return view(existing.get(), student);

        long used = attemptRepository.countByTestIdAndStudentId(testId, student.getId());
        if (test.getAttemptLimit() > 0 && used >= test.getAttemptLimit()) {
            throw ApiException.conflict("You have used all " + test.getAttemptLimit() + " attempt(s) for this test.");
        }

        List<ManagedTestSection> sections = sectionRepository.findWithQuestionsByTestId(testId);
        if (sections.isEmpty()) throw ApiException.badRequest("This test has no sections configured.");

        Map<String, List<Long>> order = new LinkedHashMap<>();
        for (ManagedTestSection section : sections) {
            List<ManagedTestQuestion> questions = new ArrayList<>(section.orderedQuestions());
            if (section.isRandomizeQuestions()) Collections.shuffle(questions);
            if (section.getQuestionCount() > 0 && questions.size() > section.getQuestionCount()) {
                questions = questions.subList(0, section.getQuestionCount());
            }
            order.put(String.valueOf(section.getId()), questions.stream().map(ManagedTestQuestion::getId).toList());
        }

        ManagedTestAttempt attempt = ManagedTestAttempt.builder()
                .test(test)
                .student(student)
                .attemptNumber((int) used + 1)
                .sessionId(UUID.randomUUID().toString())
                .status(AttemptStatus.IN_PROGRESS)
                .questionOrder(order)
                .configSnapshot(snapshotConfig(test, sections))
                .startedAt(now)
                .serverExpiresAt(now.plusSeconds(test.getDurationMinutes() * 60L))
                .totalMarks(test.getTotalMarks())
                .startIpAddress(ip)
                .startUserAgent(userAgent)
                .build();

        // Section timers start with the attempt; a per-section start would let a candidate park on
        // an unopened section indefinitely, which the overall timer alone does not prevent.
        if (test.isSectionTimersEnabled()) {
            Map<String, Object> state = new LinkedHashMap<>();
            for (ManagedTestSection section : sections) {
                Map<String, Object> s = new LinkedHashMap<>();
                s.put("startedAt", now.toEpochMilli());
                s.put("expiresAt", section.getDurationMinutes() > 0
                        ? now.plusSeconds(section.getDurationMinutes() * 60L).toEpochMilli() : null);
                s.put("submitted", false);
                state.put(String.valueOf(section.getId()), s);
            }
            attempt.setSectionState(state);
        }

        attemptRepository.save(attempt);
        return view(attempt, student);
    }

    private Map<String, Object> snapshotConfig(ManagedTest test, List<ManagedTestSection> sections) {
        Map<String, Object> snapshot = new LinkedHashMap<>();
        snapshot.put("durationMinutes", test.getDurationMinutes());
        snapshot.put("totalMarks", test.getTotalMarks());
        snapshot.put("passingPercentage", test.getPassingPercentage());
        snapshot.put("negativeMarkingEnabled", test.isNegativeMarkingEnabled());
        snapshot.put("overallTimerEnabled", test.isOverallTimerEnabled());
        snapshot.put("sectionTimersEnabled", test.isSectionTimersEnabled());
        snapshot.put("violationCountThreshold", test.getViolationCountThreshold());
        snapshot.put("sectionDurations", sections.stream()
                .collect(LinkedHashMap::new,
                        (m, s) -> m.put(String.valueOf(s.getId()), s.getDurationMinutes()),
                        LinkedHashMap::putAll));
        return snapshot;
    }

    // ------------------------------------------------------------------ read

    @Transactional(readOnly = true)
    public AttemptViewResponse getAttempt(User student, Long attemptId) {
        ManagedTestAttempt attempt = loadOwned(attemptId, student);
        return view(attempt, student);
    }

    private AttemptViewResponse view(ManagedTestAttempt attempt, User student) {
        ManagedTest test = attempt.getTest();
        boolean terminal = attempt.isTerminal();

        Map<Long, ManagedTestQuestion> byId = new HashMap<>();
        questionRepository.findBySectionTestId(test.getId()).forEach(q -> byId.put(q.getId(), q));

        List<AttemptSectionView> sections = new ArrayList<>();
        for (ManagedTestSection section : sectionRepository.findByTestIdOrderByDisplayOrderAsc(test.getId())) {
            List<Long> ids = attempt.getQuestionOrder().getOrDefault(String.valueOf(section.getId()), List.of());
            List<QuestionResponse> questions = ids.stream()
                    .map(byId::get).filter(Objects::nonNull)
                    // Solutions are stripped until the attempt is terminal - the client never holds the key.
                    .map(q -> mapper.toQuestion(q, terminal))
                    .toList();
            Map<String, Object> state = sectionStateOf(attempt, section.getId());
            sections.add(new AttemptSectionView(
                    section.getId(), section.getName(), section.getSectionType(), section.getInstructions(),
                    section.getDisplayOrder(), section.getDurationMinutes(),
                    state.get("expiresAt") instanceof Number n ? n.longValue() : null,
                    Boolean.TRUE.equals(state.get("submitted")),
                    section.isAllowBackNavigation(), questions));
        }

        Map<String, SavedAnswerView> answers = new LinkedHashMap<>();
        for (ManagedTestAnswer a : answerRepository.findByAttemptId(attempt.getId())) {
            answers.put(String.valueOf(a.getQuestionId()),
                    new SavedAnswerView(a.getResponse(), a.isMarkedForReview(), a.getTimeSpentSeconds()));
        }

        long remaining = attempt.getServerExpiresAt() == null ? 0
                : Math.max(0, Duration.between(Instant.now(), attempt.getServerExpiresAt()).getSeconds());

        return new AttemptViewResponse(
                attempt.getId(), test.getId(), test.getName(), test.getTestType(), test.getInstructions(),
                attempt.getStatus().name(), attempt.getAttemptNumber(), attempt.getStartedAt(),
                attempt.getServerExpiresAt(), remaining,
                test.isOverallTimerEnabled(), test.isSectionTimersEnabled(),
                test.isProctored(), test.isFullscreenRequired(), test.isWebcamRequired(),
                sections, answers
        );
    }

    // ------------------------------------------------------------------ autosave

    @Transactional
    public void saveAnswer(User student, Long attemptId, SaveAnswerRequest request) {
        ManagedTestAttempt attempt = loadOwned(attemptId, student);
        assertWritable(attempt);

        List<Long> served = attempt.getQuestionOrder().getOrDefault(String.valueOf(request.sectionId()), List.of());
        if (!served.contains(request.questionId())) {
            // Rejects answers for questions this candidate was never served - the client cannot
            // widen its own question set.
            throw ApiException.badRequest("This question is not part of your attempt.");
        }
        Map<String, Object> sectionState = sectionStateOf(attempt, request.sectionId());
        if (Boolean.TRUE.equals(sectionState.get("submitted"))) {
            throw ApiException.conflict("This section has already been submitted.");
        }
        if (sectionState.get("expiresAt") instanceof Number expires
                && Instant.now().isAfter(Instant.ofEpochMilli(expires.longValue()).plus(SUBMIT_GRACE))) {
            throw ApiException.conflict("Time for this section has expired.");
        }

        ManagedTestAnswer answer = answerRepository
                .findByAttemptIdAndQuestionId(attemptId, request.questionId())
                .orElseGet(() -> ManagedTestAnswer.builder()
                        .attempt(attempt).questionId(request.questionId()).sectionId(request.sectionId()).build());

        if (request.response() != null) answer.setResponse(new LinkedHashMap<>(request.response()));
        if (request.markedForReview() != null) answer.setMarkedForReview(request.markedForReview());
        if (request.timeSpentSeconds() != null) answer.setTimeSpentSeconds(request.timeSpentSeconds());
        answerRepository.save(answer);

        attempt.setLastAutosaveAt(Instant.now());
        attemptRepository.save(attempt);
    }

    @Transactional
    public void saveAnswers(User student, Long attemptId, List<SaveAnswerRequest> requests) {
        for (SaveAnswerRequest r : requests) saveAnswer(student, attemptId, r);
    }

    @Transactional
    public void submitSection(User student, Long attemptId, Long sectionId) {
        ManagedTestAttempt attempt = loadOwned(attemptId, student);
        assertWritable(attempt);
        Map<String, Object> state = new LinkedHashMap<>(sectionStateOf(attempt, sectionId));
        state.put("submitted", true);
        state.put("submittedAt", Instant.now().toEpochMilli());
        Map<String, Object> all = new LinkedHashMap<>(attempt.getSectionState());
        all.put(String.valueOf(sectionId), state);
        attempt.setSectionState(all);
        attemptRepository.save(attempt);
    }

    // ------------------------------------------------------------------ submit

    @Transactional
    public AttemptResultResponse submit(User student, Long attemptId) {
        ManagedTestAttempt attempt = loadOwned(attemptId, student);
        if (attempt.isTerminal()) {
            // Duplicate submission: return the existing result instead of re-grading, which would
            // otherwise let a replayed request overwrite a recorded score.
            return result(attempt, true);
        }
        finalizeAttempt(attempt, AttemptStatus.SUBMITTED, null);
        return result(attempt, attempt.getTest().isShowResultToStudent());
    }

    /**
     * Grades the attempt and writes every derived number. Called by submit, by the expiry sweep and
     * by violation-based termination, so there is exactly one grading path.
     */
    @Transactional
    public void finalizeAttempt(ManagedTestAttempt attempt, AttemptStatus finalStatus, String terminationReason) {
        Map<Long, ManagedTestQuestion> byId = new HashMap<>();
        questionRepository.findBySectionTestId(attempt.getTest().getId()).forEach(q -> byId.put(q.getId(), q));
        Map<Long, ManagedTestAnswer> answers = new HashMap<>();
        answerRepository.findByAttemptId(attempt.getId()).forEach(a -> answers.put(a.getQuestionId(), a));

        double scored = 0d, total = 0d;
        int correct = 0, wrong = 0, unattempted = 0, pending = 0;

        Map<String, double[]> sectionTotals = new LinkedHashMap<>();       // sectionId -> [scored, total, correct, wrong, unattempted]
        Map<String, int[]> topicTotals = new LinkedHashMap<>();            // topic -> [attempted, correct]
        Map<String, int[]> difficultyTotals = new LinkedHashMap<>();       // difficulty -> [attempted, correct]

        for (Map.Entry<String, List<Long>> entry : attempt.getQuestionOrder().entrySet()) {
            String sectionId = entry.getKey();
            double[] agg = sectionTotals.computeIfAbsent(sectionId, k -> new double[5]);

            for (Long questionId : entry.getValue()) {
                ManagedTestQuestion question = byId.get(questionId);
                if (question == null) continue;
                total += question.getMarks();
                agg[1] += question.getMarks();

                ManagedTestAnswer answer = answers.get(questionId);
                ManagedTestGradingService.GradedAnswer graded = gradingService.grade(question, answer);

                if (answer != null) {
                    answer.setCorrect(graded.correct());
                    answer.setMarksAwarded(graded.marksAwarded());
                    answer.setEvaluationStatus(graded.status());
                    answer.setEvaluationNote(graded.note());
                    answerRepository.save(answer);
                }

                switch (graded.outcome()) {
                    case CORRECT -> { correct++; agg[2]++; }
                    case WRONG -> { wrong++; agg[3]++; }
                    case UNATTEMPTED -> { unattempted++; agg[4]++; }
                    case PENDING -> pending++;
                }
                // Negative marks can push a section below zero; the attempt total is floored at zero
                // rather than each section, so one disastrous section cannot erase a good one.
                scored += graded.marksAwarded();
                agg[0] += graded.marksAwarded();

                if (graded.outcome() == ManagedTestGradingService.Outcome.CORRECT
                        || graded.outcome() == ManagedTestGradingService.Outcome.WRONG) {
                    String topic = question.getTopic() != null ? question.getTopic() : "Uncategorised";
                    int[] t = topicTotals.computeIfAbsent(topic, k -> new int[2]);
                    t[0]++;
                    if (graded.outcome() == ManagedTestGradingService.Outcome.CORRECT) t[1]++;

                    String difficulty = question.getDifficulty() != null ? question.getDifficulty().name() : "UNSPECIFIED";
                    int[] d = difficultyTotals.computeIfAbsent(difficulty, k -> new int[2]);
                    d[0]++;
                    if (graded.outcome() == ManagedTestGradingService.Outcome.CORRECT) d[1]++;
                }
            }
        }

        scored = Math.max(0d, scored);
        double percentage = total > 0 ? (scored / total) * 100d : 0d;
        int attempted = correct + wrong;
        double accuracy = attempted > 0 ? (correct * 100d) / attempted : 0d;

        attempt.setScoredMarks(round(scored));
        attempt.setTotalMarks(round(total));
        attempt.setPercentage(round(percentage));
        attempt.setAccuracy(round(accuracy));
        attempt.setCorrectCount(correct);
        attempt.setWrongCount(wrong);
        attempt.setUnattemptedCount(unattempted);
        attempt.setPendingReviewCount(pending);
        attempt.setPassed(percentage >= attempt.getTest().getPassingPercentage());
        attempt.setStatus(finalStatus);
        attempt.setTerminationReason(terminationReason);
        attempt.setSubmittedAt(Instant.now());

        Map<String, Object> details = new LinkedHashMap<>();
        Map<String, Object> sectionBreakdown = new LinkedHashMap<>();
        sectionTotals.forEach((sectionId, agg) -> {
            Map<String, Object> s = new LinkedHashMap<>();
            s.put("scored", round(Math.max(0d, agg[0])));
            s.put("total", round(agg[1]));
            s.put("percentage", agg[1] > 0 ? round(Math.max(0d, agg[0]) / agg[1] * 100d) : 0d);
            s.put("correct", (int) agg[2]);
            s.put("wrong", (int) agg[3]);
            s.put("unattempted", (int) agg[4]);
            sectionBreakdown.put(sectionId, s);
        });
        details.put("sections", sectionBreakdown);
        details.put("topics", ratioMap(topicTotals));
        details.put("difficulty", ratioMap(difficultyTotals));
        attempt.setResultDetails(details);

        attemptRepository.save(attempt);
    }

    private Map<String, Object> ratioMap(Map<String, int[]> counts) {
        Map<String, Object> out = new LinkedHashMap<>();
        counts.forEach((key, v) -> {
            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("attempted", v[0]);
            entry.put("correct", v[1]);
            entry.put("accuracy", v[0] > 0 ? round(v[1] * 100d / v[0]) : 0d);
            out.put(key, entry);
        });
        return out;
    }

    /**
     * Server-side auto-submit. The client's own timer is a convenience; this is what actually ends
     * an attempt, so closing the laptop still produces a graded result.
     */
    @Scheduled(fixedDelayString = "${app.managed-test.expiry-sweep-ms:60000}")
    @Transactional
    public void autoSubmitExpired() {
        List<ManagedTestAttempt> expired = attemptRepository.findExpired(Instant.now().minus(SUBMIT_GRACE));
        for (ManagedTestAttempt attempt : expired) {
            try {
                finalizeAttempt(attempt, AttemptStatus.AUTO_SUBMITTED, "Time expired");
                log.info("Auto-submitted managed test attempt {}", attempt.getId());
            } catch (Exception e) {
                log.error("Failed to auto-submit attempt {}", attempt.getId(), e);
            }
        }
    }

    // ------------------------------------------------------------------ results

    @Transactional(readOnly = true)
    public AttemptResultResponse studentResult(User student, Long attemptId) {
        ManagedTestAttempt attempt = loadOwned(attemptId, student);
        if (!attempt.isTerminal()) throw ApiException.badRequest("This attempt has not been submitted yet.");
        if (!attempt.getTest().isShowResultToStudent())
            throw ApiException.forbidden("Results for this test are not published to students.");
        return result(attempt, true);
    }

    @Transactional(readOnly = true)
    public AttemptResultResponse adminResult(Long attemptId) {
        ManagedTestAttempt attempt = attemptRepository.findWithRefsById(attemptId)
                .orElseThrow(() -> ApiException.notFound("Attempt not found"));
        return result(attempt, true);
    }

    private AttemptResultResponse result(ManagedTestAttempt attempt, boolean includeQuestionDetail) {
        Map<Long, ManagedTestQuestion> byId = new HashMap<>();
        questionRepository.findBySectionTestId(attempt.getTest().getId()).forEach(q -> byId.put(q.getId(), q));
        Map<Long, ManagedTestAnswer> answers = new HashMap<>();
        answerRepository.findByAttemptId(attempt.getId()).forEach(a -> answers.put(a.getQuestionId(), a));

        List<SectionResultView> sectionResults = new ArrayList<>();
        for (ManagedTestSection section : sectionRepository.findByTestIdOrderByDisplayOrderAsc(attempt.getTest().getId())) {
            Object raw = ((Map<?, ?>) attempt.getResultDetails().getOrDefault("sections", Map.of()))
                    .get(String.valueOf(section.getId()));
            if (!(raw instanceof Map<?, ?> m)) continue;
            double scored = num(m.get("scored"));
            double total = num(m.get("total"));
            int correct = (int) num(m.get("correct"));
            int wrong = (int) num(m.get("wrong"));
            double sectionPct = num(m.get("percentage"));
            sectionResults.add(new SectionResultView(
                    section.getId(), section.getName(), section.getSectionType(),
                    scored, total, sectionPct,
                    (correct + wrong) > 0 ? round(correct * 100d / (correct + wrong)) : 0d,
                    correct, wrong, (int) num(m.get("unattempted")),
                    section.getPassingPercentage() == null ? null : sectionPct >= section.getPassingPercentage()
            ));
        }

        List<QuestionResultView> questionResults = new ArrayList<>();
        if (includeQuestionDetail) {
            for (Map.Entry<String, List<Long>> entry : attempt.getQuestionOrder().entrySet()) {
                for (Long questionId : entry.getValue()) {
                    ManagedTestQuestion q = byId.get(questionId);
                    if (q == null) continue;
                    ManagedTestAnswer a = answers.get(questionId);
                    questionResults.add(new QuestionResultView(
                            q.getId(), Long.valueOf(entry.getKey()), q.getTitle(), q.getQuestionType(),
                            q.getDifficulty(), q.getTopic(), q.getMarks(),
                            a != null ? a.getMarksAwarded() : 0d,
                            a != null ? a.getCorrect() : null,
                            a != null && a.getEvaluationStatus() != null ? a.getEvaluationStatus().name() : "AUTO_GRADED",
                            a != null ? a.getResponse() : Map.of(),
                            mapper.solutionOf(q.getPayload()),
                            a != null ? a.getEvaluationNote() : "Not attempted"
                    ));
                }
            }
        }

        Double percentile = attempt.getPercentile();
        if (percentile == null && attempt.isTerminal()) {
            long cohort = attemptRepository.countSubmittedForTest(attempt.getTest().getId());
            if (cohort > 1) {
                long below = attemptRepository.countBelowPercentage(attempt.getTest().getId(), attempt.getPercentage());
                percentile = round(below * 100d / cohort);
            }
        }

        long durationSeconds = attempt.getStartedAt() != null && attempt.getSubmittedAt() != null
                ? Duration.between(attempt.getStartedAt(), attempt.getSubmittedAt()).getSeconds() : 0;

        return new AttemptResultResponse(
                attempt.getId(), attempt.getTest().getId(), attempt.getTest().getName(), attempt.getTest().getTestType(),
                attempt.getStudent().getId(), attempt.getStudent().getFullName(),
                attempt.getStatus().name(), attempt.getAttemptNumber(),
                attempt.getStartedAt(), attempt.getSubmittedAt(), durationSeconds,
                attempt.getScoredMarks(), attempt.getTotalMarks(), attempt.getPercentage(), attempt.getAccuracy(),
                attempt.getCorrectCount(), attempt.getWrongCount(), attempt.getUnattemptedCount(),
                attempt.getPendingReviewCount(), attempt.isPassed(), percentile,
                attempt.getViolationCount(), attempt.getIntegrityScore(),
                sectionResults, questionResults, attempt.getResultDetails()
        );
    }

    // ------------------------------------------------------------------ proctoring

    /**
     * Records a violation against the attempt. Severity decrements the integrity score; the score
     * and the event list are shown to the admin as signals. Nothing here concludes that a candidate
     * cheated - that judgement stays with a human.
     */
    @Transactional
    public Map<String, Object> reportViolation(User student, Long attemptId, ViolationReportRequest request) {
        ManagedTestAttempt attempt = loadOwned(attemptId, student);
        if (attempt.isTerminal()) return Map.of("recorded", false, "reason", "Attempt already closed");

        IntegrityEventType type;
        try {
            type = IntegrityEventType.valueOf(request.eventType());
        } catch (IllegalArgumentException e) {
            throw ApiException.badRequest("Unknown violation type: " + request.eventType());
        }

        int severity = request.severity() != null ? Math.min(Math.max(request.severity(), 1), 5) : defaultSeverity(type);
        IntegrityEvent event = IntegrityEvent.builder()
                .attemptId(attempt.getId())
                .attemptKind(IntegrityEvent.AttemptKind.MANAGED_TEST)
                .eventType(type)
                .severity(severity)
                .occurredAt(Instant.now())
                .durationSeconds(request.durationSeconds())
                .details(request.details())
                .build();
        integrityEventRepository.save(event);

        attempt.setViolationCount(attempt.getViolationCount() + 1);
        attempt.setIntegrityScore(Math.max(0, attempt.getIntegrityScore() - severity * 3));

        boolean terminated = false;
        int threshold = attempt.getTest().getViolationCountThreshold();
        if (threshold > 0 && attempt.getViolationCount() >= threshold) {
            finalizeAttempt(attempt, com.placement.assessment.entity.AttemptStatus.TERMINATED,
                    "Violation threshold of " + threshold + " reached");
            terminated = true;
        } else {
            attemptRepository.save(attempt);
        }

        return Map.of(
                "recorded", true,
                "violationCount", attempt.getViolationCount(),
                "integrityScore", attempt.getIntegrityScore(),
                "terminated", terminated
        );
    }

    private int defaultSeverity(IntegrityEventType type) {
        return switch (type) {
            case MULTIPLE_FACES, POTENTIAL_EXTERNAL_REFERENCE, DEVTOOLS_ATTEMPT -> 4;
            case TAB_SWITCH, FULLSCREEN_EXIT, FACE_NOT_DETECTED, CAMERA_BLOCKED -> 3;
            case COPY_ATTEMPT, PASTE_ATTEMPT, BACK_NAVIGATION_ATTEMPT -> 2;
            default -> 1;
        };
    }

    // ------------------------------------------------------------------ guards

    private void assertEligible(ManagedTest test, User student) {
        if (assignmentRepository.existsByTestIdAndStudentIdAndActiveTrue(test.getId(), student.getId())) return;

        StudentProfile profile = studentProfileRepository.findByUserId(student.getId()).orElse(null);
        boolean cohortMatch = testRepository.findCohortTargeted(Instant.now(),
                        profile != null ? profile.getCollege() : null,
                        profile != null ? profile.getBranch() : null,
                        profile != null ? profile.getGraduationYear() : null)
                .stream().anyMatch(t -> t.getId().equals(test.getId()));

        if (!cohortMatch) throw ApiException.forbidden("This test has not been assigned to you.");
    }

    private void assertWritable(ManagedTestAttempt attempt) {
        if (attempt.isTerminal()) throw ApiException.conflict("This attempt has already been closed.");
        if (attempt.getServerExpiresAt() != null
                && Instant.now().isAfter(attempt.getServerExpiresAt().plus(SUBMIT_GRACE))) {
            throw ApiException.conflict("Time has expired for this attempt.");
        }
    }

    private ManagedTestAttempt loadOwned(Long attemptId, User student) {
        ManagedTestAttempt attempt = attemptRepository.findWithRefsById(attemptId)
                .orElseThrow(() -> ApiException.notFound("Attempt not found"));
        if (!attempt.getStudent().getId().equals(student.getId())) {
            // Deliberately 404, not 403: a 403 would confirm the attempt id exists.
            throw ApiException.notFound("Attempt not found");
        }
        return attempt;
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> sectionStateOf(ManagedTestAttempt attempt, Long sectionId) {
        Object raw = attempt.getSectionState().get(String.valueOf(sectionId));
        return raw instanceof Map<?, ?> m ? (Map<String, Object>) m : new LinkedHashMap<>();
    }

    private double num(Object o) { return o instanceof Number n ? n.doubleValue() : 0d; }

    private double round(double v) { return Math.round(v * 100d) / 100d; }
}
