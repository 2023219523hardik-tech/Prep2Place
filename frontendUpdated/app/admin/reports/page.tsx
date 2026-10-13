"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { adminApi } from "@/lib/adminApi";
import ErrorState from "@/components/ErrorState";
import { Icon, type IconName } from "@/components/ui/Icon";
import { DataTable } from "@/components/ui/DataTable";
import { Skeleton, SkeletonGroup } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/hooks/useToast";

interface Summary {
  totalUsers: number;
  totalAssessments: number;
  avgMockScore: number;
  avgInterviewRating: number;
  incidents24h: number;
}

interface MockRow {
  reportId?: number;
  attemptId: number;
  userName?: string;
  userEmail?: string;
  score?: number;
  completedAt?: string;
  verdict?: string;
  sections?: { name: string; score: number; max: number }[];
}

interface InterviewRow {
  reportId?: number;
  sessionId: number;
  userName?: string;
  userEmail?: string;
  overallRating?: number;
  wpm?: number;
  verdict?: string;
  completedAt?: string;
}

interface IncidentRow {
  id: number;
  sessionId?: number;
  type?: string;
  details?: string;
  createdAt?: string;
  userEmail?: string;
  severity?: string;
}

interface Page<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
}

type TabKey = "summary" | "mock" | "interview" | "incidents";

const TABS: { key: TabKey; label: string; icon: any }[] = [
  { key: "summary", label: "Overview", icon: "dashboard" },
  { key: "mock", label: "Mock Tests", icon: "file-text" },
  { key: "interview", label: "Interviews", icon: "mic" },
  { key: "incidents", label: "Proctoring", icon: "shield" },
];

function verdictBadge(v?: string): string {
  if (!v) return "badge-neutral";
  const low = v.toLowerCase();
  if (low.includes("pass") || low === "completed" || low.includes("excel")) return "badge-success";
  if (low.includes("fail")) return "badge-danger";
  if (low.includes("warn") || low.includes("review")) return "badge-warning";
  return "badge-neutral";
}

function severityBadge(s?: string): string {
  if (!s) return "badge-neutral";
  switch (s.toUpperCase()) {
    case "HIGH":
    case "CRITICAL":
      return "badge-danger";
    case "MEDIUM":
      return "badge-warning";
    default:
      return "badge-gold";
  }
}

function downloadCsv<T>(rows: T[], filename: string, columns: { key: keyof T; label: string }[]): void {
  const header = columns.map((c) => c.label).join(",");
  const body = rows.map((r) =>
    columns
      .map((c) => {
        const raw = (r as any)[c.key as string];
        const str = raw == null ? "" : String(raw);
        return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
      })
      .join(",")
  );
  const csv = [header, ...body].join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const KPI_TILE =
  "rounded-xl border border-slate-200 bg-white px-5 py-4 flex items-start justify-between gap-3";

export default function AdminReportsHubPage() {
  const router = useRouter();
  const { push } = useToast();
  const [tab, setTab] = useState<TabKey>("summary");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [mockPage, setMockPage] = useState<Page<MockRow> | null>(null);
  const [interviewPage, setInterviewPage] = useState<Page<InterviewRow> | null>(null);
  const [incidentsPage, setIncidentsPage] = useState<Page<IncidentRow> | null>(null);
  const [mockPageNum, setMockPageNum] = useState(0);
  const [interviewPageNum, setInterviewPageNum] = useState(0);
  const [incidentsPageNum, setIncidentsPageNum] = useState(0);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [s, m, i, inc] = await Promise.all([
        adminApi.get<Summary>("/api/reports/summary").catch(() => null),
        adminApi
          .get<Page<MockRow>>(`/api/reports/mocktests?page=${mockPageNum}&size=20`)
          .catch(() => null),
        adminApi
          .get<Page<InterviewRow>>(`/api/reports/interviews?page=${interviewPageNum}&size=20`)
          .catch(() => null),
        adminApi
          .get<Page<IncidentRow>>(`/api/reports/proctoring-incidents?page=${incidentsPageNum}&size=20`)
          .catch(() => null),
      ]);
      setSummary(s);
      setMockPage(m);
      setInterviewPage(i);
      setIncidentsPage(inc);
    } catch (e: any) {
      setError(e?.message || "Failed to load reports");
    } finally {
      setLoading(false);
    }
  }, [mockPageNum, interviewPageNum, incidentsPageNum]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const kpis = useMemo(() => {
    if (!summary) return [];
    return [
      { label: "Total Students", value: summary.totalUsers, icon: "users", tint: "bg-premium-500" },
      { label: "Assessments Run", value: summary.totalAssessments, icon: "file-text", tint: "bg-cyan-500" },
      { label: "Avg Mock Score", value: summary.avgMockScore ? `${summary.avgMockScore.toFixed(1)}%` : "—", icon: "chart-bar", tint: "bg-emerald-500" },
      { label: "Avg Interview Rating", value: summary.avgInterviewRating ? summary.avgInterviewRating.toFixed(2) : "—", icon: "award", tint: "bg-amber-500" },
      { label: "Incidents (24h)", value: summary.incidents24h ?? 0, icon: "shield", tint: "bg-rose-500" },
    ];
  }, [summary]);

  function exportMockCsv() {
    if (!mockPage?.content?.length) return;
    downloadCsv(
      mockPage.content,
      `mock-test-reports-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        { key: "attemptId", label: "Attempt ID" },
        { key: "userName", label: "Student" },
        { key: "userEmail", label: "Email" },
        { key: "score", label: "Score" },
        { key: "verdict", label: "Verdict" },
        { key: "completedAt", label: "Completed At" },
      ]
    );
    push({ variant: "success", title: "CSV exported", description: `${mockPage.content.length} rows downloaded.` });
  }

  function exportInterviewCsv() {
    if (!interviewPage?.content?.length) return;
    downloadCsv(
      interviewPage.content,
      `interview-reports-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        { key: "sessionId", label: "Session ID" },
        { key: "userName", label: "Student" },
        { key: "userEmail", label: "Email" },
        { key: "overallRating", label: "Rating" },
        { key: "wpm", label: "WPM" },
        { key: "verdict", label: "Verdict" },
        { key: "completedAt", label: "Completed At" },
      ]
    );
    push({ variant: "success", title: "CSV exported", description: `${interviewPage.content.length} rows downloaded.` });
  }

  function exportIncidentsCsv() {
    if (!incidentsPage?.content?.length) return;
    downloadCsv(
      incidentsPage.content,
      `proctoring-incidents-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        { key: "id", label: "Incident ID" },
        { key: "sessionId", label: "Session ID" },
        { key: "userEmail", label: "User Email" },
        { key: "type", label: "Type" },
        { key: "severity", label: "Severity" },
        { key: "details", label: "Details" },
        { key: "createdAt", label: "Created At" },
      ]
    );
    push({ variant: "success", title: "CSV exported", description: `${incidentsPage.content.length} rows downloaded.` });
  }

  if (error) return <ErrorState message={error} />;

  const mockCols = [
    {
      key: "student" as const,
      label: "Student",
      render: (r: MockRow) => (
        <div className="min-w-0">
          <div className="font-medium text-slate-800 text-sm truncate">{r.userName || "—"}</div>
          <div className="text-xs text-slate-500 truncate">{r.userEmail || "—"}</div>
        </div>
      ),
    },
    {
      key: "score" as const,
      label: "Score",
      render: (r: MockRow) =>
        r.score != null ? (
          <span className="font-display font-bold text-slate-800 tabular-nums">{r.score.toFixed(1)}%</span>
        ) : (
          <span className="text-slate-400">—</span>
        ),
    },
    {
      key: "verdict" as const,
      label: "Verdict",
      render: (r: MockRow) => (
        <span className={`badge ${verdictBadge(r.verdict)} !text-[11px]`}>{r.verdict || "Pending"}</span>
      ),
    },
    {
      key: "completedAt" as const,
      label: "Completed",
      render: (r: MockRow) =>
        r.completedAt ? (
          <span className="text-xs text-slate-600">
            {new Date(r.completedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          </span>
        ) : (
          <span className="text-slate-400 text-xs">—</span>
        ),
    },
    {
      key: "actions" as const,
      label: "Actions",
      align: "right" as const,
      render: (r: MockRow) => (
        <div className="flex items-center gap-2 justify-end">
          <button
            onClick={() => adminApi.post(`/api/reports/generate/${r.attemptId}`, {}).catch(() => ({}))}
            className="text-xs font-medium text-slate-600 hover:text-slate-900 px-2 py-1 rounded hover:bg-slate-100"
          >
            <Icon name="refresh-cw" size={12} /> Regen
          </button>
          <Link
            href={`/mock-tests/${r.attemptId}/report`}
            className="text-xs font-semibold text-premium-700 hover:text-premium-800 px-2.5 py-1 rounded bg-premium-50 hover:bg-premium-100 inline-flex items-center gap-1"
          >
            <Icon name="eye" size={12} /> View
          </Link>
        </div>
      ),
    },
  ];

  const interviewCols = [
    {
      key: "student" as const,
      label: "Student",
      render: (r: InterviewRow) => (
        <div className="min-w-0">
          <div className="font-medium text-slate-800 text-sm truncate">{r.userName || "—"}</div>
          <div className="text-xs text-slate-500 truncate">{r.userEmail || "—"}</div>
        </div>
      ),
    },
    {
      key: "rating" as const,
      label: "Rating",
      render: (r: InterviewRow) =>
        r.overallRating != null ? (
          <div className="flex items-center gap-1">
            <Icon name="award" size={12} className="text-amber-500" />
            <span className="font-display font-bold text-slate-800 tabular-nums">
              {r.overallRating.toFixed(2)}
            </span>
          </div>
        ) : (
          <span className="text-slate-400">—</span>
        ),
    },
    {
      key: "wpm" as const,
      label: "WPM",
      render: (r: InterviewRow) =>
        r.wpm != null ? (
          <span className="font-medium text-slate-700 tabular-nums text-sm">{r.wpm}</span>
        ) : (
          <span className="text-slate-400 text-xs">—</span>
        ),
    },
    {
      key: "verdict" as const,
      label: "Verdict",
      render: (r: InterviewRow) => (
        <span className={`badge ${verdictBadge(r.verdict)} !text-[11px]`}>{r.verdict || "Pending"}</span>
      ),
    },
    {
      key: "actions" as const,
      label: "Actions",
      align: "right" as const,
      render: (r: InterviewRow) => (
        <div className="flex items-center gap-2 justify-end">
          <button
            onClick={() => adminApi.post(`/api/reports/generate-interview/${r.sessionId}`, {}).catch(() => ({}))}
            className="text-xs font-medium text-slate-600 hover:text-slate-900 px-2 py-1 rounded hover:bg-slate-100"
          >
            <Icon name="refresh-cw" size={12} /> Regen
          </button>
          <Link
            href={`/interview/${r.sessionId}/report`}
            className="text-xs font-semibold text-premium-700 hover:text-premium-800 px-2.5 py-1 rounded bg-premium-50 hover:bg-premium-100 inline-flex items-center gap-1"
          >
            <Icon name="eye" size={12} /> View
          </Link>
        </div>
      ),
    },
  ];

  const incidentCols = [
    {
      key: "id" as const,
      label: "ID",
      render: (r: IncidentRow) => (
        <span className="font-mono text-xs text-slate-600 tabular-nums">#{r.id}</span>
      ),
    },
    {
      key: "userEmail" as const,
      label: "User",
      render: (r: IncidentRow) => (
        <div className="min-w-0">
          <div className="text-xs text-slate-700 truncate">{r.userEmail || "—"}</div>
          <div className="text-[10px] text-slate-500">Session #{r.sessionId || "—"}</div>
        </div>
      ),
    },
    {
      key: "type" as const,
      label: "Type",
      render: (r: IncidentRow) => (
        <div className="min-w-0">
          <div className="text-sm font-medium text-slate-800 truncate">{r.type || "Unknown"}</div>
        </div>
      ),
    },
    {
      key: "severity" as const,
      label: "Severity",
      render: (r: IncidentRow) => (
        <span className={`badge ${severityBadge(r.severity)} !text-[11px]`}>
          {r.severity || "LOW"}
        </span>
      ),
    },
    {
      key: "details" as const,
      label: "Details",
      render: (r: IncidentRow) => (
        <div className="text-xs text-slate-600 max-w-[280px] truncate">{r.details || "—"}</div>
      ),
    },
    {
      key: "createdAt" as const,
      label: "Time",
      render: (r: IncidentRow) =>
        r.createdAt ? (
          <span className="text-xs text-slate-600 whitespace-nowrap">
            {new Date(r.createdAt).toLocaleString(undefined, {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        ) : (
          <span className="text-slate-400 text-xs">—</span>
        ),
    },
  ];

  return (
    <div className="space-y-5 animate-slide-up">
      <div className="surface-card px-5 py-4 rounded-xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col justify-center min-w-0">
            <div className="flex items-center gap-2">
              <Icon name="chart-bar" size={18} className="text-premium-600" />
              <h1 className="font-display font-bold text-lg tracking-tight text-slate-900 leading-tight">
                Reports Hub
              </h1>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5 leading-tight">
              Mock test reports, interview ratings, and proctoring incident registry.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={fetchAll}
              disabled={loading}
              className="btn-secondary disabled:opacity-50"
            >
              <Icon name={loading ? "refresh-cw" : "refresh-cw"} size={14} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-1.5 bg-slate-50 p-1 rounded-xl w-fit">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === t.key
                  ? "bg-white text-premium-700 shadow-sm ring-1 ring-premium-300/40"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
              }`}
            >
              <Icon name={t.icon} size={14} />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-5">
          {tab === "summary" ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-24 rounded-xl" />
                ))}
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Skeleton className="h-72 rounded-xl" />
                <Skeleton className="h-72 rounded-xl" />
              </div>
            </>
          ) : (
            <SkeletonGroup variant="list" />
          )}
        </div>
      ) : null}

      {!loading && tab === "summary" && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
            {kpis.length === 0
              ? Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className={KPI_TILE}>
                    <div className="space-y-1">
                      <div className="text-xs text-slate-500 font-medium uppercase tracking-wider">KPI {i + 1}</div>
                      <div className="font-display text-xl font-bold text-slate-400">—</div>
                    </div>
                    <div className="w-9 h-9 rounded-lg bg-slate-100" />
                  </div>
                ))
              : kpis.map((k) => (
                  <div key={k.label} className={KPI_TILE}>
                    <div className="space-y-1 min-w-0">
                      <div className="text-xs text-slate-500 font-medium uppercase tracking-wider">
                        {k.label}
                      </div>
                      <div className="font-display text-2xl font-bold text-slate-900 tabular-nums truncate">
                        {k.value}
                      </div>
                    </div>
                    <div className={`w-9 h-9 rounded-lg ${k.tint} text-white flex items-center justify-center shrink-0`}>
                      <Icon name={k.icon as IconName} size={16} />
                    </div>
                  </div>
                ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="surface-card p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-slate-800">Latest Mock Tests</h3>
                <button
                  onClick={() => setTab("mock")}
                  className="text-xs font-medium text-premium-700 hover:text-premium-800"
                >
                  View all →
                </button>
              </div>
              {mockPage?.content?.length ? (
                <div className="divide-y divide-slate-100">
                  {mockPage.content.slice(0, 5).map((r) => (
                    <div key={r.attemptId} className="py-2.5 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-slate-800 truncate">{r.userName || "Anonymous"}</div>
                        <div className="text-xs text-slate-500 truncate">{r.userEmail}</div>
                      </div>
                      <span className={`badge ${verdictBadge(r.verdict)} !text-[11px] shrink-0`}>
                        {r.score != null ? `${r.score.toFixed(0)}%` : r.verdict || "—"}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon="file-text"
                  variant="neutral"
                  title="No mock reports"
                  description="Completed tests will appear here."
                />
              )}
            </div>
            <div className="surface-card p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-slate-800">Latest Interviews</h3>
                <button
                  onClick={() => setTab("interview")}
                  className="text-xs font-medium text-premium-700 hover:text-premium-800"
                >
                  View all →
                </button>
              </div>
              {interviewPage?.content?.length ? (
                <div className="divide-y divide-slate-100">
                  {interviewPage.content.slice(0, 5).map((r) => (
                    <div key={r.sessionId} className="py-2.5 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-slate-800 truncate">{r.userName || "Anonymous"}</div>
                        <div className="text-xs text-slate-500 truncate">{r.userEmail}</div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {r.overallRating != null && (
                          <div className="flex items-center gap-0.5">
                            <Icon name="award" size={12} className="text-amber-500" />
                            <span className="text-sm font-semibold tabular-nums text-slate-800">
                              {r.overallRating.toFixed(1)}
                            </span>
                          </div>
                        )}
                        <span className={`badge ${verdictBadge(r.verdict)} !text-[11px]`}>
                          {r.verdict || "—"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon="mic"
                  variant="neutral"
                  title="No interview reports"
                  description="Interview ratings will appear once sessions finish."
                />
              )}
            </div>
          </div>
        </>
      )}

      {!loading && tab === "mock" && (
        <div className="section-card">
          <div className="section-header">
            <div>
              <h2 className="section-title flex items-center gap-2">
                <Icon name="file-text" size={16} className="text-premium-600" />
                Mock Test Reports
              </h2>
              <p className="section-subtitle">
                {mockPage?.totalElements ?? 0} total · Page {mockPageNum + 1} of {mockPage?.totalPages ?? 1}
              </p>
            </div>
            <button onClick={exportMockCsv} className="btn-secondary !text-xs">
              <Icon name="download" size={12} /> Export CSV
            </button>
          </div>
          {mockPage?.content?.length ? (
            <div className="overflow-x-auto">
              <DataTable<MockRow>
                columns={mockCols}
                data={mockPage.content}
                rowKey="attemptId"
                emptyIcon="file-text"
                emptyTitle="No mock reports yet"
                emptyDesc="Completed mock assessments will be listed here."
                loading={false}
              />
            </div>
          ) : (
            <div className="p-5">
              <EmptyState
                icon="file-text"
                variant="neutral"
                title="No mock reports yet"
                description="Completed mock assessments will be listed here."
              />
            </div>
          )}
        </div>
      )}

      {!loading && tab === "interview" && (
        <div className="section-card">
          <div className="section-header">
            <div>
              <h2 className="section-title flex items-center gap-2">
                <Icon name="mic" size={16} className="text-amber-600" />
                Interview Reports
              </h2>
              <p className="section-subtitle">
                {interviewPage?.totalElements ?? 0} total · Page {interviewPageNum + 1} of {interviewPage?.totalPages ?? 1}
              </p>
            </div>
            <button onClick={exportInterviewCsv} className="btn-secondary !text-xs">
              <Icon name="download" size={12} /> Export CSV
            </button>
          </div>
          {interviewPage?.content?.length ? (
            <div className="overflow-x-auto">
              <DataTable<InterviewRow>
                columns={interviewCols}
                data={interviewPage.content}
                rowKey="sessionId"
                emptyIcon="mic"
                emptyTitle="No interview reports yet"
                emptyDesc="Sessions completed with Arya will show ratings and verdicts here."
                loading={false}
              />
            </div>
          ) : (
            <div className="p-5">
              <EmptyState
                icon="mic"
                variant="neutral"
                title="No interview reports yet"
                description="Sessions completed with Arya will show ratings and verdicts here."
              />
            </div>
          )}
        </div>
      )}

      {!loading && tab === "incidents" && (
        <div className="section-card">
          <div className="section-header">
            <div>
              <h2 className="section-title flex items-center gap-2">
                <Icon name="shield" size={16} className="text-rose-600" />
                Proctoring Incidents
              </h2>
              <p className="section-subtitle">
                {incidentsPage?.totalElements ?? 0} total · Page {incidentsPageNum + 1} of {incidentsPage?.totalPages ?? 1}
              </p>
            </div>
            <button onClick={exportIncidentsCsv} className="btn-secondary !text-xs">
              <Icon name="download" size={12} /> Export CSV
            </button>
          </div>
          {incidentsPage?.content?.length ? (
            <div className="overflow-x-auto">
              <DataTable<IncidentRow>
                columns={incidentCols}
                data={incidentsPage.content}
                rowKey="id"
                emptyIcon="shield"
                emptyTitle="Zero incidents"
                emptyDesc="All sessions so far have no flagged integrity issues."
                loading={false}
              />
            </div>
          ) : (
            <div className="p-5">
              <EmptyState
                icon="shield"
                variant="success"
                title="Zero incidents"
                description="All sessions so far have no flagged integrity issues."
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
