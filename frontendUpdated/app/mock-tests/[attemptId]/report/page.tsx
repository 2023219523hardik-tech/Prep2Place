"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import LoadingState from "@/components/LoadingState";
import ErrorState from "@/components/ErrorState";
import ScoreGauge from "@/components/ScoreGauge";

interface EvidenceCard {
  eventType: string; label: string; classification: string; severity: number; confidenceScore: number | null;
  occurredAt: string; durationSeconds: number | null; evidenceAvailable: boolean; evidenceRef: string | null;
  evidenceUnavailableReason: string | null; whatWasDetected: string; howToImprove: string;
}
interface FailedTest { name: string; input: string; expected: string; actual: string; error: string | null; }
interface CodingMistakeCard {
  questionIndex: number; questionTitle: string; topics: string[]; difficulty: string; verdict: string;
  scorePercent: number; failedTests: FailedTest[]; howToImprove: string; unattempted: boolean;
}
interface AptitudeMistakeCard {
  questionIndex: number; questionText: string; topic: string; difficulty: string; yourAnswer: string | null;
  correctAnswer: string; unanswered: boolean; explanation: string; howToImprove: string;
}
interface AttemptReport {
  attemptId: number; assessmentType: string; status: string; rawScore: number; maxPossibleScore: number;
  scorePercent: number; integrityScore: number; violationCount: number; overallSummary: string;
  strengths: string[]; weaknesses: string[]; evidenceCards: EvidenceCard[];
  codingMistakes: CodingMistakeCard[]; aptitudeMistakes: AptitudeMistakeCard[];
  repeatedIssues?: { category: string; count: number; description: string }[];
}

async function downloadReportPdf(report: AttemptReport) {
  const { jsPDF } = await import("jspdf");
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
    doc.text(text, margin, y); y += 20;
  }
  function subheading(text: string) {
    ensureSpace(18);
    doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(51, 65, 85);
    doc.text(text, margin, y); y += 15;
  }
  function body(text: string, indent = 0) {
    doc.setFont("helvetica", "normal").setFontSize(9.5).setTextColor(71, 85, 105);
    const lines = doc.splitTextToSize(text, pageWidth - margin * 2 - indent);
    for (const line of lines) { ensureSpace(13); doc.text(line, margin + indent, y); y += 13; }
  }
  function rule() {
    ensureSpace(10);
    doc.setDrawColor(226, 232, 240).line(margin, y, pageWidth - margin, y);
    y += 14;
  }

  doc.setFont("helvetica", "bold").setFontSize(20).setTextColor(15, 23, 42);
  doc.text("Mock Test Performance Report", margin, y); y += 26;
  doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(100, 116, 139);
  const typeLabel = report.assessmentType === "CODING_MOCK_TEST" ? "Coding Mock Test"
    : report.assessmentType === "APTITUDE_MOCK_TEST" ? "Aptitude Mock Test"
    : report.assessmentType;
  doc.text(`${typeLabel} — ${new Date().toLocaleDateString()}`, margin, y); y += 20;
  rule();

  heading("Overall Performance");
  body(`Score: ${Math.round(report.scorePercent)}%  |  Raw: ${report.rawScore} / ${report.maxPossibleScore}`);
  body(`Integrity score: ${report.integrityScore}/100  |  Status: ${report.status}  |  Violations logged: ${report.violationCount}`);
  body(report.overallSummary);
  y += 6; rule();

  if (report.strengths.length > 0) {
    heading("Strengths");
    report.strengths.forEach((s) => body(`• ${s}`, 10));
    y += 6;
  }
  if (report.weaknesses.length > 0) {
    heading("Areas to Improve");
    report.weaknesses.forEach((w) => body(`• ${w}`, 10));
    y += 6; rule();
  }

  if (report.evidenceCards.length > 0) {
    heading("Integrity Event Log");
    report.evidenceCards.forEach((c, i) => {
      subheading(`${i + 1}. ${c.label} — ${new Date(c.occurredAt).toLocaleString()}`);
      body(c.whatWasDetected, 10);
      body(`Severity: ${c.severity} | Confidence: ${c.confidenceScore != null ? `${Math.round(c.confidenceScore * 100)}%` : "—"} | Evidence: ${c.evidenceAvailable ? "captured" : `unavailable${c.evidenceUnavailableReason ? ` — ${c.evidenceUnavailableReason}` : ""}`}`, 10);
    });
    y += 6; rule();
  }

  if (report.codingMistakes.length > 0) {
    heading("Question Breakdown (Coding)");
    report.codingMistakes.forEach((c) => {
      subheading(`Q${c.questionIndex + 1}: ${c.questionTitle} — ${c.unattempted ? "Not Attempted" : `${c.scorePercent}%`}`);
      body(`Verdict: ${c.verdict} | Topics: ${c.topics.join(", ") || "—"} | Difficulty: ${c.difficulty || "—"}`, 10);
      body(c.howToImprove, 10);
      if (c.failedTests.length > 0) {
        subheading("  Failed test cases");
        c.failedTests.slice(0, 6).forEach((ft) => body(`• [${ft.name}] expected ${ft.expected.slice(0, 80)}; got ${ft.actual.slice(0, 80)}${ft.error ? ` (${ft.error.slice(0, 80)})` : ""}`, 14));
      }
    });
    y += 6; rule();
  }

  if (report.aptitudeMistakes.length > 0) {
    heading("Question Breakdown (Aptitude)");
    report.aptitudeMistakes.forEach((c) => {
      subheading(`Q${c.questionIndex + 1} — ${c.unanswered ? "Unanswered" : "Incorrect"}`);
      body(c.questionText, 10);
      body(`Correct: ${c.correctAnswer}${c.yourAnswer ? `  |  Your answer: ${c.yourAnswer}` : ""}  |  Topic: ${c.topic || "—"}  |  Difficulty: ${c.difficulty || "—"}`, 10);
      if (c.explanation) body(c.explanation, 10);
    });
  }

  doc.save(`mock-test-report-${report.attemptId}.pdf`);
}

export default function MockTestReportPage() {
  const params = useParams();
  const router = useRouter();
  const attemptId = params.attemptId as string;

  const [report, setReport] = useState<AttemptReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lightbox, setLightbox] = useState<string | null>(null);

  useEffect(() => {
    api.post<AttemptReport>(`/api/reports/generate/${attemptId}`, {})
      .then(setReport)
      .catch((e) => setError(e instanceof ApiError ? e.message : "Failed to load report"))
      .finally(() => setLoading(false));
  }, [attemptId]);

  if (loading) return <LoadingState label="Loading report..." />;
  if (error) return <ErrorState message={error} />;
  if (!report) return null;

  const isTerminated = report.status === "TERMINATED";

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-bold gradient-text">Mock Test Report</h1>
        <div className="flex gap-2">
          <button onClick={() => downloadReportPdf(report)} className="btn-primary text-sm">⬇ Download PDF</button>
          <button onClick={() => router.push("/mock-tests")} className="btn-secondary text-sm">&larr; Back to mock tests</button>
        </div>
      </div>

      <div className="card flex items-center gap-8 shadow-premium">
        <ScoreGauge score={report.scorePercent} label="Score" />
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h2 className="text-xl font-bold font-display">
              {report.assessmentType === "CODING_MOCK_TEST" ? "Coding Mock Test" : "Aptitude Mock Test"}
            </h2>
            <span className={`chip ${isTerminated ? "bg-red-50 text-red-700 border-red-200" : "bg-premium-50 text-premium-700 border-premium-200"}`}>
              {report.status}
            </span>
          </div>
          <p className="text-sm text-slate-600 leading-relaxed">{report.overallSummary}</p>
          <p className="mt-3 text-sm text-slate-500">
            Raw score: <span className="font-bold text-slate-800">{report.rawScore}</span> / {report.maxPossibleScore}
          </p>
        </div>
      </div>

      <div className={`card flex items-center justify-between ${report.violationCount > 0 ? "bg-amber-50 border-amber-200" : "bg-emerald-50 border-emerald-200"}`}>
        <div>
          <h3 className={`font-bold text-lg ${report.violationCount > 0 ? "text-amber-800" : "text-emerald-800"}`}>
            Integrity Score: {report.integrityScore}/100
          </h3>
          <p className={`text-sm ${report.violationCount > 0 ? "text-amber-700" : "text-emerald-700"}`}>
            {report.violationCount} integrity event{report.violationCount === 1 ? "" : "s"} recorded during this attempt.
          </p>
        </div>
      </div>

      {(report.strengths.length > 0 || report.weaknesses.length > 0) && (
        <div className="grid gap-4 sm:grid-cols-2">
          {report.strengths.length > 0 && (
            <div className="card bg-emerald-50 border-emerald-200">
              <h3 className="font-bold text-emerald-900 mb-2">Strengths</h3>
              <ul className="space-y-1 text-sm text-emerald-800">{report.strengths.map((s, i) => <li key={i}>• {s}</li>)}</ul>
            </div>
          )}
          {report.weaknesses.length > 0 && (
            <div className="card bg-amber-50 border-amber-200">
              <h3 className="font-bold text-amber-900 mb-2">Areas to improve</h3>
              <ul className="space-y-1 text-sm text-amber-800">{report.weaknesses.map((s, i) => <li key={i}>• {s}</li>)}</ul>
            </div>
          )}
        </div>
      )}

      {report.evidenceCards.length > 0 && (
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold font-display">Integrity Event Log &amp; Frame Evidence</h2>
              <p className="text-xs text-slate-500 mt-0.5">Verified timeline and captured video snapshots during test session</p>
            </div>
            <span className="badge bg-amber-50 text-amber-800 border border-amber-200">
              {report.evidenceCards.length} incident{report.evidenceCards.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {report.evidenceCards.map((c, i) => {
              const eventDate = new Date(c.occurredAt);
              const firstEventDate = new Date(report.evidenceCards[report.evidenceCards.length - 1].occurredAt);
              const diffSec = Math.max(0, Math.floor((eventDate.getTime() - firstEventDate.getTime()) / 1000));
              const m = Math.floor(diffSec / 60);
              const s = diffSec % 60;
              const startRel = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
              const dur = c.durationSeconds && c.durationSeconds > 0 ? Math.round(c.durationSeconds) : 2;
              const endSec = diffSec + dur;
              const em = Math.floor(endSec / 60);
              const es = endSec % 60;
              const endRel = `${String(em).padStart(2, "0")}:${String(es).padStart(2, "0")}`;
              const wallClock = eventDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

              return (
                <div key={i} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <span className="font-bold text-slate-900 text-sm">{c.label}</span>
                      <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                        {startRel} – {endRel}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-500 font-medium mb-2">
                      Time Frame: <span className="font-semibold text-slate-700">{startRel} – {endRel}</span> (+{m}m {s}s into test • {wallClock})
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed bg-slate-50/70 p-2.5 rounded-xl border border-slate-100">
                      {c.whatWasDetected}
                    </p>
                  </div>

                  {/* Attached Video Frame Snapshot */}
                  <div>
                    {c.evidenceAvailable ? (
                      <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-900 relative group aspect-video">
                        {c.evidenceRef ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={c.evidenceRef}
                            alt={`Frame snapshot for ${c.label}`}
                            className="w-full h-full object-cover group-hover:opacity-90 transition-opacity"
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 text-xs p-3 text-center bg-slate-950">
                            <span className="text-xl mb-1">📹</span>
                            <span className="font-semibold text-slate-300">Video Frame Snapshot Captured</span>
                            <span className="text-[10px] text-slate-500 font-mono mt-0.5">{wallClock}</span>
                          </div>
                        )}
                        <div className="absolute top-2 left-2 bg-black/75 backdrop-blur-xs text-white text-[10px] font-mono px-2 py-0.5 rounded font-bold border border-white/20">
                          Frame: {startRel}
                        </div>
                        <div className="absolute top-2 right-2 bg-red-600/90 text-white text-[10px] px-1.5 py-0.5 rounded font-bold">
                          Severity {c.severity}
                        </div>
                        {c.evidenceRef && (
                          <button
                            type="button"
                            onClick={() => setLightbox(c.evidenceRef)}
                            className="absolute inset-0 bg-blue-600/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-xs font-semibold text-white bg-black/50"
                          >
                            Click to Enlarge Snapshot 🔍
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="text-[11px] text-slate-400 italic bg-slate-50 p-2 rounded-lg border border-slate-100">
                        {c.evidenceUnavailableReason || "No camera frame snapshot was recorded for this instant event."}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {report.codingMistakes.length > 0 && (
        <div className="card space-y-4">
          <h2 className="text-xl font-bold font-display">Question Breakdown</h2>
          <div className="space-y-3">
            {report.codingMistakes.map((c) => (
              <div key={c.questionIndex} className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800">Q{c.questionIndex + 1}: {c.questionTitle}</span>
                  {c.unattempted ? (
                    <span className="badge bg-slate-100 text-slate-500">Not Attempted</span>
                  ) : (
                    <span className={`badge ${c.verdict === "PASSED" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>{c.verdict}</span>
                  )}
                </div>
                <p className="mt-1 text-sm text-slate-600">{c.howToImprove}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {report.aptitudeMistakes.length > 0 && (
        <div className="card space-y-4">
          <h2 className="text-xl font-bold font-display">Question Breakdown</h2>
          <div className="space-y-3">
            {report.aptitudeMistakes.map((c) => (
              <div key={c.questionIndex} className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800">Q{c.questionIndex + 1}</span>
                  {c.unanswered ? (
                    <span className="badge bg-slate-100 text-slate-500">Not Answered</span>
                  ) : (
                    <span className="badge bg-red-100 text-red-700">Incorrect</span>
                  )}
                </div>
                <p className="mt-1 text-sm text-slate-700">{c.questionText}</p>
                <p className="mt-1 text-xs text-slate-500">Correct answer: {c.correctAnswer}</p>
                <p className="mt-1 text-sm text-slate-600">{c.explanation}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {lightbox && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setLightbox(null)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="relative max-w-4xl max-h-[90vh] bg-slate-900 rounded-2xl overflow-hidden shadow-2xl border border-white/10" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={lightbox} alt="Enlarged evidence frame" className="max-w-full max-h-[80vh] object-contain mx-auto" />
            <div className="p-3 bg-slate-950 flex items-center justify-between text-white text-xs border-t border-white/10">
              <span className="font-semibold text-slate-300">Video Frame Evidence Snapshot</span>
              <button
                type="button"
                onClick={() => setLightbox(null)}
                className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium"
              >
                Close ✕
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
