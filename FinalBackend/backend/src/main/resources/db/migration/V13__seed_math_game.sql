-- GameSeedLoader (config/GameSeedLoader.java) only inserts its catalog when the game table is
-- completely empty ("if (gameRepository.count() > 0) return;"), so it never adds a new game type
-- to a database that was already seeded before this upgrade - which is exactly why Math Challenge
-- didn't show up. Insert it directly here, guarded so this is safe regardless of whether the seed
-- loader ever ran.

INSERT INTO public.game (
    name, game_type, description, difficulty, status,
    round_count, round_duration_seconds, randomize_rounds,
    negative_marking_enabled, negative_marking_penalty,
    created_at, updated_at
)
SELECT
    'Math Challenge', 'MATH',
    'Calculate each expression and click the circles from highest value to lowest.',
    'MEDIUM', 'PUBLISHED',
    8, 25, TRUE,
    FALSE, 0.25,
    CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM public.game WHERE game_type = 'MATH');

-- Bonus fix, same root cause: the Grid/Inductive rows already in this database still carry their
-- old (pre-upgrade) descriptions, since only the round-generation logic changed, not the seeded
-- row itself. Refresh them to match the mechanic they actually run now. Harmless no-op if the
-- description was already edited to something else.
UPDATE public.game
SET description = 'No row or column repeats a symbol - work out what belongs in the missing cell.'
WHERE game_type = 'GRID'
  AND description = 'Memorize a highlighted grid pattern, then pick the option that reproduces it.';

UPDATE public.game
SET description = 'Two grids share a hidden rule - find the two candidates that follow it too.'
WHERE game_type = 'INDUCTIVE'
  AND description = 'Find the pattern behind a number sequence and predict the next term.';
