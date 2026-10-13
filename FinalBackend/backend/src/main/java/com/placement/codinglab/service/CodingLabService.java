package com.placement.codinglab.service;

import com.placement.codinglab.dto.CodingLabDtos.*;
import com.placement.codinglab.entity.*;
import com.placement.codinglab.model.RequirementSpec;
import com.placement.codinglab.model.TestCaseResult;
import com.placement.codinglab.repository.CodingAssessmentRepository;
import com.placement.codinglab.repository.CodingAttemptRepository;
import com.placement.codinglab.repository.CodingLabSubmissionRepository;
import com.placement.codinglab.runner.JUnitXmlParser;
import com.placement.codinglab.runner.RequirementScorer;
import com.placement.codinglab.runner.SandboxExecutor;
import com.placement.codinglab.runner.SandboxExecutor.Outcome;
import com.placement.codinglab.runner.SandboxExecutor.Suite;
import com.placement.codinglab.runner.WorkspaceRules;
import com.placement.entity.User;
import com.placement.exception.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

/**
 * Student-facing lifecycle: start -> autosave -> Run (public tests) -> Submit (public + hidden, scored) -> finish.
 *
 * <p><b>Transactions:</b> the old implementation ran Docker inside a database transaction (holding a pooled
 * connection for up to a minute per click). Here every step is a short transaction and the sandbox runs
 * OUTSIDE any transaction: {@code prepare} (tx) -> {@code execute} (no tx) -> {@code persist} (tx).
 * The methods that touch the sandbox are deliberately NOT annotated {@code @Transactional}, and callers
 * (controllers) must not wrap them in one.
 *
 * <p><b>Hidden tests:</b> only read in {@link #prepare} for a SUBMIT, placed on disk by the sandbox only for the
 * second container, and never copied into any map that is stored or returned.
 */
@Service
public class CodingLabService {

    /** A Submit sent as the timer hits zero should still count. */
    static final long EXPIRY_GRACE_SECONDS = 30;
    private static final long MIN_GAP_MS = 1500;

    private final CodingAssessmentRepository assessmentRepository;
    private final CodingAttemptRepository attemptRepository;
    private final CodingLabSubmissionRepository submissionRepository;
    private final SandboxExecutor executor;
    private final TransactionTemplate tx;

    private final Set<Long> running = ConcurrentHashMap.newKeySet();
    private final Map<Long, Long> lastRunAt = new ConcurrentHashMap<>();

    public CodingLabService(CodingAssessmentRepository assessmentRepository, CodingAttemptRepository attemptRepository,
                            CodingLabSubmissionRepository submissionRepository, SandboxExecutor executor,
                            PlatformTransactionManager transactionManager) {
        this.assessmentRepository = assessmentRepository;
        this.attemptRepository = attemptRepository;
        this.submissionRepository = submissionRepository;
        this.executor = executor;
        this.tx = new TransactionTemplate(transactionManager);
    }

    /** Everything the sandbox phase needs, copied out of the persistence context so no lazy entity is touched later. */
    private record RunPlan(Long attemptId, CodingRuntime runtime, boolean dom, Map<String, String> studentFiles,
                           Map<String, String> publicTests, Map<String, String> hiddenTests,
                           List<RequirementSpec> requirements, double maxScore, int memoryMb, int timeoutSeconds) {}

    private record Evaluation(CodingSubmissionStatus status, String buildLog, String runtimeError, String output,
                              List<TestCaseResult> cases, RequirementScorer.ScoreReport score, int runtimeMs) {}

    // ------------------------------------------------------------------------------------- catalogue

    @Transactional(readOnly = true)
    public List<AssessmentSummaryView> listAvailable(User candidate) {
        Map<Long, List<CodingAttempt>> mine = attemptRepository.findByCandidateOrderByCreatedAtDesc(candidate).stream()
                .collect(Collectors.groupingBy(a -> a.getAssessment().getId()));
        Instant now = Instant.now();
        return assessmentRepository.findByStatus(CodingAssessmentStatus.PUBLISHED).stream()
                .filter(a -> a.getRuntime() != null)
                .map(a -> {
                    List<CodingAttempt> attempts = mine.getOrDefault(a.getId(), List.of());
                    Long active = attempts.stream()
                            .filter(t -> t.getStatus() == CodingAttemptStatus.STARTED && t.getExpiresAt() != null && t.getExpiresAt().isAfter(now))
                            .map(CodingAttempt::getId).findFirst().orElse(null);
                    Double best = attempts.isEmpty() ? null : attempts.stream().mapToDouble(CodingAttempt::getBestScore).max().orElse(0);
                    return AssessmentSummaryView.from(a, active, best, attempts.size());
                }).toList();
    }

    public CodingAssessment getAssessmentOrThrow(Long id) {
        return assessmentRepository.findById(id).orElseThrow(() -> ApiException.notFound("Coding assessment not found"));
    }

    // ------------------------------------------------------------------------------------- lifecycle

    @Transactional
    public WorkspaceView start(User candidate, Long assessmentId) {
        CodingAssessment assessment = getAssessmentOrThrow(assessmentId);
        if (assessment.getStatus() != CodingAssessmentStatus.PUBLISHED || assessment.isLegacy()) {
            throw ApiException.forbidden("This assessment is not currently available");
        }
        for (CodingAttempt existing : attemptRepository.findByCandidateAndAssessmentAndStatus(candidate, assessment, CodingAttemptStatus.STARTED)) {
            expireIfNeeded(existing);
            if (existing.getStatus() == CodingAttemptStatus.STARTED) return toWorkspaceView(existing);
        }
        Instant now = Instant.now();
        CodingAttempt attempt = CodingAttempt.builder()
                .candidate(candidate)
                .assessment(assessment)
                .status(CodingAttemptStatus.STARTED)
                .currentFiles(new LinkedHashMap<>(assessment.getStarterFiles()))
                .startedAt(now)
                .lastActivityAt(now)
                .expiresAt(now.plusSeconds(assessment.getTimeLimitMinutes() * 60L))
                .build();
        return toWorkspaceView(attemptRepository.save(attempt));
    }

    @Transactional
    public WorkspaceView workspace(User candidate, Long attemptId) {
        return toWorkspaceView(getOwnedAttemptOrThrow(candidate, attemptId));
    }

    @Transactional
    public SaveAck save(User candidate, Long attemptId, Map<String, String> files) {
        CodingAttempt attempt = getOwnedAttemptOrThrow(candidate, attemptId);
        requireActive(attempt);
        attempt.setCurrentFiles(clean(files, attempt.getAssessment().getRuntime()));
        attempt.setLastActivityAt(Instant.now());
        attemptRepository.save(attempt);
        return new SaveAck(Instant.now());
    }

    @Transactional
    public WorkspaceView finish(User candidate, Long attemptId) {
        CodingAttempt attempt = getOwnedAttemptOrThrow(candidate, attemptId);
        if (attempt.getStatus() == CodingAttemptStatus.STARTED) {
            attempt.setStatus(CodingAttemptStatus.COMPLETED);
            attempt.setCompletedAt(Instant.now());
            attemptRepository.save(attempt);
        }
        return toWorkspaceView(attempt);
    }

    @Transactional
    public WorkspaceView abandon(User candidate, Long attemptId) {
        CodingAttempt attempt = getOwnedAttemptOrThrow(candidate, attemptId);
        if (attempt.getStatus() == CodingAttemptStatus.STARTED) {
            attempt.setStatus(CodingAttemptStatus.ABANDONED);
            attempt.setCompletedAt(Instant.now());
            attemptRepository.save(attempt);
        }
        return toWorkspaceView(attempt);
    }

    // ------------------------------------------------------------------------------------- run / submit

    /** Public tests only, unlimited, never scored. NOT transactional - see class javadoc. */
    public RunResultView run(User candidate, Long attemptId, Map<String, String> files) {
        return execute(candidate, attemptId, files, false);
    }

    /** Public + hidden tests (two containers), scored per requirement. NOT transactional - see class javadoc. */
    public RunResultView submit(User candidate, Long attemptId, Map<String, String> files) {
        return execute(candidate, attemptId, files, true);
    }

    private RunResultView execute(User candidate, Long attemptId, Map<String, String> files, boolean submit) {
        RunPlan plan = tx.execute(status -> prepare(candidate, attemptId, files, submit));
        if (!running.add(attemptId)) throw ApiException.conflict("A run is already in progress for this attempt - wait for it to finish.");
        try {
            long now = System.currentTimeMillis();
            Long last = lastRunAt.put(attemptId, now);
            if (last != null && now - last < MIN_GAP_MS) throw ApiException.tooManyRequests("Please wait a moment before running again.");
            if (lastRunAt.size() > 5000) lastRunAt.clear();

            Evaluation evaluation = evaluate(plan, submit);
            CodingLabSubmission saved = tx.execute(status -> persist(plan, evaluation, submit));
            return RunResultView.from(saved, plan.maxScore());
        } finally {
            running.remove(attemptId);
        }
    }

    private RunPlan prepare(User candidate, Long attemptId, Map<String, String> files, boolean submit) {
        CodingAttempt attempt = getOwnedAttemptOrThrow(candidate, attemptId);
        requireActive(attempt);
        CodingAssessment a = attempt.getAssessment();
        if (a.isLegacy()) throw ApiException.conflict("This assessment was retired. Please start a current one from the Coding Lab.");
        Map<String, String> student = clean(files, a.getRuntime());
        attempt.setCurrentFiles(new LinkedHashMap<>(student));
        attempt.setLastActivityAt(Instant.now());
        attemptRepository.save(attempt);
        return new RunPlan(attempt.getId(), a.getRuntime(), a.getCodingType() == CodingType.FRONTEND, student,
                new LinkedHashMap<>(a.getPublicTestFiles()), submit ? new LinkedHashMap<>(a.getHiddenTestFiles()) : Map.of(),
                a.requirementSpecs(), a.getMaxScore(), a.getMemoryLimitMb(), a.getExecutionTimeoutSeconds());
    }

    private Evaluation evaluate(RunPlan plan, boolean submit) {
        long t0 = System.nanoTime();

        SandboxExecutor.Result pub = executor.execute(new SandboxExecutor.Request(plan.runtime(), Suite.PUBLIC,
                merge(plan.studentFiles(), plan.publicTests()), plan.memoryMb(), plan.timeoutSeconds(), plan.dom()));
        requireRunner(pub);
        Evaluation early = earlyExit(pub, plan, t0);
        if (early != null) return early;
        List<TestCaseResult> cases = new ArrayList<>();
        String problem = collect(pub, "public", cases);
        if (problem != null) return failure(CodingSubmissionStatus.RUNTIME_ERROR, null, problem + tail(pub.runLog(), submit), null, plan, t0);

        if (submit && plan.hiddenTests() != null && !plan.hiddenTests().isEmpty()) {
            SandboxExecutor.Result hid = executor.execute(new SandboxExecutor.Request(plan.runtime(), Suite.HIDDEN,
                    merge(plan.studentFiles(), plan.hiddenTests()), plan.memoryMb(), plan.timeoutSeconds(), plan.dom()));
            requireRunner(hid);
            Evaluation hiddenEarly = earlyExit(hid, plan, t0);
            if (hiddenEarly != null) return hiddenEarly;
            String hiddenProblem = collect(hid, "hidden", cases);
            if (hiddenProblem != null) return failure(CodingSubmissionStatus.RUNTIME_ERROR, null, "The grading tests could not be completed. " + hiddenProblem, null, plan, t0);
        }

        RequirementScorer.ScoreReport score = submit ? RequirementScorer.compute(plan.requirements(), cases, plan.maxScore()) : null;
        boolean allPassed = !cases.isEmpty() && cases.stream().allMatch(TestCaseResult::passed);
        String output = submit ? null : truncate(pub.runLog(), 6000);
        return new Evaluation(allPassed ? CodingSubmissionStatus.SUCCESS : CodingSubmissionStatus.FAILED, null, null, output,
                cases, score, elapsedMs(t0));
    }

    /** Build failures and timeouts end the evaluation immediately with a candidate-friendly result. */
    private Evaluation earlyExit(SandboxExecutor.Result r, RunPlan plan, long t0) {
        if (r.outcome() == Outcome.TIMED_OUT) {
            return failure(CodingSubmissionStatus.TIMEOUT, null, "Execution exceeded the time limit (" + plan.timeoutSeconds() + "s). Check for infinite loops or very slow code.", null, plan, t0);
        }
        if (!r.buildOk()) {
            return failure(CodingSubmissionStatus.COMPILATION_ERROR, truncate(r.buildLog(), 3500), null, null, plan, t0);
        }
        return null;
    }

    /** Parses a suite's report into {@code out}; returns a problem description when there is nothing to grade. */
    private String collect(SandboxExecutor.Result r, String suite, List<TestCaseResult> out) {
        if (r.reportXml() == null || r.reportXml().isBlank()) return "The " + suite + " tests did not produce a report.";
        try {
            List<TestCaseResult> parsed = JUnitXmlParser.parse(r.reportXml(), suite);
            if (parsed.isEmpty()) return "No " + suite + " tests were executed.";
            out.addAll(parsed);
            return null;
        } catch (IllegalArgumentException e) {
            return "The " + suite + " test report could not be read.";
        }
    }

    private void requireRunner(SandboxExecutor.Result r) {
        if (r.outcome() == Outcome.BUSY) throw ApiException.tooManyRequests(r.userMessage());
        if (r.outcome() == Outcome.UNAVAILABLE) throw new ApiException(r.userMessage(), HttpStatus.SERVICE_UNAVAILABLE);
    }

    private Evaluation failure(CodingSubmissionStatus status, String buildLog, String runtimeError, String output, RunPlan plan, long t0) {
        return new Evaluation(status, buildLog, runtimeError, output, List.of(), null, elapsedMs(t0));
    }

    private CodingLabSubmission persist(RunPlan plan, Evaluation ev, boolean submit) {
        CodingAttempt attempt = attemptRepository.findById(plan.attemptId()).orElseThrow(() -> ApiException.notFound("Attempt not found"));
        int passed = (int) ev.cases().stream().filter(TestCaseResult::passed).count();
        CodingLabSubmission s = CodingLabSubmission.builder()
                .attemptId(attempt.getId())
                .candidate(attempt.getCandidate())
                .assessment(attempt.getAssessment())
                .kind(submit ? CodingSubmissionKind.SUBMIT : CodingSubmissionKind.RUN)
                .status(ev.status())
                .filesSnapshot(new LinkedHashMap<>(plan.studentFiles()))
                .runtimeMs(ev.runtimeMs())
                .memoryMb(0)
                .testsTotal(ev.cases().size())
                .testsPassed(passed)
                .testsFailed(ev.cases().size() - passed)
                .score(ev.score() != null ? ev.score().score() : 0)
                .compilationError(ev.buildLog())
                .runtimeError(ev.runtimeError())
                .publicOutput(ev.output())
                .aiHintsUsedAtSubmission(attempt.getAiHintsUsed())
                .build();
        s.setCases(ev.cases());
        if (ev.score() != null) s.setRequirements(ev.score().requirements());
        s = submissionRepository.save(s);

        if (submit && s.getScore() > attempt.getBestScore()) {
            attempt.setBestScore(s.getScore());
            attempt.setBestSubmissionId(s.getId());
            attemptRepository.save(attempt);
        }
        return s;
    }

    // ------------------------------------------------------------------------------------- reads

    @Transactional
    public List<AttemptHistoryView> history(User candidate) {
        return attemptRepository.findByCandidateOrderByCreatedAtDesc(candidate).stream().map(a -> {
            expireIfNeeded(a);
            return AttemptHistoryView.from(a);
        }).toList();
    }

    @Transactional
    public List<SubmissionSummaryView> submissions(User candidate, Long attemptId) {
        CodingAttempt attempt = getOwnedAttemptOrThrow(candidate, attemptId);
        return submissionRepository.findByAttemptIdOrderBySubmittedAtDesc(attempt.getId()).stream()
                .map(SubmissionSummaryView::from).toList();
    }

    @Transactional
    public RunResultView submissionDetail(User candidate, Long attemptId, Long submissionId) {
        CodingAttempt attempt = getOwnedAttemptOrThrow(candidate, attemptId);
        CodingLabSubmission s = submissionRepository.findById(submissionId)
                .filter(x -> x.getAttemptId().equals(attempt.getId()))
                .orElseThrow(() -> ApiException.notFound("Submission not found"));
        return RunResultView.from(s, attempt.getAssessment().getMaxScore());
    }

    /** Ownership + expiry check shared with the AI hint service. Joins the caller's transaction. */
    @Transactional
    public CodingAttempt getOwnedAttemptOrThrow(User candidate, Long attemptId) {
        CodingAttempt attempt = attemptRepository.findById(attemptId).orElseThrow(() -> ApiException.notFound("Attempt not found"));
        if (!attempt.getCandidate().getId().equals(candidate.getId())) {
            throw ApiException.forbidden("You do not have access to this attempt");
        }
        expireIfNeeded(attempt);
        return attempt;
    }

    WorkspaceView toWorkspaceView(CodingAttempt attempt) {
        CodingAssessment a = attempt.getAssessment();
        int remaining = Math.max(0, a.getAiMaxHints() - attempt.getAiHintsUsed());
        RunResultView last = submissionRepository.findFirstByAttemptIdOrderBySubmittedAtDesc(attempt.getId())
                .map(s -> RunResultView.from(s, a.getMaxScore())).orElse(null);
        return new WorkspaceView(attempt.getId(), a.getId(), a.getTitle(), a.getCodingType(), a.getRuntime(), a.getDescription(),
                a.getProblemStatement(), a.requirementSpecs().stream().map(RequirementView::from).toList(),
                attempt.getCurrentFiles(), a.getPublicTestFiles(), attempt.getStatus(), attempt.getStartedAt(),
                attempt.getExpiresAt(), Instant.now(), a.getTimeLimitMinutes(), a.getMaxScore(), attempt.getBestScore(),
                attempt.getAiHintsUsed(), remaining, a.isAiAssistantEnabled(), last);
    }

    // ------------------------------------------------------------------------------------- expiry

    private void requireActive(CodingAttempt attempt) {
        if (attempt.getStatus() != CodingAttemptStatus.STARTED) {
            throw ApiException.conflict("This attempt is no longer active (" + attempt.getStatus() + ")");
        }
    }

    private void expireIfNeeded(CodingAttempt attempt) {
        if (attempt.getStatus() == CodingAttemptStatus.STARTED && attempt.getExpiresAt() != null
                && Instant.now().isAfter(attempt.getExpiresAt().plusSeconds(EXPIRY_GRACE_SECONDS))) {
            attempt.setStatus(CodingAttemptStatus.EXPIRED);
            attempt.setCompletedAt(Instant.now());
            attemptRepository.save(attempt);
        }
    }

    @Transactional
    public int expireStaleAttempts() {
        Instant cutoff = Instant.now().minusSeconds(EXPIRY_GRACE_SECONDS);
        List<CodingAttempt> stale = attemptRepository.findExpiredButStillOpen().stream()
                .filter(a -> a.getExpiresAt() != null && a.getExpiresAt().isBefore(cutoff)).toList();
        for (CodingAttempt attempt : stale) {
            attempt.setStatus(CodingAttemptStatus.EXPIRED);
            attempt.setCompletedAt(Instant.now());
        }
        attemptRepository.saveAll(stale);
        return stale.size();
    }

    // ------------------------------------------------------------------------------------- helpers

    private Map<String, String> clean(Map<String, String> files, CodingRuntime runtime) {
        try {
            return WorkspaceRules.sanitizeStudentFiles(files, runtime);
        } catch (IllegalArgumentException e) {
            throw ApiException.badRequest(e.getMessage());
        }
    }

    private static Map<String, String> merge(Map<String, String> a, Map<String, String> b) {
        Map<String, String> m = new LinkedHashMap<>(a);
        m.putAll(b);
        return m;
    }

    private static String tail(String log, boolean submit) {
        if (submit || log == null || log.isBlank()) return "";
        return "\n" + truncate(log.strip(), 1500);
    }

    private static String truncate(String s, int max) {
        if (s == null) return null;
        return s.length() > max ? s.substring(0, max) + "\n… [truncated]" : s;
    }

    private static int elapsedMs(long t0) { return (int) ((System.nanoTime() - t0) / 1_000_000); }
}
