package com.placement.codinglab.generation;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.placement.codinglab.dto.CodingLabDtos.GenerateRequest;
import com.placement.codinglab.dto.CodingLabDtos.JobView;
import com.placement.codinglab.entity.AssessmentSource;
import com.placement.codinglab.entity.CodingRuntime;
import com.placement.codinglab.entity.CodingType;
import com.placement.codinglab.model.AssessmentBlueprint;
import com.placement.codinglab.model.ValidationIssue;
import com.placement.codinglab.service.AssessmentVerifier;
import com.placement.codinglab.service.AuthoringCatalog;
import com.placement.codinglab.service.CodingAssessmentAdminService;
import com.placement.codinglab.service.CodingLabJobs;
import com.placement.exception.ApiException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.*;
import java.util.function.BiConsumer;

/**
 * Generates a question with the LLM, then subjects it to the SAME gate as a hand-written one: static validation and
 * a real sandbox run of the reference solution. If that fails, the concrete failures are fed back to the model for
 * up to {@code app.llm.max-repairs} repair rounds. The outcome is always saved as a DRAFT (even a failed one, with
 * its report) so the admin can fix it by hand instead of losing the work - nothing is auto-published.
 */
@Service
@Slf4j
public class AssessmentGenerationService {

    private final LlmGateway llm;
    private final AssessmentVerifier verifier;
    private final CodingAssessmentAdminService adminService;
    private final CodingLabJobs jobs;
    private final int maxRepairs;
    private final ObjectMapper mapper = new ObjectMapper()
            .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false)
            .configure(DeserializationFeature.ACCEPT_SINGLE_VALUE_AS_ARRAY, true)
            .configure(DeserializationFeature.ACCEPT_EMPTY_STRING_AS_NULL_OBJECT, true);

    public AssessmentGenerationService(LlmGateway llm, AssessmentVerifier verifier, CodingAssessmentAdminService adminService,
                                       CodingLabJobs jobs, @Value("${app.llm.max-repairs:2}") int maxRepairs) {
        this.llm = llm;
        this.verifier = verifier;
        this.adminService = adminService;
        this.jobs = jobs;
        this.maxRepairs = Math.max(0, Math.min(4, maxRepairs));
    }

    public JobView start(GenerateRequest req, String adminName) {
        if (!llm.configured()) throw ApiException.conflict("AI generation is not configured. " + llm.setupHint());
        if (req.codingType() == null) throw ApiException.badRequest("codingType is required");
        if (req.difficulty() == null) throw ApiException.badRequest("difficulty is required");
        if (req.topic() == null || req.topic().isBlank()) throw ApiException.badRequest("Describe the topic (e.g. \"rate limiter service\", \"paginated table component\", \"TF-IDF retriever\")");
        CodingRuntime runtime = req.runtime() != null ? req.runtime() : AuthoringCatalog.defaultRuntime(req.codingType());
        if (req.codingType() == CodingType.FRONTEND && runtime != CodingRuntime.NODE_TEST) throw ApiException.badRequest("Frontend questions must use the Node runtime");
        int reqCount = req.requirementCount() == null ? 4 : Math.max(3, Math.min(6, req.requirementCount()));

        CodingLabJobs.Job job = jobs.start("GENERATE", j -> run(j, req, runtime, reqCount, adminName));
        return job.view();
    }

    private void run(CodingLabJobs.Job job, GenerateRequest req, CodingRuntime runtime, int reqCount, String adminName) {
        Instant started = Instant.now();
        job.state = "RUNNING";
        Generated g = generate(req, runtime, reqCount, (state, message) -> { job.state = state; job.message = message; });

        AssessmentBlueprint bp = g.blueprint();
        Map<String, Object> meta = new LinkedHashMap<>();
        meta.put("provider", llm.provider());
        meta.put("model", llm.model());
        meta.put("repairRounds", g.repairs());
        meta.put("generatedAt", started.toString());
        meta.put("topic", req.topic());
        if (req.scenario() != null) meta.put("scenario", req.scenario());
        if (req.extraInstructions() != null) meta.put("extraInstructions", req.extraInstructions());

        Long id = adminService.createDraftFromBlueprint(bp, AssessmentSource.AI_GENERATED, meta, adminName, true);
        job.assessmentId = id;
        AssessmentVerifier.Verification v = g.verification();
        if (v != null) {
            adminService.storeVerification(id, bp, v);
            job.result = v.report();
        }

        if (v == null || g.parseProblem() != null) {
            job.message = "Saved as a draft, but it needs manual fixes.";
        } else if (v.runnerProblem()) {
            job.message = "Question generated and saved as a draft, but it could NOT be verified: " + v.report().get("runnerMessage");
        } else if (v.ok()) {
            job.message = "Generated and verified" + (g.repairs() > 0 ? " after " + g.repairs() + " repair round(s)" : "") + ". Review it, then publish.";
        } else {
            job.message = "Saved as a draft, but verification still reports problems after " + g.repairs() + " repair round(s). Open it to fix them.";
        }
    }

    /** Outcome of the generate -> verify -> repair loop (before anything is persisted). */
    record Generated(AssessmentBlueprint blueprint, AssessmentVerifier.Verification verification, int repairs, String parseProblem) {}

    /**
     * Asks the model for a question, verifies it in the sandbox and, while it fails, sends the concrete failures back
     * for repair (at most {@code maxRepairs} times). Stops early when the sandbox itself is unavailable, because
     * repairing cannot help then.
     */
    Generated generate(GenerateRequest req, CodingRuntime runtime, int reqCount, BiConsumer<String, String> progress) {
        int repairs = 0;
        progress.accept("RUNNING", "Asking the model to write the question...");
        String raw = llm.complete(GenerationPrompts.SYSTEM, GenerationPrompts.userPrompt(req, runtime, reqCount));
        AssessmentBlueprint bp = null;
        String parseProblem;
        AssessmentVerifier.Verification verification = null;

        while (true) {
            List<ValidationIssue> issues = List.of();
            try {
                bp = parse(raw, req, runtime);
                parseProblem = null;
                progress.accept("VERIFYING", repairs == 0 ? "Checking the question in the sandbox..." : "Re-checking after repair " + repairs + "...");
                verification = verifier.verify(bp, 512, 60);
                if (verification.ok() || verification.runnerProblem()) break;
                issues = verification.issues();
            } catch (IllegalArgumentException e) {
                parseProblem = e.getMessage();
            }
            if (repairs >= maxRepairs) break;
            repairs++;
            progress.accept("REPAIRING", "Repair round " + repairs + " of " + maxRepairs + ": sending the failures back to the model...");
            raw = llm.complete(GenerationPrompts.SYSTEM, GenerationPrompts.repairPrompt(raw, issues, parseProblem));
        }
        if (bp == null) throw new IllegalStateException("The model did not return a usable question (" + parseProblem + "). Try again or simplify the topic.");
        return new Generated(bp, verification, repairs, parseProblem);
    }

    /** Extracts the JSON object from the model's answer and maps it onto a blueprint, forcing the admin's choices. */
    AssessmentBlueprint parse(String raw, GenerateRequest req, CodingRuntime runtime) {
        String json = extractJson(raw);
        AssessmentBlueprint b;
        try {
            b = mapper.readValue(json, AssessmentBlueprint.class);
        } catch (Exception e) {
            throw new IllegalArgumentException(e.getClass().getSimpleName() + ": " + firstLine(e.getMessage()));
        }
        Integer time = b.timeLimitMinutes() != null ? b.timeLimitMinutes() : req.timeLimitMinutes();
        if (req.timeLimitMinutes() != null) time = req.timeLimitMinutes();
        return new AssessmentBlueprint(b.title(), req.codingType(), req.difficulty(), runtime, b.summary(), b.problemStatement(),
                b.requirementsOrEmpty(), b.starter(), b.publicTests(), b.hiddenTests(), b.reference(), time, b.technology(),
                req.targetJobRole() != null && !req.targetJobRole().isBlank() ? req.targetJobRole().strip() : b.targetJobRole(),
                b.skills() != null ? b.skills() : req.skills(), b.tags());
    }

    static String extractJson(String raw) {
        if (raw == null) throw new IllegalArgumentException("empty answer");
        String s = raw.strip();
        if (s.startsWith("```")) {
            int nl = s.indexOf('\n');
            s = nl > 0 ? s.substring(nl + 1) : s;
            int end = s.lastIndexOf("```");
            if (end > 0) s = s.substring(0, end);
        }
        int a = s.indexOf('{'), z = s.lastIndexOf('}');
        if (a < 0 || z <= a) throw new IllegalArgumentException("no JSON object found in the answer");
        return s.substring(a, z + 1);
    }

    private static String firstLine(String s) {
        if (s == null) return "invalid JSON";
        String line = s.split("\n")[0];
        return line.length() > 300 ? line.substring(0, 300) : line;
    }
}
