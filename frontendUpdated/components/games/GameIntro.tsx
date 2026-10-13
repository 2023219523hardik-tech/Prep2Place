"use client";

import { GameType } from "@/lib/gameApi";

interface GameIntroCopy {
  skillTag: string;
  description: string;
  howToPlay: string[];
}

const COPY: Record<GameType, GameIntroCopy> = {
  DEDUCTIVE: {
    skillTag: "Logical Reasoning",
    description: "Measures logical reasoning, pattern recognition and rule identification.",
    howToPlay: [
      "Every example card follows one hidden rule.",
      "Pick the option that also follows the same rule.",
    ],
  },
  SWITCH: {
    skillTag: "Cognitive Flexibility",
    description: "Measures how quickly you can track a rearrangement and describe it precisely.",
    howToPlay: [
      "A row of shapes is rearranged into a new order.",
      "Pick the number sequence that describes the rearrangement.",
    ],
  },
  MOTION: {
    skillTag: "Visual Tracking",
    description: "Measures sustained attention and short-term spatial memory.",
    howToPlay: [
      "Watch an object move across the board.",
      "When the board freezes, pick the cell it ended up in.",
    ],
  },
  INDUCTIVE: {
    skillTag: "Pattern Inference",
    description: "Measures your ability to infer a rule from limited examples.",
    howToPlay: [
      "Two example grids share a hidden rule.",
      "Select the two candidate grids (out of four) that follow the same rule.",
    ],
  },
  GRID: {
    skillTag: "Processing Speed",
    description: "Measures processing speed and logical consistency across a matrix.",
    howToPlay: [
      "No row or column ever repeats a symbol.",
      "Pick the symbol that belongs in the highlighted cell.",
    ],
  },
  MATH: {
    skillTag: "Numerical Reasoning",
    description: "Measures calculation speed and accuracy under time pressure.",
    howToPlay: [
      "Each circle holds an unsolved expression.",
      "Click every circle in order from the highest value to the lowest.",
    ],
  },
};

export interface GameIntroProps {
  gameType: GameType;
  gameName: string;
  roundCount: number;
  roundDurationSeconds: number;
  onStart: () => void;
  starting?: boolean;
}

export function GameIntro({ gameType, gameName, roundCount, roundDurationSeconds, onStart, starting }: GameIntroProps) {
  const copy = COPY[gameType];
  const totalMinutes = Math.max(1, Math.round((roundCount * roundDurationSeconds) / 60));

  return (
    <div className="min-h-[calc(100vh-140px)] flex flex-col justify-center items-center px-4 py-8">
      <div className="w-full max-w-2xl">
        <div className="rounded-2xl bg-slate-900 px-8 py-10 text-slate-100 shadow-xl">
        <h1 className="text-2xl font-bold text-white">{gameName}</h1>
        <span className="mt-3 inline-block rounded-full bg-slate-700/60 px-3 py-1 text-xs font-semibold text-slate-200">
          {copy.skillTag}
        </span>

        <p className="mt-5 leading-relaxed text-slate-300">{copy.description}</p>

        <h2 className="mt-7 text-sm font-semibold uppercase tracking-wide text-premium-400">How to play</h2>
        <ul className="mt-2 space-y-1.5 text-slate-300">
          {copy.howToPlay.map((line) => (
            <li key={line} className="flex gap-2">
              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-premium-400" />
              <span>{line}</span>
            </li>
          ))}
        </ul>

        <dl className="mt-7 grid grid-cols-3 gap-4 border-t border-slate-700/60 pt-5 text-sm">
          <div>
            <dt className="text-slate-400">Time limit</dt>
            <dd className="mt-0.5 font-semibold text-white">~{totalMinutes} min</dd>
          </div>
          <div>
            <dt className="text-slate-400">Rounds</dt>
            <dd className="mt-0.5 font-semibold text-white">{roundCount}</dd>
          </div>
          <div>
            <dt className="text-slate-400">Scoring</dt>
            <dd className="mt-0.5 font-semibold text-white">+1 / -1</dd>
          </div>
        </dl>

        <p className="mt-5 text-sm leading-relaxed text-slate-400">
          The challenge adapts as you progress - correct answers increase difficulty, from Easy up
          through Expert+.
        </p>

        <p className="mt-6 rounded-lg bg-slate-800/70 px-4 py-3 text-xs leading-relaxed text-slate-400">
          This is a cognitive assessment designed to evaluate reasoning, processing speed, memory
          and problem-solving ability. Questions become progressively more challenging based on
          your performance. This assessment is timed.
        </p>

        <button
          onClick={onStart}
          disabled={starting}
          className="mt-7 w-full rounded-lg bg-premium-600 py-3 font-semibold text-white transition hover:bg-premium-700 disabled:opacity-60"
        >
          {starting ? "Starting…" : "Start Game"}
        </button>
      </div>
    </div>
  </div>
);
}
