package com.placement.codinglab.service;

import com.placement.codinglab.dto.CodingLabDtos.*;
import com.placement.codinglab.entity.*;
import com.placement.codinglab.generation.LlmGateway;
import com.placement.codinglab.model.AssessmentBlueprint;
import com.placement.codinglab.model.RequirementSpec;
import com.placement.codinglab.model.ValidationIssue;
import com.placement.codinglab.repository.AiHintInteractionRepository;
import com.placement.codinglab.repository.CodingAssessmentRepository;
import com.placement.codinglab.repository.CodingAttemptRepository;
import com.placement.codinglab.repository.CodingLabSubmissionRepository;
import com.placement.codinglab.runner.AssessmentContentValidator;
import com.placement.codinglab.runner.SandboxExecutor;
import com.placement.codinglab.runner.WorkspaceRules;
import com.placement.exception.ApiException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Admin authoring. One pipeline for every way a question can come into being (manual form, AI generation,
 * JSON import):  save as DRAFT (structurally valid, may be incomplete)  ->  verify in the sandbox  ->  publish.
 *
 * <p>Not class-level transactional: verification runs the sandbox and must not hold a DB connection.
 */
@Service
@RequiredArgsConstructor
public class CodingAssessmentAdminService {

    private final CodingAssessmentRepository assessmentRepository;
    private final CodingAttemptRepository attemptRepository;
    private final CodingLabSubmissionRepository submissionRepository;
    private final AiHintInteractionRepository aiHintInteractionRepository;
    private final AssessmentVerifier verifier;
    private final CodingLabJobs jobs;
    private final SandboxExecutor executor;
    private final LlmGateway llm;
    private final PlatformTransactionManager transactionManager;

    // ---------------------------------------------------------------------------------------- reads

    @Transactional(readOnly = true)
    public List<AssessmentAdminSummary> list(CodingAssessmentStatus status, CodingType type) {
        List<CodingAssessment> all;
        if (status != null && type != null) all = assessmentRepository.findByStatusAndCodingType(status, type);
        else if (status != null) all = assessmentRepository.findByStatus(status);
        else if (type != null) all = assessmentRepository.findByCodingType(type);
        else all = assessmentRepository.findAll();
        return all.stream()
                .sorted(Comparator.comparing(CodingAssessment::getUpdatedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .map(AssessmentAdminSummary::from).toList();
    }

    @Transactional(readOnly = true)
    public AssessmentAdminView get(Long id) { return toView(load(id)); }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> validate(Long id) {
        return AssessmentContentValidator.validate(load(id).toBlueprint()).stream().map(ValidationIssue::toMap).toList();
    }

    @Transactional(readOnly = true)
    public AssessmentBlueprint export(Long id) { return load(id).toBlueprint(); }

    public AuthoringSchema schema() {
        Map<String, Object> rules = new LinkedHashMap<>();
        rules.put("requirements", Map.of("min", 2, "max", 10, "idFormat", "R1, R2, ..."));
        rules.put("problemStatementMinChars", AssessmentContentValidator.MIN_STATEMENT);
        rules.put("timeLimitMinutes", Map.of("min", 10, "max", 240, "default", 45));
        rules.put("memoryLimitMb", Map.of("min", 128, "max", 2048, "default", 512));
        rules.put("executionTimeoutSeconds", Map.of("min", 5, "max", 120, "default", 60));
        rules.put("paths", Map.of("publicTests", WorkspaceRules.PUBLIC_DIR, "hiddenTests", WorkspaceRules.HIDDEN_DIR));
        rules.put("limits", Map.of("maxFiles", WorkspaceRules.MAX_FILES, "maxFileChars", WorkspaceRules.MAX_FILE_CHARS, "maxTotalChars", WorkspaceRules.MAX_TOTAL_CHARS));
        rules.put("publishGate", List.of(
                "Title, track, difficulty and runtime",
                "Problem statement of at least " + AssessmentContentValidator.MIN_STATEMENT + " characters",
                "2-10 requirements (R1, R2, ...) - each scored by tests whose name contains its id",
                "Starter files, a reference solution, at least one public test and one hidden test",
                "Verified in the sandbox: the reference passes every test and the starter does not"));
        rules.put("llmSetupHint", llm.setupHint());
        return new AuthoringSchema(AuthoringCatalog.types(), AuthoringCatalog.runtimes(), rules, llm.configured(), llm.provider(), llm.model());
    }

    public SandboxExecutor.RunnerStatus runnerStatus() { return executor.status(); }

    // ---------------------------------------------------------------------------------------- writes

    @Transactional
    public AssessmentAdminView create(AssessmentUpsertRequest req, String adminName) {
        if (req.title() == null || req.title().isBlank()) throw ApiException.badRequest("title is required");
        if (req.codingType() == null) throw ApiException.badRequest("codingType is required (BACKEND, FRONTEND, MACHINE_LEARNING, AI, GENERATIVE_AI or RAG)");
        CodingAssessment a = CodingAssessment.builder()
                .codingType(req.codingType())
                .language("python")
                .status(CodingAssessmentStatus.DRAFT)
                .source(AssessmentSource.MANUAL)
                .createdBy(adminName)
                .build();
        apply(a, req);
        return toView(assessmentRepository.save(a));
    }

    @Transactional
    public AssessmentAdminView update(Long id, AssessmentUpsertRequest req) {
        CodingAssessment a = load(id);
        if (a.isLegacy()) throw ApiException.conflict("This question was created with the old authoring model and is retired. Create a new one (or duplicate nothing - legacy questions cannot run).");
        String before = a.toBlueprint().contentHash();
        apply(a, req);
        if (a.getStatus() == CodingAssessmentStatus.PUBLISHED && !before.equals(a.toBlueprint().contentHash())) {
            // RuntimeException => the transaction rolls back, so the managed entity's changes are discarded.
            throw ApiException.conflict("Unpublish this question before changing its requirements, files or tests - candidates may have attempts in progress.");
        }
        return toView(assessmentRepository.save(a));
    }

    @Transactional
    public AssessmentAdminView publish(Long id) {
        CodingAssessment a = load(id);
        if (a.isLegacy()) throw ApiException.conflict("Legacy questions cannot be published.");
        List<ValidationIssue> issues = AssessmentContentValidator.validate(a.toBlueprint());
        if (AssessmentContentValidator.hasErrors(issues)) {
            String first = issues.stream().filter(i -> i.severity() == ValidationIssue.Severity.ERROR).limit(3)
                    .map(i -> i.field() + ": " + i.message()).collect(Collectors.joining(" | "));
            throw ApiException.conflict("Cannot publish yet - " + first);
        }
        if (!a.verificationIsCurrent()) {
            throw ApiException.conflict("Verify this question in the sandbox first (it must pass verification with its current content).");
        }
        a.setStatus(CodingAssessmentStatus.PUBLISHED);
        return toView(assessmentRepository.save(a));
    }

    @Transactional
    public AssessmentAdminView unpublish(Long id) {
        CodingAssessment a = load(id);
        a.setStatus(CodingAssessmentStatus.DRAFT);
        return toView(assessmentRepository.save(a));
    }

    @Transactional
    public AssessmentAdminView archive(Long id) {
        CodingAssessment a = load(id);
        a.setStatus(CodingAssessmentStatus.ARCHIVED);
        return toView(assessmentRepository.save(a));
    }

    @Transactional
    public void delete(Long id) {
        CodingAssessment a = load(id);
        if (!attemptRepository.findByAssessment(a).isEmpty()) {
            a.setStatus(CodingAssessmentStatus.ARCHIVED);
            assessmentRepository.save(a);
            return;
        }
        assessmentRepository.delete(a);
    }

    @Transactional
    public AssessmentAdminView duplicate(Long id) {
        CodingAssessment s = load(id);
        CodingAssessment copy = CodingAssessment.builder()
                .title(s.getTitle() + " (Copy)").description(s.getDescription()).problemStatement(s.getProblemStatement())
                .codingType(s.getCodingType()).difficulty(s.getDifficulty()).status(CodingAssessmentStatus.DRAFT)
                .runtime(s.getRuntime()).technology(s.getTechnology()).language(s.getLanguage())
                .timeLimitMinutes(s.getTimeLimitMinutes()).memoryLimitMb(s.getMemoryLimitMb())
                .executionTimeoutSeconds(s.getExecutionTimeoutSeconds())
                .requirements(new ArrayList<>(s.getRequirements() == null ? List.of() : s.getRequirements()))
                .starterFiles(new HashMap<>(s.getStarterFiles())).publicTestFiles(new HashMap<>(s.getPublicTestFiles()))
                .hiddenTestFiles(new HashMap<>(s.getHiddenTestFiles())).referenceFiles(new HashMap<>(s.getReferenceFiles()))
                .allowedDependencies(new ArrayList<>(s.getAllowedDependencies())).tags(new ArrayList<>(s.getTags()))
                .skills(new ArrayList<>(s.getSkills())).targetJobRole(s.getTargetJobRole()).maxScore(s.getMaxScore())
                .source(s.getSource()).generationMeta(new HashMap<>(s.getGenerationMeta() == null ? Map.of() : s.getGenerationMeta()))
                .validationStatus(s.getValidationStatus()).validationReport(s.getValidationReport())
                .validatedHash(s.getValidatedHash()).validatedAt(s.getValidatedAt())
                .aiAssistantEnabled(s.isAiAssistantEnabled()).aiMaxHints(s.getAiMaxHints())
                .aiMaxRequests(s.getAiMaxRequests()).aiCooldownSeconds(s.getAiCooldownSeconds())
                .createdBy(s.getCreatedBy()).build();
        return toView(assessmentRepository.save(copy));
    }

    /** Third creation path: paste/upload a blueprint (same JSON the LLM produces and "Export" returns). */
    @Transactional
    public AssessmentAdminView importBlueprint(AssessmentBlueprint bp, String adminName) {
        return toView(assessmentRepository.findById(createDraftFromBlueprint(bp, AssessmentSource.IMPORTED, Map.of(), adminName, false)).orElseThrow());
    }

    /**
     * Persists a blueprint as a DRAFT. {@code lenient} (used for AI output) drops files with unusable paths instead of
     * rejecting the whole question, so a nearly-good generation can still be saved and repaired by hand.
     */
    @Transactional
    public Long createDraftFromBlueprint(AssessmentBlueprint bp, AssessmentSource source, Map<String, Object> meta,
                                         String adminName, boolean lenient) {
        if (bp.codingType() == null) throw ApiException.badRequest("codingType is required");
        AssessmentUpsertRequest req = new AssessmentUpsertRequest(
                bp.title() == null || bp.title().isBlank() ? "Untitled question" : bp.title(), bp.codingType(), bp.difficulty(), bp.runtime(),
                bp.summary(), bp.problemStatement(), bp.requirementsOrEmpty(),
                lenient ? keepValid(bp.starter()) : bp.starter(), lenient ? keepValid(bp.publicTests()) : bp.publicTests(),
                lenient ? keepValid(bp.hiddenTests()) : bp.hiddenTests(), lenient ? keepValid(bp.reference()) : bp.reference(),
                bp.technology(), bp.targetJobRole(), bp.skills(), bp.tags(), bp.timeLimitMinutes(),
                null, null, null, null, null, null, null);
        CodingAssessment a = CodingAssessment.builder()
                .codingType(bp.codingType()).language("python").status(CodingAssessmentStatus.DRAFT)
                .source(source).generationMeta(new HashMap<>(meta)).createdBy(adminName).build();
        apply(a, req);
        return assessmentRepository.save(a).getId();
    }

    /**
     * Registers a question that ships inside the application jar and was verified at build time by
     * {@code CodingLabSeedSelfCheckTest}. Only the seed loader calls this - it is intentionally not reachable from any
     * controller, because it skips the sandbox verification that every other path must pass.
     */
    @Transactional
    public Long registerShippedSeed(AssessmentBlueprint bp, String seedName) {
        Long id = createDraftFromBlueprint(bp, AssessmentSource.IMPORTED, Map.of("seed", seedName), "system", false);
        CodingAssessment a = load(id);
        Map<String, Object> report = new LinkedHashMap<>();
        report.put("ok", true);
        report.put("stage", "shipped-seed");
        report.put("note", "Verified at build time by CodingLabSeedSelfCheckTest (reference passes all tests, starter does not).");
        report.put("checkedAt", Instant.now().toString());
        report.put("issues", List.of());
        a.setValidationReport(report);
        a.setValidationStatus(ValidationStatus.VERIFIED);
        a.setValidatedHash(bp.contentHash());
        a.setValidatedAt(Instant.now());
        a.setStatus(CodingAssessmentStatus.PUBLISHED);
        assessmentRepository.save(a);
        return id;
    }

    /** True once at least one question in the current (v2) model exists - the seed loader then leaves the catalogue alone. */
    @Transactional(readOnly = true)
    public boolean hasCurrentQuestions() {
        return assessmentRepository.findAll().stream().anyMatch(a -> a.getRuntime() != null);
    }

    // ---------------------------------------------------------------------------------------- verification

    /** Starts an async sandbox verification; poll the returned job. */
    public JobView startVerification(Long id) {
        CodingAssessment a = load(id);
        if (a.isLegacy()) throw ApiException.conflict("Legacy questions cannot be verified - create a new one.");
        CodingLabJobs.Job job = jobs.start("VERIFY", j -> {
            j.assessmentId = id;
            j.state = "VERIFYING";
            j.message = "Running the reference solution and the tests in the sandbox...";
            AssessmentVerifier.Verification v = verifyAndStore(id);
            j.result = v.report();
            if (v.runnerProblem()) {
                j.state = "FAILED";
                j.message = String.valueOf(v.report().get("runnerMessage"));
            } else {
                j.message = v.ok() ? "Verified - the question can be published." : "Verification found problems - see the report.";
            }
        });
        return job.view();
    }

    public AssessmentVerifier.Verification verifyAndStore(Long id) {
        TransactionTemplate tx = new TransactionTemplate(transactionManager);
        record Snapshot(AssessmentBlueprint bp, int memoryMb, int timeoutSeconds) {}
        Snapshot snap = tx.execute(s -> {
            CodingAssessment a = load(id);
            return new Snapshot(a.toBlueprint(), a.getMemoryLimitMb(), a.getExecutionTimeoutSeconds());
        });
        AssessmentVerifier.Verification v = verifier.verify(snap.bp(), snap.memoryMb(), snap.timeoutSeconds());
        tx.executeWithoutResult(s -> storeVerification(id, snap.bp(), v));
        return v;
    }

    /** Records a verification result against the content that was actually verified (its hash), so later edits invalidate it. */
    @Transactional
    public void storeVerification(Long id, AssessmentBlueprint verified, AssessmentVerifier.Verification v) {
        CodingAssessment a = load(id);
        a.setValidationReport(new LinkedHashMap<>(v.report()));
        a.setValidatedAt(Instant.now());
        if (v.runnerProblem()) {
            a.setValidationStatus(ValidationStatus.UNVERIFIED);
            a.setValidatedHash(null);
        } else if (v.ok()) {
            a.setValidationStatus(ValidationStatus.VERIFIED);
            a.setValidatedHash(verified.contentHash());
        } else {
            a.setValidationStatus(ValidationStatus.FAILED);
            a.setValidatedHash(null);
        }
        assessmentRepository.save(a);
    }

    public JobView job(String id) {
        CodingLabJobs.Job j = jobs.get(id);
        if (j == null) throw ApiException.notFound("Job not found (it may have expired)");
        return j.view();
    }

    // ---------------------------------------------------------------------------------------- analytics

    @Transactional(readOnly = true)
    public List<SubmissionAdminView> submissions(Long id) {
        return submissionRepository.findByAssessment(load(id)).stream().map(SubmissionAdminView::from).toList();
    }

    @Transactional(readOnly = true)
    public List<AiHintInteraction> aiAudit(Long id) {
        return aiHintInteractionRepository.findByAssessmentIdOrderByRequestedAtDesc(id);
    }

    @Transactional(readOnly = true)
    public CodingAnalyticsView analytics() {
        List<CodingAssessment> assessments = assessmentRepository.findAll();
        List<CodingLabSubmission> all = submissionRepository.findAll();
        List<CodingLabSubmission> submits = all.stream().filter(s -> s.getKind() == CodingSubmissionKind.SUBMIT).toList();

        double avgScore = submits.stream().mapToDouble(CodingLabSubmission::getScore).average().orElse(0);
        long totalTests = submits.stream().mapToLong(CodingLabSubmission::getTestsTotal).sum();
        long passedTests = submits.stream().mapToLong(CodingLabSubmission::getTestsPassed).sum();
        double avgExecMs = all.stream().mapToInt(CodingLabSubmission::getRuntimeMs).average().orElse(0);

        Map<CodingType, Double> byType = submits.stream().collect(Collectors.groupingBy(
                s -> s.getAssessment().getCodingType(), Collectors.averagingDouble(CodingLabSubmission::getScore)));

        List<Map<String, Object>> hardest = submits.stream().collect(Collectors.groupingBy(s -> s.getAssessment().getId())).entrySet().stream()
                .map(e -> {
                    CodingAssessment a = e.getValue().get(0).getAssessment();
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("assessmentId", a.getId());
                    m.put("title", a.getTitle());
                    m.put("submissions", e.getValue().size());
                    m.put("averageScore", e.getValue().stream().mapToDouble(CodingLabSubmission::getScore).average().orElse(0));
                    return m;
                })
                .sorted(Comparator.comparingDouble(m -> (double) m.get("averageScore"))).limit(5).toList();

        List<AiHintInteraction> hints = aiHintInteractionRepository.findAll();
        long granted = hints.stream().filter(i -> i.getResponseType() == AiHintResponseType.HINT || i.getResponseType() == AiHintResponseType.ERROR_EXPLANATION).count();
        long blocked = hints.stream().filter(AiHintInteraction::isBlocked).count();
        return new CodingAnalyticsView(assessments.size(), submits.size(), avgScore,
                totalTests == 0 ? 0 : (double) passedTests / totalTests, avgExecMs, byType, hardest, granted, blocked);
    }

    // ---------------------------------------------------------------------------------------- internals

    private CodingAssessment load(Long id) {
        return assessmentRepository.findById(id).orElseThrow(() -> ApiException.notFound("Coding assessment not found"));
    }

    /** Applies a partial update. Structural problems (bad paths, wrong folders, oversize) are rejected outright;
     *  incompleteness is NOT an error here - it is reported as issues and blocks publishing instead. */
    private void apply(CodingAssessment a, AssessmentUpsertRequest r) {
        if (r.title() != null) a.setTitle(r.title().strip().length() > 200 ? r.title().strip().substring(0, 200) : r.title().strip());
        if (r.codingType() != null) a.setCodingType(r.codingType());
        if (r.difficulty() != null) a.setDifficulty(r.difficulty());
        CodingRuntime rt = r.runtime() != null ? r.runtime()
                : a.getRuntime() != null ? a.getRuntime() : AuthoringCatalog.defaultRuntime(a.getCodingType());
        a.setRuntime(rt);
        a.setLanguage(rt.language());
        if (r.summary() != null) a.setDescription(cap(r.summary().strip(), 4000));
        if (r.problemStatement() != null) a.setProblemStatement(cap(r.problemStatement().strip(), 20_000));
        if (r.requirements() != null) a.setRequirements(RequirementSpec.toMaps(normalizeRequirements(r.requirements())));
        if (r.technology() != null) a.setTechnology(cap(r.technology().strip(), 200));
        if (r.targetJobRole() != null) a.setTargetJobRole(cap(r.targetJobRole().strip(), 200));
        if (r.skills() != null) a.setSkills(cleanList(r.skills()));
        if (r.tags() != null) a.setTags(cleanList(r.tags()));

        List<String> problems = new ArrayList<>();
        if (r.starterFiles() != null) a.setStarterFiles(files(problems, "starterFiles", r.starterFiles(), null, true, rt));
        if (r.referenceFiles() != null) a.setReferenceFiles(files(problems, "referenceFiles", r.referenceFiles(), null, true, rt));
        if (r.publicTestFiles() != null) a.setPublicTestFiles(files(problems, "publicTestFiles", r.publicTestFiles(), WorkspaceRules.PUBLIC_DIR, false, rt));
        if (r.hiddenTestFiles() != null) a.setHiddenTestFiles(files(problems, "hiddenTestFiles", r.hiddenTestFiles(), WorkspaceRules.HIDDEN_DIR, false, rt));
        if (!problems.isEmpty()) throw ApiException.badRequest(String.join(" | ", problems));

        if (r.timeLimitMinutes() != null) a.setTimeLimitMinutes(range("timeLimitMinutes", r.timeLimitMinutes(), 1, 600));
        if (r.memoryLimitMb() != null) a.setMemoryLimitMb(range("memoryLimitMb", r.memoryLimitMb(), 128, 2048));
        if (r.executionTimeoutSeconds() != null) a.setExecutionTimeoutSeconds(range("executionTimeoutSeconds", r.executionTimeoutSeconds(), 5, 120));
        if (r.maxScore() != null) {
            if (r.maxScore() <= 0 || r.maxScore() > 1000) throw ApiException.badRequest("maxScore must be between 0 and 1000");
            a.setMaxScore(r.maxScore());
        }
        if (r.aiAssistantEnabled() != null) a.setAiAssistantEnabled(r.aiAssistantEnabled());
        if (r.aiMaxHints() != null) a.setAiMaxHints(range("aiMaxHints", r.aiMaxHints(), 0, 50));
        if (r.aiMaxRequests() != null) a.setAiMaxRequests(range("aiMaxRequests", r.aiMaxRequests(), 0, 200));
        if (r.aiCooldownSeconds() != null) a.setAiCooldownSeconds(range("aiCooldownSeconds", r.aiCooldownSeconds(), 0, 600));

        // Anything that changes what the sandbox runs invalidates an earlier verification.
        String hash = a.toBlueprint().contentHash();
        if (a.getValidationStatus() != ValidationStatus.UNVERIFIED && !hash.equals(a.getValidatedHash())) {
            a.setValidationStatus(ValidationStatus.UNVERIFIED);
        }
    }

    private Map<String, String> files(List<String> problems, String field, Map<String, String> in, String prefix, boolean forbidTests, CodingRuntime rt) {
        problems.addAll(WorkspaceRules.checkAuthored(field, in, prefix, forbidTests, rt));
        Map<String, String> out = new LinkedHashMap<>();
        in.forEach((k, v) -> out.put(k == null ? "" : k.trim().replace('\\', '/'), v == null ? "" : v));
        return out;
    }

    private Map<String, String> keepValid(Map<String, String> in) {
        Map<String, String> out = new LinkedHashMap<>();
        in.forEach((k, v) -> {
            try { out.put(WorkspaceRules.normalizePath(k), v); } catch (IllegalArgumentException ignored) { /* dropped; verification will flag what's missing */ }
        });
        return out;
    }

    private List<RequirementSpec> normalizeRequirements(List<RequirementSpec> in) {
        List<RequirementSpec> out = new ArrayList<>();
        for (RequirementSpec r : in) {
            String id = r.id() == null ? null : r.id().strip().toUpperCase(Locale.ROOT);
            out.add(new RequirementSpec(id, r.title() == null ? null : cap(r.title().strip(), 200),
                    r.description() == null ? "" : cap(r.description().strip(), 1000), r.weightOrDefault()));
        }
        return out;
    }

    private static List<String> cleanList(List<String> in) {
        return in.stream().filter(Objects::nonNull).map(String::strip).filter(s -> !s.isEmpty()).map(s -> cap(s, 80)).distinct().limit(20).toList();
    }

    private static int range(String name, int v, int min, int max) {
        if (v < min || v > max) throw ApiException.badRequest(name + " must be between " + min + " and " + max);
        return v;
    }

    private static String cap(String s, int max) { return s.length() > max ? s.substring(0, max) : s; }

    private AssessmentAdminView toView(CodingAssessment a) {
        List<ValidationIssue> issues = AssessmentContentValidator.validate(a.toBlueprint());
        boolean publishable = !a.isLegacy() && !AssessmentContentValidator.hasErrors(issues) && a.verificationIsCurrent();
        return new AssessmentAdminView(a.getId(), a.getTitle(), a.getDescription(), a.getProblemStatement(), a.getCodingType(),
                a.getDifficulty(), a.getRuntime(), a.getStatus(), a.getTechnology(), a.getTargetJobRole(), a.getTimeLimitMinutes(),
                a.getMemoryLimitMb(), a.getExecutionTimeoutSeconds(), a.getMaxScore(), a.requirementSpecs(), a.getStarterFiles(),
                a.getPublicTestFiles(), a.getHiddenTestFiles(), a.getReferenceFiles(), a.getSkills(), a.getTags(),
                a.isAiAssistantEnabled(), a.getAiMaxHints(), a.getAiMaxRequests(), a.getAiCooldownSeconds(), a.getSource(),
                a.getGenerationMeta(), a.getValidationStatus(), a.verificationIsCurrent(), a.getValidationReport(), a.getValidatedAt(),
                issues.stream().map(ValidationIssue::toMap).toList(), publishable, a.isLegacy(), a.getCreatedAt(), a.getUpdatedAt());
    }
}
