"use client";

import { useEffect, useState } from "react";
import { jobsAdminApi, JobSummary, ApplicationDetail, EMPLOYMENT_TYPES, EXPERIENCE_LEVELS, APPLICATION_STATUSES, JobUpsertRequest } from "@/lib/jobs";
import { ApiError } from "@/lib/api";
import ErrorState from "@/components/ErrorState";
import { DataTable } from "@/components/ui/DataTable";
import { Icon } from "@/components/ui/Icon";
import { SkeletonGroup } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/hooks/useToast";

const EMPTY_FORM: JobUpsertRequest = {
  title: "",
  company: "",
  location: "",
  employmentType: "FULL_TIME",
  experienceLevel: "ENTRY",
  salaryMinLpa: null,
  salaryMaxLpa: null,
  description: "",
  requiredSkills: "",
  niceToHaveSkills: "",
  applyUrl: "",
  closesAt: null,
  active: true,
};

const STATUS_BADGE: Record<string, string> = {
  APPLIED: "badge-neutral",
  SHORTLISTED: "badge-success",
  INTERVIEW: "badge-warning",
  OFFER: "badge-success",
  REJECTED: "badge-danger",
  WITHDRAWN: "badge-neutral",
};

export default function AdminJobsPage() {
  const { push } = useToast();
  const [jobs, setJobs] = useState<JobSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<boolean | "">("");

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<JobUpsertRequest>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [appsJobId, setAppsJobId] = useState<number | null>(null);
  const [selectedJob, setSelectedJob] = useState<JobSummary | null>(null);
  const [applications, setApplications] = useState<ApplicationDetail[]>([]);
  const [appsLoading, setAppsLoading] = useState(false);

  function load() {
    setLoading(true);
    const activeParam = activeFilter === "" ? undefined : activeFilter;
    jobsAdminApi.list({ search, active: activeParam, page, size: 20 })
      .then((res) => {
        setJobs(res.content);
        setTotal(res.total);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : "Failed to load jobs"))
      .finally(() => setLoading(false));
  }

  useEffect(load, [page, activeFilter]);

  function startCreate() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowForm(true);
  }

  function startEdit(job: JobSummary) {
    setForm({
      title: job.title,
      company: job.company,
      location: job.location || "",
      employmentType: job.employmentType || "FULL_TIME",
      experienceLevel: job.experienceLevel || "ENTRY",
      salaryMinLpa: job.salaryMinLpa,
      salaryMaxLpa: job.salaryMaxLpa,
      requiredSkills: job.requiredSkills || "",
      active: job.active,
    });
    setEditingId(job.id);
    setShowForm(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: JobUpsertRequest = {
        ...form,
        active: true,
      };
      if (editingId) {
        await jobsAdminApi.update(editingId, payload);
        push({ title: "Job updated and visible to students", variant: "success" });
      } else {
        await jobsAdminApi.create(payload);
        push({ title: "Job created and live for students", variant: "success" });
      }
      setShowForm(false);
      load();
    } catch (e) {
      push({ title: e instanceof ApiError ? e.message : "Save failed", variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(job: JobSummary) {
    try {
      await jobsAdminApi.toggleActive(job.id, !job.active);
      push({ title: `Job ${job.active ? "deactivated" : "activated"}`, variant: "success" });
      load();
    } catch (e) {
      push({ title: e instanceof ApiError ? e.message : "Action failed", variant: "error" });
    }
  }

  async function remove(job: JobSummary) {
    if (!confirm(`Delete job "${job.title}"?`)) return;
    try {
      await jobsAdminApi.remove(job.id);
      push({ title: "Job deleted", variant: "success" });
      load();
    } catch (e) {
      push({ title: e instanceof ApiError ? e.message : "Delete failed", variant: "error" });
    }
  }

  function viewApplications(jobId: number) {
    const job = jobs.find((j) => j.id === jobId) || null;
    setSelectedJob(job);
    setAppsJobId(jobId);
    setAppsLoading(true);
    jobsAdminApi.applications(jobId)
      .then((res) => setApplications(res.content))
      .catch((e) => push({ title: e instanceof ApiError ? e.message : "Failed to load applications", variant: "error" }))
      .finally(() => setAppsLoading(false));
  }

  async function updateStatus(applicationId: number, status: string) {
    try {
      await jobsAdminApi.updateStatus(applicationId, status);
      push({ title: "Status updated", variant: "success" });
      if (appsJobId) viewApplications(appsJobId);
    } catch (e) {
      push({ title: e instanceof ApiError ? e.message : "Update failed", variant: "error" });
    }
  }

  const columns = [
    {
      key: "title",
      label: "Job",
      width: "25%",
      render: (row: JobSummary) => (
        <div>
          <div className="font-semibold">{row.title}</div>
          <div className="text-xs text-gray-500">{row.company}</div>
        </div>
      ),
    },
    { key: "location", label: "Location", width: "12%", render: (r: JobSummary) => r.location || "—" },
    { key: "type", label: "Type", width: "12%", render: (r: JobSummary) => r.employmentType?.replace("_", " ") || "—" },
    { key: "level", label: "Level", width: "10%", render: (r: JobSummary) => r.experienceLevel || "—" },
    {
      key: "applicants",
      label: "Applicants",
      width: "10%",
      render: (r: JobSummary) => (
        <button className="link" onClick={() => viewApplications(r.id)}>{r.applicantCount}</button>
      ),
    },
    {
      key: "active",
      label: "Status",
      width: "10%",
      render: (r: JobSummary) => (
        <button className={`badge ${r.active ? "badge-success" : "badge-neutral"}`} onClick={() => toggleActive(r)}>
          {r.active ? "Active" : "Inactive"}
        </button>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      width: "21%",
      render: (r: JobSummary) => (
        <div className="flex gap-2">
          <button className="btn btn-ghost btn-sm" onClick={() => startEdit(r)}>Edit</button>
          <button className="btn btn-ghost btn-sm" onClick={() => viewApplications(r.id)}>Apps</button>
          <button className="btn btn-ghost btn-sm text-red-600" onClick={() => remove(r)}>Delete</button>
        </div>
      ),
    },
  ];

  const totalPages = Math.max(1, Math.ceil(total / 20));

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <h1 className="page-title">Jobs Management</h1>
          <p className="page-subtitle">Post and manage placement opportunities.</p>
        </div>
        <button className="btn btn-primary" onClick={startCreate}>
          <Icon name="plus" /> Post Job
        </button>
      </div>

      <div className="card mb-4">
        <div className="flex flex-col md:flex-row gap-3">
          <input
            className="input flex-1"
            placeholder="Search title or company…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { setPage(0); load(); } }}
          />
          <select
            className="input md:w-40"
            value={String(activeFilter)}
            onChange={(e) => { setActiveFilter(e.target.value === "" ? "" : e.target.value === "true"); setPage(0); }}
          >
            <option value="">All status</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </div>
      </div>

      {error && <ErrorState message={error} onRetry={load} />}

      {!showForm && (
        loading ? (
          <SkeletonGroup variant="table" />
        ) : jobs.length === 0 ? (
          <EmptyState icon="briefcase" title="No jobs" description="Post your first job opportunity." />
        ) : (
          <>
            <DataTable data={jobs} columns={columns} rowKey={(r) => String(r.id)} emptyTitle="No jobs" emptyDesc="Post your first job opportunity." emptyIcon="briefcase" />
            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-2 mt-4">
                <button className="btn btn-secondary" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>Previous</button>
                <span className="text-sm text-gray-600">Page {page + 1} of {totalPages}</span>
                <button className="btn btn-secondary" disabled={page >= totalPages - 1} onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}>Next</button>
              </div>
            )}
          </>
        )
      )}

      {showForm && (
        <form onSubmit={save} className="card space-y-4">
          <h2 className="text-xl font-semibold">{editingId ? "Edit Job" : "Post New Job"}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Title *</label>
              <input className="input" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Company *</label>
              <input className="input" required value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Location</label>
              <input className="input" value={form.location || ""} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Employment Type</label>
              <select className="input" value={form.employmentType} onChange={(e) => setForm({ ...form, employmentType: e.target.value })}>
                {EMPLOYMENT_TYPES.map((t) => <option key={t} value={t}>{t.replace("_", " ")}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Experience Level</label>
              <select className="input" value={form.experienceLevel} onChange={(e) => setForm({ ...form, experienceLevel: e.target.value })}>
                {EXPERIENCE_LEVELS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-sm font-medium mb-1">Min (LPA)</label>
                <input type="number" step="0.1" className="input" value={form.salaryMinLpa ?? ""} onChange={(e) => setForm({ ...form, salaryMinLpa: e.target.value ? Number(e.target.value) : null })} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Max (LPA)</label>
                <input type="number" step="0.1" className="input" value={form.salaryMaxLpa ?? ""} onChange={(e) => setForm({ ...form, salaryMaxLpa: e.target.value ? Number(e.target.value) : null })} />
              </div>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Apply URL (optional)</label>
              <input className="input" placeholder="https://…" value={form.applyUrl || ""} onChange={(e) => setForm({ ...form, applyUrl: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Description</label>
              <textarea className="input min-h-[120px]" value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Required Skills (comma separated)</label>
              <input className="input" value={form.requiredSkills || ""} onChange={(e) => setForm({ ...form, requiredSkills: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Nice to Have (comma separated)</label>
              <input className="input" value={form.niceToHaveSkills || ""} onChange={(e) => setForm({ ...form, niceToHaveSkills: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Closes On</label>
              <input type="date" className="input" value={form.closesAt || ""} onChange={(e) => setForm({ ...form, closesAt: e.target.value || null })} />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Saving…" : "Save"}</button>
            <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </form>
      )}

      {appsJobId !== null && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50" onClick={() => { setAppsJobId(null); setSelectedJob(null); }}>
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50/50">
              <div>
                <h2 className="text-xl font-bold font-display text-slate-900">
                  Candidate Applications ({applications.length})
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Review student profiles, resumes, and manage hiring pipeline status
                </p>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => { setAppsJobId(null); setSelectedJob(null); }}>
                ✕ Close
              </button>
            </div>

            {/* What Company Requires Card */}
            {selectedJob && (
              <div className="p-5 bg-blue-50/60 border-b border-blue-100/70 text-xs text-slate-700">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-900">{selectedJob.title}</span>
                    <span className="font-semibold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">{selectedJob.company}</span>
                  </div>
                  <div className="text-slate-600 font-medium">
                    {selectedJob.salaryMinLpa != null && selectedJob.salaryMaxLpa != null
                      ? `₹${selectedJob.salaryMinLpa} - ${selectedJob.salaryMaxLpa} LPA`
                      : "Best in Industry"} · {selectedJob.location || "Pan India"}
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="font-semibold text-slate-600">Company Requires:</span>
                  {selectedJob.requiredSkills ? (
                    selectedJob.requiredSkills.split(",").map((s, idx) => (
                      <span key={idx} className="bg-white border border-slate-200 px-2 py-0.5 rounded-md font-medium text-slate-800">
                        {s.trim()}
                      </span>
                    ))
                  ) : (
                    <span className="text-slate-500 italic">No specific skills listed</span>
                  )}
                  <span className="ml-2 font-semibold text-slate-600">Level:</span>
                  <span className="bg-white border border-slate-200 px-2 py-0.5 rounded-md font-medium text-slate-800">
                    {selectedJob.experienceLevel}
                  </span>
                  <span className="ml-2 font-semibold text-slate-600">Type:</span>
                  <span className="bg-white border border-slate-200 px-2 py-0.5 rounded-md font-medium text-slate-800">
                    {selectedJob.employmentType?.replace("_", " ")}
                  </span>
                </div>
              </div>
            )}

            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {appsLoading ? (
                <SkeletonGroup variant="table" />
              ) : applications.length === 0 ? (
                <EmptyState icon="briefcase" title="No applications yet" description="No students have applied for this opportunity yet." />
              ) : (
                applications.map((app) => (
                  <div key={app.id} className="card border border-slate-200 hover:border-slate-300 transition-all shadow-xs">
                    <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-3">
                      <div>
                        <div className="font-bold text-base text-slate-900">{app.applicantName}</div>
                        <div className="text-xs text-blue-600 hover:underline">{app.applicantEmail}</div>
                        <div className="text-xs text-slate-400 mt-1">Applied on {new Date(app.appliedAt).toLocaleString("en-IN")}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`badge ${STATUS_BADGE[app.status] || "badge-neutral"}`}>{app.status}</span>
                        <select
                          className="input text-xs py-1.5 px-3 w-36"
                          value={app.status}
                          onChange={(e) => updateStatus(app.id, e.target.value)}
                        >
                          {APPLICATION_STATUSES.map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {app.coverNote && (
                      <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-700 border border-slate-100 mb-2">
                        <strong className="text-slate-900">Candidate Note:</strong> {app.coverNote}
                      </div>
                    )}

                    {app.resumeText && (
                      <details className="mt-2 rounded-lg border border-slate-100 bg-slate-50/50 p-2.5">
                        <summary className="text-xs font-semibold text-blue-600 cursor-pointer select-none">
                          📄 View Candidate Resume &amp; Profile Details
                        </summary>
                        <pre className="text-xs font-mono bg-white p-3 mt-2 rounded border border-slate-200 whitespace-pre-wrap max-h-60 overflow-y-auto text-slate-800">
                          {app.resumeText}
                        </pre>
                      </details>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
