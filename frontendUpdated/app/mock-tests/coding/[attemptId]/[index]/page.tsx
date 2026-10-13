"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { getAttempt, AttemptView } from "@/lib/assessment";
import SecureTestEnvironment from "@/components/secure-test/SecureTestEnvironment";
import { type MockTestPolicy } from "@/components/MockTestGuard";
import LoadingState from "@/components/LoadingState";
import ErrorState from "@/components/ErrorState";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center bg-slate-950 text-sm text-slate-400">Loading editor...</div>,
});

interface LanguageConfig { id: string; name: string; version: string; editorLanguage: string; template: string; executionMode: string; }
interface ProblemExample { title: string; input: string; output: string; }
interface ProblemMetadata {
  id: number; title: string; difficulty: string; topics: string[]; description: string;
  constraints: string[]; examples: ProblemExample[]; supportedLanguages: LanguageConfig[];
  templates: Record<string, string>; timeLimitMs: number; memoryLimitMb: number; acceptanceRate: number;
}
interface QuestionNavItem { index: number; canonicalQuestionId: number; title: string; difficulty: string; solved: boolean; attempted: boolean; }
interface WorkspaceView {
  index: number; totalQuestions: number; problem: ProblemMetadata; savedCode: string | null;
  savedLanguage: string | null; solved: boolean; submissionHistory: unknown[]; navigation: QuestionNavItem[];
}
interface TestCaseResult { name: string; status: string; input: string; expected: string; actual: string; runtimeMs: number; memoryMb: number; error?: string; }
interface RunResponse { status: string; results: TestCaseResult[]; console: string; passed: number; total: number; runtimeMs: number; memoryMb: number; }
interface SubmitResult { accepted: boolean; execution: RunResponse; firstTimeSolved: boolean; attemptRawScore: number; attemptMaxScore: number; }

export default function CodingMockTestPage() {
  const params = useParams();
  const router = useRouter();
  const attemptId = params.attemptId as string;
  const index = Number(params.index ?? 0);

  const [attempt, setAttempt] = useState<AttemptView | null>(null);
  const [workspace, setWorkspace] = useState<WorkspaceView | null>(null);
  const [language, setLanguage] = useState("java");
  const [code, setCode] = useState("");
  const [result, setResult] = useState<RunResponse | SubmitResult | null>(null);
  const [busy, setBusy] = useState<"run" | "submit" | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [navOpen, setNavOpen] = useState(false);

  const load = useCallback(async (i: number) => {
    const [attemptRes, workspaceRes] = await Promise.all([
      getAttempt(attemptId),
      api.get<WorkspaceView>(`/api/coding-mock/${attemptId}/questions/${i}`),
    ]);
    setAttempt(attemptRes);
    setWorkspace(workspaceRes);
    const lang = workspaceRes.savedLanguage || workspaceRes.problem.supportedLanguages[0]?.id || "java";
    setLanguage(lang);
    setCode(workspaceRes.savedCode || workspaceRes.problem.templates[lang] || "");
    setResult(null);
  }, [attemptId]);

  useEffect(() => {
    load(index)
      .catch((e) => setError(e instanceof ApiError ? e.message : "Failed to load test"))
      .finally(() => setLoading(false));
  }, [load, index]);

  useEffect(() => {
    if (!workspace) return;
    const canonicalId = workspace.navigation[index]?.canonicalQuestionId;
    if (canonicalId == null) return;
    const handle = window.setTimeout(() => {
      api
        .post(`/api/assessments/${attemptId}/autosave`, {
          answerDelta: { [`code_${canonicalId}`]: code },
          languageDelta: { [`code_${canonicalId}`]: language },
        })
        .catch(() => undefined);
    }, 800);
    return () => window.clearTimeout(handle);
  }, [code, language, workspace, index, attemptId]);

  const policy: MockTestPolicy | null = useMemo(() => {
    if (!attempt) return null;
    const cfg = attempt.configSnapshot;
    return {
      screenShareRequired: Boolean(cfg.screenShareRequired),
      cameraRequired: Boolean(cfg.cameraRequired),
      microphoneRequired: Boolean(cfg.microphoneRequired),
      fullscreenRequired: Boolean(cfg.fullscreenRequired),
      allowCopy: Boolean(cfg.allowCopy),
      allowPaste: Boolean(cfg.allowPaste),
      allowContextMenu: Boolean(cfg.allowContextMenu),
    };
  }, [attempt]);

  async function runCode() {
    if (!workspace || busy) return;
    setBusy("run");
    try {
      const response = await api.post<RunResponse>(`/api/coding-mock/${attemptId}/questions/${index}/run`, { language, code });
      setResult(response);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Run failed");
    } finally {
      setBusy(null);
    }
  }

  async function submitCode() {
    if (!workspace || busy) return;
    setBusy("submit");
    try {
      const response = await api.post<SubmitResult>(`/api/coding-mock/${attemptId}/questions/${index}/submit`, { language, code });
      setResult(response);
      await load(index);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Submission failed");
    } finally {
      setBusy(null);
    }
  }

  async function finishTest() {
    if (!window.confirm("Submit the entire test? You won't be able to make further changes.")) return;
    try {
      await api.post(`/api/assessments/${attemptId}/submit`);
      router.push(`/mock-tests/${attemptId}/report`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to submit test");
    }
  }

  function goTo(i: number) {
    setNavOpen(false);
    router.push(`/mock-tests/coding/${attemptId}/${i}`);
  }

  if (loading) return <LoadingState label="Loading coding test..." />;
  if (error && !workspace) return <ErrorState message={error} />;
  if (!workspace || !attempt || !policy) return null;

  if (attempt.status !== "IN_PROGRESS") {
    router.replace(`/mock-tests/${attemptId}/report`);
    return <LoadingState label="Loading report..." />;
  }

  const selectedLanguage = workspace.problem.supportedLanguages.find((l) => l.id === language);

  return (
    <SecureTestEnvironment attemptId={attemptId} profile={policy} title="Coding Mock Test">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <div className="relative">
            <button onClick={() => setNavOpen((v) => !v)} className="flex items-center gap-2 text-sm font-bold text-slate-800">
              Q{index + 1}/{workspace.totalQuestions}: {workspace.problem.title}
              {workspace.solved && <span className="rounded-md border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">Solved</span>}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className={`transition-transform ${navOpen ? "rotate-180" : ""}`}>
                <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {navOpen && (
              <div className="absolute left-0 top-full z-40 mt-2 w-72 rounded-xl border border-slate-200 bg-white p-2 shadow-2xl">
                {workspace.navigation.map((q) => (
                  <button
                    key={q.index}
                    onClick={() => goTo(q.index)}
                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm ${q.index === index ? "bg-slate-100 font-semibold" : "hover:bg-slate-50"}`}
                  >
                    <span className="w-6 text-xs text-slate-400">{String(q.index + 1).padStart(2, "0")}</span>
                    <span className="flex-1 truncate">{q.title}</span>
                    {q.solved && <span className="h-2 w-2 rounded-full bg-emerald-500" />}
                    {!q.solved && q.attempted && <span className="h-2 w-2 rounded-full bg-amber-500" />}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <select value={language} onChange={(e) => setLanguage(e.target.value)} className="input h-9 w-36 py-0 text-sm">
              {workspace.problem.supportedLanguages.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
            <button onClick={runCode} disabled={Boolean(busy)} className="btn-secondary h-9 px-4 text-sm">{busy === "run" ? "Running..." : "Run"}</button>
            <button onClick={submitCode} disabled={Boolean(busy)} className="btn-primary h-9 px-4 text-sm">{busy === "submit" ? "Submitting..." : "Submit"}</button>
            <button onClick={finishTest} className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-100">
              Finish Test
            </button>
          </div>
        </div>

        <div className="grid h-[calc(100vh-260px)] min-h-[600px] gap-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card md:grid-cols-2">
          <div className="min-h-0 overflow-auto bg-white p-5 select-none">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-lg border px-2 py-1 text-xs font-bold border-slate-200 bg-slate-50 text-slate-600">{workspace.problem.difficulty}</span>
              {workspace.problem.topics.map((t) => <span key={t} className="rounded-lg bg-cyan-50 px-2 py-1 text-xs font-bold text-cyan-700">{t}</span>)}
            </div>
            <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-700">{workspace.problem.description}</p>
            <div className="mt-4 space-y-2">
              {workspace.problem.examples.map((ex) => (
                <pre key={ex.title} className="overflow-auto rounded-lg bg-slate-50 p-3 text-xs text-slate-700">Input: {ex.input}{"\n"}Output: {ex.output}</pre>
              ))}
            </div>
          </div>

          <div className="flex min-h-0 flex-col bg-slate-950">
            <div className="min-h-0 flex-1 overflow-hidden">
              <MonacoEditor
                value={code}
                language={selectedLanguage?.editorLanguage || language}
                theme="vs-dark"
                options={{ minimap: { enabled: false }, fontSize: 14, automaticLayout: true, contextmenu: false }}
                onChange={(v) => setCode(v || "")}
              />
            </div>
            <div className="h-56 overflow-auto border-t border-white/10 bg-slate-900 p-3 text-xs text-slate-200">
              {!result ? (
                <p className="text-slate-400">Run or submit your solution to see results.</p>
              ) : (
                (() => {
                  const execution: RunResponse = "execution" in result ? result.execution : result;
                  const firstTimeSolved = "firstTimeSolved" in result && result.firstTimeSolved;
                  return (
                    <div>
                      <p className={`font-bold ${execution.status === "SUCCESS" ? "text-emerald-300" : "text-amber-300"}`}>
                        {execution.status}{firstTimeSolved ? " — Solved!" : ""}
                      </p>
                      <p className="mt-1 text-slate-400">{execution.passed}/{execution.total} cases passed</p>
                      {(execution.results || []).map((t) => (
                        <details key={t.name} className="mt-2 rounded-lg border border-white/10 bg-slate-950 p-2">
                          <summary className="cursor-pointer font-semibold">{t.name} — {t.status}</summary>
                          <pre className="mt-2 whitespace-pre-wrap text-[11px] text-slate-300">Expected: {t.expected}{"\n"}Got: {t.actual || "--"}{t.error ? `\nError: ${t.error}` : ""}</pre>
                        </details>
                      ))}
                    </div>
                  );
                })()
              )}
            </div>
          </div>
        </div>
      </div>
    </SecureTestEnvironment>
  );
}
