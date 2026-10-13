import { api } from "@/lib/api";
import { adminApi } from "@/lib/adminApi";

export type CodingType = "BACKEND" | "FRONTEND" | "MACHINE_LEARNING" | "AI" | "GENERATIVE_AI" | "RAG";
export type CodingDifficulty = "EASY" | "MEDIUM" | "HARD";
export type CodingAssessmentStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";
export type CodingAttemptStatus = "STARTED" | "COMPLETED" | "ABANDONED" | "EXPIRED";
export type CodingSubmissionKind = "RUN" | "SUBMIT";
export type CodingSubmissionStatus = "SUCCESS" | "FAILED" | "COMPILATION_ERROR" | "RUNTIME_ERROR" | "TIMEOUT";
export type AiHintClassification = "ALLOWED_HINT" | "RESTRICTED_SOLVE_REQUEST";
export type AiHintResponseType = "HINT" | "ERROR_EXPLANATION" | "REFUSAL" | "LIMIT_REACHED";

export interface AssessmentSummary {
  id: number;
  title: string;
  description: string | null;
  codingType: CodingType;
  difficulty: CodingDifficulty;
  technology: string | null;
  timeLimitMinutes: number;
  maxScore: number;
  aiAssistantEnabled: boolean;
}

export interface WorkspaceView {
  attemptId: number;
  assessmentId: number;
  title: string;
  codingType: CodingType;
  description: string | null;
  language: string;
  files: Record<string, string>;
  publicTestFiles: Record<string, string>;
  status: CodingAttemptStatus;
  startedAt: string | null;
  expiresAt: string | null;
  bestScore: number;
  aiHintsUsed: number;
  aiHintsRemaining: number;
}

export interface SubmissionResult {
  submissionId: number | null;
  kind: CodingSubmissionKind;
  status: CodingSubmissionStatus;
  runtimeMs: number;
  memoryMb: number;
  testsTotal: number;
  testsPassed: number;
  testsFailed: number;
  score: number;
  compilationError: string | null;
  runtimeError: string | null;
  publicOutput: string | null;
  submittedAt: string | null;
}

export interface AttemptHistory {
  attemptId: number;
  assessmentId: number;
  title: string;
  codingType: CodingType;
  status: CodingAttemptStatus;
  bestScore: number;
  startedAt: string | null;
  completedAt: string | null;
}

export interface HintResponseView {
  classification: AiHintClassification;
  responseType: AiHintResponseType;
  text: string;
  hintsUsed: number;
  hintsRemaining: number;
  requestsRemaining: number;
}

export const codingLabApi = {
  listAssessments: () => api.get<AssessmentSummary[]>("/api/coding-lab/assessments"),
  history: () => api.get<AttemptHistory[]>("/api/coding-lab/history"),
  start: (assessmentId: number) => api.post<WorkspaceView>(`/api/coding-lab/assessments/${assessmentId}/start`),
  getWorkspace: (attemptId: number) => api.get<WorkspaceView>(`/api/coding-lab/attempts/${attemptId}`),
  saveFiles: (attemptId: number, files: Record<string, string>) =>
    api.patch<WorkspaceView>(`/api/coding-lab/attempts/${attemptId}/files`, { files }),
  execute: (attemptId: number, files: Record<string, string>) =>
    api.post<SubmissionResult>(`/api/coding-lab/attempts/${attemptId}/run`, { files }),
  submit: (attemptId: number, files: Record<string, string>) =>
    api.post<SubmissionResult>(`/api/coding-lab/attempts/${attemptId}/submit`, { files }),
  requestHint: (attemptId: number, message: string) =>
    api.post<HintResponseView>(`/api/coding-lab/attempts/${attemptId}/ai/hint`, { message }),
};

// ---------------------------------------------------------------------------------- admin API --

export interface AssessmentAdmin {
  id: number;
  title: string;
  description: string | null;
  codingType: CodingType;
  difficulty: CodingDifficulty;
  status: CodingAssessmentStatus;
  technology: string | null;
  language: string;
  runCommand: string;
  timeLimitMinutes: number;
  memoryLimitMb: number;
  executionTimeoutSeconds: number;
  starterFiles: Record<string, string>;
  publicTestFiles: Record<string, string>;
  hiddenTestFiles: Record<string, string>;
  maxScore: number;
  aiAssistantEnabled: boolean;
  aiMaxHints: number;
  aiMaxRequests: number;
  aiCooldownSeconds: number;
}

export interface AssessmentUpsertRequest {
  title: string;
  codingType: CodingType;
  description?: string;
  difficulty?: CodingDifficulty;
  technology?: string;
  language: string;
  runCommand: string;
  timeLimitMinutes?: number;
  memoryLimitMb?: number;
  executionTimeoutSeconds?: number;
  starterFiles?: Record<string, string>;
  publicTestFiles?: Record<string, string>;
  hiddenTestFiles?: Record<string, string>;
  maxScore?: number;
  aiAssistantEnabled?: boolean;
  aiMaxHints?: number;
  aiMaxRequests?: number;
  aiCooldownSeconds?: number;
}

export interface CodingAnalytics {
  totalAssessments: number;
  totalSubmissions: number;
  averageScore: number;
  testPassRate: number;
  averageExecutionTimeMs: number;
  performanceByType: Record<string, number>;
  mostDifficultAssessments: { assessmentId: number; title: string; submissions: number; averageScore: number }[];
  aiHintsGranted: number;
  aiRequestsBlocked: number;
}

export const codingLabAdminApi = {
  list: (params?: { status?: CodingAssessmentStatus; type?: CodingType }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.type) qs.set("type", params.type);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return adminApi.get<AssessmentAdmin[]>(`/api/admin/coding-assessments${suffix}`);
  },
  get: (id: number) => adminApi.get<AssessmentAdmin>(`/api/admin/coding-assessments/${id}`),
  create: (req: AssessmentUpsertRequest) => adminApi.post<AssessmentAdmin>("/api/admin/coding-assessments", req),
  update: (id: number, req: AssessmentUpsertRequest) =>
    adminApi.put<AssessmentAdmin>(`/api/admin/coding-assessments/${id}`, req),
  remove: (id: number) => adminApi.del<void>(`/api/admin/coding-assessments/${id}`),
  publish: (id: number) => adminApi.post<AssessmentAdmin>(`/api/admin/coding-assessments/${id}/publish`),
  unpublish: (id: number) => adminApi.post<AssessmentAdmin>(`/api/admin/coding-assessments/${id}/unpublish`),
  archive: (id: number) => adminApi.post<AssessmentAdmin>(`/api/admin/coding-assessments/${id}/archive`),
  duplicate: (id: number) => adminApi.post<AssessmentAdmin>(`/api/admin/coding-assessments/${id}/duplicate`),
  preview: (id: number) => adminApi.post<SubmissionResult>(`/api/admin/coding-assessments/${id}/preview`),
  submissions: (id: number) => adminApi.get<any[]>(`/api/admin/coding-assessments/${id}/submissions`),
  aiAudit: (id: number) => adminApi.get<any[]>(`/api/admin/coding-assessments/${id}/ai-audit`),
  analyticsOverview: () => adminApi.get<CodingAnalytics>("/api/admin/coding-assessments/analytics/overview"),
};
