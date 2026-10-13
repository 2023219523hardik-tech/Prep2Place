"use client";

import { useEffect, useState } from "react";
import { adminApi } from "@/lib/adminApi";
import ErrorState from "@/components/ErrorState";
import { DataTable } from "@/components/ui/DataTable";
import { FieldGroup } from "@/components/ui/FieldGroup";
import { Icon } from "@/components/ui/Icon";
import { SkeletonGroup } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/hooks/useToast";

interface StudentSummary {
  id: number;
  email: string;
  fullName: string;
  active: boolean;
  premium: boolean;
  role?: string;
  college?: string;
  year?: string | number;
  readiness?: number;
  lastActive?: string;
}

interface Page<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
}

type RoleFilter = "All" | "Student" | "Admin";
type StatusFilter = "All" | "Active" | "Pending" | "Disabled";

export default function AdminStudentsPage() {
  const [page, setPage] = useState<Page<StudentSummary> | null>(null);
  const [search, setSearch] = useState("");
  const [pageNum, setPageNum] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("All");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const [confirmDisable, setConfirmDisable] = useState<StudentSummary | null>(null);
  const { push } = useToast();

  function load() {
    setLoading(true);
    const q = new URLSearchParams({ page: String(pageNum), size: "20" });
    if (search) q.set("search", search);
    adminApi
      .get<Page<StudentSummary>>(`/api/admin/students?${q.toString()}`)
      .then(setPage)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, [pageNum]);

  async function toggleActive(s: StudentSummary) {
    await adminApi.patch(`/api/admin/students/${s.id}/status`, { active: !s.active });
    load();
  }

  async function togglePremium(s: StudentSummary) {
    await adminApi.patch(`/api/admin/students/${s.id}/premium`, { premium: !s.premium });
    load();
  }

  function handleEdit(s: StudentSummary) {
    window.location.href = `/admin/${s.id}/edit`;
  }

  function handleImpersonate(s: StudentSummary) {
    push({
      variant: "info",
      title: "Impersonation starting...",
      description: `Switching to ${s.fullName}'s session`,
    });
  }

  function confirmToggleActive(s: StudentSummary) {
    if (s.active) {
      setConfirmDisable(s);
    } else {
      toggleActive(s);
    }
  }

  function clearFilters() {
    setSearch("");
    setRoleFilter("All");
    setStatusFilter("All");
    setPageNum(0);
  }

  function getInitials(name: string): string {
    return name
      .split(" ")
      .map((n) => n[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase();
  }

  function formatRelativeTime(dateStr?: string): string {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "—";
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 30) return `${days}d ago`;
    return d.toLocaleDateString();
  }

  function getReadinessBadgeClass(score: number): string {
    if (score >= 75) return "badge badge-success";
    if (score >= 50) return "badge badge-warning";
    return "badge badge-danger";
  }

  function getReadinessProgressClass(score: number): string {
    if (score >= 75) return "bg-emerald-500";
    if (score >= 50) return "bg-amber-500";
    return "bg-red-500";
  }

  const filteredContent = page?.content.filter((s) => {
    if (roleFilter !== "All") {
      const studentRole = s.role?.toLowerCase() || "student";
      if (roleFilter.toLowerCase() !== studentRole) return false;
    }
    if (statusFilter !== "All") {
      if (statusFilter === "Active" && !s.active) return false;
      if (statusFilter === "Disabled" && s.active) return false;
      if (statusFilter === "Pending") return false;
    }
    return true;
  }) ?? [];

  const kpiTiles = (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {[0, 1, 2, 3].map((i) => (
        <SkeletonGroup key={i} variant="kpi" />
      ))}
    </div>
  );

  if (loading && !page) {
    return (
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold">Student Management</h1>
            <p className="text-sm text-slate-500 mt-1">Manage registered students, view readiness, and control access.</p>
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

  if (error && !page) {
    return <ErrorState message={error} />;
  }

  const showEmpty = !loading && filteredContent.length === 0;

  const columns = [
    {
      key: "name",
      label: "Name",
      width: "24%",
      render: (s: StudentSummary) => (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-premium-700 bg-premium-50 border border-premium-100 shrink-0">
            {getInitials(s.fullName)}
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-slate-900 truncate">{s.fullName}</div>
            <div className="text-sm text-slate-500 truncate">{s.email}</div>
          </div>
        </div>
      ),
    },
    {
      key: "role",
      label: "Role",
      width: "12%",
      render: (s: StudentSummary) => {
        const isAdmin = (s.role?.toLowerCase() || "student") === "admin";
        return (
          <span className={`badge ${isAdmin ? "badge-danger" : "badge-neutral"}`}>
            {isAdmin ? "Admin" : "Student"}
          </span>
        );
      },
    },
    {
      key: "college",
      label: "College / Year",
      width: "18%",
      render: (s: StudentSummary) => {
        const hasCollege = s.college && s.college.trim().length > 0;
        const hasYear = s.year && String(s.year).trim().length > 0;
        if (!hasCollege && !hasYear) return <span className="text-slate-400">—</span>;
        return (
          <div className="text-sm">
            {hasCollege && <div className="text-slate-700 font-medium truncate">{s.college}</div>}
            {hasYear && <div className="text-slate-500 text-xs mt-0.5">Year {String(s.year)}</div>}
          </div>
        );
      },
    },
    {
      key: "readiness",
      label: "Readiness",
      width: "18%",
      render: (s: StudentSummary) => {
        const score = typeof s.readiness === "number" ? s.readiness : 0;
        return (
          <div className="space-y-1.5">
            <span className={getReadinessBadgeClass(score)}>
              {score}%
            </span>
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 max-w-[140px]">
              <div
                className={`h-full rounded-full ${getReadinessProgressClass(score)}`}
                style={{ width: `${Math.min(100, score)}%` }}
              />
            </div>
          </div>
        );
      },
    },
    {
      key: "lastActive",
      label: "Last Active",
      width: "14%",
      render: (s: StudentSummary) => (
        <span className="text-sm text-slate-600">{formatRelativeTime(s.lastActive)}</span>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      width: "18%",
      align: "right" as const,
      render: (s: StudentSummary) => (
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={() => handleEdit(s)}
            className="btn-ghost btn-sm btn-icon"
            title="Edit"
          >
            <Icon name="pencil" size={16} />
          </button>
          <button
            onClick={() => handleImpersonate(s)}
            className="btn-ghost btn-sm btn-icon"
            title="Impersonate"
          >
            <Icon name="user" size={16} />
          </button>
          <button
            onClick={() => confirmToggleActive(s)}
            className={`btn-ghost btn-sm btn-icon ${s.active ? "text-red-600 hover:text-red-700 hover:bg-red-50" : "text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"}`}
            title={s.active ? "Disable" : "Enable"}
          >
            <Icon name={s.active ? "lock" : "unlock"} size={16} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Student Management</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage registered students, view readiness, and control access.
          </p>
        </div>
        <div className="flex gap-2">
          <button className="btn-primary btn-sm">
            <Icon name="plus" size={16} />
            Add Student
          </button>
          <button className="btn-secondary btn-sm">
            <Icon name="upload" size={16} />
            Bulk Upload
          </button>
        </div>
      </div>

      {loading && kpiTiles}

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
              placeholder="Search by name, email, college..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (setPageNum(0), load())}
            />
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 mr-1">
                Role
              </span>
              {(["All", "Student", "Admin"] as RoleFilter[]).map((role) => (
                <button
                  key={role}
                  onClick={() => setRoleFilter(role)}
                  className={`chip ${roleFilter === role ? "chip-active" : "chip-muted"}`}
                >
                  {role}
                </button>
              ))}
            </div>
            <div className="w-px h-6 bg-slate-200 hidden md:block" />
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 mr-1">
                Status
              </span>
              {(["All", "Active", "Pending", "Disabled"] as StatusFilter[]).map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`chip ${statusFilter === status ? "chip-active" : "chip-muted"}`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>
        </div>
      </FieldGroup>

      {showEmpty ? (
        <EmptyState
          icon="users"
          title="No students found matching your filters"
          description="Try adjusting your search terms, clearing filters, or adding a new student to get started."
          action={
            <div className="flex items-center gap-2">
              <button className="btn-secondary btn-sm" onClick={clearFilters}>
                Clear Filters
              </button>
              <button className="btn-primary btn-sm">
                <Icon name="plus" size={16} />
                Add First Student
              </button>
            </div>
          }
        />
      ) : (
        <DataTable<StudentSummary>
          columns={columns}
          data={filteredContent}
          rowKey="id"
          emptyTitle="No students found"
          emptyDesc="Try adjusting your filters."
          emptyIcon="users"
          loading={loading}
        />
      )}

      {page && !showEmpty && (
        <div className="flex justify-between items-center text-sm text-slate-500 px-1">
          <span>
            Page {page.number + 1} of {Math.max(1, page.totalPages)} · {page.totalElements} students
          </span>
          <div className="flex gap-2">
            <button
              disabled={pageNum === 0 || loading}
              onClick={() => setPageNum((p) => p - 1)}
              className="btn-secondary btn-sm"
            >
              <Icon name="chevron-left" size={16} />
              Prev
            </button>
            <button
              disabled={pageNum + 1 >= page.totalPages || loading}
              onClick={() => setPageNum((p) => p + 1)}
              className="btn-secondary btn-sm"
            >
              Next
              <Icon name="chevron-right" size={16} />
            </button>
          </div>
        </div>
      )}

      <Modal
        open={!!confirmDisable}
        onClose={() => setConfirmDisable(null)}
        title="Disable Student Access"
        description={`This will disable ${confirmDisable?.fullName}'s account. They will no longer be able to log in.`}
        size="sm"
        footer={
          <>
            <button
              className="btn-secondary btn-sm"
              onClick={() => setConfirmDisable(null)}
            >
              Cancel
            </button>
            <button
              className="btn-danger btn-sm"
              onClick={() => {
                if (confirmDisable) {
                  toggleActive(confirmDisable);
                }
                setConfirmDisable(null);
              }}
            >
              <Icon name="lock" size={16} />
              Disable Account
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
                You can re-enable the account at any time.
              </p>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
