"use client";

import { RoundView } from "@/lib/gameApi";
import { ShapeIcon } from "@/components/games/shapes/ShapeIcon";

interface Tile {
  shape: string;
  color: string;
}

function TileRow({ tiles, numbered }: { tiles: Tile[]; numbered?: boolean }) {
  return (
    <div className="flex flex-wrap justify-center gap-2 sm:gap-3">
      {tiles.map((t, i) => (
        <div key={i} className="relative flex h-16 w-16 items-center justify-center rounded-lg border border-slate-200 bg-white shadow-sm sm:h-20 sm:w-20">
          {numbered && (
            <span className="absolute -top-2 -left-2 flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-[11px] font-bold text-white">
              {i + 1}
            </span>
          )}
          <ShapeIcon shape={t.shape} color={t.color} fill="FILLED" className="h-9 w-9" />
        </div>
      ))}
    </div>
  );
}

export interface SwitchBoardProps {
  round: RoundView;
  selected: string[];
  onToggleOption: (id: string) => void;
  disabled: boolean;
  revealCorrectOptionIds?: string[] | null;
}

export function SwitchBoard({ round, selected, onToggleOption, disabled, revealCorrectOptionIds }: SwitchBoardProps) {
  const top: Tile[] = round.meta?.topSequence ?? [];
  const bottom: Tile[] = round.meta?.bottomSequence ?? [];

  return (
    <div className="flex flex-col items-center">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Original order</p>
      <div className="mt-2"><TileRow tiles={top} numbered /></div>

      <div className="my-4 flex h-8 w-8 items-center justify-center rounded-full bg-premium-100 text-premium-600">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M8 2v11M3 9l5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Rearranged into</p>
      <div className="mt-2"><TileRow tiles={bottom} /></div>

      <p className="mt-6 text-sm text-slate-500">
        Pick the sequence describing which original position each new position came from:
      </p>
      <div className="mt-3 grid w-full grid-cols-2 gap-3 sm:grid-cols-3">
        {round.options.map((opt) => {
          const isSelected = selected.includes(opt.id);
          const isCorrect = revealCorrectOptionIds?.includes(opt.id);
          const isWrongPick = revealCorrectOptionIds && isSelected && !isCorrect;
          return (
            <button
              key={opt.id}
              type="button"
              disabled={disabled}
              onClick={() => onToggleOption(opt.id)}
              className={`rounded-xl border-2 bg-white px-4 py-3 text-center font-mono text-lg font-semibold tracking-widest transition disabled:cursor-default ${
                isCorrect ? "border-emerald-500 text-emerald-700" :
                isWrongPick ? "border-red-400 text-red-600" :
                isSelected ? "border-premium-500 text-premium-700" : "border-slate-200 text-slate-700 hover:border-slate-300"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
