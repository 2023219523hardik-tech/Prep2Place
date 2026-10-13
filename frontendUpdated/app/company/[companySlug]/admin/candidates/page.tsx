"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { companyAdminApi, CandidateApplicationDetail } from "@/lib/jobs";
import { ApiError } from "@/lib/api";
import LoadingState from "@/components/LoadingState";
import ErrorState from "@/components/ErrorState";
import CandidateResumeViewerModal from "@/components/CandidateResumeViewerModal";

export default function CompanyCandidatesDirectoryPage() {
  const params = useParams();
  const router = useRouter();
  const companySlug = (params.companySlug as string) || "sif360";

  const [candidates, setCandidates] = useState<CandidateApplicationDetail[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeResumeCandidate, setActiveResumeCandidate] = useState<CandidateApplicationDetail | null>(null);

  useEffect(() => {
    loadCandidates();
  }, [companySlug]);

  async function loadCandidates() {
    try {
      setLoading(true);
      const res = await companyAdminApi.candidates(companySlug, {
        search: search.trim() || undefined,
        size: 50,
      });
      setCandidates(res.content || []);
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        router.push(`/company/${companySlug}/admin/login`);
        return;
      }
      setError(err instanceof ApiError ? err.message : "Failed to load candidates directory");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Company Candidates Directory
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Search, filter, and review student talent across all active and past recruitment drives.
          </p>
        </div>

        <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700 border border-indigo-200">
          {candidates.length} Registered Candidates
        </span>
      </div>

      {/* Search Bar */}
      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-xs">
        <div className="relative flex-1">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && loadCandidates()}
            placeholder="Search candidates by student name, email, college, or job title..."
            className="w-full rounded-lg border border-slate-200 bg-slate-50/50 py-1.5 pl-8 pr-3 text-xs text-slate-900 outline-none focus:border-indigo-500 focus:bg-white"
          />
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="absolute left-2.5 top-2.5 text-slate-400"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </div>
        <button
          onClick={loadCandidates}
          className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
        >
          Search
        </button>
      </div>

      {error && <ErrorState message={error} />}

      {/* Candidates List */}
      {loading ? (
        <LoadingState label="Loading candidate talent directory..." />
      ) : candidates.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <p className="text-sm font-bold text-slate-700">No candidates found</p>
          <p className="mt-1 text-xs text-slate-400">
            {search ? "No candidates matched your search criteria." : "As students apply to your job drives, their profiles will populate here."}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="border-b border-slate-200 bg-slate-50/70 font-semibold text-slate-700">
              <tr>
                <th className="py-3 px-4">Candidate</th>
                <th className="py-3 px-4">Applied Job Drive</th>
                <th className="py-3 px-4">Academic Background</th>
                <th className="py-3 px-4">Current Pipeline Stage</th>
                <th className="py-3 px-4">Score</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {candidates.map((cand) => (
                <tr key={cand.applicationId} className="hover:bg-slate-50/50 transition">
                  {/* Candidate Name & Email */}
                  <td className="py-3.5 px-4">
                    <p className="font-bold text-slate-900 text-sm">{cand.applicantName}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">{cand.applicantEmail}</p>
                    {cand.applicantPhone && (
                      <p className="text-[10px] text-slate-400 font-mono">{cand.applicantPhone}</p>
                    )}
                  </td>

                  {/* Applied Job */}
                  <td className="py-3.5 px-4">
                    <Link
                      href={`/company/${companySlug}/admin/jobs/${cand.jobId}/applications`}
                      className="font-bold text-slate-800 hover:text-indigo-600 block truncate max-w-[200px]"
                    >
                      {cand.jobTitle}
                    </Link>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Applied: {new Date(cand.appliedAt).toLocaleDateString()}
                    </p>
                  </td>

                  {/* Academics */}
                  <td className="py-3.5 px-4">
                    <p className="font-semibold text-slate-800">{cand.applicantCollege || "University Student"}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {cand.applicantBranch || "CSE"} • {cand.applicantGraduationYear || "2027"}
                    </p>
                    <p className="text-[10px] font-bold text-indigo-600 mt-0.5">
                      CGPA: {cand.applicantCgpa ?? "N/A"}
                    </p>
                  </td>

                  {/* Stage */}
                  <td className="py-3.5 px-4">
                    <span className="rounded bg-indigo-50 px-2 py-0.5 text-xs font-bold text-indigo-700">
                      {cand.currentRoundName || "Initial Screening"}
                    </span>
                  </td>

                  {/* Score */}
                  <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                    {cand.overallScore !== null ? `${cand.overallScore} pts` : "--"}
                  </td>

                  {/* Status */}
                  <td className="py-3.5 px-4">
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-700">
                      {cand.finalDecision || cand.applicationStatus}
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setActiveResumeCandidate(cand)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-xs hover:border-indigo-300 hover:bg-indigo-50/50 hover:text-indigo-700 transition"
                        title={cand.resumeFileName ? `File: ${cand.resumeFileName}` : "View Candidate Resume & Dossier"}
                      >
                        <span className="text-slate-400">📄</span>
                        <span className="truncate max-w-[110px]">{cand.resumeFileName || "Resume"}</span>
                      </button>
                      <Link
                        href={`/company/${companySlug}/admin/jobs/${cand.jobId}/applications`}
                        className="rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700 hover:bg-indigo-100 transition"
                      >
                        Pipeline
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Rich Candidate Resume & Dossier Modal */}
      {activeResumeCandidate && (
        <CandidateResumeViewerModal
          candidate={activeResumeCandidate}
          companySlug={companySlug}
          onClose={() => setActiveResumeCandidate(null)}
        />
      )}
    </div>
  );
}
