"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import type { editor } from "monaco-editor";
import { api, ApiError } from "@/lib/api";
import LoadingState from "@/components/LoadingState";
import ErrorState from "@/components/ErrorState";
import MatrixVisualizer, { is2DMatrixProblem } from "@/components/MatrixVisualizer";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center bg-slate-900 text-sm text-slate-400">
      Loading Monaco editor...
    </div>
  ),
});

interface LanguageConfig {
  id: string;
  name: string;
  version: string;
  editorLanguage: string;
  template: string;
  executionMode: string;
}

interface ProblemExample {
  title: string;
  input: string;
  output: string;
  explanation?: string;
}

interface ProblemMetadata {
  id: number;
  title: string;
  difficulty: string;
  topics: string[];
  description: string;
  constraints: string[];
  examples: ProblemExample[];
  supportedLanguages: LanguageConfig[];
  templates: Record<string, string>;
  timeLimitMs: number;
  memoryLimitMb: number;
  acceptanceRate: number;
}

interface TestCaseResult {
  name: string;
  status: string;
  input: string;
  expected: string;
  actual: string;
  runtimeMs: number;
  memoryMb: number;
  error?: string;
}

interface RunResponse {
  status: string;
  results: TestCaseResult[];
  console: string;
  passed: number;
  total: number;
  runtimeMs: number;
  memoryMb: number;
}

interface SubmitResponse {
  status: string;
  passed: number;
  total: number;
  runtimeMs: number;
  memoryMb: number;
  score: number;
  verdict: string;
  submissionId: number;
  console: string;
}

interface SubmissionHistory {
  submissionId: number;
  problemId: number;
  problemTitle: string;
  verdict: string;
  score: number;
  submittedAt: string;
}

interface ProblemListItem {
  id: number;
  title: string;
  topic: string;
  difficulty: string;
  statement: string;
}

type LeftTab = "description" | "editorial" | "solutions" | "submissions";
type BottomTab = "testcase" | "result";

const DEFAULT_EDITOR_OPTIONS: editor.IStandaloneEditorConstructionOptions = {
  minimap: { enabled: false },
  fontSize: 14,
  tabSize: 4,
  wordWrap: "off",
  lineNumbers: "on",
  folding: true,
  bracketPairColorization: { enabled: true },
  formatOnPaste: false,
  formatOnType: true,
  scrollBeyondLastLine: false,
  automaticLayout: true,
  contextmenu: false, // Prevents copy-paste menu
  fontFamily: "'Fira Code', 'JetBrains Mono', Menlo, Monaco, Consolas, monospace",
};

export default function CodingProblemPage() {
  const params = useParams();
  const router = useRouter();
  const problemId = Number(params.id as string);

  const [problem, setProblem] = useState<ProblemMetadata | null>(null);
  const [language, setLanguage] = useState("java");
  const [code, setCode] = useState("");
  const [activeLeftTab, setActiveLeftTab] = useState<LeftTab>("description");
  const [activeBottomTab, setActiveBottomTab] = useState<BottomTab>("testcase");
  const [activeCaseIndex, setActiveCaseIndex] = useState(0);
  const [activeResultCaseIndex, setActiveResultCaseIndex] = useState(0);

  const [customInput, setCustomInput] = useState("");
  const [customExpected, setCustomExpected] = useState("");
  const [panelWidth, setPanelWidth] = useState(45); // Left panel percentage
  const [editorHeight, setEditorHeight] = useState(62); // Upper editor percentage

  const [fontSize, setFontSize] = useState(14);
  const [tabSize, setTabSize] = useState(4);
  const [wordWrap, setWordWrap] = useState(false);
  const [minimap, setMinimap] = useState(false);
  const [autoSave, setAutoSave] = useState(true);
  const [theme, setTheme] = useState<"light" | "dark" | "system">("light");

  const [result, setResult] = useState<RunResponse | SubmitResponse | null>(null);
  const [history, setHistory] = useState<SubmissionHistory[]>([]);
  const [allHistory, setAllHistory] = useState<SubmissionHistory[]>([]);
  const [problemList, setProblemList] = useState<ProblemListItem[]>([]);
  const [navOpen, setNavOpen] = useState(false);
  const [showTopics, setShowTopics] = useState(false);
  const [showCompanies, setShowCompanies] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [liked, setLiked] = useState(false);
  const [disliked, setDisliked] = useState(false);
  const [savedBookmark, setSavedBookmark] = useState(false);

  // Live Timer (Stopwatch)
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerRunning, setTimerRunning] = useState(true);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"run" | "submit" | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [error, setError] = useState("");

  const storageKey = useMemo(() => `placementpro:code:${problemId}:${language}`, [language, problemId]);
  const selectedLanguage = problem?.supportedLanguages.find((item) => item.id === language);

  const editorOptions = useMemo<editor.IStandaloneEditorConstructionOptions>(() => ({
    ...DEFAULT_EDITOR_OPTIONS,
    fontSize,
    tabSize,
    wordWrap: wordWrap ? "on" : "off",
    minimap: { enabled: minimap },
  }), [fontSize, minimap, tabSize, wordWrap]);

  const resolvedTheme = theme === "system"
    ? (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
    : theme;

  // Stopwatch effect
  useEffect(() => {
    if (!timerRunning) return;
    const interval = setInterval(() => {
      setTimerSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [timerRunning]);

  const formatTimer = (totalSec: number) => {
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    if (hrs > 0) {
      return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    }
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const statusByProblemId = useMemo(() => {
    const map = new Map<number, "solved" | "attempted">();
    for (const item of allHistory) {
      const current = map.get(item.problemId);
      if (item.verdict === "PASSED" || item.verdict === "ACCEPTED") map.set(item.problemId, "solved");
      else if (current !== "solved") map.set(item.problemId, "attempted");
    }
    return map;
  }, [allHistory]);

  const currentIndex = problemList.findIndex((p) => p.id === problemId);
  const prevProblem = currentIndex > 0 ? problemList[currentIndex - 1] : null;
  const nextProblem = currentIndex >= 0 && currentIndex < problemList.length - 1 ? problemList[currentIndex + 1] : null;

  const isMatrix = useMemo(() => is2DMatrixProblem(problem), [problem]);

  const effectiveExamples = useMemo(() => {
    if (problem?.examples && problem.examples.length > 0) {
      return problem.examples;
    }
    if ((problem as any)?.sampleInput || (problem as any)?.sampleOutput) {
      return [
        {
          title: "Example 1",
          input: (problem as any).sampleInput || "",
          output: (problem as any).sampleOutput || "",
          explanation: undefined,
        },
      ];
    }
    return [];
  }, [problem]);

  useEffect(() => {
    const storedWidth = Number(localStorage.getItem("placementpro:ide:problemWidth"));
    if (storedWidth) setPanelWidth(Math.min(60, Math.max(30, storedWidth)));
    const rawSettings = localStorage.getItem("placementpro:ide:settings");
    if (rawSettings) {
      try {
        const settings = JSON.parse(rawSettings);
        if (settings.fontSize) setFontSize(settings.fontSize);
        if (settings.tabSize) setTabSize(settings.tabSize);
        if (typeof settings.wordWrap === "boolean") setWordWrap(settings.wordWrap);
        if (typeof settings.minimap === "boolean") setMinimap(settings.minimap);
        if (typeof settings.autoSave === "boolean") setAutoSave(settings.autoSave);
        if (settings.theme) setTheme(settings.theme);
      } catch {}
    }
  }, []);

  useEffect(() => {
    Promise.all([
      api.get<ProblemMetadata>(`/api/coding/problems/${problemId}/metadata`),
      api.get<SubmissionHistory[]>("/api/coding/history").catch(() => []),
      api.get<ProblemListItem[]>("/api/coding/problems").catch(() => []),
    ])
      .then(([metadata, submissions, list]) => {
        setProblem(metadata);
        const defaultLanguage = metadata.supportedLanguages[0]?.id || "java";
        const saved = localStorage.getItem(`placementpro:code:${problemId}:${defaultLanguage}`);
        setLanguage(defaultLanguage);
        setCode(saved || metadata.templates[defaultLanguage] || "");
        setCustomInput(metadata.examples[0]?.input || "");
        setCustomExpected(metadata.examples[0]?.output || "");
        setHistory(submissions.filter((item) => item.problemId === problemId));
        setAllHistory(submissions);
        setProblemList(list);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : "Failed to load coding workspace"))
      .finally(() => setLoading(false));
  }, [problemId]);

  useEffect(() => {
    if (!autoSave || !code) return;
    const handle = window.setTimeout(() => localStorage.setItem(storageKey, code), 450);
    return () => window.clearTimeout(handle);
  }, [autoSave, code, storageKey]);

  useEffect(() => {
    localStorage.setItem("placementpro:ide:settings", JSON.stringify({ fontSize, tabSize, wordWrap, minimap, autoSave, theme }));
  }, [autoSave, fontSize, minimap, tabSize, theme, wordWrap]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        void runCode();
      }
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === "Enter") {
        event.preventDefault();
        void submitCode();
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        localStorage.setItem(storageKey, code);
      }
      if (event.key === "Escape") {
        setSettingsOpen(false);
        setShortcutsOpen(false);
        setNavOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [code, problem, storageKey]);

  function changeLanguage(nextLanguage: string) {
    if (!problem || nextLanguage === language) return;
    localStorage.setItem(storageKey, code);
    const saved = localStorage.getItem(`placementpro:code:${problemId}:${nextLanguage}`);
    const hasEdits = code.trim() && code !== (problem.templates[language] || "");
    if (hasEdits && !saved && !window.confirm("Switch language and load the starter template? Your current code is saved locally.")) return;
    setLanguage(nextLanguage);
    setCode(saved || problem.templates[nextLanguage] || "");
  }

  async function runCode() {
    if (!problem || busy) return;
    setBusy("run");
    setError("");
    setActiveBottomTab("result");
    try {
      const activeInput = activeCaseIndex < problem.examples.length
        ? problem.examples[activeCaseIndex].input
        : customInput;
      const activeExpected = activeCaseIndex < problem.examples.length
        ? problem.examples[activeCaseIndex].output
        : customExpected;

      const response = await api.post<RunResponse>("/api/coding/run", {
        problemId,
        language,
        code,
        testCases: [
          {
            name: `Case ${activeCaseIndex + 1}`,
            input: activeInput || "",
            expectedOutput: activeExpected || "",
            hidden: false,
          },
          ...(customInput.trim() && activeCaseIndex >= problem.examples.length
            ? [{ name: "Custom Case", input: customInput, expectedOutput: customExpected, hidden: false }]
            : []),
        ],
      });
      setResult(response);
      setActiveResultCaseIndex(0);
    } catch (e) {
      const message = e instanceof ApiError ? e.message : "Execution failed";
      setError(message);
    } finally {
      setBusy(null);
    }
  }

  async function submitCode() {
    if (!problem || busy) return;
    setBusy("submit");
    setError("");
    setActiveBottomTab("result");
    try {
      const response = await api.post<SubmitResponse>("/api/coding/submit", { problemId, language, code });
      setResult(response);
      const submissions = await api.get<SubmissionHistory[]>("/api/coding/history").catch(() => []);
      setHistory(submissions.filter((item) => item.problemId === problemId));
      setAllHistory(submissions);
    } catch (e) {
      const message = e instanceof ApiError ? e.message : "Submission failed";
      setError(message);
    } finally {
      setBusy(null);
    }
  }

  function resetCode() {
    if (!problem || !window.confirm("Reset editor to starter template?")) return;
    setCode(problem.templates[language] || "");
  }

  function handleRandomProblem() {
    if (problemList.length <= 1) return;
    const others = problemList.filter((p) => p.id !== problemId);
    const randomPick = others[Math.floor(Math.random() * others.length)];
    if (randomPick) router.push(`/coding/${randomPick.id}`);
  }

  if (loading) return <LoadingState label="Loading coding workspace..." />;
  if (error && !problem) return <ErrorState message={error} />;
  if (!problem) return null;

  const difficultyColors = {
    EASY: "text-emerald-500 bg-emerald-50 border-emerald-200",
    MEDIUM: "text-amber-500 bg-amber-50 border-amber-200",
    HARD: "text-rose-500 bg-rose-50 border-rose-200",
  }[problem.difficulty.toUpperCase()] || "text-slate-500 bg-slate-50 border-slate-200";

  return (
    <div className={`flex flex-col ${fullscreen ? "fixed inset-0 z-50 bg-[#f7f8fa]" : "h-[calc(100vh-68px)] min-h-[720px] bg-[#f7f8fa]"} select-none`}>
      {/* ==================== TOP NAVIGATION BAR ==================== */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4">
        {/* Left: Problem list & navigation */}
        <div className="flex items-center gap-2">
          {/* Brand Icon */}
          <button
            onClick={() => router.push("/coding")}
            className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-slate-700 hover:bg-slate-100"
            title="Back to Problems"
          >
            <div className="flex h-6 w-6 items-center justify-center rounded bg-gradient-to-tr from-amber-500 to-orange-400 font-bold text-white text-xs">
              P
            </div>
          </button>

          {/* Problem List Dropdown */}
          <div className="relative">
            <button
              onClick={() => setNavOpen((v) => !v)}
              className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="8" y1="6" x2="21" y2="6" />
                <line x1="8" y1="12" x2="21" y2="12" />
                <line x1="8" y1="18" x2="21" y2="18" />
                <line x1="3" y1="6" x2="3.01" y2="6" strokeWidth="3" />
                <line x1="3" y1="12" x2="3.01" y2="12" strokeWidth="3" />
                <line x1="3" y1="18" x2="3.01" y2="18" strokeWidth="3" />
              </svg>
              <span>Problem List</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={`transition-transform ${navOpen ? "rotate-180" : ""}`}>
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>

            {navOpen && (
              <div className="absolute left-0 top-full z-50 mt-1 max-h-96 w-80 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-2xl">
                <div className="mb-2 px-3 py-1 text-xs font-bold uppercase tracking-wider text-slate-400">
                  Problems ({problemList.length})
                </div>
                {problemList.map((p, i) => {
                  const status = statusByProblemId.get(p.id);
                  return (
                    <button
                      key={p.id}
                      onClick={() => {
                        setNavOpen(false);
                        if (p.id !== problemId) router.push(`/coding/${p.id}`);
                      }}
                      className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs ${
                        p.id === problemId ? "bg-slate-100 font-bold text-slate-900" : "text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <span className="w-6 shrink-0 text-slate-400">{i + 1}.</span>
                      <span className="min-w-0 flex-1 truncate">{p.title}</span>
                      {status === "solved" && (
                        <span className="rounded bg-emerald-50 px-1 text-[10px] font-bold text-emerald-600">Solved</span>
                      )}
                      {status === "attempted" && (
                        <span className="rounded bg-amber-50 px-1 text-[10px] font-bold text-amber-600">Attempted</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Prev / Next Arrows */}
          <button
            onClick={() => prevProblem && router.push(`/coding/${prevProblem.id}`)}
            disabled={!prevProblem}
            title={prevProblem ? `Previous: ${prevProblem.title}` : "No previous problem"}
            className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <button
            onClick={() => nextProblem && router.push(`/coding/${nextProblem.id}`)}
            disabled={!nextProblem}
            title={nextProblem ? `Next: ${nextProblem.title}` : "No next problem"}
            className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M9 6l6 6-6 6" />
            </svg>
          </button>

          {/* Random Problem Shuffle */}
          <button
            onClick={handleRandomProblem}
            title="Pick Random Problem"
            className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="16 3 21 3 21 8" />
              <line x1="4" y1="20" x2="21" y2="3" />
              <polyline points="21 16 21 21 16 21" />
              <line x1="15" y1="15" x2="21" y2="21" />
              <line x1="4" y1="4" x2="9" y2="9" />
            </svg>
          </button>
        </div>

        {/* Center: Run & Submit */}
        <div className="flex items-center gap-2">
          {/* Run Button */}
          <button
            onClick={() => void runCode()}
            disabled={Boolean(busy)}
            title="Run Code (Ctrl + Enter)"
            className="flex items-center gap-1.5 rounded-md bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-200 disabled:opacity-50"
          >
            {busy === "run" ? (
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-700 border-t-transparent" />
            ) : (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
            )}
            <span>Run</span>
          </button>

          {/* Submit Button */}
          <button
            onClick={() => void submitCode()}
            disabled={Boolean(busy)}
            title="Submit Solution (Ctrl + Shift + Enter)"
            className="flex items-center gap-1.5 rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-600 disabled:opacity-50"
          >
            {busy === "submit" ? (
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M16 16l-4-4-4 4" />
                <path d="M12 12v9" />
                <path d="M20.39 18.39A5 5 0 0018 9h-1.26A8 8 0 103 16.3" />
              </svg>
            )}
            <span>Submit</span>
          </button>
        </div>

        {/* Right: Stopwatch, Settings, Fullscreen */}
        <div className="flex items-center gap-3">
          {/* Live Timer */}
          <div className="flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-xs font-mono font-medium text-slate-700">
            <button
              onClick={() => setTimerRunning((r) => !r)}
              title={timerRunning ? "Pause Timer" : "Resume Timer"}
              className="text-slate-500 hover:text-slate-900"
            >
              {timerRunning ? (
                <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="4" width="4" height="16" />
                  <rect x="14" y="4" width="4" height="16" />
                </svg>
              ) : (
                <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
              )}
            </button>
            <span className="text-slate-800">{formatTimer(timerSeconds)}</span>
            <button
              onClick={() => setTimerSeconds(0)}
              title="Reset Timer"
              className="text-slate-400 hover:text-slate-700"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="1 4 1 10 7 10" />
                <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
              </svg>
            </button>
          </div>

          {/* Settings Gear */}
          <button
            onClick={() => setSettingsOpen(true)}
            title="Editor Settings"
            className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
            </svg>
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={() => setFullscreen((v) => !v)}
            title={fullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
            className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3" />
            </svg>
          </button>

          {/* User Badge */}
          <div className="flex items-center gap-1.5 pl-1 border-l border-slate-200">
            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
              Prep2Place
            </span>
          </div>
        </div>
      </header>

      {/* ==================== WORKSPACE MAIN BODY ==================== */}
      <div className="flex flex-1 min-h-0 p-2 gap-2">
        {/* ==================== LEFT PANEL (PROBLEM DETAILS) ==================== */}
        <section
          style={{ width: `${panelWidth}%` }}
          className="flex flex-col min-w-[320px] rounded-lg border border-slate-200 bg-white overflow-hidden shadow-sm"
        >
          {/* Tabs Header */}
          <div className="flex h-10 shrink-0 items-center justify-between border-b border-slate-200 bg-slate-50/70 px-3">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setActiveLeftTab("description")}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                  activeLeftTab === "description"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-500">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
                <span>Description</span>
              </button>

              <button
                onClick={() => setActiveLeftTab("editorial")}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                  activeLeftTab === "editorial"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-500">
                  <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z" />
                  <path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z" />
                </svg>
                <span>Editorial</span>
              </button>

              <button
                onClick={() => setActiveLeftTab("solutions")}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                  activeLeftTab === "solutions"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-purple-500">
                  <path d="M9 18h6" />
                  <path d="M10 22h4" />
                  <path d="M12 2a7 7 0 00-7 7c0 2.38 1.19 4.47 3 5.74V17a1 1 0 001 1h6a1 1 0 001-1v-2.26c1.81-1.27 3-3.36 3-5.74a7 7 0 00-7-7z" />
                </svg>
                <span>Solutions</span>
              </button>

              <button
                onClick={() => setActiveLeftTab("submissions")}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                  activeLeftTab === "submissions"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-emerald-500">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                <span>Submissions</span>
              </button>
            </div>
          </div>

          {/* Tab Content Body */}
          <div className="flex-1 min-h-0 overflow-y-auto p-5 text-slate-800">
            {activeLeftTab === "description" && (
              <div className="space-y-5">
                {/* Problem Title & ID */}
                <div>
                  <h1 className="text-xl font-bold tracking-tight text-slate-900">
                    {problem.id}. {problem.title}
                  </h1>

                  {/* Metadata Chips (LeetCode Style) */}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${difficultyColors}`}>
                      {problem.difficulty}
                    </span>

                    <button
                      onClick={() => setShowTopics((v) => !v)}
                      className="flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
                        <line x1="7" y1="7" x2="7.01" y2="7" />
                      </svg>
                      <span>Topics</span>
                    </button>

                    <button
                      onClick={() => setShowCompanies((v) => !v)}
                      className="flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0110 0v4" />
                      </svg>
                      <span>Companies</span>
                    </button>

                    <button
                      onClick={() => setShowHint((v) => !v)}
                      className="flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M9 18h6" />
                        <path d="M10 22h4" />
                        <path d="M12 2a7 7 0 00-7 7c0 2.38 1.19 4.47 3 5.74V17a1 1 0 001 1h6a1 1 0 001-1v-2.26c1.81-1.27 3-3.36 3-5.74a7 7 0 00-7-7z" />
                      </svg>
                      <span>Hint</span>
                    </button>
                  </div>

                  {/* Collapsible Topics */}
                  {showTopics && (
                    <div className="mt-2 flex flex-wrap gap-1.5 rounded-lg border border-slate-100 bg-slate-50 p-2">
                      {problem.topics.map((t) => (
                        <span key={t} className="rounded bg-slate-200/70 px-2 py-0.5 text-xs text-slate-700">
                          {t}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Collapsible Companies */}
                  {showCompanies && (
                    <div className="mt-2 flex flex-wrap gap-1.5 rounded-lg border border-amber-100 bg-amber-50/60 p-2 text-xs text-amber-900">
                      <span className="font-semibold">Frequently Asked By:</span>
                      {["Google", "Amazon", "Microsoft", "TCS", "Infosys", "SIF360"].map((c) => (
                        <span key={c} className="rounded bg-white px-2 py-0.5 border border-amber-200 text-amber-800">
                          {c}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Collapsible Hint */}
                  {showHint && (
                    <div className="mt-2 rounded-lg border border-indigo-100 bg-indigo-50/60 p-3 text-xs text-indigo-900">
                      <p className="font-bold">Hint 1:</p>
                      <p className="mt-1">
                        A brute force approach checks all pairs in O(n²). Can you use a hash map to look up the complement in O(1)?
                      </p>
                    </div>
                  )}
                </div>

                {/* Problem Statement */}
                <div className="prose prose-slate max-w-none text-sm leading-relaxed">
                  <p className="whitespace-pre-wrap">{problem.description}</p>
                </div>

                {/* Examples */}
                <div className="space-y-4">
                  {effectiveExamples.map((example, idx) => (
                    <div key={idx} className="space-y-1.5">
                      <p className="text-xs font-bold text-slate-800">Example {idx + 1}:</p>
                      <div className="rounded-md border border-slate-200 bg-slate-50/70 p-3 font-mono text-xs text-slate-800 space-y-1">
                        <div>
                          <span className="font-semibold text-slate-500">Input: </span>
                          <span className="break-all">{example.input}</span>
                        </div>
                        {/* Visual 2D Matrix Grid for Input if present and problem is a 2D matrix problem */}
                        {isMatrix && <MatrixVisualizer data={example.input} title="Input Matrix Grid" problem={problem} />}

                        <div className="pt-1">
                          <span className="font-semibold text-slate-500">Output: </span>
                          <span className="break-all">{example.output}</span>
                        </div>
                        {/* Visual 2D Matrix Grid for Output if present and problem is a 2D matrix problem */}
                        {isMatrix && <MatrixVisualizer data={example.output} title="Expected Output Matrix" problem={problem} />}

                        {example.explanation && (
                          <div className="pt-1">
                            <span className="font-semibold text-slate-500">Explanation: </span>
                            <span className="font-sans text-slate-700 leading-relaxed">{example.explanation}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Constraints */}
                <div className="space-y-2">
                  <p className="text-xs font-bold text-slate-800">Constraints:</p>
                  <ul className="list-disc space-y-1 pl-5 font-mono text-xs text-slate-700">
                    {problem.constraints.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </div>

                {/* Follow up */}
                <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 text-xs text-slate-700">
                  <span className="font-bold text-slate-900">Follow-up: </span>
                  Can you come up with an algorithm that is less than O(n²) time complexity?
                </div>

                {/* Social Footer Bar */}
                <div className="flex flex-wrap items-center justify-between border-t border-slate-100 pt-4 text-xs text-slate-500">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setLiked((v) => !v)}
                      className={`flex items-center gap-1 rounded px-2 py-1 hover:bg-slate-100 ${liked ? "text-blue-600 font-bold" : ""}`}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill={liked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
                        <path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3zM7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3" />
                      </svg>
                      <span>{liked ? "70.8K" : "70.7K"}</span>
                    </button>

                    <button
                      onClick={() => setDisliked((v) => !v)}
                      className={`flex items-center gap-1 rounded px-2 py-1 hover:bg-slate-100 ${disliked ? "text-rose-600 font-bold" : ""}`}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill={disliked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
                        <path d="M10 15v4a3 3 0 003 3l4-9V2H5.72a2 2 0 00-2 1.7l-1.38 9a2 2 0 002 2.3zm7-13h3a2 2 0 012 2v7a2 2 0 01-2 2h-3" />
                      </svg>
                    </button>

                    <button className="flex items-center gap-1 rounded px-2 py-1 hover:bg-slate-100">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                      </svg>
                      <span>2.1K</span>
                    </button>

                    <button
                      onClick={() => setSavedBookmark((v) => !v)}
                      className={`rounded p-1 hover:bg-slate-100 ${savedBookmark ? "text-amber-500" : ""}`}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill={savedBookmark ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                      </svg>
                    </button>

                    <button className="rounded p-1 hover:bg-slate-100" title="Share Problem">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="18" cy="5" r="3" />
                        <circle cx="6" cy="12" r="3" />
                        <circle cx="18" cy="19" r="3" />
                        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                      </svg>
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5 font-medium text-emerald-600">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>898 Online</span>
                  </div>
                </div>
              </div>
            )}

            {activeLeftTab === "editorial" && (
              <div className="space-y-4 text-xs leading-relaxed">
                <h3 className="text-sm font-bold text-slate-900">Approach 1: Hash Map (Optimal)</h3>
                <p>
                  Instead of checking each element against all remaining elements in O(n²), we can store numbers visited so far in a hash map.
                </p>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono">
                  {`// Algorithm:\n1. Initialize empty hash map (value -> index).\n2. Iterate through array at index i:\n   a. complement = target - nums[i]\n   b. If complement in map, return [map[complement], i]\n   c. map[nums[i]] = i\n3. Time Complexity: O(n)\n4. Space Complexity: O(n)`}
                </div>
                <h3 className="text-sm font-bold text-slate-900 mt-4">Complexity Analysis</h3>
                <ul className="list-disc pl-5 space-y-1 text-slate-700">
                  <li><strong>Time Complexity:</strong> O(n) because we traverse the list containing n elements only once. Lookups in hash table take O(1) amortized.</li>
                  <li><strong>Space Complexity:</strong> O(n) for the extra space required by the hash map storing up to n elements.</li>
                </ul>
              </div>
            )}

            {activeLeftTab === "solutions" && (
              <div className="space-y-3 text-xs">
                <h3 className="text-sm font-bold text-slate-900">Community Solutions</h3>
                <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800">One-Pass Hash Table (Clean & Fast)</span>
                    <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-600">100% Beats</span>
                  </div>
                  <pre className="rounded bg-slate-900 p-3 text-emerald-400 font-mono text-xs overflow-x-auto">
{`class Solution {
    public int[] twoSum(int[] nums, int target) {
        Map<Integer, Integer> map = new HashMap<>();
        for (int i = 0; i < nums.length; i++) {
            int complement = target - nums[i];
            if (map.containsKey(complement)) {
                return new int[] { map.get(complement), i };
            }
            map.put(nums[i], i);
        }
        throw new IllegalArgumentException("No solution found");
    }
}`}
                  </pre>
                </div>
              </div>
            )}

            {activeLeftTab === "submissions" && (
              <div className="space-y-2">
                <h3 className="text-sm font-bold text-slate-900 mb-3">Your Submission History</h3>
                {history.length === 0 ? (
                  <p className="text-xs text-slate-400">No submissions recorded yet for this problem.</p>
                ) : (
                  <div className="divide-y divide-slate-100 text-xs">
                    {history.map((sub) => {
                      const isPassed = sub.verdict === "PASSED" || sub.verdict === "ACCEPTED";
                      return (
                        <div key={sub.submissionId} className="flex items-center justify-between py-2.5">
                          <div>
                            <span className={`font-bold ${isPassed ? "text-emerald-600" : "text-rose-600"}`}>
                              {sub.verdict}
                            </span>
                            <span className="ml-2 text-slate-400">#{sub.submissionId}</span>
                          </div>
                          <div className="flex items-center gap-3 text-slate-500">
                            <span className="font-semibold text-slate-700">{sub.score} / 100 pts</span>
                            <span>{new Date(sub.submittedAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Resizer Divider */}
        <div
          className="w-1 cursor-col-resize hover:bg-indigo-400 transition-colors bg-transparent rounded"
          onMouseDown={(event) => {
            const startX = event.clientX;
            const startWidth = panelWidth;
            const onMove = (moveEvent: MouseEvent) => {
              const delta = ((moveEvent.clientX - startX) / window.innerWidth) * 100;
              const next = Math.min(65, Math.max(30, startWidth + delta));
              setPanelWidth(next);
              localStorage.setItem("placementpro:ide:problemWidth", String(next));
            };
            const onUp = () => {
              window.removeEventListener("mousemove", onMove);
              window.removeEventListener("mouseup", onUp);
            };
            window.addEventListener("mousemove", onMove);
            window.addEventListener("mouseup", onUp);
          }}
        />

        {/* ==================== RIGHT PANEL (CODE + TESTCASES) ==================== */}
        <section className="flex flex-1 flex-col min-w-[340px] rounded-lg border border-slate-200 bg-white overflow-hidden shadow-sm">
          {/* Top Half: Code Editor */}
          <div style={{ height: `${editorHeight}%` }} className="flex flex-col min-h-[240px]">
            {/* Editor Header */}
            <div className="flex h-10 shrink-0 items-center justify-between border-b border-slate-200 bg-slate-50/70 px-3">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-emerald-600">
                    <polyline points="16 18 22 12 16 6" />
                    <polyline points="8 6 2 12 8 18" />
                  </svg>
                  <span>Code</span>
                </div>

                {/* Language Selector */}
                <select
                  value={language}
                  onChange={(e) => changeLanguage(e.target.value)}
                  className="rounded border border-slate-200 bg-white px-2 py-0.5 text-xs font-semibold text-slate-800 outline-none hover:border-slate-300 focus:ring-1 focus:ring-indigo-400"
                >
                  {problem.supportedLanguages.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>

                {/* Auto Save Pill */}
                <div className="flex items-center gap-1 text-[11px] text-slate-400 font-medium">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  <span>Auto</span>
                </div>
              </div>

              {/* Editor Right Toolbar */}
              <div className="flex items-center gap-1">
                <button
                  onClick={resetCode}
                  title="Reset to Template"
                  className="rounded p-1 text-slate-500 hover:bg-slate-200/60 hover:text-slate-800"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                    <path d="M3 3v5h5" />
                  </svg>
                </button>

                <button
                  onClick={() => setShortcutsOpen(true)}
                  title="Shortcuts"
                  className="rounded p-1 text-slate-500 hover:bg-slate-200/60 hover:text-slate-800"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="2" y="4" width="20" height="16" rx="2" />
                    <path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M8 12h.01M12 12h.01M16 12h.01M7 16h10" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Monaco Editor Container */}
            <div className="relative flex-1 min-h-0">
              <MonacoEditor
                value={code}
                language={selectedLanguage?.editorLanguage || language}
                theme={resolvedTheme === "dark" ? "vs-dark" : "vs"}
                options={editorOptions}
                onChange={(value) => setCode(value || "")}
                onMount={(editorInstance, monaco) => {
                  const blocked = () => {
                    setError("Copy/paste is strictly monitored during this coding assessment.");
                    window.setTimeout(() => setError((prev) => (prev.startsWith("Copy/paste") ? "" : prev)), 2500);
                  };
                  editorInstance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyC, blocked);
                  editorInstance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyX, blocked);
                  editorInstance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyV, blocked);
                  editorInstance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyV, blocked);
                  const domNode = editorInstance.getDomNode();
                  domNode?.addEventListener("copy", (e) => { e.preventDefault(); blocked(); });
                  domNode?.addEventListener("cut", (e) => { e.preventDefault(); blocked(); });
                  domNode?.addEventListener("paste", (e) => { e.preventDefault(); blocked(); });
                }}
              />
            </div>

            {/* Editor Sub-Footer */}
            <div className="flex h-6 shrink-0 items-center justify-between border-t border-slate-200 bg-slate-50/50 px-3 text-[11px] text-slate-400">
              <span>Saved</span>
              <span>Ln 1, Col 1</span>
            </div>
          </div>

          {/* Vertical Resizer Handle */}
          <div
            className="h-1 cursor-row-resize hover:bg-indigo-400 transition-colors bg-slate-200"
            onMouseDown={(event) => {
              const startY = event.clientY;
              const startHeight = editorHeight;
              const containerHeight = window.innerHeight;
              const onMove = (moveEvent: MouseEvent) => {
                const delta = ((moveEvent.clientY - startY) / containerHeight) * 100;
                const next = Math.min(80, Math.max(35, startHeight + delta));
                setEditorHeight(next);
              };
              const onUp = () => {
                window.removeEventListener("mousemove", onMove);
                window.removeEventListener("mouseup", onUp);
              };
              window.addEventListener("mousemove", onMove);
              window.addEventListener("mouseup", onUp);
            }}
          />

          {/* Bottom Half: Testcase & Test Result Tabs */}
          <div className="flex flex-1 flex-col min-h-[160px] bg-white">
            {/* Tabs Bar */}
            <div className="flex h-10 shrink-0 items-center justify-between border-b border-slate-200 bg-slate-50/70 px-3">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setActiveBottomTab("testcase")}
                  className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                    activeBottomTab === "testcase"
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-emerald-500">
                    <polyline points="9 11 12 14 22 4" />
                    <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
                  </svg>
                  <span>Testcase</span>
                </button>

                <button
                  onClick={() => setActiveBottomTab("result")}
                  className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                    activeBottomTab === "result"
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-indigo-500">
                    <polyline points="4 17 10 11 4 5" />
                    <line x1="12" y1="19" x2="20" y2="19" />
                  </svg>
                  <span>Test Result</span>
                </button>
              </div>

              {error && (
                <div className="text-[11px] font-semibold text-rose-600 truncate max-w-[280px]">
                  {error}
                </div>
              )}
            </div>

            {/* Tab Panel Body */}
            <div className="flex-1 min-h-0 overflow-y-auto p-4 text-xs">
              {activeBottomTab === "testcase" ? (
                <div className="space-y-3">
                  {/* Case Pill Selector */}
                  <div className="flex items-center gap-1.5">
                    {effectiveExamples.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setActiveCaseIndex(i)}
                        className={`rounded-md px-2.5 py-1 font-semibold transition ${
                          activeCaseIndex === i
                            ? "bg-slate-200/80 text-slate-900"
                            : "bg-slate-100 text-slate-500 hover:bg-slate-200/50"
                        }`}
                      >
                        Case {i + 1}
                      </button>
                    ))}
                    <button
                      onClick={() => setActiveCaseIndex(effectiveExamples.length)}
                      className={`rounded-md px-2.5 py-1 font-semibold transition ${
                        activeCaseIndex === effectiveExamples.length
                          ? "bg-slate-200/80 text-slate-900"
                          : "bg-slate-100 text-slate-500 hover:bg-slate-200/50"
                      }`}
                    >
                      + Custom
                    </button>
                  </div>

                  {/* Active Case Details */}
                  {activeCaseIndex < effectiveExamples.length ? (
                    <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/50 p-3">
                      <div>
                        <span className="font-semibold text-slate-500">Input:</span>
                        <pre className="mt-1 rounded bg-white p-2 font-mono text-slate-800 border border-slate-100 overflow-x-auto">
                          {effectiveExamples[activeCaseIndex]?.input}
                        </pre>
                        {isMatrix && <MatrixVisualizer data={effectiveExamples[activeCaseIndex]?.input || ""} title="Input Matrix Grid" problem={problem} />}
                      </div>
                      <div>
                        <span className="font-semibold text-slate-500">Expected Output:</span>
                        <pre className="mt-1 rounded bg-white p-2 font-mono text-slate-800 border border-slate-100 overflow-x-auto">
                          {effectiveExamples[activeCaseIndex]?.output}
                        </pre>
                        {isMatrix && <MatrixVisualizer data={effectiveExamples[activeCaseIndex]?.output || ""} title="Expected Output Matrix" problem={problem} />}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/50 p-3">
                      <div>
                        <span className="font-semibold text-slate-500">Custom Input:</span>
                        <textarea
                          value={customInput}
                          onChange={(e) => setCustomInput(e.target.value)}
                          placeholder="e.g. nums = [2,7,11,15], target = 9"
                          rows={2}
                          className="mt-1 w-full rounded border border-slate-200 bg-white p-2 font-mono text-slate-800 outline-none focus:border-indigo-400"
                        />
                      </div>
                      <div>
                        <span className="font-semibold text-slate-500">Expected Output (Optional):</span>
                        <input
                          value={customExpected}
                          onChange={(e) => setCustomExpected(e.target.value)}
                          placeholder="e.g. [0,1]"
                          className="mt-1 w-full rounded border border-slate-200 bg-white p-2 font-mono text-slate-800 outline-none focus:border-indigo-400"
                        />
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Test Result Tab */
                <div className="h-full">
                  {!result ? (
                    <div className="flex h-full min-h-[120px] items-center justify-center text-slate-400 font-medium">
                      You must run your code first
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* Result Summary Bar */}
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-base font-bold ${
                              result.status === "ACCEPTED" || result.status === "SUCCESS"
                                ? "text-emerald-600"
                                : "text-rose-600"
                            }`}
                          >
                            {result.status === "SUCCESS" ? "Accepted" : result.status}
                          </span>
                          <span className="text-slate-400">|</span>
                          <span className="text-slate-500">
                            Runtime: <strong className="text-slate-700">{result.runtimeMs} ms</strong>
                          </span>
                          <span className="text-slate-400">|</span>
                          <span className="text-slate-500">
                            Memory: <strong className="text-slate-700">{result.memoryMb} MB</strong>
                          </span>
                        </div>
                        {"score" in result && (
                          <div className="rounded bg-indigo-50 px-2 py-0.5 text-xs font-bold text-indigo-700">
                            Score: {result.score} / 100
                          </div>
                        )}
                      </div>

                      {/* Results Cases */}
                      {"results" in result && result.results.length > 0 && (
                        <div>
                          <div className="flex items-center gap-1 mb-2">
                            {result.results.map((r, i) => (
                              <button
                                key={i}
                                onClick={() => setActiveResultCaseIndex(i)}
                                className={`rounded px-2.5 py-1 text-xs font-semibold ${
                                  activeResultCaseIndex === i
                                    ? "bg-slate-200 text-slate-900"
                                    : "bg-slate-100 text-slate-600 hover:bg-slate-200/50"
                                }`}
                              >
                                {r.name}
                              </button>
                            ))}
                          </div>

                          {result.results[activeResultCaseIndex] && (
                            <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/50 p-3">
                              <div>
                                <span className="font-semibold text-slate-500">Input:</span>
                                <pre className="mt-1 rounded bg-white p-2 font-mono text-slate-800 border border-slate-100 overflow-x-auto">
                                  {result.results[activeResultCaseIndex].input}
                                </pre>
                                {isMatrix && <MatrixVisualizer data={result.results[activeResultCaseIndex].input || ""} title="Input Matrix Grid" problem={problem} />}
                              </div>
                              <div>
                                <span className="font-semibold text-slate-500">Your Output:</span>
                                <pre className="mt-1 rounded bg-white p-2 font-mono text-slate-800 border border-slate-100 overflow-x-auto">
                                  {result.results[activeResultCaseIndex].actual || "--"}
                                </pre>
                                {isMatrix && result.results[activeResultCaseIndex].actual && (
                                  <MatrixVisualizer data={result.results[activeResultCaseIndex].actual} title="Your Output Matrix" problem={problem} />
                                )}
                              </div>
                              <div>
                                <span className="font-semibold text-slate-500">Expected Output:</span>
                                <pre className="mt-1 rounded bg-white p-2 font-mono text-slate-800 border border-slate-100 overflow-x-auto">
                                  {result.results[activeResultCaseIndex].expected}
                                </pre>
                                {isMatrix && result.results[activeResultCaseIndex].expected && (
                                  <MatrixVisualizer data={result.results[activeResultCaseIndex].expected} title="Expected Output Matrix" problem={problem} />
                                )}
                              </div>
                              {result.results[activeResultCaseIndex].error && (
                                <div className="text-rose-600 font-mono mt-1">
                                  {result.results[activeResultCaseIndex].error}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Console stdout if any */}
                      {result.console && (
                        <div>
                          <p className="font-semibold text-slate-500 mb-1">Standard Output:</p>
                          <pre className="rounded bg-slate-900 p-2.5 font-mono text-xs text-slate-200 max-h-32 overflow-y-auto">
                            {result.console}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      {/* ==================== SETTINGS MODAL ==================== */}
      {settingsOpen && (
        <Dialog title="Editor Settings" onClose={() => setSettingsOpen(false)}>
          <div className="grid gap-3 text-xs text-slate-700">
            <label className="grid gap-1">
              <span className="font-semibold">Theme</span>
              <select
                value={theme}
                onChange={(e) => setTheme(e.target.value as "light" | "dark" | "system")}
                className="rounded border border-slate-200 p-2"
              >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
                <option value="system">System</option>
              </select>
            </label>
            <label className="grid gap-1">
              <span className="font-semibold">Font Size</span>
              <select
                value={fontSize}
                onChange={(e) => setFontSize(Number(e.target.value))}
                className="rounded border border-slate-200 p-2"
              >
                {[12, 13, 14, 15, 16, 18, 20].map((s) => (
                  <option key={s} value={s}>{s}px</option>
                ))}
              </select>
            </label>
            <label className="grid gap-1">
              <span className="font-semibold">Tab Size</span>
              <select
                value={tabSize}
                onChange={(e) => setTabSize(Number(e.target.value))}
                className="rounded border border-slate-200 p-2"
              >
                <option value={2}>2 spaces</option>
                <option value={4}>4 spaces</option>
              </select>
            </label>
            <Toggle label="Word Wrap" checked={wordWrap} onChange={setWordWrap} />
            <Toggle label="Auto Save Code" checked={autoSave} onChange={setAutoSave} />
            <Toggle label="Show Minimap" checked={minimap} onChange={setMinimap} />
          </div>
        </Dialog>
      )}

      {/* ==================== SHORTCUTS MODAL ==================== */}
      {shortcutsOpen && (
        <Dialog title="Keyboard Shortcuts" onClose={() => setShortcutsOpen(false)}>
          <div className="space-y-2 text-xs text-slate-700">
            <Shortcut combo="Ctrl + Enter" label="Run Code" />
            <Shortcut combo="Ctrl + Shift + Enter" label="Submit Solution" />
            <Shortcut combo="Ctrl + S" label="Save Code Locally" />
            <Shortcut combo="Ctrl + F" label="Find in Editor" />
            <Shortcut combo="Ctrl + H" label="Replace in Editor" />
            <Shortcut combo="Esc" label="Close Modals / Overlays" />
          </div>
        </Dialog>
      )}
    </div>
  );
}

function Dialog({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900">{title}</h2>
          <button onClick={onClose} className="rounded p-1 text-slate-400 hover:text-slate-700">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Shortcut({ combo, label }: { combo: string; label: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-2.5">
      <kbd className="rounded border border-slate-300 bg-white px-2 py-0.5 font-mono text-[11px] font-bold text-slate-800">
        {combo}
      </kbd>
      <span className="font-medium text-slate-600">{label}</span>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex items-center justify-between rounded-lg bg-slate-50 p-2.5 font-semibold text-slate-700">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-indigo-600 rounded"
      />
    </label>
  );
}
