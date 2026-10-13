"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { gameApi, GameSummary, AttemptSummary } from "@/lib/gameApi";
import { ApiError } from "@/lib/api";
import { Icon } from "@/components/ui/Icon";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonGroup } from "@/components/ui/Skeleton";
import { DataTable } from "@/components/ui/DataTable";
import ErrorState from "@/components/ErrorState";

const TYPE_LABEL: Record<string, string> = {
  DEDUCTIVE: "Deductive Challenge",
  SWITCH: "Switch Challenge",
  GRID: "Grid Challenge",
  INDUCTIVE: "Inductive Challenge",
  MOTION: "Motion Challenge",
  MATH: "Math Challenge",
};

const STATUS_COLOR: Record<string, string> = {
  COMPLETED: "badge-success",
  ABANDONED: "badge-neutral",
  EXPIRED: "badge-warning",
  STARTED: "badge-primary",
};

const TYPE_ICON: Record<string, string> = {
  DEDUCTIVE: "brain",
  SWITCH: "sliders-horizontal",
  GRID: "grid-3x3",
  INDUCTIVE: "sparkles",
  MOTION: "activity",
  MATH: "calculator",
};

const GRADIENT_CLASS: Record<string, string> = {
  DEDUCTIVE: "bg-gradient-to-br from-violet-500 to-purple-600",
  SWITCH: "bg-gradient-to-br from-cyan-500 to-teal-600",
  GRID: "bg-gradient-to-br from-emerald-500 to-green-600",
  INDUCTIVE: "bg-gradient-to-br from-amber-500 to-orange-600",
  MOTION: "bg-gradient-to-br from-pink-500 to-rose-600",
  MATH: "bg-gradient-to-br from-blue-500 to-indigo-600",
};

const GAME_TYPES = ["All", "DEDUCTIVE", "SWITCH", "GRID", "INDUCTIVE", "MOTION", "MATH"];

export default function GamesPage() {
  const router = useRouter();
  const [games, setGames] = useState<GameSummary[]>([]);
  const [history, setHistory] = useState<AttemptSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [starting, setStarting] = useState<number | null>(null);
  const [typeFilter, setTypeFilter] = useState("All");

  useEffect(() => {
    Promise.all([gameApi.listAvailable(), gameApi.history()])
      .then(([g, h]) => {
        setGames(g);
        setHistory(h);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : "Failed to load games"))
      .finally(() => setLoading(false));
  }, []);

  function goToIntro(gameId: number) {
    setStarting(gameId);
    router.push(`/games/play/${gameId}`);
  }

  const { bestScore, avgAccuracy } = useMemo(() => {
    if (history.length === 0) return { bestScore: null, avgAccuracy: null };
    const completed = history.filter((h) => h.status === "COMPLETED");
    const best = completed.length > 0 ? Math.max(...completed.map((h) => h.score)) : null;
    const avg =
      completed.length > 0
        ? completed.reduce((s, h) => s + h.accuracy, 0) / completed.length
        : null;
    return { bestScore: best, avgAccuracy: avg };
  }, [history]);

  const filteredGames = useMemo(() => {
    if (typeFilter === "All") return games;
    return games.filter((g) => g.gameType === typeFilter);
  }, [games, typeFilter]);

  if (loading) {
    return (
      <div className="space-y-8 animate-slide-up">
        <div className="section-card p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <SkeletonGroup variant="kpi" className="w-64" />
            </div>
            <div className="flex gap-2">
              <SkeletonGroup variant="kpi" className="w-36" />
              <SkeletonGroup variant="kpi" className="w-36" />
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {GAME_TYPES.slice(0, 4).map((t) => (
            <div key={t} className="skeleton h-8 w-24 rounded-lg" />
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonGroup key={i} variant="card" />
          ))}
        </div>
        <SkeletonGroup variant="table" />
      </div>
    );
  }

  const historyColumns = [
    {
      key: "game",
      label: "Game",
      render: (row: AttemptSummary) => (
        <div className="font-medium text-slate-800">{row.gameName}</div>
      ),
    },
    {
      key: "type",
      label: "Type",
      render: (row: AttemptSummary) => (
        <span className="badge badge-primary">{TYPE_LABEL[row.gameType] || row.gameType}</span>
      ),
    },
    {
      key: "score",
      label: "Score",
      render: (row: AttemptSummary) => (
        <div className="font-semibold text-slate-800">{row.score.toFixed(0)}</div>
      ),
    },
    {
      key: "accuracy",
      label: "Accuracy%",
      render: (row: AttemptSummary) => (
        <div className="font-semibold text-slate-800">{(row.accuracy * 100).toFixed(0)}%</div>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (row: AttemptSummary) => (
        <span className={`badge ${STATUS_COLOR[row.status] || "badge-neutral"}`}>
          {row.status}
        </span>
      ),
    },
    {
      key: "completedAt",
      label: "Completed At",
      render: (row: AttemptSummary) =>
        row.completedAt ? (
          <div className="flex items-center gap-1.5 text-sm text-slate-500">
            <Icon name="clock" size={14} />
            {new Date(row.completedAt).toLocaleDateString()}
          </div>
        ) : (
          <span className="text-slate-400">—</span>
        ),
    },
    {
      key: "action",
      label: "Action",
      align: "right" as const,
      render: (row: AttemptSummary) => (
        <button
          onClick={() => goToIntro(row.gameId ?? (row as unknown as { id: number }).id)}
          className="btn-secondary btn-sm"
        >
          <Icon name="play" size={14} />
          Replay
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-8 animate-slide-up pb-8">
      <div className="section-card p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-slate-950">
              Cognitive Games
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Train working memory, pattern recognition &amp; mental math.
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <div className="badge badge-gold gap-1.5 py-1.5 px-3">
              <Icon name="trophy" size={14} />
              <span className="font-semibold">Best Score:</span>
              <span>{bestScore !== null ? Math.round(bestScore) : "Play to unlock"}</span>
            </div>
            <div className="badge badge-accent gap-1.5 py-1.5 px-3">
              <Icon name="target" size={14} />
              <span className="font-semibold">Avg Accuracy:</span>
              <span>
                {avgAccuracy !== null ? `${Math.round(avgAccuracy * 100)}%` : "Play to unlock"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {error && <ErrorState message={error} />}

      <div className="flex flex-wrap gap-2">
        {GAME_TYPES.map((t) => (
          <button
            key={t}
            onClick={() => setTypeFilter(t)}
            className={`chip ${typeFilter === t ? "chip-active" : "chip-muted"}`}
          >
            {t === "All" ? "All Games" : TYPE_LABEL[t] || t}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonGroup key={i} variant="card" />
          ))}
        </div>
      ) : filteredGames.length === 0 ? (
        <EmptyState
          icon="gamepad-2"
          title="No games available"
          description={
            games.length === 0
              ? "No games are available to you right now. Check back later."
              : "No games match the selected filter."
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredGames.map((g) => (
            <div
              key={g.id}
              className="section-card p-5 flex flex-col gap-4 hover:shadow-elevated transition-shadow"
            >
              <div className="flex items-start gap-4">
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-md shrink-0 ${
                    GRADIENT_CLASS[g.gameType] || "bg-gradient-to-br from-slate-500 to-slate-700"
                  }`}
                >
                  <Icon
                    name={(TYPE_ICON[g.gameType] as never) || ("gamepad-2" as never)}
                    size={22}
                    strokeWidth={2}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="badge badge-primary">
                    {TYPE_LABEL[g.gameType] || g.gameType}
                  </span>
                  <h2 className="font-semibold text-slate-900 mt-1.5 text-base">{g.name}</h2>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed line-clamp-2">
                    {g.description}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <span className="chip chip-muted">
                  <Icon name="layers" size={12} />
                  {g.roundCount} rounds
                </span>
                <span className="chip chip-muted">
                  <Icon name="clock" size={12} />
                  {g.roundDurationSeconds}s / round
                </span>
                <span className="chip chip-muted capitalize">
                  <Icon name="target" size={12} />
                  {g.difficulty.toLowerCase()}
                </span>
              </div>
              <button
                className="btn-primary btn-sm mt-auto w-full justify-center"
                disabled={starting === g.id}
                onClick={() => goToIntro(g.id)}
              >
                <Icon name="play" size={14} />
                {starting === g.id ? "Loading…" : "Play"}
              </button>
            </div>
          ))}
        </div>
      )}

      <div>
        <div className="section-header !px-0 !border-b-0 !py-0 mb-4">
          <div>
            <h2 className="section-title">Game History</h2>
            <p className="section-subtitle">Track your progress across all game attempts.</p>
          </div>
        </div>
        <DataTable<AttemptSummary>
          columns={historyColumns}
          data={history}
          rowKey={(row) => String(row.id)}
          emptyIcon="gamepad-2"
          emptyTitle="No game history yet"
          emptyDesc="Play your first cognitive game to start tracking your progress here."
          loading={false}
        />
      </div>
    </div>
  );
}
