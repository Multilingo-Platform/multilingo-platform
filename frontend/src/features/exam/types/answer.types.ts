export type AnswerValue = string | string[] | Record<string, string> | null;
export type AttemptStatus = 'IN_PROGRESS' | 'AI_GRADING' | 'COMPLETED';
export type WritingGradingStatus = 'PENDING' | 'GRADING' | 'COMPLETED' | 'FAILED';
export type CorrectnessFlag = 'CORRECT' | 'INCORRECT' | 'SKIPPED';

export interface UserAnswer {
  question_id: string;
  answer: AnswerValue;
}

export interface PartAnswers {
  part_id: number;
  answers: UserAnswer[];
}

export interface SaveDraftPayload {
  attempt_id: number;
  version: number;      // Optimistic locking
  parts: PartAnswers[];
}

export interface SkillStats {
  skill_type: string;
  correct_count: number;
  total_count: number;
  accuracy_percent: number;
}

export interface AttemptResult {
  attempt_id: number;
  status: AttemptStatus;
  total_correct: number;
  total_questions: number;
  overall_accuracy_percent: number;
  skill_stats: SkillStats[];
  time_spent_seconds: number;
  has_writing: boolean;
  writing_status: WritingGradingStatus | null;
}
