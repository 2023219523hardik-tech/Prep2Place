-- Proctoring Service Schema Ownership
-- This service owns: proctoring events
-- NOTE: no FK to other service's tables; keep it by ID only

CREATE TABLE IF NOT EXISTS proctoring_event (
    id BIGSERIAL PRIMARY KEY,
    attempt_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    event_payload JSONB,
    severity VARCHAR(20),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_proctoring_event_attempt_id ON proctoring_event(attempt_id);
CREATE INDEX IF NOT EXISTS idx_proctoring_event_user_id ON proctoring_event(user_id);
CREATE INDEX IF NOT EXISTS idx_proctoring_event_type ON proctoring_event(event_type);
CREATE INDEX IF NOT EXISTS idx_proctoring_event_created_at ON proctoring_event(created_at);
