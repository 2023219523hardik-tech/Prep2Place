-- Report Service Schema Ownership
-- This service owns: generated reports
-- UNIQUE(subject_type, subject_id, report_type) enforces idempotency

CREATE TABLE IF NOT EXISTS report (
    id BIGSERIAL PRIMARY KEY,
    subject_type VARCHAR(30) NOT NULL,
    subject_id BIGINT NOT NULL,
    report_type VARCHAR(50) NOT NULL,
    report_json JSONB,
    score DOUBLE PRECISION,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(subject_type, subject_id, report_type)
);

CREATE INDEX IF NOT EXISTS idx_report_subject ON report(subject_type, subject_id);
CREATE INDEX IF NOT EXISTS idx_report_type ON report(report_type);
CREATE INDEX IF NOT EXISTS idx_report_generated_at ON report(generated_at);
