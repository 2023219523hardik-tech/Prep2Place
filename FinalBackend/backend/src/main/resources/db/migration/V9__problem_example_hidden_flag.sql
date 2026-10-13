-- problem_example previously had no way to mark an example as a hidden grading case, so
-- CodingService.submitCode() fabricated a fake "hidden" test by duplicating the visible sample
-- input/output instead of running a real one. This column, plus the corresponding fix in
-- CodingService and the redaction in CodingRunnerService.buildConsole(), makes hidden-test
-- grading real and safe. Existing rows default to false (visible), which is correct: every
-- example currently in the database was authored as, and has only ever been shown as, visible.

ALTER TABLE public.problem_example
    ADD COLUMN IF NOT EXISTS hidden BOOLEAN NOT NULL DEFAULT false;
