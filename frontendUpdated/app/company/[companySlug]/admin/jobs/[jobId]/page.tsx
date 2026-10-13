"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  companyAdminApi,
  CompanyJobDetail,
  HiringRoundDto,
  validatePipelineSchedule,
  computeRoundEnd,
  computeRoundDuration,
  suggestNextAvailableTime,
  ScheduleConflict,
} from "@/lib/jobs";
import { ApiError } from "@/lib/api";
import LoadingState from "@/components/LoadingState";
import ErrorState from "@/components/ErrorState";
import AssessmentConfigEditor from "@/components/AssessmentConfigEditor";

const PRESET_ROUND_TYPES = [
  { type: "APTITUDE", name: "Aptitude & Analytical Reasoning", duration: 60, passing: 60, mode: "AUTOMATIC" },
  { type: "TECHNICAL_MCQ", name: "Core CS & Technical MCQ", duration: 45, passing: 65, mode: "AUTOMATIC" },
  { type: "DSA", name: "Data Structures & Algorithms Challenge", duration: 90, passing: 70, mode: "AUTOMATIC" },
  { type: "SQL", name: "SQL Query Assessment", duration: 45, passing: 65, mode: "AUTOMATIC" },
  { type: "CODING_LAB", name: "Full Stack Coding Lab", duration: 90, passing: 70, mode: "AUTOMATIC" },
  { type: "DATAFRAME", name: "Pandas & Data Science Assessment", duration: 60, passing: 65, mode: "AUTOMATIC" },
  { type: "AI_INTERVIEW", name: "AI Technical Screening Interview", duration: 30, passing: 70, mode: "AUTOMATIC" },
  { type: "TECHNICAL_INTERVIEW", name: "Live Technical Architecture Round", duration: 45, passing: 70, mode: "SCHEDULED_INTERVIEW" },
  { type: "HR_INTERVIEW", name: "HR & Culture Fit Interview", duration: 30, passing: 70, mode: "SCHEDULED_INTERVIEW" },
  { type: "CUSTOM", name: "Custom Assessment Round", duration: 60, passing: 60, mode: "MANUAL_REVIEW" },
];

type SchedulingPolicyType = "SEQUENTIAL" | "INDEPENDENT";

export default function CompanyJobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const companySlug = (params.companySlug as string) || "sif360";
  const jobId = Number(params.jobId as string);

  const [job, setJob] = useState<CompanyJobDetail | null>(null);
  const [rounds, setRounds] = useState<HiringRoundDto[]>([]);
  const [schedulingPolicy, setSchedulingPolicy] = useState<SchedulingPolicyType>("SEQUENTIAL");
  const [loading, setLoading] = useState(true);
  const [savingPipeline, setSavingPipeline] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [backendConflicts, setBackendConflicts] = useState<ScheduleConflict[]>([]);

  useEffect(() => {
    loadJobDetails();
  }, [companySlug, jobId]);

  async function loadJobDetails() {
    try {
      setLoading(true);
      const res = await companyAdminApi.getJob(companySlug, jobId);
      setJob(res);
      setRounds(res.rounds || []);
      if (res.schedulingPolicy) {
        setSchedulingPolicy(res.schedulingPolicy);
      }
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        router.push(`/company/${companySlug}/admin/login`);
        return;
      }
      setError(err instanceof ApiError ? err.message : "Failed to load job details");
    } finally {
      setLoading(false);
    }
  }

  // Live schedule validation across all rounds
  const scheduleValidation = useMemo(() => {
    return validatePipelineSchedule(rounds, schedulingPolicy);
  }, [rounds, schedulingPolicy]);

  function addRound(presetType: string) {
    const preset = PRESET_ROUND_TYPES.find((p) => p.type === presetType) || PRESET_ROUND_TYPES[0];
    const newRound: HiringRoundDto = {
      roundOrder: rounds.length + 1,
      name: preset.name,
      roundType: preset.type,
      durationMinutes: preset.duration,
      passingScore: preset.passing,
      weightage: 20,
      maxAttempts: 1,
      repeatable: false,
      autoUnlock: true,
      managementMode: preset.mode,
      roundStatus: "READY",
      isActivated: false,
      startDate: "",
      startTime: "",
      endDate: "",
      endTime: "",
      timezone: "IST",
      proctoringConfig: JSON.stringify({
        webcam: true,
        microphone: true,
        fullScreen: true,
        blockTabSwitch: true,
        maxTabSwitches: 3,
      }),
    };
    setRounds([...rounds, newRound]);
  }

  function removeRound(index: number) {
    const updated = rounds.filter((_, i) => i !== index).map((r, i) => ({ ...r, roundOrder: i + 1 }));
    setRounds(updated);
  }

  function moveRound(index: number, direction: "up" | "down") {
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= rounds.length) return;
    const copy = [...rounds];
    const temp = copy[index];
    copy[index] = copy[target];
    copy[target] = temp;
    setRounds(copy.map((r, i) => ({ ...r, roundOrder: i + 1 })));
  }

  function updateRound(index: number, updates: Partial<HiringRoundDto>) {
    setRounds((prevRounds) => {
      const copy = [...prevRounds];
      const current = { ...copy[index], ...updates };

      // Two-way consistency:
      // If start date, start time, or duration changes -> auto-recalculate end date and end time
      if (
        updates.startDate !== undefined ||
        updates.startTime !== undefined ||
        updates.durationMinutes !== undefined
      ) {
        if (current.startDate && current.startTime && current.durationMinutes && current.durationMinutes > 0) {
          const computed = computeRoundEnd(current.startDate, current.startTime, current.durationMinutes);
          if (computed) {
            current.endDate = computed.endDate;
            current.endTime = computed.endTime;
          }
        }
      }
      // If explicit end date or end time changed -> recalculate duration
      else if (updates.endDate !== undefined || updates.endTime !== undefined) {
        if (current.startDate && current.startTime && current.endDate && current.endTime) {
          const computedDur = computeRoundDuration(
            current.startDate,
            current.startTime,
            current.endDate,
            current.endTime
          );
          if (computedDur && computedDur > 0) {
            current.durationMinutes = computedDur;
          }
        }
      }

      copy[index] = current;
      return copy;
    });
  }

  function handleSuggestNextTime(index: number) {
    const suggestion = suggestNextAvailableTime(rounds, index);
    if (!suggestion) return;
    updateRound(index, {
      startDate: suggestion.startDate,
      startTime: suggestion.startTime,
      endDate: suggestion.endDate,
      endTime: suggestion.endTime,
    });
  }

  async function handleSavePipeline() {
    if (!scheduleValidation.isValid) {
      setError("Cannot save pipeline: Please resolve overlapping schedule conflicts before saving.");
      return;
    }

    setSavingPipeline(true);
    setError("");
    setSuccessMsg("");
    setBackendConflicts([]);
    try {
      if (job) {
        await companyAdminApi.updateJob(companySlug, jobId, {
          ...job,
          schedulingPolicy,
          rounds,
        });
      } else {
        await companyAdminApi.updatePipeline(companySlug, jobId, rounds);
      }
      await loadJobDetails();
      setSuccessMsg("Hiring pipeline and schedules validated and updated successfully!");
      window.setTimeout(() => setSuccessMsg(""), 3500);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.data && err.data.code === "HIRING_ROUND_SCHEDULE_CONFLICT" && Array.isArray(err.data.conflicts)) {
          setBackendConflicts(err.data.conflicts);
          setError(`Schedule conflict detected by server: ${err.message}`);
        } else {
          setError(err.message);
        }
      } else {
        setError("Failed to save pipeline");
      }
    } finally {
      setSavingPipeline(false);
    }
  }

  async function handleStatusChange(status: string) {
    try {
      await companyAdminApi.updateStatus(companySlug, jobId, status);
      await loadJobDetails();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Failed to update status");
    }
  }

  if (loading) return <LoadingState label="Loading job opportunity & hiring pipeline..." />;
  if (error && !job) return <ErrorState message={error} />;
  if (!job) return null;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href={`/company/${companySlug}/admin/jobs`}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800"
            >
              ← Back to All Drives
            </Link>
          </div>
          <div className="mt-1 flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">{job.title}</h1>
            <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700 border border-emerald-200">
              {job.status}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            {job.department || "Engineering"} • {job.jobType || job.employmentType} • ₹{job.salaryMin ?? job.salaryMinLpa}–{job.salaryMax ?? job.salaryMaxLpa} LPA • {job.location}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href={`/company/${companySlug}/admin/jobs/${job.id}/applications`}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-indigo-700"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            <span>Track Candidate Pipeline</span>
          </Link>

          <select
            value={job.status}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 outline-none"
          >
            <option value="PUBLISHED">Published</option>
            <option value="DRAFT">Draft</option>
            <option value="CLOSED">Closed</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        </div>
      </div>

      {successMsg && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 font-medium">
          {successMsg}
        </div>
      )}

      {/* Grid: Job Overview & Eligibility */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column: Job Description & Eligibility */}
        <div className="space-y-6 lg:col-span-1">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">Eligibility Criteria</h2>
            <div className="mt-3 space-y-2.5 text-xs text-slate-700">
              <div className="flex justify-between border-b border-slate-100 pb-1.5">
                <span className="text-slate-500">Minimum CGPA:</span>
                <span className="font-bold text-slate-900">{job.minCgpa ?? "No Cutoff"}</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-1.5">
                <span className="text-slate-500">Max Backlogs:</span>
                <span className="font-bold text-slate-900">{job.maxBacklogs ?? "No Limit"}</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-1.5">
                <span className="text-slate-500">Graduation Year:</span>
                <span className="font-bold text-slate-900">{job.graduationYear ?? "All"}</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-1.5">
                <span className="text-slate-500">Allowed Branches:</span>
                <span className="font-bold text-slate-900 text-right">{job.branches || "All Engineering"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Openings:</span>
                <span className="font-bold text-slate-900">{job.openings || 1} Positions</span>
              </div>
            </div>
          </div>

          {/* ATS Resume Screening & Shortlisting Card */}
          <div className="rounded-xl border border-indigo-200 bg-indigo-50/30 p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-indigo-900">ATS Resume Screening</h2>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                job.atsScreeningEnabled !== false ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700"
              }`}>
                {job.atsScreeningEnabled !== false ? "Active" : "Disabled"}
              </span>
            </div>

            <div className="space-y-2 text-xs text-slate-700">
              <div className="flex justify-between border-b border-indigo-100/60 pb-1.5">
                <span className="text-slate-500">Configured Cutoff:</span>
                <span className="font-extrabold text-indigo-900">{job.atsMinimumScore ?? 75}%</span>
              </div>
              <div className="flex justify-between border-b border-indigo-100/60 pb-1.5">
                <span className="text-slate-500">Auto-Shortlisting:</span>
                <span className="font-bold text-slate-900">{job.autoShortlistEnabled !== false ? "Enabled" : "Manual"}</span>
              </div>
              <div className="flex justify-between border-b border-indigo-100/60 pb-1.5">
                <span className="text-slate-500">Manual Review Queue:</span>
                <span className="font-bold text-slate-900">{job.manualReviewRequired ? "Required" : "Optional"}</span>
              </div>
              <div className="flex justify-between border-b border-indigo-100/60 pb-1.5">
                <span className="text-slate-500">Graduation Range:</span>
                <span className="font-bold text-slate-900">
                  {job.minGraduationYear ?? "Any"}–{job.maxGraduationYear ?? "Any"}
                </span>
              </div>
              <div className="flex justify-between border-b border-indigo-100/60 pb-1.5">
                <span className="text-slate-500">Allowed Degrees:</span>
                <span className="font-bold text-slate-900 text-right">{job.allowedDegrees || "All"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Pipeline Mode:</span>
                <span className="font-bold text-indigo-700">{job.pipelineManagementMode || "PREP2PLACE_MANAGED"}</span>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">Required Skills</h2>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {job.requiredSkills?.split(",").map((s) => (
                <span key={s.trim()} className="rounded-md bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-700">
                  {s.trim()}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Hiring Pipeline Configuration */}
        <div className="space-y-4 lg:col-span-2">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Configurable Hiring Pipeline ({rounds.length} Rounds)</h2>
                <p className="text-xs text-slate-500">
                  Customize the assessment sequence, duration, pass criteria, and review modes.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const presetList = ["APTITUDE", "DSA", "AI_INTERVIEW", "HR_INTERVIEW"];
                    const newRounds = presetList.map((type, idx) => {
                      const p = PRESET_ROUND_TYPES.find((pr) => pr.type === type)!;
                      return {
                        roundOrder: idx + 1,
                        name: p.name,
                        roundType: p.type,
                        durationMinutes: p.duration,
                        passingScore: p.passing,
                        weightage: 25,
                        maxAttempts: 1,
                        repeatable: false,
                        autoUnlock: true,
                        managementMode: p.mode,
                      };
                    });
                    setRounds(newRounds);
                  }}
                  className="rounded-lg border border-indigo-200 bg-indigo-50/70 px-3 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-100 transition cursor-pointer"
                >
                  ⚡ Load Standard Pipeline (4 Rounds)
                </button>

                <button
                  type="button"
                  disabled={savingPipeline || !scheduleValidation.isValid}
                  onClick={handleSavePipeline}
                  title={!scheduleValidation.isValid ? "Cannot save while schedule conflicts exist" : "Save pipeline rounds"}
                  className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  {savingPipeline ? "Saving Pipeline..." : "Save Pipeline"}
                </button>
              </div>
            </div>

            {/* Pipeline Scheduling Policy Toggle */}
            <div className="mt-4 p-4 rounded-xl border border-slate-200 bg-slate-50/80">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Scheduling Rule Policy:
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                      schedulingPolicy === "SEQUENTIAL"
                        ? "bg-indigo-100 text-indigo-800 border border-indigo-200"
                        : "bg-amber-100 text-amber-800 border border-amber-200"
                    }`}>
                      {schedulingPolicy}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {schedulingPolicy === "SEQUENTIAL"
                      ? "Sequential progression enforced: Candidates must complete one round before the next scheduled round begins. Overlapping assessment windows are rejected."
                      : "Independent tracks: Assessment rounds can overlap only when configured for independent candidate groups or distinct batches."}
                  </p>
                </div>

                <div className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5 shadow-2xs shrink-0">
                  <button
                    type="button"
                    onClick={() => setSchedulingPolicy("SEQUENTIAL")}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition cursor-pointer ${
                      schedulingPolicy === "SEQUENTIAL"
                        ? "bg-indigo-600 text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Sequential (Default)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSchedulingPolicy("INDEPENDENT")}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition cursor-pointer ${
                      schedulingPolicy === "INDEPENDENT"
                        ? "bg-indigo-600 text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Independent Tracks
                  </button>
                </div>
              </div>
            </div>

            {/* Live Scheduling Conflict Banner */}
            {(scheduleValidation.conflicts.length > 0 || backendConflicts.length > 0) && (
              <div className="mt-4 p-4 rounded-xl border border-rose-300 bg-rose-50/90 text-rose-900 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-600 text-white text-xs font-bold">
                      !
                    </span>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-rose-800">
                      Scheduling Conflict Detected ({scheduleValidation.conflicts.length || backendConflicts.length})
                    </h3>
                  </div>
                  <span className="text-[11px] font-semibold text-rose-700 bg-rose-100 px-2 py-0.5 rounded border border-rose-200">
                    Save Disabled Until Resolved
                  </span>
                </div>
                <p className="text-xs text-rose-700">
                  Sequential candidate pipelines require subsequent assessment rounds to start at or after the previous round concludes.
                </p>
                <div className="space-y-1.5 pt-1">
                  {(scheduleValidation.conflicts.length > 0 ? scheduleValidation.conflicts : backendConflicts).map((c, i) => (
                    <div key={i} className="flex flex-wrap items-center justify-between text-xs bg-white/80 p-2 rounded-lg border border-rose-200 text-rose-900">
                      <span>
                        • <strong>{c.nextRound}</strong> starts at <code className="bg-rose-100 px-1 py-0.5 rounded text-[11px] font-bold text-rose-800">{c.nextStart}</code>, but <strong>{c.previousRound}</strong> ends at <code className="bg-rose-100 px-1 py-0.5 rounded text-[11px] font-bold text-rose-800">{c.previousEnd}</code>.
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Add Preset Buttons Bar */}
            <div className="mt-4 pt-1">
              <span className="text-[11px] font-bold text-slate-500 block mb-2">Quick Add Round:</span>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_ROUND_TYPES.map((p) => (
                  <button
                    key={p.type}
                    type="button"
                    onClick={() => addRound(p.type)}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:border-indigo-400 hover:bg-indigo-50 hover:text-indigo-700 transition cursor-pointer"
                  >
                    + {p.name.split(" ")[0]} ({p.type})
                  </button>
                ))}
              </div>
            </div>

            {/* Rounds List */}
            <div className="mt-4 space-y-3">
              {rounds.map((round, idx) => {
                const roundConflictErrors = scheduleValidation.roundErrors[idx] || [];
                const hasConflicts = roundConflictErrors.length > 0;

                return (
                  <div
                    key={idx}
                    className={`rounded-xl border ${
                      hasConflicts ? "border-rose-300 bg-rose-50/20 shadow-xs ring-1 ring-rose-200" : "border-slate-200 bg-slate-50/50"
                    } p-4 transition hover:border-slate-300`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/60 pb-3">
                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-[11px] font-bold text-white">
                          {round.roundOrder}
                        </span>
                        <span className="rounded bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700 uppercase tracking-wider">
                          {round.roundType}
                        </span>
                        <input
                          type="text"
                          value={round.name}
                          onChange={(e) => updateRound(idx, { name: e.target.value })}
                          className="rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-900 outline-none focus:border-indigo-500 min-w-[260px]"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const isNowLive = round.roundStatus === "LIVE";
                            updateRound(idx, {
                              roundStatus: isNowLive ? "READY" : "LIVE",
                              isActivated: !isNowLive,
                            });
                          }}
                          className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border cursor-pointer transition ${
                            round.roundStatus === "LIVE"
                              ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                              : "bg-white text-slate-600 border-slate-300 hover:bg-slate-100"
                          }`}
                          title="Toggle active testing state for candidates"
                        >
                          {round.roundStatus === "LIVE" ? "● LIVE (Active)" : "○ Make LIVE"}
                        </button>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => moveRound(idx, "up")}
                          disabled={idx === 0}
                          className="rounded p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 cursor-pointer"
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          onClick={() => moveRound(idx, "down")}
                          disabled={idx === rounds.length - 1}
                          className="rounded p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 cursor-pointer"
                        >
                          ▼
                        </button>
                        <button
                          type="button"
                          onClick={() => removeRound(idx)}
                          className="rounded p-1 text-rose-400 hover:bg-rose-50 hover:text-rose-600 ml-2 cursor-pointer"
                        >
                          ✕
                        </button>
                      </div>
                    </div>

                    {/* Inline Conflict Alerts */}
                    {hasConflicts && (
                      <div className="mt-2.5 p-3 rounded-lg border border-rose-300 bg-rose-50 text-rose-900 flex flex-wrap items-center justify-between gap-2">
                        <div className="space-y-1 text-xs">
                          {roundConflictErrors.map((errMsg, errIdx) => (
                            <div key={errIdx} className="flex items-center gap-1.5 font-medium text-rose-800">
                              <span className="text-rose-600 font-bold shrink-0">⚠️</span>
                              <span>{errMsg}</span>
                            </div>
                          ))}
                        </div>
                        {idx > 0 && (
                          <button
                            type="button"
                            onClick={() => handleSuggestNextTime(idx)}
                            className="px-2.5 py-1 rounded-md text-xs font-bold bg-rose-600 text-white hover:bg-rose-700 shadow-xs transition cursor-pointer shrink-0"
                            title="Auto-calculate earliest non-conflicting start time"
                          >
                            ⚡ Suggest Next Available Time
                          </button>
                        )}
                      </div>
                    )}

                    <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6 text-xs">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-500">Duration (Mins)</label>
                        <input
                          type="number"
                          value={round.durationMinutes}
                          onChange={(e) => updateRound(idx, { durationMinutes: Number(e.target.value) })}
                          className={`mt-1 w-full rounded border ${
                            !round.durationMinutes || round.durationMinutes <= 0 ? "border-rose-300 bg-rose-50/50" : "border-slate-200 bg-white"
                          } px-2 py-1 outline-none`}
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-500">Cutoff / Pass %</label>
                        <input
                          type="number"
                          value={round.passingScore}
                          onChange={(e) => updateRound(idx, { passingScore: Number(e.target.value) })}
                          className="mt-1 w-full rounded border border-slate-200 bg-white px-2 py-1 outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-500">Weightage %</label>
                        <input
                          type="number"
                          value={round.weightage}
                          onChange={(e) => updateRound(idx, { weightage: Number(e.target.value) })}
                          className="mt-1 w-full rounded border border-slate-200 bg-white px-2 py-1 outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-500">Lifecycle Status</label>
                        <select
                          value={round.roundStatus || "READY"}
                          onChange={(e) => updateRound(idx, { roundStatus: e.target.value })}
                          className="mt-1 w-full rounded border border-slate-200 bg-white px-2 py-1 outline-none text-[11px]"
                        >
                          <option value="READY">READY (Shortlist required)</option>
                          <option value="LIVE">LIVE (Active testing)</option>
                          <option value="SCHEDULED">SCHEDULED (Windowed)</option>
                          <option value="PAUSED">PAUSED (Hold)</option>
                          <option value="DRAFT">DRAFT (Locked)</option>
                          <option value="CLOSED">CLOSED</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-500">Review Mode</label>
                        <select
                          value={round.managementMode}
                          onChange={(e) => updateRound(idx, { managementMode: e.target.value })}
                          className="mt-1 w-full rounded border border-slate-200 bg-white px-2 py-1 outline-none text-[11px]"
                        >
                          <option value="AUTOMATIC">Automatic</option>
                          <option value="MANUAL_REVIEW">Manual Review</option>
                          <option value="SCHEDULED_INTERVIEW">Live Interview</option>
                        </select>
                      </div>

                      <div className="flex flex-col justify-center pt-3">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={round.autoUnlock}
                            onChange={(e) => updateRound(idx, { autoUnlock: e.target.checked })}
                            className="rounded accent-indigo-600"
                          />
                          <span className="text-[11px] font-semibold text-slate-700">Auto-unlock</span>
                        </label>
                      </div>
                    </div>

                    {/* Assessment Window Schedule Grid */}
                    <div className="pt-3 border-t border-slate-100 mt-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                            Assessment Schedule Window:
                          </span>
                          <span className="text-[10px] bg-slate-200/70 text-slate-700 font-semibold px-2 py-0.5 rounded">
                            Timezone: {round.timezone || "IST (Asia/Kolkata)"}
                          </span>
                        </div>
                        {idx > 0 && (
                          <button
                            type="button"
                            onClick={() => handleSuggestNextTime(idx)}
                            className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 underline cursor-pointer"
                          >
                            Suggest Next Available Time
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-5 text-xs">
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-500">Start Date</label>
                          <input
                            type="date"
                            value={round.startDate || ""}
                            onChange={(e) => updateRound(idx, { startDate: e.target.value })}
                            className={`mt-0.5 w-full rounded border ${
                              hasConflicts ? "border-rose-400 bg-rose-50/40" : "border-slate-200 bg-white"
                            } px-2 py-1 text-xs`}
                            title="Assessment Window Start Date"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-500">Start Time</label>
                          <input
                            type="time"
                            value={round.startTime || ""}
                            onChange={(e) => updateRound(idx, { startTime: e.target.value })}
                            className={`mt-0.5 w-full rounded border ${
                              hasConflicts ? "border-rose-400 bg-rose-50/40" : "border-slate-200 bg-white"
                            } px-2 py-1 text-xs font-semibold`}
                            title="Assessment Window Start Time"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-500">Duration (Mins)</label>
                          <input
                            type="number"
                            min={5}
                            value={round.durationMinutes}
                            onChange={(e) => updateRound(idx, { durationMinutes: Number(e.target.value) })}
                            className="mt-0.5 w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs"
                            title="Assessment Duration in Minutes"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-500">End Date</label>
                          <input
                            type="date"
                            value={round.endDate || ""}
                            onChange={(e) => updateRound(idx, { endDate: e.target.value })}
                            className="mt-0.5 w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs"
                            title="Calculated end date (or specify manually)"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-500">End Time</label>
                          <input
                            type="time"
                            value={round.endTime || ""}
                            onChange={(e) => updateRound(idx, { endTime: e.target.value })}
                            className="mt-0.5 w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs font-semibold"
                            title="Calculated end time (or specify manually)"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Proctoring Toggles */}
                    <div className="pt-2 border-t border-slate-100 mt-2 flex flex-wrap items-center justify-between gap-3 text-xs">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">Proctoring:</span>
                      {(() => {
                        let proc: any = {};
                        try {
                          proc = round.proctoringConfig ? JSON.parse(round.proctoringConfig) : {};
                        } catch {}
                        const toggleProc = (field: string, val: boolean) => {
                          const updated = { ...proc, [field]: val };
                          updateRound(idx, { proctoringConfig: JSON.stringify(updated) });
                        };
                        return (
                          <>
                            <label className="flex items-center gap-1 cursor-pointer" title="Webcam monitoring">
                              <input
                                type="checkbox"
                                checked={proc.webcam !== false}
                                onChange={(e) => toggleProc("webcam", e.target.checked)}
                                className="accent-indigo-600 rounded"
                              />
                              <span className="text-[11px] text-slate-600">Webcam</span>
                            </label>
                            <label className="flex items-center gap-1 cursor-pointer" title="Audio monitoring">
                              <input
                                type="checkbox"
                                checked={proc.microphone !== false}
                                onChange={(e) => toggleProc("microphone", e.target.checked)}
                                className="accent-indigo-600 rounded"
                              />
                              <span className="text-[11px] text-slate-600">Mic</span>
                            </label>
                            <label className="flex items-center gap-1 cursor-pointer" title="Fullscreen enforcement">
                              <input
                                type="checkbox"
                                checked={proc.fullScreen !== false}
                                onChange={(e) => toggleProc("fullScreen", e.target.checked)}
                                className="accent-indigo-600 rounded"
                              />
                              <span className="text-[11px] text-slate-600">Fullscreen</span>
                            </label>
                            <label className="flex items-center gap-1 cursor-pointer" title="Anti-tab switching penalty">
                              <input
                                type="checkbox"
                                checked={proc.blockTabSwitch !== false}
                                onChange={(e) => toggleProc("blockTabSwitch", e.target.checked)}
                                className="accent-indigo-600 rounded"
                              />
                              <span className="text-[11px] text-slate-600">Anti-Tab</span>
                            </label>
                          </>
                        );
                      })()}
                    </div>

                    {/* Database Question Bank & Topic Selector */}
                    <AssessmentConfigEditor
                      roundType={round.roundType}
                      configJson={round.assessmentConfig}
                      onChange={(updatedJson) => updateRound(idx, { assessmentConfig: updatedJson })}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
