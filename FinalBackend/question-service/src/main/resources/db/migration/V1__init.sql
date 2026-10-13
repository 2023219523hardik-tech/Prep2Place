-- Question Service Schema Ownership
-- This service owns: technical MCQ questions, aptitude questions, canonical questions, source mappings

CREATE TABLE IF NOT EXISTS technical_mcq_question (
    id BIGSERIAL PRIMARY KEY,
    question_text TEXT NOT NULL,
    category VARCHAR(100),
    difficulty VARCHAR(20),
    options_json JSONB NOT NULL,
    correct_option INT NOT NULL,
    explanation TEXT,
    tags TEXT[],
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS aptitude_question (
    id BIGSERIAL PRIMARY KEY,
    question_text TEXT NOT NULL,
    category VARCHAR(100),
    subcategory VARCHAR(100),
    difficulty VARCHAR(20),
    options_json JSONB NOT NULL,
    correct_option INT NOT NULL,
    solution_text TEXT,
    tags TEXT[],
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS canonical_question (
    id BIGSERIAL PRIMARY KEY,
    canonical_text TEXT NOT NULL,
    category VARCHAR(100) NOT NULL,
    difficulty VARCHAR(20),
    topics TEXT[],
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(canonical_text, category)
);

CREATE TABLE IF NOT EXISTS question_source_mapping (
    id BIGSERIAL PRIMARY KEY,
    question_id BIGINT NOT NULL,
    question_type VARCHAR(50) NOT NULL,
    source_name VARCHAR(100),
    source_question_id VARCHAR(255),
    source_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_technical_mcq_category ON technical_mcq_question(category);
CREATE INDEX IF NOT EXISTS idx_aptitude_question_category ON aptitude_question(category);
CREATE INDEX IF NOT EXISTS idx_canonical_question_category ON canonical_question(category);
CREATE INDEX IF NOT EXISTS idx_question_source_mapping ON question_source_mapping(question_id, question_type);
