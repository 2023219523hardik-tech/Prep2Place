"use client";

function PauseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <rect x="3" y="2" width="4" height="12" rx="1" />
      <rect x="9" y="2" width="4" height="12" rx="1" />
    </svg>
  );
}
function PlayIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M4 2.5v11l10-5.5-10-5.5z" />
    </svg>
  );
}
function SoundOnIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M2 6h3l4-3v10l-4-3H2V6z" />
      <path d="M11 5.5a3.5 3.5 0 010 5" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" />
      <path d="M12.8 3.7a6 6 0 010 8.6" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" opacity="0.6" />
    </svg>
  );
}
function SoundOffIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M2 6h3l4-3v10l-4-3H2V6z" />
      <path d="M11 6l4 4M15 6l-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export interface GameHUDProps {
  gameName: string;
  level: number;
  levelLabel: string;
  score: number;
  correctCount: number;
  incorrectCount: number;
  roundNumber: number;
  totalRounds: number;
  secondsRemaining: number;
  paused: boolean;
  soundOn: boolean;
  onTogglePause: () => void;
  onToggleSound: () => void;
}

function formatClock(totalSeconds: number) {
  const s = Math.max(0, Math.ceil(totalSeconds));
  const mm = Math.floor(s / 60).toString().padStart(2, "0");
  const ss = (s % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

export function GameHUD({
  gameName, level, levelLabel, score, correctCount, incorrectCount,
  roundNumber, totalRounds, secondsRemaining, paused, soundOn,
  onTogglePause, onToggleSound,
}: GameHUDProps) {
  const progressPct = totalRounds > 0 ? Math.min(100, (roundNumber / totalRounds) * 100) : 0;
  const urgent = secondsRemaining <= 5;

  return (
    <div className="sticky top-0 z-10 rounded-t-xl bg-slate-900 px-4 py-3 text-white shadow-md sm:px-6">
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={onTogglePause}
          aria-label={paused ? "Resume" : "Pause"}
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-700/70 transition hover:bg-slate-700"
        >
          {paused ? <PlayIcon /> : <PauseIcon />}
        </button>
        <button
          onClick={onToggleSound}
          aria-label={soundOn ? "Mute" : "Unmute"}
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-700/70 transition hover:bg-slate-700"
        >
          {soundOn ? <SoundOnIcon /> : <SoundOffIcon />}
        </button>
        <span className="rounded-lg bg-slate-700/70 px-3 py-2 text-sm font-semibold">
          Level {level} <span className="text-slate-300 font-normal">· {levelLabel}</span>
        </span>

        <div className="mx-2 h-2 flex-1 min-w-[120px] overflow-hidden rounded-full bg-slate-700/70">
          <div className="h-full rounded-full bg-premium-500 transition-all" style={{ width: `${progressPct}%` }} />
        </div>

        <span
          className={`rounded-lg px-3 py-2 font-mono text-sm font-semibold ${urgent ? "bg-red-500/20 text-red-300" : "bg-slate-700/70"}`}
        >
          {formatClock(secondsRemaining)}
        </span>
        <span className="max-w-[40%] truncate text-sm font-semibold text-slate-200">{gameName}</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-300">
        <span>Score <strong className="text-white">{Math.round(score)}</strong></span>
        <span>Correct <strong className="text-emerald-400">{correctCount}</strong></span>
        <span>Incorrect <strong className="text-red-400">{incorrectCount}</strong></span>
        <span>Round <strong className="text-white">{Math.min(roundNumber + 1, totalRounds)}</strong> / {totalRounds}</span>
      </div>
    </div>
  );
}
