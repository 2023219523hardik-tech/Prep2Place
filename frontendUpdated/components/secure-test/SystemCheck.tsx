"use client";

import { useMemo } from "react";

export interface SecureSystemCheckProfile {
  cameraRequired: boolean;
  microphoneRequired: boolean;
  screenShareRequired: boolean;
  fullscreenRequired: boolean;
}

interface SystemCheckProps {
  profile: SecureSystemCheckProfile;
  title?: string;
  onStart: () => void;
}

export default function SystemCheck({ profile, title = "Secure Test Environment", onStart }: SystemCheckProps) {
  const checks = useMemo(
    () => [
      { label: "Camera", required: profile.cameraRequired, ok: true },
      { label: "Microphone", required: profile.microphoneRequired, ok: true },
      { label: "Screen Sharing", required: profile.screenShareRequired, ok: true },
      { label: "Fullscreen", required: profile.fullscreenRequired, ok: true },
      { label: "Browser", required: true, ok: true },
      { label: "Network", required: true, ok: true },
      { label: "Secure Mode", required: true, ok: true },
    ],
    [profile]
  );

  const mandatoryChecks = checks.filter((check) => check.required).length;

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-12 text-white">
      <div className="mx-auto max-w-3xl rounded-3xl border border-slate-700 bg-slate-900/80 p-8 shadow-2xl shadow-slate-950/40 backdrop-blur-sm">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-500/15 text-xl text-cyan-300">
            🔒
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">Prep2Place</p>
            <h1 className="text-2xl font-bold text-white">{title}</h1>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-700 bg-slate-950/70 p-5">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">System & Security Check</p>
          <h2 className="mt-3 text-3xl font-bold text-white">Before starting your test, please complete the following checks.</h2>
          <p className="mt-3 text-sm text-slate-300">
            This mock test is protected by the secure test environment. Required device and browser permissions must be granted before the assessment begins.
          </p>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {checks.map((check) => (
            <div
              key={check.label}
              className={`flex items-center justify-between rounded-xl border px-4 py-3 text-sm ${
                check.ok
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                  : "border-amber-500/30 bg-amber-500/10 text-amber-200"
              }`}
            >
              <span className="font-medium">{check.required ? "Required" : "Optional"}</span>
              <span className="flex items-center gap-2 font-semibold">
                <span className="text-base">{check.ok ? "✓" : "…"}</span>
                {check.label}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-6 flex items-center justify-between rounded-xl border border-slate-700 bg-slate-950/60 px-4 py-3 text-sm text-slate-300">
          <span>{mandatoryChecks} required checks</span>
          <span className="font-semibold text-emerald-300">Ready to begin</span>
        </div>

        <button
          type="button"
          onClick={onStart}
          className="mt-8 inline-flex w-full items-center justify-center rounded-xl bg-cyan-500 px-5 py-3 text-base font-semibold text-slate-950 shadow-lg shadow-cyan-500/25 transition hover:bg-cyan-400"
        >
          Start Security Check
        </button>
      </div>
    </div>
  );
}
