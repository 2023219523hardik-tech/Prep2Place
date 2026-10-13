package com.placement.questionbank.service;

import com.placement.questionbank.adapter.QuestionSourceAdapter;
import com.placement.questionbank.adapter.dto.RawSourceQuestion;
import com.placement.questionbank.config.QuestionSourceProperties;
import com.placement.questionbank.entity.*;
import com.placement.questionbank.repository.CanonicalQuestionRepository;
import com.placement.questionbank.repository.QuestionSourceMappingRepository;
import com.placement.questionbank.repository.SyncRunRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * Orchestrates synchronization across every registered {@link QuestionSourceAdapter}. Core
 * guarantee: one source failing (timeout, auth error, bad data) never prevents the others from
 * syncing, and every attempt - success or failure - produces a queryable {@link SyncRun} record.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class QuestionSyncService {

    private final List<QuestionSourceAdapter> adapters; // Spring injects every @Component implementing the interface
    private final QuestionSourceProperties properties;
    private final QuestionNormalizationService normalizationService;
    private final DeduplicationService deduplicationService;
    private final CanonicalQuestionRepository canonicalQuestionRepository;
    private final QuestionSourceMappingRepository sourceMappingRepository;
    private final SyncRunRepository syncRunRepository;

    /** Sync every enabled source. Returns one SyncRun per source (including skipped/disabled ones). */
    public List<SyncRun> syncAll() {
        return adapters.stream()
                .map(this::syncSourceIsolated)
                .collect(Collectors.toList());
    }

    /** Section 3.0: ingestion must run periodically in the background, not only as a one-off seed
     *  script or a manually-triggered admin action - runtime question delivery must never depend
     *  on a live external call, and the DB needs to keep growing/refreshing on its own schedule.
     *  Weekly by default (question banks don't change fast enough to warrant more often); the
     *  admin-triggered /api/admin/questionbank/sync endpoint remains available for on-demand runs
     *  (e.g. right after adding a new curated seed file) without waiting for the next window. */
    @org.springframework.scheduling.annotation.Scheduled(cron = "${app.questionbank.sync-cron:0 0 3 * * SUN}")
    public void scheduledSyncAll() {
        log.info("Starting scheduled question bank ingestion run across {} adapter(s).", adapters.size());
        List<SyncRun> runs = syncAll();
        int added = runs.stream().mapToInt(SyncRun::getQuestionsCreated).sum();
        long failed = runs.stream().filter(r -> r.getStatus() == SyncRunStatus.FAILED).count();
        log.info("Scheduled question bank ingestion complete: {} question(s) added across {} run(s), {} failed.",
                added, runs.size(), failed);
    }

    public SyncRun syncSource(QuestionSource source) {
        QuestionSourceAdapter adapter = adapters.stream()
                .filter(a -> a.getSource() == source)
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("No adapter registered for source " + source));
        return syncSourceIsolated(adapter);
    }

    /** Wraps a single adapter's sync in full isolation: exceptions here never propagate to syncAll(). */
    private SyncRun syncSourceIsolated(QuestionSourceAdapter adapter) {
        SyncRun run = SyncRun.builder().source(adapter.getSource()).build();

        if (!adapter.isEnabled()) {
            run.setStatus(SyncRunStatus.SKIPPED_DISABLED);
            run.setFinishedAt(Instant.now());
            return syncRunRepository.save(run);
        }

        int maxRetries = properties.getSync().getMaxRetries();
        long backoff = properties.getSync().getRetryBackoffMs();

        List<RawSourceQuestion> raw = null;
        Exception lastError = null;
        for (int attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                raw = adapter.fetchAll();
                lastError = null;
                break;
            } catch (Exception e) {
                lastError = e;
                run.setRetryCount(run.getRetryCount() + 1);
                log.warn("Sync attempt {}/{} failed for source {}: {}", attempt, maxRetries, adapter.getSource(), e.getMessage());
                if (attempt < maxRetries) {
                    sleep(backoff * attempt); // linear backoff
                }
            }
        }

        if (raw == null) {
            run.setStatus(SyncRunStatus.FAILED);
            run.setErrorMessage(lastError == null ? "Unknown failure" : String.valueOf(lastError.getMessage()));
            run.setFinishedAt(Instant.now());
            log.error("Source {} failed after {} attempts - other sources are unaffected.", adapter.getSource(), maxRetries);
            return syncRunRepository.save(run);
        }

        try {
            return processFetchedQuestions(adapter.getSource(), raw, run);
        } catch (Exception e) {
            // Defensive: even a bug in processing shouldn't take down the whole sync cycle.
            log.error("Unexpected error processing fetched questions for {}: {}", adapter.getSource(), e.getMessage(), e);
            run.setStatus(SyncRunStatus.PARTIAL_FAILURE);
            run.setErrorMessage(e.getMessage());
            run.setFinishedAt(Instant.now());
            return syncRunRepository.save(run);
        }
    }

    @Transactional
    protected SyncRun processFetchedQuestions(QuestionSource source, List<RawSourceQuestion> rawQuestions, SyncRun run) {
        int fetched = 0, created = 0, updated = 0, unchanged = 0, autoMerged = 0, flagged = 0, failed = 0;

        for (RawSourceQuestion raw : rawQuestions) {
            fetched++;
            try {
                Optional<QuestionSourceMapping> existingMapping =
                        sourceMappingRepository.findBySourceAndSourceQuestionId(source, raw.getSourceQuestionId());

                if (existingMapping.isPresent()) {
                    // Incremental update path: enrich the existing canonical question, mark source as seen.
                    CanonicalQuestion existing = existingMapping.get().getCanonicalQuestion();
                    normalizationService.enrichExisting(existing, raw);
                    QuestionSourceMapping mapping = existingMapping.get();
                    mapping.setSourceTitle(raw.getTitle());
                    mapping.setSourceUrl(raw.getSourceUrl());
                    mapping.setIntegrationMode(raw.getIntegrationMode());
                    mapping.setLastSyncedAt(Instant.now());
                    mapping.setLastSeenAvailableAt(Instant.now());
                    mapping.setSourceAvailable(true);
                    canonicalQuestionRepository.save(existing);
                    sourceMappingRepository.save(mapping);
                    updated++;
                    continue;
                }

                // New source question we haven't seen before -> normalize, then dedup against the pool.
                CanonicalQuestion candidate = normalizationService.toCanonicalCandidate(raw);
                DeduplicationService.DedupResult dedup = deduplicationService.resolve(candidate);

                CanonicalQuestion target;
                switch (dedup.decision()) {
                    case EXACT_MATCH, AUTO_MERGED -> {
                        target = dedup.target();
                        normalizationService.enrichExisting(target, raw);
                        canonicalQuestionRepository.save(target);
                        if (dedup.decision() == DeduplicationService.Decision.AUTO_MERGED) autoMerged++;
                    }
                    case FLAGGED_FOR_REVIEW -> {
                        candidate.setAvailabilityState(com.placement.questionbank.entity.QuestionAvailabilityState.PENDING_REVIEW);
                        target = canonicalQuestionRepository.save(candidate);
                        deduplicationService.createReviewEntry(target.getId(), dedup.target().getId(), dedup.confidence(), dedup.reason());
                        created++;
                        flagged++;
                    }
                    default -> {
                        target = canonicalQuestionRepository.save(candidate);
                        created++;
                    }
                }

                QuestionSourceMapping mapping = QuestionSourceMapping.builder()
                        .canonicalQuestion(target)
                        .source(source)
                        .sourceQuestionId(raw.getSourceQuestionId())
                        .sourceTitle(raw.getTitle())
                        .sourceUrl(raw.getSourceUrl())
                        .integrationMode(raw.getIntegrationMode())
                        .attribution(raw.getAttribution())
                        .lastSyncedAt(Instant.now())
                        .lastSeenAvailableAt(Instant.now())
                        .sourceAvailable(true)
                        .build();
                sourceMappingRepository.save(mapping);

            } catch (Exception e) {
                failed++;
                log.warn("Skipping one bad record from source {} (id={}): {}", source, raw.getSourceQuestionId(), e.getMessage());
            }
        }

        run.setQuestionsFetched(fetched);
        run.setQuestionsCreated(created);
        run.setQuestionsUpdated(updated);
        run.setQuestionsUnchanged(unchanged);
        run.setDuplicatesAutoMerged(autoMerged);
        run.setDuplicatesFlaggedForReview(flagged);
        run.setStatus(failed == 0 ? SyncRunStatus.SUCCESS : SyncRunStatus.PARTIAL_FAILURE);
        run.setFinishedAt(Instant.now());
        return syncRunRepository.save(run);
    }

    public Map<QuestionSource, Long> countsBySource() {
        return java.util.Arrays.stream(QuestionSource.values())
                .collect(Collectors.toMap(s -> s, sourceMappingRepository::countBySource));
    }

    private void sleep(long ms) {
        try {
            Thread.sleep(ms);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
