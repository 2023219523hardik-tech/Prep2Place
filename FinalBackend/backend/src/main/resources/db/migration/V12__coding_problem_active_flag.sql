-- coding_problem had no soft-delete flag, and coding_submission.problem_id is a non-nullable FK
-- with no ON DELETE clause (RESTRICT), so a hard DELETE of any problem a student has submitted to
-- would fail with a raw FK-violation error. This column also replaces the old (incorrect)
-- sourceQuestionId-based visibility filter in CodingService.listProblems() - see
-- CodingProblem.active's javadoc. Existing rows default to true so nothing currently visible
-- disappears on migrate.

ALTER TABLE public.coding_problem
    ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true;
