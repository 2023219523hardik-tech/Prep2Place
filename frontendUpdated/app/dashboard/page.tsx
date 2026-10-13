"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Cell,
} from "recharts";
import { api, ApiError, redirectToLogin } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Skeleton, SkeletonGroup } from "@/components/ui/Skeleton";
import EmptyState from "@/components/ui/EmptyState";
import Icon, { IconName } from "@/components/ui/Icon";
import ScoreGauge from "@/components/ScoreGauge";

interface DashboardData {
  studentName: string;
  readinessScore: number;
  readinessLevel: string;
  avgCodingScore: number;
  avgAptitudeScore: number;
  avgInterviewScore: number;
  totalInterviews: number;
  totalCodingSubmissions: number;
  totalAptitudeAttempts: number;
  skillBreakdown: Record<string, number>;
  recentActivity: { type: string; description: string; timestamp: string }[];
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      redirectToLogin("/dashboard");
      return;
    }
    api.get<DashboardData>("/api/dashboard")
      .then(setData)
      .catch((e) => {
        const isAuthError =
          (e instanceof ApiError && (e.status === 401 || e.status === 403)) ||
          e?.message?.toLowerCase().includes("authentication") ||
          e?.message?.toLowerCase().includes("token") ||
          e?.message?.toLowerCase().includes("jwt");
        if (isAuthError) {
          redirectToLogin("/dashboard");
          return;
        }
        setError(e instanceof ApiError ? e.message : "Failed to load dashboard");
      })
      .finally(() => setLoading(false));
  }, [authLoading, user, router]);

  if (authLoading || loading) {
    return <DashboardLoadingState />;
  }
  if (error) return <DashboardErrorState message={error} />;
  if (!data) return null;

  const firstName = data.studentName.split(" ")[0];
  const initials = data.studentName
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const quickLinks: QuickLink[] = [
    {
      href: "/coding",
      title: "Coding Practice",
      desc: "Solve DSA problems",
      stat: `${data.totalCodingSubmissions} submissions`,
      icon: "code",
      gradient: "from-premium-500 to-indigo-500",
      bg: "from-premium-50 to-white",
      border: "border-premium-100",
      badge: "bg-premium-500/10 text-premium-700",
    },
    {
      href: "/aptitude",
      title: "Aptitude",
      desc: "Quant, logical & verbal",
      stat: `${data.totalAptitudeAttempts} attempts`,
      icon: "calculator",
      gradient: "from-accent-500 to-cyan-500",
      bg: "from-accent-50 to-white",
      border: "border-accent-100",
      badge: "bg-accent-500/10 text-accent-700",
    },
    {
      href: "/dashboard/technical-mcq",
      title: "Technical MCQ Practice",
      desc: "DSA, CS fundamentals & concept checks",
      stat: "Practice now",
      icon: "brain",
      gradient: "from-violet-500 to-fuchsia-500",
      bg: "from-violet-50 to-white",
      border: "border-violet-100",
      badge: "bg-violet-500/10 text-violet-700",
    },
    {
      href: "/coding?mode=SQL",
      title: "SQL Practice",
      desc: "Database queries & joins",
      stat: "Practice now",
      icon: "database",
      gradient: "from-teal-500 to-emerald-500",
      bg: "from-teal-50 to-white",
      border: "border-teal-100",
      badge: "bg-teal-500/10 text-teal-700",
    },
    {
      href: "/coding?mode=DATAFRAME",
      title: "DataFrame Practice",
      desc: "Pandas / DataFrame manipulation",
      stat: "Practice now",
      icon: "table",
      gradient: "from-violet-500 to-purple-500",
      bg: "from-violet-50 to-white",
      border: "border-violet-100",
      badge: "bg-violet-500/10 text-violet-700",
    },
    {
      href: "/interview",
      title: "Mock Interview",
      desc: "AI-evaluated practice interviews",
      stat: `${data.totalInterviews} interviews`,
      icon: "mic",
      gradient: "from-gold-500 to-amber-500",
      bg: "from-amber-50 to-white",
      border: "border-amber-100",
      badge: "bg-gold-500/10 text-amber-700",
    },
  ];

  const activityBadgeTone: Record<string, string> = {
    CODING: "badge-primary",
    APTITUDE: "badge-accent",
    INTERVIEW: "badge-gold",
    SUBMISSION: "badge-primary",
    TECHNICAL_MCQ: "bg-violet-50 text-violet-700 border border-violet-100",
    MANAGED_TEST: "bg-violet-50 text-violet-700 border border-violet-100",
  };

  return (
    <div className="space-y-5 animate-slide-up">
      <WelcomeBanner
        firstName={firstName}
        initials={initials}
        readinessScore={data.readinessScore}
        readinessLevel={data.readinessLevel}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiTile
          label="Readiness Score"
          value={data.readinessScore}
          deltaLabel={data.readinessLevel}
          deltaTrend={data.readinessScore >= 50 ? "up" : "down"}
          badgeTone={
            data.readinessScore >= 75
              ? "badge-success"
              : data.readinessScore >= 50
              ? "badge-warning"
              : "badge-danger"
          }
        />
        <KpiTile
          label="Coding Avg"
          value={data.avgCodingScore}
          deltaLabel={data.avgCodingScore >= 50 ? "On track" : "Needs work"}
          deltaTrend={data.avgCodingScore >= 50 ? "up" : "down"}
          badgeTone="badge-primary"
        />
        <KpiTile
          label="Aptitude Avg"
          value={data.avgAptitudeScore}
          deltaLabel={data.avgAptitudeScore >= 50 ? "On track" : "Needs work"}
          deltaTrend={data.avgAptitudeScore >= 50 ? "up" : "down"}
          badgeTone="badge-accent"
        />
        <KpiTile
          label="Interview Avg"
          value={data.avgInterviewScore}
          deltaLabel={data.avgInterviewScore >= 50 ? "On track" : "Needs work"}
          deltaTrend={data.avgInterviewScore >= 50 ? "up" : "down"}
          badgeTone="badge-gold"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-5">
        <SkillBreakdownCard skillBreakdown={data.skillBreakdown} />
        <RecommendedStepsCard quickLinks={quickLinks} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.25fr_1fr] gap-5">
        <RecentActivityCard
          recentActivity={data.recentActivity}
          activityBadgeTone={activityBadgeTone}
          firstName={firstName}
        />
        <QuickStatsCard
          totalInterviews={data.totalInterviews}
          totalCodingSubmissions={data.totalCodingSubmissions}
          totalAptitudeAttempts={data.totalAptitudeAttempts}
        />
      </div>
    </div>
  );
}

function DashboardLoadingState() {
  return (
    <div className="space-y-5 animate-slide-up">
      <div className="surface-card overflow-hidden">
        <div className="py-4 px-5 md:px-6 md:py-5">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-start gap-4">
              <Skeleton variant="circle" className="w-12 h-12 flex-shrink-0" />
              <div className="space-y-2 pt-1">
                <Skeleton variant="line" className="w-28 h-3" />
                <Skeleton variant="line" className="w-48 h-5" />
                <div className="flex gap-2 pt-1">
                  <Skeleton variant="line" className="w-28 h-8 rounded-lg" />
                  <Skeleton variant="line" className="w-28 h-8 rounded-lg" />
                </div>
              </div>
            </div>
            <Skeleton variant="circle" className="w-28 h-28 flex-shrink-0" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SkeletonGroup variant="kpi" />
        <SkeletonGroup variant="kpi" />
        <SkeletonGroup variant="kpi" />
        <SkeletonGroup variant="kpi" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-5">
        <SkeletonGroup variant="card" />
        <SkeletonGroup variant="card" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.25fr_1fr] gap-5">
        <SkeletonGroup variant="card" />
        <SkeletonGroup variant="card" />
      </div>
    </div>
  );
}

function DashboardErrorState({ message }: { message: string }) {
  const isAuth =
    message.toLowerCase().includes("authentication") ||
    message.toLowerCase().includes("token") ||
    message.toLowerCase().includes("login") ||
    message.toLowerCase().includes("unauthorized");

  useEffect(() => {
    if (isAuth) {
      const timer = setTimeout(() => {
        redirectToLogin("/dashboard");
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [isAuth]);

  return (
    <div className="surface-card p-8 text-center max-w-lg mx-auto my-12 border border-slate-200 shadow-sm rounded-2xl">
      <div className="w-14 h-14 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center mx-auto text-red-600">
        <Icon name="alert-circle" size={28} strokeWidth={1.75} />
      </div>
      <h3 className="font-display text-base font-semibold mt-4 text-slate-900">
        {isAuth ? "Session Expired" : "Failed to load dashboard"}
      </h3>
      <p className="text-sm text-slate-500 mt-1.5 max-w-md mx-auto leading-relaxed">
        {isAuth
          ? "Your login session has expired or requires re-authentication. Redirecting you to login..."
          : message}
      </p>
      <div className="mt-6 flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => redirectToLogin("/dashboard")}
          className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 transition"
        >
          Go to Login Page
        </button>
        {!isAuth && (
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
          >
            Retry
          </button>
        )}
      </div>
    </div>
  );
}

interface WelcomeBannerProps {
  firstName: string;
  initials: string;
  readinessScore: number;
  readinessLevel: string;
}

function WelcomeBanner({ firstName, initials, readinessScore, readinessLevel }: WelcomeBannerProps) {
  return (
    <div className="relative rounded-xl overflow-hidden shadow-soft border border-premium-200/50">
      <div className="absolute inset-0 bg-premium-gradient" />
      <div className="absolute inset-0 opacity-25">
        <div className="absolute -top-10 -right-10 w-56 h-56 rounded-full bg-white/20 blur-2xl" />
        <div className="absolute -bottom-14 -left-8 w-64 h-64 rounded-full bg-accent-400/30 blur-2xl" />
      </div>

      <div className="relative py-4 px-5 md:px-6 md:py-5 text-white">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="shrink-0 w-12 h-12 rounded-xl bg-white/15 backdrop-blur-sm border border-white/20 flex items-center justify-center text-xl font-bold shadow-lg ring-2 ring-white/10">
              {initials}
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 backdrop-blur-sm border border-white/15 text-[10px] font-bold uppercase tracking-wider mb-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-gold-400 animate-pulse" />
                Live Dashboard
              </div>
              <h1 className="font-display font-bold text-lg md:text-xl tracking-tight leading-tight">
                Welcome back, <span className="text-gold-400">{firstName}</span>
                <span className="text-white/70">.</span>
              </h1>
              <div className="flex gap-2 mt-3">
                <Link
                  href="/readiness"
                  className="inline-flex items-center gap-1.5 bg-white/15 backdrop-blur-sm border border-white/20 hover:bg-white/25 text-white font-semibold px-3.5 py-2 rounded-lg transition-all text-sm"
                >
                  <Icon name="chart-bar" size={14} />
                  View Full Report
                </Link>
                <Link
                  href="/coding"
                  className="inline-flex items-center gap-1.5 bg-white text-premium-700 hover:bg-gold-400 hover:text-ink-900 font-bold px-3.5 py-2 rounded-lg transition-all shadow-md text-sm"
                >
                  <Icon name="play" size={14} />
                  Start Practicing
                </Link>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0 self-start md:self-center">
            <div className="flex flex-col items-center">
              <span className="kpi-label !text-white/70 !mb-1">Placement Readiness</span>
              <ScoreGauge score={readinessScore} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface KpiTileProps {
  label: string;
  value: number;
  deltaLabel: string;
  deltaTrend: "up" | "down";
  badgeTone: string;
}

function KpiTile({ label, value, deltaLabel, deltaTrend, badgeTone }: KpiTileProps) {
  const pct = Math.min(100, Math.max(0, Math.round(value)));
  return (
    <div className="kpi-tile">
      <div className="kpi-label">{label}</div>
      <div className="flex items-baseline gap-2 mt-1">
        <span className="kpi-value">{pct}</span>
        <span className={`badge ${badgeTone} !px-1.5 !py-0.5 text-[10px]`}>%</span>
      </div>
      <div className="kpi-delta">
        <Icon
          name={deltaTrend === "up" ? "trending-up" : "trending-down"}
          size={12}
          className={deltaTrend === "up" ? "text-emerald-600" : "text-red-500"}
        />
        <span className={deltaTrend === "up" ? "text-emerald-600" : "text-red-500"}>
          {deltaLabel}
        </span>
      </div>
    </div>
  );
}

interface SkillBreakdownCardProps {
  skillBreakdown: Record<string, number>;
}

function SkillBreakdownCard({ skillBreakdown }: SkillBreakdownCardProps) {
  const radarData = useMemo(() => {
    return Object.entries(skillBreakdown).map(([skill, score]) => ({
      skill,
      score: Math.min(100, Math.max(0, Math.round(score))),
      fullMark: 100,
    }));
  }, [skillBreakdown]);

  const barData = useMemo(() => {
    return [...radarData].sort((a, b) => b.score - a.score);
  }, [radarData]);

  const barColors = [
    "#7c3aed",
    "#06b6d4",
    "#f59e0b",
    "#10b981",
    "#ef4444",
    "#8b5cf6",
    "#0ea5e9",
    "#ec4899",
    "#14b8a6",
    "#f97316",
  ];

  return (
    <div className="section-card">
      <div className="section-header">
        <div>
          <h2 className="section-title flex items-center gap-2">
            <Icon name="radar" size={18} className="text-premium-600" />
            Skill Breakdown Performance
          </h2>
          <p className="section-subtitle">Strengths and gaps across your preparation domains</p>
        </div>
      </div>
      <div className="p-5">
        {radarData.length === 0 ? (
          <EmptyState
            icon="target"
            variant="info"
            title="No skill data yet"
            description="Complete practice modules to see your skill breakdown mapped here."
          />
        ) : (
          <div className="space-y-5">
            <div className="w-full h-64">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
                  <PolarGrid stroke="#e2e8f0" />
                  <PolarAngleAxis
                    dataKey="skill"
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    tickLine={false}
                  />
                  <PolarRadiusAxis
                    angle={90}
                    domain={[0, 100]}
                    tick={{ fontSize: 10, fill: "#94a3b8" }}
                    axisLine={false}
                    tickCount={5}
                  />
                  <Radar
                    name="Score"
                    dataKey="score"
                    stroke="#7c3aed"
                    fill="#7c3aed"
                    fillOpacity={0.28}
                    strokeWidth={2}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 10,
                      border: "1px solid #e2e8f0",
                      boxShadow: "0 4px 14px -6px rgba(15,23,42,0.12)",
                      fontSize: 13,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            {radarData.length > 8 && (
              <div>
                <div className="divider mb-4" />
                <div className="w-full h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis
                        dataKey="skill"
                        tick={{ fontSize: 11, fill: "#64748b" }}
                        axisLine={false}
                        tickLine={false}
                        angle={-35}
                        textAnchor="end"
                        height={60}
                      />
                      <YAxis
                        domain={[0, 100]}
                        tick={{ fontSize: 10, fill: "#94a3b8" }}
                        axisLine={false}
                        tickLine={false}
                        tickCount={5}
                      />
                      <Tooltip
                        contentStyle={{
                          borderRadius: 10,
                          border: "1px solid #e2e8f0",
                          boxShadow: "0 4px 14px -6px rgba(15,23,42,0.12)",
                          fontSize: 13,
                        }}
                      />
                      <Bar dataKey="score" name="Score" radius={[6, 6, 0, 0]}>
                        {barData.map((_, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={barColors[index % barColors.length]}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

interface QuickLink {
  href: string;
  title: string;
  desc: string;
  stat: string;
  icon: IconName;
  gradient: string;
  bg: string;
  border: string;
  badge: string;
}

function RecommendedStepsCard({ quickLinks }: { quickLinks: QuickLink[] }) {
  return (
    <div className="section-card">
      <div className="section-header">
        <div>
          <h2 className="section-title flex items-center gap-2">
            <Icon name="sparkles" size={18} className="text-amber-500" />
            Recommended Next Steps
          </h2>
          <p className="section-subtitle">Pick one and keep momentum going</p>
        </div>
      </div>
      <div className="p-5 space-y-2">
        {quickLinks.map((q) => (
          <Link
            key={q.href}
            href={q.href}
            className="group block rounded-lg p-3 -mx-2 hover:bg-slate-50/80 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 shrink-0 rounded-lg bg-gradient-to-br ${q.gradient} flex items-center justify-center text-lg shadow-sm`}
              >
                <Icon name={q.icon as any} size={20} strokeWidth={2} className="text-white drop-shadow" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-sm text-slate-900 truncate">{q.title}</p>
                  <span className={`badge ${q.badge} border shrink-0 !text-[10px] !px-2 !py-0.5`}>
                    {q.stat}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5 truncate">{q.desc}</p>
              </div>
              <Icon
                name="chevron-right"
                size={16}
                className="text-slate-400 group-hover:text-premium-600 group-hover:translate-x-0.5 transition-all shrink-0"
              />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

interface RecentActivityCardProps {
  recentActivity: { type: string; description: string; timestamp: string }[];
  activityBadgeTone: Record<string, string>;
  firstName: string;
}

function RecentActivityCard({
  recentActivity,
  activityBadgeTone,
  firstName,
}: RecentActivityCardProps) {
  return (
    <div className="section-card">
      <div className="section-header">
        <div>
          <h2 className="section-title flex items-center gap-2">
            <Icon name="clock" size={18} className="text-premium-600" />
            Recent Activity
          </h2>
          <p className="section-subtitle">Your latest preparation milestones</p>
        </div>
        <Link
          href="/progress"
          className="inline-flex items-center gap-1 text-sm font-semibold text-premium-600 hover:text-premium-700"
        >
          View all
          <Icon name="chevron-right" size={14} />
        </Link>
      </div>
      <div className="p-5">
        {recentActivity.length === 0 ? (
          <EmptyState
            icon="sparkles"
            variant="info"
            title={`No activity yet, ${firstName}!`}
            description="Start a coding problem, take an aptitude test, or book an AI mock interview to begin."
            action={
              <div className="flex items-center justify-center gap-2">
                <Link href="/coding" className="btn-primary btn-sm">
                  <Icon name="code" size={14} />
                  Try coding
                </Link>
                <Link href="/aptitude" className="btn-secondary btn-sm">
                  <Icon name="calculator" size={14} />
                  Aptitude test
                </Link>
              </div>
            }
          />
        ) : (
          <div className="relative pl-5">
            <div className="absolute left-[9px] top-1 bottom-1 w-px bg-gradient-to-b from-premium-200 via-premium-300/60 to-premium-100" />
            <ul className="space-y-4">
              {recentActivity.slice(0, 8).map((a, i) => {
                const tone = activityBadgeTone[a.type] || activityBadgeTone.CODING;
                return (
                  <li key={i} className="relative">
                    <div className="absolute -left-5 top-1.5 w-4 h-4 rounded-full bg-white border-2 border-premium-400 shadow-sm z-10" />
                    <div className="flex items-start justify-between gap-4 pl-1">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <span className={`badge ${tone}`}>{a.type}</span>
                        </div>
                        <p className="text-sm text-slate-700 leading-relaxed">{a.description}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                          {new Date(a.timestamp).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                          })}
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          {new Date(a.timestamp).toLocaleTimeString(undefined, {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

interface QuickStatsCardProps {
  totalInterviews: number;
  totalCodingSubmissions: number;
  totalAptitudeAttempts: number;
}

function QuickStatsCard({
  totalInterviews,
  totalCodingSubmissions,
  totalAptitudeAttempts,
}: QuickStatsCardProps) {
  const max = Math.max(totalInterviews, totalCodingSubmissions, totalAptitudeAttempts, 1);
  const interviewPct = Math.round((totalInterviews / max) * 100);
  const codingPct = Math.round((totalCodingSubmissions / max) * 100);
  const aptitudePct = Math.round((totalAptitudeAttempts / max) * 100);

  return (
    <div className="section-card">
      <div className="section-header">
        <div>
          <h2 className="section-title flex items-center gap-2">
            <Icon name="chart-bar" size={18} className="text-accent-600" />
            Quick Stats
          </h2>
          <p className="section-subtitle">Volume across practice categories</p>
        </div>
      </div>
      <div className="p-5 space-y-4">
        <MiniKpi
          label="Coding Submissions"
          value={totalCodingSubmissions}
          icon={<Icon name="code" size={16} />}
          iconTone="text-premium-600"
          iconBg="bg-premium-50"
          progressPct={codingPct}
          progressColor="bg-premium-gradient"
        />
        <MiniKpi
          label="Aptitude Attempts"
          value={totalAptitudeAttempts}
          icon={<Icon name="calculator" size={16} />}
          iconTone="text-accent-600"
          iconBg="bg-accent-50"
          progressPct={aptitudePct}
          progressColor="bg-gradient-to-r from-accent-500 to-cyan-500"
        />
        <MiniKpi
          label="Mock Interviews"
          value={totalInterviews}
          icon={<Icon name="mic" size={16} />}
          iconTone="text-amber-600"
          iconBg="bg-amber-50"
          progressPct={interviewPct}
          progressColor="bg-gradient-to-r from-gold-500 to-amber-500"
        />
      </div>
    </div>
  );
}

interface MiniKpiProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  iconTone: string;
  iconBg: string;
  progressPct: number;
  progressColor: string;
}

function MiniKpi({ label, value, icon, iconTone, iconBg, progressPct, progressColor }: MiniKpiProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-lg ${iconBg} flex items-center justify-center ${iconTone}`}>
            {icon}
          </div>
          <span className="text-sm font-medium text-slate-700">{label}</span>
        </div>
        <span className="font-display text-xl font-bold text-slate-900 tracking-tight">
          {value}
        </span>
      </div>
      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
        <div
          className={`h-full rounded-full ${progressColor} transition-all duration-700 ease-out`}
          style={{ width: `${progressPct}%` }}
        />
      </div>
    </div>
  );
}
