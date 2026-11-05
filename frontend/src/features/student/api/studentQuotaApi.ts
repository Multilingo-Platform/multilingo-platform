import axiosClient from '../../../core/api/axiosClient';
import type { StudentQuotaItem } from '../types/studentQuota.types';

export const studentQuotaApi = {
  getMyQuotas: async (): Promise<StudentQuotaItem[]> => {
    const res: any = await axiosClient.get('/v1/student/quotas');
    return res.data;
  },
};

