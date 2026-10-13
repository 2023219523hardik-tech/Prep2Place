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

const UPLOAD_SAMPLE = `[
  {
    "text": "If a train travels 60 km in 1.5 hours, what is its speed?",
    "topic": "Time, Speed & Distance",
    "difficulty": "EASY",
    "optionA": "30 km/h",
    "optionB": "40 km/h",
    "optionC": "45 km/h",
    "optionD": "50 km/h",
    "correctOption": "B",
    "explanation": "Speed = Distance / Time = 60 / 1.5 = 40 km/h"
  }
]`;

const DIFFICULTIES = ["EASY", "MEDIUM", "HARD"];
const OPTION_KEYS = ["A", "B", "C", "D"] as const;

interface AptitudeQuestion {
  id: number;
  text: string;
  topic: string;
  difficulty: string;
  optionA: string;
  optionB: string;
  optionC: string | null;
  optionD: string | null;
  correctOption: string;
  explanation: string | null;
  active: boolean;
}

const EMPTY_FORM = {
  text: "",
  topic: "",
  difficulty: "MEDIUM",
  optionA: "",
  optionB: "",
  optionC: "",
  optionD: "",
  correctOption: "A",
  explanation: "",
};

export default function AdminAptitudePage() {
  const [questions, setQuestions] = useState<AptitudeQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [showInactive, setShowInactive] = useState(false);
  const [search, setSearch] = useState("");
  const [topicFilter, setTopicFilter] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState("");
  const { push } = useToast();

  function load() {
    setLoading(true);
    adminApi
      .get<AptitudeQuestion[]>("/api/admin/aptitude-questions")
      .then(setQuestions)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingId(null);
  }

  function startEdit(q: AptitudeQuestion) {
    setForm({
      text: q.text,
      topic: q.topic,
      difficulty: q.difficulty,
      optionA: q.optionA,
      optionB: q.optionB,
      optionC: q.optionC || "",
      optionD: q.optionD || "",
      correctOption: q.correctOption,
      explanation: q.explanation || "",
    });
    setEditingId(q.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (editingId) {
        await adminApi.put(`/api/admin/aptitude-questions/${editingId}`, form);
        push({ variant: "success", title: "Question updated", description: "Changes have been saved." });
      } else {
        await adminApi.post("/api/admin/aptitude-questions", form);
        push({ variant: "success", title: "Question created", description: "New aptitude question added." });
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
    try {
      await adminApi.del(`/api/admin/aptitude-questions/${id}`);
      push({ variant: "success", title: "Question archived" });
      load();
    } catch (e: any) {
      setError(e.message);
      push({ variant: "error", title: "Archive failed", description: e.message });
    }
  }

  async function reactivate(id: number) {
    await adminApi.patch(`/api/admin/aptitude-questions/${id}/reactivate`, {});
    push({ variant: "success", title: "Question reactivated" });
    load();
  }

  function clearFilters() {
    setSearch("");
    setTopicFilter("");
    setDifficultyFilter("");
    setShowInactive(false);
  }

  const topicOptions = [...new Set(questions.map((q) => q.topic))].filter(Boolean);

  const filtered = questions.filter((q) => {
    if (!showInactive && !q.active) return false;
    if (search && !q.text.toLowerCase().includes(search.toLowerCase()) && !String(q.id).includes(search)) return false;
    if (topicFilter && q.topic !== topicFilter) return false;
    if (difficultyFilter && q.difficulty !== difficultyFilter) return false;
    return true;
  });

  const difficultyBadge = (d: string) =>
    d === "EASY" ? "badge badge-success" : d === "MEDIUM" ? "badge badge-warning" : "badge badge-danger";

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
      render: (row: AptitudeQuestion) => (
        <span className="badge badge-neutral font-mono text-xs">#{row.id}</span>
      ),
    },
    {
      key: "text",
      label: "Question",
      render: (row: AptitudeQuestion) => (
        <div className="max-w-64 truncate font-semibold text-slate-900">{row.text}</div>
      ),
    },
    {
      key: "topic",
      label: "Topic",
      render: (row: AptitudeQuestion) => {
        if (!row.topic) return <span className="text-slate-400">—</span>;
        return <span className="chip chip-muted">{row.topic}</span>;
      },
    },
    {
      key: "difficulty",
      label: "Difficulty",
      render: (row: AptitudeQuestion) => (
        <span className={`badge ${difficultyBadge(row.difficulty)}`}>{row.difficulty}</span>
      ),
    },
    {
      key: "correctOption",
      label: "Answer",
      render: (row: AptitudeQuestion) => (
        <span className="badge badge-primary">{row.correctOption}</span>
      ),
    },
    {
      key: "active",
      label: "Status",
      render: (row: AptitudeQuestion) => (
        <span className={`badge ${row.active ? "badge-success" : "badge-neutral"}`}>
          {row.active ? "Active" : "Archived"}
        </span>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      align: "right" as const,
      render: (row: AptitudeQuestion) => (
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

  if (loading && questions.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold">Aptitude Questions</h1>
            <p className="text-sm text-slate-500 mt-1">Manage quantitative and logical aptitude questions for assessments.</p>
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
  const isFirstEmpty = !loading && questions.length === 0;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Aptitude Questions</h1>
          <p className="text-sm text-slate-500 mt-1">Manage quantitative and logical aptitude questions for assessments.</p>
        </div>
        <div className="flex gap-2">
          <JsonUploadButton
            endpoint="/api/admin/aptitude-questions/bulk-upload"
            sample={UPLOAD_SAMPLE}
            onUploaded={load}
          />
        </div>
      </div>

      {loading && kpiTiles}

      <FieldGroup title={editingId ? `Edit Question #${editingId}` : "Create New Aptitude Question"} description={editingId ? "Update the question details below." : "Add a new aptitude question with options, answer key, and explanation."}>
        <form onSubmit={submit} className="space-y-3">
          <textarea
            className="input"
            placeholder="Question text"
            value={form.text}
            onChange={(e) => setForm({ ...form, text: e.target.value })}
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <input className="input" placeholder="Topic (e.g. Time, Speed & Distance)" value={form.topic}
              onChange={(e) => setForm({ ...form, topic: e.target.value })} required />
            <select className="input" value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value })}>
              {DIFFICULTIES.map((d) => <option key={d}>{d}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {OPTION_KEYS.map((k) => {
              const field = `option${k}` as "optionA" | "optionB" | "optionC" | "optionD";
              return (
                <div key={k} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="correctOption"
                    checked={form.correctOption === k}
                    onChange={() => setForm({ ...form, correctOption: k })}
                    title={`Mark ${k} as correct`}
                  />
                  <span className="w-5 shrink-0 font-medium text-slate-500">{k}</span>
                  <input
                    className="input"
                    placeholder={`Option ${k}${k === "C" || k === "D" ? " (optional)" : ""}`}
                    value={form[field]}
                    onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                    required={k === "A" || k === "B"}
                  />
                </div>
              );
            })}
          </div>

          <textarea className="input" placeholder="Explanation (shown to students after they answer)"
            value={form.explanation} onChange={(e) => setForm({ ...form, explanation: e.target.value })} />

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
              placeholder="Search by question text or ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 mr-1">
                Topic
              </span>
              <button
                onClick={() => setTopicFilter("")}
                className={`chip ${topicFilter === "" ? "chip-active" : "chip-muted"}`}
              >
                All
              </button>
              {topicOptions.slice(0, 5).map((t) => (
                <button
                  key={t}
                  onClick={() => setTopicFilter(topicFilter === t ? "" : t)}
                  className={`chip ${topicFilter === t ? "chip-active" : "chip-muted"}`}
                >
                  {t}
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

      {error && questions.length === 0 ? (
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
          icon="file-text"
          title="No aptitude questions yet"
          description="Create your first aptitude question to start building your assessment bank, or bulk import from JSON."
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
                  a.download = "aptitude-sample.json";
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
        <DataTable<AptitudeQuestion>
          columns={columns}
          data={filtered}
          rowKey="id"
          emptyTitle="No matching questions"
          emptyDesc="Try adjusting your search or filters."
          emptyIcon="search"
          loading={loading}
        />
      )}
    </div>
  );
}
