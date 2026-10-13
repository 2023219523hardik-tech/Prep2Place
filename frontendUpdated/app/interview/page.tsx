"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import LoadingState from "@/components/LoadingState";
import ErrorState from "@/components/ErrorState";
import { extractTextFromFile, FileParseError } from "@/lib/fileParsing";
import { Icon } from "@/components/ui/Icon";
import { EmptyState } from "@/components/ui/EmptyState";

interface JobRole {
  id: number;
  title: string;
}

interface SessionResponse {
  sessionId: number;
  status: string;
  roleTitle: string;
  level: string;
  createdAt: string;
  questionsAnswered: number;
  totalQuestions: number;
  overallScore?: number | null;
  integrityScore?: number;
  score?: number;
}

type StatusFilter = "ALL" | "IN_PROGRESS" | "COMPLETED" | "PAUSED" | "EXITED";

const STATUS_FILTERS: StatusFilter[] = ["ALL", "IN_PROGRESS", "COMPLETED", "PAUSED", "EXITED"];

const statusBadgeTone: Record<string, { bg: string; text: string; border: string }> = {
  COMPLETED: { bg: "bg-emerald-50 text-emerald-700", text: "text-emerald-700", border: "border-emerald-200" },
  REPORT_READY: { bg: "bg-teal-50 text-teal-700", text: "text-teal-700", border: "border-teal-200" },
  SUBMITTED: { bg: "bg-cyan-50 text-cyan-700", text: "text-cyan-700", border: "border-cyan-200" },
  IN_PROGRESS: { bg: "bg-indigo-50 text-indigo-700", text: "text-indigo-700", border: "border-indigo-200" },
  PAUSED: { bg: "bg-amber-50 text-amber-700", text: "text-amber-700", border: "border-amber-200" },
  RESUMABLE: { bg: "bg-amber-50 text-amber-700", text: "text-amber-700", border: "border-amber-200" },
  EXITED: { bg: "bg-slate-100 text-slate-600", text: "text-slate-600", border: "border-slate-200" },
  TERMINATED_VIOLATION: { bg: "bg-rose-50 text-rose-700", text: "text-rose-700", border: "border-rose-200" },
  VIOLATION_DETECTED: { bg: "bg-rose-50 text-rose-700", text: "text-rose-700", border: "border-rose-200" },
  TIMEOUT: { bg: "bg-rose-50 text-rose-700", text: "text-rose-700", border: "border-rose-200" },
  ADMIN_TERMINATED: { bg: "bg-rose-50 text-rose-700", text: "text-rose-700", border: "border-rose-200" },
};

export default function InterviewHomePage() {
  const [roles, setRoles] = useState<JobRole[]>([]);
  const [history, setHistory] = useState<SessionResponse[]>([]);
  const [roleId, setRoleId] = useState<string>("");
  const [level, setLevel] = useState("Intermediate");
  const [resumeText, setResumeText] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [resumeFileName, setResumeFileName] = useState("");
  const [jobDescriptionFileName, setJobDescriptionFileName] = useState("");
  const [resumeNotice, setResumeNotice] = useState<{ kind: "success" | "warning" | "error"; message: string } | null>(null);
  const [jdNotice, setJdNotice] = useState<{ kind: "success" | "warning" | "error"; message: string } | null>(null);
  const [parsingResume, setParsingResume] = useState(false);
  const [parsingJd, setParsingJd] = useState(false);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [showProctoringNotice, setShowProctoringNotice] = useState(true);

  const router = useRouter();

  useEffect(() => {
    Promise.all([api.get<JobRole[]>("/api/roles"), api.get<SessionResponse[]>("/api/interviews/history")])
      .then(([r, h]) => {
        setRoles(r);
        setHistory(h);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  async function startInterview() {
    setStarting(true);
    setError("");
    try {
      const session = await api.post<SessionResponse>("/api/interviews", {
        roleId: roleId ? Number(roleId) : null,
        level,
        numQuestions: 5,
        resumeText,
        jobDescription,
      });
      router.push(`/interview/${session.sessionId}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to start interview");
    } finally {
      setStarting(false);
    }
  }

  async function loadTextFile(
    file: File | undefined,
    setText: (value: string) => void,
    setFileName: (value: string) => void,
    setNotice: (value: { kind: "success" | "warning" | "error"; message: string } | null) => void,
    setParsing: (value: boolean) => void,
  ) {
    if (!file) return;
    setParsing(true);
    setNotice(null);
    try {
      const { text, warning } = await extractTextFromFile(file);
      setText(text);
      setFileName(file.name);
      setNotice(
        warning
          ? { kind: "warning", message: warning }
          : { kind: "success", message: `Extracted ${text.length.toLocaleString()} characters from ${file.name}` }
      );
    } catch (e) {
      const message =
        e instanceof FileParseError ? e.message : "Could not read that file. Use a PDF, DOCX, TXT, or Markdown file.";
      setNotice({ kind: "error", message });
    } finally {
      setParsing(false);
    }
  }

  async function exitInterview(sessionId: number) {
    if (!window.confirm("Exit this interview? Exited interviews cannot be resumed.")) return;
    try {
      const updated = await api.post<SessionResponse>(`/api/interviews/${sessionId}/exit`);
      setHistory((items) => items.map((item) => (item.sessionId === sessionId ? updated : item)));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to exit interview");
    }
  }

  async function resumeInterview(sessionId: number) {
    try {
      await api.post<SessionResponse>(`/api/interviews/${sessionId}/resume`);
      router.push(`/interview/${sessionId}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to resume interview");
    }
  }

  const totalInterviews = history.length;

  const avgScore = useMemo(() => {
    const completed = history.filter(
      (s) =>
        s.status === "COMPLETED" ||
        s.status === "SUBMITTED" ||
        s.status === "REPORT_READY" ||
        s.status === "EXITED" ||
        s.status === "TERMINATED_VIOLATION"
    );
    if (completed.length === 0) return null;
    const scores = completed
      .map((s) => s.overallScore ?? s.score)
      .filter((n): n is number => typeof n === "number");
    if (scores.length === 0) return null;
    const sum = scores.reduce((a, b) => a + b, 0);
    return Math.round(sum / scores.length);
  }, [history]);

  const lastSession = useMemo(() => {
    if (history.length === 0) return null;
    return [...history].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )[0];
  }, [history]);

  const filteredHistory = useMemo(() => {
    return history.filter((s) => {
      if (statusFilter !== "ALL") {
        if (statusFilter === "PAUSED") {
          if (s.status !== "PAUSED" && s.status !== "RESUMABLE") return false;
        } else if (s.status !== statusFilter) {
          return false;
        }
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const roleMatch = s.roleTitle?.toLowerCase().includes(q);
        const levelMatch = s.level?.toLowerCase().includes(q);
        const statusMatch = s.status?.toLowerCase().includes(q);
        if (!roleMatch && !levelMatch && !statusMatch) return false;
      }
      return true;
    });
  }, [history, statusFilter, searchQuery]);

  function scrollToHistory() {
    document.getElementById("past-interviews-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (loading) return <LoadingState label="Loading interview suite..." />;

  return (
    <div className="w-full space-y-6 pb-12 font-sans max-w-7xl mx-auto">
      {/* ============================================================
          HERO BANNER
      ============================================================ */}
      <HeroSection onStartNew={startInterview} onViewHistory={scrollToHistory} starting={starting} />

      {/* ============================================================
          KPI STRIP
      ============================================================ */}
      <KpiStrip
        totalInterviews={totalInterviews}
        avgScore={avgScore}
        lastSession={lastSession}
        onResumeLast={
          lastSession
            ? () => {
                if (lastSession.status === "COMPLETED" || lastSession.status === "REPORT_READY") {
                  router.push(`/interview/${lastSession.sessionId}/report`);
                } else if (lastSession.status === "PAUSED" || lastSession.status === "RESUMABLE") {
                  resumeInterview(lastSession.sessionId);
                } else {
                  router.push(`/interview/${lastSession.sessionId}`);
                }
              }
            : undefined
        }
      />

      {/* ============================================================
          MAIN TWO-COLUMN WORKBENCH
      ============================================================ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5">
          <LeftSetupColumn
            roles={roles}
            roleId={roleId}
            setRoleId={setRoleId}
            level={level}
            setLevel={setLevel}
            resumeText={resumeText}
            setResumeText={setResumeText}
            jobDescription={jobDescription}
            setJobDescription={setJobDescription}
            resumeFileName={resumeFileName}
            setResumeFileName={setResumeFileName}
            jobDescriptionFileName={jobDescriptionFileName}
            setJobDescriptionFileName={setJobDescriptionFileName}
            resumeNotice={resumeNotice}
            jdNotice={jdNotice}
            parsingResume={parsingResume}
            parsingJd={parsingJd}
            loadTextFile={loadTextFile}
            setResumeNotice={setResumeNotice}
            setJdNotice={setJdNotice}
            setParsingResume={setParsingResume}
            setParsingJd={setParsingJd}
            error={error}
            starting={starting}
            onStart={startInterview}
            showProctoringNotice={showProctoringNotice}
            setShowProctoringNotice={setShowProctoringNotice}
          />
        </div>

        <div className="lg:col-span-7">
          <RightHistoryColumn
            id="past-interviews-section"
            history={filteredHistory}
            allCount={history.length}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            onStartNew={startInterview}
            onRowAction={(row, action) => {
              if (action === "view-report") {
                router.push(`/interview/${row.sessionId}/report`);
              } else if (action === "resume") {
                resumeInterview(row.sessionId);
              } else if (action === "continue") {
                router.push(`/interview/${row.sessionId}`);
              } else if (action === "exit") {
                exitInterview(row.sessionId);
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   HERO SECTION
============================================================ */
function HeroSection({
  onStartNew,
  onViewHistory,
  starting,
}: {
  onStartNew: () => void;
  onViewHistory: () => void;
  starting: boolean;
}) {
  return (
    <div className="relative rounded-3xl overflow-hidden border border-slate-200/80 bg-gradient-to-b from-white via-slate-50/60 to-indigo-50/30 shadow-sm">
      {/* Decorative ambient gradients */}
      <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 rounded-full bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-transparent blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 rounded-full bg-gradient-to-tr from-cyan-500/10 via-teal-500/10 to-transparent blur-3xl pointer-events-none" />

      <div className="relative px-6 sm:px-10 py-10 sm:py-12 flex flex-col items-center text-center">
        {/* Status Pill */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-200/80 text-emerald-700 text-xs font-semibold shadow-xs mb-4">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <Icon name="sparkles" size={13} />
          <span>AI Speech & Proctoring Engine Online</span>
        </div>

        {/* Title */}
        <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight max-w-3xl">
          Mock Interview with{" "}
          <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-cyan-600 bg-clip-text text-transparent">
            Arya
          </span>{" "}
          — your live AI interviewer
        </h1>

        {/* Subtitle */}
        <p className="mt-3 text-sm sm:text-base text-slate-600 max-w-2xl leading-relaxed">
          Dynamic questions, real-time proctoring analysis, and AI-graded rubric feedback to prepare you for actual campus and corporate placements.
        </p>

        {/* Key Feature Chips */}
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-xs font-medium text-slate-600">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-slate-200 shadow-xs">
            🎙️ Voice & Video Interaction
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-slate-200 shadow-xs">
            ⚡ Dynamic Follow-up Probing
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-slate-200 shadow-xs">
            🛡️ Anti-Cheat & Malpractice Engine
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-slate-200 shadow-xs">
            📊 Placement Readiness Scoring
          </span>
        </div>

        {/* CTA Actions */}
        <div className="mt-8 flex flex-col sm:flex-row items-center gap-3">
          <button
            onClick={onStartNew}
            disabled={starting}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold text-sm shadow-md shadow-indigo-600/20 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            <Icon name="mic" size={17} />
            <span>{starting ? "Launching Session..." : "Start New Interview"}</span>
          </button>

          <button
            onClick={onViewHistory}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 hover:text-slate-900 font-semibold text-sm shadow-xs transition-all"
          >
            <Icon name="clock" size={16} />
            <span>View Past Sessions</span>
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   KPI METRICS STRIP
============================================================ */
function KpiStrip({
  totalInterviews,
  avgScore,
  lastSession,
  onResumeLast,
}: {
  totalInterviews: number;
  avgScore: number | null;
  lastSession: SessionResponse | null;
  onResumeLast?: () => void;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Card 1: Total Interviews */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs hover:shadow-sm transition-all flex flex-col justify-between">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Interviews</p>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-3xl font-extrabold text-slate-900">{totalInterviews}</span>
              <span className="text-xs font-semibold text-slate-500">sessions</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {totalInterviews === 0 ? "Take your first mock session" : "Mock interviews tracked"}
            </p>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
            <Icon name="briefcase" size={20} />
          </div>
        </div>
        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
            {totalInterviews} recorded
          </span>
          <span className="text-[11px] text-slate-400">Campus benchmark</span>
        </div>
      </div>

      {/* Card 2: Avg Score */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs hover:shadow-sm transition-all flex flex-col justify-between">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Average Score</p>
            <div className="flex items-baseline gap-1 mt-2">
              <span className="text-3xl font-extrabold text-slate-900">
                {avgScore !== null ? avgScore : "—"}
              </span>
              {avgScore !== null && <span className="text-lg font-bold text-slate-600">%</span>}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {avgScore !== null
                ? avgScore >= 75
                  ? "Placement Ready (Excellent)"
                  : avgScore >= 50
                  ? "Developing well (Keep practicing)"
                  : "Needs focused preparation"
                : "Complete a session to evaluate"}
            </p>
          </div>
          <div
            className={`w-11 h-11 rounded-2xl border flex items-center justify-center shrink-0 ${
              avgScore === null
                ? "bg-slate-50 border-slate-200 text-slate-400"
                : avgScore >= 75
                ? "bg-emerald-50 border-emerald-100 text-emerald-600"
                : avgScore >= 50
                ? "bg-amber-50 border-amber-100 text-amber-600"
                : "bg-rose-50 border-rose-100 text-rose-600"
            }`}
          >
            <Icon name="award" size={20} />
          </div>
        </div>
        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
          <span
            className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
              avgScore === null
                ? "bg-slate-50 text-slate-600 border-slate-200"
                : avgScore >= 75
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : avgScore >= 50
                ? "bg-amber-50 text-amber-700 border-amber-200"
                : "bg-rose-50 text-rose-700 border-rose-200"
            }`}
          >
            {avgScore !== null ? "Across completed attempts" : "Awaiting data"}
          </span>
          <span className="text-[11px] text-slate-400">Target: 75%+</span>
        </div>
      </div>

      {/* Card 3: Last Session */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs hover:shadow-sm transition-all flex flex-col justify-between">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Last Session</p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className="text-lg font-bold text-slate-900 truncate" title={lastSession?.roleTitle || "General"}>
                {lastSession ? lastSession.roleTitle || "General" : "No sessions yet"}
              </span>
              {lastSession && (
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                    statusBadgeTone[lastSession.status]?.bg || "bg-slate-100 text-slate-600"
                  } ${statusBadgeTone[lastSession.status]?.border || "border-slate-200"}`}
                >
                  {lastSession.status}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1 truncate">
              {lastSession
                ? `${lastSession.level} · ${new Date(lastSession.createdAt).toLocaleDateString()}`
                : "Your interview history will appear here"}
            </p>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-cyan-50 border border-cyan-100 flex items-center justify-center text-cyan-600 shrink-0">
            <Icon name="clock" size={20} />
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
          {lastSession && onResumeLast ? (
            <button
              onClick={onResumeLast}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
            >
              {lastSession.status === "COMPLETED" || lastSession.status === "REPORT_READY" ? (
                <>
                  <span>View Report</span>
                  <Icon name="chevron-right" size={13} />
                </>
              ) : (
                <>
                  <span>Resume Session</span>
                  <Icon name="play" size={13} />
                </>
              )}
            </button>
          ) : (
            <span className="text-[11px] text-slate-400">Awaiting first session</span>
          )}
          <span className="text-[11px] text-slate-400">Arya Evaluation</span>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   LEFT COLUMN — INTERVIEW SETUP
============================================================ */
interface LeftColumnProps {
  roles: JobRole[];
  roleId: string;
  setRoleId: (v: string) => void;
  level: string;
  setLevel: (v: string) => void;
  resumeText: string;
  setResumeText: (v: string) => void;
  jobDescription: string;
  setJobDescription: (v: string) => void;
  resumeFileName: string;
  setResumeFileName: (v: string) => void;
  jobDescriptionFileName: string;
  setJobDescriptionFileName: (v: string) => void;
  resumeNotice: { kind: "success" | "warning" | "error"; message: string } | null;
  jdNotice: { kind: "success" | "warning" | "error"; message: string } | null;
  parsingResume: boolean;
  parsingJd: boolean;
  loadTextFile: (
    file: File | undefined,
    setText: (value: string) => void,
    setFileName: (value: string) => void,
    setNotice: (value: { kind: "success" | "warning" | "error"; message: string } | null) => void,
    setParsing: (value: boolean) => void,
  ) => Promise<void>;
  setResumeNotice: (v: { kind: "success" | "warning" | "error"; message: string } | null) => void;
  setJdNotice: (v: { kind: "success" | "warning" | "error"; message: string } | null) => void;
  setParsingResume: (v: boolean) => void;
  setParsingJd: (v: boolean) => void;
  error: string;
  starting: boolean;
  onStart: () => void;
  showProctoringNotice: boolean;
  setShowProctoringNotice: (v: boolean) => void;
}

function LeftSetupColumn(props: LeftColumnProps) {
  const {
    roles,
    roleId,
    setRoleId,
    level,
    setLevel,
    resumeText,
    setResumeText,
    jobDescription,
    setJobDescription,
    resumeFileName,
    setResumeFileName,
    jobDescriptionFileName,
    setJobDescriptionFileName,
    resumeNotice,
    jdNotice,
    parsingResume,
    parsingJd,
    loadTextFile,
    setResumeNotice,
    setJdNotice,
    setParsingResume,
    setParsingJd,
    error,
    starting,
    onStart,
    showProctoringNotice,
    setShowProctoringNotice,
  } = props;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <Icon name="mic" size={16} />
            </span>
            Start New Interview
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">Customize role parameters and resume context</p>
        </div>
        <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200/60 px-2.5 py-1 rounded-full">
          Step 1 of 2
        </span>
      </div>

      <div className="p-6 space-y-6">
        {/* Role & Level Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Target Track & Level
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Target Role <span className="font-normal text-slate-400">(optional)</span>
              </label>
              <select
                className="w-full bg-slate-50/80 hover:bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-xs"
                value={roleId}
                onChange={(e) => setRoleId(e.target.value)}
              >
                <option value="">General (Mixed placement questions)</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Difficulty Level</label>
              <div className="grid grid-cols-3 gap-1.5 bg-slate-100 p-1 rounded-xl">
                {["Beginner", "Intermediate", "Advanced"].map((lvl) => {
                  const active = level === lvl;
                  return (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setLevel(lvl)}
                      className={`text-xs font-semibold py-1.5 rounded-lg transition-all ${
                        active
                          ? "bg-white text-indigo-700 shadow-xs font-bold"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      {lvl}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Dual Upload Section */}
        <div className="space-y-4 pt-2 border-t border-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Context Enrichment</p>
              <p className="text-[11px] text-slate-400">Upload your resume and target JD for custom interview probes</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FileUploadCard
              label="Resume / CV"
              optional
              icon="file-text"
              iconTone="premium"
              fileName={resumeFileName}
              text={resumeText}
              setText={setResumeText}
              notice={resumeNotice}
              parsing={parsingResume}
              placeholder="Paste resume text or upload PDF/DOCX..."
              onFileSelect={(file) =>
                loadTextFile(file, setResumeText, setResumeFileName, setResumeNotice, setParsingResume)
              }
              onClear={() => {
                setResumeText("");
                setResumeFileName("");
                setResumeNotice(null);
              }}
              accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown"
            />

            <FileUploadCard
              label="Job Description"
              optional
              icon="briefcase"
              iconTone="accent"
              fileName={jobDescriptionFileName}
              text={jobDescription}
              setText={setJobDescription}
              notice={jdNotice}
              parsing={parsingJd}
              placeholder="Paste job description or requirements..."
              onFileSelect={(file) =>
                loadTextFile(file, setJobDescription, setJobDescriptionFileName, setJdNotice, setParsingJd)
              }
              onClear={() => {
                setJobDescription("");
                setJobDescriptionFileName("");
                setJdNotice(null);
              }}
              accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown"
            />
          </div>
        </div>

        {/* Proctoring Notice */}
        {showProctoringNotice && (
          <div className="relative rounded-2xl bg-amber-50/70 border border-amber-200 p-4 text-amber-900 shadow-xs">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-700 shrink-0 mt-0.5">
                <Icon name="shield" size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-amber-900">Proctoring & Malpractice Verification</p>
                  <button
                    onClick={() => setShowProctoringNotice(false)}
                    className="text-amber-600 hover:text-amber-800 p-0.5 rounded transition"
                  >
                    <Icon name="x" size={14} />
                  </button>
                </div>
                <p className="text-[11px] leading-relaxed text-amber-800/90 mt-1">
                  Fullscreen and webcam are required. Periodic face detection, tab changes, and window focus are logged to simulate actual enterprise hiring rounds.
                </p>
              </div>
            </div>
          </div>
        )}

        {error && <ErrorState message={error} />}

        {/* Start Button */}
        <div className="pt-2">
          <button
            onClick={onStart}
            disabled={starting}
            className="w-full inline-flex items-center justify-center gap-2 py-3.5 px-6 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold text-sm shadow-md shadow-indigo-600/20 active:scale-[0.99] transition-all disabled:opacity-50"
          >
            {starting ? (
              <>
                <svg className="animate-spin w-4 h-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                <span>Initializing Arya Interview Room...</span>
              </>
            ) : (
              <>
                <Icon name="mic" size={17} />
                <span>Launch Interview Room</span>
              </>
            )}
          </button>
          <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2 px-1">
            <span>Standard Session: ~5 questions</span>
            <span>Duration: ~15 mins</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   FILE UPLOAD CARD SUB-COMPONENT
============================================================ */
function FileUploadCard({
  label,
  optional,
  icon,
  iconTone,
  fileName,
  text,
  setText,
  notice,
  parsing,
  placeholder,
  onFileSelect,
  onClear,
  accept,
}: {
  label: string;
  optional?: boolean;
  icon: "file-text" | "briefcase";
  iconTone: "premium" | "accent";
  fileName: string;
  text: string;
  setText: (v: string) => void;
  notice: { kind: "success" | "warning" | "error"; message: string } | null;
  parsing: boolean;
  placeholder: string;
  onFileSelect: (file: File | undefined) => void;
  onClear?: () => void;
  accept: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-slate-700">
          {label}
          {optional && <span className="font-normal text-slate-400"> (optional)</span>}
        </label>
        {fileName && onClear && (
          <button
            onClick={onClear}
            className="text-[10px] text-rose-600 hover:text-rose-700 font-semibold"
          >
            Remove file
          </button>
        )}
      </div>

      {/* Dropzone */}
      <label className="block cursor-pointer rounded-xl border border-dashed border-slate-300 hover:border-indigo-400 bg-slate-50/50 hover:bg-indigo-50/30 p-3.5 text-center transition-all group">
        <input
          type="file"
          accept={accept}
          className="sr-only"
          disabled={parsing}
          onChange={(e) => onFileSelect(e.target.files?.[0])}
        />
        <div className="w-9 h-9 mx-auto rounded-xl bg-white border border-slate-200 group-hover:border-indigo-300 flex items-center justify-center text-indigo-600 shadow-xs mb-1.5 transition-colors">
          <Icon name="upload" size={16} />
        </div>
        <p className="text-xs font-semibold text-slate-700 truncate max-w-[200px] mx-auto">
          {parsing ? "Parsing text..." : fileName ? fileName : "Upload document"}
        </p>
        <p className="text-[10px] text-slate-400 mt-0.5">PDF, DOCX, TXT</p>
      </label>

      {notice && (
        <p
          className={`text-[11px] font-medium leading-tight ${
            notice.kind === "error"
              ? "text-rose-600"
              : notice.kind === "warning"
              ? "text-amber-600"
              : "text-emerald-600"
          }`}
        >
          {notice.message}
        </p>
      )}

      {/* Textarea */}
      <textarea
        className="w-full bg-slate-50/80 hover:bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all min-h-[72px] resize-y"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

/* ============================================================
   RIGHT COLUMN — PAST INTERVIEWS
============================================================ */
interface RightColumnProps {
  id?: string;
  history: SessionResponse[];
  allCount: number;
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  statusFilter: StatusFilter;
  setStatusFilter: (v: StatusFilter) => void;
  onStartNew: () => void;
  onRowAction: (row: SessionResponse, action: "view-report" | "resume" | "continue" | "exit") => void;
}

function RightHistoryColumn(props: RightColumnProps) {
  const { id, history, allCount, searchQuery, setSearchQuery, statusFilter, setStatusFilter, onStartNew, onRowAction } =
    props;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden" id={id}>
      {/* Header */}
      <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-cyan-50 border border-cyan-100 flex items-center justify-center text-cyan-600">
              <Icon name="clock" size={16} />
            </span>
            Past Interviews
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">Review transcripts, proctoring metrics, and AI reports</p>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Icon name="search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search sessions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full sm:w-48 bg-white border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-xs"
          />
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="px-6 py-3 border-b border-slate-100 bg-white flex flex-wrap gap-1.5">
        {STATUS_FILTERS.map((f) => {
          const active = statusFilter === f;
          return (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                active
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "bg-slate-100 hover:bg-slate-200/70 text-slate-600"
              }`}
            >
              {f === "ALL" ? `All (${allCount})` : f.replace("_", " ")}
            </button>
          );
        })}
      </div>

      {/* Table Content */}
      {history.length === 0 ? (
        <div className="p-8">
          <EmptyState
            icon="sparkles"
            variant="info"
            title="No sessions found"
            description="Start your first AI mock interview to receive real-time speech analytics and placement scoring."
            action={
              <button
                onClick={onStartNew}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm transition"
              >
                <Icon name="mic" size={14} />
                <span>Start Mock Interview</span>
              </button>
            }
          />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3 px-5">Role & Level</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Questions Progress</th>
                <th className="py-3 px-4">Score / Status</th>
                <th className="py-3 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {history.map((row) => {
                const pct =
                  row.totalQuestions > 0 ? Math.round((row.questionsAnswered / row.totalQuestions) * 100) : 0;
                const badgeInfo = statusBadgeTone[row.status] || {
                  bg: "bg-slate-100 text-slate-600",
                  text: "text-slate-600",
                  border: "border-slate-200",
                };

                return (
                  <tr key={row.sessionId} className="hover:bg-slate-50/70 transition-colors">
                    {/* Role & Level */}
                    <td className="py-3.5 px-5">
                      <div className="font-bold text-slate-900 text-xs truncate max-w-[160px]">
                        {row.roleTitle || "General Technical"}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.2 rounded-full border ${
                            row.level === "Advanced"
                              ? "bg-rose-50 text-rose-700 border-rose-200"
                              : row.level === "Intermediate"
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : "bg-emerald-50 text-emerald-700 border-emerald-200"
                          }`}
                        >
                          {row.level}
                        </span>
                      </div>
                    </td>

                    {/* Date */}
                    <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                      <div className="font-semibold text-slate-800">
                        {new Date(row.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {new Date(row.createdAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </td>

                    {/* Questions Progress */}
                    <td className="py-3.5 px-4 min-w-[130px]">
                      <div className="flex items-center justify-between text-[11px] font-semibold mb-1">
                        <span className="text-slate-700">
                          {row.questionsAnswered} / {row.totalQuestions}
                        </span>
                        <span className="text-slate-400 font-mono text-[10px]">{pct}%</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </td>

                    {/* Score / Status */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {typeof row.overallScore === "number" || typeof row.score === "number" ? (
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                            (row.overallScore ?? row.score!) >= 75
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : (row.overallScore ?? row.score!) >= 50
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : "bg-rose-50 text-rose-700 border-rose-200"
                          }`}
                        >
                          {row.overallScore ?? row.score}%
                        </span>
                      ) : (
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${badgeInfo.bg} ${badgeInfo.border}`}
                        >
                          {row.status}
                        </span>
                      )}
                    </td>

                    {/* Action */}
                    <td className="py-3.5 px-5 text-right whitespace-nowrap">
                      {row.status === "COMPLETED" ||
                      row.status === "SUBMITTED" ||
                      row.status === "REPORT_READY" ||
                      row.status === "EXITED" ||
                      row.status === "TERMINATED_VIOLATION" ||
                      row.status === "VIOLATION_DETECTED" ||
                      row.status === "TIMEOUT" ||
                      row.status === "ADMIN_TERMINATED" ? (
                        <button
                          onClick={() => onRowAction(row, "view-report")}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs transition"
                        >
                          <span>Report</span>
                          <Icon name="chevron-right" size={13} />
                        </button>
                      ) : row.status === "PAUSED" || row.status === "RESUMABLE" ? (
                        <button
                          onClick={() => onRowAction(row, "resume")}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs transition"
                        >
                          <Icon name="play" size={12} />
                          <span>Resume</span>
                        </button>
                      ) : row.status === "IN_PROGRESS" ? (
                        <button
                          onClick={() => onRowAction(row, "continue")}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs transition"
                        >
                          <Icon name="play" size={12} />
                          <span>Continue</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => onRowAction(row, "exit")}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-rose-600 hover:bg-rose-50 font-bold text-xs transition"
                        >
                          <Icon name="x" size={12} />
                          <span>Exit</span>
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
