"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  jobsApi,
  ApplicationResponse,
  HiringRoundDto,
  CandidateApplicationDetail,
  computeRoundEnd,
} from "@/lib/jobs";
import { ApiError } from "@/lib/api";
import { useToast } from "@/hooks/useToast";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import ErrorState from "@/components/ErrorState";
import { Icon } from "@/components/ui/Icon";

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

export default function HiringProgressPage() {
  const router = useRouter();
  const { push } = useToast();
  const [apps, setApps] = useState<ApplicationResponse[]>([]);
  const [selectedAppId, setSelectedAppId] = useState<number | null>(null);
  const [pipelineRounds, setPipelineRounds] = useState<HiringRoundDto[]>([]);
  const [appProgress, setAppProgress] = useState<CandidateApplicationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingPipeline, setLoadingPipeline] = useState(false);
  const [error, setError] = useState("");
  const [proctoringModalRound, setProctoringModalRound] = useState<{ round: HiringRoundDto; engineRoute: string } | null>(null);
  const [ackQuiet, setAckQuiet] = useState(false);
  const [ackHardware, setAckHardware] = useState(false);
  const [ackHonesty, setAckHonesty] = useState(false);

  useEffect(() => {
    setLoading(true);
    jobsApi.myApplications()
      .then((res) => {
        setApps(res.content);
        if (res.content.length > 0) {
          setSelectedAppId(res.content[0].id);
        }
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : "Failed to load applications"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedAppId) return;
    const currentApp = apps.find((a) => a.id === selectedAppId);
    if (!currentApp) return;

    setLoadingPipeline(true);
    Promise.all([
      jobsApi.progress(currentApp.id).catch(() => null),
      jobsApi.pipeline(currentApp.jobId).catch(() => []),
    ])
      .then(([prog, pipe]) => {
        setAppProgress(prog);
        setPipelineRounds(pipe);
      })
      .finally(() => setLoadingPipeline(false));
  }, [selectedAppId, apps]);

  const selectedApp = apps.find((a) => a.id === selectedAppId);

  function isEligibleToTakeTests(app: ApplicationResponse): boolean {
    const activeTestStatuses = [
      "SHORTLISTED",
      "ASSESSMENT_PENDING",
      "IN_PROGRESS",
      "QUALIFIED",
      "INTERVIEW",
      "INTERVIEW_SCHEDULED",
      "SELECTED",
      "OFFER",
      "OFFER_RELEASED",
      "OFFER_ACCEPTED",
    ];
    return activeTestStatuses.includes(app.status.toUpperCase());
  }

  function handleStartRound(round: HiringRoundDto, engineRoute: string) {
    setAckQuiet(false);
    setAckHardware(false);
    setAckHonesty(false);
    setProctoringModalRound({ round, engineRoute });
  }

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
          className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all flex items-center gap-2"
        >
          <Icon name="file-text" size={16} />
          My Applications
        </Link>
        <Link
          href="/jobs/hiring-progress"
          className="px-4 py-2 rounded-xl text-sm font-bold bg-blue-50 text-blue-700 border border-blue-200 shadow-xs flex items-center gap-2"
        >
          <Icon name="trending-up" size={16} />
          Hiring Progress
        </Link>
      </div>

      {/* Header */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight font-display text-slate-900">
              Active Hiring Pipeline Journey
            </h1>
            <p className="text-sm text-slate-500">
              Interactive round-by-round roadmap across your registered campus drives.
            </p>
          </div>
          <Link
            href="/jobs/applications"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-white text-blue-700 border border-blue-200 hover:bg-blue-50 transition-all"
          >
            <Icon name="chevron-left" size={14} />
            Back to Applications
          </Link>
        </div>

        {/* Company Pills */}
        {apps.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pt-5 mt-5 border-t border-slate-100 scrollbar-none">
            {apps.map((a) => {
              const active = a.id === selectedAppId;
              return (
                <button
                  key={a.id}
                  onClick={() => setSelectedAppId(a.id)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all shrink-0 cursor-pointer flex items-center gap-2 ${
                    active
                      ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <span>{a.company}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"}`}>
                    {a.jobTitle}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {error && <ErrorState message={error} onRetry={() => window.location.reload()} />}

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-40 rounded-2xl" />
        </div>
      ) : apps.length === 0 ? (
        <EmptyState
          icon="trending-up"
          title="No Active Hiring Processes"
          description="You don't have any applications under active hiring review yet."
          action={
            <Link href="/jobs" className="btn-primary btn-sm">
              <Icon name="search" size={14} />
              Explore Open Drives
            </Link>
          }
        />
      ) : !selectedApp ? null : (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
          {/* Header of selected application */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-xl font-bold text-slate-900">{selectedApp.jobTitle}</h2>
              <p className="text-xs text-slate-500 font-medium mt-1">
                Company: <strong className="text-slate-800">{selectedApp.company}</strong> • Application Status:{" "}
                <span className={`font-bold px-2 py-0.5 rounded text-xs ${
                  selectedApp.status === "SHORTLISTED"
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : selectedApp.status === "DISQUALIFIED" || selectedApp.status === "REJECTED"
                    ? "bg-rose-50 text-rose-700 border border-rose-200"
                    : selectedApp.status === "PENDING_ATS_REVIEW" || selectedApp.status === "UNDER_REVIEW"
                    ? "bg-amber-50 text-amber-800 border border-amber-200"
                    : "bg-blue-50 text-blue-700 border border-blue-200"
                }`}>
                  {selectedApp.status}
                </span>
              </p>
            </div>
            <div className="flex items-center gap-3">
              {selectedApp.atsScore != null && (
                <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-1.5">
                  <Icon name="file-text" size={13} />
                  ATS Match: {selectedApp.atsScore}%
                </span>
              )}
              {selectedApp.overallScore != null && (
                <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                  Overall Score: {selectedApp.overallScore}%
                </span>
              )}
            </div>
          </div>

          {/* Academic / Screening Warning if not shortlisted */}
          {!isEligibleToTakeTests(selectedApp) && (
            <div className={`p-4 rounded-xl text-xs border flex items-start gap-3 ${
              selectedApp.status === "DISQUALIFIED" || selectedApp.status === "REJECTED" || selectedApp.eligibilityPassed === false
                ? "bg-rose-50 text-rose-800 border-rose-200"
                : "bg-amber-50 text-amber-800 border-amber-200"
            }`}>
              <Icon name="alert-circle" size={18} className="shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">
                  {selectedApp.eligibilityPassed === false
                    ? "Academic Eligibility Requirement Not Met"
                    : selectedApp.status === "PENDING_ATS_REVIEW" || selectedApp.status === "UNDER_REVIEW" || selectedApp.status === "APPLIED"
                    ? "Resume Screening & Shortlisting in Progress"
                    : "Assessment Access Restricted"}
                </p>
                <p className="mt-0.5 text-xs opacity-90">
                  {selectedApp.eligibilityFailureReason || (
                    selectedApp.status === "PENDING_ATS_REVIEW" || selectedApp.status === "UNDER_REVIEW" || selectedApp.status === "APPLIED"
                      ? "Your application is currently being evaluated against job criteria. Assessment rounds will unlock automatically once your profile is shortlisted by the recruitment team."
                      : "You are not currently eligible to access assessment rounds for this drive."
                  )}
                </p>
              </div>
            </div>
          )}

          {loadingPipeline ? (
            <div className="space-y-3">
              <Skeleton className="h-16 rounded-xl" />
              <Skeleton className="h-16 rounded-xl" />
              <Skeleton className="h-16 rounded-xl" />
            </div>
          ) : pipelineRounds.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <Icon name="briefcase" size={32} className="mx-auto text-slate-400 mb-2" />
              <p className="font-semibold text-sm">Standard Profile Evaluation</p>
              <p className="text-xs text-slate-400">Company evaluates candidates via resume and direct contact.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Configured Hiring Pipeline ({pipelineRounds.length} Stages)
              </div>

              <div className="space-y-3">
                {pipelineRounds.map((round, idx) => {
                  const attempts = appProgress?.roundAttempts?.filter((a) => a.roundId === round.id) || [];
                  const latestAttempt = attempts[attempts.length - 1];

                  // Check if previous round was passed
                  let prevRoundPassed = idx === 0;
                  if (idx > 0) {
                    const prevRound = pipelineRounds[idx - 1];
                    const prevAttempts = appProgress?.roundAttempts?.filter((a) => a.roundId === prevRound.id) || [];
                    prevRoundPassed = prevAttempts.some((a) => a.passed === true || a.status === "PASSED");
                  }

                  const isCandidateEligible = isEligibleToTakeTests(selectedApp);
                  const isDisqualified = selectedApp.status === "DISQUALIFIED" || selectedApp.status === "REJECTED";

                  // Schedule window check
                  const roundStatus = (round.roundStatus || "READY").toUpperCase();
                  const isLiveOrActivated = roundStatus === "LIVE" || round.isActivated === true;
                  const isPaused = roundStatus === "PAUSED";
                  const isClosed = roundStatus === "CLOSED" || roundStatus === "COMPLETED";
                  const isDraft = roundStatus === "DRAFT";

                  // Parse Date Window
                  let isUpcoming = false;
                  let isExpired = false;
                  let formattedScheduleLabel = "";

                  if (round.startDate) {
                    try {
                      const startStr = `${round.startDate}T${round.startTime || "00:00:00"}`;
                      const startObj = new Date(startStr);
                      const now = new Date();
                      if (!isNaN(startObj.getTime())) {
                        isUpcoming = now < startObj;
                        const diffMs = startObj.getTime() - now.getTime();
                        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
                        formattedScheduleLabel = isUpcoming
                          ? (diffDays > 1 ? `Opens in ${diffDays} days (${round.startDate} ${round.startTime || ""})` : `Opens today at ${round.startTime || ""}`)
                          : `Started ${round.startDate}`;
                      }
                    } catch {}
                  }

                  if (round.endDate) {
                    try {
                      const endStr = `${round.endDate}T${round.endTime || "23:59:59"}`;
                      const endObj = new Date(endStr);
                      const now = new Date();
                      if (!isNaN(endObj.getTime())) {
                        isExpired = now > endObj;
                      }
                    } catch {}
                  }

                  // Determine state from 11 possible states
                  let state = "LOCKED";
                  let lockReason = "";

                  if (isDisqualified) {
                    state = latestAttempt?.passed ? "PASSED" : "LOCKED";
                    lockReason = "Disqualified";
                  } else if (latestAttempt?.passed === true || latestAttempt?.status === "PASSED") {
                    state = "PASSED";
                  } else if (latestAttempt?.passed === false || latestAttempt?.status === "FAILED") {
                    state = "FAILED";
                  } else if (latestAttempt?.status === "EVALUATING" || latestAttempt?.status === "SUBMITTED") {
                    state = latestAttempt.status;
                  } else if (latestAttempt?.status === "IN_PROGRESS") {
                    state = "IN_PROGRESS";
                  } else if (isExpired) {
                    state = "LOCKED";
                    lockReason = "Assessment Window Closed";
                  } else if (isUpcoming) {
                    state = "SCHEDULED";
                    lockReason = formattedScheduleLabel || `Opens on ${round.startDate}`;
                  } else if (roundStatus === "SCHEDULED") {
                    state = "SCHEDULED";
                    lockReason = formattedScheduleLabel || "Scheduled Window";
                  } else if (!isCandidateEligible) {
                    state = "LOCKED";
                    lockReason = "Shortlisting Required";
                  } else if (!prevRoundPassed) {
                    state = "LOCKED";
                    lockReason = `Requires Round ${idx} Clearance`;
                  } else if (isDraft) {
                    state = "LOCKED";
                    lockReason = "Round in Draft";
                  } else if (isPaused) {
                    state = "ON_HOLD";
                    lockReason = "Paused by Recruiter";
                  } else if (isClosed) {
                    state = "LOCKED";
                    lockReason = "Window Closed";
                  } else if (isLiveOrActivated || prevRoundPassed) {
                    state = "AVAILABLE";
                  } else {
                    state = "LOCKED";
                  }

                  // Dedicated proctored assessment route for company round
                  const engineRoute = `/jobs/assessment/${round.id}?appId=${selectedApp.id}`;

                  return (
                    <div
                      key={round.id || idx}
                      className={`p-4 rounded-2xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                        state === "AVAILABLE"
                          ? "border-blue-400 bg-blue-50/40 shadow-xs"
                          : state === "IN_PROGRESS"
                          ? "border-amber-400 bg-amber-50/40"
                          : state === "SUBMITTED" || state === "EVALUATING"
                          ? "border-purple-300 bg-purple-50/30"
                          : state === "PASSED"
                          ? "border-emerald-300 bg-emerald-50/30"
                          : state === "FAILED"
                          ? "border-rose-300 bg-rose-50/30"
                          : state === "ON_HOLD"
                          ? "border-amber-300 bg-amber-50/20"
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
                          {state === "PASSED" ? <Icon name="check" size={16} /> : idx + 1}
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-sm text-slate-900">{round.name}</h3>
                            <span className="text-[10px] px-2 py-0.5 rounded font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                              {round.roundType}
                            </span>
                            {round.roundStatus && round.roundStatus !== "READY" && (
                              <span className={`text-[9px] px-1.5 py-0.5 rounded font-extrabold uppercase ${
                                round.roundStatus === "LIVE"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : round.roundStatus === "SCHEDULED"
                                  ? "bg-blue-100 text-blue-800"
                                  : "bg-slate-200 text-slate-700"
                              }`}>
                                {round.roundStatus}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-1">
                            <span>Duration: {round.durationMinutes || 60} mins</span>
                            {round.passingScore && <span>• Cutoff: {round.passingScore}%</span>}
                            {round.startDate && round.startTime && (() => {
                              const calculatedEnd = round.endDate && round.endTime
                                ? { endDate: round.endDate, endTime: round.endTime }
                                : computeRoundEnd(round.startDate, round.startTime, round.durationMinutes || 60);

                              const sameDay = !calculatedEnd || calculatedEnd.endDate === round.startDate;
                              const endFormatted = calculatedEnd
                                ? (sameDay ? calculatedEnd.endTime : `${calculatedEnd.endDate} ${calculatedEnd.endTime}`)
                                : "";

                              return (
                                <span className="font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                  📅 Schedule: {round.startDate} {round.startTime} {endFormatted ? `– ${endFormatted}` : ""} ({round.timezone || "IST"})
                                </span>
                              );
                            })()}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {state === "LOCKED" && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-200 text-slate-600">
                            <Icon name="lock" size={13} />
                            {lockReason || "Locked"}
                          </span>
                        )}

                        {(state === "SUBMITTED" || state === "EVALUATING") && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200">
                            <Icon name="clock" size={13} />
                            Evaluating Submission
                          </span>
                        )}

                        {state === "ON_HOLD" && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                            <Icon name="alert-circle" size={13} />
                            {lockReason || "On Hold"}
                          </span>
                        )}

                        {state === "SKIPPED" && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
                            Skipped
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
                            Failed
                          </span>
                        )}

                        {state === "SCHEDULED" && (
                          <div className="text-right">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
                              <Icon name="clock" size={13} />
                              Scheduled
                            </span>
                            {latestAttempt?.interviewerMeetingLink ? (
                              <a
                                href={latestAttempt.interviewerMeetingLink}
                                target="_blank"
                                rel="noreferrer"
                                className="block text-xs font-bold text-blue-600 hover:underline mt-1"
                              >
                                Join Meeting &rarr;
                              </a>
                            ) : round.startDate ? (
                              <p className="text-[10px] text-slate-500 mt-0.5">
                                Opens on {round.startDate} {round.startTime || ""}
                              </p>
                            ) : null}
                          </div>
                        )}

                        {(state === "AVAILABLE" || state === "IN_PROGRESS") && (
                          <button
                            type="button"
                            onClick={() => handleStartRound(round, engineRoute)}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-all cursor-pointer"
                          >
                            <Icon name="play" size={13} />
                            {state === "IN_PROGRESS" ? "Resume Round" : "Start Round"}
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
      )}

      {/* Pre-Assessment Readiness & Proctoring Modal */}
      {proctoringModalRound && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-lg text-slate-900">Pre-Assessment Readiness &amp; Proctoring</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {proctoringModalRound.round.name} • {proctoringModalRound.round.roundType}
                </p>
              </div>
              <button
                onClick={() => setProctoringModalRound(null)}
                className="text-slate-400 hover:text-slate-700 text-lg font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Assessment Details Bar */}
            <div className="grid grid-cols-3 gap-2 bg-slate-50 p-3 rounded-xl text-center border border-slate-200">
              <div>
                <p className="text-[10px] text-slate-500 uppercase font-bold">Duration</p>
                <p className="text-sm font-extrabold text-slate-900 mt-0.5">
                  {proctoringModalRound.round.durationMinutes || 60} Mins
                </p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500 uppercase font-bold">Cutoff Score</p>
                <p className="text-sm font-extrabold text-blue-700 mt-0.5">
                  {proctoringModalRound.round.passingScore || 60}%
                </p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500 uppercase font-bold">Max Attempts</p>
                <p className="text-sm font-extrabold text-slate-900 mt-0.5">
                  {proctoringModalRound.round.maxAttempts || 1}
                </p>
              </div>
            </div>

            {/* Proctoring Rules */}
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-600">Proctoring Requirements</p>
              <div className="space-y-1.5 text-xs text-slate-600 bg-blue-50/50 p-3 rounded-xl border border-blue-100">
                <div className="flex items-center gap-2">
                  <Icon name="check-circle" size={14} className="text-blue-600 shrink-0" />
                  <span><strong>Full-Screen Mode:</strong> Assessment must run in full-screen mode throughout.</span>
                </div>
                <div className="flex items-center gap-2">
                  <Icon name="check-circle" size={14} className="text-blue-600 shrink-0" />
                  <span><strong>Webcam &amp; Audio:</strong> Continuous monitoring active during this session.</span>
                </div>
                <div className="flex items-center gap-2">
                  <Icon name="check-circle" size={14} className="text-blue-600 shrink-0" />
                  <span><strong>Anti-Tab Switch:</strong> Tab changes and window loss are flagged to recruiter.</span>
                </div>
              </div>
            </div>

            {/* Verification Checklist */}
            <div className="space-y-2.5 pt-1">
              <label className="flex items-start gap-2.5 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={ackQuiet}
                  onChange={(e) => setAckQuiet(e.target.checked)}
                  className="mt-0.5 rounded accent-blue-600"
                />
                <span>I confirm I am in a well-lit, isolated room with stable internet connectivity.</span>
              </label>

              <label className="flex items-start gap-2.5 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={ackHardware}
                  onChange={(e) => setAckHardware(e.target.checked)}
                  className="mt-0.5 rounded accent-blue-600"
                />
                <span>I authorize camera and microphone permissions required for this round.</span>
              </label>

              <label className="flex items-start gap-2.5 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={ackHonesty}
                  onChange={(e) => setAckHonesty(e.target.checked)}
                  className="mt-0.5 rounded accent-blue-600"
                />
                <span>I understand that tab switching, AI assistants, or unauthorized help will result in immediate disqualification.</span>
              </label>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setProctoringModalRound(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!ackQuiet || !ackHardware || !ackHonesty}
                onClick={() => {
                  const targetRoute = proctoringModalRound.engineRoute;
                  setProctoringModalRound(null);
                  router.push(targetRoute);
                }}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-2"
              >
                <Icon name="play" size={14} />
                Launch Assessment Environment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
