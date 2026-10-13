"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { companyAdminApi, CompanyInterviewReport } from "@/lib/jobs";
import LoadingState from "@/components/LoadingState";
import ErrorState from "@/components/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";

export default function CompanyAdminReportsPage() {
  const params = useParams();
  const companySlug = (params.companySlug as string) || "sif360";

  const [reports, setReports] = useState<CompanyInterviewReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  function load() {
    setLoading(true);
    companyAdminApi.reports(companySlug)
      .then(setReports)
      .catch((e) => setError(e?.message || "Failed to load reports"))
      .finally(() => setLoading(false));
  }

  useEffect(load, [companySlug]);

  if (loading) return <LoadingState label="Loading candidate reports & assessment performance..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const passedCount = reports.filter((r) => r.passed).length;
  const avgScore = reports.length > 0
    ? Math.round(reports.reduce((acc, r) => acc + (r.score || 0), 0) / reports.length)
    : 0;

  return (
    <div className="space-y-6 pb-12 animate-slide-up">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Candidate Evaluation Reports
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Detailed performance results across aptitude, coding labs, SQL, DataFrame, and interviews.
          </p>
        </div>
      </div>

      {/* KPI summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-center">
          <div className="text-xs text-slate-500 font-semibold">Evaluations Completed</div>
          <div className="text-xl font-bold text-slate-900 mt-1">{reports.length}</div>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 text-center">
          <div className="text-xs text-emerald-700 font-semibold">Cleared / Passed</div>
          <div className="text-xl font-bold text-emerald-800 mt-1">{passedCount}</div>
        </div>
        <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 text-center">
          <div className="text-xs text-blue-700 font-semibold">Average Score</div>
          <div className="text-xl font-bold text-blue-800 mt-1">{avgScore}%</div>
        </div>
      </div>

      {reports.length === 0 ? (
        <EmptyState
          icon="file-text"
          title="No Evaluation Reports Generated"
          description="Completed assessments and round evaluation scores will appear here automatically."
        />
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/75 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3.5 px-4">Candidate</th>
                <th className="py-3.5 px-4">Job Posting</th>
                <th className="py-3.5 px-4">Round</th>
                <th className="py-3.5 px-4">Score</th>
                <th className="py-3.5 px-4">Cutoff</th>
                <th className="py-3.5 px-4">Result</th>
                <th className="py-3.5 px-4">Feedback / Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {reports.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-3.5 px-4 font-semibold text-slate-900">
                    <div>{item.candidateName}</div>
                    <div className="text-[11px] text-slate-400 font-normal">{item.candidateEmail}</div>
                  </td>
                  <td className="py-3.5 px-4 font-medium text-slate-700">{item.jobTitle}</td>
                  <td className="py-3.5 px-4 font-bold text-indigo-700">{item.roundName}</td>
                  <td className="py-3.5 px-4 font-bold text-slate-900">{item.score != null ? `${item.score}%` : "—"}</td>
                  <td className="py-3.5 px-4 text-slate-500">{item.passingScore != null ? `${item.passingScore}%` : "—"}</td>
                  <td className="py-3.5 px-4">
                    <span className={`px-2.5 py-1 rounded-full font-bold text-[10px] border ${
                      item.passed
                        ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                        : "bg-rose-50 text-rose-700 border-rose-300"
                    }`}>
                      {item.passed ? "PASSED" : "FAILED"}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-slate-600 max-w-xs truncate">
                    {item.notes || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
