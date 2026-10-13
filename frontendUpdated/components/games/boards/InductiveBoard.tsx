"use client";

import { RoundView } from "@/lib/gameApi";
import { ShapeIcon } from "@/components/games/shapes/ShapeIcon";

interface Cell {
  shape: string;
  color: string;
}

function MiniGrid({ grid, size = 22 }: { grid: Cell[][]; size?: number }) {
  const n = grid.length;
  return (
    <div
      className="grid gap-[2px] overflow-hidden rounded-md border border-slate-300 bg-slate-300"
      style={{ gridTemplateColumns: `repeat(${n}, ${size}px)` }}
    >
      {grid.map((row, r) =>
        row.map((cell, c) => (
          <div key={`${r}-${c}`} className="flex items-center justify-center bg-white" style={{ width: size, height: size }}>
            <ShapeIcon shape={cell.shape} color={cell.color} fill="FILLED" className="h-3/4 w-3/4" />
          </div>
        ))
      )}
    </div>
  );
}

export interface InductiveBoardProps {
  round: RoundView;
  selected: string[];
  onToggleOption: (id: string) => void;
  disabled: boolean;
  revealCorrectOptionIds?: string[] | null;
}

export function InductiveBoard({ round, selected, onToggleOption, disabled, revealCorrectOptionIds }: InductiveBoardProps) {
  const examples: Cell[][][] = round.meta?.exampleGrids ?? [];

  return (
    <div className="grid gap-8 sm:grid-cols-2">
      <div>
        <p className="text-sm text-slate-500">These two grids follow a rule.</p>
        <div className="mt-3 flex flex-col items-center gap-4">
          {examples.map((g, i) => (
            <MiniGrid key={i} grid={g} size={30} />
          ))}
        </div>
      </div>

      <div>
        <p className="text-sm text-slate-500">
          Which two of these grids follow the same rule?
          {selected.length > 0 && (
            <span className="ml-1 font-medium text-premium-600">({selected.length}/2 selected)</span>
          )}
        </p>
        <div className="mt-3 grid grid-cols-2 gap-4">
          {round.options.map((opt) => {
            const isSelected = selected.includes(opt.id);
            const isCorrect = revealCorrectOptionIds?.includes(opt.id);
            const isWrongPick = revealCorrectOptionIds && isSelected && !isCorrect;
            const atCapacity = !isSelected && selected.length >= 2;
            return (
              <button
                key={opt.id}
                type="button"
                disabled={disabled || atCapacity}
                onClick={() => onToggleOption(opt.id)}
                className={`flex justify-center rounded-lg border-2 p-2 transition disabled:cursor-not-allowed disabled:opacity-50 ${
                  isCorrect ? "border-emerald-500" :
                  isWrongPick ? "border-red-400" :
                  isSelected ? "border-premium-500" : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <MiniGrid grid={opt.label as Cell[][]} />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
