"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Wraps the browser's native SpeechSynthesis API (Web Speech API) for text-to-speech. This is
 * genuinely functional with zero backend/API-key dependency, but the naive way to use this API
 * (one long utterance, default voice, speak() called right after cancel()) reliably produces the
 * exact "choppy / cuts off mid-sentence / robotic" symptoms this hook was built to fix:
 *
 * 1. Chrome silently stops firing speech after ~15s of continuous audio unless the utterance is
 *    kept alive with periodic pause()/resume() calls - a long-standing, well-documented browser
 *    bug, not a network issue. This is very likely the dominant cause of "brraky" playback here,
 *    since interview questions are often longer than 15s of speech as a single utterance.
 * 2. speak() called synchronously right after cancel() races with the engine tearing down the
 *    previous utterance in some browsers, clipping the first word or two of the next one.
 * 3. getVoices() can return an empty list on first call - voices load asynchronously via the
 *    'voiceschanged' event - so speaking before they're ready silently falls back to whatever
 *    low-quality default voice the browser ships, which sounds more "robotic".
 * 4. A single very long utterance has no natural pause points, which reads as a run-on and makes
 *    any stutter far more noticeable than it would be between shorter, sentence-level utterances.
 *
 * Fixes applied: split into sentence-level utterances spoken as a queue (so no single utterance
 * gets close to the 15s cliff and pauses land on real sentence breaks); a keep-alive heartbeat
 * while speaking; a short delay between cancel() and the next speak(); voice-list readiness
 * handling with a deliberate preference for higher-quality voices over the platform default; and
 * one retry per chunk if playback is interrupted by something other than a deliberate cancel, so
 * a single dropped chunk doesn't silently swallow words.
 *
 * Note: this is local, on-device synthesis, not a server-streamed audio pipeline - there is no
 * network jitter or audio codec/sample-rate mismatch to smooth over here, since nothing is
 * streamed over the network. The choppiness this hook fixes is a browser-engine behavior, and the
 * fix holds regardless of network conditions.
 */

const KEEP_ALIVE_INTERVAL_MS = 5000; // must stay comfortably under the ~15s Chrome cliff
const CANCEL_TO_SPEAK_DELAY_MS = 60; // lets the engine actually tear down the previous utterance
const VOICE_READY_TIMEOUT_MS = 1500;

// Rough preference order for voices that sound noticeably less robotic than a bare platform
// default, when present. Matched by substring so it's resilient to browser/OS naming variations.
const PREFERRED_VOICE_HINTS = [
  "Google US English", "Google UK English Female", "Microsoft Aria", "Microsoft Jenny",
  "Samantha", "Natural", "Neural",
];

function splitIntoChunks(text: string): string[] {
  // Sentence-level split (keeps the terminator), falling back to the whole string if no sentence
  // boundaries are found (e.g. a single short phrase).
  const matches = text.match(/[^.!?]+[.!?]+(\s+|$)|[^.!?]+$/g);
  const chunks = (matches ?? [text]).map((c) => c.trim()).filter(Boolean);
  return chunks.length > 0 ? chunks : [text];
}

function waitForVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    const existing = window.speechSynthesis.getVoices();
    if (existing.length > 0) { resolve(existing); return; }
    const timeout = window.setTimeout(() => resolve(window.speechSynthesis.getVoices()), VOICE_READY_TIMEOUT_MS);
    window.speechSynthesis.onvoiceschanged = () => {
      window.clearTimeout(timeout);
      resolve(window.speechSynthesis.getVoices());
    };
  });
}

function pickVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  if (voices.length === 0) return null;
  for (const hint of PREFERRED_VOICE_HINTS) {
    const match = voices.find((v) => v.name.includes(hint) && v.lang.startsWith("en"));
    if (match) return match;
  }
  const english = voices.find((v) => v.lang.startsWith("en") && v.localService);
  return english ?? voices.find((v) => v.lang.startsWith("en")) ?? voices[0];
}

export function useSpeechSynthesis() {
  const [speaking, setSpeaking] = useState(false);
  const [supported, setSupported] = useState(false);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const queueRef = useRef<string[]>([]);
  const chunkIndexRef = useRef(0);
  const retriedRef = useRef(false);
  const keepAliveRef = useRef<number | null>(null);
  const cancelledRef = useRef(false);
  const onEndRef = useRef<(() => void) | undefined>(undefined);

  useEffect(() => {
    const ok = typeof window !== "undefined" && "speechSynthesis" in window;
    setSupported(ok);
    if (ok) waitForVoices().then((voices) => { voiceRef.current = pickVoice(voices); });
  }, []);

  const stopKeepAlive = useCallback(() => {
    if (keepAliveRef.current != null) {
      window.clearInterval(keepAliveRef.current);
      keepAliveRef.current = null;
    }
  }, []);

  const startKeepAlive = useCallback(() => {
    stopKeepAlive();
    // The pause()/resume() cycle is the standard workaround for Chrome's mid-utterance cutoff -
    // it resets the engine's internal timer without audibly interrupting playback.
    keepAliveRef.current = window.setInterval(() => {
      if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
        window.speechSynthesis.pause();
        window.speechSynthesis.resume();
      }
    }, KEEP_ALIVE_INTERVAL_MS);
  }, [stopKeepAlive]);

  const speakChunk = useCallback((index: number) => {
    if (cancelledRef.current) {
      stopKeepAlive();
      setSpeaking(false);
      return;
    }
    const chunks = queueRef.current;
    if (index >= chunks.length) {
      stopKeepAlive();
      setSpeaking(false);
      if (!cancelledRef.current) onEndRef.current?.();
      return;
    }
    const utterance = new SpeechSynthesisUtterance(chunks[index]);
    utterance.rate = 0.98;
    utterance.pitch = 1.0;
    if (voiceRef.current) utterance.voice = voiceRef.current;

    utterance.onstart = () => {
      if (cancelledRef.current) {
        stopKeepAlive();
        try { window.speechSynthesis.cancel(); } catch {}
        setSpeaking(false);
        return;
      }
      setSpeaking(true);
    };
    utterance.onend = () => {
      if (cancelledRef.current) {
        stopKeepAlive();
        setSpeaking(false);
        return;
      }
      retriedRef.current = false;
      chunkIndexRef.current = index + 1;
      speakChunk(index + 1);
    };
    utterance.onerror = (e) => {
      if (cancelledRef.current || e.error === "canceled" || e.error === "interrupted") {
        stopKeepAlive();
        setSpeaking(false);
        return; // deliberate stop, not a real drop
      }
      if (!retriedRef.current) {
        // One retry for a chunk that was dropped mid-playback, so a transient glitch doesn't
        // silently skip words - if the retry also fails, move on rather than getting stuck.
        retriedRef.current = true;
        speakChunk(index);
      } else {
        retriedRef.current = false;
        speakChunk(index + 1);
      }
    };
    if (!cancelledRef.current) {
      window.speechSynthesis.speak(utterance);
    }
  }, [stopKeepAlive]);

  const speak = useCallback((text: string, onEnd?: () => void) => {
    if (!supported || !text.trim()) { onEnd?.(); return; }
    cancelledRef.current = false;
    onEndRef.current = onEnd;
    try {
      window.speechSynthesis.cancel();
    } catch {}
    queueRef.current = splitIntoChunks(text);
    chunkIndexRef.current = 0;
    retriedRef.current = false;
    startKeepAlive();
    // A short delay after cancel() avoids the race where speak() fires before the engine has
    // actually finished tearing down the previous utterance, which clips the first word.
    window.setTimeout(() => {
      if (!cancelledRef.current) {
        speakChunk(0);
      }
    }, CANCEL_TO_SPEAK_DELAY_MS);
  }, [supported, speakChunk, startKeepAlive]);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    queueRef.current = [];
    stopKeepAlive();
    if (supported && typeof window !== "undefined" && window.speechSynthesis) {
      try {
        window.speechSynthesis.pause();
        window.speechSynthesis.cancel();
      } catch {}
    }
    setSpeaking(false);
  }, [supported, stopKeepAlive]);

  useEffect(() => () => {
    cancelledRef.current = true;
    queueRef.current = [];
    stopKeepAlive();
    if (supported && typeof window !== "undefined" && window.speechSynthesis) {
      try {
        window.speechSynthesis.pause();
        window.speechSynthesis.cancel();
      } catch {}
    }
  }, [supported, stopKeepAlive]);

  return { speak, cancel, speaking, supported };
}
