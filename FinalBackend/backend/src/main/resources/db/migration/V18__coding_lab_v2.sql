-- Coding Lab v2: structured requirements, verified questions, uniform test protocol.
--  * coding_assessment gains: runtime (replaces the free-form run_command), problem statement, requirements,
--    reference solution, provenance (manual / AI generated / imported) and verification state.
--  * coding_submission gains per-test and per-requirement reports.
--  * Rows created with the v1 authoring model (runtime IS NULL) cannot run under the new sandbox protocol;
--    they are ARCHIVED (status change only - nothing is deleted, attempts and submissions stay intact).

ALTER TABLE public.coding_assessment
    ADD COLUMN IF NOT EXISTS runtime            VARCHAR(30),
    ADD COLUMN IF NOT EXISTS problem_statement  TEXT,
    ADD COLUMN IF NOT EXISTS requirements       JSONB,
    ADD COLUMN IF NOT EXISTS reference_files    JSONB,
    ADD COLUMN IF NOT EXISTS source             VARCHAR(20) NOT NULL DEFAULT 'MANUAL',
    ADD COLUMN IF NOT EXISTS generation_meta    JSONB,
    ADD COLUMN IF NOT EXISTS validation_status  VARCHAR(20) NOT NULL DEFAULT 'UNVERIFIED',
    ADD COLUMN IF NOT EXISTS validation_report  JSONB,
    ADD COLUMN IF NOT EXISTS validated_hash     VARCHAR(64),
    ADD COLUMN IF NOT EXISTS validated_at       TIMESTAMP(6) WITH TIME ZONE;

ALTER TABLE public.coding_assessment ALTER COLUMN run_command DROP NOT NULL;

ALTER TABLE public.coding_assessment
    ADD CONSTRAINT coding_assessment_runtime_check CHECK (runtime IS NULL OR runtime IN ('JAVA_JUNIT','NODE_TEST','PYTHON_PYTEST')),
    ADD CONSTRAINT coding_assessment_source_check CHECK (source IN ('MANUAL','AI_GENERATED','IMPORTED')),
    ADD CONSTRAINT coding_assessment_validation_check CHECK (validation_status IN ('UNVERIFIED','VERIFIED','FAILED'));

UPDATE public.coding_assessment SET status = 'ARCHIVED' WHERE runtime IS NULL AND status <> 'ARCHIVED';

ALTER TABLE public.coding_lab_submission
    ADD COLUMN IF NOT EXISTS test_report        JSONB,
    ADD COLUMN IF NOT EXISTS requirement_report JSONB;
