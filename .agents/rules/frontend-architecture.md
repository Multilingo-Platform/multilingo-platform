# 🎨 Multilingo Platform - Quy Tắc Kiến Trúc Frontend

## Tech Stack
- React 19, TypeScript, Vite 8, TailwindCSS v4, Redux Toolkit, React Router DOM v7, Axios.
- Linter: Oxlint.

## Cấu trúc thư mục (Feature-based Architecture)
- Bắt buộc chia kiến trúc theo Feature (Feature-Sliced Design thu gọn).
- `src/app/`: Chứa config cốt lõi như `store.ts`, `hooks.ts`, `App.tsx`, cấu hình Router.
- `src/core/`: Chứa config chung như `api/axiosClient.ts`, utils, constants không dính dáng đến UI.
- `src/components/`: Chứa các Component dùng chung (Dumb/Presentational), ví dụ `common/` (Button, Input) và `layout/`.
- `src/features/`: Nơi chứa toàn bộ logic theo tính năng. Mỗi tính năng là 1 folder độc lập (ví dụ `features/auth/`, `features/exams/`). Bên trong mỗi feature sẽ có các folder con:
  - `api/`: Các hàm gọi API riêng cho feature đó.
  - `components/`: UI Component đặc thù chỉ dùng trong feature.
  - `pages/`: Các trang giao diện (có thể chia nhỏ thành `admin/` và `student/`).
  - `slices/` (tuỳ chọn): Redux state riêng của tính năng.
  - `types.ts` (tuỳ chọn): Định nghĩa các kiểu dữ liệu TS.

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
- BẮT BUỘC sử dụng Data Router (`createBrowserRouter` / Object-based routing) của React Router v7.
- Khai báo route tập trung tại `src/app/router.tsx` và dùng `<RouterProvider>` để render.
- Khuyến khích sử dụng `loader` để lấy dữ liệu trước khi render (Render-as-you-fetch) và `errorElement` để bắt lỗi.
- Route phải hoạt động đúng khi F5 trên cả Vite Dev (`localhost:5173`) và Nginx Docker (`localhost:3000`).

## Dev Proxy
- Vite dev server proxy `/api` -> `http://localhost:8080`.
- Trong môi trường dev KHÔNG nên gọi trực tiếp `http://localhost:8080/api`, chỉ dùng đường dẫn tương đối `/api`.

## Kiểm tra trước khi commit
- `npm run lint` phải đạt 0 warnings, 0 errors.
- `npm run build` (TypeScript + Vite build) phải thành công.
