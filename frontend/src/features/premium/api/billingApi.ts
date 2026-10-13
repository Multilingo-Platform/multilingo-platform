import axiosClient from '../../../core/api/axiosClient';
import type { PageResponse, PurchaseHistoryItem } from '../types/billing';

export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

export const billingApi = {
  getPurchaseHistory: async (page = 0, size = 20): Promise<ApiResponse<PageResponse<PurchaseHistoryItem>>> => {
    const res: any = await axiosClient.get(`/v1/billing/my-history?page=${page}&size=${size}`);
    return res;
  },
};
