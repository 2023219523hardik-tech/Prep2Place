let ctx: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext || (window as any).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) ctx = new Ctor();
  return ctx;
}

function tone(freq: number, startOffset: number, durationSec: number, gain = 0.05) {
  const audioCtx = getContext();
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  const startAt = audioCtx.currentTime + startOffset;
  gainNode.gain.setValueAtTime(0, startAt);
  gainNode.gain.linearRampToValueAtTime(gain, startAt + 0.01);
  gainNode.gain.linearRampToValueAtTime(0, startAt + durationSec);
  osc.connect(gainNode);
  gainNode.connect(audioCtx.destination);
  osc.start(startAt);
  osc.stop(startAt + durationSec + 0.02);
}

/** Subtle, non-intrusive cues (spec Section 14) - synthesized with the Web Audio API so no audio
 *  asset files are needed. Every call is a no-op when `enabled` is false. */
export const gameSound = {
  correct: (enabled: boolean) => enabled && tone(740, 0, 0.12),
  incorrect: (enabled: boolean) => enabled && tone(220, 0, 0.16),
  levelUp: (enabled: boolean) => {
    if (!enabled) return;
    tone(523, 0, 0.1);
    tone(659, 0.1, 0.14);
  },
  timeWarning: (enabled: boolean) => enabled && tone(880, 0, 0.08, 0.03),
  completion: (enabled: boolean) => {
    if (!enabled) return;
    tone(523, 0, 0.12);
    tone(659, 0.12, 0.12);
    tone(784, 0.24, 0.2);
  },
};
