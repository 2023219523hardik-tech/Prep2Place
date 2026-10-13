"use client";

import { RoundView } from "@/lib/gameApi";
import { ShapeIcon } from "@/components/games/shapes/ShapeIcon";

interface CardData {
  shape: string;
  fill: string;
  color: string;
  size: string;
  count: number;
}

function SymbolCard({ card, tone }: { card: CardData; tone: "example" | "option" }) {
  const count = Math.max(1, Math.min(6, card.count));
  return (
    <div
      className={`flex min-h-[92px] flex-wrap items-center justify-center gap-1.5 rounded-xl border p-3 ${
        tone === "example" ? "border-slate-200 bg-slate-50" : "border-slate-200 bg-white"
      }`}
    >
      {Array.from({ length: count }).map((_, i) => (
        <ShapeIcon
          key={i}
          shape={card.shape}
          color={card.color}
          fill={card.fill as any}
          size={card.size as any}
          className="h-7 w-7"
        />
      ))}
    </div>
  );
}

export interface DeductiveBoardProps {
  round: RoundView;
  selected: string[];
  onToggleOption: (id: string) => void;
  disabled: boolean;
  revealCorrectOptionIds?: string[] | null;
}

export function DeductiveBoard({ round, selected, onToggleOption, disabled, revealCorrectOptionIds }: DeductiveBoardProps) {
  const examples: CardData[] = round.meta?.examples ?? [];

  return (
    <div>
      <p className="text-sm text-slate-500">These cards all follow the hidden rule:</p>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {examples.map((card, i) => (
          <SymbolCard key={i} card={card} tone="example" />
        ))}
      </div>

      <p className="mt-6 text-sm text-slate-500">Pick the option that also follows it:</p>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
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
              className={`rounded-xl border-2 p-1 text-left transition disabled:cursor-default ${
                isCorrect ? "border-emerald-500" :
                isWrongPick ? "border-red-400" :
                isSelected ? "border-premium-500" : "border-transparent hover:border-slate-300"
              }`}
            >
              <SymbolCard card={opt.label as CardData} tone="option" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
