"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Real-time microphone amplitude via the Web Audio API (getUserMedia + AnalyserNode) — this
 * is genuinely reactive to the candidate's actual voice, not a fake/looping animation. Used
 * to drive the AI voice orb's "listening" pulse in sync with real audio input.
 */
export function useMicLevel(active: boolean) {
  const [level, setLevel] = useState(0); // 0-1
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);

  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    audioCtxRef.current?.close().catch(() => {});
    streamRef.current = null;
    audioCtxRef.current = null;
    setLevel(0);
  }, []);

  useEffect(() => {
    if (!active) { stop(); return; }

    let cancelled = false;
    navigator.mediaDevices?.getUserMedia({ audio: true }).then((stream) => {
      if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
      streamRef.current = stream;
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioCtxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);

      function tick() {
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((sum, v) => sum + v, 0) / data.length;
        setLevel(Math.min(1, avg / 100));
        rafRef.current = requestAnimationFrame(tick);
      }
      tick();
    }).catch(() => setLevel(0));

    return () => { cancelled = true; stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  return level;
}
