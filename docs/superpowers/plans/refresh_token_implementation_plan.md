# Kế hoạch Triển khai Refresh Token

## 1. Kiến trúc lưu trữ Token
Trong các ứng dụng Web hiện đại, việc lưu trữ token cần đảm bảo tính bảo mật, đặc biệt là chống lại các tấn công XSS (Cross-Site Scripting) và CSRF (Cross-Site Request Forgery).

| Loại Token | Nơi lưu trữ khuyên dùng | Lý do & Đặc điểm bảo mật |
| :--- | :--- | :--- |
| **Access Token** | Bộ nhớ ứng dụng (Redux, React Context) hoặc Local Storage. | Do thời gian sống ngắn (15-30 phút), rủi ro lộ lọt thấp hơn. Lưu ở Local Storage dễ bị XSS nhưng tiện lợi khi refresh trang. |
| **Refresh Token** | **HttpOnly Secure Cookie** | 🔴 **Bắt buộc**. Cookie này có cờ `HttpOnly` (JavaScript không thể đọc được, chống XSS) và cờ `Secure` (chỉ gửi qua HTTPS). |

## 2. Cơ chế cấp Token mới (Refresh Mechanism)
Quá trình cấp lại token diễn ra hoàn toàn trong suốt (seamless) với người dùng:

1. **Đăng nhập (Login):** Người dùng đăng nhập thành công. Server trả về `Access Token` trong Body JSON và tự động gài `Refresh Token` vào một `HttpOnly Cookie`.
2. **Gọi API thông thường:** Frontend dùng `Access Token` gán vào header `Authorization: Bearer ...` để gọi các API bảo mật.
3. **Khi Access Token hết hạn:** Server trả về mã lỗi HTTP `401 Unauthorized`.
4. **Bắt lỗi & Refresh:** Frontend (thường dùng Axios Interceptor) bắt lỗi `401`, tạm giữ các request đang bị lỗi lại (vào queue), và gọi API `POST /api/v1/auth/refresh-token`. Request này trình duyệt sẽ tự động đính kèm `HttpOnly Cookie` chứa Refresh Token lên Server.
5. **Cấp mới:** Server kiểm tra Refresh Token hợp lệ (chưa hết hạn, tồn tại trong DB...). Nếu hợp lệ, cấp `Access Token` mới.
6. **Tiếp tục:** Frontend nhận Access Token mới, cập nhật lại cấu hình, và tự động gọi lại các request đang bị chờ ở bước 4. Người dùng không hề hay biết quá trình này.
7. **Trường hợp thất bại:** Nếu Refresh Token cũng hết hạn hoặc bị thu hồi, API refresh trả về `401/403`, Frontend điều hướng người dùng ra trang Đăng nhập (`/login`).

---

## 3. Kế hoạch triển khai chi tiết cho Multilingo Platform

Dưới đây là kế hoạch phân chia công việc (Tasks) cho Backend (Spring Boot) và Frontend (React):

### Giai đoạn 1: Backend (Spring Boot)

*   **Task 1.1: Thiết kế Database**
    *   Tạo bảng `refresh_tokens` với các trường: `id`, `token` (chuỗi UUID hoặc JWT), `user_id` (khóa ngoại), `expiry_date`, `is_revoked`. Bảng này giúp Server có quyền chủ động **thu hồi token** (ví dụ khi người dùng đổi mật khẩu hoặc đăng xuất ở mọi thiết bị).
    *   Tạo Entity `RefreshToken` kế thừa `BaseEntity`.

*   **Task 1.2: Cập nhật AuthService & JwtService**
    *   Thêm cấu hình `application.yml` cho thời gian sống: Access Token (15 phút), Refresh Token (7 ngày).
    *   Viết logic sinh Refresh Token, lưu vào Database và trả về cấu trúc đối tượng cookie.

*   **Task 1.3: Cập nhật các Controller (`AuthController`)**
    *   **Login API:** Cập nhật endpoint đăng nhập. Đóng gói `Refresh Token` thành `ResponseCookie` (set `httpOnly(true)`, `secure(true)`, `path("/api/v1/auth")`, `maxAge(7 days)`) và add vào Header `Set-Cookie` của response.
    *   **Refresh API:** Thêm endpoint `POST /api/v1/auth/refresh`. Dùng `@CookieValue("refresh_token")` để lấy token. Validate token trong DB, sinh `Access Token` mới và trả về Body JSON.
    *   **Logout API:** Lấy thông tin user hiện tại, xóa toàn bộ `RefreshToken` của user đó trong Database, đồng thời set một cookie mới đè lên cookie cũ với `maxAge(0)` để xóa cookie phía Client.

*   **Task 1.4: Cấu hình CORS**
    *   Đảm bảo cấu hình CORS trong Spring Security bật `allowCredentials(true)` và chỉ định rõ allowed origins (ví dụ: `http://localhost:3000` hoặc `http://localhost:5173`). Nếu không có cái này, Cookie không thể được trao đổi giữa 2 port khác nhau.

### Giai đoạn 2: Frontend (React / TypeScript)

*   **Task 2.1: Cấu hình Axios Instance**
    *   Trong file cấu hình Axios (vd: `src/shared/api/axiosClient.ts`), thiết lập `withCredentials: true` để trình duyệt tự động gửi và nhận cookie trong các API request tới Backend.

*   **Task 2.2: Triển khai Axios Interceptor**
    *   Tạo một biến cờ `isRefreshing = false` và một mảng `refreshSubscribers = []` để xử lý việc nhiều API cùng bị `401` một lúc.
    *   Bắt lỗi `401`: Nếu gặp lỗi `401` và request gốc **không phải** là `/login` hoặc `/refresh-token`:
        *   Nếu `isRefreshing` là false: Đặt lên true, gọi API `/refresh-token`. Khi có token mới, lưu vào trạng thái, duyệt qua mảng `refreshSubscribers` để thực hiện lại các request, rồi reset cờ.
        *   Nếu `isRefreshing` là true (đang có một request đi xin token rồi): Đẩy request hiện tại vào mảng `refreshSubscribers` qua một `Promise` và chờ.
        *   Nếu API `/refresh-token` thất bại: Gọi action Logout (clear user state, redirect về `/login`).

*   **Task 2.3: Xử lý State Management**
    *   Chỉ lưu `Access Token` vào bộ nhớ hoặc localStorage.
    *   Đảm bảo header `Authorization: Bearer {token}` luôn được cập nhật ở các request thông thường bằng token mới nhất.

### Giai đoạn 3: Kiểm thử (Testing)

*   **Backend:** Viết Unit Test & Integration Test cho các logic kiểm tra Refresh Token hết hạn, bị thu hồi.
*   **Frontend:** Mô phỏng tình huống Access Token hết hạn, gọi đồng thời 3 API bảo mật xem Interceptor có hoạt động chính xác (chỉ gọi 1 API refresh và chờ) hay không.
