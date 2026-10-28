import axiosClient from '../../../core/api/axiosClient';
import type { 
  ApiResponse, 
  PageResponse, 
  HistoryStatsResponse, 
  HistoryAttemptItem, 
  HistoryFilterParams 
} from '../types/history.types';

export const historyApi = {
  getStats: async (): Promise<ApiResponse<HistoryStatsResponse>> => {
    return axiosClient.get('/v1/student/history/stats');
  },

  getHistory: async (params?: HistoryFilterParams): Promise<ApiResponse<PageResponse<HistoryAttemptItem>>> => {
    return axiosClient.get('/v1/student/history', { params });
  },
};
