import type { AttemptStatus, PartAnswers } from './answer.types';
import type { ExamSnapshot } from './exam.types';

export type TestScope = 'FULL_EXAM' | 'SINGLE_SKILL' | 'SINGLE_PART';
export type TestMode = 'MOCK_TEST' | 'PRACTICE';

export interface CreateAttemptRequest {
  exam_id: number;
  test_scope: TestScope;
  test_mode: TestMode;
  section_id: number | null;
  part_id: number | null;
}

export interface WorkspaceResponse {
  attempt_id: number;
  status: AttemptStatus;
  test_scope: TestScope;
  test_mode: TestMode;
  deadline: string | null;      // ISO-8601 UTC Instant; null for PRACTICE
  exam_snapshot: ExamSnapshot;  // Snapshot does NOT contain correct_answer
  version: number;
  saved_answers: PartAnswers[];
  lockedSections?: number[];
  /** ISO-8601 UTC Instant timestamp from server */
  serverTime?: string | null;
  /** ms: serverClock - clientClock at workspace fetch time. 0 if unknown. */
  serverTimeOffset: number;
}

export interface ApiResponse<T> {
  success: boolean;
  code: number;
  message: string;
  data: T | null;
  timestamp: string;
}

export interface AutosaveRequest {
  version: number;
  answers: PartAnswers[];
}

export interface SubmitResult {
  attempt_id: number;
  status: 'COMPLETED' | 'AI_GRADING';
  redirect_url: string;
}

export interface ExamResultResponse {
  attemptId: number;
  status: AttemptStatus;
  testScope: TestScope;
  testMode: TestMode;
  startTime: string;
  endTime: string;
  timeSpentSeconds: number;
  overallScore: number;
  resultSummary: {
    objective?: {
      scoreUnit: string;
      correct: number;
      incorrect: number;
      unanswered: number;
      total: number;
      accuracy: number;
      bySkill: Array<{
        skill: string;
        correct: number;
        incorrect: number;
        unanswered: number;
        total: number;
        accuracy: number;
      }>;
      byPart: Array<{
        partId: number;
        label: string;
        skill: string;
        correct: number;
        incorrect: number;
        unanswered: number;
        total: number;
      }>;
    };
    writing?: {
      status: string;
      tasks: Array<{
        partId: number;
        label: string;
        status: string;
        wordCount: number;
        score: number | null;
        maxScore: number;
      }>;
    };
  } | null;
}

export interface ExamReviewOption {
  id: number;
  content: string;
  isCorrect?: boolean;
}

export interface ExamReviewQuestion {
  id: number;
  content: string;
  explanation?: string | null;
  options?: ExamReviewOption[];
  [key: string]: any;
}

export interface ExamReviewPartData {
  id?: number;
  partNumber?: number;
  title?: string;
  name?: string;
  questions?: ExamReviewQuestion[];
  [key: string]: any;
}

export interface ExamReviewResponse {
  attemptId: number;
  partId: number;
  partResult?: {
    score?: number;
    correctCount?: number;
    totalQuestions?: number;
    isCorrectFlags?: Record<string, boolean>;
    [key: string]: any;
  } | null;
  userAnswers?: Record<string, any> | null;
  examData?: ExamReviewPartData | null;
  examSnapshot?: {
    questions?: ExamReviewQuestion[];
    [key: string]: any;
  } | null;
  isCorrectFlags?: Record<string, boolean>;
}
