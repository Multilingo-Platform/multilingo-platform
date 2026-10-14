import axiosClient from '../../../core/api/axiosClient';
import type { LoginRequest, GoogleLoginRequest, RegisterRequest, AuthResponse, UserResponse, UpdateProfileRequest, ChangePasswordRequest } from '../types';

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
  loginWithGoogle: async (data: GoogleLoginRequest) => {
    const res = await axiosClient.post<any, ApiResponse<AuthResponse>>('/auth/google', data);
    return res;
  },
  register: async (data: RegisterRequest) => {
    const res = await axiosClient.post<any, ApiResponse<null>>('/users', data);
    return res;
  },
  logout: async () => {
    const token = localStorage.getItem('token');
    const res = await axiosClient.post<any, ApiResponse<null>>('/auth/logout', token ? { token } : {});
    return res;
  },
  getMyInfo: async () => {
    const res = await axiosClient.get<any, ApiResponse<UserResponse>>('/users/me');
    return res;
  },
  updateMyInfo: async (data: UpdateProfileRequest) => {
    const res = await axiosClient.put<any, ApiResponse<UserResponse>>('/users/me', data);
    return res;
  },
  changePassword: async (data: ChangePasswordRequest) => {
    const res = await axiosClient.put<any, ApiResponse<null>>('/users/me/password', data);
    return res;
  }
};
