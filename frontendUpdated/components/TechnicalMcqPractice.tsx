"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { api, ApiError, redirectToLogin } from "@/lib/api";
import ErrorState from "@/components/ErrorState";
import { Icon } from "@/components/ui/Icon";
import { Skeleton } from "@/components/ui/Skeleton";

interface Question {
  id: number;
  text: string;
  topic: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption?: string | null;
  explanation?: string | null;
}

interface AttemptResult {
  questionId: number;
  selectedOption: string;
  correctOption: string;
  correct: boolean;
  explanation?: string | null;
}

const DIFFICULTY_STYLES: Record<string, string> = {
  EASY: "border-emerald-200 bg-emerald-50 text-emerald-700 font-semibold",
  MEDIUM: "border-amber-200 bg-amber-50 text-amber-700 font-semibold",
  HARD: "border-rose-200 bg-rose-50 text-rose-700 font-semibold",
};

interface TechModule {
  id: string;
  label: string;
  icon: "layers" | "database" | "code" | "shield";
  description: string;
}

const TECH_MODULES: TechModule[] = [
  {
    id: "ALL",
    label: "All Technical Modules",
    icon: "layers",
    description: "Complete curriculum across core CS, programming languages, DSA & cloud security",
  },
  {
    id: "CORE_CS",
    label: "Core Computer Science",
    icon: "database",
    description: "Operating Systems, DBMS, Computer Networks & System Architecture",
  },
  {
    id: "LANGUAGES_DSA",
    label: "Programming & DSA",
    icon: "code",
    description: "Data Structures, Algorithms, OOP, Java, Python, C++ & Problem Solving",
  },
  {
    id: "WEB_CLOUD",
    label: "Cloud, Web & Security",
    icon: "shield",
    description: "Cloud Architecture, DevSecOps, Network & Application Security, Containers",
  },
];

function getModuleForTopic(topic: string): string {
  if (!topic) return "CORE_CS";
  const t = topic.toLowerCase().trim();

  // Cloud & Security keywords
  if (
    t.includes("cloud") ||
    t.includes("security") ||
    t.includes("threat") ||
    t.includes("vulnerabilit") ||
    t.includes("attack") ||
    t.includes("compliance") ||
    t.includes("governance") ||
    t.includes("devsecops") ||
    t.includes("container") ||
    t.includes("cryptograph") ||
    t.includes("encryption") ||
    t.includes("identity") ||
    t.includes("access") ||
    t.includes("incident") ||
    t.includes("disaster") ||
    t.includes("monitoring") ||
    t.includes("detection") ||
    t.includes("hardening") ||
    t.includes("secret") ||
    t.includes("infra") ||
    t.includes("deployment") ||
    t.includes("web") ||
    t.includes("http") ||
    t.includes("api")
  ) {
    return "WEB_CLOUD";
  }

  // Programming & DSA keywords
  if (
    t.includes("java") ||
    t.includes("python") ||
    t.includes("c++") ||
    t.includes("algo") ||
    t.includes("struct") ||
    t.includes("array") ||
    t.includes("string") ||
    t.includes("tree") ||
    t.includes("graph") ||
    t.includes("heap") ||
    t.includes("stack") ||
    t.includes("hash") ||
    t.includes("sort") ||
    t.includes("search") ||
    t.includes("linked") ||
    t.includes("dynamic") ||
    t.includes("greedy") ||
    t.includes("oop") ||
    t.includes("inherit") ||
    t.includes("polymorph") ||
    t.includes("encapsul") ||
    t.includes("abstract") ||
    t.includes("pointer") ||
    t.includes("stl") ||
    t.includes("collect") ||
    t.includes("concurr") ||
    t.includes("except") ||
    t.includes("jvm") ||
    t.includes("function") ||
    t.includes("code") ||
    t.includes("pandas") ||
    t.includes("comprehen")
  ) {
    return "LANGUAGES_DSA";
  }

  // Core CS keywords (OS, DBMS, Networks)
  if (
    t.includes("dbms") ||
    t.includes("database") ||
    t.includes("os") ||
    t.includes("operat") ||
    t.includes("network") ||
    t.includes("protocol") ||
    t.includes("deadlock") ||
    t.includes("schedul") ||
    t.includes("process") ||
    t.includes("memory") ||
    t.includes("storage") ||
    t.includes("synchron") ||
    t.includes("pipeline") ||
    t.includes("tcp") ||
    t.includes("dns") ||
    t.includes("transact") ||
    t.includes("join") ||
    t.includes("index") ||
    t.includes("normaliz") ||
    t.includes("sql")
  ) {
    return "CORE_CS";
  }

  return "CORE_CS";
}

function getSuggestedPace(difficulty: string): number {
  switch (difficulty?.toUpperCase()) {
    case "EASY":
      return 60;
    case "HARD":
      return 120;
    case "MEDIUM":
    default:
      return 90;
  }
}

const PAGE_CHUNK_SIZE = 25;

export default function TechnicalMcqPractice() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Module & Filter States
  const [selectedModule, setSelectedModule] = useState<string>("ALL");
  const [selectedTopic, setSelectedTopic] = useState<string>("All");
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [navigatorFilter, setNavigatorFilter] = useState<"ALL" | "ANSWERED" | "UNANSWERED" | "FLAGGED">("ALL");
  const [chunkPage, setChunkPage] = useState<number>(0);
  const [index, setIndex] = useState(0);

  // Attempt & Answer State
  const [results, setResults] = useState<Record<number, AttemptResult>>({});
  const [flaggedIds, setFlaggedIds] = useState<Set<number>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [explanationOpen, setExplanationOpen] = useState(true);

  // Session & Suggested Pace Timer State
  const [isPracticeActive, setIsPracticeActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const [paceMode, setPaceMode] = useState<"auto" | "90s" | "untimed">("auto");
  const [paceSecondsRemaining, setPaceSecondsRemaining] = useState(90);
  const [showSummaryModal, setShowSummaryModal] = useState(false);

  // Load Questions from Backend
  useEffect(() => {
    async function fetchQuestions() {
      setLoading(true);
      setError(null);
      try {
        let loaded: Question[] = [];
        try {
          const res = await api.get<{ content: any[]; total?: number }>(
            "/api/technical/questions?page=0&size=200"
          );
          const list = Array.isArray(res?.content) ? res.content : Array.isArray(res) ? (res as any) : [];
          if (list.length > 0) {
            loaded = list.map((item: any, idx: number) => {
              const opts = Array.isArray(item.options) ? item.options : [];
              const optA = typeof opts[0] === "string" ? opts[0] : opts[0]?.text || "Option A";
              const optB = typeof opts[1] === "string" ? opts[1] : opts[1]?.text || "Option B";
              const optC = typeof opts[2] === "string" ? opts[2] : opts[2]?.text || "Option C";
              const optD = typeof opts[3] === "string" ? opts[3] : opts[3]?.text || "Option D";
              const cIdx = item.correctIndex != null ? item.correctIndex : 0;
              const letter = ["A", "B", "C", "D"][cIdx] || "A";
              return {
                id: item.id || idx + 1,
                text: item.questionText || item.prompt || "Question prompt",
                topic: item.topic || item.categoryLabel || item.category || "Core CS",
                difficulty: (item.difficulty?.toUpperCase() || "MEDIUM") as any,
                optionA: optA,
                optionB: optB,
                optionC: optC,
                optionD: optD,
                correctOption: letter,
                explanation: item.explanation || "Review the core computer science principles and invariants.",
              };
            });
          }
        } catch (fetchErr: any) {
          if (fetchErr instanceof ApiError && (fetchErr.status === 401 || fetchErr.status === 403)) {
            redirectToLogin("/technical-mcq");
            return;
          }
          // Legacy fallback
          try {
            const legacy = await api.get<any>("/api/technical-mcq?page=0&size=200");
            const list = Array.isArray(legacy?.content) ? legacy.content : [];
            loaded = list.map((item: any, idx: number) => {
              const opts = Array.isArray(item.options) ? item.options : [];
              const optA = opts[0]?.text || "Option A";
              const optB = opts[1]?.text || "Option B";
              const optC = opts[2]?.text || "Option C";
              const optD = opts[3]?.text || "Option D";
              const cIdx = item.correctIndex != null ? item.correctIndex : 0;
              const letter = ["A", "B", "C", "D"][cIdx] || "A";
              return {
                id: item.id || idx + 1,
                text: item.questionText || "Question prompt",
                topic: item.categoryLabel || item.topic || "Core CS",
                difficulty: (item.difficulty?.toUpperCase() || "MEDIUM") as any,
                optionA: optA,
                optionB: optB,
                optionC: optC,
                optionD: optD,
                correctOption: letter,
                explanation: item.explanation || "Conceptual breakdown for core systems.",
              };
            });
          } catch (legacyErr: any) {
            if (legacyErr instanceof ApiError && (legacyErr.status === 401 || legacyErr.status === 403)) {
              redirectToLogin("/technical-mcq");
              return;
            }
          }
        }

        setQuestions(loaded);
      } catch (err: any) {
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          redirectToLogin("/technical-mcq");
          return;
        }
        setError(err instanceof ApiError ? err.message : "Failed to load technical MCQs");
      } finally {
        setLoading(false);
      }
    }

    fetchQuestions();
  }, []);

  // Filtered Questions by Module, Topic, Difficulty & Search
  const filtered = useMemo(() => {
    const qNorm = searchQuery.trim().toLowerCase();
    return questions.filter((q) => {
      if (selectedModule !== "ALL") {
        if (getModuleForTopic(q.topic) !== selectedModule) return false;
      }
      if (selectedTopic !== "All") {
        if (q.topic !== selectedTopic) return false;
      }
      if (selectedDifficulty !== "All") {
        if (q.difficulty !== selectedDifficulty) return false;
      }
      if (qNorm) {
        const matchesText = q.text.toLowerCase().includes(qNorm);
        const matchesTopic = q.topic.toLowerCase().includes(qNorm);
        if (!matchesText && !matchesTopic) return false;
      }
      return true;
    });
  }, [questions, selectedModule, selectedTopic, selectedDifficulty, searchQuery]);

  // Available Topics for Selected Module
  const availableTopics = useMemo(() => {
    let pool = questions;
    if (selectedModule !== "ALL") {
      pool = questions.filter((q) => getModuleForTopic(q.topic) === selectedModule);
    }
    const topicMap = new Map<string, number>();
    for (const q of pool) {
      if (q.topic) {
        topicMap.set(q.topic, (topicMap.get(q.topic) || 0) + 1);
      }
    }
    const sorted = Array.from(topicMap.entries()).sort((a, b) => b[1] - a[1]);
    return [{ name: "All", count: pool.length }, ...sorted.map(([name, count]) => ({ name, count }))];
  }, [questions, selectedModule]);

  // Module counts
  const moduleCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: questions.length };
    for (const m of TECH_MODULES) {
      if (m.id === "ALL") continue;
      counts[m.id] = questions.filter((q) => getModuleForTopic(q.topic) === m.id).length;
    }
    return counts;
  }, [questions]);

  const activeIndex = Math.min(index, Math.max(0, filtered.length - 1));
  const currentQuestion = filtered[activeIndex];
  const currentResult = currentQuestion ? results[currentQuestion.id] : undefined;
  const isFlagged = currentQuestion ? flaggedIds.has(currentQuestion.id) : false;

  // Pace Countdown Reset when Question Changes
  useEffect(() => {
    if (!currentQuestion) return;
    const basePace = paceMode === "auto" ? getSuggestedPace(currentQuestion.difficulty) : 90;
    setPaceSecondsRemaining(basePace);
  }, [activeIndex, currentQuestion?.id, paceMode]);

  // Keep chunkPage in sync with active index
  useEffect(() => {
    setChunkPage(Math.floor(activeIndex / PAGE_CHUNK_SIZE));
  }, [activeIndex]);

  // Session Timer
  useEffect(() => {
    if (!isPracticeActive || isPaused || loading || showSummaryModal) return;
    const timer = setInterval(() => {
      setSessionSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [isPracticeActive, isPaused, loading, showSummaryModal]);

  // Suggested Pace Countdown
  useEffect(() => {
    if (!isPracticeActive || isPaused || paceMode === "untimed" || currentResult || showSummaryModal) {
      return;
    }
    const countdown = setInterval(() => {
      setPaceSecondsRemaining((prev) => {
        if (prev <= 1) return 0;
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(countdown);
  }, [isPracticeActive, isPaused, paceMode, currentResult, showSummaryModal]);

  // Metrics
  const attemptedCount = Object.keys(results).length;
  const correctCount = Object.values(results).filter((r) => r.correct).length;
  const accuracyPct = attemptedCount > 0 ? Math.round((correctCount / attemptedCount) * 100) : 0;

  const handleOptionSelect = useCallback(
    async (optionKey: string) => {
      if (!currentQuestion || results[currentQuestion.id] || submitting) return;

      if (!isPracticeActive) {
        setIsPracticeActive(true);
        setIsPaused(false);
      }

      setSubmitting(true);
      try {
        const correctKey = currentQuestion.correctOption || "A";
        const isCorrect = optionKey.toUpperCase() === correctKey.toUpperCase();

        const result: AttemptResult = {
          questionId: currentQuestion.id,
          selectedOption: optionKey,
          correctOption: correctKey,
          correct: isCorrect,
          explanation: currentQuestion.explanation,
        };

        setResults((prev) => ({ ...prev, [currentQuestion.id]: result }));
        setExplanationOpen(true);
      } finally {
        setSubmitting(false);
      }
    },
    [currentQuestion, results, submitting, isPracticeActive]
  );

  function toggleFlagCurrent() {
    if (!currentQuestion) return;
    setFlaggedIds((prev) => {
      const next = new Set(prev);
      if (next.has(currentQuestion.id)) {
        next.delete(currentQuestion.id);
      } else {
        next.add(currentQuestion.id);
      }
      return next;
    });
  }

  // Keyboard Navigation: 1-4 for options, ArrowLeft/Right for next/prev, F for flag
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (["INPUT", "TEXTAREA", "SELECT"].includes((e.target as HTMLElement)?.tagName)) return;
      if (e.key === "1" || e.key === "a" || e.key === "A") handleOptionSelect("A");
      if (e.key === "2" || e.key === "b" || e.key === "B") handleOptionSelect("B");
      if (e.key === "3" || e.key === "c" || e.key === "C") handleOptionSelect("C");
      if (e.key === "4" || e.key === "d" || e.key === "D") handleOptionSelect("D");
      if (e.key === "f" || e.key === "F") toggleFlagCurrent();
      if (e.key === "ArrowLeft") setIndex((i) => Math.max(0, i - 1));
      if (e.key === "ArrowRight") setIndex((i) => Math.min(filtered.length - 1, i + 1));
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleOptionSelect, filtered.length]);

  function handleStartPractice() {
    setIsPracticeActive(true);
    setIsPaused(false);
  }

  function handlePauseToggle() {
    setIsPaused((p) => !p);
  }

  function handleModuleChange(modId: string) {
    setSelectedModule(modId);
    setSelectedTopic("All");
    setSelectedDifficulty("All");
    setSearchQuery("");
    setIndex(0);
    setChunkPage(0);
    setExplanationOpen(true);
  }

  function formatTime(totalSec: number) {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }

  const basePaceTotal = currentQuestion
    ? paceMode === "auto"
      ? getSuggestedPace(currentQuestion.difficulty)
      : 90
    : 90;
  const paceFraction = Math.max(0, Math.min(1, paceSecondsRemaining / basePaceTotal));
  const paceProgressWidth = `${Math.round(paceFraction * 100)}%`;

  // Navigator Question items filtered by navigatorFilter
  const navigatorItems = useMemo(() => {
    return filtered
      .map((q, idx) => ({ q, idx }))
      .filter(({ q }) => {
        const isAns = Boolean(results[q.id]);
        const isFlag = flaggedIds.has(q.id);
        if (navigatorFilter === "ANSWERED") return isAns;
        if (navigatorFilter === "UNANSWERED") return !isAns;
        if (navigatorFilter === "FLAGGED") return isFlag;
        return true;
      });
  }, [filtered, results, flaggedIds, navigatorFilter]);

  const totalChunkPages = Math.ceil(filtered.length / PAGE_CHUNK_SIZE);
  const currentChunkStart = chunkPage * PAGE_CHUNK_SIZE;
  const currentChunkItems = filtered.slice(currentChunkStart, currentChunkStart + PAGE_CHUNK_SIZE);

  return (
    <div className="space-y-6 pb-20 animate-fade-in">
      {/* ======================================================== */}
      {/* 1. TOP HEADER & LEARNING OBJECTIVE                       */}
      {/* ======================================================== */}
      <div className="rounded-3xl border border-slate-200 bg-gradient-to-r from-violet-50 via-white to-indigo-50 p-6 sm:p-8 shadow-card">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-indigo-700">
              <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
              Core Technical Mastery
            </div>
            <h1 className="mt-3 font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
              Technical MCQ & Core Concepts
            </h1>
            <p className="mt-1.5 max-w-2xl text-xs sm:text-sm text-slate-600 leading-relaxed">
              Targeted drills for DBMS, Operating Systems, Networks, OOP, and Cloud Security. Practice with pace guidance, bookmarks, and detailed conceptual solutions.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-xs">
              📚 {questions.length} Total Bank Questions
            </span>
            <span className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700">
              🎯 {accuracyPct}% Accuracy
            </span>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 2. STICKY PRACTICE SESSION CONTROL BAR                   */}
      {/* ======================================================== */}
      <div className="sticky top-20 z-30 rounded-2xl border border-slate-200 bg-white/95 backdrop-blur-md p-3.5 sm:p-4 shadow-md transition">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Left: Start / Pause Controls & Stopwatch */}
          <div className="flex items-center gap-3">
            {!isPracticeActive ? (
              <button
                type="button"
                onClick={handleStartPractice}
                className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:brightness-105 active:scale-95 transition"
              >
                <span>▶</span>
                <span>Start Practice</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handlePauseToggle}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition shadow-xs ${
                  isPaused
                    ? "bg-amber-500 text-white hover:bg-amber-600"
                    : "border border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                <span>{isPaused ? "▶ Resume" : "⏸ Pause"}</span>
              </button>
            )}

            {/* Session Stopwatch */}
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 font-mono text-xs font-bold text-slate-800">
              <span className="text-slate-400">⏱</span>
              <span>{formatTime(sessionSeconds)}</span>
              {isPracticeActive && !isPaused && (
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
              )}
            </div>

            {/* Answered Pill */}
            <div className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-600 font-semibold">
              <span>Answered:</span>
              <strong className="text-indigo-600">{attemptedCount}</strong>
              <span className="text-slate-400">/ {filtered.length}</span>
            </div>
          </div>

          {/* Right: Suggested Pace Countdown Bar & Finish CTA */}
          <div className="flex items-center gap-3 flex-1 sm:flex-initial justify-end">
            {/* Suggested Pace Indicator */}
            {paceMode !== "untimed" && (
              <div className="flex items-center gap-2.5">
                <div className="text-right">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Suggested Pace
                  </div>
                  <div
                    className={`font-mono text-xs font-extrabold ${
                      paceSecondsRemaining <= 15
                        ? "text-rose-600 animate-pulse"
                        : paceSecondsRemaining <= 30
                        ? "text-amber-600"
                        : "text-slate-700"
                    }`}
                  >
                    {paceSecondsRemaining}s remaining
                  </div>
                </div>
                <div className="w-20 sm:w-28 h-2 rounded-full bg-slate-100 overflow-hidden border border-slate-200">
                  <div
                    className={`h-full transition-all duration-1000 ${
                      paceSecondsRemaining <= 15
                        ? "bg-rose-500"
                        : paceSecondsRemaining <= 30
                        ? "bg-amber-500"
                        : "bg-indigo-600"
                    }`}
                    style={{ width: paceProgressWidth }}
                  />
                </div>
              </div>
            )}

            {/* Pace Mode Dropdown */}
            <select
              value={paceMode}
              onChange={(e) => setPaceMode(e.target.value as any)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs font-semibold text-slate-700 outline-none hover:border-slate-300"
            >
              <option value="auto">Adaptive Pace</option>
              <option value="90s">Fixed 90s</option>
              <option value="untimed">Untimed</option>
            </select>

            {/* Finish Session */}
            {attemptedCount > 0 && (
              <button
                type="button"
                onClick={() => setShowSummaryModal(true)}
                className="rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-100 transition"
              >
                Finish Session
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 3. CORE TECHNICAL MODULE SELECTOR CARDS                  */}
      {/* ======================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {TECH_MODULES.map((mod) => {
          const isSelected = selectedModule === mod.id;
          const count = moduleCounts[mod.id] || 0;

          return (
            <button
              key={mod.id}
              type="button"
              onClick={() => handleModuleChange(mod.id)}
              className={`rounded-2xl border p-4 text-left transition-all relative overflow-hidden flex flex-col justify-between ${
                isSelected
                  ? "border-indigo-500 bg-indigo-50/50 shadow-md ring-2 ring-indigo-500/20"
                  : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-xs"
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-xl text-base ${
                      isSelected
                        ? "bg-indigo-600 text-white shadow-xs"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    <Icon name={mod.icon} size={18} strokeWidth={2} />
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                      isSelected
                        ? "bg-indigo-200/60 text-indigo-900"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {count} Qs
                  </span>
                </div>
                <h3 className="font-bold text-sm text-slate-900">{mod.label}</h3>
                <p className="mt-1 text-xs text-slate-500 line-clamp-2 leading-relaxed">
                  {mod.description}
                </p>
              </div>

              {isSelected && (
                <div className="mt-3 flex items-center gap-1 text-[11px] font-bold text-indigo-600">
                  <span>Active Module</span>
                  <span>✓</span>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* ======================================================== */}
      {/* 4. SUBTOPIC & DIFFICULTY FILTER BAR                      */}
      {/* ======================================================== */}
      <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Search Bar */}
          <div className="relative flex-1 max-w-md">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Icon name="search" size={14} />
            </span>
            <input
              type="text"
              placeholder="Filter questions by keyword or topic..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setIndex(0);
              }}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            )}
          </div>

          {/* Topic Dropdown & Difficulty Selector */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-slate-400">Topic:</span>
              <select
                value={selectedTopic}
                onChange={(e) => {
                  setSelectedTopic(e.target.value);
                  setIndex(0);
                }}
                className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-700 outline-none hover:border-slate-300 max-w-[200px]"
              >
                {availableTopics.map((t) => (
                  <option key={t.name} value={t.name}>
                    {t.name} ({t.count})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-slate-400">Difficulty:</span>
              <select
                value={selectedDifficulty}
                onChange={(e) => {
                  setSelectedDifficulty(e.target.value);
                  setIndex(0);
                }}
                className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-bold text-slate-700 outline-none hover:border-slate-300"
              >
                <option value="All">All Difficulties</option>
                <option value="EASY">Easy</option>
                <option value="MEDIUM">Medium</option>
                <option value="HARD">Hard</option>
              </select>
            </div>

            {(selectedTopic !== "All" || selectedDifficulty !== "All" || searchQuery) && (
              <button
                type="button"
                onClick={() => {
                  setSelectedTopic("All");
                  setSelectedDifficulty("All");
                  setSearchQuery("");
                  setIndex(0);
                }}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold px-2 py-1 rounded-lg hover:bg-indigo-50 transition"
              >
                Reset Filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 5. REDESIGNED QUESTION NAVIGATOR                         */}
      {/* ======================================================== */}
      {filtered.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
          {/* Top Bar: Title, Status Filter Tabs & Pagination Switcher */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <span className="font-bold text-xs sm:text-sm text-slate-900">
                Question Navigator
              </span>
              <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-bold text-indigo-700">
                {activeIndex + 1} of {filtered.length}
              </span>
            </div>

            {/* Filter Tabs: All, Answered, Unanswered, Flagged */}
            <div className="flex flex-wrap items-center gap-1">
              {[
                { id: "ALL", label: `All (${filtered.length})` },
                { id: "ANSWERED", label: `Answered (${attemptedCount})` },
                { id: "UNANSWERED", label: `Unanswered (${filtered.length - attemptedCount})` },
                { id: "FLAGGED", label: `⚑ Flagged (${flaggedIds.size})` },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setNavigatorFilter(tab.id as any)}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
                    navigatorFilter === tab.id
                      ? "bg-indigo-600 text-white shadow-xs"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Chunk Page Selector (for large sets) */}
            {totalChunkPages > 1 && navigatorFilter === "ALL" && (
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <span>Batch:</span>
                <select
                  value={chunkPage}
                  onChange={(e) => setChunkPage(Number(e.target.value))}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700 outline-none"
                >
                  {Array.from({ length: totalChunkPages }, (_, i) => (
                    <option key={i} value={i}>
                      Qs {i * PAGE_CHUNK_SIZE + 1} – {Math.min((i + 1) * PAGE_CHUNK_SIZE, filtered.length)}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Navigator Pills Grid */}
          <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1">
            {(navigatorFilter === "ALL" && totalChunkPages > 1 ? currentChunkItems : navigatorItems.map((n) => n.q)).map(
              (q) => {
                // Find actual index in filtered array
                const realIdx = filtered.findIndex((item) => item.id === q.id);
                const res = results[q.id];
                const isCurrent = realIdx === activeIndex;
                const isFlag = flaggedIds.has(q.id);

                let btnClass = "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100";
                if (res) {
                  btnClass = res.correct
                    ? "border-emerald-300 bg-emerald-50 text-emerald-800 font-bold"
                    : "border-rose-300 bg-rose-50 text-rose-800 font-bold";
                }
                if (isFlag) {
                  btnClass = "border-amber-400 bg-amber-50 text-amber-900 font-bold ring-1 ring-amber-400";
                }
                if (isCurrent) {
                  btnClass = "border-indigo-600 bg-indigo-600 text-white font-extrabold shadow-sm scale-105 ring-2 ring-indigo-300";
                }

                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => setIndex(realIdx)}
                    className={`relative flex h-7.5 min-w-[30px] px-1.5 items-center justify-center rounded-lg border text-xs transition ${btnClass}`}
                    title={`Question ${realIdx + 1}: ${q.topic} (${q.difficulty})${isFlag ? " [Flagged]" : ""}`}
                  >
                    <span>{realIdx + 1}</span>
                    {isFlag && (
                      <span className="absolute -top-1 -right-1 text-[9px] text-amber-600">⚑</span>
                    )}
                  </button>
                );
              }
            )}
          </div>

          {/* Navigator Legend */}
          <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-slate-500 border-t border-slate-100">
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" /> Current
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Correct
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Incorrect
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Flagged (⚑)
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-300" /> Unanswered
            </span>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 6. MAIN QUESTION CARD & OPTIONS                          */}
      {/* ======================================================== */}
      {loading ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-8 space-y-4">
          <Skeleton className="h-6 w-1/3 rounded-lg" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <div className="space-y-3 pt-4">
            <Skeleton className="h-12 w-full rounded-xl" />
            <Skeleton className="h-12 w-full rounded-xl" />
            <Skeleton className="h-12 w-full rounded-xl" />
            <Skeleton className="h-12 w-full rounded-xl" />
          </div>
        </div>
      ) : error ? (
        <ErrorState message={error} />
      ) : !currentQuestion ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 text-xl mb-3">
            🔍
          </div>
          <h3 className="font-bold text-slate-900 text-base">No questions found</h3>
          <p className="text-xs text-slate-500 mt-1">
            No technical questions match the selected module and topic filters.
          </p>
          <button
            type="button"
            onClick={() => {
              setSelectedModule("ALL");
              setSelectedTopic("All");
              setSelectedDifficulty("All");
              setSearchQuery("");
            }}
            className="mt-4 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-500 transition shadow-xs"
          >
            Reset All Filters
          </button>
        </div>
      ) : (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-card space-y-6">
          {/* Question Header & Metadata Badges */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-extrabold text-indigo-700">
                Question {activeIndex + 1} of {filtered.length}
              </span>
              <span className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700">
                {currentQuestion.topic}
              </span>
              <span
                className={`rounded-lg border px-2 py-0.5 text-[11px] ${
                  DIFFICULTY_STYLES[currentQuestion.difficulty] || "border-slate-200 bg-slate-50 text-slate-700"
                }`}
              >
                {currentQuestion.difficulty}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Flag / Bookmark Button */}
              <button
                type="button"
                onClick={toggleFlagCurrent}
                className={`inline-flex items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-bold transition border ${
                  isFlagged
                    ? "border-amber-300 bg-amber-50 text-amber-700"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
                title="Flag this question to review later (Hotkey: F)"
              >
                <span>{isFlagged ? "⚑ Flagged" : "⚐ Flag"}</span>
              </button>

              {currentResult && (
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${
                    currentResult.correct
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-rose-100 text-rose-800"
                  }`}
                >
                  {currentResult.correct ? "✓ Correct" : "✕ Incorrect"}
                </span>
              )}
            </div>
          </div>

          {/* Question Prompt Text */}
          <div className="text-base sm:text-lg font-semibold text-slate-900 leading-relaxed">
            {currentQuestion.text}
          </div>

          {/* Options Grid (A, B, C, D) */}
          <div className="space-y-3 pt-2">
            {[
              { key: "A", text: currentQuestion.optionA, num: "1" },
              { key: "B", text: currentQuestion.optionB, num: "2" },
              { key: "C", text: currentQuestion.optionC, num: "3" },
              { key: "D", text: currentQuestion.optionD, num: "4" },
            ].map(({ key, text, num }) => {
              const isSelected = currentResult?.selectedOption === key;
              const isCorrectOption = currentResult?.correctOption === key;

              let cardStyle = "border-slate-200 bg-slate-50/60 hover:border-indigo-300 hover:bg-indigo-50/30 text-slate-800 cursor-pointer";
              let badgeStyle = "border-slate-300 bg-white text-slate-700";

              if (currentResult) {
                if (isCorrectOption) {
                  cardStyle = "border-emerald-500 bg-emerald-50/80 text-emerald-950 font-semibold shadow-xs ring-1 ring-emerald-500/20";
                  badgeStyle = "border-emerald-500 bg-emerald-600 text-white font-bold";
                } else if (isSelected && !currentResult.correct) {
                  cardStyle = "border-rose-500 bg-rose-50/80 text-rose-950 font-semibold shadow-xs ring-1 ring-rose-500/20";
                  badgeStyle = "border-rose-500 bg-rose-600 text-white font-bold";
                } else {
                  cardStyle = "border-slate-200 bg-slate-50/40 text-slate-400 opacity-60";
                }
              }

              return (
                <button
                  key={key}
                  type="button"
                  disabled={submitting || Boolean(currentResult)}
                  onClick={() => handleOptionSelect(key)}
                  className={`w-full rounded-2xl border p-4 text-left transition flex items-start gap-3.5 ${cardStyle}`}
                >
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border text-xs font-bold transition ${badgeStyle}`}
                  >
                    {key}
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm pt-0.5 leading-relaxed block">{text}</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400 hidden sm:inline-block">
                    [{num}]
                  </span>
                </button>
              );
            })}
          </div>

          {/* Explanation & Conceptual Solution Drawer */}
          {currentResult && (
            <div className="mt-6 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-5 space-y-2 animate-slide-up">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-900 flex items-center gap-1.5">
                  <span>💡</span>
                  Conceptual Solution & Explanation
                </span>
                <span className="text-xs font-semibold text-indigo-700">
                  Correct Answer: Option {currentResult.correctOption}
                </span>
              </div>
              <p className="text-xs text-indigo-950 leading-relaxed">
                {currentResult.explanation || currentQuestion.explanation}
              </p>
            </div>
          )}

          {/* Navigation Controls */}
          <div className="flex items-center justify-between border-t border-slate-100 pt-5">
            <button
              type="button"
              disabled={activeIndex <= 0}
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              <span>← Previous Question</span>
            </button>

            <span className="text-xs font-semibold text-slate-400">
              {activeIndex + 1} / {filtered.length}
            </span>

            <button
              type="button"
              disabled={activeIndex >= filtered.length - 1}
              onClick={() => setIndex((i) => Math.min(filtered.length - 1, i + 1))}
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              <span>Next Question →</span>
            </button>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 7. PRACTICE SUMMARY MODAL                                */}
      {/* ======================================================== */}
      {showSummaryModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in"
          onClick={() => setShowSummaryModal(false)}
        >
          <div
            className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-2xl animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 text-2xl mb-3">
                🎯
              </div>
              <h2 className="text-xl font-bold text-slate-900">Practice Session Summary</h2>
              <p className="text-xs text-slate-500 mt-1">
                Technical MCQ Drill Analytics & Performance Breakdown
              </p>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3 text-center">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <span className="text-[11px] text-slate-400 font-semibold block">Total Attempted</span>
                <span className="text-xl font-extrabold text-slate-900 mt-0.5">{attemptedCount}</span>
              </div>
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
                <span className="text-[11px] text-emerald-700 font-semibold block">Correct Answers</span>
                <span className="text-xl font-extrabold text-emerald-800 mt-0.5">{correctCount}</span>
              </div>
              <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-3">
                <span className="text-[11px] text-indigo-700 font-semibold block">Accuracy Rate</span>
                <span className="text-xl font-extrabold text-indigo-800 mt-0.5">{accuracyPct}%</span>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <span className="text-[11px] text-slate-400 font-semibold block">Time Elapsed</span>
                <span className="text-xl font-extrabold text-slate-900 mt-0.5 font-mono">
                  {formatTime(sessionSeconds)}
                </span>
              </div>
            </div>

            <div className="mt-6 space-y-2">
              <button
                type="button"
                onClick={() => {
                  setShowSummaryModal(false);
                  setIsPracticeActive(true);
                  setIsPaused(false);
                }}
                className="w-full rounded-xl bg-indigo-600 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-indigo-500 transition"
              >
                Continue Practicing
              </button>
              <button
                type="button"
                onClick={() => {
                  setResults({});
                  setFlaggedIds(new Set());
                  setSessionSeconds(0);
                  setIsPracticeActive(false);
                  setIsPaused(false);
                  setShowSummaryModal(false);
                }}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
              >
                Reset Session & Clear Answers
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
