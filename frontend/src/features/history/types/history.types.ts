export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

export interface PageResponse<T> {
  items: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  last: boolean;
}

export interface ScoreTrendItem {
  attemptId: number;
  examTitle: string;
  certType: string;
  score: number | null;
  maxScore: number;
  percentage: number;
  completedAt: string;
}

export interface HistoryStatsResponse {
  totalAttempts: number;
  completedAttempts: number;
  inProgressAttempts: number;
  failedAttempts?: number;
  averageScore: number | null;
  highestScore: number | null;
  totalPracticeMinutes: number;
  currentStreak: number;
  targetAchievedCount: number;
  recentScoreTrends: ScoreTrendItem[];
}

export interface HistoryAttemptItem {
  attemptId: number;
  examId: number;
  examCode: string;
  examTitle: string;
  examType: string;
  examLanguage: string;
  isExamDeleted?: boolean;
  testMode: 'MOCK_TEST' | 'PRACTICE';
  testScope: 'FULL_EXAM' | 'SINGLE_SKILL' | 'SINGLE_PART';
  status: 'COMPLETED' | 'IN_PROGRESS' | 'GRADING_FAILED' | 'AI_GRADING' | 'AI_GRADING_QUEUED' | 'SUBMITTED' | 'EXPIRED' | string;
  startTime: string;
  endTime: string | null;
  timeSpentSeconds: number;
  durationMinutes: number;
  overallScore: number | null;
  maxScore: number;
  targetScore: number | null;
  targetAchieved: boolean | null;
  passed: boolean | null;
  accuracyPercentage: number | null;
}

export interface HistoryFilterParams {
  search?: string;
  cert?: string;
  mode?: string;
  status?: string;
  page?: number;
  size?: number;
  sort?: string;
}
