"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { z } from "zod";
import { adminApi } from "@/lib/adminApi";
import ErrorState from "@/components/ErrorState";
import { DataTable } from "@/components/ui/DataTable";
import { FieldGroup } from "@/components/ui/FieldGroup";
import { Icon } from "@/components/ui/Icon";
import { Skeleton, SkeletonGroup } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/hooks/useToast";

interface PlacementDrive {
  id: number;
  title: string;
  company: string;
  description: string;
  date: string;
  eligibility: string;
  seats: number;
  location: string;
  createdAt: string;
}

const driveSchema = z.object({
  title: z.string().min(1, "Title is required"),
  company: z.string().min(1, "Company is required"),
  description: z.string().optional(),
  date: z.string().min(1, "Date is required"),
  eligibility: z.string().optional(),
  seats: z.coerce.number().int().min(0).optional(),
  location: z.string().optional(),
});

type DriveForm = z.infer<typeof driveSchema>;

const EMPTY_FORM: DriveForm = {
  title: "",
  company: "",
  description: "",
  date: "",
  eligibility: "",
  seats: 0,
  location: "",
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function isUpcoming(dateStr: string): boolean {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d >= today;
}

export default function AdminDrivesPage() {
  const [drives, setDrives] = useState<PlacementDrive[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState<DriveForm>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [deleteTarget, setDeleteTarget] = useState<PlacementDrive | null>(null);
  const { push } = useToast();

  function load() {
    setLoading(true);
    adminApi
      .get<PlacementDrive[]>("/api/placement/drives")
      .then(setDrives)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  function setField<K extends keyof DriveForm>(key: K, value: DriveForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setFormErrors((prev) => ({ ...prev, [key]: "" }));
  }

  function startEdit(drive: PlacementDrive) {
    setEditingId(drive.id);
    setForm({
      title: drive.title,
      company: drive.company,
      description: drive.description || "",
      date: drive.date ? new Date(drive.date).toISOString().split("T")[0] : "",
      eligibility: drive.eligibility || "",
      seats: drive.seats ?? 0,
      location: drive.location || "",
    });
    setFormErrors({});
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormErrors({});
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const parsed = driveSchema.safeParse(form);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.issues.forEach((iss) => {
        const key = iss.path[0] as string;
        if (key) errs[key] = iss.message;
      });
      setFormErrors(errs);
      setSaving(false);
      push({
        variant: "error",
        title: "Validation failed",
        description: "Please fix the highlighted fields and try again.",
      });
      return;
    }

    try {
      const payload = { ...parsed.data };
      if (editingId === null) {
        await adminApi.post("/api/placement/drives", payload);
        push({
          variant: "success",
          title: "Drive created",
          description: "New placement drive has been added successfully.",
        });
      } else {
        await adminApi.put(`/api/placement/drives/${editingId}`, payload);
        push({
          variant: "success",
          title: "Drive updated",
          description: "Placement drive details have been updated.",
        });
      }
      cancelEdit();
      load();
    } catch (e: any) {
      setError(e.message);
      push({
        variant: "error",
        title: editingId === null ? "Create failed" : "Update failed",
        description: e.message,
      });
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await adminApi.del(`/api/placement/drives/${deleteTarget.id}`);
      push({
        variant: "success",
        title: "Drive deleted",
        description: "Placement drive has been removed.",
      });
      if (editingId === deleteTarget.id) {
        cancelEdit();
      }
      load();
    } catch (e: any) {
      push({
        variant: "error",
        title: "Delete failed",
        description: e.message,
      });
    } finally {
      setDeleteTarget(null);
    }
  }

  const columns = [
    {
      key: "title",
      label: "Title",
      render: (row: PlacementDrive) => (
        <div className="min-w-0">
          <div className="font-semibold text-slate-900 truncate">{row.title}</div>
          <div className="text-xs text-slate-500 mt-0.5 truncate">
            {row.description || "No description"}
          </div>
        </div>
      ),
    },
    {
      key: "company",
      label: "Company",
      width: "18%",
      render: (row: PlacementDrive) => (
        <span className="chip chip-muted font-medium">{row.company}</span>
      ),
    },
    {
      key: "date",
      label: "Date",
      width: "18%",
      render: (row: PlacementDrive) => {
        const upcoming = isUpcoming(row.date);
        return (
          <div className="space-y-1.5">
            <div className="text-sm font-medium text-slate-800">
              {formatDate(row.date)}
            </div>
            <span className={`badge !text-[10px] !px-2 !py-0.5 ${upcoming ? "badge-primary" : "badge-neutral"}`}>
              <Icon name={upcoming ? "briefcase" : "activity"} size={10} />
              {upcoming ? "Upcoming" : "Past"}
            </span>
          </div>
        );
      },
    },
    {
      key: "seats",
      label: "Seats",
      width: "10%",
      align: "center" as const,
      render: (row: PlacementDrive) => (
        <span className="font-display font-bold text-slate-800 tabular-nums">
          {row.seats ?? 0}
        </span>
      ),
    },
    {
      key: "location",
      label: "Location",
      width: "16%",
      render: (row: PlacementDrive) => {
        if (!row.location) return <span className="text-slate-400 text-sm">—</span>;
        return (
          <div className="text-sm text-slate-700 flex items-center gap-1.5">
            <Icon name="target" size={12} className="text-slate-400" />
            <span className="truncate">{row.location}</span>
          </div>
        );
      },
    },
    {
      key: "actions",
      label: "Actions",
      width: "140px",
      align: "right" as const,
      render: (row: PlacementDrive) => (
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={() => startEdit(row)}
            className="btn-ghost btn-sm btn-icon"
            title="Edit drive"
          >
            <Icon name="pencil" size={16} />
          </button>
          <button
            onClick={() => setDeleteTarget(row)}
            className="btn-ghost btn-sm btn-icon text-red-600 hover:text-red-700 hover:bg-red-50"
            title="Delete drive"
          >
            <Icon name="trash-2" size={16} />
          </button>
        </div>
      ),
    },
  ];

  const skeletonRows = (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Skeleton variant="line" className="w-48 h-6" />
          <Skeleton variant="line" className="w-80 h-4 mt-2" />
        </div>
      </div>
      <SkeletonGroup variant="card" />
      <SkeletonGroup variant="table" />
    </div>
  );

  if (loading && drives.length === 0) {
    return <div className="space-y-6 pb-8">{skeletonRows}</div>;
  }

  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Placement Drives</h1>
          <p className="text-sm text-slate-500 mt-1">
            Create and manage campus placement drives, eligibility criteria, and seat allocations.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/jobs" className="btn btn-primary btn-sm flex items-center gap-1.5">
            <Icon name="briefcase" size={14} />
            Job Postings &amp; Applications
          </Link>
        </div>
      </div>

      <FieldGroup
        title={editingId === null ? "Create Placement Drive" : "Edit Placement Drive"}
        description={
          editingId === null
            ? "Add a new placement drive with company details, date, and eligibility requirements."
            : "Update the placement drive details below. Changes are saved on submit."
        }
        action={
          editingId !== null ? (
            <button
              type="button"
              onClick={cancelEdit}
              className="btn-secondary btn-sm"
            >
              <Icon name="x" size={14} />
              Cancel Edit
            </button>
          ) : undefined
        }
      >
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Title *
              </label>
              <input
                className={`input ${formErrors.title ? "border-red-400 focus:border-red-500 focus:ring-red-100" : ""}`}
                placeholder="e.g. Campus Placement Drive - Batch 2026"
                value={form.title}
                onChange={(e) => setField("title", e.target.value)}
              />
              {formErrors.title && (
                <p className="text-xs text-red-600">{formErrors.title}</p>
              )}
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Company *
              </label>
              <input
                className={`input ${formErrors.company ? "border-red-400 focus:border-red-500 focus:ring-red-100" : ""}`}
                placeholder="e.g. Google, Amazon, TCS"
                value={form.company}
                onChange={(e) => setField("company", e.target.value)}
              />
              {formErrors.company && (
                <p className="text-xs text-red-600">{formErrors.company}</p>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Description
            </label>
            <textarea
              className="input min-h-[80px]"
              placeholder="Brief description of the drive, roles offered, process overview..."
              value={form.description}
              onChange={(e) => setField("description", e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Drive Date *
              </label>
              <input
                type="date"
                className={`input ${formErrors.date ? "border-red-400 focus:border-red-500 focus:ring-red-100" : ""}`}
                value={form.date}
                onChange={(e) => setField("date", e.target.value)}
              />
              {formErrors.date && (
                <p className="text-xs text-red-600">{formErrors.date}</p>
              )}
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Available Seats
              </label>
              <input
                type="number"
                min="0"
                className="input"
                placeholder="e.g. 50"
                value={form.seats ?? 0}
                onChange={(e) => setField("seats", Number(e.target.value))}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Eligibility Criteria
              </label>
              <input
                className="input"
                placeholder="e.g. CGPA >= 7.0, CSE/IT/ECE branches only"
                value={form.eligibility}
                onChange={(e) => setField("eligibility", e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Location
              </label>
              <input
                className="input"
                placeholder="e.g. Bangalore, Hybrid, Remote"
                value={form.location}
                onChange={(e) => setField("location", e.target.value)}
              />
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex items-center gap-2 pt-1">
            <button
              className="btn-primary btn-sm"
              disabled={saving}
              type="submit"
            >
              {editingId === null ? (
                <>
                  <Icon name="plus" size={16} />
                  {saving ? "Creating..." : "Create Drive"}
                </>
              ) : (
                <>
                  <Icon name="check-circle" size={16} />
                  {saving ? "Saving..." : "Update Drive"}
                </>
              )}
            </button>
            {editingId !== null && (
              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={cancelEdit}
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </FieldGroup>

      {error && drives.length === 0 ? (
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
      ) : drives.length === 0 && !loading ? (
        <EmptyState
          icon="briefcase"
          title="No placement drives yet"
          description="Create your first placement drive above to start managing campus recruitments."
          variant="info"
          action={
            <button
              type="button"
              className="btn-primary btn-sm"
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            >
              <Icon name="plus" size={16} />
              Create First Drive
            </button>
          }
        />
      ) : (
        <DataTable<PlacementDrive>
          columns={columns}
          data={drives}
          rowKey="id"
          emptyTitle="No placement drives"
          emptyDesc="Create a drive using the form above."
          emptyIcon="briefcase"
          loading={loading}
        />
      )}

      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Placement Drive"
        description={`This will permanently delete the "${deleteTarget?.title}" drive. This action cannot be undone.`}
        size="sm"
        footer={
          <>
            <button
              className="btn-secondary btn-sm"
              onClick={() => setDeleteTarget(null)}
            >
              Cancel
            </button>
            <button
              className="btn-danger btn-sm"
              onClick={confirmDelete}
            >
              <Icon name="trash-2" size={16} />
              Delete Drive
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="flex items-center gap-3 rounded-xl bg-red-50 border border-red-100 p-4">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 shrink-0">
              <Icon name="alert-triangle" size={20} />
            </div>
            <div>
              <p className="font-semibold text-red-800 text-sm">
                Are you sure you want to proceed?
              </p>
              <p className="text-sm text-red-600 mt-0.5">
                All associated data for this drive will be removed.
              </p>
            </div>
          </div>
          {deleteTarget && (
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-2">
              <div className="flex justify-between items-center gap-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Drive</span>
                <span className="font-semibold text-slate-800 text-sm truncate text-right">
                  {deleteTarget.title}
                </span>
              </div>
              <div className="flex justify-between items-center gap-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Company</span>
                <span className="text-sm text-slate-700">{deleteTarget.company}</span>
              </div>
              <div className="flex justify-between items-center gap-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Date</span>
                <span className="text-sm text-slate-700">{formatDate(deleteTarget.date)}</span>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
