package com.placement.codinglab.service;

import com.placement.codinglab.dto.CodingLabDtos.JobView;
import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.function.Consumer;

/**
 * Tiny in-memory registry for slow admin operations (AI generation ~30-120s, verification ~10-40s).
 * The HTTP call returns a job id immediately and the UI polls {@code GET .../jobs/{id}} - so no request ever
 * sits open long enough to hit a proxy/gateway timeout. Jobs are ephemeral by design: the durable outcome
 * (the saved draft and its validation report) lives in the database.
 */
@Component
@Slf4j
public class CodingLabJobs {

    public static final class Job {
        public final String id;
        public final String kind;
        public final Instant startedAt = Instant.now();
        public volatile String state = "QUEUED";     // QUEUED | RUNNING | VERIFYING | REPAIRING | DONE | FAILED
        public volatile String message = "";
        public volatile Long assessmentId;
        public volatile Map<String, Object> result;
        public volatile Instant finishedAt;

        Job(String id, String kind) { this.id = id; this.kind = kind; }

        public JobView view() { return new JobView(id, kind, state, message, assessmentId, result, startedAt, finishedAt); }
    }

    private final Map<String, Job> jobs = new ConcurrentHashMap<>();
    private final ExecutorService pool = Executors.newFixedThreadPool(2, r -> {
        Thread t = new Thread(r, "coding-lab-job");
        t.setDaemon(true);
        return t;
    });

    public Job start(String kind, Consumer<Job> body) {
        Instant cutoff = Instant.now().minus(Duration.ofHours(1));
        jobs.values().removeIf(j -> j.finishedAt != null && j.finishedAt.isBefore(cutoff));

        Job job = new Job(UUID.randomUUID().toString(), kind);
        jobs.put(job.id, job);
        pool.submit(() -> {
            try {
                job.state = "RUNNING";
                body.accept(job);
                if (!"FAILED".equals(job.state)) job.state = "DONE";
            } catch (Throwable t) {
                log.warn("Coding Lab job {} ({}) failed: {}", job.id, kind, t.toString());
                job.state = "FAILED";
                job.message = t.getMessage() == null ? t.getClass().getSimpleName() : t.getMessage();
            } finally {
                job.finishedAt = Instant.now();
            }
        });
        return job;
    }

    public Job get(String id) { return jobs.get(id); }

    @PreDestroy
    void shutdown() { pool.shutdownNow(); }
}
