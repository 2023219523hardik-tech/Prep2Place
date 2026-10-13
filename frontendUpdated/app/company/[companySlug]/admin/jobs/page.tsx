"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { companyAdminApi, CompanyJobDetail } from "@/lib/jobs";
import { ApiError } from "@/lib/api";
import LoadingState from "@/components/LoadingState";
import ErrorState from "@/components/ErrorState";

export default function CompanyJobsPage() {
  const params = useParams();
  const router = useRouter();
  const companySlug = (params.companySlug as string) || "sif360";

  const [jobs, setJobs] = useState<CompanyJobDetail[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionBusy, setActionBusy] = useState<number | null>(null);

  useEffect(() => {
    loadJobs();
  }, [companySlug, statusFilter]);

  async function loadJobs() {
    try {
      setLoading(true);
      const res = await companyAdminApi.jobs(companySlug, {
        search: search.trim() || undefined,
        status: statusFilter === "ALL" ? undefined : statusFilter,
      });
      setJobs(res.content || []);
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        router.push(`/company/${companySlug}/admin/login`);
        return;
      }
      setError(err instanceof ApiError ? err.message : "Failed to load jobs");
    } finally {
      setLoading(false);
    }
  }

  async function handleStatusChange(jobId: number, nextStatus: string) {
    if (!window.confirm(`Change job status to ${nextStatus}?`)) return;
    setActionBusy(jobId);
    try {
      await companyAdminApi.updateStatus(companySlug, jobId, nextStatus);
      await loadJobs();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Status update failed");
    } finally {
      setActionBusy(null);
    }
  }

  async function handleDelete(jobId: number, title: string) {
    if (!window.confirm(`Are you sure you want to delete job "${title}"? This cannot be undone.`)) return;
    setActionBusy(jobId);
    try {
      await companyAdminApi.deleteJob(companySlug, jobId);
      await loadJobs();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Failed to delete job");
    } finally {
      setActionBusy(null);
    }
  }

  const statusBadges: Record<string, string> = {
    PUBLISHED: "bg-emerald-50 text-emerald-700 border-emerald-200",
    DRAFT: "bg-amber-50 text-amber-700 border-amber-200",
    CLOSED: "bg-slate-100 text-slate-700 border-slate-200",
    ARCHIVED: "bg-rose-50 text-rose-700 border-rose-200",
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Job Opportunities & Recruitment Drives
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Configure multi-round hiring pipelines, manage criteria, and review candidate submissions.
          </p>
        </div>

        <Link
          href={`/company/${companySlug}/admin/jobs/create`}
          className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span>Create New Job</span>
        </Link>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-xs">
        <div className="flex flex-1 items-center gap-2 min-w-[260px]">
          <div className="relative flex-1">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && loadJobs()}
              placeholder="Search by title, department, skills..."
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
            onClick={loadJobs}
            className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200"
          >
            Search
          </button>
        </div>

        <div className="flex items-center gap-1">
          {["ALL", "PUBLISHED", "DRAFT", "CLOSED", "ARCHIVED"].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold capitalize transition ${
                statusFilter === s
                  ? "bg-indigo-50 text-indigo-700 font-bold"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
              }`}
            >
              {s.toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Error state */}
      {error && <ErrorState message={error} />}

      {/* Table of Jobs */}
      {loading ? (
        <LoadingState label="Loading company job postings..." />
      ) : jobs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <p className="text-sm font-bold text-slate-700">No job postings found</p>
          <p className="mt-1 text-xs text-slate-400">
            {search || statusFilter !== "ALL"
              ? "Try clearing your filters or search query"
              : "Get started by creating your first campus or off-campus recruitment drive"}
          </p>
          <Link
            href={`/company/${companySlug}/admin/jobs/create`}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
          >
            Create Job Drive
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="border-b border-slate-200 bg-slate-50/70 font-semibold text-slate-700">
              <tr>
                <th className="py-3 px-4">Role & Details</th>
                <th className="py-3 px-4">Type & Openings</th>
                <th className="py-3 px-4">Package (CTC)</th>
                <th className="py-3 px-4">Pipeline Rounds</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {jobs.map((job) => (
                <tr key={job.id} className="hover:bg-slate-50/50 transition">
                  {/* Title & Department */}
                  <td className="py-3.5 px-4">
                    <Link
                      href={`/company/${companySlug}/admin/jobs/${job.id}`}
                      className="font-bold text-slate-900 hover:text-indigo-600 text-sm block"
                    >
                      {job.title}
                    </Link>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {job.department || "Technology"} • {job.location || "Remote"}
                    </p>
                  </td>

                  {/* Type & Openings */}
                  <td className="py-3.5 px-4">
                    <span className="font-semibold text-slate-800">{job.jobType || job.employmentType}</span>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {job.openings ? `${job.openings} Openings` : "Multiple Openings"}
                    </p>
                  </td>

                  {/* CTC */}
                  <td className="py-3.5 px-4 font-mono">
                    <span className="font-semibold text-slate-800">
                      ₹{job.salaryMin ?? job.salaryMinLpa}–{job.salaryMax ?? job.salaryMaxLpa} LPA
                    </span>
                    {job.stipend && (
                      <p className="text-[11px] text-slate-400 mt-0.5 font-sans">
                        ₹{job.stipend.toLocaleString()}/mo stipend
                      </p>
                    )}
                  </td>

                  {/* Rounds count */}
                  <td className="py-3.5 px-4">
                    <span className="inline-flex items-center gap-1 rounded bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700">
                      {job.rounds?.length || 0} configured rounds
                    </span>
                  </td>

                  {/* Status Badge */}
                  <td className="py-3.5 px-4">
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        statusBadges[job.status] || "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {job.status}
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/company/${companySlug}/admin/jobs/${job.id}/applications`}
                        className="rounded border border-indigo-200 bg-indigo-50/50 px-2.5 py-1 text-[11px] font-bold text-indigo-700 hover:bg-indigo-100"
                        title="View Candidates in Pipeline"
                      >
                        Candidates
                      </Link>

                      <Link
                        href={`/company/${companySlug}/admin/jobs/${job.id}`}
                        className="rounded border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                        title="Configure Pipeline & Criteria"
                      >
                        Pipeline
                      </Link>

                      {/* Status Dropdown */}
                      <select
                        value={job.status}
                        disabled={actionBusy === job.id}
                        onChange={(e) => handleStatusChange(job.id, e.target.value)}
                        className="rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 outline-none hover:border-slate-300"
                      >
                        <option value="PUBLISHED">Publish</option>
                        <option value="DRAFT">Draft</option>
                        <option value="CLOSED">Close</option>
                        <option value="ARCHIVED">Archive</option>
                      </select>

                      <button
                        onClick={() => handleDelete(job.id, job.title)}
                        disabled={actionBusy === job.id}
                        className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                        title="Delete Job"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    </div>
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
