"use client";

import { useMemo, useState, useRef } from "react";
import { Icon } from "@/components/ui/Icon";

interface AssessmentConfigEditorProps {
  roundType: string;
  configJson: string | null | undefined;
  onChange: (updatedJson: string) => void;
}

const TOPIC_PRESETS: Record<string, string[]> = {
  APTITUDE: [
    "Quantitative Aptitude",
    "Logical Reasoning",
    "Verbal Ability",
    "Data Interpretation",
    "Number Series & Sequences",
    "Puzzles & Seating Arrangement",
  ],
  TECHNICAL_MCQ: [
    "Core Java & JVM",
    "Python Programming",
    "C++ & Object Oriented Design",
    "Data Structures & Algorithms",
    "Database Management Systems (DBMS)",
    "Operating Systems & Memory",
    "Computer Networks & Protocols",
    "Web Technologies & REST APIs",
  ],
  DSA: [
    "Arrays & Two Pointers",
    "Strings & Sliding Window",
    "Linked Lists & Stacks",
    "Binary Trees & BST",
    "Graphs & Traversals (BFS/DFS)",
    "Dynamic Programming",
    "Greedy Algorithms",
    "Binary Search & Recursion",
  ],
  CODING_LAB: [
    "Algorithms & Problem Solving",
    "Data Structures",
    "Object-Oriented Design",
    "System Logic",
  ],
  SQL: [
    "SELECT Queries & Filtering",
    "Aggregate Functions & GROUP BY",
    "Table Joins (Inner, Left, Right)",
    "Subqueries & Common Table Expressions",
    "Window Functions & Ranking",
  ],
  DATAFRAME: [
    "Pandas Series & DataFrames",
    "Data Filtering & Indexing",
    "Groupby & Aggregations",
    "Merging & Joining Datasets",
    "Handling Missing Values",
  ],
  AI_INTERVIEW: [
    "System Design & Scalability",
    "DSA & Algorithmic Complexity",
    "Microservices & REST APIs",
    "Concurrency & Multithreading",
    "Behavioral & STAR Method",
    "Problem Solving Approach",
  ],
  TECHNICAL_INTERVIEW: [
    "Object Oriented Design (LLD)",
    "Distributed Systems (HLD)",
    "Database Schema & Optimization",
    "Core Language Deep Dive",
    "Framework Internals (Spring/React)",
    "Past Project Walkthrough",
  ],
  HR_INTERVIEW: [
    "Company Culture & Values",
    "Conflict Resolution & Teamwork",
    "Career Aspirations & Growth",
    "Situational Scenarios",
    "Work Ethics & Ownership",
  ],
};

export default function AssessmentConfigEditor({
  roundType,
  configJson,
  onChange,
}: AssessmentConfigEditorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"topics" | "custom_questions">("topics");
  const [customTopicInput, setCustomTopicInput] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Manual Question Authoring Modal/Drawer State
  const [showAddQuestionModal, setShowAddQuestionModal] = useState(false);
  const [newQuestion, setNewQuestion] = useState({
    title: "",
    description: "",
    type: "MCQ_SINGLE",
    topic: "",
    difficulty: "MEDIUM",
    options: ["", "", "", ""],
    marks: 1,
    sampleInput: "",
    sampleOutput: "",
  });

  const parsedConfig = useMemo(() => {
    try {
      if (configJson) return JSON.parse(configJson);
    } catch {}
    return {};
  }, [configJson]);

  const upperType = (roundType || "APTITUDE").toUpperCase();
  const availableTopics = TOPIC_PRESETS[upperType] || TOPIC_PRESETS.TECHNICAL_MCQ;

  const isInterviewRound =
    upperType === "AI_INTERVIEW" ||
    upperType === "TECHNICAL_INTERVIEW" ||
    upperType === "HR_INTERVIEW";

  const currentCount =
    parsedConfig.questionCount || (upperType === "DSA" || upperType === "CODING_LAB" ? 3 : isInterviewRound ? 5 : 15);
  const currentDifficulty = parsedConfig.difficulty || "ALL";
  const selectedTopics: string[] = parsedConfig.topics || [];
  const customQuestions: any[] = parsedConfig.customQuestions || [];

  const handleUpdate = (updates: Record<string, any>) => {
    const next = { ...parsedConfig, ...updates };
    onChange(JSON.stringify(next));
  };

  const toggleTopic = (topic: string) => {
    const exists = selectedTopics.includes(topic);
    const nextTopics = exists
      ? selectedTopics.filter((t) => t !== topic)
      : [...selectedTopics, topic];
    handleUpdate({ topics: nextTopics });
  };

  const addCustomTopic = () => {
    const trimmed = customTopicInput.trim();
    if (!trimmed) return;
    if (!selectedTopics.includes(trimmed)) {
      handleUpdate({ topics: [...selectedTopics, trimmed] });
    }
    setCustomTopicInput("");
  };

  const selectAllTopics = () => {
    handleUpdate({ topics: [...availableTopics] });
  };

  const clearAllTopics = () => {
    handleUpdate({ topics: [] });
  };

  // --- JSON Upload Handler ---
  const handleJsonUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError("");
    setUploadSuccess("");
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const questionsArray = Array.isArray(parsed)
        ? parsed
        : parsed.questions && Array.isArray(parsed.questions)
        ? parsed.questions
        : null;

      if (!questionsArray || questionsArray.length === 0) {
        setUploadError("Uploaded JSON must be an array of question objects.");
        return;
      }

      // Sanitize and normalize items
      const normalized = questionsArray.map((q: any, idx: number) => ({
        id: q.id || idx + 1,
        title: q.title || q.question || q.questionText || `Question ${idx + 1}`,
        description: q.description || q.statement || q.explanation || "",
        type: q.type || q.questionType || (isInterviewRound ? "INTERVIEW_QUESTION" : upperType === "DSA" ? "CODING" : "MCQ_SINGLE"),
        topic: q.topic || q.category || selectedTopics[0] || "Custom",
        difficulty: (q.difficulty || "MEDIUM").toUpperCase(),
        options: Array.isArray(q.options)
          ? q.options.map((opt: any) => (typeof opt === "string" ? opt : opt.text || opt.key || ""))
          : [],
        marks: q.marks || 1,
        codeTemplate: q.codeTemplate || (q.templates && q.templates.java) || null,
        sampleTestCases: q.sampleTestCases || (q.sampleInput ? [`Input: ${q.sampleInput}`, `Output: ${q.sampleOutput || ""}`] : []),
      }));

      const merged = [...customQuestions, ...normalized];
      handleUpdate({ customQuestions: merged });
      setUploadSuccess(`Successfully imported ${normalized.length} questions from ${file.name}!`);
      setActiveTab("custom_questions");
    } catch (err: any) {
      setUploadError("Invalid JSON: " + (err?.message || "File could not be parsed."));
    }
  };

  // --- Download Sample JSON Template ---
  const downloadSampleTemplate = () => {
    let sample: any[] = [];
    const filename = `${upperType.toLowerCase()}-sample-questions.json`;

    if (isInterviewRound) {
      sample = [
        {
          title: "Explain the architecture of a high-throughput event processing system.",
          type: "INTERVIEW_QUESTION",
          topic: "System Design",
          difficulty: "HARD",
          description: "Candidate should explain Kafka partition strategy, consumer lag mitigation, and exactly-once semantics.",
          marks: 10,
        },
        {
          title: "Tell me about a time you resolved a major production bug under tight deadline.",
          type: "INTERVIEW_QUESTION",
          topic: "Behavioral & Leadership",
          difficulty: "MEDIUM",
          description: "Look for STAR methodology, clear ownership, root cause analysis, and post-mortem reflection.",
          marks: 10,
        },
      ];
    } else if (upperType === "DSA" || upperType === "CODING_LAB") {
      sample = [
        {
          title: "Minimum Window Substring",
          type: "CODING",
          topic: "Strings & Sliding Window",
          difficulty: "HARD",
          statement: "Given two strings s and t of lengths m and n respectively, return the minimum window substring of s such that every character in t is included in the window.",
          sampleInput: "s = 'ADOBECODEBANC', t = 'ABC'",
          sampleOutput: "'BANC'",
          codeTemplate: "class Solution {\n    public String minWindow(String s, String t) {\n        // Your code here\n    }\n}",
          marks: 20,
        },
      ];
    } else {
      sample = [
        {
          title: "Which HTTP status code is used when a rate limit is exceeded?",
          type: "MCQ_SINGLE",
          topic: "Web Technologies & REST APIs",
          difficulty: "EASY",
          options: ["400 Bad Request", "403 Forbidden", "429 Too Many Requests", "503 Service Unavailable"],
          correctOption: "429 Too Many Requests",
          marks: 2,
        },
      ];
    }

    const blob = new Blob([JSON.stringify(sample, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSaveDirectQuestion = () => {
    if (!newQuestion.title.trim()) return;

    const formatted = {
      id: Date.now(),
      title: newQuestion.title.trim(),
      description: newQuestion.description.trim(),
      type: isInterviewRound ? "INTERVIEW_QUESTION" : newQuestion.type,
      topic: newQuestion.topic.trim() || selectedTopics[0] || "Custom",
      difficulty: newQuestion.difficulty,
      options: newQuestion.options.filter((o) => o.trim().length > 0),
      marks: newQuestion.marks || 1,
      sampleTestCases: newQuestion.sampleInput ? [`Input: ${newQuestion.sampleInput}`, `Output: ${newQuestion.sampleOutput}`] : [],
    };

    handleUpdate({ customQuestions: [...customQuestions, formatted] });
    setShowAddQuestionModal(false);
    setNewQuestion({
      title: "",
      description: "",
      type: "MCQ_SINGLE",
      topic: "",
      difficulty: "MEDIUM",
      options: ["", "", "", ""],
      marks: 1,
      sampleInput: "",
      sampleOutput: "",
    });
    setActiveTab("custom_questions");
  };

  const removeCustomQuestion = (idx: number) => {
    const updated = customQuestions.filter((_, i) => i !== idx);
    handleUpdate({ customQuestions: updated });
  };

  return (
    <div className="mt-2.5 rounded-xl border border-indigo-100 bg-indigo-50/40 overflow-hidden text-xs transition">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 flex items-center justify-between text-indigo-900 font-bold hover:bg-indigo-100/50 transition cursor-pointer"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <Icon name="database" size={14} className="text-indigo-600 shrink-0" />
          <span className="font-semibold">
            {isInterviewRound ? "Interview Questions & Topics Config" : "Question Bank, Topics & JSON Upload"}
          </span>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-200/60 text-indigo-800">
            {customQuestions.length > 0
              ? `${customQuestions.length} Custom Questions`
              : selectedTopics.length > 0
              ? `${selectedTopics.length} Topics Selected`
              : "Full Platform Pool"}
          </span>
          <span className="text-[10px] text-slate-500 font-normal">
            • {currentCount} Questions ({currentDifficulty})
          </span>
        </div>
        <div className="flex items-center gap-1 text-slate-500 text-[11px] shrink-0">
          <span>{isOpen ? "Hide Settings" : "Configure Questions & Topics"}</span>
          <Icon name="chevron-down" size={14} className={isOpen ? "rotate-180 transition-transform" : "transition-transform"} />
        </div>
      </button>

      {isOpen && (
        <div className="p-3.5 border-t border-indigo-100 bg-white/90 space-y-3.5">
          {/* Navigation Sub-Tabs */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab("topics")}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                  activeTab === "topics"
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                1. Topics &amp; Bank Settings
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("custom_questions")}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
                  activeTab === "custom_questions"
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                <span>2. Custom Questions &amp; JSON Upload</span>
                {customQuestions.length > 0 && (
                  <span className="bg-emerald-500 text-white text-[9px] px-1.5 py-0.2 rounded-full font-bold">
                    {customQuestions.length}
                  </span>
                )}
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={downloadSampleTemplate}
                className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 hover:underline"
                title="Download JSON sample format for this round"
              >
                <Icon name="download" size={12} />
                Sample JSON
              </button>
            </div>
          </div>

          {activeTab === "topics" ? (
            <div className="space-y-3">
              {/* Question Count & Difficulty Selector */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                    {isInterviewRound ? "Interview Questions Target" : "Questions Drawn from Bank"}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={upperType === "DSA" ? 10 : 50}
                      value={currentCount}
                      onChange={(e) =>
                        handleUpdate({ questionCount: Math.max(1, Number(e.target.value)) })
                      }
                      className="w-24 rounded-lg border border-slate-200 p-1.5 text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 bg-white"
                    />
                    <span className="text-[11px] text-slate-500">
                      {isInterviewRound
                        ? "Interview questions per candidate"
                        : upperType === "DSA"
                        ? "Coding challenges (default 3)"
                        : "MCQ problems drawn dynamically"}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Difficulty Filter
                  </label>
                  <select
                    value={currentDifficulty}
                    onChange={(e) => handleUpdate({ difficulty: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 p-1.5 text-xs text-slate-800 outline-none focus:border-indigo-500 bg-white"
                  >
                    <option value="ALL">Balanced Mix (Easy, Medium, Hard)</option>
                    <option value="EASY">Easy Focused (Entry Level)</option>
                    <option value="MEDIUM">Medium Focused (Standard Placement)</option>
                    <option value="HARD">Hard Only (Advanced / Product Companies)</option>
                  </select>
                </div>
              </div>

              {/* Topic Selectors */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                    Select Topics &amp; Domains
                  </label>
                  <div className="flex items-center gap-2 text-[10px]">
                    <button
                      type="button"
                      onClick={selectAllTopics}
                      className="text-indigo-600 hover:underline font-bold"
                    >
                      Select All
                    </button>
                    <span className="text-slate-300">•</span>
                    <button
                      type="button"
                      onClick={clearAllTopics}
                      className="text-slate-500 hover:underline"
                    >
                      Clear Selection
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1.5">
                  {availableTopics.map((topic) => {
                    const isSelected = selectedTopics.includes(topic);
                    return (
                      <button
                        key={topic}
                        type="button"
                        onClick={() => toggleTopic(topic)}
                        className={`px-2.5 py-1.5 rounded-lg border text-left text-xs transition cursor-pointer flex items-center gap-2 ${
                          isSelected
                            ? "border-indigo-500 bg-indigo-50 text-indigo-900 font-bold"
                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        <span
                          className={`w-3.5 h-3.5 rounded flex items-center justify-center text-[9px] shrink-0 ${
                            isSelected
                              ? "bg-indigo-600 text-white font-bold"
                              : "border border-slate-300 bg-white"
                          }`}
                        >
                          {isSelected ? "✓" : ""}
                        </span>
                        <span className="truncate">{topic}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Company Admin Custom Topic Addition */}
                <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center gap-2">
                  <input
                    type="text"
                    value={customTopicInput}
                    onChange={(e) => setCustomTopicInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addCustomTopic();
                      }
                    }}
                    placeholder="Company Admin: specify custom topic (e.g. AWS Lambdas, LangChain, Kafka)..."
                    className="flex-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-800 outline-none focus:border-indigo-500 bg-white"
                  />
                  <button
                    type="button"
                    onClick={addCustomTopic}
                    className="btn-secondary !text-xs !py-1 !px-2.5 shrink-0"
                  >
                    <Icon name="plus" size={12} /> Add Topic
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* --- CUSTOM QUESTIONS & JSON UPLOAD SECTION --- */
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                <div>
                  <h4 className="text-xs font-bold text-slate-900">Company Custom Questions</h4>
                  <p className="text-[11px] text-slate-500">
                    Upload questions via JSON or add them directly. Custom questions take priority over the generic database pool.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json,application/json"
                    className="hidden"
                    onChange={handleJsonUpload}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="btn-secondary !text-xs !py-1 !px-2.5"
                  >
                    <Icon name="upload" size={12} /> Upload JSON
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddQuestionModal(true)}
                    className="btn-primary !text-xs !py-1 !px-2.5"
                  >
                    <Icon name="plus" size={12} /> Add Directly
                  </button>
                </div>
              </div>

              {uploadError && (
                <div className="p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                  {uploadError}
                </div>
              )}
              {uploadSuccess && (
                <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs">
                  {uploadSuccess}
                </div>
              )}

              {/* Direct Question Form Modal */}
              {showAddQuestionModal && (
                <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-200 space-y-2.5 animate-slide-down">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-indigo-950">Add Custom Question</span>
                    <button
                      type="button"
                      onClick={() => setShowAddQuestionModal(false)}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <Icon name="x" size={14} />
                    </button>
                  </div>

                  <div className="space-y-2">
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-600 mb-0.5">
                        Question / Title *
                      </label>
                      <input
                        type="text"
                        value={newQuestion.title}
                        onChange={(e) => setNewQuestion({ ...newQuestion, title: e.target.value })}
                        placeholder={isInterviewRound ? "e.g. How does Redis achieve single-threaded high performance?" : "e.g. Reverse a singly linked list in O(1) space."}
                        className="w-full rounded-lg border border-slate-200 p-1.5 text-xs text-slate-800 bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-600 mb-0.5">
                        {isInterviewRound ? "Key Evaluation Points / Ideal Answer Rubric" : "Description / Problem Statement"}
                      </label>
                      <textarea
                        value={newQuestion.description}
                        onChange={(e) => setNewQuestion({ ...newQuestion, description: e.target.value })}
                        placeholder="Evaluation criteria, constraints, or hints..."
                        className="w-full rounded-lg border border-slate-200 p-1.5 text-xs text-slate-800 bg-white min-h-[50px]"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-slate-600 mb-0.5">Topic</label>
                        <input
                          type="text"
                          value={newQuestion.topic}
                          onChange={(e) => setNewQuestion({ ...newQuestion, topic: e.target.value })}
                          placeholder="e.g. Distributed Caching"
                          className="w-full rounded-lg border border-slate-200 p-1.5 text-xs text-slate-800 bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-slate-600 mb-0.5">Difficulty</label>
                        <select
                          value={newQuestion.difficulty}
                          onChange={(e) => setNewQuestion({ ...newQuestion, difficulty: e.target.value })}
                          className="w-full rounded-lg border border-slate-200 p-1.5 text-xs text-slate-800 bg-white"
                        >
                          <option value="EASY">Easy</option>
                          <option value="MEDIUM">Medium</option>
                          <option value="HARD">Hard</option>
                        </select>
                      </div>
                    </div>

                    {!isInterviewRound && upperType !== "DSA" && (
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-slate-600 mb-0.5">
                          Multiple Choice Options (4 Options)
                        </label>
                        <div className="grid grid-cols-2 gap-1.5">
                          {newQuestion.options.map((opt, i) => (
                            <input
                              key={i}
                              type="text"
                              value={opt}
                              onChange={(e) => {
                                const next = [...newQuestion.options];
                                next[i] = e.target.value;
                                setNewQuestion({ ...newQuestion, options: next });
                              }}
                              placeholder={`Option ${String.fromCharCode(65 + i)}`}
                              className="rounded-lg border border-slate-200 p-1 text-xs text-slate-800 bg-white"
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setShowAddQuestionModal(false)}
                        className="btn-secondary !text-xs !py-1 !px-2"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveDirectQuestion}
                        className="btn-primary !text-xs !py-1 !px-2.5"
                      >
                        Save Question
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Questions List */}
              {customQuestions.length === 0 ? (
                <div className="p-4 text-center text-slate-400 bg-white rounded-xl border border-dashed border-slate-200">
                  <p className="text-xs">No custom questions added yet.</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Click <strong>Upload JSON</strong> or <strong>Add Directly</strong> to specify questions for this round.
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                  {customQuestions.map((q, idx) => (
                    <div
                      key={q.id || idx}
                      className="p-2.5 bg-white rounded-lg border border-slate-200 flex items-start justify-between gap-2 shadow-xs"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono text-[10px] text-indigo-600 font-bold">#{idx + 1}</span>
                          <span className="font-semibold text-slate-900 text-xs truncate max-w-xs">{q.title}</span>
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-medium bg-slate-100 text-slate-600">
                            {q.topic || "General"}
                          </span>
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-50 text-amber-700">
                            {q.difficulty}
                          </span>
                        </div>
                        {q.description && (
                          <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">{q.description}</p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeCustomQuestion(idx)}
                        className="text-slate-400 hover:text-rose-600 p-1"
                        title="Remove question"
                      >
                        <Icon name="trash-2" size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
