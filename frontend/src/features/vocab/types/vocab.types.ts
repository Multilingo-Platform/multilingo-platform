export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

export interface LanguageOption {
  code: string;
  name: string;
  shortLabel: string;
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'en', name: 'Tiếng Anh (English)', shortLabel: 'EN' },
  { code: 'vi', name: 'Tiếng Việt', shortLabel: 'VI' },
  { code: 'ko', name: 'Tiếng Hàn (한국어)', shortLabel: 'KO' },
  { code: 'zh', name: 'Tiếng Trung (中文)', shortLabel: 'ZH' },
  { code: 'ja', name: 'Tiếng Nhật (日本語)', shortLabel: 'JA' },
  { code: 'fr', name: 'Tiếng Pháp (Français)', shortLabel: 'FR' },
  { code: 'de', name: 'Tiếng Đức (Deutsch)', shortLabel: 'DE' },
  { code: 'es', name: 'Tiếng Tây Ban Nha (Español)', shortLabel: 'ES' },
];

export interface DeckSummary {
  id: number;
  name: string;
  description?: string;
  targetLanguage: string;
  sourceLanguage: string;
  isPublic: boolean;
  totalCards: number;
  newCards: number;
  learningCards: number;
  masteredCards: number;
  dueTodayCards: number;
  createdAt?: string;
}

export interface Flashcard {
  id: number;
  deckId: number;
  customWord: string;
  customMeaning: string;
  exampleSentence?: string;
  customImageUrl?: string;
  wordId?: number;
  phonetic?: string;
  pos?: string;
  level?: string;
  languageCode?: string;
  defaultMeaning?: Record<string, string>;
  status: 'NEW' | 'LEARNING' | 'REVIEW' | 'MASTERED';
  reviewCount: number;
  easeFactor: number;
  intervalDays: number;
  nextReviewDate?: string;
  createdAt?: string;
}

export interface DeckDetail {
  id: number;
  userId: number;
  name: string;
  description?: string;
  targetLanguage: string;
  sourceLanguage: string;
  isPublic: boolean;
  clonesCount: number;
  totalCards: number;
  cards: Flashcard[];
  createdAt?: string;
  updatedAt?: string;
}

export interface DeckResponse {
  id: number;
  userId: number;
  name: string;
  description?: string;
  targetLanguage: string;
  sourceLanguage: string;
  isPublic: boolean;
  clonesCount: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateDeckRequest {
  name: string;
  description?: string;
  targetLanguage?: string;
  sourceLanguage?: string;
  isPublic?: boolean;
}

export interface UpdateDeckRequest {
  name: string;
  description?: string;
  targetLanguage?: string;
  sourceLanguage?: string;
  isPublic?: boolean;
}

export interface CreateFlashcardRequest {
  customWord: string;
  customMeaning?: string;
  exampleSentence?: string;
  customImageUrl?: string;
  wordId?: number;
  phonetic?: string;
  pos?: string;
  level?: string;
}

export interface UpdateFlashcardRequest {
  customWord: string;
  customMeaning: string;
  exampleSentence?: string;
  customImageUrl?: string;
  phonetic?: string;
  pos?: string;
  level?: string;
}

// ==========================================
// Chế độ 1: Ôn tập Flashcard SRS (UC12.2)
// ==========================================
export interface StudySessionCardDto {
  id: number;
  customWord: string;
  phonetic?: string;
  pos?: string;
  maskedSentence?: string;
  customMeaning: string;
  fullSentence?: string;
  customImageUrl?: string;
  reviewCount: number;
  status: string;
}

export interface StudySessionResponse {
  deckId: number;
  deckName: string;
  targetLanguage: string;
  sourceLanguage: string;
  totalSessionCards: number;
  cards: StudySessionCardDto[];
}

export interface ReviewCardRequest {
  rating: 'REMEMBERED' | 'FORGOTTEN';
}

export interface CardReviewResponse {
  cardId: number;
  status: string;
  easeFactor: number;
  intervalDays: number;
  reviewCount: number;
  nextReviewDate: string;
}

export interface FinishStudySessionRequest {
  cardsReviewed: number;
  cardsRemembered: number;
  cardsForgotten: number;
  durationSeconds?: number;
}

export interface StudySessionSummaryResponse {
  earnedXp: number;
  currentStreak: number;
  totalMasteredCards: number;
  cardsReviewed: number;
}

// ==========================================
// Chế độ 2: Ghép từ & Trắc nghiệm (UC12.3)
// ==========================================
export interface QuizOption {
  key: string; // 'A' | 'B' | 'C' | 'D'
  text: string;
  isCorrect: boolean;
}

export interface QuizQuestion {
  questionNumber: number;
  cardId: number;
  targetWord: string;
  phonetic?: string;
  pos?: string;
  sentence?: string;
  options: QuizOption[];
  explanation: string;
}

// ==========================================
// Chế độ 3: Trò chơi Ghép thẻ tốc độ 60s (UC12.5)
// ==========================================
export interface MatchTile {
  id: string; // e.g. "word-101", "meaning-101"
  cardId: number;
  text: string;
  type: 'WORD' | 'MEANING';
  isMatched: boolean;
}

// ==========================================
// Chế độ 4: Thi thử từ vựng (UC12.4)
// ==========================================
export interface TestQuestion {
  questionNumber: number;
  cardId: number;
  questionText: string;
  options: { key: string; text: string }[];
  correctKey: string;
  targetWord: string;
  correctMeaning: string;
}

export interface TestAnswerState {
  questionNumber: number;
  selectedKey?: string;
}
