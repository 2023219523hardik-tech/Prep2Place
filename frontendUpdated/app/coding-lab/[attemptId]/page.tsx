"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { codingLabApi, WorkspaceView, SubmissionResult, HintResponseView } from "@/lib/codingLabApi";
import LoadingState from "@/components/LoadingState";
import ErrorState from "@/components/ErrorState";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center bg-[#0d1117] text-sm text-slate-400">
      <div className="flex items-center gap-2">
        <svg className="animate-spin w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
        <span>Initializing editor environment...</span>
      </div>
    </div>
  ),
});

const LANGUAGE_FOR_EXT: Record<string, string> = {
  java: "java",
  js: "javascript",
  ts: "typescript",
  tsx: "typescript",
  py: "python",
  json: "json",
  md: "markdown",
  sql: "sql",
  html: "html",
  css: "css",
};

function editorLanguageFor(path: string) {
  const ext = path.split(".").pop() || "";
  return LANGUAGE_FOR_EXT[ext] || "plaintext";
}

function getFileBadge(filename: string) {
  const ext = filename.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "py":
      return { icon: "🐍", label: "Python", bg: "bg-blue-950/60 text-blue-400 border-blue-800/60" };
    case "java":
      return { icon: "☕", label: "Java", bg: "bg-amber-950/60 text-amber-400 border-amber-800/60" };
    case "js":
      return { icon: "⚡", label: "JavaScript", bg: "bg-yellow-950/60 text-yellow-300 border-yellow-800/60" };
    case "ts":
    case "tsx":
      return { icon: "🔷", label: "TypeScript", bg: "bg-cyan-950/60 text-cyan-400 border-cyan-800/60" };
    case "html":
      return { icon: "🌐", label: "HTML5", bg: "bg-orange-950/60 text-orange-400 border-orange-800/60" };
    case "css":
      return { icon: "🎨", label: "CSS3", bg: "bg-sky-950/60 text-sky-400 border-sky-800/60" };
    case "json":
      return { icon: "{}", label: "JSON", bg: "bg-emerald-950/60 text-emerald-400 border-emerald-800/60" };
    case "md":
      return { icon: "📝", label: "Markdown", bg: "bg-slate-800/80 text-slate-300 border-slate-700" };
    default:
      return { icon: "📄", label: "File", bg: "bg-slate-800/80 text-slate-400 border-slate-700" };
  }
}

export default function CodingWorkspacePage() {
  const params = useParams<{ attemptId: string }>();
  const router = useRouter();
  const attemptId = Number(params.attemptId);

  const [workspace, setWorkspace] = useState<WorkspaceView | null>(null);
  const [files, setFiles] = useState<Record<string, string>>({});
  const [activeFile, setActiveFile] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<SubmissionResult | null>(null);

  // Tabs for the bottom dock
  const [dockTab, setDockTab] = useState<"output" | "tests" | "errors" | "preview">("output");
  const [editorViewMode, setEditorViewMode] = useState<"code" | "split" | "preview">("split");
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [previewKey, setPreviewKey] = useState(0);
  const [isAiCollapsed, setIsAiCollapsed] = useState(false);
  const [isFileTreeCollapsed, setIsFileTreeCollapsed] = useState(false);

  // AI Hint state
  const [hintMessage, setHintMessage] = useState("");
  const [hintHistory, setHintHistory] = useState<{ from: "student" | "assistant"; text: string; time?: string }[]>([]);
  const [hintLoading, setHintLoading] = useState(false);
  const [hintsInfo, setHintsInfo] = useState<{ used: number; remaining: number } | null>(null);

  useEffect(() => {
    codingLabApi
      .getWorkspace(attemptId)
      .then((w) => {
        setWorkspace(w);
        setFiles(w.files);
        const editable = Object.keys(w.files)[0];
        setActiveFile(editable || "");
        setHintsInfo({ used: w.aiHintsUsed, remaining: w.aiHintsRemaining });
        if (w.codingType === "FRONTEND") {
          setEditorViewMode("split");
        } else {
          setEditorViewMode("code");
        }
      })
      .catch((e) => setError(e.message || "Failed to load workspace"))
      .finally(() => setLoading(false));
  }, [attemptId]);

  const readOnlyFiles = useMemo(() => (workspace ? Object.keys(workspace.publicTestFiles) : []), [workspace]);
  const allFileNames = useMemo(
    () => [...Object.keys(files), ...readOnlyFiles.filter((f) => !(f in files))],
    [files, readOnlyFiles]
  );

  const isFrontend = useMemo(() => {
    return workspace?.codingType === "FRONTEND" || !!files["index.html"] || !!files["styles.css"];
  }, [workspace, files]);

  const previewHtml = useMemo(() => {
    if (!isFrontend) return "";
    let html = files["index.html"] || "<!DOCTYPE html><html><head><meta charset=\"UTF-8\" /><title>Preview</title></head><body></body></html>";
    const css = files["styles.css"] || files["style.css"] || "";
    const js = files["script.js"] || files["index.js"] || files["main.js"] || "";

    if (!html.toLowerCase().includes("<html")) {
      html = `<!DOCTYPE html><html><head><meta charset="UTF-8" /><title>Preview</title></head><body>${html}</body></html>`;
    }

    if (css) {
      const styleTag = `<style id="__p2p_live_css">\n${css}\n</style>`;
      if (html.includes("</head>")) {
        html = html.replace("</head>", `${styleTag}\n</head>`);
      } else {
        html = `${styleTag}\n` + html;
      }
    }

    if (js) {
      const scriptTag = `<script id="__p2p_live_js">\ntry {\n${js}\n} catch (err) { console.error('Preview Script Error:', err); }\n</script>`;
      if (html.includes("</body>")) {
        html = html.replace("</body>", `${scriptTag}\n</body>`);
      } else {
        html = html + `\n${scriptTag}`;
      }
    }

    return html;
  }, [isFrontend, files]);

  async function persistFiles(next: Record<string, string>) {
    try {
      await codingLabApi.saveFiles(attemptId, next);
    } catch {
      // Autosave failures are non-fatal
    }
  }

  function updateFile(path: string, content: string) {
    const next = { ...files, [path]: content };
    setFiles(next);
  }

  async function run() {
    setRunning(true);
    setError("");
    try {
      await persistFiles(files);
      setPreviewKey((k) => k + 1);
      const r = await codingLabApi.execute(attemptId, files);
      setResult(r);
      if (r.compilationError || r.runtimeError) {
        setDockTab("errors");
      } else {
        setDockTab("tests");
      }
    } catch (e: any) {
      setError(e.message || "Run failed");
      setDockTab("errors");
    } finally {
      setRunning(false);
    }
  }

  async function submit() {
    if (!window.confirm("Submit your solution for final evaluation?")) return;
    setSubmitting(true);
    setError("");
    try {
      await persistFiles(files);
      const r = await codingLabApi.submit(attemptId, files);
      setResult(r);
      const w = await codingLabApi.getWorkspace(attemptId);
      setWorkspace(w);
      setDockTab("tests");
    } catch (e: any) {
      setError(e.message || "Submit failed");
      setDockTab("errors");
    } finally {
      setSubmitting(false);
    }
  }

  async function askHint(presetPrompt?: string) {
    const promptToSend = presetPrompt || hintMessage;
    if (!promptToSend.trim() || hintLoading) return;
    const timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    setHintHistory((h) => [...h, { from: "student", text: promptToSend, time: timestamp }]);
    if (!presetPrompt) setHintMessage("");
    setHintLoading(true);
    try {
      const r: HintResponseView = await codingLabApi.requestHint(attemptId, promptToSend);
      setHintHistory((h) => [
        ...h,
        {
          from: "assistant",
          text: r.text,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
      setHintsInfo({ used: r.hintsUsed, remaining: r.hintsRemaining });
    } catch (e: any) {
      setHintHistory((h) => [
        ...h,
        {
          from: "assistant",
          text: e.message || "Could not reach the AI hint assistant.",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setHintLoading(false);
    }
  }

  if (loading) return <LoadingState label="Preparing your coding environment..." />;
  if (error && !workspace) return <ErrorState message={error} />;
  if (!workspace) return null;

  const isReadOnly = readOnlyFiles.includes(activeFile);
  const isTerminated = workspace.status !== "STARTED";
  const activeFileBadge = getFileBadge(activeFile);

  return (
    <div className="fixed inset-0 h-screen w-screen z-50 bg-[#090d16] text-slate-100 select-none overflow-hidden font-sans flex flex-col">
      {/* ============================================================
          TOP IDE TOOLBAR
      ============================================================ */}
      <header className="h-14 bg-[#0d1322] border-b border-slate-800/80 px-4 sm:px-6 flex items-center justify-between shrink-0 shadow-lg z-20">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => router.push("/coding-lab")}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800/50 hover:bg-slate-800 border border-slate-700/60 rounded-lg transition-all group"
          >
            <svg
              className="w-3.5 h-3.5 text-slate-400 group-hover:-translate-x-0.5 transition-transform"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
            </svg>
            <span className="font-semibold">Lab Catalog</span>
          </button>

          <div className="h-4 w-px bg-slate-800" />

          {/* Title & Status */}
          <div className="flex items-center gap-2.5 truncate">
            <h1 className="text-xs sm:text-sm font-bold text-white tracking-tight truncate max-w-[200px] sm:max-w-md">
              {workspace.title}
            </h1>
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border shadow-xs ${
                workspace.status === "STARTED"
                  ? "bg-emerald-950/80 text-emerald-400 border-emerald-600/40"
                  : "bg-slate-800/80 text-slate-300 border-slate-700"
              }`}
            >
              {workspace.status === "STARTED" && (
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                </span>
              )}
              {workspace.status === "STARTED" ? "Active Attempt" : workspace.status}
            </span>
          </div>
        </div>

        {/* Right Action Cluster */}
        <div className="flex items-center gap-2.5 shrink-0">
          {hintsInfo && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-950/70 border border-indigo-700/50 text-indigo-300 text-xs font-semibold shadow-xs">
              <span className="text-indigo-400">⚡</span>
              <span>{hintsInfo.remaining} Hints left</span>
            </div>
          )}

          {/* Run Button */}
          <button
            onClick={run}
            disabled={running || isTerminated}
            className="inline-flex items-center gap-1.5 h-8 px-3.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-100 hover:text-white border border-slate-700 hover:border-slate-600 shadow-sm active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            title="Execute current code in isolated runner"
          >
            {running ? (
              <svg className="animate-spin w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5 text-emerald-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
            <span>{running ? "Executing..." : "Run"}</span>
          </button>

          {/* Submit Button */}
          <button
            onClick={submit}
            disabled={submitting || isTerminated}
            className="inline-flex items-center gap-1.5 h-8 px-4 text-xs font-bold rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-md shadow-emerald-950/40 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            title="Submit files for grading"
          >
            {submitting ? (
              <svg className="animate-spin w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
              </svg>
            )}
            <span>{submitting ? "Evaluating..." : "Submit"}</span>
          </button>
        </div>
      </header>

      {/* ============================================================
          MAIN 3-PANE WORKSPACE
      ============================================================ */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-2.5 p-2.5 overflow-hidden min-h-0 bg-[#090d16]">
        {/* ============================================================
            PANE 1: FILE EXPLORER
        ============================================================ */}
        <section
          className={`${
            isFileTreeCollapsed ? "lg:col-span-1 hidden lg:flex" : "lg:col-span-2 flex"
          } flex-col bg-[#0e1422] rounded-xl border border-slate-800/80 shadow-md overflow-hidden min-h-0 transition-all`}
        >
          {/* File Header */}
          <div className="h-9 border-b border-slate-800/80 bg-[#12192c] px-3 flex items-center justify-between shrink-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              Files
            </span>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-slate-400 font-mono bg-slate-800/60 px-1.5 py-0.2 rounded border border-slate-700/50">
                {allFileNames.length}
              </span>
              <button
                onClick={() => setIsFileTreeCollapsed(!isFileTreeCollapsed)}
                className="hidden lg:block text-slate-400 hover:text-white p-0.5 rounded transition"
                title={isFileTreeCollapsed ? "Expand files" : "Collapse files"}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                </svg>
              </button>
            </div>
          </div>

          {/* File List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {allFileNames.map((filename) => {
              const badge = getFileBadge(filename);
              const readOnly = readOnlyFiles.includes(filename);
              const isActive = activeFile === filename;
              return (
                <button
                  key={filename}
                  onClick={() => setActiveFile(filename)}
                  className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-xs font-mono transition text-left group ${
                    isActive
                      ? "bg-slate-800/90 text-white font-semibold border-l-2 border-emerald-400 shadow-sm"
                      : "text-slate-400 hover:bg-slate-800/40 hover:text-slate-200"
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="text-xs">{badge.icon}</span>
                    <span className="truncate">{filename}</span>
                  </div>
                  {readOnly && (
                    <span className="shrink-0 text-[9px] px-1.5 py-0.5 rounded bg-slate-900/90 text-slate-400 border border-slate-700/60 font-sans flex items-center gap-1">
                      <svg className="w-2.5 h-2.5 text-slate-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                      </svg>
                      locked
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {/* ============================================================
            PANE 2: EDITOR & OUTPUT CONSOLE DOCK
        ============================================================ */}
        <section
          className={`${
            isAiCollapsed
              ? isFileTreeCollapsed ? "lg:col-span-11" : "lg:col-span-10"
              : isFileTreeCollapsed ? "lg:col-span-8" : "lg:col-span-7"
          } flex flex-col gap-2.5 overflow-hidden min-h-0 transition-all`}
        >
          {/* Top Half: Monaco Editor */}
          <div className="flex-1 flex flex-col bg-[#0e1422] rounded-xl border border-slate-800/80 shadow-md overflow-hidden min-h-[300px]">
            {/* Editor Tab Bar */}
            <div className="h-9 border-b border-slate-800/80 bg-[#12192c] px-3 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <div className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#0e1422] border border-slate-700/60 text-xs font-semibold text-white shadow-xs">
                  <span>{activeFileBadge.icon}</span>
                  <span className="truncate font-mono">{activeFile || "Select a file"}</span>
                </div>
                {isReadOnly && (
                  <span className="text-[10px] text-amber-400 font-sans italic bg-amber-950/40 border border-amber-800/40 px-2 py-0.5 rounded">
                    Read-only Test Suite
                  </span>
                )}
              </div>

              {/* Center: Frontend View Mode Switcher */}
              {isFrontend && (
                <div className="flex items-center gap-1 bg-[#090d16] p-0.5 rounded-lg border border-slate-700/60">
                  <button
                    onClick={() => setEditorViewMode("code")}
                    className={`flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-semibold transition ${
                      editorViewMode === "code"
                        ? "bg-slate-800 text-white shadow-xs border border-slate-700/80 font-bold"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                    title="Code editor full width"
                  >
                    <span>💻</span>
                    <span>Code</span>
                  </button>
                  <button
                    onClick={() => setEditorViewMode("split")}
                    className={`flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-semibold transition ${
                      editorViewMode === "split"
                        ? "bg-emerald-950 text-emerald-300 border border-emerald-700/60 font-bold shadow-xs"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                    title="Split View: Editor + Live Webpage"
                  >
                    <span>⚡</span>
                    <span>Split View</span>
                  </button>
                  <button
                    onClick={() => setEditorViewMode("preview")}
                    className={`flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-semibold transition ${
                      editorViewMode === "preview"
                        ? "bg-cyan-950 text-cyan-300 border border-cyan-700/60 font-bold shadow-xs"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                    title="Live Webpage full width"
                  >
                    <span>🌐</span>
                    <span>Live Preview</span>
                  </button>
                </div>
              )}

              <div className="flex items-center gap-3 text-xs text-slate-400">
                <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-slate-800/60 border border-slate-700/50 text-slate-300">
                  {editorLanguageFor(activeFile)}
                </span>
                <span className="text-[11px] text-slate-500 font-mono hidden sm:inline">Spaces: 4</span>
              </div>
            </div>

            {/* Monaco Canvas / Live Preview Area */}
            <div className="flex-1 min-h-0 bg-[#0d1117] flex overflow-hidden">
              {/* Left/Main: Monaco Editor */}
              {(!isFrontend || editorViewMode !== "preview") && (
                <div
                  className={`h-full ${
                    isFrontend && editorViewMode === "split" ? "w-1/2 border-r border-slate-800/80" : "w-full"
                  } overflow-hidden`}
                >
                  <MonacoEditor
                    value={isReadOnly ? workspace.publicTestFiles[activeFile] : files[activeFile] ?? ""}
                    language={editorLanguageFor(activeFile)}
                    theme="vs-dark"
                    options={{
                      readOnly: isReadOnly || isTerminated,
                      minimap: { enabled: false },
                      fontSize: 13,
                      lineHeight: 20,
                      tabSize: 4,
                      wordWrap: "on",
                      automaticLayout: true,
                      scrollBeyondLastLine: false,
                      padding: { top: 12, bottom: 12 },
                      smoothScrolling: true,
                      cursorBlinking: "smooth",
                    }}
                    onChange={(value) => {
                      if (!isReadOnly) updateFile(activeFile, value ?? "");
                    }}
                  />
                </div>
              )}

              {/* Right: Live Webpage Preview (when split or preview mode) */}
              {isFrontend && editorViewMode !== "code" && (
                <div
                  className={`h-full ${
                    editorViewMode === "preview" ? "w-full" : "w-1/2"
                  } flex flex-col bg-[#0b0f19] overflow-hidden`}
                >
                  {/* Preview Toolbar */}
                  <div className="h-8 bg-[#101626] px-3 border-b border-slate-800/80 flex items-center justify-between text-xs shrink-0">
                    <div className="flex items-center gap-2">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                      </span>
                      <span className="text-[11px] font-bold text-slate-300">Live Webpage Preview</span>
                      <span className="text-[10px] text-emerald-400 font-mono hidden xl:inline">● Realtime Sync</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <div className="flex items-center bg-[#090d16] rounded border border-slate-700/60 p-0.5 text-[10px]">
                        <button
                          onClick={() => setPreviewDevice("desktop")}
                          className={`px-2 py-0.5 rounded font-semibold transition ${
                            previewDevice === "desktop" ? "bg-slate-700 text-white font-bold" : "text-slate-400 hover:text-slate-200"
                          }`}
                          title="Desktop View (100%)"
                        >
                          Desktop
                        </button>
                        <button
                          onClick={() => setPreviewDevice("tablet")}
                          className={`px-2 py-0.5 rounded font-semibold transition ${
                            previewDevice === "tablet" ? "bg-slate-700 text-white font-bold" : "text-slate-400 hover:text-slate-200"
                          }`}
                          title="Tablet View (768px)"
                        >
                          Tablet
                        </button>
                        <button
                          onClick={() => setPreviewDevice("mobile")}
                          className={`px-2 py-0.5 rounded font-semibold transition ${
                            previewDevice === "mobile" ? "bg-slate-700 text-white font-bold" : "text-slate-400 hover:text-slate-200"
                          }`}
                          title="Mobile View (375px)"
                        >
                          Mobile
                        </button>
                      </div>

                      <button
                        onClick={() => setPreviewKey((k) => k + 1)}
                        className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/50 text-[10px] font-medium transition"
                        title="Reload live preview"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        <span>Refresh</span>
                      </button>
                    </div>
                  </div>

                  {/* Iframe Viewport Container */}
                  <div className="flex-1 bg-slate-950/80 p-2 flex items-center justify-center overflow-auto">
                    <div
                      className={`h-full bg-white rounded-lg shadow-2xl overflow-hidden transition-all duration-300 ${
                        previewDevice === "desktop"
                          ? "w-full"
                          : previewDevice === "tablet"
                          ? "w-[768px] max-w-full border-2 border-slate-700"
                          : "w-[375px] max-w-full border-4 border-slate-700 rounded-2xl"
                      }`}
                    >
                      <iframe
                        key={previewKey}
                        title="Live Webpage Preview"
                        srcDoc={previewHtml}
                        sandbox="allow-scripts allow-modals"
                        className="w-full h-full border-0 bg-white"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Bottom Half: Console & Execution Results */}
          <div className="h-[250px] flex flex-col bg-[#0e1422] rounded-xl border border-slate-800/80 shadow-md overflow-hidden shrink-0">
            {/* Console Dock Tabs */}
            <div className="h-9 border-b border-slate-800/80 bg-[#12192c] px-3 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setDockTab("output")}
                  className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                    dockTab === "output"
                      ? "bg-slate-800 text-white shadow-xs border border-slate-700 font-bold"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
                  }`}
                >
                  <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span>Console Output</span>
                </button>

                <button
                  onClick={() => setDockTab("tests")}
                  className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                    dockTab === "tests"
                      ? "bg-slate-800 text-white shadow-xs border border-slate-700 font-bold"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
                  }`}
                >
                  <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Test Results</span>
                  {result && (
                    <span
                      className={`ml-1 text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                        result.status === "SUCCESS"
                          ? "bg-emerald-950 text-emerald-300 border border-emerald-700"
                          : "bg-rose-950 text-rose-300 border border-rose-700"
                      }`}
                    >
                      {result.testsPassed}/{result.testsTotal}
                    </span>
                  )}
                </button>

                {(result?.compilationError || result?.runtimeError || error) && (
                  <button
                    onClick={() => setDockTab("errors")}
                    className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                      dockTab === "errors"
                        ? "bg-rose-950/80 text-rose-200 border border-rose-700 font-bold"
                        : "text-rose-400 hover:bg-rose-950/40"
                    }`}
                  >
                    <span>⚠</span>
                    <span>Errors</span>
                  </button>
                )}

                {isFrontend && (
                  <button
                    onClick={() => setDockTab("preview")}
                    className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                      dockTab === "preview"
                        ? "bg-slate-800 text-white shadow-xs border border-slate-700 font-bold"
                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
                    }`}
                  >
                    <span>🌐</span>
                    <span>Webpage Preview</span>
                  </button>
                )}
              </div>

              {/* Execution Status Badge */}
              {result && (
                <div className="flex items-center gap-3 text-xs">
                  <span
                    className={`font-bold px-2.5 py-0.5 rounded-full text-[10px] uppercase tracking-wider border ${
                      result.status === "SUCCESS"
                        ? "bg-emerald-950/80 text-emerald-300 border-emerald-700/60"
                        : "bg-rose-950/80 text-rose-300 border-rose-700/60"
                    }`}
                  >
                    {result.status}
                  </span>
                  <span className="text-slate-400 font-mono text-[11px] flex items-center gap-1">
                    <svg className="w-3 h-3 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {result.runtimeMs} ms
                  </span>
                  {result.kind === "SUBMIT" && (
                    <span className="font-bold text-emerald-400 text-xs">Score: {Math.round(result.score)}%</span>
                  )}
                </div>
              )}
            </div>

            {/* Console Content Area */}
            <div className="flex-1 overflow-y-auto p-3 text-xs font-mono select-text bg-[#090d16]">
              {dockTab === "output" && (
                <div className="h-full">
                  {result?.publicOutput ? (
                    <pre className="p-3 bg-[#0d1117] rounded-lg border border-slate-800 text-slate-200 whitespace-pre-wrap leading-relaxed font-mono">
                      {result.publicOutput}
                    </pre>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-500 font-sans text-xs gap-2 py-8">
                      <svg className="w-8 h-8 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p>Click <strong className="text-slate-300 mx-1">Run</strong> to execute code and inspect output logs.</p>
                    </div>
                  )}
                </div>
              )}

              {dockTab === "tests" && (
                <div className="space-y-3 font-sans">
                  {result ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                        <span className="flex items-center gap-1.5">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              result.status === "SUCCESS" ? "bg-emerald-500" : "bg-rose-500"
                            }`}
                          />
                          {result.testsPassed} of {result.testsTotal} test cases passed
                        </span>
                        <span className="text-slate-400 font-mono text-[11px]">Duration: {result.runtimeMs}ms</span>
                      </div>

                      {/* Visual Progress Bar */}
                      <div className="w-full bg-slate-800/80 rounded-full h-2 overflow-hidden border border-slate-700/40">
                        <div
                          className={`h-full transition-all duration-500 ${
                            result.status === "SUCCESS"
                              ? "bg-gradient-to-r from-emerald-500 to-teal-400"
                              : "bg-gradient-to-r from-rose-500 to-red-400"
                          }`}
                          style={{
                            width: `${result.testsTotal > 0 ? (result.testsPassed / result.testsTotal) * 100 : 0}%`,
                          }}
                        />
                      </div>

                      {result.publicOutput && (
                        <div className="mt-3">
                          <p className="text-[11px] font-semibold text-slate-400 mb-1">Execution Log</p>
                          <pre className="p-3 bg-[#0d1117] rounded-lg border border-slate-800 text-slate-300 font-mono text-[11px] whitespace-pre-wrap leading-relaxed">
                            {result.publicOutput}
                          </pre>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs gap-2 py-8">
                      <svg className="w-8 h-8 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                      </svg>
                      <p>No test execution run yet. Click Run to evaluate code against the test suite.</p>
                    </div>
                  )}
                </div>
              )}

              {dockTab === "errors" && (
                <div className="space-y-2.5 font-mono">
                  {result?.compilationError && (
                    <div className="p-3 bg-rose-950/40 rounded-lg border border-rose-800/60 text-rose-300">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-rose-400 mb-1 font-sans">
                        Compilation / Syntax Error
                      </p>
                      <pre className="whitespace-pre-wrap leading-relaxed text-xs">{result.compilationError}</pre>
                    </div>
                  )}
                  {result?.runtimeError && (
                    <div className="p-3 bg-rose-950/40 rounded-lg border border-rose-800/60 text-rose-300">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-rose-400 mb-1 font-sans">
                        Runtime Exception
                      </p>
                      <pre className="whitespace-pre-wrap leading-relaxed text-xs">{result.runtimeError}</pre>
                    </div>
                  )}
                  {error && (
                    <div className="p-3 bg-rose-950/40 rounded-lg border border-rose-800/60 text-rose-300">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-rose-400 mb-1 font-sans">
                        Execution Error
                      </p>
                      <pre className="whitespace-pre-wrap leading-relaxed text-xs">{error}</pre>
                    </div>
                  )}
                </div>
              )}

              {dockTab === "preview" && (
                <div className="h-full flex flex-col bg-white rounded-lg overflow-hidden min-h-[180px]">
                  <iframe
                    key={`dock-${previewKey}`}
                    title="Dock Webpage Preview"
                    srcDoc={previewHtml}
                    sandbox="allow-scripts allow-modals"
                    className="w-full h-full border-0 bg-white"
                  />
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ============================================================
            PANE 3: AI HINT ASSISTANT (COPILOT)
        ============================================================ */}
        {!isAiCollapsed && (
          <section className="lg:col-span-3 flex flex-col bg-[#0e1422] rounded-xl border border-slate-800/80 shadow-md overflow-hidden min-h-0">
            {/* AI Assistant Header */}
            <div className="h-9 border-b border-slate-800/80 bg-[#12192c] px-3 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <span className="text-indigo-400">⚡</span>
                  AI Hint Assistant
                </span>
                {hintsInfo && (
                  <span className="text-[10px] px-2 py-0.2 rounded-full bg-indigo-950 text-indigo-300 font-bold border border-indigo-700/60">
                    {hintsInfo.remaining} left
                  </span>
                )}
              </div>
              <button
                onClick={() => setIsAiCollapsed(true)}
                className="text-slate-400 hover:text-white p-1 rounded-md transition"
                title="Collapse Assistant"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Quick Prompts */}
            <div className="p-2 border-b border-slate-800/80 bg-[#0a0e1a] flex flex-wrap gap-1.5">
              <button
                onClick={() => askHint("Explain what this compiler error means and which line to check.")}
                className="text-[10px] px-2 py-1 rounded-md bg-slate-800/80 border border-slate-700/60 text-slate-300 hover:border-indigo-500 hover:bg-indigo-950/50 hover:text-indigo-200 transition"
              >
                🔍 Explain Error
              </button>
              <button
                onClick={() => askHint("What edge cases should I consider for this problem?")}
                className="text-[10px] px-2 py-1 rounded-md bg-slate-800/80 border border-slate-700/60 text-slate-300 hover:border-indigo-500 hover:bg-indigo-950/50 hover:text-indigo-200 transition"
              >
                💡 Edge Cases
              </button>
              <button
                onClick={() => askHint("Can you give a hint on the general algorithm approach?")}
                className="text-[10px] px-2 py-1 rounded-md bg-slate-800/80 border border-slate-700/60 text-slate-300 hover:border-indigo-500 hover:bg-indigo-950/50 hover:text-indigo-200 transition"
              >
                🧩 Hint on Approach
              </button>
            </div>

            {/* Message Feed */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-[#090d16]">
              {hintHistory.length === 0 ? (
                <div className="text-center p-4 text-xs text-slate-400 space-y-3 my-auto">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 text-white flex items-center justify-center mx-auto shadow-md shadow-indigo-950">
                    <span className="text-lg">🤖</span>
                  </div>
                  <p className="font-semibold text-slate-200 text-sm">Need guided hints?</p>
                  <p className="text-[11px] leading-relaxed text-slate-400">
                    Ask questions about syntax, error diagnostics, edge cases, or algorithmic concepts. The AI guides you without spoiling the solution.
                  </p>
                </div>
              ) : (
                hintHistory.map((m, i) => (
                  <div
                    key={i}
                    className={`text-xs rounded-xl p-3 leading-relaxed shadow-sm ${
                      m.from === "student"
                        ? "bg-indigo-600 text-white ml-6 border border-indigo-500"
                        : "bg-[#111728] text-slate-200 border border-slate-800 mr-4"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1 opacity-75 text-[10px] uppercase tracking-wider font-bold">
                      <span>{m.from === "student" ? "You" : "Arya AI Hint"}</span>
                      {m.time && <span className="font-mono text-[9px]">{m.time}</span>}
                    </div>
                    <div className="whitespace-pre-wrap leading-relaxed font-sans">{m.text}</div>
                  </div>
                ))
              )}
              {hintLoading && (
                <div className="flex items-center gap-2.5 text-xs text-indigo-300 bg-indigo-950/40 p-3 rounded-xl border border-indigo-800/50">
                  <svg className="animate-spin w-3.5 h-3.5 text-indigo-400" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <span>Formulating hint...</span>
                </div>
              )}
            </div>

            {/* Prompt Input */}
            <div className="p-2.5 border-t border-slate-800/80 bg-[#0e1422]">
              <div className="flex gap-2">
                <input
                  className="bg-[#090d16] border border-slate-700/80 text-white placeholder:text-slate-500 text-xs px-3 py-1.5 h-8 rounded-lg flex-1 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  placeholder="Ask for guidance or hint..."
                  value={hintMessage}
                  onChange={(e) => setHintMessage(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && askHint()}
                  disabled={hintsInfo?.remaining === 0 || hintLoading}
                />
                <button
                  className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white disabled:text-slate-500 h-8 px-3 rounded-lg text-xs font-semibold shadow-sm transition-all"
                  onClick={() => askHint()}
                  disabled={hintLoading || !hintMessage.trim() || hintsInfo?.remaining === 0}
                >
                  Send
                </button>
              </div>
            </div>
          </section>
        )}

        {isAiCollapsed && (
          <button
            onClick={() => setIsAiCollapsed(false)}
            className="fixed bottom-4 right-4 z-30 flex items-center gap-2 px-3 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-xs font-bold shadow-lg shadow-indigo-950/60 hover:scale-105 transition-all"
          >
            <span>⚡</span>
            <span>Open AI Assistant</span>
          </button>
        )}
      </div>
    </div>
  );
}
