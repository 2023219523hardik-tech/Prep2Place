"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { gameAdminApi, GameAdmin, GameType, GameDifficulty, GameAttemptAdmin, GameAnalytics } from "@/lib/gameApi";
import ErrorState from "@/components/ErrorState";
import DataTable from "@/components/ui/DataTable";
import EmptyState from "@/components/ui/EmptyState";
import { SkeletonGroup, Skeleton } from "@/components/ui/Skeleton";
import FieldGroup from "@/components/ui/FieldGroup";
import Icon from "@/components/ui/Icon";

const GAME_TYPES: GameType[] = ["DEDUCTIVE", "SWITCH", "GRID", "INDUCTIVE", "MOTION"];
const DIFFICULTIES: GameDifficulty[] = ["EASY", "MEDIUM", "HARD"];

const EMPTY_FORM = {
  name: "",
  gameType: "DEDUCTIVE" as GameType,
  description: "",
  difficulty: "MEDIUM" as GameDifficulty,
  roundCount: 5,
  roundDurationSeconds: 45,
  negativeMarkingEnabled: false,
  negativeMarkingPenalty: 0.25,
};

export default function AdminGamesPage() {
  const [games, setGames] = useState<GameAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [attempts, setAttempts] = useState<GameAttemptAdmin[]>([]);
  const [analytics, setAnalytics] = useState<GameAnalytics | null>(null);
  const [preview, setPreview] = useState<any | null>(null);

  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<GameType | "ALL">("ALL");
  const [filterDifficulty, setFilterDifficulty] = useState<GameDifficulty | "ALL">("ALL");

  function load() {
    setLoading(true);
    gameAdminApi
      .list()
      .then(setGames)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  useEffect(() => {
    gameAdminApi.analyticsOverview().then(setAnalytics).catch(() => {});
  }, [games.length]);

  async function createGame(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await gameAdminApi.create(form);
      setForm(EMPTY_FORM);
      load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleExpand(game: GameAdmin) {
    if (expandedId === game.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(game.id);
    setPreview(null);
    try {
      const [a, an] = await Promise.all([gameAdminApi.attempts(game.id), gameAdminApi.analytics(game.id)]);
      setAttempts(a);
      setAnalytics(an);
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function runAction(action: (id: number) => Promise<GameAdmin>, id: number) {
    setError("");
    try {
      await action(id);
      load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function runPreview(id: number) {
    setError("");
    try {
      const p = await gameAdminApi.preview(id);
      setPreview(p);
    } catch (e: any) {
      setError(e.message);
    }
  }

  const filtered = games.filter((g) => {
    if (filterType !== "ALL" && g.gameType !== filterType) return false;
    if (filterDifficulty !== "ALL" && g.difficulty !== filterDifficulty) return false;
    if (search) {
      const s = search.toLowerCase();
      if (!g.name.toLowerCase().includes(s)) return false;
    }
    return true;
  });

  const isFirstEmpty = games.length === 0 && !loading && !error;
  const isFilteredEmpty = games.length > 0 && filtered.length === 0 && !loading;

  if (loading && games.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <Skeleton className="h-7 w-64" />
            <Skeleton className="h-4 w-96" />
          </div>
          <Skeleton className="h-9 w-36" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <SkeletonGroup variant="kpi" />
          <SkeletonGroup variant="kpi" />
          <SkeletonGroup variant="kpi" />
          <SkeletonGroup variant="kpi" />
        </div>
        <div className="surface-card p-4 space-y-3">
          <Skeleton className="h-10 w-80" />
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-7 w-20" />
            <Skeleton className="h-7 w-20" />
            <Skeleton className="h-7 w-20" />
          </div>
        </div>
        <SkeletonGroup variant="table" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-slate-900">Game-Based Assessments</h1>
          <p className="text-sm text-slate-500">Create and manage gamified aptitude assessments with adaptive difficulty and behavioral analytics.</p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="#create"
            className="btn-primary btn-sm inline-flex items-center gap-1.5"
          >
            <Icon name="plus" size={14} />
            <span>Create Game</span>
          </a>
        </div>
      </div>

      {error && (
        <div className="space-y-3">
          <ErrorState message={error} />
          <div className="flex justify-center">
            <button
              className="btn-secondary btn-sm inline-flex items-center gap-1.5"
              onClick={() => {
                setError("");
                load();
              }}
            >
              <Icon name="refresh-cw" size={14} />
              Try Again
            </button>
          </div>
        </div>
      )}

      {analytics && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="surface-card p-4">
            <div className="text-2xl font-semibold text-slate-800">{analytics.gamesAttempted}</div>
            <div className="text-xs text-slate-500 mt-0.5">Attempted</div>
          </div>
          <div className="surface-card p-4">
            <div className="text-2xl font-semibold text-slate-800">{analytics.gamesCompleted}</div>
            <div className="text-xs text-slate-500 mt-0.5">Completed</div>
          </div>
          <div className="surface-card p-4">
            <div className="text-2xl font-semibold text-slate-800">{analytics.averageScore.toFixed(1)}</div>
            <div className="text-xs text-slate-500 mt-0.5">Avg. score</div>
          </div>
          <div className="surface-card p-4">
            <div className="text-2xl font-semibold text-slate-800">{(analytics.averageAccuracy * 100).toFixed(0)}%</div>
            <div className="text-xs text-slate-500 mt-0.5">Avg. accuracy</div>
          </div>
        </div>
      )}

      <div id="create">
        <FieldGroup
          title="Create Game"
          description="Configure a new game-based assessment with rounds, timing, and marking rules."
        >
        <form onSubmit={createGame} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <input
              className="input"
              placeholder="Game name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
            <select
              className="input"
              value={form.gameType}
              onChange={(e) => setForm({ ...form, gameType: e.target.value as GameType })}
            >
              {GAME_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <textarea
            className="input"
            placeholder="Description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={2}
          />
          <div className="grid grid-cols-4 gap-3">
            <select
              className="input"
              value={form.difficulty}
              onChange={(e) => setForm({ ...form, difficulty: e.target.value as GameDifficulty })}
            >
              {DIFFICULTIES.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <input
              type="number"
              min={1}
              className="input"
              placeholder="Rounds"
              value={form.roundCount}
              onChange={(e) => setForm({ ...form, roundCount: Number(e.target.value) })}
            />
            <input
              type="number"
              min={5}
              className="input"
              placeholder="Seconds / round"
              value={form.roundDurationSeconds}
              onChange={(e) => setForm({ ...form, roundDurationSeconds: Number(e.target.value) })}
            />
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={form.negativeMarkingEnabled}
                onChange={(e) => setForm({ ...form, negativeMarkingEnabled: e.target.checked })}
              />
              Negative marking
            </label>
          </div>
          <button className="btn-primary btn-sm inline-flex items-center gap-1.5" disabled={saving}>
            {saving ? "Creating..." : "Create Game"}
          </button>
        </form>
        </FieldGroup>
      </div>

      <FieldGroup className="!p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-80">
            <Icon
              name="search"
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              placeholder="Search games by name..."
              className="input pl-9 w-80"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="w-px h-6 bg-slate-200 hidden md:block" />
          <div className="flex flex-wrap items-center gap-1.5">
            {(["ALL", ...GAME_TYPES] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setFilterType(t)}
                className={filterType === t ? "chip-active" : "chip-muted"}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="w-px h-6 bg-slate-200 hidden md:block" />
          <div className="flex flex-wrap items-center gap-1.5">
            {(["ALL", ...DIFFICULTIES] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setFilterDifficulty(d)}
                className={filterDifficulty === d ? "chip-active" : "chip-muted"}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
      </FieldGroup>

      {isFirstEmpty ? (
        <EmptyState
          variant="info"
          icon="gamepad-2"
          title="No games yet"
          description="Create your first game-based assessment to start evaluating candidates with engaging, adaptive challenges."
          action={
            <a href="#create" className="btn-primary btn-sm inline-flex items-center gap-1.5">
              <Icon name="plus" size={14} />
              Create First Game
            </a>
          }
        />
      ) : isFilteredEmpty ? (
        <EmptyState
          variant="neutral"
          icon="search"
          title="No games match your filters"
          description="Try clearing your search or adjusting the type/difficulty filters."
          action={
            <button
              className="btn-secondary btn-sm inline-flex items-center gap-1.5"
              onClick={() => {
                setSearch("");
                setFilterType("ALL");
                setFilterDifficulty("ALL");
              }}
            >
              <Icon name="refresh-cw" size={14} />
              Clear Filters
            </button>
          }
        />
      ) : (
        <DataTable<GameAdmin>
          emptyIcon="gamepad-2"
          columns={[
            {
              key: "name",
              label: "Game",
              render: (row) => (
                <div>
                  <div className="font-medium text-slate-800">{row.name}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{row.description || "No description"}</div>
                </div>
              ),
            },
            {
              key: "gameType",
              label: "Type",
              render: (row) => <span className="badge-primary">{row.gameType}</span>,
            },
            {
              key: "difficulty",
              label: "Difficulty",
              render: (row) =>
                row.difficulty === "EASY" ? (
                  <span className="badge-success">{row.difficulty}</span>
                ) : row.difficulty === "MEDIUM" ? (
                  <span className="badge-warning">{row.difficulty}</span>
                ) : (
                  <span className="badge-danger">{row.difficulty}</span>
                ),
            },
            {
              key: "rounds",
              label: "Rounds / Time",
              render: (row) => (
                <div className="text-sm text-slate-600">
                  <div>{row.roundCount} rounds</div>
                  <div className="text-xs text-slate-500">{row.roundDurationSeconds}s / round</div>
                </div>
              ),
            },
            {
              key: "status",
              label: "Status",
              render: (row) =>
                row.status === "PUBLISHED" ? (
                  <span className="badge-success">{row.status}</span>
                ) : row.status === "ARCHIVED" ? (
                  <span className="badge-neutral">{row.status}</span>
                ) : (
                  <span className="badge-warning">{row.status}</span>
                ),
            },
            {
              key: "preview",
              label: "Preview",
              render: (row) => (
                <button
                  onClick={() => runPreview(row.id)}
                  className="btn-ghost btn-sm btn-icon"
                  title="Preview rounds"
                >
                  <Icon name="eye" size={14} />
                </button>
              ),
            },
            {
              key: "actions",
              label: "Actions",
              render: (row) => (
                <div className="flex items-center gap-1">
                  {row.status !== "PUBLISHED" && (
                    <button
                      onClick={() => runAction(gameAdminApi.publish, row.id)}
                      className="btn-ghost btn-sm btn-icon text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                      title="Publish"
                    >
                      <Icon name="chart-bar" size={14} />
                    </button>
                  )}
                  {row.status === "PUBLISHED" && (
                    <button
                      onClick={() => runAction(gameAdminApi.unpublish, row.id)}
                      className="btn-ghost btn-sm btn-icon text-slate-500"
                      title="Unpublish"
                    >
                      <Icon name="eye-off" size={14} />
                    </button>
                  )}
                  <button
                    onClick={() => runAction(gameAdminApi.duplicate, row.id)}
                    className="btn-ghost btn-sm btn-icon text-slate-500"
                    title="Duplicate"
                  >
                    <Icon name="copy" size={14} />
                  </button>
                  <button
                    onClick={() => runAction(gameAdminApi.archive, row.id)}
                    className="btn-ghost btn-sm btn-icon text-slate-500"
                    title="Archive"
                  >
                    <Icon name="lock" size={14} />
                  </button>
                  <button
                    onClick={() => toggleExpand(row)}
                    className={
                      expandedId === row.id
                        ? "btn-primary btn-sm btn-icon"
                        : "btn-ghost btn-sm btn-icon text-premium-700"
                    }
                    title={expandedId === row.id ? "Hide attempts" : "View attempts"}
                  >
                    <Icon name="users" size={14} />
                  </button>
                </div>
              ),
            },
          ]}
          data={filtered}
          rowKey="id"
          emptyTitle="No games"
          emptyDesc="No games found."
        />
      )}

      {expandedId !== null && !isFirstEmpty && !isFilteredEmpty && (
        <FieldGroup
          title={`Attempts: ${games.find((g) => g.id === expandedId)?.name ?? ""}`}
          action={
            <button
              onClick={() => setExpandedId(null)}
              className="btn-ghost btn-sm btn-icon text-slate-500"
              title="Close"
            >
              <Icon name="x" size={14} />
            </button>
          }
        >
          {attempts.length === 0 ? (
            <p className="text-sm text-slate-500">No attempts yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-slate-500 text-left">
                  <tr>
                    <th className="py-2 px-2 font-medium">Candidate</th>
                    <th className="py-2 px-2 font-medium">Status</th>
                    <th className="py-2 px-2 font-medium">Score</th>
                    <th className="py-2 px-2 font-medium">Accuracy</th>
                    <th className="py-2 px-2 font-medium">Avg. response</th>
                  </tr>
                </thead>
                <tbody>
                  {attempts.map((a) => (
                    <tr key={a.id} className="border-t border-slate-100">
                      <td className="py-2 px-2">{a.candidateName || a.candidateId}</td>
                      <td className="py-2 px-2">{a.status}</td>
                      <td className="py-2 px-2 font-medium">{a.score.toFixed(0)}</td>
                      <td className="py-2 px-2">
                        <span className="badge-accent">{(a.accuracy * 100).toFixed(0)}%</span>
                      </td>
                      <td className="py-2 px-2 text-slate-600">
                        {(a.averageResponseTimeMs / 1000).toFixed(1)}s
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </FieldGroup>
      )}

      {preview && (
        <div className="section-card overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-slate-100">
            <div>
              <h2 className="font-semibold text-slate-800">Preview: {preview.gameType}</h2>
              <p className="text-xs text-slate-500">Generated rounds and configuration</p>
            </div>
            <button
              className="btn-ghost btn-sm btn-icon text-slate-500"
              onClick={() => setPreview(null)}
              title="Close preview"
            >
              <Icon name="x" size={14} />
            </button>
          </div>
          <div className="p-4">
            <pre className="text-xs bg-slate-50 rounded-lg p-4 overflow-auto max-h-96 border border-slate-100">
              {JSON.stringify(preview.rounds, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
