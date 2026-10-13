"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { adminApi } from "@/lib/adminApi";
import ErrorState from "@/components/ErrorState";
import { Icon } from "@/components/ui/Icon";
import { Skeleton, SkeletonGroup } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/hooks/useToast";

type AttemptStatus = "IN_PROGRESS" | "COMPLETED" | "TERMINATED" | "QUEUED";
type AttemptType = "mock" | "interview" | "coding";

interface LiveAttempt {
  id: string | number;
  attemptId?: string | number;
  userId?: string | number;
  userName?: string;
  userEmail?: string;
  type?: AttemptType;
  status: AttemptStatus;
  startedAt: string;
  lastSeenAt?: string;
  integrityScore?: number;
}

interface LiveAttemptsResponse {
  attempts: LiveAttempt[];
  summary?: {
    completedToday: number;
    terminatedToday: number;
  };
}

const STATUS_BADGE: Record<AttemptStatus, string> = {
  IN_PROGRESS: "badge-primary",
  COMPLETED: "badge-success",
  TERMINATED: "badge-danger",
  QUEUED: "badge-warning",
};

const STATUS_DOT: Record<AttemptStatus, string> = {
  IN_PROGRESS: "bg-premium-500",
  COMPLETED: "bg-emerald-500",
  TERMINATED: "bg-red-500",
  QUEUED: "bg-amber-500",
};

const TYPE_ICON: Record<AttemptType, string> = {
  mock: "test-tube",
  interview: "mic",
  coding: "code",
};

const TYPE_LABEL: Record<AttemptType, string> = {
  mock: "Mock Test",
  interview: "Interview",
  coding: "Coding",
};

function integrityProgressClass(score: number): string {
  if (score < 50) return "bg-red-500";
  if (score <= 75) return "bg-amber-500";
  return "bg-emerald-500";
}

function formatDateTime(iso?: string): string {
  if (!iso) return "-";
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatRelative(iso?: string): string {
  if (!iso) return "-";
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}

function getInitials(name?: string): string {
  if (!name) return "??";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "??";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

export default function AdminLiveMonitoringPage() {
  const [attempts, setAttempts] = useState<LiveAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [firstLoad, setFirstLoad] = useState(true);
  const [error, setError] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [terminating, setTerminating] = useState<Set<string | number>>(new Set());
  const [summary, setSummary] = useState<{ completedToday: number; terminatedToday: number }>({
    completedToday: 0,
    terminatedToday: 0,
  });
  const { push } = useToast();

  const fetchAttempts = useCallback(async () => {
    setError("");
    try {
      const res = await adminApi.get<LiveAttemptsResponse>("/api/admin/live/attempts");
      const list = res?.attempts ?? [];
      setAttempts(list);
      if (res?.summary) {
        setSummary(res.summary);
      }
    } catch (e: any) {
      setError(e?.message || "Failed to load live attempts");
    } finally {
      setLoading(false);
      setFirstLoad(false);
    }
  }, []);

  useEffect(() => {
    fetchAttempts();
  }, [fetchAttempts]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => {
      fetchAttempts();
    }, 5000);
    return () => clearInterval(id);
  }, [autoRefresh, fetchAttempts]);

  const handleTerminate = useCallback(
    async (attempt: LiveAttempt) => {
      const id = attempt.attemptId ?? attempt.id;
      setTerminating((prev) => new Set(prev).add(id));
      try {
        await adminApi.post(`/api/admin/live/attempts/${id}/terminate`, {});
        push({
          variant: "success",
          title: "Attempt terminated",
          description: `${attempt.userName || "User"}'s session has been terminated.`,
        });
        setAttempts((prev) =>
          prev.map((a) =>
            (a.attemptId ?? a.id) === id ? { ...a, status: "TERMINATED" as AttemptStatus } : a
          )
        );
      } catch (e: any) {
        push({
          variant: "error",
          title: "Failed to terminate",
          description: e?.message || "Please try again.",
        });
      } finally {
        setTerminating((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    },
    [push]
  );

  const handleInspectHref = useCallback((attempt: LiveAttempt): string => {
    const id = attempt.attemptId ?? attempt.id;
    if (attempt.type === "interview") {
      return `/interview/${id}/report`;
    }
    if (attempt.type === "mock") {
      return `/mock-tests/${id}`;
    }
    return `/admin/tests/${id}/attempts`;
  }, []);

  const kpis = useMemo(() => {
    const live = attempts.filter((a) => a.status === "IN_PROGRESS" || a.status === "QUEUED");
    const withScore = attempts.filter(
      (a) => typeof a.integrityScore === "number" && !isNaN(a.integrityScore!)
    );
    const avgIntegrity = withScore.length
      ? Math.round(
          withScore.reduce((sum, a) => sum + (a.integrityScore ?? 0), 0) / withScore.length
        )
      : 0;
    return {
      totalLive: live.length,
      completedToday: summary.completedToday ?? 0,
      terminatedToday: summary.terminatedToday ?? 0,
      avgIntegrity,
    };
  }, [attempts, summary]);

  if (firstLoad && loading) {
    return (
      <div className="w-full space-y-5 pb-8">
        <div className="section-card">
          <div className="px-5 py-5 space-y-3">
            <Skeleton variant="line" className="w-64 h-6" />
            <Skeleton variant="line" className="w-96 h-4" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <SkeletonGroup variant="kpi" />
          <SkeletonGroup variant="kpi" />
          <SkeletonGroup variant="kpi" />
          <SkeletonGroup variant="kpi" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <SkeletonGroup variant="card" />
          <SkeletonGroup variant="card" />
          <SkeletonGroup variant="card" />
          <SkeletonGroup variant="card" />
          <SkeletonGroup variant="card" />
          <SkeletonGroup variant="card" />
        </div>
      </div>
    );
  }

  if (error) return <ErrorState message={error} />;

  return (
    <div className="w-full space-y-5 pb-8">
      <section className="section-card">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 px-5 py-5">
          <div>
            <p className="eyebrow">Admin Console / Live Ops</p>
            <h1 className="font-display text-2xl font-bold text-slate-900 mt-1 tracking-tight flex items-center gap-2">
              <Icon name="activity" size={22} className="text-premium-600" />
              Live Attempt Monitoring
            </h1>
            <p className="section-subtitle mt-1">
              Real-time view of active mock tests, interviews, and coding sessions. Auto-refreshes
              every 5 seconds.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="accent-premium-600 w-4 h-4"
              />
              <span className="text-sm font-medium text-slate-700">Auto-on</span>
              <span
                className={`w-2 h-2 rounded-full ${autoRefresh ? "bg-emerald-500 animate-pulse" : "bg-slate-300"}`}
              />
            </label>
            <button
              type="button"
              className="btn-secondary btn-sm"
              onClick={fetchAttempts}
              disabled={loading}
            >
              <Icon
                name="refresh-cw"
                size={14}
                className={loading ? "animate-spin" : ""}
              />
              Refresh now
            </button>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="kpi-tile">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="kpi-label">Total Live</div>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="kpi-value tabular-nums">{kpis.totalLive}</span>
              </div>
              <div className="kpi-delta mt-2 text-slate-600">
                <span
                  className={`inline-block w-2 h-2 rounded-full mr-1.5 ${kpis.totalLive > 0 ? "bg-premium-500 animate-pulse" : "bg-slate-300"}`}
                />
                {kpis.totalLive === 0 ? "No active sessions" : "Active right now"}
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-premium-50 border border-premium-100 flex items-center justify-center text-premium-600 flex-shrink-0">
              <Icon name="activity" size={20} />
            </div>
          </div>
        </div>

        <div className="kpi-tile">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="kpi-label">Completed Today</div>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="kpi-value tabular-nums">{kpis.completedToday}</span>
              </div>
              <div className="kpi-delta mt-2 text-emerald-700">
                <Icon name="check-circle" size={12} className="text-emerald-600" />
                Successfully finished
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 flex-shrink-0">
              <Icon name="check-circle" size={20} />
            </div>
          </div>
        </div>

        <div className="kpi-tile">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="kpi-label">Terminated Today</div>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="kpi-value tabular-nums">{kpis.terminatedToday}</span>
              </div>
              <div className="kpi-delta mt-2 text-red-700">
                <Icon name="stop-circle" size={12} className="text-red-600" />
                Stopped by admin or guard
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center text-red-600 flex-shrink-0">
              <Icon name="stop-circle" size={20} />
            </div>
          </div>
        </div>

        <div className="kpi-tile">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="kpi-label">Avg Integrity</div>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="kpi-value tabular-nums">{kpis.avgIntegrity}</span>
                <span className="text-sm text-slate-500">%</span>
              </div>
              <div className="kpi-delta mt-2 text-slate-600">
                <Icon name="shield" size={12} className="text-premium-600" />
                Across live sessions
              </div>
            </div>
            <div
              className={`w-10 h-10 rounded-xl border flex items-center justify-center flex-shrink-0 ${
                kpis.avgIntegrity >= 75
                  ? "bg-emerald-50 border-emerald-100 text-emerald-600"
                  : kpis.avgIntegrity >= 50
                  ? "bg-amber-50 border-amber-100 text-amber-600"
                  : "bg-red-50 border-red-100 text-red-600"
              }`}
            >
              <Icon name="shield" size={20} />
            </div>
          </div>
        </div>
      </div>

      {attempts.length === 0 ? (
        <EmptyState
          icon="activity"
          variant="info"
          title="No active attempts"
          description="There are currently no test sessions running. This view will automatically populate when students start mock tests, interviews, or coding assessments."
          action={
            <button
              type="button"
              className="btn-secondary btn-sm"
              onClick={fetchAttempts}
              disabled={loading}
            >
              <Icon
                name="refresh-cw"
                size={14}
                className={loading ? "animate-spin" : ""}
              />
              Refresh now
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {attempts.map((attempt) => {
            const id = attempt.attemptId ?? attempt.id;
            const isTerminating = terminating.has(id);
            const integrity = attempt.integrityScore ?? 0;
            const typeIcon = attempt.type ? TYPE_ICON[attempt.type] : "layers";
            const typeLabel = attempt.type ? TYPE_LABEL[attempt.type] : "Session";

            return (
              <div
                key={String(id)}
                className="surface-card p-5 flex flex-col gap-4 hover:shadow-lg hover:border-premium-200 transition-all duration-200"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-full bg-premium-50 text-premium-700 font-bold flex items-center justify-center text-sm flex-shrink-0">
                      {getInitials(attempt.userName)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`badge ${STATUS_BADGE[attempt.status]} !text-[11px] flex items-center gap-1`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[attempt.status]} ${attempt.status === "IN_PROGRESS" ? "animate-pulse" : ""}`} />
                          {attempt.status.replace("_", " ")}
                        </span>
                        <span className="badge badge-neutral !text-[11px] flex items-center gap-1">
                          <Icon name={typeIcon as any} size={11} />
                          {typeLabel}
                        </span>
                      </div>
                      <div className="mt-1.5 font-semibold text-slate-900 text-sm truncate">
                        {attempt.userName || "Unnamed User"}
                      </div>
                      {attempt.userEmail && (
                        <div className="text-xs text-slate-500 truncate">
                          {attempt.userEmail}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <div className="text-slate-400 font-medium uppercase tracking-wider text-[10px]">
                      Attempt ID
                    </div>
                    <div className="text-slate-700 font-mono text-[11px] truncate mt-0.5">
                      #{String(id)}
                    </div>
                  </div>
                  {attempt.userId !== undefined && (
                    <div>
                      <div className="text-slate-400 font-medium uppercase tracking-wider text-[10px]">
                        User ID
                      </div>
                      <div className="text-slate-700 font-mono text-[11px] truncate mt-0.5">
                        #{String(attempt.userId)}
                      </div>
                    </div>
                  )}
                  <div>
                    <div className="text-slate-400 font-medium uppercase tracking-wider text-[10px]">
                      Started
                    </div>
                    <div className="text-slate-700 text-[11px] mt-0.5">
                      {formatDateTime(attempt.startedAt)}
                    </div>
                  </div>
                  {attempt.lastSeenAt && (
                    <div>
                      <div className="text-slate-400 font-medium uppercase tracking-wider text-[10px]">
                        Last Seen
                      </div>
                      <div className="text-slate-700 text-[11px] mt-0.5">
                        {formatRelative(attempt.lastSeenAt)}
                      </div>
                    </div>
                  )}
                </div>

                {typeof attempt.integrityScore === "number" && !isNaN(attempt.integrityScore) && (
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400 flex items-center gap-1">
                        <Icon name="shield" size={10} />
                        Integrity Score
                      </span>
                      <span
                        className={`text-xs font-bold tabular-nums ${
                          integrity >= 75
                            ? "text-emerald-700"
                            : integrity >= 50
                            ? "text-amber-700"
                            : "text-red-700"
                        }`}
                      >
                        {Math.round(integrity)}%
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${integrityProgressClass(integrity)}`}
                        style={{ width: `${Math.max(0, Math.min(100, integrity))}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 mt-auto">
                  <Link
                    href={handleInspectHref(attempt)}
                    className="btn-ghost btn-sm flex-1 justify-center"
                  >
                    <Icon name="eye" size={14} />
                    Inspect
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleTerminate(attempt)}
                    disabled={
                      isTerminating ||
                      attempt.status === "TERMINATED" ||
                      attempt.status === "COMPLETED"
                    }
                    className="btn-sm flex-1 justify-center text-white bg-red-600 hover:bg-red-700 border border-red-600 hover:border-red-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:border-slate-200 disabled:cursor-not-allowed transition-colors rounded-lg font-medium text-xs inline-flex items-center gap-1.5"
                  >
                    <Icon
                      name="stop-circle"
                      size={14}
                      className={isTerminating ? "animate-spin" : ""}
                    />
                    {isTerminating ? "Terminating…" : "Terminate"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
