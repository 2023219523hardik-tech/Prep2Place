"use client";

import { useEffect, useRef, useState } from "react";
import { RoundView } from "@/lib/gameApi";

interface Point { row: number; col: number }
interface MotionObject { id: string; color: string; path: Point[]; stepIntervalMs: number }

const COLOR_HEX: Record<string, string> = {
  RED: "#dc2626", BLUE: "#2563eb", GREEN: "#16a34a", PURPLE: "#7c3aed",
  ORANGE: "#ea580c", TEAL: "#0d9488",
};

export interface MotionBoardProps {
  round: RoundView;
  selected: string[];
  onToggleOption: (id: string) => void;
  disabled: boolean;
  revealCorrectOptionIds?: string[] | null;
}

export function MotionBoard({ round, selected, onToggleOption, disabled, revealCorrectOptionIds }: MotionBoardProps) {
  const fieldSize: number = round.meta?.fieldSize ?? 6;
  const objects: MotionObject[] = round.meta?.objects ?? [];
  const targetObjectId: string = round.meta?.targetObjectId;

  const [stepIndex, setStepIndex] = useState(0);
  const [answering, setAnswering] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setStepIndex(0);
    setAnswering(false);
    if (timerRef.current) clearInterval(timerRef.current);
    const pathLength = objects[0]?.path?.length ?? 1;
    const avgInterval = objects.length
      ? objects.reduce((sum, o) => sum + o.stepIntervalMs, 0) / objects.length
      : 400;
    let i = 0;
    timerRef.current = setInterval(() => {
      i++;
      if (i >= pathLength) {
        if (timerRef.current) clearInterval(timerRef.current);
        setAnswering(true);
      } else {
        setStepIndex(i);
      }
    }, avgInterval);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round.roundIndex]);

  const pct = (rc: number) => `${((rc + 0.5) / fieldSize) * 100}%`;

  return (
    <div className="flex flex-col items-center">
      <p className="text-sm text-slate-500">
        {answering ? "Where did the highlighted object end up?" : "Watch closely…"}
      </p>
      <div
        className="relative mt-3 w-full max-w-[560px] overflow-hidden rounded-xl border-2 border-slate-300 bg-slate-50"
        style={{ aspectRatio: "1 / 1" }}
      >
        {/* grid lines */}
        <div
          className="absolute inset-0 grid"
          style={{ gridTemplateColumns: `repeat(${fieldSize}, 1fr)`, gridTemplateRows: `repeat(${fieldSize}, 1fr)` }}
        >
          {Array.from({ length: fieldSize * fieldSize }).map((_, i) => (
            <div key={i} className="border border-slate-200/70" />
          ))}
        </div>

        {/* moving objects, hidden once the board freezes for answering */}
        {!answering &&
          objects.map((obj) => {
            const p = obj.path[Math.min(stepIndex, obj.path.length - 1)];
            const isTarget = obj.id === targetObjectId;
            return (
              <div
                key={obj.id}
                className="absolute h-[12%] w-[12%] rounded-full shadow-md transition-all ease-linear"
                style={{
                  left: pct(p.col),
                  top: pct(p.row),
                  transform: "translate(-50%, -50%)",
                  transitionDuration: `${obj.stepIntervalMs}ms`,
                  backgroundColor: COLOR_HEX[obj.color] ?? "#475569",
                  outline: isTarget ? "3px solid white" : "none",
                  outlineOffset: isTarget ? "-3px" : undefined,
                  boxShadow: isTarget ? "0 0 0 3px rgba(124,58,237,0.55)" : undefined,
                }}
              />
            );
          })}

        {/* answer targets, placed directly on the board once frozen */}
        {answering &&
          round.options.map((opt) => {
            const p = opt.label as Point;
            const isSelected = selected.includes(opt.id);
            const isCorrect = revealCorrectOptionIds?.includes(opt.id);
            const isWrongPick = revealCorrectOptionIds && isSelected && !isCorrect;
            return (
              <button
                key={opt.id}
                type="button"
                disabled={disabled}
                onClick={() => onToggleOption(opt.id)}
                className={`absolute flex h-[14%] w-[14%] items-center justify-center rounded-full border-4 bg-white/80 transition disabled:cursor-default ${
                  isCorrect ? "border-emerald-500" :
                  isWrongPick ? "border-red-400" :
                  isSelected ? "border-premium-500 scale-110" : "border-slate-400 hover:border-premium-400"
                }`}
                style={{ left: pct(p.col), top: pct(p.row), transform: "translate(-50%, -50%)" }}
              />
            );
          })}
      </div>
      {!answering && <p className="mt-3 text-xs text-slate-400">The board will freeze shortly.</p>}
    </div>
  );
}
