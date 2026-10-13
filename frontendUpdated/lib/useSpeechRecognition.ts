"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Wraps the browser's native SpeechRecognition API (Web Speech API) for speech-to-text.
 * HONEST LIMITATION: this API is only implemented in Chromium-based browsers (Chrome, Edge)
 * and Safari — NOT Firefox. `supported` reflects this so the UI can fall back to typed input
 * cleanly rather than silently failing. When supported, this is real, live, on-device/cloud
 * (browser-vendor-provided) transcription — not a stub.
 */
interface SpeechRecognitionResult {
  transcript: string;
  listening: boolean;
  supported: boolean;
  start: () => void;
  stop: () => void;
  resetTranscript: () => void;
}

export function useSpeechRecognition(): SpeechRecognitionResult {
  const [transcript, setTranscript] = useState("");
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognitionCtor =
      typeof window !== "undefined" && ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
    if (!SpeechRecognitionCtor) {
      setSupported(false);
      return;
    }
    setSupported(true);
    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: any) => {
      let finalTranscript = "";
      for (let i = 0; i < event.results.length; i++) {
        finalTranscript += event.results[i][0].transcript;
      }
      setTranscript(finalTranscript);
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);

    recognitionRef.current = recognition;
    return () => recognition.stop();
  }, []);

  const start = useCallback(() => {
    if (!recognitionRef.current) return;
    setTranscript("");
    try {
      recognitionRef.current.start();
      setListening(true);
    } catch {
      // start() throws if already started — ignore, it's already listening
    }
  }, []);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  const resetTranscript = useCallback(() => setTranscript(""), []);

  return { transcript, listening, supported, start, stop, resetTranscript };
}
