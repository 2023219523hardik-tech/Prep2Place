"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  companyAdminApi,
  CandidateApplicationDetail,
  CompanyJobDetail,
  RoundAttemptDetail,
  AtsScreeningStats,
} from "@/lib/jobs";
import { ApiError } from "@/lib/api";
import LoadingState from "@/components/LoadingState";
import ErrorState from "@/components/ErrorState";
import CandidateResumeViewerModal from "@/components/CandidateResumeViewerModal";

export default function JobApplicationsPage() {
  const params = useParams();
  const router = useRouter();
  const companySlug = (params.companySlug as string) || "sif360";
  const jobId = Number(params.jobId as string);

  const [job, setJob] = useState<CompanyJobDetail | null>(null);
  const [applications, setApplications] = useState<CandidateApplicationDetail[]>([]);
  const [atsStats, setAtsStats] = useState<AtsScreeningStats | null>(null);
  const [cutoffFilter, setCutoffFilter] = useState<number>(0);
  const [screeningTab, setScreeningTab] = useState<"ALL" | "SHORTLISTED" | "REVIEW" | "BELOW_CUTOFF" | "INELIGIBLE">("ALL");
  const [selectedStatus, setSelectedStatus] = useState("ALL");
  const [selectedRoundId, setSelectedRoundId] = useState<number | "ALL">("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Modals state
  const [activeResumeApp, setActiveResumeApp] = useState<CandidateApplicationDetail | null>(null);
  const [activeAtsModalApp, setActiveAtsModalApp] = useState<CandidateApplicationDetail | null>(null);
  const [overrideAction, setOverrideAction] = useState<string>("SHORTLIST");
  const [overrideNotes, setOverrideNotes] = useState<string>("");
  const [overrideScore, setOverrideScore] = useState<number | "">("");

  const [evaluatingAttempt, setEvaluatingAttempt] = useState<{
    app: CandidateApplicationDetail;
    attempt: RoundAttemptDetail;
  } | null>(null);
  const [evalScore, setEvalScore] = useState<number>(75);
  const [evalPassed, setEvalPassed] = useState<boolean>(true);
  const [evalFeedback, setEvalFeedback] = useState("");
  const [evalNotes, setEvalNotes] = useState("");

  const [schedulingAttempt, setSchedulingAttempt] = useState<{
    app: CandidateApplicationDetail;
    attempt: RoundAttemptDetail;
  } | null>(null);
  const [interviewTime, setInterviewTime] = useState("");
  const [meetingLink, setMeetingLink] = useState("https://meet.google.com/abc-defg-hij");
  const [interviewNotes, setInterviewNotes] = useState("");

  // Disqualification Modal State
  const [disqualifyingApp, setDisqualifyingApp] = useState<CandidateApplicationDetail | null>(null);
  const [disqualifyReason, setDisqualifyReason] = useState("PROCTORING_VIOLATION");
  const [disqualifyNotes, setDisqualifyNotes] = useState("");

  const [actionBusy, setActionBusy] = useState(false);

  useEffect(() => {
    loadData();
  }, [companySlug, jobId, selectedStatus]);

  async function loadData() {
    try {
      setLoading(true);
      const [jobRes, appsRes, statsRes] = await Promise.all([
        companyAdminApi.getJob(companySlug, jobId),
        companyAdminApi.applications(companySlug, jobId, {
          status: selectedStatus === "ALL" ? undefined : selectedStatus,
          size: 50,
        }),
        companyAdminApi.getAtsStats(companySlug, jobId).catch(() => null),
      ]);
      setJob(jobRes);
      setApplications(appsRes.content || []);
      setAtsStats(statsRes);
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        router.push(`/company/${companySlug}/admin/login`);
        return;
      }
      setError(err instanceof ApiError ? err.message : "Failed to load candidates");
    } finally {
      setLoading(false);
    }
  }

  async function handleEvaluateSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!evaluatingAttempt) return;
    setActionBusy(true);
    try {
      await companyAdminApi.evaluateRound(companySlug, evaluatingAttempt.attempt.id, {
        score: evalScore,
        passed: evalPassed,
        feedback: evalFeedback,
        notes: evalNotes,
      });
      setEvaluatingAttempt(null);
      await loadData();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Failed to evaluate round");
    } finally {
      setActionBusy(false);
    }
  }

  async function handleScheduleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!schedulingAttempt || !interviewTime) return;
    setActionBusy(true);
    try {
      await companyAdminApi.scheduleInterview(companySlug, schedulingAttempt.attempt.id, {
        interviewScheduledAt: interviewTime,
        interviewerMeetingLink: meetingLink,
        notes: interviewNotes,
      });
      setSchedulingAttempt(null);
      await loadData();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Failed to schedule interview");
    } finally {
      setActionBusy(false);
    }
  }

  async function handleDecisionChange(applicationId: number, decision: string) {
    if (!window.confirm(`Set final hiring decision to "${decision}" for this candidate?`)) return;
    setActionBusy(true);
    try {
      await companyAdminApi.updateDecision(companySlug, applicationId, decision);
      await loadData();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Failed to update decision");
    } finally {
      setActionBusy(false);
    }
  }

  async function handleCandidateAction(applicationId: number, action: string, notes?: string) {
    setActionBusy(true);
    try {
      await companyAdminApi.candidateAction(companySlug, applicationId, { action, notes });
      await loadData();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Failed to execute candidate action");
    } finally {
      setActionBusy(false);
    }
  }

  async function handleDisqualifySubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!disqualifyingApp) return;
    setActionBusy(true);
    try {
      const auditNote = `[Reason: ${disqualifyReason}] ${disqualifyNotes}`.trim();
      await companyAdminApi.candidateAction(companySlug, disqualifyingApp.applicationId, {
        action: "DISQUALIFY",
        notes: auditNote,
      });
      setDisqualifyingApp(null);
      setDisqualifyNotes("");
      await loadData();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Failed to disqualify candidate");
    } finally {
      setActionBusy(false);
    }
  }

  async function handleAtsOverrideSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!activeAtsModalApp) return;
    setActionBusy(true);
    try {
      await companyAdminApi.overrideAts(companySlug, activeAtsModalApp.applicationId, {
        action: overrideAction,
        notes: overrideNotes,
        overrideAtsScore: overrideScore === "" ? undefined : Number(overrideScore),
      });
      setActiveAtsModalApp(null);
      setOverrideNotes("");
      setOverrideScore("");
      await loadData();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Failed to override ATS decision");
    } finally {
      setActionBusy(false);
    }
  }

  const configuredCutoff = job?.atsMinimumScore ?? 75;

  const filteredApplications = applications.filter((app) => {
    if (selectedRoundId !== "ALL" && app.currentRoundId !== selectedRoundId) return false;

    if (cutoffFilter > 0 && (app.atsScore == null || app.atsScore < cutoffFilter)) {
      return false;
    }

    if (screeningTab === "SHORTLISTED") {
      return app.applicationStatus === "SHORTLISTED" || (app.atsScore != null && app.atsScore >= configuredCutoff && app.eligibilityPassed !== false);
    }
    if (screeningTab === "REVIEW") {
      return app.applicationStatus === "PENDING_ATS_REVIEW" || app.applicationStatus === "UNDER_REVIEW";
    }
    if (screeningTab === "BELOW_CUTOFF") {
      return app.atsScore != null && app.atsScore < configuredCutoff;
    }
    if (screeningTab === "INELIGIBLE") {
      return app.eligibilityPassed === false || app.applicationStatus === "NOT_ELIGIBLE" || app.applicationStatus === "INELIGIBLE";
    }

    return true;
  });

  if (loading) return <LoadingState label="Loading candidate applications & round progress..." />;
  if (error && !job) return <ErrorState message={error} />;
  if (!job) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href={`/company/${companySlug}/admin/jobs/${job.id}`}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800"
            >
              ← Back to Job Details &amp; Pipeline
            </Link>
          </div>
          <div className="mt-1 flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Candidate Pipeline: {job.title}
            </h1>
            <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-bold text-indigo-700 border border-indigo-200">
              {applications.length} Total Applicants
            </span>
            {job.atsScreeningEnabled && (
              <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700 border border-emerald-200">
                ATS Auto-Screening Active (Cutoff: {configuredCutoff}%)
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            Review applicant qualifications, ATS compatibility breakdown, score round submissions, and schedule live interviews.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/company/${companySlug}/admin/jobs/${job.id}`}
            className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50"
          >
            Configure Pipeline &amp; ATS
          </Link>
        </div>
      </div>

      {/* ATS Screening Summary Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total Applied</p>
          <p className="mt-1 text-xl font-extrabold text-slate-900">
            {atsStats?.totalApplicants ?? applications.length}
          </p>
          <p className="mt-0.5 text-[10px] text-slate-400">All submissions</p>
        </div>

        <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-3.5 shadow-xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Shortlisted</p>
          <p className="mt-1 text-xl font-extrabold text-emerald-800">
            {atsStats?.shortlistedCandidates ?? applications.filter((a) => a.applicationStatus === "SHORTLISTED").length}
          </p>
          <p className="mt-0.5 text-[10px] text-emerald-600">Cleared ATS cutoff</p>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-3.5 shadow-xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Manual Review</p>
          <p className="mt-1 text-xl font-extrabold text-amber-800">
            {atsStats?.underReviewCandidates ?? applications.filter((a) => a.applicationStatus === "PENDING_ATS_REVIEW" || a.applicationStatus === "UNDER_REVIEW").length}
          </p>
          <p className="mt-0.5 text-[10px] text-amber-600">Pending recruiter decision</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Below Cutoff</p>
          <p className="mt-1 text-xl font-extrabold text-slate-700">
            {atsStats?.belowCutoffCandidates ?? applications.filter((a) => (a.atsScore ?? 0) < configuredCutoff).length}
          </p>
          <p className="mt-0.5 text-[10px] text-slate-400">&lt; {configuredCutoff}% score</p>
        </div>

        <div className="rounded-xl border border-rose-200 bg-rose-50/40 p-3.5 shadow-xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-rose-700">Academic Ineligible</p>
          <p className="mt-1 text-xl font-extrabold text-rose-800">
            {atsStats?.ineligibleCandidates ?? applications.filter((a) => a.eligibilityPassed === false).length}
          </p>
          <p className="mt-0.5 text-[10px] text-rose-600">CGPA/degree mismatch</p>
        </div>

        <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-3.5 shadow-xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-700">Avg ATS Score</p>
          <p className="mt-1 text-xl font-extrabold text-indigo-800">
            {atsStats?.averageAtsScore != null ? `${atsStats.averageAtsScore}%` : "--"}
          </p>
          <p className="mt-0.5 text-[10px] text-indigo-600">Config cutoff: {configuredCutoff}%</p>
        </div>
      </div>

      {/* Real-time Filter & Cutoff Slider */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Screening Category Tabs */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setScreeningTab("ALL")}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                screeningTab === "ALL"
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              All Applicants ({applications.length})
            </button>
            <button
              onClick={() => setScreeningTab("SHORTLISTED")}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                screeningTab === "SHORTLISTED"
                  ? "bg-emerald-600 text-white"
                  : "bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
              }`}
            >
              Shortlisted
            </button>
            <button
              onClick={() => setScreeningTab("REVIEW")}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                screeningTab === "REVIEW"
                  ? "bg-amber-600 text-white"
                  : "bg-amber-50 text-amber-800 hover:bg-amber-100"
              }`}
            >
              Needs Review
            </button>
            <button
              onClick={() => setScreeningTab("BELOW_CUTOFF")}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                screeningTab === "BELOW_CUTOFF"
                  ? "bg-slate-700 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Below Cutoff
            </button>
            <button
              onClick={() => setScreeningTab("INELIGIBLE")}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                screeningTab === "INELIGIBLE"
                  ? "bg-rose-600 text-white"
                  : "bg-rose-50 text-rose-800 hover:bg-rose-100"
              }`}
            >
              Academic Ineligible
            </button>
          </div>

          {/* Cutoff Filter Slider */}
          <div className="flex items-center gap-3 bg-slate-50 px-3.5 py-1.5 rounded-xl border border-slate-200">
            <span className="text-xs font-bold text-slate-600">Cutoff Filter:</span>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={cutoffFilter}
              onChange={(e) => setCutoffFilter(Number(e.target.value))}
              className="w-28 accent-indigo-600 cursor-pointer"
            />
            <span className="text-xs font-extrabold text-indigo-700 min-w-[48px]">
              {cutoffFilter === 0 ? "Off" : `≥ ${cutoffFilter}%`}
            </span>
            {cutoffFilter > 0 && (
              <button
                type="button"
                onClick={() => setCutoffFilter(0)}
                className="text-[10px] text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Pipeline Rounds Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-1">
            <button
              onClick={() => setSelectedRoundId("ALL")}
              className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                selectedRoundId === "ALL"
                  ? "bg-indigo-600 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              All Pipeline Rounds
            </button>
            {job.rounds?.map((r) => (
              <button
                key={r.id || r.roundOrder}
                onClick={() => setSelectedRoundId(r.id || r.roundOrder)}
                className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                  selectedRoundId === (r.id || r.roundOrder)
                    ? "bg-indigo-600 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                R{r.roundOrder}: {r.roundType}
              </button>
            ))}
          </div>

          {/* Status Dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">Status:</span>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 outline-none"
            >
              <option value="ALL">All Statuses</option>
              <option value="APPLIED">Applied</option>
              <option value="PENDING_ATS_REVIEW">Pending ATS Review</option>
              <option value="SHORTLISTED">Shortlisted</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="ASSESSMENT_PENDING">Assessment Pending</option>
              <option value="INTERVIEW_SCHEDULED">Interview Scheduled</option>
              <option value="QUALIFIED">Qualified</option>
              <option value="SELECTED">Selected / Offered</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>
        </div>
      </div>

      {/* Applications Table */}
      {filteredApplications.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <p className="text-sm font-bold text-slate-700">No candidate applications in this stage</p>
          <p className="mt-1 text-xs text-slate-400">
            When students apply with their verified resumes, they will appear in Round 1 of this pipeline.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="border-b border-slate-200 bg-slate-50/70 font-semibold text-slate-700">
              <tr>
                <th className="py-3 px-4">Candidate Profile</th>
                <th className="py-3 px-4">Academic Background</th>
                <th className="py-3 px-4">ATS Match &amp; Cutoff</th>
                <th className="py-3 px-4">Current Pipeline Stage</th>
                <th className="py-3 px-4">Score &amp; Verdict</th>
                <th className="py-3 px-4">Resume</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredApplications.map((app) => {
                const latestAttempt = app.roundAttempts && app.roundAttempts.length > 0
                  ? app.roundAttempts[app.roundAttempts.length - 1]
                  : null;

                return (
                  <tr key={app.applicationId} className="hover:bg-slate-50/50 transition">
                    {/* Name & Contact */}
                    <td className="py-3.5 px-4">
                      <p className="font-bold text-slate-900 text-sm">{app.applicantName}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">{app.applicantEmail}</p>
                      {app.applicantPhone && (
                        <p className="text-[10px] text-slate-400 font-mono">{app.applicantPhone}</p>
                      )}
                    </td>

                    {/* Academic details */}
                    <td className="py-3.5 px-4">
                      <p className="font-semibold text-slate-800">{app.applicantCollege || "University Student"}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {app.applicantBranch || "CSE"} • {app.applicantGraduationYear || "2027"}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[11px] font-bold text-indigo-600">
                          CGPA: {app.applicantCgpa ?? "N/A"}
                        </span>
                        {app.eligibilityPassed === false ? (
                          <span className="rounded bg-rose-50 px-1.5 py-0.5 text-[9px] font-bold text-rose-700 border border-rose-200" title={app.eligibilityFailureReason || "Academic criteria not met"}>
                            Criteria Failed
                          </span>
                        ) : app.eligibilityPassed === true ? (
                          <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700 border border-emerald-200">
                            Eligible
                          </span>
                        ) : null}
                      </div>
                    </td>

                    {/* ATS Match & Cutoff */}
                    <td className="py-3.5 px-4">
                      {app.atsScore != null ? (
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className={`px-2 py-0.5 rounded text-xs font-extrabold ${
                              app.atsScore >= configuredCutoff
                                ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                : app.atsScore >= 50
                                ? "bg-amber-100 text-amber-800 border border-amber-300"
                                : "bg-slate-100 text-slate-700 border border-slate-300"
                            }`}>
                              {app.atsScore}% ATS
                            </span>
                            <span className="text-[10px] text-slate-400 font-medium">
                              (Cutoff: {configuredCutoff}%)
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setActiveAtsModalApp(app);
                              setOverrideAction(app.applicationStatus === "SHORTLISTED" ? "SHORTLIST" : "SHORTLIST");
                              setOverrideNotes(app.recruiterAuditNotes || "");
                              setOverrideScore(app.atsScore ?? "");
                            }}
                            className="mt-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                          >
                            <span>Inspect Breakdown</span>
                            <span>&rarr;</span>
                          </button>
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400">
                          {app.atsParsingStatus === "PARSING_FAILED" ? "Parsing Failed" : "Not Screened"}
                        </span>
                      )}
                    </td>

                    {/* Current Stage */}
                    <td className="py-3.5 px-4">
                      <span className="rounded bg-indigo-50 px-2 py-0.5 text-xs font-bold text-indigo-700">
                        {app.currentRoundName || "Initial Screening"}
                      </span>
                      <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                        {app.applicationStatus === "DISQUALIFIED" ? (
                          <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-extrabold text-rose-700 border border-rose-200 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                            DISQUALIFIED
                          </span>
                        ) : app.applicationStatus === "SHORTLISTED" ? (
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                            SHORTLISTED
                          </span>
                        ) : app.applicationStatus === "PENDING_ATS_REVIEW" || app.applicationStatus === "UNDER_REVIEW" ? (
                          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 border border-amber-200">
                            PENDING REVIEW
                          </span>
                        ) : app.applicationStatus === "ELIGIBLE" ? (
                          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 border border-amber-200">
                            ELIGIBLE
                          </span>
                        ) : app.applicationStatus === "NOT_ELIGIBLE" ? (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 border border-slate-200">
                            NOT ELIGIBLE
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-500">
                            Status: <strong className="text-slate-700">{app.applicationStatus}</strong>
                          </span>
                        )}
                      </div>
                      {latestAttempt?.interviewScheduledAt && (
                        <p className="text-[10px] text-amber-700 font-semibold mt-1">
                          📅 {new Date(latestAttempt.interviewScheduledAt).toLocaleString()}
                        </p>
                      )}
                    </td>

                    {/* Score */}
                    <td className="py-3.5 px-4">
                      <div className="font-mono text-xs">
                        <span className="font-bold text-slate-900">
                          {app.overallScore !== null ? `${app.overallScore} pts` : "--"}
                        </span>
                        {app.finalDecision && (
                          <p className="text-[10px] font-bold uppercase text-emerald-600 mt-0.5">
                            {app.finalDecision}
                          </p>
                        )}
                      </div>
                    </td>

                    {/* Resume */}
                    <td className="py-3.5 px-4">
                      <button
                        onClick={() => setActiveResumeApp(app)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50/70 px-2.5 py-1 text-[11px] font-bold text-indigo-700 hover:bg-indigo-100 transition cursor-pointer"
                        title={app.resumeFileName ? `Original: ${app.resumeFileName}` : "View candidate resume dossier"}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                        </svg>
                        <span>{app.resumeFileName ? "Resume File" : "View Resume"}</span>
                      </button>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5 flex-wrap">
                        {/* ATS Audit Button */}
                        <button
                          onClick={() => {
                            setActiveAtsModalApp(app);
                            setOverrideAction(app.applicationStatus === "SHORTLISTED" ? "SHORTLIST" : "SHORTLIST");
                            setOverrideNotes(app.recruiterAuditNotes || "");
                            setOverrideScore(app.atsScore ?? "");
                          }}
                          className="rounded border border-indigo-200 bg-indigo-50 px-2 py-1 text-[10px] font-bold text-indigo-700 hover:bg-indigo-100 transition cursor-pointer"
                          title="Inspect ATS breakdown and override screening decision"
                        >
                          ATS Audit
                        </button>

                        {/* Screening Action Buttons if in applied / under review state */}
                        {(app.applicationStatus === "APPLIED" || app.applicationStatus === "UNDER_REVIEW") && (
                          <>
                            <button
                              onClick={() => handleCandidateAction(app.applicationId, "SCREEN_ELIGIBLE")}
                              className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700 hover:bg-emerald-100 transition"
                              title="Mark candidate resume as eligible"
                            >
                              Eligible
                            </button>
                            <button
                              onClick={() => handleCandidateAction(app.applicationId, "SCREEN_NOT_ELIGIBLE")}
                              className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-semibold text-slate-600 hover:bg-slate-100 transition"
                              title="Mark candidate resume as not eligible"
                            >
                              Ineligible
                            </button>
                          </>
                        )}

                        {/* Evaluate Round Button */}
                        {latestAttempt && (
                          <button
                            onClick={() => {
                              setEvaluatingAttempt({ app, attempt: latestAttempt });
                              setEvalScore(latestAttempt.score || 75);
                              setEvalPassed(latestAttempt.passed ?? true);
                              setEvalFeedback(latestAttempt.feedback || "");
                              setEvalNotes(latestAttempt.notes || "");
                            }}
                            className="rounded border border-purple-200 bg-purple-50 px-2 py-1 text-[11px] font-bold text-purple-700 hover:bg-purple-100"
                          >
                            Score Round
                          </button>
                        )}

                        {/* Schedule Interview Button */}
                        {latestAttempt && (
                          <button
                            onClick={() => {
                              setSchedulingAttempt({ app, attempt: latestAttempt });
                              setInterviewTime(latestAttempt.interviewScheduledAt || "");
                              setMeetingLink(latestAttempt.interviewerMeetingLink || "https://meet.google.com/abc-defg-hij");
                              setInterviewNotes(latestAttempt.notes || "");
                            }}
                            className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-800 hover:bg-amber-100"
                          >
                            Interview
                          </button>
                        )}

                        {/* Disqualify Button with Confirmation Modal */}
                        {app.applicationStatus !== "DISQUALIFIED" && (
                          <button
                            onClick={() => {
                              setDisqualifyingApp(app);
                              setDisqualifyReason("PROCTORING_VIOLATION");
                              setDisqualifyNotes("");
                            }}
                            className="rounded border border-rose-200 bg-rose-50 px-2 py-1 text-[10px] font-extrabold text-rose-700 hover:bg-rose-100 transition"
                            title="Disqualify candidate and terminate all active/future rounds"
                          >
                            Disqualify
                          </button>
                        )}

                        {/* Final Decision Selector */}
                        <select
                          value={app.finalDecision || app.applicationStatus}
                          onChange={(e) => handleDecisionChange(app.applicationId, e.target.value)}
                          className="rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 outline-none"
                        >
                          <option value="SHORTLISTED">Shortlist</option>
                          <option value="QUALIFIED">Qualify</option>
                          <option value="SELECTED">Select / Offer</option>
                          <option value="REJECTED">Reject</option>
                          <option value="ON_HOLD">On Hold</option>
                        </select>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ==================== RESUME VIEWER MODAL ==================== */}
      <CandidateResumeViewerModal
        candidate={activeResumeApp}
        companySlug={companySlug}
        onClose={() => setActiveResumeApp(null)}
      />

      {/* ==================== EVALUATE ROUND MODAL ==================== */}
      {evaluatingAttempt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">
                  Score Round: {evaluatingAttempt.attempt.roundName}
                </h3>
                <p className="text-[11px] text-slate-500">
                  Candidate: {evaluatingAttempt.app.applicantName}
                </p>
              </div>
              <button
                onClick={() => setEvaluatingAttempt(null)}
                className="rounded p-1 text-slate-400 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleEvaluateSubmit} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700">Evaluation Score (0 - 100)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={evalScore}
                  onChange={(e) => setEvalScore(Number(e.target.value))}
                  required
                  className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-sm font-mono font-bold text-slate-900 outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 font-bold text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={evalPassed}
                    onChange={(e) => setEvalPassed(e.target.checked)}
                    className="h-4 w-4 accent-emerald-600 rounded"
                  />
                  <span>Mark as Passed this Round</span>
                </label>
              </div>

              <div>
                <label className="block font-bold text-slate-700">Candidate Feedback (Visible to Candidate)</label>
                <textarea
                  value={evalFeedback}
                  onChange={(e) => setEvalFeedback(e.target.value)}
                  rows={2}
                  placeholder="Strong problem solving, clear explanation of trade-offs..."
                  className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-xs text-slate-900 outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700">Internal Recruiter Notes</label>
                <textarea
                  value={evalNotes}
                  onChange={(e) => setEvalNotes(e.target.value)}
                  rows={2}
                  placeholder="Recommend for final bar-raiser round..."
                  className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-xs text-slate-900 outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEvaluatingAttempt(null)}
                  className="rounded-lg border border-slate-200 px-3.5 py-1.5 font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionBusy}
                  className="rounded-lg bg-indigo-600 px-4 py-1.5 font-bold text-white shadow-xs hover:bg-indigo-700 disabled:opacity-50"
                >
                  {actionBusy ? "Saving..." : "Save Evaluation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== SCHEDULE INTERVIEW MODAL ==================== */}
      {schedulingAttempt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">
                  Schedule Live Interview: {schedulingAttempt.attempt.roundName}
                </h3>
                <p className="text-[11px] text-slate-500">
                  Candidate: {schedulingAttempt.app.applicantName}
                </p>
              </div>
              <button
                onClick={() => setSchedulingAttempt(null)}
                className="rounded p-1 text-slate-400 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleScheduleSubmit} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700">Interview Date & Time *</label>
                <input
                  type="datetime-local"
                  value={interviewTime}
                  onChange={(e) => setInterviewTime(e.target.value)}
                  required
                  className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-xs text-slate-900 outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700">Meeting Link (Google Meet / Zoom)</label>
                <input
                  type="url"
                  value={meetingLink}
                  onChange={(e) => setMeetingLink(e.target.value)}
                  placeholder="https://meet.google.com/..."
                  className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-xs font-mono text-slate-900 outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700">Interviewer Notes / Agenda</label>
                <textarea
                  value={interviewNotes}
                  onChange={(e) => setInterviewNotes(e.target.value)}
                  rows={2}
                  placeholder="Focus on concurrency, system design, and database indexing..."
                  className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-xs text-slate-900 outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSchedulingAttempt(null)}
                  className="rounded-lg border border-slate-200 px-3.5 py-1.5 font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionBusy}
                  className="rounded-lg bg-indigo-600 px-4 py-1.5 font-bold text-white shadow-xs hover:bg-indigo-700 disabled:opacity-50"
                >
                  {actionBusy ? "Scheduling..." : "Schedule Interview"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Disqualification Confirmation Modal */}
      {disqualifyingApp && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in"
          onClick={() => setDisqualifyingApp(null)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-rose-200 bg-white p-6 shadow-2xl animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start gap-3 border-b border-rose-100 pb-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-600 font-bold text-lg">
                ⚠️
              </div>
              <div className="flex-1">
                <h3 className="font-extrabold text-slate-900 text-base">
                  Confirm Candidate Disqualification
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Drive: <strong className="text-slate-800">{job.title}</strong>
                </p>
              </div>
              <button
                onClick={() => setDisqualifyingApp(null)}
                className="rounded p-1 text-slate-400 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            {/* Candidate Summary Card */}
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-900 text-sm block">
                  {disqualifyingApp.applicantName}
                </span>
                <span className="text-slate-500 font-mono text-[11px]">
                  {disqualifyingApp.applicantEmail}
                </span>
              </div>
              <span className="rounded bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-800 uppercase">
                To Be Disqualified
              </span>
            </div>

            {/* Strict Impact Warning */}
            <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50/80 p-3.5 text-xs text-rose-800 space-y-1.5">
              <div className="font-bold flex items-center gap-1.5 text-rose-900">
                <span>🛑</span>
                Immediate System Action & Impact Warning:
              </div>
              <ul className="list-disc pl-5 space-y-1 text-[11px] text-rose-700">
                <li>Any active or ongoing proctored test sessions will be immediately terminated.</li>
                <li>All remaining and subsequent rounds in this drive will be permanently locked.</li>
                <li>Audit entry with timestamps and justification note will be preserved.</li>
              </ul>
            </div>

            {/* Form */}
            <form onSubmit={handleDisqualifySubmit} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Disqualification Policy Violation Reason *
                </label>
                <select
                  value={disqualifyReason}
                  onChange={(e) => setDisqualifyReason(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 p-2 text-xs font-semibold text-slate-800 outline-none focus:border-rose-500"
                >
                  <option value="PROCTORING_VIOLATION">Proctoring Violation (Multiple faces, audio/noise flags, tab switches)</option>
                  <option value="ELIGIBILITY_CRITERIA_MISMATCH">Academic Eligibility Mismatch (CGPA / Backlogs / Branch criteria not met)</option>
                  <option value="RESUME_FRAUD_FABRICATION">Resume Fraud / Document Fabrication / Unverified claims</option>
                  <option value="BEHAVIORAL_NON_COMPLIANCE">Behavioral Non-Compliance / Interview Misconduct</option>
                  <option value="PROXY_ATTEMPT_DETECTED">Proxy Candidate / Impersonation Detected</option>
                  <option value="OTHER">Other Administrative Grounds</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Recruiter Audit Notes & Justification (Optional)
                </label>
                <textarea
                  value={disqualifyNotes}
                  onChange={(e) => setDisqualifyNotes(e.target.value)}
                  rows={2}
                  placeholder="e.g. Flagged by AI proctor with 8 tab switch violations and secondary voice detected..."
                  className="w-full rounded-lg border border-slate-200 p-2 text-xs text-slate-900 outline-none focus:border-rose-500 placeholder:text-slate-400"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setDisqualifyingApp(null)}
                  className="rounded-lg border border-slate-200 px-3.5 py-2 font-semibold text-slate-600 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionBusy}
                  className="rounded-lg bg-rose-600 px-4 py-2 font-bold text-white shadow-xs hover:bg-rose-700 transition disabled:opacity-50 flex items-center gap-1.5"
                >
                  <span>⚠️</span>
                  {actionBusy ? "Disqualifying..." : "Confirm Disqualification"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== ATS SCORE BREAKDOWN & AUDIT OVERRIDE MODAL ==================== */}
      {activeAtsModalApp && (() => {
        let breakdown: any = null;
        try {
          if (activeAtsModalApp.atsScoreBreakdown) {
            breakdown = JSON.parse(activeAtsModalApp.atsScoreBreakdown);
          }
        } catch {}

        const matchedSkills: string[] = breakdown?.matchedSkills || [];
        const missingSkills: string[] = breakdown?.missingSkills || [];

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs animate-fade-in">
            <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    ATS Resume Compatibility &amp; Screening Audit
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Candidate: <strong>{activeAtsModalApp.applicantName}</strong> ({activeAtsModalApp.applicantEmail})
                  </p>
                </div>
                <button
                  onClick={() => setActiveAtsModalApp(null)}
                  className="rounded p-1 text-slate-400 hover:text-slate-700 font-bold text-lg cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Top Summary Comparison */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl border p-3 text-center bg-indigo-50/50 border-indigo-200">
                  <p className="text-[10px] font-bold text-indigo-700 uppercase">ATS Score</p>
                  <p className="text-2xl font-black text-indigo-950 mt-1">
                    {activeAtsModalApp.atsScore ?? "--"}%
                  </p>
                  <p className="text-[10px] text-indigo-600 mt-0.5">Cutoff: {configuredCutoff}%</p>
                </div>

                <div className={`rounded-xl border p-3 text-center ${
                  activeAtsModalApp.eligibilityPassed !== false
                    ? "bg-emerald-50/50 border-emerald-200 text-emerald-800"
                    : "bg-rose-50/50 border-rose-200 text-rose-800"
                }`}>
                  <p className="text-[10px] font-bold uppercase">Academic Check</p>
                  <p className="text-lg font-black mt-1">
                    {activeAtsModalApp.eligibilityPassed !== false ? "PASSED" : "FAILED"}
                  </p>
                  <p className="text-[10px] opacity-80 mt-0.5">
                    {activeAtsModalApp.eligibilityFailureReason || "All criteria satisfied"}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center">
                  <p className="text-[10px] font-bold text-slate-500 uppercase">Current Status</p>
                  <p className="text-base font-extrabold text-slate-800 mt-1">
                    {activeAtsModalApp.applicationStatus}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Stage: {activeAtsModalApp.currentRoundName || "Screening"}
                  </p>
                </div>
              </div>

              {/* Category Score Breakdown */}
              {breakdown?.breakdown && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    Scoring Weight Distribution
                  </h4>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-5 text-center">
                    <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                      <p className="text-[10px] text-slate-500 font-semibold">Required Skills</p>
                      <p className="text-sm font-black text-slate-900 mt-0.5">{breakdown.breakdown.requiredSkills ?? "--"} pts</p>
                      <p className="text-[9px] text-slate-400">Max 40</p>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                      <p className="text-[10px] text-slate-500 font-semibold">Preferred Skills</p>
                      <p className="text-sm font-black text-slate-900 mt-0.5">{breakdown.breakdown.preferredSkills ?? "--"} pts</p>
                      <p className="text-[9px] text-slate-400">Max 15</p>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                      <p className="text-[10px] text-slate-500 font-semibold">Experience &amp; Proj</p>
                      <p className="text-sm font-black text-slate-900 mt-0.5">{breakdown.breakdown.experienceAndProjects ?? "--"} pts</p>
                      <p className="text-[9px] text-slate-400">Max 20</p>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                      <p className="text-[10px] text-slate-500 font-semibold">Academic &amp; Certs</p>
                      <p className="text-sm font-black text-slate-900 mt-0.5">{breakdown.breakdown.academicAndCertifications ?? "--"} pts</p>
                      <p className="text-[9px] text-slate-400">Max 15</p>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                      <p className="text-[10px] text-slate-500 font-semibold">JD Relevance</p>
                      <p className="text-sm font-black text-slate-900 mt-0.5">{breakdown.breakdown.keywordRelevance ?? "--"} pts</p>
                      <p className="text-[9px] text-slate-400">Max 10</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Skill Match Breakdown */}
              <div className="space-y-3">
                {matchedSkills.length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-emerald-800 mb-1.5">
                      ✓ Matched Technical Skills ({matchedSkills.length})
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {matchedSkills.map((s) => (
                        <span key={s} className="rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 text-xs font-semibold">
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {missingSkills.length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-rose-800 mb-1.5">
                      ✕ Missing Job Skills ({missingSkills.length})
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {missingSkills.map((s) => (
                        <span key={s} className="rounded-md bg-rose-50 text-rose-800 border border-rose-200 px-2 py-0.5 text-xs font-semibold">
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Academic Criteria Checks */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-2 text-xs">
                <p className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">Academic Verification</p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-slate-700">
                  <div>
                    <span className="text-slate-400 block text-[10px]">CGPA</span>
                    <strong className="text-slate-900">{activeAtsModalApp.applicantCgpa ?? "N/A"}</strong>
                    <span className="text-[10px] text-slate-500 block">Min req: {job.minCgpa ?? "None"}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Graduation Year</span>
                    <strong className="text-slate-900">{activeAtsModalApp.applicantGraduationYear ?? "N/A"}</strong>
                    <span className="text-[10px] text-slate-500 block">Required: {job.graduationYear ?? "All"}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Degree &amp; Branch</span>
                    <strong className="text-slate-900">{activeAtsModalApp.applicantDegree || "B.Tech"} - {activeAtsModalApp.applicantBranch || "CSE"}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">College</span>
                    <strong className="text-slate-900">{activeAtsModalApp.applicantCollege || "University Student"}</strong>
                  </div>
                </div>
              </div>

              {/* Recruiter Manual Override Form */}
              <form onSubmit={handleAtsOverrideSubmit} className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-900">
                    Recruiter Manual Override &amp; Decision Audit
                  </h4>
                  <span className="text-[10px] text-indigo-700 font-semibold">Action will be saved to candidate record</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Override Action *
                    </label>
                    <select
                      value={overrideAction}
                      onChange={(e) => setOverrideAction(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs font-semibold text-slate-800 outline-none"
                    >
                      <option value="SHORTLIST">Shortlist Candidate (Unlock Round 1)</option>
                      <option value="SEND_TO_REVIEW">Send to Manual Review Queue</option>
                      <option value="OVERRIDE_ELIGIBLE">Override Academic Eligibility (Mark Eligible)</option>
                      <option value="REJECT">Reject Candidate</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Score Adjustment (Optional 0–100)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={overrideScore}
                      onChange={(e) => setOverrideScore(e.target.value === "" ? "" : Number(e.target.value))}
                      placeholder={`Current: ${activeAtsModalApp.atsScore ?? 0}`}
                      className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs font-semibold text-slate-800 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Recruiter Justification &amp; Audit Note
                  </label>
                  <textarea
                    rows={2}
                    value={overrideNotes}
                    onChange={(e) => setOverrideNotes(e.target.value)}
                    placeholder="e.g. Verified exceptional GitHub projects and competitive programming profile."
                    className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-800 outline-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setActiveAtsModalApp(null)}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionBusy}
                    className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 disabled:opacity-50 cursor-pointer"
                  >
                    {actionBusy ? "Saving..." : "Apply Override & Update Candidate"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
