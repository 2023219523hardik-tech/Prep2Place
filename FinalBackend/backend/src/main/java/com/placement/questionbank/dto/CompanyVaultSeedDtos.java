package com.placement.questionbank.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Getter;
import lombok.Setter;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Raw parse targets + import report for {@link com.placement.questionbank.service.CompanyVaultSeedService}.
 * Deliberately separate from {@link com.placement.questionbank.adapter.dto.RawSourceQuestion}: that
 * DTO models one question with a flat list of company names, whereas a companyvault-seed row is one
 * (company, question) occurrence carrying a rank/frequencyScore specific to that pairing.
 */
public class CompanyVaultSeedDtos {

    /**
     * One row of a per-company sheet file (companyvault-seed/&lt;slug&gt;.json). Field set matches
     * what's actually present in the source data - see CompanyVaultSeedService's javadoc for which
     * of these are used vs. left for the general questionbank sync to own.
     */
    @Getter
    @Setter
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class CompanySheetRow {
        private String sourceQuestionId;
        private String title;
        private String sourceUrl;
        private String difficulty;
        private List<String> topics = new ArrayList<>();
        private List<String> subtopics = new ArrayList<>();
        private List<String> tags = new ArrayList<>();
        private List<String> supportedLanguages = new ArrayList<>();
        private List<String> companies = new ArrayList<>();
        private Double frequencyScore;
        private Integer companyRank;
        // Present on some files (e.g. jtg-josh-technology-sheet.json) but not persisted anywhere
        // yet - the general questionbank sync/dedup pipeline is what would own these, not
        // CompanyVault. Kept here only so parsing doesn't choke on the extra fields.
        private String platform;
        private Long leetcodeId;
        private Double acceptanceRate;
        private String alternatePlatformUrl;
    }

    /** One entry of companyvault-seed/_index.json. */
    @Getter
    @Setter
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class IndexEntry {
        private String company;
        private String file;
        private Integer totalDistinctAvailable;
        private Integer includedInSheet;
        private Boolean capped;
    }

    /** Returned by {@code CompanyVaultSeedService.importAll()} and logged at startup; also used
     *  directly by tests to assert exact counts instead of re-deriving them from the database. */
    @Getter
    @Setter
    public static class ImportReport {
        private int companiesUpserted;
        private int companyFilesProcessed;
        private int rowsSeen;
        private int ranksCreated;
        private int ranksUpdated;
        private int skippedNoMatchingCanonicalQuestion;
        private int skippedInvalidRow;
        private int skippedUnresolvedSource;
        private final List<String> excludedIndexEntries = new ArrayList<>();
        private final Map<String, Integer> skippedByCompany = new LinkedHashMap<>();

        public int totalSkipped() {
            return skippedNoMatchingCanonicalQuestion + skippedInvalidRow + skippedUnresolvedSource;
        }

        @Override
        public String toString() {
            return "CompanyVault import: %d companies upserted, %d files processed, %d rows seen, "
                    + "%d ranks created, %d ranks updated, %d skipped (%d no-canonical-match, %d invalid, %d unresolved-source), "
                    + "%d index entries excluded (not real companies)".formatted(
                    companiesUpserted, companyFilesProcessed, rowsSeen, ranksCreated, ranksUpdated,
                    totalSkipped(), skippedNoMatchingCanonicalQuestion, skippedInvalidRow, skippedUnresolvedSource,
                    excludedIndexEntries.size());
        }
    }
}
