"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Icon } from "@/components/ui/Icon";
import LoadingState from "@/components/LoadingState";
import ErrorState from "@/components/ErrorState";
import { CompanyLogo, getCompanyMeta } from "@/components/CompanyLogos";

interface CompanySummary {
  name: string;
  questionCount: number;
}

const CATEGORIES = [
  "All",
  "Big Tech",
  "FinTech",
  "Enterprise",
  "Consumer Tech",
  "Indian Tech",
] as const;

export default function CompanyVaultPage() {
  const { user } = useAuth();
  const [companies, setCompanies] = useState<CompanySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api
      .get<CompanySummary[]>("/api/questionbank/companies")
      .then(setCompanies)
      .catch((e) => setError(e instanceof ApiError ? e.message : "Failed to load company vault"))
      .finally(() => setLoading(false));
  }, []);

  // Quick keyboard shortcut (press '/' to focus search)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement !== searchInputRef.current) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const totalQuestions = useMemo(
    () => companies.reduce((sum, c) => sum + c.questionCount, 0),
    [companies]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return companies.filter((c) => {
      const meta = getCompanyMeta(c.name);
      const matchesCategory =
        selectedCategory === "All" || meta.category === selectedCategory;
      const matchesQuery =
        !q ||
        meta.displayName.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        meta.tagline.toLowerCase().includes(q);

      return matchesCategory && matchesQuery;
    });
  }, [companies, query, selectedCategory]);

  if (loading) return <LoadingState label="Loading 2026 Company Vault..." />;
  if (error) return <ErrorState message={error} />;

  return (
    <div className="space-y-8 animate-slide-up pb-12 font-sans">
      {/* 2026 HERO SECTION */}
      <section className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white p-6 sm:p-10 shadow-2xl">
        {/* Subtle decorative glowing mesh */}
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-20 w-72 h-72 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full bg-indigo-500/20 border border-indigo-400/30 px-3.5 py-1 text-xs font-bold text-indigo-300 uppercase tracking-wider backdrop-blur-md">
            <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
            2026 Placement Recruitment Vault
          </div>

          <h1 className="font-display text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-white leading-tight">
            Company Question Vault
          </h1>

          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            Practice actual coding and algorithmic interview questions reported by real candidates
            across {companies.length} top engineering enterprises. Master company-specific DSA
            patterns and targeted recruitment benchmarks.
          </p>

          {/* KPI Ribbon */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3">
            <div className="rounded-2xl bg-white/5 border border-white/10 p-3 backdrop-blur-md">
              <p className="text-[11px] font-bold text-slate-400 uppercase">Tracked Companies</p>
              <p className="text-xl sm:text-2xl font-black text-white mt-0.5">{companies.length}</p>
            </div>
            <div className="rounded-2xl bg-white/5 border border-white/10 p-3 backdrop-blur-md">
              <p className="text-[11px] font-bold text-slate-400 uppercase">Curated Questions</p>
              <p className="text-xl sm:text-2xl font-black text-indigo-300 mt-0.5">
                {totalQuestions}+
              </p>
            </div>
            <div className="rounded-2xl bg-white/5 border border-white/10 p-3 backdrop-blur-md">
              <p className="text-[11px] font-bold text-slate-400 uppercase">Drive Frequency</p>
              <p className="text-xl sm:text-2xl font-black text-emerald-400 mt-0.5">2026 Active</p>
            </div>
            <div className="rounded-2xl bg-white/5 border border-white/10 p-3 backdrop-blur-md">
              <p className="text-[11px] font-bold text-slate-400 uppercase">Proctoring Ready</p>
              <p className="text-xl sm:text-2xl font-black text-blue-400 mt-0.5">100%</p>
            </div>
          </div>

          {!user?.premium && (
            <div className="pt-2">
              <div className="inline-flex items-center gap-2 rounded-xl bg-amber-500/10 border border-amber-500/20 px-3.5 py-2 text-xs text-amber-200">
                <Icon name="award" size={14} className="text-amber-400 shrink-0" />
                <span>
                  The first 15 questions per company are unlocked for free practice. Premium membership grants access to the full problem set.
                </span>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* FILTER & SEARCH BAR */}
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Category Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-2xl bg-slate-100 border border-slate-200/80">
            {CATEGORIES.map((cat) => {
              const isSelected = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    isSelected
                      ? "bg-white text-slate-900 shadow-xs border border-slate-200"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>

          {/* Search Input with 2026 Hotkey Indicator */}
          <div className="relative w-full md:w-80">
            <Icon
              name="search"
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            />
            <input
              ref={searchInputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search companies or tech stacks..."
              className="w-full rounded-2xl border border-slate-200 bg-white pl-10 pr-12 py-2 text-xs text-slate-900 outline-none shadow-xs transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                ✕
              </button>
            ) : (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 rounded bg-slate-100 border border-slate-200 px-1.5 py-0.5 text-[10px] font-mono text-slate-400 pointer-events-none">
                /
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-500 px-1">
          <span>
            Showing <strong>{filtered.length}</strong> of {companies.length} companies
          </span>
          {selectedCategory !== "All" && (
            <button
              type="button"
              onClick={() => setSelectedCategory("All")}
              className="text-indigo-600 font-bold hover:underline"
            >
              Reset Category Filter
            </button>
          )}
        </div>
      </div>

      {/* 2026 COMPANY CARDS GRID */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((c) => {
          const meta = getCompanyMeta(c.name);

          return (
            <Link
              key={c.name}
              href={`/coding/companies/${c.name}`}
              className="group relative rounded-3xl border border-slate-200/90 bg-white p-6 shadow-xs transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:border-slate-300 flex flex-col justify-between overflow-hidden"
              style={{
                boxShadow: "0 2px 8px -2px rgba(0, 0, 0, 0.04)",
              }}
            >
              {/* Subtle accent hover line on top */}
              <div
                className="absolute top-0 left-0 right-0 h-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{ backgroundColor: meta.accentColor }}
              />

              <div className="space-y-4">
                {/* Header: Company Logo & Category Tag */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center p-2.5 shrink-0 shadow-2xs group-hover:scale-105 transition-transform duration-300">
                      <CompanyLogo slug={c.name} className="w-full h-full object-contain" />
                    </div>
                    <div>
                      <h2 className="font-display text-lg font-extrabold text-slate-900 group-hover:text-indigo-600 transition-colors">
                        {meta.displayName}
                      </h2>
                      <span className="inline-block mt-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        {meta.category}
                      </span>
                    </div>
                  </div>

                  {/* Question Count Pill */}
                  <div className="rounded-xl bg-slate-100 px-2.5 py-1 text-right shrink-0">
                    <p className="text-xs font-black text-slate-800">{c.questionCount}</p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase">Problems</p>
                  </div>
                </div>

                {/* Tagline */}
                <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                  {meta.tagline}
                </p>
              </div>

              {/* Card Footer: Difficulty Indicators & Action Link */}
              <div className="mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-semibold">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" title="Easy questions" />
                  <span className="w-2 h-2 rounded-full bg-amber-500" title="Medium questions" />
                  <span className="w-2 h-2 rounded-full bg-rose-500" title="Hard questions" />
                  <span className="ml-1 text-slate-500">Mixed Curations</span>
                </div>

                <span className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 group-hover:text-indigo-700 group-hover:translate-x-1 transition-all">
                  <span>Explore Vault</span>
                  <Icon name="arrow-right" size={13} />
                </span>
              </div>
            </Link>
          );
        })}
      </section>

      {/* Empty State */}
      {filtered.length === 0 && (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 mx-auto flex items-center justify-center text-slate-400">
            <Icon name="search" size={24} />
          </div>
          <h3 className="text-sm font-bold text-slate-800">No companies found matching &quot;{query}&quot;</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Try searching for another company name, technology stack, or reset your category filter.
          </p>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setSelectedCategory("All");
            }}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 transition cursor-pointer"
          >
            Clear Filters
          </button>
        </div>
      )}
    </div>
  );
}
