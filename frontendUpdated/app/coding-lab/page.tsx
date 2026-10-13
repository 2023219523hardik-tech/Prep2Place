"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { codingLabApi, AssessmentSummary, AttemptHistory, CodingType } from "@/lib/codingLabApi";
import { Icon } from "@/components/ui/Icon";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonGroup } from "@/components/ui/Skeleton";
import ErrorState from "@/components/ErrorState";

const TYPE_LABEL: Record<CodingType, string> = {
  BACKEND: "Backend",
  FRONTEND: "Frontend",
  MACHINE_LEARNING: "Machine Learning",
  AI: "AI",
  GENERATIVE_AI: "GenAI",
  RAG: "RAG",
};

const TYPE_ORDER: CodingType[] = ["BACKEND", "FRONTEND", "MACHINE_LEARNING", "AI", "GENERATIVE_AI", "RAG"];

const TYPE_ICON: Record<CodingType, string> = {
  BACKEND: "database",
  FRONTEND: "grid-3x3",
  MACHINE_LEARNING: "brain",
  AI: "sparkles",
  GENERATIVE_AI: "zap",
  RAG: "book-open",
};

const TYPE_THEME: Record<CodingType, { bg: string; text: string; border: string; badge: string }> = {
  BACKEND: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", badge: "bg-emerald-600 text-white" },
  FRONTEND: { bg: "bg-cyan-50", text: "text-cyan-700", border: "border-cyan-200", badge: "bg-cyan-600 text-white" },
  MACHINE_LEARNING: { bg: "bg-violet-50", text: "text-violet-700", border: "border-violet-200", badge: "bg-violet-600 text-white" },
  AI: { bg: "bg-premium-50", text: "text-premium-700", border: "border-premium-200", badge: "bg-premium-700 text-white" },
  GENERATIVE_AI: { bg: "bg-amber-50", text: "text-amber-800", border: "border-amber-200", badge: "bg-amber-600 text-white" },
  RAG: { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200", badge: "bg-rose-600 text-white" },
};

const ALL_TYPES: (CodingType | "ALL")[] = ["ALL", ...TYPE_ORDER];

export default function CodingLabPage() {
  const router = useRouter();
  const [assessments, setAssessments] = useState<AssessmentSummary[]>([]);
  const [history, setHistory] = useState<AttemptHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [starting, setStarting] = useState<number | null>(null);
  const [activeType, setActiveType] = useState<CodingType | "ALL">("ALL");

  useEffect(() => {
    Promise.all([codingLabApi.listAssessments(), codingLabApi.history()])
      .then(([a, h]) => {
        setAssessments(a);
        setHistory(h);
      })
      .catch((e) => setError(e.message || "Failed to load coding assessments"))
      .finally(() => setLoading(false));
  }, []);

  async function start(id: number) {
    setStarting(id);
    setError("");
    try {
      const workspace = await codingLabApi.start(id);
      router.push(`/coding-lab/${workspace.attemptId}`);
    } catch (e: any) {
      setError(e.message || "Could not start this assessment");
      setStarting(null);
    }
  }

  if (loading) {
    return (
      <div className="space-y-8 animate-slide-up max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <div className="card p-6 bg-white border border-slate-200 shadow-sm">
          <div className="h-6 w-48 bg-slate-200 rounded animate-pulse" />
          <div className="h-4 w-96 bg-slate-100 rounded animate-pulse mt-2" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonGroup key={i} variant="card" />
          ))}
        </div>
      </div>
    );
  }

  const visible = activeType === "ALL" ? assessments : assessments.filter((a) => a.codingType === activeType);

  return (
    <div className="space-y-8 animate-slide-up max-w-7xl mx-auto px-4 sm:px-6 py-6">
      {/* Hero Header */}
      <div className="card bg-white border border-slate-200/90 shadow-sm p-6 sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-premium-50 text-premium-700 border border-premium-200/60">
              <span>🚀</span> Production Ready Assessments
            </div>
            <h1 className="font-display text-3xl font-bold tracking-tight text-slate-950">
              Interactive Coding Lab
            </h1>
            <p className="text-sm text-slate-600 leading-relaxed">
              Solve real-world coding problems in isolated runner environments. Work with production codebases, multi-file projects, and a guided AI hint assistant.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-center min-w-[110px]">
              <span className="block text-2xl font-bold font-display text-slate-900">{assessments.length}</span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Assessments</span>
            </div>
            <div className="px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-center min-w-[110px]">
              <span className="block text-2xl font-bold font-display text-slate-900">{history.length}</span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Attempts</span>
            </div>
            <div className="px-4 py-3 rounded-xl bg-premium-50 border border-premium-200 text-center min-w-[110px]">
              <span className="block text-2xl font-bold font-display text-premium-700">6</span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-premium-600">Tech Domains</span>
            </div>
          </div>
        </div>
      </div>

      {error && <ErrorState message={error} />}

      {/* Domain Filters Bar */}
      <div className="flex flex-wrap items-center gap-2">
        {ALL_TYPES.map((t) => {
          const isActive = activeType === t;
          const count = t === "ALL" ? assessments.length : assessments.filter((a) => a.codingType === t).length;
          return (
            <button
              key={t}
              onClick={() => setActiveType(t)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition border ${
                isActive
                  ? "bg-premium-700 text-white border-premium-700 shadow-sm"
                  : "bg-white text-slate-600 border-slate-200 hover:border-premium-300 hover:bg-premium-50/50"
              }`}
            >
              <span>{t === "ALL" ? "All Tracks" : TYPE_LABEL[t]}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  isActive ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Assessments Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-display text-xl font-bold text-slate-950 flex items-center gap-2">
              <span className="text-premium-600">📁</span>
              Available Assessments
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {activeType === "ALL"
                ? "Browse all project-based evaluations across all tracks"
                : `${TYPE_LABEL[activeType as CodingType]} domain challenges`}
            </p>
          </div>
        </div>

        {visible.length === 0 ? (
          <EmptyState
            icon="file-code"
            variant="info"
            title={assessments.length === 0 ? "No assessments available" : "No assessments in this track"}
            description="Assessments will appear here once configured or seeded."
          />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((a) => {
              const theme = TYPE_THEME[a.codingType] || TYPE_THEME.BACKEND;
              return (
                <div
                  key={a.id}
                  className="card bg-white border border-slate-200/90 shadow-sm p-5 flex flex-col gap-4 hover:shadow-md hover:border-premium-300 transition-all group"
                >
                  <div className="flex items-start gap-3.5">
                    <div
                      className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0 shadow-xs ${theme.bg} ${theme.text} border ${theme.border}`}
                    >
                      <Icon
                        name={(TYPE_ICON[a.codingType] as never) || ("file-code" as never)}
                        size={20}
                        strokeWidth={2}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-md ${theme.badge}`}>
                        {TYPE_LABEL[a.codingType]}
                      </span>
                      <h3 className="font-display font-bold text-slate-900 mt-1.5 text-base truncate group-hover:text-premium-700 transition">
                        {a.title}
                      </h3>
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed line-clamp-2">
                        {a.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs">
                    <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 font-medium">
                      <Icon name="clock" size={12} />
                      {a.timeLimitMinutes} min
                    </span>
                    <span
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold capitalize border ${
                        a.difficulty === "EASY"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : a.difficulty === "HARD"
                          ? "bg-rose-50 text-rose-700 border-rose-200"
                          : "bg-amber-50 text-amber-700 border-amber-200"
                      }`}
                    >
                      <Icon name="target" size={12} />
                      {a.difficulty.toLowerCase()}
                    </span>
                    {a.aiAssistantEnabled && (
                      <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-premium-50 text-premium-700 font-semibold border border-premium-200/50">
                        <Icon name="sparkles" size={12} />
                        AI Hints
                      </span>
                    )}
                  </div>

                  <button
                    className="btn-primary w-full justify-center h-10 mt-auto text-xs font-semibold shadow-xs"
                    disabled={starting === a.id}
                    onClick={() => start(a.id)}
                  >
                    <Icon name="play" size={14} />
                    {starting === a.id ? "Launching Workspace…" : "Start Assessment"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Attempt History Section */}
      <div className="card bg-white border border-slate-200/90 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-display text-lg font-bold text-slate-950 flex items-center gap-2">
              <Icon name="clock" size={18} className="text-accent-600" />
              Attempt History
            </h2>
            <p className="text-xs text-slate-500">Review your past workspace sessions and performance.</p>
          </div>
        </div>

        {history.length === 0 ? (
          <EmptyState
            icon="clock"
            title="No past attempts"
            description="Start any assessment above to build your coding assessment record."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-500 uppercase tracking-wider font-bold">
                  <th className="text-left py-3 px-4">Assessment</th>
                  <th className="text-left py-3 px-4 hidden sm:table-cell">Track</th>
                  <th className="text-left py-3 px-4">Status</th>
                  <th className="text-left py-3 px-4">Score</th>
                  <th className="text-right py-3 px-4">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {history.map((h) => {
                  const isCompleted = h.status === "COMPLETED";
                  return (
                    <tr key={h.attemptId} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        {h.title}
                        <span className="block text-[11px] text-slate-400 font-normal">Attempt #{h.attemptId}</span>
                      </td>
                      <td className="py-3 px-4 hidden sm:table-cell font-medium text-slate-600">
                        {h.codingType}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            isCompleted
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-premium-50 text-premium-700 border border-premium-200"
                          }`}
                        >
                          {h.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-bold font-mono text-slate-800">
                        {h.bestScore != null ? `${Math.round(h.bestScore)}%` : "--"}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => router.push(`/coding-lab/${h.attemptId}`)}
                          className="btn-secondary h-7 px-3 text-xs font-semibold"
                        >
                          {isCompleted ? "Review" : "Resume"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
