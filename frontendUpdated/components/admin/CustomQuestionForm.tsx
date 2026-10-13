"use client";

import { useState } from "react";
import { QuestionType, TECHNICAL_CATEGORIES, labelOf, testsAdminApi } from "@/lib/managedTests";

/**
 * Manual question authoring for MCQ / Coding / SQL / DataFrame.
 *
 * The four types share almost nothing beyond a title, so the form switches body entirely rather
 * than showing one long form with most fields greyed out.
 */
export default function CustomQuestionForm({
  testId, sectionId, defaultType, onSaved, onClose,
}: {
  testId: number;
  sectionId: number;
  defaultType: QuestionType;
  onSaved: () => void;
  onClose: () => void;
}) {
  const [questionType, setQuestionType] = useState<QuestionType>(defaultType);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [difficulty, setDifficulty] = useState("MEDIUM");
  const [topic, setTopic] = useState("");
  const [subtopic, setSubtopic] = useState("");
  const [marks, setMarks] = useState(1);
  const [negativeMarks, setNegativeMarks] = useState(0);
  const [saveToBank, setSaveToBank] = useState(false);
  const [bankCategory, setBankCategory] = useState("OOPS");

  // MCQ
  const [options, setOptions] = useState([
    { key: "A", text: "" }, { key: "B", text: "" }, { key: "C", text: "" }, { key: "D", text: "" },
  ]);
  const [correct, setCorrect] = useState<string[]>([]);
  const [explanation, setExplanation] = useState("");

  // Coding
  const [inputFormat, setInputFormat] = useState("");
  const [outputFormat, setOutputFormat] = useState("");
  const [constraints, setConstraints] = useState("");
  const [languages, setLanguages] = useState("java,python,cpp");
  const [starterCode, setStarterCode] = useState("");
  const [functionSignature, setFunctionSignature] = useState("");
  const [testCases, setTestCases] = useState([{ input: "", expectedOutput: "", hidden: false }]);

  // SQL / DataFrame
  const [schemaDdl, setSchemaDdl] = useState("");
  const [sampleData, setSampleData] = useState("");
  const [expectedOutput, setExpectedOutput] = useState("");
  const [evaluation, setEvaluation] = useState("EXACT_ROWS");
  const [datasetRef, setDatasetRef] = useState("");
  const [requirements, setRequirements] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const isMcq = questionType === "MCQ_SINGLE" || questionType === "MCQ_MULTI";

  function toggleCorrect(key: string) {
    if (questionType === "MCQ_SINGLE") { setCorrect([key]); return; }
    setCorrect((prev) => prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]);
  }

  function buildPayload(): Record<string, any> {
    if (isMcq) {
      return {
        body: body || title,
        options: options.filter((o) => o.text.trim() !== ""),
        correctOptions: correct,
        explanation,
      };
    }
    if (questionType === "CODING") {
      return {
        body, inputFormat, outputFormat, constraints,
        languages: languages.split(",").map((s) => s.trim()).filter(Boolean),
        starterCode: starterCode ? { [languages.split(",")[0].trim()]: starterCode } : {},
        functionSignature,
        testCases: testCases.filter((tc) => tc.input !== "" || tc.expectedOutput !== ""),
        examples: [],
      };
    }
    if (questionType === "SQL") {
      return { body, schemaDdl, sampleData, expectedOutput, evaluation };
    }
    if (questionType === "DATAFRAME") {
      return { body, datasetRef, requirements, expectedOutput, evaluation };
    }
    return { body };
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      await testsAdminApi.addCustomQuestion(testId, sectionId, {
        questionType, title, difficulty, topic, subtopic,
        marks, negativeMarks, estimatedTimeSeconds: isMcq ? 60 : 900,
        payload: buildPayload(),
        saveToQuestionBank: saveToBank,
        bankCategory: saveToBank ? bankCategory : undefined,
      });
      onSaved();
      onClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-start justify-center overflow-y-auto p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl my-8">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-800">Add Custom Question</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl leading-none">&times;</button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <select className="input" value={questionType} onChange={(e) => setQuestionType(e.target.value as QuestionType)}>
              <option value="MCQ_SINGLE">MCQ (single correct)</option>
              <option value="MCQ_MULTI">MCQ (multiple correct)</option>
              <option value="CODING">Coding</option>
              <option value="SQL">SQL</option>
              <option value="DATAFRAME">DataFrame</option>
              <option value="DESCRIPTIVE">Descriptive</option>
            </select>
            <select className="input" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
              <option value="EASY">Easy</option><option value="MEDIUM">Medium</option><option value="HARD">Hard</option>
            </select>
            <input className="input" type="number" step="0.5" placeholder="Marks" value={marks}
              onChange={(e) => setMarks(Number(e.target.value))} />
            <input className="input" type="number" step="0.25" placeholder="Negative marks" value={negativeMarks}
              onChange={(e) => setNegativeMarks(Number(e.target.value))} />
          </div>

          <input className="input" placeholder="Question title" value={title} onChange={(e) => setTitle(e.target.value)} />

          <div className="grid grid-cols-2 gap-3">
            <input className="input" placeholder="Topic" value={topic} onChange={(e) => setTopic(e.target.value)} />
            <input className="input" placeholder="Subtopic" value={subtopic} onChange={(e) => setSubtopic(e.target.value)} />
          </div>

          <textarea className="input min-h-[100px]" placeholder="Problem statement / question text"
            value={body} onChange={(e) => setBody(e.target.value)} />

          {isMcq && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-700">
                Options {questionType === "MCQ_MULTI" ? "(tick every correct option)" : "(tick the correct option)"}
              </p>
              {options.map((o, i) => (
                <div key={o.key} className="flex items-center gap-2">
                  <input
                    type={questionType === "MCQ_SINGLE" ? "radio" : "checkbox"}
                    name="correct"
                    checked={correct.includes(o.key)}
                    onChange={() => toggleCorrect(o.key)}
                  />
                  <span className="w-5 text-slate-500 text-sm">{o.key}</span>
                  <input
                    className="input flex-1"
                    placeholder={`Option ${o.key}`}
                    value={o.text}
                    onChange={(e) => setOptions((prev) => prev.map((p, pi) => pi === i ? { ...p, text: e.target.value } : p))}
                  />
                </div>
              ))}
              <button
                type="button"
                className="text-sm text-premium-700 hover:underline"
                onClick={() => setOptions((prev) => [...prev, { key: String.fromCharCode(65 + prev.length), text: "" }])}
              >
                + Add option
              </button>
              <textarea className="input" placeholder="Explanation (shown after submission)"
                value={explanation} onChange={(e) => setExplanation(e.target.value)} />
            </div>
          )}

          {questionType === "CODING" && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <input className="input" placeholder="Input format" value={inputFormat} onChange={(e) => setInputFormat(e.target.value)} />
                <input className="input" placeholder="Output format" value={outputFormat} onChange={(e) => setOutputFormat(e.target.value)} />
              </div>
              <textarea className="input" placeholder="Constraints" value={constraints} onChange={(e) => setConstraints(e.target.value)} />
              <div className="grid grid-cols-2 gap-3">
                <input className="input" placeholder="Languages (comma separated)" value={languages} onChange={(e) => setLanguages(e.target.value)} />
                <input className="input" placeholder="Function signature" value={functionSignature} onChange={(e) => setFunctionSignature(e.target.value)} />
              </div>
              <textarea className="input font-mono text-xs min-h-[80px]" placeholder="Starter code (first language)"
                value={starterCode} onChange={(e) => setStarterCode(e.target.value)} />
              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-700">Test cases</p>
                {testCases.map((tc, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-center">
                    <input className="input col-span-5 font-mono text-xs" placeholder="Input" value={tc.input}
                      onChange={(e) => setTestCases((p) => p.map((t, ti) => ti === i ? { ...t, input: e.target.value } : t))} />
                    <input className="input col-span-5 font-mono text-xs" placeholder="Expected output" value={tc.expectedOutput}
                      onChange={(e) => setTestCases((p) => p.map((t, ti) => ti === i ? { ...t, expectedOutput: e.target.value } : t))} />
                    <label className="col-span-2 text-xs text-slate-500 flex items-center gap-1">
                      <input type="checkbox" checked={tc.hidden}
                        onChange={(e) => setTestCases((p) => p.map((t, ti) => ti === i ? { ...t, hidden: e.target.checked } : t))} />
                      Hidden
                    </label>
                  </div>
                ))}
                <button type="button" className="text-sm text-premium-700 hover:underline"
                  onClick={() => setTestCases((p) => [...p, { input: "", expectedOutput: "", hidden: false }])}>
                  + Add test case
                </button>
              </div>
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                Coding answers are recorded and queued for review rather than auto-scored by this module.
              </p>
            </div>
          )}

          {questionType === "SQL" && (
            <div className="space-y-3">
              <textarea className="input font-mono text-xs min-h-[90px]" placeholder="Schema DDL (CREATE TABLE ...)"
                value={schemaDdl} onChange={(e) => setSchemaDdl(e.target.value)} />
              <textarea className="input font-mono text-xs" placeholder="Sample data (INSERT ...)"
                value={sampleData} onChange={(e) => setSampleData(e.target.value)} />
              <textarea className="input font-mono text-xs" placeholder="Expected output (one row per line)"
                value={expectedOutput} onChange={(e) => setExpectedOutput(e.target.value)} />
              <select className="input" value={evaluation} onChange={(e) => setEvaluation(e.target.value)}>
                <option value="EXACT_ROWS">Compare rows, order-insensitive</option>
                <option value="ORDERED_ROWS">Compare rows, order matters</option>
                <option value="MANUAL">Manual review</option>
              </select>
            </div>
          )}

          {questionType === "DATAFRAME" && (
            <div className="space-y-3">
              <input className="input" placeholder="Dataset reference (e.g. sales.csv)" value={datasetRef} onChange={(e) => setDatasetRef(e.target.value)} />
              <input className="input" placeholder="Python requirements (e.g. pandas >= 2.0)" value={requirements} onChange={(e) => setRequirements(e.target.value)} />
              <textarea className="input font-mono text-xs" placeholder="Expected output"
                value={expectedOutput} onChange={(e) => setExpectedOutput(e.target.value)} />
            </div>
          )}

          <div className="border-t border-slate-200 pt-3 space-y-2">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={saveToBank} onChange={(e) => setSaveToBank(e.target.checked)} />
              Also save to the Question Bank for future use
            </label>
            {saveToBank && (
              <>
                <select className="input max-w-xs" value={bankCategory} onChange={(e) => setBankCategory(e.target.value)}>
                  {TECHNICAL_CATEGORIES.map((c) => <option key={c} value={c}>{labelOf(c)}</option>)}
                </select>
                <p className="text-xs text-slate-500">
                  Creates a new bank entry. The copy in this test stays independent — editing it later
                  will not change the bank question. Only MCQs can be saved to the bank today.
                </p>
              </>
            )}
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <div className="flex justify-end gap-3 px-5 py-4 border-t border-slate-200">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={save} disabled={saving || !title.trim()} className="btn-primary">
            {saving ? "Saving..." : "Add Question"}
          </button>
        </div>
      </div>
    </div>
  );
}
