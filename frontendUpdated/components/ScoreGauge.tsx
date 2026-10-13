"use client";

export default function ScoreGauge({ score, label }: { score: number; label?: string }) {
  const color = score >= 75 ? "text-green-600" : score >= 50 ? "text-amber-500" : "text-red-500";
  const ringColor = score >= 75 ? "#16a34a" : score >= 50 ? "#f59e0b" : "#ef4444";
  const circumference = 2 * Math.PI * 45;
  const offset = circumference - (Math.min(100, Math.max(0, score)) / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      <svg width="120" height="120" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="45" fill="none" stroke="#e2e8f0" strokeWidth="8" />
        <circle
          cx="50" cy="50" r="45" fill="none" stroke={ringColor} strokeWidth="8"
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round" transform="rotate(-90 50 50)"
        />
        <text x="50" y="55" textAnchor="middle" fontSize="20" fontWeight="700" className={color} fill="currentColor">
          {Math.round(score)}
        </text>
      </svg>
      {label && <span className="text-sm text-slate-600 mt-1">{label}</span>}
    </div>
  );
}
