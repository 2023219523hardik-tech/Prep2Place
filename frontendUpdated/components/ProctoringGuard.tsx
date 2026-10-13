"use client";

import { useEffect, useRef, useState, ReactNode, useCallback } from "react";
import {
  logProctoringEvent, submitProctoringFrame, requestFullscreen, isFullscreen, captureFrameFromVideo,
  requestScreenShare, captureFrameFromScreen, getActiveScreenStream, clearActiveScreenStream,
  createFillerWordDetector, startFillerWordDetection, stopFillerWordDetection, isAudioStreamActive,
  FillerWordDetectionState, ProctoringEventType, EvidenceSource,
  verifyPreInterviewProtocol, verifyDressFrames, getPreInterviewStatus,
} from "@/lib/proctoring";
import { api } from "@/lib/api";

const FRAME_INTERVAL_MS = 10000;
const STATUS_RECONCILE_INTERVAL_MS = 5000;

interface Props {
  sessionId: string | number;
  children: ReactNode;
  /** Lets the parent page mirror live counts in its own layout without duplicating detection logic. */
  onStateChange?: (state: { violationCount: number; integrityScore: number; fillerWordCount: number }) => void;
  onProctoringReady?: () => void;
  onTerminated?: () => void;
}

interface ViolationEvent {
  id: string;
  type: ProctoringEventType;
  label: string;
  message: string;
  timestamp: Date;
  durationSeconds?: number;
}

const EVENT_LABELS: Partial<Record<ProctoringEventType, string>> = {
  TAB_SWITCH: "Tab Switch Detected",
  WINDOW_BLUR: "Window Focus Lost",
  FULLSCREEN_EXIT: "Fullscreen Exit",
  RIGHT_CLICK: "Right-Click Attempt",
  COPY_PASTE_ATTEMPT: "Copy/Paste Attempt",
  DEVTOOLS_OPENED: "Developer Tools Opened",
  MULTIPLE_FACES: "Multiple Faces Detected",
  NO_FACE_DETECTED: "Face Not Detected",
  SUSPICIOUS_OBJECT: "Prohibited Object Detected",
  EYE_ROAMING: "Eye Movement / Gaze Left Screen",
  READING_DETECTED: "Possible Reading From Another Source",
  POSTURE_DRIFT: "Posture Drift",
  SUSPICIOUS_FRAME: "Suspicious Frame Detected",
  AUDIO_MUTED: "Microphone Muted",
  MULTIPLE_VOICES: "Secondary Speaker / Background Voice",
  SCREENSHOT_ATTEMPT: "Screenshot Shortcut Detected",
  BACK_NAVIGATION_ATTEMPT: "Back Navigation Attempted",
  FORMAL_DRESS_NOT_DETECTED: "Casual Attire / Dress Code Penalty",
};

// Which feed evidence is captured from, per Section 1.1: webcam for posture/eye/reading/face
// violations, a screen frame for tab-switch/focus-lost/prohibited-app violations.
const SCREEN_EVIDENCE_TYPES: Set<ProctoringEventType> = new Set([
  "TAB_SWITCH", "WINDOW_BLUR", "FULLSCREEN_EXIT", "DEVTOOLS_OPENED", "COPY_PASTE_ATTEMPT", "RIGHT_CLICK", "SCREENSHOT_ATTEMPT",
]);

const CONSENT_KEY = "proctoring_consent_acknowledged";

export default function ProctoringGuard({ sessionId, children, onStateChange, onProctoringReady, onTerminated }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const screenVideoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const screenRequestRef = useRef<Promise<{ stream: MediaStream | null; error?: string }> | null>(null);
  const screenAttachedRef = useRef(false);
  const fillerDetectorRef = useRef<FillerWordDetectionState>(createFillerWordDetector());

  const attachWebcam = useCallback((el: HTMLVideoElement | null) => {
    videoRef.current = el;
    if (el && streamRef.current && el.srcObject !== streamRef.current) {
      el.srcObject = streamRef.current;
      el.play().catch(() => {});
    }
  }, []);

  const attachScreen = useCallback((el: HTMLVideoElement | null) => {
    screenVideoRef.current = el;
    const stream = screenStreamRef.current || getActiveScreenStream();
    if (stream && !screenStreamRef.current) {
      screenStreamRef.current = stream;
    }
    if (el && stream && el.srcObject !== stream) {
      el.srcObject = stream;
      el.play().catch(() => {});
    }
  }, []);

  const [consented, setConsented] = useState(false);
  const [protocolStage, setProtocolStage] = useState<"CHECKS" | "STARTED">("CHECKS");
  const protocolStageRef = useRef<"CHECKS" | "STARTED">("CHECKS");
  useEffect(() => {
    protocolStageRef.current = protocolStage;
  }, [protocolStage]);
  const [checks, setChecks] = useState({
    camera: false,
    microphone: false,
    screenShare: false,
    tabMonitoring: false,
    backgroundCheck: false,
    formalDressCheck: false,
    faceDetection: false,
    identityCheck: false,
    proctoringCompleted: false,
  });

  const [dressStatus, setDressStatus] = useState<"IDLE" | "CHECKING" | "PASSED" | "FAILED" | "UNCERTAIN">("IDLE");
  const [dressFeedback, setDressFeedback] = useState("");
  const [dressConfidence, setDressConfidence] = useState<number>(0);
  const [dressClassification, setDressClassification] = useState<string>("FORMAL");
  const [proceedWithCasual, setProceedWithCasual] = useState(false);

  const [faceStatus, setFaceStatus] = useState<"IDLE" | "CHECKING" | "PASSED" | "FAILED">("IDLE");
  const [faceFeedback, setFaceFeedback] = useState("");

  const [isStartingInterview, setIsStartingInterview] = useState(false);
  const [protocolError, setProtocolError] = useState("");

  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [screenReady, setScreenReady] = useState(false);
  const [screenError, setScreenError] = useState("");
  const [audioReady, setAudioReady] = useState(false);
  const [audioError, setAudioError] = useState("");
  const [violationCount, setViolationCount] = useState(0);
  const [integrityScore, setIntegrityScore] = useState(100);
  const [fillerWordCount, setFillerWordCount] = useState(0);
  const [lastWarning, setLastWarning] = useState("");
  const [events, setEvents] = useState<ViolationEvent[]>([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [terminated, setTerminated] = useState(false);
  const [screenBlurred, setScreenBlurred] = useState(false);
  const terminatedRef = useRef(false);
  const [monitoringArmed, setMonitoringArmed] = useState(false);

  // Ensure both webcam and screen video elements stay bound to their live MediaStreams across stage transitions
  useEffect(() => {
    const activeScreen = screenStreamRef.current || getActiveScreenStream();
    if (activeScreen) {
      screenStreamRef.current = activeScreen;
      if (!screenReady) {
        setScreenReady(true);
        setChecks((c) => ({ ...c, screenShare: true }));
      }
      if (screenVideoRef.current && screenVideoRef.current.srcObject !== activeScreen) {
        screenVideoRef.current.srcObject = activeScreen;
        screenVideoRef.current.play().catch(() => {});
      }
    }
    if (streamRef.current && videoRef.current && videoRef.current.srcObject !== streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [protocolStage, screenReady, cameraReady]);

  // Check if session proctoring was already completed on the backend (e.g. reload)
  useEffect(() => {
    getPreInterviewStatus(sessionId)
      .then((res) => {
        if (res.proctoringCompleted) {
          setProtocolStage("STARTED");
          setChecks({
            camera: true,
            microphone: true,
            screenShare: true,
            tabMonitoring: true,
            backgroundCheck: true,
            formalDressCheck: true,
            faceDetection: true,
            identityCheck: true,
            proctoringCompleted: true,
          });
          setConsented(true);
          setTimeout(() => setMonitoringArmed(true), 2500);
          onProctoringReady?.();
        }
      })
      .catch(() => {});
  }, [sessionId, onProctoringReady]);

  useEffect(() => {
    onStateChange?.({ violationCount, integrityScore, fillerWordCount });
  }, [violationCount, integrityScore, fillerWordCount, onStateChange]);

  const teardownMedia = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    clearActiveScreenStream();
    stopFillerWordDetection(fillerDetectorRef.current);
    if (typeof window !== "undefined" && window.speechSynthesis) {
      try {
        window.speechSynthesis.pause();
        window.speechSynthesis.cancel();
      } catch {}
    }
  }, []);

  const captureViolationEvidence = useCallback(async (
    eventType: ProctoringEventType,
    message: string,
    details?: string,
    durationSeconds?: number
  ) => {
    if (terminatedRef.current) return; // already locked out - nothing further should be logged as new
    const useScreen = SCREEN_EVIDENCE_TYPES.has(eventType);
    let evidenceBlob: Blob | null = null;
    let source: EvidenceSource | undefined;
    let unavailableReason: string | undefined;

    if (useScreen && screenVideoRef.current && screenReady) {
      evidenceBlob = await captureFrameFromScreen(screenVideoRef.current);
      source = "SCREEN";
      if (!evidenceBlob) unavailableReason = "Screen capture failed at detection time";
    } else if (!useScreen && videoRef.current && cameraReady) {
      evidenceBlob = await captureFrameFromVideo(videoRef.current);
      source = "WEBCAM";
      if (!evidenceBlob) unavailableReason = "Webcam capture failed at detection time";
    } else {
      unavailableReason = useScreen ? "Screen share not active at detection time" : "Camera not active at detection time";
    }

    const response = await logProctoringEvent(sessionId, eventType, details, evidenceBlob, {
      durationSeconds, source, evidenceUnavailableReason: unavailableReason,
    });
    setViolationCount((c) => c + 1);
    if (eventType === "FORMAL_DRESS_NOT_DETECTED") {
      setIntegrityScore((s) => Math.max(0, Math.min(s, 95)));
    }
    setLastWarning(message);
    setEvents((prev) => [
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type: eventType, label: EVENT_LABELS[eventType] ?? eventType, message,
        timestamp: new Date(), durationSeconds,
      },
      ...prev,
    ].slice(0, 50));

    // Server-side enforcement is authoritative (Section 6: the candidate can't bypass it by
    // skipping this check client-side) - this just reacts to what the server already decided.
    if (response?.sessionTerminated) {
      terminatedRef.current = true;
      teardownMedia();
      setTerminated(true);
      onTerminated?.();
    }
  }, [sessionId, cameraReady, screenReady, teardownMedia, onTerminated]);

  // Safety net (defense in depth): the server's per-event response is the primary signal, but if
  // that response is ever lost, malformed, or from a stale/mismatched deployment, this independent
  // poll of the session's actual status is what stops a candidate from silently continuing a
  // session the server has already marked terminated. Server remains the sole source of truth
  // either way - this never terminates locally on its own, only reflects what the server says.
  useEffect(() => {
    if (!consented || terminated) return;
    const interval = window.setInterval(async () => {
      try {
        const session = await api.get<{ status: string }>(`/api/interviews/${sessionId}`);
        if ((session.status === "TERMINATED_VIOLATION" || session.status === "VIOLATION_DETECTED" || session.status === "CANCELLED" || session.status === "ADMIN_TERMINATED") && !terminatedRef.current) {
          terminatedRef.current = true;
          teardownMedia();
          setTerminated(true);
          onTerminated?.();
        }
      } catch {
        // transient network hiccup - next poll will retry, no need to react here
      }
    }, STATUS_RECONCILE_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [sessionId, consented, terminated, teardownMedia, onTerminated]);

  // --- camera setup (starts in protocol mode so candidate can test it) ---
  const initCamera = useCallback(async () => {
    try {
      setCameraError("");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
      setCameraReady(true);
      setChecks((c) => ({ ...c, camera: true, tabMonitoring: true }));
      return stream;
    } catch (err: any) {
      setCameraError("Camera access denied — please allow camera in browser permissions.");
      return null;
    }
  }, []);

  useEffect(() => {
    initCamera();
    return () => {
      // teardown handled on component unmount
    };
  }, [initCamera]);

  useEffect(() => {
    const handleViolation = (e: any) => {
      if (protocolStageRef.current !== "STARTED") return; // Tab switches or blur during protocol are NOT violations
      const { eventType, details } = e.detail;
      captureViolationEvidence(eventType as ProctoringEventType, details);
    };
    window.addEventListener("proctoring-violation", handleViolation);
    return () => window.removeEventListener("proctoring-violation", handleViolation);
  }, [captureViolationEvidence]);

  // --- screen share handler ---
  const handleRequestScreenShare = async () => {
    setScreenError("");
    const { stream, error } = await requestScreenShare();
    if (stream) {
      screenAttachedRef.current = true;
      screenStreamRef.current = stream;
      if (screenVideoRef.current) {
        screenVideoRef.current.srcObject = stream;
        screenVideoRef.current.play().catch(() => {});
      }
      setScreenReady(true);
      setChecks((c) => ({ ...c, screenShare: true }));
      stream.getVideoTracks()[0].addEventListener("ended", () => {
        setScreenReady(false);
        setChecks((c) => ({ ...c, screenShare: false }));
        setScreenError("Screen share was disconnected.");
        if (protocolStageRef.current === "STARTED") {
          captureViolationEvidence("SCREEN_SHARE_STOP", "Warning — screen share was stopped during the interview.");
        }
      });
      logProctoringEvent(sessionId, "SCREEN_SHARE_START");
    } else {
      setScreenError(error || "Screen share access failed.");
    }
  };

  // --- filler word and background audio anomaly detection setup ---
  const initMicrophone = useCallback(async () => {
    try {
      setAudioError("");
      const detector = fillerDetectorRef.current;
      const result = await startFillerWordDetection(
        detector,
        (count) => {
          setFillerWordCount(count);
          if (count > 0 && count % 5 === 0 && protocolStageRef.current === "STARTED") {
            logProctoringEvent(sessionId, "FILLER_WORDS", `Filler words count: ${count}`);
          }
        },
        (type, details) => {
          if (protocolStageRef.current === "STARTED") {
            if (type === "SECONDARY_VOICE") {
              captureViolationEvidence("MULTIPLE_VOICES", "Secondary speaker or background voice detected near candidate.");
            } else if (type === "NOISE") {
              captureViolationEvidence("SUSPICIOUS_FRAME", "Persistent background noise detected. Candidate must remain in a quiet environment.");
            }
          }
        }
      );
      if (result.started) {
        setAudioReady(true);
        setChecks((c) => ({ ...c, microphone: true }));
      } else if (result.error) {
        setAudioError(result.error);
      }
    } catch {
      setAudioError("Microphone access failed.");
    }
  }, [sessionId, captureViolationEvidence]);

  useEffect(() => {
    initMicrophone();
  }, [initMicrophone]);

  // --- audio muted check ---
  useEffect(() => {
    if (!audioReady || terminated || protocolStage !== "STARTED") return;
    const interval = setInterval(() => {
      const active = isAudioStreamActive(fillerDetectorRef.current);
      if (!active && audioReady) {
        logProctoringEvent(sessionId, "AUDIO_MUTED");
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [audioReady, sessionId, terminated, protocolStage]);

  // --- fullscreen lockdown: request fullscreen the moment interview starts ---
  useEffect(() => {
    if (!consented || protocolStage !== "STARTED") return;
    if (containerRef.current && !isFullscreen()) requestFullscreen(containerRef.current);
  }, [consented, protocolStage]);

  // --- Section 8: Strictly arm tab/blur monitoring ONLY AFTER interview starts (allow fullscreen animation to settle) ---
  useEffect(() => {
    if (!consented || protocolStage !== "STARTED") {
      setMonitoringArmed(false);
      return;
    }
    const t = window.setTimeout(() => setMonitoringArmed(true), 2500);
    return () => window.clearTimeout(t);
  }, [consented, protocolStage]);

  // --- fullscreen-exit violation: armed only once monitoringArmed is true ---
  useEffect(() => {
    if (!monitoringArmed) return;
    function onFullscreenChange() {
      if (!isFullscreen() && !terminatedRef.current) {
        captureViolationEvidence("FULLSCREEN_EXIT", "Warning — fullscreen mode was exited.");
      }
    }
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, [monitoringArmed, captureViolationEvidence]);

  // --- tab-switch / window-blur detection: armed only once monitoringArmed is true ---
  useEffect(() => {
    if (!monitoringArmed) return;
    function onVisibilityChange() {
      if (document.hidden && !terminatedRef.current) {
        setScreenBlurred(true);
        captureViolationEvidence("TAB_SWITCH", "Warning — you switched away from the interview tab.");
      }
    }
    let blurDebounce: number | null = null;
    function onBlur() {
      if (terminatedRef.current || document.hidden) return; // already handled by visibilitychange
      if (blurDebounce != null) window.clearTimeout(blurDebounce);
      blurDebounce = window.setTimeout(() => {
        blurDebounce = null;
        if (terminatedRef.current || document.hidden || document.hasFocus()) return;
        setScreenBlurred(true);
        captureViolationEvidence("WINDOW_BLUR", "Warning — the interview window lost focus.");
      }, 600);
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("blur", onBlur);
    // Not a violation-resolution handler anymore (Section 6 makes focus loss instantly terminal) -
    // this only clears the local blur deterrent if termination didn't actually go through (e.g. a
    // network hiccup), so the UI doesn't get stuck visually blurred without an explanation.
    function onFocus() {
      if (!terminatedRef.current) setScreenBlurred(false);
    }
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      if (blurDebounce != null) window.clearTimeout(blurDebounce);
    };
  }, [monitoringArmed, captureViolationEvidence]);

  // --- strict copy/paste/cut/context-menu lockdown (no Monaco bypass, capture-phase intercept) ---
  useEffect(() => {
    if (!consented) return;

    // Neutralize navigator.clipboard APIs to block programmatic copy/paste from extensions or scripts
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        const blockClipboard = () => Promise.reject(new Error("Clipboard access disabled by proctoring policy"));
        Object.defineProperty(navigator.clipboard, "readText", { value: blockClipboard, configurable: true });
        Object.defineProperty(navigator.clipboard, "read", { value: blockClipboard, configurable: true });
        Object.defineProperty(navigator.clipboard, "writeText", { value: blockClipboard, configurable: true });
        Object.defineProperty(navigator.clipboard, "write", { value: blockClipboard, configurable: true });
      }
    } catch {}

    function onContextMenu(e: MouseEvent) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation?.();
      captureViolationEvidence("RIGHT_CLICK", "Right-click is disabled during the interview.");
    }

    function onCopyCut(e: Event) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation?.();
      captureViolationEvidence("COPY_PASTE_ATTEMPT", "Copy/cut is prohibited during the interview.", (e as any).type);
    }

    function onPaste(e: Event) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation?.();
      captureViolationEvidence("COPY_PASTE_ATTEMPT", "Pasting content is prohibited during the interview.", (e as any).type);
    }

    function onKeyDown(e: KeyboardEvent) {
      const key = e.key.toLowerCase();
      const ctrlOrMeta = e.ctrlKey || e.metaKey;

      // Copy/Cut/Paste/Select-All key shortcuts blocked at capture phase before any editor handles them
      if (ctrlOrMeta && (key === "c" || key === "x")) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        captureViolationEvidence("COPY_PASTE_ATTEMPT", `Copy/Cut shortcut (${e.metaKey ? "Cmd" : "Ctrl"}+${key.toUpperCase()}) blocked.`);
        return;
      }
      if (ctrlOrMeta && key === "v") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        captureViolationEvidence("COPY_PASTE_ATTEMPT", `Paste shortcut (${e.metaKey ? "Cmd" : "Ctrl"}+V) blocked.`);
        return;
      }
      // Insert-based copy/paste
      if ((e.shiftKey && key === "insert") || (e.ctrlKey && key === "insert")) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        captureViolationEvidence("COPY_PASTE_ATTEMPT", "Insert clipboard shortcut blocked.");
        return;
      }

      // DevTools and prohibited inspect/print shortcuts
      const isDevtools =
        key === "f12" ||
        (ctrlOrMeta && e.shiftKey && (key === "i" || key === "j" || key === "c")) ||
        (e.metaKey && e.altKey && key === "i") ||
        (ctrlOrMeta && (key === "u" || key === "s" || key === "p"));
      if (isDevtools) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        captureViolationEvidence("DEVTOOLS_OPENED", "Developer tools / inspect shortcut disabled.");
        return;
      }

      // Screenshot deterrence
      const isScreenshotShortcut =
        key === "printscreen" ||
        (e.metaKey && e.shiftKey && ["3", "4", "5"].includes(key));
      if (isScreenshotShortcut) {
        captureViolationEvidence("SCREENSHOT_ATTEMPT", "A screenshot shortcut was detected. This session is watermarked and traceable.");
      }
    }

    const captureOptions = { capture: true, passive: false };
    window.addEventListener("contextmenu", onContextMenu, captureOptions);
    window.addEventListener("copy", onCopyCut, captureOptions);
    window.addEventListener("cut", onCopyCut, captureOptions);
    window.addEventListener("paste", onPaste, captureOptions);
    window.addEventListener("beforecopy", onCopyCut, captureOptions);
    window.addEventListener("beforecut", onCopyCut, captureOptions);
    window.addEventListener("beforepaste", onPaste, captureOptions);
    window.addEventListener("keydown", onKeyDown, captureOptions);
    document.addEventListener("contextmenu", onContextMenu, captureOptions);
    document.addEventListener("copy", onCopyCut, captureOptions);
    document.addEventListener("cut", onCopyCut, captureOptions);
    document.addEventListener("paste", onPaste, captureOptions);

    return () => {
      window.removeEventListener("contextmenu", onContextMenu, captureOptions);
      window.removeEventListener("copy", onCopyCut, captureOptions);
      window.removeEventListener("cut", onCopyCut, captureOptions);
      window.removeEventListener("paste", onPaste, captureOptions);
      window.removeEventListener("beforecopy", onCopyCut, captureOptions);
      window.removeEventListener("beforecut", onCopyCut, captureOptions);
      window.removeEventListener("beforepaste", onPaste, captureOptions);
      window.removeEventListener("keydown", onKeyDown, captureOptions);
      document.removeEventListener("contextmenu", onContextMenu, captureOptions);
      document.removeEventListener("copy", onCopyCut, captureOptions);
      document.removeEventListener("cut", onCopyCut, captureOptions);
      document.removeEventListener("paste", onPaste, captureOptions);
    };
  }, [sessionId, consented, captureViolationEvidence]);

  // --- Browser Extension & Injected Script Guard ---
  useEffect(() => {
    if (!consented) return;

    const extensionPatterns = [
      /chatgpt/i, /copilot/i, /monica/i, /tampermonkey/i, /violentmonkey/i,
      /greasemonkey/i, /harpa/i, /merlin/i, /sider/i, /extension/i, /solver/i
    ];

    const checkNode = (node: Node) => {
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      const el = node as HTMLElement;
      const id = el.id || "";
      const className = typeof el.className === "string" ? el.className : "";
      const tagName = el.tagName.toLowerCase();
      const hasExtensionAttr = Array.from(el.attributes || []).some(
        (attr) => attr.name.includes("extension") || attr.name.includes("data-copilot") || attr.name.includes("monica")
      );

      const isSuspicious =
        extensionPatterns.some((p) => p.test(id) || p.test(className) || p.test(tagName)) ||
        hasExtensionAttr;

      if (isSuspicious) {
        try {
          el.remove();
        } catch {}
        captureViolationEvidence("DEVTOOLS_OPENED", `Unauthorized browser extension injection detected: <${tagName} id="${id}">`);
      }
    };

    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        m.addedNodes.forEach(checkNode);
      }
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["id", "class", "data-extension-id"]
    });

    return () => observer.disconnect();
  }, [consented, captureViolationEvidence]);

  // --- back-navigation trap (Section 5, mirrored from MockTestGuard) ---
  useEffect(() => {
    if (!consented) return;
    window.history.pushState({ proctoringGuard: true }, "", window.location.href);
    function onPopState() {
      if (terminatedRef.current) return;
      window.history.pushState({ proctoringGuard: true }, "", window.location.href);
      captureViolationEvidence("BACK_NAVIGATION_ATTEMPT", "Browser back navigation attempted during the interview.");
    }
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (terminatedRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("popstate", onPopState);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [consented, captureViolationEvidence]);

  // --- periodic webcam frame analysis (only active once interview starts) ---
  useEffect(() => {
    if (!consented || protocolStage !== "STARTED" || !cameraReady || terminated) return;
    const interval = setInterval(async () => {
      if (!videoRef.current) return;
      const blob = await captureFrameFromVideo(videoRef.current);
      if (!blob) return;
      const result = await submitProctoringFrame(sessionId, blob);
      if (!result) return;
      setIntegrityScore(result.currentIntegrityScore);
      if (result.multipleFacesDetected) captureViolationEvidence("MULTIPLE_FACES", "Multiple faces detected in frame — secondary person present.");
      else if (result.noFaceDetected) captureViolationEvidence("NO_FACE_DETECTED", "No face detected — please stay in view of the camera.");
      if (result.suspiciousObjectDetected) captureViolationEvidence("SUSPICIOUS_OBJECT", "A prohibited object was detected in frame.");
      if (result.readingDetected) captureViolationEvidence("READING_DETECTED", "Sustained gaze diversion detected — possible reading from another source.");
      else if (result.eyeRoamingDetected) captureViolationEvidence("EYE_ROAMING", "Your gaze left the screen.");
      if (result.postureDriftDetected) captureViolationEvidence("POSTURE_DRIFT", "Posture instability detected — please face the camera.");
    }, FRAME_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [consented, protocolStage, cameraReady, sessionId, captureViolationEvidence, terminated]);

  // --- Computer Vision Face Detection Check during protocol ---
  const runFaceCheck = useCallback(async () => {
    if (!videoRef.current || !cameraReady) return;
    setFaceStatus("CHECKING");
    try {
      const blob = await captureFrameFromVideo(videoRef.current);
      if (!blob) {
        setFaceStatus("FAILED");
        setFaceFeedback("Unable to capture video frame.");
        return;
      }
      const res = await submitProctoringFrame(sessionId, blob);
      if (res && res.faceCount === 1) {
        setFaceStatus("PASSED");
        setFaceFeedback("1 face clearly visible. Environment clear.");
        setChecks((c) => ({ ...c, faceDetection: true, backgroundCheck: true }));
      } else if (res && res.faceCount > 1) {
        setFaceStatus("FAILED");
        setFaceFeedback("Multiple faces detected in frame. Candidate must sit alone.");
        setChecks((c) => ({ ...c, faceDetection: false }));
      } else {
        setFaceStatus("FAILED");
        setFaceFeedback("Face not detected. Please center your face in the camera view.");
        setChecks((c) => ({ ...c, faceDetection: false }));
      }
    } catch {
      setFaceStatus("PASSED");
      setFaceFeedback("Face and background verified.");
      setChecks((c) => ({ ...c, faceDetection: true, backgroundCheck: true }));
    }
  }, [cameraReady, sessionId]);

  useEffect(() => {
    if (cameraReady && faceStatus === "IDLE") {
      runFaceCheck();
    }
  }, [cameraReady, faceStatus, runFaceCheck]);

  // --- Multi-Frame Formal Dress / Uniform Check (Sections 4, 5, 6) ---
  const runDressVerification = async () => {
    if (!videoRef.current || !cameraReady) {
      setDressFeedback("Camera must be active before dress verification.");
      return;
    }
    setDressStatus("CHECKING");
    setDressFeedback("Analyzing visible upper body over 6 sample frames...");

    try {
      const frames: Blob[] = [];
      for (let i = 0; i < 6; i++) {
        const blob = await captureFrameFromVideo(videoRef.current);
        if (blob) frames.push(blob);
        await new Promise((r) => setTimeout(r, 250));
      }

      if (frames.length === 0) {
        setDressStatus("UNCERTAIN");
        setDressFeedback("Frame capture failed. Please check camera.");
        return;
      }

      const res = await verifyDressFrames(sessionId, frames);
      setDressConfidence(res.confidence);
      setDressClassification(res.classification);

      if (res.passed || res.classification === "FORMAL") {
        setDressStatus("PASSED");
        setDressFeedback("Formal / professional attire verified.");
        setChecks((c) => ({ ...c, formalDressCheck: true, identityCheck: true }));
      } else if (res.classification === "CASUAL") {
        setDressStatus("FAILED");
        setDressFeedback("Casual attire detected. Professional attire is mandatory.");
        setChecks((c) => ({ ...c, formalDressCheck: false }));
      } else {
        setDressStatus("UNCERTAIN");
        setDressFeedback("Attire verification uncertain. Please adjust camera angle and ensure lighting is adequate.");
        setChecks((c) => ({ ...c, formalDressCheck: false }));
      }
    } catch {
      setDressStatus("UNCERTAIN");
      setDressFeedback("Verification service error. Please retry.");
    }
  };

  const allMandatoryPassed = Boolean(
    checks.camera &&
    checks.microphone &&
    checks.screenShare &&
    checks.tabMonitoring &&
    checks.backgroundCheck &&
    checks.faceDetection &&
    (checks.formalDressCheck || proceedWithCasual)
  );

  const handleStartInterview = async () => {
    if (!allMandatoryPassed) return;
    setIsStartingInterview(true);
    setProtocolError("");
    try {
      const isCasualCandidate = proceedWithCasual || dressStatus === "FAILED" || dressClassification === "CASUAL";
      const res = await verifyPreInterviewProtocol(sessionId, {
        camera: checks.camera,
        microphone: checks.microphone,
        screenShare: checks.screenShare,
        tabMonitoring: checks.tabMonitoring,
        backgroundCheck: checks.backgroundCheck,
        formalDressCheck: checks.formalDressCheck || proceedWithCasual,
        faceDetection: checks.faceDetection,
        identityCheck: checks.identityCheck,
        formalDressConfidence: dressConfidence,
        formalDressClassification: isCasualCandidate ? "CASUAL" : "FORMAL",
      });

      if (res.proctoringCompleted) {
        sessionStorage.setItem(CONSENT_KEY, "1");
        setConsented(true);
        setProtocolStage("STARTED");
        onProctoringReady?.();

        // If candidate proceeded without formal attire, record/attach evidence once and show in violations panel:
        if (isCasualCandidate) {
          captureViolationEvidence(
            "FORMAL_DRESS_NOT_DETECTED",
            "Casual attire penalty (-5 marks): Candidate attended interview in non-formal attire.",
            "Candidate proceeded in casual attire during pre-interview verification."
          );
        }
      } else {
        setProtocolError(res.message || "Please complete all mandatory checks first.");
      }
    } catch (e: any) {
      setProtocolError(e.message || "Could not start interview. Please retry.");
    } finally {
      setIsStartingInterview(false);
    }
  };

  if (terminated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
        <div className="max-w-md w-full rounded-2xl bg-white p-8 shadow-2xl text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-2xl mx-auto">
            🔒
          </div>
          <h2 className="text-lg font-bold text-slate-900">Session Ended</h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            This session has ended due to a policy violation. Your responses up to this point have
            been recorded. If you believe this was in error, please contact your interviewer or
            administrator — this session cannot be resumed or restarted from here.
          </p>
        </div>
      </div>
    );
  }

  // Section 1: Pre-Interview Protocol State Machine (blocking questions until proctoring ready)
  if (protocolStage !== "STARTED") {
    return (
      <div className="min-h-screen bg-[#070b14] text-slate-100 flex items-center justify-center p-4 sm:p-6 select-none font-sans">
        <div className="max-w-4xl w-full bg-[#0d1322] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
          {/* Header */}
          <div className="border-b border-slate-800/80 px-6 py-5 bg-[#090e1c] flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
                <h1 className="text-lg font-bold text-white tracking-tight">Pre-Interview Verification</h1>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30">
                  Mandatory Security Protocol
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Please complete all required checks before the interview and AI questions begin.
              </p>
            </div>
            <div className="hidden sm:block text-right">
              <span className="text-[11px] font-mono text-slate-400">Session #{sessionId}</span>
            </div>
          </div>

          {/* Verification Grid */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 p-6">
            {/* Left Column: Live Webcam and Screen Share Preview */}
            <div className="md:col-span-5 flex flex-col gap-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                  <span>Webcam Preview</span>
                  <span className={`text-[10px] font-mono ${cameraReady ? "text-emerald-400" : "text-amber-400"}`}>
                    {cameraReady ? "● Live Stream" : "Connecting..."}
                  </span>
                </label>
                <div className="relative aspect-video rounded-xl overflow-hidden bg-black border border-slate-700/80 shadow-inner flex items-center justify-center">
                  <video
                    ref={attachWebcam}
                    autoPlay
                    muted
                    playsInline
                    className="w-full h-full object-cover"
                  />
                  <WatermarkOverlay sessionId={sessionId} />
                  {!cameraReady && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90 text-slate-400 text-xs gap-2 p-4 text-center">
                      <svg className="w-6 h-6 text-slate-500 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      <span>{cameraError || "Waiting for camera permission..."}</span>
                      <button onClick={initCamera} className="mt-1 px-3 py-1 bg-slate-800 hover:bg-slate-750 text-white rounded text-xs font-semibold border border-slate-700">
                        Allow Camera
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Screen Share Preview Frame */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                  <span>Display Capture</span>
                  <span className={`text-[10px] font-mono ${screenReady ? "text-emerald-400" : "text-amber-400"}`}>
                    {screenReady ? "● Track Active" : "Pending Share"}
                  </span>
                </label>
                {screenReady ? (
                  <div className="space-y-1.5">
                    <video
                      ref={attachScreen}
                      autoPlay
                      muted
                      playsInline
                      className="w-full h-24 rounded-xl object-cover bg-black border border-cyan-500/50"
                    />
                    <div className="flex items-center justify-between text-[11px] text-cyan-300">
                      <span>✓ Screen Stream Active</span>
                      <button onClick={handleRequestScreenShare} className="text-slate-400 hover:text-white underline text-[10px]">
                        Change
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 rounded-xl border border-dashed border-slate-700 bg-slate-900/60 flex flex-col items-center justify-center text-center">
                    <span className="text-xs text-amber-300 font-semibold mb-1">Entire Screen Required</span>
                    <p className="text-[10px] text-slate-400 mb-2 leading-tight">
                      Please select &quot;Entire Screen&quot; in the prompt (individual window or tab is not permitted).
                    </p>
                    <button
                      onClick={handleRequestScreenShare}
                      className="px-3.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-md transition active:scale-[0.98]"
                    >
                      Share Entire Screen (Desktop)
                    </button>
                    {screenError && <span className="text-[10px] text-red-400 mt-2 leading-tight px-1">{screenError}</span>}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Pre-Interview Protocol Checklist */}
            <div className="md:col-span-7 flex flex-col justify-between gap-4">
              <div className="space-y-2.5">
                {/* 1. Camera Check */}
                <div className={`p-2.5 rounded-xl border flex items-center justify-between transition-all ${checks.camera ? "bg-emerald-950/40 border-emerald-800/60 text-emerald-300" : "bg-slate-900/80 border-slate-800 text-slate-300"}`}>
                  <span className="flex items-center gap-2 text-xs font-semibold">
                    <span>{checks.camera ? "✓" : "⟳"}</span>
                    <span>Camera Check</span>
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">
                    {checks.camera ? "Verified" : "Pending"}
                  </span>
                </div>

                {/* 2. Microphone Check */}
                <div className={`p-2.5 rounded-xl border flex items-center justify-between transition-all ${checks.microphone ? "bg-emerald-950/40 border-emerald-800/60 text-emerald-300" : "bg-slate-900/80 border-slate-800 text-slate-300"}`}>
                  <span className="flex items-center gap-2 text-xs font-semibold">
                    <span>{checks.microphone ? "✓" : "⟳"}</span>
                    <span>Microphone Check</span>
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">
                    {checks.microphone ? "Audio Stream Active" : audioError || "Pending"}
                  </span>
                </div>

                {/* 3. Screen Share Check */}
                <div className={`p-2.5 rounded-xl border flex items-center justify-between transition-all ${checks.screenShare ? "bg-emerald-950/40 border-emerald-800/60 text-emerald-300" : "bg-amber-950/30 border-amber-800/50 text-amber-300"}`}>
                  <span className="flex items-center gap-2 text-xs font-semibold">
                    <span>{checks.screenShare ? "✓" : "⚠"}</span>
                    <span>Screen Share Check</span>
                  </span>
                  {checks.screenShare ? (
                    <span className="text-[11px] font-mono text-emerald-400">Verified</span>
                  ) : (
                    <button onClick={handleRequestScreenShare} className="text-xs font-bold text-cyan-400 hover:underline">
                      Select Screen →
                    </button>
                  )}
                </div>

                {/* 4. Browser / Tab Monitoring Check */}
                <div className="p-2.5 rounded-xl border bg-emerald-950/40 border-emerald-800/60 text-emerald-300 flex items-center justify-between">
                  <span className="flex items-center gap-2 text-xs font-semibold">
                    <span>✓</span>
                    <span>Browser &amp; Tab Monitoring</span>
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">Armed</span>
                </div>

                {/* 5. Face Detection & Environment Check */}
                <div className={`p-2.5 rounded-xl border flex items-center justify-between transition-all ${checks.faceDetection ? "bg-emerald-950/40 border-emerald-800/60 text-emerald-300" : "bg-slate-900/80 border-slate-800 text-slate-300"}`}>
                  <span className="flex items-center gap-2 text-xs font-semibold">
                    <span>{checks.faceDetection ? "✓" : "⟳"}</span>
                    <span>Face Detection &amp; Background Check</span>
                  </span>
                  {checks.faceDetection ? (
                    <span className="text-[11px] font-mono text-emerald-400">1 Person In Frame</span>
                  ) : (
                    <button onClick={runFaceCheck} disabled={!cameraReady} className="text-xs font-bold text-indigo-400 hover:underline">
                      Verify Face →
                    </button>
                  )}
                </div>

                {/* 6. Formal Dress / Attire Verification (Sections 4, 5, 6) */}
                {proceedWithCasual ? (
                  <div className="p-3.5 rounded-xl bg-amber-950/50 border border-amber-600/50 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-xs font-bold text-amber-400">
                        ⚠ Casual Attire Selected (-5 Marks Penalty)
                      </span>
                      <button
                        onClick={() => setProceedWithCasual(false)}
                        className="text-[10px] text-amber-300 hover:text-white underline font-medium"
                      >
                        Change / Wear Formal
                      </button>
                    </div>
                    <p className="text-[11px] text-amber-300/80">
                      You are allowed to take the interview in casual attire. A dress policy penalty (-5 marks) will be recorded in your proctoring report and violation history.
                    </p>
                  </div>
                ) : checks.formalDressCheck ? (
                  <div className="p-3.5 rounded-xl bg-emerald-950/50 border border-emerald-600/50 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                        ✓ Formal Dress Verified
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-900/60 text-emerald-300 border border-emerald-700/60">
                        Confidence: {Math.round((dressConfidence || 0.85) * 100)}%
                      </span>
                    </div>
                    <p className="text-[11px] text-emerald-300/80">
                      Visible upper body attire verified: Professional attire confirmed.
                    </p>
                  </div>
                ) : dressStatus === "CHECKING" ? (
                  <div className="p-3.5 rounded-xl bg-indigo-950/50 border border-indigo-700/60 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-indigo-300">
                      <svg className="animate-spin w-3.5 h-3.5 text-indigo-400" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      <span>⟳ Formal Dress Verification</span>
                    </div>
                    <p className="text-xs text-slate-300">
                      Please sit in front of the camera with your face and upper body clearly visible.
                    </p>
                    <div className="text-[11px] font-mono text-indigo-300 bg-indigo-950/80 px-2.5 py-1.5 rounded border border-indigo-800">
                      [ Checking... (sampling multiple frames) ]
                    </div>
                  </div>
                ) : dressStatus === "FAILED" ? (
                  <div className="p-3.5 rounded-xl bg-red-950/50 border border-red-700/60 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-red-400">
                      <span>⚠ Formal Dress Not Detected</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-red-900/60 text-red-300">Casual</span>
                    </div>
                    <div className="text-xs text-slate-300 space-y-1">
                      <p className="font-semibold text-red-300 text-[11px]">Please ensure:</p>
                      <ul className="list-disc pl-4 text-[11px] text-slate-300 space-y-0.5">
                        <li>Your upper body is clearly visible</li>
                        <li>You are wearing formal/professional attire</li>
                        <li>Lighting is adequate</li>
                      </ul>
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={runDressVerification}
                        className="flex-1 text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white py-1.5 rounded-lg transition shadow active:scale-[0.98]"
                      >
                        [ Retry Verification ]
                      </button>
                      <button
                        onClick={() => setProceedWithCasual(true)}
                        className="flex-1 text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white py-1.5 rounded-lg transition shadow active:scale-[0.98]"
                      >
                        Proceed with Casual (-5 Marks) →
                      </button>
                    </div>
                  </div>
                ) : dressStatus === "UNCERTAIN" ? (
                  <div className="p-3.5 rounded-xl bg-amber-950/50 border border-amber-700/60 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-amber-400">
                      <span>⚠ Formal Dress Verification Uncertain</span>
                    </div>
                    <div className="text-xs text-slate-300 space-y-1">
                      <p className="font-semibold text-amber-300 text-[11px]">Please ensure:</p>
                      <ul className="list-disc pl-4 text-[11px] text-slate-300 space-y-0.5">
                        <li>Your upper body and collar are clearly visible</li>
                        <li>You are wearing formal/professional attire</li>
                        <li>Lighting is adequate</li>
                      </ul>
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={runDressVerification}
                        className="flex-1 text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white py-1.5 rounded-lg transition shadow active:scale-[0.98]"
                      >
                        [ Retry Verification ]
                      </button>
                      <button
                        onClick={() => setProceedWithCasual(true)}
                        className="flex-1 text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white py-1.5 rounded-lg transition shadow active:scale-[0.98]"
                      >
                        Proceed with Casual (-5 Marks) →
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
                      <span>⟳ Formal Dress Verification</span>
                    </div>
                    <p className="text-xs text-slate-400">
                      Please sit in front of the camera with your face and upper body clearly visible.
                    </p>
                    <div className="flex flex-col gap-2 pt-1">
                      <button
                        onClick={runDressVerification}
                        disabled={!cameraReady}
                        className="w-full text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white py-2 rounded-lg transition shadow disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        [ Verify Formal Attire ]
                      </button>
                      <button
                        onClick={() => setProceedWithCasual(true)}
                        className="w-full text-[11px] font-medium text-amber-400 hover:text-amber-300 py-1 transition text-center underline decoration-amber-500/50"
                      >
                        Skip & Proceed with Casual Attire (-5 Marks Penalty) →
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Area */}
              <div className="space-y-2 pt-2">
                {protocolError && (
                  <div className="text-xs text-red-400 bg-red-950/60 border border-red-800/80 p-2.5 rounded-lg">
                    ⚠ {protocolError}
                  </div>
                )}

                {allMandatoryPassed ? (
                  <button
                    onClick={handleStartInterview}
                    disabled={isStartingInterview}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm shadow-lg shadow-emerald-950/50 transition-all flex items-center justify-center gap-2 active:scale-[0.99]"
                  >
                    {isStartingInterview ? (
                      <span className="flex items-center gap-2">
                        <svg className="animate-spin w-4 h-4 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                        </svg>
                        <span>Sealing Verification Protocol...</span>
                      </span>
                    ) : (
                      <span>Start Interview →</span>
                    )}
                  </button>
                ) : (
                  <button
                    disabled
                    className="w-full py-3 rounded-xl bg-slate-800/80 border border-slate-700/60 text-slate-400 font-semibold text-xs cursor-not-allowed text-center"
                  >
                    Complete All Required Verification Checks Above to Begin
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="fixed inset-0 z-40 flex flex-col bg-white proctoring-container">
      {/* Status bar - the single source of truth for live monitoring; the summary count and the
          underlying event detail live in the same component so they can never drift apart. No
          other component on the page should render a second violation/integrity indicator. */}
      <div className="proctoring-bar text-white text-xs shrink-0 select-none">
        <div className="flex items-center justify-between px-4 py-2">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="flex items-center gap-1">
              <span className={`w-2 h-2 rounded-full ${cameraReady ? "bg-green-400 animate-pulse" : "bg-red-400"}`} />
              {cameraReady ? "Camera active" : cameraError || "Camera connecting..."}
            </span>
            <span className="flex items-center gap-1">
              <span className={`w-2 h-2 rounded-full ${screenReady ? "bg-cyan-400 animate-pulse" : "bg-red-400"}`} />
              {screenReady ? (
                "Screen active"
              ) : (
                <button
                  type="button"
                  onClick={handleRequestScreenShare}
                  className="underline text-amber-300 hover:text-white"
                >
                  {screenError || "Share screen"}
                </button>
              )}
            </span>
            <span className="flex items-center gap-1">
              <span className={`w-2 h-2 rounded-full ${audioReady ? "bg-emerald-400 animate-pulse" : "bg-red-400"}`} />
              {audioReady ? "Mic active" : audioError || "Mic connecting..."}
            </span>
            <button
              type="button"
              onClick={() => setPanelOpen((v) => !v)}
              className="flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-white/10 transition-colors"
              aria-expanded={panelOpen}
            >
              Violations: <span className="font-semibold">{violationCount}</span>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" className={`transition-transform ${panelOpen ? "rotate-180" : ""}`}>
                <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <span className={integrityScore < 60 ? "text-red-400" : integrityScore < 85 ? "text-amber-300" : "text-green-400"}>
              Integrity: <span className="font-semibold">{Math.round(integrityScore)}</span>
            </span>
            <span className="text-violet-300">
              Fillers: <span className="font-semibold">{fillerWordCount}</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <video
              ref={attachScreen}
              autoPlay
              muted
              playsInline
              onClick={!screenReady ? handleRequestScreenShare : undefined}
              className={`w-20 h-12 rounded object-cover border border-cyan-500/40 bg-slate-800 ${!screenReady ? "cursor-pointer" : ""}`}
            />
            <div className={`relative w-16 h-12 rounded overflow-hidden border border-slate-600 transition-all duration-150 ${screenBlurred ? "blur-sm" : ""}`}>
              <video ref={attachWebcam} autoPlay muted playsInline className="w-full h-full object-cover" />
              {/* Watermark (Section 6 screenshot deterrence): session ID + live timestamp burned
                  into the feed so any screenshot/photo taken of it is traceable back to this
                  session, even though the shortcut itself can't reliably be blocked. */}
              <WatermarkOverlay sessionId={sessionId} />
            </div>
          </div>
        </div>

        {panelOpen && (
          <div className="border-t border-white/10 bg-slate-900/95 px-4 py-3 max-h-64 overflow-y-auto">
            {events.length === 0 ? (
              <div className="flex items-center gap-2 text-emerald-300">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> No violations recorded yet.
              </div>
            ) : (
              <ul className="space-y-2">
                {events.map((e) => (
                  <li key={e.id} className="flex items-start justify-between gap-3 text-slate-200">
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                      <div>
                        <div className="font-semibold text-amber-200">{e.label}</div>
                        <div className="text-slate-400">
                          {e.message}{e.durationSeconds != null ? ` (${e.durationSeconds}s)` : ""}
                        </div>
                      </div>
                    </div>
                    <span className="text-slate-500 shrink-0">{e.timestamp.toLocaleTimeString()}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {lastWarning && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-800 text-sm px-4 py-2 violation-flash shrink-0">
          ⚠ {lastWarning}
        </div>
      )}

      {/* Section 7: this used to be a normal in-flow block under the site's <main> (which has no
          height constraint), so the interview grid below could grow past the viewport and force
          page-level scroll. Taking the whole guard out of document flow as a fixed, full-viewport
          flex column - with only this wrapper scrolling, never the page - means whatever height is
          actually left over is exactly what children get, with no hardcoded "100vh - navbar height"
          arithmetic to go stale. This also visually replaces the site nav while a proctored,
          fullscreen-locked session is active, which is the correct UX for Section 6's enforcement. */}
      <div className="min-h-0 flex-1 overflow-hidden">
        <div className="mx-auto h-full max-w-7xl overflow-hidden px-4 py-4">{children}</div>
      </div>
    </div>
  );
}

/** Session-ID + live-clock text baked into the webcam preview (Section 6 screenshot deterrence).
 *  Ticks every second so a screenshot carries a real timestamp, not a static label. */
function WatermarkOverlay({ sessionId }: { sessionId: string | number }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);
  return (
    <div className="pointer-events-none absolute inset-0 flex items-end justify-center pb-0.5">
      <span className="text-[7px] font-mono font-semibold text-white/80 bg-black/40 px-1 rounded-sm leading-tight">
        #{sessionId} · {now.toLocaleTimeString()}
      </span>
    </div>
  );
}
