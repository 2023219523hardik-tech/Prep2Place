"use client";

import { useEffect, useState, useRef } from "react";
import {
  codingLabAdminApi,
  AssessmentAdmin,
  CodingType,
  CodingDifficulty,
  CodingAnalytics,
} from "@/lib/codingLabApi";
import ErrorState from "@/components/ErrorState";
import { DataTable } from "@/components/ui/DataTable";
import { FieldGroup } from "@/components/ui/FieldGroup";
import { Icon } from "@/components/ui/Icon";
import { SkeletonGroup } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/hooks/useToast";

const CODING_TYPES: CodingType[] = ["BACKEND", "FRONTEND", "MACHINE_LEARNING", "AI", "GENERATIVE_AI", "RAG"];
const DIFFICULTIES: CodingDifficulty[] = ["EASY", "MEDIUM", "HARD"];

const EMPTY_FORM = {
  title: "",
  codingType: "BACKEND" as CodingType,
  description: "",
  difficulty: "MEDIUM" as CodingDifficulty,
  technology: "",
  language: "java",
  runCommand: "javac *.java && java Main",
  timeLimitMinutes: 60,
  aiAssistantEnabled: true,
  aiMaxHints: 5,
};

export default function AdminCodingAssessmentsPage() {
  const [assessments, setAssessments] = useState<AssessmentAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [analytics, setAnalytics] = useState<CodingAnalytics | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState("");
  const [showCreateStudio, setShowCreateStudio] = useState(false);
  const [jsonImportModalOpen, setJsonImportModalOpen] = useState(false);
  const [jsonFile, setJsonFile] = useState<File | null>(null);
  const [jsonPreview, setJsonPreview] = useState("");
  const [importingJson, setImportingJson] = useState(false);
  const jsonFileInputRef = useRef<HTMLInputElement>(null);
  const { push } = useToast();

  function load() {
    setLoading(true);
    codingLabAdminApi
      .list()
      .then(setAssessments)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
    codingLabAdminApi.analyticsOverview().then(setAnalytics).catch(() => {});
  }
  useEffect(load, []);

  async function createAssessment(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await codingLabAdminApi.create({
        ...form,
        starterFiles: { "Main.java": "public class Main {\n  public static void main(String[] args) {\n    // TODO\n  }\n}\n" },
      });
      setForm(EMPTY_FORM);
      push({ variant: "success", title: "Assessment created", description: "New coding assessment is ready." });
      load();
    } catch (e: any) {
      setError(e.message);
      push({ variant: "error", title: "Create failed", description: e.message });
    } finally {
      setSaving(false);
    }
  }

  async function runAction(action: (id: number) => Promise<AssessmentAdmin>, id: number) {
    setError("");
    try {
      await action(id);
      push({ variant: "success", title: "Action completed" });
      load();
    } catch (e: any) {
      setError(e.message);
      push({ variant: "error", title: "Action failed", description: e.message });
    }
  }

  async function toggleExpand(id: number) {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    try {
      setSubmissions(await codingLabAdminApi.submissions(id));
    } catch (e: any) {
      setError(e.message);
    }
  }

  function clearFilters() {
    setSearch("");
    setTypeFilter("");
    setDifficultyFilter("");
  }

  async function handleJsonFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setJsonFile(file);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        setJsonPreview(`Found ${parsed.length} assessment items in JSON array.`);
      } else if (parsed && typeof parsed === "object") {
        setJsonPreview(`Found assessment: "${parsed.title || "Untitled"}" (${parsed.codingType || "BACKEND"})`);
      }
    } catch {
      setJsonPreview("Warning: File contains invalid JSON format.");
    }
  }

  async function runJsonImport() {
    if (!jsonFile) return;
    setImportingJson(true);
    try {
      const text = await jsonFile.text();
      const parsed = JSON.parse(text);
      const items = Array.isArray(parsed) ? parsed : [parsed];
      let imported = 0;
      for (const item of items) {
        if (!item.title) continue;
        await codingLabAdminApi.create({
          title: item.title,
          codingType: item.codingType || "BACKEND",
          description: item.description || "",
          difficulty: item.difficulty || "MEDIUM",
          technology: item.technology || "",
          language: item.language || "java",
          runCommand: item.runCommand || "javac *.java && java Main",
          timeLimitMinutes: item.timeLimitMinutes || 60,
          aiAssistantEnabled: item.aiAssistantEnabled ?? true,
          aiMaxHints: item.aiMaxHints ?? 5,
          starterFiles: item.starterFiles || { "Main.java": "public class Main {\n  public static void main(String[] args) {\n    // TODO\n  }\n}\n" },
        });
        imported++;
      }
      push({ variant: "success", title: "Import completed", description: `Successfully imported ${imported} assessment(s).` });
      setJsonImportModalOpen(false);
      setJsonFile(null);
      setJsonPreview("");
      load();
    } catch (e: any) {
      push({ variant: "error", title: "Import failed", description: e?.message || "Invalid JSON payload." });
    } finally {
      setImportingJson(false);
    }
  }

  function downloadSampleAssessmentJson() {
    const sample = [
      {
        title: "High-Throughput Rate Limiter",
        codingType: "BACKEND",
        description: "Implement a sliding window token-bucket rate limiter that enforces per-client IP throttling.",
        difficulty: "MEDIUM",
        technology: "Java 21 / Spring Boot",
        language: "java",
        runCommand: "javac *.java && java Main",
        timeLimitMinutes: 60,
        aiAssistantEnabled: true,
        aiMaxHints: 4,
        starterFiles: {
          "Main.java": "public class Main {\n  public static void main(String[] args) {\n    System.out.println(\"RateLimiter active\");\n  }\n}\n"
        }
      }
    ];
    const blob = new Blob([JSON.stringify(sample, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sample-coding-assessment.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  const difficultyBadge = (d: string) =>
    d === "EASY" ? "badge badge-success" : d === "MEDIUM" ? "badge badge-warning" : "badge badge-danger";

  const statusBadge = (s: string) => {
    if (s === "PUBLISHED") return "badge badge-success";
    if (s === "ARCHIVED") return "badge badge-neutral";
    return "badge badge-warning";
  };

  const filtered = assessments.filter((a) => {
    if (search && !a.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (typeFilter && a.codingType !== typeFilter) return false;
    if (difficultyFilter && a.difficulty !== difficultyFilter) return false;
    return true;
  });

  const kpiTiles = (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {[0, 1, 2, 3].map((i) => (
        <SkeletonGroup key={i} variant="kpi" />
      ))}
    </div>
  );

  const columns = [
    {
      key: "id",
      label: "ID",
      width: "80px",
      render: (row: AssessmentAdmin) => (
        <span className="badge badge-neutral font-mono text-xs">#{row.id}</span>
      ),
    },
    {
      key: "title",
      label: "Title",
      width: "22%",
      render: (row: AssessmentAdmin) => (
        <div className="min-w-0">
          <div className="font-semibold text-slate-900 truncate">{row.title}</div>
          <div className="text-xs text-slate-500 mt-0.5">
            {row.language} &middot; {row.timeLimitMinutes} min
            {row.aiAssistantEnabled && <> &middot; AI: {row.aiMaxHints} hints</>}
          </div>
        </div>
      ),
    },
    {
      key: "codingType",
      label: "Type",
      width: "14%",
      render: (row: AssessmentAdmin) => (
        <span className="chip chip-muted">{row.codingType}</span>
      ),
    },
    {
      key: "difficulty",
      label: "Difficulty",
      width: "12%",
      render: (row: AssessmentAdmin) => (
        <span className={`badge ${difficultyBadge(row.difficulty)}`}>{row.difficulty}</span>
      ),
    },
    {
      key: "status",
      label: "Status",
      width: "14%",
      render: (row: AssessmentAdmin) => (
        <span className={statusBadge(row.status)}>{row.status}</span>
      ),
    },
    {
      key: "submissions",
      label: "Submissions",
      width: "10%",
      align: "center" as const,
      render: (row: AssessmentAdmin) => (
        <button
          onClick={() => toggleExpand(row.id)}
          className={`font-semibold ${expandedId === row.id ? "text-premium-700" : "text-slate-700 hover:text-premium-700"}`}
        >
          View
        </button>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      width: "20%",
      align: "right" as const,
      render: (row: AssessmentAdmin) => (
        <div className="flex items-center justify-end gap-1">
          {row.status !== "PUBLISHED" ? (
            <button
              onClick={() => runAction(codingLabAdminApi.publish, row.id)}
              className="btn-ghost btn-sm btn-icon text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
              title="Publish"
            >
              <Icon name="chart-bar" size={16} />
            </button>
          ) : (
            <button
              onClick={() => runAction(codingLabAdminApi.unpublish, row.id)}
              className="btn-ghost btn-sm btn-icon text-amber-600 hover:text-amber-700 hover:bg-amber-50"
              title="Unpublish"
            >
              <Icon name="eye-off" size={16} />
            </button>
          )}
          <button
            onClick={() => runAction(codingLabAdminApi.duplicate, row.id)}
            className="btn-ghost btn-sm btn-icon"
            title="Duplicate"
          >
            <Icon name="copy" size={16} />
          </button>
          <button
            onClick={() => runAction(codingLabAdminApi.archive, row.id)}
            className="btn-ghost btn-sm btn-icon text-red-600 hover:text-red-700 hover:bg-red-50"
            title="Archive"
          >
            <Icon name="trash-2" size={16} />
          </button>
        </div>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold">Coding Assessments</h1>
            <p className="text-sm text-slate-500 mt-1">Live coding labs with AI assistance, multi-language support, and real-time grading.</p>
          </div>
          <div className="flex gap-2">
            <SkeletonGroup variant="kpi" />
          </div>
        </div>
        {kpiTiles}
        <div className="surface-card p-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="w-80">
              <SkeletonGroup variant="kpi" />
            </div>
            <div className="flex gap-2">
              {[0, 1, 2].map((i) => (
                <SkeletonGroup key={i} variant="kpi" />
              ))}
            </div>
          </div>
        </div>
        <SkeletonGroup variant="table" />
      </div>
    );
  }

  const showEmpty = filtered.length === 0;
  const isFirstEmpty = assessments.length === 0;

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Top Header */}
      <div className="surface-card px-6 py-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Icon name="code" size={20} />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Coding Lab Assessments
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Production coding labs with real-time container grading, automated test cases, and AI hints.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={() => setShowCreateStudio(!showCreateStudio)}
            className="btn-primary !text-xs !py-2 !px-3.5 shadow-sm"
          >
            <Icon name={showCreateStudio ? "x" : "plus"} size={14} />
            {showCreateStudio ? "Close Studio" : "New Assessment"}
          </button>
          <button
            type="button"
            onClick={() => setJsonImportModalOpen(true)}
            className="btn-secondary !text-xs !py-2 !px-3"
          >
            <Icon name="upload" size={14} /> Import JSON
          </button>
          <button
            type="button"
            onClick={load}
            className="btn-secondary !text-xs !py-2 !px-3"
            title="Refresh list"
          >
            <Icon name="refresh-cw" size={14} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {/* Modern KPI Cards */}
      {analytics && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="surface-card p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Labs</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{analytics.totalAssessments}</p>
              <span className="inline-flex items-center text-[11px] text-emerald-600 font-medium mt-1">
                Active in catalog
              </span>
            </div>
            <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Icon name="terminal" size={20} />
            </div>
          </div>

          <div className="surface-card p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Submissions</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{analytics.totalSubmissions}</p>
              <span className="inline-flex items-center text-[11px] text-slate-500 mt-1">
                Graded attempts
              </span>
            </div>
            <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Icon name="play" size={20} />
            </div>
          </div>

          <div className="surface-card p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Avg. Score</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{analytics.averageScore.toFixed(1)}/100</p>
              <span className="inline-flex items-center text-[11px] text-amber-600 font-medium mt-1">
                Across all candidates
              </span>
            </div>
            <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Icon name="award" size={20} />
            </div>
          </div>

          <div className="surface-card p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Test Pass Rate</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{(analytics.testPassRate * 100).toFixed(0)}%</p>
              <span className="inline-flex items-center text-[11px] text-emerald-600 font-medium mt-1">
                All test assertions
              </span>
            </div>
            <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Icon name="check-circle" size={20} />
            </div>
          </div>
        </div>
      )}

      {/* Expandable Assessment Creation Studio */}
      {showCreateStudio && (
        <div className="surface-card rounded-2xl border border-indigo-200 bg-white p-6 shadow-sm space-y-5 animate-slide-down">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">Create Coding Assessment</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Set up runtime configurations, language restrictions, and AI hints guardrails.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowCreateStudio(false)}
              className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
            >
              <Icon name="x" size={18} />
            </button>
          </div>

          <form onSubmit={createAssessment} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2 space-y-1">
                <label className="text-xs font-semibold text-slate-700">Assessment Title *</label>
                <input
                  className="input text-sm w-full rounded-xl"
                  placeholder="e.g. Distributed Task Queue & Worker Implementation"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Domain / Type *</label>
                <select
                  className="select text-sm w-full rounded-xl"
                  value={form.codingType}
                  onChange={(e) => setForm({ ...form, codingType: e.target.value as CodingType })}
                >
                  {CODING_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Problem Statement & Requirements</label>
              <textarea
                className="input text-sm w-full rounded-xl min-h-[90px] py-2"
                placeholder="Detailed instructions for candidates, problem constraints, and expected output..."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Difficulty</label>
                <select
                  className="select text-sm w-full rounded-xl"
                  value={form.difficulty}
                  onChange={(e) => setForm({ ...form, difficulty: e.target.value as CodingDifficulty })}
                >
                  {DIFFICULTIES.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Primary Language</label>
                <select
                  className="select text-sm w-full rounded-xl"
                  value={form.language}
                  onChange={(e) => setForm({ ...form, language: e.target.value })}
                >
                  <option value="java">Java 21</option>
                  <option value="node">Node.js (TypeScript/JS)</option>
                  <option value="python">Python 3.12</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Time Limit (mins)</label>
                <input
                  type="number"
                  min={5}
                  max={180}
                  className="input text-sm w-full rounded-xl"
                  value={form.timeLimitMinutes}
                  onChange={(e) => setForm({ ...form, timeLimitMinutes: Number(e.target.value) })}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Max AI Hints</label>
                <input
                  type="number"
                  min={0}
                  max={10}
                  className="input text-sm w-full rounded-xl"
                  value={form.aiMaxHints}
                  onChange={(e) => setForm({ ...form, aiMaxHints: Number(e.target.value) })}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Run Command (Container Runner)</label>
              <input
                className="input font-mono text-xs w-full rounded-xl bg-slate-50"
                placeholder="javac *.java && java Main"
                value={form.runCommand}
                onChange={(e) => setForm({ ...form, runCommand: e.target.value })}
              />
              <p className="text-[11px] text-slate-500">
                Command executed inside isolated runner container to evaluate solution and tests.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowCreateStudio(false)}
                className="btn-secondary btn-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary btn-sm shadow-sm"
                disabled={saving}
              >
                <Icon name={saving ? "refresh-cw" : "plus"} size={14} className={saving ? "animate-spin" : ""} />
                {saving ? "Creating Lab..." : "Create Coding Assessment"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filter Toolbar Card */}
      <div className="surface-card p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between gap-4 flex-wrap">
        <div className="relative w-80 max-w-full">
          <Icon
            name="search"
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            className="input input-sm pl-9 rounded-xl text-xs w-full"
            placeholder="Search assessments by title..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mr-1">
              Type:
            </span>
            <button
              onClick={() => setTypeFilter("")}
              className={`chip ${typeFilter === "" ? "chip-active" : "chip-muted"} text-xs`}
            >
              All
            </button>
            {CODING_TYPES.slice(0, 4).map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(typeFilter === t ? "" : t)}
                className={`chip ${typeFilter === t ? "chip-active" : "chip-muted"} text-xs`}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="w-px h-5 bg-slate-200 hidden md:block" />

          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mr-1">
              Difficulty:
            </span>
            {["ALL", ...DIFFICULTIES].map((d) => (
              <button
                key={d}
                onClick={() => setDifficultyFilter(d === "ALL" ? "" : d)}
                className={`chip ${difficultyFilter === (d === "ALL" ? "" : d) ? "chip-active" : "chip-muted"} text-xs`}
              >
                {d === "ALL" ? "All" : d}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && assessments.length === 0 ? (
        <div>
          <ErrorState message={error} />
          <div className="flex justify-center mt-4">
            <button
              type="button"
              onClick={() => {
                load();
                push({ variant: "info", title: "Retrying..." });
              }}
              className="btn-secondary btn-sm"
            >
              <Icon name="refresh-cw" size={16} />
              Try Again
            </button>
          </div>
        </div>
      ) : isFirstEmpty ? (
        <EmptyState
          icon="terminal"
          title="No coding assessments yet"
          description="Create your first live coding assessment to evaluate candidates with real-world problems and AI-powered hints."
          variant="info"
          action={
            <button
              type="button"
              className="btn-primary btn-sm"
              onClick={() => setShowCreateStudio(true)}
            >
              <Icon name="plus" size={16} />
              Create First Assessment
            </button>
          }
        />
      ) : showEmpty ? (
        <EmptyState
          icon="search"
          title="No matching assessments"
          description="Try adjusting your search terms or clearing filters."
          action={
            <button className="btn-secondary btn-sm" onClick={clearFilters}>
              Clear Filters
            </button>
          }
        />
      ) : (
        <div className="space-y-4">
          <div className="surface-card rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <DataTable<AssessmentAdmin>
              columns={columns}
              data={filtered}
              rowKey="id"
              emptyTitle="No matching assessments"
              emptyDesc="Try adjusting your search or filters."
              emptyIcon="search"
            />
          </div>

          {filtered.map((a) =>
            expandedId === a.id ? (
              <div
                key={`submissions-${a.id}`}
                className="surface-card rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden p-5 space-y-4"
              >
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Submissions: {a.title}
                    </h3>
                    <p className="text-xs text-slate-500">
                      Review candidate test outcomes and benchmark scores.
                    </p>
                  </div>
                  <button
                    onClick={() => setExpandedId(null)}
                    className="btn-ghost btn-sm"
                  >
                    <Icon name="x" size={16} />
                    Close
                  </button>
                </div>

                {submissions.length === 0 ? (
                  <div className="py-8 text-center text-slate-500 text-sm">
                    No submissions recorded yet for this assessment.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50/70 border-b border-slate-200 text-left text-slate-500 text-xs uppercase tracking-wider">
                        <tr>
                          <th className="px-4 py-3 font-semibold">Candidate</th>
                          <th className="px-4 py-3 font-semibold">Kind</th>
                          <th className="px-4 py-3 font-semibold">Status</th>
                          <th className="px-4 py-3 font-semibold">Score</th>
                          <th className="px-4 py-3 font-semibold">Tests</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {submissions.map((s) => (
                          <tr key={s.id} className="hover:bg-slate-50/50">
                            <td className="px-4 py-3 font-medium text-slate-800">
                              {s.candidateName || s.candidateId}
                            </td>
                            <td className="px-4 py-3 text-slate-600">{s.kind}</td>
                            <td className="px-4 py-3">
                              <span className={`badge ${
                                s.status === "PASSED" ? "badge-success" :
                                s.status === "FAILED" ? "badge-danger" : "badge-neutral"
                              }`}>
                                {s.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 font-bold text-slate-800">
                              {s.score?.toFixed?.(0) ?? s.score}
                            </td>
                            <td className="px-4 py-3 text-slate-600">
                              {s.testsPassed}/{s.testsTotal}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : null
          )}
        </div>
      )}

      {/* JSON Import Modal */}
      <Modal
        open={jsonImportModalOpen}
        onClose={() => !importingJson && setJsonImportModalOpen(false)}
        title="Import Coding Assessments via JSON"
        description="Upload a JSON array of coding assessment definitions with starters, test configurations, and AI limits."
        size="md"
        footer={
          <div className="flex items-center justify-between w-full">
            <button
              type="button"
              onClick={downloadSampleAssessmentJson}
              className="btn-ghost btn-sm text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50"
            >
              <Icon name="download" size={14} /> Download Sample JSON
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setJsonImportModalOpen(false)}
                disabled={importingJson}
                className="btn-secondary btn-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={runJsonImport}
                disabled={!jsonFile || importingJson}
                className="btn-primary btn-sm"
              >
                <Icon name={importingJson ? "refresh-cw" : "upload"} size={14} className={importingJson ? "animate-spin" : ""} />
                {importingJson ? "Importing..." : "Upload & Import"}
              </button>
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="border-2 border-dashed border-slate-200 rounded-xl p-5 hover:border-indigo-400 transition-colors">
            <input
              ref={jsonFileInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={handleJsonFileChange}
            />
            <div className="flex flex-col items-center justify-center text-center gap-2">
              <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Icon name="upload" size={22} />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">Choose Assessment JSON File</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Top-level array or object with title, codingType, language, starterFiles, etc.
                </p>
              </div>
              <button
                type="button"
                onClick={() => jsonFileInputRef.current?.click()}
                className="btn-secondary btn-sm mt-2"
              >
                <Icon name="folder" size={12} /> Select File
              </button>
            </div>
          </div>

          {jsonFile && (
            <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-700 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Icon name="file-code" size={14} className="text-slate-400 shrink-0" />
                <span className="font-medium truncate">{jsonFile.name}</span>
                <span className="text-slate-400 shrink-0">
                  {(jsonFile.size / 1024).toFixed(1)} KB
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setJsonFile(null);
                  setJsonPreview("");
                }}
                className="btn-ghost btn-icon btn-xs text-slate-400 hover:text-slate-700"
              >
                <Icon name="x" size={12} />
              </button>
            </div>
          )}

          {jsonPreview && (
            <p className="text-xs text-slate-600 bg-indigo-50/60 border border-indigo-100 rounded-lg p-2.5">
              {jsonPreview}
            </p>
          )}
        </div>
      </Modal>
    </div>
  );
}
