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

interface JobRole { id: number; title: string; domain: string; description: string; requiredSkills: string; }

export default function AdminRolesPage() {
  const [roles, setRoles] = useState<JobRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ title: "", domain: "", description: "", requiredSkills: "" });
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [domainFilter, setDomainFilter] = useState("");
  const { push } = useToast();

  function load() {
    setLoading(true);
    adminApi.get<JobRole[]>("/api/admin/roles")
      .then(setRoles)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function createRole(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await adminApi.post("/api/admin/roles", form);
      setForm({ title: "", domain: "", description: "", requiredSkills: "" });
      push({ variant: "success", title: "Role created", description: "New job role has been added." });
      load();
    } catch (e: any) {
      setError(e.message);
      push({ variant: "error", title: "Create failed", description: e.message });
    } finally {
      setSaving(false);
    }
  }

  function clearFilters() {
    setSearch("");
    setDomainFilter("");
  }

  const domainOptions = [...new Set(roles.map((r) => r.domain))].filter(Boolean);

  const filtered = roles.filter((r) => {
    if (search) {
      const s = search.toLowerCase();
      if (!r.title.toLowerCase().includes(s) && !r.domain.toLowerCase().includes(s) && !r.description.toLowerCase().includes(s)) {
        return false;
      }
    }
    if (domainFilter && r.domain !== domainFilter) return false;
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
      render: (row: JobRole) => (
        <span className="badge badge-neutral font-mono text-xs">#{row.id}</span>
      ),
    },
    {
      key: "title",
      label: "Title",
      width: "22%",
      render: (row: JobRole) => (
        <div className="font-semibold text-slate-900">{row.title}</div>
      ),
    },
    {
      key: "domain",
      label: "Domain",
      width: "18%",
      render: (row: JobRole) => {
        if (!row.domain) return <span className="text-slate-400">—</span>;
        return <span className="chip chip-muted">{row.domain}</span>;
      },
    },
    {
      key: "description",
      label: "Description",
      width: "30%",
      render: (row: JobRole) => {
        if (!row.description) return <span className="text-slate-400">—</span>;
        return <div className="text-sm text-slate-600 truncate max-w-xs">{row.description}</div>;
      },
    },
    {
      key: "requiredSkills",
      label: "Skills",
      render: (row: JobRole) => {
        const skills = (row.requiredSkills || "").split(",").filter(Boolean).slice(0, 3);
        if (skills.length === 0) return <span className="text-slate-400">—</span>;
        return (
          <div className="flex flex-wrap gap-1">
            {skills.map((s, i) => (
              <span key={i} className="badge badge-neutral">{s.trim()}</span>
            ))}
            {((row.requiredSkills || "").split(",").filter(Boolean).length > 3) && (
              <span className="badge badge-neutral">
                +{(row.requiredSkills || "").split(",").filter(Boolean).length - 3}
              </span>
            )}
          </div>
        );
      },
    },
  ];

  if (loading && roles.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold">Job Roles</h1>
            <p className="text-sm text-slate-500 mt-1">Define job roles, skill requirements, and domain classifications for placement matching.</p>
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
              {[0, 1].map((i) => (
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
  const isFirstEmpty = !loading && roles.length === 0;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Job Roles</h1>
          <p className="text-sm text-slate-500 mt-1">Define job roles, skill requirements, and domain classifications for placement matching.</p>
        </div>
      </div>

      {loading && kpiTiles}

      <FieldGroup title="Create New Job Role" description="Add a new job role with required skills and domain classification for placement matching.">
        <form onSubmit={createRole} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input className="input" placeholder="Title (e.g. Backend Developer)" value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })} required />
            <input className="input" placeholder="Domain (e.g. Software Development)" value={form.domain}
              onChange={(e) => setForm({ ...form, domain: e.target.value })} />
          </div>
          <textarea className="input" placeholder="Description" value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <input className="input" placeholder="Required skills (comma-separated)" value={form.requiredSkills}
            onChange={(e) => setForm({ ...form, requiredSkills: e.target.value })} />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button className="btn-primary btn-sm" disabled={saving}>
            <Icon name="plus" size={16} />
            {saving ? "Saving..." : "Add Role"}
          </button>
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
              placeholder="Search by title, domain, or description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 mr-1">
                Domain
              </span>
              <button
                onClick={() => setDomainFilter("")}
                className={`chip ${domainFilter === "" ? "chip-active" : "chip-muted"}`}
              >
                All
              </button>
              {domainOptions.slice(0, 5).map((d) => (
                <button
                  key={d}
                  onClick={() => setDomainFilter(domainFilter === d ? "" : d)}
                  className={`chip ${domainFilter === d ? "chip-active" : "chip-muted"}`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        </div>
      </FieldGroup>

      {error && roles.length === 0 ? (
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
          icon="briefcase"
          title="No job roles yet"
          description="Define your first job role to start matching candidates with their ideal positions."
          variant="info"
          action={
            <button
              type="button"
              className="btn-primary btn-sm"
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            >
              <Icon name="plus" size={16} />
              Create First Role
            </button>
          }
        />
      ) : showEmpty ? (
        <EmptyState
          icon="search"
          title="No matching roles"
          description="Try adjusting your search terms or clearing filters to see more roles."
          action={
            <button className="btn-secondary btn-sm" onClick={clearFilters}>
              Clear Filters
            </button>
          }
        />
      ) : (
        <DataTable<JobRole>
          columns={columns}
          data={filtered}
          rowKey="id"
          emptyTitle="No matching roles"
          emptyDesc="Try adjusting your search or filters."
          emptyIcon="search"
          loading={loading}
        />
      )}
    </div>
  );
}
