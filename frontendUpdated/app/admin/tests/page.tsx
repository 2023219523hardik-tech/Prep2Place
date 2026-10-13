"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ErrorState from "@/components/ErrorState";
import { DataTable } from "@/components/ui/DataTable";
import { FieldGroup } from "@/components/ui/FieldGroup";
import { Icon } from "@/components/ui/Icon";
import { SkeletonGroup } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/hooks/useToast";
import {
  TEST_TYPES,
  TestStatus,
  TestSummary,
  TestType,
  labelOf,
  testsAdminApi,
} from "@/lib/managedTests";

interface Page<T> { content: T[]; totalElements: number; totalPages: number; number: number; }

const STATUSES: TestStatus[] = ["DRAFT", "PUBLISHED", "SCHEDULED", "ACTIVE", "COMPLETED", "ARCHIVED"];

const STATUS_BADGE: Record<TestStatus, string> = {
  DRAFT: "badge badge-neutral",
  PUBLISHED: "badge badge-success",
  SCHEDULED: "badge badge-warning",
  ACTIVE: "badge badge-primary",
  COMPLETED: "badge badge-accent",
  ARCHIVED: "badge badge-danger",
};

const TYPE_BADGE: Record<string, string> = {
  APTITUDE: "badge badge-accent",
  TECHNICAL: "badge badge-primary",
  CODING: "badge badge-success",
  GD: "badge badge-warning",
  PERSONAL_INTERVIEW: "badge badge-danger",
};

export default function AdminTestsPage() {
  const [page, setPage] = useState<Page<TestSummary> | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<TestStatus | "">("");
  const [testType, setTestType] = useState<TestType | "">("");
  const [pageNum, setPageNum] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const { push } = useToast();

  function load() {
    setLoading(true);
    testsAdminApi
      .list({
        page: pageNum,
        size: 20,
        search: search || undefined,
        status: (status || undefined) as TestStatus | undefined,
        testType: (testType || undefined) as TestType | undefined,
      })
      .then(setPage)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, [pageNum, status, testType]);

  async function withBusy(id: number, action: () => Promise<any>) {
    setBusyId(id);
    try {
      await action();
      push({ variant: "success", title: "Action completed" });
      load();
    } catch (e: any) {
      setError(e.message);
      push({ variant: "error", title: "Action failed", description: e.message });
    } finally {
      setBusyId(null);
    }
  }

  async function togglePublish(t: TestSummary) {
    await withBusy(t.id, () =>
      t.status === "PUBLISHED" ? testsAdminApi.unpublish(t.id) : testsAdminApi.publish(t.id)
    );
  }

  async function duplicate(t: TestSummary) {
    await withBusy(t.id, () => testsAdminApi.duplicate(t.id));
  }

  async function archive(t: TestSummary) {
    if (!confirm(`Archive "${t.name}"? This cannot be undone.`)) return;
    await withBusy(t.id, () => testsAdminApi.archive(t.id));
  }

  function clearFilters() {
    setSearch("");
    setStatus("");
    setTestType("");
    setPageNum(0);
  }

  const kpiTiles = (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {[0, 1, 2, 3].map((i) => (
        <SkeletonGroup key={i} variant="kpi" />
      ))}
    </div>
  );

  const columns = [
    {
      key: "name",
      label: "Test",
      width: "22%",
      render: (t: TestSummary) => (
        <div className="min-w-0">
          <Link
            href={`/admin/tests/${t.id}/preview`}
            className="font-semibold text-slate-900 truncate block hover:text-premium-700 hover:underline"
          >
            {t.name}
          </Link>
          {t.organizationName && (
            <div className="text-xs text-slate-500 mt-0.5 truncate">{t.organizationName}</div>
          )}
        </div>
      ),
    },
    {
      key: "testType",
      label: "Type",
      width: "12%",
      render: (t: TestSummary) => {
        const cls = TYPE_BADGE[t.testType] || "badge badge-neutral";
        return <span className={cls}>{labelOf(t.testType)}</span>;
      },
    },
    {
      key: "status",
      label: "Status",
      width: "14%",
      render: (t: TestSummary) => (
        <span className={STATUS_BADGE[t.status]}>{labelOf(t.status)}</span>
      ),
    },
    {
      key: "sectionCount",
      label: "Sections",
      width: "10%",
      render: (t: TestSummary) => (
        <span className="font-semibold text-slate-700">{t.sectionCount}</span>
      ),
    },
    {
      key: "questionCount",
      label: "Questions",
      width: "10%",
      render: (t: TestSummary) => (
        <span className="font-semibold text-slate-700">{t.questionCount}</span>
      ),
    },
    {
      key: "assignedStudentCount",
      label: "Assigned",
      width: "10%",
      render: (t: TestSummary) => (
        <span className="font-semibold text-slate-700">{t.assignedStudentCount}</span>
      ),
    },
    {
      key: "attemptCount",
      label: "Attempts",
      width: "10%",
      render: (t: TestSummary) => (
        <Link
          href={`/admin/tests/${t.id}/attempts`}
          className="font-semibold text-premium-700 hover:underline"
        >
          {t.attemptCount}
        </Link>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      width: "18%",
      align: "right" as const,
      render: (t: TestSummary) => (
        <div className="flex items-center justify-end gap-1">
          <Link
            href={`/admin/tests/${t.id}/edit`}
            className="btn-ghost btn-sm btn-icon"
            title="Edit"
          >
            <Icon name="pencil" size={16} />
          </Link>
          <Link
            href={`/admin/tests/${t.id}/preview`}
            className="btn-secondary btn-sm btn-icon"
            title="Preview"
          >
            <Icon name="eye" size={16} />
          </Link>
          <button
            disabled={busyId === t.id}
            onClick={() => togglePublish(t)}
            className={`btn-ghost btn-sm btn-icon disabled:opacity-50 ${t.status === "PUBLISHED" ? "text-amber-600 hover:text-amber-700 hover:bg-amber-50" : "text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"}`}
            title={t.status === "PUBLISHED" ? "Unpublish" : "Publish"}
          >
            <Icon name="chart-bar" size={16} />
          </button>
          <button
            disabled={busyId === t.id}
            onClick={() => duplicate(t)}
            className="btn-ghost btn-sm btn-icon disabled:opacity-50"
            title="Duplicate"
          >
            <Icon name="copy" size={16} />
          </button>
          <button
            disabled={busyId === t.id || t.status === "ARCHIVED"}
            onClick={() => archive(t)}
            className="btn-ghost btn-sm btn-icon text-red-600 hover:text-red-700 hover:bg-red-50 disabled:opacity-50"
            title="Archive"
          >
            <Icon name="trash-2" size={16} />
          </button>
        </div>
      ),
    },
  ];

  if (loading && !page) {
    return (
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold">Custom Tests</h1>
            <p className="text-sm text-slate-500 mt-1">Build, schedule, and manage custom assessments for candidates and students.</p>
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

  const showEmpty = !loading && (page?.content.length ?? 0) === 0;
  const isFirstEmpty = !loading && page && page.totalElements === 0;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Custom Tests</h1>
          <p className="text-sm text-slate-500 mt-1">Build, schedule, and manage custom assessments for candidates and students.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/tests/new" className="btn-primary btn-sm">
            <Icon name="plus" size={16} />
            New Test
          </Link>
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
              placeholder="Search by test name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (setPageNum(0), load())}
            />
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 mr-1">
                Type
              </span>
              <button
                onClick={() => { setTestType(""); setPageNum(0); }}
                className={`chip ${testType === "" ? "chip-active" : "chip-muted"}`}
              >
                All
              </button>
              {TEST_TYPES.slice(0, 4).map((t) => (
                <button
                  key={t.value}
                  onClick={() => { setTestType(testType === t.value ? "" : t.value as TestType); setPageNum(0); }}
                  className={`chip ${testType === t.value ? "chip-active" : "chip-muted"}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="w-px h-6 bg-slate-200 hidden md:block" />
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 mr-1">
                Status
              </span>
              <button
                onClick={() => { setStatus(""); setPageNum(0); }}
                className={`chip ${status === "" ? "chip-active" : "chip-muted"}`}
              >
                All
              </button>
              {STATUSES.slice(0, 4).map((s) => (
                <button
                  key={s}
                  onClick={() => { setStatus(status === s ? "" : s); setPageNum(0); }}
                  className={`chip ${status === s ? "chip-active" : "chip-muted"}`}
                >
                  {labelOf(s)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </FieldGroup>

      {error && !page ? (
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
          icon="test-tube"
          title="No custom tests yet"
          description="Create your first test to start building assessments. You can mix question types and schedule them for candidates."
          variant="info"
          action={
            <Link href="/admin/tests/new" className="btn-primary btn-sm">
              <Icon name="plus" size={16} />
              Create First Test
            </Link>
          }
        />
      ) : showEmpty ? (
        <EmptyState
          icon="search"
          title="No matching tests"
          description="Try adjusting your search terms or clearing filters to see more tests."
          action={
            <button className="btn-secondary btn-sm" onClick={clearFilters}>
              Clear Filters
            </button>
          }
        />
      ) : (
        <>
          <DataTable<TestSummary>
            columns={columns}
            data={page?.content ?? []}
            rowKey="id"
            emptyTitle="No matching tests"
            emptyDesc="Try adjusting your search or filters."
            emptyIcon="search"
            loading={loading}
          />
          {page && (
            <div className="flex justify-between items-center text-sm text-slate-500 px-1">
              <span>
                Page {page.number + 1} of {Math.max(1, page.totalPages)} · {page.totalElements} tests
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
        </>
      )}
    </div>
  );
}
