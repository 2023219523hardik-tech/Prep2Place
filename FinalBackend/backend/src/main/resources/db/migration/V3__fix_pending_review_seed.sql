-- Fixes incorrectly set PENDING_REVIEW availability state on seed-synced canonical questions.
-- Root cause: QuestionNormalizationService.toCanonicalCandidate() defaulted availabilityState to
-- PENDING_REVIEW for ALL new questions, including genuine NEW_QUESTION decisions, when only
-- FLAGGED_FOR_REVIEW should ever land in PENDING_REVIEW. Result: 90%+ of the question pool was
-- invisible to Company Vault queries and dedup, both of which filter for AVAILABLE only.
--
-- This migration is intentionally broad and safe to re-run:
--   * On a fresh DB with the fixed normalization code, canonical_question starts empty, so the
--     UPDATE affects zero rows before the first seed sync inserts already-AVAILABLE rows.
--   * On a pre-fix database, every PENDING_REVIEW row that doesn't have a corresponding pending
--     DuplicateReview entry is promoted to AVAILABLE; genuine FLAGGED_FOR_REVIEW rows are
--     protected by the existence of a review entry (and, realistically, were never created by the
--     seed sync path in the first place - the dedup thresholds require a pre-existing AVAILABLE
--     pool to match against, which the first sync didn't have).

UPDATE public.canonical_question
   SET availability_state = 'AVAILABLE'
 WHERE availability_state = 'PENDING_REVIEW'
   AND id NOT IN (
       SELECT question_a_id FROM public.duplicate_review WHERE status = 'PENDING'
        UNION
       SELECT question_b_id FROM public.duplicate_review WHERE status = 'PENDING'
   );
