package com.placement.questionbank.entity;

/**
 * How a given source is actually being integrated. This exists so the system never pretends
 * to have full content it doesn't legally have. Every adapter reports its mode, and the mode
 * is stored on every synced question so the UI/API can be honest with the candidate:
 * either the full statement is available in-app, or the candidate is linked out to the source.
 *
 * IMPORTANT: as of this build, no outbound network calls have been made from this codebase to
 * TUF / LeetCode / HackerRank / GFG (this environment has no network access to verify what each
 * platform's current terms of service and public/official API surface actually allow). Every
 * adapter therefore currently ships in METADATA_REFERENCE_ONLY or MANUAL_CURATION mode by default.
 * Switching a source to OFFICIAL_API or LICENSED_DATASET requires a human to:
 *   1) confirm the provider has a public/official API or a licensing agreement,
 *   2) obtain credentials/dataset access,
 *   3) set the corresponding "enabled"/"apiBaseUrl"/"apiKey" properties for that source,
 *   4) flip the integrationMode in configuration.
 * Until then, the adapters are real, working code paths - they just operate on curated metadata
 * an admin supplies (source URL, title, difficulty, topics, canonical id) rather than scraped or
 * assumed full problem text.
 */
public enum SourceIntegrationMode {
    /** Full or partial content pulled via a confirmed official/public API, using real credentials. */
    OFFICIAL_API,
    /** Content sourced from a licensed dataset / data-sharing agreement, not a live API call. */
    LICENSED_DATASET,
    /** Only permitted metadata (title, topic, difficulty, source URL, source id) is stored; the
     *  candidate is linked out to the source for the full statement. This is the safe default. */
    METADATA_REFERENCE_ONLY,
    /** An admin has manually entered/curated the question in Prep2Place's own words, optionally
     *  crediting the source of inspiration. No automated sync involved. */
    MANUAL_CURATION
}
