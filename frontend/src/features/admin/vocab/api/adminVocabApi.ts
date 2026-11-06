import axiosClient from '../../../../core/api/axiosClient';
import type {
  AdminDeck,
  AdminDeckDetail,
  AdminDeckFilterParams,
  AdminFlashcard,
  ApiResponse,
  CreateCardPayload,
  CreateDeckPayload,
  PageResponse,
  UpdateDeckPayload,
} from '../types/adminVocab.types';

export const adminVocabApi = {
  getDecks: async (params: AdminDeckFilterParams): Promise<PageResponse<AdminDeck>> => {
    const queryParams: Record<string, any> = {
      page: params.page ?? 0,
      size: params.size ?? 10,
    };
    if (params.keyword && params.keyword.trim()) {
      queryParams.keyword = params.keyword.trim();
    }
    if (params.targetLanguage && params.targetLanguage !== 'ALL') {
      queryParams.targetLanguage = params.targetLanguage;
    }
    if (params.isPublic !== undefined) {
      queryParams.isPublic = params.isPublic;
    }
    if (params.sort) {
      queryParams.sort = params.sort;
    }

    const res = (await axiosClient.get('/v1/admin/vocab/decks', {
      params: queryParams,
    })) as unknown as ApiResponse<PageResponse<AdminDeck>>;
    return res.data;
  },

  getDeckDetail: async (id: number): Promise<AdminDeckDetail> => {
    const res = (await axiosClient.get(
      `/v1/admin/vocab/decks/${id}`
    )) as unknown as ApiResponse<AdminDeckDetail>;
    return res.data;
  },

  createDeck: async (payload: CreateDeckPayload): Promise<AdminDeck> => {
    const res = (await axiosClient.post(
      '/v1/admin/vocab/decks',
      payload
    )) as unknown as ApiResponse<AdminDeck>;
    return res.data;
  },

  updateDeck: async (id: number, payload: UpdateDeckPayload): Promise<AdminDeck> => {
    const res = (await axiosClient.put(
      `/v1/admin/vocab/decks/${id}`,
      payload
    )) as unknown as ApiResponse<AdminDeck>;
    return res.data;
  },

  togglePublic: async (id: number): Promise<AdminDeck> => {
    const res = (await axiosClient.patch(
      `/v1/admin/vocab/decks/${id}/toggle-public`
    )) as unknown as ApiResponse<AdminDeck>;
    return res.data;
  },

  deleteDeck: async (id: number): Promise<void> => {
    await axiosClient.delete(`/v1/admin/vocab/decks/${id}`);
  },

  addCard: async (deckId: number, payload: CreateCardPayload): Promise<AdminFlashcard> => {
    const res = (await axiosClient.post(
      `/v1/admin/vocab/decks/${deckId}/cards`,
      payload
    )) as unknown as ApiResponse<AdminFlashcard>;
    return res.data;
  },

  deleteCard: async (cardId: number): Promise<void> => {
    await axiosClient.delete(`/v1/admin/vocab/decks/cards/${cardId}`);
  },
};

