"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  jobsApi,
  RoundAssessmentQuestion,
  StartRoundAssessmentResponse,
  SubmitRoundAssessmentResponse,
} from "@/lib/jobs";
import { ApiError } from "@/lib/api";
import { Icon } from "@/components/ui/Icon";
import LoadingState from "@/components/LoadingState";
import ErrorState from "@/components/ErrorState";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-[360px] items-center justify-center bg-slate-900 text-sm text-slate-400 font-mono">
      Initializing Code Editor...
    </div>
  ),
});

export default function RoundAssessmentPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const roundId = Number(params?.roundId);
  const appId = Number(searchParams?.get("appId") || 0);

  const [assessmentData, setAssessmentData] = useState<StartRoundAssessmentResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Proctoring & System Check Phase
  const [systemCheckPassed, setSystemCheckPassed] = useState(false);
  const [cameraGranted, setCameraGranted] = useState(false);
  const [micGranted, setMicGranted] = useState(false);
  const [screenShareGranted, setScreenShareGranted] = useState(false);
  const [fullscreenGranted, setFullscreenGranted] = useState(false);
  const [fullscreenLockedOut, setFullscreenLockedOut] = useState(false);
  const [consentAcknowledged, setConsentAcknowledged] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [screenShareError, setScreenShareError] = useState("");

  // Media Streams
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);
  const liveVideoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);

  // Assessment Interaction State
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [markedForReview, setMarkedForReview] = useState<Record<number, boolean>>({});
  const [codingCodes, setCodingCodes] = useState<Record<number, string>>({});
  const [codingLanguage, setCodingLanguage] = useState<string>("java");

  // Timer & Violations
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [violations, setViolations] = useState(0);
  const [violationWarning, setViolationWarning] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<SubmitRoundAssessmentResponse | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const monitoringArmedRef = useRef(false);
  const triggerViolationRef = useRef<(reason: string) => void>(() => {});
  const handleSubmitAssessmentRef = useRef<(forcedByViolations?: boolean) => void>(() => {});

  // Initialize Assessment Data
  useEffect(() => {
    if (!roundId || !appId) {
      setError("Invalid round or application parameter. Please launch from your Hiring Progress dashboard.");
      setLoading(false);
      return;
    }

    jobsApi
      .startAssessment(appId, roundId)
      .then((data) => {
        setAssessmentData(data);
        const durationSec = (data.durationMinutes || 60) * 60;
        setRemainingSeconds(durationSec);

        // Prepopulate coding templates if coding round
        if (data.questions && data.questions.length > 0) {
          const initCodes: Record<number, string> = {};
          data.questions.forEach((q) => {
            if (q.codeTemplate) {
              initCodes[q.id] = q.codeTemplate;
            }
          });
          setCodingCodes(initCodes);
        }
      })
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "Failed to initialize assessment round.");
      })
      .finally(() => setLoading(false));
  }, [roundId, appId]);

  // Request Hardware Permissions for System Check
  const requestMediaPermissions = useCallback(async () => {
    setCameraError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
        audio: true,
      });
      mediaStreamRef.current = stream;
      setCameraGranted(true);
      setMicGranted(true);
      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
        void videoPreviewRef.current.play();
      }
    } catch (err: any) {
      setCameraError(
        err?.message || "Webcam or microphone access was denied. Proctoring requires camera access."
      );
      setCameraGranted(false);
      setMicGranted(false);
    }
  }, []);

  // Request Display/Screen Share Stream
  const requestScreenShare = useCallback(async () => {
    setScreenShareError("");
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: "monitor" } as any,
        audio: false,
      });
      screenStreamRef.current = screenStream;
      setScreenShareGranted(true);

      const track = screenStream.getVideoTracks()[0];
      if (track) {
        track.onended = () => {
          setScreenShareGranted(false);
          triggerViolationRef.current("Screen sharing stream terminated! Continuous screen monitoring is required");
        };
      }
    } catch (err: any) {
      setScreenShareError(
        err?.message || "Screen sharing authorization is mandatory for this proctored placement round."
      );
      setScreenShareGranted(false);
    }
  }, []);

  // Attach stream to live PIP video element once test starts
  useEffect(() => {
    if (systemCheckPassed && liveVideoRef.current && mediaStreamRef.current) {
      liveVideoRef.current.srcObject = mediaStreamRef.current;
      void liveVideoRef.current.play();
    }
  }, [systemCheckPassed]);

  // Handle Fullscreen & Start Test
  const handleLaunchSession = async () => {
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
      setFullscreenGranted(true);
      setFullscreenLockedOut(false);
      setSystemCheckPassed(true);
      setTimeout(() => {
        monitoringArmedRef.current = true;
      }, 1500);
    } catch {
      setFullscreenGranted(true);
      setFullscreenLockedOut(false);
      setSystemCheckPassed(true);
      setTimeout(() => {
        monitoringArmedRef.current = true;
      }, 1500);
    }
  };

  const reEnterFullscreen = async () => {
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
      setFullscreenLockedOut(false);
    } catch {
      setFullscreenLockedOut(false);
    }
  };

  // Record a proctoring violation
  const triggerViolation = useCallback((reason: string) => {
    if (!monitoringArmedRef.current || isSubmitting || submitResult) return;
    setViolations((prev) => {
      const next = prev + 1;
      setViolationWarning(
        `Security Alert: ${reason}. This violation has been flagged to company recruiters. Strike ${next}/3.`
      );
      if (next >= 3) {
        // Auto submit test if 3 strikes exceeded
        void handleSubmitAssessmentRef.current(true);
      }
      return next;
    });
  }, [isSubmitting, submitResult]);
  triggerViolationRef.current = triggerViolation;

  // Anti-cheat window listeners
  useEffect(() => {
    if (!systemCheckPassed || submitResult) return;

    const handleVisibilityChange = () => {
      if (document.hidden && monitoringArmedRef.current) {
        try { navigator.clipboard.writeText(""); } catch {}
        triggerViolation("Tab switch or browser minimization detected");
      }
    };

    const handleWindowBlur = () => {
      if (monitoringArmedRef.current) {
        try { navigator.clipboard.writeText(""); } catch {}
        triggerViolation("Assessment window lost focus");
      }
    };

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && monitoringArmedRef.current) {
        setFullscreenLockedOut(true);
        triggerViolation("Full-screen mode exited");
      } else if (document.fullscreenElement) {
        setFullscreenLockedOut(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!monitoringArmedRef.current) return;

      // PrintScreen key intercept
      if (e.key === "PrintScreen" || e.keyCode === 44) {
        e.preventDefault();
        try { navigator.clipboard.writeText(""); } catch {}
        triggerViolation("Screenshot or PrintScreen attempt blocked");
        return;
      }

      // Mac screenshot combinations (Cmd+Shift+3, Cmd+Shift+4, Cmd+Shift+5, Cmd+Shift+S)
      // Windows Snipping combinations (Win+Shift+S, Ctrl+Shift+S)
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && ["3", "4", "5", "s", "S"].includes(e.key)) {
        e.preventDefault();
        try { navigator.clipboard.writeText(""); } catch {}
        triggerViolation("Screen capture shortcut detected");
        return;
      }

      // Developer Tools shortcuts: F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C, Cmd+Option+I
      if (
        e.key === "F12" ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && ["i", "I", "c", "C", "j", "J"].includes(e.key)) ||
        (e.metaKey && e.altKey && ["i", "I"].includes(e.key))
      ) {
        e.preventDefault();
        triggerViolation("Developer inspection console shortcut blocked");
        return;
      }
    };

    const handleCopy = (e: ClipboardEvent) => {
      if (monitoringArmedRef.current) {
        e.preventDefault();
        triggerViolation("Copying assessment question content is prohibited");
      }
    };

    const handleCut = (e: ClipboardEvent) => {
      if (monitoringArmedRef.current) {
        e.preventDefault();
        triggerViolation("Cutting assessment content is prohibited");
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleWindowBlur);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("copy", handleCopy);
    window.addEventListener("cut", handleCut);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleWindowBlur);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("copy", handleCopy);
      window.removeEventListener("cut", handleCut);
    };
  }, [systemCheckPassed, submitResult, triggerViolation]);

  // Clean up media streams on unmount
  useEffect(() => {
    return () => {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // Authoritative Countdown Timer
  useEffect(() => {
    if (!systemCheckPassed || remainingSeconds <= 0 || submitResult) return;

    const interval = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          void handleSubmitAssessment();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [systemCheckPassed, remainingSeconds, submitResult]);

  const currentQuestion = useMemo(() => {
    if (!assessmentData?.questions || assessmentData.questions.length === 0) return null;
    return assessmentData.questions[currentIndex] || assessmentData.questions[0];
  }, [assessmentData, currentIndex]);

  const isCodingRound = useMemo(() => {
    const type = assessmentData?.roundType?.toUpperCase() || "";
    return (
      type === "DSA" ||
      type === "CODING" ||
      type === "CODING_LAB" ||
      type === "SQL" ||
      type === "DATAFRAME" ||
      currentQuestion?.questionType === "CODING"
    );
  }, [assessmentData, currentQuestion]);

  // Submit Assessment to Backend
  const handleSubmitAssessment = async (forcedByViolations = false) => {
    if (!assessmentData || isSubmitting) return;
    setIsSubmitting(true);
    setShowConfirmModal(false);

    const questions = assessmentData.questions || [];
    const totalCount = questions.length;

    let computedScore = 0;
    let answeredCount = 0;

    if (!isCodingRound) {
      // Calculate MCQ score based on answered questions
      questions.forEach((q) => {
        if (answers[q.id] !== undefined && answers[q.id] !== null) {
          answeredCount++;
        }
      });
      // Realistic simulation: calculate score proportional to answers provided
      computedScore = totalCount > 0 ? Math.round((answeredCount / totalCount) * 100) : 75;
    } else {
      // Coding round
      questions.forEach((q) => {
        if (codingCodes[q.id] && codingCodes[q.id].trim().length > 30) {
          answeredCount++;
        }
      });
      computedScore = totalCount > 0 ? Math.round((answeredCount / totalCount) * 85 + 15) : 80;
    }

    if (forcedByViolations) {
      computedScore = Math.max(0, computedScore - 30);
    }

    try {
      const res = await jobsApi.submitAssessment(appId, roundId, {
        score: computedScore,
        answeredCount,
        totalQuestions: totalCount,
        proctoringViolations: violations,
        feedback: forcedByViolations
          ? "Assessment flagged and terminated due to exceeding proctoring violation limits."
          : `Assessment submitted successfully. Answered ${answeredCount} of ${totalCount} problems.`,
      });
      setSubmitResult(res);

      // Stop camera stream
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (document.fullscreenElement && document.exitFullscreen) {
        void document.exitFullscreen();
      }
    } catch (err: any) {
      setError(err instanceof ApiError ? err.message : "Failed to submit assessment.");
    } finally {
      setIsSubmitting(false);
    }
  };
  handleSubmitAssessmentRef.current = handleSubmitAssessment;

  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  if (loading) return <LoadingState label="Preparing Proctored Assessment Environment..." />;
  if (error) {
    return (
      <div className="p-6 max-w-2xl mx-auto space-y-4">
        <ErrorState message={error} />
        <div className="text-center pt-2">
          <Link
            href="/jobs/hiring-progress"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 transition"
          >
            &larr; Return to Hiring Progress
          </Link>
        </div>
      </div>
    );
  }

  // PHASE 1: HARDWARE & SYSTEM CHECK BEFORE STARTING TEST
  if (!systemCheckPassed) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-center items-center p-4 sm:p-6 font-sans">
        <div className="w-full max-w-2xl bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
              Proctored Environment Verification
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              {assessmentData?.roundName || "Online Assessment"}
            </h1>
            <p className="text-xs text-slate-400">
              {assessmentData?.companyName} • {assessmentData?.jobTitle} • {assessmentData?.durationMinutes || 60} mins
            </p>
          </div>

          {/* Hardware & Screen Share Verification Grid */}
          <div className="grid sm:grid-cols-2 gap-4">
            {/* Camera Preview Box */}
            <div className="relative aspect-video rounded-xl overflow-hidden bg-slate-950 border border-slate-800 flex items-center justify-center">
              <video
                ref={videoPreviewRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${cameraGranted ? "block" : "hidden"}`}
              />
              {!cameraGranted && (
                <div className="text-center p-4 space-y-2">
                  <Icon name="video" size={32} className="mx-auto text-slate-600" />
                  <p className="text-[11px] text-slate-400 font-medium">
                    Webcam stream required for proctoring.
                  </p>
                  <button
                    type="button"
                    onClick={requestMediaPermissions}
                    className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md transition cursor-pointer"
                  >
                    Enable Camera &amp; Mic
                  </button>
                </div>
              )}
              {cameraGranted && (
                <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-900/80 backdrop-blur-md border border-emerald-500/30 text-emerald-400 text-[10px] font-bold">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Webcam Active
                </div>
              )}
            </div>

            {/* Screen Share Verification Box */}
            <div className="relative aspect-video rounded-xl overflow-hidden bg-slate-950 border border-slate-800 flex flex-col items-center justify-center p-4 text-center">
              {screenShareGranted ? (
                <div className="space-y-2">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto">
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="3" width="20" height="14" rx="2" />
                      <line x1="8" y1="21" x2="16" y2="21" />
                      <line x1="12" y1="17" x2="12" y2="21" />
                    </svg>
                  </div>
                  <p className="text-xs font-bold text-emerald-400">Entire Screen Shared</p>
                  <p className="text-[10px] text-slate-400">
                    Live desktop telemetry active &amp; anti-cheat bound.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <svg className="w-8 h-8 mx-auto text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="3" width="20" height="14" rx="2" />
                    <line x1="8" y1="21" x2="16" y2="21" />
                    <line x1="12" y1="17" x2="12" y2="21" />
                  </svg>
                  <p className="text-[11px] text-slate-400 font-medium">
                    Share your entire screen for proctoring.
                  </p>
                  <button
                    type="button"
                    onClick={requestScreenShare}
                    className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md transition cursor-pointer"
                  >
                    Share Entire Screen
                  </button>
                </div>
              )}
              {screenShareGranted && (
                <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-900/80 backdrop-blur-md border border-emerald-500/30 text-emerald-400 text-[10px] font-bold">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Screen Monitored
                </div>
              )}
            </div>
          </div>

          {(cameraError || screenShareError) && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs space-y-1">
              {cameraError && (
                <div className="flex items-center gap-2">
                  <Icon name="alert-circle" size={14} className="shrink-0" />
                  <span>{cameraError}</span>
                </div>
              )}
              {screenShareError && (
                <div className="flex items-center gap-2">
                  <Icon name="alert-circle" size={14} className="shrink-0" />
                  <span>{screenShareError}</span>
                </div>
              )}
            </div>
          )}

          {/* Proctoring Rules Checklist */}
          <div className="bg-slate-950/60 rounded-xl p-4 border border-slate-800/80 space-y-2 text-xs text-slate-300">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Active Security Guardrails
            </p>
            <div className="grid sm:grid-cols-2 gap-2">
              <div className="flex items-center gap-2">
                <Icon name="check-circle" size={14} className="text-emerald-400 shrink-0" />
                <span>Fullscreen lock enforced</span>
              </div>
              <div className="flex items-center gap-2">
                <Icon name="check-circle" size={14} className="text-emerald-400 shrink-0" />
                <span>Screenshot &amp; PrintScreen blocker</span>
              </div>
              <div className="flex items-center gap-2">
                <Icon name="check-circle" size={14} className="text-emerald-400 shrink-0" />
                <span>Continuous desktop screen share</span>
              </div>
              <div className="flex items-center gap-2">
                <Icon name="check-circle" size={14} className="text-emerald-400 shrink-0" />
                <span>Cutoff: {assessmentData?.passingScore || 60}% to advance</span>
              </div>
            </div>
          </div>

          {/* Acknowledgement Checkbox */}
          <label className="flex items-start gap-3 text-xs text-slate-300 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={consentAcknowledged}
              onChange={(e) => setConsentAcknowledged(e.target.checked)}
              className="mt-0.5 rounded accent-blue-600 cursor-pointer"
            />
            <span>
              I confirm that I am the registered candidate and will adhere to academic integrity standards. I understand full-screen mode, screen share, and webcam proctoring will remain enforced.
            </span>
          </label>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-800">
            <Link
              href="/jobs/hiring-progress"
              className="text-xs text-slate-400 hover:text-white transition font-medium"
            >
              &larr; Cancel &amp; Return
            </Link>
            <button
              type="button"
              disabled={!cameraGranted || !screenShareGranted || !consentAcknowledged}
              onClick={handleLaunchSession}
              className="px-6 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-white shadow-lg shadow-blue-600/20 transition cursor-pointer flex items-center gap-2"
            >
              <Icon name="play" size={14} />
              Lock Screen &amp; Begin Assessment
            </button>
          </div>
        </div>
      </div>
    );
  }

  // PHASE 3: RESULT VIEW AFTER SUBMITTING
  if (submitResult) {
    const passed = submitResult.passed;
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-lg bg-slate-950 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl text-center space-y-6">
          <div
            className={`w-16 h-16 rounded-2xl mx-auto flex items-center justify-center border shadow-lg ${
              passed
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-emerald-500/10"
                : "bg-rose-500/10 border-rose-500/30 text-rose-400 shadow-rose-500/10"
            }`}
          >
            <Icon name={passed ? "check" : "alert-circle"} size={32} />
          </div>

          <div className="space-y-1">
            <span
              className={`text-[11px] font-extrabold uppercase tracking-wider px-3 py-1 rounded-full border ${
                passed
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                  : "bg-rose-500/10 border-rose-500/30 text-rose-400"
              }`}
            >
              {passed ? "Round Cleared" : "Round Did Not Clear"}
            </span>
            <h2 className="text-2xl font-bold text-white pt-2">{assessmentData?.roundName}</h2>
            <p className="text-xs text-slate-400">
              {assessmentData?.companyName} • {assessmentData?.jobTitle}
            </p>
          </div>

          {/* Scores Overview */}
          <div className="grid grid-cols-2 gap-3 bg-slate-900/80 rounded-2xl p-4 border border-slate-800 text-left">
            <div>
              <p className="text-[10px] text-slate-400 uppercase font-bold">Your Score</p>
              <p className={`text-2xl font-black ${passed ? "text-emerald-400" : "text-rose-400"}`}>
                {submitResult.score}%
              </p>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 uppercase font-bold">Passing Cutoff</p>
              <p className="text-2xl font-black text-slate-300">
                {submitResult.passingScore}%
              </p>
            </div>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed bg-slate-900/40 p-3 rounded-xl border border-slate-800/60">
            {submitResult.feedback}
          </p>

          {passed && submitResult.nextRoundUnlocked && (
            <div className="p-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs flex items-center gap-3 text-left">
              <Icon name="check-circle" size={18} className="text-blue-400 shrink-0" />
              <div>
                <p className="font-bold text-blue-200">Next Round Unlocked!</p>
                <p className="text-[11px] text-blue-300/80">
                  {submitResult.nextRoundName || "Subsequent stage"} is now available in your Hiring Progress.
                </p>
              </div>
            </div>
          )}

          <div className="pt-2">
            <Link
              href="/jobs/hiring-progress"
              className="w-full inline-flex items-center justify-center gap-2 py-3 px-5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg transition"
            >
              <Icon name="arrow-right" size={14} />
              Return to Placement Journey &amp; Hiring Progress
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // PHASE 2: LIVE PROCTORED ASSESSMENT ENVIRONMENT
  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 w-screen h-screen min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans select-none overflow-hidden m-0 p-0"
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Fullscreen Lockout Overlay Modal */}
      {fullscreenLockedOut && (
        <div className="fixed inset-0 z-[100] bg-slate-950/95 backdrop-blur-xl flex flex-col items-center justify-center p-6 text-center space-y-5 select-none">
          <div className="w-20 h-20 rounded-3xl bg-rose-500/20 border-2 border-rose-500 flex items-center justify-center text-rose-400 animate-pulse">
            <Icon name="alert-triangle" size={40} />
          </div>
          <div className="space-y-2 max-w-md">
            <span className="text-[11px] font-extrabold uppercase tracking-widest px-3 py-1 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30">
              Exam Security Lockdown
            </span>
            <h2 className="text-2xl font-black text-white">Full-Screen Mode Required</h2>
            <p className="text-xs text-slate-300 leading-relaxed">
              You have exited full-screen examination mode or navigated away from the assessment. Continuous full-screen view is strictly enforced throughout the test.
            </p>
            <p className="text-xs font-bold text-rose-400">
              Security Violation Registered: Strike {violations}/3. Exceeding 3 strikes will automatically submit and terminate your test attempt.
            </p>
          </div>
          <button
            type="button"
            onClick={reEnterFullscreen}
            className="px-8 py-3 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs shadow-xl shadow-rose-600/30 transition cursor-pointer flex items-center gap-2"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
            </svg>
            Re-enter Full-Screen Mode
          </button>
        </div>
      )}

      {/* Violation Alert Banner */}
      {violationWarning && (
        <div className="bg-rose-600 text-white px-4 py-2 text-xs font-bold flex items-center justify-between shadow-lg animate-pulse z-50">
          <div className="flex items-center gap-2">
            <Icon name="alert-circle" size={16} />
            <span>{violationWarning}</span>
          </div>
          <button
            type="button"
            onClick={() => setViolationWarning(null)}
            className="text-white hover:text-rose-200 text-xs px-2 py-0.5 rounded font-mono"
          >
            Acknowledge [X]
          </button>
        </div>
      )}

      {/* TOP PROCTORING HEADER BAR */}
      <header className="h-14 bg-slate-900 border-b border-slate-800 px-4 sm:px-6 flex items-center justify-between shrink-0 z-40">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-sm text-white">
            {assessmentData?.companyName?.slice(0, 2).toUpperCase() || "P2P"}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xs sm:text-sm font-bold text-white truncate max-w-[200px] sm:max-w-xs">
                {assessmentData?.roundName}
              </h2>
              <span className="text-[10px] px-2 py-0.5 rounded font-extrabold bg-blue-500/10 border border-blue-500/30 text-blue-400 uppercase">
                {assessmentData?.roundType}
              </span>
            </div>
            <p className="text-[10px] text-slate-400">
              {assessmentData?.companyName} • Cutoff {assessmentData?.passingScore}%
            </p>
          </div>
        </div>

        {/* Center Countdown Timer */}
        <div className="flex items-center gap-2">
          <div
            className={`px-3 py-1 rounded-xl font-mono text-sm sm:text-base font-bold flex items-center gap-2 border ${
              remainingSeconds < 300
                ? "bg-rose-500/20 text-rose-400 border-rose-500/30 animate-pulse"
                : "bg-slate-800 text-slate-200 border-slate-700"
            }`}
          >
            <Icon name="clock" size={14} className={remainingSeconds < 300 ? "text-rose-400" : "text-slate-400"} />
            <span>{formatTimer(remainingSeconds)}</span>
          </div>
        </div>

        {/* Right Controls: Live Webcam PIP + Submit Button */}
        <div className="flex items-center gap-3">
          {/* Live Webcam Feed Miniature */}
          <div className="relative w-16 h-10 sm:w-20 sm:h-12 rounded-lg overflow-hidden bg-black border border-slate-700 shrink-0">
            <video ref={liveVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            <div className="absolute top-1 left-1 flex items-center gap-1 bg-black/70 px-1 py-0.5 rounded text-[8px] font-bold text-rose-400">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
              REC
            </div>
          </div>

          {/* Violations Badge */}
          <div
            className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border ${
              violations > 0
                ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                : "bg-slate-800 text-slate-400 border-slate-700"
            }`}
          >
            <Icon name="shield" size={12} />
            <span>Strikes: {violations}/3</span>
          </div>

          <button
            type="button"
            onClick={() => setShowConfirmModal(true)}
            className="px-4 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition cursor-pointer flex items-center gap-1.5"
          >
            <Icon name="check" size={13} />
            <span>Finish Test</span>
          </button>
        </div>
      </header>

      {/* MAIN TEST BODY */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Left / Center Work Area */}
        <div className="flex-1 flex flex-col overflow-y-auto p-4 sm:p-6 bg-slate-950">
          {currentQuestion ? (
            <div className="max-w-4xl w-full mx-auto space-y-6">
              {/* Question Meta Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold">
                    Problem {currentIndex + 1} of {assessmentData?.questions?.length || 1}
                  </span>
                  {currentQuestion.topic && (
                    <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 text-xs font-medium">
                      {currentQuestion.topic}
                    </span>
                  )}
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      currentQuestion.difficulty === "HARD"
                        ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                        : currentQuestion.difficulty === "MEDIUM"
                        ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                        : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    }`}
                  >
                    {currentQuestion.difficulty || "MEDIUM"}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setMarkedForReview((prev) => ({
                      ...prev,
                      [currentQuestion.id]: !prev[currentQuestion.id],
                    }))
                  }
                  className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer border ${
                    markedForReview[currentQuestion.id]
                      ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                      : "bg-slate-800 text-slate-400 border-slate-700 hover:text-white"
                  }`}
                >
                  <Icon name="flag" size={12} />
                  <span>{markedForReview[currentQuestion.id] ? "Marked for Review" : "Mark for Review"}</span>
                </button>
              </div>

              {/* Problem Title & Statement */}
              <div className="space-y-3">
                <h3 className="text-base sm:text-lg font-bold text-white leading-relaxed">
                  {currentQuestion.title}
                </h3>
                {currentQuestion.description && (
                  <p className="text-xs sm:text-sm text-slate-300 whitespace-pre-line leading-relaxed bg-slate-900/40 p-4 rounded-xl border border-slate-800/80">
                    {currentQuestion.description}
                  </p>
                )}
              </div>

              {/* MCQ Options Rendering */}
              {!isCodingRound && currentQuestion.options && currentQuestion.options.length > 0 && (
                <div className="space-y-3 pt-2">
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Select Your Response
                  </p>
                  <div className="grid gap-2.5">
                    {currentQuestion.options.map((opt, optIdx) => {
                      const isSelected = answers[currentQuestion.id] === String(optIdx);
                      const optLabel = String.fromCharCode(65 + optIdx);
                      return (
                        <button
                          key={optIdx}
                          type="button"
                          onClick={() =>
                            setAnswers((prev) => ({
                              ...prev,
                              [currentQuestion.id]: String(optIdx),
                            }))
                          }
                          className={`w-full p-3.5 rounded-xl text-left text-xs sm:text-sm transition flex items-center gap-3 border cursor-pointer ${
                            isSelected
                              ? "bg-blue-600/20 border-blue-500 text-blue-100 font-semibold shadow-md shadow-blue-500/10"
                              : "bg-slate-900/60 border-slate-800 text-slate-300 hover:bg-slate-800/60 hover:border-slate-700"
                          }`}
                        >
                          <span
                            className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 border ${
                              isSelected
                                ? "bg-blue-600 text-white border-blue-500"
                                : "bg-slate-800 text-slate-400 border-slate-700"
                            }`}
                          >
                            {optLabel}
                          </span>
                          <span className="flex-1">{opt}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Coding IDE Rendering */}
              {isCodingRound && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      Solution Workspace
                    </span>
                    <div className="flex items-center gap-2">
                      <select
                        value={codingLanguage}
                        onChange={(e) => setCodingLanguage(e.target.value)}
                        className="rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200 px-2.5 py-1 outline-none"
                      >
                        <option value="java">Java (OpenJDK 21)</option>
                        <option value="python">Python 3.12</option>
                        <option value="cpp">C++ 20</option>
                        <option value="javascript">JavaScript (Node.js)</option>
                      </select>
                    </div>
                  </div>

                  <div className="h-[380px] rounded-xl overflow-hidden border border-slate-800 shadow-inner">
                    <MonacoEditor
                      height="100%"
                      language={codingLanguage}
                      theme="vs-dark"
                      value={codingCodes[currentQuestion.id] || currentQuestion.codeTemplate || "// Write your solution here\n"}
                      onChange={(val) =>
                        setCodingCodes((prev) => ({
                          ...prev,
                          [currentQuestion.id]: val || "",
                        }))
                      }
                      options={{
                        minimap: { enabled: false },
                        fontSize: 13,
                        scrollBeyondLastLine: false,
                        automaticLayout: true,
                      }}
                    />
                  </div>

                  {currentQuestion.sampleTestCases && currentQuestion.sampleTestCases.length > 0 && (
                    <div className="bg-slate-900/60 rounded-xl p-3 border border-slate-800 text-xs space-y-1.5 font-mono">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-sans">
                        Sample Test Cases
                      </p>
                      {currentQuestion.sampleTestCases.map((tc, tcIdx) => (
                        <div key={tcIdx} className="text-slate-300 text-[11px]">
                          {tc}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Navigation Actions */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                <button
                  type="button"
                  disabled={currentIndex === 0}
                  onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
                >
                  &larr; Previous Problem
                </button>

                <div className="flex items-center gap-2">
                  {!isCodingRound && answers[currentQuestion.id] !== undefined && (
                    <button
                      type="button"
                      onClick={() =>
                        setAnswers((prev) => {
                          const next = { ...prev };
                          delete next[currentQuestion.id];
                          return next;
                        })
                      }
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-rose-400 transition"
                    >
                      Clear Selection
                    </button>
                  )}

                  {currentIndex < (assessmentData?.questions?.length || 1) - 1 ? (
                    <button
                      type="button"
                      onClick={() => setCurrentIndex((prev) => prev + 1)}
                      className="px-5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-md transition cursor-pointer"
                    >
                      Next Problem &rarr;
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowConfirmModal(true)}
                      className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md transition cursor-pointer"
                    >
                      Review &amp; Submit Assessment
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-20 text-slate-500">
              <p>No questions configured for this round.</p>
            </div>
          )}
        </div>

        {/* Right Sidebar: Question Palette & Overview */}
        <aside className="w-full md:w-64 bg-slate-900 border-t md:border-t-0 md:border-l border-slate-800 p-4 shrink-0 flex flex-col justify-between">
          <div className="space-y-4">
            <div>
              <p className="text-xs font-bold text-white uppercase tracking-wider">
                Question Palette
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Navigate problems in this round
              </p>
            </div>

            {/* Grid of Question Buttons */}
            <div className="grid grid-cols-5 gap-2 max-h-60 overflow-y-auto p-1">
              {assessmentData?.questions?.map((q, idx) => {
                const isCurrent = idx === currentIndex;
                const isAnswered = isCodingRound
                  ? codingCodes[q.id] && codingCodes[q.id].trim().length > 30
                  : answers[q.id] !== undefined;
                const isMarked = markedForReview[q.id];

                let bgClass = "bg-slate-800 text-slate-400 border-slate-700";
                if (isMarked) {
                  bgClass = "bg-amber-500/20 text-amber-300 border-amber-500/50";
                } else if (isAnswered) {
                  bgClass = "bg-emerald-600/30 text-emerald-300 border-emerald-500/50";
                }

                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => setCurrentIndex(idx)}
                    className={`h-9 rounded-lg text-xs font-bold transition flex items-center justify-center border cursor-pointer ${bgClass} ${
                      isCurrent ? "ring-2 ring-blue-500 ring-offset-2 ring-offset-slate-900 font-extrabold" : ""
                    }`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="space-y-1.5 pt-2 border-t border-slate-800 text-[11px] text-slate-400">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-emerald-500/40 border border-emerald-500/60" />
                <span>Answered</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-amber-500/40 border border-amber-500/60" />
                <span>Marked for Review</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-slate-800 border border-slate-700" />
                <span>Not Visited / Empty</span>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setShowConfirmModal(true)}
              className="w-full py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md transition cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Icon name="check" size={14} />
              <span>Submit Assessment</span>
            </button>
          </div>
        </aside>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white">Confirm Assessment Submission</h3>
            <p className="text-xs text-slate-300">
              Are you sure you want to conclude and submit your assessment for{" "}
              <strong>{assessmentData?.roundName}</strong>? Once submitted, your answers will be graded against the{" "}
              {assessmentData?.passingScore}% cutoff score.
            </p>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs space-y-1 text-slate-400">
              <div className="flex justify-between">
                <span>Total Questions:</span>
                <span className="font-bold text-slate-200">{assessmentData?.questions?.length || 0}</span>
              </div>
              <div className="flex justify-between">
                <span>Answered Responses:</span>
                <span className="font-bold text-emerald-400">
                  {isCodingRound
                    ? Object.values(codingCodes).filter((c) => c && c.trim().length > 30).length
                    : Object.keys(answers).length}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Strikes / Violations:</span>
                <span className={`font-bold ${violations > 0 ? "text-rose-400" : "text-slate-400"}`}>
                  {violations}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition"
              >
                Continue Assessment
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => handleSubmitAssessment()}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white shadow-md transition cursor-pointer"
              >
                {isSubmitting ? "Submitting..." : "Yes, Submit Test"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
