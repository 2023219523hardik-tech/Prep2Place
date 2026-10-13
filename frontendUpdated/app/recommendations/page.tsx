"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { Icon } from "@/components/ui/Icon";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonGroup } from "@/components/ui/Skeleton";
import ErrorState from "@/components/ErrorState";

interface RoadmapItem { week: number; focusArea: string; goal: string; }
interface Recommendation {
  recommendedTopics: string[]; recommendedQuestionCategories: string[]; recommendedRoles: string[]; roadmap: RoadmapItem[];
}

const ROADMAP_GRADIENTS = [
  "bg-gradient-to-br from-premium-500 to-indigo-600",
  "bg-gradient-to-br from-accent-500 to-cyan-600",
  "bg-gradient-to-br from-violet-500 to-fuchsia-600",
  "bg-gradient-to-br from-emerald-500 to-green-600",
  "bg-gradient-to-br from-amber-500 to-orange-600",
  "bg-gradient-to-br from-pink-500 to-rose-600",
];

const ROADMAP_ICONS = [
  "target",
  "code",
  "brain",
  "database",
  "rocket",
  "briefcase",
] as const;

export default function RecommendationsPage() {
  const [data, setData] = useState<Recommendation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get<Recommendation>("/api/recommendations")
      .then(setData)
      .catch((e) => setError(e instanceof ApiError ? e.message : "Failed to load recommendations"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-8 animate-slide-up">
        <div className="section-card p-5">
          <div className="space-y-2">
            <SkeletonGroup variant="kpi" className="w-80" />
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <SkeletonGroup variant="kpi" />
          <SkeletonGroup variant="kpi" />
          <SkeletonGroup variant="kpi" />
        </div>
        <SkeletonGroup variant="card" />
        <SkeletonGroup variant="card" />
      </div>
    );
  }
  if (error) return <ErrorState message={error} />;
  if (!data) return null;

  const hasAnyData =
    data.recommendedTopics.length > 0 ||
    data.recommendedQuestionCategories.length > 0 ||
    data.recommendedRoles.length > 0 ||
    data.roadmap.length > 0;

  return (
    <div className="space-y-8 animate-slide-up pb-8">
      <div className="section-card p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-slate-950">
              Personalized Recommendations
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              AI-generated focus areas, curated question categories, and a structured placement roadmap built from your performance data.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="kpi-tile">
          <div className="kpi-label">Focus Topics</div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="kpi-value">{data.recommendedTopics.length}</span>
            <span className="badge badge-warning !px-1.5 !py-0.5 text-[10px]">topics</span>
          </div>
          <div className="kpi-delta">
            <Icon name="target" size={12} className="text-amber-600" />
            <span className="text-amber-600">Weak areas to strengthen</span>
          </div>
        </div>
        <div className="kpi-tile">
          <div className="kpi-label">Recommended Categories</div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="kpi-value">{data.recommendedQuestionCategories.length}</span>
            <span className="badge badge-accent !px-1.5 !py-0.5 text-[10px]">categories</span>
          </div>
          <div className="kpi-delta">
            <Icon name="library" size={12} className="text-accent-600" />
            <span className="text-accent-600">Curated question pools</span>
          </div>
        </div>
        <div className="kpi-tile">
          <div className="kpi-label">Roadmap Weeks</div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="kpi-value">{data.roadmap.length}</span>
            <span className="badge badge-primary !px-1.5 !py-0.5 text-[10px]">weeks</span>
          </div>
          <div className="kpi-delta">
            <Icon name="rocket" size={12} className="text-premium-600" />
            <span className="text-premium-600">Structured prep plan</span>
          </div>
        </div>
      </div>

      {!hasAnyData ? (
        <EmptyState
          icon="sparkles"
          variant="info"
          title="No recommendations yet"
          description="Keep practicing across coding, aptitude and mock interviews to get personalized recommendations generated from your performance data."
        />
      ) : (
        <>
          {data.recommendedTopics.length > 0 && (
            <div className="section-card">
              <div className="section-header">
                <div>
                  <h2 className="section-title flex items-center gap-2">
                    <Icon name="target" size={18} className="text-amber-500" />
                    Focus Topics
                  </h2>
                  <p className="section-subtitle">Weak areas detected in your performance — prioritize these first.</p>
                </div>
              </div>
              <div className="p-5">
                <div className="flex flex-wrap gap-2">
                  {data.recommendedTopics.map((t) => (
                    <span key={t} className="badge badge-warning">
                      <Icon name="alert-triangle" size={12} />
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {data.recommendedQuestionCategories.length > 0 && (
            <div className="section-card">
              <div className="section-header">
                <div>
                  <h2 className="section-title flex items-center gap-2">
                    <Icon name="library" size={18} className="text-accent-500" />
                    Recommended Categories
                  </h2>
                  <p className="section-subtitle">Question categories curated for your improvement.</p>
                </div>
              </div>
              <div className="p-5">
                <div className="flex flex-wrap gap-2">
                  {data.recommendedQuestionCategories.map((c) => (
                    <span key={c} className="badge badge-accent">
                      <Icon name="book-open" size={12} />
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {data.recommendedRoles.length > 0 && (
            <div className="section-card">
              <div className="section-header">
                <div>
                  <h2 className="section-title flex items-center gap-2">
                    <Icon name="briefcase" size={18} className="text-emerald-500" />
                    Recommended Roles
                  </h2>
                  <p className="section-subtitle">Roles aligned with your current skill trajectory.</p>
                </div>
              </div>
              <div className="p-5">
                <div className="flex flex-wrap gap-2">
                  {data.recommendedRoles.map((r) => (
                    <span key={r} className="badge badge-success">
                      <Icon name="briefcase" size={12} />
                      {r}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {data.roadmap.length > 0 ? (
            <div className="section-card">
              <div className="section-header">
                <div>
                  <h2 className="section-title flex items-center gap-2">
                    <Icon name="rocket" size={18} className="text-premium-500" />
                    Your Placement Roadmap
                  </h2>
                  <p className="section-subtitle">A week-by-week structured plan to get placement-ready.</p>
                </div>
              </div>
              <div className="p-5">
                <ol className="space-y-3">
                  {data.roadmap.map((r, idx) => {
                    const gradient = ROADMAP_GRADIENTS[idx % ROADMAP_GRADIENTS.length];
                    const iconName = ROADMAP_ICONS[idx % ROADMAP_ICONS.length];
                    return (
                      <li
                        key={r.week}
                        className="group flex items-start gap-4 rounded-lg p-3 -mx-2 hover:bg-slate-50/80 transition-colors"
                      >
                        <div
                          className={`w-11 h-11 shrink-0 rounded-xl ${gradient} flex items-center justify-center text-white shadow-sm`}
                        >
                          <Icon name={iconName as any} size={20} strokeWidth={2} className="drop-shadow" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="badge badge-primary">
                              <Icon name="clock" size={12} />
                              Week {r.week}
                            </span>
                            <span className="font-semibold text-sm text-slate-900">
                              {r.focusArea}
                            </span>
                          </div>
                          <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">{r.goal}</p>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </div>
            </div>
          ) : (
            <EmptyState
              icon="rocket"
              title="No roadmap yet"
              description="Keep practicing and a personalized week-by-week roadmap will be generated for you."
            />
          )}
        </>
      )}
    </div>
  );
}
