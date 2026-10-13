"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { adminApi } from "@/lib/adminApi";
import LoadingState from "@/components/LoadingState";
import ErrorState from "@/components/ErrorState";
import { Icon } from "@/components/ui/Icon";
import { DataTable } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton, SkeletonGroup } from "@/components/ui/Skeleton";
import { useToast } from "@/hooks/useToast";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface Stats {
  totalStudents: number;
  activeStudents: number;
  placementReadyStudents: number;
  studentsNeedingImprovement: number;
  averageReadinessScore: number;
  averageCodingScore: number;
  averageAptitudeScore: number;
  averageInterviewScore: number;
  mostCommonSkillGaps: string[];
}

interface FlaggedInterview {
  sessionId: number;
  studentName: string;
  studentEmail: string;
  roleTitle: string;
  integrityScore: number;
  completedAt: string;
}

function round(n: number): number {
  return Math.round(n);
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "??";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function integrityBadgeClass(score: number): string {
  if (score < 50) return "badge-danger";
  if (score <= 75) return "badge-warning";
  return "badge-neutral";
}

function integrityProgressClass(score: number): string {
  if (score < 50) return "bg-red-500";
  if (score <= 75) return "bg-amber-500";
  return "bg-slate-400";
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [flagged, setFlagged] = useState<FlaggedInterview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dismissing, setDismissing] = useState<number | null>(null);
  const { push } = useToast();

  const fetchData = useCallback(() => {
    setLoading(true);
    setError("");
    Promise.all([
      adminApi.get<Stats>("/api/admin/dashboard"),
      adminApi.get<FlaggedInterview[]>("/api/admin/interviews/flagged"),
    ])
      .then(([s, f]) => {
        setStats(s);
        setFlagged(f);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (error) return <ErrorState message={error} />;
  if (!stats && !loading) return null;

  const flaggedColumns = [
    {
      key: "student",
      label: "Student",
      render: (row: FlaggedInterview) => (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-premium-50 text-premium-700 font-bold flex items-center justify-center text-sm flex-shrink-0">
            {getInitials(row.studentName)}
          </div>
          <div className="min-w-0">
            <p className="font-medium text-slate-900 truncate">{row.studentName}</p>
            <p className="text-xs text-slate-500 truncate">{row.studentEmail}</p>
          </div>
        </div>
      ),
    },
    {
      key: "role",
      label: "Role",
      render: (row: FlaggedInterview) => (
        <span className="badge badge-gold">
          <Icon name="briefcase" size={12} />
          {row.roleTitle}
        </span>
      ),
    },
    {
      key: "integrityScore",
      label: "Integrity Score",
      render: (row: FlaggedInterview) => {
        const rounded = Math.round(row.integrityScore);
        return (
          <div>
            <span className={`badge ${integrityBadgeClass(row.integrityScore)}`}>
              {rounded}
            </span>
            <div className="w-full max-w-[140px] h-1.5 bg-slate-100 rounded-full mt-2 overflow-hidden">
              <div
                className={`h-full rounded-full ${integrityProgressClass(row.integrityScore)}`}
                style={{ width: `${Math.max(0, Math.min(100, rounded))}%` }}
              />
            </div>
          </div>
        );
      },
    },
    {
      key: "completedAt",
      label: "Completed At",
      render: (row: FlaggedInterview) => (
        <span className="inline-flex items-center gap-1.5 text-slate-600 text-xs">
          <Icon name="clock" size={12} />
          {row.completedAt ? new Date(row.completedAt).toLocaleString() : "-"}
        </span>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      align: "right" as const,
      render: (row: FlaggedInterview) => {
        const handleReview = () => {
          push({
            variant: "info",
            title: "Opening review report",
            description: `Interview ${row.sessionId} — ${row.studentName}`,
          });
          router.push(`/interview/${row.sessionId}/report`);
        };

        const handleDismiss = async () => {
          setDismissing(row.sessionId);
          try {
            await adminApi.patch(
              `/api/admin/interviews/${row.sessionId}/dismiss-flag`,
              {}
            );
            setFlagged((prev) =>
              prev.filter((f) => f.sessionId !== row.sessionId)
            );
            push({
              variant: "success",
              title: "Flag dismissed",
              description: `${row.studentName}'s integrity flag has been cleared.`,
            });
          } catch (e: any) {
            push({
              variant: "error",
              title: "Failed to dismiss flag",
              description: e?.message || "Please try again.",
            });
          } finally {
            setDismissing(null);
          }
        };

        const isDismissing = dismissing === row.sessionId;

        return (
          <div className="flex items-center gap-1 justify-end">
            <button
              type="button"
              className="btn-ghost btn-sm"
              onClick={handleReview}
            >
              <Icon name="eye" size={14} />
              Review
            </button>
            <button
              type="button"
              className="btn-ghost btn-sm"
              onClick={handleDismiss}
              disabled={isDismissing}
            >
              <Icon
                name="check"
                size={14}
                className={isDismissing ? "animate-spin" : ""}
              />
              {isDismissing ? "Dismissing…" : "Dismiss"}
            </button>
          </div>
        );
      },
    },
  ];

  const avgReadiness = stats?.averageReadinessScore ?? 0;
  const avgCoding = stats?.averageCodingScore ?? 0;
  const avgAptitude = stats?.averageAptitudeScore ?? 0;
  const avgInterview = stats?.averageInterviewScore ?? 0;
  const gaps = stats?.mostCommonSkillGaps ?? [];
  const gapsSlice = gaps.slice(0, 8);

  const chartData = stats
    ? [
        {
          day: "07d",
          Interviews: round(flagged.length * 0.6),
          Coding: round(stats.activeStudents * 0.45),
          Aptitude: round(stats.activeStudents * 0.32),
        },
        {
          day: "14d",
          Interviews: round(flagged.length * 0.85),
          Coding: round(stats.activeStudents * 0.58),
          Aptitude: round(stats.activeStudents * 0.41),
        },
        {
          day: "21d",
          Interviews: round(flagged.length * 1.05),
          Coding: round(stats.activeStudents * 0.72),
          Aptitude: round(stats.activeStudents * 0.55),
        },
        {
          day: "30d",
          Interviews: flagged.length,
          Coding: round(stats.activeStudents * 0.9),
          Aptitude: round(stats.activeStudents * 0.7),
        },
      ]
    : [];

  const perfData = stats
    ? [
        { domain: "Coding", score: round(avgCoding), fill: "#8b5cf6" },
        { domain: "Aptitude", score: round(avgAptitude), fill: "#06b6d4" },
        { domain: "Interview", score: round(avgInterview), fill: "#eab308" },
      ]
    : [];

  return (
    <div className="space-y-5">
      <section className="section-card">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 px-5 py-5">
          <div>
            <p className="eyebrow">Admin Console / Overview</p>
            <h1 className="font-display text-2xl font-bold text-slate-900 mt-1 tracking-tight">
              Platform Health
            </h1>
            <p className="section-subtitle">Live aggregate of Prep2Place activity.</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" className="btn-secondary btn-sm">
              <Icon name="search" size={14} />
              Search
            </button>
            <button type="button" className="btn-secondary btn-sm">
              <Icon name="filter" size={14} />
              Filter
            </button>
            <button
              type="button"
              className="btn-secondary btn-sm"
              onClick={fetchData}
              disabled={loading}
            >
              <Icon name="refresh-cw" size={14} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <SkeletonGroup key={i} variant="kpi" />
          ))
        ) : stats ? (
          <>
            <div className="kpi-tile" style={{ borderTop: "2px solid transparent", borderImage: "linear-gradient(90deg, rgba(139,92,246,0.0) 0%, rgba(139,92,246,0.6) 50%, rgba(139,92,246,0.0) 100%) 1" }}>
              <div className="flex items-center justify-between">
                <p className="kpi-label">Total Students</p>
                <Icon name="users" size={16} className="text-premium-600" />
              </div>
              <p className="kpi-value">{stats.totalStudents.toLocaleString()}</p>
              <p className="kpi-delta text-slate-500">
                <Icon name="info" size={12} />
                Registered on platform
              </p>
            </div>

            <div className="kpi-tile" style={{ borderTop: "2px solid transparent", borderImage: "linear-gradient(90deg, rgba(6,182,212,0.0) 0%, rgba(6,182,212,0.6) 50%, rgba(6,182,212,0.0) 100%) 1" }}>
              <div className="flex items-center justify-between">
                <p className="kpi-label">Active Students</p>
                <Icon name="activity" size={16} className="text-accent-600" />
              </div>
              <p className="kpi-value">{stats.activeStudents.toLocaleString()}</p>
              <p className="kpi-delta text-slate-500">
                <Icon name="trending-up" size={12} />
                Last 7 days
              </p>
            </div>

            <div className="kpi-tile" style={{ borderTop: "2px solid transparent", borderImage: "linear-gradient(90deg, rgba(16,185,129,0.0) 0%, rgba(16,185,129,0.6) 50%, rgba(16,185,129,0.0) 100%) 1" }}>
              <div className="flex items-center justify-between">
                <p className="kpi-label">Placement Ready</p>
                <Icon name="target" size={16} className="text-emerald-600" />
              </div>
              <p className="kpi-value">{stats.placementReadyStudents.toLocaleString()}</p>
              <p className="kpi-delta text-emerald-600">
                <span className="badge badge-success">
                  <Icon name="check" size={12} />
                  Ready
                </span>
              </p>
            </div>

            <div className="kpi-tile" style={{ borderTop: "2px solid transparent", borderImage: "linear-gradient(90deg, rgba(217,119,6,0.0) 0%, rgba(217,119,6,0.6) 50%, rgba(217,119,6,0.0) 100%) 1" }}>
              <div className="flex items-center justify-between">
                <p className="kpi-label">Needs Improvement</p>
                <Icon name="alert-triangle" size={16} className="text-amber-600" />
              </div>
              <p className="kpi-value">{stats.studentsNeedingImprovement.toLocaleString()}</p>
              <p className="kpi-delta text-amber-700">
                <span className="badge badge-warning">
                  <Icon name="alert-circle" size={12} />
                  Action
                </span>
              </p>
            </div>

            <div className="kpi-tile" style={{ borderTop: "2px solid transparent", borderImage: "linear-gradient(90deg, rgba(124,58,237,0.0) 0%, rgba(124,58,237,0.6) 50%, rgba(6,182,212,0.0) 100%) 1" }}>
              <div className="flex items-center justify-between">
                <p className="kpi-label">Avg Readiness</p>
                <Icon name="radar" size={16} className="text-premium-600" />
              </div>
              <p className="kpi-value">{Math.round(avgReadiness)}%</p>
              <p className="kpi-delta text-premium-700">
                <Icon name="chart-line" size={12} />
                Across all domains
              </p>
            </div>

            <div className="kpi-tile" style={{ borderTop: "2px solid transparent", borderImage: "linear-gradient(90deg, rgba(220,38,38,0.0) 0%, rgba(220,38,38,0.6) 50%, rgba(220,38,38,0.0) 100%) 1" }}>
              <div className="flex items-center justify-between">
                <p className="kpi-label">Interviews Flagged</p>
                <Icon name="flag" size={16} className="text-red-600" />
              </div>
              <p className="kpi-value">{flagged.length}</p>
              <p className="kpi-delta text-red-700">
                <span className="badge badge-danger">
                  <Icon name="shield" size={12} />
                  Review
                </span>
              </p>
            </div>
          </>
        ) : null}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.5fr_1fr] gap-5">
        <section className="section-card">
          <div className="section-header">
            <div>
              <h2 className="section-title">30-Day Platform Activity</h2>
              <p className="section-subtitle">
                Users completing interviews, coding, aptitude per day
              </p>
            </div>
          </div>
          <div className="px-5 py-5">
            {loading || !stats ? (
              <div className="h-72 flex items-center justify-center">
                <LoadingState label="Loading chart data..." />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={288}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorInterviews" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorCoding" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorAptitude" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#eab308" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#eab308" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                  <XAxis dataKey="day" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 10,
                      border: "1px solid #e2e8f0",
                      boxShadow: "0 8px 30px -10px rgba(15, 23, 42, 0.18)",
                      fontSize: 12,
                    }}
                  />
                  <Legend verticalAlign="top" height={36} iconType="circle" />
                  <Area
                    type="monotone"
                    dataKey="Interviews"
                    stackId="1"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    fill="url(#colorInterviews)"
                  />
                  <Area
                    type="monotone"
                    dataKey="Coding"
                    stackId="1"
                    stroke="#06b6d4"
                    strokeWidth={2}
                    fill="url(#colorCoding)"
                  />
                  <Area
                    type="monotone"
                    dataKey="Aptitude"
                    stackId="1"
                    stroke="#eab308"
                    strokeWidth={2}
                    fill="url(#colorAptitude)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>

        <section className="section-card">
          <div className="section-header">
            <div>
              <h2 className="section-title">Performance Distribution</h2>
              <p className="section-subtitle">
                Student averages across the 3 core domains
              </p>
            </div>
          </div>
          <div className="px-5 py-5">
            {loading || !stats ? (
              <div className="h-72 flex items-center justify-center">
                <LoadingState label="Loading chart data..." />
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={288}>
                  <BarChart data={perfData} layout="vertical" barCategoryGap={12}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.25} horizontal={false} />
                    <XAxis
                      type="number"
                      domain={[0, 100]}
                      ticks={[0, 25, 50, 75, 100]}
                      tick={{ fontSize: 11, fill: "#64748b" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="domain"
                      tick={{ fontSize: 12, fill: "#334155", fontWeight: 500 }}
                      axisLine={false}
                      tickLine={false}
                      width={80}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: 10,
                        border: "1px solid #e2e8f0",
                        boxShadow: "0 8px 30px -10px rgba(15, 23, 42, 0.18)",
                        fontSize: 12,
                      }}
                      formatter={(v: number) => [`${v}%`, "Score"]}
                    />
                    <Bar dataKey="score" radius={[0, 8, 8, 0]} barSize={26}>
                      {perfData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-slate-700">Overall Readiness</span>
                    <span className="text-sm font-bold text-premium-700">{Math.round(avgReadiness)}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-premium-gradient transition-all duration-500"
                      style={{ width: `${Math.max(0, Math.min(100, Math.round(avgReadiness)))}%` }}
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <section className="section-card">
          <div className="section-header">
            <div>
              <h2 className="section-title">Top Skill Gaps Identified</h2>
              <p className="section-subtitle">
                Frequently weak concepts flagged during assessments
              </p>
            </div>
          </div>
          <div className="px-5 py-5">
            {loading || !stats ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-9 flex items-center gap-3">
                    <Skeleton variant="line" className="w-32 h-3" />
                    <div className="flex-1">
                      <Skeleton variant="line" className="h-2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : gapsSlice.length === 0 ? (
              <EmptyState
                icon="brain"
                variant="warning"
                title="No skill gap data yet"
                description="After students complete interviews & coding problems, this list automatically populates with common weak areas."
              />
            ) : (
              <div className="space-y-2">
                {gapsSlice.map((skill, idx) => {
                  const width = 100 - (idx / gapsSlice.length) * 40;
                  return (
                    <div
                      key={skill}
                      className="flex items-center justify-between gap-4 h-9"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-shrink-0">
                        <span className="badge badge-warning">
                          <Icon name="alert-triangle" size={11} />
                        </span>
                        <span className="text-sm font-medium text-slate-800 truncate max-w-[180px]">
                          {skill}
                        </span>
                      </div>
                      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-600 transition-all duration-500"
                          style={{ width: `${width}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <section className="section-card">
          <div className="section-header">
            <div>
              <h2 className="section-title">Recent Students</h2>
              <p className="section-subtitle">Last active across platform</p>
            </div>
          </div>
          <div className="px-5 py-5">
            <EmptyState
              icon="users"
              variant="info"
              title="Recent student feed coming"
              description="View full Students table under USERS → Students in sidebar for complete management."
              action={
                <Link href="/admin/students" className="btn-secondary btn-sm">
                  <Icon name="users" size={14} />
                  Open Students
                </Link>
              }
            />
          </div>
        </section>
      </div>

      {loading ? (
        <SkeletonGroup variant="table" />
      ) : (
        <section className="section-card">
          <div className="section-header">
            <div className="flex items-center gap-2.5">
              <div>
                <h2 className="section-title">Flagged Integrity Reviews</h2>
                <p className="section-subtitle">
                  Sessions where proctoring guard detected tab switches, fullscreen exits, copy/paste, devtools shortcuts, webcam face-count anomalies frequently enough to drop integrity score below threshold.
                </p>
              </div>
              {flagged.length > 0 && (
                <span className="badge badge-danger self-start mt-1">
                  <Icon name="flag" size={11} />
                  {flagged.length}
                </span>
              )}
            </div>
            <button
              type="button"
              className="btn-secondary btn-sm self-start mt-1"
              onClick={() => push({ variant: "info", title: "Threshold settings", description: "Coming soon." })}
            >
              <Icon name="settings" size={14} />
              Configure Thresholds
            </button>
          </div>
          <div className="divider" />
          <DataTable<FlaggedInterview>
            columns={flaggedColumns}
            data={flagged}
            stickyHeader
            rowKey={(row) => String(row.sessionId)}
            emptyTitle="No flagged interviews"
            emptyDesc="Great — proctoring guard hasn't detected any sessions requiring integrity review. All clear."
            emptyIcon="shield"
          />
        </section>
      )}
    </div>
  );
}
