"use client";

interface PerformanceRow {
  level: number;
  levelLabel: string;
  total: number;
  correct: number;
  accuracy: number;
}

export interface ResultScreenProps {
  gameName: string;
  result: Record<string, any>;
  onPlayAgain: () => void;
  onBackToList: () => void;
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${accent ? "border-premium-200 bg-premium-50" : "border-slate-200 bg-white"}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${accent ? "text-premium-700" : "text-slate-900"}`}>{value}</p>
    </div>
  );
}

export function ResultScreen({ gameName, result, onPlayAgain, onBackToList }: ResultScreenProps) {
  const accuracyPct = Math.round((result.accuracy ?? 0) * 100);
  const performanceByLevel: PerformanceRow[] = result.performanceByLevel ?? [];
  const status = result.status as string;

  return (
    <div className="min-h-[calc(100vh-140px)] flex flex-col justify-center items-center px-4 py-8">
      <div className="w-full max-w-2xl">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-premium">
        <p className="text-sm font-medium text-premium-600">{gameName}</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">
          {status === "COMPLETED" ? "Game Completed" : status === "ABANDONED" ? "Game Ended Early" : "Time's Up"}
        </h1>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Final Score" value={String(Math.round(result.score ?? 0))} accent />
          <StatCard label="Accuracy" value={`${accuracyPct}%`} />
          <StatCard label="Correct" value={String(result.correctCount ?? 0)} />
          <StatCard label="Incorrect" value={String(result.incorrectCount ?? 0)} />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Highest Level" value={`Lv. ${result.highestLevelReached ?? 1}`} />
          <StatCard label="Best Streak" value={String(result.bestStreak ?? 0)} />
          <StatCard label="Avg Response" value={`${Math.round((result.averageResponseTimeMs ?? 0) / 100) / 10}s`} />
          <StatCard label="Rounds" value={`${result.roundsAnswered ?? 0}/${result.totalRounds ?? 0}`} />
        </div>

        {performanceByLevel.length > 0 && (
          <div className="mt-8">
            <h2 className="text-sm font-semibold text-slate-700">Performance by difficulty</h2>
            <div className="mt-3 space-y-2">
              {performanceByLevel.map((row) => (
                <div key={row.level} className="flex items-center gap-3">
                  <span className="w-24 shrink-0 text-xs font-medium text-slate-500">
                    Lv.{row.level} {row.levelLabel}
                  </span>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-premium-500"
                      style={{ width: `${Math.round(row.accuracy * 100)}%` }}
                    />
                  </div>
                  <span className="w-12 shrink-0 text-right text-xs font-semibold text-slate-600">
                    {Math.round(row.accuracy * 100)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-8 flex gap-3">
          <button
            onClick={onPlayAgain}
            className="flex-1 rounded-lg bg-premium-600 py-2.5 font-semibold text-white transition hover:bg-premium-700"
          >
            Play Again
          </button>
          <button
            onClick={onBackToList}
            className="flex-1 rounded-lg border border-slate-300 py-2.5 font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Back to Games
          </button>
        </div>
      </div>
    </div>
  </div>
);
}
