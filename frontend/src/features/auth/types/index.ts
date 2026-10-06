export interface User {
  id: number;
  email: string;
  fullName: string;
  roles?: string[];
}

export interface AuthResponse {
  accessToken: string;
  refreshToken?: string;
  user: User;
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
