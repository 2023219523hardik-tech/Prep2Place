"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { adminApi } from "@/lib/adminApi";
import ErrorState from "@/components/ErrorState";
import { DataTable } from "@/components/ui/DataTable";
import { FieldGroup } from "@/components/ui/FieldGroup";
import { Icon } from "@/components/ui/Icon";
import { SkeletonGroup } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/hooks/useToast";

const UPLOAD_SAMPLE = `[
  {
    "questionText": "Which data structure uses FIFO order?",
    "category": "DATA_STRUCTURES",
    "topic": "Queues",
    "subtopic": "Basics",
    "difficulty": "EASY",
    "options": [
      { "key": "A", "text": "Stack" },
      { "key": "B", "text": "Queue" },
      { "key": "C", "text": "Tree" },
      { "key": "D", "text": "Graph" }
    ],
    "correctOptions": ["B"],
    "multipleCorrect": false,
    "explanation": "A queue follows First-In-First-Out order.",
    "defaultMarks": 1,
    "defaultNegativeMarks": 0.25,
    "estimatedTimeSeconds": 60,
    "companies": ["Google", "Amazon"],
    "tags": ["queues", "fifo"]
  }
]`;

const CATEGORIES = [
  "DSA", "ALGORITHMS", "OOPS", "JAVA", "PYTHON", "C", "CPP", "DBMS", "SQL",
  "COMPUTER_NETWORKS", "OPERATING_SYSTEMS", "CLOUD_COMPUTING", "AWS", "AZURE", "GCP",
  "AI", "MACHINE_LEARNING", "DEEP_LEARNING", "GENERATIVE_AI", "DATA_SCIENCE",
  "DATA_STRUCTURES", "SYSTEM_DESIGN", "SOFTWARE_ENGINEERING", "COMPUTER_ARCHITECTURE",
  "LINUX", "DEVOPS", "DOCKER", "KUBERNETES", "GIT_GITHUB", "SPRING_BOOT", "REST_API",
  "MICROSERVICES", "APTITUDE", "LOGICAL_REASONING", "QUANTITATIVE_APTITUDE", "VERBAL_ABILITY",
];
const DIFFICULTIES = ["EASY", "MEDIUM", "HARD"];
const OPTION_KEYS = ["A", "B", "C", "D"] as const;

interface McqOption { key: string; text: string; }
interface Mcq {
  id: number;
  questionText: string;
  category: string;
  topic: string;
  subtopic: string | null;
  difficulty: string;
  options: McqOption[];
  correctOptions: string[];
  multipleCorrect: boolean;
  explanation: string | null;
  defaultMarks: number;
  defaultNegativeMarks: number;
  active: boolean;
}
interface Page { content: Mcq[]; totalElements: number; totalPages: number; page: number; size: number; }

const EMPTY_FORM = {
  questionText: "",
  category: "DSA",
  topic: "",
  subtopic: "",
  difficulty: "MEDIUM",
  optionTexts: { A: "", B: "", C: "", D: "" } as Record<string, string>,
  correctOptions: [] as string[],
  multipleCorrect: false,
  explanation: "",
  defaultMarks: 1,
  defaultNegativeMarks: 0.25,
};

export default function AdminTechnicalMcqPage() {
  const [data, setData] = useState<Page | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState("");
  const [page, setPage] = useState(0);
  const [showInactive, setShowInactive] = useState(false);
  const { push } = useToast();

  function load() {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), size: "20" });
    if (search.trim()) params.set("search", search.trim());
    if (categoryFilter) params.set("category", categoryFilter);
    if (difficultyFilter) params.set("difficulty", difficultyFilter);
    if (!showInactive) params.set("active", "true");
    adminApi
      .get<Page>(`/api/admin/questionbank/technical-mcq?${params.toString()}`)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }
  useEffect(load, [page, showInactive, categoryFilter, difficultyFilter]);

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingId(null);
  }

  function startEdit(q: Mcq) {
    const optionTexts: Record<string, string> = { A: "", B: "", C: "", D: "" };
    q.options.forEach((o) => { optionTexts[o.key] = o.text; });
    setForm({
      questionText: q.questionText,
      category: q.category,
      topic: q.topic,
      subtopic: q.subtopic || "",
      difficulty: q.difficulty,
      optionTexts,
      correctOptions: q.correctOptions,
      multipleCorrect: q.multipleCorrect,
      explanation: q.explanation || "",
      defaultMarks: q.defaultMarks,
      defaultNegativeMarks: q.defaultNegativeMarks,
    });
    setEditingId(q.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function toggleCorrect(key: string) {
    setForm((f) => {
      const has = f.correctOptions.includes(key);
      const next = has ? f.correctOptions.filter((k) => k !== key) : [...f.correctOptions, key];
      return { ...f, correctOptions: f.multipleCorrect ? next : [key] };
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const payload = {
      questionText: form.questionText,
      category: form.category,
      topic: form.topic,
      subtopic: form.subtopic || null,
      difficulty: form.difficulty,
      options: OPTION_KEYS.map((k) => ({ key: k, text: form.optionTexts[k] })),
      correctOptions: form.correctOptions,
      multipleCorrect: form.multipleCorrect,
      explanation: form.explanation || null,
      defaultMarks: form.defaultMarks,
      defaultNegativeMarks: form.defaultNegativeMarks,
    };
    try {
      if (editingId) {
        await adminApi.put(`/api/admin/questionbank/technical-mcq/${editingId}`, payload);
        push({ variant: "success", title: "Question updated", description: "Changes have been saved." });
      } else {
        await adminApi.post("/api/admin/questionbank/technical-mcq", payload);
        push({ variant: "success", title: "Question created", description: "New technical MCQ added." });
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
    if (!confirm("Archive this question? It will stop appearing to students but stays in history.")) return;
    await adminApi.del(`/api/admin/questionbank/technical-mcq/${id}`);
    push({ variant: "success", title: "Question archived" });
    load();
  }

  async function reactivate(id: number) {
    await adminApi.patch(`/api/admin/questionbank/technical-mcq/${id}/reactivate`, {});
    push({ variant: "success", title: "Question reactivated" });
    load();
  }

  function clearFilters() {
    setSearch("");
    setCategoryFilter("");
    setDifficultyFilter("");
    setShowInactive(false);
    setPage(0);
  }

  const difficultyBadge = (d: string) =>
    d === "EASY" ? "badge badge-success" : d === "MEDIUM" ? "badge badge-warning" : "badge badge-danger";

  const content = data?.content || [];

  const filtered = content;

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
      render: (row: Mcq) => (
        <span className="badge badge-neutral font-mono text-xs">#{row.id}</span>
      ),
    },
    {
      key: "questionText",
      label: "Question",
      render: (row: Mcq) => (
        <div className="max-w-64 truncate font-semibold text-slate-900">{row.questionText}</div>
      ),
    },
    {
      key: "category",
      label: "Category",
      render: (row: Mcq) => (
        <span className="chip chip-muted">{row.category}</span>
      ),
    },
    {
      key: "topic",
      label: "Topic",
      render: (row: Mcq) => {
        if (!row.topic) return <span className="text-slate-400">—</span>;
        return <span className="text-sm text-slate-700">{row.topic}</span>;
      },
    },
    {
      key: "difficulty",
      label: "Difficulty",
      render: (row: Mcq) => (
        <span className={`badge ${difficultyBadge(row.difficulty)}`}>{row.difficulty}</span>
      ),
    },
    {
      key: "correctOptions",
      label: "Answer",
      render: (row: Mcq) => (
        <span className="badge badge-primary">{row.correctOptions.join(", ")}</span>
      ),
    },
    {
      key: "active",
      label: "Status",
      render: (row: Mcq) => (
        <span className={`badge ${row.active ? "badge-success" : "badge-neutral"}`}>
          {row.active ? "Active" : "Archived"}
        </span>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      align: "right" as const,
      render: (row: Mcq) => (
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
            <h1 className="text-2xl font-semibold">Technical MCQ</h1>
            <p className="text-sm text-slate-500 mt-1">Manage technical multiple-choice questions across all engineering categories.</p>
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
          <h1 className="text-2xl font-semibold">Technical MCQ</h1>
          <p className="text-sm text-slate-500 mt-1">Manage technical multiple-choice questions across all engineering categories.</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin/question-bank"
            className="btn-secondary btn-sm flex items-center gap-1.5"
            title="Consolidated Question Bank Seed & Upload"
          >
            <Icon name="upload" size={16} />
            Question Bank Seeds
          </Link>
        </div>
      </div>

      {loading && kpiTiles}

      <FieldGroup title={editingId ? `Edit Question #${editingId}` : "Create New Technical MCQ"} description={editingId ? "Update the question details below." : "Add a new MCQ with options, marking scheme, and explanation."}>
        <form onSubmit={submit} className="space-y-3">
          <textarea
            className="input"
            placeholder="Question text"
            value={form.questionText}
            onChange={(e) => setForm({ ...form, questionText: e.target.value })}
            required
          />
          <div className="grid grid-cols-3 gap-3">
            <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
            <input className="input" placeholder="Topic (e.g. Arrays)" value={form.topic}
              onChange={(e) => setForm({ ...form, topic: e.target.value })} required />
            <select className="input" value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value })}>
              {DIFFICULTIES.map((d) => <option key={d}>{d}</option>)}
            </select>
          </div>
          <input className="input" placeholder="Subtopic (optional)" value={form.subtopic}
            onChange={(e) => setForm({ ...form, subtopic: e.target.value })} />

          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
            <input type="checkbox" checked={form.multipleCorrect}
              onChange={(e) => setForm({ ...form, multipleCorrect: e.target.checked, correctOptions: [] })} />
            Multiple correct answers
          </label>

          <div className="grid grid-cols-2 gap-3">
            {OPTION_KEYS.map((k) => (
              <div key={k} className="flex items-center gap-2">
                <input
                  type={form.multipleCorrect ? "checkbox" : "radio"}
                  name="correctOption"
                  checked={form.correctOptions.includes(k)}
                  onChange={() => toggleCorrect(k)}
                  title={`Mark ${k} as correct`}
                />
                <span className="w-5 shrink-0 font-medium text-slate-500">{k}</span>
                <input
                  className="input"
                  placeholder={`Option ${k}`}
                  value={form.optionTexts[k]}
                  onChange={(e) => setForm({ ...form, optionTexts: { ...form.optionTexts, [k]: e.target.value } })}
                  required
                />
              </div>
            ))}
          </div>

          <textarea className="input" placeholder="Explanation (shown to students after they answer)"
            value={form.explanation} onChange={(e) => setForm({ ...form, explanation: e.target.value })} />

          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm text-slate-600">
              Marks
              <input type="number" step="0.5" className="input mt-1" value={form.defaultMarks}
                onChange={(e) => setForm({ ...form, defaultMarks: Number(e.target.value) })} />
            </label>
            <label className="text-sm text-slate-600">
              Negative marks
              <input type="number" step="0.25" min="0" className="input mt-1" value={form.defaultNegativeMarks}
                onChange={(e) => setForm({ ...form, defaultNegativeMarks: Number(e.target.value) })} />
            </label>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button className="btn-primary btn-sm" disabled={saving}>
              <Icon name="plus" size={16} />
              {saving ? "Saving..." : editingId ? "Save Changes" : "Add Question"}
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
              placeholder="Search question text..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { setPage(0); load(); } }}
            />
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 mr-1">
                Category
              </span>
              <button
                onClick={() => { setCategoryFilter(""); setPage(0); }}
                className={`chip ${categoryFilter === "" ? "chip-active" : "chip-muted"}`}
              >
                All
              </button>
              {CATEGORIES.slice(0, 4).map((c) => (
                <button
                  key={c}
                  onClick={() => { setCategoryFilter(categoryFilter === c ? "" : c); setPage(0); }}
                  className={`chip ${categoryFilter === c ? "chip-active" : "chip-muted"}`}
                >
                  {c}
                </button>
              ))}
            </div>
            <div className="w-px h-6 bg-slate-200 hidden md:block" />
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
          icon="file-code"
          title="No technical MCQs yet"
          description="Create your first technical question to start building your question bank, or bulk import from JSON."
          variant="info"
          action={
            <div className="flex gap-2">
              <button
                type="button"
                className="btn-primary btn-sm"
                onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              >
                <Icon name="plus" size={16} />
                Create First Question
              </button>
              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={() => {
                  const blob = new Blob([UPLOAD_SAMPLE], { type: "application/json" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "technical-mcq-sample.json";
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
          title="No matching questions"
          description="Try adjusting your search terms, clearing filters, or adding a new question."
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
          <DataTable<Mcq>
            columns={columns}
            data={filtered}
            rowKey="id"
            emptyTitle="No matching questions"
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
