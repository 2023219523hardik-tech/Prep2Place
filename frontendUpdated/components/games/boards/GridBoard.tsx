"use client";

import { RoundView } from "@/lib/gameApi";
import { ShapeIcon } from "@/components/games/shapes/ShapeIcon";

interface AlphabetSymbol {
  id: string;
  shape: string;
  color: string;
}

export interface GridBoardProps {
  round: RoundView;
  selected: string[];
  onToggleOption: (id: string) => void;
  disabled: boolean;
  revealCorrectOptionIds?: string[] | null;
}

/** Cell size shrinks a little as the grid grows so a 6x6 board still fits comfortably, but never
 *  drops below a size that would make the puzzle hard to read or click - the exact failure mode
 *  this component was written to fix. */
function cellSizeFor(n: number) {
  if (n <= 3) return 84;
  if (n <= 4) return 76;
  if (n <= 5) return 68;
  return 58;
}

export function GridBoard({ round, selected, onToggleOption, disabled, revealCorrectOptionIds }: GridBoardProps) {
  const n: number = round.meta?.gridSize ?? 3;
  const cells: (string | null)[][] = round.meta?.cells ?? [];
  const alphabet: AlphabetSymbol[] = round.meta?.alphabet ?? [];
  const blankRow: number = round.meta?.blankRow ?? 0;
  const blankCol: number = round.meta?.blankCol ?? 0;
  const bySymbolId = new Map(alphabet.map((s) => [s.id, s]));
  const cellSize = cellSizeFor(n);
  const previewSymbolId = selected[0];
  const previewSymbol = previewSymbolId
    ? (alphabet.find((s) => `opt_${s.id}` === previewSymbolId) ?? null)
    : null;

  return (
    <div className="flex flex-col items-center">
      <div
        className="grid gap-0 overflow-hidden rounded-lg border-2 border-slate-300 bg-slate-300"
        style={{ gridTemplateColumns: `repeat(${n}, ${cellSize}px)`, gap: "2px" }}
      >
        {cells.map((row, r) =>
          row.map((symbolId, c) => {
            const isBlank = r === blankRow && c === blankCol;
            const symbol = isBlank ? previewSymbol : symbolId ? bySymbolId.get(symbolId) : null;
            return (
              <div
                key={`${r}-${c}`}
                style={{ width: cellSize, height: cellSize }}
                className={`flex items-center justify-center bg-white ${
                  isBlank ? "border-2 border-dashed border-premium-500 bg-premium-50" : ""
                }`}
              >
                {symbol ? (
                  <ShapeIcon shape={symbol.shape} color={symbol.color} fill="FILLED" className="h-2/3 w-2/3" />
                ) : isBlank ? (
                  <span className="font-mono text-lg font-bold text-premium-400">?</span>
                ) : null}
              </div>
            );
          })
        )}
      </div>

      <p className="mt-6 text-sm text-slate-500">Which symbol belongs in the highlighted cell?</p>
      <div className="mt-3 flex flex-wrap justify-center gap-3">
        {round.options.map((opt) => {
          const label = opt.label as AlphabetSymbol;
          const isSelected = selected.includes(opt.id);
          const isCorrect = revealCorrectOptionIds?.includes(opt.id);
          const isWrongPick = revealCorrectOptionIds && isSelected && !isCorrect;
          return (
            <button
              key={opt.id}
              type="button"
              disabled={disabled}
              onClick={() => onToggleOption(opt.id)}
              className={`flex h-16 w-16 items-center justify-center rounded-xl border-2 bg-white transition disabled:cursor-default ${
                isCorrect ? "border-emerald-500" :
                isWrongPick ? "border-red-400" :
                isSelected ? "border-premium-500 scale-105" : "border-slate-200 hover:border-slate-300"
              }`}
            >
              <ShapeIcon shape={label.shape} color={label.color} fill="FILLED" className="h-9 w-9" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
