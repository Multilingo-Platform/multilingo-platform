export interface AdminDeck {
  id: number;
  name: string;
  description: string | null;
  targetLanguage: string;
  sourceLanguage: string;
  isPublic: boolean;
  clonesCount: number;
  ownerId: number | null;
  ownerName: string;
  ownerEmail: string | null;
  totalCards: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdminFlashcard {
  id: number;
  deckId: number;
  wordId: number | null;
  customWord: string;
  customMeaning: string | null;
  exampleSentence: string | null;
  customImageUrl: string | null;
  phonetic: string | null;
  pos: string | null;
  languageCode: string | null;
  status: string;
  reviewCount: number;
  easeFactor: number;
  intervalDays: number;
  nextReviewDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminDeckDetail extends AdminDeck {
  cards: AdminFlashcard[];
}

export interface AdminDeckFilterParams {
  keyword?: string;
  targetLanguage?: string;
  isPublic?: boolean;
  page?: number;
  size?: number;
  sort?: string;
}

export interface CreateDeckPayload {
  name: string;
  description?: string;
  targetLanguage?: string;
  sourceLanguage?: string;
  isPublic?: boolean;
}

export interface UpdateDeckPayload {
  name: string;
  description?: string;
  targetLanguage?: string;
  sourceLanguage?: string;
  isPublic?: boolean;
}

export interface CreateCardPayload {
  customWord: string;
  customMeaning?: string;
  exampleSentence?: string;
  customImageUrl?: string;
  phonetic?: string;
  pos?: string;
  level?: string;
}

export interface PageResponse<T> {
  items: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  last: boolean;
}

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

