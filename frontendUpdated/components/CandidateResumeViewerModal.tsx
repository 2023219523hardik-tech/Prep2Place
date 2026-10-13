"use client";

import { useState } from "react";
import { CandidateApplicationDetail, companyAdminApi } from "@/lib/jobs";

interface Props {
  candidate: CandidateApplicationDetail | null;
  companySlug: string;
  onClose: () => void;
}

export default function CandidateResumeViewerModal({ candidate, companySlug, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<"FORMATTED" | "RAW">("FORMATTED");
  const [copied, setCopied] = useState(false);

  if (!candidate) return null;
  const currentCandidate = candidate;

  const fileName =
    currentCandidate.resumeFileName ||
    `${currentCandidate.applicantName.replace(/[^a-zA-Z0-9_-]/g, "_")}_Resume.txt`;

  function handleDownload() {
    const downloadUrl = companyAdminApi.downloadResumeUrl(companySlug, currentCandidate.applicationId);
    
    // Attempt download via backend endpoint first
    const token = localStorage.getItem("adminAccessToken") || localStorage.getItem("accessToken");
    fetch(downloadUrl, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((res) => {
        if (!res.ok) throw new Error("Download failed");
        return res.blob();
      })
      .then((blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      })
      .catch(() => {
        // Fallback: create client-side text blob download
        const content = `================================================================================
                         CANDIDATE RESUME DOSSIER                               
================================================================================

CANDIDATE:        ${currentCandidate.applicantName}
EMAIL:            ${currentCandidate.applicantEmail}
PHONE:            ${currentCandidate.applicantPhone || "N/A"}
INSTITUTION:      ${currentCandidate.applicantCollege || "N/A"}
DEGREE & BRANCH:  ${currentCandidate.applicantDegree || "N/A"} - ${currentCandidate.applicantBranch || "N/A"}
CGPA:             ${currentCandidate.applicantCgpa ?? "N/A"}
GRADUATION YEAR:  ${currentCandidate.applicantGraduationYear || "N/A"}
APPLIED JOB:      ${currentCandidate.jobTitle}
APPLICATION DATE: ${new Date(currentCandidate.appliedAt).toLocaleString()}
ATS MATCH SCORE:  ${currentCandidate.atsScore != null ? `${currentCandidate.atsScore}%` : "Not Screened"}

================================================================================
                         ATTACHED RESUME TEXT CONTENT                           
================================================================================

${currentCandidate.resumeText || "(No resume text content available)"}
`;
        const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      });
  }

  function handleCopy() {
    if (!currentCandidate.resumeText) return;
    navigator.clipboard.writeText(currentCandidate.resumeText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handlePrint() {
    window.print();
  }

  const initials = candidate.applicantName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3 sm:p-5 backdrop-blur-sm">
      <div className="flex flex-col h-[90vh] max-h-[850px] w-full max-w-4xl rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Top Header */}
        <div className="shrink-0 border-b border-slate-100 bg-slate-50/70 p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white font-bold text-sm shadow-sm shrink-0">
              {initials || "CA"}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-slate-900 text-base truncate">
                  {candidate.applicantName}
                </h3>
                <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700 border border-indigo-200">
                  {candidate.jobTitle}
                </span>
                {candidate.atsScore != null && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold border ${
                      candidate.atsScore >= 75
                        ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                        : "bg-amber-50 text-amber-800 border-amber-300"
                    }`}
                  >
                    {candidate.atsScore}% ATS Match
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5 flex-wrap">
                <span>{candidate.applicantEmail}</span>
                {candidate.applicantPhone && <span>• {candidate.applicantPhone}</span>}
                <span>
                  • {candidate.applicantCollege || "University Student"}{" "}
                  {candidate.applicantDegree ? `(${candidate.applicantDegree})` : ""}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Download Original Resume Button */}
            <button
              type="button"
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition cursor-pointer"
              title="Download original attached resume document"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span>Download Original Resume</span>
            </button>

            {/* Print / Save PDF Button */}
            <button
              type="button"
              onClick={handlePrint}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 shadow-xs transition cursor-pointer"
              title="Print or export as PDF"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="6 9 6 2 18 2 18 9" />
                <path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" />
                <rect x="6" y="14" width="12" height="8" />
              </svg>
              <span>Print / PDF</span>
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
              aria-label="Close modal"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Subheader: Attached File Badge & View Tabs */}
        <div className="shrink-0 px-5 py-2.5 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-medium">Attached File:</span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-slate-200 font-mono text-[11px] font-bold text-slate-800 shadow-2xs">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-indigo-600">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              {fileName}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="inline-flex p-0.5 rounded-lg bg-slate-200/70 text-[11px] font-bold">
              <button
                type="button"
                onClick={() => setActiveTab("FORMATTED")}
                className={`px-3 py-1 rounded-md transition cursor-pointer ${
                  activeTab === "FORMATTED"
                    ? "bg-white text-indigo-700 shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Dossier Document View
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("RAW")}
                className={`px-3 py-1 rounded-md transition cursor-pointer ${
                  activeTab === "RAW"
                    ? "bg-white text-indigo-700 shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Raw Source Text
              </button>
            </div>

            <button
              type="button"
              onClick={handleCopy}
              className="text-[11px] font-semibold text-slate-600 hover:text-indigo-600 transition px-2 py-1 rounded-md hover:bg-slate-100"
            >
              {copied ? "✓ Copied" : "Copy Content"}
            </button>
          </div>
        </div>

        {/* Modal Body / Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 bg-white">
          {/* Candidate Academic & Criteria Dossier Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Academic CGPA</p>
              <p className="text-sm font-extrabold text-slate-900 mt-0.5">
                {candidate.applicantCgpa != null ? `${candidate.applicantCgpa} / 10.0` : "Not Disclosed"}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Graduation Year</p>
              <p className="text-sm font-extrabold text-slate-900 mt-0.5">
                {candidate.applicantGraduationYear || "Class of 2026/2027"}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Branch &amp; Major</p>
              <p className="text-sm font-extrabold text-slate-900 mt-0.5 truncate">
                {candidate.applicantBranch || "Computer Science"}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Eligibility Check</p>
              <p className="text-sm font-extrabold mt-0.5">
                {candidate.eligibilityPassed ? (
                  <span className="text-emerald-600">Passed Criteria</span>
                ) : (
                  <span className="text-rose-600">Criteria Failed</span>
                )}
              </p>
            </div>
          </div>

          {/* Cover Note Callout if present */}
          {candidate.coverNote && (
            <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-4 text-xs space-y-1">
              <p className="font-bold text-indigo-950 flex items-center gap-1.5">
                <span>Candidate Cover Note</span>
              </p>
              <p className="text-indigo-900/90 leading-relaxed whitespace-pre-wrap">
                {candidate.coverNote}
              </p>
            </div>
          )}

          {/* Tab Content */}
          {activeTab === "FORMATTED" ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-5 space-y-4">
              <div className="border-b border-slate-200/80 pb-3 flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">Resume Document Content</h4>
                  <p className="text-[11px] text-slate-500">
                    Extracted and parsed verbatim from candidate submission
                  </p>
                </div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  {candidate.resumeText ? `${candidate.resumeText.split(/\s+/).length} words` : "Empty"}
                </span>
              </div>

              {candidate.resumeText ? (
                <div className="text-xs leading-relaxed text-slate-800 space-y-3 font-sans">
                  {candidate.resumeText.split(/\n\s*\n/).map((paragraph, idx) => (
                    <p key={idx} className="whitespace-pre-wrap">
                      {paragraph}
                    </p>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center text-slate-400">
                  <p className="text-xs font-semibold">No resume body text was extracted from this submission.</p>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-slate-900 p-4 overflow-x-auto">
              <pre className="font-mono text-xs leading-relaxed text-slate-200 whitespace-pre-wrap">
                {candidate.resumeText || "// No resume text content available"}
              </pre>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="shrink-0 border-t border-slate-100 bg-slate-50/70 px-5 py-3 flex items-center justify-between">
          <p className="text-[11px] text-slate-400">
            Prep2Place ATS &amp; Candidate Document Archive
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownload}
              className="px-4 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition cursor-pointer"
            >
              Download File
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl text-xs font-bold bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 transition cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
