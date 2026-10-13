"use client";

import React, { useMemo } from "react";

export interface MatrixProblemInfo {
  title?: string;
  topic?: string;
  topics?: string[];
  description?: string;
  statement?: string;
  templates?: Record<string, string>;
}

export interface MatrixVisualizerProps {
  data: string;
  title?: string;
  highlightCoordinates?: [number, number][];
  problem?: MatrixProblemInfo | null;
  isMatrix?: boolean;
}

interface ParsedMatrix {
  name: string;
  matrix: any[][];
  extraParams?: string;
}

/**
 * Checks whether a problem is specifically a 2D Matrix / Grid / Board problem
 * (e.g. Set Matrix Zeroes, Flood Fill, Rotate Image, Spiral Matrix, Word Search, Number of Islands)
 * rather than a general problem returning list-of-lists (e.g. 3Sum, Subsets, Combination Sum).
 */
export function is2DMatrixProblem(problem?: MatrixProblemInfo | null): boolean {
  if (!problem) return false;

  const title = (problem.title || "").toLowerCase();
  const desc = ((problem.description || "") + " " + (problem.statement || "")).toLowerCase();
  const topicsList = Array.isArray(problem.topics) ? problem.topics : [];
  const allTopics = [...topicsList, problem.topic || ""]
    .filter(Boolean)
    .map((t) => t.toLowerCase());
  const javaTpl = (problem.templates?.java || "").toLowerCase();
  const cppTpl = (problem.templates?.cpp || "").toLowerCase();

  // 1. Explicitly exclude non-matrix problems that return list-of-lists / collections
  const nonMatrixExclusions = [
    "3sum",
    "4sum",
    "subsets",
    "permutation",
    "combination sum",
    "group anagrams",
    "level order",
    "generate parentheses",
    "letter combinations",
    "all paths from source",
    "course schedule",
    "lru cache",
    "lfu cache",
  ];
  if (nonMatrixExclusions.some((ex) => title.includes(ex))) {
    return false;
  }

  // 2. Check topics
  if (allTopics.some((t) => t.includes("matrix") || t.includes("grid") || t.includes("2d array"))) {
    return true;
  }

  // 3. Check title keywords for classic 2D array / grid problems
  const matrixTitleKeywords = [
    "matrix",
    "grid",
    "board",
    "image",
    "flood fill",
    "island",
    "sudoku",
    "surrounded regions",
    "game of life",
    "pacific atlantic",
    "maximal square",
    "maximal rectangle",
    "knight dialer",
  ];
  if (matrixTitleKeywords.some((kw) => title.includes(kw))) {
    return true;
  }

  // 4. Check description for spatial 2D matrix/grid terminology
  const matrixDescPatterns = [
    /m\s*[x×*]\s*n\s+(?:matrix|grid|board|array|character|integer|binary)/i,
    /n\s*[x×*]\s*n\s+(?:matrix|grid|board|array|character|integer|binary)/i,
    /2d\s+(?:grid|matrix|array|board|plane)/i,
    /two-dimensional\s+(?:array|grid|matrix)/i,
    /grid\s+of\s+size/i,
    /matrix\s+of\s+size/i,
    /board\s+of\s+characters/i,
    /(?:given an|given a)\s+m\s*x\s*n/i,
    /(?:given an|given a)\s+n\s*x\s*n/i,
  ];
  if (matrixDescPatterns.some((pattern) => pattern.test(desc))) {
    return true;
  }

  // 5. Check function signature / template for 2D array types or parameters
  const templateKeywords = [
    "int[][]",
    "char[][]",
    "boolean[][]",
    "string[][]",
    "vector<vector<",
    "int[][] matrix",
    "int[][] grid",
    "int[][] board",
    "int[][] image",
    "char[][] board",
  ];
  if (templateKeywords.some((kw) => javaTpl.includes(kw) || cppTpl.includes(kw))) {
    return true;
  }

  return false;
}

export function parseMatrixFromText(text: string): ParsedMatrix | null {
  if (!text || typeof text !== "string") return null;

  const trimmed = text.trim();
  // Try extracting [[...], [...]]
  let match = trimmed.match(/(?:([a-zA-Z0-9_]+)\s*=\s*)?(\[\s*\[[\s\S]*?\]\s*\])/);
  if (!match) {
    // Tolerant fallback for unclosed matrices like "[[1,2],[3,4]" or "matrix=[[1,2],[3,4]"
    const unclosed = trimmed.match(/(?:([a-zA-Z0-9_]+)\s*=\s*)?(\[\s*\[[\s\S]*?\])/);
    if (unclosed && !unclosed[2].endsWith("]]")) {
      match = [unclosed[0] + "]", unclosed[1], unclosed[2] + "]"] as RegExpMatchArray;
    }
  }
  if (!match) return null;

  const varName = match[1] || "";
  // If variable name is clearly a 1D array of items or general collections
  const nonMatrixVarNames = ["nums", "arr", "subsets", "res", "result", "triplets", "pairs"];
  if (nonMatrixVarNames.includes(varName.toLowerCase())) {
    return null;
  }

  try {
    const rawMatrixStr = match[2]
      .replace(/'/g, '"')
      .replace(/\bTrue\b/g, "true")
      .replace(/\bFalse\b/g, "false");
    const parsed = JSON.parse(rawMatrixStr);

    if (Array.isArray(parsed) && parsed.length > 0 && Array.isArray(parsed[0])) {
      const extra = trimmed
        .replace(match[0], "")
        .replace(/^,\s*/, "")
        .trim();

      return {
        name: varName || "matrix",
        matrix: parsed,
        extraParams: extra || undefined,
      };
    }
  } catch {
    // If exact JSON parse fails, return null
  }
  return null;
}

export default function MatrixVisualizer({
  data,
  title,
  highlightCoordinates = [],
  problem,
  isMatrix,
}: MatrixVisualizerProps) {
  // If explicitly specified as not a matrix, or problem is provided and isn't a 2D matrix problem, skip
  if (isMatrix === false) return null;
  if (problem && !is2DMatrixProblem(problem)) return null;

  const parsed = useMemo(() => parseMatrixFromText(data), [data]);

  if (!parsed || parsed.matrix.length === 0) {
    return null;
  }

  const { name, matrix, extraParams } = parsed;
  const numRows = matrix.length;
  const numCols = Math.max(...matrix.map((row) => (Array.isArray(row) ? row.length : 0)));

  const isHighlighted = (r: number, c: number) => {
    return highlightCoordinates.some(([hr, hc]) => hr === r && hc === c);
  };

  return (
    <div className="mt-2.5 overflow-hidden rounded-xl border border-indigo-200/80 bg-gradient-to-br from-indigo-50/40 via-white to-slate-50/70 p-3.5 text-xs shadow-xs">
      {/* Header bar with dimension badge and variable name */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-indigo-100 pb-2 mb-3">
        <div className="flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-md bg-indigo-600 text-[10px] font-bold text-white shadow-xs">
            ⊞
          </span>
          <span className="font-bold text-slate-800">
            {title ? (
              name && name !== "matrix" ? (
                <>
                  {title} <span className="font-mono text-indigo-700">({name})</span>
                </>
              ) : (
                title
              )
            ) : (
              <>
                2D Matrix Grid: <span className="font-mono text-indigo-700">{name}</span>
              </>
            )}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="rounded-full border border-indigo-200 bg-white px-2 py-0.5 text-[10px] font-bold text-indigo-700 shadow-2xs">
            {numRows} × {numCols} Grid
          </span>
          {extraParams && (
            <span className="rounded-md border border-slate-200 bg-slate-100/80 px-2 py-0.5 font-mono text-[10px] text-slate-600">
              {extraParams}
            </span>
          )}
        </div>
      </div>

      {/* Responsive Visual Grid */}
      <div className="overflow-x-auto pb-1">
        <table className="border-collapse select-none">
          <thead>
            <tr>
              <th className="p-1 text-[10px] font-bold text-slate-400">r\c</th>
              {Array.from({ length: numCols }).map((_, colIdx) => (
                <th
                  key={colIdx}
                  className="px-2 py-1 text-center font-mono text-[10px] font-bold text-indigo-500"
                >
                  [{colIdx}]
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.map((row, rowIdx) => (
              <tr key={rowIdx}>
                {/* Row Header */}
                <td className="px-2 py-1 text-right font-mono text-[10px] font-bold text-indigo-500">
                  [{rowIdx}]
                </td>

                {/* Matrix Cells */}
                {Array.from({ length: numCols }).map((_, colIdx) => {
                  const cellVal = Array.isArray(row) && colIdx < row.length ? row[colIdx] : "";
                  const displayStr =
                    typeof cellVal === "string" ? `"${cellVal}"` : String(cellVal ?? "");
                  const highlighted = isHighlighted(rowIdx, colIdx);

                  return (
                    <td key={colIdx} className="p-1">
                      <div
                        className={`flex min-w-[34px] min-h-[30px] items-center justify-center rounded-lg border px-2 py-1 text-center font-mono text-xs font-bold transition ${
                          highlighted
                            ? "border-amber-400 bg-amber-100 text-amber-900 shadow-xs ring-2 ring-amber-300"
                            : "border-slate-200 bg-white text-slate-800 shadow-2xs hover:border-indigo-300 hover:bg-indigo-50/50"
                        }`}
                        title={`[${rowIdx}][${colIdx}] = ${displayStr}`}
                      >
                        {displayStr}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
