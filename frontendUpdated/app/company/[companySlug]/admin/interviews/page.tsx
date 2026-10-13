"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { companyAdminApi, CompanyInterviewReport } from "@/lib/jobs";
import LoadingState from "@/components/LoadingState";
import ErrorState from "@/components/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";

export default function CompanyAdminInterviewsPage() {
  const params = useParams();
  const companySlug = (params.companySlug as string) || "sif360";

  const [interviews, setInterviews] = useState<CompanyInterviewReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  function load() {
    setLoading(true);
    companyAdminApi.interviews(companySlug)
      .then(setInterviews)
      .catch((e) => setError(e?.message || "Failed to load interviews"))
      .finally(() => setLoading(false));
  }

  useEffect(load, [companySlug]);

  if (loading) return <LoadingState label="Loading scheduled and AI interviews..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="space-y-6 pb-12 animate-slide-up">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Interview Management &amp; Schedules
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Track AI Interviews, Technical Video Rounds, and HR Discussions across company openings.
          </p>
        </div>
      </div>

      {interviews.length === 0 ? (
        <EmptyState
          icon="video"
          title="No Interviews Found"
          description="When candidates reach AI Interview or live technical interview rounds, they will be listed here."
        />
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/75 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3.5 px-4">Candidate</th>
                <th className="py-3.5 px-4">Role / Job</th>
                <th className="py-3.5 px-4">Interview Round</th>
                <th className="py-3.5 px-4">Type</th>
                <th className="py-3.5 px-4">Scheduled / Done</th>
                <th className="py-3.5 px-4">Score / Status</th>
                <th className="py-3.5 px-4">Meeting Link</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {interviews.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-3.5 px-4 font-semibold text-slate-900">
                    <div>{item.candidateName}</div>
                    <div className="text-[11px] text-slate-400 font-normal">{item.candidateEmail}</div>
                  </td>
                  <td className="py-3.5 px-4 font-medium text-slate-700">{item.jobTitle}</td>
                  <td className="py-3.5 px-4 font-bold text-indigo-700">{item.roundName}</td>
                  <td className="py-3.5 px-4">
                    <span className="px-2 py-0.5 rounded font-mono text-[10px] bg-slate-100 text-slate-700">
                      {item.roundType}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-slate-600">
                    {item.completedAt
                      ? new Date(item.completedAt).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })
                      : item.scheduledAt
                      ? new Date(item.scheduledAt).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })
                      : "Pending"}
                  </td>
                  <td className="py-3.5 px-4">
                    <span className={`px-2.5 py-1 rounded-full font-bold text-[10px] border ${
                      item.passed
                        ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                        : item.status === "FAILED"
                        ? "bg-rose-50 text-rose-700 border-rose-300"
                        : "bg-blue-50 text-blue-700 border-blue-300"
                    }`}>
                      {item.status} {item.score != null ? `(${item.score}%)` : ""}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    {item.meetingLink ? (
                      <a
                        href={item.meetingLink}
                        target="_blank"
                        rel="noreferrer"
                        className="text-indigo-600 hover:underline font-bold text-xs"
                      >
                        Join Room &rarr;
                      </a>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
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
