-- Adds the Math Challenge game type and the live adaptive-difficulty / pause-tracking columns
-- that game_attempt needs now that rounds are generated one at a time (just before they're
-- needed) instead of all up front at a single fixed difficulty.

ALTER TABLE public.game DROP CONSTRAINT IF EXISTS game_type_check;
ALTER TABLE public.game ADD CONSTRAINT game_type_check
    CHECK (game_type IN ('DEDUCTIVE','SWITCH','GRID','INDUCTIVE','MOTION','MATH'));

ALTER TABLE public.game_attempt
    ADD COLUMN IF NOT EXISTS difficulty_score       DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    ADD COLUMN IF NOT EXISTS current_level           INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS highest_level_reached    INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS paused_at                TIMESTAMP(6) WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS total_paused_ms          BIGINT NOT NULL DEFAULT 0;

ALTER TABLE public.game_attempt
    ADD CONSTRAINT game_attempt_level_check CHECK (current_level BETWEEN 1 AND 8),
    ADD CONSTRAINT game_attempt_difficulty_score_check
        CHECK (difficulty_score BETWEEN 1.0 AND 8.0);

CREATE INDEX IF NOT EXISTS idx_game_attempt_paused_at ON public.game_attempt (paused_at);
