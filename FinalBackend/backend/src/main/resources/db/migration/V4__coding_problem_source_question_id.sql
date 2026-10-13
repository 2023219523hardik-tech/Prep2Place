-- Adds source_question_id column to coding_problem for stable natural-key upserts when
-- seeding the main question pool from leetcode-company-seed.json. Without this column,
-- LeetCodeCodingProblemSeedLoader would have to match on title+topic, which is unreliable
-- when titles differ slightly (e.g. "Two Sum" vs "1. Two Sum").

ALTER TABLE public.coding_problem
  ADD COLUMN IF NOT EXISTS source_question_id VARCHAR(255);

CREATE UNIQUE INDEX IF NOT EXISTS uk_coding_problem_source_question_id
  ON public.coding_problem (source_question_id)
  WHERE source_question_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_coding_problem_source_question_id
  ON public.coding_problem (source_question_id);
