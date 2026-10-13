"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import LoadingState from "@/components/LoadingState";
import ErrorState from "@/components/ErrorState";
import { TestDetail, labelOf, testsAdminApi } from "@/lib/managedTests";

/**
 * Full pre-publish preview: instructions, every section, every question with its options, the
 * correct answer and the explanation. This is an admin verification screen, so it deliberately
 * shows the answer key — the student-facing runner strips all of it server-side.
 */
export default function TestPreviewPage() {
  const params = useParams();
  const id = Number(params?.id);
  const [detail, setDetail] = useState<TestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeSection, setActiveSection] = useState(0);

  useEffect(() => {
    if (!id) return;
    testsAdminApi.preview(id)
      .then(setDetail)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;
  if (!detail) return null;

  const section = detail.sections[activeSection];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{detail.summary.name}</h1>
          <p className="text-sm text-slate-500">
            {labelOf(detail.summary.testType)} · {detail.summary.durationMinutes} min ·
            {" "}{detail.summary.totalMarks} marks · pass at {detail.summary.passingPercentage}%
            {detail.negativeMarkingEnabled ? ` · negative marking ${detail.defaultNegativeMarks}` : " · no negative marking"}
          </p>
        </div>
        <div className="flex gap-3 text-sm">
          <Link href={`/admin/tests/${id}/edit`} className="btn-secondary">Edit</Link>
          <Link href="/admin/tests" className="text-slate-500 hover:underline self-center">All tests</Link>
        </div>
      </div>

      {detail.instructions && (
        <div className="card">
          <h2 className="font-medium text-slate-800 mb-2">Instructions</h2>
          <p className="text-sm text-slate-600 whitespace-pre-wrap">{detail.instructions}</p>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {detail.sections.map((s, i) => (
          <button key={s.id} onClick={() => setActiveSection(i)}
            className={`px-3 py-1.5 rounded-lg text-sm border ${
              activeSection === i ? "bg-premium-700 text-white border-premium-700" : "bg-white text-slate-600 border-slate-200"
            }`}>
            {s.name} ({s.attachedQuestionCount})
          </button>
        ))}
      </div>

      {section && (
        <div className="card space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="font-medium text-slate-800">{section.name}</h2>
              <p className="text-xs text-slate-500">
                {labelOf(section.sectionType)} · {section.attachedQuestionCount} questions ·
                {section.durationMinutes > 0 ? ` ${section.durationMinutes} min` : " no section timer"} ·
                {" "}{section.attachedMarks} marks
                {section.negativeMarks > 0 && ` · −${section.negativeMarks} per wrong answer`}
              </p>
            </div>
            <span className="text-xs text-slate-400">{section.mandatory ? "Mandatory" : "Optional"}</span>
          </div>

          {section.questions.map((q, i) => (
            <div key={q.id} className="border border-slate-100 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-xs text-slate-400">
                <span>Q{i + 1} · {labelOf(q.questionType)} · {q.difficulty || "—"} {q.topic ? `· ${q.topic}` : ""}</span>
                <span>{q.marks} marks {q.negativeMarks > 0 && `· −${q.negativeMarks}`}</span>
              </div>

              <p className="text-slate-800 whitespace-pre-wrap">{q.payload?.body || q.title}</p>

              {Array.isArray(q.payload?.options) && (
                <ul className="space-y-1 text-sm">
                  {q.payload.options.map((o: any) => {
                    const isCorrect = (q.payload.correctOptions || []).includes(o.key);
                    return (
                      <li key={o.key} className={isCorrect ? "text-teal-700 font-medium" : "text-slate-600"}>
                        {o.key}. {o.text} {isCorrect && "✓"}
                      </li>
                    );
                  })}
                </ul>
              )}

              {q.payload?.explanation && (
                <p className="text-xs text-slate-500 bg-slate-50 rounded p-2">
                  <strong>Explanation:</strong> {q.payload.explanation}
                </p>
              )}

              {q.questionType === "CODING" && (
                <div className="text-xs space-y-2">
                  {q.payload?.constraints && <p className="text-slate-500"><strong>Constraints:</strong> {q.payload.constraints}</p>}
                  {q.payload?.languages && <p className="text-slate-500"><strong>Languages:</strong> {(q.payload.languages || []).join(", ")}</p>}
                  <pre className="bg-slate-900 text-slate-100 rounded p-3 overflow-x-auto">
{Object.values(q.payload?.starterCode || {})[0] as string || "// no starter code configured"}
                  </pre>
                  <p className="text-slate-500">
                    <strong>{(q.payload?.testCases || []).length}</strong> test case(s) configured
                    {" "}({(q.payload?.testCases || []).filter((t: any) => t.hidden).length} hidden)
                  </p>
                </div>
              )}

              {(q.questionType === "SQL" || q.questionType === "DATAFRAME") && (
                <div className="text-xs space-y-2">
                  {q.payload?.schemaDdl && (
                    <pre className="bg-slate-50 border border-slate-200 rounded p-2 overflow-x-auto">{q.payload.schemaDdl}</pre>
                  )}
                  {q.payload?.expectedOutput && (
                    <div>
                      <p className="text-slate-500 mb-1"><strong>Expected output:</strong></p>
                      <pre className="bg-slate-50 border border-slate-200 rounded p-2 overflow-x-auto">{q.payload.expectedOutput}</pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {section.questions.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-6">This section has no questions attached.</p>
          )}
        </div>
      )}
    </div>
  );
}
