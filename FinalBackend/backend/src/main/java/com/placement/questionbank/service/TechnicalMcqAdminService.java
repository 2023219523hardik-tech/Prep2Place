package com.placement.questionbank.service;

import com.placement.questionbank.dto.QuestionBankDtos.TechnicalMcqAdminPage;
import com.placement.questionbank.dto.QuestionBankDtos.TechnicalMcqAdminView;
import com.placement.questionbank.dto.QuestionBankDtos.TechnicalMcqUpsertRequest;
import com.placement.questionbank.dto.QuestionBankDtos.TechnicalMcqImportRequest;
import com.placement.questionbank.dto.QuestionBankDtos.TechnicalMcqImportReport;
import com.placement.questionbank.entity.TechnicalCategory;
import com.placement.questionbank.entity.TechnicalMcqQuestion;
import com.placement.questionbank.repository.TechnicalMcqQuestionRepository;
import com.placement.exception.ApiException;
import com.placement.service.AuditLogService;
import com.placement.service.CurrentUserService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Admin CRUD for the Technical MCQ bank (com.placement.questionbank.entity.TechnicalMcqQuestion).
 *
 * Before this class existed, TechnicalMcqQuestionRepository.save() was only ever called from
 * TechnicalMcqSeedLoader on startup - there was no way for an admin to create, edit, or retire a
 * technical MCQ (including its correct answer) through any API. This service is the fix: every
 * write here is the same JPA-managed save() that already round-trips correctly for every other
 * admin-editable entity in this codebase, so "admin changes B -> D" now actually reaches Postgres.
 */
@Service
@RequiredArgsConstructor
public class TechnicalMcqAdminService {

    private final TechnicalMcqQuestionRepository repository;
    private final AuditLogService auditLogService;
    private final CurrentUserService currentUserService;

    @Transactional(readOnly = true)
    public TechnicalMcqAdminPage search(TechnicalCategory category, com.placement.entity.Difficulty difficulty,
                                         String topic, String subtopic,
                                         String search, int page, int size) {
        Page<TechnicalMcqQuestion> result = repository.search(category, difficulty, topic, subtopic,
                blankToNull(search), PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "id")));
        return TechnicalMcqAdminPage.builder()
                .content(result.getContent().stream().map(TechnicalMcqAdminView::from).toList())
                .totalElements(result.getTotalElements())
                .totalPages(result.getTotalPages())
                .page(page)
                .size(size)
                .build();
    }

    @Transactional(readOnly = true)
    public TechnicalMcqAdminView get(Long id) {
        return TechnicalMcqAdminView.from(findOrThrow(id));
    }

    @Transactional
    public TechnicalMcqAdminView create(TechnicalMcqUpsertRequest req) {
        validate(req);
        TechnicalMcqQuestion q = TechnicalMcqQuestion.builder()
                .active(true)
                .createdAt(Instant.now())
                .build();
        applyRequest(q, req);
        TechnicalMcqQuestion saved = repository.save(q);
        auditLogService.record(currentUserService.getCurrentUser(), "QUESTION_CREATED",
                "TechnicalMcqQuestion", saved.getId(), saved.getQuestionText());
        return TechnicalMcqAdminView.from(saved);
    }

    /** Bulk JSON upload: per-row tolerant. Each row is validated and persisted in its own
     *  transaction (the outer method is intentionally non-transactional so one bad row cannot
     *  roll back the rest). Returns inserted/updated/skipped/duplicates/failed counts plus a
     *  per-row failures list with index + reason. */
    public TechnicalMcqImportReport bulkCreate(List<TechnicalMcqUpsertRequest> requests) {
        if (requests == null || requests.isEmpty()) {
            throw ApiException.badRequest("The JSON array contains no questions.");
        }

        int inserted = 0, skipped = 0, duplicates = 0, failed = 0;
        List<String> errors = new ArrayList<>();
        List<Map<String, Object>> failures = new ArrayList<>();
        Set<String> seenTexts = new java.util.HashSet<>();

        for (int i = 0; i < requests.size(); i++) {
            TechnicalMcqUpsertRequest req = requests.get(i);
            int row = i + 1;
            try {
                if (req == null) {
                    failed++;
                    String reason = "Row " + row + ": question object is required.";
                    errors.add(reason);
                    failures.add(Map.of("row", row, "reason", "question object is required."));
                    continue;
                }
                String text = req.getQuestionText();
                if (text != null && !text.isBlank()) {
                    if (!seenTexts.add(text.trim())) {
                        duplicates++;
                        continue;
                    }
                    if (repository.existsByQuestionText(text.trim())) {
                        duplicates++;
                        continue;
                    }
                }
                create(req);
                inserted++;
            } catch (ApiException ex) {
                failed++;
                String reason = "Row " + row + ": " + ex.getMessage();
                errors.add(reason);
                failures.add(Map.of("row", row, "reason", ex.getMessage()));
            } catch (Exception ex) {
                failed++;
                String reason = "Row " + row + ": " + (ex.getMessage() != null ? ex.getMessage() : ex.getClass().getSimpleName());
                errors.add(reason);
                failures.add(Map.of("row", row, "reason", ex.getMessage() != null ? ex.getMessage() : ex.getClass().getSimpleName()));
            }
        }

        auditLogService.record(currentUserService.getCurrentUser(), "QUESTION_BANK_BULK_UPLOAD",
                "TechnicalMcqQuestion", null,
                "Bulk upload: " + inserted + " inserted, " + duplicates + " duplicates, " + failed + " failed");

        return TechnicalMcqImportReport.builder()
                .totalRecords(requests.size())
                .inserted(inserted)
                .updated(0)
                .unchanged(0)
                .skipped(skipped)
                .duplicates(duplicates)
                .failed(failed)
                .errors(errors)
                .failures(failures)
                .build();
    }

    /**
     * Imports the schema used by seed-data/technical-mcq-questions.json.  Validation happens for
     * the complete payload before any write, so a bad row cannot be reported as a partial success.
     * Re-imports are idempotent through sourceRef, which is the canonical identifier in the seed.
     */
    @Transactional
    public TechnicalMcqImportReport importSeed(List<TechnicalMcqImportRequest> requests) {
        if (requests == null || requests.isEmpty()) {
            throw ApiException.badRequest("The JSON array contains no questions.");
        }

        List<String> errors = new ArrayList<>();
        Set<String> sourceRefs = new java.util.HashSet<>();
        for (int i = 0; i < requests.size(); i++) {
            TechnicalMcqImportRequest request = requests.get(i);
            int row = i + 1;
            if (request == null) {
                errors.add("Row " + row + ": question object is required.");
                continue;
            }
            if (isBlank(request.getSourceRef())) {
                String textHash = request.getQuestionText() != null ? String.valueOf(Math.abs(request.getQuestionText().hashCode())) : java.util.UUID.randomUUID().toString().substring(0, 8);
                request.setSourceRef("tmq-auto-" + textHash + "-" + row);
            }
            if (!sourceRefs.add(request.getSourceRef().trim())) {
                request.setSourceRef(request.getSourceRef().trim() + "-" + row);
                sourceRefs.add(request.getSourceRef().trim());
            }
            try {
                validate(request);
            } catch (ApiException ex) {
                errors.add("Row " + row + ": " + ex.getMessage());
            }
        }
        if (!errors.isEmpty()) {
            throw ApiException.badRequest(String.join(" ", errors));
        }

        int inserted = 0, updated = 0, unchanged = 0;
        for (TechnicalMcqImportRequest request : requests) {
            String sourceRef = request.getSourceRef().trim();
            TechnicalMcqQuestion question = repository.findBySourceRef(sourceRef).orElse(null);
            if (question == null) {
                question = TechnicalMcqQuestion.builder().sourceRef(sourceRef).active(true)
                        .createdAt(Instant.now()).build();
                applyRequest(question, request);
                repository.save(question);
                inserted++;
            } else if (applyImportRequest(question, request)) {
                repository.save(question);
                updated++;
            } else {
                unchanged++;
            }
        }
        auditLogService.record(currentUserService.getCurrentUser(), "QUESTION_BANK_IMPORTED",
                "TechnicalMcqQuestion", null, "Imported " + requests.size() + " technical MCQ record(s)");
        return TechnicalMcqImportReport.builder().totalRecords(requests.size()).inserted(inserted)
                .updated(updated).unchanged(unchanged).failed(0).errors(List.of()).build();
    }

    @Transactional
    public TechnicalMcqAdminView update(Long id, TechnicalMcqUpsertRequest req) {
        validate(req);
        TechnicalMcqQuestion q = findOrThrow(id);
        applyRequest(q, req);
        // Explicit save (rather than relying on the transactional dirty-check alone) so a caller
        // reading the response back gets exactly what was persisted, not a stale in-memory copy -
        // this is the specific guarantee the "B -> D must reach Postgres" requirement is about.
        TechnicalMcqQuestion saved = repository.save(q);
        auditLogService.record(currentUserService.getCurrentUser(), "QUESTION_UPDATED",
                "TechnicalMcqQuestion", saved.getId(), null);
        return TechnicalMcqAdminView.from(saved);
    }

    /** Soft delete: flips active=false rather than removing the row. TechnicalMcqQuestion has no
     *  live foreign key from ManagedTestQuestion - test sections snapshot the question's content at
     *  attach time (see ManagedTestDemoSeedLoader.attach / TestQuestionSourcingService.snapshotFromBank),
     *  so a hard delete here would not corrupt any historical attempt. Soft delete is still the
     *  default because it is reversible and keeps the row available for audit / "who asked this" -
     *  see hardDelete() below for the explicit, opt-in destructive path. */
    @Transactional
    public TechnicalMcqAdminView archive(Long id) {
        TechnicalMcqQuestion q = findOrThrow(id);
        q.setActive(false);
        q.setUpdatedAt(Instant.now());
        TechnicalMcqQuestion saved = repository.save(q);
        auditLogService.record(currentUserService.getCurrentUser(), "QUESTION_ARCHIVED",
                "TechnicalMcqQuestion", saved.getId(), null);
        return TechnicalMcqAdminView.from(saved);
    }

    @Transactional
    public TechnicalMcqAdminView reactivate(Long id) {
        TechnicalMcqQuestion q = findOrThrow(id);
        q.setActive(true);
        q.setUpdatedAt(Instant.now());
        TechnicalMcqQuestion saved = repository.save(q);
        auditLogService.record(currentUserService.getCurrentUser(), "QUESTION_REACTIVATED",
                "TechnicalMcqQuestion", saved.getId(), null);
        return TechnicalMcqAdminView.from(saved);
    }

    /** Genuinely destructive - only safe because of the snapshot pattern described on archive().
     *  Kept as a separate explicit method (not the default DELETE behaviour) so a future change to
     *  how test sections reference bank questions can't silently make this unsafe without someone
     *  noticing this method needs a reference-count guard added first. */
    @Transactional
    public void hardDelete(Long id) {
        if (!repository.existsById(id)) {
            throw ApiException.notFound("Technical MCQ " + id + " not found");
        }
        repository.deleteById(id);
        auditLogService.record(currentUserService.getCurrentUser(), "QUESTION_DELETED",
                "TechnicalMcqQuestion", id, "Permanent delete");
    }

    private TechnicalMcqQuestion findOrThrow(Long id) {
        return repository.findById(id)
                .orElseThrow(() -> ApiException.notFound("Technical MCQ " + id + " not found"));
    }

    private void applyRequest(TechnicalMcqQuestion q, TechnicalMcqUpsertRequest req) {
        q.setQuestionText(req.getQuestionText());
        q.setCategory(req.getCategory());
        q.setTopic(req.getTopic());
        q.setSubtopic(req.getSubtopic());
        q.setDifficulty(req.getDifficulty());
        q.setOptions(new ArrayList<>(req.getOptions()));
        q.setCorrectOptions(new ArrayList<>(req.getCorrectOptions()));
        q.setMultipleCorrect(req.isMultipleCorrect());
        q.setExplanation(req.getExplanation());
        q.setDefaultMarks(req.getDefaultMarks() == null ? 1d : req.getDefaultMarks());
        q.setDefaultNegativeMarks(req.getDefaultNegativeMarks() == null ? 0d : req.getDefaultNegativeMarks());
        q.setEstimatedTimeSeconds(req.getEstimatedTimeSeconds() == null ? 60 : req.getEstimatedTimeSeconds());
        q.setUpdatedAt(Instant.now());
    }

    private boolean applyImportRequest(TechnicalMcqQuestion q, TechnicalMcqImportRequest req) {
        Instant previousUpdatedAt = q.getUpdatedAt();
        TechnicalMcqQuestion before = TechnicalMcqQuestion.builder()
                .questionText(q.getQuestionText()).category(q.getCategory()).topic(q.getTopic())
                .subtopic(q.getSubtopic()).difficulty(q.getDifficulty()).options(q.getOptions())
                .correctOptions(q.getCorrectOptions()).multipleCorrect(q.isMultipleCorrect())
                .explanation(q.getExplanation()).defaultMarks(q.getDefaultMarks())
                .defaultNegativeMarks(q.getDefaultNegativeMarks()).estimatedTimeSeconds(q.getEstimatedTimeSeconds())
                .build();
        applyRequest(q, req);
        boolean changed = !java.util.Objects.equals(before.getQuestionText(), q.getQuestionText())
                || before.getCategory() != q.getCategory()
                || !java.util.Objects.equals(before.getTopic(), q.getTopic())
                || !java.util.Objects.equals(before.getSubtopic(), q.getSubtopic())
                || before.getDifficulty() != q.getDifficulty()
                || !java.util.Objects.equals(before.getOptions(), q.getOptions())
                || !java.util.Objects.equals(before.getCorrectOptions(), q.getCorrectOptions())
                || before.isMultipleCorrect() != q.isMultipleCorrect()
                || !java.util.Objects.equals(before.getExplanation(), q.getExplanation())
                || Double.compare(before.getDefaultMarks(), q.getDefaultMarks()) != 0
                || Double.compare(before.getDefaultNegativeMarks(), q.getDefaultNegativeMarks()) != 0
                || before.getEstimatedTimeSeconds() != q.getEstimatedTimeSeconds();
        if (!changed) q.setUpdatedAt(previousUpdatedAt);
        return changed;
    }

    /** Mirrors the spec's own worked example almost exactly: "Option C is empty" / "invalid correct
     *  answer" need to be caught here, at the one place every create and every update passes
     *  through, rather than trusted to whatever the frontend form happens to send. */
    private void validate(TechnicalMcqUpsertRequest req) {
        List<String> errors = new ArrayList<>();

        if (isBlank(req.getQuestionText())) errors.add("Question text is required.");
        if (req.getCategory() == null) req.setCategory(TechnicalCategory.DSA);
        if (req.getDifficulty() == null) req.setDifficulty(com.placement.entity.Difficulty.MEDIUM);

        List<Map<String, String>> options = req.getOptions();
        if (options == null || options.size() < 2) {
            errors.add("At least two options are required.");
            options = List.of();
        }

        Set<String> keys = new java.util.HashSet<>();
        for (int i = 0; i < options.size(); i++) {
            Map<String, String> opt = options.get(i);
            if (opt == null) continue;
            String key = opt.get("key");
            String text = opt.get("text");
            if (isBlank(key) && opt.size() == 1) {
                Map.Entry<String, String> entry = opt.entrySet().iterator().next();
                key = entry.getKey();
                text = entry.getValue();
                opt.put("key", key);
                opt.put("text", text);
            }
            if (isBlank(key)) {
                key = String.valueOf((char) ('A' + i));
                opt.put("key", key);
            }
            String upperKey = key.toUpperCase();
            opt.put("key", upperKey);
            if (!keys.add(upperKey)) errors.add("Duplicate option key \"" + upperKey + "\".");
            if (isBlank(text)) errors.add("Option " + upperKey + " is empty.");
        }

        List<String> correct = req.getCorrectOptions();
        if (correct == null || correct.isEmpty()) {
            errors.add("At least one correct option must be selected.");
        } else {
            List<String> upperCorrect = correct.stream().map(String::toUpperCase).toList();
            req.setCorrectOptions(upperCorrect);
            if (!req.isMultipleCorrect() && upperCorrect.size() > 1) {
                errors.add("Multiple correct options were given but \"multiple correct\" is off.");
            }
            Set<String> correctSet = new java.util.HashSet<>();
            for (String c : upperCorrect) {
                if (!keys.contains(c)) {
                    errors.add("Correct answer \"" + c + "\" does not match any option key.");
                } else if (!correctSet.add(c)) {
                    errors.add("Correct option \"" + c + "\" is listed more than once.");
                }
            }
        }

        if (req.getDefaultMarks() != null && req.getDefaultMarks() <= 0) {
            errors.add("Marks must be greater than zero.");
        }
        if (req.getDefaultNegativeMarks() != null && req.getDefaultNegativeMarks() < 0) {
            errors.add("Negative marking cannot be negative.");
        }

        if (!errors.isEmpty()) {
            throw ApiException.badRequest(String.join(" ", errors));
        }
    }

    @Transactional
    public int deduplicateQuestions() {
        List<TechnicalMcqQuestion> all = repository.findAll();
        Map<String, List<TechnicalMcqQuestion>> groups = new LinkedHashMap<>();
        for (TechnicalMcqQuestion q : all) {
            String key = q.getQuestionText() != null ? q.getQuestionText().trim().toLowerCase().replaceAll("[^a-z0-9]", "") : "";
            if (key.isBlank() && q.getSourceRef() != null) {
                key = q.getSourceRef().trim().toLowerCase();
            }
            if (!key.isBlank()) {
                groups.computeIfAbsent(key, k -> new ArrayList<>()).add(q);
            }
        }

        int removed = 0;
        for (Map.Entry<String, List<TechnicalMcqQuestion>> entry : groups.entrySet()) {
            List<TechnicalMcqQuestion> group = entry.getValue();
            if (group.size() <= 1) continue;

            TechnicalMcqQuestion keep = group.stream().min((a, b) -> {
                boolean activeA = a.isActive();
                boolean activeB = b.isActive();
                if (activeA != activeB) return activeA ? -1 : 1;
                int optLenA = a.getOptions() != null ? a.getOptions().size() : 0;
                int optLenB = b.getOptions() != null ? b.getOptions().size() : 0;
                if (optLenA != optLenB) return Integer.compare(optLenB, optLenA);
                return Long.compare(a.getId(), b.getId());
            }).orElse(group.get(0));

            for (TechnicalMcqQuestion q : group) {
                if (!q.getId().equals(keep.getId())) {
                    q.setActive(false);
                    try {
                        repository.delete(q);
                    } catch (Exception ex) {
                        repository.save(q);
                    }
                    removed++;
                }
            }
        }
        return removed;
    }

    private static boolean isBlank(String s) { return s == null || s.isBlank(); }
    private static String blankToNull(String s) { return isBlank(s) ? null : s; }
}
