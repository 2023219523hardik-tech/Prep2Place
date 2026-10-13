"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ApiError } from "@/lib/api";
import { AttemptView, AttemptResult, studentTestsApi } from "@/lib/managedTests";
import { type MockTestPolicy } from "@/components/MockTestGuard";
import SecureTestEnvironment from "@/components/secure-test/SecureTestEnvironment";
import LoadingState from "@/components/LoadingState";
import ErrorState from "@/components/ErrorState";

export default function ManagedMockTestPage() {
  const params = useParams();
  const router = useRouter();
  const attemptId = Number(params?.attemptId);

  const [attempt, setAttempt] = useState<AttemptView | null>(null);
  const [activeSectionIndex, setActiveSectionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const [result, setResult] = useState<AttemptResult | null>(null);
  const lastInteractionRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!attemptId) return;
    studentTestsApi.attempt(attemptId)
      .then((data) => {
        setAttempt(data);
        setRemaining(data.remainingSeconds || 0);
        const nextAnswers = Object.fromEntries(
          Object.entries(data.answers || {}).map(([questionId, answer]) => [questionId, answer.response])
        );
        setAnswers(nextAnswers);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : "Failed to load test"))
      .finally(() => setLoading(false));
  }, [attemptId]);

  useEffect(() => {
    if (!attempt || attempt.status !== "IN_PROGRESS" || result) return;
    const interval = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          void submit();
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt?.status, result]);

  const activeSection = useMemo(
    () => attempt?.sections[activeSectionIndex] ?? attempt?.sections[0] ?? null,
    [attempt, activeSectionIndex]
  );

  const policy: MockTestPolicy | null = useMemo(() => {
    if (!attempt) return null;
    return {
      screenShareRequired: false,
      cameraRequired: Boolean(attempt.webcamRequired),
      microphoneRequired: false,
      fullscreenRequired: Boolean(attempt.fullscreenRequired),
      allowCopy: true,
      allowPaste: true,
      allowContextMenu: true,
    };
  }, [attempt]);

  if (loading) return <LoadingState label="Loading managed test..." />;
  if (error) return <ErrorState message={error} />;
  if (!attempt || !activeSection) return null;

  if (result) {
    return <ResultView result={result} onBack={() => router.push("/mock-tests")} />;
  }

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const answeredCount = Object.values(answers).filter(
    (a) => a && (a.selectedOption || (Array.isArray(a.selectedOptions) && a.selectedOptions.length > 0))
  ).length;

  const handleSelect = async (question: any, optionKey: string) => {
    const current = answers[String(question.id)] ?? {};
    let nextResponse: Record<string, any>;

    if (question.questionType === "MCQ_MULTI") {
      const selected = Array.isArray(current.selectedOptions) ? current.selectedOptions : [];
      const updated = selected.includes(optionKey)
        ? selected.filter((key: string) => key !== optionKey)
        : [...selected, optionKey];
      nextResponse = { selectedOptions: updated };
    } else {
      nextResponse = { selectedOption: current.selectedOption === optionKey ? null : optionKey };
    }

    setAnswers((prev) => ({ ...prev, [String(question.id)]: nextResponse }));

    const now = Date.now();
    const timeSpent = Math.max(1, Math.round((now - lastInteractionRef.current) / 1000));
    lastInteractionRef.current = now;

    try {
      await studentTestsApi.saveAnswer(attemptId, {
        questionId: question.id,
        sectionId: activeSection.sectionId,
        response: nextResponse,
        markedForReview: false,
        timeSpentSeconds: timeSpent,
      });
    } catch {
      // Best-effort autosave; the test remains usable even if the save request fails once.
    }
  };

  const submit = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await studentTestsApi.submit(attemptId);
      setResult(res);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to submit test");
      setSubmitting(false);
    }
  };

  const content = (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Managed Test</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">{attempt.testName}</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-600">
            {answeredCount} answered
          </span>
          <span className={`rounded-lg px-3 py-1.5 text-sm font-bold ${remaining < 60 ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-700"}`}>
            {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
          </span>
          <button onClick={submit} disabled={submitting} className="btn-primary text-sm">
            {submitting ? "Submitting..." : "Submit test"}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {attempt.sections.map((section, index) => (
          <button
            key={section.sectionId}
            type="button"
            onClick={() => setActiveSectionIndex(index)}
            className={`rounded-xl border px-3 py-2 text-sm font-medium ${
              activeSectionIndex === index
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-200 bg-white text-slate-600"
            }`}
          >
            {section.name}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{activeSection.name}</h2>
            <p className="text-sm text-slate-500">{activeSection.questions.length} question(s)</p>
          </div>
          <div className="flex items-center gap-2">
            {activeSection.durationMinutes > 0 && (
              <span className="rounded-lg bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">
                {activeSection.durationMinutes} min
              </span>
            )}
            <span className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
              {activeSection.sectionType}
            </span>
          </div>
        </div>

        <div className="space-y-5">
          {activeSection.questions.map((question, questionIndex) => {
            const response = answers[String(question.id)] ?? {};
            const options = Array.isArray(question.payload?.options) ? question.payload.options : [];
            const selected = question.questionType === "MCQ_MULTI"
              ? (Array.isArray(response.selectedOptions) ? response.selectedOptions : [])
              : response.selectedOption ?? null;

            return (
              <div key={question.id} className="rounded-xl border border-slate-200 p-4">
                <p className="mb-3 text-sm font-semibold text-slate-700">Q{questionIndex + 1}</p>
                <p className="mb-4 whitespace-pre-wrap text-base leading-7 text-slate-800">{question.title}</p>

                {options.length > 0 ? (
                  <div className="space-y-2">
                    {options.map((option: any) => {
                      const isSelected = question.questionType === "MCQ_MULTI"
                        ? (selected as string[]).includes(option.key)
                        : selected === option.key;

                      return (
                        <button
                          key={option.key}
                          type="button"
                          onClick={() => handleSelect(question, option.key)}
                          className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left text-sm transition ${
                            isSelected
                              ? "border-cyan-500 bg-cyan-50 text-cyan-900"
                              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          <span className={`flex h-6 w-6 items-center justify-center rounded-full border text-xs font-bold ${
                            isSelected ? "border-cyan-500 bg-cyan-500 text-white" : "border-slate-300 text-slate-500"
                          }`}>
                            {option.key}
                          </span>
                          <span>{option.text}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">No answer options were attached to this question.</p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  if (attempt.proctored && policy) {
    return (
      <SecureTestEnvironment attemptId={attemptId} profile={policy} title={attempt.testName}>
        {content}
      </SecureTestEnvironment>
    );
  }

  return content;
}

function ResultView({ result, onBack }: { result: AttemptResult; onBack: () => void }) {
  return (
    <div className="mx-auto max-w-3xl space-y-5 py-8">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Test Submitted</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">{result.testName}</h1>
          </div>
          <button onClick={onBack} className="btn-secondary text-sm">Back to tests</button>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Score" value={`${Math.round(result.percentage)}%`} />
          <Stat label="Marks" value={`${result.scoredMarks} / ${result.totalMarks}`} />
          <Stat label="Correct" value={String(result.correctCount)} />
          <Stat label="Accuracy" value={`${Math.round(result.accuracy)}%`} />
        </div>
      </div>

      {result.sectionResults?.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Section-wise performance</h2>
          <div className="space-y-3">
            {result.sectionResults.map((s) => (
              <div key={s.sectionId} className="flex items-center justify-between rounded-xl border border-slate-100 p-3">
                <div>
                  <p className="font-medium text-slate-800">{s.name}</p>
                  <p className="text-xs text-slate-500">{s.sectionType}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-slate-900">{s.scoredMarks} / {s.totalMarks}</p>
                  <p className="text-xs text-slate-500">{Math.round(s.percentage)}%</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-4 text-center">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-bold text-slate-900">{value}</p>
    </div>
  );
}
