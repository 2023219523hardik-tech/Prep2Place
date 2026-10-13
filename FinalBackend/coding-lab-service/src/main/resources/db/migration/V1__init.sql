-- Coding Lab Service Schema Ownership
-- This service owns: coding lab assessments, attempts, submissions, and AI hint interactions
-- NOTE: No FKs to coding-service tables

CREATE TABLE IF NOT EXISTS coding_assessment (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    coding_type VARCHAR(30),
    status VARCHAR(30),
    difficulty VARCHAR(20),
    created_by BIGINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS coding_attempt (
    id BIGSERIAL PRIMARY KEY,
    assessment_id BIGINT REFERENCES coding_assessment(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL,
    status VARCHAR(30),
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS coding_lab_submission (
    id BIGSERIAL PRIMARY KEY,
    attempt_id BIGINT REFERENCES coding_attempt(id) ON DELETE CASCADE,
    kind VARCHAR(30),
    submission TEXT,
    status VARCHAR(30),
    score DOUBLE PRECISION,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_hint_interaction (
    id BIGSERIAL PRIMARY KEY,
    attempt_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    prompt TEXT,
    response TEXT,
    classification VARCHAR(30),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coding_attempt_assessment_id ON coding_attempt(assessment_id);
CREATE INDEX IF NOT EXISTS idx_coding_attempt_user_id ON coding_attempt(user_id);
CREATE INDEX IF NOT EXISTS idx_coding_lab_submission_attempt_id ON coding_lab_submission(attempt_id);
CREATE INDEX IF NOT EXISTS idx_ai_hint_interaction_attempt_id ON ai_hint_interaction(attempt_id);
