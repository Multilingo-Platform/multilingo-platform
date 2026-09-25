# 🎨 Multilingo Platform - Quy Tắc Kiến Trúc Frontend

## Tech Stack
- React 19, TypeScript, Vite 8, TailwindCSS v4, Redux Toolkit, React Router DOM v7, Axios.
- Linter: Oxlint.

## Gọi API
- **BẮT BUỘC** sử dụng `axiosClient` tại `frontend/src/api/axiosClient.ts`.
- `axiosClient` đã unwrap `response.data` và đính kèm Bearer token tự động.
- Base URL mặc định: `http://localhost:8080/api` (có thể override qua `VITE_API_URL`).

## Type-Safe API Response
- Khai báo interface `ApiResponse<T>` đồng bộ với Backend:
  ```typescript
  interface ApiResponse<T> {
    success: boolean;
    code: number;
    message: string;
    data: T;
    timestamp: string;
  }
  ```

## Routing
- Sử dụng React Router v7 (`BrowserRouter`).
- Route phải hoạt động đúng khi F5 trên cả Vite Dev (`localhost:5173`) và Nginx Docker (`localhost:3000`).

## Dev Proxy
- Vite dev server proxy `/api` -> `http://localhost:8080`.
- Trong môi trường dev KHÔNG nên gọi trực tiếp `http://localhost:8080/api`, chỉ dùng đường dẫn tương đối `/api`.

## Kiểm tra trước khi commit
- `npm run lint` phải đạt 0 warnings, 0 errors.
- `npm run build` (TypeScript + Vite build) phải thành công.
