-- ============================================================
-- Prep2Place - Coding Lab Module
-- ============================================================
-- Real-Time Practical Coding:
-- Backend / Frontend / Machine Learning / AI / GenAI / RAG
--
-- coding_assessment      : Admin-authored reusable assessment
-- coding_attempt         : One student workspace/attempt
-- coding_lab_submission  : One Run or Submit action
-- ai_hint_interaction    : Append-only AI hint audit log
--
-- IMPORTANT:
-- This module intentionally uses coding_lab_submission instead
-- of the legacy coding_submission table used by the normal
-- Coding module.
-- ============================================================


-- ============================================================
-- 1. CODING ASSESSMENT
-- ============================================================

CREATE TABLE IF NOT EXISTS public.coding_assessment (
    id                          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title                       VARCHAR(200) NOT NULL,
    description                 VARCHAR(4000),
    coding_type                 VARCHAR(255) NOT NULL,
    difficulty                  VARCHAR(255) NOT NULL DEFAULT 'MEDIUM',
    status                      VARCHAR(255) NOT NULL DEFAULT 'DRAFT',
    technology                  VARCHAR(255),
    language                    VARCHAR(50) NOT NULL,
    run_command                 VARCHAR(500) NOT NULL,
    time_limit_minutes          INTEGER NOT NULL DEFAULT 60,
    memory_limit_mb             INTEGER NOT NULL DEFAULT 512,
    execution_timeout_seconds   INTEGER NOT NULL DEFAULT 60,
    starter_files               JSONB NOT NULL,
    public_test_files           JSONB,
    hidden_test_files           JSONB,
    allowed_dependencies        JSONB,
    tags                        JSONB,
    skills                      JSONB,
    target_job_role             VARCHAR(255),
    max_score                   DOUBLE PRECISION NOT NULL DEFAULT 100,
    ai_assistant_enabled       BOOLEAN NOT NULL DEFAULT TRUE,
    ai_max_hints               INTEGER NOT NULL DEFAULT 5,
    ai_max_requests            INTEGER NOT NULL DEFAULT 15,
    ai_cooldown_seconds         INTEGER NOT NULL DEFAULT 20,
    created_by                  VARCHAR(255),
    created_at                  TIMESTAMP(6) WITH TIME ZONE,
    updated_at                  TIMESTAMP(6) WITH TIME ZONE,

    CONSTRAINT coding_assessment_type_check
        CHECK (
            coding_type IN (
                'BACKEND',
                'FRONTEND',
                'MACHINE_LEARNING',
                'AI',
                'GENERATIVE_AI',
                'RAG'
            )
        ),

    CONSTRAINT coding_assessment_difficulty_check
        CHECK (difficulty IN ('EASY', 'MEDIUM', 'HARD')),

    CONSTRAINT coding_assessment_status_check
        CHECK (status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED'))
);


CREATE INDEX IF NOT EXISTS idx_coding_assessment_status
    ON public.coding_assessment (status);

CREATE INDEX IF NOT EXISTS idx_coding_assessment_type
    ON public.coding_assessment (coding_type);


-- ============================================================
-- 2. CODING ATTEMPT
-- ============================================================

CREATE TABLE IF NOT EXISTS public.coding_attempt (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    candidate_id        BIGINT NOT NULL
        REFERENCES public.app_user (id),

    assessment_id       BIGINT NOT NULL
        REFERENCES public.coding_assessment (id),

    status              VARCHAR(255) NOT NULL DEFAULT 'STARTED',

    current_files       JSONB NOT NULL,

    best_score          DOUBLE PRECISION NOT NULL DEFAULT 0,

    best_submission_id  BIGINT,

    ai_hints_used       INTEGER NOT NULL DEFAULT 0,

    ai_requests_used    INTEGER NOT NULL DEFAULT 0,

    last_ai_request_at  TIMESTAMP(6) WITH TIME ZONE,

    started_at          TIMESTAMP(6) WITH TIME ZONE,

    expires_at          TIMESTAMP(6) WITH TIME ZONE,

    completed_at        TIMESTAMP(6) WITH TIME ZONE,

    last_activity_at    TIMESTAMP(6) WITH TIME ZONE,

    created_at          TIMESTAMP(6) WITH TIME ZONE,

    updated_at          TIMESTAMP(6) WITH TIME ZONE,

    CONSTRAINT coding_attempt_status_check
        CHECK (
            status IN (
                'STARTED',
                'COMPLETED',
                'ABANDONED',
                'EXPIRED'
            )
        )
);


CREATE INDEX IF NOT EXISTS idx_coding_attempt_candidate
    ON public.coding_attempt (candidate_id);

CREATE INDEX IF NOT EXISTS idx_coding_attempt_assessment
    ON public.coding_attempt (assessment_id);

CREATE INDEX IF NOT EXISTS idx_coding_attempt_status
    ON public.coding_attempt (status);

CREATE INDEX IF NOT EXISTS idx_coding_attempt_candidate_assessment_status
    ON public.coding_attempt (
        candidate_id,
        assessment_id,
        status
    );


-- ============================================================
-- 3. CODING LAB SUBMISSION
-- ============================================================
--
-- IMPORTANT:
-- Do NOT use the legacy public.coding_submission table.
-- The normal Coding module already owns that table.
--
-- Coding Lab has its own entity:
-- com.placement.codinglab.entity.CodingSubmission
--
-- Therefore this module owns:
-- public.coding_lab_submission
-- ============================================================

CREATE TABLE IF NOT EXISTS public.coding_lab_submission (
    id                          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    attempt_id                  BIGINT NOT NULL
        REFERENCES public.coding_attempt (id),

    candidate_id                BIGINT NOT NULL
        REFERENCES public.app_user (id),

    assessment_id               BIGINT NOT NULL
        REFERENCES public.coding_assessment (id),

    kind                        VARCHAR(255) NOT NULL,

    status                      VARCHAR(255) NOT NULL,

    files_snapshot              JSONB,

    runtime_ms                  INTEGER NOT NULL DEFAULT 0,

    memory_mb                   DOUBLE PRECISION NOT NULL DEFAULT 0,

    tests_total                 INTEGER NOT NULL DEFAULT 0,

    tests_passed                INTEGER NOT NULL DEFAULT 0,

    tests_failed                INTEGER NOT NULL DEFAULT 0,

    score                       DOUBLE PRECISION NOT NULL DEFAULT 0,

    compilation_error           VARCHAR(4000),

    runtime_error               VARCHAR(4000),

    public_output               VARCHAR(8000),

    ai_hints_used_at_submission INTEGER NOT NULL DEFAULT 0,

    submitted_at                TIMESTAMP(6) WITH TIME ZONE,

    CONSTRAINT coding_lab_submission_kind_check
        CHECK (kind IN ('RUN', 'SUBMIT')),

    CONSTRAINT coding_lab_submission_status_check
        CHECK (
            status IN (
                'SUCCESS',
                'FAILED',
                'COMPILATION_ERROR',
                'RUNTIME_ERROR',
                'TIMEOUT'
            )
        )
);


CREATE INDEX IF NOT EXISTS idx_coding_lab_submission_attempt
    ON public.coding_lab_submission (attempt_id);

CREATE INDEX IF NOT EXISTS idx_coding_lab_submission_assessment
    ON public.coding_lab_submission (assessment_id);

CREATE INDEX IF NOT EXISTS idx_coding_lab_submission_candidate
    ON public.coding_lab_submission (candidate_id);


-- ============================================================
-- 4. AI HINT INTERACTION
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ai_hint_interaction (
    id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    attempt_id         BIGINT NOT NULL
        REFERENCES public.coding_attempt (id),

    candidate_id       BIGINT NOT NULL
        REFERENCES public.app_user (id),

    assessment_id      BIGINT NOT NULL
        REFERENCES public.coding_assessment (id),

    requested_at       TIMESTAMP(6) WITH TIME ZONE NOT NULL,

    student_message    VARCHAR(2000) NOT NULL,

    classification     VARCHAR(255) NOT NULL,

    response_type      VARCHAR(255) NOT NULL,

    response_text      VARCHAR(3000) NOT NULL,

    blocked            BOOLEAN NOT NULL DEFAULT FALSE,

    hint_count_after   INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT ai_hint_classification_check
        CHECK (
            classification IN (
                'ALLOWED_HINT',
                'RESTRICTED_SOLVE_REQUEST'
            )
        ),

    CONSTRAINT ai_hint_response_type_check
        CHECK (
            response_type IN (
                'HINT',
                'ERROR_EXPLANATION',
                'REFUSAL',
                'LIMIT_REACHED'
            )
        )
);


CREATE INDEX IF NOT EXISTS idx_ai_hint_interaction_attempt
    ON public.ai_hint_interaction (attempt_id);

CREATE INDEX IF NOT EXISTS idx_ai_hint_interaction_assessment
    ON public.ai_hint_interaction (assessment_id);

