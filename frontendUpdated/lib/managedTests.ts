// Types + API helpers for the Admin Assessment / Test Management module.
// Admin calls go through adminApi (adminAccessToken); student calls go through api (accessToken),
// exactly as the rest of the app already does.
import { adminApi } from "@/lib/adminApi";
import { api } from "@/lib/api";

export type TestType =
  | "STANDARD_MOCK_TEST" | "UNIVERSITY_TEST" | "CUSTOM_TEST"
  | "TECHNICAL_MCQ_TEST" | "COMPANY_TEST" | "PLACEMENT_TEST";

export type TestStatus = "DRAFT" | "PUBLISHED" | "SCHEDULED" | "ACTIVE" | "COMPLETED" | "ARCHIVED";

export type SectionType =
  | "DSA" | "CODING" | "SQL" | "DATAFRAME" | "APTITUDE" | "TECHNICAL_MCQ"
  | "OOPS" | "DBMS" | "OS" | "CN" | "CLOUD" | "AI" | "ML" | "GENAI" | "CUSTOM";

export type QuestionType = "MCQ_SINGLE" | "MCQ_MULTI" | "CODING" | "SQL" | "DATAFRAME" | "DESCRIPTIVE";
export type QuestionSourceType = "TECHNICAL_MCQ" | "APTITUDE" | "CANONICAL";
export type SelectionStrategy = "MANUAL" | "RANDOM" | "FIXED" | "HYBRID";
export type Difficulty = "EASY" | "MEDIUM" | "HARD";

export const TEST_TYPES: { value: TestType; label: string }[] = [
  { value: "STANDARD_MOCK_TEST", label: "Standard Mock Test" },
  { value: "UNIVERSITY_TEST", label: "University Test" },
  { value: "CUSTOM_TEST", label: "Custom Test" },
  { value: "TECHNICAL_MCQ_TEST", label: "Technical MCQ Test" },
  { value: "COMPANY_TEST", label: "Company Test" },
  { value: "PLACEMENT_TEST", label: "Placement Test" },
];

export const SECTION_TYPES: SectionType[] = [
  "DSA", "CODING", "SQL", "DATAFRAME", "APTITUDE", "TECHNICAL_MCQ",
  "OOPS", "DBMS", "OS", "CN", "CLOUD", "AI", "ML", "GENAI", "CUSTOM",
];

export const TECHNICAL_CATEGORIES = [
  "DSA", "ALGORITHMS", "OOPS", "JAVA", "PYTHON", "C", "CPP", "DBMS", "SQL",
  "COMPUTER_NETWORKS", "OPERATING_SYSTEMS", "CLOUD_COMPUTING", "AWS", "AZURE", "GCP",
  "AI", "MACHINE_LEARNING", "DEEP_LEARNING", "GENERATIVE_AI", "DATA_SCIENCE",
  "DATA_STRUCTURES", "SYSTEM_DESIGN", "SOFTWARE_ENGINEERING", "COMPUTER_ARCHITECTURE",
  "LINUX", "DEVOPS", "DOCKER", "KUBERNETES", "GIT_GITHUB", "SPRING_BOOT",
  "REST_API", "MICROSERVICES", "APTITUDE", "LOGICAL_REASONING",
  "QUANTITATIVE_APTITUDE", "VERBAL_ABILITY",
];

export function labelOf(value: string): string {
  if (value === "CPP") return "C++";
  if (value === "GIT_GITHUB") return "Git/GitHub";
  return value
    .split("_")
    .map((p) => (p.length <= 3 ? p : p.charAt(0) + p.slice(1).toLowerCase()))
    .join(" ");
}

export interface QuestionOption { key: string; text: string }

export interface TestQuestion {
  id: number;
  questionType: QuestionType;
  origin: "QUESTION_BANK" | "CUSTOM";
  sourceType: QuestionSourceType | null;
  sourceQuestionId: number | null;
  title: string;
  difficulty: Difficulty | null;
  topic: string | null;
  subtopic: string | null;
  marks: number;
  negativeMarks: number;
  estimatedTimeSeconds: number;
  displayOrder: number;
  payload: Record<string, any>;
}

export interface TestSection {
  id: number;
  name: string;
  sectionType: SectionType;
  instructions: string | null;
  displayOrder: number;
  questionCount: number;
  attachedQuestionCount: number;
  durationMinutes: number;
  marksPerQuestion: number;
  negativeMarks: number;
  passingPercentage: number | null;
  mandatory: boolean;
  randomizeQuestions: boolean;
  randomizeOptions: boolean;
  allowBackNavigation: boolean;
  selectionStrategy: SelectionStrategy;
  selectionRules: Record<string, any>;
  attachedMarks: number;
  questions: TestQuestion[];
}

export interface TestSummary {
  id: number;
  name: string;
  testType: TestType;
  status: TestStatus;
  organizationName: string | null;
  batch: string | null;
  branch: string | null;
  graduationYear: number | null;
  difficulty: Difficulty | null;
  durationMinutes: number;
  totalMarks: number;
  passingPercentage: number;
  sectionCount: number;
  questionCount: number;
  assignedStudentCount: number;
  attemptCount: number;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
  updatedAt: string | null;
  createdBy: string | null;
}

export interface ValidationReport { publishable: boolean; errors: string[]; warnings: string[] }

export interface TestDetail {
  summary: TestSummary;
  description: string | null;
  instructions: string | null;
  targetJobRoleId: number | null;
  targetJobRoleTitle: string | null;
  negativeMarkingEnabled: boolean;
  defaultNegativeMarks: number;
  overallTimerEnabled: boolean;
  sectionTimersEnabled: boolean;
  attemptLimit: number;
  shuffleSections: boolean;
  showResultToStudent: boolean;
  proctored: boolean;
  fullscreenRequired: boolean;
  webcamRequired: boolean;
  violationCountThreshold: number;
  sections: TestSection[];
  validation: ValidationReport;
}

export interface BankQuestion {
  id: number;
  sourceType: QuestionSourceType;
  title: string;
  preview: string;
  questionType: QuestionType;
  category: string | null;
  topic: string | null;
  subtopic: string | null;
  difficulty: Difficulty | null;
  defaultMarks: number;
  defaultNegativeMarks: number;
  companies: string[];
  tags: string[];
  source: string;
  usageCount: number;
  alreadyInTest: boolean;
}

export interface Page<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

export interface AttemptSummary {
  attemptId: number; testId: number; testName: string; testType: TestType;
  studentId: number; studentName: string; studentEmail: string;
  status: string; attemptNumber: number; startedAt: string | null; submittedAt: string | null;
  scoredMarks: number; totalMarks: number; percentage: number; accuracy: number;
  passed: boolean; violationCount: number; integrityScore: number;
}

export interface AttemptResult {
  attemptId: number; testId: number; testName: string; testType: TestType;
  studentId: number; studentName: string; status: string; attemptNumber: number;
  startedAt: string | null; submittedAt: string | null; durationSeconds: number;
  scoredMarks: number; totalMarks: number; percentage: number; accuracy: number;
  correctCount: number; wrongCount: number; unattemptedCount: number; pendingReviewCount: number;
  passed: boolean; percentile: number | null; violationCount: number; integrityScore: number;
  sectionResults: {
    sectionId: number; name: string; sectionType: SectionType;
    scoredMarks: number; totalMarks: number; percentage: number; accuracy: number;
    correctCount: number; wrongCount: number; unattemptedCount: number; passed: boolean | null;
  }[];
  questionResults: {
    questionId: number; sectionId: number; title: string; questionType: QuestionType;
    difficulty: Difficulty | null; topic: string | null;
    marks: number; marksAwarded: number; correct: boolean | null; evaluationStatus: string;
    response: Record<string, any>; solution: Record<string, any>; evaluationNote: string | null;
  }[];
  analytics: Record<string, any>;
}

export interface StudentTestCard {
  testId: number; name: string; testType: TestType; organizationName: string | null;
  durationMinutes: number; sectionCount: number; questionCount: number; totalMarks: number;
  passingPercentage: number; startsAt: string | null; endsAt: string | null;
  attemptLimit: number; attemptsUsed: number; attemptable: boolean; attemptStatus: string;
  activeAttemptId: number | null; bestPercentage: number | null; sectionNames: string[];
}

export interface AttemptView {
  attemptId: number; testId: number; testName: string; testType: TestType;
  instructions: string | null; status: string; attemptNumber: number;
  startedAt: string | null; serverExpiresAt: string | null; remainingSeconds: number;
  overallTimerEnabled: boolean; sectionTimersEnabled: boolean;
  proctored: boolean; fullscreenRequired: boolean; webcamRequired: boolean;
  sections: {
    sectionId: number; name: string; sectionType: SectionType; instructions: string | null;
    displayOrder: number; durationMinutes: number; expiresAtEpochMillis: number | null;
    submitted: boolean; allowBackNavigation: boolean; questions: TestQuestion[];
  }[];
  answers: Record<string, { response: Record<string, any>; markedForReview: boolean; timeSpentSeconds: number }>;
}

// ------------------------------------------------------------------ admin API

function qs(params: Record<string, any>): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") search.set(k, String(v));
  });
  const s = search.toString();
  return s ? `?${s}` : "";
}

export const testsAdminApi = {
  list: (params: { status?: TestStatus; testType?: TestType; search?: string; page?: number; size?: number } = {}) =>
    adminApi.get<Page<TestSummary>>(`/api/admin/tests${qs(params)}`),
  get: (id: number) => adminApi.get<TestDetail>(`/api/admin/tests/${id}`),
  create: (body: Record<string, any>) => adminApi.post<TestDetail>("/api/admin/tests", body),
  update: (id: number, body: Record<string, any>) => adminApi.put<TestDetail>(`/api/admin/tests/${id}`, body),
  archive: (id: number) => adminApi.del<{ message: string }>(`/api/admin/tests/${id}`),
  publish: (id: number) => adminApi.post<TestDetail>(`/api/admin/tests/${id}/publish`),
  unpublish: (id: number) => adminApi.post<TestDetail>(`/api/admin/tests/${id}/unpublish`),
  duplicate: (id: number, newName?: string) => adminApi.post<TestDetail>(`/api/admin/tests/${id}/duplicate`, { newName }),
  preview: (id: number) => adminApi.get<TestDetail>(`/api/admin/tests/${id}/preview`),

  sections: (id: number) => adminApi.get<TestSection[]>(`/api/admin/tests/${id}/sections`),
  addSection: (id: number, body: Record<string, any>) => adminApi.post<TestSection>(`/api/admin/tests/${id}/sections`, body),
  updateSection: (id: number, sectionId: number, body: Record<string, any>) =>
    adminApi.put<TestSection>(`/api/admin/tests/${id}/sections/${sectionId}`, body),
  deleteSection: (id: number, sectionId: number) =>
    adminApi.del<{ message: string }>(`/api/admin/tests/${id}/sections/${sectionId}`),
  reorderSections: (id: number, sectionIdsInOrder: number[]) =>
    adminApi.post<{ message: string }>(`/api/admin/tests/${id}/sections/reorder`, { sectionIdsInOrder }),

  addBankQuestions: (id: number, sectionId: number, sourceType: QuestionSourceType, questionIds: number[]) =>
    adminApi.post<TestQuestion[]>(`/api/admin/tests/${id}/sections/${sectionId}/questions`, { sourceType, questionIds }),
  addCustomQuestion: (id: number, sectionId: number, body: Record<string, any>) =>
    adminApi.post<TestQuestion>(`/api/admin/tests/${id}/sections/${sectionId}/custom-questions`, body),
  updateQuestion: (id: number, questionId: number, body: Record<string, any>) =>
    adminApi.put<TestQuestion>(`/api/admin/tests/${id}/custom-questions/${questionId}`, body),
  removeQuestion: (id: number, questionId: number) =>
    adminApi.del<{ message: string }>(`/api/admin/tests/${id}/questions/${questionId}`),
  reorderQuestions: (id: number, sectionId: number, questionIdsInOrder: number[]) =>
    adminApi.post<{ message: string }>(`/api/admin/tests/${id}/sections/${sectionId}/questions/reorder`, { questionIdsInOrder }),
  autoFill: (id: number, sectionId: number, body: Record<string, any>) =>
    adminApi.post<{ requested: number; added: number; shortfall: number; notes: string[] }>(
      `/api/admin/tests/${id}/sections/${sectionId}/auto-fill`, body),

  assignments: (id: number) => adminApi.get<Page<any>>(`/api/admin/tests/${id}/assignments`),
  assign: (id: number, studentIds: number[]) => adminApi.post<any[]>(`/api/admin/tests/${id}/assign`, { studentIds }),
  unassign: (id: number, studentId: number) => adminApi.del<{ message: string }>(`/api/admin/tests/${id}/assign/${studentId}`),

  attempts: (id: number, page = 0, size = 20) =>
    adminApi.get<Page<AttemptSummary>>(`/api/admin/tests/${id}/attempts${qs({ page, size })}`),
  attempt: (attemptId: number) => adminApi.get<AttemptResult>(`/api/admin/test-attempts/${attemptId}`),
  attemptViolations: (attemptId: number) => adminApi.get<any[]>(`/api/admin/test-attempts/${attemptId}/violations`),

  searchBank: (params: Record<string, any>) => adminApi.get<Page<BankQuestion>>(`/api/admin/question-bank${qs(params)}`),
  bankFacets: () => adminApi.get<any>("/api/admin/question-bank/facets"),

  testAnalytics: () => adminApi.get<any>("/api/admin/dashboard/test-analytics"),
  testActivity: () => adminApi.get<any>("/api/admin/dashboard/test-activity"),
  integrity: () => adminApi.get<any>("/api/admin/dashboard/integrity"),
  studentProgress: (studentId: number) => adminApi.get<any>(`/api/admin/students/${studentId}/test-progress`),
  studentAttempts: (studentId: number) => adminApi.get<Page<AttemptSummary>>(`/api/admin/students/${studentId}/test-attempts`),
};

// ------------------------------------------------------------------ student API

export const studentTestsApi = {
  available: (testType?: TestType) => api.get<StudentTestCard[]>(`/api/student/tests${qs({ testType })}`),
  start: (testId: number) => api.post<AttemptView>(`/api/student/tests/${testId}/start`),
  attempt: (attemptId: number) => api.get<AttemptView>(`/api/student/tests/attempts/${attemptId}`),
  saveAnswer: (attemptId: number, body: Record<string, any>) =>
    api.post<{ message: string }>(`/api/student/tests/attempts/${attemptId}/answers`, body),
  saveAnswers: (attemptId: number, answers: Record<string, any>[]) =>
    api.post<{ message: string }>(`/api/student/tests/attempts/${attemptId}/answers/bulk`, { answers }),
  submitSection: (attemptId: number, sectionId: number) =>
    api.post<{ message: string }>(`/api/student/tests/attempts/${attemptId}/sections/submit`, { sectionId }),
  submit: (attemptId: number) => api.post<AttemptResult>(`/api/student/tests/attempts/${attemptId}/submit`),
  result: (attemptId: number) => api.get<AttemptResult>(`/api/student/tests/attempts/${attemptId}/result`),
  reportViolation: (attemptId: number, body: Record<string, any>) =>
    api.post<{ recorded: boolean; violationCount: number; integrityScore: number; terminated: boolean }>(
      `/api/student/tests/attempts/${attemptId}/violations`, body),
  progress: () => api.get<any>("/api/student/tests/progress"),
};
