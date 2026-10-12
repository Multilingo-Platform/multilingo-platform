import type { AttemptStatus, PartAnswers, AnswerValue } from './answer.types';
import type { ExamSnapshot, QuestionType } from './exam.types';

export type PracticeObjectiveType = Exclude<QuestionType, 'ESSAY'> | 'MATCHING';
export type PracticeVerdict = 'CORRECT' | 'WRONG' | 'BLANK';
export type ReviewScalar = string | number | boolean;

export interface PracticeFeedbackRequest {
  partId: number;
  questionId: string;
  answer: AnswerValue;
}

export interface PracticeFeedbackResponse {
  attemptId: number;
  partId: number;
  questionId: string;
  type: PracticeObjectiveType;
  userAnswer: AnswerValue;
  verdict: PracticeVerdict;
  score: number;
  correctAnswer: ReviewScalar | ReviewScalar[] | Record<string, ReviewScalar>;
  explanation: string | null;
}

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

export interface ReviewPartNavigation {
  id: number;
  label: string;
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
  reviewParts: ReviewPartNavigation[];
}

export type ReviewVerdict = 'CORRECT' | 'WRONG' | 'BLANK' | 'PENDING';

export interface ReviewOptionDto {
  id: string;
  text?: string;
  content?: string;
  isCorrect?: boolean | null;
}

export interface ReviewQuestionDto {
  questionId: string;
  type?: string;
  questionText?: string | null;
  prompt?: string | null;
  label?: string | null;
  explanation?: string | null;
  correctAnswer?: unknown;
  userAnswer?: unknown;
  verdict: ReviewVerdict;
  score?: number | null;
  options?: ReviewOptionDto[] | null;
  media?: Record<string, unknown> | null;
  id?: string | number;
  content?: string;
  isCorrect?: boolean | null;
  [key: string]: any;
}

export interface ReviewQuestionGroupDto {
  groupId?: string | null;
  instruction?: string | null;
  contentHtml?: string | null;
  sharedAudio?: Record<string, unknown> | null;
  sharedMedia?: Record<string, unknown> | null;
  questions?: ReviewQuestionDto[] | null;
}

export interface ReviewPartStatsDto {
  score: number;
  correctCount: number;
  incorrectCount: number;
  unansweredCount: number;
  totalQuestions: number;
  accuracy: number;
  isCorrectFlags?: Record<string, boolean> | null;
}

export interface ExamReviewOption {
  id: number;
  content: string;
  isCorrect?: boolean;
  [key: string]: any;
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
  partTitle?: string;
  skill?: string;
  partStats: ReviewPartStatsDto;
  userAnswers?: Record<string, any> | null;
  questions: ReviewQuestionDto[];
  questionGroups?: ReviewQuestionGroupDto[] | null;
  examData?: ExamReviewPartData | null;
  examSnapshot?: {
    questions?: ExamReviewQuestion[];
    [key: string]: any;
  } | null;
  partResult?: Record<string, any> | null;
  isCorrectFlags?: Record<string, boolean> | null;
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
