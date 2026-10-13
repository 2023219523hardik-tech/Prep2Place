import { api } from "@/lib/api";

export interface JobSummary {
  id: number;
  title: string;
  company: string;
  location: string;
  employmentType: string;
  experienceLevel: string;
  salaryMinLpa: number | null;
  salaryMaxLpa: number | null;
  requiredSkills: string;
  postedAt: string;
  closesAt: string | null;
  active: boolean;
  applicantCount: number;
}

export interface JobDetail extends JobSummary {
  description: string;
  niceToHaveSkills: string;
  applyUrl: string | null;
  alreadyApplied: boolean;
}

export interface ApplicationResponse {
  id: number;
  jobId: number;
  jobTitle: string;
  company: string;
  status: string;
  appliedAt: string;
  coverNote: string | null;
  currentRoundId?: number | null;
  currentRoundName?: string | null;
  currentRoundType?: string | null;
  overallScore?: number | null;
  finalDecision?: string | null;
  currentRoundOrder?: number;
  totalRounds?: number;
  nextAvailableRound?: string | null;
  deadline?: string | null;
  atsScore?: number | null;
  eligibilityPassed?: boolean;
  eligibilityFailureReason?: string | null;
  atsParsingStatus?: string;
  atsScoreBreakdown?: string | null;
}

export interface ApplicationDetail extends ApplicationResponse {
  applicantName: string;
  applicantEmail: string;
  resumeText: string | null;
}

export interface PageResponse<T> {
  content: T[];
  total: number;
  page: number;
  size: number;
}

export interface JobUpsertRequest {
  title: string;
  company: string;
  location?: string;
  employmentType?: string;
  experienceLevel?: string;
  salaryMinLpa?: number | null;
  salaryMaxLpa?: number | null;
  description?: string;
  requiredSkills?: string;
  niceToHaveSkills?: string;
  applyUrl?: string;
  closesAt?: string | null;
  active?: boolean;
}

export const jobsApi = {
  list: (params: { search?: string; employmentType?: string; experienceLevel?: string; page?: number; size?: number }) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
    });
    return api.get<PageResponse<JobSummary>>(`/api/jobs?${qs.toString()}`);
  },
  get: (id: number) => api.get<JobDetail>(`/api/jobs/${id}`),
  apply: (id: number, body: { resumeText?: string; coverNote?: string }) =>
    api.post<ApplicationResponse>(`/api/jobs/${id}/apply`, body),
  myApplications: (page = 0, size = 20) =>
    api.get<PageResponse<ApplicationResponse>>(`/api/jobs/applications/me?page=${page}&size=${size}`),
  withdraw: (applicationId: number) => api.del<void>(`/api/jobs/applications/${applicationId}`),
  pipeline: (jobId: number) =>
    api.get<HiringRoundDto[]>(`/api/jobs/${jobId}/pipeline`),
  progress: (applicationId: number) =>
    api.get<CandidateApplicationDetail>(`/api/jobs/applications/${applicationId}/progress`),
  startAssessment: (applicationId: number, roundId: number) =>
    api.post<StartRoundAssessmentResponse>(`/api/jobs/applications/${applicationId}/rounds/${roundId}/start`),
  submitAssessment: (applicationId: number, roundId: number, body: SubmitRoundAssessmentRequest) =>
    api.post<SubmitRoundAssessmentResponse>(`/api/jobs/applications/${applicationId}/rounds/${roundId}/submit`, body),
};

export const jobsAdminApi = {
  list: (params: { search?: string; active?: boolean; page?: number; size?: number }) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
    });
    return api.get<PageResponse<JobSummary>>(`/api/admin/jobs?${qs.toString()}`);
  },
  get: (id: number) => api.get<JobDetail>(`/api/admin/jobs/${id}`),
  create: (body: JobUpsertRequest) => api.post<JobSummary>(`/api/admin/jobs`, body),
  update: (id: number, body: JobUpsertRequest) => api.put<JobSummary>(`/api/admin/jobs/${id}`, body),
  toggleActive: (id: number, active: boolean) =>
    api.patch<void>(`/api/admin/jobs/${id}/active?active=${active}`),
  remove: (id: number) => api.del<void>(`/api/admin/jobs/${id}`),
  applications: (jobId: number, status?: string, page = 0, size = 20) => {
    const qs = new URLSearchParams({ page: String(page), size: String(size) });
    if (status) qs.set("status", status);
    return api.get<PageResponse<ApplicationDetail>>(`/api/admin/jobs/${jobId}/applications?${qs.toString()}`);
  },
  updateStatus: (applicationId: number, status: string) =>
    api.patch<ApplicationDetail>(`/api/admin/jobs/applications/${applicationId}/status`, { status }),
};

export const EMPLOYMENT_TYPES = ["FULL_TIME", "INTERNSHIP", "CONTRACT", "PART_TIME"];
export const EXPERIENCE_LEVELS = ["FRESHER", "ENTRY", "MID", "SENIOR"];
export const APPLICATION_STATUSES = [
  "APPLIED",
  "UNDER_REVIEW",
  "ELIGIBLE",
  "NOT_ELIGIBLE",
  "SHORTLISTED",
  "ASSESSMENT_PENDING",
  "IN_PROGRESS",
  "QUALIFIED",
  "INTERVIEW",
  "INTERVIEW_SCHEDULED",
  "SELECTED",
  "OFFER",
  "OFFER_RELEASED",
  "OFFER_ACCEPTED",
  "OFFER_DECLINED",
  "REJECTED",
  "ON_HOLD",
  "WITHDRAWN",
];

export const PIPELINE_ROUND_TYPES = [
  "APTITUDE",
  "TECHNICAL_MCQ",
  "DSA",
  "SQL",
  "CODING_LAB",
  "FRONTEND_CODING",
  "BACKEND_CODING",
  "ML_AI_CODING",
  "DATAFRAME",
  "SYSTEM_DESIGN",
  "CASE_STUDY",
  "GROUP_DISCUSSION",
  "AI_INTERVIEW",
  "TECHNICAL_INTERVIEW",
  "HR_INTERVIEW",
  "CUSTOM",
];

export interface CompanyInfo {
  id: number;
  slug: string;
  name: string;
  logoUrl: string | null;
  description: string | null;
  website: string | null;
}

export interface HiringRoundDto {
  id?: number;
  roundOrder: number;
  name: string;
  roundType: string;
  durationMinutes: number;
  passingScore: number;
  weightage: number;
  maxAttempts: number;
  repeatable: boolean;
  autoUnlock: boolean;
  managementMode: string;
  assessmentConfig?: string | null;
  roundStatus?: string;
  startDate?: string | null;
  startTime?: string | null;
  endDate?: string | null;
  endTime?: string | null;
  timezone?: string;
  isActivated?: boolean;
  proctoringConfig?: string | null;
}

export interface RoundAttemptDetail {
  id: number;
  roundId: number;
  roundName: string;
  roundType: string;
  roundOrder: number;
  attemptNumber: number;
  score: number | null;
  passingScore: number;
  passed: boolean | null;
  status: string;
  feedback: string | null;
  notes: string | null;
  interviewScheduledAt: string | null;
  interviewerMeetingLink: string | null;
  evaluatedByName: string | null;
  completedAt: string | null;
}

export interface CandidateApplicationDetail {
  applicationId: number;
  jobId: number;
  jobTitle: string;
  applicantId: number;
  applicantName: string;
  applicantEmail: string;
  applicantPhone: string | null;
  applicantCollege: string | null;
  applicantDegree: string | null;
  applicantBranch: string | null;
  applicantGraduationYear: number | null;
  applicantCgpa: number | null;
  applicationStatus: string;
  appliedAt: string;
  resumeText: string | null;
  resumeFileName?: string | null;
  coverNote: string | null;
  currentRoundId: number | null;
  currentRoundName: string | null;
  currentRoundType: string | null;
  overallScore: number | null;
  finalDecision: string | null;
  atsScore?: number | null;
  atsParsingStatus?: string;
  eligibilityPassed?: boolean;
  eligibilityFailureReason?: string | null;
  atsScoreBreakdown?: string | null;
  recruiterAuditNotes?: string | null;
  roundAttempts: RoundAttemptDetail[];
}

export interface CompanyDashboardStats {
  totalJobs: number;
  activeJobs: number;
  totalApplications: number;
  eligibleCandidates: number;
  shortlistedCandidates: number;
  inAssessment: number;
  inInterview: number;
  selectedCandidates: number;
  rejectedCandidates: number;
  funnelStages: Record<string, number>;
}

export interface CompanyJobDetail extends JobSummary {
  slug?: string;
  companyInfo?: CompanyInfo;
  department?: string;
  openings?: number;
  jobType?: string;
  salaryMin?: number | null;
  salaryMax?: number | null;
  stipend?: number | null;
  status: string;
  description: string;
  responsibilities?: string;
  niceToHaveSkills: string;
  benefits?: string;
  minCgpa?: number | null;
  maxBacklogs?: number | null;
  graduationYear?: number | null;
  minGraduationYear?: number | null;
  maxGraduationYear?: number | null;
  branches?: string;
  allowedDegrees?: string;
  requiredCertifications?: string;
  applyUrl: string | null;
  pipelineManagementMode?: string;
  schedulingPolicy?: "SEQUENTIAL" | "INDEPENDENT";
  atsScreeningEnabled?: boolean;
  atsMinimumScore?: number;
  autoShortlistEnabled?: boolean;
  manualReviewRequired?: boolean;
  atsScoringWeights?: string | null;
  rounds: HiringRoundDto[];
}

export interface AtsScreeningStats {
  totalApplicants: number;
  eligibleCandidates: number;
  ineligibleCandidates: number;
  shortlistedCandidates: number;
  underReviewCandidates: number;
  belowCutoffCandidates: number;
  averageAtsScore: number;
  highestAtsScore: number;
  lowestAtsScore: number;
  configuredCutoff: number;
}

export const companyAdminApi = {
  login: (companySlug: string, body: { email: string; password: string }) =>
    api.post<{
      token: string;
      refreshToken: string;
      user: { id: number; email: string; fullName: string; role: string };
      company: CompanyInfo;
    }>(`/api/company/${companySlug}/admin/login`, body, true),

  dashboard: (companySlug: string) =>
    api.get<CompanyDashboardStats>(`/api/company/${companySlug}/admin/dashboard`),

  jobs: (companySlug: string, params: { search?: string; status?: string; page?: number; size?: number } = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
    });
    return api.get<PageResponse<CompanyJobDetail>>(`/api/company/${companySlug}/admin/jobs?${qs.toString()}`);
  },

  getJob: (companySlug: string, jobId: number) =>
    api.get<CompanyJobDetail>(`/api/company/${companySlug}/admin/jobs/${jobId}`),

  createJob: (companySlug: string, body: any) =>
    api.post<CompanyJobDetail>(`/api/company/${companySlug}/admin/jobs`, body),

  updateJob: (companySlug: string, jobId: number, body: any) =>
    api.put<CompanyJobDetail>(`/api/company/${companySlug}/admin/jobs/${jobId}`, body),

  updateStatus: (companySlug: string, jobId: number, status: string) =>
    api.patch<void>(`/api/company/${companySlug}/admin/jobs/${jobId}/status?status=${status}`),

  deleteJob: (companySlug: string, jobId: number) =>
    api.del<void>(`/api/company/${companySlug}/admin/jobs/${jobId}`),

  pipeline: (companySlug: string, jobId: number) =>
    api.get<HiringRoundDto[]>(`/api/company/${companySlug}/admin/jobs/${jobId}/pipeline`),

  updatePipeline: (companySlug: string, jobId: number, rounds: HiringRoundDto[]) =>
    api.put<HiringRoundDto[]>(`/api/company/${companySlug}/admin/jobs/${jobId}/pipeline`, rounds),

  applications: (companySlug: string, jobId?: number, params: { status?: string; page?: number; size?: number } = {}) => {
    const qs = new URLSearchParams();
    if (jobId) qs.set("jobId", String(jobId));
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
    });
    const endpoint = jobId
      ? `/api/company/${companySlug}/admin/jobs/${jobId}/applications?${qs.toString()}`
      : `/api/company/${companySlug}/admin/jobs/applications?${qs.toString()}`;
    return api.get<PageResponse<CandidateApplicationDetail>>(endpoint);
  },

  candidates: (companySlug: string, params: { search?: string; page?: number; size?: number } = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
    });
    return api.get<PageResponse<CandidateApplicationDetail>>(`/api/company/${companySlug}/admin/candidates?${qs.toString()}`);
  },

  applicationDetail: (companySlug: string, applicationId: number) =>
    api.get<CandidateApplicationDetail>(`/api/company/${companySlug}/admin/applications/${applicationId}`),

  evaluateRound: (companySlug: string, attemptId: number, body: { score?: number; passed?: boolean; feedback?: string; notes?: string }) =>
    api.post<RoundAttemptDetail>(`/api/company/${companySlug}/admin/rounds/${attemptId}/evaluate`, body),

  scheduleInterview: (companySlug: string, attemptId: number, body: { interviewScheduledAt: string; interviewerMeetingLink?: string; notes?: string }) =>
    api.post<RoundAttemptDetail>(`/api/company/${companySlug}/admin/rounds/${attemptId}/schedule-interview`, body),

  updateDecision: (companySlug: string, applicationId: number, decision: string) =>
    api.patch<CandidateApplicationDetail>(`/api/company/${companySlug}/admin/applications/${applicationId}/decision`, { decision }),

  liveMonitoring: (companySlug: string) =>
    api.get<LiveCandidate[]>(`/api/company/${companySlug}/admin/live-monitoring`),

  timeline: (companySlug: string, applicationId: number) =>
    api.get<TimelineEvent[]>(`/api/company/${companySlug}/admin/applications/${applicationId}/timeline`),

  candidateAction: (companySlug: string, applicationId: number, body: { action: string; notes?: string; score?: number }) =>
    api.post<CandidateApplicationDetail>(`/api/company/${companySlug}/admin/applications/${applicationId}/action`, body),

  interviews: (companySlug: string) =>
    api.get<CompanyInterviewReport[]>(`/api/company/${companySlug}/admin/interviews`),

  reports: (companySlug: string) =>
    api.get<CompanyInterviewReport[]>(`/api/company/${companySlug}/admin/reports`),

  getAtsStats: (companySlug: string, jobId: number) =>
    api.get<AtsScreeningStats>(`/api/company/${companySlug}/admin/jobs/${jobId}/ats-stats`),

  overrideAts: (companySlug: string, applicationId: number, body: { action: string; notes?: string; overrideAtsScore?: number }) =>
    api.post<CandidateApplicationDetail>(`/api/company/${companySlug}/admin/applications/${applicationId}/ats-override`, body),

  updateRoundLifecycle: (companySlug: string, roundId: number, body: { status: string; isActivated?: boolean }) =>
    api.patch<HiringRoundDto>(`/api/company/${companySlug}/admin/rounds/${roundId}/lifecycle`, body),

  downloadResumeUrl: (companySlug: string, applicationId: number) =>
    `${(process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080").replace(/\/+$/, "")}/api/company/${companySlug}/admin/applications/${applicationId}/resume/download`,
};

export interface LiveCandidate {
  applicationId: number;
  candidateId: number;
  candidateName: string;
  candidateEmail: string;
  jobId: number;
  jobTitle: string;
  roundName: string;
  roundType: string;
  startedAt: string;
  durationMinutes: number;
  remainingSeconds: number;
  status: string;
  violationsCount: number;
  active: boolean;
}

export interface TimelineEvent {
  id: number;
  title: string;
  description: string;
  timestamp: string;
  eventType: string;
  status: string;
  score?: number | null;
}

export interface CompanyInterviewReport {
  applicationId: number;
  candidateId: number;
  candidateName: string;
  candidateEmail: string;
  jobId: number;
  jobTitle: string;
  roundName: string;
  roundType: string;
  scheduledAt?: string | null;
  completedAt?: string | null;
  score?: number | null;
  passingScore?: number | null;
  passed?: boolean | null;
  status: string;
  meetingLink?: string | null;
  notes?: string | null;
}

export interface RoundAssessmentQuestion {
  id: number;
  questionType: string;
  title: string;
  description?: string | null;
  options?: string[];
  topic?: string;
  difficulty?: string;
  marks?: number;
  codeTemplate?: string | null;
  constraints?: string | null;
  sampleTestCases?: string[];
}

export interface StartRoundAssessmentResponse {
  attemptId: number;
  applicationId: number;
  roundId: number;
  roundName: string;
  roundType: string;
  durationMinutes: number;
  passingScore: number;
  companyName: string;
  jobTitle: string;
  proctoringConfig?: string | null;
  questions: RoundAssessmentQuestion[];
}

export interface SubmitRoundAssessmentRequest {
  score: number;
  answeredCount: number;
  totalQuestions: number;
  proctoringViolations: number;
  feedback?: string;
}

export interface SubmitRoundAssessmentResponse {
  attemptId: number;
  score: number;
  passingScore: number;
  passed: boolean;
  status: string;
  feedback?: string;
  nextRoundId?: number | null;
  nextRoundName?: string | null;
  nextRoundUnlocked?: boolean;
  applicationStatus: string;
}

export interface ScheduleConflict {
  previousRound: string;
  previousEnd: string;
  nextRound: string;
  nextStart: string;
  suggestedEarliestStart?: string;
  message?: string;
}

export interface ScheduleConflictResponse {
  code: string;
  message: string;
  conflicts: ScheduleConflict[];
}

export interface PipelineScheduleValidationResult {
  isValid: boolean;
  conflicts: ScheduleConflict[];
  roundErrors: Record<number, string[]>;
}

export function computeRoundEnd(
  startDate?: string | null,
  startTime?: string | null,
  durationMinutes?: number
): { endDate: string; endTime: string } | null {
  if (!startDate || !startTime || durationMinutes == null || durationMinutes <= 0) {
    return null;
  }
  try {
    const [year, month, day] = startDate.split("-").map(Number);
    const [hours, minutes] = startTime.split(":").map(Number);
    if (isNaN(year) || isNaN(month) || isNaN(day) || isNaN(hours) || isNaN(minutes)) {
      return null;
    }
    const dt = new Date(year, month - 1, day, hours, minutes);
    dt.setMinutes(dt.getMinutes() + durationMinutes);
    const pad = (n: number) => String(n).padStart(2, "0");
    const endDate = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
    const endTime = `${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
    return { endDate, endTime };
  } catch {
    return null;
  }
}

export function computeRoundDuration(
  startDate?: string | null,
  startTime?: string | null,
  endDate?: string | null,
  endTime?: string | null
): number | null {
  if (!startDate || !startTime || !endDate || !endTime) {
    return null;
  }
  try {
    const [sy, sm, sd] = startDate.split("-").map(Number);
    const [sh, smin] = startTime.split(":").map(Number);
    const [ey, em, ed] = endDate.split("-").map(Number);
    const [eh, emin] = endTime.split(":").map(Number);
    const startDt = new Date(sy, sm - 1, sd, sh, smin);
    const endDt = new Date(ey, em - 1, ed, eh, emin);
    const diffMins = Math.round((endDt.getTime() - startDt.getTime()) / (60 * 1000));
    return diffMins > 0 ? diffMins : null;
  } catch {
    return null;
  }
}

export function parseRoundInterval(round: Partial<HiringRoundDto>): { start: Date; end: Date } | null {
  if (!round.startDate || !round.startTime) return null;
  try {
    const [sy, sm, sd] = round.startDate.split("-").map(Number);
    const [sh, smin] = round.startTime.split(":").map(Number);
    const start = new Date(sy, sm - 1, sd, sh, smin);
    if (isNaN(start.getTime())) return null;

    let end: Date;
    if (round.endDate && round.endTime) {
      const [ey, em, ed] = round.endDate.split("-").map(Number);
      const [eh, emin] = round.endTime.split(":").map(Number);
      end = new Date(ey, em - 1, ed, eh, emin);
    } else {
      const dur = round.durationMinutes && round.durationMinutes > 0 ? round.durationMinutes : 60;
      end = new Date(start.getTime() + dur * 60 * 1000);
    }
    if (isNaN(end.getTime())) return null;
    return { start, end };
  } catch {
    return null;
  }
}

function formatDisplayDateTime(dt: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
}

export function validatePipelineSchedule(
  rounds: HiringRoundDto[],
  policy: "SEQUENTIAL" | "INDEPENDENT" = "SEQUENTIAL"
): PipelineScheduleValidationResult {
  const conflicts: ScheduleConflict[] = [];
  const roundErrors: Record<number, string[]> = {};

  const addError = (idx: number, msg: string) => {
    if (!roundErrors[idx]) roundErrors[idx] = [];
    roundErrors[idx].push(msg);
  };

  // 1. Validate intra-round sanity
  rounds.forEach((round, idx) => {
    if (!round.durationMinutes || round.durationMinutes <= 0) {
      addError(idx, "Duration must be greater than 0 minutes.");
    }

    if (round.startDate && round.startTime) {
      const interval = parseRoundInterval(round);
      if (!interval) {
        addError(idx, "Invalid start date or time format.");
      } else if (interval.end.getTime() <= interval.start.getTime()) {
        addError(idx, "End date/time must be strictly after start date/time.");
      }
    }
  });

  // 2. Sequential conflict validation across ordered rounds
  if (policy === "SEQUENTIAL") {
    const orderedIndices = rounds
      .map((r, originalIndex) => ({
        originalIndex,
        roundOrder: r.roundOrder ?? originalIndex + 1,
        round: r,
        interval: parseRoundInterval(r),
      }))
      .sort((a, b) => a.roundOrder - b.roundOrder);

    for (let i = 0; i < orderedIndices.length; i++) {
      const prev = orderedIndices[i];
      if (!prev.interval) continue;

      for (let j = i + 1; j < orderedIndices.length; j++) {
        const next = orderedIndices[j];
        if (!next.interval) continue;

        // Conflict condition: next starts before prev ends
        if (next.interval.start.getTime() < prev.interval.end.getTime()) {
          const pad = (n: number) => String(n).padStart(2, "0");
          const prevEndTimeStr = `${pad(prev.interval.end.getHours())}:${pad(prev.interval.end.getMinutes())}`;
          const nextStartTimeStr = `${pad(next.interval.start.getHours())}:${pad(next.interval.start.getMinutes())}`;

          const conflictMsg = `Schedule conflict: ${next.round.name || "Round " + next.roundOrder} starts at ${nextStartTimeStr}, but ${prev.round.name || "Round " + prev.roundOrder} ends at ${prevEndTimeStr}. Schedule it at ${prevEndTimeStr} or later.`;

          conflicts.push({
            previousRound: prev.round.name || `Round ${prev.roundOrder}`,
            previousEnd: formatDisplayDateTime(prev.interval.end),
            nextRound: next.round.name || `Round ${next.roundOrder}`,
            nextStart: formatDisplayDateTime(next.interval.start),
            suggestedEarliestStart: formatDisplayDateTime(prev.interval.end),
            message: conflictMsg,
          });

          addError(next.originalIndex, conflictMsg);
        }
      }
    }
  }

  return {
    isValid: conflicts.length === 0 && Object.keys(roundErrors).length === 0,
    conflicts,
    roundErrors,
  };
}

export function suggestNextAvailableTime(
  rounds: HiringRoundDto[],
  targetIndex: number
): { startDate: string; startTime: string; endDate: string; endTime: string } | null {
  const current = rounds[targetIndex];
  if (!current) return null;

  // Find latest end timestamp among all preceding rounds with a valid schedule
  let maxEnd: Date | null = null;
  let referenceStartDate = current.startDate || "";

  for (let i = 0; i < targetIndex; i++) {
    const prevInterval = parseRoundInterval(rounds[i]);
    if (prevInterval) {
      if (!maxEnd || prevInterval.end.getTime() > maxEnd.getTime()) {
        maxEnd = prevInterval.end;
        if (rounds[i].startDate) {
          referenceStartDate = rounds[i].startDate!;
        }
      }
    }
  }

  const pad = (n: number) => String(n).padStart(2, "0");
  let suggestedStartDate: string;
  let suggestedStartTime: string;

  if (maxEnd) {
    suggestedStartDate = `${maxEnd.getFullYear()}-${pad(maxEnd.getMonth() + 1)}-${pad(maxEnd.getDate())}`;
    suggestedStartTime = `${pad(maxEnd.getHours())}:${pad(maxEnd.getMinutes())}`;
  } else {
    const now = new Date();
    suggestedStartDate = referenceStartDate || `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    suggestedStartTime = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  }

  const duration = current.durationMinutes && current.durationMinutes > 0 ? current.durationMinutes : 30;
  const computedEnd = computeRoundEnd(suggestedStartDate, suggestedStartTime, duration);

  return {
    startDate: suggestedStartDate,
    startTime: suggestedStartTime,
    endDate: computedEnd?.endDate || suggestedStartDate,
    endTime: computedEnd?.endTime || suggestedStartTime,
  };
}


