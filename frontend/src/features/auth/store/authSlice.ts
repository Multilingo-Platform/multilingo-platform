import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { UserResponse, AuthResponse } from '../types';

interface AuthState {
  user: UserResponse | null;
  token: string | null;
  isAuthenticated: boolean;
}

const initialToken = localStorage.getItem('token');

const initialState: AuthState = {
  user: null, // Ideal logic: hydrate user info from token or an API call like /me
  token: initialToken,
  isAuthenticated: !!initialToken,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials: (
      state,
      action: PayloadAction<AuthResponse>
    ) => {
      const { user, accessToken } = action.payload;
      state.user = user || null;
      state.token = accessToken;
      state.isAuthenticated = true;
      localStorage.setItem('token', accessToken);
    },
    logout: (state) => {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
      localStorage.removeItem('token');
    },
    updateUser: (state, action: PayloadAction<UserResponse>) => {
      state.user = action.payload;
    },
  },
});

export const { setCredentials, logout, updateUser } = authSlice.actions;

export default authSlice.reducer;
