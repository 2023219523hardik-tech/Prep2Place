"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { jobsApi, JobDetail } from "@/lib/jobs";
import { ApiError } from "@/lib/api";
import { useToast } from "@/hooks/useToast";
import { Skeleton } from "@/components/ui/Skeleton";
import ErrorState from "@/components/ErrorState";
import { Icon } from "@/components/ui/Icon";
import { extractTextFromFile, FileParseError } from "@/lib/fileParsing";

function formatSalary(min: number | null, max: number | null): string {
  if (min == null && max == null) return "Not disclosed";
  if (min != null && max != null) return `₹${min}–${max} LPA`;
  if (min != null) return `₹${min}+ LPA`;
  return `Up to ₹${max} LPA`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function JobDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { push } = useToast();
  const jobId = Number(params.id);
  const [job, setJob] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [applying, setApplying] = useState(false);
  const [showResume, setShowResume] = useState(false);
  const [resumeText, setResumeText] = useState("");
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [parsingResume, setParsingResume] = useState(false);
  const [resumeError, setResumeError] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [showTextEditor, setShowTextEditor] = useState(false);
  const [coverNote, setCoverNote] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [profileResume, setProfileResume] = useState<{ fileName?: string; text?: string } | null>(null);
  const [useProfileResume, setUseProfileResume] = useState(false);

  function load() {
    setLoading(true);
    jobsApi.get(jobId)
      .then(setJob)
      .catch((e) => setError(e instanceof ApiError ? e.message : "Failed to load job"))
      .finally(() => setLoading(false));

    // Try fetching student profile resume
    import("@/lib/api").then(({ api }) => {
      api.get<any>("/api/profile/student")
        .then((profile) => {
          if (profile && profile.resumeText) {
            setProfileResume({
              fileName: profile.resumeFileName || "Profile Resume",
              text: profile.resumeText,
            });
            // Keep unselected by default so student explicitly chooses to attach or upload
          }
        })
        .catch(() => {});
    });
  }

  useEffect(load, [jobId]);

  async function handleFileSelected(file: File | undefined) {
    if (!file) return;
    setResumeError("");
    setResumeText("");
    setUseProfileResume(false);
    const lowerName = file.name.toLowerCase();
    const isPdf = lowerName.endsWith(".pdf");
    const isDoc = lowerName.endsWith(".doc") || lowerName.endsWith(".docx");

    if (!isPdf && !isDoc) {
      setResumeError("Unsupported format. Please upload a PDF (.pdf) or Word document (.docx, .doc).");
      return;
    }

    setResumeFile(file);
    setParsingResume(true);
    try {
      const res = await extractTextFromFile(file);
      setResumeText(res.text);
      if (res.warning) {
        setResumeError(res.warning);
      }
    } catch (err: any) {
      setResumeText("");
      if (err instanceof FileParseError) {
        setResumeError(err.message);
      } else {
        setResumeError("Could not extract text from document. Please ensure file contains selectable text.");
      }
    } finally {
      setParsingResume(false);
    }
  }

  function handleRemoveFile() {
    setResumeFile(null);
    setResumeText("");
    setResumeError("");
    setUseProfileResume(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function handleSelectProfileResume() {
    if (profileResume?.text) {
      setResumeFile(null);
      setUseProfileResume(true);
      setResumeText(profileResume.text);
      setResumeError("");
    }
  }

  async function handleApply() {
    if (!resumeText.trim()) {
      setResumeError("A resume is required to apply for this campus drive. Please upload a document or use your profile resume.");
      return;
    }
    setApplying(true);
    try {
      await jobsApi.apply(jobId, { resumeText: resumeText.trim(), coverNote: coverNote.trim() || undefined });
      push({ title: "Application submitted successfully!", variant: "success" });
      setJob((j) => (j ? { ...j, alreadyApplied: true } : j));
      setShowResume(false);
    } catch (e: any) {
      if (e instanceof ApiError && e.status === 409) {
        push({ title: "You have already applied to this drive", variant: "info" });
        setJob((j) => (j ? { ...j, alreadyApplied: true } : j));
        setShowResume(false);
      } else {
        push({ title: e instanceof ApiError ? e.message : "Failed to apply", variant: "error" });
      }
    } finally {
      setApplying(false);
    }
  }

  if (loading) {
    return (
      <div className="page-shell">
        <div>
          <Skeleton className="h-8 w-1/2 mb-2" />
          <Skeleton className="h-5 w-1/3 mb-4" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="page-shell">
        <ErrorState message={error || "Job not found"} onRetry={load} />
      </div>
    );
  }

  return (
    <div className="page-shell">
      <Link href="/jobs" className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 mb-4">
        <Icon name="chevron-left" /> Back to jobs
      </Link>

      <div className="card mb-6">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-4">
          <div>
            <h1 className="text-2xl font-bold">{job.title}</h1>
            <p className="text-gray-600">{job.company}</p>
            <div className="flex flex-wrap gap-3 text-sm text-gray-600 mt-2">
              {job.location && <span className="inline-flex items-center gap-1">{job.location}</span>}
              <span className="inline-flex items-center gap-1"><Icon name="clock" />{job.employmentType?.replace("_", " ") || "—"}</span>
              <span className="inline-flex items-center gap-1"><Icon name="briefcase" />{job.experienceLevel || "—"}</span>
              <span className="inline-flex items-center gap-1">{formatSalary(job.salaryMinLpa, job.salaryMaxLpa)}</span>
            </div>
          </div>
          <div className="flex flex-col gap-2 items-end">
            {job.applyUrl ? (
              <a href={job.applyUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
                Apply on company site <Icon name="file-text" />
              </a>
            ) : job.alreadyApplied ? (
              <span className="badge badge-success">Applied</span>
            ) : (
              <button className="btn btn-primary" onClick={() => setShowResume(true)}>
                Apply now
              </button>
            )}
            <span className="text-xs text-gray-500">{job.applicantCount} applicants</span>
          </div>
        </div>

        {job.description && (
          <div className="prose max-w-none mb-4">
            <h3 className="font-semibold mb-2">Description</h3>
            <p className="whitespace-pre-wrap text-gray-700">{job.description}</p>
          </div>
        )}

        {job.requiredSkills && (
          <div className="mb-4">
            <h3 className="font-semibold mb-2">Required Skills</h3>
            <div className="flex flex-wrap gap-2">
              {job.requiredSkills.split(",").map((s, i) => (
                <span key={i} className="badge badge-neutral">{s.trim()}</span>
              ))}
            </div>
          </div>
        )}

        {job.niceToHaveSkills && (
          <div>
            <h3 className="font-semibold mb-2">Nice to Have</h3>
            <div className="flex flex-wrap gap-2">
              {job.niceToHaveSkills.split(",").map((s, i) => (
                <span key={i} className="badge badge-neutral">{s.trim()}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      {showResume && !job.alreadyApplied && (
        <div className="card shadow-premium border border-slate-200">
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-lg text-slate-900 font-display">Apply for {job.title}</h3>
              <p className="text-xs text-slate-500 mt-0.5">{job.company} · Campus Recruitment Drive</p>
            </div>
            <button
              onClick={() => setShowResume(false)}
              className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <Icon name="x" size={18} />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-semibold text-slate-800">
                  Resume / CV <span className="text-rose-500">*</span>
                </label>
                <span className="text-xs text-slate-500 font-medium">Format: PDF or Word (.docx, .doc)</span>
              </div>

              {/* Hidden Native File Input */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="hidden"
                disabled={parsingResume}
                onChange={(e) => handleFileSelected(e.target.files?.[0])}
              />

              {/* Profile resume option if available */}
              {profileResume?.text && (
                <div className="mb-3 p-3 rounded-xl border border-blue-200 bg-blue-50/60 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                      <Icon name="file-text" size={16} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-blue-900 truncate">
                        Saved Profile Resume: {profileResume.fileName}
                      </p>
                      <p className="text-[11px] text-blue-700">
                        {useProfileResume ? "Selected for application" : "Click use to attach this resume"}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleSelectProfileResume}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
                      useProfileResume
                        ? "bg-blue-600 text-white shadow-xs"
                        : "bg-white text-blue-700 border border-blue-200 hover:bg-blue-100/50"
                    }`}
                  >
                    {useProfileResume ? "✓ Selected" : "Use This Resume"}
                  </button>
                </div>
              )}

              {!resumeFile && !useProfileResume ? (
                /* Drag & Drop Upload Zone */
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                  onDragLeave={() => setDragActive(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragActive(false);
                    handleFileSelected(e.dataTransfer.files?.[0]);
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-7 text-center cursor-pointer transition-all ${
                    dragActive
                      ? "border-blue-500 bg-blue-50/50 scale-[1.005]"
                      : "border-slate-300 hover:border-blue-400 hover:bg-slate-50/60 bg-slate-50/30"
                  }`}
                >
                  <div className="flex justify-center items-center gap-2 mb-3">
                    <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center shadow-xs">
                      <Icon name="upload" size={24} />
                    </div>
                  </div>
                  <p className="font-semibold text-slate-800 text-sm mb-1">
                    Click to upload or drag &amp; drop your Resume
                  </p>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto mb-3">
                    Supported formats: <strong className="text-slate-700">PDF (.pdf)</strong> or <strong className="text-slate-700">Word (.doc, .docx)</strong> up to 5MB
                  </p>
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50">
                    <Icon name="file-text" size={14} className="text-blue-600" />
                    <span>Select PDF or Word Document</span>
                  </div>
                </div>
              ) : useProfileResume ? (
                /* Profile Resume Selected Card */
                <div className="rounded-2xl border border-blue-200 bg-blue-50/40 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-11 h-11 rounded-xl flex items-center justify-center font-bold text-xs uppercase shadow-xs bg-blue-600 text-white">
                        DOC
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm text-slate-900 truncate">
                          {profileResume?.fileName || "Profile Resume"}
                        </p>
                        <p className="text-xs text-blue-700 mt-0.5">
                          Attached from your student profile · Ready for submission
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-colors"
                      >
                        Upload Different File
                      </button>
                    </div>
                  </div>
                </div>
              ) : resumeFile ? (
                /* Selected File Card */
                <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold text-xs uppercase shadow-xs ${
                        resumeFile.name.toLowerCase().endsWith(".pdf")
                          ? "bg-rose-50 text-rose-600 border border-rose-200"
                          : "bg-blue-50 text-blue-600 border border-blue-200"
                      }`}>
                        {resumeFile.name.toLowerCase().endsWith(".pdf") ? "PDF" : "DOC"}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm text-slate-900 truncate">
                          {resumeFile.name}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {formatBytes(resumeFile.size)} · {parsingResume ? "Parsing content..." : "Ready for submission"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-colors"
                      >
                        Change
                      </button>
                      <button
                        type="button"
                        onClick={handleRemoveFile}
                        className="px-2.5 py-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-xs font-semibold text-rose-700 transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  </div>

                  {parsingResume && (
                    <div className="flex items-center gap-2 text-xs text-blue-600 bg-blue-50/60 p-2.5 rounded-xl border border-blue-100">
                      <span className="w-3.5 h-3.5 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
                      <span>Reading and parsing document contents...</span>
                    </div>
                  )}

                  {!parsingResume && resumeText && (
                    <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 font-medium">
                        <Icon name="check-circle" size={14} className="text-emerald-600" />
                        Text parsed ({resumeText.trim().split(/\s+/).length} words extracted)
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowTextEditor(!showTextEditor)}
                        className="text-xs text-blue-600 hover:text-blue-700 font-semibold"
                      >
                        {showTextEditor ? "Hide preview" : "Preview extracted text"}
                      </button>
                    </div>
                  )}

                  {showTextEditor && (
                    <div className="mt-2">
                      <textarea
                        className="input text-xs font-mono min-h-[100px] w-full"
                        value={resumeText}
                        onChange={(e) => setResumeText(e.target.value)}
                        placeholder="Extracted resume text..."
                      />
                    </div>
                  )}
                </div>
              ) : null}

              {resumeError && (
                <div className="mt-2 text-xs text-rose-600 bg-rose-50 border border-rose-200 p-2.5 rounded-xl flex items-center gap-2">
                  <Icon name="alert-triangle" size={14} />
                  <span>{resumeError}</span>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-800 mb-1">
                Cover Note <span className="font-normal text-slate-400">(optional)</span>
              </label>
              <textarea
                className="input min-h-[80px]"
                placeholder="Why are you a good fit for this role? Share relevant highlights..."
                value={coverNote}
                onChange={(e) => setCoverNote(e.target.value)}
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                className="btn btn-primary"
                disabled={applying || parsingResume}
                onClick={handleApply}
              >
                {applying ? "Submitting Application..." : "Submit Application"}
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => setShowResume(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
