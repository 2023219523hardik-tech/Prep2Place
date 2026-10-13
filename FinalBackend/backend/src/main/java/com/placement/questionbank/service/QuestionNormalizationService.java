package com.placement.questionbank.service;

import com.placement.entity.Difficulty;
import com.placement.questionbank.adapter.dto.RawSourceQuestion;
import com.placement.questionbank.entity.CanonicalQuestion;
import com.placement.questionbank.entity.QuestionAvailabilityState;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;

@Service
public class QuestionNormalizationService {

    /** Builds a (not-yet-persisted) canonical question representation from a single raw source question. */
    public CanonicalQuestion toCanonicalCandidate(RawSourceQuestion raw) {
        String title = raw.getTitle() == null ? "Untitled question" : raw.getTitle().trim();
        return CanonicalQuestion.builder()
                .canonicalTitle(title)
                .normalizedTitleKey(QuestionSimilarity.normalizedKey(title))
                .domain(raw.getDomain() == null ? com.placement.questionbank.entity.QuestionDomain.CODING : raw.getDomain())
                .description(raw.getDescription())
                .difficulty(raw.getDifficulty() == null ? Difficulty.MEDIUM : raw.getDifficulty())
                .topics(new ArrayList<>(raw.getTopics()))
                .subtopics(new ArrayList<>(raw.getSubtopics()))
                .companies(new ArrayList<>(raw.getCompanies()))
                .tags(new ArrayList<>(raw.getTags()))
                .supportedLanguages(new ArrayList<>(raw.getSupportedLanguages()))
                .examples(new ArrayList<>(raw.getExamples()))
                .constraints(raw.getConstraints())
                .inputFormat(raw.getInputFormat())
                .outputFormat(raw.getOutputFormat())
                .hints(raw.getHints())
                .active(true)
                .availabilityState(QuestionAvailabilityState.AVAILABLE)
                .lastSyncedAt(Instant.now())
                .build();
    }

    /**
     * When a raw question attaches to an already-existing canonical question (exact match or
     * auto-merge), enrich the canonical record with any new information the new source adds
     * (e.g. companies/tags the existing record didn't have) without overwriting good existing data.
     */
    public void enrichExisting(CanonicalQuestion existing, RawSourceQuestion raw) {
        mergeDistinct(existing.getTopics(), raw.getTopics());
        mergeDistinct(existing.getSubtopics(), raw.getSubtopics());
        mergeDistinct(existing.getCompanies(), raw.getCompanies());
        mergeDistinct(existing.getTags(), raw.getTags());
        mergeDistinct(existing.getSupportedLanguages(), raw.getSupportedLanguages());
        if ((existing.getDescription() == null || existing.getDescription().isBlank()) && raw.getDescription() != null) {
            existing.setDescription(raw.getDescription());
        }
        existing.setLastSyncedAt(Instant.now());
    }

    private void mergeDistinct(java.util.List<String> target, java.util.List<String> incoming) {
        for (String item : incoming) {
            boolean present = target.stream().anyMatch(t -> t.equalsIgnoreCase(item));
            if (!present) target.add(item);
        }
    }
}
