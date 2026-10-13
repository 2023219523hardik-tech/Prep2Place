"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Icon } from "@/components/ui/Icon";
import LoadingState from "@/components/LoadingState";
import ErrorState from "@/components/ErrorState";
import { CompanyLogo, getCompanyMeta } from "@/components/CompanyLogos";

interface CompanyDetail {
  name: string;
  questionCount: number;
  byDifficulty: Record<string, number>;
}

interface CompanyQuestionView {
  id: number;
  codingProblemId: number | null;
  title: string;
  difficulty: string;
  locked: boolean;
  sourceUrl: string | null;
}

const DIFF_BADGES: Record<string, { bg: string; text: string; border: string }> = {
  EASY: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  MEDIUM: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  HARD: { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200" },
};

export default function CompanyDetailPage() {
  const params = useParams<{ name: string }>();
  const { user } = useAuth();
  const [detail, setDetail] = useState<CompanyDetail | null>(null);
  const [questions, setQuestions] = useState<CompanyQuestionView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [diffFilter, setDiffFilter] = useState<string>("ALL");

  const companySlug = params?.name || "";
  const meta = useMemo(() => getCompanyMeta(companySlug), [companySlug]);

  useEffect(() => {
    if (!companySlug) return;
    Promise.all([
      api.get<CompanyDetail>(`/api/questionbank/companies/${companySlug}`),
      api.get<CompanyQuestionView[]>(`/api/questionbank/companies/${companySlug}/questions`),
    ])
      .then(([d, q]) => {
        setDetail(d);
        setQuestions(q);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : "Failed to load company problem vault"))
      .finally(() => setLoading(false));
  }, [companySlug]);

  const filteredQuestions = useMemo(() => {
    const q = search.trim().toLowerCase();
    return questions.filter((item) => {
      const matchesDiff = diffFilter === "ALL" || item.difficulty.toUpperCase() === diffFilter;
      const matchesQuery = !q || item.title.toLowerCase().includes(q);
      return matchesDiff && matchesQuery;
    });
  }, [questions, search, diffFilter]);

  if (loading) return <LoadingState label="Loading company question set..." />;
  if (error) return <ErrorState message={error} />;
  if (!detail) return null;

  const lockedCount = questions.filter((q) => q.locked).length;

  return (
    <div className="space-y-6 animate-slide-up pb-12 font-sans">
      {/* Back Breadcrumb */}
      <div>
        <Link
          href="/coding/companies"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-indigo-600 transition"
        >
          <Icon name="chevron-left" size={14} />
          <span>Back to Company Vault</span>
        </Link>
      </div>

      {/* 2026 HERO BANNER */}
      <section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs">
        <div
          className="absolute top-0 left-0 right-0 h-1.5"
          style={{ backgroundColor: meta.accentColor }}
        />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start sm:items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-slate-50 border border-slate-200 p-3 flex items-center justify-center shrink-0 shadow-xs">
              <CompanyLogo slug={companySlug} className="w-full h-full object-contain" />
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h1 className="font-display text-2xl sm:text-3xl font-black text-slate-900">
                  {meta.displayName}
                </h1>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                  {meta.category}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500">{meta.tagline}</p>
            </div>
          </div>

          {/* Stats Badges */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="px-3.5 py-2 rounded-2xl bg-slate-50 border border-slate-200 text-center">
              <p className="text-[10px] font-bold uppercase text-slate-400">Total Problems</p>
              <p className="text-lg font-black text-slate-900 mt-0.5">{detail.questionCount}</p>
            </div>
            {Object.entries(detail.byDifficulty || {}).map(([diff, count]) => {
              const badge = DIFF_BADGES[diff] || {
                bg: "bg-slate-50",
                text: "text-slate-700",
                border: "border-slate-200",
              };
              return (
                <div
                  key={diff}
                  className={`px-3.5 py-2 rounded-2xl border text-center ${badge.bg} ${badge.border}`}
                >
                  <p className="text-[10px] font-bold uppercase opacity-80">{diff}</p>
                  <p className={`text-lg font-black ${badge.text} mt-0.5`}>{count}</p>
                </div>
              );
            })}
          </div>
        </div>

        {!user?.premium && lockedCount > 0 && (
          <div className="mt-6 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4 text-xs text-indigo-900 flex items-center gap-3">
            <Icon name="award" size={16} className="text-indigo-600 shrink-0" />
            <span>
              {lockedCount} of {detail.questionCount} interview questions are reserved for Premium members.
              The first 15 questions are fully unlocked for your preparation.
            </span>
          </div>
        )}
      </section>

      {/* FILTER & SEARCH */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 border border-slate-200">
          {["ALL", "EASY", "MEDIUM", "HARD"].map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setDiffFilter(tab)}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                diffFilter === tab
                  ? "bg-white text-slate-900 shadow-xs border border-slate-200"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              {tab === "ALL" ? "All Levels" : tab}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Icon
            name="search"
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search problems..."
            className="w-full rounded-xl border border-slate-200 bg-white pl-8 pr-3 py-1.5 text-xs text-slate-800 outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      {/* QUESTIONS LIST */}
      <section className="space-y-2.5">
        {filteredQuestions.map((q, index) => {
          const badge = DIFF_BADGES[q.difficulty] || {
            bg: "bg-slate-50",
            text: "text-slate-700",
            border: "border-slate-200",
          };

          const cardContent = (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4">
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-7 h-7 rounded-lg bg-slate-100 font-mono text-xs font-bold text-slate-500 flex items-center justify-center shrink-0">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border shrink-0 ${badge.bg} ${badge.text} ${badge.border}`}
                >
                  {q.difficulty}
                </span>
                <h3
                  className={`text-sm font-bold truncate ${
                    q.locked ? "text-slate-400" : "text-slate-900 group-hover:text-indigo-600 transition-colors"
                  }`}
                >
                  {q.title}
                </h3>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {q.locked ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-500 text-xs font-bold">
                    <Icon name="lock" size={12} />
                    <span>Premium</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-bold border border-indigo-200/60 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                    <span>Solve Challenge</span>
                    <Icon name="arrow-right" size={12} />
                  </span>
                )}
              </div>
            </div>
          );

          return q.locked ? (
            <div
              key={q.id}
              className="rounded-2xl border border-slate-200 bg-slate-50/70 opacity-70"
            >
              {cardContent}
            </div>
          ) : (
            <Link
              key={q.id}
              href={`/coding/${q.codingProblemId ?? q.id}`}
              className="group block rounded-2xl border border-slate-200/90 bg-white hover:border-indigo-300 hover:shadow-sm transition-all"
            >
              {cardContent}
            </Link>
          );
        })}

        {filteredQuestions.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500 text-xs">
            No questions match your current filter.
          </div>
        )}
      </section>
    </div>
  );
}
