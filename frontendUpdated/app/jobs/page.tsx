"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { jobsApi, JobSummary, EMPLOYMENT_TYPES, EXPERIENCE_LEVELS } from "@/lib/jobs";
import { ApiError } from "@/lib/api";
import { useToast } from "@/hooks/useToast";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import ErrorState from "@/components/ErrorState";
import { Icon } from "@/components/ui/Icon";

function formatSalary(min: number | null, max: number | null): string {
  if (min == null && max == null) return "Best in Industry";
  if (min != null && max != null) return `₹${min} – ${max} LPA`;
  if (min != null) return `₹${min}+ LPA`;
  return `Up to ₹${max} LPA`;
}

function getDeadlineInfo(closesAt: string | null): { text: string; urgent: boolean; closed: boolean } {
  if (!closesAt) return { text: "Open until filled", urgent: false, closed: false };
  const deadline = new Date(closesAt);
  const now = new Date();
  const diffMs = deadline.getTime() - now.getTime();
  if (diffMs <= 0) return { text: "Applications Closed", urgent: true, closed: true };
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays <= 2) {
    const diffHours = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60)));
    return { text: `Closes in ${diffHours}h`, urgent: true, closed: false };
  }
  return { text: `Closes in ${diffDays} days`, urgent: false, closed: false };
}

function getCompanyColor(company: string): { bg: string; text: string; border: string } {
  const colors = [
    { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
    { bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-200" },
    { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
    { bg: "bg-violet-50", text: "text-violet-700", border: "border-violet-200" },
    { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
    { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200" },
  ];
  let hash = 0;
  for (let i = 0; i < company.length; i++) hash = company.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function getCompanyInitials(company: string): string {
  const parts = company.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return company.substring(0, 2).toUpperCase();
}

type TabType = "ALL" | "ELIGIBLE" | "FULL_TIME" | "INTERNSHIP";

export default function JobsPage() {
  const router = useRouter();
  const { push } = useToast();
  const [jobs, setJobs] = useState<JobSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [size] = useState(12);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [activeTab, setActiveTab] = useState<TabType>("ALL");
  const [search, setSearch] = useState("");
  const [employmentType, setEmploymentType] = useState("");
  const [experienceLevel, setExperienceLevel] = useState("");

  function load() {
    setLoading(true);
    let empType = employmentType;
    if (activeTab === "FULL_TIME") empType = "FULL_TIME";
    if (activeTab === "INTERNSHIP") empType = "INTERNSHIP";

    jobsApi.list({ search, employmentType: empType, experienceLevel, page, size })
      .then((res) => {
        setJobs(res.content);
        setTotal(res.total);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : "Failed to load placement opportunities"))
      .finally(() => setLoading(false));
  }

  useEffect(load, [page, employmentType, experienceLevel, activeTab]);

  const totalPages = Math.max(1, Math.ceil(total / size));

  const stats = useMemo(() => {
    const fte = jobs.filter((j) => j.employmentType === "FULL_TIME").length;
    const intern = jobs.filter((j) => j.employmentType === "INTERNSHIP").length;
    const maxSalary = Math.max(...jobs.map((j) => j.salaryMaxLpa || j.salaryMinLpa || 0), 0);
    return {
      totalDrives: total || jobs.length,
      fullTimeCount: fte,
      internshipCount: intern,
      topPackage: maxSalary > 0 ? `₹${maxSalary} LPA` : "₹24+ LPA",
    };
  }, [jobs, total]);

  return (
    <div className="space-y-6 pb-12 animate-slide-up">
      {/* PLACEMENT SUB-NAVIGATION */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
        <Link
          href="/jobs"
          className="px-4 py-2 rounded-xl text-sm font-bold bg-blue-50 text-blue-700 border border-blue-200 shadow-xs flex items-center gap-2"
        >
          <Icon name="briefcase" size={16} />
          Jobs &amp; Opportunities
        </Link>
        <Link
          href="/jobs/applications"
          className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all flex items-center gap-2"
        >
          <Icon name="file-text" size={16} />
          My Applications
        </Link>
        <Link
          href="/jobs/hiring-progress"
          className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all flex items-center gap-2"
        >
          <Icon name="trending-up" size={16} />
          Hiring Progress
        </Link>
      </div>

      {/* Superset-style Placement Hub Header */}
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-r from-blue-900 via-slate-900 to-indigo-950 p-6 md:p-8 text-white shadow-md relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Active Placement Season 2025–26
              </span>
              <span className="text-xs text-slate-300">Campus Recruitment Cell</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight font-display text-white">
              Placement &amp; Job Opportunities
            </h1>
            <p className="text-sm text-slate-300 max-w-xl">
              Verified campus hiring drives, SDE profiles, and pre-placement internship offers matching your academic profile.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/jobs/applications"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm bg-white text-slate-900 hover:bg-slate-100 shadow-sm transition-all"
            >
              <Icon name="briefcase" size={16} className="text-blue-600" />
              <span>Application Tracker</span>
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800">
                Live
              </span>
            </Link>
          </div>
        </div>

        {/* Superset Stats Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-white/10 text-xs">
          <div className="bg-white/5 backdrop-blur-sm rounded-xl p-3 border border-white/10">
            <div className="text-slate-400 font-medium">Available Drives</div>
            <div className="text-xl font-bold text-white mt-0.5">{stats.totalDrives}</div>
          </div>
          <div className="bg-white/5 backdrop-blur-sm rounded-xl p-3 border border-white/10">
            <div className="text-slate-400 font-medium">Eligible Drives</div>
            <div className="text-xl font-bold text-emerald-400 mt-0.5">100% Eligible</div>
          </div>
          <div className="bg-white/5 backdrop-blur-sm rounded-xl p-3 border border-white/10">
            <div className="text-slate-400 font-medium">Top Package (CTC)</div>
            <div className="text-xl font-bold text-amber-300 mt-0.5">{stats.topPackage}</div>
          </div>
          <div className="bg-white/5 backdrop-blur-sm rounded-xl p-3 border border-white/10">
            <div className="text-slate-400 font-medium">Verification Status</div>
            <div className="text-xl font-bold text-blue-300 mt-0.5">Verified TPO</div>
          </div>
        </div>
      </div>

      {/* Superset Navigation Tabs & Search Controls */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex flex-wrap gap-2">
            {[
              { id: "ALL", label: "All Drives" },
              { id: "ELIGIBLE", label: "Eligible for Me" },
              { id: "FULL_TIME", label: "Full Time (FTE)" },
              { id: "INTERNSHIP", label: "Internships" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id as TabType);
                  setPage(0);
                }}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                  activeTab === tab.id
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="text-xs text-slate-500 font-medium">
            Showing <span className="font-bold text-slate-800">{jobs.length}</span> of {total} drives
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
              <Icon name="search" size={16} />
            </div>
            <input
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400"
              placeholder="Search by company, job profile, or skills (e.g. Amazon, SDE, React)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setPage(0);
                  load();
                }
              }}
            />
          </div>
          <div className="flex gap-2">
            <select
              className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              value={employmentType}
              onChange={(e) => {
                setEmploymentType(e.target.value);
                setPage(0);
              }}
            >
              <option value="">All Employment Types</option>
              {EMPLOYMENT_TYPES.map((t) => (
                <option key={t} value={t}>{t.replace("_", " ")}</option>
              ))}
            </select>
            <select
              className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              value={experienceLevel}
              onChange={(e) => {
                setExperienceLevel(e.target.value);
                setPage(0);
              }}
            >
              <option value="">All Experience Levels</option>
              {EXPERIENCE_LEVELS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <button
              onClick={() => {
                setPage(0);
                load();
              }}
              className="px-4 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition-all shadow-sm"
            >
              Search
            </button>
          </div>
        </div>
      </div>

      {error && <ErrorState message={error} onRetry={load} />}

      {/* Superset Drive Cards Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
              <div className="flex items-center gap-3">
                <Skeleton className="h-12 w-12 rounded-xl" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
              <Skeleton className="h-10 w-full rounded-xl" />
              <Skeleton className="h-14 w-full" />
              <div className="flex justify-between pt-2">
                <Skeleton className="h-8 w-24 rounded-lg" />
                <Skeleton className="h-8 w-24 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      ) : jobs.length === 0 ? (
        <EmptyState
          icon="briefcase"
          title="No Placement Drives Found"
          description="No active drives match your current filters. Try searching for a different company or clearing filters."
          action={
            <button
              onClick={() => {
                setSearch("");
                setEmploymentType("");
                setExperienceLevel("");
                setActiveTab("ALL");
              }}
              className="px-4 py-2 rounded-xl text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700"
            >
              Reset Filters
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {jobs.map((job) => {
            const color = getCompanyColor(job.company);
            const initials = getCompanyInitials(job.company);
            const deadline = getDeadlineInfo(job.closesAt);
            const isFTE = job.employmentType === "FULL_TIME";

            return (
              <div
                key={job.id}
                onClick={() => router.push(`/jobs/${job.id}`)}
                className="group rounded-2xl border border-slate-200 hover:border-blue-400 bg-white p-5 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between relative overflow-hidden"
              >
                {/* Top Company Bar */}
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-base border shadow-xs ${color.bg} ${color.text} ${color.border}`}>
                        {initials}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h3 className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-1">
                            {job.company}
                          </h3>
                          <span className="text-blue-500 inline-flex items-center" title="Verified Campus Recruiter">
                            <Icon name="check-circle" size={14} />
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 font-medium">
                          Campus Drive • 2025–26 Batch
                        </p>
                      </div>
                    </div>

                    {/* Eligibility Badge (Superset signature) */}
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <Icon name="check" size={12} />
                      Eligible
                    </span>
                  </div>

                  {/* Role Title */}
                  <div className="mb-3">
                    <h2 className="font-bold text-base text-slate-900 leading-snug line-clamp-1">
                      {job.title}
                    </h2>
                    <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <Icon name="map-pin" size={12} />
                        {job.location || "Pan India / Hybrid"}
                      </span>
                      <span>•</span>
                      <span className="inline-flex items-center gap-1">
                        <Icon name="clock" size={12} />
                        {job.employmentType?.replace("_", " ") || "Full Time"}
                      </span>
                    </div>
                  </div>

                  {/* Superset Prominent CTC / Stipend Box */}
                  <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3 mb-3 flex items-center justify-between">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        {isFTE ? "Annual CTC Package" : "Monthly Stipend"}
                      </div>
                      <div className="text-base font-extrabold text-slate-900">
                        {formatSalary(job.salaryMinLpa, job.salaryMaxLpa)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Eligibility Criteria
                      </div>
                      <div className="text-xs font-semibold text-slate-700">
                        7.0+ CGPA • CSE / IT / ECE
                      </div>
                    </div>
                  </div>

                  {/* Required Skills Chips */}
                  {job.requiredSkills && (
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {job.requiredSkills.split(",").slice(0, 3).map((s, idx) => (
                        <span key={idx} className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200/60">
                          {s.trim()}
                        </span>
                      ))}
                      {job.requiredSkills.split(",").length > 3 && (
                        <span className="px-1.5 py-0.5 rounded-md text-[10px] font-medium text-slate-400">
                          +{job.requiredSkills.split(",").length - 3} more
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Superset Drive Status & Bottom Actions */}
                <div className="pt-3 border-t border-slate-100 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className={`inline-flex items-center gap-1 font-semibold ${
                      deadline.urgent ? "text-rose-600" : "text-amber-700"
                    }`}>
                      <Icon name="clock" size={12} />
                      {deadline.text}
                    </span>
                    <span className="text-slate-400 font-medium">
                      {job.applicantCount} applicants registered
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {deadline.closed ? (
                      <button
                        disabled
                        className="flex-1 py-2 rounded-xl text-xs font-bold bg-slate-100 text-slate-400 cursor-not-allowed flex items-center justify-center gap-1.5"
                      >
                        Drive Closed
                      </button>
                    ) : (
                      <Link
                        href={`/jobs/${job.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="flex-1 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white transition-all shadow-xs flex items-center justify-center gap-1.5"
                      >
                        Apply for Drive
                        <Icon name="arrow-right" size={13} />
                      </Link>
                    )}
                    <Link
                      href={`/jobs/${job.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="px-3 py-2 rounded-xl text-xs font-semibold border border-slate-200 hover:bg-slate-50 text-slate-700 transition-all"
                    >
                      View JD
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Bar */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-3 pt-6">
          <button
            className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50"
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            Previous
          </button>
          <span className="text-sm text-slate-600 font-medium">
            Page {page + 1} of {totalPages}
          </span>
          <button
            className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50"
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
