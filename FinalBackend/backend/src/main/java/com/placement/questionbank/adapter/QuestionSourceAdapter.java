package com.placement.questionbank.adapter;

import com.placement.questionbank.adapter.dto.RawSourceQuestion;
import com.placement.questionbank.entity.QuestionSource;
import com.placement.questionbank.entity.SourceIntegrationMode;

import java.util.List;

/**
 * Contract every question-source connector implements. Adding a fifth, sixth, Nth provider means
 * writing one class that implements this interface and registering it as a Spring bean - the sync
 * orchestrator ({@code QuestionSyncService}) discovers all adapters automatically and treats each
 * one in isolation, so a failure in one adapter's fetchAll() never blocks the others.
 */
public interface QuestionSourceAdapter {

    QuestionSource getSource();

    /** Whether this adapter is currently configured/enabled (checked before every sync run). */
    boolean isEnabled();

    /** Reports how this adapter is actually getting its data right now - see {@link SourceIntegrationMode}. */
    SourceIntegrationMode getIntegrationMode();

    /**
     * Fetch the full/incremental set of questions this adapter currently knows about.
     * Implementations MUST NOT throw for individual bad records - skip and log those; only throw
     * for connection-level failures (timeout, auth failure, source unreachable), which the sync
     * orchestrator will retry with backoff and, on exhaustion, record as a failed SyncRun without
     * touching other sources.
     */
    List<RawSourceQuestion> fetchAll();

    /**
     * Fetch only questions changed/added since the given sync run (incremental sync). Adapters
     * that can't support true incremental fetch (e.g. metadata-only/manual sources) may fall back
     * to fetchAll(); the sync service will diff against stored lastSyncedAt/content hash either way.
     */
    default List<RawSourceQuestion> fetchIncremental(java.time.Instant since) {
        return fetchAll();
    }
}
