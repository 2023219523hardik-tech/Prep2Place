"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import Icon from "@/components/ui/Icon";
import { Skeleton, SkeletonGroup } from "@/components/ui/Skeleton";
import EmptyState from "@/components/ui/EmptyState";
import ErrorState from "@/components/ErrorState";
import { DataTable } from "@/components/ui/DataTable";
import { useToast } from "@/hooks/useToast";

type TabKey = "mock" | "interview";

interface MockRow {
  attemptId: number;
  score?: number;
  verdict?: string;
  completedAt?: string;
}

interface InterviewRow {
  sessionId: number;
  overallRating?: number;
  wpm?: number;
  verdict?: string;
  completedAt?: string;
}

interface Page<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number?: number;
  page?: number;
  size?: number;
}

const TABS: { key: TabKey; label: string; icon: any }[] = [
  { key: "mock", label: "Mock Tests", icon: "file-text" },
  { key: "interview", label: "Interviews", icon: "mic" },
];

function verdictBadge(v?: string): string {
  if (!v) return "badge-neutral";
  const low = v.toLowerCase();
  if (low.includes("pass") || low === "completed" || low.includes("excel")) return "badge-success";
  if (low.includes("fail")) return "badge-danger";
  if (low.includes("warn") || low.includes("review")) return "badge-warning";
  return "badge-neutral";
}

export default function StudentReportsPage() {
  const { push } = useToast();
  const [tab, setTab] = useState<TabKey>("mock");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mockPage, setMockPage] = useState<Page<MockRow> | null>(null);
  const [interviewPage, setInterviewPage] = useState<Page<InterviewRow> | null>(null);

  const fetchAll = () => {
    setLoading(true);
    setError("");
    Promise.all([
      api.get<Page<MockRow>>("/api/reports/mocktests?size=50").catch(() => null),
      api.get<Page<InterviewRow>>("/api/reports/interviews?size=50").catch(() => null),
    ])
      .then(([m, i]) => {
        setMockPage(m ?? { content: [], totalElements: 0, totalPages: 0 });
        setInterviewPage(i ?? { content: [], totalElements: 0, totalPages: 0 });
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : "Failed to load reports"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const mockCols = useMemo(
    () => [
      {
        key: "attemptId" as const,
        label: "Attempt ID",
        render: (r: MockRow) => (
          <span className="font-mono text-xs font-semibold text-slate-700 tabular-nums">#{r.attemptId}</span>
        ),
      },
      {
        key: "score" as const,
        label: "Score %",
        render: (r: MockRow) =>
          r.score != null ? (
            <span className="font-display font-bold text-slate-800 tabular-nums">
              {r.score.toFixed(1)}%
            </span>
          ) : (
            <span className="text-slate-400">—</span>
          ),
      },
      {
        key: "verdict" as const,
        label: "Verdict",
        render: (r: MockRow) => (
          <span className={`badge ${verdictBadge(r.verdict)} !text-[11px]`}>
            {r.verdict || "Pending"}
          </span>
        ),
      },
      {
        key: "completedAt" as const,
        label: "Completed",
        render: (r: MockRow) =>
          r.completedAt ? (
            <div className="text-xs text-slate-600">
              <div className="font-medium">
                {new Date(r.completedAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </div>
              <div className="text-slate-400 mt-0.5">
                {new Date(r.completedAt).toLocaleTimeString(undefined, {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            </div>
          ) : (
            <span className="text-slate-400 text-xs">—</span>
          ),
      },
      {
        key: "actions" as const,
        label: "Actions",
        align: "right" as const,
        render: (r: MockRow) => (
          <Link
            href={`/mock-tests/${r.attemptId}/report`}
            className="text-xs font-semibold text-premium-700 hover:text-premium-800 px-2.5 py-1.5 rounded-lg bg-premium-50 hover:bg-premium-100 inline-flex items-center gap-1.5 transition-colors"
          >
            <Icon name="eye" size={12} /> View Report
          </Link>
        ),
      },
    ],
    []
  );

  const interviewCols = useMemo(
    () => [
      {
        key: "sessionId" as const,
        label: "Session ID",
        render: (r: InterviewRow) => (
          <span className="font-mono text-xs font-semibold text-slate-700 tabular-nums">#{r.sessionId}</span>
        ),
      },
      {
        key: "rating" as const,
        label: "Rating",
        render: (r: InterviewRow) =>
          r.overallRating != null ? (
            <div className="flex items-center gap-1.5">
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
          <span className={`badge ${verdictBadge(r.verdict)} !text-[11px]`}>
            {r.verdict || "Pending"}
          </span>
        ),
      },
      {
        key: "completedAt" as const,
        label: "Completed",
        render: (r: InterviewRow) =>
          r.completedAt ? (
            <div className="text-xs text-slate-600">
              <div className="font-medium">
                {new Date(r.completedAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </div>
              <div className="text-slate-400 mt-0.5">
                {new Date(r.completedAt).toLocaleTimeString(undefined, {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            </div>
          ) : (
            <span className="text-slate-400 text-xs">—</span>
          ),
      },
      {
        key: "actions" as const,
        label: "Actions",
        align: "right" as const,
        render: (r: InterviewRow) => (
          <Link
            href={`/interview/${r.sessionId}/report`}
            className="text-xs font-semibold text-premium-700 hover:text-premium-800 px-2.5 py-1.5 rounded-lg bg-premium-50 hover:bg-premium-100 inline-flex items-center gap-1.5 transition-colors"
          >
            <Icon name="eye" size={12} /> View Report
          </Link>
        ),
      },
    ],
    []
  );

  if (error) return <ErrorState message={error} />;

  const mockContent = mockPage?.content ?? [];
  const interviewContent = interviewPage?.content ?? [];

  return (
    <div className="space-y-4 animate-slide-up">
      <header className="surface-card px-5 py-4 rounded-xl border border-slate-200">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col justify-center min-w-0">
            <div className="flex items-center gap-2">
              <Icon name="file-text" size={18} strokeWidth={2} className="text-premium-600" />
              <h1 className="font-display font-bold text-lg tracking-tight text-slate-900 leading-tight">
                My Reports
              </h1>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5 leading-tight">
              Review your mock test and interview performance reports
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="badge bg-slate-100 text-slate-700 border border-slate-200 !text-[11px]">
              Mock Tests <span className="font-bold ml-1">{mockContent.length}</span>
            </span>
            <span className="badge bg-amber-50 text-amber-700 border border-amber-200 !text-[11px]">
              Interviews <span className="font-bold ml-1">{interviewContent.length}</span>
            </span>
            <button
              onClick={fetchAll}
              disabled={loading}
              className="btn-secondary disabled:opacity-50 !py-1.5"
            >
              <Icon
                name={loading ? "refresh-cw" : "refresh-cw"}
                size={14}
                className={loading ? "animate-spin" : ""}
              />
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
              <Icon name={t.icon} size={14} strokeWidth={2} />
              {t.label}
            </button>
          ))}
        </div>
      </header>

      {loading ? (
        <div className="space-y-4 animate-slide-up">
          <div className="surface-card h-[72px] px-5 flex items-center justify-between">
            <div className="space-y-1">
              <div className="h-5 w-44 bg-slate-200/70 rounded animate-pulse" />
              <div className="h-3 w-80 bg-slate-200/50 rounded animate-pulse" />
            </div>
            <div className="flex gap-2" />
          </div>
          <SkeletonGroup variant="table" />
        </div>
      ) : tab === "mock" ? (
        <DataTable<MockRow>
          columns={mockCols}
          data={mockContent}
          rowKey="attemptId"
          emptyIcon="file-text"
          emptyTitle="No mock test reports yet"
          emptyDesc="Complete a mock test to see your performance report here."
          loading={false}
        />
      ) : (
        <DataTable<InterviewRow>
          columns={interviewCols}
          data={interviewContent}
          rowKey="sessionId"
          emptyIcon="mic"
          emptyTitle="No interview reports yet"
          emptyDesc="Complete a mock interview to get personalized feedback and your report here."
          loading={false}
        />
      )}
    </div>
  );
}
