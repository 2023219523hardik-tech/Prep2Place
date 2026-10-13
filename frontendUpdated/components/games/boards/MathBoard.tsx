"use client";

import { RoundView } from "@/lib/gameApi";

export interface MathBoardProps {
  round: RoundView;
  selected: string[];
  onToggleOption: (id: string) => void;
  disabled: boolean;
  revealCorrectOptionIds?: string[] | null;
}

export function MathBoard({ round, selected, onToggleOption, disabled, revealCorrectOptionIds }: MathBoardProps) {
  return (
    <div className="rounded-2xl bg-slate-900 px-6 py-8">
      <p className="text-center text-sm text-slate-400">
        Click circles from <span className="font-semibold text-white">HIGH</span> to{" "}
        <span className="font-semibold text-white">LOW</span>
      </p>

      <div className="mt-6 flex flex-wrap justify-center gap-4">
        {round.options.map((opt) => {
          const orderIndex = selected.indexOf(opt.id);
          const isSelected = orderIndex !== -1;
          const isCorrect = revealCorrectOptionIds?.includes(opt.id);
          return (
            <button
              key={opt.id}
              type="button"
              disabled={disabled}
              onClick={() => onToggleOption(opt.id)}
              className={`relative flex h-24 w-24 items-center justify-center rounded-full border-2 bg-slate-800 font-mono text-sm font-semibold text-white transition disabled:cursor-default sm:h-28 sm:w-28 ${
                revealCorrectOptionIds
                  ? isCorrect ? "border-emerald-500" : "border-red-400/70"
                  : isSelected ? "border-premium-400" : "border-sky-500/70 hover:border-sky-400"
              }`}
            >
              {opt.label}
              {isSelected && (
                <span className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-premium-500 text-xs font-bold text-white">
                  {orderIndex + 1}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <p className="mt-6 text-center text-xs text-slate-500">
        {selected.length} / {round.options.length} selected
      </p>
    </div>
  );
}
