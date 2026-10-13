"use client";

import { useEffect, useRef } from "react";

export type OrbState = "idle" | "speaking" | "listening" | "thinking";

interface Props {
  state: OrbState;
  audioLevel?: number; // 0-1, real mic amplitude — used to drive the "listening" pulse
  size?: number;
}

const STATE_COLORS: Record<OrbState, [string, string, string]> = {
  idle: ["#94a3b8", "#cbd5e1", "#e2e8f0"],       // slate — calm, waiting
  speaking: ["#6366f1", "#8b5cf6", "#a78bfa"],    // indigo/violet — AI is talking
  listening: ["#10b981", "#34d399", "#6ee7b7"],   // emerald — candidate is talking
  thinking: ["#f59e0b", "#fbbf24", "#fcd34d"],    // amber — processing/evaluating
};

/**
 * Siri/ChatGPT-voice-mode-style animated orb, built with plain Canvas 2D — no external
 * animation library needed. Reacts to real microphone amplitude during "listening" (see
 * useMicLevel), and to a smooth procedural pulse during "speaking"/"thinking" (browsers don't
 * expose an analyzable audio signal for SpeechSynthesis output, so that part is animated
 * rather than truly audio-reactive — documented here rather than silently implied otherwise).
 */
export default function AIVoiceOrb({ state, audioLevel = 0, size = 220 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const tRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    const [c1, c2, c3] = STATE_COLORS[state];
    const center = size / 2;

    function draw() {
      if (!ctx) return;
      tRef.current += 0.02;
      const t = tRef.current;
      ctx.clearRect(0, 0, size, size);

      const baseRadius = size * 0.28;
      let pulse: number;
      if (state === "listening") {
        pulse = 1 + audioLevel * 0.5 + Math.sin(t * 4) * 0.03;
      } else if (state === "speaking") {
        pulse = 1 + Math.sin(t * 5) * 0.12 + Math.sin(t * 9) * 0.05;
      } else if (state === "thinking") {
        pulse = 1 + Math.sin(t * 2) * 0.06;
      } else {
        pulse = 1 + Math.sin(t * 1.2) * 0.03;
      }

      // Three overlapping soft blobs at different phase offsets — creates an organic,
      // lava-lamp-like feel rather than a rigid perfect circle.
      const blobs: [string, number, number][] = [
        [c1, baseRadius * pulse, 0],
        [c2, baseRadius * pulse * 0.85, Math.PI * 0.66],
        [c3, baseRadius * pulse * 0.7, Math.PI * 1.33],
      ];

      ctx.globalCompositeOperation = "lighter";
      for (const [color, radius, phase] of blobs) {
        const offsetX = Math.cos(t * 0.8 + phase) * size * 0.04;
        const offsetY = Math.sin(t * 0.8 + phase) * size * 0.04;
        const gradient = ctx.createRadialGradient(
          center + offsetX, center + offsetY, 0,
          center + offsetX, center + offsetY, radius,
        );
        gradient.addColorStop(0, color + "cc");
        gradient.addColorStop(1, color + "00");
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(center + offsetX, center + offsetY, radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";

      // Solid core so the orb reads clearly even on light/dark backgrounds
      const coreGradient = ctx.createRadialGradient(center, center, 0, center, center, baseRadius * 0.55);
      coreGradient.addColorStop(0, c2);
      coreGradient.addColorStop(1, c1);
      ctx.fillStyle = coreGradient;
      ctx.beginPath();
      ctx.arc(center, center, baseRadius * 0.55 * (state === "listening" ? 1 + audioLevel * 0.3 : 1), 0, Math.PI * 2);
      ctx.fill();

      rafRef.current = requestAnimationFrame(draw);
    }

    draw();
    return () => cancelAnimationFrame(rafRef.current);
  }, [state, audioLevel, size]);

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <canvas ref={canvasRef} style={{ width: size, height: size }} />
    </div>
  );
}
