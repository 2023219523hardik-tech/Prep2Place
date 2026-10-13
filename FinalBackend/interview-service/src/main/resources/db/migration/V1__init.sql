-- Interview Service Schema Ownership
-- This service owns: interview sessions and interview answers

CREATE TABLE IF NOT EXISTS interview_session (
    id BIGSERIAL PRIMARY KEY,
    candidate_id BIGINT NOT NULL,
    interviewer_id BIGINT,
    status VARCHAR(30) NOT NULL,
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    score DOUBLE PRECISION,
    report_id BIGINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS interview_answer (
    id BIGSERIAL PRIMARY KEY,
    session_id BIGINT REFERENCES interview_session(id) ON DELETE CASCADE,
    question_index INT NOT NULL,
    question_text TEXT,
    candidate_response TEXT,
    score DOUBLE PRECISION,
    feedback TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_interview_session_candidate_id ON interview_session(candidate_id);
CREATE INDEX IF NOT EXISTS idx_interview_session_status ON interview_session(status);
CREATE INDEX IF NOT EXISTS idx_interview_answer_session_id ON interview_answer(session_id);
