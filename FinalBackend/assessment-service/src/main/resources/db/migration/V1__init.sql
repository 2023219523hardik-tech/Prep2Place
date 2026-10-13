-- Assessment Service Schema Ownership
-- This service owns: assessment profiles, attempts, managed tests, and integrity events

CREATE TABLE IF NOT EXISTS assessment_profile (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    assessment_type VARCHAR(30),
    duration_min INT,
    status VARCHAR(30),
    published BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS assessment_attempt (
    id BIGSERIAL PRIMARY KEY,
    profile_id BIGINT REFERENCES assessment_profile(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL,
    status VARCHAR(30),
    started_at TIMESTAMPTZ,
    violations_count INT DEFAULT 0,
    score DOUBLE PRECISION,
    submitted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS managed_test (
    id BIGSERIAL PRIMARY KEY,
    profile_id BIGINT REFERENCES assessment_profile(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    test_type VARCHAR(50),
    total_marks DOUBLE PRECISION,
    duration_min INT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS managed_test_section (
    id BIGSERIAL PRIMARY KEY,
    test_id BIGINT REFERENCES managed_test(id) ON DELETE CASCADE,
    section_name VARCHAR(255) NOT NULL,
    section_order INT,
    marks_per_question DOUBLE PRECISION,
    negative_marks DOUBLE PRECISION DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS managed_test_question (
    id BIGSERIAL PRIMARY KEY,
    section_id BIGINT REFERENCES managed_test_section(id) ON DELETE CASCADE,
    question_id BIGINT NOT NULL,
    question_type VARCHAR(50) NOT NULL,
    question_order INT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS managed_test_attempt (
    id BIGSERIAL PRIMARY KEY,
    attempt_id BIGINT REFERENCES assessment_attempt(id) ON DELETE CASCADE,
    question_id BIGINT NOT NULL,
    question_type VARCHAR(50),
    selected_option INT,
    answer_text TEXT,
    marks_obtained DOUBLE PRECISION,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS integrity_event (
    id BIGSERIAL PRIMARY KEY,
    attempt_id BIGINT NOT NULL,
    event_type VARCHAR(50),
    classification VARCHAR(50),
    details TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assessment_attempt_profile_id ON assessment_attempt(profile_id);
CREATE INDEX IF NOT EXISTS idx_assessment_attempt_user_id ON assessment_attempt(user_id);
CREATE INDEX IF NOT EXISTS idx_managed_test_profile_id ON managed_test(profile_id);
CREATE INDEX IF NOT EXISTS idx_integrity_event_attempt_id ON integrity_event(attempt_id);
