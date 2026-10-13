-- Interview abandonment detection: track the last time a candidate interacted with a session so
-- a scheduled sweeper can mark stale IN_PROGRESS sessions as EXITED instead of leaving them stuck
-- forever after a browser close or network drop.

ALTER TABLE public.interview_session
    ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP;
