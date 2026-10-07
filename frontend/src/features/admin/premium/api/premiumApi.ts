import axiosClient from '../../../../core/api/axiosClient';
import type { SubscriptionPlan, SubscriptionPlanRequest } from '../types';

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export const premiumApi = {
  getAllPlans: async () => {
    const res = await axiosClient.get<any, ApiResponse<SubscriptionPlan[]>>('/admin/plans');
    return res;
  },
  createPlan: async (data: SubscriptionPlanRequest) => {
    const res = await axiosClient.post<any, ApiResponse<SubscriptionPlan>>('/admin/plans', data);
    return res;
  },
  updatePlan: async (id: number, data: SubscriptionPlanRequest) => {
    const res = await axiosClient.put<any, ApiResponse<SubscriptionPlan>>(`/admin/plans/${id}`, data);
    return res;
  },
  changeStatus: async (id: number, isActive: boolean) => {
    const res = await axiosClient.patch<any, ApiResponse<SubscriptionPlan>>(`/admin/plans/${id}/status?isActive=${isActive}`);
    return res;
  }
};
