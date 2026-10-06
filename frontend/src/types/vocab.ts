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
