package com.placement.questionbank.dto;

import com.placement.entity.Difficulty;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.placement.questionbank.entity.*;
import lombok.*;

import java.time.Instant;
import java.util.List;

public class QuestionBankDtos {

    @Getter @Setter @Builder
    public static class SourceMappingView {
        private QuestionSource source;
        private String sourceUrl;
        private SourceIntegrationMode integrationMode;
        private String attribution;
        private boolean sourceAvailable;

        public static SourceMappingView from(QuestionSourceMapping m) {
            return SourceMappingView.builder()
                    .source(m.getSource())
                    .sourceUrl(m.getSourceUrl())
                    .integrationMode(m.getIntegrationMode())
                    .attribution(m.getAttribution())
                    .sourceAvailable(m.isSourceAvailable())
                    .build();
        }
    }

    @Getter @Setter @Builder
    public static class CanonicalQuestionView {
        private Long id;
        private String title;
        private String description;
        private Difficulty difficulty;
        private List<String> topics;
        private List<String> subtopics;
        private List<String> companies;
        private List<String> tags;
        private List<String> supportedLanguages;
        private List<String> examples;
        private String constraints;
        private String inputFormat;
        private String outputFormat;
        private String hints;
        private QuestionAvailabilityState availabilityState;
        private List<SourceMappingView> sources;
        /** True only when at least one source mapping is OFFICIAL_API/LICENSED_DATASET/MANUAL_CURATION
         *  with a non-blank description - tells the frontend whether to render the full statement
         *  or a "view full problem at source" link-out state. */
        private boolean fullContentAvailable;

        public static CanonicalQuestionView from(CanonicalQuestion q) {
            boolean fullContent = q.getDescription() != null && !q.getDescription().isBlank();
            return CanonicalQuestionView.builder()
                    .id(q.getId())
                    .title(q.getCanonicalTitle())
                    .description(q.getDescription())
                    .difficulty(q.getDifficulty())
                    .topics(q.getTopics() == null ? List.of() : new java.util.ArrayList<>(q.getTopics()))
                    .subtopics(q.getSubtopics() == null ? List.of() : new java.util.ArrayList<>(q.getSubtopics()))
                    .companies(q.getCompanies() == null ? List.of() : new java.util.ArrayList<>(q.getCompanies()))
                    .tags(q.getTags() == null ? List.of() : new java.util.ArrayList<>(q.getTags()))
                    .supportedLanguages(q.getSupportedLanguages() == null ? List.of() : new java.util.ArrayList<>(q.getSupportedLanguages()))
                    .examples(q.getExamples() == null ? List.of() : new java.util.ArrayList<>(q.getExamples()))
                    .constraints(q.getConstraints())
                    .inputFormat(q.getInputFormat())
                    .outputFormat(q.getOutputFormat())
                    .hints(q.getHints())
                    .availabilityState(q.getAvailabilityState())
                    .sources(q.getSourceMappings() == null ? List.of() : q.getSourceMappings().stream().map(SourceMappingView::from).toList())
                    .fullContentAvailable(fullContent)
                    .build();
        }
    }

    @Getter @Setter @Builder
    public static class SyncRunView {
        private Long id;
        private QuestionSource source;
        private SyncRunStatus status;
        private Instant startedAt;
        private Instant finishedAt;
        private int questionsFetched;
        private int questionsCreated;
        private int questionsUpdated;
        private int duplicatesAutoMerged;
        private int duplicatesFlaggedForReview;
        private int retryCount;
        private String errorMessage;

        public static SyncRunView from(SyncRun r) {
            return SyncRunView.builder()
                    .id(r.getId()).source(r.getSource()).status(r.getStatus())
                    .startedAt(r.getStartedAt()).finishedAt(r.getFinishedAt())
                    .questionsFetched(r.getQuestionsFetched()).questionsCreated(r.getQuestionsCreated())
                    .questionsUpdated(r.getQuestionsUpdated()).duplicatesAutoMerged(r.getDuplicatesAutoMerged())
                    .duplicatesFlaggedForReview(r.getDuplicatesFlaggedForReview()).retryCount(r.getRetryCount())
                    .errorMessage(r.getErrorMessage())
                    .build();
        }
    }

    @Getter @Setter @Builder
    public static class DuplicateReviewView {
        private Long id;
        private Long questionAId;
        private String questionATitle;
        private Long questionBId;
        private String questionBTitle;
        private double confidenceScore;
        private String matchReason;
        private DuplicateReviewStatus status;
    }

    @Getter @Setter
    public static class ResolveDuplicateRequest {
        private boolean merge; // true = approve merge, false = reject as distinct
        private Long survivorQuestionId; // required when merge=true; the other id becomes the merged-away one
    }

    @Getter @Setter @Builder
    public static class QuestionBankStats {
        private long totalCanonicalQuestions;
        private long availableQuestions;
        private long pendingReview;
        private long deactivated;
        private long pendingDuplicateReviews;
        private java.util.Map<QuestionSource, Long> mappingsBySource;
    }

    // --- Section 5: Company Vault ---

    @Getter @Setter @Builder
    public static class CompanySummary {
        private String name;
        private long questionCount;
        /** Below fields are null for companies that only exist as a tag on CanonicalQuestion.companies
         *  with no corresponding companyvault-seed/_index.json entry (e.g. companies pulled in only
         *  via questionbank-seed/leetcode.json's broader tag set, not one of the curated per-company
         *  sheets). Populated by CompanyVaultSeedService via the Company entity when present. */
        private String slug;
        private Integer totalDistinctAvailable;
        private Integer includedInSheet;
        private Boolean capped;
    }

    @Getter @Setter @Builder
    public static class CompanyDetail {
        private String name;
        private long questionCount;
        private java.util.Map<String, Long> byDifficulty; // Difficulty.name() -> count
    }

    /** Deliberately its own view, not a reuse of CanonicalQuestionView: a locked question must
     *  never carry description/sourceUrl/hints to the client, so the gate is enforced by what the
     *  server sends, not by what the frontend chooses to render. */
    @Getter @Setter @Builder
    public static class CompanyQuestionView {
        private Long id;
        /** Native CodingProblem identifier used by the Prep2Place IDE route. */
        private Long codingProblemId;
        private String title;
        private Difficulty difficulty;
        private boolean locked;
        private String sourceUrl; // null when locked
        /** CompanyVault follow-up: null when this company has no CompanyQuestionRank data yet
         *  (falls back to the pre-existing difficulty/title ordering - see
         *  QuestionBankQueryService.getCompanyQuestions). 1 = most frequently asked at this company. */
        private Integer rank;
        private Double frequencyScore;
    }

    /**
     * Admin-only view of a Technical MCQ. Unlike anything the student endpoints return, this
     * includes correctOptions and explanation - callers of QuestionBankAdminController are gated
     * by the "/api/admin/**" security rule, so exposing the answer key here is intentional and
     * safe, mirroring how the coding module keeps hidden test cases out of student DTOs but shows
     * them to admins.
     */
    @Getter @Setter @Builder
    public static class TechnicalMcqAdminView {
        private Long id;
        private String questionText;
        private TechnicalCategory category;
        private String topic;
        private String subtopic;
        private Difficulty difficulty;
        private List<java.util.Map<String, String>> options;
        private List<String> correctOptions;
        private boolean multipleCorrect;
        private String explanation;
        private double defaultMarks;
        private double defaultNegativeMarks;
        private int estimatedTimeSeconds;
        private String sourceRef;
        private boolean active;
        private Instant createdAt;
        private Instant updatedAt;

        public static TechnicalMcqAdminView from(com.placement.questionbank.entity.TechnicalMcqQuestion q) {
            return TechnicalMcqAdminView.builder()
                    .id(q.getId())
                    .questionText(q.getQuestionText())
                    .category(q.getCategory())
                    .topic(q.getTopic())
                    .subtopic(q.getSubtopic())
                    .difficulty(q.getDifficulty())
                    .options(q.getOptions())
                    .correctOptions(q.getCorrectOptions())
                    .multipleCorrect(q.isMultipleCorrect())
                    .explanation(q.getExplanation())
                    .defaultMarks(q.getDefaultMarks())
                    .defaultNegativeMarks(q.getDefaultNegativeMarks())
                    .estimatedTimeSeconds(q.getEstimatedTimeSeconds())
                    .sourceRef(q.getSourceRef())
                    .active(q.isActive())
                    .createdAt(q.getCreatedAt())
                    .updatedAt(q.getUpdatedAt())
                    .build();
        }
    }

    /** Create/update payload for a Technical MCQ. Every field is required on create; update() in
     *  TechnicalMcqAdminService overwrites the full row rather than doing a partial merge, since a
     *  question's options/correctOptions/explanation are one coherent unit - a partial PATCH-style
     *  merge on options would risk leaving correctOptions pointing at a key that no longer exists. */
    /** @Builder deliberately omitted here (unlike every other DTO in this file): this class is
     *  deserialized from JSON as a @RequestBody by QuestionBankAdminController, and @Builder on a
     *  class suppresses Java's implicit no-args constructor - Jackson has no way to construct an
     *  instance without one and this would fail at runtime with "no Creators, like default
     *  constructor, exist". Matches the file's own existing convention for request bodies -
     *  ResolveDuplicateRequest above uses the same plain @Getter @Setter, no @Builder. Nothing in
     *  this codebase ever constructs this class via a builder (only the frontend ever builds the
     *  JSON that becomes it), so dropping @Builder costs nothing. */
    @Getter @Setter
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class TechnicalMcqUpsertRequest {
        private String sourceRef;
        private String questionText;
        private TechnicalCategory category;
        private String topic;
        private String subtopic;
        private Difficulty difficulty;
        private List<java.util.Map<String, String>> options;
        private List<String> correctOptions;
        private boolean multipleCorrect;
        private String explanation;
        private Double defaultMarks;
        private Double defaultNegativeMarks;
        private Integer estimatedTimeSeconds;
    }

    /**
     * Wire format used by the curated technical-MCQ JSON files.  sourceRef is the stable
     * natural key: importing the same file again updates that question instead of creating a
     * duplicate row.  Unknown provenance fields such as _source/tags/companies are deliberately
     * accepted because they are present in the curated export but are not persisted by this table.
     */
    @Getter @Setter
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class TechnicalMcqImportRequest extends TechnicalMcqUpsertRequest {
        private String sourceRef;
    }

    @Getter @Setter @Builder
    public static class TechnicalMcqImportReport {
        private int totalRecords;
        private int inserted;
        private int updated;
        private int unchanged;
        private int skipped;
        private int duplicates;
        private int failed;
        private java.util.List<String> errors;
        private java.util.List<java.util.Map<String, Object>> failures;
    }

    /** One page of the admin Technical MCQ list, with the total count the UI needs for pagination
     *  controls (Spring's Page<> serializes fine on its own, but keeping this explicit avoids ever
     *  changing that serialization shape and breaking the admin UI as a side effect). */
    @Getter @Setter @Builder
    public static class TechnicalMcqAdminPage {
        private List<TechnicalMcqAdminView> content;
        private long totalElements;
        private int totalPages;
        private int page;
        private int size;
    }
}
