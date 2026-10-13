"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import ErrorState from "@/components/ErrorState";
import { Icon } from "@/components/ui/Icon";
import { Skeleton, SkeletonGroup } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer,
} from "recharts";

interface Readiness {
  overallScore: number;
  readinessLevel: string;
  categoryBreakdown: Record<string, number>;
  weakAreas: string[];
  strengths: string[];
}

const LEVEL_COLOR: Record<string, string> = {
  "Highly Ready": "#10b981",
  "Ready": "#22c55e",
  "Needs Improvement": "#f59e0b",
  "Not Ready": "#ef4444",
};

const LEVEL_BADGE: Record<string, string> = {
  "Highly Ready": "badge-success",
  "Ready": "badge-success",
  "Needs Improvement": "badge-warning",
  "Not Ready": "badge-danger",
};

const ACTION_TEMPLATES: Record<string, { verb: string; href: string; unit: string }> = {
  "DSA/Coding": { verb: "Attempt", href: "/mock-tests", unit: "more mock coding test(s)" },
  "Aptitude": { verb: "Practice", href: "/aptitude", unit: "more aptitude question set(s)" },
  "Technical Knowledge": { verb: "Practice", href: "/dashboard/technical-mcq", unit: "more technical MCQ set(s)" },
  "Communication": { verb: "Complete", href: "/interview", unit: "more mock interview(s) focused on clarity" },
  "Interview": { verb: "Complete", href: "/interview", unit: "more mock interview(s)" },
  "Projects": { verb: "Add", href: "/profile", unit: "more project(s) to your profile" },
  "Academics": { verb: "Update", href: "/profile", unit: "your academic record" },
};

type DimensionTab = "OVERALL" | "CODING" | "APTITUDE" | "INTERVIEW";

const DIMENSION_TABS: DimensionTab[] = ["OVERALL", "CODING", "APTITUDE", "INTERVIEW"];

function suggestedReps(score: number): number {
  return Math.min(6, Math.max(1, Math.round((70 - score) / 12)));
}

export default function ReadinessPage() {
  const [data, setData] = useState<Readiness | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<DimensionTab>("OVERALL");

  useEffect(() => {
    api.get<Readiness>("/api/placement/readiness")
      .then(setData)
      .catch((e) => setError(e instanceof ApiError ? e.message : "Failed to load readiness"))
      .finally(() => setLoading(false));
  }, []);

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
        <div className="flex gap-2 overflow-x-auto pb-1">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} variant="line" className="w-28 h-9 shrink-0 rounded-xl" />
          ))}
        </div>
        <SkeletonGroup variant="card" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <SkeletonGroup key={i} variant="card" />
          ))}
        </div>
        <SkeletonGroup variant="list" />
      </div>
    );
  }
  if (error) return <ErrorState message={error} />;
  if (!data) return null;

  const levelColor = LEVEL_COLOR[data.readinessLevel] ?? "#64748b";
  const levelBadge = LEVEL_BADGE[data.readinessLevel] ?? "badge-neutral";
  const categories = Object.entries(data.categoryBreakdown).sort(([, a], [, b]) => a - b);
  const radarData = categories.map(([category, score]) => ({ category, score }));

  const strengths = data.strengths;
  const weakAreas = data.weakAreas;

  const codingScore =
    data.categoryBreakdown["DSA/Coding"] ?? data.categoryBreakdown["Coding"] ?? data.overallScore;
  const aptitudeScore =
    data.categoryBreakdown["Aptitude"] ?? data.categoryBreakdown["Quant"] ?? data.overallScore;
  const interviewScore =
    data.categoryBreakdown["Interview"] ??
    data.categoryBreakdown["Communication"] ??
    data.overallScore;

  return (
    <div className="w-full space-y-5 pb-8">
      <div className="surface-card p-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-display text-xl font-bold tracking-tight text-slate-950">
              Placement Readiness
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Your current standing across every practice module, updated in real time
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`badge ${levelBadge}`}>
              <Icon name="target" size={14} />
              {data.readinessLevel}
            </span>
            <span className="badge badge-primary">
              {Object.keys(data.categoryBreakdown).length} Metrics
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="kpi-tile">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="kpi-label">Overall Score</div>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="kpi-value">{Math.round(data.overallScore)}</span>
                <span className="badge badge-primary !px-1.5 !py-0.5 text-[10px]">%</span>
              </div>
              <div className="kpi-delta mt-2">
                <Icon name="target" size={12} className="text-premium-600" />
                <span className="text-slate-600">Combined readiness index</span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-premium-50 border border-premium-100 flex items-center justify-center text-premium-600 flex-shrink-0">
              <Icon name="radar" size={20} />
            </div>
          </div>
          <div className="mt-3">
            <span className={`badge !text-[10px] !px-2 !py-0.5 ${levelBadge}`}>
              {data.readinessLevel}
            </span>
          </div>
        </div>

        <div className="kpi-tile">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="kpi-label">Strength Areas</div>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="kpi-value">{strengths.length}</span>
              </div>
              <div className="kpi-delta mt-2">
                <Icon name="award" size={12} className="text-emerald-600" />
                <span className="text-slate-600">Domains where you excel</span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 flex-shrink-0">
              <Icon name="trophy" size={20} />
            </div>
          </div>
          <div className="mt-3">
            <span className="badge badge-success !text-[10px] !px-2 !py-0.5">
              {strengths.length === 0 ? "Building strengths" : `${strengths.length} strengths`}
            </span>
          </div>
        </div>

        <div className="kpi-tile">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="kpi-label">Focus Areas</div>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="kpi-value">{weakAreas.length}</span>
              </div>
              <div className="kpi-delta mt-2">
                <Icon name="trending-up" size={12} className="text-amber-600" />
                <span className="text-slate-600">
                  {weakAreas.length === 0 ? "All strong — maintain it" : "Domains to improve"}
                </span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 flex-shrink-0">
              <Icon name="zap" size={20} />
            </div>
          </div>
          <div className="mt-3">
            <span
              className={`badge !text-[10px] !px-2 !py-0.5 ${
                weakAreas.length === 0 ? "badge-success" : "badge-warning"
              }`}
            >
              {weakAreas.length === 0 ? "No weak areas" : `${weakAreas.length} to improve`}
            </span>
          </div>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
        {DIMENSION_TABS.map((item) => {
          const active = tab === item;
          return (
            <button
              key={item}
              onClick={() => setTab(item)}
              className={`chip shrink-0 ${active ? "chip-active" : "chip-muted"}`}
            >
              {item === "OVERALL"
                ? "Overall"
                : item === "CODING"
                ? "Coding"
                : item === "APTITUDE"
                ? "Aptitude"
                : "Interview"}
            </button>
          );
        })}
      </div>

      <div className="section-card">
        <div className="p-6">
          <div className="flex flex-col items-center gap-8 sm:flex-row sm:items-center">
            <HeroRing score={data.overallScore} color={levelColor} />
            <div className="flex-1 text-center sm:text-left">
              <span className={`badge ${levelBadge}`}>{data.readinessLevel}</span>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-600">
                This score combines your DSA/coding practice, aptitude accuracy, technical
                knowledge, communication clarity, mock interview performance, projects, and
                academics using a weighted formula.
              </p>
            </div>
          </div>
        </div>
      </div>

      {(tab === "OVERALL" || tab === "CODING" || tab === "APTITUDE" || tab === "INTERVIEW") && (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-5">
          <div className="section-card">
            <div className="section-header">
              <div>
                <h2 className="section-title flex items-center gap-2">
                  <Icon name="radar" size={18} className="text-premium-600" />
                  Category Radar
                </h2>
                <p className="section-subtitle">Balance across all skill dimensions</p>
              </div>
            </div>
            <div className="p-5">
              {radarData.length === 0 ? (
                <EmptyState
                  icon="radar"
                  variant="neutral"
                  title="No category data yet"
                  description="Complete practice modules to see a radar view of your strengths."
                />
              ) : (
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={radarData} outerRadius="75%">
                      <PolarGrid stroke="#e2e8f0" />
                      <PolarAngleAxis
                        dataKey="category"
                        tick={{ fontSize: 11, fill: "#475569" }}
                      />
                      <PolarRadiusAxis
                        domain={[0, 100]}
                        tick={{ fontSize: 9, fill: "#94a3b8" }}
                        tickCount={5}
                      />
                      <Radar
                        dataKey="score"
                        stroke="#7c3aed"
                        fill="#7c3aed"
                        fillOpacity={0.35}
                        strokeWidth={2}
                      />
                    </RadarChart>
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
                  Skill Breakdown
                </h2>
                <p className="section-subtitle">Individual category scores</p>
              </div>
            </div>
            <div className="p-5">
              {categories.length === 0 ? (
                <EmptyState
                  icon="chart-bar"
                  variant="neutral"
                  title="No skill breakdown"
                  description="Complete practice sessions to populate category scores."
                />
              ) : (
                <div className="space-y-3.5">
                  {categories.map(([category, score]) => {
                    const color =
                      score >= 75 ? "#10b981" : score >= 50 ? "#f59e0b" : "#ef4444";
                    const status =
                      score >= 75 ? "Strong" : score >= 50 ? "Developing" : "Needs Work";
                    return (
                      <div key={category}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-semibold text-slate-700">{category}</span>
                          <div className="flex items-center gap-2">
                            <span
                              className="badge !text-[10px] !px-2 !py-0.5 border"
                              style={{ backgroundColor: `${color}1a`, color, borderColor: `${color}40` }}
                            >
                              {status}
                            </span>
                            <span className="text-xs font-bold text-slate-900 tabular-nums">
                              {Math.round(score)}%
                            </span>
                          </div>
                        </div>
                        <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-700 ease-out"
                            style={{ width: `${Math.min(100, Math.max(0, score))}%`, backgroundColor: color }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {categories.map(([category, score]) => (
          <SkillCard key={category} category={category} score={score} />
        ))}
      </div>

      {weakAreas.length > 0 ? (
        <div className="section-card">
          <div className="section-header">
            <div>
              <h2 className="section-title flex items-center gap-2">
                <Icon name="zap" size={18} className="text-amber-600" />
                Recommended Next Steps
              </h2>
              <p className="section-subtitle">Concrete actions for your weakest areas</p>
            </div>
          </div>
          <div className="p-5 grid gap-3 sm:grid-cols-2">
            {weakAreas.map((area) => {
              const template = ACTION_TEMPLATES[area];
              const score = data.categoryBreakdown[area] ?? 0;
              const reps = suggestedReps(score);
              return (
                <Link
                  key={area}
                  href={template?.href ?? "/dashboard"}
                  className="group flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 transition-all hover:-translate-y-0.5 hover:shadow-card"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-wider text-amber-700">
                      Weak in {area}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-800 truncate">
                      {template
                        ? `${template.verb} ${reps} ${template.unit}`
                        : `Spend focused time improving ${area}`}
                    </p>
                  </div>
                  <Icon
                    name="chevron-right"
                    size={18}
                    className="shrink-0 text-amber-600 transition-transform group-hover:translate-x-0.5"
                  />
                </Link>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="section-card">
          <div className="p-5">
            <EmptyState
              icon="trophy"
              variant="success"
              title="No weak areas identified"
              description="Keep up the consistent practice — you're strong across every measured dimension."
            />
          </div>
        </div>
      )}

      {strengths.length > 0 && (
        <div className="section-card">
          <div className="section-header">
            <div>
              <h2 className="section-title flex items-center gap-2">
                <Icon name="award" size={18} className="text-emerald-600" />
                Strengths
              </h2>
              <p className="section-subtitle">Domains where you consistently perform well</p>
            </div>
          </div>
          <div className="p-5">
            <div className="flex flex-wrap gap-2">
              {strengths.map((s) => (
                <span
                  key={s}
                  className="badge badge-success !px-3 !py-1.5 !text-sm"
                >
                  <Icon name="check-circle" size={14} />
                  {s}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function HeroRing({ score, color }: { score: number; color: string }) {
  const circumference = 2 * Math.PI * 52;
  const offset = circumference - (Math.min(100, Math.max(0, score)) / 100) * circumference;
  return (
    <svg width="140" height="140" viewBox="0 0 120 120" className="shrink-0">
      <circle cx="60" cy="60" r="52" fill="none" stroke="#e2e8f0" strokeWidth="10" />
      <circle
        cx="60" cy="60" r="52" fill="none" stroke={color} strokeWidth="10"
        strokeDasharray={circumference} strokeDashoffset={offset}
        strokeLinecap="round" transform="rotate(-90 60 60)"
        className="transition-all duration-700 ease-out"
      />
      <text x="60" y="66" textAnchor="middle" fontSize="26" fontWeight="800" fill="#0f172a">
        {Math.round(score)}
      </text>
    </svg>
  );
}

function SkillCard({ category, score }: { category: string; score: number }) {
  const color = score >= 75 ? "#10b981" : score >= 50 ? "#f59e0b" : "#ef4444";
  const status = score >= 75 ? "Strong" : score >= 50 ? "Developing" : "Needs Work";
  const circumference = 2 * Math.PI * 26;
  const offset = circumference - (Math.min(100, Math.max(0, score)) / 100) * circumference;
  return (
    <div className="kpi-tile">
      <div className="flex flex-col items-center gap-2 text-center">
        <svg width="64" height="64" viewBox="0 0 64 64">
          <circle cx="32" cy="32" r="26" fill="none" stroke="#e2e8f0" strokeWidth="6" />
          <circle
            cx="32" cy="32" r="26" fill="none" stroke={color} strokeWidth="6"
            strokeDasharray={circumference} strokeDashoffset={offset}
            strokeLinecap="round" transform="rotate(-90 32 32)"
            className="transition-all duration-700 ease-out"
          />
          <text x="32" y="37" textAnchor="middle" fontSize="14" fontWeight="700" fill="#0f172a">
            {Math.round(score)}
          </text>
        </svg>
        <p className="text-xs font-bold leading-tight text-slate-800">{category}</p>
        <span
          className="badge !text-[10px] !px-2 !py-0.5 border"
          style={{ backgroundColor: `${color}1a`, color, borderColor: `${color}40` }}
        >
          {status}
        </span>
      </div>
    </div>
  );
}
