"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { getAttempt, AttemptView } from "@/lib/assessment";
import { type MockTestPolicy } from "@/components/MockTestGuard";
import SecureTestEnvironment from "@/components/secure-test/SecureTestEnvironment";
import LoadingState from "@/components/LoadingState";
import ErrorState from "@/components/ErrorState";

interface QuestionView {
  index: number;
  canonicalQuestionId: number;
  text: string;
  topic: string;
  difficulty: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  selectedOption: string | null;
}

interface WorkspaceView {
  attemptId: number;
  remainingSeconds: number;
  totalQuestions: number;
  answeredCount: number;
  questions: QuestionView[];
}

const OPTION_KEYS = ["A", "B", "C", "D"] as const;

export default function AptitudeMockTestPage() {
  const params = useParams();
  const router = useRouter();
  const attemptId = params.attemptId as string;

  const [attempt, setAttempt] = useState<AttemptView | null>(null);
  const [workspace, setWorkspace] = useState<WorkspaceView | null>(null);
  const [current, setCurrent] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadWorkspace = useCallback(async () => {
    const [attemptRes, workspaceRes] = await Promise.all([
      getAttempt(attemptId),
      api.get<WorkspaceView>(`/api/aptitude-mock/${attemptId}`),
    ]);
    setAttempt(attemptRes);
    setWorkspace(workspaceRes);
    setRemaining(workspaceRes.remainingSeconds);
    return attemptRes;
  }, [attemptId]);

  useEffect(() => {
    loadWorkspace()
      .catch((e) => setError(e instanceof ApiError ? e.message : "Failed to load test"))
      .finally(() => setLoading(false));
  }, [loadWorkspace]);

  // Server-authoritative timer display; auto-submits client-side when it hits zero (the server
  // also enforces this independently via serverExpiresAt, so a candidate can't extend time by
  // staying on a stale tab).
  useEffect(() => {
    if (!attempt || attempt.status !== "IN_PROGRESS") return;
    const interval = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) { void submit(); return 0; }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt?.status]);

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

  async function selectOption(option: string) {
    if (!workspace) return;
    const question = workspace.questions[current];
    const nextValue = question.selectedOption === option ? null : option;
    setWorkspace({
      ...workspace,
      questions: workspace.questions.map((q, i) => (i === current ? { ...q, selectedOption: nextValue } : q)),
    });
    try {
      await api.post(`/api/aptitude-mock/${attemptId}/answer`, { index: current, selectedOption: nextValue });
    } catch {
      // best-effort autosave; a failed save doesn't block the candidate from continuing
    }
  }

  async function submit() {
    if (submitting) return;
    setSubmitting(true);
    try {
      await api.post(`/api/aptitude-mock/${attemptId}/submit`);
      router.push(`/mock-tests/${attemptId}/report`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to submit test");
      setSubmitting(false);
    }
  }

  if (loading) return <LoadingState label="Loading aptitude test..." />;
 
  if (!workspace || !attempt || !policy) return null;

  if (attempt.status !== "IN_PROGRESS") {
    // Already submitted/terminated/expired - nothing to do here but send them to the report.
    router.replace(`/mock-tests/${attemptId}/report`);
    return <LoadingState label="Loading report..." />;
  }

  const question = workspace.questions[current];
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;

  return (
    <SecureTestEnvironment attemptId={attemptId} profile={policy} title="Aptitude Mock Test">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-bold text-slate-700">
              Question {current + 1} / {workspace.totalQuestions}
            </span>
            <span className="text-sm text-slate-500">{workspace.answeredCount} answered</span>
          </div>
          <span className={`rounded-lg px-3 py-1.5 text-sm font-bold ${remaining < 60 ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-700"}`}>
            {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
          </span>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_220px]">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-lg bg-cyan-50 px-2 py-1 font-bold text-cyan-700">{question.topic || "General"}</span>
              <span className="rounded-lg bg-slate-100 px-2 py-1 font-bold text-slate-600">{question.difficulty}</span>
            </div>
            <p className="text-base leading-7 text-slate-800 select-none">{question.text}</p>
            <div className="space-y-2">
              {OPTION_KEYS.map((key) => {
                const text = { A: question.optionA, B: question.optionB, C: question.optionC, D: question.optionD }[key];
                const selected = question.selectedOption === key;
                return (
                  <button
                    key={key}
                    onClick={() => selectOption(key)}
                    className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left text-sm transition-colors ${
                      selected ? "border-cyan-400 bg-cyan-50 font-semibold text-cyan-900" : "border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${selected ? "border-cyan-500 bg-cyan-500 text-white" : "border-slate-300 text-slate-500"}`}>
                      {key}
                    </span>
                    {text}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => setCurrent((c) => Math.max(0, c - 1))}
                disabled={current === 0}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 disabled:opacity-30"
              >
                Previous
              </button>
              {current < workspace.totalQuestions - 1 ? (
                <button
                  onClick={() => setCurrent((c) => Math.min(workspace.totalQuestions - 1, c + 1))}
                  className="btn-primary text-sm"
                >
                  Next
                </button>
              ) : (
                <button onClick={submit} disabled={submitting} className="btn-primary text-sm">
                  {submitting ? "Submitting..." : "Submit Test"}
                </button>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm h-fit">
            <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Questions</p>
            <div className="grid grid-cols-5 gap-1.5 lg:grid-cols-4">
              {workspace.questions.map((q, i) => (
                <button
                  key={q.index}
                  onClick={() => setCurrent(i)}
                  className={`h-8 w-8 rounded-lg text-xs font-bold transition-colors ${
                    i === current
                      ? "bg-slate-900 text-white"
                      : q.selectedOption
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
            <button onClick={submit} disabled={submitting} className="btn-secondary mt-4 w-full text-sm">
              {submitting ? "Submitting..." : "Submit Test"}
            </button>
          </div>
        </div>
      </div>
    </SecureTestEnvironment>
  );
}
