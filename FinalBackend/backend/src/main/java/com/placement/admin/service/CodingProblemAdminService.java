package com.placement.service;

import com.placement.dto.CodingDtos.*;
import com.placement.entity.CodingProblem;
import com.placement.entity.Difficulty;
import com.placement.entity.ExecutionMode;
import com.placement.entity.ProblemConstraint;
import com.placement.entity.ProblemExample;
import com.placement.exception.ApiException;
import com.placement.repository.CodingProblemRepository;
import com.placement.repository.CodingSubmissionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

/**
 * Admin CRUD for the legacy coding module (CodingProblem + its ProblemExample/ProblemConstraint
 * children). Before this class existed, CodingProblem had no admin write path at all - every
 * problem in the database came from DataLoader or a seed/sync loader, never from an admin API -
 * the same gap already fixed for TechnicalMcqQuestion (questionbank module) and AptitudeQuestion.
 * This is the third and largest instance of that pattern.
 */
@Service
@RequiredArgsConstructor
public class CodingProblemAdminService {

    private final CodingProblemRepository repository;
    private final CodingSubmissionRepository submissionRepository;
    private final AuditLogService auditLogService;
    private final CurrentUserService currentUserService;

    @Transactional(readOnly = true)
    public CodingProblemAdminPage search(String topic, Difficulty difficulty, Boolean active,
                                          String search, int page, int size) {
        Page<CodingProblem> result = repository.search(blankToNull(topic), difficulty, active,
                blankToNull(search), PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "id")));
        return new CodingProblemAdminPage(
                result.getContent().stream().map(CodingProblemAdminView::from).toList(),
                result.getTotalElements(), result.getTotalPages(), page, size);
    }

    @Transactional(readOnly = true)
    public CodingProblemAdminView get(Long id) {
        return CodingProblemAdminView.from(findOrThrow(id));
    }

    @Transactional
    public CodingProblemAdminView create(CodingProblemUpsertRequest req) {
        validate(req);
        CodingProblem p = CodingProblem.builder().active(true).build();
        applyRequest(p, req);
        CodingProblem saved = repository.save(p);
        auditLogService.record(currentUserService.getCurrentUser(), "QUESTION_CREATED",
                "CodingProblem", saved.getId(), saved.getTitle());
        return CodingProblemAdminView.from(saved);
    }

    /** Bulk JSON upload: same validation and audit trail as create(), one row at a time, wrapped
     *  in a single transaction (same all-or-nothing semantics as this codebase's other bulk-upload
     *  endpoints) - a bad row rolls the whole batch back rather than leaving a partial import, and
     *  the row number in the error message is what lets an admin find it in their file. */
    @Transactional
    public List<CodingProblemAdminView> bulkCreate(List<CodingProblemUpsertRequest> requests) {
        List<CodingProblemAdminView> created = new ArrayList<>();
        for (int i = 0; i < requests.size(); i++) {
            try {
                created.add(create(requests.get(i)));
            } catch (ApiException ex) {
                throw ApiException.badRequest("Row " + (i + 1) + ": " + ex.getMessage());
            }
        }
        return created;
    }

    @Transactional
    public CodingProblemAdminView update(Long id, CodingProblemUpsertRequest req) {
        validate(req);
        CodingProblem p = findOrThrow(id);
        applyRequest(p, req);
        CodingProblem saved = repository.save(p);
        auditLogService.record(currentUserService.getCurrentUser(), "QUESTION_UPDATED",
                "CodingProblem", saved.getId(), null);
        return CodingProblemAdminView.from(saved);
    }

    /** Default delete: soft (active=false). See CodingProblem.active's javadoc - a hard delete of
     *  a problem with any submission would fail as a raw FK-violation anyway, and archiving is
     *  the right default even for a never-attempted problem, for the same reversibility reasons
     *  as the other two admin CRUDs in this codebase. */
    @Transactional
    public CodingProblemAdminView archive(Long id) {
        CodingProblem p = findOrThrow(id);
        p.setActive(false);
        CodingProblem saved = repository.save(p);
        auditLogService.record(currentUserService.getCurrentUser(), "QUESTION_ARCHIVED",
                "CodingProblem", saved.getId(), null);
        return CodingProblemAdminView.from(saved);
    }

    @Transactional
    public CodingProblemAdminView reactivate(Long id) {
        CodingProblem p = findOrThrow(id);
        p.setActive(true);
        CodingProblem saved = repository.save(p);
        auditLogService.record(currentUserService.getCurrentUser(), "QUESTION_REACTIVATED",
                "CodingProblem", saved.getId(), null);
        return CodingProblemAdminView.from(saved);
    }

    @Transactional
    public void hardDelete(Long id) {
        if (!repository.existsById(id)) {
            throw ApiException.notFound("Coding problem " + id + " not found");
        }
        long submissionCount = submissionRepository.countByProblem_Id(id);
        if (submissionCount > 0) {
            throw ApiException.conflict("Unable to delete problem. It is referenced by "
                    + submissionCount + " student submission" + (submissionCount == 1 ? "" : "s")
                    + ". Archive it instead.");
        }
        repository.deleteById(id); // examples/constraints cascade via orphanRemoval
        auditLogService.record(currentUserService.getCurrentUser(), "QUESTION_DELETED",
                "CodingProblem", id, "Permanent delete");
    }

    private CodingProblem findOrThrow(Long id) {
        return repository.findById(id)
                .orElseThrow(() -> ApiException.notFound("Coding problem " + id + " not found"));
    }

    /** Mutates CodingProblem's existing examples/constraints collections in place (clear + re-add)
     *  rather than calling setExamples()/setConstraints() with a fresh list. Both are
     *  cascade=ALL, orphanRemoval=true @OneToMany collections owned by Hibernate's managed
     *  PersistentBag wrapper - replacing the collection reference on an already-managed entity is
     *  a well-known source of "a collection with cascade=all-delete-orphan was no longer
     *  referenced" errors on some Hibernate versions. Clearing and re-populating the same
     *  collection instance sidesteps that entirely and is the documented-safe pattern. */
    private void applyRequest(CodingProblem p, CodingProblemUpsertRequest req) {
        p.setTitle(req.title());
        p.setStatement(req.statement());
        p.setTopic(req.topic());
        p.setDifficulty(Difficulty.valueOf(req.difficulty().toUpperCase()));
        p.setSampleInput(req.sampleInput());
        p.setSampleOutput(req.sampleOutput());
        p.setTemplates(req.templates() == null ? new java.util.HashMap<>() : new java.util.HashMap<>(req.templates()));
        p.setTimeLimitMs(req.timeLimitMs() == null ? 1000 : req.timeLimitMs());
        p.setMemoryLimitMb(req.memoryLimitMb() == null ? 256 : req.memoryLimitMb());
        p.setAcceptanceRate(req.acceptanceRate() == null ? 56.4 : req.acceptanceRate());
        p.setCompanyTags(req.companyTags());
        p.setMethodName(req.methodName());
        p.setReturnType(req.returnType());
        p.setParameters(req.parameters() == null ? new ArrayList<>() : new ArrayList<>(req.parameters()));
        p.setExecutionMode(req.executionMode() == null ? ExecutionMode.METHOD : ExecutionMode.valueOf(req.executionMode().toUpperCase()));
        p.setSchemaDdl(req.schemaDdl());
        p.setExpectedOutput(req.expectedOutput());

        p.getExamples().clear();
        if (req.examples() != null) {
            int ordinal = 0;
            for (ProblemExampleAdminDto e : req.examples()) {
                p.getExamples().add(ProblemExample.builder()
                        .problem(p).ordinal(ordinal++)
                        .title(e.title()).input(e.input()).output(e.output())
                        .explanation(e.explanation()).hidden(e.hidden())
                        .build());
            }
        }

        p.getConstraints().clear();
        if (req.constraints() != null) {
            int ordinal = 0;
            for (ProblemConstraintAdminDto c : req.constraints()) {
                p.getConstraints().add(ProblemConstraint.builder()
                        .problem(p).ordinal(ordinal++).text(c.text())
                        .build());
            }
        }
    }

    /** Same "catch everything at the one place every write passes through" reasoning as the other
     *  two admin CRUDs' validate() methods. */
    private void validate(CodingProblemUpsertRequest req) {
        List<String> errors = new ArrayList<>();

        if (isBlank(req.title())) errors.add("Title is required.");
        if (isBlank(req.statement())) errors.add("Problem statement is required.");

        if (isBlank(req.difficulty())) {
            errors.add("Difficulty is required.");
        } else {
            try {
                Difficulty.valueOf(req.difficulty().toUpperCase());
            } catch (IllegalArgumentException ex) {
                errors.add("\"" + req.difficulty() + "\" is not a valid difficulty.");
            }
        }

        String modeStr = req.executionMode();
        ExecutionMode mode = null;
        if (!isBlank(modeStr)) {
            try {
                mode = ExecutionMode.valueOf(modeStr.toUpperCase());
            } catch (IllegalArgumentException ex) {
                errors.add("\"" + modeStr + "\" is not a valid execution mode.");
            }
        }
        // METHOD mode (the default, and what the boilerplate generator relies on) needs a real
        // signature - see CodingProblem.returnType's javadoc on why a missing one used to produce
        // a hardcoded "Object"/"null" stub instead of the real generated method signature.
        if ((mode == null || mode == ExecutionMode.METHOD)) {
            if (isBlank(req.methodName())) errors.add("Method name is required for METHOD execution mode.");
            if (isBlank(req.returnType())) errors.add("Return type is required for METHOD execution mode.");
        }
        // SQL needs the table setup up front - there is no method signature to fall back on, and
        // an admin-authored problem with no schema is not reviewable, let alone gradable, once a
        // real runner exists for this mode. DataFrame is intentionally more lenient: schemaDdl is
        // documentation there (column/dtype notes), not executable DDL, so it stays optional.
        if (mode == ExecutionMode.SQL && isBlank(req.schemaDdl())) {
            errors.add("Schema DDL (table setup) is required for SQL execution mode.");
        }

        if (req.timeLimitMs() != null && req.timeLimitMs() <= 0) errors.add("Time limit must be greater than zero.");
        if (req.memoryLimitMb() != null && req.memoryLimitMb() <= 0) errors.add("Memory limit must be greater than zero.");

        if (req.examples() != null) {
            for (int i = 0; i < req.examples().size(); i++) {
                ProblemExampleAdminDto e = req.examples().get(i);
                if (isBlank(e.input()) || isBlank(e.output())) {
                    errors.add("Example " + (i + 1) + " needs both an input and an output.");
                }
            }
        }

        if (!errors.isEmpty()) {
            throw ApiException.badRequest(String.join(" ", errors));
        }
    }

    private static boolean isBlank(String s) { return s == null || s.isBlank(); }
    private static String blankToNull(String s) { return isBlank(s) ? null : s; }
}