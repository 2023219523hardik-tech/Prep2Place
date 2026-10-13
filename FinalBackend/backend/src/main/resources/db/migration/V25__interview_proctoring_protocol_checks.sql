-- V25__interview_proctoring_protocol_checks.sql
-- Add strict pre-interview proctoring protocol columns to interview_session

ALTER TABLE interview_session
    ADD COLUMN IF NOT EXISTS proctoring_status VARCHAR(32) DEFAULT 'NOT_STARTED',
    ADD COLUMN IF NOT EXISTS camera_checked BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS mic_checked BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS screen_share_checked BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS tab_monitoring_checked BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS background_checked BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS formal_dress_checked BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS face_detection_checked BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS identity_checked BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS proctoring_completed BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS formal_dress_confidence DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS formal_dress_classification VARCHAR(32);
