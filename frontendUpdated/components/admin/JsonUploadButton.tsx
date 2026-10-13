"use client";

import { useRef, useState } from "react";
import { adminApi } from "@/lib/adminApi";

interface JsonUploadButtonProps {
  /** Endpoint that accepts a JSON array of upsert-request objects. */
  endpoint: string;
  /** Called with the number of rows created, so the page can reload its list. */
  onUploaded: (count: number) => void;
  /** A short JSON snippet shown in a collapsible hint, so admins know the expected shape. */
  sample: string;
}

/** Bulk JSON upload for the admin question banks (coding problems, technical MCQ, aptitude).
 *  Reads a local .json file, expects a top-level array, and POSTs it as-is to `endpoint`.
 *  Endpoints return either the created list or an import report with inserted/duplicates/failed
 *  counts; this component displays whichever shape comes back. */
export default function JsonUploadButton({ endpoint, onUploaded, sample }: JsonUploadButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showSample, setShowSample] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file after a fix
    if (!file) return;

    setError("");
    setSuccess("");
    setUploading(true);
    try {
      const text = await file.text();
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new Error("That file isn't valid JSON.");
      }
      if (!Array.isArray(parsed)) {
        throw new Error("Expected a JSON array of questions, e.g. [ {...}, {...} ].");
      }
      if (parsed.length === 0) {
        throw new Error("The file has no questions in it.");
      }

      const result = await adminApi.post<unknown>(endpoint, parsed);
      const count = Array.isArray(result)
        ? result.length
        : typeof result === "object" && result && "inserted" in result
        ? (result as any).inserted
        : parsed.length;
      const parts: string[] = [];
      if (typeof result === "object" && result && !Array.isArray(result)) {
        const r = result as any;
        if (typeof r.inserted === "number") parts.push(`${r.inserted} inserted`);
        if (typeof r.updated === "number" && r.updated > 0) parts.push(`${r.updated} updated`);
        if (typeof r.duplicates === "number" && r.duplicates > 0) parts.push(`${r.duplicates} duplicates`);
        if (typeof r.skipped === "number" && r.skipped > 0) parts.push(`${r.skipped} skipped`);
        if (typeof r.failed === "number" && r.failed > 0) parts.push(`${r.failed} failed`);
      }
      setSuccess(
        parts.length > 0
          ? `Upload complete: ${parts.join(", ")}.`
          : `Uploaded ${count} question${count === 1 ? "" : "s"}.`
      );
      onUploaded(count);
    } catch (err: any) {
      setError(err.message || "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="btn-secondary"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? "Uploading…" : "Upload JSON"}
        </button>
        <input ref={inputRef} type="file" accept="application/json,.json" className="hidden" onChange={handleFile} />
        <button
          type="button"
          className="text-xs text-slate-500 hover:underline"
          onClick={() => setShowSample((s) => !s)}
        >
          {showSample ? "Hide expected format" : "Expected format?"}
        </button>
      </div>
      {showSample && (
        <pre className="text-xs bg-slate-50 border border-slate-200 rounded p-3 overflow-x-auto max-w-2xl whitespace-pre">
{sample}
        </pre>
      )}
      {error && <p className="text-xs text-red-600 max-w-md">{error}</p>}
      {success && <p className="text-xs text-teal-700">{success}</p>}
    </div>
  );
}
