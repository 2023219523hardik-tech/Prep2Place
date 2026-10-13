"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import LoadingState from "@/components/LoadingState";
import QuestionBankPicker from "@/components/admin/QuestionBankPicker";
import CustomQuestionForm from "@/components/admin/CustomQuestionForm";
import {
  QuestionType, SECTION_TYPES, SectionType, SelectionStrategy, TEST_TYPES, TestDetail, TestType,
  TECHNICAL_CATEGORIES, labelOf, testsAdminApi,
} from "@/lib/managedTests";

/**
 * The admin Test Builder, used by both /admin/tests/new and /admin/tests/[id]/edit.
 *
 * Flow: basic information is saved first (which creates the test and gives us an id), then sections
 * and questions are edited against the server. Nothing is held in local state waiting for one big
 * save — a half-built test survives a closed tab as a draft.
 */
export default function TestBuilder({ testId }: { testId?: number }) {
  const router = useRouter();
  const [detail, setDetail] = useState<TestDetail | null>(null);
  const [loading, setLoading] = useState(!!testId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [form, setForm] = useState({
    name: "", testType: "CUSTOM_TEST" as TestType, description: "", instructions: "",
    organizationName: "", organizationCode: "", batch: "", branch: "", graduationYear: "",
    difficulty: "MEDIUM", durationMinutes: 60, passingPercentage: 40,
    negativeMarkingEnabled: false, defaultNegativeMarks: 0.25,
    overallTimerEnabled: true, sectionTimersEnabled: false,
    attemptLimit: 1, showResultToStudent: true,
    startsAt: "", endsAt: "",
    proctored: false, fullscreenRequired: false, webcamRequired: false, violationCountThreshold: 0,
  });

  const [pickerFor, setPickerFor] = useState<number | null>(null);
  const [customFor, setCustomFor] = useState<{ sectionId: number; type: QuestionType } | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);

  const load = useCallback((id: number) => {
    setLoading(true);
    testsAdminApi.get(id)
      .then((d) => {
        setDetail(d);
        setForm({
          name: d.summary.name,
          testType: d.summary.testType,
          description: d.description || "",
          instructions: d.instructions || "",
          organizationName: d.summary.organizationName || "",
          organizationCode: "",
          batch: d.summary.batch || "",
          branch: d.summary.branch || "",
          graduationYear: d.summary.graduationYear ? String(d.summary.graduationYear) : "",
          difficulty: d.summary.difficulty || "MEDIUM",
          durationMinutes: d.summary.durationMinutes,
          passingPercentage: d.summary.passingPercentage,
          negativeMarkingEnabled: d.negativeMarkingEnabled,
          defaultNegativeMarks: d.defaultNegativeMarks,
          overallTimerEnabled: d.overallTimerEnabled,
          sectionTimersEnabled: d.sectionTimersEnabled,
          attemptLimit: d.attemptLimit,
          showResultToStudent: d.showResultToStudent,
          startsAt: d.summary.startsAt ? d.summary.startsAt.slice(0, 16) : "",
          endsAt: d.summary.endsAt ? d.summary.endsAt.slice(0, 16) : "",
          proctored: d.proctored,
          fullscreenRequired: d.fullscreenRequired,
          webcamRequired: d.webcamRequired,
          violationCountThreshold: d.violationCountThreshold,
        });
        setError("");
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { if (testId) load(testId); }, [testId, load]);

  function payload() {
    return {
      ...form,
      graduationYear: form.graduationYear ? Number(form.graduationYear) : null,
      startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
      endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
      organizationName: form.organizationName || null,
      branch: form.branch || null,
      batch: form.batch || null,
    };
  }

  async function saveBasics() {
    setSaving(true);
    setError("");
    try {
      if (detail) {
        const updated = await testsAdminApi.update(detail.summary.id, payload());
        setDetail(updated);
        setNotice("Saved.");
      } else {
        const created = await testsAdminApi.create(payload());
        setDetail(created);
        setNotice("Draft created. Add sections below.");
        router.replace(`/admin/tests/${created.summary.id}/edit`);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
      setTimeout(() => setNotice(""), 3000);
    }
  }

  async function refresh() { if (detail) load(detail.summary.id); }

  async function addSection() {
    if (!detail) return;
    try {
      await testsAdminApi.addSection(detail.summary.id, {
        name: `Section ${detail.sections.length + 1}`,
        sectionType: "TECHNICAL_MCQ",
        questionCount: 0, durationMinutes: 0, marksPerQuestion: 1, negativeMarks: 0,
        mandatory: true, randomizeQuestions: false, randomizeOptions: false,
        allowBackNavigation: true, selectionStrategy: "MANUAL",
      });
      refresh();
    } catch (e: any) { setError(e.message); }
  }

  async function updateSection(sectionId: number, patch: Record<string, any>) {
    if (!detail) return;
    const section = detail.sections.find((s) => s.id === sectionId);
    if (!section) return;
    try {
      await testsAdminApi.updateSection(detail.summary.id, sectionId, {
        name: section.name, sectionType: section.sectionType, instructions: section.instructions,
        displayOrder: section.displayOrder, questionCount: section.questionCount,
        durationMinutes: section.durationMinutes, marksPerQuestion: section.marksPerQuestion,
        negativeMarks: section.negativeMarks, passingPercentage: section.passingPercentage,
        mandatory: section.mandatory, randomizeQuestions: section.randomizeQuestions,
        randomizeOptions: section.randomizeOptions, allowBackNavigation: section.allowBackNavigation,
        selectionStrategy: section.selectionStrategy, selectionRules: section.selectionRules,
        ...patch,
      });
      refresh();
    } catch (e: any) { setError(e.message); }
  }

  async function deleteSection(sectionId: number) {
    if (!detail || !confirm("Delete this section and all of its questions?")) return;
    try { await testsAdminApi.deleteSection(detail.summary.id, sectionId); refresh(); }
    catch (e: any) { setError(e.message); }
  }

  async function move(sectionId: number, delta: number) {
    if (!detail) return;
    const ids = detail.sections.map((s) => s.id);
    const i = ids.indexOf(sectionId);
    const j = i + delta;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    await testsAdminApi.reorderSections(detail.summary.id, ids);
    refresh();
  }

  async function removeQuestion(questionId: number) {
    if (!detail) return;
    try { await testsAdminApi.removeQuestion(detail.summary.id, questionId); refresh(); }
    catch (e: any) { setError(e.message); }
  }

  async function autoFill(sectionId: number, rules: Record<string, any>) {
    if (!detail) return;
    try {
      const res = await testsAdminApi.autoFill(detail.summary.id, sectionId, rules);
      setNotice(`Added ${res.added} question(s).${res.notes.length ? " " + res.notes.join(" ") : ""}`);
      refresh();
    } catch (e: any) { setError(e.message); }
  }

  async function publish() {
    if (!detail) return;
    setSaving(true);
    try {
      const updated = await testsAdminApi.publish(detail.summary.id);
      setDetail(updated);
      setNotice("Published.");
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  }

  if (loading) return <LoadingState />;

  const isUniversity = form.testType === "UNIVERSITY_TEST" || form.testType === "COMPANY_TEST" || form.testType === "PLACEMENT_TEST";
  const validation = detail?.validation;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{detail ? "Edit Assessment" : "Create Assessment"}</h1>
          {detail && (
            <p className="text-sm text-slate-500">
              {detail.summary.status} · {detail.summary.totalMarks} marks · {detail.summary.questionCount} questions
            </p>
          )}
        </div>
        <Link href="/admin/tests" className="text-sm text-slate-500 hover:underline">Back to all tests</Link>
      </div>

      {error && <div className="card border-red-200 bg-red-50 text-sm text-red-700">{error}</div>}
      {notice && <div className="card border-teal-200 bg-teal-50 text-sm text-teal-700">{notice}</div>}

      {/* ---------------- Basic information ---------------- */}
      <div className="card space-y-4">
        <h2 className="font-medium text-slate-800">Basic Information</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input className="input" placeholder="Test name" value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <select className="input" value={form.testType}
            onChange={(e) => setForm({ ...form, testType: e.target.value as TestType })}>
            {TEST_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>

        <textarea className="input" placeholder="Description" value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <textarea className="input min-h-[90px]" placeholder="Instructions shown to the student before starting"
          value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} />

        {isUniversity && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <input className="input" placeholder="University / Company" value={form.organizationName}
              onChange={(e) => setForm({ ...form, organizationName: e.target.value })} />
            <input className="input" placeholder="Code (e.g. SU)" value={form.organizationCode}
              onChange={(e) => setForm({ ...form, organizationCode: e.target.value })} />
            <input className="input" placeholder="Batch (e.g. 2027)" value={form.batch}
              onChange={(e) => setForm({ ...form, batch: e.target.value })} />
            <input className="input" placeholder="Branch (e.g. CSE)" value={form.branch}
              onChange={(e) => setForm({ ...form, branch: e.target.value })} />
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <label className="text-xs text-slate-500">Duration (min)
            <input className="input" type="number" value={form.durationMinutes}
              onChange={(e) => setForm({ ...form, durationMinutes: Number(e.target.value) })} />
          </label>
          <label className="text-xs text-slate-500">Passing %
            <input className="input" type="number" value={form.passingPercentage}
              onChange={(e) => setForm({ ...form, passingPercentage: Number(e.target.value) })} />
          </label>
          <label className="text-xs text-slate-500">Attempt limit (0 = unlimited)
            <input className="input" type="number" value={form.attemptLimit}
              onChange={(e) => setForm({ ...form, attemptLimit: Number(e.target.value) })} />
          </label>
          <label className="text-xs text-slate-500">Difficulty
            <select className="input" value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value })}>
              <option value="EASY">Easy</option><option value="MEDIUM">Medium</option><option value="HARD">Hard</option>
            </select>
          </label>
          <label className="text-xs text-slate-500">Starts at
            <input className="input" type="datetime-local" value={form.startsAt}
              onChange={(e) => setForm({ ...form, startsAt: e.target.value })} />
          </label>
          <label className="text-xs text-slate-500">Ends at
            <input className="input" type="datetime-local" value={form.endsAt}
              onChange={(e) => setForm({ ...form, endsAt: e.target.value })} />
          </label>
          <label className="text-xs text-slate-500">Graduation year
            <input className="input" type="number" value={form.graduationYear}
              onChange={(e) => setForm({ ...form, graduationYear: e.target.value })} />
          </label>
          <label className="text-xs text-slate-500">Negative marks (default)
            <input className="input" type="number" step="0.25" value={form.defaultNegativeMarks}
              onChange={(e) => setForm({ ...form, defaultNegativeMarks: Number(e.target.value) })} />
          </label>
        </div>

        <div className="flex flex-wrap gap-4 text-sm text-slate-600">
          {([
            ["negativeMarkingEnabled", "Negative marking"],
            ["overallTimerEnabled", "Overall timer"],
            ["sectionTimersEnabled", "Section timers"],
            ["showResultToStudent", "Show result to student"],
            ["proctored", "Proctored"],
            ["fullscreenRequired", "Require fullscreen"],
            ["webcamRequired", "Require webcam"],
          ] as const).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2">
              <input type="checkbox" checked={(form as any)[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.checked } as any)} />
              {label}
            </label>
          ))}
        </div>

        <button onClick={saveBasics} disabled={saving || !form.name.trim()} className="btn-primary">
          {saving ? "Saving..." : detail ? "Save Changes" : "Create Draft"}
        </button>
      </div>

      {/* ---------------- Sections ---------------- */}
      {detail && (
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-medium text-slate-800">Sections</h2>
            <button onClick={addSection} className="btn-secondary text-sm">+ Add Section</button>
          </div>

          {detail.sections.length === 0 && (
            <p className="text-sm text-slate-500">No sections yet. Add at least one before publishing.</p>
          )}

          {detail.sections.map((section, idx) => (
            <div key={section.id} className="border border-slate-200 rounded-lg">
              <div className="flex items-center justify-between p-3 bg-slate-50">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-400">#{idx + 1}</span>
                  <input
                    className="input py-1 w-48"
                    value={section.name}
                    onChange={(e) => setDetail({
                      ...detail,
                      sections: detail.sections.map((s) => s.id === section.id ? { ...s, name: e.target.value } : s),
                    })}
                    onBlur={(e) => updateSection(section.id, { name: e.target.value })}
                  />
                  <select
                    className="input py-1 w-40"
                    value={section.sectionType}
                    onChange={(e) => updateSection(section.id, { sectionType: e.target.value as SectionType })}
                  >
                    {SECTION_TYPES.map((t) => <option key={t} value={t}>{labelOf(t)}</option>)}
                  </select>
                  <span className="text-xs text-slate-500">
                    {section.attachedQuestionCount} questions · {section.durationMinutes} min · {section.attachedMarks} marks
                  </span>
                </div>
                <div className="flex gap-2 text-xs">
                  <button onClick={() => move(section.id, -1)} className="text-slate-500 hover:underline">↑</button>
                  <button onClick={() => move(section.id, 1)} className="text-slate-500 hover:underline">↓</button>
                  <button onClick={() => setExpanded(expanded === section.id ? null : section.id)} className="text-premium-700 hover:underline">
                    {expanded === section.id ? "Collapse" : "Edit / Questions"}
                  </button>
                  <button onClick={() => deleteSection(section.id)} className="text-red-600 hover:underline">Delete</button>
                </div>
              </div>

              {expanded === section.id && (
                <div className="p-4 space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <label className="text-xs text-slate-500">Target questions
                      <input className="input" type="number" defaultValue={section.questionCount}
                        onBlur={(e) => updateSection(section.id, { questionCount: Number(e.target.value) })} />
                    </label>
                    <label className="text-xs text-slate-500">Duration (min)
                      <input className="input" type="number" defaultValue={section.durationMinutes}
                        onBlur={(e) => updateSection(section.id, { durationMinutes: Number(e.target.value) })} />
                    </label>
                    <label className="text-xs text-slate-500">Marks / question
                      <input className="input" type="number" step="0.5" defaultValue={section.marksPerQuestion}
                        onBlur={(e) => updateSection(section.id, { marksPerQuestion: Number(e.target.value) })} />
                    </label>
                    <label className="text-xs text-slate-500">Negative marks
                      <input className="input" type="number" step="0.25" defaultValue={section.negativeMarks}
                        onBlur={(e) => updateSection(section.id, { negativeMarks: Number(e.target.value) })} />
                    </label>
                    <label className="text-xs text-slate-500">Section passing %
                      <input className="input" type="number" defaultValue={section.passingPercentage ?? ""}
                        onBlur={(e) => updateSection(section.id, { passingPercentage: e.target.value ? Number(e.target.value) : null })} />
                    </label>
                  </div>

                  <div className="flex flex-wrap gap-4 text-sm text-slate-600">
                    <label className="flex items-center gap-2">
                      <input type="checkbox" checked={section.mandatory}
                        onChange={(e) => updateSection(section.id, { mandatory: e.target.checked })} /> Mandatory
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" checked={section.randomizeQuestions}
                        onChange={(e) => updateSection(section.id, { randomizeQuestions: e.target.checked })} /> Randomize questions
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" checked={section.randomizeOptions}
                        onChange={(e) => updateSection(section.id, { randomizeOptions: e.target.checked })} /> Randomize options
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" checked={section.allowBackNavigation}
                        onChange={(e) => updateSection(section.id, { allowBackNavigation: e.target.checked })} /> Allow going back
                    </label>
                  </div>

                  {/* Question source */}
                  <div className="border-t border-slate-100 pt-3 space-y-3">
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-slate-600">Question source:</span>
                      <select className="input py-1 w-40" value={section.selectionStrategy}
                        onChange={(e) => updateSection(section.id, { selectionStrategy: e.target.value as SelectionStrategy })}>
                        <option value="MANUAL">Question Bank / manual</option>
                        <option value="RANDOM">Automatic (random)</option>
                        <option value="FIXED">Automatic (fixed)</option>
                        <option value="HYBRID">Hybrid</option>
                      </select>
                      <button onClick={() => setPickerFor(section.id)} className="btn-secondary text-xs">From Question Bank</button>
                      <button onClick={() => setCustomFor({ sectionId: section.id, type: "MCQ_SINGLE" })} className="btn-secondary text-xs">
                        Create Custom Question
                      </button>
                    </div>

                    {(section.selectionStrategy !== "MANUAL") && (
                      <AutoFillPanel
                        sectionType={section.sectionType}
                        onRun={(rules) => autoFill(section.id, rules)}
                      />
                    )}
                  </div>

                  {/* Attached questions */}
                  <div className="border border-slate-100 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 text-left text-slate-500">
                        <tr>
                          <th className="p-2 w-10">#</th>
                          <th className="p-2">Question</th>
                          <th className="p-2">Type</th>
                          <th className="p-2">Topic</th>
                          <th className="p-2">Diff.</th>
                          <th className="p-2">Marks</th>
                          <th className="p-2">Origin</th>
                          <th className="p-2"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {section.questions.length === 0 ? (
                          <tr><td colSpan={8} className="p-4 text-center text-slate-400">No questions in this section yet.</td></tr>
                        ) : section.questions.map((q, qi) => (
                          <tr key={q.id} className="border-t border-slate-100">
                            <td className="p-2 text-slate-400">{qi + 1}</td>
                            <td className="p-2 max-w-md text-slate-700">{q.title}</td>
                            <td className="p-2 text-xs text-slate-500">{labelOf(q.questionType)}</td>
                            <td className="p-2 text-xs text-slate-500">{q.topic || "-"}</td>
                            <td className="p-2 text-xs text-slate-500">{q.difficulty || "-"}</td>
                            <td className="p-2 text-xs text-slate-500">{q.marks}</td>
                            <td className="p-2 text-xs text-slate-400">{q.origin === "QUESTION_BANK" ? "Bank" : "Custom"}</td>
                            <td className="p-2">
                              <button onClick={() => removeQuestion(q.id)} className="text-xs text-red-600 hover:underline">Remove</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ---------------- Validation + publish ---------------- */}
      {detail && validation && (
        <div className="card space-y-3">
          <h2 className="font-medium text-slate-800">Before publishing</h2>
          {validation.errors.length === 0 ? (
            <p className="text-sm text-teal-700">All checks passed. This test is ready to publish.</p>
          ) : (
            <ul className="text-sm text-red-700 list-disc pl-5 space-y-1">
              {validation.errors.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          )}
          {validation.warnings.length > 0 && (
            <ul className="text-sm text-amber-700 list-disc pl-5 space-y-1">
              {validation.warnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          )}
          <div className="flex gap-3 pt-2">
            <button onClick={saveBasics} className="btn-secondary">Save Draft</button>
            <Link href={`/admin/tests/${detail.summary.id}/preview`} className="btn-secondary">Preview</Link>
            <button onClick={publish} disabled={saving || !validation.publishable} className="btn-primary">Publish</button>
          </div>
        </div>
      )}

      {detail && pickerFor !== null && (
        <QuestionBankPicker testId={detail.summary.id} sectionId={pickerFor}
          onAdded={refresh} onClose={() => setPickerFor(null)} />
      )}
      {detail && customFor && (
        <CustomQuestionForm testId={detail.summary.id} sectionId={customFor.sectionId}
          defaultType={customFor.type} onSaved={refresh} onClose={() => setCustomFor(null)} />
      )}
    </div>
  );
}

/** Difficulty and category quotas for automatic selection from the Question Bank. */
function AutoFillPanel({ sectionType, onRun }: { sectionType: SectionType; onRun: (rules: Record<string, any>) => void }) {
  const defaultSource = sectionType === "APTITUDE" ? "APTITUDE"
    : sectionType === "CODING" || sectionType === "DSA" ? "CANONICAL" : "TECHNICAL_MCQ";

  const [sourceType, setSourceType] = useState(defaultSource);
  const [count, setCount] = useState(10);
  const [easy, setEasy] = useState(0);
  const [medium, setMedium] = useState(0);
  const [hard, setHard] = useState(0);
  const [keepExisting, setKeepExisting] = useState(true);
  const [categoryRows, setCategoryRows] = useState<{ category: string; count: number }[]>([]);

  function run() {
    onRun({
      sourceType, count, keepExisting,
      difficultyDistribution: (easy || medium || hard) ? { EASY: easy, MEDIUM: medium, HARD: hard } : null,
      categoryDistribution: categoryRows.length
        ? Object.fromEntries(categoryRows.filter((r) => r.count > 0).map((r) => [r.category, r.count]))
        : null,
    });
  }

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-3 text-sm">
      <p className="text-slate-600 font-medium">Automatic selection rules</p>
      <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
        <select className="input py-1" value={sourceType} onChange={(e) => setSourceType(e.target.value)}>
          <option value="TECHNICAL_MCQ">Technical MCQ</option>
          <option value="APTITUDE">Aptitude</option>
          <option value="CANONICAL">Coding / DSA</option>
        </select>
        <label className="text-xs text-slate-500">Total
          <input className="input py-1" type="number" value={count} onChange={(e) => setCount(Number(e.target.value))} />
        </label>
        <label className="text-xs text-slate-500">Easy
          <input className="input py-1" type="number" value={easy} onChange={(e) => setEasy(Number(e.target.value))} />
        </label>
        <label className="text-xs text-slate-500">Medium
          <input className="input py-1" type="number" value={medium} onChange={(e) => setMedium(Number(e.target.value))} />
        </label>
        <label className="text-xs text-slate-500">Hard
          <input className="input py-1" type="number" value={hard} onChange={(e) => setHard(Number(e.target.value))} />
        </label>
        <label className="text-xs text-slate-500 flex items-end gap-2 pb-1">
          <input type="checkbox" checked={keepExisting} onChange={(e) => setKeepExisting(e.target.checked)} />
          Keep existing
        </label>
      </div>

      {sourceType === "TECHNICAL_MCQ" && (
        <div className="space-y-2">
          {categoryRows.map((row, i) => (
            <div key={i} className="flex gap-2">
              <select className="input py-1 flex-1" value={row.category}
                onChange={(e) => setCategoryRows((p) => p.map((r, ri) => ri === i ? { ...r, category: e.target.value } : r))}>
                {TECHNICAL_CATEGORIES.map((c) => <option key={c} value={c}>{labelOf(c)}</option>)}
              </select>
              <input className="input py-1 w-24" type="number" value={row.count}
                onChange={(e) => setCategoryRows((p) => p.map((r, ri) => ri === i ? { ...r, count: Number(e.target.value) } : r))} />
              <button className="text-red-600 text-xs" onClick={() => setCategoryRows((p) => p.filter((_, ri) => ri !== i))}>Remove</button>
            </div>
          ))}
          <button className="text-xs text-premium-700 hover:underline"
            onClick={() => setCategoryRows((p) => [...p, { category: "OOPS", count: 5 }])}>
            + Add category quota
          </button>
        </div>
      )}

      <button onClick={run} className="btn-secondary text-xs">Generate questions from bank</button>
      <p className="text-xs text-slate-500">
        Category quotas are applied first, then difficulty quotas, then any remaining slots are filled
        from the wider pool. If the bank cannot supply enough, you will be told how many are missing.
      </p>
    </div>
  );
}
