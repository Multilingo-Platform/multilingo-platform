# Frontend Auth Integration Implementation Plan (UC001 - UC002)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tích hợp giao diện Đăng nhập và Đăng ký (Frontend) với các API Authentication của Spring Boot (Backend), đồng thời quản lý trạng thái phiên đăng nhập toàn cục bằng Redux Toolkit.

**Architecture:** Áp dụng chặt chẽ Feature-based Architecture (được quy định trong rule). Cấu trúc mã nguồn của module Auth (`api`, `store`, `components`, `pages`) sẽ nằm hoàn toàn bên trong `src/features/auth/`. Gọi API thông qua thư viện Axios (đã setup `axiosClient`) và quản lý state user bằng Redux Slice.

**Tech Stack:** React, Redux Toolkit, Axios, React Router Dom, Tailwind CSS.

**Spec:** `docs/DacTa/motaUC_Multilingo.md` (UC001, UC002)

## Global Constraints
- Tất cả API của auth phải gọi qua instance `axiosClient` đã được cấu hình tại `src/core/api/axiosClient.ts`.
- Sử dụng `createAsyncThunk` hoặc Redux Toolkit Query để dispatch hành động gọi API.
- Token (`accessToken`) phải được lưu trữ an toàn vào `localStorage` ngay khi đăng nhập thành công.
- Tuân thủ thiết kế giao diện (UI) hiện tại của file `LoginForm.tsx` và `RegisterForm.tsx`, chỉ bổ sung logic xử lý form và hook, không được làm hỏng CSS đang có.

## Review Focus
1. **Quản lý Token & Error Handling:** Khi gọi API đăng nhập thất bại (sai pass), form phải hiện thông báo lỗi rành mạch thay vì crash. Khi đăng xuất, token phải bị xóa sạch khỏi bộ nhớ.
2. **Form Validation & UX:** Ngăn chặn spam click nút Submit khi đang gọi API (loading state). Phải có validate độ dài/định dạng căn bản ở frontend trước khi gọi backend.
3. **Redirect Loop:** Việc tích hợp ProtectedRoute và lưu token vào Redux nếu bị lệch trạng thái dễ gây ra vòng lặp điều hướng liên tục. Cần test kỹ luồng sau khi đăng nhập thành công.

---

### Task 1: Định nghĩa cấu trúc dữ liệu và API calls (Auth API)

**Files:**
- Create: `src/features/auth/api/authApi.ts`
- Create: `src/features/auth/types/index.ts`

**Interfaces:**
- Produces: `AuthResponse`, `LoginRequest`, `RegisterRequest`, `User` interface.
- Produces: `authApi.login(req)`, `authApi.register(req)`, `authApi.logout()`.

- [ ] **Step 1: Tạo file định nghĩa types**
```typescript
// src/features/auth/types/index.ts
export interface User {
  id: number;
  email: string;
  fullName: string;
  roles: string[];
}

export interface AuthResponse {
  accessToken: string;
  refreshToken?: string;
  user: User;
}

export interface LoginRequest {
  email: string;
  passwordHash: string;
}

export interface RegisterRequest {
  email: string;
  passwordHash: string;
  fullName: string;
  phone?: string;
}
```

- [ ] **Step 2: Viết file gọi API với axiosClient**
```typescript
// src/features/auth/api/authApi.ts
import axiosClient from '../../../core/api/axiosClient';
import { LoginRequest, RegisterRequest, AuthResponse } from '../types';

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export const authApi = {
  login: async (data: LoginRequest) => {
    const res = await axiosClient.post<any, ApiResponse<AuthResponse>>('/v1/auth/login', data);
    return res;
  },
  register: async (data: RegisterRequest) => {
    const res = await axiosClient.post<any, ApiResponse<null>>('/v1/auth/register', data);
    return res;
  },
  logout: async () => {
    // Gọi API logout blacklist token (nếu backend yêu cầu)
    const res = await axiosClient.post<any, ApiResponse<null>>('/v1/auth/logout');
    return res;
  }
};
```

- [ ] **Step 3: Commit**
```bash
git add src/features/auth/types/index.ts src/features/auth/api/authApi.ts
git commit -m "feat(auth): add api endpoints and types for authentication"
```

---

### Task 2: Cài đặt Redux Slice để quản lý trạng thái Auth

**Files:**
- Create: `src/features/auth/store/authSlice.ts`
- Modify: `src/app/store.ts` (Giả sử file root store nằm ở đây, hoặc `src/store/index.ts`)

**Interfaces:**
- Consumes: `authApi.login`, `authApi.logout` từ Task 1.
- Produces: `authReducer`, `loginThunk`, `logoutAction`.

- [ ] **Step 1: Viết authSlice và Thunk**
```typescript
// src/features/auth/store/authSlice.ts
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { authApi } from '../api/authApi';
import { User, LoginRequest } from '../types';

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
}

const initialState: AuthState = {
  user: null,
  token: localStorage.getItem('token') || null,
  isLoading: false,
  error: null,
};

export const loginThunk = createAsyncThunk(
  'auth/login',
  async (credentials: LoginRequest, { rejectWithValue }) => {
    try {
      const response = await authApi.login(credentials);
      if (!response.success) return rejectWithValue(response.message);
      
      // Save token to localStorage
      localStorage.setItem('token', response.data.accessToken);
      return response.data;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.message || 'Đăng nhập thất bại');
    }
  }
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    logout: (state) => {
      state.user = null;
      state.token = null;
      localStorage.removeItem('token');
      // Tùy chọn: authApi.logout() background call
    },
    clearError: (state) => {
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(loginThunk.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loginThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        state.token = action.payload.accessToken;
        state.user = action.payload.user;
      })
      .addCase(loginThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
  },
});

export const { logout, clearError } = authSlice.actions;
export default authSlice.reducer;
```

- [ ] **Step 2: Đăng ký authReducer vào root store**
  (Kỹ sư chủ động tìm file `store.ts` và import `authReducer` vào `configureStore`).

- [ ] **Step 3: Commit**
```bash
git add src/features/auth/store/authSlice.ts
git commit -m "feat(auth): implement Redux slice for authentication state"
```

---

### Task 3: Cập nhật giao diện LoginForm (UC002)

**Files:**
- Modify: `src/features/auth/components/LoginForm.tsx`

**Interfaces:**
- Consumes: `loginThunk` từ `authSlice.ts`.
- Consumes: Giao diện tĩnh hiện tại của Form.

- [ ] **Step 1: Hook Redux vào form state**
```tsx
// Trong LoginForm.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { loginThunk, clearError } from '../store/authSlice';
import { AppDispatch, RootState } from '../../../app/store';

// Thêm state cục bộ và xử lý handleSubmit
const [email, setEmail] = useState('');
const [password, setPassword] = useState('');
const dispatch = useDispatch<AppDispatch>();
const navigate = useNavigate();
const { isLoading, error } = useSelector((state: RootState) => state.auth);

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  dispatch(clearError());
  
  const resultAction = await dispatch(loginThunk({ email, passwordHash: password }));
  if (loginThunk.fulfilled.match(resultAction)) {
    navigate('/student/dashboard'); // Redirect sau thành công
  }
};
```

- [ ] **Step 2: Hiển thị trạng thái Loading và Lỗi**
- Vô hiệu hóa (disable) nút Submit khi `isLoading === true`. Đổi text thành "Đang xử lý...".
- Render một thẻ `<div className="text-red-500 mb-4">{error}</div>` nếu `error` có giá trị.

- [ ] **Step 3: Commit**
```bash
git add src/features/auth/components/LoginForm.tsx
git commit -m "feat(auth): integrate backend API with LoginForm"
```

---

### Task 4: Cập nhật giao diện RegisterForm (UC001)

**Files:**
- Modify: `src/features/auth/components/RegisterForm.tsx`

**Interfaces:**
- Consumes: `authApi.register`.

- [ ] **Step 1: Quản lý Form State cho Register**
- Bổ sung state cục bộ cho `email`, `fullName`, `phone`, `password`, `confirmPassword`.
- Xử lý hàm `handleSubmit`:
  - Validate mật khẩu và confirm mật khẩu có khớp nhau không.
  - Gọi hàm `authApi.register(...)`.
  
- [ ] **Step 2: Xử lý Response từ API**
- Nếu API trả về thành công: Hiển thị Toast thông báo và `navigate('/login')`.
- Nếu thất bại: Bắt lỗi `catch` và hiển thị thông báo lỗi trên UI.
- Thêm `loading` state để vô hiệu hóa nút đăng ký khi đang gọi mạng.

- [ ] **Step 3: Commit**
```bash
git add src/features/auth/components/RegisterForm.tsx
git commit -m "feat(auth): integrate backend API with RegisterForm"
```
