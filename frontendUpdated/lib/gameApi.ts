import { api } from "@/lib/api";
import { adminApi } from "@/lib/adminApi";

export type GameType = "DEDUCTIVE" | "SWITCH" | "GRID" | "INDUCTIVE" | "MOTION" | "MATH";
export type GameDifficulty = "EASY" | "MEDIUM" | "HARD";
export type GameStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";
export type GameAttemptStatus = "STARTED" | "COMPLETED" | "ABANDONED" | "EXPIRED";
export type AnswerMode = "SINGLE" | "MULTI_UNORDERED" | "ORDERED_SEQUENCE";

export interface GameSummary {
  id: number;
  name: string;
  gameType: GameType;
  description: string | null;
  difficulty: GameDifficulty;
  roundCount: number;
  roundDurationSeconds: number;
}

export interface RoundOption {
  id: string;
  label: any;
}

export interface RoundView {
  roundIndex: number;
  prompt: string;
  meta: Record<string, any>;
  options: RoundOption[];
  answerMode: AnswerMode;
  requiredSelectionCount: number;
  timeLimitSeconds: number;
  /** The adaptive difficulty level (1-8) this specific round was generated at. */
  level: number;
  correct: boolean | null;
  correctOptionId: string | null;
  correctOptionIds: string[] | null;
}

export interface AttemptView {
  id: number;
  gameId: number;
  gameName: string;
  gameType: GameType;
  difficulty: GameDifficulty;
  status: GameAttemptStatus;
  currentRoundIndex: number;
  totalRounds: number;
  score: number;
  maxPossibleScore: number;
  accuracy: number;
  correctCount: number;
  incorrectCount: number;
  currentStreak: number;
  bestStreak: number;
  averageResponseTimeMs: number;
  /** Live adaptive-difficulty state - see AdaptiveDifficulty on the backend. */
  currentLevel: number;
  difficultyScore: number;
  highestLevelReached: number;
  paused: boolean;
  startedAt: string | null;
  expiresAt: string | null;
  completedAt: string | null;
  currentRound: RoundView | null;
}

export interface AttemptSummary {
  id: number;
  gameId: number;
  gameName: string;
  gameType: GameType;
  status: GameAttemptStatus;
  score: number;
  accuracy: number;
  startedAt: string | null;
  completedAt: string | null;
}

export interface AnswerResult {
  correct: boolean;
  correctOptionId: string | null;
  correctOptionIds: string[] | null;
  roundScore: number;
  levelUp: boolean;
  previousLevel: number;
  newLevel: number;
  attempt: AttemptView;
}

// ------------------------------------------------------------------------------- student API --

export const gameApi = {
  listAvailable: () => api.get<GameSummary[]>("/api/games"),
  get: (gameId: number) => api.get<GameSummary>(`/api/games/${gameId}`),
  history: () => api.get<AttemptSummary[]>("/api/games/history"),
  start: (gameId: number) => api.post<AttemptView>(`/api/games/${gameId}/start`),
  /** optionIds: one id for a SINGLE round, the (unordered) required-count ids for
   *  MULTI_UNORDERED, or every option id in the order the student clicked them for
   *  ORDERED_SEQUENCE. Pass [] to represent "no answer" (e.g. a client-side timeout). */
  answer: (gameId: number, roundIndex: number, optionIds: string[], responseTimeMs: number) =>
    api.post<AnswerResult>(`/api/games/${gameId}/answer`, { roundIndex, optionIds, responseTimeMs }),
  complete: (gameId: number) => api.post<AttemptView>(`/api/games/${gameId}/complete`),
  abandon: (attemptId: number) => api.post<AttemptView>(`/api/games/attempts/${attemptId}/abandon`),
  pause: (attemptId: number) => api.post<AttemptView>(`/api/games/attempts/${attemptId}/pause`),
  resume: (attemptId: number) => api.post<AttemptView>(`/api/games/attempts/${attemptId}/resume`),
  getAttempt: (attemptId: number) => api.get<AttemptView>(`/api/games/attempts/${attemptId}`),
  getResult: (attemptId: number) => api.get<Record<string, any>>(`/api/games/results/${attemptId}`),
};

// ---------------------------------------------------------------------------------- admin API --

export interface GameAdmin {
  id: number;
  name: string;
  gameType: GameType;
  description: string | null;
  difficulty: GameDifficulty;
  status: GameStatus;
  roundCount: number;
  roundDurationSeconds: number;
  randomizeRounds: boolean;
  negativeMarkingEnabled: boolean;
  negativeMarkingPenalty: number;
  scoringConfig: Record<string, number>;
  gameConfig: Record<string, any>;
  targetUniversity: string | null;
  targetCompany: string | null;
  targetJobRole: string | null;
  availableFrom: string | null;
  availableTo: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GameUpsertRequest {
  name: string;
  gameType: GameType;
  description?: string;
  difficulty?: GameDifficulty;
  roundCount?: number;
  roundDurationSeconds?: number;
  randomizeRounds?: boolean;
  negativeMarkingEnabled?: boolean;
  negativeMarkingPenalty?: number;
  scoringConfig?: Record<string, number>;
  gameConfig?: Record<string, any>;
  targetUniversity?: string;
  targetCompany?: string;
  targetJobRole?: string;
}

export interface GameAttemptAdmin {
  id: number;
  candidateId: number;
  candidateName: string | null;
  status: GameAttemptStatus;
  score: number;
  accuracy: number;
  correctCount: number;
  incorrectCount: number;
  averageResponseTimeMs: number;
  startedAt: string | null;
  completedAt: string | null;
}

export interface GameAnalytics {
  gamesAttempted: number;
  gamesCompleted: number;
  averageScore: number;
  averageAccuracy: number;
  averageResponseTimeMs: number;
  averageScoreByType: Record<string, number>;
  averageScoreByDifficulty: Record<string, number>;
  mostAttemptedGames: { gameId: number; gameName: string; attempts: number; averageAccuracy: number }[];
  mostDifficultGames: { gameId: number; gameName: string; attempts: number; averageAccuracy: number }[];
}

export const gameAdminApi = {
  list: (params?: { status?: GameStatus; type?: GameType }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.type) qs.set("type", params.type);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return adminApi.get<GameAdmin[]>(`/api/admin/games${suffix}`);
  },
  get: (id: number) => adminApi.get<GameAdmin>(`/api/admin/games/${id}`),
  create: (req: GameUpsertRequest) => adminApi.post<GameAdmin>("/api/admin/games", req),
  update: (id: number, req: GameUpsertRequest) => adminApi.put<GameAdmin>(`/api/admin/games/${id}`, req),
  remove: (id: number) => adminApi.del<void>(`/api/admin/games/${id}`),
  publish: (id: number) => adminApi.post<GameAdmin>(`/api/admin/games/${id}/publish`),
  unpublish: (id: number) => adminApi.post<GameAdmin>(`/api/admin/games/${id}/unpublish`),
  archive: (id: number) => adminApi.post<GameAdmin>(`/api/admin/games/${id}/archive`),
  duplicate: (id: number) => adminApi.post<GameAdmin>(`/api/admin/games/${id}/duplicate`),
  preview: (id: number) => adminApi.post<{ gameType: GameType; difficulty: GameDifficulty; rounds: any[] }>(
    `/api/admin/games/${id}/preview`
  ),
  attempts: (id: number) => adminApi.get<GameAttemptAdmin[]>(`/api/admin/games/${id}/attempts`),
  analytics: (id: number) => adminApi.get<GameAnalytics>(`/api/admin/games/${id}/analytics`),
  analyticsOverview: () => adminApi.get<GameAnalytics>("/api/admin/games/analytics/overview"),
};
