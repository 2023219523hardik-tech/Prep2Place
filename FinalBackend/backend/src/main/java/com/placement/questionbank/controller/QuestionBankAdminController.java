package com.placement.questionbank.controller;

import com.placement.questionbank.dto.QuestionBankDtos.*;
import com.placement.questionbank.entity.*;
import com.placement.questionbank.repository.CanonicalQuestionRepository;
import com.placement.questionbank.repository.DuplicateReviewRepository;
import com.placement.questionbank.repository.SyncRunRepository;
import com.placement.questionbank.service.DeduplicationService;
import com.placement.questionbank.service.QuestionBankQueryService;
import com.placement.questionbank.service.QuestionSyncService;
import com.placement.questionbank.service.TechnicalMcqAdminService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/** Admin-only. Covered by SecurityConfig's "/api/admin/** requires ROLE_ADMIN or ROLE_PLACEMENT_ADMIN" rule. */
@RestController
@RequestMapping("/api/admin/questionbank")
@RequiredArgsConstructor
public class QuestionBankAdminController {

    private final QuestionSyncService syncService;
    private final DeduplicationService deduplicationService;
    private final CanonicalQuestionRepository canonicalQuestionRepository;
    private final DuplicateReviewRepository duplicateReviewRepository;
    private final SyncRunRepository syncRunRepository;
    private final QuestionBankQueryService queryService;
    private final TechnicalMcqAdminService technicalMcqAdminService;

    // -------------------------------------------------------------------------- technical MCQ CRUD --
    // Full lifecycle for com.placement.questionbank.entity.TechnicalMcqQuestion. Previously this
    // entity had no admin write path at all (see TechnicalMcqAdminService's class comment) - these
    // six endpoints are the fix, and deliberately live under this existing controller rather than a
    // new one, since it already owns this bounded context and its "/api/admin/questionbank" prefix.

    @GetMapping("/technical-mcq")
    public ResponseEntity<TechnicalMcqAdminPage> listTechnicalMcq(
            @RequestParam(required = false) TechnicalCategory category,
            @RequestParam(required = false) com.placement.entity.Difficulty difficulty,
            @RequestParam(required = false) String topic,
            @RequestParam(required = false) String subtopic,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(technicalMcqAdminService.search(
                category, difficulty, topic, subtopic, search, page, size));
    }

    @GetMapping("/technical-mcq/{id}")
    public ResponseEntity<TechnicalMcqAdminView> getTechnicalMcq(@PathVariable Long id) {
        return ResponseEntity.ok(technicalMcqAdminService.get(id));
    }

    @PostMapping("/technical-mcq")
    public ResponseEntity<TechnicalMcqAdminView> createTechnicalMcq(@RequestBody TechnicalMcqUpsertRequest req) {
        return ResponseEntity.ok(technicalMcqAdminService.create(req));
    }

    /** Bulk import: a JSON array of the same shape the single-create endpoint above accepts.
     *  Per-row tolerant: returns inserted/duplicates/failed counts instead of failing the batch. */
    @PostMapping("/technical-mcq/bulk-upload")
    public ResponseEntity<TechnicalMcqImportReport> bulkUploadTechnicalMcq(@RequestBody List<TechnicalMcqUpsertRequest> requests) {
        return ResponseEntity.ok(technicalMcqAdminService.bulkCreate(requests));
    }

    /** Duplicate-safe import for the published technical-MCQ seed JSON schema. */
    @PostMapping("/technical-mcq/import")
    public ResponseEntity<TechnicalMcqImportReport> importTechnicalMcq(
            @RequestBody List<TechnicalMcqImportRequest> requests) {
        return ResponseEntity.ok(technicalMcqAdminService.importSeed(requests));
    }

    @PutMapping("/technical-mcq/{id}")
    public ResponseEntity<TechnicalMcqAdminView> updateTechnicalMcq(@PathVariable Long id,
                                                                     @RequestBody TechnicalMcqUpsertRequest req) {
        return ResponseEntity.ok(technicalMcqAdminService.update(id, req));
    }

    /** Default delete is soft (active=false) - see TechnicalMcqAdminService.archive() for why this
     *  is safe to make destructive-by-name but non-destructive-by-default. */
    @DeleteMapping("/technical-mcq/{id}")
    public ResponseEntity<TechnicalMcqAdminView> archiveTechnicalMcq(@PathVariable Long id) {
        return ResponseEntity.ok(technicalMcqAdminService.archive(id));
    }

    @PatchMapping("/technical-mcq/{id}/reactivate")
    public ResponseEntity<TechnicalMcqAdminView> reactivateTechnicalMcq(@PathVariable Long id) {
        return ResponseEntity.ok(technicalMcqAdminService.reactivate(id));
    }

    /** Explicit, separate from the DELETE mapping above on purpose: a UI control for this should
     *  read "Permanently delete" with its own confirmation, never the default archive action. */
    @DeleteMapping("/technical-mcq/{id}/permanent")
    public ResponseEntity<Void> hardDeleteTechnicalMcq(@PathVariable Long id) {
        technicalMcqAdminService.hardDelete(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/sync")
    public ResponseEntity<List<SyncRunView>> syncAll() {
        return ResponseEntity.ok(syncService.syncAll().stream().map(SyncRunView::from).toList());
    }

    @PostMapping("/sync/{source}")
    public ResponseEntity<SyncRunView> syncOne(@PathVariable QuestionSource source) {
        return ResponseEntity.ok(SyncRunView.from(syncService.syncSource(source)));
    }

    @GetMapping("/sync/status")
    public ResponseEntity<List<SyncRunView>> recentRuns() {
        return ResponseEntity.ok(syncRunRepository.findTop50ByOrderByStartedAtDesc().stream().map(SyncRunView::from).toList());
    }

    @GetMapping("/duplicates")
    public ResponseEntity<List<DuplicateReviewView>> pendingDuplicates() {
        List<DuplicateReview> pending = duplicateReviewRepository.findByStatus(DuplicateReviewStatus.PENDING);
        List<DuplicateReviewView> views = pending.stream().map(r -> {
            String titleA = canonicalQuestionRepository.findById(r.getQuestionAId()).map(CanonicalQuestion::getCanonicalTitle).orElse("(deleted)");
            String titleB = canonicalQuestionRepository.findById(r.getQuestionBId()).map(CanonicalQuestion::getCanonicalTitle).orElse("(deleted)");
            return DuplicateReviewView.builder()
                    .id(r.getId())
                    .questionAId(r.getQuestionAId()).questionATitle(titleA)
                    .questionBId(r.getQuestionBId()).questionBTitle(titleB)
                    .confidenceScore(r.getConfidenceScore())
                    .matchReason(r.getMatchReason())
                    .status(r.getStatus())
                    .build();
        }).collect(Collectors.toList());
        return ResponseEntity.ok(views);
    }

    @PostMapping("/duplicates/{id}/resolve")
    public ResponseEntity<Void> resolveDuplicate(@PathVariable Long id, @RequestBody ResolveDuplicateRequest request) {
        DuplicateReview review = duplicateReviewRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Duplicate review " + id + " not found"));

        if (request.isMerge()) {
            Long aId = review.getQuestionAId(), bId = review.getQuestionBId();
            Long survivorId = request.getSurvivorQuestionId() != null ? request.getSurvivorQuestionId() : aId;
            Long mergedId = survivorId.equals(aId) ? bId : aId;
            deduplicationService.applyMerge(survivorId, mergedId);
            review.setStatus(DuplicateReviewStatus.APPROVED_MERGED);
        } else {
            review.setStatus(DuplicateReviewStatus.REJECTED_DISTINCT);
        }
        review.setResolvedAt(java.time.Instant.now());
        duplicateReviewRepository.save(review);
        return ResponseEntity.ok().build();
    }

    @PatchMapping("/questions/{id}/activate")
    public ResponseEntity<Void> activate(@PathVariable Long id) {
        return setState(id, QuestionAvailabilityState.AVAILABLE);
    }

    @PatchMapping("/questions/{id}/deactivate")
    public ResponseEntity<Void> deactivate(@PathVariable Long id) {
        return setState(id, QuestionAvailabilityState.DEACTIVATED);
    }

    private ResponseEntity<Void> setState(Long id, QuestionAvailabilityState state) {
        CanonicalQuestion q = canonicalQuestionRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Question " + id + " not found"));
        q.setAvailabilityState(state);
        canonicalQuestionRepository.save(q);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/stats")
    public ResponseEntity<QuestionBankStats> stats() {
        Map<QuestionSource, Long> bySource = syncService.countsBySource();
        return ResponseEntity.ok(QuestionBankStats.builder()
                .totalCanonicalQuestions(canonicalQuestionRepository.count())
                .availableQuestions(queryService.countByState(QuestionAvailabilityState.AVAILABLE))
                .pendingReview(queryService.countByState(QuestionAvailabilityState.PENDING_REVIEW))
                .deactivated(queryService.countByState(QuestionAvailabilityState.DEACTIVATED))
                .pendingDuplicateReviews(duplicateReviewRepository.findByStatus(DuplicateReviewStatus.PENDING).size())
                .mappingsBySource(bySource)
                .build());
    }
}
