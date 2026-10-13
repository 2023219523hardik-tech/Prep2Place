-- Adds SQL and DATAFRAME as coding_problem execution modes, alongside the existing
-- METHOD/STDIN/SCRIPT/CONTEST ones (see ExecutionMode.java). Both new modes are metadata-only
-- for now (schema_ddl + expected_output), same "no runner yet" shape managed_test's SQL/DATAFRAME
-- question types already have - this migration only needs to make the columns and the check
-- constraint agree with the entity, not add execution/grading support.

ALTER TABLE public.coding_problem
    ADD COLUMN IF NOT EXISTS schema_ddl TEXT,
    ADD COLUMN IF NOT EXISTS expected_output TEXT;

-- V1's original check constraint only allowed the four pre-existing modes; widen it rather than
-- drop it outright, so a typo'd execution_mode still fails fast at the DB layer like every other
-- mode does today.
ALTER TABLE public.coding_problem
    DROP CONSTRAINT IF EXISTS coding_problem_execution_mode_check;

ALTER TABLE public.coding_problem
    ADD CONSTRAINT coding_problem_execution_mode_check
    CHECK (((execution_mode)::text = ANY ((ARRAY[
        'METHOD'::character varying,
        'STDIN'::character varying,
        'SCRIPT'::character varying,
        'CONTEST'::character varying,
        'SQL'::character varying,
        'DATAFRAME'::character varying
    ])::text[])));
