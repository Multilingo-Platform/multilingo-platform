import axiosClient from '../../../../core/api/axiosClient';
import type { StudentDashboardData } from '../types/dashboard.types';

export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

export const studentDashboardApi = {
  getDashboard: async (timeRange: string = 'THIS_WEEK', year?: number): Promise<StudentDashboardData> => {
    const params: Record<string, string | number> = { timeRange };
    if (year) {
      params.year = year;
    }
    const res: any = await axiosClient.get('/v1/student/dashboard', { params });
    return res.data;
  },
};
