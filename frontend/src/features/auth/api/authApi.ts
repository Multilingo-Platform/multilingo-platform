import axiosClient from '../../../core/api/axiosClient';
import type { LoginRequest, RegisterRequest, AuthResponse } from '../types';

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export const authApi = {
  login: async (data: LoginRequest) => {
    const res = await axiosClient.post<any, ApiResponse<AuthResponse>>('/auth/login', data);
    return res;
  },
  register: async (data: RegisterRequest) => {
    const res = await axiosClient.post<any, ApiResponse<null>>('/users', data);
    return res;
  },
  logout: async () => {
    const res = await axiosClient.post<any, ApiResponse<null>>('/auth/logout');
    return res;
  }
};
