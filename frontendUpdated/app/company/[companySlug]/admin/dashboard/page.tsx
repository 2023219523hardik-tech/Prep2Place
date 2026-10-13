"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  companyAdminApi,
  CompanyDashboardStats,
  CandidateApplicationDetail,
  CompanyJobDetail,
  LiveCandidate,
} from "@/lib/jobs";
import { ApiError } from "@/lib/api";
import LoadingState from "@/components/LoadingState";
import ErrorState from "@/components/ErrorState";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/hooks/useToast";

export default function CompanyAdminDashboardPage() {
  const params = useParams();
  const router = useRouter();
  const { push } = useToast();
  const companySlug = (params.companySlug as string) || "sif360";

  const [stats, setStats] = useState<CompanyDashboardStats | null>(null);
  const [recentApplications, setRecentApplications] = useState<CandidateApplicationDetail[]>([]);
  const [activeJobs, setActiveJobs] = useState<CompanyJobDetail[]>([]);
  const [liveCandidates, setLiveCandidates] = useState<LiveCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Action Modal State
  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<LiveCandidate | CandidateApplicationDetail | null>(null);
  const [actionType, setActionType] = useState<string>("ADVANCE_ROUND");
  const [actionNotes, setActionNotes] = useState("");
  const [actionScore, setActionScore] = useState<string>("");
  const [performingAction, setPerformingAction] = useState(false);

  const loadDashboard = useCallback(async () => {
    try {
      setError("");
      const [statsRes, appsRes, jobsRes, liveRes] = await Promise.all([
        companyAdminApi.dashboard(companySlug).catch(() => null),
        companyAdminApi.applications(companySlug, undefined, { size: 6 }).catch(() => ({ content: [], total: 0, page: 0, size: 6 })),
        companyAdminApi.jobs(companySlug, { size: 5 }).catch(() => ({ content: [], total: 0, page: 0, size: 5 })),
        companyAdminApi.liveMonitoring(companySlug).catch(() => []),
      ]);

      if (statsRes) setStats(statsRes);
      setRecentApplications(appsRes.content || []);
      setActiveJobs(jobsRes.content || []);
      setLiveCandidates(liveRes || []);
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        router.push(`/company/${companySlug}/admin/login`);
        return;
      }
      setError(err instanceof ApiError ? err.message : "Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  }, [companySlug, router]);

  useEffect(() => {
    loadDashboard();
    // Poll live candidate monitor every 15 seconds
    const interval = setInterval(() => {
      companyAdminApi.liveMonitoring(companySlug)
        .then(setLiveCandidates)
        .catch(() => {});
    }, 15000);
    return () => clearInterval(interval);
  }, [loadDashboard, companySlug]);

  async function handleExecuteAction() {
    if (!selectedCandidate) return;
    const appId = "applicationId" in selectedCandidate ? selectedCandidate.applicationId : (selectedCandidate as any).id;
    if (!appId) return;

    setPerformingAction(true);
    try {
      await companyAdminApi.candidateAction(companySlug, appId, {
        action: actionType,
        notes: actionNotes.trim() || undefined,
        score: actionScore ? parseFloat(actionScore) : undefined,
      });
      push({ title: `Action "${actionType}" applied successfully!`, variant: "success" });
      setActionModalOpen(false);
      setActionNotes("");
      setActionScore("");
      loadDashboard();
    } catch (err: any) {
      push({ title: err?.message || "Failed to execute candidate action", variant: "error" });
    } finally {
      setPerformingAction(false);
    }
  }

  function openActionFor(cand: LiveCandidate | CandidateApplicationDetail) {
    setSelectedCandidate(cand);
    setActionType("ADVANCE_ROUND");
    setActionNotes("");
    setActionScore("");
    setActionModalOpen(true);
  }

  if (loading) return <LoadingState label="Loading company admin analytics & pipeline..." />;
  if (error) return <ErrorState message={error} onRetry={loadDashboard} />;

  const funnelStages = [
    { label: "Applications", count: stats?.totalApplications || 0, color: "bg-slate-200 text-slate-800" },
    { label: "Eligible", count: stats?.eligibleCandidates || 0, color: "bg-blue-100 text-blue-800" },
    { label: "Shortlisted", count: stats?.shortlistedCandidates || 0, color: "bg-indigo-100 text-indigo-800" },
    { label: "In Assessment", count: stats?.inAssessment || 0, color: "bg-purple-100 text-purple-800" },
    { label: "In Interview", count: stats?.inInterview || 0, color: "bg-amber-100 text-amber-800" },
    { label: "Selected / Offered", count: stats?.selectedCandidates || 0, color: "bg-emerald-100 text-emerald-800" },
  ];

  return (
    <div className="space-y-6">
      {/* Top Welcome & Actions Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-indigo-100 text-indigo-800">
              {companySlug.toUpperCase()} Recruitment Console
            </span>
            <span className="text-xs text-slate-400">Live Active Session</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
            Hiring Pipeline &amp; Live Monitor
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Real-time candidate monitoring, round progression, proctoring signals, and recruitment analytics.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href={`/company/${companySlug}/admin/jobs`}
            className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition-all"
          >
            Manage Drives
          </Link>
          <Link
            href={`/company/${companySlug}/admin/jobs/create`}
            className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 transition-all"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>Create New Job Drive</span>
          </Link>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <p className="text-xs font-medium text-slate-500">Total Drives</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{stats?.totalJobs || 0}</p>
          <p className="mt-1 text-[11px] text-emerald-600 font-semibold">{stats?.activeJobs || 0} currently active</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <p className="text-xs font-medium text-slate-500">Applications</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{stats?.totalApplications || 0}</p>
          <p className="mt-1 text-[11px] text-slate-400">Total candidates</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <p className="text-xs font-medium text-slate-500">Eligible</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{stats?.eligibleCandidates || 0}</p>
          <p className="mt-1 text-[11px] text-blue-600 font-semibold">Passed criteria</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <p className="text-xs font-medium text-slate-500">Shortlisted</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{stats?.shortlistedCandidates || 0}</p>
          <p className="mt-1 text-[11px] text-indigo-600 font-semibold">Ready for rounds</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <p className="text-xs font-medium text-slate-500">In Rounds</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {(stats?.inAssessment || 0) + (stats?.inInterview || 0)}
          </p>
          <p className="mt-1 text-[11px] text-purple-600 font-semibold">Assessments + HR</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <p className="text-xs font-medium text-slate-500">Offers Extended</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{stats?.selectedCandidates || 0}</p>
          <p className="mt-1 text-[11px] text-emerald-600 font-semibold">Selected</p>
        </div>
      </div>

      {/* SECTION: LIVE CANDIDATE MONITOR (REAL-TIME ASSESSMENTS) */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Live Candidate Monitor (Active Assessments &amp; Interviews)
              </h2>
              <p className="text-xs text-slate-500">
                Real-time active assessment sessions with proctoring telemetry &amp; live timers.
              </p>
            </div>
          </div>
          <span className="text-xs font-semibold px-3 py-1 rounded-full bg-slate-100 text-slate-700">
            Auto-refreshing every 15s • {liveCandidates.length} Active Now
          </span>
        </div>

        {liveCandidates.length === 0 ? (
          <div className="py-10 text-center text-slate-400 space-y-2">
            <svg className="w-10 h-10 mx-auto text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            <p className="text-xs font-semibold text-slate-600">No candidates currently taking an active round</p>
            <p className="text-[11px] text-slate-400">
              When candidates launch Aptitude, Coding Lab, SQL, DataFrame, or AI Interview rounds, live metrics will appear here.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {liveCandidates.map((cand) => {
              const hasViolation = cand.violationsCount > 0;
              const remainingMins = Math.floor(cand.remainingSeconds / 60);

              return (
                <div
                  key={cand.applicationId}
                  className={`p-4 rounded-xl border transition-all flex flex-col justify-between space-y-3 ${
                    hasViolation
                      ? "border-rose-300 bg-rose-50/40"
                      : "border-slate-200 bg-slate-50/50 hover:border-indigo-300"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-xs text-slate-900">{cand.candidateName}</h3>
                      <p className="text-[11px] text-slate-500">{cand.jobTitle}</p>
                    </div>

                    {/* Proctoring Status Pill */}
                    {hasViolation ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300 animate-pulse">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-600" />
                        Violation Detected
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-ping" />
                        Active
                      </span>
                    )}
                  </div>

                  <div className="space-y-1.5 text-[11px] text-slate-600">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-slate-500">Round:</span>
                      <span className="font-bold text-indigo-700">{cand.roundName}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-slate-500">Type:</span>
                      <span className="font-semibold text-slate-700">{cand.roundType}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-slate-500">Time Remaining:</span>
                      <span className="font-bold text-slate-900 tabular-nums">
                        {remainingMins > 0 ? `${remainingMins} mins` : "Wrapping Up"}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => openActionFor(cand)}
                    className="w-full py-1.5 rounded-lg text-xs font-bold bg-white border border-slate-200 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-300 transition-all cursor-pointer"
                  >
                    Recruiter Action &rarr;
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Recruitment Funnel Visualizer */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
        <h2 className="text-sm font-bold text-slate-900">Recruitment Funnel Overview</h2>
        <p className="text-xs text-slate-400 mt-0.5">Distribution of candidate volume across hiring stages</p>

        <div className="mt-6 space-y-3">
          {funnelStages.map((stage, idx) => {
            const maxVal = Math.max(...funnelStages.map((s) => s.count), 1);
            const pct = Math.max(5, Math.round((stage.count / maxVal) * 100));

            return (
              <div key={idx} className="flex items-center gap-3 text-xs">
                <span className="w-36 font-medium text-slate-600 truncate">{stage.label}</span>
                <div className="flex-1 overflow-hidden rounded-full bg-slate-100 h-3">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      stage.label.includes("Selected") ? "bg-emerald-500" : "bg-indigo-600"
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="w-12 text-right font-bold text-slate-900">{stage.count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Drives and Recent Applications Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Active Drives */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-sm font-bold text-slate-900">Active Job Postings</h2>
            <Link
              href={`/company/${companySlug}/admin/jobs`}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
            >
              View All ({activeJobs.length})
            </Link>
          </div>

          <div className="mt-4 divide-y divide-slate-100">
            {activeJobs.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                No active drives posted yet.{" "}
                <Link href={`/company/${companySlug}/admin/jobs/create`} className="text-indigo-600 underline">
                  Post your first drive
                </Link>
              </div>
            ) : (
              activeJobs.map((job) => (
                <div key={job.id} className="flex items-center justify-between py-3">
                  <div className="min-w-0 flex-1 pr-4">
                    <Link
                      href={`/company/${companySlug}/admin/jobs/${job.id}`}
                      className="font-bold text-xs text-slate-900 hover:text-indigo-600 truncate block"
                    >
                      {job.title}
                    </Link>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {job.department || "Engineering"} • {job.jobType || job.employmentType} • ₹{job.salaryMin ?? job.salaryMinLpa}–{job.salaryMax ?? job.salaryMaxLpa} LPA
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                      {job.status}
                    </span>
                    <Link
                      href={`/company/${companySlug}/admin/jobs/${job.id}/applications`}
                      className="rounded border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
                    >
                      Candidates
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Applications */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-sm font-bold text-slate-900">Recent Applications</h2>
            <Link
              href={`/company/${companySlug}/admin/candidates`}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
            >
              All Candidates
            </Link>
          </div>

          <div className="mt-4 divide-y divide-slate-100">
            {recentApplications.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                No student applications received yet.
              </div>
            ) : (
              recentApplications.map((app) => (
                <div key={app.applicationId} className="flex items-center justify-between py-3">
                  <div className="min-w-0 flex-1 pr-4">
                    <p className="font-bold text-xs text-slate-900 truncate">{app.applicantName}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                      {app.jobTitle} • {app.applicantCollege || "Candidate"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <span className="rounded bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
                        {app.applicationStatus}
                      </span>
                      {app.currentRoundName && (
                        <p className="text-[10px] text-slate-400 mt-0.5">{app.currentRoundName}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => openActionFor(app)}
                      className="rounded border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                    >
                      Action
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* RECRUITER CANDIDATE ACTION MODAL */}
      <Modal
        open={actionModalOpen}
        onClose={() => setActionModalOpen(false)}
        title={
          selectedCandidate
            ? `Recruiter Action: ${"candidateName" in selectedCandidate ? selectedCandidate.candidateName : (selectedCandidate as any).applicantName}`
            : "Candidate Action"
        }
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Action to Perform</label>
            <select
              value={actionType}
              onChange={(e) => setActionType(e.target.value)}
              className="w-full rounded-xl border border-slate-200 p-2.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="ADVANCE_ROUND">Advance to Next Round (Automatic Unlock)</option>
              <option value="MANUAL_PASS">Manual Pass Round</option>
              <option value="MANUAL_FAIL">Manual Fail Round</option>
              <option value="ALLOW_REATTEMPT">Allow Candidate Re-attempt</option>
              <option value="SHORTLIST">Shortlist Candidate</option>
              <option value="PUT_ON_HOLD">Put on Hold</option>
              <option value="DISQUALIFY">Disqualify Candidate (Revoke Session & Lock Drive)</option>
              <option value="REJECT">Reject Candidate</option>
              <option value="ADD_NOTE">Add Recruiter Note Only</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Score (Optional %)</label>
            <input
              type="number"
              min="0"
              max="100"
              placeholder="e.g. 85.5"
              value={actionScore}
              onChange={(e) => setActionScore(e.target.value)}
              className="w-full rounded-xl border border-slate-200 p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Notes &amp; Internal Feedback</label>
            <textarea
              rows={3}
              placeholder="Enter internal recruiter notes or evaluation feedback..."
              value={actionNotes}
              onChange={(e) => setActionNotes(e.target.value)}
              className="w-full rounded-xl border border-slate-200 p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setActionModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={performingAction}
              onClick={handleExecuteAction}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs cursor-pointer"
            >
              {performingAction ? "Processing..." : "Confirm Action"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
