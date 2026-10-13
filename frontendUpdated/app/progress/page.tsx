"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import ErrorState from "@/components/ErrorState";
import { Icon } from "@/components/ui/Icon";
import { Skeleton, SkeletonGroup } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend,
} from "recharts";
import { z } from "zod";

const SectionStatsSchema = z.object({
  attempted: z.number().default(0),
  correct: z.number().default(0),
  totalAvailable: z.number().default(100),
  scorePct: z.number().default(0),
});
const CategoryBreakdownSchema = z.object({
  dsa: SectionStatsSchema.default({ attempted: 0, correct: 0, totalAvailable: 100, scorePct: 0 }),
  sql: SectionStatsSchema.default({ attempted: 0, correct: 0, totalAvailable: 100, scorePct: 0 }),
  dataframe: SectionStatsSchema.default({ attempted: 0, correct: 0, totalAvailable: 100, scorePct: 0 }),
  techMcq: SectionStatsSchema.default({ attempted: 0, correct: 0, totalAvailable: 100, scorePct: 0 }),
  aptitude: SectionStatsSchema.default({ attempted: 0, correct: 0, totalAvailable: 100, scorePct: 0 }),
});
const MilestoneSchema = z.object({
  name: z.string(),
  done: z.boolean().default(false),
  targetDate: z.string().optional(),
});
const GoalResponseSchema = z.object({
  targetRole: z.string().default("Not Set"),
  targetCompanies: z.array(z.string()).default([]),
  progressPct: z.number().default(0),
  milestones: z.array(MilestoneSchema).default([]),
});
const DayActivitySchema = z.object({
  day: z.string(),
  mocktestCount: z.number().default(0),
  interviewCount: z.number().default(0),
  questionsSolved: z.number().default(0),
  minutesSpent: z.number().default(0),
});
const ActivityResponseSchema = z.object({
  weekStart: z.string().default(""),
  days: z.array(DayActivitySchema).default([]),
});
const SummaryResponseSchema = z.object({
  totalAttempted: z.number().default(0),
  totalCorrect: z.number().default(0),
  accuracyPct: z.number().default(0),
  streakDays: z.number().default(0),
  minutesSpent: z.number().default(0),
  interviewsCompleted: z.number().default(0),
});

interface Submission { submissionId: number; problemTitle: string; verdict: string; score: number; submittedAt: string; }
interface AptitudeAttempt { attemptId: number; questionId: number; correct: boolean; }
interface InterviewSessionSummary { sessionId: number; status: string; roleTitle: string; createdAt: string; }
type SectionStats = z.infer<typeof SectionStatsSchema>;
type CategoryBreakdown = z.infer<typeof CategoryBreakdownSchema>;
type Milestone = z.infer<typeof MilestoneSchema>;
type GoalResponse = z.infer<typeof GoalResponseSchema>;
type DayActivity = z.infer<typeof DayActivitySchema>;
type ActivityResponse = z.infer<typeof ActivityResponseSchema>;
type SummaryResponse = z.infer<typeof SummaryResponseSchema>;

const VERDICT_BADGE: Record<string, string> = {
  Accepted: "badge-success",
  "Wrong Answer": "badge-danger",
  "Time Limit Exceeded": "badge-warning",
  "Runtime Error": "badge-danger",
  Compilation: "badge-danger",
  Partial: "badge-warning",
  Pending: "badge-neutral",
};

const STATUS_BADGE: Record<string, string> = {
  COMPLETED: "badge-success",
  IN_PROGRESS: "badge-primary",
  PAUSED: "badge-warning",
  RESUMABLE: "badge-warning",
  EXITED: "badge-danger",
  SUBMITTED: "badge-accent",
  REPORT_READY: "badge-gold",
};

const ZERO_STATS: SectionStats = { attempted: 0, correct: 0, totalAvailable: 100, scorePct: 0 };
const ZERO_BREAKDOWN: CategoryBreakdown = { dsa: ZERO_STATS, sql: ZERO_STATS, dataframe: ZERO_STATS, techMcq: ZERO_STATS, aptitude: ZERO_STATS };
const ZERO_GOAL: GoalResponse = { targetRole: "Not Set", targetCompanies: [], progressPct: 0, milestones: [] };
const ZERO_SUMMARY: SummaryResponse = { totalAttempted: 0, totalCorrect: 0, accuracyPct: 0, streakDays: 0, minutesSpent: 0, interviewsCompleted: 0 };

const CATEGORY_META: Record<keyof CategoryBreakdown, { label: string; icon: string; color: string; gradient: string; }> = {
  dsa: { label: "DSA / Coding", icon: "code", color: "#7c3aed", gradient: "from-premium-500 to-indigo-500" },
  sql: { label: "SQL", icon: "database", color: "#0ea5e9", gradient: "from-sky-500 to-blue-500" },
  dataframe: { label: "DataFrame", icon: "table", color: "#10b981", gradient: "from-emerald-500 to-teal-500" },
  techMcq: { label: "Technical MCQ", icon: "brain", color: "#8b5cf6", gradient: "from-violet-500 to-fuchsia-500" },
  aptitude: { label: "Aptitude", icon: "calculator", color: "#f59e0b", gradient: "from-amber-500 to-orange-500" },
};

export default function ProgressPage() {
  const [coding, setCoding] = useState<Submission[]>([]);
  const [aptitude, setAptitude] = useState<AptitudeAttempt[]>([]);
  const [interviews, setInterviews] = useState<InterviewSessionSummary[]>([]);
  const [breakdown, setBreakdown] = useState<CategoryBreakdown>(ZERO_BREAKDOWN);
  const [goal, setGoal] = useState<GoalResponse>(ZERO_GOAL);
  const [activity, setActivity] = useState<ActivityResponse | null>(null);
  const [summary, setSummary] = useState<SummaryResponse>(ZERO_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.allSettled([
      api.get<Submission[]>("/api/coding/history"),
      api.get<AptitudeAttempt[]>("/api/aptitude/history"),
      api.get<InterviewSessionSummary[]>("/api/interviews/history"),
      api.get<unknown>("/api/progress/breakdown"),
      api.get<unknown>("/api/progress/goal"),
      api.get<unknown>("/api/progress/activity"),
      api.get<unknown>("/api/progress/summary"),
    ]).then((results) => {
      const [cRes, aRes, iRes, bdRes, glRes, acRes, smRes] = results;
      if (cRes.status === "fulfilled") setCoding(cRes.value);
      if (aRes.status === "fulfilled") setAptitude(aRes.value);
      if (iRes.status === "fulfilled") setInterviews(iRes.value);
      if (bdRes.status === "fulfilled") {
        const parsed = CategoryBreakdownSchema.safeParse(bdRes.value);
        setBreakdown(parsed.success ? parsed.data : ZERO_BREAKDOWN);
      }
      if (glRes.status === "fulfilled") {
        const parsed = GoalResponseSchema.safeParse(glRes.value);
        setGoal(parsed.success ? parsed.data : ZERO_GOAL);
      }
      if (acRes.status === "fulfilled") {
        const parsed = ActivityResponseSchema.safeParse(acRes.value);
        if (parsed.success) setActivity(parsed.data);
      }
      if (smRes.status === "fulfilled") {
        const parsed = SummaryResponseSchema.safeParse(smRes.value);
        setSummary(parsed.success ? parsed.data : ZERO_SUMMARY);
      }
    })
      .catch((e) => setError(e instanceof ApiError ? e.message : "Failed to load progress"))
      .finally(() => setLoading(false));
  }, []);

  const aptitudeAccuracy = aptitude.length ? Math.round((aptitude.filter((a) => a.correct).length / aptitude.length) * 100) : 0;

  const submissionTimeline = useMemo(() => {
    const byDate = new Map<string, number>();
    coding.forEach((s) => {
      if (!s.submittedAt) return;
      const key = new Date(s.submittedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" });
      byDate.set(key, (byDate.get(key) ?? 0) + 1);
    });
    return Array.from(byDate.entries()).map(([date, count]) => ({ date, Submissions: count }));
  }, [coding]);

  const verdictBreakdown = useMemo(() => {
    const counts = new Map<string, number>();
    coding.forEach((c) => counts.set(c.verdict, (counts.get(c.verdict) ?? 0) + 1));
    return Array.from(counts.entries()).map(([verdict, count]) => ({ verdict, count }));
  }, [coding]);

  const totalAttempted = useMemo(() => (Object.keys(breakdown) as (keyof CategoryBreakdown)[])
    .reduce((sum, k) => sum + (breakdown[k]?.attempted ?? 0), 0), [breakdown]);
  const totalCorrect = useMemo(() => (Object.keys(breakdown) as (keyof CategoryBreakdown)[])
    .reduce((sum, k) => sum + (breakdown[k]?.correct ?? 0), 0), [breakdown]);
  const overallAccuracy = totalAttempted > 0 ? Math.round((totalCorrect / totalAttempted) * 100) : 0;

  const streakDays = useMemo(() => {
    const dates = new Set<string>();
    coding.forEach((s) => { if (s.submittedAt) dates.add(new Date(s.submittedAt).toDateString()); });
    aptitude.forEach((a) => { const d = new Date(); dates.add(d.toDateString()); });
    let streak = 0;
    let d = new Date();
    while (dates.has(d.toDateString())) { streak++; d.setDate(d.getDate() - 1); }
    return streak;
  }, [coding, aptitude]);

  const weeklyActivityChart = useMemo(() => {
    if (!activity?.days?.length) return [];
    return activity.days.map((d) => ({
      day: d.day,
      Questions: d.questionsSolved,
      "Mock Tests": d.mocktestCount,
      Interviews: d.interviewCount,
    }));
  }, [activity]);

  const categoryRows = useMemo(() => (
    (Object.keys(CATEGORY_META) as (keyof CategoryBreakdown)[]).map((key) => ({
      key,
      ...CATEGORY_META[key],
      stats: breakdown[key] ?? ZERO_STATS,
    }))
  ), [breakdown]);

  if (loading) {
    return (
      <div className="w-full space-y-5 pb-8">
        <div className="surface-card p-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="space-y-1">
              <Skeleton variant="line" className="w-48 h-5" />
              <Skeleton variant="line" className="w-80 h-4" />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <SkeletonGroup variant="kpi" />
          <SkeletonGroup variant="kpi" />
          <SkeletonGroup variant="kpi" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <SkeletonGroup variant="card" />
          <SkeletonGroup variant="card" />
        </div>
        <SkeletonGroup variant="table" />
        <SkeletonGroup variant="list" />
      </div>
    );
  }
  if (error) return <ErrorState message={error} />;

  return (
    <div className="w-full space-y-5 pb-8">
      <div className="surface-card p-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-display text-xl font-bold tracking-tight text-slate-950">
              Progress History
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Track your coding submissions, aptitude attempts, and mock interviews
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="badge badge-gold">
              <Icon name="zap" size={14} />
              {streakDays} day{streakDays === 1 ? "" : "s"} streak
            </span>
            <span className="badge badge-primary">
              <Icon name="activity" size={14} />
              Live Updates
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="kpi-tile">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="kpi-label">Current Streak</div>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="kpi-value">{streakDays}</span>
                <span className="text-sm text-slate-500">days</span>
              </div>
              <div className="kpi-delta mt-2">
                <Icon name="zap" size={12} className="text-amber-600" />
                <span className="text-slate-600">
                  {streakDays === 0 ? "Start a streak today" : "Keep the momentum going"}
                </span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 flex-shrink-0">
              <Icon name="zap" size={20} />
            </div>
          </div>
          <div className="mt-3">
            <span className="badge badge-gold !text-[10px] !px-2 !py-0.5">
              {streakDays === 0 ? "No streak yet" : `${streakDays} day${streakDays === 1 ? "" : "s"}`}
            </span>
          </div>
        </div>

        <div className="kpi-tile">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="kpi-label">Questions Attempted</div>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="kpi-value">{totalAttempted}</span>
              </div>
              <div className="kpi-delta mt-2">
                <Icon name="target" size={12} className="text-premium-600" />
                <span className="text-slate-600">Across all 5 categories</span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-premium-50 border border-premium-100 flex items-center justify-center text-premium-600 flex-shrink-0">
              <Icon name="target" size={20} />
            </div>
          </div>
          <div className="mt-3">
            <span className="badge badge-primary !text-[10px] !px-2 !py-0.5">
              {totalCorrect} correct
            </span>
          </div>
        </div>

        <div className="kpi-tile">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="kpi-label">Overall Accuracy</div>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="kpi-value">{overallAccuracy}</span>
                <span className="badge badge-success !px-1.5 !py-0.5 text-[10px]">%</span>
              </div>
              <div className="kpi-delta mt-2">
                <Icon name="check-circle" size={12} className="text-emerald-600" />
                <span className="text-slate-600">
                  {totalAttempted === 0 ? "Build accuracy with practice" : `${totalCorrect}/${totalAttempted} correct`}
                </span>
              </div>
            </div>
            <div
              className={`w-10 h-10 rounded-xl border flex items-center justify-center flex-shrink-0 ${
                overallAccuracy >= 75
                  ? "bg-emerald-50 border-emerald-100 text-emerald-600"
                  : overallAccuracy >= 50
                  ? "bg-amber-50 border-amber-100 text-amber-600"
                  : "bg-red-50 border-red-100 text-red-600"
              }`}
            >
              <Icon name="check-circle" size={20} />
            </div>
          </div>
          <div className="mt-3">
            <span
              className={`badge !text-[10px] !px-2 !py-0.5 ${
                overallAccuracy >= 75 ? "badge-success" : overallAccuracy >= 50 ? "badge-warning" : "badge-danger"
              }`}
            >
              {overallAccuracy >= 75 ? "Great work" : overallAccuracy >= 50 ? "Keep going" : "Room to improve"}
            </span>
          </div>
        </div>

        <div className="kpi-tile">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="kpi-label">Coding Submissions</div>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="kpi-value">{coding.length}</span>
              </div>
              <div className="kpi-delta mt-2">
                <Icon name="code" size={12} className="text-premium-600" />
                <span className="text-slate-600">
                  {coding.length === 0 ? "Start solving problems" : "Submissions tracked"}
                </span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-premium-50 border border-premium-100 flex items-center justify-center text-premium-600 flex-shrink-0">
              <Icon name="code" size={20} />
            </div>
          </div>
          <div className="mt-3">
            <span className="badge badge-primary !text-[10px] !px-2 !py-0.5">
              {coding.length === 0 ? "No submissions yet" : `${coding.length} total`}
            </span>
          </div>
        </div>

        <div className="kpi-tile">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="kpi-label">Aptitude Accuracy</div>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="kpi-value">{aptitudeAccuracy}</span>
                <span className="badge badge-success !px-1.5 !py-0.5 text-[10px]">%</span>
              </div>
              <div className="kpi-delta mt-2">
                <Icon name="calculator" size={12} className="text-accent-600" />
                <span className="text-slate-600">
                  {aptitude.length === 0
                    ? "Attempt questions to score"
                    : `Across ${aptitude.length} attempts`}
                </span>
              </div>
            </div>
            <div
              className={`w-10 h-10 rounded-xl border flex items-center justify-center flex-shrink-0 ${
                aptitudeAccuracy >= 75
                  ? "bg-emerald-50 border-emerald-100 text-emerald-600"
                  : aptitudeAccuracy >= 50
                  ? "bg-amber-50 border-amber-100 text-amber-600"
                  : "bg-red-50 border-red-100 text-red-600"
              }`}
            >
              <Icon name="brain" size={20} />
            </div>
          </div>
          <div className="mt-3">
            <span
              className={`badge !text-[10px] !px-2 !py-0.5 ${
                aptitudeAccuracy >= 75
                  ? "badge-success"
                  : aptitudeAccuracy >= 50
                  ? "badge-warning"
                  : "badge-danger"
              }`}
            >
              {aptitude.length === 0 ? "No attempts yet" : `${aptitudeAccuracy}% correct`}
            </span>
          </div>
        </div>

        <div className="kpi-tile">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="kpi-label">Interviews</div>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="kpi-value">{interviews.length}</span>
              </div>
              <div className="kpi-delta mt-2">
                <Icon name="mic" size={12} className="text-amber-600" />
                <span className="text-slate-600">
                  {interviews.length === 0 ? "Start a mock interview" : "Sessions recorded"}
                </span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 flex-shrink-0">
              <Icon name="briefcase" size={20} />
            </div>
          </div>
          <div className="mt-3">
            <span className="badge badge-gold !text-[10px] !px-2 !py-0.5">
              {interviews.length === 0 ? "No sessions yet" : `${interviews.length} total`}
            </span>
          </div>
        </div>
      </div>

      <div className="section-card">
        <div className="section-header">
          <div>
            <h2 className="section-title flex items-center gap-2">
              <Icon name="layers" size={18} className="text-premium-600" />
              Category Progress
            </h2>
            <p className="section-subtitle">Performance across every learning module</p>
          </div>
        </div>
        <div className="p-5 space-y-5">
          {categoryRows.length === 0 ? (
            <EmptyState
              icon="layers"
              variant="neutral"
              title="No progress data yet"
              description="Start attempting questions to see your per-category progress here."
            />
          ) : (
            categoryRows.map(({ key, label, icon, color, stats }) => {
              const pct = Math.max(0, Math.min(100, stats.scorePct ?? 0));
              return (
                <div key={key}>
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                        <Icon name={icon as any} size={16} />
                      </span>
                      <div className="min-w-0">
                        <div className="font-semibold text-sm text-slate-800 truncate">{label}</div>
                        <div className="text-xs text-slate-500">
                          Attempted: {stats.attempted ?? 0} · Correct: {stats.correct ?? 0}
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-display text-lg font-bold text-slate-900 tabular-nums">
                        {pct.toFixed(0)}
                        <span className="text-sm text-slate-500 font-normal">%</span>
                      </div>
                    </div>
                  </div>
                  <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500 ease-out"
                      style={{ width: `${pct}%`, backgroundColor: color }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="section-card">
          <div className="section-header">
            <div>
              <h2 className="section-title flex items-center gap-2">
                <Icon name="chart-line" size={18} className="text-premium-600" />
                Submission Timeline
              </h2>
              <p className="section-subtitle">Daily coding submissions over time</p>
            </div>
          </div>
          <div className="p-5">
            {submissionTimeline.length === 0 ? (
              <EmptyState
                icon="chart-line"
                variant="neutral"
                title="No submission history yet"
                description="Start solving coding problems to see your submission trends here."
              />
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={submissionTimeline}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#64748b" }} />
                    <YAxis tick={{ fontSize: 11, fill: "#64748b" }} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="Submissions"
                      stroke="#7c3aed"
                      strokeWidth={2.5}
                      dot={{ fill: "#7c3aed", r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>

        <div className="section-card">
          <div className="section-header">
            <div>
              <h2 className="section-title flex items-center gap-2">
                <Icon name="chart-bar" size={18} className="text-accent-600" />
                Verdict Breakdown
              </h2>
              <p className="section-subtitle">Coding submissions by outcome</p>
            </div>
          </div>
          <div className="p-5">
            {verdictBreakdown.length === 0 ? (
              <EmptyState
                icon="chart-bar"
                variant="neutral"
                title="No verdict data"
                description="Submit code to see a breakdown of your results by verdict."
              />
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={verdictBreakdown}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="verdict" tick={{ fontSize: 10, fill: "#64748b" }} />
                    <YAxis tick={{ fontSize: 11, fill: "#64748b" }} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }}
                    />
                    <Legend />
                    <Bar dataKey="count" name="Count" fill="#06b6d4" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="section-card">
          <div className="section-header">
            <div>
              <h2 className="section-title flex items-center gap-2">
                <Icon name="target" size={18} className="text-premium-600" />
                Placement Goal
              </h2>
              <p className="section-subtitle">Your target role and readiness progress</p>
            </div>
            <Link
              href="/profile"
              className="text-xs font-medium text-premium-700 hover:text-premium-800 hover:underline"
            >
              Edit goal
            </Link>
          </div>
          <div className="p-5 space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs text-slate-500 font-medium uppercase tracking-wider">Target Role</div>
                <div className="mt-1 font-display text-lg font-bold text-slate-900 truncate">
                  {goal.targetRole && goal.targetRole !== "Not Set" ? goal.targetRole : "No target role set"}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-xs text-slate-500 font-medium uppercase tracking-wider">Progress</div>
                <div className="mt-1 font-display text-lg font-bold text-premium-700 tabular-nums">
                  {goal.progressPct.toFixed(1)}%
                </div>
              </div>
            </div>
            <div>
              <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-premium-500 to-indigo-500 rounded-full transition-all duration-500"
                  style={{ width: `${Math.max(0, Math.min(100, goal.progressPct))}%` }}
                />
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-2">
                Target Companies
              </div>
              {!goal.targetCompanies?.length ? (
                <div className="text-sm text-slate-500 italic">
                  No target companies set yet.
                </div>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {goal.targetCompanies.slice(0, 8).map((c, i) => (
                    <span key={i} className="badge badge-neutral !text-[11px]">
                      {c}
                    </span>
                  ))}
                  {goal.targetCompanies.length > 8 && (
                    <span className="badge badge-neutral !text-[11px]">
                      +{goal.targetCompanies.length - 8} more
                    </span>
                  )}
                </div>
              )}
            </div>
            {goal.milestones?.length ? (
              <div>
                <div className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-2">
                  Milestones
                </div>
                <ul className="space-y-2">
                  {goal.milestones.map((m, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className={`mt-0.5 w-4 h-4 rounded-full border shrink-0 flex items-center justify-center ${
                        m.done ? "bg-emerald-500 border-emerald-500" : "border-slate-300"
                      }`}>
                        {m.done && <Icon name="check" size={10} className="text-white" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className={m.done ? "text-slate-600 line-through" : "text-slate-800 font-medium"}>
                          {m.name}
                        </div>
                        {m.targetDate && (
                          <div className="text-xs text-slate-500">Target: {m.targetDate}</div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>

        <div className="section-card">
          <div className="section-header">
            <div>
              <h2 className="section-title flex items-center gap-2">
                <Icon name="activity" size={18} className="text-accent-600" />
                Weekly Activity
              </h2>
              <p className="section-subtitle">
                {activity?.weekStart ? `Week of ${activity.weekStart}` : "Last 7 days"}
              </p>
            </div>
          </div>
          <div className="p-5">
            {weeklyActivityChart.length === 0 ? (
              <EmptyState
                icon="activity"
                variant="neutral"
                title="No activity this week"
                description="Questions solved, mock tests, and interviews will appear here."
              />
            ) : (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weeklyActivityChart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#64748b" }} />
                    <YAxis tick={{ fontSize: 11, fill: "#64748b" }} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }}
                    />
                    <Legend />
                    <Bar dataKey="Questions" fill="#7c3aed" radius={[6, 6, 0, 0]} stackId="a" />
                    <Bar dataKey="Mock Tests" fill="#06b6d4" radius={[6, 6, 0, 0]} stackId="b" />
                    <Bar dataKey="Interviews" fill="#f59e0b" radius={[6, 6, 0, 0]} stackId="c" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            {activity?.days?.length ? (
              <div className="mt-4 grid grid-cols-7 gap-2 text-center text-xs">
                {activity.days.map((d, i) => {
                  const total = d.questionsSolved + d.mocktestCount + d.interviewCount;
                  return (
                    <div key={i} className="space-y-1">
                      <div className="font-semibold text-slate-700">{d.day}</div>
                      <div className={`w-full h-1.5 rounded-full ${total > 0 ? "bg-premium-500" : "bg-slate-200"}`}
                        style={{ opacity: total > 0 ? Math.min(1, 0.25 + total * 0.15) : 1 }} />
                      <div className="text-slate-500 tabular-nums">{total}m</div>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="section-card">
        <div className="section-header">
          <div>
            <h2 className="section-title flex items-center gap-2">
              <Icon name="terminal" size={18} className="text-premium-600" />
              Coding Submission History
            </h2>
            <p className="section-subtitle">All coding problem attempts, latest first</p>
          </div>
        </div>
        {coding.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon="code"
              variant="info"
              title="No coding submissions yet"
              description="Solve coding problems in the mock tests section to build your history here."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Problem</th>
                  <th style={{ width: "140px" }}>Verdict</th>
                  <th style={{ width: "100px" }}>Score</th>
                  <th style={{ width: "150px" }}>Date</th>
                </tr>
              </thead>
              <tbody>
                {coding.map((c) => (
                  <tr key={c.submissionId}>
                    <td>
                      <div className="font-semibold text-slate-800 text-sm truncate">
                        {c.problemTitle}
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${VERDICT_BADGE[c.verdict] ?? "badge-neutral"} !text-[11px]`}>
                        {c.verdict}
                      </span>
                    </td>
                    <td>
                      <span className="font-semibold text-sm tabular-nums text-slate-700">
                        {c.score}
                      </span>
                    </td>
                    <td>
                      <div className="text-xs text-slate-600">
                        <div className="font-medium">
                          {c.submittedAt ? new Date(c.submittedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "Not attempted"}
                        </div>
                        <div className="text-slate-400 mt-0.5">
                          {c.submittedAt ? new Date(c.submittedAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }) : ""}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="section-card">
        <div className="section-header">
          <div>
            <h2 className="section-title flex items-center gap-2">
              <Icon name="mic" size={18} className="text-amber-600" />
              Interview History
            </h2>
            <p className="section-subtitle">Your mock interview sessions</p>
          </div>
        </div>
        {interviews.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon="briefcase"
              variant="info"
              title="No interviews yet"
              description="Start a mock interview with Arya to practice and get personalized feedback."
            />
          </div>
        ) : (
          <div className="surface-card divide-y divide-slate-100">
            {interviews.map((s) => (
              <div key={s.sessionId} className="px-5 py-4 flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-slate-900 text-sm truncate">
                    {s.roleTitle || "General Interview"}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    <Icon name="clock" size={12} className="inline mr-1" />
                    {new Date(s.createdAt).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
                <span className={`badge ${STATUS_BADGE[s.status] ?? "badge-neutral"} !text-[11px] shrink-0`}>
                  {s.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
