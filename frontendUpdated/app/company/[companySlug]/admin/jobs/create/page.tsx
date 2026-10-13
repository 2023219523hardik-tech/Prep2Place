"use client";

import { useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  companyAdminApi,
  HiringRoundDto,
  validatePipelineSchedule,
  computeRoundEnd,
  computeRoundDuration,
  suggestNextAvailableTime,
  ScheduleConflict,
} from "@/lib/jobs";
import { ApiError } from "@/lib/api";
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
  { type: "CUSTOM", name: "Custom Company Assessment", duration: 60, passing: 60, mode: "MANUAL_REVIEW" },
];

type SchedulingPolicyType = "SEQUENTIAL" | "INDEPENDENT";

export default function CreateJobPage() {
  const params = useParams();
  const router = useRouter();
  const companySlug = (params.companySlug as string) || "sif360";

  const [activeStep, setActiveStep] = useState<"basic" | "description" | "eligibility" | "ats" | "pipeline">("basic");

  // Basic Details
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [jobType, setJobType] = useState("FULL_TIME");
  const [location, setLocation] = useState("Remote");
  const [department, setDepartment] = useState("Engineering");
  const [openings, setOpenings] = useState(5);
  const [salaryMin, setSalaryMin] = useState(8);
  const [salaryMax, setSalaryMax] = useState(14);
  const [stipend, setStipend] = useState<number | "">("");
  const [deadline, setDeadline] = useState("2026-11-30");

  // Description
  const [description, setDescription] = useState("");
  const [responsibilities, setResponsibilities] = useState("");
  const [requiredSkills, setRequiredSkills] = useState("");
  const [niceToHaveSkills, setNiceToHaveSkills] = useState("");
  const [benefits, setBenefits] = useState("");

  // Academic Eligibility
  const [minCgpa, setMinCgpa] = useState<number | "">(7.0);
  const [maxBacklogs, setMaxBacklogs] = useState<number | "">(0);
  const [graduationYear, setGraduationYear] = useState<number | "">(2027);
  const [minGraduationYear, setMinGraduationYear] = useState<number | "">(2024);
  const [maxGraduationYear, setMaxGraduationYear] = useState<number | "">(2027);
  const [branches, setBranches] = useState("CSE, IT, AI-ML, ECE");
  const [allowedDegrees, setAllowedDegrees] = useState("B.Tech, B.E., M.Tech, MCA");
  const [requiredCertifications, setRequiredCertifications] = useState("");

  // Pipeline Execution & ATS Screening Configuration
  const [pipelineManagementMode, setPipelineManagementMode] = useState<"PREP2PLACE_MANAGED" | "HYBRID" | "SELF_MANAGED">("PREP2PLACE_MANAGED");
  const [schedulingPolicy, setSchedulingPolicy] = useState<SchedulingPolicyType>("SEQUENTIAL");
  const [atsScreeningEnabled, setAtsScreeningEnabled] = useState(true);
  const [atsMinimumScore, setAtsMinimumScore] = useState<number>(75);
  const [autoShortlistEnabled, setAutoShortlistEnabled] = useState(true);
  const [manualReviewRequired, setManualReviewRequired] = useState(false);

  // Pipeline Rounds
  const [rounds, setRounds] = useState<HiringRoundDto[]>([
    {
      roundOrder: 1,
      name: "Online Aptitude & Reasoning Assessment",
      roundType: "APTITUDE",
      durationMinutes: 60,
      passingScore: 60,
      weightage: 20,
      maxAttempts: 1,
      repeatable: false,
      autoUnlock: true,
      managementMode: "AUTOMATIC",
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
    },
    {
      roundOrder: 2,
      name: "Technical MCQ & Core Fundamentals",
      roundType: "TECHNICAL_MCQ",
      durationMinutes: 45,
      passingScore: 65,
      weightage: 25,
      maxAttempts: 1,
      repeatable: false,
      autoUnlock: true,
      managementMode: "AUTOMATIC",
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
    },
    {
      roundOrder: 3,
      name: "DSA Coding Challenge",
      roundType: "DSA",
      durationMinutes: 90,
      passingScore: 70,
      weightage: 30,
      maxAttempts: 1,
      repeatable: false,
      autoUnlock: true,
      managementMode: "AUTOMATIC",
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
    },
    {
      roundOrder: 4,
      name: "Live Technical & Architectural Interview",
      roundType: "TECHNICAL_INTERVIEW",
      durationMinutes: 45,
      passingScore: 70,
      weightage: 25,
      maxAttempts: 1,
      repeatable: false,
      autoUnlock: false,
      managementMode: "SCHEDULED_INTERVIEW",
      roundStatus: "READY",
      isActivated: false,
      startDate: "",
      startTime: "",
      endDate: "",
      endTime: "",
      timezone: "IST",
    },
  ]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [backendConflicts, setBackendConflicts] = useState<ScheduleConflict[]>([]);

  // Live schedule validation across all rounds
  const scheduleValidation = useMemo(() => {
    return validatePipelineSchedule(rounds, schedulingPolicy);
  }, [rounds, schedulingPolicy]);

  function handleTitleChange(val: string) {
    setTitle(val);
    if (!slug || slug === title.toLowerCase().replace(/[^a-z0-9]+/g, "-")) {
      setSlug(val.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
    }
  }

  function addRound(presetType: string) {
    const preset = PRESET_ROUND_TYPES.find((p) => p.type === presetType) || PRESET_ROUND_TYPES[0];
    const newRound: HiringRoundDto = {
      roundOrder: rounds.length + 1,
      name: preset.name,
      roundType: preset.type,
      durationMinutes: preset.duration,
      passingScore: preset.passing,
      weightage: 15,
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

  async function handleSubmit(asDraft: boolean) {
    if (!title.trim()) {
      setError("Please provide a job title");
      setActiveStep("basic");
      return;
    }
    if (!description.trim()) {
      setError("Please provide a job description");
      setActiveStep("description");
      return;
    }
    if (rounds.length === 0) {
      setError("Please configure at least one round in the hiring pipeline");
      setActiveStep("pipeline");
      return;
    }

    if (!scheduleValidation.isValid) {
      setError("Cannot save job: Please resolve overlapping schedule conflicts in the hiring pipeline.");
      setActiveStep("pipeline");
      return;
    }

    setLoading(true);
    setError("");
    setBackendConflicts([]);

    try {
      const payload = {
        title,
        slug: slug || undefined,
        jobType,
        location,
        department,
        openings: Number(openings) || 1,
        salaryMin: Number(salaryMin) || 0,
        salaryMax: Number(salaryMax) || 0,
        stipend: stipend ? Number(stipend) : null,
        deadline,
        status: asDraft ? "DRAFT" : "PUBLISHED",
        description,
        responsibilities,
        requiredSkills,
        niceToHaveSkills,
        benefits,
        minCgpa: minCgpa !== "" ? Number(minCgpa) : null,
        maxBacklogs: maxBacklogs !== "" ? Number(maxBacklogs) : null,
        graduationYear: graduationYear !== "" ? Number(graduationYear) : null,
        minGraduationYear: minGraduationYear !== "" ? Number(minGraduationYear) : null,
        maxGraduationYear: maxGraduationYear !== "" ? Number(maxGraduationYear) : null,
        branches,
        allowedDegrees,
        requiredCertifications,
        pipelineManagementMode,
        schedulingPolicy,
        atsScreeningEnabled,
        atsMinimumScore: Number(atsMinimumScore) || 75,
        autoShortlistEnabled,
        manualReviewRequired,
        rounds,
      };

      const created = await companyAdminApi.createJob(companySlug, payload);
      router.push(`/company/${companySlug}/admin/jobs/${created.id}`);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.data && err.data.code === "HIRING_ROUND_SCHEDULE_CONFLICT" && Array.isArray(err.data.conflicts)) {
          setBackendConflicts(err.data.conflicts);
          setError(`Schedule conflict detected by server: ${err.message}`);
          setActiveStep("pipeline");
        } else {
          setError(err.message);
        }
      } else {
        setError("Failed to create job opportunity");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href={`/company/${companySlug}/admin/jobs`}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800"
            >
              ← Back to Jobs
            </Link>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            Create Job Opportunity & Pipeline
          </h1>
          <p className="mt-0.5 text-xs text-slate-500">
            Configure job description, academic eligibility criteria, and assessment rounds.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={loading || (activeStep === "pipeline" && !scheduleValidation.isValid)}
            onClick={() => handleSubmit(true)}
            title={!scheduleValidation.isValid ? "Cannot save while pipeline schedule conflicts exist" : "Save job as draft"}
            className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            Save as Draft
          </button>
          <button
            type="button"
            disabled={loading || (activeStep === "pipeline" && !scheduleValidation.isValid)}
            onClick={() => handleSubmit(false)}
            title={!scheduleValidation.isValid ? "Cannot publish while pipeline schedule conflicts exist" : "Publish job opportunity"}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            {loading ? "Publishing Drive..." : "Publish Opportunity"}
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-700 flex items-start gap-2">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-rose-600 mt-0.5">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {/* Step Tabs Bar */}
      <div className="flex border-b border-slate-200 bg-white rounded-t-xl px-4 pt-2 overflow-x-auto scrollbar-none">
        {[
          { id: "basic", label: "1. Basic Details" },
          { id: "description", label: "2. Job Description" },
          { id: "eligibility", label: "3. Student Eligibility" },
          { id: "ats", label: "4. ATS Resume Screening" },
          { id: "pipeline", label: "5. Hiring Pipeline & Proctoring" },
        ].map((step) => (
          <button
            key={step.id}
            onClick={() => setActiveStep(step.id as any)}
            className={`border-b-2 px-4 py-2.5 text-xs font-bold transition whitespace-nowrap cursor-pointer ${
              activeStep === step.id
                ? "border-indigo-600 text-indigo-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {step.label}
          </button>
        ))}
      </div>

      {/* Step Body */}
      <div className="rounded-b-xl border border-slate-200 border-t-0 bg-white p-6 shadow-xs">
        {/* STEP 1: BASIC DETAILS */}
        {activeStep === "basic" && (
          <div className="grid gap-5 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                Job Title *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="e.g. Associate Software Engineer / AI Engineer"
                className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-xs text-slate-900 outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                Job Slug
              </label>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="e.g. associate-software-engineer"
                className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-xs font-mono text-slate-800 outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                Department
              </label>
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="e.g. Cloud & AI Architecture"
                className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-xs text-slate-900 outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                Job Type
              </label>
              <select
                value={jobType}
                onChange={(e) => setJobType(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-xs text-slate-900 outline-none focus:border-indigo-500"
              >
                <option value="FULL_TIME">Full-Time</option>
                <option value="INTERNSHIP">Internship</option>
                <option value="PPO">Pre-Placement Offer (PPO)</option>
                <option value="CONTRACT">Contract</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                Workplace Location
              </label>
              <select
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-xs text-slate-900 outline-none focus:border-indigo-500"
              >
                <option value="Remote">Remote</option>
                <option value="Hybrid">Hybrid</option>
                <option value="On-site">On-site (Office)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                Number of Openings
              </label>
              <input
                type="number"
                value={openings}
                onChange={(e) => setOpenings(Number(e.target.value))}
                min={1}
                className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-xs text-slate-900 outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                Application Deadline
              </label>
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-xs text-slate-900 outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                Annual Salary / CTC Range (LPA)
              </label>
              <div className="mt-1 flex items-center gap-2">
                <input
                  type="number"
                  value={salaryMin}
                  onChange={(e) => setSalaryMin(Number(e.target.value))}
                  placeholder="Min"
                  className="w-1/2 rounded-lg border border-slate-200 p-2.5 text-xs text-slate-900 outline-none focus:border-indigo-500"
                />
                <span className="text-slate-400">to</span>
                <input
                  type="number"
                  value={salaryMax}
                  onChange={(e) => setSalaryMax(Number(e.target.value))}
                  placeholder="Max"
                  className="w-1/2 rounded-lg border border-slate-200 p-2.5 text-xs text-slate-900 outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                Monthly Internship Stipend (₹, Optional)
              </label>
              <input
                type="number"
                value={stipend}
                onChange={(e) => setStipend(e.target.value === "" ? "" : Number(e.target.value))}
                placeholder="e.g. 40000"
                className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-xs text-slate-900 outline-none focus:border-indigo-500"
              />
            </div>
          </div>
        )}

        {/* STEP 2: JOB DESCRIPTION */}
        {activeStep === "description" && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                Detailed Job Description *
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
                placeholder="Provide a comprehensive summary of the team, role objectives, and organizational mission..."
                className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-xs text-slate-900 outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                Key Responsibilities
              </label>
              <textarea
                value={responsibilities}
                onChange={(e) => setResponsibilities(e.target.value)}
                rows={4}
                placeholder="• Architect and ship scalable microservices&#10;• Collaborate with cross-functional product and UX teams&#10;• Optimize SQL database query latencies..."
                className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-xs text-slate-900 outline-none focus:border-indigo-500"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Required Technical Skills
                </label>
                <input
                  type="text"
                  value={requiredSkills}
                  onChange={(e) => setRequiredSkills(e.target.value)}
                  placeholder="Java, Spring Boot, PostgreSQL, Docker, DSA"
                  className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-xs text-slate-900 outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Preferred / Nice-to-have Skills
                </label>
                <input
                  type="text"
                  value={niceToHaveSkills}
                  onChange={(e) => setNiceToHaveSkills(e.target.value)}
                  placeholder="AWS, Kubernetes, Next.js, Redis, Kafka"
                  className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-xs text-slate-900 outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                Perks & Benefits
              </label>
              <textarea
                value={benefits}
                onChange={(e) => setBenefits(e.target.value)}
                rows={3}
                placeholder="Health Insurance, Remote stipend, Learning allowance, ESOPs..."
                className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-xs text-slate-900 outline-none focus:border-indigo-500"
              />
            </div>
          </div>
        )}

        {/* STEP 3: STUDENT ELIGIBILITY */}
        {activeStep === "eligibility" && (
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                Minimum CGPA Requirement
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="10"
                value={minCgpa}
                onChange={(e) => setMinCgpa(e.target.value === "" ? "" : Number(e.target.value))}
                placeholder="e.g. 7.5"
                className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-xs text-slate-900 outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                Maximum Allowed Active Backlogs
              </label>
              <input
                type="number"
                min="0"
                value={maxBacklogs}
                onChange={(e) => setMaxBacklogs(e.target.value === "" ? "" : Number(e.target.value))}
                placeholder="e.g. 0"
                className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-xs text-slate-900 outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                Eligible Graduation Year Range
              </label>
              <div className="mt-1 flex items-center gap-2">
                <input
                  type="number"
                  value={minGraduationYear}
                  onChange={(e) => setMinGraduationYear(e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder="Min Year (2024)"
                  className="w-1/2 rounded-lg border border-slate-200 p-2.5 text-xs text-slate-900 outline-none focus:border-indigo-500"
                />
                <span className="text-slate-400 font-bold">-</span>
                <input
                  type="number"
                  value={maxGraduationYear}
                  onChange={(e) => setMaxGraduationYear(e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder="Max Year (2027)"
                  className="w-1/2 rounded-lg border border-slate-200 p-2.5 text-xs text-slate-900 outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                Allowed Degree Qualifications
              </label>
              <input
                type="text"
                value={allowedDegrees}
                onChange={(e) => setAllowedDegrees(e.target.value)}
                placeholder="B.Tech, B.E., M.Tech, MCA, BCA"
                className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-xs text-slate-900 outline-none focus:border-indigo-500"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                Allowed Degree Branches
              </label>
              <input
                type="text"
                value={branches}
                onChange={(e) => setBranches(e.target.value)}
                placeholder="CSE, IT, AI-ML, Data Science, ECE"
                className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-xs text-slate-900 outline-none focus:border-indigo-500"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                Required Certifications / Special Conditions
              </label>
              <input
                type="text"
                value={requiredCertifications}
                onChange={(e) => setRequiredCertifications(e.target.value)}
                placeholder="e.g. AWS Certified Developer or Oracle Certified Associate"
                className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-xs text-slate-900 outline-none focus:border-indigo-500"
              />
            </div>
          </div>
        )}

        {/* STEP 4: ATS RESUME SCREENING CONFIGURATION */}
        {activeStep === "ats" && (
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                ATS Resume Screening &amp; Shortlisting Configuration
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Configure automated first-round screening to evaluate candidate resumes objectively.
              </p>
            </div>

            {/* Pipeline Execution Mode */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                Pipeline Execution Mode
              </label>
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  {
                    mode: "PREP2PLACE_MANAGED",
                    title: "Prep2Place Managed",
                    desc: "Automated proctoring, test engines, and objective score computation.",
                  },
                  {
                    mode: "HYBRID",
                    title: "Hybrid Mode",
                    desc: "Prep2Place automated coding/MCQ rounds + Recruiter live interview scheduling.",
                  },
                  {
                    mode: "SELF_MANAGED",
                    title: "Self-Managed",
                    desc: "Company recruiters manage test evaluations and offline stages.",
                  },
                ].map((item) => (
                  <button
                    key={item.mode}
                    type="button"
                    onClick={() => setPipelineManagementMode(item.mode as any)}
                    className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                      pipelineManagementMode === item.mode
                        ? "border-indigo-600 bg-indigo-50/70 text-indigo-900 shadow-xs"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <p className="font-bold text-xs">{item.title}</p>
                    <p className="text-[11px] text-slate-500 mt-1">{item.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* ATS Main Controls */}
            <div className="grid gap-5 md:grid-cols-2">
              <div className="rounded-xl border border-slate-200 p-4 bg-white space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-slate-900">ATS Resume Screening</p>
                    <p className="text-[11px] text-slate-500">Extract skills and calculate 0–100 compatibility score.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={atsScreeningEnabled}
                      onChange={(e) => setAtsScreeningEnabled(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>

                <div className="pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-700">
                      Configurable ATS Cutoff Threshold
                    </label>
                    <span className="text-sm font-extrabold text-indigo-700">
                      {atsMinimumScore} / 100
                    </span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="95"
                    step="5"
                    value={atsMinimumScore}
                    onChange={(e) => setAtsMinimumScore(Number(e.target.value))}
                    className="w-full accent-indigo-600 cursor-pointer"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Candidates scoring below this cutoff will not auto-shortlist for assessment rounds.
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 p-4 bg-white space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-slate-900">Automatic Shortlisting</p>
                    <p className="text-[11px] text-slate-500">Auto-shortlist if candidate meets CGPA + ATS cutoff.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={autoShortlistEnabled}
                    onChange={(e) => setAutoShortlistEnabled(e.target.checked)}
                    className="w-4 h-4 rounded accent-indigo-600 cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <div>
                    <p className="text-xs font-bold text-slate-900">Manual Resume Review Required</p>
                    <p className="text-[11px] text-slate-500">Send all submissions to recruiter queue before round 1.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={manualReviewRequired}
                    onChange={(e) => setManualReviewRequired(e.target.checked)}
                    className="w-4 h-4 rounded accent-indigo-600 cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* ATS Scoring Weights Reference */}
            <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-4 space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-indigo-900">
                Multi-Factor ATS Compatibility Engine Weights
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5 text-center text-xs">
                <div className="bg-white p-2 rounded-lg border border-indigo-100">
                  <span className="font-bold text-indigo-700 block">40%</span>
                  <span className="text-[10px] text-slate-600">Required Skills</span>
                </div>
                <div className="bg-white p-2 rounded-lg border border-indigo-100">
                  <span className="font-bold text-indigo-700 block">15%</span>
                  <span className="text-[10px] text-slate-600">Preferred Skills</span>
                </div>
                <div className="bg-white p-2 rounded-lg border border-indigo-100">
                  <span className="font-bold text-indigo-700 block">20%</span>
                  <span className="text-[10px] text-slate-600">Experience &amp; Proj</span>
                </div>
                <div className="bg-white p-2 rounded-lg border border-indigo-100">
                  <span className="font-bold text-indigo-700 block">15%</span>
                  <span className="text-[10px] text-slate-600">Academics &amp; Certs</span>
                </div>
                <div className="bg-white p-2 rounded-lg border border-indigo-100">
                  <span className="font-bold text-indigo-700 block">10%</span>
                  <span className="text-[10px] text-slate-600">JD Relevance</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 5: HIRING PIPELINE BUILDER */}
        {activeStep === "pipeline" && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Configurable Hiring Pipeline ({rounds.length} Rounds)
                </h3>
                <p className="text-xs text-slate-500">
                  Add, configure, reorder, or customize stages for this specific job drive.
                </p>
              </div>

              {/* Add Round Preset Dropdown */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-600">Add Stage:</span>
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      addRound(e.target.value);
                      e.target.value = "";
                    }
                  }}
                  className="rounded-lg border border-indigo-200 bg-indigo-50/50 px-3 py-1.5 text-xs font-semibold text-indigo-700 outline-none hover:bg-indigo-100"
                >
                  <option value="">+ Choose Assessment Type...</option>
                  {PRESET_ROUND_TYPES.map((p) => (
                    <option key={p.type} value={p.type}>
                      {p.name} ({p.duration} min)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Pipeline Scheduling Policy Toggle */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/80">
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

            {/* Live Scheduling Conflict Warning Banner */}
            {(scheduleValidation.conflicts.length > 0 || backendConflicts.length > 0) && (
              <div className="p-4 rounded-xl border border-rose-300 bg-rose-50/90 text-rose-900 space-y-2">
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
                    Publish Disabled Until Resolved
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

            {/* Rounds List */}
            <div className="space-y-4">
              {rounds.map((round, idx) => {
                const roundConflictErrors = scheduleValidation.roundErrors[idx] || [];
                const hasConflicts = roundConflictErrors.length > 0;

                return (
                  <div
                    key={idx}
                    className={`rounded-xl border ${
                      hasConflicts ? "border-rose-300 bg-rose-50/20 shadow-xs ring-1 ring-rose-200" : "border-slate-200 bg-slate-50/40"
                    } p-4 shadow-2xs transition hover:border-slate-300`}
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
                          className="rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-900 outline-none focus:border-indigo-500 min-w-[280px]"
                        />
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => moveRound(idx, "up")}
                          disabled={idx === 0}
                          className="rounded p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 cursor-pointer"
                          title="Move Up"
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          onClick={() => moveRound(idx, "down")}
                          disabled={idx === rounds.length - 1}
                          className="rounded p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 cursor-pointer"
                          title="Move Down"
                        >
                          ▼
                        </button>
                        <button
                          type="button"
                          onClick={() => removeRound(idx)}
                          className="rounded p-1 text-rose-400 hover:bg-rose-50 hover:text-rose-600 ml-2 cursor-pointer"
                          title="Delete Round"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* Inline Conflict Alert */}
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

                    {/* Round Parameters */}
                    <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6 text-xs">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-500">Duration (Mins)</label>
                        <input
                          type="number"
                          value={round.durationMinutes}
                          onChange={(e) => updateRound(idx, { durationMinutes: Number(e.target.value) })}
                          min={5}
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
                          min={0}
                          max={100}
                          className="mt-1 w-full rounded border border-slate-200 bg-white px-2 py-1 outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-500">Weightage %</label>
                        <input
                          type="number"
                          value={round.weightage}
                          onChange={(e) => updateRound(idx, { weightage: Number(e.target.value) })}
                          min={0}
                          max={100}
                          className="mt-1 w-full rounded border border-slate-200 bg-white px-2 py-1 outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-500">Max Attempts</label>
                        <input
                          type="number"
                          value={round.maxAttempts}
                          onChange={(e) => updateRound(idx, { maxAttempts: Number(e.target.value) })}
                          min={1}
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
                          <option value="AUTOMATIC">Automatic Scoring</option>
                          <option value="MANUAL_REVIEW">Manual Review</option>
                          <option value="SCHEDULED_INTERVIEW">Live Interview</option>
                        </select>
                      </div>

                      <div className="flex flex-col justify-center gap-1 pt-3">
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

                    {/* Round Scheduling Grid */}
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
        )}

        {/* Step Navigation Bar */}
        <div className="mt-8 flex items-center justify-between border-t border-slate-100 pt-4">
          <button
            type="button"
            disabled={activeStep === "basic"}
            onClick={() => {
              if (activeStep === "pipeline") setActiveStep("ats");
              else if (activeStep === "ats") setActiveStep("eligibility");
              else if (activeStep === "eligibility") setActiveStep("description");
              else if (activeStep === "description") setActiveStep("basic");
            }}
            className="rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-30 cursor-pointer"
          >
            ← Previous Step
          </button>

          {activeStep !== "pipeline" ? (
            <button
              type="button"
              onClick={() => {
                if (activeStep === "basic") setActiveStep("description");
                else if (activeStep === "description") setActiveStep("eligibility");
                else if (activeStep === "eligibility") setActiveStep("ats");
                else if (activeStep === "ats") setActiveStep("pipeline");
              }}
              className="rounded-lg bg-slate-900 px-4 py-1.5 text-xs font-bold text-white hover:bg-slate-800 cursor-pointer"
            >
              Next Step →
            </button>
          ) : (
            <button
              type="button"
              disabled={loading || !scheduleValidation.isValid}
              onClick={() => handleSubmit(false)}
              title={!scheduleValidation.isValid ? "Cannot publish while schedule conflicts exist" : "Publish job opportunity"}
              className="rounded-lg bg-indigo-600 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              {loading ? "Publishing Drive..." : "Publish Job Drive"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
