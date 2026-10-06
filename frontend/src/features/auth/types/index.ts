export interface UserResponse {
  id: string;
  email: string;
  fullName: string;
  avatarUrl?: string;
  role?: string;
  phone?: string;
  subscriptionTier?: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken?: string;
  user?: UserResponse;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  passwordHash: string;
  fullName: string;
  phone?: string;
}

export interface UpdateProfileRequest {
  fullName: string;
  phone?: string;
}

export interface ChangePasswordRequest {
  oldPassword: string;
  newPassword: string;
  confirmPassword: string;
}
