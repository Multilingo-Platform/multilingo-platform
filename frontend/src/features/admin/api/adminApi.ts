import axiosClient from '../../../core/api/axiosClient';
import type {
  AdminUser,
  AdminUserDetail,
  UpdateUserStatusPayload,
  UserTrackingItem,
  ExamTrackingItem,
  UserQuotaItem,
  UpdateQuotaPayload,
  AuditLogItem,
  DashboardStats,
  RevenueChartData,
  AdminTransaction,
  PageResponse,
  ApiResponse,
} from '../types/adminTypes';

export const adminApi = {
  // 1. Dashboard
  getDashboardStats: async (): Promise<DashboardStats> => {
    const res = (await axiosClient.get('/admin/dashboard/stats')) as unknown as ApiResponse<DashboardStats>;
    return res.data;
  },

  getRevenueChart: async (period = '7d'): Promise<RevenueChartData> => {
    const res = (await axiosClient.get('/admin/dashboard/revenue-chart', {
      params: { period },
    })) as unknown as ApiResponse<RevenueChartData>;
    return res.data;
  },

  // 2. User Management
  getUsers: async (params?: {
    keyword?: string;
    isActive?: boolean;
    subscriptionTier?: string;
    page?: number;
    size?: number;
  }): Promise<PageResponse<AdminUser>> => {
    const res = (await axiosClient.get('/admin/users', {
      params,
    })) as unknown as ApiResponse<PageResponse<AdminUser>>;
    return res.data;
  },

  getUserDetail: async (userId: number): Promise<AdminUserDetail> => {
    const res = (await axiosClient.get(`/admin/users/${userId}`)) as unknown as ApiResponse<AdminUserDetail>;
    return res.data;
  },

  updateUserStatus: async (
    userId: number,
    payload: UpdateUserStatusPayload
  ): Promise<AdminUser> => {
    const res = (await axiosClient.patch(`/admin/users/${userId}/status`, payload)) as unknown as ApiResponse<AdminUser>;
    return res.data;
  },

  // 3. Tracking & Monitoring
  getUserTracking: async (params?: {
    keyword?: string;
    page?: number;
    size?: number;
  }): Promise<PageResponse<UserTrackingItem>> => {
    const res = (await axiosClient.get('/admin/tracking/users', {
      params,
    })) as unknown as ApiResponse<PageResponse<UserTrackingItem>>;
    return res.data;
  },

  getExamTracking: async (): Promise<ExamTrackingItem[]> => {
    const res = (await axiosClient.get('/admin/tracking/exams')) as unknown as ApiResponse<ExamTrackingItem[]>;
    return res.data;
  },

  // 4. Quota Configuration
  getAllQuotas: async (): Promise<UserQuotaItem[]> => {
    const res = (await axiosClient.get('/admin/quotas')) as unknown as ApiResponse<UserQuotaItem[]>;
    return res.data;
  },

  updateQuota: async (payload: UpdateQuotaPayload): Promise<UserQuotaItem> => {
    const res = (await axiosClient.put('/admin/quotas', payload)) as unknown as ApiResponse<UserQuotaItem>;
    return res.data;
  },

  // 5. Audit Logs
  getAuditLogs: async (params?: {
    userId?: number;
    action?: string;
    entityType?: string;
    fromDate?: string;
    toDate?: string;
    page?: number;
    size?: number;
  }): Promise<PageResponse<AuditLogItem>> => {
    const res = (await axiosClient.get('/admin/audit-logs', {
      params,
    })) as unknown as ApiResponse<PageResponse<AuditLogItem>>;
    return res.data;
  },

  getAuditLogDetail: async (id: number): Promise<AuditLogItem> => {
    const res = (await axiosClient.get(`/admin/audit-logs/${id}`)) as unknown as ApiResponse<AuditLogItem>;
    return res.data;
  },

  // 6. Transactions & Reconciliation
  getTransactions: async (params?: {
    vnpTxnRef?: string;
    status?: string;
    from?: string;
    to?: string;
    page?: number;
    size?: number;
  }): Promise<PageResponse<AdminTransaction>> => {
    const res = (await axiosClient.get('/admin/transactions', {
      params,
    })) as unknown as ApiResponse<PageResponse<AdminTransaction>>;
    return res.data;
  },

  getAllTransactionsForExport: async (params?: {
    vnpTxnRef?: string;
    status?: string;
    from?: string;
    to?: string;
  }): Promise<AdminTransaction[]> => {
    const res = (await axiosClient.get('/admin/transactions/export', {
      params,
    })) as unknown as ApiResponse<AdminTransaction[]>;
    return res.data;
  },
};
