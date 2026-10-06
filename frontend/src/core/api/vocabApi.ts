import axiosClient from './axiosClient';
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
} from '../../types/vocab';

export const vocabApi = {
  // --- Quản lý Bộ thẻ (Flashcard Decks) ---
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

  // --- Quản lý Thẻ Từ vựng (Flashcards) ---
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
};
