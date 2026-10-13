"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BankQuestion, QuestionSourceType, TECHNICAL_CATEGORIES, labelOf, testsAdminApi,
} from "@/lib/managedTests";

/**
 * Searchable Question Bank picker used by the section editor.
 *
 * Questions already present in this test are shown but disabled rather than hidden - an admin
 * looking for a question they added earlier should see why it isn't selectable, not wonder where
 * it went.
 */
export default function QuestionBankPicker({
  testId, sectionId, onAdded, onClose,
}: {
  testId: number;
  sectionId: number;
  onAdded: () => void;
  onClose: () => void;
}) {
  const [sourceType, setSourceType] = useState<QuestionSourceType>("TECHNICAL_MCQ");
  const [category, setCategory] = useState("");
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [company, setCompany] = useState("");
  const [tag, setTag] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  const [rows, setRows] = useState<BankQuestion[]>([]);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [preview, setPreview] = useState<BankQuestion | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    testsAdminApi
      .searchBank({ sourceType, category, topic, difficulty, company, tag, search, forTestId: testId, page, size: 20 })
      .then((res) => { setRows(res.content); setTotal(res.totalElements); setError(""); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [sourceType, category, topic, difficulty, company, tag, search, testId, page]);

  useEffect(load, [load]);

  // Switching pool invalidates the selection: ids are only unique within a source.
  useEffect(() => { setSelected(new Set()); setPage(0); setCategory(""); }, [sourceType]);

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function selectAllOnPage() {
    setSelected((prev) => {
      const next = new Set(prev);
      rows.filter((r) => !r.alreadyInTest).forEach((r) => next.add(r.id));
      return next;
    });
  }

  async function addSelected() {
    if (selected.size === 0) return;
    setSaving(true);
    try {
      await testsAdminApi.addBankQuestions(testId, sectionId, sourceType, Array.from(selected));
      setSelected(new Set());
      onAdded();
      load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-start justify-center overflow-y-auto p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl my-8">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-800">Add from Question Bank</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl leading-none">&times;</button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <select className="input" value={sourceType} onChange={(e) => setSourceType(e.target.value as QuestionSourceType)}>
              <option value="TECHNICAL_MCQ">Technical MCQ bank</option>
              <option value="APTITUDE">Aptitude bank</option>
              <option value="CANONICAL">Coding / DSA bank</option>
            </select>

            {sourceType === "TECHNICAL_MCQ" ? (
              <select className="input" value={category} onChange={(e) => { setCategory(e.target.value); setPage(0); }}>
                <option value="">All categories</option>
                {TECHNICAL_CATEGORIES.map((c) => <option key={c} value={c}>{labelOf(c)}</option>)}
              </select>
            ) : (
              <input className="input" placeholder="Topic" value={topic} onChange={(e) => { setTopic(e.target.value); setPage(0); }} />
            )}

            <select className="input" value={difficulty} onChange={(e) => { setDifficulty(e.target.value); setPage(0); }}>
              <option value="">Any difficulty</option>
              <option value="EASY">Easy</option>
              <option value="MEDIUM">Medium</option>
              <option value="HARD">Hard</option>
            </select>

            <input className="input" placeholder="Company" value={company} onChange={(e) => { setCompany(e.target.value); setPage(0); }} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input className="input md:col-span-2" placeholder="Search question text..." value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }} />
            <input className="input" placeholder="Tag" value={tag} onChange={(e) => { setTag(e.target.value); setPage(0); }} />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">{total} result{total === 1 ? "" : "s"} · {selected.size} selected</span>
            <div className="flex gap-3">
              <button onClick={selectAllOnPage} className="text-premium-700 hover:underline">Select all on page</button>
              <button onClick={() => setSelected(new Set())} className="text-slate-500 hover:underline">Clear</button>
            </div>
          </div>

          <div className="border border-slate-200 rounded-lg overflow-hidden max-h-[45vh] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-500 sticky top-0">
                <tr>
                  <th className="p-2 w-10"></th>
                  <th className="p-2 w-16">ID</th>
                  <th className="p-2">Question</th>
                  <th className="p-2">Type</th>
                  <th className="p-2">Topic</th>
                  <th className="p-2">Diff.</th>
                  <th className="p-2">Marks</th>
                  <th className="p-2">Source</th>
                  <th className="p-2">Used in</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={10} className="p-6 text-center text-slate-400">Loading...</td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={10} className="p-6 text-center text-slate-400">No questions match these filters.</td></tr>
                ) : rows.map((r) => (
                  <tr key={r.id} className={`border-t border-slate-100 ${r.alreadyInTest ? "opacity-50" : ""}`}>
                    <td className="p-2">
                      <input type="checkbox" disabled={r.alreadyInTest} checked={selected.has(r.id)} onChange={() => toggle(r.id)} />
                    </td>
                    <td className="p-2 text-slate-400">#{r.id}</td>
                    <td className="p-2 max-w-sm">
                      <span className="text-slate-700">{r.title}</span>
                      {r.alreadyInTest && <span className="ml-2 text-xs text-amber-600">already in this test</span>}
                    </td>
                    <td className="p-2 text-slate-500 text-xs">{labelOf(r.questionType)}</td>
                    <td className="p-2 text-slate-500 text-xs">{r.topic || (r.category ? labelOf(r.category) : "-")}</td>
                    <td className="p-2 text-slate-500 text-xs">{r.difficulty || "-"}</td>
                    <td className="p-2 text-slate-500 text-xs">{r.defaultMarks}</td>
                    <td className="p-2 text-slate-400 text-xs">{r.source}</td>
                    <td className="p-2 text-slate-500 text-xs">{r.usageCount} test{r.usageCount === 1 ? "" : "s"}</td>
                    <td className="p-2">
                      <button onClick={() => setPreview(r)} className="text-xs text-premium-700 hover:underline">Preview</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {total > 20 && (
            <div className="flex gap-2 items-center text-sm">
              <button className="btn-secondary" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</button>
              <span className="text-slate-500">Page {page + 1} of {Math.ceil(total / 20)}</span>
              <button className="btn-secondary" disabled={(page + 1) * 20 >= total} onClick={() => setPage((p) => p + 1)}>Next</button>
            </div>
          )}

          {preview && (
            <div className="border border-slate-200 rounded-lg p-4 bg-slate-50 text-sm">
              <div className="flex justify-between">
                <strong className="text-slate-700">Preview #{preview.id}</strong>
                <button onClick={() => setPreview(null)} className="text-slate-400">&times;</button>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-slate-700">{preview.preview}</p>
              <p className="mt-2 text-xs text-slate-500">
                {preview.category ? labelOf(preview.category) : ""} · {preview.difficulty} · {preview.defaultMarks} marks
                {preview.companies.length > 0 && ` · asked at ${preview.companies.join(", ")}`}
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 px-5 py-4 border-t border-slate-200">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={addSelected} disabled={saving || selected.size === 0} className="btn-primary">
            {saving ? "Adding..." : `Add ${selected.size} question${selected.size === 1 ? "" : "s"}`}
          </button>
        </div>
      </div>
    </div>
  );
}
