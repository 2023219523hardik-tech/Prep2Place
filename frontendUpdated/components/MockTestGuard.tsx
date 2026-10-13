"use client";

import { useCallback, useEffect, useRef, useState, ReactNode } from "react";
import { reportViolation, getAttempt, terminateAttempt } from "@/lib/assessment";
import { registerAuthorizedStream, ProctoringEventType } from "@/lib/proctoring";

const STATUS_RECONCILE_INTERVAL_MS = 5000;

/** Only the enforcement-relevant fields - callers can pass either a full AssessmentProfile or an
 *  attempt's immutable configSnapshot (the policy actually locked in when the attempt started). */
export interface MockTestPolicy {
  screenShareRequired: boolean;
  cameraRequired: boolean;
  microphoneRequired: boolean;
  fullscreenRequired: boolean;
  allowCopy: boolean;
  allowPaste: boolean;
  allowContextMenu: boolean;
}

interface Props {
  attemptId: number | string;
  profile: MockTestPolicy;
  children: ReactNode;
}

const CONSENT_KEY_PREFIX = "mocktest_consent_acknowledged:";

/**
 * Anti-cheat shell for mock coding/aptitude tests (Section 5 + Section 6 - same universal policy
 * as the live interview's ProctoringGuard, applied here to the assessment-attempt API instead of
 * the interview API). Enforces from question 1: mandatory screen share (if the profile requires
 * it), fullscreen lockdown, copy/paste blocking, and instant termination on tab-switch/window-blur
 * /fullscreen-exit - decided authoritatively server-side, this component only reacts to it.
 */
export default function MockTestGuard({ attemptId, profile, children }: Props) {
  const consentKey = CONSENT_KEY_PREFIX + attemptId;
  const containerRef = useRef<HTMLDivElement>(null);
  const screenVideoRef = useRef<HTMLVideoElement>(null);
  const cameraVideoRef = useRef<HTMLVideoElement>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const terminatedRef = useRef(false);

  const [consented, setConsented] = useState(false);
  const [screenReady, setScreenReady] = useState(false);
  const [screenError, setScreenError] = useState("");
  const [cameraReady, setCameraReady] = useState(false);
  const [terminated, setTerminated] = useState(false);
  const [violationCount, setViolationCount] = useState(0);
  // True only once every permission this profile requires has actually resolved (and a short
  // settle buffer has passed). The tab-switch/window-blur/fullscreen-exit listeners below are
  // gated on THIS, not on `consented` directly - `consented` flips the instant the candidate
  // clicks the button, which is the same instant getUserMedia/getDisplayMedia pop up their
  // native permission UI. That native UI reliably blurs the document (and on some browser/OS
  // combinations marks it `hidden`) while the candidate is still reading/clicking "Allow" - with
  // the old single-flag gating, that was being caught by the very listeners meant to detect a
  // real tab-switch, ending the test before the candidate ever saw a question. Waiting for the
  // actual permission grants (not just the click) removes the false trigger at its source.
  const [monitoringArmed, setMonitoringArmed] = useState(false);

  useEffect(() => {
    setConsented(typeof window !== "undefined" && sessionStorage.getItem(consentKey) === "1");
  }, [consentKey]);

  const teardown = useCallback(() => {
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    cameraStreamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  const reportAndCheckTermination = useCallback(async (
    eventType: Parameters<typeof reportViolation>[1],
    details?: string,
    durationSeconds?: number
  ) => {
    if (terminatedRef.current) return;
    const event = await reportViolation(attemptId, eventType, { details, durationSeconds });
    setViolationCount((c) => c + 1);
    if (event?.contributedToTermination) {
      terminatedRef.current = true;
      teardown();
      setTerminated(true);
    }
  }, [attemptId, teardown]);

  const terminateImmediately = useCallback(async (reason: "TAB_SWITCH" | "WINDOW_BLUR" = "TAB_SWITCH", details?: string) => {
    if (terminatedRef.current) return;
    terminatedRef.current = true;
    setTerminated(true);
    teardown();

    try {
      await terminateAttempt(attemptId, reason);
    } catch {
      // Best-effort backend termination; the attempt remains locked locally as soon as the UI shows
      // the termination state, and the server-side status is re-checked by the periodic poll below.
    }

    try {
      await reportViolation(attemptId, "TAB_SWITCH", { details: details ?? "Candidate left the active test window; mock test terminated immediately.", durationSeconds: 0 });
    } catch {
      // Intentionally ignored; the explicit terminate call above is the authoritative lock.
    }
  }, [attemptId, teardown]);

  // Safety net (defense in depth): same reasoning as ProctoringGuard - the per-event response is
  // primary, but an independent poll of the attempt's actual status guards against a stale or
  // mismatched deployment where that response is missing the termination field.
  useEffect(() => {
    if (!consented || terminated) return;
    const interval = window.setInterval(async () => {
      try {
        const attempt = await getAttempt(attemptId);
        if (attempt.status === "TERMINATED" && !terminatedRef.current) {
          terminatedRef.current = true;
          teardown();
          setTerminated(true);
        }
      } catch {
        // transient network hiccup - next poll retries
      }
    }, STATUS_RECONCILE_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [attemptId, consented, terminated, teardown]);

  useEffect(() => {
    if (!consented) return;
    const handleViolation = (e: any) => {
      const { eventType, details } = e.detail;
      reportAndCheckTermination(eventType as any, details);
    };
    window.addEventListener("proctoring-violation", handleViolation);
    return () => window.removeEventListener("proctoring-violation", handleViolation);
  }, [consented, reportAndCheckTermination]);

  // --- mandatory screen share ---
  useEffect(() => {
    if (!consented || !profile.screenShareRequired) return;
    let cancelled = false;
    navigator.mediaDevices?.getDisplayMedia({ video: true })
      .then((stream) => {
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        registerAuthorizedStream(stream);
        screenStreamRef.current = stream;
        if (screenVideoRef.current) {
          screenVideoRef.current.srcObject = stream;
          screenVideoRef.current.play().catch(() => {});
        }
        setScreenReady(true);
        stream.getVideoTracks()[0].addEventListener("ended", () => {
          setScreenReady(false);
          setScreenError("Screen share stopped");
          reportAndCheckTermination("SCREEN_CHANGE_ATTEMPT", "Screen share was stopped mid-test");
        });
      })
      .catch(() => setScreenError("Screen share is required for this test and was not granted."));
    return () => { cancelled = true; screenStreamRef.current?.getTracks().forEach((t) => t.stop()); };
  }, [consented, profile.screenShareRequired, reportAndCheckTermination]);

  // --- optional camera (per profile) ---
  useEffect(() => {
    if (!consented || !profile.cameraRequired) return;
    let cancelled = false;
    navigator.mediaDevices?.getUserMedia({ video: { width: 320, height: 240 }, audio: profile.microphoneRequired })
      .then((stream) => {
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        cameraStreamRef.current = stream;
        if (cameraVideoRef.current) {
          cameraVideoRef.current.srcObject = stream;
          cameraVideoRef.current.play().catch(() => {});
        }
        setCameraReady(true);
      })
      .catch(() => reportAndCheckTermination("CAMERA_BLOCKED", "Camera access was denied"));
    return () => { cancelled = true; cameraStreamRef.current?.getTracks().forEach((t) => t.stop()); };
  }, [consented, profile.cameraRequired, profile.microphoneRequired, reportAndCheckTermination]);

  // --- fullscreen lockdown: request fullscreen the moment consent is given - this part stays
  //     tied to `consented` directly, it's only the violation *detection* below that waits. ---
  useEffect(() => {
    if (!consented || !profile.fullscreenRequired) return;
    const el = containerRef.current;
    if (el?.requestFullscreen) el.requestFullscreen().catch(() => {});
  }, [consented, profile.fullscreenRequired]);

  // --- arm monitoring only once every permission this profile actually requires has resolved ---
  useEffect(() => {
    if (!consented) { setMonitoringArmed(false); return; }
    const stillWaiting =
      (profile.screenShareRequired && !screenReady) || (profile.cameraRequired && !cameraReady);
    if (stillWaiting) { setMonitoringArmed(false); return; }
    // Small settle buffer: the permission grant resolving and the browser's own "you're now
    // sharing your screen" indicator bar fully appearing are not the same instant - this closes
    // that gap without weakening detection once armed.
    const t = window.setTimeout(() => setMonitoringArmed(true), 800);
    return () => window.clearTimeout(t);
  }, [consented, profile.screenShareRequired, profile.cameraRequired, screenReady, cameraReady]);

  // --- fullscreen-exit violation: armed only once monitoringArmed is true, same reasoning as
  //     the tab-switch/blur effect below - the OS-level screen-share picker can itself interrupt
  //     the fullscreen transition, which must not be read as the candidate exiting fullscreen. ---
  useEffect(() => {
    if (!monitoringArmed || !profile.fullscreenRequired) return;
    function onFullscreenChange() {
      if (!document.fullscreenElement && !terminatedRef.current) {
        reportAndCheckTermination("FULLSCREEN_EXIT", "Fullscreen mode was exited");
      }
    }
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, [monitoringArmed, profile.fullscreenRequired, reportAndCheckTermination]);

  // --- tab-switch / window-blur: instant, universal, no warning threshold ---
  // Armed only once monitoringArmed is true (after all permissions are granted and settled),
  // preventing native OS/browser permission pop-ups from causing false terminations.
  // Detects both visibilityState === "hidden" (tab switch) and window blur (macOS Cmd+Tab / app switch).
  useEffect(() => {
    if (!monitoringArmed || terminated) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden" || document.hidden) {
        void terminateImmediately("TAB_SWITCH", "Candidate switched away from the active test tab.");
      }
    };

    const handleBlur = () => {
      void terminateImmediately("WINDOW_BLUR", "Candidate left the active test window (Cmd+Tab / window blur detected).");
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleBlur);
    };
  }, [monitoringArmed, terminated, terminateImmediately]);

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

    function onCopyCut(e: Event) {
      if (!profile.allowCopy) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation?.();
        reportAndCheckTermination("COPY_ATTEMPT", "Clipboard copy/cut blocked by proctoring policy");
      }
    }

    function onPaste(e: Event) {
      if (!profile.allowPaste) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation?.();
        reportAndCheckTermination("PASTE_ATTEMPT", "Clipboard paste blocked by proctoring policy");
      }
    }

    function onContextMenu(e: MouseEvent) {
      if (!profile.allowContextMenu) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation?.();
        reportAndCheckTermination("CONTEXT_MENU_ATTEMPT", "Right-click context menu is disabled during the test");
      }
    }

    function onKeyDown(e: KeyboardEvent) {
      const key = e.key.toLowerCase();
      const ctrlOrMeta = e.ctrlKey || e.metaKey;

      // Copy/Cut/Paste/Select-All key shortcuts blocked at capture phase before any editor handles them
      if (ctrlOrMeta && (!profile.allowCopy && (key === "c" || key === "x"))) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        reportAndCheckTermination("COPY_ATTEMPT", `Copy/Cut shortcut (${e.metaKey ? "Cmd" : "Ctrl"}+${key.toUpperCase()}) blocked`);
        return;
      }
      if (ctrlOrMeta && (!profile.allowPaste && key === "v")) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        reportAndCheckTermination("PASTE_ATTEMPT", `Paste shortcut (${e.metaKey ? "Cmd" : "Ctrl"}+V) blocked`);
        return;
      }
      // Insert-based copy/paste
      if ((e.shiftKey && key === "insert" && !profile.allowPaste) || (e.ctrlKey && key === "insert" && !profile.allowCopy)) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        reportAndCheckTermination(e.shiftKey ? "PASTE_ATTEMPT" : "COPY_ATTEMPT", "Insert clipboard shortcut blocked");
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
        reportAndCheckTermination("DEVTOOLS_ATTEMPT", `Developer tools / prohibited shortcut (${key}) blocked`);
      }
    }

    // Attach in CAPTURE phase on both window and document to intercept before any bubble or inner handlers
    const captureOptions = { capture: true, passive: false };
    window.addEventListener("copy", onCopyCut, captureOptions);
    window.addEventListener("cut", onCopyCut, captureOptions);
    window.addEventListener("paste", onPaste, captureOptions);
    window.addEventListener("beforecopy", onCopyCut, captureOptions);
    window.addEventListener("beforecut", onCopyCut, captureOptions);
    window.addEventListener("beforepaste", onPaste, captureOptions);
    window.addEventListener("contextmenu", onContextMenu, captureOptions);
    window.addEventListener("keydown", onKeyDown, captureOptions);
    document.addEventListener("copy", onCopyCut, captureOptions);
    document.addEventListener("cut", onCopyCut, captureOptions);
    document.addEventListener("paste", onPaste, captureOptions);
    document.addEventListener("contextmenu", onContextMenu, captureOptions);

    return () => {
      window.removeEventListener("copy", onCopyCut, captureOptions);
      window.removeEventListener("cut", onCopyCut, captureOptions);
      window.removeEventListener("paste", onPaste, captureOptions);
      window.removeEventListener("beforecopy", onCopyCut, captureOptions);
      window.removeEventListener("beforecut", onCopyCut, captureOptions);
      window.removeEventListener("beforepaste", onPaste, captureOptions);
      window.removeEventListener("contextmenu", onContextMenu, captureOptions);
      window.removeEventListener("keydown", onKeyDown, captureOptions);
      document.removeEventListener("copy", onCopyCut, captureOptions);
      document.removeEventListener("cut", onCopyCut, captureOptions);
      document.removeEventListener("paste", onPaste, captureOptions);
      document.removeEventListener("contextmenu", onContextMenu, captureOptions);
    };
  }, [consented, profile.allowCopy, profile.allowPaste, profile.allowContextMenu, reportAndCheckTermination]);

  // --- Browser Extension & Script Injection Guard ---
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
        reportAndCheckTermination("DEVTOOLS_ATTEMPT", `Unauthorized browser extension injection detected: <${tagName} id="${id}">`);
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
  }, [consented, reportAndCheckTermination]);

  // --- back-navigation trap (Section 5: was entirely missing). Client-side only, as the spec
  //     itself acknowledges ("client checks alone are bypassable") - paired with server-side
  //     re-validation via the same violation-count/termination policy every other event goes
  //     through, so this can't be defeated by just disabling JS and clicking back anyway (the
  //     attempt is still locked server-side the moment ANY subsequent authenticated action hits
  //     a terminated attempt - see AssessmentEngineService's isTerminalState() guards). ---
  useEffect(() => {
    if (!consented) return;
    // Pushes a dummy history entry so the first back-press lands on it instead of leaving the page.
    window.history.pushState({ mockTestGuard: true }, "", window.location.href);
    function onPopState() {
      if (terminatedRef.current) return;
      window.history.pushState({ mockTestGuard: true }, "", window.location.href);
      reportAndCheckTermination("BACK_NAVIGATION_ATTEMPT", "Browser back navigation attempted during the test");
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
  }, [consented, reportAndCheckTermination]);

  if (terminated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
        <div className="max-w-md w-full rounded-2xl bg-white p-8 shadow-2xl text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-2xl mx-auto">🔒</div>
          <h2 className="text-lg font-bold text-slate-900">Test Ended</h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            This test has ended due to a policy violation. Your answers up to this point have been
            recorded and scored. This attempt cannot be resumed or restarted — contact your
            administrator if you believe this was in error.
          </p>
        </div>
      </div>
    );
  }

  if (!consented) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
        <div className="max-w-lg w-full rounded-2xl bg-white p-6 shadow-2xl space-y-4">
          <h2 className="text-lg font-bold text-slate-900">This test is monitored</h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            {profile.screenShareRequired && "Screen sharing is required for the full duration of this test. "}
            {profile.cameraRequired && "Your camera is required. "}
            Copy and paste {profile.allowCopy || profile.allowPaste ? "may be restricted" : "are disabled"} in
            the test environment.
          </p>
          <p className="text-sm text-slate-600 leading-relaxed">
            <strong className="text-slate-800">Switching tabs, minimizing the window, or exiting
            fullscreen ends the test immediately</strong> and it cannot be resumed. Your feed is
            watermarked with an attempt ID and timestamp for traceability; browsers cannot fully
            prevent OS-level screenshots — this is a deterrent and detection layer, not a guarantee.
          </p>
          <button
            type="button"
            className="w-full rounded-lg bg-slate-900 text-white font-semibold py-2.5 hover:bg-slate-800 transition-colors"
            onClick={() => {
              // Section 7 fix applied here too: request fullscreen synchronously in this real
              // click handler rather than relying solely on the effect below, which fires async
              // relative to the gesture and can be silently rejected by the browser.
              document.documentElement.requestFullscreen?.().catch(() => {});
              sessionStorage.setItem(consentKey, "1");
              setConsented(true);
            }}
          >
            I understand and consent to monitoring
          </button>
        </div>
      </div>
    );
  }

  const blockedOnPrereqs = (profile.screenShareRequired && !screenReady) || (profile.cameraRequired && !cameraReady);

  return (
    <div ref={containerRef} className="min-h-screen proctoring-container">
      <div className="text-white text-xs select-none" style={{ background: "linear-gradient(90deg,#0f172a,#1e293b)" }}>
        <div className="flex items-center justify-between px-4 py-2">
          <div className="flex items-center gap-4 flex-wrap">
            {profile.screenShareRequired && (
              <span className="flex items-center gap-1">
                <span className={`w-2 h-2 rounded-full ${screenReady ? "bg-cyan-400 animate-pulse" : "bg-red-400"}`} />
                {screenReady ? "Screen sharing active" : screenError || "Waiting for screen share..."}
              </span>
            )}
            {profile.cameraRequired && (
              <span className="flex items-center gap-1">
                <span className={`w-2 h-2 rounded-full ${cameraReady ? "bg-green-400 animate-pulse" : "bg-red-400"}`} />
                {cameraReady ? "Camera active" : "Waiting for camera..."}
              </span>
            )}
            <span>Violations: <span className="font-semibold">{violationCount}</span></span>
          </div>
          {profile.cameraRequired && (
            <div className="relative w-16 h-12 rounded overflow-hidden border border-slate-600">
              <video ref={cameraVideoRef} muted playsInline className="w-full h-full object-cover" />
              <MockTestWatermark attemptId={attemptId} />
            </div>
          )}
          <video ref={screenVideoRef} muted playsInline className="hidden" />
        </div>
      </div>

      {blockedOnPrereqs ? (
        <div className="flex min-h-[70vh] items-center justify-center px-4">
          <div className="max-w-md text-center space-y-3">
            <h3 className="text-lg font-bold text-slate-800">Waiting for required permissions</h3>
            <p className="text-sm text-slate-600">
              {profile.screenShareRequired && !screenReady && "Grant screen-share access to begin. "}
              {profile.cameraRequired && !cameraReady && "Grant camera access to begin."}
            </p>
          </div>
        </div>
      ) : (
        <div className="max-w-7xl mx-auto px-4 py-6">{children}</div>
      )}
    </div>
  );
}

function MockTestWatermark({ attemptId }: { attemptId: number | string }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);
  return (
    <div className="pointer-events-none absolute inset-0 flex items-end justify-center pb-0.5">
      <span className="text-[7px] font-mono font-semibold text-white/80 bg-black/40 px-1 rounded-sm leading-tight">
        #{attemptId} · {now.toLocaleTimeString()}
      </span>
    </div>
  );
}
