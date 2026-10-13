import { api } from "./api";

export type ProctoringEventType =
  | "TAB_SWITCH" | "WINDOW_BLUR" | "FULLSCREEN_EXIT" | "COPY_PASTE_ATTEMPT"
  | "RIGHT_CLICK" | "DEVTOOLS_OPENED" | "FILLER_WORDS" | "POSTURE_DRIFT"
  | "MOVEMENT_DETECTED" | "SCREEN_SHARE_START" | "SCREEN_SHARE_STOP"
  | "AUDIO_MUTED" | "CONTEXT_MISMATCH" | "SUSPICIOUS_FRAME"
  | "MULTIPLE_FACES" | "NO_FACE_DETECTED" | "SUSPICIOUS_OBJECT" | "MULTIPLE_VOICES"
  | "EYE_ROAMING" | "READING_DETECTED" | "SCREENSHOT_ATTEMPT" | "SESSION_TERMINATED" | "BACK_NAVIGATION_ATTEMPT"
  | "UNAUTHORIZED_SCREEN_SHARE_DETECTED" | "UNAUTHORIZED_SECOND_SHARE" | "POTENTIAL_DISPLAY_CAPTURE" | "EXTENSION_CAPTURE_API_PRESENT"
  | "FORMAL_DRESS_NOT_DETECTED";

export type EvidenceSource = "WEBCAM" | "SCREEN";

export interface ProctoringEventResponse {
  id: number;
  eventType: ProctoringEventType;
  details: string | null;
  occurredAt: string;
  severity: number;
  durationSeconds: number | null;
  confidenceScore: number | null;
  evidenceAvailable: boolean;
  evidenceUrl: string | null;
  evidenceUnavailableReason: string | null;
  evidenceSource: EvidenceSource | null;
  /** Universal anti-cheat (Section 6): true when this event caused the session to be
   *  auto-terminated. The caller must lock the UI immediately when this is true. */
  sessionTerminated: boolean;
  terminationReason: string | null;
}

export type IncidentSeverity = 1 | 2 | 3;

function severityFor(eventType: ProctoringEventType): IncidentSeverity {
  switch (eventType) {
    case "UNAUTHORIZED_SCREEN_SHARE_DETECTED":
    case "UNAUTHORIZED_SECOND_SHARE":
    case "POTENTIAL_DISPLAY_CAPTURE":
    case "EXTENSION_CAPTURE_API_PRESENT":
    case "SESSION_TERMINATED":
    case "SUSPICIOUS_FRAME":
    case "SUSPICIOUS_OBJECT":
      return 3;
    case "TAB_SWITCH":
    case "WINDOW_BLUR":
    case "FULLSCREEN_EXIT":
    case "COPY_PASTE_ATTEMPT":
    case "RIGHT_CLICK":
    case "DEVTOOLS_OPENED":
    case "SCREENSHOT_ATTEMPT":
    case "BACK_NAVIGATION_ATTEMPT":
    case "MULTIPLE_FACES":
    case "NO_FACE_DETECTED":
    case "EYE_ROAMING":
      return 2;
    default:
      return 1;
  }
}

/** Standalone incident endpoint — session-agnostic JSON payload; works for both interview
 *  session IDs and mock test attempt IDs. Backed by ProctoringIncident entity with 5-second
 *  dedup window, so callers can safely log the same event from multiple hooks without
 *  creating duplicates. */
export async function logProctoringIncident(
  sessionId: string | number,
  type: string,
  details?: string,
  severity?: IncidentSeverity
): Promise<void> {
  try {
    await api.post<void>("/api/proctoring/incidents", {
      sessionId: String(sessionId),
      type,
      details,
      severity: severity ?? severityFor(type as ProctoringEventType),
    });
  } catch {
    // fire-and-forget; never surface logging errors to the UX
  }
}

/** Single event-logging call — always multipart, so an event and its evidence (when captured)
 *  are written together server-side and can never end up linked incorrectly or out of sync.
 *
 *  Additionally dual-writes a simplified row to the standalone `/api/proctoring/incidents`
 *  endpoint (ProctoringIncident table), which the Admin Reports Hub /proctoring-incidents
 *  list queries — ensuring incidents from both interview and mock-test contexts surface in
 *  the admin console regardless of which session type triggered them. */
export async function logProctoringEvent(
  sessionId: string | number,
  eventType: ProctoringEventType,
  details?: string,
  evidenceBlob?: Blob | null,
  options?: { durationSeconds?: number; source?: EvidenceSource; evidenceUnavailableReason?: string }
): Promise<ProctoringEventResponse | null> {
  void logProctoringIncident(sessionId, eventType, details);
  try {
    const form = new FormData();
    form.append("eventType", eventType);
    if (details) form.append("details", details);
    if (options?.durationSeconds != null) form.append("durationSeconds", String(options.durationSeconds));
    if (options?.source) form.append("source", options.source);
    if (evidenceBlob) {
      form.append("file", evidenceBlob, "evidence.jpg");
    } else {
      form.append(
        "evidenceUnavailableReason",
        options?.evidenceUnavailableReason || "No camera frame available at detection time"
      );
    }
    return await api.postForm<ProctoringEventResponse>(`/api/interviews/${sessionId}/proctoring/events`, form);
  } catch {
    // Never let a logging failure interrupt the interview itself.
    return null;
  }
}

export interface FrameAnalysis {
  faceCount: number;
  multipleFacesDetected: boolean;
  noFaceDetected: boolean;
  suspiciousObjectDetected: boolean;
  eyeRoamingDetected: boolean;
  postureDriftDetected: boolean;
  readingDetected: boolean;
  currentIntegrityScore: number;
  formalAttireDetected?: boolean;
  attireType?: string;
  attireScore?: number;
}

export async function submitProctoringFrame(sessionId: string | number, blob: Blob): Promise<FrameAnalysis | null> {
  try {
    const form = new FormData();
    form.append("file", blob, "frame.jpg");
    return await api.postForm<FrameAnalysis>(`/api/interviews/${sessionId}/proctoring/frame`, form);
  } catch {
    return null;
  }
}

export async function requestFullscreen(el: Element) {
  try {
    if (el.requestFullscreen) await el.requestFullscreen();
  } catch {
    // Fullscreen can be denied by the browser/user — the guard still tracks exits below.
  }
}

export function isFullscreen(): boolean {
  return document.fullscreenElement != null;
}

export async function captureFrameFromVideo(video: HTMLVideoElement): Promise<Blob | null> {
  if (!video.videoWidth || !video.videoHeight) return null;
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0);
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/jpeg", 0.8));
}

const authorizedStreamIds = new Set<string>();
export function registerAuthorizedStream(stream: MediaStream) {
  authorizedStreamIds.add(stream.id);
}

if (typeof window !== "undefined" && window.navigator && window.navigator.mediaDevices) {
  const originalGetDisplayMedia = window.navigator.mediaDevices.getDisplayMedia;
  if (originalGetDisplayMedia) {
    window.navigator.mediaDevices.getDisplayMedia = async function (options) {
      const stream = await originalGetDisplayMedia.call(window.navigator.mediaDevices, options);
      
      setTimeout(() => {
        if (!authorizedStreamIds.has(stream.id)) {
          window.dispatchEvent(new CustomEvent("proctoring-violation", { 
            detail: { eventType: "UNAUTHORIZED_SCREEN_SHARE_DETECTED", details: "An unauthorized screen share was initiated." }
          }));
        } else if (authorizedStreamIds.size > 1) {
          window.dispatchEvent(new CustomEvent("proctoring-violation", { 
            detail: { eventType: "UNAUTHORIZED_SECOND_SHARE", details: "A second screen share was initiated." }
          }));
        }
      }, 50);
      
      return stream;
    };
    
    Object.defineProperty(window.navigator.mediaDevices, 'getDisplayMedia', {
      writable: false,
      configurable: false
    });
  }

  window.navigator.mediaDevices.addEventListener("devicechange", async () => {
    try {
      const devices = await window.navigator.mediaDevices.enumerateDevices();
      const hasDisplay = devices.some(d => d.label.toLowerCase().includes("screen") || d.label.toLowerCase().includes("display"));
      if (hasDisplay) {
        window.dispatchEvent(new CustomEvent("proctoring-violation", { 
          detail: { eventType: "POTENTIAL_DISPLAY_CAPTURE", details: "A potential display capture device was detected." }
        }));
      }
    } catch {}
  });

  setTimeout(() => {
    const hasChromeExtension = typeof (window as any).chrome !== "undefined" && 
                               (typeof (window as any).chrome.tabCapture !== "undefined" || 
                                typeof (window as any).chrome.desktopCapture !== "undefined");
    if (hasChromeExtension) {
      window.dispatchEvent(new CustomEvent("proctoring-violation", { 
        detail: { eventType: "EXTENSION_CAPTURE_API_PRESENT", details: "Screen capture extension API detected." }
      }));
    }
  }, 1000);
}

export interface ScreenShareResult {
  stream: MediaStream | null;
  error?: string;
}

let activeScreenStream: MediaStream | null = null;

export function getActiveScreenStream(): MediaStream | null {
  if (activeScreenStream) {
    const tracks = activeScreenStream.getVideoTracks();
    if (tracks.some((t) => t.readyState === "live")) {
      return activeScreenStream;
    }
    activeScreenStream = null;
  }
  return null;
}

export function clearActiveScreenStream() {
  activeScreenStream = null;
}

export async function requestScreenShare(): Promise<ScreenShareResult> {
  try {
    const displayMediaOptions: DisplayMediaStreamOptions = {
      video: {
        displaySurface: "monitor",
        frameRate: 15,
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      } as any,
      audio: false,
    };

    const stream = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions);
    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack || videoTrack.readyState !== "live") {
      stream.getTracks().forEach((t) => t.stop());
      return { stream: null, error: "Screen share track is not active. Please select an active display." };
    }

    // Proctoring integrity enforcement: candidate MUST share entire display/monitor, NOT a single window or tab
    const settings = videoTrack.getSettings() as any;
    const surface = settings?.displaySurface;
    if (surface && surface !== "monitor") {
      stream.getTracks().forEach((t) => t.stop());
      return {
        stream: null,
        error: "Entire Screen required: You selected a single window or browser tab. To prevent malpractice, proctoring requires sharing your Entire Screen (Desktop). Please select 'Entire Screen' in the prompt.",
      };
    }

    registerAuthorizedStream(stream);
    activeScreenStream = stream;
    videoTrack.addEventListener("ended", () => {
      if (activeScreenStream === stream) {
        activeScreenStream = null;
      }
    });
    return { stream };
  } catch (e) {
    return { stream: null, error: e instanceof Error ? e.message : "Screen share denied" };
  }
}

export async function captureFrameFromScreen(video: HTMLVideoElement): Promise<Blob | null> {
  return captureFrameFromVideo(video);
}

export interface FillerWordDetectionState {
  analyser: AnalyserNode | null;
  audioContext: AudioContext | null;
  mediaStream: MediaStream | null;
  sourceNode: MediaStreamAudioSourceNode | null;
  fillerCount: number;
  lastFillerTime: number;
}

export function createFillerWordDetector(): FillerWordDetectionState {
  return {
    analyser: null,
    audioContext: null,
    mediaStream: null,
    sourceNode: null,
    fillerCount: 0,
    lastFillerTime: 0,
  };
}

export async function startFillerWordDetection(
  state: FillerWordDetectionState,
  onFillerDetected: (count: number) => void,
  onAudioAnomaly?: (type: "NOISE" | "SECONDARY_VOICE", details: string) => void
): Promise<{ started: boolean; error?: string }> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    state.mediaStream = stream;

    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    state.audioContext = new AudioCtx();
    state.sourceNode = state.audioContext.createMediaStreamSource(stream);
    state.analyser = state.audioContext.createAnalyser();
    state.analyser.fftSize = 1024;
    state.analyser.smoothingTimeConstant = 0.4;
    state.sourceNode.connect(state.analyser);

    const bufferLength = state.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    let silenceFrames = 0;
    let activeFrames = 0;
    let lastActivePitchAverage = 0;
    let lastAnomalyTime = 0;
    let continuousHighEnergyFrames = 0;
    const MIN_FILLER_GAP_MS = 600;
    const MIN_ANOMALY_GAP_MS = 12000;

    const detectLoop = () => {
      if (!state.analyser) return;
      state.analyser.getByteFrequencyData(dataArray);

      let sum = 0;
      let highFreqSum = 0;
      let lowFreqSum = 0;
      const startBand = Math.floor(bufferLength * 0.05);
      const vocalLowBand = Math.floor(bufferLength * 0.15);
      const midBand = Math.floor(bufferLength * 0.5);
      const highBand = Math.floor(bufferLength * 0.85);

      for (let i = startBand; i < vocalLowBand; i++) lowFreqSum += dataArray[i];
      for (let i = vocalLowBand; i < midBand; i++) sum += dataArray[i];
      for (let i = midBand; i < highBand; i++) highFreqSum += dataArray[i];

      const avgVol = sum / (midBand - vocalLowBand);
      const avgLow = lowFreqSum / (vocalLowBand - startBand);
      const avgHighFreq = highFreqSum / (highBand - midBand);
      const volThreshold = 35;
      const now = Date.now();

      // Audio anomaly detection: persistent ambient noise or secondary speaker harmonics
      if (avgLow > 55 && avgHighFreq > 40 && avgVol > 40) {
        continuousHighEnergyFrames++;
        if (continuousHighEnergyFrames > 120 && now - lastAnomalyTime > MIN_ANOMALY_GAP_MS) {
          lastAnomalyTime = now;
          onAudioAnomaly?.("NOISE", "Significant ambient background noise detected");
        }
      } else {
        continuousHighEnergyFrames = Math.max(0, continuousHighEnergyFrames - 2);
      }

      // Secondary speaker detection: dual energy peaks in vocal band during speech
      if (avgVol > 45 && avgHighFreq > 35 && avgLow > 40) {
        if (now - lastAnomalyTime > MIN_ANOMALY_GAP_MS) {
          lastAnomalyTime = now;
          onAudioAnomaly?.("SECONDARY_VOICE", "Secondary speaker or background voice detected");
        }
      }

      if (avgVol > volThreshold) {
        activeFrames++;
        silenceFrames = 0;
        lastActivePitchAverage = avgHighFreq / (avgVol + 1);
      } else {
        silenceFrames++;
        if (activeFrames >= 2 && activeFrames <= 9 && now - state.lastFillerTime > MIN_FILLER_GAP_MS) {
          const spikeRatio = lastActivePitchAverage;
          if (spikeRatio > 0.15 && spikeRatio < 2.5) {
            state.fillerCount++;
            state.lastFillerTime = now;
            onFillerDetected(state.fillerCount);
          }
        }
        activeFrames = 0;
      }

      requestAnimationFrame(detectLoop);
    };

    detectLoop();
    return { started: true };
  } catch (e) {
    return { started: false, error: e instanceof Error ? e.message : "Mic access denied" };
  }
}

export function stopFillerWordDetection(state: FillerWordDetectionState) {
  try {
    state.mediaStream?.getTracks().forEach((t) => t.stop());
    state.audioContext?.close();
  } catch {
    // ignore cleanup errors
  }
  state.analyser = null;
  state.audioContext = null;
  state.mediaStream = null;
  state.sourceNode = null;
}

export function isAudioStreamActive(state: FillerWordDetectionState): boolean {
  return state.mediaStream != null && state.mediaStream.getAudioTracks().some((t) => t.readyState === "live");
}

export interface PreInterviewCheckRequest {
  camera: boolean;
  microphone: boolean;
  screenShare: boolean;
  tabMonitoring: boolean;
  backgroundCheck: boolean;
  formalDressCheck: boolean;
  faceDetection: boolean;
  identityCheck: boolean;
  formalDressConfidence?: number;
  formalDressClassification?: string;
}

export interface PreInterviewCheckResponse {
  proctoringStatus: string;
  camera: boolean;
  microphone: boolean;
  screenShare: boolean;
  tabMonitoring: boolean;
  backgroundCheck: boolean;
  formalDressCheck: boolean;
  faceDetection: boolean;
  identityCheck: boolean;
  proctoringCompleted: boolean;
  message: string;
}

export interface DressAnalysisResult {
  classification: "FORMAL" | "CASUAL" | "UNCERTAIN" | "NO_PERSON";
  confidence: number;
  message: string;
  passed: boolean;
  totalFramesAnalyzed: number;
  formalFramesCount: number;
  casualFramesCount: number;
}

export async function verifyPreInterviewProtocol(
  sessionId: string | number,
  checklist: PreInterviewCheckRequest
): Promise<PreInterviewCheckResponse> {
  return api.post<PreInterviewCheckResponse>(`/api/interviews/${sessionId}/proctoring/verify-protocol`, checklist);
}

export async function verifyDressFrames(
  sessionId: string | number,
  frameBlobs: Blob[]
): Promise<DressAnalysisResult> {
  const form = new FormData();
  frameBlobs.forEach((blob, idx) => {
    form.append("files", blob, `frame_${idx}.jpg`);
  });
  return api.post<DressAnalysisResult>(`/api/interviews/${sessionId}/proctoring/verify-dress`, form);
}

export async function getPreInterviewStatus(sessionId: string | number): Promise<PreInterviewCheckResponse> {
  return api.get<PreInterviewCheckResponse>(`/api/interviews/${sessionId}/proctoring/status`);
}
