package com.placement.questionbank.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/**
 * Bound from `questionbank.*` in application.yml (see application.yml for the defaults this ships
 * with). Every source is disabled-for-live-API-calls by default and ships in
 * METADATA_REFERENCE_ONLY mode - see {@link com.placement.questionbank.entity.SourceIntegrationMode}
 * for why, and what a human needs to do to change that.
 */
@Configuration
@ConfigurationProperties(prefix = "questionbank")
@Getter
@Setter
public class QuestionSourceProperties {

    private SourceConfig tuf = new SourceConfig();
    private SourceConfig leetcode = new SourceConfig();
    private SourceConfig hackerrank = new SourceConfig();
    private SourceConfig gfg = new SourceConfig();

    private Dedup dedup = new Dedup();
    private Sync sync = new Sync();

    @Getter
    @Setter
    public static class SourceConfig {
        private boolean enabled = true;                 // sync runs, but in the safe metadata mode below
        private String integrationMode = "METADATA_REFERENCE_ONLY";
        private String apiBaseUrl;                       // set once a real, confirmed official API exists
        private String apiKey;                            // injected via env var, never committed
        private String curatedSeedClasspath;               // curated metadata JSON an admin maintains
    }

    @Getter
    @Setter
    public static class Dedup {
        /** Above this combined similarity score, auto-merge without human review. */
        private double autoMergeThreshold = 0.93;
        /** Above this (but below autoMergeThreshold), flag for admin review instead of auto-merging. */
        private double reviewThreshold = 0.78;
    }

    @Getter
    @Setter
    public static class Sync {
        private int maxRetries = 3;
        private long retryBackoffMs = 1500;
        private int timeoutMs = 8000;
    }
}
