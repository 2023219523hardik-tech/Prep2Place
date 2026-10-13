"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api, ApiError, redirectToLogin } from "@/lib/api";
import Icon from "@/components/ui/Icon";
import { SkeletonGroup } from "@/components/ui/Skeleton";
import EmptyState from "@/components/ui/EmptyState";
import ErrorState from "@/components/ErrorState";

type Mode = "DSA" | "SQL" | "DATAFRAME";
type StatusFilter = "ALL" | "SOLVED" | "ATTEMPTED" | "TODO";

interface ProblemBase {
  id: number;
  title: string;
  difficulty: string;
  category?: string;
  executionMode?: string;
}

interface DSAProblem extends ProblemBase {
  topic: string;
  statement?: string;
  starterQuery?: string;
  schemaDdl?: string;
}

interface SqlProblem extends ProblemBase {
  problemStatement?: string;
  topics?: string[];
  subtopics?: string[];
  sourceUrl?: string;
  starterQuery?: string;
  explanation?: string;
  executionConfig?: string;
}

interface DataFrameProblem extends ProblemBase {
  problemStatement?: string;
  topics?: string[];
  subtopics?: string[];
  sourceUrl?: string;
  starterCode?: string;
  requirements?: string;
  datasetRef?: string;
  expectedOutputFormat?: string;
}

interface SubmissionHistory {
  submissionId: number;
  problemId: number;
  problemTitle: string;
  verdict: string;
  score: number;
  submittedAt: string;
}

interface PagedSql {
  content: SqlProblem[];
  totalElements: number;
  totalPages: number;
  page: number;
  size: number;
}

interface PagedDf {
  content: DataFrameProblem[];
  totalElements: number;
  totalPages: number;
  page: number;
  size: number;
}

type SolveStatus = "solved" | "attempted" | "unattempted";

const DIFF_COLOR: Record<string, { bg: string; text: string; border: string }> = {
  EASY: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  MEDIUM: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  HARD: { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200" },
};

const TOPIC_ORDER = [
  "All",
  "Arrays",
  "Dynamic Programming",
  "Binary Search",
  "Trees",
  "Graphs",
  "Strings",
  "LinkedList",
  "Heaps",
  "Backtracking",
  "Stack",
  "Two Pointers",
  "Matrix",
  "Greedy",
  "Recursion",
  "Trie",
  "Sliding Window",
  "Prefix Sum",
];

const MODES: { mode: Mode; label: string; desc: string; icon: "code" | "database" | "table" }[] = [
  { mode: "DSA", label: "DSA Coding", desc: "Core algorithms, data structures & complexity", icon: "code" },
  { mode: "SQL", label: "SQL Practice", desc: "Relational queries, aggregations & joins", icon: "database" },
  { mode: "DATAFRAME", label: "DataFrame", desc: "Pandas operations & tabular transformations", icon: "table" },
];

export default function CodingListPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4 animate-slide-up">
          <div className="surface-card h-20 px-5 flex items-center justify-between rounded-2xl border border-slate-200">
            <div className="space-y-2">
              <div className="h-5 w-48 bg-slate-200/70 rounded animate-pulse" />
              <div className="h-3 w-80 bg-slate-200/50 rounded animate-pulse" />
            </div>
            <div className="flex gap-2" />
          </div>
          <SkeletonGroup variant="list" />
        </div>
      }
    >
      <CodingListPageContent />
    </Suspense>
  );
}

function CodingListPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [mode, setMode] = useState<Mode>("DSA");
  const [dsaProblems, setDsaProblems] = useState<DSAProblem[]>([]);
  const [sqlPage, setSqlPage] = useState<PagedSql | null>(null);
  const [dfPage, setDfPage] = useState<PagedDf | null>(null);
  const [history, setHistory] = useState<SubmissionHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [topic, setTopic] = useState("All");
  const [difficulty, setDifficulty] = useState("All");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [query, setQuery] = useState("");

  useEffect(() => {
    const q = searchParams.get("q");
    const topicParam = searchParams.get("topic");
    const modeParam = searchParams.get("mode");
    if (q) setQuery(q);
    if (topicParam) setTopic(topicParam);
    if (modeParam === "SQL" || modeParam === "DATAFRAME" || modeParam === "DSA") setMode(modeParam);
  }, [searchParams]);

  useEffect(() => {
    setLoading(true);
    setError("");

    const tasks: Promise<any>[] = [
      api.get<DSAProblem[]>("/api/coding/problems").catch((e) => {
        if (e instanceof ApiError && (e.status === 401 || e.message?.toLowerCase().includes("authentication"))) {
          redirectToLogin("/coding");
        }
        return [];
      }),
      api.get<SubmissionHistory[]>("/api/coding/history").catch(() => []),
    ];

    if (mode === "SQL") {
      tasks.push(
        api.get<PagedSql>("/api/coding/sql?page=0&size=200").catch((e) => {
          if (e instanceof ApiError && (e.status === 401 || e.message?.toLowerCase().includes("authentication"))) {
            redirectToLogin("/coding?mode=SQL");
          }
          return null;
        })
      );
    }

    if (mode === "DATAFRAME") {
      tasks.push(
        api.get<PagedDf>("/api/coding/dataframe?page=0&size=200").catch((e) => {
          if (e instanceof ApiError && (e.status === 401 || e.message?.toLowerCase().includes("authentication"))) {
            redirectToLogin("/coding?mode=DATAFRAME");
          }
          return null;
        })
      );
    }

    Promise.all(tasks)
      .then(([dsaRes, historyRes, modeRes]) => {
        // STRICT CLEAN FILTERING FOR DSA:
        // Absolutely drop any SQL or DataFrame problem and deduplicate by normalized title
        const cleanDsa: DSAProblem[] = [];
        const seenDsa = new Set<string>();

        for (const p of (Array.isArray(dsaRes) ? dsaRes : []) as any[]) {
          const cat = (p.category || "").toUpperCase().trim();
          const modeStr = (p.executionMode || "").toUpperCase().trim();
          const hasStarterQuery = Boolean(p.starterQuery && p.starterQuery.trim().length > 0);
          const hasSchemaDdl = Boolean(p.schemaDdl && p.schemaDdl.trim().length > 0);

          // Strictly skip non-DSA problems
          if (
            cat === "SQL" ||
            cat === "DATAFRAME" ||
            modeStr === "SQL" ||
            modeStr === "DATAFRAME" ||
            hasStarterQuery ||
            hasSchemaDdl
          ) {
            continue;
          }

          const titleKey = (p.title || "").trim().toLowerCase();
          if (titleKey && !seenDsa.has(titleKey)) {
            seenDsa.add(titleKey);
            cleanDsa.push(p);
          } else if (!titleKey) {
            cleanDsa.push(p);
          }
        }

        setDsaProblems(cleanDsa);
        setHistory(Array.isArray(historyRes) ? historyRes : []);
        if (mode === "SQL") {
          setSqlPage(modeRes ?? { content: [], totalElements: 0, totalPages: 0, page: 0, size: 200 });
        }
        if (mode === "DATAFRAME") {
          setDfPage(modeRes ?? { content: [], totalElements: 0, totalPages: 0, page: 0, size: 200 });
        }
      })
      .catch((e) => {
        if (e instanceof ApiError && (e.status === 401 || e.message?.toLowerCase().includes("authentication"))) {
          redirectToLogin("/coding");
        } else {
          setError(e instanceof ApiError ? e.message : "Failed to load coding catalogue");
        }
      })
      .finally(() => setLoading(false));
  }, [mode]);

  const statusByProblemId = useMemo(() => {
    const map = new Map<number, SolveStatus>();
    for (const item of history) {
      const current = map.get(item.problemId);
      if (item.verdict === "PASSED") {
        map.set(item.problemId, "solved");
      } else if (current !== "solved") {
        map.set(item.problemId, "attempted");
      }
    }
    return map;
  }, [history]);

  const allProblems = useMemo<ProblemBase[]>(() => {
    if (mode === "DSA") return dsaProblems;
    if (mode === "SQL") return sqlPage?.content ?? [];
    return dfPage?.content ?? [];
  }, [mode, dsaProblems, sqlPage, dfPage]);

  const solvedCount = useMemo(
    () => allProblems.filter((p) => statusByProblemId.get(p.id) === "solved").length,
    [allProblems, statusByProblemId]
  );

  const attemptedCount = useMemo(
    () => allProblems.filter((p) => statusByProblemId.get(p.id) === "attempted").length,
    [allProblems, statusByProblemId]
  );

  const stats = useMemo(
    () => ({
      total: allProblems.length,
      solved: solvedCount,
      easy: allProblems.filter((p) => p.difficulty === "EASY").length,
      easySolved: allProblems.filter((p) => p.difficulty === "EASY" && statusByProblemId.get(p.id) === "solved").length,
      medium: allProblems.filter((p) => p.difficulty === "MEDIUM").length,
      mediumSolved: allProblems.filter((p) => p.difficulty === "MEDIUM" && statusByProblemId.get(p.id) === "solved").length,
      hard: allProblems.filter((p) => p.difficulty === "HARD").length,
      hardSolved: allProblems.filter((p) => p.difficulty === "HARD" && statusByProblemId.get(p.id) === "solved").length,
    }),
    [allProblems, solvedCount, statusByProblemId]
  );

  const topics = useMemo(() => {
    if (mode === "DSA") {
      const available = Array.from(new Set(dsaProblems.map((p) => p.topic).filter(Boolean)));
      const ordered = TOPIC_ORDER.filter((item) => item === "All" || available.includes(item));
      const rest = available.filter((item) => !ordered.includes(item)).sort();
      return [...ordered, ...rest];
    }
    if (mode === "SQL") {
      const s = sqlPage?.content ?? [];
      const set = new Set<string>();
      s.forEach((p) => (p.topics || []).forEach((t) => set.add(t)));
      return ["All", ...Array.from(set).sort()];
    }
    const d = dfPage?.content ?? [];
    const set = new Set<string>();
    d.forEach((p) => (p.topics || []).forEach((t) => set.add(t)));
    return ["All", ...Array.from(set).sort()];
  }, [mode, dsaProblems, sqlPage, dfPage]);

  // Topic count helper
  const countForTopic = (t: string) => {
    if (t === "All") return allProblems.length;
    if (mode === "DSA") return dsaProblems.filter((p) => p.topic === t).length;
    if (mode === "SQL") return (sqlPage?.content ?? []).filter((p) => (p.topics || []).includes(t)).length;
    return (dfPage?.content ?? []).filter((p) => (p.topics || []).includes(t)).length;
  };

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return allProblems.filter((problem) => {
      const matchesDifficulty = difficulty === "All" || problem.difficulty === difficulty;
      const matchesQuery = !normalizedQuery || problem.title.toLowerCase().includes(normalizedQuery);

      const status = statusByProblemId.get(problem.id) ?? "unattempted";
      let matchesStatus = true;
      if (statusFilter === "SOLVED") matchesStatus = status === "solved";
      else if (statusFilter === "ATTEMPTED") matchesStatus = status === "attempted";
      else if (statusFilter === "TODO") matchesStatus = status === "unattempted";

      let matchesTopic = topic === "All";
      if (!matchesTopic && mode === "DSA") {
        const p = problem as DSAProblem;
        matchesTopic = p.topic === topic;
      } else if (!matchesTopic && mode === "SQL") {
        const p = problem as SqlProblem;
        matchesTopic = (p.topics || []).includes(topic);
      } else if (!matchesTopic && mode === "DATAFRAME") {
        const p = problem as DataFrameProblem;
        matchesTopic = (p.topics || []).includes(topic);
      }
      return matchesTopic && matchesDifficulty && matchesStatus && matchesQuery;
    });
  }, [difficulty, allProblems, query, topic, mode, statusFilter, statusByProblemId]);

  const hasFilters = query !== "" || topic !== "All" || difficulty !== "All" || statusFilter !== "ALL";

  const clearFilters = () => {
    setQuery("");
    setTopic("All");
    setDifficulty("All");
    setStatusFilter("ALL");
    router.replace(`/coding${mode !== "DSA" ? `?mode=${mode}` : ""}`);
  };

  function hrefFor(problem: ProblemBase) {
    if (mode === "SQL") return `/coding/sql/${problem.id}`;
    if (mode === "DATAFRAME") return `/coding/dataframe/${problem.id}`;
    return `/coding/${problem.id}`;
  }

  function topicText(problem: ProblemBase): string {
    if (mode === "DSA") return (problem as DSAProblem).topic || "General";
    if (mode === "SQL") return (problem as SqlProblem).topics?.[0] || "SQL Query";
    return (problem as DataFrameProblem).topics?.[0] || "DataFrame";
  }

  // Pick random problem (LeetCode style)
  const handlePickRandom = () => {
    const pool = filtered.length > 0 ? filtered : allProblems;
    if (pool.length === 0) return;
    // Prefer unattempted problems
    const unattempted = pool.filter((p) => statusByProblemId.get(p.id) !== "solved");
    const candidateList = unattempted.length > 0 ? unattempted : pool;
    const randomItem = candidateList[Math.floor(Math.random() * candidateList.length)];
    if (randomItem) {
      router.push(hrefFor(randomItem));
    }
  };

  const modeMeta = MODES.find((m) => m.mode === mode)!;
  const percentSolved = stats.total > 0 ? Math.round((stats.solved / stats.total) * 100) : 0;

  if (loading) {
    return (
      <div className="space-y-4 animate-slide-up">
        <div className="surface-card h-24 px-6 flex items-center justify-between rounded-2xl border border-slate-200">
          <div className="space-y-2">
            <div className="h-6 w-52 bg-slate-200/70 rounded animate-pulse" />
            <div className="h-3 w-80 bg-slate-200/50 rounded animate-pulse" />
          </div>
          <div className="h-9 w-32 bg-slate-200/60 rounded-xl animate-pulse" />
        </div>
        <SkeletonGroup variant="list" />
      </div>
    );
  }

  if (error) {
    return <ErrorState message={error} onRetry={() => window.location.reload()} />;
  }

  return (
    <div className="space-y-5 animate-slide-up pb-12">
      {/* HEADER & SOLVED PROGRESS BAR */}
      <header className="surface-card p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-xs">
                <Icon name={modeMeta.icon} size={18} strokeWidth={2.2} />
              </div>
              <h1 className="font-display font-bold text-xl sm:text-2xl tracking-tight text-slate-900">
                {modeMeta.label}
              </h1>
              <span className="badge bg-indigo-50 text-indigo-700 border-indigo-200 font-semibold text-[11px]">
                {allProblems.length} Problems
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-xl">
              {modeMeta.desc}
            </p>
          </div>

          {/* PROGRESS METRICS & PICK RANDOM */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="bg-slate-50/90 border border-slate-200/70 rounded-xl p-3 flex items-center gap-4">
              <div className="text-center min-w-[70px]">
                <div className="text-base font-bold text-slate-900 leading-none">
                  {stats.solved}
                  <span className="text-xs font-normal text-slate-500">/{stats.total}</span>
                </div>
                <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mt-1">
                  Solved ({percentSolved}%)
                </div>
              </div>

              <div className="h-8 w-px bg-slate-200" />

              <div className="flex items-center gap-2">
                <div className="text-center px-1.5">
                  <div className="text-xs font-bold text-emerald-700 leading-none">
                    {stats.easySolved}
                    <span className="text-[10px] font-normal text-slate-400">/{stats.easy}</span>
                  </div>
                  <div className="text-[9px] font-semibold text-emerald-600 uppercase mt-0.5">Easy</div>
                </div>
                <div className="text-center px-1.5">
                  <div className="text-xs font-bold text-amber-700 leading-none">
                    {stats.mediumSolved}
                    <span className="text-[10px] font-normal text-slate-400">/{stats.medium}</span>
                  </div>
                  <div className="text-[9px] font-semibold text-amber-600 uppercase mt-0.5">Med</div>
                </div>
                <div className="text-center px-1.5">
                  <div className="text-xs font-bold text-rose-700 leading-none">
                    {stats.hardSolved}
                    <span className="text-[10px] font-normal text-slate-400">/{stats.hard}</span>
                  </div>
                  <div className="text-[9px] font-semibold text-rose-600 uppercase mt-0.5">Hard</div>
                </div>
              </div>
            </div>

            <button
              onClick={handlePickRandom}
              title="Pick a random problem to solve"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 text-xs font-bold shadow-sm transition active:scale-[0.98]"
            >
              <Icon name="sparkles" size={14} strokeWidth={2} />
              <span>Pick Random</span>
            </button>
          </div>
        </div>

        {/* PROGRESS BAR */}
        <div className="mt-4 pt-3 border-t border-slate-100">
          <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1.5 font-medium">
            <span>Overall Completion</span>
            <span className="font-semibold text-slate-700">{percentSolved}% Completed</span>
          </div>
          <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden flex">
            <div
              className="bg-emerald-500 h-full transition-all duration-500"
              style={{ width: `${stats.total > 0 ? (stats.easySolved / stats.total) * 100 : 0}%` }}
              title={`Easy: ${stats.easySolved}`}
            />
            <div
              className="bg-amber-500 h-full transition-all duration-500"
              style={{ width: `${stats.total > 0 ? (stats.mediumSolved / stats.total) * 100 : 0}%` }}
              title={`Medium: ${stats.mediumSolved}`}
            />
            <div
              className="bg-rose-500 h-full transition-all duration-500"
              style={{ width: `${stats.total > 0 ? (stats.hardSolved / stats.total) * 100 : 0}%` }}
              title={`Hard: ${stats.hardSolved}`}
            />
          </div>
        </div>
      </header>

      {/* THREE-WAY PRACTICE MODE CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {MODES.map((m) => {
          const isSelected = mode === m.mode;
          const count =
            m.mode === "DSA"
              ? dsaProblems.length
              : m.mode === "SQL"
              ? sqlPage?.totalElements ?? 0
              : dfPage?.totalElements ?? 0;

          return (
            <button
              key={m.mode}
              onClick={() => {
                setMode(m.mode);
                setTopic("All");
                setDifficulty("All");
                setStatusFilter("ALL");
                router.replace(`/coding${m.mode !== "DSA" ? `?mode=${m.mode}` : ""}`);
              }}
              className={`group flex items-start gap-3.5 rounded-2xl border p-4 text-left transition-all ${
                isSelected
                  ? "border-indigo-500 bg-indigo-50/50 ring-2 ring-indigo-500/20 shadow-xs"
                  : "border-slate-200/80 bg-white hover:border-indigo-200 hover:bg-slate-50/60 shadow-2xs"
              }`}
            >
              <div
                className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center transition-colors ${
                  isSelected
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 group-hover:bg-indigo-50 group-hover:text-indigo-600"
                }`}
              >
                <Icon name={m.icon} size={20} strokeWidth={2} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <div className={`text-sm font-bold ${isSelected ? "text-indigo-950" : "text-slate-800"}`}>
                    {m.label}
                  </div>
                  <span
                    className={`text-[10px] font-bold rounded-full px-2 py-0.5 border ${
                      isSelected
                        ? "bg-indigo-100 text-indigo-700 border-indigo-200"
                        : "bg-slate-100 text-slate-600 border-slate-200"
                    }`}
                  >
                    {count} Qs
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 mt-1 line-clamp-1">{m.desc}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* COMPANY VAULT SHOWCASE BANNER (DSA MODE) */}
      {mode === "DSA" && (
        <Link
          href="/coding/companies"
          className="group surface-card px-5 py-4 flex items-center justify-between gap-4 rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50/80 via-white to-purple-50/60 hover:border-indigo-300 hover:shadow-sm transition-all"
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-10 h-10 shrink-0 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <Icon name="database" size={18} strokeWidth={2.2} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-sm text-slate-900 leading-tight">Company Problem Vault</h2>
                <span className="rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white shadow-xs">
                  Premium Sheets
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5 truncate">
                Curated interview questions asked at Google, Amazon, Microsoft, Meta &amp; 190+ companies — organized by company &amp; frequency
              </p>
            </div>
          </div>
          <div className="shrink-0 flex items-center gap-1.5 text-xs font-bold text-indigo-600 group-hover:translate-x-1 transition-transform">
            <span>Browse Sheets</span>
            <Icon name="chevron-right" size={16} strokeWidth={2.2} />
          </div>
        </Link>
      )}

      {/* SEARCH AND FILTERS TOOLBAR */}
      <div className="surface-card p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-3.5">
        <div className="grid gap-3 md:grid-cols-[1fr_auto_auto_auto] items-center">
          {/* SEARCH INPUT */}
          <div className="relative">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${modeMeta.label} problems by title or topic...`}
              className="input !pl-10 !pr-10 !h-10 text-xs sm:text-sm !rounded-xl"
            />
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
              <Icon name="search" size={16} strokeWidth={2} />
            </span>
            {query && (
              <button
                onClick={() => setQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <Icon name="x" size={14} />
              </button>
            )}
          </div>

          {/* TOPIC SELECT */}
          <div className="min-w-[160px]">
            <select
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="input !h-10 text-xs sm:text-sm !rounded-xl font-medium"
            >
              {topics.map((t) => (
                <option key={t} value={t}>
                  {t} ({countForTopic(t)})
                </option>
              ))}
            </select>
          </div>

          {/* DIFFICULTY SELECT */}
          <div className="min-w-[130px]">
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              className="input !h-10 text-xs sm:text-sm !rounded-xl font-medium"
            >
              <option value="All">All Difficulties</option>
              <option value="EASY">Easy</option>
              <option value="MEDIUM">Medium</option>
              <option value="HARD">Hard</option>
            </select>
          </div>

          {/* STATUS PILLS */}
          <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200">
            {(["ALL", "TODO", "ATTEMPTED", "SOLVED"] as StatusFilter[]).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1 text-[11px] font-bold rounded-lg transition-colors ${
                  statusFilter === st
                    ? "bg-white text-slate-900 shadow-2xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {st === "ALL" ? "All" : st === "TODO" ? "Todo" : st === "ATTEMPTED" ? "Attempted" : "Solved"}
              </button>
            ))}
          </div>
        </div>

        {/* ACTIVE FILTERS SUMMARY & CLEAR BUTTON */}
        {hasFilters && (
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-500">
            <div className="flex items-center gap-2 flex-wrap">
              <span>Showing <strong>{filtered.length}</strong> of {allProblems.length} questions</span>
              {topic !== "All" && (
                <span className="badge bg-indigo-50 text-indigo-700 border-indigo-200 text-[10px]">
                  Topic: {topic}
                </span>
              )}
              {difficulty !== "All" && (
                <span className="badge bg-slate-100 text-slate-700 border-slate-200 text-[10px]">
                  Diff: {difficulty}
                </span>
              )}
              {statusFilter !== "ALL" && (
                <span className="badge bg-slate-100 text-slate-700 border-slate-200 text-[10px]">
                  Status: {statusFilter}
                </span>
              )}
            </div>
            <button
              onClick={clearFilters}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 underline inline-flex items-center gap-1"
            >
              <Icon name="x" size={12} />
              Reset all
            </button>
          </div>
        )}
      </div>

      {/* PROBLEMS LIST / TABLE */}
      {filtered.length > 0 ? (
        <div className="surface-card rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs">
          {/* TABLE HEADER */}
          <div className="hidden md:grid md:grid-cols-[48px_36px_1fr_160px_110px_100px] md:items-center gap-3 px-5 py-3 bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
            <div>#</div>
            <div>Status</div>
            <div>Problem Title</div>
            <div className="text-center">Topic</div>
            <div className="text-center">Difficulty</div>
            <div className="text-right">Action</div>
          </div>

          {/* TABLE ROWS */}
          <div className="divide-y divide-slate-100">
            {filtered.map((problem, index) => {
              const status = statusByProblemId.get(problem.id) ?? "unattempted";
              const globalIndex = allProblems.findIndex((p) => p.id === problem.id) + 1;
              const diffStyle = DIFF_COLOR[problem.difficulty] || {
                bg: "bg-slate-50",
                text: "text-slate-600",
                border: "border-slate-200",
              };

              return (
                <Link
                  key={problem.id}
                  href={hrefFor(problem)}
                  className="grid grid-cols-[36px_1fr_auto] md:grid-cols-[48px_36px_1fr_160px_110px_100px] items-center gap-3 px-5 py-3.5 hover:bg-slate-50/90 transition-colors group"
                >
                  {/* NUMBER */}
                  <div className="text-xs font-bold text-slate-400 tabular-nums">
                    {String(globalIndex).padStart(2, "0")}
                  </div>

                  {/* STATUS ICON */}
                  <div className="hidden md:flex items-center">
                    {status === "solved" ? (
                      <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-xs" title="Solved">
                        <Icon name="check" size={12} strokeWidth={2.8} />
                      </div>
                    ) : status === "attempted" ? (
                      <div className="w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center shadow-xs" title="Attempted">
                        <Icon name="clock" size={12} strokeWidth={2.5} />
                      </div>
                    ) : (
                      <div className="w-5 h-5 rounded-full border-2 border-slate-300 bg-white" title="Todo" />
                    )}
                  </div>

                  {/* TITLE & MOBILE META */}
                  <div className="min-w-0">
                    <h3 className="font-semibold text-sm text-slate-900 group-hover:text-indigo-600 transition-colors truncate leading-snug">
                      {problem.title}
                    </h3>
                    <div className="md:hidden flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                        {topicText(problem)}
                      </span>
                      <span
                        className={`rounded-md border px-2 py-0.5 text-[10px] font-bold ${diffStyle.bg} ${diffStyle.text} ${diffStyle.border}`}
                      >
                        {problem.difficulty}
                      </span>
                      {status === "solved" && (
                        <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-0.5">
                          <Icon name="check" size={10} /> Solved
                        </span>
                      )}
                    </div>
                  </div>

                  {/* TOPIC BADGE */}
                  <div className="hidden md:flex justify-center">
                    <span className="rounded-lg bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 truncate max-w-[150px]">
                      {topicText(problem)}
                    </span>
                  </div>

                  {/* DIFFICULTY BADGE */}
                  <div className="hidden md:flex justify-center">
                    <span
                      className={`rounded-lg border px-3 py-1 text-xs font-bold ${diffStyle.bg} ${diffStyle.text} ${diffStyle.border}`}
                    >
                      {problem.difficulty}
                    </span>
                  </div>

                  {/* ACTION BUTTON */}
                  <div className="hidden md:flex justify-end items-center">
                    <span
                      className={`inline-flex items-center gap-1 text-xs font-bold px-3 py-1 rounded-lg transition-colors ${
                        status === "solved"
                          ? "bg-emerald-50 text-emerald-700 group-hover:bg-emerald-100"
                          : "bg-indigo-50 text-indigo-700 group-hover:bg-indigo-600 group-hover:text-white"
                      }`}
                    >
                      <span>{status === "solved" ? "Review" : "Solve"}</span>
                      <Icon name="chevron-right" size={12} strokeWidth={2.5} />
                    </span>
                  </div>

                  {/* MOBILE CHEVRON */}
                  <div className="md:hidden text-slate-400 group-hover:text-indigo-600 transition-colors">
                    <Icon name="chevron-right" size={16} strokeWidth={2} />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      ) : (
        <EmptyState
          icon="search"
          variant="info"
          title={`No ${modeMeta.label} problems match your filters`}
          description="Try adjusting your search query, topic, difficulty, or status filters to view more problems."
          action={
            hasFilters ? (
              <button onClick={clearFilters} className="btn-primary btn-sm inline-flex items-center gap-1.5">
                <Icon name="x" size={14} />
                Clear filters
              </button>
            ) : undefined
          }
        />
      )}
    </div>
  );
}
