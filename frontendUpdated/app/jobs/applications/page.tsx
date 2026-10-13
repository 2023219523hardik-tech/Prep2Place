"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  jobsApi,
  ApplicationResponse,
  HiringRoundDto,
  CandidateApplicationDetail,
} from "@/lib/jobs";
import { ApiError } from "@/lib/api";
import { useToast } from "@/hooks/useToast";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import ErrorState from "@/components/ErrorState";
import { Icon } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";

function getCompanyInitials(company: string): string {
  const parts = company.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return company.substring(0, 2).toUpperCase();
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

function getRoundEngineRoute(roundType?: string): string {
  if (!roundType) return "/mock-tests";
  const t = roundType.toUpperCase();
  if (t === "APTITUDE") return "/aptitude";
  if (t === "TECHNICAL_MCQ") return "/mock-tests";
  if (t === "DSA") return "/coding";
  if (t === "SQL") return "/coding?mode=SQL";
  if (t === "DATAFRAME") return "/coding?mode=DATAFRAME";
  if (t === "CODING_LAB") return "/coding-lab";
  if (t === "AI_INTERVIEW") return "/interview";
  return "/mock-tests";
}

function getRoundTypeIcon(roundType?: string): any {
  if (!roundType) return "check-circle";
  const t = roundType.toUpperCase();
  if (t.includes("APTITUDE")) return "brain";
  if (t.includes("MCQ")) return "list";
  if (t.includes("DSA") || t.includes("CODING")) return "code";
  if (t.includes("SQL")) return "database";
  if (t.includes("DATAFRAME")) return "table";
  if (t.includes("INTERVIEW")) return "video";
  return "briefcase";
}

export default function MyApplicationsPage() {
  const router = useRouter();
  const { push } = useToast();
  const [apps, setApps] = useState<ApplicationResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [withdrawing, setWithdrawing] = useState<number | null>(null);

  // Tab filter: ALL, SHORTLISTED, UNDER_REVIEW, PASSED, IN_PROGRESS
  const [activeTab, setActiveTab] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Modals state
  const [journeyModalOpen, setJourneyModalOpen] = useState(false);
  const [selectedApp, setSelectedApp] = useState<ApplicationResponse | null>(null);
  const [appProgress, setAppProgress] = useState<CandidateApplicationDetail | null>(null);
  const [pipelineRounds, setPipelineRounds] = useState<HiringRoundDto[]>([]);
  const [loadingProgress, setLoadingProgress] = useState(false);

  // ATS Breakdown Modal
  const [atsModalOpen, setAtsModalOpen] = useState(false);
  const [atsTargetApp, setAtsTargetApp] = useState<ApplicationResponse | null>(null);

  function load() {
    setLoading(true);
    setError("");
    jobsApi.myApplications()
      .then((res: any) => {
        const list = Array.isArray(res) ? res : res?.content || [];
        setApps(list);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : "Failed to load applications"))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function openHiringProgress(app: ApplicationResponse) {
    setSelectedApp(app);
    setJourneyModalOpen(true);
    setLoadingProgress(true);
    try {
      const [prog, pipe] = await Promise.all([
        jobsApi.progress(app.id).catch(() => null),
        jobsApi.pipeline(app.jobId).catch(() => []),
      ]);
      setAppProgress(prog);
      setPipelineRounds(pipe);
    } catch {
      push({ title: "Could not load hiring journey details", variant: "error" });
    } finally {
      setLoadingProgress(false);
    }
  }

  function openAtsBreakdown(app: ApplicationResponse) {
    setAtsTargetApp(app);
    setAtsModalOpen(true);
  }

  async function withdraw(id: number) {
    setWithdrawing(id);
    try {
      await jobsApi.withdraw(id);
      push({ title: "Application withdrawn successfully", variant: "success" });
      setApps((prev) => prev.map((a) => (a.id === id ? { ...a, status: "WITHDRAWN" } : a)));
    } catch (e) {
      push({ title: e instanceof ApiError ? e.message : "Failed to withdraw application", variant: "error" });
    } finally {
      setWithdrawing(null);
    }
  }

  const counts = useMemo(() => {
    return {
      total: apps.length,
      shortlisted: apps.filter((a) => a.status === "SHORTLISTED").length,
      underReview: apps.filter((a) => a.status === "UNDER_REVIEW" || a.status === "APPLIED").length,
      inProgress: apps.filter((a) => a.status === "IN_PROGRESS" || a.status === "ASSESSMENT_PENDING" || a.status === "INTERVIEW").length,
      offers: apps.filter((a) => a.status === "OFFER" || a.status === "SELECTED" || a.finalDecision === "SELECTED" || a.finalDecision === "OFFER").length,
    };
  }, [apps]);

  const filteredApps = useMemo(() => {
    return apps.filter((app) => {
      const matchSearch =
        searchQuery.trim() === "" ||
        app.jobTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
        app.company.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchSearch) return false;

      if (activeTab === "SHORTLISTED") return app.status === "SHORTLISTED";
      if (activeTab === "UNDER_REVIEW") return app.status === "UNDER_REVIEW" || app.status === "APPLIED";
      if (activeTab === "IN_PROGRESS") return app.status === "IN_PROGRESS" || app.status === "INTERVIEW" || app.status === "ASSESSMENT_PENDING";
      if (activeTab === "OFFERS") return app.status === "OFFER" || app.status === "SELECTED" || app.finalDecision === "SELECTED";
      return true;
    });
  }, [apps, activeTab, searchQuery]);

  return (
    <div className="space-y-6 pb-12 animate-slide-up">
      {/* PLACEMENT SUB-NAVIGATION */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
        <Link
          href="/jobs"
          className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all flex items-center gap-2"
        >
          <Icon name="briefcase" size={16} />
          Jobs &amp; Opportunities
        </Link>
        <Link
          href="/jobs/applications"
          className="px-4 py-2 rounded-xl text-sm font-bold bg-blue-50 text-blue-700 border border-blue-200 shadow-xs flex items-center gap-2"
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

      {/* Main Placement Hub Header */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                Prep2Place Campus Recruitment Hub
              </span>
              <span className="text-xs text-slate-400">Live ATS Shortlisting &amp; Journey</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight font-display text-slate-900">
              My Applications &amp; Recruitment Pipeline
            </h1>
            <p className="text-sm text-slate-500">
              Track ATS score screening, academic eligibility verification, scheduled tests, and interview rounds.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/jobs"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 shadow-sm transition-all"
            >
              <Icon name="plus" size={16} />
              Explore Open Drives
            </Link>
          </div>
        </div>

        {/* Metrics Counter Bar */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-6 pt-5 border-t border-slate-100 text-center">
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
            <div className="text-xs font-semibold text-slate-500">Total Applied</div>
            <div className="text-xl font-bold text-slate-900 mt-0.5">{counts.total}</div>
          </div>
          <div className="bg-emerald-50/70 rounded-xl p-3 border border-emerald-100">
            <div className="text-xs font-semibold text-emerald-700">ATS Shortlisted</div>
            <div className="text-xl font-bold text-emerald-800 mt-0.5">{counts.shortlisted}</div>
          </div>
          <div className="bg-amber-50/70 rounded-xl p-3 border border-amber-100">
            <div className="text-xs font-semibold text-amber-700">Under Review</div>
            <div className="text-xl font-bold text-amber-800 mt-0.5">{counts.underReview}</div>
          </div>
          <div className="bg-blue-50/70 rounded-xl p-3 border border-blue-100">
            <div className="text-xs font-semibold text-blue-700">In Assessment</div>
            <div className="text-xl font-bold text-blue-800 mt-0.5">{counts.inProgress}</div>
          </div>
          <div className="bg-purple-50/70 rounded-xl p-3 border border-purple-100">
            <div className="text-xs font-semibold text-purple-700">Offers Extended</div>
            <div className="text-xl font-bold text-purple-800 mt-0.5">{counts.offers}</div>
          </div>
        </div>
      </div>

      {/* Search & Tabs Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: "ALL", label: `All (${counts.total})` },
            { id: "SHORTLISTED", label: `Shortlisted (${counts.shortlisted})` },
            { id: "UNDER_REVIEW", label: `In Review (${counts.underReview})` },
            { id: "IN_PROGRESS", label: `Assessments (${counts.inProgress})` },
            { id: "OFFERS", label: `Offers (${counts.offers})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === tab.id
                  ? "bg-slate-900 text-white shadow-xs"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <input
            type="text"
            placeholder="Search by company or role..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl bg-white border border-slate-200 px-3 py-2 pl-9 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
          <Icon name="search" size={14} className="absolute left-3 top-2.5 text-slate-400" />
        </div>
      </div>

      {error && <ErrorState message={error} onRetry={load} />}

      {loading ? (
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
              <Skeleton className="h-6 w-1/3" />
              <Skeleton className="h-4 w-1/4" />
              <Skeleton className="h-16 w-full rounded-xl" />
            </div>
          ))}
        </div>
      ) : filteredApps.length === 0 ? (
        <EmptyState
          icon="briefcase"
          title={searchQuery || activeTab !== "ALL" ? "No Matching Applications Found" : "No Placement Applications Yet"}
          description={
            searchQuery || activeTab !== "ALL"
              ? "Try adjusting your search query or tab filter."
              : "You haven't applied to any campus recruitment drives yet. Browse open opportunities and submit your resume."
          }
          action={
            <Link href="/jobs" className="btn-primary btn-sm">
              <Icon name="search" size={14} />
              Explore Open Drives
            </Link>
          }
        />
      ) : (
        <div className="space-y-4">
          {filteredApps.map((app) => {
            const initials = getCompanyInitials(app.company);
            const color = getCompanyColor(app.company);
            const refId = `P2P-2026-${String(app.id).padStart(5, "0")}`;
            const totalRounds = app.totalRounds || 1;
            const currentOrder = app.currentRoundOrder || 1;
            const progressPct = Math.min(100, Math.round((currentOrder / totalRounds) * 100));
            const isTerminal =
              app.status === "OFFER" ||
              app.status === "REJECTED" ||
              app.status === "WITHDRAWN" ||
              app.status === "NOT_ELIGIBLE" ||
              app.finalDecision === "SELECTED" ||
              app.finalDecision === "REJECTED";
            const engineRoute = getRoundEngineRoute(app.currentRoundType || undefined);

            const atsScore = app.atsScore;
            const isShortlisted = app.status === "SHORTLISTED";

            return (
              <div
                key={app.id}
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-all space-y-5"
              >
                {/* Header Information */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                  <div className="flex items-start gap-4">
                    <div
                      className={`w-12 h-12 rounded-xl border flex items-center justify-center font-bold text-base shadow-xs shrink-0 ${color.bg} ${color.text} ${color.border}`}
                    >
                      {initials}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="font-bold text-lg text-slate-900">{app.jobTitle}</h2>
                        <span className="text-xs px-2 py-0.5 rounded-md font-mono bg-slate-100 text-slate-600 border border-slate-200">
                          {refId}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-1 font-medium">
                        <span className="text-slate-800 font-bold">{app.company}</span>
                        <span>•</span>
                        <span>
                          Applied on{" "}
                          {new Date(app.appliedAt).toLocaleString("en-IN", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </span>
                        {app.deadline && (
                          <>
                            <span>•</span>
                            <span className="text-amber-700 font-semibold">Deadline: {app.deadline}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Badges Bar */}
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Status Pill */}
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold border ${
                        app.status === "SELECTED" || app.status === "OFFER"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                          : app.status === "SHORTLISTED"
                          ? "bg-emerald-50 text-emerald-800 border-emerald-300 ring-1 ring-emerald-400/20"
                          : app.status === "REJECTED" || app.status === "NOT_ELIGIBLE"
                          ? "bg-rose-50 text-rose-700 border-rose-300"
                          : app.status === "UNDER_REVIEW"
                          ? "bg-amber-50 text-amber-800 border-amber-300"
                          : app.status === "WITHDRAWN"
                          ? "bg-slate-100 text-slate-500 border-slate-300"
                          : "bg-blue-50 text-blue-700 border-blue-300"
                      }`}
                    >
                      {app.status === "SHORTLISTED"
                        ? "✓ Shortlisted"
                        : app.status === "UNDER_REVIEW"
                        ? "Screening Under Review"
                        : app.status === "NOT_ELIGIBLE"
                        ? "Eligibility Criteria Not Met"
                        : app.status}
                    </span>

                    {/* ATS Score Badge with Clickable Breakdown */}
                    {atsScore != null && (
                      <button
                        type="button"
                        onClick={() => openAtsBreakdown(app)}
                        className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 transition-all cursor-pointer ${
                          atsScore >= 75
                            ? "bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100"
                            : atsScore >= 60
                            ? "bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-100"
                            : "bg-rose-50 text-rose-700 border-rose-300 hover:bg-rose-100"
                        }`}
                        title="Click to view ATS Score Breakdown"
                      >
                        <Icon name="check-circle" size={13} />
                        ATS Score: {atsScore}%
                      </button>
                    )}

                    {/* Active Round Badge */}
                    {app.currentRoundName && (
                      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200 flex items-center gap-1.5">
                        <Icon name={getRoundTypeIcon(app.currentRoundType || "")} size={13} />
                        {app.currentRoundName}
                      </span>
                    )}
                  </div>
                </div>

                {/* Academic Criteria Alert if failed */}
                {app.eligibilityPassed === false && app.eligibilityFailureReason && (
                  <div className="bg-rose-50/70 border border-rose-200 rounded-xl p-3 flex items-start gap-2.5 text-xs text-rose-800">
                    <Icon name="alert-circle" size={16} className="text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="font-bold">Academic Eligibility Notice: </strong>
                      {app.eligibilityFailureReason}
                    </div>
                  </div>
                )}

                {/* Pipeline Progression Bar */}
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-3">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-slate-700">
                      Recruitment Stages: Round {currentOrder} of {totalRounds}
                    </span>
                    <span className="text-blue-700">{progressPct}% Stage Progress</span>
                  </div>
                  <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                    <div
                      className="bg-blue-600 h-full rounded-full transition-all duration-500"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 pt-1">
                    <span>
                      Current Active Round:{" "}
                      <strong className="text-slate-800 font-bold">
                        {app.currentRoundName || "Initial Screening & Document Verification"}
                      </strong>
                    </span>
                    {app.overallScore != null && (
                      <span className="text-emerald-700 font-bold">
                        Cumulative Score: {app.overallScore}%
                      </span>
                    )}
                  </div>
                </div>

                {/* Footer Action Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                  <div className="text-xs text-slate-500">
                    {app.finalDecision ? (
                      <span className="font-semibold text-slate-800">
                        Final Decision: <strong className="text-emerald-700">{app.finalDecision}</strong>
                      </span>
                    ) : isShortlisted ? (
                      <span className="text-emerald-700 font-semibold flex items-center gap-1.5">
                        <Icon name="check" size={14} />
                        Shortlisted for subsequent round. Check schedule below.
                      </span>
                    ) : app.status === "UNDER_REVIEW" ? (
                      <span className="text-amber-700 font-medium">
                        Resume parsed. Awaiting recruiter confirmation.
                      </span>
                    ) : (
                      <span>Application registered under active campus recruitment drive</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openHiringProgress(app)}
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-white text-blue-700 border border-blue-200 hover:bg-blue-50 transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
                    >
                      <Icon name="trending-up" size={14} />
                      View Hiring Journey
                    </button>

                    <Link
                      href={`/jobs/hiring-progress?appId=${app.id}`}
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 transition-all flex items-center gap-1.5 shadow-xs"
                    >
                      <Icon name="play" size={14} />
                      Round Status &amp; Assessment
                    </Link>

                    {!isTerminal && (
                      <button
                        type="button"
                        disabled={withdrawing === app.id}
                        onClick={() => withdraw(app.id)}
                        className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-all cursor-pointer"
                      >
                        {withdrawing === app.id ? "Withdrawing..." : "Withdraw"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ATS SCORE BREAKDOWN MODAL */}
      <Modal
        open={atsModalOpen}
        onClose={() => setAtsModalOpen(false)}
        title={atsTargetApp ? `${atsTargetApp.company} • ATS Compatibility Score Breakdown` : "ATS Score Breakdown"}
        size="md"
      >
        {atsTargetApp && (
          <div className="space-y-4">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-500 font-semibold">Total Match Compatibility</div>
                <div className="text-2xl font-bold text-slate-900 mt-0.5">
                  {atsTargetApp.atsScore != null ? `${atsTargetApp.atsScore}%` : "Not Scored"}
                </div>
              </div>
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold border ${
                  (atsTargetApp.atsScore || 0) >= 75
                    ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                    : "bg-amber-100 text-amber-800 border-amber-300"
                }`}
              >
                {(atsTargetApp.atsScore || 0) >= 75 ? "Meets Shortlist Cutoff" : "Under Review"}
              </span>
            </div>

            {atsTargetApp.atsScoreBreakdown && (
              <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
                <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Category Breakdown
                </div>
                {(() => {
                  try {
                    const parsed = JSON.parse(atsTargetApp.atsScoreBreakdown);
                    return (
                      <div className="space-y-3 text-xs">
                        <div className="flex justify-between pb-1 border-b border-slate-100">
                          <span className="text-slate-600">Required Skills Match</span>
                          <span className="font-bold text-slate-900">{parsed.requiredSkillsScore} / {parsed.requiredSkillsMax} pts</span>
                        </div>
                        {parsed.matchedRequiredSkills?.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            <span className="text-[11px] text-slate-500 font-medium mr-1">Matched:</span>
                            {parsed.matchedRequiredSkills.map((s: string, idx: number) => (
                              <span key={idx} className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-[11px] font-semibold">
                                ✓ {s}
                              </span>
                            ))}
                          </div>
                        )}
                        {parsed.missingRequiredSkills?.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            <span className="text-[11px] text-slate-500 font-medium mr-1">Missing:</span>
                            {parsed.missingRequiredSkills.map((s: string, idx: number) => (
                              <span key={idx} className="px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded text-[11px]">
                                ✕ {s}
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="flex justify-between pb-1 border-b border-slate-100 pt-1">
                          <span className="text-slate-600">Preferred Skills Match</span>
                          <span className="font-bold text-slate-900">{parsed.preferredSkillsScore} / {parsed.preferredSkillsMax} pts</span>
                        </div>
                        <div className="flex justify-between pb-1 border-b border-slate-100">
                          <span className="text-slate-600">Experience &amp; Projects</span>
                          <span className="font-bold text-slate-900">{parsed.experienceScore} / {parsed.experienceMax} pts</span>
                        </div>
                        <div className="flex justify-between pb-1 border-b border-slate-100">
                          <span className="text-slate-600">Academic &amp; Certifications</span>
                          <span className="font-bold text-slate-900">{parsed.educationScore} / {parsed.educationMax} pts</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-600">JD Keyword Density</span>
                          <span className="font-bold text-slate-900">{parsed.keywordScore} / {parsed.keywordMax} pts</span>
                        </div>
                        {parsed.summary && (
                          <div className="mt-3 p-2.5 bg-blue-50/70 border border-blue-200 rounded-lg text-blue-900 text-xs">
                            {parsed.summary}
                          </div>
                        )}
                      </div>
                    );
                  } catch {
                    return <p className="text-xs text-slate-500">Breakdown available in recruiter dashboard.</p>;
                  }
                })()}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setAtsModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-all cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* HIRING PROGRESS JOURNEY MODAL */}
      <Modal
        open={journeyModalOpen}
        onClose={() => setJourneyModalOpen(false)}
        title={
          selectedApp
            ? `${selectedApp.company} • ${selectedApp.jobTitle} Hiring Journey`
            : "Hiring Pipeline Journey"
        }
        size="lg"
      >
        <div className="space-y-6">
          {loadingProgress ? (
            <div className="py-8 space-y-4">
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="h-20 w-full rounded-2xl" />
              <Skeleton className="h-20 w-full rounded-2xl" />
            </div>
          ) : pipelineRounds.length === 0 ? (
            <div className="text-center py-8 text-slate-500 space-y-2">
              <Icon name="briefcase" size={36} className="mx-auto text-slate-400" />
              <p className="font-semibold">Standard Recruitment Pipeline</p>
              <p className="text-xs">This company is managing candidates directly through resume review.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-xs text-slate-500 pb-2 border-b border-slate-100 flex items-center justify-between">
                <span>Configured Hiring Rounds ({pipelineRounds.length})</span>
                <span>Rounds unlock sequentially based on schedule &amp; eligibility</span>
              </div>

              <div className="space-y-3">
                {pipelineRounds.map((round, idx) => {
                  const attempts = appProgress?.roundAttempts?.filter((a) => a.roundId === round.id) || [];
                  const latestAttempt = attempts[attempts.length - 1];
                  const isShortlisted = selectedApp?.status === "SHORTLISTED";

                  let state = "LOCKED";
                  if (latestAttempt?.passed === true || latestAttempt?.status === "PASSED") {
                    state = "PASSED";
                  } else if (latestAttempt?.passed === false || latestAttempt?.status === "FAILED") {
                    state = "FAILED";
                  } else if (latestAttempt?.status === "IN_PROGRESS") {
                    state = "IN_PROGRESS";
                  } else if (latestAttempt?.status === "SCHEDULED") {
                    state = "SCHEDULED";
                  } else if (round.roundStatus === "LIVE" && isShortlisted && (idx === 0 || attempts.length > 0)) {
                    state = "AVAILABLE";
                  } else if (round.roundStatus === "SCHEDULED") {
                    state = "SCHEDULED";
                  } else {
                    state = "LOCKED";
                  }

                  const engineRoute = getRoundEngineRoute(round.roundType);

                  return (
                    <div
                      key={round.id || idx}
                      className={`p-4 rounded-2xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                        state === "AVAILABLE"
                          ? "border-blue-400 bg-blue-50/40 shadow-xs"
                          : state === "IN_PROGRESS"
                          ? "border-amber-400 bg-amber-50/40"
                          : state === "PASSED"
                          ? "border-emerald-300 bg-emerald-50/30"
                          : state === "FAILED"
                          ? "border-rose-300 bg-rose-50/30"
                          : "border-slate-200 bg-slate-50/60 opacity-80"
                      }`}
                    >
                      <div className="flex items-start gap-3.5">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 border ${
                            state === "PASSED"
                              ? "bg-emerald-600 text-white border-emerald-600"
                              : state === "AVAILABLE" || state === "IN_PROGRESS"
                              ? "bg-blue-600 text-white border-blue-600"
                              : "bg-slate-200 text-slate-600 border-slate-300"
                          }`}
                        >
                          {state === "PASSED" ? (
                            <Icon name="check" size={16} />
                          ) : (
                            idx + 1
                          )}
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-sm text-slate-900">{round.name}</h3>
                            <span className="text-[10px] px-2 py-0.5 rounded font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                              {round.roundType}
                            </span>
                            <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                              round.roundStatus === "LIVE"
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-slate-100 text-slate-600"
                            }`}>
                              {round.roundStatus || "DRAFT"}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-1">
                            <span>Duration: {round.durationMinutes || 60} mins</span>
                            {round.passingScore && <span>• Passing Cutoff: {round.passingScore}%</span>}
                            {round.startDate && (
                              <span>• Schedule: {round.startDate} {round.startTime || ""}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right Action */}
                      <div className="flex items-center gap-2 shrink-0">
                        {state === "LOCKED" && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-200 text-slate-600">
                            <Icon name="lock" size={13} />
                            Locked
                          </span>
                        )}

                        {state === "PASSED" && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <Icon name="check-circle" size={13} />
                            Cleared
                          </span>
                        )}

                        {state === "FAILED" && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
                            <Icon name="alert-circle" size={13} />
                            Did Not Clear
                          </span>
                        )}

                        {state === "AVAILABLE" && (
                          <button
                            type="button"
                            onClick={() => {
                              setJourneyModalOpen(false);
                              router.push(engineRoute);
                            }}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-all cursor-pointer"
                          >
                            <Icon name="play" size={13} />
                            Start Round Now
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
