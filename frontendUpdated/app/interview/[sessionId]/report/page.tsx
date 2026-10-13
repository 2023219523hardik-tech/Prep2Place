"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import LoadingState from "@/components/LoadingState";
import ErrorState from "@/components/ErrorState";
import ScoreGauge from "@/components/ScoreGauge";
import { ProctoringEventType, ProctoringEventResponse } from "@/lib/proctoring";
import { jsPDF } from "jspdf";

interface AnswerEvaluation {
  questionId: number; correctness: number; clarity: number; depth: number; confidence: number;
  structure: number; weightedScore: number; feedback: string;
}
interface ProctoringSummaryEntry { eventType: string; count: number; topDetails: string[] }
interface CodingChallengeSummary {
  problemTitle: string | null; domain: string; status: string; verdict: string | null;
  scorePercent: number | null; language: string | null; deadline: string | null;
}
interface BehavioralAnalysisSummary {
  framesAnalyzed: number; avgEyeContactScore: number; avgPostureScore: number;
  eyeContactPercentSessionTime: number; postureIssueCount: number; eyeRoamingCount: number;
}
interface AnswerPaceEntry { questionId: number; wordCount: number; durationSeconds: number; wordsPerMinute: number }
interface SpeechDeliverySummary {
  fillerWordCount: number; avgWordsPerMinute: number; paceFluctuation: number;
  possibleHesitationAnswerCount: number; perAnswerPace: AnswerPaceEntry[];
}
interface LanguageIssue { category: string; example: string; issue: string; suggestion: string }
interface AnswerLanguageIssues { questionId: number; issues: LanguageIssue[] }
interface LanguageQualitySummary { avgGrammarScore: number; totalIssuesFound: number; perAnswerIssues: AnswerLanguageIssues[] }

interface Report {
  sessionId: number; roleTitle: string; level: string; technicalScore: number; behavioralScore: number;
  confidenceScore: number; overallScore: number; answers: AnswerEvaluation[]; weakTopics: string[]; summary: string;
  integrityScore: number; flaggedForReview: boolean;
  fillerWordCount: number; movementEventCount: number; postureFlagCount: number; tabSwitchCount: number;
  proctoringSummaries: ProctoringSummaryEntry[];
  // Real, per-event ground truth - every bar/metric on this page is derived from this array (or
  // the equivalent aggregate counts above), never randomized or invented client-side.
  violationLog: ProctoringEventResponse[];
  totalCheatTimeSeconds: number | null;
  completionState: string; terminationReason: string | null;
  codingChallenge: CodingChallengeSummary | null;
  behavioralAnalysis: BehavioralAnalysisSummary | null;
  speechDelivery: SpeechDeliverySummary | null;
  languageQuality: LanguageQualitySummary | null;
  reportStatus?: string;
  exitReason?: string | null;
}

const BAR_COLORS: Partial<Record<ProctoringEventType, [string, string]>> = {
  TAB_SWITCH: ["#f59e0b", "#dc2626"],
  WINDOW_BLUR: ["#eab308", "#f59e0b"],
  FULLSCREEN_EXIT: ["#8b5cf6", "#6366f1"],
  FILLER_WORDS: ["#f97316", "#eab308"],
  POSTURE_DRIFT: ["#0ea5e9", "#6366f1"],
  MOVEMENT_DETECTED: ["#ec4899", "#8b5cf6"],
  MULTIPLE_FACES: ["#dc2626", "#991b1b"],
  NO_FACE_DETECTED: ["#f43f5e", "#be123c"],
  SUSPICIOUS_OBJECT: ["#dc2626", "#7c2d12"],
  SUSPICIOUS_FRAME: ["#dc2626", "#7c2d12"],
  EYE_ROAMING: ["#06b6d4", "#0891b2"],
  READING_DETECTED: ["#a855f7", "#7e22ce"],
  AUDIO_MUTED: ["#64748b", "#334155"],
  CONTEXT_MISMATCH: ["#d946ef", "#a855f7"],
  COPY_PASTE_ATTEMPT: ["#ef4444", "#b91c1c"],
  RIGHT_CLICK: ["#f87171", "#dc2626"],
  DEVTOOLS_OPENED: ["#ef4444", "#7f1d1d"],
  SCREEN_SHARE_START: ["#10b981", "#059669"],
  SCREEN_SHARE_STOP: ["#f87171", "#dc2626"],
};

const EVENT_LABELS: Partial<Record<ProctoringEventType, string>> = {
  TAB_SWITCH: "Tab Switches",
  WINDOW_BLUR: "Window Focus Lost",
  FULLSCREEN_EXIT: "Fullscreen Exits",
  FILLER_WORDS: "Filler Words (um/ah)",
  POSTURE_DRIFT: "Posture Drift Flags",
  MOVEMENT_DETECTED: "Movement Events",
  MULTIPLE_FACES: "Multiple Faces Detected",
  NO_FACE_DETECTED: "Face Not Detected",
  SUSPICIOUS_OBJECT: "Prohibited Objects",
  SUSPICIOUS_FRAME: "Suspicious Frames",
  EYE_ROAMING: "Eye Movement / Gaze Left Screen",
  READING_DETECTED: "Possible Reading From Elsewhere",
  AUDIO_MUTED: "Microphone Muted",
  CONTEXT_MISMATCH: "Context Mismatches",
  COPY_PASTE_ATTEMPT: "Copy/Paste Attempts",
  RIGHT_CLICK: "Right-Click Attempts",
  DEVTOOLS_OPENED: "Developer Tools Opened",
};

/** Section 12: structured PDF export - built directly from the report data with jsPDF's text/
 *  layout primitives (not a screenshot of the page), so it stays crisp and paginates properly
 *  rather than being a blurry raster dump of the DOM. */
async function downloadReportPdf(report: Report) {
  try {
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 48;
    let y = margin;

  function ensureSpace(need: number) {
    if (y + need > pageHeight - margin) { doc.addPage(); y = margin; }
  }
  function heading(text: string) {
    ensureSpace(28);
    doc.setFont("helvetica", "bold").setFontSize(14).setTextColor(15, 23, 42);
    doc.text(text, margin, y);
    y += 20;
  }
  function subheading(text: string) {
    ensureSpace(18);
    doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(51, 65, 85);
    doc.text(text, margin, y);
    y += 15;
  }
  function body(text: string, indent = 0) {
    doc.setFont("helvetica", "normal").setFontSize(9.5).setTextColor(71, 85, 105);
    const lines = doc.splitTextToSize(text, pageWidth - margin * 2 - indent);
    for (const line of lines) {
      ensureSpace(13);
      doc.text(line, margin + indent, y);
      y += 13;
    }
  }
  function rule() {
    ensureSpace(10);
    doc.setDrawColor(226, 232, 240).line(margin, y, pageWidth - margin, y);
    y += 14;
  }

  doc.setFont("helvetica", "bold").setFontSize(20).setTextColor(15, 23, 42);
  doc.text("Interview Performance Report", margin, y); y += 26;
  doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(100, 116, 139);
  doc.text(`${report.roleTitle} — ${report.level} — ${new Date().toLocaleDateString()}`, margin, y); y += 20;
  rule();

  heading("Overall Performance");
  body(`Overall score: ${Math.round(report.overallScore)}/100  |  Technical: ${Math.round(report.technicalScore)}  |  Behavioral: ${Math.round(report.behavioralScore)}  |  Confidence: ${Math.round(report.confidenceScore)}`);
  body(report.summary);
  y += 6; rule();

  heading("Proctoring & Integrity Summary");
  body(`Integrity score: ${Math.round(report.integrityScore)}/100  |  Status: ${report.completionState}${report.flaggedForReview ? "  |  FLAGGED FOR REVIEW" : ""}`);
  if (report.terminationReason) body(`Termination reason: ${report.terminationReason}`);
  body(`Total violations logged: ${report.violationLog.length}${report.totalCheatTimeSeconds != null ? `  |  Time on suspicious activity: ${Math.round(report.totalCheatTimeSeconds)}s` : ""}`);
  for (const s of report.proctoringSummaries) body(`• ${s.eventType.replace(/_/g, " ")}: ${s.count}`, 10);
  y += 6; rule();

  if (report.behavioralAnalysis) {
    const b = report.behavioralAnalysis;
    heading("Behavioral / Posture Analysis");
    body(`Based on ${b.framesAnalyzed} sampled webcam frames.`);
    body(`Average eye-contact score: ${b.avgEyeContactScore}/100  |  Estimated on-screen gaze time: ${b.eyeContactPercentSessionTime}%`);
    body(`Average posture score: ${b.avgPostureScore}/100  |  Posture issues flagged: ${b.postureIssueCount}  |  Gaze-away events: ${b.eyeRoamingCount}`);
    y += 6; rule();
  }

  if (report.speechDelivery) {
    const s = report.speechDelivery;
    heading("Speech Delivery Analysis");
    body(`Filler words (um/uh/like): ${s.fillerWordCount}`);
    if (s.perAnswerPace.length > 0) {
      body(`Average pace: ${s.avgWordsPerMinute} words/min  |  Pace fluctuation: ±${s.paceFluctuation} wpm  |  Answers with possible hesitation: ${s.possibleHesitationAnswerCount}`);
    } else {
      body("No timed spoken answers were available to compute pace.");
    }
    y += 6; rule();
  }

  if (report.languageQuality) {
    const l = report.languageQuality;
    heading("Language Quality Analysis");
    body(`Average grammar score: ${l.avgGrammarScore}/100  |  Issues found: ${l.totalIssuesFound}`);
    for (const entry of l.perAnswerIssues.slice(0, 10)) {
      for (const issue of entry.issues) {
        body(`• [${issue.category}] "${issue.example}" — ${issue.issue}. Suggested: "${issue.suggestion}"`, 10);
      }
    }
    y += 6; rule();
  }

  if (report.codingChallenge) {
    const c = report.codingChallenge;
    heading("Technical / Domain Coding Challenge");
    body(`Domain: ${c.domain}  |  Problem: ${c.problemTitle || "—"}  |  Status: ${c.status}`);
    if (c.scorePercent != null) body(`Score: ${c.scorePercent}%  |  Verdict: ${c.verdict || "—"}  |  Language: ${c.language || "—"}`);
    y += 6; rule();
  }

  if (report.weakTopics.length > 0) {
    heading("Weak Topics");
    body(report.weakTopics.join(", "));
    y += 6; rule();
  }

  heading("Answer-by-Answer Breakdown");
  report.answers.forEach((a, i) => {
    subheading(`Question ${i + 1} — ${Math.round(a.weightedScore)}/100`);
    body(`Correctness ${Math.round(a.correctness)} | Clarity ${Math.round(a.clarity)} | Depth ${Math.round(a.depth)} | Structure ${Math.round(a.structure)} | Confidence ${Math.round(a.confidence)}`);
    body(a.feedback, 10);
    y += 4;
  });

    doc.save(`interview-report-${report.sessionId}.pdf`);
  } catch (err) {
    console.warn("PDF generation error, opening browser print fallback:", err);
    window.print();
  }
}

function MiniGauge({ value, label }: { value: number; label: string }) {
  const clamped = Math.min(100, Math.max(0, value));
  const circumference = 2 * Math.PI * 16;
  const offset = circumference - (clamped / 100) * circumference;
  const color = clamped >= 75 ? "#16a34a" : clamped >= 50 ? "#f59e0b" : "#ef4444";
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="52" height="52" viewBox="0 0 50 50">
        <circle cx="25" cy="25" r="16" fill="none" stroke="#e2e8f0" strokeWidth="5" />
        <circle
          cx="25" cy="25" r="16" fill="none" stroke={color} strokeWidth="5"
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round" transform="rotate(-90 25 25)"
        />
        <text x="25" y="29" textAnchor="middle" fontSize="11" fontWeight="700" fill={color}>
          {Math.round(clamped)}
        </text>
      </svg>
      <span className="text-[10px] font-medium text-slate-500">{label}</span>
    </div>
  );
}

function StatBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center">
      <p className="font-display text-lg font-bold text-slate-900">{value}</p>
      <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
    </div>
  );
}

function BarRow({ label, value, maxValue, colorFrom, colorTo, badge }: {
  label: string; value: number; maxValue: number; colorFrom: string; colorTo: string; badge?: string;
}) {
  const pct = Math.min(100, (value / Math.max(1, maxValue)) * 100);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-slate-700">{label}</span>
        <div className="flex items-center gap-2">
          {badge && <span className="badge bg-slate-100 text-slate-600">{badge}</span>}
          <span className="font-bold text-slate-800">{value}</span>
        </div>
      </div>
      <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${colorFrom} 0%, ${colorTo} 100%)` }}
        />
      </div>
    </div>
  );
}

function EventBadge({ eventType }: { eventType: ProctoringEventType }) {
  const [from] = BAR_COLORS[eventType] ?? ["#64748b", "#334155"];
  return (
    <span
      className="badge border"
      style={{ backgroundColor: `${from}1a`, borderColor: `${from}55`, color: from }}
    >
      {eventType.replace(/_/g, " ")}
    </span>
  );
}

function formatTimeFrame(
  occurredAtStr: string,
  durationSeconds?: number | null,
  referenceStartStr?: string
): { relative: string; timeFrame: string; wallClock: string } {
  const eventTime = new Date(occurredAtStr);
  const wallClock = eventTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  
  const startTime = referenceStartStr ? new Date(referenceStartStr) : eventTime;
  const diffSec = Math.max(0, Math.floor((eventTime.getTime() - startTime.getTime()) / 1000));
  const m = Math.floor(diffSec / 60);
  const s = diffSec % 60;
  const startRel = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  
  const dur = durationSeconds && durationSeconds > 0 ? Math.round(durationSeconds) : 2;
  const endSec = diffSec + dur;
  const em = Math.floor(endSec / 60);
  const es = endSec % 60;
  const endRel = `${String(em).padStart(2, "0")}:${String(es).padStart(2, "0")}`;
  
  return {
    relative: `+${m}m ${s}s`,
    timeFrame: `${startRel} – ${endRel}`,
    wallClock,
  };
}

/** Fetches evidence for one violation event through the access-controlled endpoint and renders it. */
function EvidenceThumbnail({
  event,
  sessionStartTime,
  onOpen,
}: {
  event: ProctoringEventResponse;
  sessionStartTime?: string;
  onOpen: (url: string) => void;
}) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!event.evidenceUrl) return;
    let revoke: string | null = null;
    api.getBlob(event.evidenceUrl)
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        revoke = url;
        setObjectUrl(url);
      })
      .catch(() => setFailed(true));
    return () => { if (revoke) URL.revokeObjectURL(revoke); };
  }, [event.evidenceUrl]);

  const [colorFrom] = BAR_COLORS[event.eventType] ?? ["#64748b", "#334155"];
  const tf = formatTimeFrame(event.occurredAt, event.durationSeconds, sessionStartTime);

  return (
    <div className="group relative rounded-xl overflow-hidden border border-slate-200 shadow-card hover:shadow-premium transition-all hover:-translate-y-0.5 bg-white">
      <button
        type="button"
        disabled={!objectUrl}
        onClick={() => objectUrl && onOpen(objectUrl)}
        className="block w-full aspect-video relative bg-slate-900 group-hover:opacity-95 transition-opacity"
      >
        {objectUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={objectUrl} alt={`Evidence for ${event.eventType}`} className="w-full h-full object-cover" />
        ) : failed ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-slate-400 text-[10px]">
            <span>Video frame unavailable</span>
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="w-4 h-4 rounded-full border-2 border-slate-300 border-t-blue-500 animate-spin" />
          </div>
        )}
        <div className="absolute top-1.5 left-1.5">
          <span className="text-[10px] font-mono font-bold text-white bg-slate-900/80 backdrop-blur-xs rounded px-1.5 py-0.5 border border-white/20">
            {tf.timeFrame}
          </span>
        </div>
        <div className="absolute top-1.5 right-1.5">
          <span className="text-[10px] font-mono font-medium text-slate-300 bg-black/60 rounded px-1.5 py-0.5">
            {tf.relative}
          </span>
        </div>
        <div className="absolute inset-0 bg-blue-600/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
          <span className="px-2 py-1 rounded bg-black/75 text-[11px] text-white font-medium shadow-sm">
            Click to Enlarge Frame 🔍
          </span>
        </div>
      </button>
      <div className="p-2.5 bg-white border-t border-slate-100 space-y-1.5">
        <div className="flex items-center justify-between">
          <EventBadge eventType={event.eventType} />
          <span className="text-[10px] text-slate-400 font-mono">{tf.wallClock}</span>
        </div>
        <p className="text-[11px] text-slate-600 truncate font-medium" title={event.details ?? undefined}>
          {event.details || "—"}
        </p>
      </div>
    </div>
  );
}

function TableEvidenceButton({
  event,
  onOpen,
}: {
  event: ProctoringEventResponse;
  onOpen: (url: string) => void;
}) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!event.evidenceUrl) return;
    let revoke: string | null = null;
    api.getBlob(event.evidenceUrl)
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        revoke = url;
        setObjectUrl(url);
      })
      .catch(() => {});
    return () => { if (revoke) URL.revokeObjectURL(revoke); };
  }, [event.evidenceUrl]);

  if (!event.evidenceAvailable) {
    return <span className="text-slate-400" title={event.evidenceUnavailableReason ?? undefined}>Unavailable</span>;
  }

  return (
    <button
      type="button"
      onClick={() => objectUrl && onOpen(objectUrl)}
      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-800 text-[11px] font-semibold hover:bg-emerald-100 transition-colors shadow-2xs"
    >
      {objectUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={objectUrl} alt="Frame" className="w-4 h-4 rounded object-cover border border-emerald-400" />
      )}
      <span>Video Frame</span>
      <span>🔍</span>
    </button>
  );
}

export default function InterviewReportPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;

  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState("");
  const [lightbox, setLightbox] = useState<string | null>(null);

  const fetchReport = useCallback(() => {
    setLoading(true);
    setError("");
    api.post<Report>(`/api/reports/generate-interview/${sessionId}`, {})
      .then((data) => {
        setReport(data);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : "Failed to load report"))
      .finally(() => setLoading(false));
  }, [sessionId]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handleRetry = async () => {
    setRetrying(true);
    setError("");
    try {
      const data = await api.post<Report>(`/api/reports/interview/${sessionId}/retry`, {});
      setReport(data);
    } catch (e: any) {
      setError(e instanceof ApiError ? e.message : "Retry failed");
    } finally {
      setRetrying(false);
    }
  };

  // Real per-type counts, straight from the same rows the backend used to compute integrityScore
  // and flaggedForReview - this can never disagree with those numbers.
  const barCounts = useMemo(() => {
    const counts: Partial<Record<ProctoringEventType, number>> = {};
    for (const e of report?.violationLog ?? []) {
      counts[e.eventType] = (counts[e.eventType] ?? 0) + 1;
    }
    return counts;
  }, [report]);

  const evidenceEvents = useMemo(
    () => (report?.violationLog ?? []).filter((e) => e.evidenceAvailable),
    [report]
  );

  const totalViolations = report?.violationLog.length ?? 0;
  const maxBarValue = Math.max(5, ...Object.values(barCounts), 1) * 1.2;

  const openLightbox = useCallback((url: string) => setLightbox(url), []);

  if (loading) return <LoadingState label="Loading report..." />;
  if (error) {
    return (
      <div className="max-w-xl mx-auto py-12 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto text-2xl font-bold">⚠️</div>
        <h2 className="text-xl font-bold text-slate-800">Report Not Available</h2>
        <p className="text-sm text-slate-600">{error}</p>
        <div className="flex gap-3 justify-center pt-2">
          <button onClick={handleRetry} disabled={retrying} className="btn-primary text-sm">
            {retrying ? "Retrying..." : "Retry Report Generation"}
          </button>
          <button onClick={() => router.push("/interview")} className="btn-secondary text-sm">Back to Interviews</button>
        </div>
      </div>
    );
  }
  if (!report) return null;

  const barTypes = (Object.keys(barCounts) as ProctoringEventType[]).sort(
    (a, b) => (barCounts[b] ?? 0) - (barCounts[a] ?? 0)
  );

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-display gradient-text">Interview Report</h1>
          <p className="text-xs text-slate-500 mt-1">Session ID: #{report.sessionId} · Evaluated with multimodal AI proctoring</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => downloadReportPdf(report)} className="btn-primary text-sm flex items-center gap-1.5 shadow-sm">
            <span>⬇</span> Download PDF
          </button>
          <button onClick={() => router.push("/interview")} className="btn-secondary text-sm">
            &larr; Back to interviews
          </button>
        </div>
      </div>

      {/* Terminal State Alert Banners */}
      {(report.completionState === "VIOLATION_DETECTED" || report.completionState === "TERMINATED_VIOLATION") && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-900 flex items-start gap-3 shadow-sm">
          <span className="text-2xl">⚠️</span>
          <div className="flex-1">
            <h3 className="font-bold text-sm text-red-950">Interview Terminated Due to a Policy Violation</h3>
            <p className="text-xs text-red-800 mt-1">
              Your interview was ended early due to a detected proctoring policy violation ({report.exitReason || report.terminationReason || "proctoring policy"}). Your report and integrity logs below reflect work answered up to that point.
            </p>
          </div>
          <span className="badge badge-danger text-xs">TERMINATED</span>
        </div>
      )}

      {report.completionState === "EXITED" && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900 flex items-start gap-3 shadow-sm">
          <span className="text-2xl">🚪</span>
          <div className="flex-1">
            <h3 className="font-bold text-sm text-amber-950">Interview Exited</h3>
            <p className="text-xs text-amber-800 mt-1">
              This interview was exited early by the candidate. Partial scores and proctoring metrics have been recorded.
            </p>
          </div>
          <span className="badge badge-warning text-xs">EXITED</span>
        </div>
      )}

      {(report.completionState === "COMPLETED" || report.completionState === "SUBMITTED") && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900 flex items-start gap-3 shadow-sm">
          <span className="text-2xl">✅</span>
          <div className="flex-1">
            <h3 className="font-bold text-sm text-emerald-950">Interview Completed</h3>
            <p className="text-xs text-emerald-800 mt-1">
              Your interview session finished successfully. Your comprehensive AI evaluation report is ready.
            </p>
          </div>
          <span className="badge badge-success text-xs">COMPLETED</span>
        </div>
      )}

      {/* Performance & Integrity Hero Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="card flex flex-col md:flex-row items-center gap-8 shadow-premium lg:col-span-7">
          <ScoreGauge score={report.overallScore} label="Overall Score" />
          <div className="flex-1 w-full">
            <div className="flex items-center gap-2 mb-2">
              <h2 className="text-xl font-bold font-display text-slate-900">{report.roleTitle}</h2>
              <span className="chip bg-premium-50 text-premium-700 border-premium-200">{report.level}</span>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">{report.summary}</p>
            <div className="grid grid-cols-3 gap-3 mt-4">
              <div className="bg-slate-50 rounded-xl p-3 text-center border border-slate-100">
                <p className="text-xs text-slate-500">Technical</p>
                <p className="text-2xl font-bold gradient-text">{Math.round(report.technicalScore)}</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 text-center border border-slate-100">
                <p className="text-xs text-slate-500">Behavioral</p>
                <p className="text-2xl font-bold gradient-text">{Math.round(report.behavioralScore)}</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 text-center border border-slate-100">
                <p className="text-xs text-slate-500">Confidence</p>
                <p className="text-2xl font-bold gradient-text">{Math.round(report.confidenceScore)}</p>
              </div>
            </div>
          </div>
        </div>

        <div className={`card flex flex-col justify-between shadow-premium lg:col-span-5 ${report.flaggedForReview ? "bg-red-50/70 border-red-200" : "bg-emerald-50/70 border-emerald-200"}`}>
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shrink-0 shadow-sm" style={{
              background: report.flaggedForReview
                ? "linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)"
                : "linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)",
            }}>
              {report.flaggedForReview ? "⚠️" : "✓"}
            </div>
            <div className="flex-1">
              <h3 className={`font-bold text-lg ${report.flaggedForReview ? "text-red-800" : "text-emerald-800"}`}>
                Interview Integrity: {Math.round(report.integrityScore)}/100
              </h3>
              <p className={`text-sm mt-1 leading-relaxed ${report.flaggedForReview ? "text-red-700" : "text-emerald-700"}`}>
                {report.flaggedForReview
                  ? `This session was flagged for review — ${totalViolations} suspicious event${totalViolations === 1 ? "" : "s"} detected.`
                  : "No significant proctoring violations were detected during this session."}
              </p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap pt-4 border-t border-slate-200/60 mt-4">
            {report.flaggedForReview && (
              <span className="badge bg-red-200 text-red-900 border border-red-300">Flagged</span>
            )}
            <span className="badge bg-white text-slate-700 border border-slate-200">
              {totalViolations} violation{totalViolations === 1 ? "" : "s"}
            </span>
            {report.totalCheatTimeSeconds != null && (
              <span className="badge bg-white text-slate-700 border border-slate-200">
                {Math.round(report.totalCheatTimeSeconds)}s spent on suspicious activity
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Proctoring Integrity Deep Dive - built entirely from report.violationLog / barCounts above. */}
      {totalViolations > 0 && (
        <div className="card space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold font-display">Proctoring Integrity Deep Dive</h2>
              <p className="text-sm text-slate-500 mt-1">Breakdown of every signal actually captured during the session</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-premium-gradient flex items-center justify-center shadow-premium text-white text-xl">
              🔍
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
            {barTypes.map((type) => {
              const value = barCounts[type] ?? 0;
              const [colorFrom, colorTo] = BAR_COLORS[type] ?? ["#64748b", "#334155"];
              const badge = value >= 3 ? "High" : value >= 1 ? "Medium" : "Low";
              return (
                <BarRow key={type} label={EVENT_LABELS[type] ?? type.replace(/_/g, " ")}
                  value={value} maxValue={maxBarValue} colorFrom={colorFrom} colorTo={colorTo} badge={badge} />
              );
            })}
          </div>
        </div>
      )}

      {/* Captured Evidence Frames - only ever shows events that actually have stored evidence;
          no placeholder gradients standing in for a real capture. */}
      {evidenceEvents.length > 0 && (
        <div className="card space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold font-display">Captured Evidence</h2>
              <p className="text-sm text-slate-500 mt-1">{evidenceEvents.length} evidence frame{evidenceEvents.length === 1 ? "" : "s"} captured during suspicious events</p>
            </div>
            <span className="badge bg-red-50 text-red-700 border border-red-200">
              {evidenceEvents.length} image{evidenceEvents.length === 1 ? "" : "s"}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {evidenceEvents.map((ev) => (
              <EvidenceThumbnail
                key={ev.id}
                event={ev}
                sessionStartTime={report.violationLog[report.violationLog.length - 1]?.occurredAt}
                onOpen={openLightbox}
              />
            ))}
          </div>
        </div>
      )}

      {/* Full violation log - with explicit Time Frame and Attached Video Frame snapshot */}
      {totalViolations > 0 && (
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold font-display">Violation Log &amp; Frame Evidence</h2>
            <span className="text-xs text-slate-500 font-medium">Click on any video frame to enlarge snapshot</span>
          </div>
          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200">
                  <th className="px-3 py-2.5 font-semibold">Time Frame &amp; Timestamp</th>
                  <th className="px-3 py-2.5 font-semibold">Violation Type</th>
                  <th className="px-3 py-2.5 font-semibold">Incident Details</th>
                  <th className="px-3 py-2.5 font-semibold">Duration</th>
                  <th className="px-3 py-2.5 font-semibold">Confidence</th>
                  <th className="px-3 py-2.5 font-semibold">Video Frame Evidence</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {report.violationLog.map((e) => {
                  const tf = formatTimeFrame(
                    e.occurredAt,
                    e.durationSeconds,
                    report.violationLog[report.violationLog.length - 1]?.occurredAt
                  );
                  return (
                    <tr key={e.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-mono font-bold text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded text-[11px] w-fit border border-slate-200/80">
                            {tf.timeFrame}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            {tf.relative} • {tf.wallClock}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5"><EventBadge eventType={e.eventType} /></td>
                      <td className="px-3 py-2.5 text-slate-600 max-w-xs truncate" title={e.details ?? undefined}>{e.details || "—"}</td>
                      <td className="px-3 py-2.5 text-slate-600 whitespace-nowrap">{e.durationSeconds != null ? `${e.durationSeconds}s` : "—"}</td>
                      <td className="px-3 py-2.5 text-slate-600 whitespace-nowrap">{e.confidenceScore != null ? `${Math.round(e.confidenceScore * 100)}%` : "—"}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <TableEvidenceButton event={e} onOpen={openLightbox} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Section 12: Behavioral / Posture Analysis - derived from real accumulated per-frame
          webcam samples (see report.behavioralAnalysis on the backend); shown only when at
          least one frame was actually sampled, never a fabricated percentage. */}
      {report.behavioralAnalysis && report.behavioralAnalysis.framesAnalyzed > 0 && (
        <div className="card space-y-4">
          <h2 className="text-xl font-bold font-display">Behavioral &amp; Posture Analysis</h2>
          <p className="text-xs text-slate-500">Based on {report.behavioralAnalysis.framesAnalyzed} sampled webcam frames throughout the session.</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatBlock label="Eye Contact (avg)" value={`${report.behavioralAnalysis.avgEyeContactScore}/100`} />
            <StatBlock label="On-Screen Gaze Time" value={`${report.behavioralAnalysis.eyeContactPercentSessionTime}%`} />
            <StatBlock label="Posture (avg)" value={`${report.behavioralAnalysis.avgPostureScore}/100`} />
            <StatBlock label="Posture Issues" value={String(report.behavioralAnalysis.postureIssueCount)} />
          </div>
        </div>
      )}

      {/* Speech Delivery Analysis - filler words (already tracked live), plus pace/fluctuation
          computed from real per-answer durations the frontend measured and sent (Section 12). */}
      {report.speechDelivery && (
        <div className="card space-y-4">
          <h2 className="text-xl font-bold font-display">Speech Delivery Analysis</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatBlock label="Filler Words" value={String(report.speechDelivery.fillerWordCount)} />
            {report.speechDelivery.perAnswerPace.length > 0 ? (
              <>
                <StatBlock label="Avg Pace" value={`${report.speechDelivery.avgWordsPerMinute} wpm`} />
                <StatBlock label="Pace Fluctuation" value={`±${report.speechDelivery.paceFluctuation} wpm`} />
                <StatBlock label="Possible Hesitation" value={`${report.speechDelivery.possibleHesitationAnswerCount} answer(s)`} />
              </>
            ) : (
              <p className="col-span-3 self-center text-xs text-slate-400">No timed spoken answers were available to compute pace.</p>
            )}
          </div>
          {report.speechDelivery.possibleHesitationAnswerCount > 0 && (
            <p className="text-xs text-slate-400">
              &quot;Possible hesitation&quot; is a words-per-minute heuristic (this app doesn&apos;t capture frame-level pause timestamps) — not literal pause detection.
            </p>
          )}
        </div>
      )}

      {/* Language Quality Analysis - real rule-based grammar/vocabulary issues (see
          LanguageQualityAnalyzer on the backend), each with the actual matched text and a
          concrete suggested correction, not a generic tip. */}
      {report.languageQuality && (
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold font-display">Language Quality Analysis</h2>
            <span className="badge bg-slate-100 text-slate-600">Avg grammar score: {report.languageQuality.avgGrammarScore}/100</span>
          </div>
          {report.languageQuality.totalIssuesFound === 0 ? (
            <p className="text-sm text-emerald-600">No specific grammar or vocabulary issues were detected in your answers.</p>
          ) : (
            <div className="space-y-3">
              {report.languageQuality.perAnswerIssues.map((entry, i) => (
                <div key={i} className="rounded-xl border border-slate-200 p-3">
                  <p className="mb-1.5 text-xs font-bold text-slate-500">Question {report.answers.findIndex((a) => a.questionId === entry.questionId) + 1 || "?"}</p>
                  <ul className="space-y-1.5">
                    {entry.issues.map((issue, j) => (
                      <li key={j} className="text-xs text-slate-600">
                        <span className="badge bg-amber-50 text-amber-700 mr-1.5">{issue.category}</span>
                        &quot;{issue.example}&quot; — {issue.issue}.{" "}
                        <span className="font-semibold text-emerald-700">Suggested: &quot;{issue.suggestion}&quot;</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Domain / Coding Section (Section 9) - shown only if the interview actually reached the
          mid-interview trigger point; a session that ended early legitimately has none. */}
      {report.codingChallenge && (
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold font-display">Technical / Domain Coding Challenge</h2>
            <span className={`badge ${report.codingChallenge.status === "SUBMITTED" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
              {report.codingChallenge.status}
            </span>
          </div>
          <p className="text-sm text-slate-600">
            {report.codingChallenge.domain} track — <span className="font-semibold">{report.codingChallenge.problemTitle || "—"}</span>
          </p>
          {report.codingChallenge.scorePercent != null ? (
            <div className="grid grid-cols-3 gap-3">
              <StatBlock label="Score" value={`${report.codingChallenge.scorePercent}%`} />
              <StatBlock label="Verdict" value={report.codingChallenge.verdict || "—"} />
              <StatBlock label="Language" value={report.codingChallenge.language || "—"} />
            </div>
          ) : (
            <p className="text-xs text-slate-400">Not submitted — no score recorded.</p>
          )}
        </div>
      )}

      {report.weakTopics.length > 0 && (
        <div className="card bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-200">
          <h3 className="font-bold text-amber-900 mb-2">📌 Weak Topics</h3>
          <div className="flex flex-wrap gap-2">
            {report.weakTopics.map((t) => (
              <span key={t} className="chip bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-200">
                {t}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Answer-by-Answer Breakdown with mini gauges */}
      <div className="card space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold font-display">Answer-by-Answer Breakdown</h2>
            <p className="text-sm text-slate-500 mt-1">{report.answers.length} questions evaluated</p>
          </div>
        </div>

        <div className="space-y-4">
          {report.answers.map((a, i) => (
            <div key={i} className="border border-slate-200 rounded-2xl p-5 space-y-4 hover:shadow-card transition-shadow bg-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold shadow-premium"
                    style={{
                      background: a.weightedScore >= 75
                        ? "linear-gradient(135deg, #10b981, #059669)"
                        : a.weightedScore >= 50
                        ? "linear-gradient(135deg, #f59e0b, #d97706)"
                        : "linear-gradient(135deg, #ef4444, #dc2626)",
                    }}
                  >
                    Q{i + 1}
                  </div>
                  <div>
                    <p className="font-bold text-slate-800">Question {i + 1}</p>
                    <p className="text-xs text-slate-500">
                      Weighted Score: <span className="font-bold text-slate-800">{Math.round(a.weightedScore)}/100</span>
                    </p>
                  </div>
                </div>
                <ScoreGauge score={a.weightedScore} />
              </div>

              <div className="grid grid-cols-4 gap-2 py-3 border-y border-slate-100 bg-slate-50/50 rounded-xl">
                <MiniGauge value={a.correctness} label="Correctness" />
                <MiniGauge value={a.clarity} label="Clarity" />
                <MiniGauge value={a.depth} label="Depth" />
                <MiniGauge value={a.structure} label="Structure" />
              </div>

              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Feedback</p>
                <p className="text-sm text-slate-700 leading-relaxed">{a.feedback}</p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex justify-between bg-white rounded-lg px-3 py-2 border border-slate-100">
                  <span className="text-slate-500">Confidence</span>
                  <span className="font-bold text-slate-700">{Math.round(a.confidence)}%</span>
                </div>
                <div className="flex justify-between bg-white rounded-lg px-3 py-2 border border-slate-100">
                  <span className="text-slate-500">Avg Metric</span>
                  <span className="font-bold text-slate-700">
                    {Math.round((a.correctness + a.clarity + a.depth + a.structure) / 4)}%
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-6 cursor-zoom-out"
          onClick={() => setLightbox(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox} alt="Evidence detail" className="max-h-[85vh] max-w-full rounded-lg shadow-2xl" />
        </div>
      )}
    </div>
  );
}
