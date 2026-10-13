-- Coding Service Schema Ownership
-- This service owns: coding problems and coding submissions
-- NOTE: No FKs to coding-lab or other services' tables

CREATE TABLE IF NOT EXISTS coding_problem (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    category VARCHAR(20) DEFAULT 'DSA',
    difficulty VARCHAR(20),
    problem_statement TEXT,
    execution_config JSONB,
    test_cases_json JSONB,
    starter_query TEXT,
    starter_code TEXT,
    explanation TEXT,
    source_url TEXT,
    source_question_id VARCHAR(255) UNIQUE,
    topics TEXT[],
    subtopics TEXT[],
    tags TEXT[],
    companies TEXT[],
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS coding_submission (
    id BIGSERIAL PRIMARY KEY,
    problem_id BIGINT REFERENCES coding_problem(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL,
    category VARCHAR(20),
    code TEXT,
    sql TEXT,
    score DOUBLE PRECISION,
    status VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coding_problem_category ON coding_problem(category);
CREATE INDEX IF NOT EXISTS idx_coding_problem_difficulty ON coding_problem(difficulty);
CREATE INDEX IF NOT EXISTS idx_coding_submission_user_id ON coding_submission(user_id);
CREATE INDEX IF NOT EXISTS idx_coding_submission_problem_id ON coding_submission(problem_id);
