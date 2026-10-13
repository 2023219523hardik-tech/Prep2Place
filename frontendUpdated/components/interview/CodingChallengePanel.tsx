"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center bg-slate-950 text-sm text-slate-400">Loading editor...</div>,
});

interface CodingChallengeInfo {
  problemId: number; title: string; statement: string; constraints: string[]; difficulty: string;
  methodName: string; returnType: string;
  examples: { title: string; input: string; output: string }[];
  templates: Record<string, string>;
  supportedLanguages: { id: string; name: string; version: string; editorLanguage: string; template: string; executionMode: string }[];
  savedCode: string | null; savedLanguage: string | null; deadline: string; status: string;
}
interface TestCaseResult { name: string; status: string; input: string; expected: string; actual: string; runtimeMs: number; memoryMb: number; error?: string; }
interface RunResponse { status: string; results: TestCaseResult[]; console: string; passed: number; total: number; runtimeMs: number; memoryMb: number; }
interface SubmitResult { verdict: string; scorePercent: number; passed: number; total: number; }

export default function CodingChallengePanel({ sessionId, challenge, onComplete }: {
  sessionId: string | number; challenge: CodingChallengeInfo; onComplete: () => void;
}) {
  const [language, setLanguage] = useState(challenge.savedLanguage || challenge.supportedLanguages[0]?.id || "java");
  const [code, setCode] = useState(challenge.savedCode || challenge.templates[language] || "");
  const [result, setResult] = useState<RunResponse | SubmitResult | null>(null);
  const [busy, setBusy] = useState<"run" | "submit" | null>(null);
  const [error, setError] = useState("");
  const submittedRef = useRef(false);

  const deadlineMs = useMemo(() => new Date(challenge.deadline).getTime(), [challenge.deadline]);
  const [remaining, setRemaining] = useState(() => Math.max(0, Math.round((deadlineMs - Date.now()) / 1000)));

  async function submit(reason: "manual" | "timeout") {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setBusy("submit");
    try {
      const response = await api.post<SubmitResult>(`/api/interviews/${sessionId}/coding-challenge/submit`, { language, code });
      setResult(response);
      window.setTimeout(onComplete, reason === "timeout" ? 1500 : 800);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to submit challenge");
      submittedRef.current = false; // allow a real retry on genuine failure
    } finally {
      setBusy(null);
    }
  }

  // Section 9: fixed 20-minute timer, auto-submits whatever code is present at 0:00 - the
  // candidate is scored on their last saved state, never silently zeroed for running out of time.
  useEffect(() => {
    const interval = window.setInterval(() => {
      const secs = Math.max(0, Math.round((deadlineMs - Date.now()) / 1000));
      setRemaining(secs);
      if (secs <= 0) {
        window.clearInterval(interval);
        submit("timeout");
      }
    }, 1000);
    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deadlineMs]);

  async function runCode() {
    if (busy) return;
    setBusy("run");
    setError("");
    try {
      const response = await api.post<RunResponse>(`/api/interviews/${sessionId}/coding-challenge/run`, { language, code });
      setResult(response);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Run failed");
    } finally {
      setBusy(null);
    }
  }

  const selectedLanguage = challenge.supportedLanguages.find((l) => l.id === language);
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const urgent = remaining <= 120;

  return (
    <div className="card flex h-full min-h-0 flex-col overflow-hidden p-0 shadow-premium">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-premium-600">Domain Coding Challenge</p>
          <h3 className="font-display font-bold text-slate-900">{challenge.title}</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded-lg px-3 py-1.5 text-sm font-bold ${urgent ? "bg-red-50 text-red-700 animate-pulse" : "bg-slate-100 text-slate-700"}`}>
            {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
          </span>
          <select value={language} onChange={(e) => { setLanguage(e.target.value); setCode(challenge.templates[e.target.value] || ""); }} className="input h-9 w-32 py-0 text-sm">
            {challenge.supportedLanguages.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
          <button onClick={runCode} disabled={Boolean(busy) || submittedRef.current} className="btn-secondary h-9 px-3 text-sm">
            {busy === "run" ? "Running..." : "Run"}
          </button>
          <button onClick={() => submit("manual")} disabled={Boolean(busy) || submittedRef.current} className="btn-primary h-9 px-3 text-sm">
            {busy === "submit" ? "Submitting..." : "Submit"}
          </button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden md:grid-cols-2">
        <div className="min-h-0 overflow-y-auto border-b border-slate-100 p-4 text-sm md:border-b-0 md:border-r">
          <span className="badge bg-slate-100 text-slate-600">{challenge.difficulty}</span>
          <p className="mt-3 whitespace-pre-wrap leading-6 text-slate-700">{challenge.statement}</p>
          <p className="mt-3 text-xs font-semibold text-slate-500">
            Function: <code className="rounded bg-slate-100 px-1.5 py-0.5">{selectedLanguage?.editorLanguage === "python" ? "def" : ""} {challenge.methodName}(...)</code>
          </p>
          {challenge.examples.map((ex) => (
            <pre key={ex.title} className="mt-3 overflow-auto rounded-lg bg-slate-50 p-2.5 text-xs text-slate-700">Input: {ex.input}{"\n"}Output: {ex.output}</pre>
          ))}
        </div>
        <div className="flex min-h-0 flex-col bg-slate-950">
          <div className="min-h-0 flex-1">
            <MonacoEditor
              value={code}
              language={selectedLanguage?.editorLanguage || language}
              theme="vs-dark"
              options={{ minimap: { enabled: false }, fontSize: 13, automaticLayout: true, contextmenu: false }}
              onChange={(v) => setCode(v || "")}
            />
          </div>
          <div className="h-32 shrink-0 overflow-y-auto border-t border-white/10 bg-slate-900 p-2.5 text-xs text-slate-200">
            {error && <p className="text-red-300">{error}</p>}
            {!result ? (
              <p className="text-slate-400">Run or submit to see results. Submitting ends the challenge and continues the interview.</p>
            ) : "passed" in result && "total" in result && "status" in result ? (
              <p className={result.status === "SUCCESS" ? "text-emerald-300" : "text-amber-300"}>
                {result.status} — {result.passed}/{result.total} cases passed
              </p>
            ) : (
              <p className="text-emerald-300">{result.verdict} — {result.scorePercent}% ({result.passed}/{result.total} cases)</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
