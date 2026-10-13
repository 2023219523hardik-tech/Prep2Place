"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { adminApi } from "@/lib/adminApi";
import { Icon } from "@/components/ui/Icon";
import { Skeleton, SkeletonGroup } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { FieldGroup } from "@/components/ui/FieldGroup";
import { DataTable } from "@/components/ui/DataTable";
import { useToast } from "@/hooks/useToast";
import ErrorState from "@/components/ErrorState";
import JsonUploadButton from "../../../components/admin/JsonUploadButton";

interface Question { id: number; text: string; category: string; difficulty: string; expectedKeywords: string; published: boolean; createdAt?: string; updatedAt?: string; }

const CATEGORIES = ["DSA", "CODING", "APTITUDE", "TECHNICAL", "COMMUNICATION", "HR", "INTERVIEW"];
const DIFFICULTIES = ["EASY", "MEDIUM", "HARD"];

const QUESTION_SAMPLE = `[
  {
    "text": "Explain the difference between stack and queue.",
    "category": "DSA",
    "difficulty": "EASY",
    "expectedKeywords": "LIFO, FIFO, push, pop, enqueue, dequeue"
  }
]`;

export default function AdminQuestionsPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ text: "", category: "TECHNICAL", difficulty: "MEDIUM", expectedKeywords: "" });
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const { push } = useToast();

  function load() {
    setLoading(true);
    setError("");
    adminApi
      .get<Question[]>("/api/admin/questions")
      .then(setQuestions)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function createQuestion(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await adminApi.post("/api/admin/questions", { ...form, roleId: null });
      setForm({ text: "", category: "TECHNICAL", difficulty: "MEDIUM", expectedKeywords: "" });
      load();
      push({ variant: "success", title: "Question created", description: "Your question has been added to the bank." });
    } catch (e: any) {
      setError(e.message);
      push({ variant: "error", title: "Create failed", description: e.message });
    } finally {
      setSaving(false);
    }
  }

  async function deleteQuestion(id: number) {
    try {
      await adminApi.del(`/api/admin/questions/${id}`);
      load();
      push({ variant: "success", title: "Question deleted" });
    } catch (e: any) {
      push({ variant: "error", title: "Delete failed", description: e.message });
    }
  }

  async function toggleStatus(q: Question) {
    try {
      await adminApi.patch(`/api/admin/questions/${q.id}/status`, { published: !q.published });
      load();
      push({ variant: "success", title: `Question ${q.published ? "unpublished" : "published"}` });
    } catch (e: any) {
      push({ variant: "error", title: "Status update failed", description: e.message });
    }
  }

  const filtered = questions.filter((q) => {
    if (search && !q.text.toLowerCase().includes(search.toLowerCase()) && !String(q.id).includes(search)) return false;
    if (categoryFilter && q.category !== categoryFilter) return false;
    if (difficultyFilter && q.difficulty !== difficultyFilter) return false;
    if (statusFilter) {
      const published = statusFilter === "PUBLISHED";
      if (q.published !== published) return false;
    }
    return true;
  });

  const topicOptions = [...new Set(questions.map((q) => q.category))];

  const difficultyBadge = (d: string) =>
    d === "EASY" ? "badge badge-success" : d === "MEDIUM" ? "badge badge-warning" : "badge badge-danger";

  const columns = [
    {
      key: "id",
      label: "ID",
      width: "80px",
      render: (row: Question) => (
        <span className="badge badge-neutral font-mono text-xs">#{row.id}</span>
      ),
    },
    {
      key: "text",
      label: "Title",
      width: "256px",
      render: (row: Question) => (
        <div className="max-w-64 truncate font-semibold text-slate-900">{row.text}</div>
      ),
    },
    {
      key: "category",
      label: "Topic / Type",
      render: (row: Question) => (
        <span className="chip chip-muted">{row.category}</span>
      ),
    },
    {
      key: "difficulty",
      label: "Difficulty",
      render: (row: Question) => (
        <span className={`badge ${difficultyBadge(row.difficulty)}`}>{row.difficulty}</span>
      ),
    },
    {
      key: "published",
      label: "Status",
      render: (row: Question) => (
        <span className={`badge ${row.published ? "badge-success" : "badge-neutral"}`}>
          {row.published ? "Published" : "Draft"}
        </span>
      ),
    },
    {
      key: "createdAt",
      label: "Created",
      render: (row: Question) => (
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <Icon name="clock" size={14} />
          <span>{row.createdAt ? new Date(row.createdAt).toLocaleDateString() : "—"}</span>
        </div>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      align: "right" as const,
      render: (row: Question) => (
        <div className="flex items-center justify-end gap-1">
          <Link
            href={`/admin/${row.id}/edit`}
            className="btn-ghost btn-icon btn-sm"
            title="Edit"
          >
            <Icon name="pencil" size={16} />
          </Link>
          <Link
            href={`/admin/${row.id}/preview`}
            className="btn-secondary btn-icon btn-sm"
            title="Preview"
          >
            <Icon name="eye" size={16} />
          </Link>
          <button
            type="button"
            className="btn-ghost btn-icon btn-sm"
            onClick={() => toggleStatus(row)}
            title="Toggle publish"
          >
            <Icon name="chart-bar" size={16} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Question Bank</h1>
          <p className="text-sm text-slate-500 mt-1">Manage interview and assessment questions across all categories.</p>
        </div>
        <div className="flex items-center gap-2">
          <JsonUploadButton
            endpoint="/api/admin/questions/bulk-upload"
            sample={QUESTION_SAMPLE}
            onUploaded={() => load()}
          />
          <Link href="/admin/new" className="btn-primary btn-sm">
            <Icon name="plus" size={16} />
            Add New
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {["ALL", ...CATEGORIES].map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategoryFilter(c === "ALL" ? "" : c)}
            className={`chip ${categoryFilter === (c === "ALL" ? "" : c) ? "chip-active" : "chip-muted"}`}
          >
            {c === "ALL" ? "All Types" : c}
          </button>
        ))}
      </div>

      <FieldGroup className="!p-4">
        <div className="flex flex-wrap items-center gap-4 justify-between">
          <div className="relative min-w-80 w-80">
            <Icon name="search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="input pl-10"
              placeholder="Search by title/topic/id..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Topic</span>
              <div className="flex flex-wrap gap-1.5">
                {topicOptions.length === 0 ? (
                  <span className="chip chip-muted">—</span>
                ) : (
                  topicOptions.slice(0, 5).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setCategoryFilter(categoryFilter === t ? "" : t)}
                      className={`chip ${categoryFilter === t ? "chip-active" : "chip-muted"}`}
                    >
                      {t}
                    </button>
                  ))
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Difficulty</span>
              <div className="flex gap-1.5">
                {["ALL", ...DIFFICULTIES].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDifficultyFilter(d === "ALL" ? "" : d)}
                    className={`chip ${difficultyFilter === (d === "ALL" ? "" : d) ? "chip-active" : "chip-muted"}`}
                  >
                    {d === "ALL" ? "All" : d}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</span>
              <div className="flex gap-1.5">
                {[
                  { k: "", l: "All" },
                  { k: "DRAFT", l: "Draft" },
                  { k: "PUBLISHED", l: "Published" },
                ].map((s) => (
                  <button
                    key={s.k}
                    type="button"
                    onClick={() => setStatusFilter(s.k)}
                    className={`chip ${statusFilter === s.k ? "chip-active" : "chip-muted"}`}
                  >
                    {s.l}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </FieldGroup>

      {loading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <SkeletonGroup variant="kpi" />
            <SkeletonGroup variant="kpi" />
            <SkeletonGroup variant="kpi" />
            <SkeletonGroup variant="kpi" />
          </div>
          <div className="surface-card p-4">
            <div className="flex flex-wrap items-center gap-4 justify-between">
              <Skeleton variant="line" className="w-80 h-10" />
              <div className="flex items-center gap-2">
                <Skeleton variant="line" className="w-24 h-8" />
                <Skeleton variant="line" className="w-24 h-8" />
                <Skeleton variant="line" className="w-24 h-8" />
              </div>
            </div>
          </div>
          <SkeletonGroup variant="table" />
        </div>
      ) : error ? (
        <div>
          <ErrorState message={error} />
          <div className="flex justify-center mt-4">
            <button
              type="button"
              onClick={() => {
                load();
                push({ variant: "info", title: "Retrying..." });
              }}
              className="btn-secondary"
            >
              <Icon name="refresh-cw" size={16} />
              Try Again
            </button>
          </div>
        </div>
      ) : filtered.length === 0 && questions.length === 0 ? (
        <EmptyState
          icon="file-text"
          title="No questions yet"
          description="Create your first question to start building your assessment bank, or bulk import from JSON."
          variant="info"
          action={
            <div className="flex gap-2">
              <Link href="/admin/questions/new" className="btn-primary btn-sm">
                <Icon name="plus" size={16} />
                Create First Question
              </Link>
              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={() => {
                  const blob = new Blob([QUESTION_SAMPLE], { type: "application/json" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "questions-sample.json";
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
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          rowKey="id"
          emptyTitle="No matching questions"
          emptyDesc="Try adjusting your search or filters."
          emptyIcon="search"
        />
      )}
    </div>
  );
}
