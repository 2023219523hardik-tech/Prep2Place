"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import { api, ApiError } from "@/lib/api";
import ErrorState from "@/components/ErrorState";
import { Icon } from "@/components/ui/Icon";
import { Skeleton, SkeletonGroup } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";

interface CategoryGap { category: string; matched: string[]; missing: string[]; matchPercentage: number }
interface MissingSkillAction { skill: string; category: string; actionLabel: string; href: string }
interface SkillGap {
  targetRole: string; matchedSkills: string[]; missingSkills: string[]; matchPercentage: number;
  categoryBreakdown: CategoryGap[]; missingSkillActions: MissingSkillAction[]; noRoleSet?: boolean;
}

type GapTab = "OVERVIEW" | "MISSING" | "ACTION";

const GAP_TABS: GapTab[] = ["OVERVIEW", "MISSING", "ACTION"];

export default function SkillGapPage() {
  const [data, setData] = useState<SkillGap | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<GapTab>("OVERVIEW");

  useEffect(() => {
    api.get<SkillGap>("/api/skills/gaps")
      .then(setData)
      .catch((e) => setError(e instanceof ApiError ? e.message : "Failed to load skill gap analysis"))
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SkeletonGroup variant="kpi" />
          <SkeletonGroup variant="kpi" />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} variant="line" className="w-32 h-9 shrink-0 rounded-xl" />
          ))}
        </div>
        <SkeletonGroup variant="card" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <SkeletonGroup key={i} variant="card" />
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <SkeletonGroup variant="list" />
          <SkeletonGroup variant="list" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full space-y-4">
        <div className="surface-card p-4">
          <div>
            <h1 className="font-display text-xl font-bold tracking-tight text-slate-950">
              Skill Gap Analysis
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              How your current skills line up against your target role requirements
            </p>
          </div>
        </div>
        <ErrorState message={error} />
        <div className="surface-card p-5">
          <p className="text-sm text-slate-500">
            Tip: set a target role on your{" "}
            <Link href="/profile" className="font-semibold text-premium-700 hover:underline">
              profile
            </Link>{" "}
            to see a skill gap analysis.
          </p>
        </div>
      </div>
    );
  }
  if (!data) return null;

  if (data.noRoleSet) {
    return (
      <div className="w-full space-y-4">
        <div className="surface-card p-4">
          <div>
            <h1 className="font-display text-xl font-bold tracking-tight text-slate-950">
              Skill Gap Analysis
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              How your current skills line up against your target role requirements
            </p>
          </div>
        </div>
        <div className="section-card">
          <div className="p-8">
            <EmptyState
              icon="target"
              variant="info"
              title="Set your target role to start tracking readiness"
              description="Visit your profile to select a target role. Once set, we'll analyze your skills against the role's requirements and show you exactly what to work on."
            />
            <div className="mt-4 text-center">
              <Link
                href="/profile"
                className="inline-flex items-center gap-2 rounded-xl bg-premium-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-premium-700 transition-colors"
              >
                <Icon name="user" size={16} />
                Go to Profile
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const radarData = data.categoryBreakdown.map((c) => ({
    category: c.category,
    match: c.matchPercentage,
  }));
  const barData = data.categoryBreakdown.map((c) => ({
    category: c.category,
    Matched: c.matched.length,
    Missing: c.missing.length,
  }));
  const actionsByCategory = data.missingSkillActions.reduce<
    Record<string, MissingSkillAction[]>
  >((acc, a) => {
    (acc[a.category] ??= []).push(a);
    return acc;
  }, {});

  const matchTone =
    data.matchPercentage >= 75
      ? { kpi: "bg-emerald-50 border-emerald-100 text-emerald-600", badge: "badge-success" }
      : data.matchPercentage >= 50
      ? { kpi: "bg-amber-50 border-amber-100 text-amber-600", badge: "badge-warning" }
      : { kpi: "bg-red-50 border-red-100 text-red-600", badge: "badge-danger" };

  return (
    <div className="w-full space-y-5 pb-8">
      <div className="surface-card p-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-display text-xl font-bold tracking-tight text-slate-950">
              Skill Gap Analysis
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              How your current skills line up against what {data.targetRole} roles typically need
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="badge badge-primary">
              <Icon name="target" size={14} />
              {data.targetRole}
            </span>
            <span className={`badge ${matchTone.badge}`}>
              {data.matchPercentage}% Match
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="kpi-tile">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="kpi-label">Overall Skill Match</div>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="kpi-value">{data.matchPercentage}</span>
                <span className={`badge ${matchTone.badge} !px-1.5 !py-0.5 text-[10px]`}>%</span>
              </div>
              <div className="kpi-delta mt-2">
                <Icon name="target" size={12} className={matchTone.kpi.split(" ")[2]} />
                <span className="text-slate-600">
                  {data.matchPercentage >= 75
                    ? "Strong match for the role"
                    : data.matchPercentage >= 50
                    ? "Getting there — close some gaps"
                    : "Significant gaps to address"}
                </span>
              </div>
            </div>
            <div
              className={`w-10 h-10 rounded-xl border flex items-center justify-center flex-shrink-0 ${matchTone.kpi}`}
            >
              <Icon name="radar" size={20} />
            </div>
          </div>
          <div className="mt-3">
            <span className={`badge !text-[10px] !px-2 !py-0.5 ${matchTone.badge}`}>
              {data.matchPercentage >= 75
                ? "Role Ready"
                : data.matchPercentage >= 50
                ? "In Progress"
                : "Needs Work"}
            </span>
          </div>
        </div>

        <div className="kpi-tile">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="kpi-label">Target Role</div>
              <div className="flex items-baseline gap-2 mt-1 flex-wrap">
                <span className="kpi-value text-base truncate" title={data.targetRole}>
                  {data.targetRole}
                </span>
                <span className="badge badge-primary !text-[10px] !px-2 !py-0.5">
                  Analysis
                </span>
              </div>
              <div className="kpi-delta mt-2">
                <Icon name="briefcase" size={12} className="text-premium-600" />
                <span className="text-slate-600 truncate">
                  {data.categoryBreakdown.length} categories scanned
                </span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-premium-50 border border-premium-100 flex items-center justify-center text-premium-600 flex-shrink-0">
              <Icon name="briefcase" size={20} />
            </div>
          </div>
          <div className="mt-3">
            <span className="badge badge-neutral !text-[10px] !px-2 !py-0.5">
              {data.matchedSkills.length} matched · {data.missingSkills.length} missing
            </span>
          </div>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
        {GAP_TABS.map((item) => {
          const active = tab === item;
          return (
            <button
              key={item}
              onClick={() => setTab(item)}
              className={`chip shrink-0 ${active ? "chip-active" : "chip-muted"}`}
            >
              {item === "OVERVIEW"
                ? "Overview"
                : item === "MISSING"
                ? "Missing Skills"
                : "Action Plan"}
            </button>
          );
        })}
      </div>

      {(tab === "OVERVIEW" || tab === "MISSING" || tab === "ACTION") && (
        <div className="section-card">
          <div className="p-6">
            <div className="flex flex-col items-center gap-8 sm:flex-row">
              <div className="text-center sm:text-left min-w-0 flex-1">
                <p className="kpi-label">Target Role</p>
                <p className="mt-0.5 font-display text-xl font-bold text-slate-950">
                  {data.targetRole}
                </p>
                <p className="mt-3 font-display text-5xl font-extrabold text-premium-700 tracking-tight">
                  {data.matchPercentage}%
                </p>
                <p className="text-sm text-slate-500 mt-0.5">overall skill match</p>
                <div className="mt-4 flex flex-wrap gap-1.5 justify-center sm:justify-start">
                  <span className="badge badge-success !text-[11px]">
                    <Icon name="check-circle" size={12} />
                    {data.matchedSkills.length} Matched
                  </span>
                  <span className="badge badge-warning !text-[11px]">
                    <Icon name="alert-triangle" size={12} />
                    {data.missingSkills.length} Missing
                  </span>
                </div>
              </div>
              <div className="h-56 w-full max-w-sm sm:h-64 sm:flex-1">
                {radarData.length > 0 ? (
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
                        dataKey="match"
                        stroke="#7c3aed"
                        fill="#7c3aed"
                        fillOpacity={0.35}
                        strokeWidth={2}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <EmptyState
                      icon="radar"
                      variant="neutral"
                      title="No required skills configured"
                      description="This role hasn't been mapped to skill categories yet."
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "OVERVIEW" && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {data.categoryBreakdown.length === 0 ? (
              <div className="col-span-full">
                <EmptyState
                  icon="layers"
                  variant="neutral"
                  title="No categories configured"
                  description="Skill categories for this role are not yet defined."
                />
              </div>
            ) : (
              data.categoryBreakdown.map((c) => (
                <div key={c.category} className="kpi-tile text-center">
                  <p className="font-display text-2xl font-bold text-slate-900 tabular-nums">
                    {c.matchPercentage}%
                  </p>
                  <p className="mt-0.5 text-[11px] font-semibold leading-tight text-slate-500">
                    {c.category}
                  </p>
                  <div className="mt-2">
                    <span
                      className={`badge !text-[10px] !px-2 !py-0.5 ${
                        c.matchPercentage >= 75
                          ? "badge-success"
                          : c.matchPercentage >= 50
                          ? "badge-warning"
                          : "badge-danger"
                      }`}
                    >
                      {c.matchPercentage >= 75
                        ? "Strong"
                        : c.matchPercentage >= 50
                        ? "Developing"
                        : "Gap"}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          {barData.length > 0 && (
            <div className="section-card">
              <div className="section-header">
                <div>
                  <h2 className="section-title flex items-center gap-2">
                    <Icon name="chart-bar" size={18} className="text-accent-600" />
                    Per-Category Gaps
                  </h2>
                  <p className="section-subtitle">
                    Matched vs missing skills by category
                  </p>
                </div>
              </div>
              <div className="p-5">
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis
                        dataKey="category"
                        tick={{ fontSize: 10, fill: "#64748b" }}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: "#64748b" }}
                        allowDecimals={false}
                      />
                      <Tooltip
                        contentStyle={{
                          borderRadius: 8,
                          border: "1px solid #e2e8f0",
                          fontSize: 12,
                        }}
                      />
                      <Legend />
                      <Bar
                        dataKey="Matched"
                        name="Matched"
                        fill="#10b981"
                        radius={[6, 6, 0, 0]}
                      />
                      <Bar
                        dataKey="Missing"
                        name="Missing"
                        fill="#f59e0b"
                        radius={[6, 6, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {(tab === "OVERVIEW" || tab === "MISSING") && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div className="section-card">
            <div className="section-header">
              <div>
                <h2 className="section-title flex items-center gap-2">
                  <Icon name="check-circle" size={18} className="text-emerald-600" />
                  Matched Skills
                </h2>
                <p className="section-subtitle">
                  Skills you already have for this role
                </p>
              </div>
            </div>
            <div className="p-5">
              {data.matchedSkills.length === 0 ? (
                <EmptyState
                  icon="plus"
                  variant="neutral"
                  title="No matched skills yet"
                  description="Add skills on your profile as you learn them to populate this view."
                />
              ) : (
                <ul className="space-y-1.5">
                  {data.matchedSkills.map((s) => (
                    <li
                      key={s}
                      className="flex items-center gap-2 capitalize text-sm text-slate-700 rounded-lg px-2.5 py-2 hover:bg-emerald-50/60 transition-colors"
                    >
                      <Icon
                        name="check-circle"
                        size={16}
                        className="text-emerald-500 shrink-0"
                      />
                      <span className="truncate">{s}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="section-card">
            <div className="section-header">
              <div>
                <h2 className="section-title flex items-center gap-2">
                  <Icon name="alert-triangle" size={18} className="text-amber-600" />
                  Missing Skills
                </h2>
                <p className="section-subtitle">
                  Skills to learn for the target role
                </p>
              </div>
            </div>
            <div className="p-5">
              {data.missingSkills.length === 0 ? (
                <EmptyState
                  icon="trophy"
                  variant="success"
                  title="Full coverage"
                  description="You have every skill this role typically needs — maintain and deepen them."
                />
              ) : Object.keys(actionsByCategory).length === 0 ? (
                <EmptyState
                  icon="alert-circle"
                  variant="warning"
                  title="No action links yet"
                  description="Missing skills are listed below once action mappings are available."
                />
              ) : (
                <div className="space-y-4">
                  {Object.entries(actionsByCategory).map(([category, actions]) => (
                    <div key={category}>
                      <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">
                        {category}
                      </p>
                      <ul className="space-y-1">
                        {actions.map((a) => (
                          <li key={a.skill}>
                            <Link
                              href={a.href}
                              className="group flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-sm capitalize text-slate-700 transition-colors hover:bg-amber-50"
                            >
                              <span className="flex items-center gap-2 min-w-0 flex-1">
                                <Icon
                                  name="plus"
                                  size={14}
                                  className="text-amber-500 shrink-0"
                                />
                                <span className="truncate">{a.skill}</span>
                              </span>
                              <span className="whitespace-nowrap text-xs font-semibold text-premium-700 opacity-0 transition-opacity group-hover:opacity-100 shrink-0">
                                {a.actionLabel}{" "}
                                <Icon
                                  name="chevron-right"
                                  size={12}
                                  className="inline -mt-0.5"
                                />
                              </span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === "ACTION" && (
        <div className="section-card">
          <div className="section-header">
            <div>
              <h2 className="section-title flex items-center gap-2">
                <Icon name="zap" size={18} className="text-premium-600" />
                Action Plan
              </h2>
              <p className="section-subtitle">
                Prioritized steps to close skill gaps
              </p>
            </div>
          </div>
          <div className="p-5">
            {data.missingSkillActions.length === 0 ? (
              <EmptyState
                icon="sparkles"
                variant="success"
                title="No actions needed"
                description="You've covered all skills required for this role. Explore advanced topics to stand out further."
              />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {data.missingSkillActions.map((a, i) => (
                  <Link
                    key={`${a.category}-${a.skill}-${i}`}
                    href={a.href}
                    className="group flex items-start justify-between gap-3 rounded-xl border border-premium-100 bg-premium-50/40 p-4 transition-all hover:-translate-y-0.5 hover:shadow-soft"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="badge badge-accent !text-[10px] !px-2 !py-0.5">
                          {a.category}
                        </span>
                        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                          Step {i + 1}
                        </span>
                      </div>
                      <p className="mt-2 text-sm font-semibold text-slate-800 truncate capitalize">
                        Learn {a.skill}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">{a.actionLabel}</p>
                    </div>
                    <Icon
                      name="chevron-right"
                      size={18}
                      className="shrink-0 text-premium-600 transition-transform group-hover:translate-x-0.5 mt-1"
                    />
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "OVERVIEW" && (
        <div className="section-card bg-slate-50/40">
          <div className="p-5 text-center">
            <div className="inline-flex items-center gap-2 text-sm text-slate-500">
              <Icon name="clock" size={16} className="text-slate-400" />
              Trend tracking will appear here once you have multiple skill-gap analyses over time.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
