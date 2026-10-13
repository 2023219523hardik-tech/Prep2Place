"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { api, ApiError } from "@/lib/api";
import ErrorState from "@/components/ErrorState";
import { Icon } from "@/components/ui/Icon";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";

interface Question {
  id: number;
  text: string;
  topic: string;
  difficulty: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
}

interface AttemptResult {
  attemptId: number;
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

interface AptitudeModule {
  id: string;
  label: string;
  icon: string;
  description: string;
  topics: string[];
}

const APTITUDE_MODULES: AptitudeModule[] = [
  {
    id: "ALL",
    label: "All Modules",
    icon: "layers",
    description: "Complete aptitude curriculum with all topic drills",
    topics: [],
  },
  {
    id: "QUANT",
    label: "Quantitative Aptitude",
    icon: "calculator",
    description: "Arithmetic, algebra, geometry, numbers & business math",
    topics: [
      "Algebra",
      "Averages",
      "Boats and Streams",
      "Clocks and Calendars",
      "Geometry & Mensuration",
      "HCF and LCM",
      "Mixtures & Alligations",
      "Number Systems",
      "Partnership",
      "Percentages",
      "Permutations & Combinations",
      "Pipes and Cisterns",
      "Probability",
      "Problems on Trains",
      "Profit & Loss",
      "Profit and Loss",
      "Progressions",
      "Ratio & Proportion",
      "Ratio and Proportion",
      "Simple & Compound Interest",
      "Simple and Compound Interest",
      "Simplification",
      "Surds and Indices",
      "Time & Work",
      "Time Speed & Distance",
      "Time-Speed-Distance",
      "Trigonometry",
    ],
  },
  {
    id: "LOGICAL",
    label: "Logical Reasoning",
    icon: "brain",
    description: "Deductive reasoning, arrangements, series & puzzles",
    topics: [
      "Analogies",
      "Blood Relations",
      "Cause and Effect",
      "Coding-Decoding",
      "Course of Action",
      "Critical Reasoning (Assertion-Reason)",
      "Cubes and Dices",
      "Data Sufficiency (Reasoning)",
      "Direction Sense",
      "Input-Output",
      "Order and Ranking",
      "Puzzles",
      "Seating Arrangement",
      "Series",
      "Statement and Assumption",
      "Statement and Conclusion",
      "Syllogisms",
      "Venn Diagrams",
    ],
  },
  {
    id: "VERBAL",
    label: "Verbal Ability",
    icon: "book-open",
    description: "Grammar, reading comprehension, vocabulary & sentence logic",
    topics: [
      "Antonyms",
      "Fill in the Blanks",
      "Grammar",
      "Idioms & Phrases",
      "Idioms and Phrases",
      "One Word Substitution",
      "Para Jumbles",
      "Reading Comprehension",
      "Sentence Correction",
      "Sentence Improvement",
      "Spotting Errors",
      "Synonyms",
      "Verbal Analogies",
      "Vocabulary",
    ],
  },
  {
    id: "DI",
    label: "Data Interpretation",
    icon: "chart-bar",
    description: "Tables, charts, pie graphs, and caselet data analysis",
    topics: [
      "Bar Charts",
      "Caselet DI",
      "Data Interpretation",
      "Line Graphs",
      "Missing Data Tables",
      "Pie Charts",
      "Radar Charts",
      "Tables",
    ],
  },
];

function getModuleForTopic(topicName?: string): string {
  if (!topicName) return "QUANT";
  for (const m of APTITUDE_MODULES) {
    if (m.id === "ALL") continue;
    if (m.topics.some((t) => t.toLowerCase() === topicName.toLowerCase())) {
      return m.id;
    }
  }
  const lower = topicName.toLowerCase();
  if (lower.includes("reason") || lower.includes("logic") || lower.includes("relation") || lower.includes("series")) {
    return "LOGICAL";
  }
  if (lower.includes("verbal") || lower.includes("grammar") || lower.includes("word") || lower.includes("english")) {
    return "VERBAL";
  }
  if (lower.includes("data") || lower.includes("chart") || lower.includes("table") || lower.includes("graph")) {
    return "DI";
  }
  return "QUANT";
}

function getSuggestedPace(difficulty?: string): number {
  if (!difficulty) return 90;
  const d = difficulty.toUpperCase();
  if (d === "EASY") return 60;
  if (d === "HARD") return 120;
  return 90;
}

export default function AptitudePage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<Record<number, AttemptResult>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Module & Topic Navigation State
  const [selectedModule, setSelectedModule] = useState<string>("ALL");
  const [selectedTopic, setSelectedTopic] = useState<string>("All");
  const [explanationOpen, setExplanationOpen] = useState(true);

  // Practice State
  const [isPracticeActive, setIsPracticeActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const [showSummaryModal, setShowSummaryModal] = useState(false);

  // Suggested Pace Timer State (90 seconds countdown per question)
  const [paceMode, setPaceMode] = useState<"90s" | "auto" | "untimed">("90s");
  const [paceSecondsRemaining, setPaceSecondsRemaining] = useState(90);

  useEffect(() => {
    api
      .get<Question[]>("/api/aptitude/questions")
      .then(setQuestions)
      .catch((e) =>
        setError(e instanceof ApiError ? e.message : "Failed to load aptitude questions")
      )
      .finally(() => setLoading(false));
  }, []);

  // Filter questions based on Selected Module and Selected Topic
  const filtered = useMemo(() => {
    return questions.filter((q) => {
      if (selectedModule !== "ALL") {
        const modId = getModuleForTopic(q.topic);
        if (modId !== selectedModule) return false;
      }
      if (selectedTopic !== "All") {
        if (q.topic !== selectedTopic) return false;
      }
      return true;
    });
  }, [questions, selectedModule, selectedTopic]);

  // Topic pill options based on Selected Module
  const availableTopics = useMemo(() => {
    let pool = questions;
    if (selectedModule !== "ALL") {
      pool = questions.filter((q) => getModuleForTopic(q.topic) === selectedModule);
    }
    const raw = Array.from(new Set(pool.map((q) => q.topic).filter(Boolean))).sort();
    return ["All", ...raw];
  }, [questions, selectedModule]);

  // Module question counts
  const moduleCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: questions.length };
    for (const m of APTITUDE_MODULES) {
      if (m.id === "ALL") continue;
      counts[m.id] = questions.filter((q) => getModuleForTopic(q.topic) === m.id).length;
    }
    return counts;
  }, [questions]);

  const activeIndex = Math.min(index, Math.max(0, filtered.length - 1));
  const currentQuestion = filtered[activeIndex];
  const currentResult = currentQuestion ? results[currentQuestion.id] : undefined;

  // Initialize/reset suggested pace when active question changes
  useEffect(() => {
    if (!currentQuestion) return;
    const basePace = paceMode === "auto" ? getSuggestedPace(currentQuestion.difficulty) : 90;
    setPaceSecondsRemaining(basePace);
  }, [activeIndex, currentQuestion?.id, paceMode]);

  // Stopwatch Session Timer Ticker
  useEffect(() => {
    if (!isPracticeActive || isPaused || loading || showSummaryModal) return;
    const timer = setInterval(() => {
      setSessionSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [isPracticeActive, isPaused, loading, showSummaryModal]);

  // Suggested Pace Countdown Ticker
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

  // Session metrics
  const attemptedCount = Object.keys(results).length;
  const correctCount = Object.values(results).filter((r) => r.correct).length;
  const accuracyPct = attemptedCount > 0 ? Math.round((correctCount / attemptedCount) * 100) : 0;

  async function answer(option: string) {
    if (!currentQuestion || results[currentQuestion.id] || submitting) return;
    // Auto start session if user answers without manually pressing start
    if (!isPracticeActive) {
      setIsPracticeActive(true);
      setIsPaused(false);
    }
    setSubmitting(true);
    try {
      const res = await api.post<AttemptResult>("/api/aptitude/attempts", {
        questionId: currentQuestion.id,
        selectedOption: option,
      });
      setResults((prev) => ({ ...prev, [currentQuestion.id]: res }));
      setExplanationOpen(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to submit answer");
    } finally {
      setSubmitting(false);
    }
  }

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
    setIndex(0);
    setExplanationOpen(true);
  }

  function handleTopicChange(nextTopic: string) {
    setSelectedTopic(nextTopic);
    setIndex(0);
    setExplanationOpen(true);
  }

  function handleNextQuestion() {
    if (activeIndex < filtered.length - 1) {
      setIndex((i) => i + 1);
      setExplanationOpen(true);
    }
  }

  function handlePrevQuestion() {
    if (activeIndex > 0) {
      setIndex((i) => i - 1);
      setExplanationOpen(true);
    }
  }

  function handleEndSession() {
    setIsPaused(true);
    setShowSummaryModal(true);
  }

  function handleRestartSession() {
    setResults({});
    setSessionSeconds(0);
    setPaceSecondsRemaining(90);
    setIndex(0);
    setIsPracticeActive(true);
    setIsPaused(false);
    setShowSummaryModal(false);
  }

  function formatTime(totalSec: number): string {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }

  if (loading) {
    return (
      <div className="space-y-5 animate-pulse max-w-7xl mx-auto px-4 py-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-2">
              <Skeleton className="w-56 h-7" />
              <Skeleton className="w-80 h-4" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="w-28 h-8 rounded-full" />
              <Skeleton className="w-36 h-8 rounded-full" />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <Skeleton className="h-96 rounded-2xl" />
          <Skeleton className="h-96 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error && questions.length === 0) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <ErrorState message={error} onRetry={() => window.location.reload()} />
      </div>
    );
  }

  const currentModObj = APTITUDE_MODULES.find((m) => m.id === selectedModule) || APTITUDE_MODULES[0];

  return (
    <div className="space-y-6 pb-16 max-w-7xl mx-auto px-4 py-4 animate-slide-up">
      {/* ======================================================== */}
      {/* 1. TOP HEADER (EXACTLY MATCHING ATTACHED SCREENSHOT)     */}
      {/* ======================================================== */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 font-display">
              Aptitude Practice
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Quantitative, logical reasoning &amp; verbal ability drills
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <Icon name="check-circle" size={14} className="text-emerald-600" />
              <span>{accuracyPct}% Accuracy</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
              <span>{attemptedCount} of {questions.length} Attempted</span>
            </span>
          </div>
        </div>

        {/* Interactive Practice Controls Bar */}
        <div className="mt-5 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            {!isPracticeActive ? (
              <button
                type="button"
                onClick={handleStartPractice}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 shadow-sm transition-all transform active:scale-95 cursor-pointer"
              >
                <Icon name="play" size={14} />
                <span>Start Practice</span>
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePauseToggle}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
                    isPaused
                      ? "bg-amber-500 text-white border-amber-600 hover:bg-amber-600"
                      : "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200"
                  }`}
                >
                  {isPaused ? (
                    <Icon name="play" size={13} />
                  ) : (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                      <rect x="6" y="4" width="4" height="16" />
                      <rect x="14" y="4" width="4" height="16" />
                    </svg>
                  )}
                  <span>{isPaused ? "Resume Drill" : "Pause"}</span>
                </button>
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold bg-slate-100 text-slate-800 border border-slate-200">
                  <Icon name="clock" size={13} className="text-purple-600" />
                  <span>{formatTime(sessionSeconds)}</span>
                </span>
              </div>
            )}

            {/* Suggested Pace Selector Pill */}
            <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200 text-xs">
              <span className="text-[11px] font-semibold text-slate-500 px-2">Pacing:</span>
              <button
                type="button"
                onClick={() => setPaceMode("90s")}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                  paceMode === "90s"
                    ? "bg-white text-purple-700 shadow-xs border border-purple-200"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                90s Suggested
              </button>
              <button
                type="button"
                onClick={() => setPaceMode("auto")}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                  paceMode === "auto"
                    ? "bg-white text-purple-700 shadow-xs border border-purple-200"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Auto (Diff)
              </button>
              <button
                type="button"
                onClick={() => setPaceMode("untimed")}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                  paceMode === "untimed"
                    ? "bg-white text-purple-700 shadow-xs border border-purple-200"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Untimed
              </button>
            </div>
          </div>

          {/* Quick Module Status Tag */}
          <div className="text-xs text-slate-500 flex items-center gap-2">
            <span className="font-medium">Active Module:</span>
            <strong className="text-purple-700 font-semibold">{currentModObj.label}</strong>
            <span className="text-slate-300">•</span>
            <span>{filtered.length} drills available</span>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 2. ALL MODULES TABS (QUANT, LOGICAL, VERBAL, DI)         */}
      {/* ======================================================== */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
        {APTITUDE_MODULES.map((mod) => {
          const active = selectedModule === mod.id;
          const count = moduleCounts[mod.id] || 0;
          return (
            <button
              key={mod.id}
              type="button"
              onClick={() => handleModuleChange(mod.id)}
              className={`p-3.5 rounded-2xl border text-left transition-all flex flex-col justify-between gap-2 cursor-pointer ${
                active
                  ? "bg-purple-50/70 border-purple-500 ring-2 ring-purple-500/20 shadow-xs"
                  : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/60"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold transition-colors ${
                    active ? "bg-purple-600 text-white" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  <Icon name={mod.icon as any} size={16} />
                </span>
                <span
                  className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                    active ? "bg-purple-200/60 text-purple-900" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {count}
                </span>
              </div>
              <div>
                <div
                  className={`text-xs font-bold truncate ${
                    active ? "text-purple-950" : "text-slate-900"
                  }`}
                >
                  {mod.label}
                </div>
                <div className="text-[10px] text-slate-500 truncate mt-0.5">
                  {mod.description}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* ======================================================== */}
      {/* 3. HORIZONTAL SUB-TOPIC PILLS BAR                        */}
      {/* ======================================================== */}
      <div className="overflow-x-auto pb-2 -mx-1 px-1 scrollbar-none">
        <div className="flex items-center gap-2 min-w-max">
          {availableTopics.map((t) => {
            const active = t === selectedTopic;
            return (
              <button
                key={t}
                onClick={() => handleTopicChange(t)}
                className={`px-4 py-2 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
                  active
                    ? "bg-purple-600 text-white border-purple-600 shadow-xs"
                    : "bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                {t}
              </button>
            );
          })}
        </div>
      </div>

      {/* ======================================================== */}
      {/* 4. MAIN PRACTICE WORKSPACE (QUESTION CARD + SIDEBAR)     */}
      {/* ======================================================== */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* Left Column: Question Card & Controls */}
        <section className="space-y-5">
          {currentQuestion ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-6">
              {/* Question Metadata & Suggested Pace Countdown Pill */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-slate-700 bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
                    Question {activeIndex + 1} of {filtered.length}
                  </span>
                  {currentQuestion.topic && (
                    <span className="text-xs font-bold text-purple-700 bg-purple-50 px-3 py-1 rounded-full border border-purple-200">
                      {currentQuestion.topic}
                    </span>
                  )}
                  {currentQuestion.difficulty && (
                    <span
                      className={`text-xs px-3 py-1 rounded-full border ${
                        DIFFICULTY_STYLES[currentQuestion.difficulty.toUpperCase()] ||
                        "border-slate-200 bg-slate-50 text-slate-700"
                      }`}
                    >
                      {currentQuestion.difficulty.toUpperCase()}
                    </span>
                  )}
                </div>

                {/* Interactive Suggested Pace Display matching user prompt */}
                <div
                  className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                    !isPracticeActive || isPaused
                      ? "bg-slate-50 text-slate-500 border-slate-200"
                      : paceMode === "untimed"
                      ? "bg-slate-50 text-slate-700 border-slate-200"
                      : paceSecondsRemaining > 30
                      ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                      : paceSecondsRemaining > 10
                      ? "bg-amber-50 text-amber-800 border-amber-300"
                      : "bg-rose-50 text-rose-700 border-rose-300 animate-pulse"
                  }`}
                >
                  <Icon
                    name="clock"
                    size={14}
                    className={
                      !isPracticeActive || isPaused
                        ? "text-slate-400"
                        : paceSecondsRemaining <= 10
                        ? "text-rose-600"
                        : paceSecondsRemaining <= 30
                        ? "text-amber-600"
                        : "text-emerald-600"
                    }
                  />
                  <span>
                    Suggested pace:{" "}
                    <strong className="tabular-nums font-bold">
                      {paceMode === "untimed"
                        ? "Untimed"
                        : !isPracticeActive
                        ? "90 seconds"
                        : isPaused
                        ? `${paceSecondsRemaining}s (Paused)`
                        : `${paceSecondsRemaining} seconds`}
                    </strong>
                  </span>
                </div>
              </div>

              {/* Question Statement */}
              <div className="text-lg font-bold text-slate-900 leading-relaxed font-display">
                {currentQuestion.text}
              </div>

              {/* Options List (Letter Circle A, B, C, D) */}
              <div className="space-y-3">
                {[
                  { key: "A", text: currentQuestion.optionA },
                  { key: "B", text: currentQuestion.optionB },
                  { key: "C", text: currentQuestion.optionC },
                  { key: "D", text: currentQuestion.optionD },
                ].map(({ key, text }) => {
                  const isSelected = currentResult?.selectedOption === key;
                  const isCorrect = currentResult?.correctOption === key;
                  const isAnswered = !!currentResult;

                  let cardStyle =
                    "border-slate-200 bg-white hover:border-purple-300 hover:bg-slate-50/50 text-slate-800";
                  let badgeStyle = "bg-slate-100 text-slate-700 border-slate-200";

                  if (isAnswered) {
                    if (isCorrect) {
                      cardStyle = "border-emerald-300 bg-emerald-50/70 text-emerald-950 font-semibold";
                      badgeStyle = "bg-emerald-600 text-white border-emerald-600";
                    } else if (isSelected) {
                      cardStyle = "border-rose-300 bg-rose-50/70 text-rose-950";
                      badgeStyle = "bg-rose-600 text-white border-rose-600";
                    } else {
                      cardStyle = "border-slate-100 bg-slate-50/40 text-slate-400 opacity-60";
                    }
                  }

                  return (
                    <button
                      key={key}
                      disabled={isAnswered || submitting}
                      onClick={() => answer(key)}
                      className={`w-full text-left p-4 rounded-2xl border transition-all flex items-center justify-between gap-4 cursor-pointer ${cardStyle}`}
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <span
                          className={`w-8 h-8 rounded-xl border flex items-center justify-center font-bold text-xs shrink-0 ${badgeStyle}`}
                        >
                          {key}
                        </span>
                        <span className="text-sm leading-snug">{text}</span>
                      </div>

                      {isAnswered && isCorrect && (
                        <Icon name="check-circle" size={20} className="text-emerald-600 shrink-0" />
                      )}
                      {isAnswered && isSelected && !isCorrect && (
                        <Icon name="x" size={20} className="text-rose-600 shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Solution & Explanation Accordion */}
              {currentResult && (
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-2">
                  <button
                    type="button"
                    onClick={() => setExplanationOpen((o) => !o)}
                    className="w-full flex items-center justify-between text-left text-sm font-bold text-slate-900"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-2.5 h-2.5 rounded-full ${
                          currentResult.correct ? "bg-emerald-500" : "bg-rose-500"
                        }`}
                      />
                      <span>
                        {currentResult.correct
                          ? "Correct Answer! Well done."
                          : `Incorrect. Correct Option is ${currentResult.correctOption}.`}
                      </span>
                    </div>
                    <Icon
                      name="chevron-down"
                      size={16}
                      className={`transition-transform text-slate-500 ${
                        explanationOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {explanationOpen && currentResult.explanation && (
                    <div className="pt-2 text-sm text-slate-700 leading-relaxed border-t border-slate-200/60 whitespace-pre-line">
                      {currentResult.explanation}
                    </div>
                  )}
                </div>
              )}

              {/* Bottom Navigation matching screenshot */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <button
                  type="button"
                  disabled={activeIndex === 0}
                  onClick={handlePrevQuestion}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Icon name="chevron-left" size={14} />
                  <span>Previous</span>
                </button>

                <div className="text-xs font-bold text-slate-600 tabular-nums">
                  {activeIndex + 1} <span className="text-slate-300 mx-1">/</span> {filtered.length}
                </div>

                <button
                  type="button"
                  disabled={activeIndex >= filtered.length - 1}
                  onClick={handleNextQuestion}
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white shadow-xs disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                >
                  <span>Next</span>
                  <Icon name="chevron-right" size={14} />
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
              <EmptyState
                icon="brain"
                title="No questions available"
                description="Try picking a different category or module filter above."
                action={
                  <button
                    onClick={() => {
                      setSelectedModule("ALL");
                      setSelectedTopic("All");
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-purple-600 text-white"
                  >
                    Reset Filters
                  </button>
                }
              />
            </div>
          )}
        </section>

        {/* Right Sidebar: Session Summary & Session Controls */}
        <aside className="space-y-5">
          {/* Session Summary Card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
            <h2 className="font-display text-base font-bold text-slate-900">
              Session summary
            </h2>

            <div className="space-y-3.5">
              <ProgressRow
                label="Attempted"
                value={attemptedCount}
                max={questions.length}
                tone="bg-purple-600"
                toneBg="bg-purple-100"
              />
              <ProgressRow
                label="Correct"
                value={correctCount}
                max={Math.max(1, attemptedCount)}
                tone="bg-emerald-500"
                toneBg="bg-emerald-100"
              />
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
              <span>Avg Time / Question:</span>
              <span className="font-bold text-slate-800 tabular-nums">
                {attemptedCount > 0
                  ? `${Math.round(sessionSeconds / attemptedCount)}s`
                  : "—"}
              </span>
            </div>
          </div>

          {/* Session Controls Card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
            <h2 className="font-display text-base font-bold text-slate-900">
              Session controls
            </h2>

            <div className="space-y-3">
              {/* Live Session Timer Box matching screenshot */}
              <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-slate-50/70">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-white border border-slate-200 text-slate-600 flex items-center justify-center">
                    <Icon name="clock" size={18} />
                  </div>
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      SESSION TIME
                    </div>
                    <div className="text-sm font-extrabold text-slate-900 tabular-nums">
                      {isPracticeActive
                        ? `${formatTime(sessionSeconds)} — ${isPaused ? "paused" : "active"}`
                        : "00:00 — not timed"}
                    </div>
                  </div>
                </div>

                {isPracticeActive && (
                  <button
                    type="button"
                    onClick={handlePauseToggle}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 cursor-pointer"
                  >
                    {isPaused ? "Resume" : "Pause"}
                  </button>
                )}
              </div>

              {/* End Session Button matching screenshot */}
              <button
                type="button"
                onClick={handleEndSession}
                className="w-full py-2.5 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 shadow-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <span className="w-2.5 h-2.5 rounded-xs bg-white inline-block" />
                <span>End Session</span>
              </button>
            </div>
          </div>
        </aside>
      </div>

      {/* ======================================================== */}
      {/* 5. SESSION SUMMARY MODAL                                 */}
      {/* ======================================================== */}
      {showSummaryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-md w-full p-6 space-y-5 shadow-xl animate-scale-up">
            <div className="text-center space-y-1">
              <div className="w-14 h-14 rounded-2xl bg-purple-100 text-purple-700 mx-auto flex items-center justify-center mb-2">
                <Icon name="check-circle" size={28} />
              </div>
              <h3 className="text-xl font-extrabold text-slate-900 font-display">
                Session Completed
              </h3>
              <p className="text-xs text-slate-500">
                Performance breakdown for this practice drill.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-center">
                <div className="text-[10px] font-bold text-slate-400 uppercase">Total Time</div>
                <div className="text-lg font-bold text-slate-900 tabular-nums mt-0.5">
                  {formatTime(sessionSeconds)}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-center">
                <div className="text-[10px] font-bold text-slate-400 uppercase">Accuracy</div>
                <div className="text-lg font-bold text-emerald-600 tabular-nums mt-0.5">
                  {accuracyPct}%
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-center">
                <div className="text-[10px] font-bold text-slate-400 uppercase">Attempted</div>
                <div className="text-lg font-bold text-purple-700 tabular-nums mt-0.5">
                  {attemptedCount}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-center">
                <div className="text-[10px] font-bold text-slate-400 uppercase">Correct</div>
                <div className="text-lg font-bold text-emerald-600 tabular-nums mt-0.5">
                  {correctCount}
                </div>
              </div>
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={handleRestartSession}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold border border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
              >
                Restart Session
              </button>
              <button
                type="button"
                onClick={() => setShowSummaryModal(false)}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-700"
              >
                Continue Practice
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ProgressRow({
  label,
  value,
  max,
  tone,
  toneBg,
}: {
  label: string;
  value: number;
  max: number;
  tone: string;
  toneBg: string;
}) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-slate-600">{label}</span>
        <span className="font-bold text-slate-900 tabular-nums">
          {value} / {max}
        </span>
      </div>
      <div className={`h-2 rounded-full overflow-hidden ${toneBg}`}>
        <div
          className={`h-full rounded-full transition-all duration-300 ${tone}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
