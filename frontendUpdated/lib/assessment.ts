import { api } from "@/lib/api";

export type AssessmentType = "CODING_MOCK_TEST" | "APTITUDE_MOCK_TEST" | "AI_INTERVIEW";
export type AttemptStatus = "NOT_STARTED" | "IN_PROGRESS" | "PAUSED" | "SUBMITTED" | "AUTO_SUBMITTED" | "TERMINATED" | "TAB_SWITCH_TERMINATED" | "AUTO_SUBMITTED_TAB_SWITCH" | "LOCKED";

export interface AssessmentProfile {
  id: number;
  name: string;
  assessmentType: AssessmentType;
  companyName: string | null;
  durationMinutes: number;
  questionCount: number;
  difficultyDistribution: Record<string, number>;
  allowedLanguages: string[] | null;
  cameraRequired: boolean;
  microphoneRequired: boolean;
  screenShareRequired: boolean;
  fullscreenRequired: boolean;
  allowCopy: boolean;
  allowPaste: boolean;
  allowContextMenu: boolean;
  tabSwitchPolicy: "IGNORE" | "WARN" | "TERMINATE";
  active: boolean;
}

export interface AttemptView {
  id: number;
  assessmentType: AssessmentType;
  status: AttemptStatus;
  selectedQuestionIds: number[];
  answerState: Record<string, unknown>;
  languageState: Record<string, string>;
  configSnapshot: Record<string, unknown>;
  startedAt: string;
  serverExpiresAt: string;
  remainingSeconds: number;
  violationCount: number;
  integrityScore: number;
  terminationReason: string | null;
}

export type IntegrityEventType =
  | "TAB_SWITCH" | "WINDOW_BLUR" | "FULLSCREEN_EXIT" | "COPY_ATTEMPT" | "PASTE_ATTEMPT"
  | "CONTEXT_MENU_ATTEMPT" | "SCREEN_CHANGE_ATTEMPT" | "CAMERA_BLOCKED" | "MICROPHONE_BLOCKED"
  | "FACE_NOT_DETECTED" | "MULTIPLE_FACES" | "LOOKING_AWAY" | "POSTURE_ISSUE"
  | "POTENTIAL_EXTERNAL_REFERENCE" | "SUSPICIOUS_KEYBOARD_ACTIVITY" | "INACTIVITY"
  | "TIME_EXPIRATION" | "TEST_TERMINATED" | "DEVTOOLS_ATTEMPT" | "BACK_NAVIGATION_ATTEMPT";

export interface IntegrityEventView {
  id: number;
  eventType: IntegrityEventType;
  classification: string;
  occurredAt: string;
  durationSeconds: number | null;
  severity: number;
  confidenceScore: number | null;
  details: string | null;
  evidenceAvailable: boolean;
  evidenceRef: string | null;
  evidenceUnavailableReason: string | null;
  /** Universal anti-cheat (Section 6): true when this event terminated the attempt server-side
   *  regardless of what the frontend expected - this is the authoritative signal to lock the UI. */
  contributedToTermination: boolean;
}

export async function listProfiles(type?: AssessmentType): Promise<AssessmentProfile[]> {
  return api.get<AssessmentProfile[]>(`/api/assessments/profiles${type ? `?type=${type}` : ""}`);
}

export async function startAttempt(profileId: number): Promise<AttemptView> {
  return api.post<AttemptView>("/api/assessments/start", { profileId });
}

export async function getAttempt(attemptId: number | string): Promise<AttemptView> {
  return api.get<AttemptView>(`/api/assessments/${attemptId}`);
}

export async function submitAttempt(attemptId: number | string): Promise<AttemptView> {
  return api.post<AttemptView>(`/api/assessments/${attemptId}/submit`);
}

/** Reports a violation and lets the server decide whether it terminates the attempt (it always
 *  does, server-side - see ViolationPolicyService). Never throws into the caller's UI flow;
 *  failing to log a violation should not itself crash the test. */
export async function reportViolation(
  attemptId: number | string,
  eventType: IntegrityEventType,
  opts?: { durationSeconds?: number; confidenceScore?: number; details?: string; evidenceAvailable?: boolean; evidenceRef?: string; evidenceUnavailableReason?: string }
): Promise<IntegrityEventView | null> {
  try {
    return await api.post<IntegrityEventView>(`/api/assessments/${attemptId}/violations`, {
      eventType,
      durationSeconds: opts?.durationSeconds,
      confidenceScore: opts?.confidenceScore,
      details: opts?.details,
      evidenceAvailable: opts?.evidenceAvailable ?? false,
      evidenceRef: opts?.evidenceRef,
      evidenceUnavailableReason: opts?.evidenceUnavailableReason,
    });
  } catch {
    return null;
  }
}

export async function terminateAttempt(attemptId: number | string, reason: string = "TAB_SWITCH") {
  return api.post<{ status: AttemptStatus; reason: string; terminatedAt: string | null }>(`/api/assessments/${attemptId}/terminate`, { reason });
}
