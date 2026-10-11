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
  startTime: string;            // ISO-8601 UTC Instant
  deadline: string | null;      // ISO-8601 UTC Instant; null for PRACTICE
  serverTime: string;           // ISO-8601 UTC Instant timestamp from server
  gracePeriodSeconds: number;   // e.g. 15
  lockedSections: number[];     // array of locked section IDs
  exam_snapshot: ExamSnapshot;  // Snapshot does NOT contain correct_answer
  version: number;
  saved_answers: PartAnswers[];
  /** ms: serverClock - clientClock at workspace fetch time. */
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

export interface AutosaveResponse {
  version: number;
}

export interface SubmitResult {
  attempt_id: number;
  status: Exclude<AttemptStatus, 'IN_PROGRESS'>;
  redirect_url: string;
}

export interface ObjectiveResultStats {
  rawScore: number;
  correct: number;
  incorrect: number;
  unanswered: number;
  total: number;
  accuracy: number;
}

export type ResultWritingStatus = 'PENDING' | 'QUEUED' | 'FAILED' | 'UNAVAILABLE';

export interface ResultSummary {
  objective: ObjectiveResultStats & {
    scoreUnit: 'RAW_OBJECTIVE';
    bySkill: Array<ObjectiveResultStats & { skill: string }>;
    byPart: Array<ObjectiveResultStats & { partId: number; label: string; skill: string }>;
  };
  writing: {
    status: ResultWritingStatus;
    tasks: Array<{
      partId: number;
      questionId: string;
      label: string;
      status: ResultWritingStatus;
      wordCount: number;
      // TV3-11 exposes Writing metadata, not AI scores.
      score: null;
      maxScore: null;
    }>;
  } | null;
}

/** Validated UI projection; legacy grading fields are intentionally excluded. */
export interface ExamResultResponse {
  attemptId: number;
  status: Exclude<AttemptStatus, 'IN_PROGRESS'>;
  testScope: TestScope;
  testMode: TestMode;
  startTime: string;
  endTime: string | null;
  timeSpentSeconds: number | null;
  overallScore: number | null;
  summaryAvailable: boolean;
  resultSummary: ResultSummary | null;
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

export interface LearnerExamStructurePart {
  id: number;
  partNumber: number;
  title: string | null;
}

export interface LearnerExamStructureSection {
  id: number;
  skillType: string;
  title: string;
  durationMinutes: number | null;
  orderIndex: number;
  parts: LearnerExamStructurePart[];
}

export interface LearnerExamStructure {
  id: number;
  code: string;
  title: string;
  type: string;
  durationMinutes: number | null;
  sections: LearnerExamStructureSection[];
}
