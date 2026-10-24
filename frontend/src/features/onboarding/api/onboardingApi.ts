import axiosClient from '../../../core/api/axiosClient';
import type { ApiResponse, OnboardingRequest, OnboardingResponse, OnboardingStatusResponse } from '../types';

export const onboardingApi = {
  getStatus: async (): Promise<ApiResponse<OnboardingStatusResponse>> => {
    return axiosClient.get('/v1/student/onboarding/status');
  },

  submitOnboarding: async (data: OnboardingRequest): Promise<ApiResponse<OnboardingResponse>> => {
    return axiosClient.post('/v1/student/onboarding', data);
  },
};
