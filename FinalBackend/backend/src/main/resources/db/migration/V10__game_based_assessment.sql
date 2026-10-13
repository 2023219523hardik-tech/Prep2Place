-- Game-Based Assessment module (Deductive / Switch / Grid / Inductive / Motion challenges).
-- Game            : admin-authored, reusable definition (one row covers every attempt of that
--                    game - Section 8/9 "reusable architecture").
-- game_attempt    : one row per student attempt; rounds_snapshot freezes the generated rounds
--                    (including hidden correct answers) at start time so a later edit to `game`
--                    never changes an attempt already in progress.
-- game_event      : append-only gameplay event log for analytics (Section 16).

CREATE TABLE IF NOT EXISTS public.game (
    id                          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name                        VARCHAR(200)  NOT NULL,
    game_type                   VARCHAR(255)  NOT NULL,
    description                 VARCHAR(2000),
    difficulty                  VARCHAR(255)  NOT NULL DEFAULT 'MEDIUM',
    status                      VARCHAR(255)  NOT NULL DEFAULT 'DRAFT',
    round_count                 INTEGER       NOT NULL DEFAULT 5,
    round_duration_seconds      INTEGER       NOT NULL DEFAULT 60,
    randomize_rounds            BOOLEAN       NOT NULL DEFAULT TRUE,
    negative_marking_enabled    BOOLEAN       NOT NULL DEFAULT FALSE,
    negative_marking_penalty    DOUBLE PRECISION NOT NULL DEFAULT 0.25,
    scoring_config              JSONB,
    game_config                 JSONB,
    target_university           VARCHAR(255),
    target_company              VARCHAR(255),
    target_job_role             VARCHAR(255),
    available_from              TIMESTAMP(6) WITH TIME ZONE,
    available_to                TIMESTAMP(6) WITH TIME ZONE,
    created_by                  VARCHAR(255),
    created_at                  TIMESTAMP(6) WITH TIME ZONE,
    updated_at                  TIMESTAMP(6) WITH TIME ZONE,
    CONSTRAINT game_type_check CHECK (game_type IN ('DEDUCTIVE','SWITCH','GRID','INDUCTIVE','MOTION')),
    CONSTRAINT game_difficulty_check CHECK (difficulty IN ('EASY','MEDIUM','HARD')),
    CONSTRAINT game_status_check CHECK (status IN ('DRAFT','PUBLISHED','ARCHIVED'))
);

CREATE INDEX IF NOT EXISTS idx_game_status ON public.game (status);
CREATE INDEX IF NOT EXISTS idx_game_type ON public.game (game_type);

CREATE TABLE IF NOT EXISTS public.game_attempt (
    id                      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    candidate_id            BIGINT NOT NULL REFERENCES public.app_user (id),
    game_id                 BIGINT NOT NULL REFERENCES public.game (id),
    game_type               VARCHAR(255) NOT NULL,
    difficulty               VARCHAR(255) NOT NULL,
    status                  VARCHAR(255) NOT NULL DEFAULT 'STARTED',
    rounds_snapshot         JSONB NOT NULL,
    answer_log              JSONB,
    result_details          JSONB,
    current_round_index     INTEGER NOT NULL DEFAULT 0,
    total_rounds            INTEGER NOT NULL DEFAULT 0,
    correct_count           INTEGER NOT NULL DEFAULT 0,
    incorrect_count         INTEGER NOT NULL DEFAULT 0,
    current_streak          INTEGER NOT NULL DEFAULT 0,
    best_streak             INTEGER NOT NULL DEFAULT 0,
    average_response_time_ms DOUBLE PRECISION NOT NULL DEFAULT 0,
    accuracy                DOUBLE PRECISION NOT NULL DEFAULT 0,
    score                   DOUBLE PRECISION NOT NULL DEFAULT 0,
    max_possible_score      DOUBLE PRECISION NOT NULL DEFAULT 0,
    started_at              TIMESTAMP(6) WITH TIME ZONE,
    expires_at              TIMESTAMP(6) WITH TIME ZONE,
    completed_at            TIMESTAMP(6) WITH TIME ZONE,
    last_activity_at        TIMESTAMP(6) WITH TIME ZONE,
    created_at              TIMESTAMP(6) WITH TIME ZONE,
    updated_at              TIMESTAMP(6) WITH TIME ZONE,
    CONSTRAINT game_attempt_status_check CHECK (status IN ('STARTED','COMPLETED','ABANDONED','EXPIRED'))
);

CREATE INDEX IF NOT EXISTS idx_game_attempt_candidate ON public.game_attempt (candidate_id);
CREATE INDEX IF NOT EXISTS idx_game_attempt_game ON public.game_attempt (game_id);
CREATE INDEX IF NOT EXISTS idx_game_attempt_status ON public.game_attempt (status);
CREATE INDEX IF NOT EXISTS idx_game_attempt_candidate_game_status
    ON public.game_attempt (candidate_id, game_id, status);

CREATE TABLE IF NOT EXISTS public.game_event (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    attempt_id    BIGINT NOT NULL REFERENCES public.game_attempt (id),
    game_id       BIGINT NOT NULL REFERENCES public.game (id),
    event_type    VARCHAR(255) NOT NULL,
    occurred_at   TIMESTAMP(6) WITH TIME ZONE NOT NULL,
    round_index   INTEGER,
    payload       JSONB,
    CONSTRAINT game_event_type_check CHECK (event_type IN
        ('ROUND_STARTED','ANSWER_SUBMITTED','ROUND_COMPLETED','TIME_WARNING','GAME_PAUSED',
         'GAME_RESUMED','GAME_COMPLETED'))
);

CREATE INDEX IF NOT EXISTS idx_game_event_attempt ON public.game_event (attempt_id);
CREATE INDEX IF NOT EXISTS idx_game_event_game ON public.game_event (game_id);
CREATE INDEX IF NOT EXISTS idx_game_event_type ON public.game_event (event_type);
