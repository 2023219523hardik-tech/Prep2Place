"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AssessmentProfile, listProfiles, startAttempt } from "@/lib/assessment";
import { ApiError } from "@/lib/api";
import { Icon } from "@/components/ui/Icon";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonGroup, Skeleton } from "@/components/ui/Skeleton";
import ErrorState from "@/components/ErrorState";
import { StudentTestCard, studentTestsApi } from "@/lib/managedTests";

type Tier = "Easy" | "Medium" | "Hard" | "Mixed";

type MockTestItem =
  | { kind: "legacy"; profile: AssessmentProfile }
  | { kind: "managed"; card: StudentTestCard };

function tierOf(profile: AssessmentProfile): Tier {
  const dist = profile.difficultyDistribution || {};
  const easy = dist.EASY || 0, medium = dist.MEDIUM || 0, hard = dist.HARD || 0;
  const total = easy + medium + hard;
  if (total === 0) return "Mixed";
  if (easy / total >= 0.6) return "Easy";
  if (hard / total >= 0.5) return "Hard";
  if (easy > 0 && medium > 0 && hard > 0) return "Mixed";
  return "Medium";
}

const TIER_BADGE: Record<Tier, string> = {
  Easy: "badge-success",
  Medium: "badge-warning",
  Hard: "badge-danger",
  Mixed: "badge-neutral",
};

const DIFFICULTY_FILTERS: ("All" | Tier)[] = ["All", "Easy", "Medium", "Hard", "Mixed"];
const DURATION_FILTERS = ["All", "< 30 min", "30-60 min", "> 60 min"];

function itemTier(item: MockTestItem): Tier {
  if (item.kind === "legacy") return tierOf(item.profile);
  return "Mixed";
}

export default function MockTestsPage() {
  const router = useRouter();
  const [profiles, setProfiles] = useState<AssessmentProfile[]>([]);
  const [managedTests, setManagedTests] = useState<StudentTestCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [starting, setStarting] = useState<number | null>(null);

  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"All" | "Coding" | "Aptitude" | "Technical MCQ">("All");
  const [tierFilter, setTierFilter] = useState<"All" | Tier>("All");
  const [durationFilter, setDurationFilter] = useState("All");

  useEffect(() => {
    Promise.all([
      listProfiles().then((all) => all.filter((p) => p.assessmentType !== "AI_INTERVIEW" && p.active)),
      studentTestsApi.available().catch(() => []),
    ])
      .then(([legacyProfiles, studentTests]) => {
        setProfiles(legacyProfiles);
        setManagedTests(studentTests);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : "Failed to load mock tests"))
      .finally(() => setLoading(false));
  }, []);

  const items = useMemo<MockTestItem[]>(() => [
    ...profiles.map((profile) => ({ kind: "legacy" as const, profile })),
    ...managedTests.map((card) => ({ kind: "managed" as const, card })),
  ], [profiles, managedTests]);

  const companies = useMemo(
    () => Array.from(new Set(items.flatMap((item) => {
      if (item.kind === "legacy") return item.profile.companyName ? [item.profile.companyName] : [];
      return item.card.organizationName ? [item.card.organizationName] : [];
    }))).sort(),
    [items]
  );

  const getDuration = (item: MockTestItem): number => {
    return item.kind === "legacy" ? item.profile.durationMinutes : item.card.durationMinutes;
  };

  const matchesDuration = (dur: number): boolean => {
    if (durationFilter === "All") return true;
    if (durationFilter === "< 30 min") return dur < 30;
    if (durationFilter === "30-60 min") return dur >= 30 && dur <= 60;
    if (durationFilter === "> 60 min") return dur > 60;
    return true;
  };

  const filtered = useMemo(() => {
    return items.filter((item) => {
      const name = item.kind === "legacy" ? item.profile.name : item.card.name;
      const company = item.kind === "legacy" ? item.profile.companyName : item.card.organizationName;
      const matchesQuery = !query || name.toLowerCase().includes(query.toLowerCase()) ||
        (company || "").toLowerCase().includes(query.toLowerCase());
      const matchesType = typeFilter === "All" ||
        (typeFilter === "Coding" && item.kind === "legacy" && item.profile.assessmentType === "CODING_MOCK_TEST") ||
        (typeFilter === "Aptitude" && item.kind === "legacy" && item.profile.assessmentType === "APTITUDE_MOCK_TEST") ||
        (typeFilter === "Technical MCQ" && item.kind === "managed" && item.card.testType === "TECHNICAL_MCQ_TEST");
      const matchesTier = tierFilter === "All" || itemTier(item) === tierFilter;
      const matchesDur = matchesDuration(getDuration(item));
      return matchesQuery && matchesType && matchesTier && matchesDur;
    });
  }, [items, query, typeFilter, tierFilter, durationFilter]);

  const recentAttempts = useMemo(() => {
    return filtered.slice(0, 4);
  }, [filtered]);

  async function start(item: MockTestItem) {
    setStarting(item.kind === "legacy" ? item.profile.id : item.card.testId);
    setError("");
    try {
      if (item.kind === "legacy") {
        const attempt = await startAttempt(item.profile.id);
        if (item.profile.assessmentType === "CODING_MOCK_TEST") {
          router.push(`/mock-tests/coding/${attempt.id}/0`);
        } else {
          router.push(`/mock-tests/aptitude/${attempt.id}`);
        }
        return;
      }

      const attempt = await studentTestsApi.start(item.card.testId);
      router.push(`/mock-tests/managed/${attempt.attemptId}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to start test");
      setStarting(null);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6 animate-slide-up pb-8">
        <div className="section-card p-4 space-y-3">
          <Skeleton variant="line" className="w-48 h-6" />
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="skeleton h-9 w-40 rounded-lg" />
            ))}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonGroup key={i} variant="kpi" />
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonGroup key={i} variant="card" />
          ))}
        </div>
      </div>
    );
  }

  if (error && items.length === 0) return <ErrorState message={error} />;

  return (
    <div className="space-y-6 animate-slide-up pb-8">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-slate-950">Mock Tests</h1>
        <p className="text-sm text-slate-500 mt-1">
          Full-length placement simulations with proctoring.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <Icon name="alert-circle" size={16} />
          {error}
        </div>
      )}

      <div className="section-card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              <Icon name="search" size={16} />
            </div>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search tests..."
              className="input !pl-10"
            />
          </div>
          <div className="flex flex-wrap gap-1.5 items-center">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 mr-1">
              Difficulty:
            </span>
            {DIFFICULTY_FILTERS.map((d) => (
              <button
                key={d}
                onClick={() => setTierFilter(d)}
                className={`chip ${tierFilter === d ? "chip-active" : "chip-muted"}`}
              >
                {d}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5 items-center">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 mr-1">
              Duration:
            </span>
            {DURATION_FILTERS.map((d) => (
              <button
                key={d}
                onClick={() => setDurationFilter(d)}
                className={`chip ${durationFilter === d ? "chip-active" : "chip-muted"}`}
              >
                {d}
              </button>
            ))}
          </div>
          <button className="btn-secondary btn-sm ml-auto whitespace-nowrap">
            <Icon name="plus" size={14} />
            Create Custom Test
          </button>
        </div>
      </div>

      {recentAttempts.length > 0 && (
        <div>
          <div className="section-header !px-0 !border-b-0 !py-0 mb-3">
            <div>
              <h2 className="section-title">Featured Tests</h2>
              <p className="section-subtitle">Quick start — or see your scored attempts in Progress.</p>
            </div>
            <button
              onClick={() => router.push("/progress")}
              className="btn-secondary btn-sm"
            >
              <Icon name="chart-line" size={14} />
              My Attempts &amp; Reports
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {recentAttempts.map((item, i) => {
              const name = item.kind === "legacy" ? item.profile.name : item.card.name;
              const tier = itemTier(item);
              const managed = item.kind === "managed" ? item.card : null;
              const hasCompletedAttempt =
                !!managed &&
                (managed.bestPercentage !== null ||
                  managed.attemptsUsed > 0 ||
                  managed.attemptStatus === "SUBMITTED" ||
                  managed.attemptStatus === "COMPLETED" ||
                  managed.attemptStatus === "REPORT_READY");

              const goToReportOrProgress = () => {
                if (managed && managed.activeAttemptId && hasCompletedAttempt) {
                  router.push(`/mock-tests/${managed.activeAttemptId}/report`);
                } else {
                  router.push("/progress");
                }
              };

              return (
                <div key={i} className="kpi-tile">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className={`badge ${TIER_BADGE[tier]}`}>{tier}</span>
                    <span className="text-xs text-slate-400">
                      {new Date(Date.now() - i * 86400000).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="font-semibold text-sm text-slate-900 line-clamp-2 min-h-[40px]">
                    {name}
                  </div>
                  {managed && managed.bestPercentage !== null && (
                    <div className="mt-2 text-xs font-semibold text-emerald-600">
                      Best: {Math.round(managed.bestPercentage)}%
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={goToReportOrProgress}
                    className="btn-ghost btn-sm !px-0 !py-1 mt-2 text-xs gap-1 text-premium-600 hover:text-premium-700"
                  >
                    {hasCompletedAttempt ? "View Report" : "Progress"}
                    <Icon name="chevron-right" size={12} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          icon="test-tube"
          title="No tests found"
          description={
            items.length === 0
              ? "No mock tests are currently available. Check back later."
              : "No tests match your filters. Try adjusting your search criteria."
          }
          action={
            <button
              onClick={() => {
                setQuery("");
                setTierFilter("All");
                setDurationFilter("All");
                setTypeFilter("All");
              }}
              className="btn-secondary btn-sm"
            >
              <Icon name="refresh-cw" size={14} />
              Browse All Tests
            </button>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item) => (
            <TestCard
              key={item.kind === "legacy" ? `legacy-${item.profile.id}` : `managed-${item.card.testId}`}
              item={item}
              onStart={start}
              starting={starting}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TestCard({ item, onStart, starting }: {
  item: MockTestItem; onStart: (item: MockTestItem) => void; starting: number | null;
}) {
  const router = useRouter();
  const tier = itemTier(item);

  if (item.kind === "legacy") {
    const profile = item.profile;
    const requiresCamera = profile.cameraRequired;
    const requiresScreenShare = profile.screenShareRequired;

    return (
      <div className="section-card p-0 flex flex-col overflow-hidden hover:shadow-elevated transition-shadow relative">
        {requiresCamera && (
          <div className="absolute left-0 top-4 z-10">
            <div className="badge badge-danger rounded-l-none rounded-r-lg shadow-sm">
              <Icon name="video" size={12} />
              Requires Camera
            </div>
          </div>
        )}
        {!requiresCamera && requiresScreenShare && (
          <div className="absolute left-0 top-4 z-10">
            <div className="badge badge-warning rounded-l-none rounded-r-lg shadow-sm">
              <Icon name="sidebar" size={12} />
              Requires Screen Share
            </div>
          </div>
        )}
        <div className="p-5 flex flex-col gap-3 flex-1 pt-10">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-display font-bold text-slate-950 leading-tight pr-2">
              {profile.name}
            </h3>
            <div className="flex flex-col gap-1 items-end shrink-0">
              <span className={`badge ${TIER_BADGE[tier]}`}>{tier}</span>
              {profile.companyName && (
                <span className="badge badge-primary">{profile.companyName}</span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <span className="chip chip-muted">
              <Icon name="file-text" size={12} />
              {profile.questionCount} question{profile.questionCount === 1 ? "" : "s"}
            </span>
            <span className="chip chip-muted">
              <Icon name="clock" size={12} />
              {profile.durationMinutes} min
            </span>
            {profile.cameraRequired && (
              <span className="chip chip-muted">
                <Icon name="video" size={12} />
                Camera
              </span>
            )}
            {profile.screenShareRequired && (
              <span className="chip chip-muted">
                <Icon name="sidebar" size={12} />
                Screen Share
              </span>
            )}
          </div>
          <div className="flex flex-col gap-2 mt-auto">
            <button
              onClick={() => onStart(item)}
              disabled={starting !== null}
              className="btn-primary btn-sm w-full justify-center"
            >
              <Icon name="play" size={14} />
              {starting === profile.id ? "Starting..." : "Start"}
            </button>
            <button
              onClick={() => router.push("/progress")}
              className="btn-ghost btn-sm w-full justify-center !text-premium-700 hover:!bg-premium-50"
            >
              <Icon name="chart-line" size={14} />
              My Attempts
            </button>
          </div>
        </div>
      </div>
    );
  }

  const card = item.card;

  return (
    <div className="section-card p-0 flex flex-col overflow-hidden hover:shadow-elevated transition-shadow">
      <div className="p-5 flex flex-col gap-3 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display font-bold text-slate-950 leading-tight pr-2">
            {card.name}
          </h3>
          <div className="flex flex-col gap-1 items-end shrink-0">
            <span className={`badge ${TIER_BADGE[tier]}`}>
              {card.testType === "TECHNICAL_MCQ_TEST" ? "Technical MCQ" : "Managed"}
            </span>
            {card.organizationName && (
              <span className="badge badge-primary">{card.organizationName}</span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <span className="chip chip-muted">
            <Icon name="file-text" size={12} />
            {card.questionCount} question{card.questionCount === 1 ? "" : "s"}
          </span>
          <span className="chip chip-muted">
            <Icon name="clock" size={12} />
            {card.durationMinutes} min
          </span>
          {card.sectionNames.length > 0 && (
            <span className="chip chip-muted">
              <Icon name="layers" size={12} />
              {card.sectionNames.length} sections
            </span>
          )}
        </div>
        <div className="flex flex-col gap-2 mt-auto">
          <button
            onClick={() => onStart(item)}
            disabled={starting !== null}
            className="btn-primary btn-sm w-full justify-center"
          >
            <Icon name="play" size={14} />
            {starting === card.testId ? "Starting..." : "Start"}
          </button>
          {card.bestPercentage !== null ? (
            <button
              onClick={() =>
                card.activeAttemptId
                  ? router.push(`/mock-tests/${card.activeAttemptId}/report`)
                  : router.push("/progress")
              }
              className="btn-ghost btn-sm w-full justify-center !text-emerald-700 hover:!bg-emerald-50 gap-1.5"
            >
              <Icon name="file-text" size={14} />
              Best Report · {Math.round(card.bestPercentage)}%
            </button>
          ) : card.attemptsUsed > 0 ? (
            <button
              onClick={() => router.push("/progress")}
              className="btn-ghost btn-sm w-full justify-center !text-premium-700 hover:!bg-premium-50"
            >
              <Icon name="chart-line" size={14} />
              View My Attempts
            </button>
          ) : (
            <button
              onClick={() => router.push("/progress")}
              className="btn-ghost btn-sm w-full justify-center !text-slate-600 hover:!bg-slate-50"
            >
              <Icon name="info" size={14} />
              Attempts history
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
