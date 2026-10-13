"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { editor } from "monaco-editor";
import { api, ApiError } from "@/lib/api";
import LoadingState from "@/components/LoadingState";
import ErrorState from "@/components/ErrorState";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center bg-slate-950 text-sm text-slate-400">
      Loading editor...
    </div>
  ),
});

interface SqlProblemDetail {
  id: number;
  title: string;
  problemStatement: string;
  difficulty: string;
  topics?: string[];
  subtopics?: string[];
  executionConfig?: string;
  starterQuery?: string;
  explanation?: string;
  sourceUrl?: string;
  testCasesJson?: string;
}

interface SqlTestCaseResult {
  testCaseId: string;
  passed: boolean;
  message: string;
}

interface SqlExecutionResult {
  status: string;
  executionTimeMs: number;
  rowsReturned: number;
  columns: string[];
  rows: (string | number | null)[][];
  testCaseResults: SqlTestCaseResult[];
  score: number;
}

interface TableColumn {
  name: string;
  type: string;
  nullable?: boolean;
}

interface TableSchema {
  name: string;
  columns: TableColumn[];
}

interface ExecutionConfigParsed {
  dialect?: string;
  tables?: TableSchema[];
}

interface SqlTestCaseParsed {
  testCaseId: string;
  input?: {
    tables?: Record<string, Record<string, any>[]>;
  };
  expectedOutput?: {
    columns?: string[];
    rows?: any[][];
  };
}

function formatAsciiTable(headers: string[], rows: (string | number | null | undefined)[][]): string {
  if (!headers || headers.length === 0) return "";
  const colWidths = headers.map((h, i) => {
    let max = h.length;
    for (const row of rows) {
      const val = row[i] == null ? "null" : String(row[i]);
      if (val.length > max) max = val.length;
    }
    return Math.max(max, 3);
  });

  const divider = "+" + colWidths.map((w) => "-".repeat(w + 2)).join("+") + "+";
  const headerLine =
    "| " + headers.map((h, i) => h.padEnd(colWidths[i])).join(" | ") + " |";

  const rowLines = rows.map((row) => {
    return (
      "| " +
      headers
        .map((_, i) => {
          const val = row[i] == null ? "null" : String(row[i]);
          return val.padEnd(colWidths[i]);
        })
        .join(" | ") +
      " |"
    );
  });

  return [divider, headerLine, divider, ...rowLines, divider].join("\n");
}

const DEFAULT_EDITOR_OPTIONS: editor.IStandaloneEditorConstructionOptions = {
  minimap: { enabled: false },
  fontSize: 14,
  tabSize: 2,
  wordWrap: "on",
  lineNumbers: "on",
  folding: true,
  bracketPairColorization: { enabled: true },
  formatOnPaste: true,
  formatOnType: true,
  scrollBeyondLastLine: false,
  automaticLayout: true,
  contextmenu: true,
  theme: "vs-dark",
};

export default function SqlProblemPage() {
  const params = useParams();
  const router = useRouter();
  const problemId = Number(params.id as string);

  const [problem, setProblem] = useState<SqlProblemDetail | null>(null);
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<SqlExecutionResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"run" | "submit" | null>(null);
  const [error, setError] = useState("");
  const [leftTab, setLeftTab] = useState<"description" | "editorial" | "solutions" | "submissions">("description");
  const [bottomTab, setBottomTab] = useState<"testcase" | "result">("testcase");
  const [activeTestCaseIndex, setActiveTestCaseIndex] = useState(0);
  const [selectedDialect, setSelectedDialect] = useState("MySQL");
  const [showSqlSchemaModal, setShowSqlSchemaModal] = useState(false);
  const [liked, setLiked] = useState<boolean | null>(null);
  const [starred, setStarred] = useState(false);
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });

  const storageKey = useMemo(() => `placementpro:sql:${problemId}`, [problemId]);

  useEffect(() => {
    api.get<SqlProblemDetail>(`/api/coding/sql/${problemId}`)
      .then((p) => {
        setProblem(p);
        const saved = localStorage.getItem(storageKey);
        setQuery(saved || p.starterQuery || "-- Write your SQL query statement below.\n");
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : "Failed to load SQL problem"))
      .finally(() => setLoading(false));
  }, [problemId, storageKey]);

  useEffect(() => {
    if (!query) return;
    const handle = window.setTimeout(() => localStorage.setItem(storageKey, query), 450);
    return () => window.clearTimeout(handle);
  }, [query, storageKey]);

  // Parse executionConfig
  const parsedConfig = useMemo<ExecutionConfigParsed | null>(() => {
    if (!problem?.executionConfig) return null;
    try {
      return JSON.parse(problem.executionConfig);
    } catch {
      return null;
    }
  }, [problem?.executionConfig]);

  // Parse testCases
  const parsedTestCases = useMemo<SqlTestCaseParsed[]>(() => {
    if (!problem?.testCasesJson) return [];
    try {
      const tc = JSON.parse(problem.testCasesJson);
      return Array.isArray(tc) ? tc : [];
    } catch {
      return [];
    }
  }, [problem?.testCasesJson]);

  // Format schema DDL text for SQL Schema modal
  const sqlSchemaDdl = useMemo(() => {
    if (!parsedConfig?.tables || parsedConfig.tables.length === 0) {
      return problem?.executionConfig || "-- No DDL available";
    }
    const statements: string[] = [];
    for (const t of parsedConfig.tables) {
      const colDefs = (t.columns || []).map(
        (c) => `    ${c.name} ${c.type}${c.nullable === false ? " NOT NULL" : ""}`
      );
      statements.push(`Create table If Not Exists ${t.name} (\n${colDefs.join(",\n")}\n);`);
    }
    if (parsedTestCases.length > 0 && parsedTestCases[0].input?.tables) {
      statements.push("\n-- Sample Data Inserts:");
      for (const [tName, rows] of Object.entries(parsedTestCases[0].input.tables)) {
        statements.push(`Truncate table ${tName};`);
        for (const row of rows) {
          const cols = Object.keys(row);
          const vals = Object.values(row).map((v) =>
            v == null ? "null" : typeof v === "string" ? `'${v}'` : v
          );
          statements.push(`insert into ${tName} (${cols.join(", ")}) values (${vals.join(", ")});`);
        }
      }
    }
    return statements.join("\n");
  }, [parsedConfig, parsedTestCases, problem?.executionConfig]);

  async function runCode() {
    if (!problem || busy) return;
    setBusy("run");
    setError("");
    setBottomTab("result");
    try {
      const r = await api.post<SqlExecutionResult>("/api/coding/sql/run", {
        problemId: String(problemId),
        sql: query,
      });
      setResult(r);
    } catch (e) {
      const message = e instanceof ApiError ? e.message : "Run failed";
      setError(message);
      setResult({
        status: "ERROR",
        executionTimeMs: 0,
        rowsReturned: 0,
        columns: [],
        rows: [],
        testCaseResults: [{ testCaseId: "0", passed: false, message }],
        score: 0,
      });
    } finally {
      setBusy(null);
    }
  }

  async function submitCode() {
    if (!problem || busy) return;
    setBusy("submit");
    setError("");
    setBottomTab("result");
    try {
      const r = await api.post<SqlExecutionResult>("/api/coding/sql/submit", {
        problemId: String(problemId),
        sql: query,
      });
      setResult(r);
    } catch (e) {
      const message = e instanceof ApiError ? e.message : "Submit failed";
      setError(message);
      setResult({
        status: "ERROR",
        executionTimeMs: 0,
        rowsReturned: 0,
        columns: [],
        rows: [],
        testCaseResults: [{ testCaseId: "0", passed: false, message }],
        score: 0,
      });
    } finally {
      setBusy(null);
    }
  }

  if (loading) return <LoadingState label="Loading SQL workspace..." />;
  if (error && !problem) return <ErrorState message={error} />;
  if (!problem) return null;

  const difficultyStyle =
    problem.difficulty === "EASY"
      ? "text-emerald-700 bg-emerald-50 border-emerald-200"
      : problem.difficulty === "HARD"
      ? "text-rose-700 bg-rose-50 border-rose-200"
      : "text-amber-700 bg-amber-50 border-amber-200";

  const currentTestCase = parsedTestCases[activeTestCaseIndex] || parsedTestCases[0];

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] -mt-2 -mx-4 sm:-mx-6 lg:-mx-8 bg-[#f4f6fb] text-slate-800 select-none overflow-hidden">
      {/* Top Main Navigation Bar - Website Palette */}
      <header className="h-12 border-b border-slate-200 bg-white px-4 flex items-center justify-between shrink-0 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/coding?mode=SQL")}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
          >
            <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
            </svg>
            Problem List
          </button>
          <div className="h-4 w-px bg-slate-200" />
          <span className="text-xs font-mono font-semibold text-slate-400">#{problem.id}</span>
          <span className="text-xs font-bold text-slate-900 truncate max-w-[280px] sm:max-w-md">
            {problem.title}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => void runCode()}
            disabled={Boolean(busy)}
            className="btn-secondary h-8 px-3.5 text-xs font-semibold shadow-xs"
            title="Run Code (Ctrl + Enter)"
          >
            <svg className="w-3.5 h-3.5 text-slate-700" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
            {busy === "run" ? "Running..." : "Run"}
          </button>

          <button
            onClick={() => void submitCode()}
            disabled={Boolean(busy)}
            className="btn-primary h-8 px-4 text-xs font-semibold shadow-xs"
            title="Submit Solution (Ctrl + Shift + Enter)"
          >
            <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
            </svg>
            {busy === "submit" ? "Submitting..." : "Submit"}
          </button>
        </div>
      </header>

      {/* Main Split Body: Left Description, Right Workspace */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-2 p-2 overflow-hidden min-h-0">
        {/* LEFT COLUMN: Tabs (Description, Editorial, Solutions, Submissions) */}
        <section className="lg:col-span-5 flex flex-col bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden min-h-0">
          {/* Left Tabs Header */}
          <div className="h-10 border-b border-slate-200 bg-slate-50/70 px-3 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setLeftTab("description")}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                  leftTab === "description"
                    ? "bg-white text-premium-700 shadow-xs border border-slate-200/80 font-bold"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                <svg className="w-3.5 h-3.5 text-premium-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Description
              </button>
              <button
                onClick={() => setLeftTab("editorial")}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                  leftTab === "editorial"
                    ? "bg-white text-premium-700 shadow-xs border border-slate-200/80 font-bold"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                <svg className="w-3.5 h-3.5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                Editorial
              </button>
              <button
                onClick={() => setLeftTab("solutions")}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                  leftTab === "solutions"
                    ? "bg-white text-premium-700 shadow-xs border border-slate-200/80 font-bold"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                <svg className="w-3.5 h-3.5 text-accent-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
                Solutions
              </button>
              <button
                onClick={() => setLeftTab("submissions")}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                  leftTab === "submissions"
                    ? "bg-white text-premium-700 shadow-xs border border-slate-200/80 font-bold"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Submissions
              </button>
            </div>
          </div>

          {/* Left Content Area */}
          <div className="flex-1 overflow-y-auto p-5 text-sm leading-relaxed text-slate-700">
            {leftTab === "description" && (
              <div className="space-y-6">
                {/* Title */}
                <div>
                  <h1 className="text-xl font-display font-bold text-slate-950 tracking-tight">
                    {problem.id}. {problem.title}
                  </h1>

                  {/* Pills */}
                  <div className="flex flex-wrap items-center gap-2 mt-3">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border capitalize ${difficultyStyle}`}>
                      {problem.difficulty?.toLowerCase() || "medium"}
                    </span>

                    {(problem.topics || []).map((t) => (
                      <span
                        key={t}
                        className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-premium-50 text-premium-700 border border-premium-200/60"
                      >
                        <svg className="w-3 h-3 text-premium-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                        </svg>
                        {t}
                      </span>
                    ))}

                    <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                      <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      Companies
                    </span>
                  </div>

                  {/* SQL Schema Link */}
                  <div className="flex items-center gap-3 mt-4 text-xs font-semibold">
                    <button
                      onClick={() => setShowSqlSchemaModal(true)}
                      className="text-premium-700 hover:text-premium-800 flex items-center gap-1 transition"
                    >
                      SQL Schema
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Formatted Table Schemas (ASCII format) */}
                {parsedConfig?.tables && parsedConfig.tables.length > 0 && (
                  <div className="space-y-4">
                    {parsedConfig.tables.map((tbl) => {
                      const cols = (tbl.columns || []).map((c) => [c.name, c.type.toLowerCase()]);
                      const ascii = formatAsciiTable(["Column Name", "Type"], cols);
                      return (
                        <div key={tbl.name} className="space-y-1.5">
                          <p className="text-xs font-semibold text-slate-600">
                            Table: <code className="bg-slate-100 text-slate-900 px-1.5 py-0.5 rounded font-mono text-xs border border-slate-200">{tbl.name}</code>
                          </p>
                          <pre className="p-3 bg-slate-900 rounded-lg font-mono text-xs text-slate-100 border border-slate-800 overflow-x-auto leading-5 select-text shadow-xs">
                            {ascii}
                          </pre>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Problem Statement */}
                <div className="space-y-3">
                  <p className="text-slate-800 whitespace-pre-wrap leading-relaxed">
                    {problem.problemStatement}
                  </p>
                  <p className="text-slate-500 text-xs">
                    The result format is in the following example.
                  </p>
                </div>

                {/* Example 1 (and further examples if present) */}
                {parsedTestCases.length > 0 && (
                  <div className="space-y-5">
                    {parsedTestCases.slice(0, 2).map((tc, idx) => {
                      const inputTables = tc.input?.tables || {};
                      const hasInput = Object.keys(inputTables).length > 0;
                      const hasOutput = tc.expectedOutput?.columns && tc.expectedOutput.columns.length > 0;

                      return (
                        <div key={tc.testCaseId || idx} className="space-y-2">
                          <h3 className="text-sm font-bold text-slate-900">Example {idx + 1}:</h3>
                          <div className="p-3.5 bg-slate-900 rounded-lg font-mono text-xs text-slate-100 border border-slate-800 space-y-3 overflow-x-auto select-text shadow-xs">
                            {hasInput && (
                              <div className="space-y-2">
                                <div className="text-slate-400 font-semibold font-sans">Input:</div>
                                {Object.entries(inputTables).map(([tName, rows]) => {
                                  const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
                                  const dataRows = rows.map((r) => headers.map((h) => r[h]));
                                  const tableAscii = formatAsciiTable(headers, dataRows);
                                  return (
                                    <div key={tName} className="space-y-1">
                                      <div className="text-slate-300 font-sans">{tName} table:</div>
                                      <pre className="text-slate-100 leading-5">{tableAscii}</pre>
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {hasOutput && (
                              <div className="space-y-2 pt-2 border-t border-slate-800">
                                <div className="text-slate-400 font-semibold font-sans">Output:</div>
                                <pre className="text-slate-100 leading-5">
                                  {formatAsciiTable(tc.expectedOutput!.columns!, tc.expectedOutput!.rows || [])}
                                </pre>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Explanation if available */}
                {problem.explanation && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-bold text-slate-900">Explanation:</h3>
                    <p className="text-xs text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-200 whitespace-pre-wrap leading-relaxed">
                      {problem.explanation}
                    </p>
                  </div>
                )}
              </div>
            )}

            {leftTab === "editorial" && (
              <div className="space-y-4">
                <h2 className="text-base font-bold text-slate-900">Editorial &amp; Solution Approach</h2>
                {problem.explanation ? (
                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 text-slate-700 text-xs whitespace-pre-wrap leading-relaxed">
                    {problem.explanation}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">
                    Editorial is being generated for this problem. Review the schema and sample testcases to build your query.
                  </p>
                )}
              </div>
            )}

            {leftTab === "solutions" && (
              <div className="space-y-4">
                <h2 className="text-base font-bold text-slate-900">Solutions &amp; Starter Template</h2>
                <div className="space-y-2">
                  <p className="text-xs text-slate-500">Starter SQL Query:</p>
                  <pre className="p-3 bg-slate-900 rounded-lg border border-slate-800 text-xs font-mono text-slate-100">
                    {problem.starterQuery || "-- Write your query here\nSELECT * FROM table_name;"}
                  </pre>
                </div>
              </div>
            )}

            {leftTab === "submissions" && (
              <div className="space-y-4">
                <h2 className="text-base font-bold text-slate-900">Submissions</h2>
                {result ? (
                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className={`font-bold ${result.status === "PASS" || result.status === "ACCEPTED" ? "text-emerald-700" : "text-rose-700"}`}>
                        {result.status}
                      </span>
                      <span className="text-slate-500">{result.executionTimeMs} ms</span>
                    </div>
                    <p className="text-slate-600">
                      Score: {result.score != null ? `${Math.round(result.score * 100)}%` : "--"}
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">
                    No submissions made yet in this session. Click &quot;Submit&quot; to test your solution.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Left Pane Footer Bar */}
          <div className="h-10 border-t border-slate-200 bg-slate-50 px-4 flex items-center justify-between shrink-0 text-xs text-slate-500">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setLiked(liked === true ? null : true)}
                className={`flex items-center gap-1 hover:text-slate-900 transition ${liked === true ? "text-premium-700 font-bold" : ""}`}
                title="Like"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                </svg>
                <span>2.4K</span>
              </button>
              <button
                onClick={() => setLiked(liked === false ? null : false)}
                className={`flex items-center gap-1 hover:text-slate-900 transition ${liked === false ? "text-rose-600 font-bold" : ""}`}
                title="Dislike"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018c.163 0 .326.02.485.06L17 4m-7 10v5a2 2 0 002 2h.096c.5 0 .904-.405.904-.905 0-.714.211-1.412.608-2.006L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" />
                </svg>
              </button>
              <div className="flex items-center gap-1 hover:text-slate-900 transition cursor-pointer">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <span>270</span>
              </div>
              <button
                onClick={() => setStarred(!starred)}
                className={`hover:text-slate-900 transition ${starred ? "text-amber-500" : ""}`}
                title="Star"
              >
                <svg className="w-3.5 h-3.5" fill={starred ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
              </button>
            </div>

            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>24 Online</span>
            </div>
          </div>
        </section>

        {/* RIGHT COLUMN: Split into Editor (Top) & Testcase/Result (Bottom) */}
        <section className="lg:col-span-7 flex flex-col gap-2 overflow-hidden min-h-0">
          {/* Top Half: Code Editor */}
          <div className="flex-1 flex flex-col bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden min-h-[300px]">
            {/* Editor Header */}
            <div className="h-10 border-b border-slate-200 bg-slate-50/70 px-3 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1 text-xs font-bold text-slate-800">
                  <svg className="w-3.5 h-3.5 text-premium-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                  </svg>
                  Code
                </span>

                <div className="h-4 w-px bg-slate-200 mx-1" />

                {/* Dialect Selector */}
                <select
                  value={selectedDialect}
                  onChange={(e) => setSelectedDialect(e.target.value)}
                  className="bg-white text-slate-700 text-xs px-2.5 py-1 rounded-md border border-slate-200 cursor-pointer focus:outline-none focus:border-premium-500 font-medium shadow-xs"
                >
                  <option value="MySQL">MySQL</option>
                  <option value="PostgreSQL">PostgreSQL</option>
                  <option value="SQLite">SQLite</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setQuery(problem.starterQuery || "-- Write your SQL query statement below.\n")}
                  className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md transition"
                  title="Reset to starter query"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Monaco Editor Canvas */}
            <div className="flex-1 min-h-0 bg-slate-950">
              <MonacoEditor
                value={query}
                language="sql"
                theme="vs-dark"
                options={DEFAULT_EDITOR_OPTIONS}
                onChange={(value) => setQuery(value || "")}
                onMount={(editorInstance, monaco) => {
                  editorInstance.onDidChangeCursorPosition((e) => {
                    setCursorPos({ line: e.position.lineNumber, col: e.position.column });
                  });
                  editorInstance.addCommand(
                    monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter,
                    () => void runCode()
                  );
                  editorInstance.addCommand(
                    monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.Enter,
                    () => void submitCode()
                  );
                  editorInstance.addCommand(
                    monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS,
                    () => {
                      localStorage.setItem(storageKey, query);
                    }
                  );
                }}
              />
            </div>

            {/* Editor Footer */}
            <div className="h-6 border-t border-slate-200 bg-slate-50 px-3 flex items-center justify-between shrink-0 text-[11px] text-slate-500">
              <span className="flex items-center gap-1 font-medium">
                <svg className="w-3 h-3 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                Saved
              </span>
              <span>
                Ln {cursorPos.line}, Col {cursorPos.col}
              </span>
            </div>
          </div>

          {/* Bottom Half: Testcase & Result */}
          <div className="h-[280px] flex flex-col bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden shrink-0">
            {/* Bottom Tabs Header */}
            <div className="h-10 border-b border-slate-200 bg-slate-50/70 px-3 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setBottomTab("testcase")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                    bottomTab === "testcase"
                      ? "bg-white text-premium-700 shadow-xs border border-slate-200/80 font-bold"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Testcase
                </button>
                <button
                  onClick={() => setBottomTab("result")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                    bottomTab === "result"
                      ? "bg-white text-premium-700 shadow-xs border border-slate-200/80 font-bold"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Test Result
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => void runCode()}
                  disabled={Boolean(busy)}
                  className="btn-secondary h-7 px-2.5 text-xs font-semibold"
                >
                  Run
                </button>
                <button
                  onClick={() => void submitCode()}
                  disabled={Boolean(busy)}
                  className="btn-primary h-7 px-3 text-xs font-semibold"
                >
                  Submit
                </button>
              </div>
            </div>

            {/* Bottom Content */}
            <div className="flex-1 overflow-y-auto p-4 text-xs select-text bg-white">
              {bottomTab === "testcase" && (
                <div className="space-y-4 font-sans">
                  {/* Case Switcher */}
                  <div className="flex items-center gap-2">
                    {(parsedTestCases.length > 0 ? parsedTestCases : [null]).map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setActiveTestCaseIndex(i)}
                        className={`px-3 py-1 rounded-md text-xs font-semibold transition ${
                          activeTestCaseIndex === i
                            ? "bg-premium-100 text-premium-800 border border-premium-200"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        Case {i + 1}
                      </button>
                    ))}
                  </div>

                  {/* Display tables for selected case */}
                  {currentTestCase?.input?.tables ? (
                    <div className="space-y-3 font-mono">
                      {Object.entries(currentTestCase.input.tables).map(([tName, rows]) => {
                        const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
                        const dataRows = rows.map((r) => headers.map((h) => r[h]));
                        return (
                          <div key={tName} className="space-y-1">
                            <span className="text-slate-600 text-xs font-sans font-semibold">{tName} =</span>
                            <pre className="p-2.5 bg-slate-900 rounded-lg border border-slate-800 text-slate-100 text-xs leading-5 overflow-x-auto shadow-xs">
                              {formatAsciiTable(headers, dataRows)}
                            </pre>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-slate-500 text-xs font-sans">
                      Standard default test case loaded for table schemas. Run code to execute against all test cases.
                    </div>
                  )}
                </div>
              )}

              {bottomTab === "result" && (
                <div className="h-full">
                  {!result && !busy && (
                    <div className="h-full flex items-center justify-center text-sm font-sans text-slate-400">
                      You must run your code first
                    </div>
                  )}

                  {busy && (
                    <div className="h-full flex items-center justify-center text-sm font-sans text-slate-600 gap-2">
                      <svg className="animate-spin w-4 h-4 text-premium-600" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      {busy === "run" ? "Executing SQL query..." : "Evaluating solution..."}
                    </div>
                  )}

                  {result && !busy && (
                    <div className="space-y-4 font-sans">
                      {/* Status row */}
                      {(() => {
                        const isPass =
                          result.status === "PASS" ||
                          result.status === "ACCEPTED" ||
                          result.status === "ALL_PASSED" ||
                          result.status === "PASSED" ||
                          result.status === "SUCCESS" ||
                          result.status === "PASSED_TO_BE_EVALUATED" ||
                          (result.testCaseResults.length > 0 &&
                            result.testCaseResults.every((t) => t.passed));
                        return (
                          <div className="flex items-center gap-3">
                            <span
                              className={`text-lg font-bold ${
                                isPass ? "text-emerald-600" : "text-rose-600"
                              }`}
                            >
                              {isPass
                                ? "Accepted"
                                : result.status === "ERROR"
                                ? "Runtime Error"
                                : "Wrong Answer"}
                            </span>
                            <span className="text-xs text-slate-500 font-medium">
                              Runtime: {result.executionTimeMs} ms
                            </span>
                          </div>
                        );
                      })()}

                      {/* Output Table */}
                      {result.columns.length > 0 && (
                        <div className="space-y-1.5 font-mono">
                          <span className="text-slate-600 text-xs font-sans font-semibold">Output</span>
                          <pre className="p-2.5 bg-slate-900 rounded-lg border border-slate-800 text-slate-100 text-xs leading-5 overflow-x-auto shadow-xs">
                            {formatAsciiTable(result.columns, result.rows)}
                          </pre>
                        </div>
                      )}

                      {/* Test cases passed breakdown */}
                      <div className="space-y-1.5">
                        <span className="text-slate-600 text-xs font-sans font-semibold">
                          Testcases Passed: {result.testCaseResults.filter((t) => t.passed).length} / {result.testCaseResults.length}
                        </span>
                        {result.testCaseResults.map((t) => (
                          <div
                            key={t.testCaseId}
                            className={`p-2.5 rounded-lg text-xs border ${
                              t.passed
                                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                                : "bg-rose-50 border-rose-200 text-rose-800"
                            }`}
                          >
                            <span className="font-bold">{t.passed ? "✓ Passed" : "✗ Failed"}:</span> Test {t.testCaseId}
                            {t.message && <p className="mt-1 font-mono text-[11px] text-slate-700">{t.message}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      {/* SQL Schema Modal */}
      {showSqlSchemaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-xs p-4">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-elevated max-w-xl w-full overflow-hidden flex flex-col max-h-[80vh]">
            <div className="h-12 border-b border-slate-200 px-5 flex items-center justify-between shrink-0 bg-slate-50">
              <h3 className="font-display font-bold text-slate-900 text-sm">SQL Schema</h3>
              <button
                onClick={() => setShowSqlSchemaModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg transition"
              >
                ✕
              </button>
            </div>
            <div className="p-4 overflow-y-auto font-mono text-xs text-slate-100 leading-relaxed bg-slate-900">
              <pre className="whitespace-pre-wrap select-text">{sqlSchemaDdl}</pre>
            </div>
            <div className="h-12 border-t border-slate-200 px-5 flex items-center justify-end shrink-0 bg-slate-50">
              <button
                onClick={() => setShowSqlSchemaModal(false)}
                className="btn-secondary h-8 px-4 text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
