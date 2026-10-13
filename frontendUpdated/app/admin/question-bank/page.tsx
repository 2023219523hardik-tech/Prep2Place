"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { adminApi } from "@/lib/adminApi";
import { Icon } from "@/components/ui/Icon";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton, SkeletonGroup } from "@/components/ui/Skeleton";
import { DataTable } from "@/components/ui/DataTable";
import ErrorState from "@/components/ErrorState";
import { Modal } from "@/components/ui/Modal";
import { FieldGroup } from "@/components/ui/FieldGroup";
import { useToast } from "@/hooks/useToast";
import { CompanyLogo } from "@/components/CompanyLogos";

type TabKey = "dsa" | "sql" | "dataframe" | "mcq" | "vault";

interface Page<T> {
  content: T[];
  totalElements?: number;
  totalPages?: number;
  number?: number;
}

interface DsaRow {
  id: number;
  title: string;
  topic?: string;
  difficulty?: string;
}

interface SqlRow {
  id: number;
  title?: string;
  question?: string;
  statement?: string;
  topic?: string;
  category?: string;
  difficulty?: string;
}

interface DataframeRow {
  id: number;
  title?: string;
  question?: string;
  statement?: string;
  topic?: string;
  category?: string;
  difficulty?: string;
}

interface McqRow {
  id: number;
  questionText?: string;
  question?: string;
  title?: string;
  topic?: string;
  category?: string;
  difficulty?: string;
}

interface CompanyAdminRow {
  id: number;
  name: string;
  slug: string;
  totalDistinctAvailable?: number;
  includedInSheet?: number;
  capped?: boolean;
  questionCount: number;
}

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: "dsa", label: "DSA", icon: "code" },
  { key: "sql", label: "SQL", icon: "database" },
  { key: "dataframe", label: "DataFrame", icon: "table" },
  { key: "mcq", label: "Tech MCQ", icon: "brain" },
  { key: "vault", label: "Company Vault", icon: "shield" },
];

const SEED_ENDPOINTS: Record<TabKey, string> = {
  dsa: "/api/coding/problems/seed",
  sql: "/api/sql/problems/seed",
  dataframe: "/api/dataframe/problems/seed",
  mcq: "/api/admin/questionbank/technical-mcq/import",
  vault: "/api/admin/company-vault/seed-index",
};

const BULK_DELETE_ENDPOINTS: Record<TabKey, string> = {
  dsa: "/api/coding/problems/bulk-delete",
  sql: "/api/sql/problems/bulk-delete",
  dataframe: "/api/dataframe/problems/bulk-delete",
  mcq: "/api/technical/questions/bulk-delete",
  vault: "",
};

const DEDUPLICATE_ENDPOINTS: Record<TabKey, string> = {
  dsa: "/api/coding/problems/deduplicate",
  sql: "/api/sql/problems/deduplicate",
  dataframe: "/api/dataframe/problems/deduplicate",
  mcq: "/api/technical/questions/deduplicate",
  vault: "",
};

const PREVIEW_LINKS: Record<TabKey, (id: number) => string> = {
  dsa: (id) => `/coding/${id}`,
  sql: (id) => `/coding/sql/${id}`,
  dataframe: (id) => `/coding/dataframe/${id}`,
  mcq: (id) => `/coding/${id}`,
  vault: () => `/coding/companies`,
};

const DIFFICULTY_BADGE: Record<string, string> = {
  EASY: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20",
  MEDIUM: "bg-amber-50 text-amber-700 ring-1 ring-amber-600/20",
  HARD: "bg-rose-50 text-rose-700 ring-1 ring-rose-600/20",
};

function difficultyBadgeClass(d?: string): string {
  if (!d) return "badge badge-neutral";
  const key = d.toUpperCase();
  return DIFFICULTY_BADGE[key] ?? "badge badge-neutral";
}

function getTitle(row: any, tab: TabKey): string {
  if (tab === "dsa") return row.title ?? "Untitled";
  if (tab === "sql" || tab === "dataframe") return row.title ?? row.question ?? row.statement ?? "Untitled";
  return row.questionText ?? row.question ?? row.title ?? "Untitled";
}

function getTopic(row: any, tab: TabKey): string {
  if (Array.isArray(row.topics) && row.topics.length > 0) {
    return row.topics.join(", ");
  }
  if (tab === "dsa") return row.topic ?? "—";
  if (tab === "sql" || tab === "dataframe") return row.topic ?? row.category ?? "—";
  return row.topic ?? row.category ?? "—";
}

function getDifficulty(row: any): string {
  return row.difficulty?.toUpperCase() ?? "—";
}

export default function AdminQuestionBankPage() {
  const { push } = useToast();
  const [tab, setTab] = useState<TabKey>("dsa");

  const [dsaData, setDsaData] = useState<DsaRow[]>([]);
  const [sqlData, setSqlData] = useState<SqlRow[]>([]);
  const [dfData, setDfData] = useState<DataframeRow[]>([]);
  const [mcqData, setMcqData] = useState<McqRow[]>([]);
  const [vaultData, setVaultData] = useState<CompanyAdminRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [seedModalOpen, setSeedModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deduplicating, setDeduplicating] = useState(false);
  const [seedFile, setSeedFile] = useState<File | null>(null);
  const [seedPreview, setSeedPreview] = useState("");
  const [seedError, setSeedError] = useState<string | null>(null);
  const [seedSuccessInfo, setSeedSuccessInfo] = useState<{
    total: number;
    inserted: number;
    updated: number;
    skipped: number;
    duplicatesRemoved: number;
    message: string;
  } | null>(null);
  const [seedFileDiagnostics, setSeedFileDiagnostics] = useState<{
    count: number;
    sizeKb: string;
    sampleTitles: string[];
    hasTestCases: boolean;
  } | null>(null);
  const [duplicateStrategy, setDuplicateStrategy] = useState<"UPDATE" | "SKIP" | "INSERT_NEW">("UPDATE");
  const [cleanupAfterSeed, setCleanupAfterSeed] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Company Vault specific state
  const [vaultSearch, setVaultSearch] = useState("");
  const [syncingVault, setSyncingVault] = useState(false);

  // Modal: Seed Index (_index.json)
  const [vaultIndexModalOpen, setVaultIndexModalOpen] = useState(false);
  const [vaultIndexFile, setVaultIndexFile] = useState<File | null>(null);
  const [vaultIndexPreview, setVaultIndexPreview] = useState("");
  const [seedingIndex, setSeedingIndex] = useState(false);
  const vaultIndexInputRef = useRef<HTMLInputElement>(null);

  // Modal: Company-Wise Seed
  const [vaultCompanyModalOpen, setVaultCompanyModalOpen] = useState(false);
  const [vaultSelectedSlug, setVaultSelectedSlug] = useState("");
  const [vaultSelectedName, setVaultSelectedName] = useState("");
  const [vaultCompanyFile, setVaultCompanyFile] = useState<File | null>(null);
  const [vaultCompanyPreview, setVaultCompanyPreview] = useState("");
  const [seedingCompany, setSeedingCompany] = useState(false);
  const vaultCompanyInputRef = useRef<HTMLInputElement>(null);

  // Modal: Create New Company First, Then Seed
  const [vaultNewCompanyModalOpen, setVaultNewCompanyModalOpen] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState("");
  const [newCompanySlug, setNewCompanySlug] = useState("");
  const [newCompanyFile, setNewCompanyFile] = useState<File | null>(null);
  const [newCompanyPreview, setNewCompanyPreview] = useState("");
  const [creatingAndSeeding, setCreatingAndSeeding] = useState(false);
  const newCompanyInputRef = useRef<HTMLInputElement>(null);

  const [tableSearch, setTableSearch] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState("ALL");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [d, s, df, m, v] = await Promise.all([
        adminApi.get<DsaRow[]>("/api/coding/problems").catch(() => []),
        adminApi
          .get<Page<SqlRow>>("/api/coding/sql?page=0&size=200")
          .then((p) => p.content ?? [])
          .catch(() => []),
        adminApi
          .get<Page<DataframeRow>>("/api/coding/dataframe?page=0&size=200")
          .then((p) => p.content ?? [])
          .catch(() => []),
        adminApi
          .get<{ content: McqRow[] }>("/api/technical/questions?page=0&size=200")
          .then((p) => p.content ?? [])
          .catch(() => []),
        adminApi
          .get<CompanyAdminRow[]>("/api/admin/company-vault/companies")
          .catch(() => []),
      ]);

      const rawDsa = Array.isArray(d) ? d : [];
      const cleanDsaList: DsaRow[] = [];
      const seenDsaTitles = new Set<string>();

      for (const item of rawDsa as any[]) {
        const cat = (item.category || "").toUpperCase();
        const mode = (item.executionMode || "").toUpperCase();
        if (cat === "SQL" || cat === "DATAFRAME" || mode === "SQL" || mode === "DATAFRAME") {
          continue;
        }
        const titleKey = (item.title || "").trim().toLowerCase();
        if (titleKey && !seenDsaTitles.has(titleKey)) {
          seenDsaTitles.add(titleKey);
          cleanDsaList.push(item);
        } else if (!titleKey) {
          cleanDsaList.push(item);
        }
      }

      setDsaData(cleanDsaList);
      setSqlData(Array.isArray(s) ? s : []);
      setDfData(Array.isArray(df) ? df : []);
      setMcqData(Array.isArray(m) ? m : []);
      setVaultData(Array.isArray(v) ? v : []);
    } catch (e: any) {
      setError(e?.message || "Failed to load question bank");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    setSelected(new Set());
  }, [tab]);

  const currentRows: any[] =
    tab === "dsa" ? dsaData : tab === "sql" ? sqlData : tab === "dataframe" ? dfData : tab === "mcq" ? mcqData : [];

  const filteredRows = currentRows.filter((r) => {
    const title = getTitle(r, tab).toLowerCase();
    const topic = getTopic(r, tab).toLowerCase();
    const query = tableSearch.trim().toLowerCase();
    const matchesSearch = !query || title.includes(query) || topic.includes(query) || String(r.id).includes(query);
    const diff = getDifficulty(r);
    const matchesDiff = difficultyFilter === "ALL" || diff === difficultyFilter;
    return matchesSearch && matchesDiff;
  });

  function toggleRow(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === filteredRows.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filteredRows.map((r) => r.id)));
    }
  }

  function openSeedModal() {
    setSeedFile(null);
    setSeedPreview("");
    setSeedError(null);
    setSeedSuccessInfo(null);
    setSeedFileDiagnostics(null);
    setDuplicateStrategy("UPDATE");
    setCleanupAfterSeed(true);
    setSeedModalOpen(true);
  }

  function handleSeedFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setSeedFile(f);
    setSeedError(null);
    setSeedSuccessInfo(null);
    f.text().then((txt) => {
      try {
        const parsed = JSON.parse(txt);
        let items: any[] = [];
        if (Array.isArray(parsed)) {
          items = parsed;
        } else if (Array.isArray((parsed as any).problems)) {
          items = (parsed as any).problems;
        } else if (Array.isArray((parsed as any).questions)) {
          items = (parsed as any).questions;
        } else {
          items = [parsed];
        }

        const count = items.length;
        const sampleTitles = items
          .slice(0, 3)
          .map((item) => item.title || item.question || item.questionText || item.statement || "Untitled")
          .filter(Boolean);
        const hasTestCases = items.some((item) => item.testCases && item.testCases.length > 0);

        setSeedFileDiagnostics({
          count,
          sizeKb: (f.size / 1024).toFixed(1),
          sampleTitles,
          hasTestCases,
        });
        setSeedPreview(`Detected ${count} record${count === 1 ? "" : "s"} in ${f.name}`);
      } catch {
        setSeedFileDiagnostics(null);
        setSeedError(`The file "${f.name}" is not valid JSON.`);
        setSeedPreview("");
      }
    });
  }

  async function runSeed(customStrategy?: "UPDATE" | "SKIP" | "INSERT_NEW") {
    if (!seedFile) {
      push({ variant: "warning", title: "Select a file", description: "Choose a JSON file to seed." });
      return;
    }
    const strat = customStrategy || duplicateStrategy;
    if (customStrategy) setDuplicateStrategy(customStrategy);
    setSeeding(true);
    setSeedError(null);
    try {
      const text = await seedFile.text();
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new Error("The selected file is not valid JSON.");
      }

      const endpoint = `${SEED_ENDPOINTS[tab]}?duplicateStrategy=${strat}&cleanup=${cleanupAfterSeed}`;
      const result: any = await adminApi.post(endpoint, parsed);

      const totalCount = seedFileDiagnostics?.count ?? (Array.isArray(parsed) ? parsed.length : 1);
      const inserted = result?.inserted ?? 0;
      const updated = result?.updated ?? 0;
      const skipped = result?.skipped ?? 0;
      const duplicatesRemoved = result?.duplicatesRemoved ?? 0;
      const message = result?.message || `Successfully processed seed for ${TABS.find((t) => t.key === tab)?.label}.`;

      setSeedSuccessInfo({
        total: totalCount,
        inserted,
        updated,
        skipped,
        duplicatesRemoved,
        message,
      });

      push({
        variant: "success",
        title: "Seed completed successfully",
        description: `${inserted} inserted, ${updated} updated${skipped ? `, ${skipped} skipped` : ""}${duplicatesRemoved ? `, ${duplicatesRemoved} cleaned` : ""}.`,
      });
      refresh();
    } catch (e: any) {
      const msg = e?.message || "Upload failed.";
      setSeedError(msg);
      push({ variant: "error", title: "Seed failed", description: msg });
    } finally {
      setSeeding(false);
    }
  }

  function downloadSampleTemplate() {
    let sampleData: any = [];
    const filename = `sample-${tab}-questions.json`;

    if (tab === "dsa") {
      sampleData = [
        {
          title: "Two Sum",
          slug: "two-sum",
          topic: "Arrays, Hash Table",
          difficulty: "EASY",
          statement: "Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.",
          sampleInput: "nums = [2,7,11,15], target = 9",
          sampleOutput: "[0,1]",
          methodName: "twoSum",
          returnType: "int[]",
          templates: {
            java: "class Solution {\n    public int[] twoSum(int[] nums, int target) {\n        // Your code here\n        return new int[]{};\n    }\n}",
            python: "class Solution:\n    def twoSum(self, nums: list[int], target: int) -> list[int]:\n        return []"
          },
          testCases: [
            { "input": "[2,7,11,15]\n9", "expectedOutput": "[0,1]", "hidden": false },
            { "input": "[3,2,4]\n6", "expectedOutput": "[1,2]", "hidden": true }
          ]
        }
      ];
    } else if (tab === "sql") {
      sampleData = [
        {
          title: "Second Highest Salary",
          category: "SQL",
          topic: "Window Functions, Aggregations",
          difficulty: "MEDIUM",
          statement: "Write a SQL query to find the second highest salary from the Employee table.",
          sampleInput: "Employee (id INT, salary INT)",
          sampleOutput: "SecondHighestSalary"
        }
      ];
    } else if (tab === "dataframe") {
      sampleData = [
        {
          title: "Clean and Impute Missing Values",
          category: "DATAFRAME",
          topic: "Pandas, Data Cleaning",
          difficulty: "EASY",
          statement: "Write a python function to drop duplicates and fill NaN values in salary column with mean.",
          sampleInput: "df: id, name, salary",
          sampleOutput: "Cleaned pandas DataFrame"
        }
      ];
    } else {
      sampleData = [
        {
          questionText: "What is the time complexity of searching in a Balanced Binary Search Tree (AVL / Red-Black)?",
          category: "DSA",
          topic: "Trees & Graphs",
          difficulty: "EASY",
          options: [
            { key: "A", text: "O(1)" },
            { key: "B", text: "O(log N)" },
            { key: "C", text: "O(N)" },
            { key: "D", text: "O(N log N)" }
          ],
          correctOptions: ["B"],
          multipleCorrect: false,
          explanation: "In a balanced BST with N nodes, tree height is bounded by O(log N)."
        }
      ];
    }

    const blob = new Blob([JSON.stringify(sampleData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleDeduplicate() {
    if (tab === "vault") return;
    setDeduplicating(true);
    try {
      const endpoint = DEDUPLICATE_ENDPOINTS[tab];
      const res: any = await adminApi.post(endpoint, {});
      push({
        variant: "success",
        title: "Deduplication finished",
        description: res.duplicatesRemoved
          ? `Removed/archived ${res.duplicatesRemoved} duplicate entries from ${TABS.find((t) => t.key === tab)?.label}.`
          : `No duplicate questions found in ${TABS.find((t) => t.key === tab)?.label}.`,
      });
      refresh();
    } catch (e: any) {
      push({ variant: "error", title: "Deduplication failed", description: e?.message || "Operation failed." });
    } finally {
      setDeduplicating(false);
    }
  }

  function openDeleteModal() {
    if (selected.size === 0) {
      push({ variant: "warning", title: "Select rows first", description: "Check at least one row to bulk delete." });
      return;
    }
    setDeleteModalOpen(true);
  }

  async function runBulkDelete() {
    if (selected.size === 0) return;
    setDeleting(true);
    try {
      const ids = Array.from(selected);
      await adminApi.post(BULK_DELETE_ENDPOINTS[tab], { ids });
      push({
        variant: "success",
        title: "Bulk delete completed",
        description: `${ids.length} row${ids.length === 1 ? "" : "s"} removed from ${TABS.find((t) => t.key === tab)?.label}.`,
      });
      setSelected(new Set());
      setDeleteModalOpen(false);
      refresh();
    } catch (e: any) {
      push({ variant: "error", title: "Bulk delete failed", description: e?.message || "Delete operation failed." });
    } finally {
      setDeleting(false);
    }
  }

  // --- Company Vault Handlers ---
  async function runVaultIndexSeed() {
    if (!vaultIndexFile) {
      push({ variant: "warning", title: "Select index file", description: "Choose a _index.json file." });
      return;
    }
    setSeedingIndex(true);
    try {
      const text = await vaultIndexFile.text();
      const parsed = JSON.parse(text);
      const res: any = await adminApi.post("/api/admin/company-vault/seed-index", parsed);
      push({
        variant: "success",
        title: "Index seeded",
        description: res.message || `Successfully imported company directory index.`,
      });
      setVaultIndexModalOpen(false);
      setVaultIndexFile(null);
      setVaultIndexPreview("");
      refresh();
    } catch (e: any) {
      push({ variant: "error", title: "Seed index failed", description: e?.message || "Failed to seed index." });
    } finally {
      setSeedingIndex(false);
    }
  }

  async function runVaultCompanySeed() {
    if (!vaultSelectedSlug) {
      push({ variant: "warning", title: "Choose company", description: "Select or enter a company slug." });
      return;
    }
    if (!vaultCompanyFile) {
      push({ variant: "warning", title: "Select JSON file", description: "Choose a questions JSON file." });
      return;
    }
    setSeedingCompany(true);
    try {
      const text = await vaultCompanyFile.text();
      const parsed = JSON.parse(text);
      const res: any = await adminApi.post(
        `/api/admin/company-vault/seed-company?companySlug=${encodeURIComponent(vaultSelectedSlug)}&companyName=${encodeURIComponent(vaultSelectedName || vaultSelectedSlug)}`,
        parsed
      );
      push({
        variant: "success",
        title: "Company questions seeded",
        description: res.message || `Imported questions for ${vaultSelectedSlug}.`,
      });
      setVaultCompanyModalOpen(false);
      setVaultCompanyFile(null);
      setVaultCompanyPreview("");
      refresh();
    } catch (e: any) {
      push({ variant: "error", title: "Company seed failed", description: e?.message || "Failed to seed company questions." });
    } finally {
      setSeedingCompany(false);
    }
  }

  async function runCreateAndSeedCompany() {
    if (!newCompanyName.trim()) {
      push({ variant: "warning", title: "Name required", description: "Enter a company name." });
      return;
    }
    setCreatingAndSeeding(true);
    try {
      const slug = (newCompanySlug || newCompanyName).trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
      let questions: any[] = [];
      if (newCompanyFile) {
        const text = await newCompanyFile.text();
        const parsed = JSON.parse(text);
        questions = Array.isArray(parsed) ? parsed : parsed.questions ?? [];
      }
      const res: any = await adminApi.post("/api/admin/company-vault/create-and-seed", {
        companyName: newCompanyName.trim(),
        companySlug: slug,
        questions,
      });
      push({
        variant: "success",
        title: "Company created & seeded",
        description: res.message || `Company "${newCompanyName}" created with ${questions.length} questions.`,
      });
      setVaultNewCompanyModalOpen(false);
      setNewCompanyName("");
      setNewCompanySlug("");
      setNewCompanyFile(null);
      setNewCompanyPreview("");
      refresh();
    } catch (e: any) {
      push({ variant: "error", title: "Creation failed", description: e?.message || "Could not create company." });
    } finally {
      setCreatingAndSeeding(false);
    }
  }

  async function runSyncAllVault() {
    if (!confirm("Run complete classpath seed sync for all companies?")) return;
    setSyncingVault(true);
    try {
      const res: any = await adminApi.post("/api/admin/company-vault/seed-all", {});
      push({
        variant: "success",
        title: "Vault sync complete",
        description: `${res.companiesUpserted ?? 0} companies updated, ${res.ranksCreated ?? 0} question ranks created.`,
      });
      refresh();
    } catch (e: any) {
      push({ variant: "error", title: "Sync failed", description: e?.message || "Classpath sync failed." });
    } finally {
      setSyncingVault(false);
    }
  }

  const columns = [
    {
      key: "select" as const,
      label: (
        <div className="flex items-center justify-center">
          <input
            type="checkbox"
            checked={filteredRows.length > 0 && selected.size === filteredRows.length}
            onChange={toggleAll}
            aria-label="Select all rows"
          />
        </div>
      ),
      width: "48px",
      align: "center" as const,
      render: (row: any) => (
        <div className="flex items-center justify-center">
          <input
            type="checkbox"
            checked={selected.has(row.id)}
            onChange={() => toggleRow(row.id)}
            aria-label={`Select row ${row.id}`}
          />
        </div>
      ),
    },
    {
      key: "id" as const,
      label: "ID",
      width: "70px",
      render: (row: any) => (
        <span className="badge badge-neutral font-mono text-xs">#{row.id}</span>
      ),
    },
    {
      key: "title" as const,
      label: tab === "mcq" ? "Question" : "Title",
      render: (row: any) => (
        <div className="min-w-0 py-1">
          <Link
            href={PREVIEW_LINKS[tab](row.id)}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-slate-900 hover:text-indigo-600 text-sm line-clamp-2 transition-colors block leading-snug"
            title={getTitle(row, tab)}
          >
            {getTitle(row, tab)}
          </Link>
        </div>
      ),
    },
    {
      key: "topic" as const,
      label: tab === "mcq" ? "Category" : "Topic",
      render: (row: any) => {
        const topics = Array.isArray(row.topics) && row.topics.length > 0 
          ? row.topics 
          : row.topic 
          ? [row.topic] 
          : row.category 
          ? [row.category] 
          : [];
        if (topics.length === 0) return <span className="text-slate-400 text-xs">—</span>;
        return (
          <div className="flex flex-wrap gap-1 max-w-xs">
            {topics.slice(0, 3).map((t: string, idx: number) => (
              <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700">
                {t}
              </span>
            ))}
            {topics.length > 3 && (
              <span className="text-[10px] text-slate-400 self-center">+{topics.length - 3}</span>
            )}
          </div>
        );
      },
    },
    {
      key: "difficulty" as const,
      label: "Difficulty",
      width: "110px",
      render: (row: any) => {
        const d = getDifficulty(row);
        if (d === "—") return <span className="text-slate-400 text-sm">—</span>;
        const cls = difficultyBadgeClass(d);
        return (
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold ${cls}`}
          >
            {d}
          </span>
        );
      },
    },
    {
      key: "actions" as const,
      label: "Actions",
      width: "100px",
      align: "right" as const,
      render: (row: any) => (
        <div className="flex items-center justify-end gap-1.5">
          <Link
            href={PREVIEW_LINKS[tab](row.id)}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary btn-icon btn-sm"
            title="Preview"
          >
            <Icon name="eye" size={14} />
          </Link>
          <button
            type="button"
            onClick={() => {
              if (!confirm(`Delete record #${row.id}?`)) return;
              const endpoint =
                tab === "dsa"
                  ? `/api/coding/problems/${row.id}`
                  : tab === "sql"
                  ? `/api/sql/problems/${row.id}`
                  : tab === "dataframe"
                  ? `/api/dataframe/problems/${row.id}`
                  : `/api/technical/questions/${row.id}`;
              adminApi
                .del(endpoint)
                .then(() => {
                  push({ variant: "success", title: "Deleted", description: `Record #${row.id} removed.` });
                  refresh();
                })
                .catch((e) => push({ variant: "error", title: "Delete failed", description: e?.message }));
            }}
            className="btn-ghost btn-icon btn-sm text-rose-600 hover:text-rose-700 hover:bg-rose-50"
            title="Delete"
          >
            <Icon name="trash-2" size={14} />
          </button>
        </div>
      ),
    },
  ];

  if (error && !loading) {
    return (
      <div className="space-y-4">
        <ErrorState message={error} />
        <div className="flex justify-center">
          <button type="button" onClick={refresh} className="btn-secondary btn-sm">
            <Icon name="refresh-cw" size={14} /> Retry
          </button>
        </div>
      </div>
    );
  }

  const tabLabel = TABS.find((t) => t.key === tab)?.label ?? "";

  const filteredVault = vaultData.filter(
    (c) =>
      c.name.toLowerCase().includes(vaultSearch.toLowerCase()) ||
      c.slug.toLowerCase().includes(vaultSearch.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-slide-up">
      {/* 2026 SaaS Header Card */}
      <div className="surface-card px-6 py-5 rounded-2xl border border-slate-200/80 shadow-xs bg-white">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-col justify-center min-w-0">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-indigo-50 border border-indigo-200/60 text-indigo-700 text-[11px] font-semibold w-fit mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
              PREP2PLACE ENTERPRISE REPOSITORY & VAULT
            </div>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white flex items-center justify-center shadow-sm shrink-0">
                <Icon name="library" size={18} />
              </div>
              <div>
                <h1 className="font-display font-bold text-xl tracking-tight text-slate-900 leading-tight">
                  Question Bank & Company Vault
                </h1>
                <p className="text-xs text-slate-500 mt-0.5 leading-snug">
                  Manage coding challenges, database queries, technical MCQs, and company-specific interview problem sets.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {tab !== "vault" ? (
              <>
                <button
                  type="button"
                  onClick={handleDeduplicate}
                  disabled={deduplicating}
                  className="btn-secondary !text-xs !py-2 !px-3 !border-amber-200 !text-amber-800 hover:!bg-amber-50 shadow-xs"
                  title={`Prune and merge duplicate questions in ${tabLabel}`}
                >
                  <Icon name={deduplicating ? "refresh-cw" : "filter"} size={13} className={deduplicating ? "animate-spin" : "text-amber-600"} />
                  {deduplicating ? "Deduplicating..." : "Deduplicate"}
                </button>
                <button
                  type="button"
                  onClick={openSeedModal}
                  className="btn-primary !text-xs !py-2 !px-3.5 shadow-sm !bg-indigo-600 hover:!bg-indigo-700 !text-white flex items-center gap-1.5"
                >
                  <Icon name="upload" size={13} /> Ingest / Seed JSON
                </button>
                <button
                  type="button"
                  onClick={openDeleteModal}
                  className="btn-secondary !text-xs !py-2 !px-3 !border-rose-200 !text-rose-700 hover:!bg-rose-50 disabled:opacity-50 shadow-xs"
                  disabled={selected.size === 0}
                >
                  <Icon name="trash-2" size={13} className="text-rose-600" />
                  Bulk Delete{selected.size > 0 ? ` (${selected.size})` : ""}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setVaultIndexFile(null);
                    setVaultIndexPreview("");
                    setVaultIndexModalOpen(true);
                  }}
                  className="btn-secondary !text-xs !py-2 !px-3"
                >
                  <Icon name="folder" size={13} /> Seed Index (_index.json)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setVaultCompanyFile(null);
                    setVaultCompanyPreview("");
                    setVaultSelectedSlug(vaultData[0]?.slug || "");
                    setVaultSelectedName(vaultData[0]?.name || "");
                    setVaultCompanyModalOpen(true);
                  }}
                  className="btn-secondary !text-xs !py-2 !px-3"
                >
                  <Icon name="upload" size={13} /> Seed by Company
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNewCompanyName("");
                    setNewCompanySlug("");
                    setNewCompanyFile(null);
                    setNewCompanyPreview("");
                    setVaultNewCompanyModalOpen(true);
                  }}
                  className="btn-primary !text-xs !py-2 !px-3.5 !bg-indigo-600 hover:!bg-indigo-700 !text-white"
                >
                  <Icon name="plus" size={13} /> New Company & Seed
                </button>
                <button
                  type="button"
                  onClick={runSyncAllVault}
                  disabled={syncingVault}
                  className="btn-secondary !text-xs !py-2 !px-3"
                  title="Re-sync classpath seed sheets for all companies"
                >
                  <Icon name={syncingVault ? "refresh-cw" : "database"} size={13} className={syncingVault ? "animate-spin" : ""} />
                  {syncingVault ? "Syncing..." : "Sync All Seeds"}
                </button>
              </>
            )}
            <button
              type="button"
              onClick={refresh}
              disabled={loading}
              className="btn-secondary !text-xs !py-2 !px-3 disabled:opacity-50 shadow-xs"
              title="Reload all question data"
            >
              <Icon name="refresh-cw" size={13} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>
        </div>

        {/* Global KPI Stat Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-5 pt-5 border-t border-slate-100">
          <div
            onClick={() => setTab("dsa")}
            className={`cursor-pointer rounded-xl p-3 border transition-all ${
              tab === "dsa"
                ? "border-emerald-400 bg-emerald-50/50 ring-1 ring-emerald-400/30"
                : "border-slate-200/70 bg-slate-50/60 hover:bg-slate-100/60"
            }`}
          >
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-600">DSA Pool</span>
              <Icon name="code" size={14} className="text-emerald-600" />
            </div>
            <div className="text-xl font-bold text-slate-900 tracking-tight">{dsaData.length}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Coding Problems</div>
          </div>

          <div
            onClick={() => setTab("sql")}
            className={`cursor-pointer rounded-xl p-3 border transition-all ${
              tab === "sql"
                ? "border-indigo-400 bg-indigo-50/50 ring-1 ring-indigo-400/30"
                : "border-slate-200/70 bg-slate-50/60 hover:bg-slate-100/60"
            }`}
          >
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-600">SQL Pool</span>
              <Icon name="database" size={14} className="text-indigo-600" />
            </div>
            <div className="text-xl font-bold text-slate-900 tracking-tight">{sqlData.length}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Database Queries</div>
          </div>

          <div
            onClick={() => setTab("dataframe")}
            className={`cursor-pointer rounded-xl p-3 border transition-all ${
              tab === "dataframe"
                ? "border-sky-400 bg-sky-50/50 ring-1 ring-sky-400/30"
                : "border-slate-200/70 bg-slate-50/60 hover:bg-slate-100/60"
            }`}
          >
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-600">DataFrame</span>
              <Icon name="table" size={14} className="text-sky-600" />
            </div>
            <div className="text-xl font-bold text-slate-900 tracking-tight">{dfData.length}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Pandas Challenges</div>
          </div>

          <div
            onClick={() => setTab("mcq")}
            className={`cursor-pointer rounded-xl p-3 border transition-all ${
              tab === "mcq"
                ? "border-purple-400 bg-purple-50/50 ring-1 ring-purple-400/30"
                : "border-slate-200/70 bg-slate-50/60 hover:bg-slate-100/60"
            }`}
          >
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-600">Tech MCQ</span>
              <Icon name="brain" size={14} className="text-purple-600" />
            </div>
            <div className="text-xl font-bold text-slate-900 tracking-tight">{mcqData.length}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Objective Questions</div>
          </div>

          <div
            onClick={() => setTab("vault")}
            className={`cursor-pointer rounded-xl p-3 border transition-all col-span-2 sm:col-span-1 ${
              tab === "vault"
                ? "border-amber-400 bg-amber-50/50 ring-1 ring-amber-400/30"
                : "border-slate-200/70 bg-slate-50/60 hover:bg-slate-100/60"
            }`}
          >
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-600">Company Vault</span>
              <Icon name="shield" size={14} className="text-amber-600" />
            </div>
            <div className="text-xl font-bold text-slate-900 tracking-tight">{vaultData.length}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              {vaultData.reduce((acc, c) => acc + (c.includedInSheet || c.questionCount || 0), 0)} curated questions
            </div>
          </div>
        </div>

        {/* Tab Segment Controls */}
        <div className="mt-5 flex flex-wrap gap-1.5 bg-slate-100/80 p-1 rounded-xl w-fit border border-slate-200/60">
          {TABS.map((t) => {
            const count =
              t.key === "dsa"
                ? dsaData.length
                : t.key === "sql"
                ? sqlData.length
                : t.key === "dataframe"
                ? dfData.length
                : t.key === "mcq"
                ? mcqData.length
                : vaultData.length;
            const isActive = tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                  isActive
                    ? "bg-white text-indigo-700 shadow-sm ring-1 ring-slate-200"
                    : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
                }`}
              >
                <Icon name={t.icon as any} size={14} />
                {t.label}
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ml-1 transition-colors ${
                    isActive
                      ? "bg-indigo-50 text-indigo-700 border border-indigo-200/60"
                      : "bg-slate-200/70 text-slate-600"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {tab !== "vault" ? (
        <div className="surface-card rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-slate-100 bg-slate-50/70">
            <div>
              <h2 className="text-sm font-bold text-slate-900 tracking-tight">
                {tabLabel} Questions
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {selected.size > 0 ? `${selected.size} selected • ` : ""}{filteredRows.length} displayed ({currentRows.length} total in pool)
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs text-slate-600">
                <span className="font-medium text-slate-500">Difficulty:</span>
                <select
                  value={difficultyFilter}
                  onChange={(e) => setDifficultyFilter(e.target.value)}
                  className="select select-sm !py-1 text-xs rounded-lg border-slate-200 bg-white"
                >
                  <option value="ALL">All</option>
                  <option value="EASY">Easy</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HARD">Hard</option>
                </select>
              </div>
            </div>
          </div>

          <div className="p-4 border-b border-slate-100 bg-white flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1 min-w-[240px] max-w-md">
              <div className="relative w-full">
                <Icon name="search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                  placeholder={`Search ${tabLabel} by title, topic, or ID...`}
                  className="input input-sm w-full !pl-8 text-xs rounded-lg"
                />
                {tableSearch && (
                  <button
                    type="button"
                    onClick={() => setTableSearch("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <Icon name="x" size={12} />
                  </button>
                )}
              </div>
            </div>
            <div className="text-xs text-slate-500 font-medium">
              Showing {filteredRows.length} of {currentRows.length} problems
            </div>
          </div>

          {loading ? (
            <div className="p-5">
              <SkeletonGroup variant="table" />
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="p-5">
              <EmptyState
                icon="file-text"
                variant="neutral"
                title={currentRows.length === 0 ? `No ${tabLabel} questions` : "No matching questions"}
                description={currentRows.length === 0 ? "Use the Seed button above to import JSON, or add questions directly." : "Try adjusting your search query or difficulty filter."}
                action={
                  currentRows.length === 0 ? (
                    <button type="button" onClick={openSeedModal} className="btn-primary btn-sm">
                      <Icon name="upload" size={14} /> Seed JSON
                    </button>
                  ) : (
                    <button type="button" onClick={() => { setTableSearch(""); setDifficultyFilter("ALL"); }} className="btn-secondary btn-sm">
                      Reset Filters
                    </button>
                  )
                }
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <DataTable<any>
                columns={columns}
                data={filteredRows}
                rowKey="id"
                emptyTitle="No rows"
                emptyDesc="Nothing here yet."
                emptyIcon="file-text"
              />
            </div>
          )}
        </div>
      ) : (
        /* --- COMPANY VAULT SECTION --- */
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="surface-card p-4 rounded-xl flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-premium-50 text-premium-600 flex items-center justify-center font-bold">
                <Icon name="shield" size={20} />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Companies Tracked</p>
                <p className="text-xl font-bold text-slate-900">{vaultData.length}</p>
              </div>
            </div>
            <div className="surface-card p-4 rounded-xl flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                <Icon name="code" size={20} />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Sheet Questions</p>
                <p className="text-xl font-bold text-slate-900">
                  {vaultData.reduce((acc, c) => acc + (c.includedInSheet || c.questionCount || 0), 0)}
                </p>
              </div>
            </div>
            <div className="surface-card p-4 rounded-xl flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                <Icon name="database" size={20} />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Total Available</p>
                <p className="text-xl font-bold text-slate-900">
                  {vaultData.reduce((acc, c) => acc + (c.totalDistinctAvailable || 0), 0)}
                </p>
              </div>
            </div>
            <div className="surface-card p-4 rounded-xl flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                <Icon name="check-circle" size={20} />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">Capped Sheets</p>
                <p className="text-xl font-bold text-slate-900">
                  {vaultData.filter((c) => c.capped).length}
                </p>
              </div>
            </div>
          </div>

          <FieldGroup
            title="Company Vault Registry"
            description="Companies with curated LeetCode & interview problem sets. Students view these under Company Prep."
            className="!p-0"
            action={
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Icon name="search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={vaultSearch}
                    onChange={(e) => setVaultSearch(e.target.value)}
                    placeholder="Search companies..."
                    className="input-sm !pl-8 text-xs w-48 rounded-lg border-slate-200"
                  />
                </div>
              </div>
            }
          >
            {loading ? (
              <div className="p-5">
                <SkeletonGroup variant="table" />
              </div>
            ) : filteredVault.length === 0 ? (
              <div className="p-5">
                <EmptyState
                  icon="shield"
                  variant="neutral"
                  title="No companies in vault"
                  description="Use the buttons above to seed the vault directory index or create your first company sheet."
                  action={
                    <button
                      type="button"
                      onClick={() => setVaultNewCompanyModalOpen(true)}
                      className="btn-primary btn-sm"
                    >
                      <Icon name="plus" size={14} /> New Company & Seed
                    </button>
                  }
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="table w-full">
                  <thead>
                    <tr>
                      <th className="w-16">#</th>
                      <th>Company</th>
                      <th>Slug</th>
                      <th>Sheet Questions</th>
                      <th>Available</th>
                      <th>Sheet Status</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredVault.map((c, idx) => (
                      <tr key={c.id || c.slug} className="hover:bg-slate-50/70 transition-colors">
                        <td className="font-mono text-xs text-slate-400">{idx + 1}</td>
                        <td>
                          <div className="font-semibold text-slate-900 text-sm flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-white border border-slate-200 shadow-xs flex items-center justify-center p-1 shrink-0 overflow-hidden">
                              <CompanyLogo slug={c.slug} name={c.name} className="w-full h-full object-contain" />
                            </div>
                            <span>{c.name}</span>
                          </div>
                        </td>
                        <td>
                          <span className="chip chip-muted font-mono text-xs">{c.slug}</span>
                        </td>
                        <td>
                          <span className="badge badge-primary font-semibold">
                            {c.includedInSheet ?? c.questionCount ?? 0} questions
                          </span>
                        </td>
                        <td className="text-slate-600 text-sm font-medium">
                          {c.totalDistinctAvailable ?? "—"}
                        </td>
                        <td>
                          {c.capped ? (
                            <span className="badge badge-warning text-[11px]">Capped</span>
                          ) : (
                            <span className="badge badge-success text-[11px]">Active</span>
                          )}
                        </td>
                        <td className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setVaultSelectedSlug(c.slug);
                                setVaultSelectedName(c.name);
                                setVaultCompanyFile(null);
                                setVaultCompanyPreview("");
                                setVaultCompanyModalOpen(true);
                              }}
                              className="btn-secondary !text-xs !py-1 !px-2.5"
                              title="Upload questions JSON for this company"
                            >
                              <Icon name="upload" size={12} /> Seed
                            </button>
                            <Link
                              href={`/coding/companies/${c.slug}`}
                              target="_blank"
                              className="btn-ghost btn-icon btn-sm text-slate-600 hover:text-slate-900"
                              title="Preview in Student Vault"
                            >
                              <Icon name="eye" size={14} />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </FieldGroup>
        </div>
      )}

      {/* --- MODAL 1: Standard Question Bank Seed --- */}
      <Modal
        open={seedModalOpen}
        onClose={() => !seeding && setSeedModalOpen(false)}
        title={`Ingest & Seed ${tabLabel} Questions`}
        description="Bulk import questions from JSON datasets. Validate schemas, inspect test cases, and resolve duplicate records with enterprise conflict strategies."
        size="lg"
        footer={
          <div className="flex flex-wrap items-center justify-between w-full gap-3">
            <button
              type="button"
              onClick={downloadSampleTemplate}
              className="btn-ghost btn-sm text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 flex items-center gap-1.5"
            >
              <Icon name="download" size={14} /> Download {tabLabel} Template
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSeedModalOpen(false)}
                disabled={seeding}
                className="btn-secondary btn-sm"
              >
                {seedSuccessInfo ? "Close" : "Cancel"}
              </button>
              {!seedSuccessInfo && (
                <button
                  type="button"
                  onClick={() => runSeed()}
                  disabled={!seedFile || seeding}
                  className="btn-primary btn-sm !bg-indigo-600 hover:!bg-indigo-700 !text-white flex items-center gap-1.5 shadow-sm"
                >
                  <Icon name={seeding ? "refresh-cw" : "upload"} size={14} className={seeding ? "animate-spin" : ""} />
                  {seeding
                    ? "Ingesting questions..."
                    : seedFileDiagnostics
                    ? `Ingest ${seedFileDiagnostics.count.toLocaleString()} Questions`
                    : "Upload & Seed"}
                </button>
              )}
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          {/* Success Summary Banner */}
          {seedSuccessInfo && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/90 p-4 space-y-3 animate-fade-in">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <Icon name="check-circle" size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-bold text-emerald-950">Ingestion Succeeded!</h4>
                  <p className="text-xs text-emerald-800 mt-0.5">{seedSuccessInfo.message}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-emerald-200/60 text-center">
                <div className="bg-white/80 rounded-lg p-2 border border-emerald-200/50">
                  <div className="text-[10px] uppercase font-bold text-slate-500">New Inserted</div>
                  <div className="text-lg font-bold text-emerald-700">{seedSuccessInfo.inserted.toLocaleString()}</div>
                </div>
                <div className="bg-white/80 rounded-lg p-2 border border-emerald-200/50">
                  <div className="text-[10px] uppercase font-bold text-slate-500">Updated</div>
                  <div className="text-lg font-bold text-indigo-700">{seedSuccessInfo.updated.toLocaleString()}</div>
                </div>
                <div className="bg-white/80 rounded-lg p-2 border border-emerald-200/50">
                  <div className="text-[10px] uppercase font-bold text-slate-500">Skipped</div>
                  <div className="text-lg font-bold text-slate-700">{seedSuccessInfo.skipped.toLocaleString()}</div>
                </div>
                <div className="bg-white/80 rounded-lg p-2 border border-emerald-200/50">
                  <div className="text-[10px] uppercase font-bold text-slate-500">Deduplicated</div>
                  <div className="text-lg font-bold text-amber-700">{seedSuccessInfo.duplicatesRemoved.toLocaleString()}</div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setSeedFile(null);
                    setSeedPreview("");
                    setSeedFileDiagnostics(null);
                    setSeedSuccessInfo(null);
                  }}
                  className="btn-ghost btn-xs text-emerald-800 hover:bg-emerald-100"
                >
                  <Icon name="refresh-cw" size={12} /> Seed Another Dataset
                </button>
              </div>
            </div>
          )}

          {/* In-Modal Error & Fast Recovery Banner */}
          {seedError && !seedSuccessInfo && (
            <div className="rounded-xl border border-rose-200 bg-rose-50/90 p-4 space-y-2.5 animate-fade-in">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                  <Icon name="alert-triangle" size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-bold text-rose-950">Ingestion Conflict / Error</h4>
                  <p className="text-xs text-rose-800 mt-0.5 font-mono break-all">{seedError}</p>
                </div>
              </div>
              <div className="pt-2 border-t border-rose-200/60 flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-semibold text-rose-900">One-Click Conflict Recovery:</span>
                <button
                  type="button"
                  disabled={seeding}
                  onClick={() => runSeed("SKIP")}
                  className="btn-secondary !text-xs !py-1 !px-2.5 !border-rose-300 hover:!bg-white"
                >
                  <Icon name="arrow-right" size={12} /> Retry with Skip Duplicates
                </button>
                <button
                  type="button"
                  disabled={seeding}
                  onClick={() => runSeed("UPDATE")}
                  className="btn-secondary !text-xs !py-1 !px-2.5 !border-rose-300 hover:!bg-white"
                >
                  <Icon name="refresh-cw" size={12} /> Retry with Update Existing
                </button>
                <button
                  type="button"
                  disabled={seeding}
                  onClick={() => runSeed("INSERT_NEW")}
                  className="btn-secondary !text-xs !py-1 !px-2.5 !border-rose-300 hover:!bg-white"
                >
                  <Icon name="plus" size={12} /> Retry with Insert All New
                </button>
              </div>
            </div>
          )}

          {/* Seeding In-Progress Live Bar */}
          {seeding && (
            <div className="rounded-xl border border-indigo-200 bg-indigo-50/90 p-4 space-y-2 text-center animate-pulse">
              <div className="flex items-center justify-center gap-2 text-indigo-900 text-xs font-bold">
                <Icon name="refresh-cw" size={14} className="animate-spin text-indigo-600" />
                Ingesting {seedFileDiagnostics?.count.toLocaleString() ?? ""} problems into database...
              </div>
              <div className="w-full bg-indigo-200/80 rounded-full h-2 overflow-hidden">
                <div className="bg-indigo-600 h-2 rounded-full w-2/3 animate-[pulse_1s_ease-in-out_infinite]" />
              </div>
              <p className="text-[11px] text-indigo-700">
                Verifying constraints, auto-linking test cases, and reconciling database indices. Please do not close this window.
              </p>
            </div>
          )}

          {/* File Picker & Diagnostics Section */}
          {!seedSuccessInfo && (
            <>
              <div className="border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-2xl p-5 bg-slate-50/50 hover:bg-indigo-50/20 transition-all">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={handleSeedFileChange}
                />
                {!seedFile ? (
                  <div className="flex flex-col items-center justify-center text-center gap-2">
                    <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-xs">
                      <Icon name="upload" size={22} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800">Select JSON Seed Dataset</p>
                      <p className="text-xs text-slate-500 mt-0.5 max-w-sm">
                        Supports single objects or arrays of questions with test cases, execution templates, and topics.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="btn-secondary btn-sm mt-2 shadow-xs"
                    >
                      <Icon name="folder" size={13} /> Browse Files
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                          <Icon name="file-code" size={20} />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-slate-900 truncate">{seedFile.name}</div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-2">
                            <span>{(seedFile.size / 1024).toFixed(1)} KB</span>
                            <span>•</span>
                            <span className="font-semibold text-indigo-600">
                              {seedFileDiagnostics ? `${seedFileDiagnostics.count.toLocaleString()} problems found` : "Analyzing JSON..."}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="btn-ghost btn-xs text-slate-600 hover:text-slate-900"
                        >
                          Change
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSeedFile(null);
                            setSeedPreview("");
                            setSeedFileDiagnostics(null);
                            setSeedError(null);
                          }}
                          className="btn-ghost btn-icon btn-xs text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                          aria-label="Remove file"
                        >
                          <Icon name="x" size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Diagnostics Details */}
                    {seedFileDiagnostics && (
                      <div className="bg-white rounded-xl border border-slate-200 p-3 space-y-2 text-xs">
                        <div className="flex items-center justify-between text-slate-600">
                          <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                            <Icon name="check" size={13} className="text-emerald-600" />
                            Payload Diagnostics:
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            seedFileDiagnostics.hasTestCases
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-slate-100 text-slate-600"
                          }`}>
                            {seedFileDiagnostics.hasTestCases ? "Test Cases: Detected" : "Standard Metadata"}
                          </span>
                        </div>
                        {seedFileDiagnostics.sampleTitles.length > 0 && (
                          <div>
                            <div className="text-[10px] text-slate-400 mb-1">Sample Questions in File:</div>
                            <div className="flex flex-wrap gap-1">
                              {seedFileDiagnostics.sampleTitles.map((t, idx) => (
                                <span key={idx} className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px] truncate max-w-xs">
                                  {t}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Deduplication & Collision Strategy Cards */}
              <div className="rounded-2xl border border-slate-200/90 bg-slate-50/70 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <Icon name="filter" size={13} className="text-indigo-600" />
                    Duplicate Handling Strategy
                  </label>
                  <span className="text-[11px] text-slate-500">Auto-resolves slug & title conflicts</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setDuplicateStrategy("UPDATE")}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      duplicateStrategy === "UPDATE"
                        ? "border-indigo-600 bg-white text-indigo-950 shadow-xs ring-2 ring-indigo-500/20"
                        : "border-slate-200 bg-white/70 hover:bg-white text-slate-700"
                    }`}
                  >
                    <div className="text-xs font-bold flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${duplicateStrategy === "UPDATE" ? "bg-indigo-600" : "bg-slate-300"}`} />
                        Update Existing
                      </span>
                      <span className="text-[9px] font-bold uppercase px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700">Recommended</span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1.5 leading-snug">
                      Updates statements, test cases, and templates for existing questions.
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDuplicateStrategy("SKIP")}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      duplicateStrategy === "SKIP"
                        ? "border-indigo-600 bg-white text-indigo-950 shadow-xs ring-2 ring-indigo-500/20"
                        : "border-slate-200 bg-white/70 hover:bg-white text-slate-700"
                    }`}
                  >
                    <div className="text-xs font-bold flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${duplicateStrategy === "SKIP" ? "bg-indigo-600" : "bg-slate-300"}`} />
                        Skip Duplicates
                      </span>
                      <span className="text-[9px] font-bold uppercase px-1.5 py-0.2 rounded bg-slate-100 text-slate-600">Fastest</span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1.5 leading-snug">
                      Leaves existing database records untouched; only inserts new questions.
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDuplicateStrategy("INSERT_NEW")}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      duplicateStrategy === "INSERT_NEW"
                        ? "border-indigo-600 bg-white text-indigo-950 shadow-xs ring-2 ring-indigo-500/20"
                        : "border-slate-200 bg-white/70 hover:bg-white text-slate-700"
                    }`}
                  >
                    <div className="text-xs font-bold flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${duplicateStrategy === "INSERT_NEW" ? "bg-indigo-600" : "bg-slate-300"}`} />
                        Insert All New
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1.5 leading-snug">
                      Forces new entries for all items, auto-generating unique slugs (-1, -2).
                    </div>
                  </button>
                </div>

                <div className="pt-1 flex items-center gap-2 text-xs text-slate-600">
                  <input
                    type="checkbox"
                    id="cleanupAfterSeed"
                    checked={cleanupAfterSeed}
                    onChange={(e) => setCleanupAfterSeed(e.target.checked)}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <label htmlFor="cleanupAfterSeed" className="cursor-pointer select-none text-[11px]">
                    Prune and merge redundant duplicate records post-ingestion (safe soft-archiving).
                  </label>
                </div>
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* --- MODAL 2: Seed Company Vault Index (_index.json) --- */}
      <Modal
        open={vaultIndexModalOpen}
        onClose={() => !seedingIndex && setVaultIndexModalOpen(false)}
        title="Seed Company Vault Index (_index.json)"
        description="Upload the _index.json file containing company metadata, sheet limits, and distinct availability counts."
        size="md"
        footer={
          <>
            <button
              type="button"
              onClick={() => setVaultIndexModalOpen(false)}
              disabled={seedingIndex}
              className="btn-secondary btn-sm"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={runVaultIndexSeed}
              disabled={!vaultIndexFile || seedingIndex}
              className="btn-primary btn-sm"
            >
              <Icon name={seedingIndex ? "refresh-cw" : "upload"} size={14} className={seedingIndex ? "animate-spin" : ""} />
              {seedingIndex ? "Importing..." : "Seed Index"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="border-2 border-dashed border-slate-200 rounded-xl p-5 hover:border-premium-300 transition-colors">
            <input
              ref={vaultIndexInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (!f) return;
                setVaultIndexFile(f);
                f.text().then((txt) => {
                  try {
                    const parsed = JSON.parse(txt);
                    const count = Array.isArray(parsed) ? parsed.length : 0;
                    setVaultIndexPreview(`Found ${count} company entries in ${f.name}`);
                  } catch {
                    setVaultIndexPreview(`Warning: ${f.name} is not valid JSON`);
                  }
                });
              }}
            />
            <div className="flex flex-col items-center justify-center text-center gap-2">
              <div className="w-12 h-12 rounded-xl bg-premium-50 text-premium-600 flex items-center justify-center">
                <Icon name="shield" size={22} />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">_index.json File</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Array of objects with company name/slug, totalDistinctAvailable, includedInSheet, etc.
                </p>
              </div>
              <button
                type="button"
                onClick={() => vaultIndexInputRef.current?.click()}
                className="btn-secondary btn-sm mt-2"
              >
                <Icon name="folder" size={12} /> Choose _index.json
              </button>
            </div>
          </div>
          {vaultIndexFile && (
            <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-700 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Icon name="file-code" size={14} className="text-slate-400 shrink-0" />
                <span className="font-medium truncate">{vaultIndexFile.name}</span>
                <span className="text-slate-400 shrink-0">
                  {(vaultIndexFile.size / 1024).toFixed(1)} KB
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setVaultIndexFile(null);
                  setVaultIndexPreview("");
                }}
                className="btn-ghost btn-icon btn-xs text-slate-400 hover:text-slate-700"
              >
                <Icon name="x" size={12} />
              </button>
            </div>
          )}
          {vaultIndexPreview && (
            <p className="text-xs text-slate-600 bg-premium-50/50 border border-premium-100 rounded px-3 py-2">
              {vaultIndexPreview}
            </p>
          )}
        </div>
      </Modal>

      {/* --- MODAL 3: Company-Wise Seed (Seed specific company) --- */}
      <Modal
        open={vaultCompanyModalOpen}
        onClose={() => !seedingCompany && setVaultCompanyModalOpen(false)}
        title="Seed Company-Wise Questions"
        description="Select an existing company and upload its curated question list JSON (e.g. google.json)."
        size="md"
        footer={
          <>
            <button
              type="button"
              onClick={() => setVaultCompanyModalOpen(false)}
              disabled={seedingCompany}
              className="btn-secondary btn-sm"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={runVaultCompanySeed}
              disabled={!vaultCompanyFile || !vaultSelectedSlug || seedingCompany}
              className="btn-primary btn-sm"
            >
              <Icon name={seedingCompany ? "refresh-cw" : "upload"} size={14} className={seedingCompany ? "animate-spin" : ""} />
              {seedingCompany ? "Importing..." : "Seed Company"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Select Target Company
            </label>
            <select
              value={vaultSelectedSlug}
              onChange={(e) => {
                setVaultSelectedSlug(e.target.value);
                const found = vaultData.find((c) => c.slug === e.target.value);
                if (found) setVaultSelectedName(found.name);
              }}
              className="w-full text-sm rounded-lg border-slate-200 bg-white px-3 py-2 focus:ring-2 focus:ring-premium-500 focus:outline-none"
            >
              <option value="">-- Choose a company --</option>
              {vaultData.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name} ({c.slug}) — {c.includedInSheet ?? c.questionCount ?? 0} questions
                </option>
              ))}
            </select>
          </div>

          <div className="border-2 border-dashed border-slate-200 rounded-xl p-5 hover:border-premium-300 transition-colors">
            <input
              ref={vaultCompanyInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (!f) return;
                setVaultCompanyFile(f);
                f.text().then((txt) => {
                  try {
                    const parsed = JSON.parse(txt);
                    const count = Array.isArray(parsed)
                      ? parsed.length
                      : parsed.questions?.length ?? 0;
                    setVaultCompanyPreview(`Loaded ${count} question${count === 1 ? "" : "s"} from ${f.name}`);
                  } catch {
                    setVaultCompanyPreview(`Warning: ${f.name} is not valid JSON`);
                  }
                });
              }}
            />
            <div className="flex flex-col items-center justify-center text-center gap-2">
              <div className="w-12 h-12 rounded-xl bg-premium-50 text-premium-600 flex items-center justify-center">
                <Icon name="upload" size={22} />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">Company Questions JSON</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Array of question objects (title, difficulty, companyRank, frequencyScore, topics).
                </p>
              </div>
              <button
                type="button"
                onClick={() => vaultCompanyInputRef.current?.click()}
                className="btn-secondary btn-sm mt-2"
              >
                <Icon name="folder" size={12} /> Choose JSON File
              </button>
            </div>
          </div>

          {vaultCompanyFile && (
            <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-700 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Icon name="file-code" size={14} className="text-slate-400 shrink-0" />
                <span className="font-medium truncate">{vaultCompanyFile.name}</span>
                <span className="text-slate-400 shrink-0">
                  {(vaultCompanyFile.size / 1024).toFixed(1)} KB
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setVaultCompanyFile(null);
                  setVaultCompanyPreview("");
                }}
                className="btn-ghost btn-icon btn-xs text-slate-400 hover:text-slate-700"
              >
                <Icon name="x" size={12} />
              </button>
            </div>
          )}
          {vaultCompanyPreview && (
            <p className="text-xs text-slate-600 bg-premium-50/50 border border-premium-100 rounded px-3 py-2">
              {vaultCompanyPreview}
            </p>
          )}
        </div>
      </Modal>

      {/* --- MODAL 4: Create New Company First, Then Seed --- */}
      <Modal
        open={vaultNewCompanyModalOpen}
        onClose={() => !creatingAndSeeding && setVaultNewCompanyModalOpen(false)}
        title="Create New Company & Seed Questions"
        description="Register a new company in the vault and optionally attach its questions JSON."
        size="md"
        footer={
          <>
            <button
              type="button"
              onClick={() => setVaultNewCompanyModalOpen(false)}
              disabled={creatingAndSeeding}
              className="btn-secondary btn-sm"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={runCreateAndSeedCompany}
              disabled={!newCompanyName.trim() || creatingAndSeeding}
              className="btn-primary btn-sm"
            >
              <Icon name={creatingAndSeeding ? "refresh-cw" : "plus"} size={14} className={creatingAndSeeding ? "animate-spin" : ""} />
              {creatingAndSeeding ? "Creating & Seeding..." : "Create & Seed"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Company Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={newCompanyName}
              onChange={(e) => {
                setNewCompanyName(e.target.value);
                if (!newCompanySlug || newCompanySlug === newCompanyName.toLowerCase().replace(/[^a-z0-9-]/g, "-")) {
                  setNewCompanySlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"));
                }
              }}
              placeholder="e.g. Atlassian, Stripe, Uber"
              className="w-full text-sm rounded-lg border-slate-200 bg-white px-3 py-2 focus:ring-2 focus:ring-premium-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              URL Slug <span className="text-slate-400 font-normal">(auto-generated)</span>
            </label>
            <input
              type="text"
              value={newCompanySlug}
              onChange={(e) => setNewCompanySlug(e.target.value)}
              placeholder="e.g. atlassian"
              className="w-full text-sm font-mono rounded-lg border-slate-200 bg-white px-3 py-2 focus:ring-2 focus:ring-premium-500 focus:outline-none"
            />
          </div>

          <div className="pt-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Attach Questions JSON <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 hover:border-premium-300 transition-colors">
              <input
                ref={newCompanyInputRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (!f) return;
                  setNewCompanyFile(f);
                  f.text().then((txt) => {
                    try {
                      const parsed = JSON.parse(txt);
                      const count = Array.isArray(parsed)
                        ? parsed.length
                        : parsed.questions?.length ?? 0;
                      setNewCompanyPreview(`Found ${count} question${count === 1 ? "" : "s"} in ${f.name}`);
                    } catch {
                      setNewCompanyPreview(`Warning: ${f.name} is not valid JSON`);
                    }
                  });
                }}
              />
              <div className="flex flex-col items-center justify-center text-center gap-1.5">
                <p className="text-xs text-slate-600">
                  {newCompanyFile ? newCompanyFile.name : "Choose questions JSON to seed immediately with this company"}
                </p>
                <button
                  type="button"
                  onClick={() => newCompanyInputRef.current?.click()}
                  className="btn-secondary !text-xs !py-1 mt-1"
                >
                  <Icon name="folder" size={12} /> {newCompanyFile ? "Change File" : "Browse File"}
                </button>
              </div>
            </div>
            {newCompanyPreview && (
              <p className="text-xs text-slate-600 bg-premium-50/50 border border-premium-100 rounded px-3 py-1.5 mt-2">
                {newCompanyPreview}
              </p>
            )}
          </div>
        </div>
      </Modal>

      {/* --- MODAL 5: Bulk Delete Confirmation --- */}
      <Modal
        open={deleteModalOpen}
        onClose={() => !deleting && setDeleteModalOpen(false)}
        title={`Bulk Delete ${selected.size} ${tabLabel} Record${selected.size === 1 ? "" : "s"}`}
        description="This action cannot be undone. The selected rows will be permanently removed from the question bank."
        size="sm"
        footer={
          <>
            <button
              type="button"
              onClick={() => setDeleteModalOpen(false)}
              disabled={deleting}
              className="btn-secondary btn-sm"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={runBulkDelete}
              disabled={deleting}
              className="!bg-rose-600 hover:!bg-rose-700 !text-white btn-primary btn-sm"
            >
              <Icon name={deleting ? "refresh-cw" : "trash-2"} size={14} className={deleting ? "animate-spin" : ""} />
              {deleting ? "Deleting..." : `Delete ${selected.size}`}
            </button>
          </>
        }
      >
        <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 flex items-start gap-3">
          <Icon name="alert-triangle" size={18} className="text-rose-600 shrink-0 mt-0.5" />
          <div className="text-xs text-rose-800 space-y-1">
            <p className="font-semibold">Are you sure?</p>
            <p>
              You are about to permanently delete <strong>{selected.size}</strong> row
              {selected.size === 1 ? "" : "s"}. This will remove the questions from all
              assessments and student views.
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
}
