export interface VocabTestOption {
  key: string;
  text: string;
}

export interface VocabTestQuestion {
  questionNumber: number;
  cardId: number;
  word: string;
  phonetic?: string;
  pos?: string;
  sentence?: string;
  options: VocabTestOption[];
}

export interface VocabTestExam {
  testToken: string;
  deckId: number;
  deckName: string;
  timeLimitSeconds: number;
  totalQuestions: number;
  startedAt: string;
  expiresAt: string;
  serverTime: string;
  questions: VocabTestQuestion[];
}

export interface VocabTestAnswerItem {
  questionNumber: number;
  selectedKey?: string | null;
  flagged?: boolean;
}

export interface VocabTestResumeResponse {
  testToken: string;
  deckId: number;
  deckName: string;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'TIMED_OUT';
  progressVersion: number;
  timeLimitSeconds: number;
  totalQuestions: number;
  startedAt: string;
  expiresAt: string;
  serverTime: string;
  deadlinePassed: boolean;
  questions: VocabTestQuestion[];
  savedAnswers: VocabTestAnswerItem[];
  resultSummary?: VocabTestResult | null;
}

export interface VocabTestResult {
  testToken: string;
  status: string;
  score: number;
  correctCount: number;
  totalQuestions: number;
  xpEarned: number;
  timeSpentSeconds: number;
  currentStreak: number;
  streakIncremented: boolean;
  submittedAt: string;
}

export interface VocabTestReviewItem {
  questionNumber: number;
  cardId: number;
  word: string;
  phonetic?: string;
  pos?: string;
  sentence?: string;
  options: VocabTestOption[];
  selectedKey?: string | null;
  correctKey: string;
  correct: boolean;
  explanation?: string;
}

export interface VocabTestReviewDetail {
  testToken: string;
  deckId: number;
  deckName: string;
  status: string;
  score: number;
  correctCount: number;
  totalQuestions: number;
  xpEarned: number;
  timeSpentSeconds: number;
  startedAt: string;
  submittedAt: string;
  reviewItems: VocabTestReviewItem[];
}

export interface VocabTestHistoryItem {
  id: number;
  testToken: string;
  deckId: number;
  deckName: string;
  status: string;
  score: number;
  correctCount: number;
  totalQuestions: number;
  xpEarned: number;
  timeSpentSeconds: number;
  startedAt: string;
  submittedAt: string;
  createdAt: string;
}
