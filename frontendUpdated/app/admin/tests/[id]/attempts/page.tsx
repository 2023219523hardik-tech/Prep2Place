"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import LoadingState from "@/components/LoadingState";
import ErrorState from "@/components/ErrorState";
import { AttemptResult, AttemptSummary, labelOf, testsAdminApi } from "@/lib/managedTests";

/** Attempt list for one test, with a question-wise drill-down and the violation log. */
export default function TestAttemptsPage() {
  const params = useParams();
  const id = Number(params?.id);
  const [rows, setRows] = useState<AttemptSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState<AttemptResult | null>(null);
  const [violations, setViolations] = useState<any[]>([]);

  const load = useCallback(() => {
    if (!id) return;
    setLoading(true);
    testsAdminApi.attempts(id, page, 20)
      .then((res) => { setRows(res.content); setTotal(res.totalElements); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id, page]);

  useEffect(load, [load]);

  async function open(attemptId: number) {
    try {
      const [result, v] = await Promise.all([
        testsAdminApi.attempt(attemptId),
        testsAdminApi.attemptViolations(attemptId),
      ]);
      setDetail(result);
      setViolations(v);
    } catch (e: any) { setError(e.message); }
  }

  if (loading && rows.length === 0) return <LoadingState />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Attempts</h1>
        <Link href="/admin/tests" className="text-sm text-slate-500 hover:underline">All tests</Link>
      </div>

      {error && <ErrorState message={error} />}

      <div className="card p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="p-3">Student</th><th>Attempt</th><th>Status</th>
              <th>Score</th><th>%</th><th>Accuracy</th><th>Result</th>
              <th>Integrity</th><th>Submitted</th><th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={10} className="p-8 text-center text-slate-400">No attempts recorded yet.</td></tr>
            ) : rows.map((a) => (
              <tr key={a.attemptId} className="border-t border-slate-100">
                <td className="p-3">
                  <div className="text-slate-800">{a.studentName}</div>
                  <div className="text-xs text-slate-400">{a.studentEmail}</div>
                </td>
                <td className="text-slate-600">#{a.attemptNumber}</td>
                <td className="text-slate-600 text-xs">{a.status}</td>
                <td className="text-slate-600">{a.scoredMarks} / {a.totalMarks}</td>
                <td className="text-slate-600">{a.percentage}%</td>
                <td className="text-slate-600">{a.accuracy}%</td>
                <td>
                  <span className={`text-xs font-medium ${a.passed ? "text-teal-700" : "text-red-600"}`}>
                    {a.passed ? "Pass" : "Fail"}
                  </span>
                </td>
                <td className="text-slate-600">
                  {a.integrityScore}
                  {a.violationCount > 0 && <span className="text-xs text-amber-600 ml-1">({a.violationCount})</span>}
                </td>
                <td className="text-slate-500 text-xs">
                  {a.submittedAt ? new Date(a.submittedAt).toLocaleString() : "—"}
                </td>
                <td className="p-3">
                  <button onClick={() => open(a.attemptId)} className="text-xs text-premium-700 hover:underline">View report</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {total > 20 && (
        <div className="flex gap-2 items-center text-sm">
          <button className="btn-secondary" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</button>
          <span className="text-slate-500">Page {page + 1}</span>
          <button className="btn-secondary" disabled={(page + 1) * 20 >= total} onClick={() => setPage((p) => p + 1)}>Next</button>
        </div>
      )}

      {detail && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-start justify-center overflow-y-auto p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl my-8">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <div>
                <h2 className="font-semibold text-slate-800">{detail.studentName} — attempt #{detail.attemptNumber}</h2>
                <p className="text-xs text-slate-500">
                  {detail.scoredMarks}/{detail.totalMarks} ({detail.percentage}%) ·
                  accuracy {detail.accuracy}% · {detail.passed ? "Passed" : "Failed"}
                  {detail.percentile !== null && ` · ${detail.percentile} percentile`}
                </p>
              </div>
              <button onClick={() => setDetail(null)} className="text-slate-400 text-xl leading-none">&times;</button>
            </div>

            <div className="p-5 space-y-5">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-center text-sm">
                {[
                  ["Correct", detail.correctCount, "text-teal-700"],
                  ["Wrong", detail.wrongCount, "text-red-600"],
                  ["Unattempted", detail.unattemptedCount, "text-slate-500"],
                  ["Pending review", detail.pendingReviewCount, "text-amber-600"],
                  ["Integrity", detail.integrityScore, "text-slate-700"],
                ].map(([label, value, cls]) => (
                  <div key={label as string} className="border border-slate-200 rounded-lg p-3">
                    <div className={`text-xl font-semibold ${cls}`}>{value as number}</div>
                    <div className="text-xs text-slate-500">{label as string}</div>
                  </div>
                ))}
              </div>

              <div>
                <h3 className="font-medium text-slate-800 mb-2">Section-wise</h3>
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-slate-500">
                    <tr><th className="p-2">Section</th><th>Score</th><th>%</th><th>Correct</th><th>Wrong</th><th>Skipped</th></tr>
                  </thead>
                  <tbody>
                    {detail.sectionResults.map((s) => (
                      <tr key={s.sectionId} className="border-t border-slate-100">
                        <td className="p-2 text-slate-700">{s.name}</td>
                        <td className="text-slate-600">{s.scoredMarks}/{s.totalMarks}</td>
                        <td className="text-slate-600">{s.percentage}%</td>
                        <td className="text-teal-700">{s.correctCount}</td>
                        <td className="text-red-600">{s.wrongCount}</td>
                        <td className="text-slate-500">{s.unattemptedCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div>
                <h3 className="font-medium text-slate-800 mb-2">Question-wise</h3>
                <div className="space-y-2 max-h-[40vh] overflow-y-auto">
                  {detail.questionResults.map((q) => (
                    <div key={q.questionId} className="border border-slate-100 rounded p-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-700">{q.title}</span>
                        <span className={q.correct === true ? "text-teal-700" : q.correct === false ? "text-red-600" : "text-amber-600"}>
                          {q.correct === true ? "Correct" : q.correct === false ? "Wrong" : q.evaluationStatus}
                          {" "}({q.marksAwarded}/{q.marks})
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        {labelOf(q.questionType)} {q.topic ? `· ${q.topic}` : ""} {q.difficulty ? `· ${q.difficulty}` : ""}
                      </div>
                      <div className="text-xs text-slate-600 mt-1">
                        Answered: {JSON.stringify(q.response?.selectedOptions ?? q.response?.query ?? q.response?.code ?? "—")}
                      </div>
                      {q.solution?.correctOptions && (
                        <div className="text-xs text-slate-500">Key: {(q.solution.correctOptions as string[]).join(", ")}</div>
                      )}
                      {q.evaluationNote && <div className="text-xs text-slate-400">{q.evaluationNote}</div>}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="font-medium text-slate-800 mb-2">Integrity events</h3>
                {violations.length === 0 ? (
                  <p className="text-sm text-slate-500">No events recorded for this attempt.</p>
                ) : (
                  <>
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 text-left text-slate-500">
                        <tr><th className="p-2">Type</th><th>Severity</th><th>When</th><th>Details</th></tr>
                      </thead>
                      <tbody>
                        {violations.map((v) => (
                          <tr key={v.eventId} className="border-t border-slate-100">
                            <td className="p-2 text-slate-700">{labelOf(v.eventType)}</td>
                            <td className="text-slate-600">{v.severity}</td>
                            <td className="text-slate-500 text-xs">{new Date(v.occurredAt).toLocaleString()}</td>
                            <td className="text-slate-500 text-xs">{v.details || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p className="text-xs text-slate-500 mt-2">
                      These are recorded signals, not a finding of misconduct. Review them alongside the
                      attempt before drawing any conclusion.
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
