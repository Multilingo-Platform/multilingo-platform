import axiosClient from '../../../core/api/axiosClient';
import type {
  ApiResponse,
  DeckSummary,
  DeckDetail,
  DeckResponse,
  Flashcard,
  CreateDeckRequest,
  UpdateDeckRequest,
  CreateFlashcardRequest,
  UpdateFlashcardRequest,
  StudySessionResponse,
  ReviewCardRequest,
  CardReviewResponse,
  FinishStudySessionRequest,
  StudySessionSummaryResponse,
} from '../types/vocab.types';

export const vocabApi = {
  // ==========================================
  // 1. Quản lý Bộ thẻ (Flashcard Decks)
  // ==========================================
  getDecks: async (): Promise<DeckSummary[]> => {
    const res = (await axiosClient.get('/v1/vocab/decks')) as unknown as ApiResponse<DeckSummary[]>;
    return res.data;
  },

  getDeckDetail: async (deckId: number): Promise<DeckDetail> => {
    const res = (await axiosClient.get(`/v1/vocab/decks/${deckId}`)) as unknown as ApiResponse<DeckDetail>;
    return res.data;
  },

  createDeck: async (data: CreateDeckRequest): Promise<DeckResponse> => {
    const res = (await axiosClient.post('/v1/vocab/decks', data)) as unknown as ApiResponse<DeckResponse>;
    return res.data;
  },

  updateDeck: async (deckId: number, data: UpdateDeckRequest): Promise<DeckResponse> => {
    const res = (await axiosClient.put(`/v1/vocab/decks/${deckId}`, data)) as unknown as ApiResponse<DeckResponse>;
    return res.data;
  },

  deleteDeck: async (deckId: number): Promise<void> => {
    await axiosClient.delete(`/v1/vocab/decks/${deckId}`);
  },

  // ==========================================
  // 2. Quản lý Thẻ Từ vựng (Flashcards)
  // ==========================================
  getCardsInDeck: async (
    deckId: number,
    keyword?: string,
    status?: string
  ): Promise<Flashcard[]> => {
    const params: Record<string, string> = {};
    if (keyword && keyword.trim()) params.keyword = keyword.trim();
    if (status && status !== 'ALL') params.status = status;

    const res = (await axiosClient.get(`/v1/vocab/decks/${deckId}/cards`, {
      params,
    })) as unknown as ApiResponse<Flashcard[]>;
    return res.data;
  },

  addCard: async (deckId: number, data: CreateFlashcardRequest): Promise<Flashcard> => {
    const res = (await axiosClient.post(`/v1/vocab/decks/${deckId}/cards`, data)) as unknown as ApiResponse<Flashcard>;
    return res.data;
  },

  updateCard: async (cardId: number, data: UpdateFlashcardRequest): Promise<Flashcard> => {
    const res = (await axiosClient.put(`/v1/vocab/cards/${cardId}`, data)) as unknown as ApiResponse<Flashcard>;
    return res.data;
  },

  deleteCard: async (cardId: number): Promise<void> => {
    await axiosClient.delete(`/v1/vocab/cards/${cardId}`);
  },

  // ==========================================
  // 3. Chế độ Ôn tập Flashcard SRS (UC12.2)
  // ==========================================
  getStudySession: async (deckId: number): Promise<StudySessionResponse> => {
    const res = (await axiosClient.get(`/v1/vocab/decks/${deckId}/study-session`)) as unknown as ApiResponse<StudySessionResponse>;
    return res.data;
  },

  reviewCard: async (cardId: number, data: ReviewCardRequest): Promise<CardReviewResponse> => {
    const res = (await axiosClient.post(`/v1/vocab/cards/${cardId}/review`, data)) as unknown as ApiResponse<CardReviewResponse>;
    return res.data;
  },

  finishSession: async (
    deckId: number,
    data: FinishStudySessionRequest
  ): Promise<StudySessionSummaryResponse> => {
    const res = (await axiosClient.post(
      `/v1/vocab/decks/${deckId}/finish-session`,
      data
    )) as unknown as ApiResponse<StudySessionSummaryResponse>;
    return res.data;
  },
};
