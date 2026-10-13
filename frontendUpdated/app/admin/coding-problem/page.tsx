"use client";

import { useEffect, useState } from "react";
import { adminApi } from "@/lib/adminApi";
import ErrorState from "@/components/ErrorState";
import { DataTable } from "@/components/ui/DataTable";
import { FieldGroup } from "@/components/ui/FieldGroup";
import { Icon } from "@/components/ui/Icon";
import { SkeletonGroup } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/hooks/useToast";
import JsonUploadButton from "../../../components/admin/JsonUploadButton";

const DIFFICULTIES = ["EASY", "MEDIUM", "HARD"];
const EXECUTION_MODES = ["METHOD", "STDIN", "SCRIPT", "CONTEST", "SQL", "DATAFRAME"];

const UPLOAD_SAMPLE = `[
  {
    "title": "Two Sum",
    "statement": "Given an array of integers nums and a target, return indices of the two numbers that add up to target.",
    "topic": "Arrays",
    "difficulty": "EASY",
    "sampleInput": "[2,7,11,15], target=9",
    "sampleOutput": "[0,1]",
    "examples": [
      { "title": "Example 1", "input": "[2,7,11,15], target=9", "output": "[0,1]", "explanation": "", "hidden": false }
    ],
    "constraints": [{ "text": "2 <= nums.length <= 10^4" }],
    "timeLimitMs": 1000,
    "memoryLimitMb": 256,
    "companyTags": "Google, Amazon",
    "methodName": "twoSum",
    "returnType": "int[]",
    "parameters": [
      { "name": "nums", "type": "int[]", "description": "input array" },
      { "name": "target", "type": "int", "description": "target sum" }
    ],
    "executionMode": "METHOD"
  },
  {
    "title": "Top Paid Employee Per Department",
    "statement": "Write a SQL query to find the highest-paid employee in each department.",
    "topic": "SQL",
    "difficulty": "MEDIUM",
    "sampleInput": "employees(id, name, department, salary)",
    "sampleOutput": "department, name, salary",
    "examples": [],
    "constraints": [],
    "executionMode": "SQL",
    "schemaDdl": "CREATE TABLE employees (id INT, name TEXT, department TEXT, salary INT);\\nINSERT INTO employees VALUES (1,'A','Eng',90000), (2,'B','Eng',85000);",
    "expectedOutput": "Eng, A, 90000"
  },
  {
    "title": "Average Age by City",
    "statement": "Given a pandas DataFrame df with columns name, city, age, compute the average age per city.",
    "topic": "DataFrame",
    "difficulty": "MEDIUM",
    "sampleInput": "df with columns [name, city, age]",
    "sampleOutput": "city, avg_age",
    "examples": [],
    "constraints": [],
    "executionMode": "DATAFRAME",
    "schemaDdl": "df columns: name (str), city (str), age (int)",
    "expectedOutput": "Delhi, 28.5\\nMumbai, 31.0"
  }
]`;

interface ParameterSpec { name: string; type: string; description: string; }
interface ExampleRow { title: string; input: string; output: string; explanation: string; hidden: boolean; }
interface ConstraintRow { text: string; }
interface CodingProblemAdmin {
  id: number;
  title: string;
  statement: string;
  topic: string;
  difficulty: string;
  sampleInput: string;
  sampleOutput: string;
  examples: ExampleRow[];
  constraints: ConstraintRow[];
  timeLimitMs: number;
  memoryLimitMb: number;
  companyTags: string | null;
  methodName: string | null;
  returnType: string | null;
  parameters: ParameterSpec[];
  executionMode: string;
  schemaDdl: string | null;
  expectedOutput: string | null;
  active: boolean;
}
interface Page { content: CodingProblemAdmin[]; totalElements: number; totalPages: number; page: number; size: number; }

const EMPTY_FORM = {
  title: "",
  statement: "",
  topic: "",
  difficulty: "MEDIUM",
  sampleInput: "",
  sampleOutput: "",
  examples: [] as ExampleRow[],
  constraints: [] as ConstraintRow[],
  timeLimitMs: 1000,
  memoryLimitMb: 256,
  companyTags: "",
  methodName: "",
  returnType: "",
  parameters: [] as ParameterSpec[],
  executionMode: "METHOD",
  schemaDdl: "",
  expectedOutput: "",
};

export default function AdminCodingProblemsPage() {
  const [data, setData] = useState<Page | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [page, setPage] = useState(0);
  const [showInactive, setShowInactive] = useState(false);
  const [search, setSearch] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState("");
  const [modeFilter, setModeFilter] = useState("");
  const { push } = useToast();

  function load() {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), size: "20" });
    if (!showInactive) params.set("active", "true");
    if (search.trim()) params.set("search", search.trim());
    adminApi
      .get<Page>(`/api/admin/coding-problems?${params.toString()}`)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }
  useEffect(load, [page, showInactive]);

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingId(null);
  }

  function startEdit(p: CodingProblemAdmin) {
    setForm({
      title: p.title,
      statement: p.statement || "",
      topic: p.topic || "",
      difficulty: p.difficulty,
      sampleInput: p.sampleInput || "",
      sampleOutput: p.sampleOutput || "",
      examples: p.examples,
      constraints: p.constraints,
      timeLimitMs: p.timeLimitMs,
      memoryLimitMb: p.memoryLimitMb,
      companyTags: p.companyTags || "",
      methodName: p.methodName || "",
      returnType: p.returnType || "",
      parameters: p.parameters,
      executionMode: p.executionMode,
      schemaDdl: p.schemaDdl || "",
      expectedOutput: p.expectedOutput || "",
    });
    setEditingId(p.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const payload = {
      title: form.title,
      statement: form.statement,
      topic: form.topic,
      difficulty: form.difficulty,
      sampleInput: form.sampleInput,
      sampleOutput: form.sampleOutput,
      examples: form.examples,
      constraints: form.constraints,
      timeLimitMs: form.timeLimitMs,
      memoryLimitMb: form.memoryLimitMb,
      companyTags: form.companyTags || null,
      methodName: form.methodName || null,
      returnType: form.returnType || null,
      parameters: form.parameters,
      executionMode: form.executionMode,
      schemaDdl: form.schemaDdl || null,
      expectedOutput: form.expectedOutput || null,
    };
    try {
      if (editingId) {
        await adminApi.put(`/api/admin/coding-problems/${editingId}`, payload);
        push({ variant: "success", title: "Problem updated", description: "Changes have been saved." });
      } else {
        await adminApi.post("/api/admin/coding-problems", payload);
        push({ variant: "success", title: "Problem created", description: "New coding problem added." });
      }
      resetForm();
      load();
    } catch (e: any) {
      setError(e.message);
      push({ variant: "error", title: "Save failed", description: e.message });
    } finally {
      setSaving(false);
    }
  }

  async function archive(id: number) {
    if (!confirm("Archive this problem? It will stop appearing to students but stays in history.")) return;
    try {
      await adminApi.del(`/api/admin/coding-problems/${id}`);
      push({ variant: "success", title: "Problem archived" });
      load();
    } catch (e: any) {
      setError(e.message);
      push({ variant: "error", title: "Archive failed", description: e.message });
    }
  }

  async function reactivate(id: number) {
    await adminApi.patch(`/api/admin/coding-problems/${id}/reactivate`, {});
    push({ variant: "success", title: "Problem reactivated" });
    load();
  }

  function addExample() {
    setForm((f) => ({ ...f, examples: [...f.examples, { title: "", input: "", output: "", explanation: "", hidden: false }] }));
  }
  function updateExample(i: number, patch: Partial<ExampleRow>) {
    setForm((f) => ({ ...f, examples: f.examples.map((e, idx) => (idx === i ? { ...e, ...patch } : e)) }));
  }
  function removeExample(i: number) {
    setForm((f) => ({ ...f, examples: f.examples.filter((_, idx) => idx !== i) }));
  }

  function addConstraint() {
    setForm((f) => ({ ...f, constraints: [...f.constraints, { text: "" }] }));
  }
  function updateConstraint(i: number, text: string) {
    setForm((f) => ({ ...f, constraints: f.constraints.map((c, idx) => (idx === i ? { text } : c)) }));
  }
  function removeConstraint(i: number) {
    setForm((f) => ({ ...f, constraints: f.constraints.filter((_, idx) => idx !== i) }));
  }

  function addParameter() {
    setForm((f) => ({ ...f, parameters: [...f.parameters, { name: "", type: "", description: "" }] }));
  }
  function updateParameter(i: number, patch: Partial<ParameterSpec>) {
    setForm((f) => ({ ...f, parameters: f.parameters.map((p, idx) => (idx === i ? { ...p, ...patch } : p)) }));
  }
  function removeParameter(i: number) {
    setForm((f) => ({ ...f, parameters: f.parameters.filter((_, idx) => idx !== i) }));
  }

  function clearFilters() {
    setSearch("");
    setDifficultyFilter("");
    setModeFilter("");
    setShowInactive(false);
    setPage(0);
  }

  const hiddenCount = form.examples.filter((e) => e.hidden).length;

  const difficultyBadge = (d: string) =>
    d === "EASY" ? "badge badge-success" : d === "MEDIUM" ? "badge badge-warning" : "badge badge-danger";

  const modeBadge = (m: string) => {
    if (m === "SQL") return "badge badge-accent";
    if (m === "DATAFRAME") return "badge badge-warning";
    return "badge badge-neutral";
  };

  const content = data?.content || [];

  const filtered = content.filter((p) => {
    if (difficultyFilter && p.difficulty !== difficultyFilter) return false;
    if (modeFilter && p.executionMode !== modeFilter) return false;
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
      render: (row: CodingProblemAdmin) => (
        <span className="badge badge-neutral font-mono text-xs">#{row.id}</span>
      ),
    },
    {
      key: "title",
      label: "Title",
      render: (row: CodingProblemAdmin) => (
        <div className="max-w-64 truncate font-semibold text-slate-900">{row.title}</div>
      ),
    },
    {
      key: "topic",
      label: "Topic",
      render: (row: CodingProblemAdmin) => {
        if (!row.topic) return <span className="text-slate-400">—</span>;
        return <span className="chip chip-muted">{row.topic}</span>;
      },
    },
    {
      key: "difficulty",
      label: "Difficulty",
      render: (row: CodingProblemAdmin) => (
        <span className={`badge ${difficultyBadge(row.difficulty)}`}>{row.difficulty}</span>
      ),
    },
    {
      key: "executionMode",
      label: "Mode",
      render: (row: CodingProblemAdmin) => (
        <span className={`badge ${modeBadge(row.executionMode)}`}>{row.executionMode}</span>
      ),
    },
    {
      key: "hiddenTests",
      label: "Hidden",
      render: (row: CodingProblemAdmin) => {
        const count = row.examples.filter((e) => e.hidden).length;
        return (
          <span className={`badge ${count > 0 ? "badge-success" : "badge-neutral"}`}>
            {count} test{count !== 1 ? "s" : ""}
          </span>
        );
      },
    },
    {
      key: "active",
      label: "Status",
      render: (row: CodingProblemAdmin) => (
        <span className={`badge ${row.active ? "badge-success" : "badge-neutral"}`}>
          {row.active ? "Active" : "Archived"}
        </span>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      align: "right" as const,
      render: (row: CodingProblemAdmin) => (
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={() => startEdit(row)}
            className="btn-ghost btn-sm btn-icon"
            title="Edit"
          >
            <Icon name="pencil" size={16} />
          </button>
          <button
            onClick={() => row.active ? archive(row.id) : reactivate(row.id)}
            className={`btn-ghost btn-sm btn-icon ${row.active ? "text-red-600 hover:text-red-700 hover:bg-red-50" : "text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"}`}
            title={row.active ? "Archive" : "Reactivate"}
          >
            <Icon name={row.active ? "lock" : "unlock"} size={16} />
          </button>
        </div>
      ),
    },
  ];

  if (loading && !data) {
    return (
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold">Coding Problems</h1>
            <p className="text-sm text-slate-500 mt-1">Create and manage coding problems, test cases, and execution environments.</p>
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

  const showEmpty = !loading && filtered.length === 0;
  const isFirstEmpty = !loading && (!data || data.totalElements === 0);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Coding Problems</h1>
          <p className="text-sm text-slate-500 mt-1">Create and manage coding problems, test cases, and execution environments.</p>
        </div>
        <div className="flex gap-2">
          <JsonUploadButton
            endpoint="/api/admin/coding-problems/bulk-upload"
            sample={UPLOAD_SAMPLE}
            onUploaded={load}
          />
        </div>
      </div>

      {loading && kpiTiles}

      <FieldGroup title={editingId ? `Edit Problem #${editingId}` : "Create New Coding Problem"} description={editingId ? "Update the problem details below." : "Add a new problem with test cases, constraints, and execution settings."}>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <input className="input col-span-2" placeholder="Title" value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })} required />
            <select className="input" value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value })}>
              {DIFFICULTIES.map((d) => <option key={d}>{d}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input className="input" placeholder="Topic (e.g. Arrays)" value={form.topic}
              onChange={(e) => setForm({ ...form, topic: e.target.value })} />
            <input className="input" placeholder="Company tags (comma-separated)" value={form.companyTags}
              onChange={(e) => setForm({ ...form, companyTags: e.target.value })} />
          </div>
          <textarea className="input" placeholder="Problem statement" rows={4} value={form.statement}
            onChange={(e) => setForm({ ...form, statement: e.target.value })} required />

          <div className="border border-slate-200 rounded-lg p-3 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-slate-700">Function signature</h3>
              <select className="input w-40" value={form.executionMode}
                onChange={(e) => setForm({ ...form, executionMode: e.target.value })}>
                {EXECUTION_MODES.map((m) => <option key={m}>{m}</option>)}
              </select>
            </div>
            {form.executionMode === "METHOD" && (
              <>
                <p className="text-xs text-slate-500">
                  Required for METHOD mode - without these, the generated starter code falls back to a
                  generic, unmarked stub for every language.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <input className="input" placeholder="Method name (e.g. twoSum)" value={form.methodName}
                    onChange={(e) => setForm({ ...form, methodName: e.target.value })} required />
                  <input className="input" placeholder="Return type (e.g. int[])" value={form.returnType}
                    onChange={(e) => setForm({ ...form, returnType: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  {form.parameters.map((p, i) => (
                    <div key={i} className="grid grid-cols-8 gap-2 items-center">
                      <input className="input col-span-2" placeholder="name" value={p.name}
                        onChange={(e) => updateParameter(i, { name: e.target.value })} />
                      <input className="input col-span-2" placeholder="type" value={p.type}
                        onChange={(e) => updateParameter(i, { type: e.target.value })} />
                      <input className="input col-span-3" placeholder="description" value={p.description}
                        onChange={(e) => updateParameter(i, { description: e.target.value })} />
                      <button type="button" className="text-red-500 text-sm" onClick={() => removeParameter(i)}>Remove</button>
                    </div>
                  ))}
                  <button type="button" className="btn-secondary btn-sm" onClick={addParameter}>+ Add Parameter</button>
                </div>
              </>
            )}
            {(form.executionMode === "SQL" || form.executionMode === "DATAFRAME") && (
              <>
                <p className="text-xs text-slate-500">
                  {form.executionMode === "SQL"
                    ? "Schema DDL is required for SQL mode - it's the table setup (CREATE TABLE + seed INSERT statements) students query against."
                    : "Schema notes are optional for DataFrame mode - document the input DataFrame's columns/dtypes, or the snippet that builds it."}
                </p>
                <textarea className="input font-mono text-sm" rows={5}
                  placeholder={form.executionMode === "SQL"
                    ? "CREATE TABLE employees (id INT, name TEXT, department TEXT, salary INT);\nINSERT INTO employees VALUES (1, 'A', 'Eng', 90000);"
                    : "df columns: name (str), city (str), age (int)"}
                  value={form.schemaDdl}
                  onChange={(e) => setForm({ ...form, schemaDdl: e.target.value })}
                  required={form.executionMode === "SQL"} />
                <p className="text-xs text-slate-500">
                  Expected output - the reference result students' queries/code are reviewed against.
                </p>
                <textarea className="input font-mono text-sm" rows={4}
                  placeholder="Eng, A, 90000"
                  value={form.expectedOutput}
                  onChange={(e) => setForm({ ...form, expectedOutput: e.target.value })} />
              </>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <textarea className="input" placeholder="Sample input (shown to students)" value={form.sampleInput}
              onChange={(e) => setForm({ ...form, sampleInput: e.target.value })} required />
            <textarea className="input" placeholder="Sample output (shown to students)" value={form.sampleOutput}
              onChange={(e) => setForm({ ...form, sampleOutput: e.target.value })} required />
          </div>

          <div className="border border-slate-200 rounded-lg p-3 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-slate-700">Test cases / examples</h3>
              <span className="text-xs text-slate-500">{hiddenCount} marked hidden (used for grading, never shown to students)</span>
            </div>
            {form.examples.map((ex, i) => (
              <div key={i} className="border border-slate-100 rounded p-2 space-y-2">
                <div className="flex items-center gap-2">
                  <input className="input flex-1" placeholder="Title" value={ex.title}
                    onChange={(e) => updateExample(i, { title: e.target.value })} />
                  <label className="flex items-center gap-1 text-xs text-slate-600 whitespace-nowrap cursor-pointer">
                    <input type="checkbox" checked={ex.hidden} onChange={(e) => updateExample(i, { hidden: e.target.checked })} />
                    Hidden (grading only)
                  </label>
                  <button type="button" className="text-red-500 text-sm" onClick={() => removeExample(i)}>Remove</button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input className="input" placeholder="Input" value={ex.input}
                    onChange={(e) => updateExample(i, { input: e.target.value })} required />
                  <input className="input" placeholder="Output" value={ex.output}
                    onChange={(e) => updateExample(i, { output: e.target.value })} required />
                </div>
                <input className="input" placeholder="Explanation (optional)" value={ex.explanation}
                  onChange={(e) => updateExample(i, { explanation: e.target.value })} />
              </div>
            ))}
            <button type="button" className="btn-secondary btn-sm" onClick={addExample}>+ Add Example</button>
          </div>

          <div className="border border-slate-200 rounded-lg p-3 space-y-2">
            <h3 className="text-sm font-medium text-slate-700">Constraints</h3>
            {form.constraints.map((c, i) => (
              <div key={i} className="flex items-center gap-2">
                <input className="input flex-1" placeholder="e.g. 1 <= n <= 10^5" value={c.text}
                  onChange={(e) => updateConstraint(i, e.target.value)} />
                <button type="button" className="text-red-500 text-sm" onClick={() => removeConstraint(i)}>Remove</button>
              </div>
            ))}
            <button type="button" className="btn-secondary btn-sm" onClick={addConstraint}>+ Add Constraint</button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm text-slate-600">
              Time limit (ms)
              <input type="number" className="input mt-1" value={form.timeLimitMs}
                onChange={(e) => setForm({ ...form, timeLimitMs: Number(e.target.value) })} />
            </label>
            <label className="text-sm text-slate-600">
              Memory limit (MB)
              <input type="number" className="input mt-1" value={form.memoryLimitMb}
                onChange={(e) => setForm({ ...form, memoryLimitMb: Number(e.target.value) })} />
            </label>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button className="btn-primary btn-sm" disabled={saving}>
              <Icon name="plus" size={16} />
              {saving ? "Saving..." : editingId ? "Save Changes" : "Add Problem"}
            </button>
            {editingId && (
              <button type="button" className="btn-secondary btn-sm" onClick={resetForm}>
                Cancel
              </button>
            )}
          </div>
        </form>
      </FieldGroup>

      <FieldGroup className="!p-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="relative w-80 max-w-full">
            <Icon
              name="search"
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              className="input pl-9"
              placeholder="Search title..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { setPage(0); load(); } }}
            />
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 mr-1">
                Difficulty
              </span>
              {["ALL", ...DIFFICULTIES].map((d) => (
                <button
                  key={d}
                  onClick={() => setDifficultyFilter(d === "ALL" ? "" : d)}
                  className={`chip ${difficultyFilter === (d === "ALL" ? "" : d) ? "chip-active" : "chip-muted"}`}
                >
                  {d === "ALL" ? "All" : d}
                </button>
              ))}
            </div>
            <div className="w-px h-6 bg-slate-200 hidden md:block" />
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 mr-1">
                Mode
              </span>
              <button
                onClick={() => setModeFilter("")}
                className={`chip ${modeFilter === "" ? "chip-active" : "chip-muted"}`}
              >
                All
              </button>
              {EXECUTION_MODES.slice(0, 4).map((m) => (
                <button
                  key={m}
                  onClick={() => setModeFilter(modeFilter === m ? "" : m)}
                  className={`chip ${modeFilter === m ? "chip-active" : "chip-muted"}`}
                >
                  {m}
                </button>
              ))}
            </div>
            <div className="w-px h-6 bg-slate-200 hidden md:block" />
            <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
              />
              Show archived
            </label>
          </div>
        </div>
      </FieldGroup>

      {error && !data ? (
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
          icon="code"
          title="No coding problems yet"
          description="Create your first coding problem to start building your challenge library, or bulk import from JSON."
          variant="info"
          action={
            <div className="flex gap-2">
              <button
                type="button"
                className="btn-primary btn-sm"
                onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              >
                <Icon name="plus" size={16} />
                Create First Problem
              </button>
              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={() => {
                  const blob = new Blob([UPLOAD_SAMPLE], { type: "application/json" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "coding-problems-sample.json";
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                <Icon name="download" size={16} />
                Bulk Upload Sample
              </button>
            </div>
          }
        />
      ) : showEmpty ? (
        <EmptyState
          icon="search"
          title="No matching problems"
          description="Try adjusting your search terms, clearing filters, or adding a new problem."
          action={
            <div className="flex items-center gap-2">
              <button className="btn-secondary btn-sm" onClick={clearFilters}>
                Clear Filters
              </button>
            </div>
          }
        />
      ) : (
        <>
          <DataTable<CodingProblemAdmin>
            columns={columns}
            data={filtered}
            rowKey="id"
            emptyTitle="No matching problems"
            emptyDesc="Try adjusting your search or filters."
            emptyIcon="search"
            loading={loading}
          />
          {data && data.totalPages > 1 && (
            <div className="flex justify-between items-center text-sm text-slate-500 px-1">
              <span>
                Page {data.page + 1} of {Math.max(1, data.totalPages)} &middot; {data.totalElements} total
              </span>
              <div className="flex gap-2">
                <button
                  disabled={page === 0 || loading}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  className="btn-secondary btn-sm"
                >
                  <Icon name="chevron-left" size={16} />
                  Prev
                </button>
                <button
                  disabled={page + 1 >= data.totalPages || loading}
                  onClick={() => setPage((p) => p + 1)}
                  className="btn-secondary btn-sm"
                >
                  Next
                  <Icon name="chevron-right" size={16} />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
