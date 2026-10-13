package com.placement.questionbank.service;

import com.placement.questionbank.config.QuestionSourceProperties;
import com.placement.questionbank.entity.*;
import com.placement.questionbank.repository.CanonicalQuestionRepository;
import com.placement.questionbank.repository.DuplicateReviewRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

/**
 * Decides, for every newly-normalized question, whether it:
 *   (a) is an exact normalized-title match of an existing canonical question -> attach as a new
 *       source mapping on the existing one,
 *   (b) is a high-confidence probable duplicate below exact-match but above the auto-merge
 *       threshold -> merge automatically and log it,
 *   (c) is a borderline match -> create a DuplicateReview row for an admin to resolve,
 *   (d) is sufficiently distinct -> becomes its own new canonical question.
 *
 * Threshold values are configurable (questionbank.dedup.*) rather than hard-coded, per spec.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class DeduplicationService {

    private final CanonicalQuestionRepository canonicalQuestionRepository;
    private final DuplicateReviewRepository duplicateReviewRepository;
    private final QuestionSourceProperties properties;

    public enum Decision { EXACT_MATCH, AUTO_MERGED, FLAGGED_FOR_REVIEW, NEW_QUESTION }

    public record DedupResult(Decision decision, CanonicalQuestion target, double confidence, String reason) {}

    /**
     * candidate = a not-yet-persisted CanonicalQuestion built from a RawSourceQuestion by the
     * normalization service. Returns the canonical question this raw question should attach to
     * (creating a new one if genuinely distinct), plus the decision that was made and why.
     */
    public DedupResult resolve(CanonicalQuestion candidate) {
        // 1) Exact normalized-title match short-circuits everything else - same problem, different casing/punctuation.
        Optional<CanonicalQuestion> exact = canonicalQuestionRepository.findByNormalizedTitleKeyAndActiveTrue(candidate.getNormalizedTitleKey());
        if (exact.isPresent()) {
            return new DedupResult(Decision.EXACT_MATCH, exact.get(), 1.0, "Normalized title key exact match");
        }

        // 2) Score against the existing active pool. For very large catalogs this should be an
        // indexed/blocked search (e.g. by shared topic) rather than O(n) - documented as a scale
        // TODO, but correctness comes first.
        // Pool includes both AVAILABLE and PENDING_REVIEW: a question that landed in PENDING_REVIEW
        // on an earlier sync still needs to be recognized as a duplicate if the same question comes
        // in again, instead of creating a second row in either state.
        List<CanonicalQuestion> pool = canonicalQuestionRepository.findAllActiveForDedup();

        CanonicalQuestion best = null;
        double bestScore = 0.0;
        for (CanonicalQuestion existing : pool) {
            double score = QuestionSimilarity.combinedConfidence(
                    candidate.getCanonicalTitle(), existing.getCanonicalTitle(),
                    candidate.getTopics(), existing.getTopics(),
                    candidate.getTags(), existing.getTags());
            if (score > bestScore) {
                bestScore = score;
                best = existing;
            }
        }

        double autoMerge = properties.getDedup().getAutoMergeThreshold();
        double review = properties.getDedup().getReviewThreshold();

        if (best != null && bestScore >= autoMerge) {
            log.info("Auto-merging candidate '{}' into canonical question {} (confidence {})",
                    candidate.getCanonicalTitle(), best.getId(), bestScore);
            return new DedupResult(Decision.AUTO_MERGED, best, bestScore,
                    String.format("Combined similarity %.2f >= auto-merge threshold %.2f", bestScore, autoMerge));
        }

        if (best != null && bestScore >= review) {
            // Flag for review, but still create the candidate as its own canonical question for now
            // so it's usable while awaiting admin resolution.
            log.info("Flagging possible duplicate: '{}' vs canonical question {} (confidence {})",
                    candidate.getCanonicalTitle(), best.getId(), bestScore);
            return new DedupResult(Decision.FLAGGED_FOR_REVIEW, best, bestScore,
                    String.format("Combined similarity %.2f is between review threshold %.2f and auto-merge threshold %.2f", bestScore, review, autoMerge));
        }

        return new DedupResult(Decision.NEW_QUESTION, null, bestScore, "No sufficiently similar existing question found");
    }

    /** Called by the sync service after resolve() returns FLAGGED_FOR_REVIEW, once both questions have IDs. */
    public void createReviewEntry(Long candidateId, Long existingId, double confidence, String reason) {
        boolean alreadyExists = duplicateReviewRepository.findByQuestionAIdAndQuestionBId(candidateId, existingId).isPresent()
                || duplicateReviewRepository.findByQuestionAIdAndQuestionBId(existingId, candidateId).isPresent();
        if (alreadyExists) return;
        duplicateReviewRepository.save(DuplicateReview.builder()
                .questionAId(candidateId)
                .questionBId(existingId)
                .confidenceScore(confidence)
                .matchReason(reason)
                .status(DuplicateReviewStatus.PENDING)
                .build());
    }

    /** Admin-approved merge: reassign all source mappings from the loser onto the survivor,
     *  deactivate the loser. Takes IDs, not entities: this must load both questions itself inside
     *  its own @Transactional boundary. Taking pre-fetched entities from the caller looked
     *  equivalent but wasn't - each repository call in a non-transactional controller method opens
     *  and closes its own transaction, so by the time this method ran, both entities were already
     *  detached and touching their lazy sourceMappings collection threw LazyInitializationException
     *  on every single admin merge attempt. */
    @org.springframework.transaction.annotation.Transactional
    public void applyMerge(Long survivorId, Long mergedId) {
        CanonicalQuestion survivor = canonicalQuestionRepository.findById(survivorId)
                .orElseThrow(() -> new IllegalArgumentException("Canonical question " + survivorId + " not found"));
        CanonicalQuestion merged = canonicalQuestionRepository.findById(mergedId)
                .orElseThrow(() -> new IllegalArgumentException("Canonical question " + mergedId + " not found"));
        for (QuestionSourceMapping mapping : List.copyOf(merged.getSourceMappings())) {
            mapping.setCanonicalQuestion(survivor);
            survivor.getSourceMappings().add(mapping);
        }
        merged.getSourceMappings().clear();
        merged.setActive(false);
        merged.setMergedIntoId(survivor.getId());
        merged.setAvailabilityState(QuestionAvailabilityState.DEACTIVATED);
        canonicalQuestionRepository.save(survivor);
        canonicalQuestionRepository.save(merged);
    }
}
