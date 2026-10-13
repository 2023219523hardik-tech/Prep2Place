"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { gameApi, GameSummary } from "@/lib/gameApi";
import { ApiError } from "@/lib/api";
import LoadingState from "@/components/LoadingState";
import ErrorState from "@/components/ErrorState";
import { GameIntro } from "@/components/games/GameIntro";

export default function GameIntroPage() {
  const params = useParams<{ gameId: string }>();
  const gameId = Number(params.gameId);
  const router = useRouter();

  const [game, setGame] = useState<GameSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    gameApi
      .get(gameId)
      .then(setGame)
      .catch((e) => setError(e instanceof ApiError ? e.message : "Failed to load this game"))
      .finally(() => setLoading(false));
  }, [gameId]);

  async function handleStart() {
    setStarting(true);
    setError("");
    try {
      const attempt = await gameApi.start(gameId);
      router.push(`/games/${attempt.id}`);
    } catch (e: any) {
      setError(e?.message || "Could not start this game");
      setStarting(false);
    }
  }

  if (loading) return <LoadingState label="Loading game..." />;
  if (error && !game) return <ErrorState message={error} />;
  if (!game) return null;

  return (
    <div>
      {error && (
        <div className="mx-auto max-w-2xl px-4 pt-6">
          <ErrorState message={error} />
        </div>
      )}
      <GameIntro
        gameType={game.gameType}
        gameName={game.name}
        roundCount={game.roundCount}
        roundDurationSeconds={game.roundDurationSeconds}
        onStart={handleStart}
        starting={starting}
      />
    </div>
  );
}
