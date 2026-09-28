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
  workspace: ExamSnapshot;      // Snapshot không có correct_answer
  deadline: string | null;      // ISO 8601 UTC
  version: number;
  saved_answers: PartAnswers[];
}

export interface ApiResponse<T> {
  success: boolean;
  code: number;
  message: string;
  data: T | null;
  timestamp: string;
}
