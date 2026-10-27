# Tiêu Chí Nghiệm Thu & Thiết Kế Kiểm Thử: Nâng Cấp Trang Lịch Sử Làm Bài

> **Mã tính năng:** `FEAT_STUDENT_TEST_HISTORY`  
> **Tài liệu Spec:** [docs/superpowers/specs/2026-10-25-test-history-upgrade-spec.md](file:///d:/IT4/PTPMMNM/multilingo-platform/docs/superpowers/specs/2026-10-25-test-history-upgrade-spec.md)  
> **Ngày tạo:** 2026-10-25  

---

## Bước 1: Phân Tích Phạm Vi & Tác Nhân (Scope & Actors)

### 1. Persona & Actors
- **Học viên đã đăng nhập (`STUDENT` / `USER`):** Có thể xem toàn bộ lịch sử thi thử và luyện tập của chính mình, xem thống kê tiến độ, xu hướng điểm số và các thao tác (Xem kết quả, Làm lại, Tiếp tục).
- **Khách vãng lai (`ANONYMOUS`):** Bị chặn ở `ProtectedRoute`, tự động chuyển hướng đến `/login`.
- **Học viên khác:** Không được phép xem lịch sử của người dùng khác (chống IDOR).

### 2. Ranh giới phạm vi (Scope Boundaries)
- **In-Scope:**
  - API Backend lấy thống kê tổng hợp (`/api/v1/student/history/stats`) và danh sách lượt thi phân trang (`/api/v1/student/history`).
  - Lọc theo chứng chỉ (`IELTS`, `TOEIC`, `NLTV`), chế độ (`MOCK_TEST`, `PRACTICE`), trạng thái (`COMPLETED`, `IN_PROGRESS`).
  - Tìm kiếm theo tên đề thi, sắp xếp theo thời gian hoặc điểm số.
  - Hiển thị 4 KPI Cards và biểu đồ xu hướng điểm số (Score Trend Chart).
  - Điều hướng chính xác: Xem kết quả (`/attempts/:id/result`), Tiếp tục làm dở (`/attempts/:id/workspace`), Làm lại (`/student/exam/:examId`).
- **Out-of-Scope:**
  - Xóa hoặc chỉnh sửa lịch sử làm bài (lịch sử thi là bất biến - immutable audit trail).
  - Xuất báo cáo dạng PDF (để dành cho giai đoạn tiếp theo).

---

## Bước 2: Tiêu Chí Nghiệm Thu (Acceptance Criteria - AC)

### 1. Kịch bản Gherkin

#### AC-01: Hiển thị Thống Kê & KPI Cards của học viên
```gherkin
Kịch bản: Học viên đã đăng nhập xem tổng quan thống kê học tập
Given Học viên đã đăng nhập vào hệ thống và truy cập trang "/student/history"
When Trang lịch sử làm bài tải xong
Then Hệ thống hiển thị 4 KPI Cards:
  | Thẻ | Dữ liệu hiển thị |
  | Tổng bài đã làm | Số lượng bài thi hoàn thành / đang làm |
  | Điểm trung bình | Điểm số trung bình các bài thi đã làm |
  | Thời gian luyện tập | Tổng thời gian (Giờ/Phút) tích lũy |
  | Chuỗi ngày học | Số ngày học liên tục (Streak) |
And Biểu đồ xu hướng điểm số (Score Trend Chart) hiển thị các điểm thi gần nhất theo trục thời gian
```

#### AC-02: Lọc & Tìm kiếm danh sách lượt thi
```gherkin
Kịch bản: Lọc lịch sử theo chứng chỉ TOEIC và trạng thái Hoàn thành
Given Học viên có nhiều lượt thi cả IELTS, TOEIC và NLTV
When Học viên chọn tab "TOEIC" và chọn chip trạng thái "Đã làm"
Then Danh sách chỉ hiển thị các lượt thi có examType thuộc TOEIC và status = "COMPLETED"
And Số lượng kết quả hiển thị được cập nhật tương ứng
```

#### AC-03: Thao tác Tiếp tục làm bài đối với lượt thi dở dang
```gherkin
Kịch bản: Học viên bấm tiếp tục làm bài thi đang thực hiện
Given Học viên có một lượt thi ở trạng thái "IN_PROGRESS"
When Học viên bấm vào nút "Tiếp tục làm bài" trên thẻ lượt thi đó
Then Hệ thống điều hướng học viên đến "/attempts/{attemptId}/workspace"
And Trạng thái câu trả lời đã lưu trước đó được phục hồi nguyên vẹn
```

#### AC-04: Thao tác Xem kết quả chi tiết đối với bài thi đã nộp
```gherkin
Kịch bản: Học viên xem lại bảng điểm và phân tích bài thi đã nộp
Given Học viên có một lượt thi ở trạng thái "COMPLETED"
When Học viên bấm vào thẻ hoặc nút "Xem chi tiết kết quả"
Then Hệ thống điều hướng đến "/attempts/{attemptId}/result"
And Hiển thị chi tiết bảng điểm, câu đúng/sai và nhận xét AI
```

### 2. Checklist Quy tắc nghiệp vụ (Business Rules Checklist)
- [x] **Quyền sở hữu (Ownership):** Chỉ trả về dữ liệu `test_attempts` thuộc về `userId` của token hiện tại. Không bao giờ lộ lượt thi của user khác.
- [x] **Định dạng điểm số:**
  - IELTS: Hiển thị Band thập phân 1 chữ số (ví dụ: `7.5 / 9.0`).
  - TOEIC: Hiển thị số nguyên (ví dụ: `820 / 990`).
  - NLTV: Hiển thị theo Bậc (ví dụ: `Bậc 4 (B2)` hoặc `6.5 / 10.0`).
- [x] **Thời gian làm bài:** Quy đổi từ `timeSpentSeconds` sang định dạng thân thiện (`45 phút`, `1 giờ 15 phút`).
- [x] **Xử lý rỗng (Empty State):** Nếu học viên mới chưa làm bài nào, hiển thị thông báo khích lệ kèm nút bấm dẫn sang Thư viện đề thi (`/student/library`).

---

## Bước 3: Ma Trận Kiểm Thử 6 Khía Cạnh (Comprehensive Test Matrix)

| Khía cạnh | Tình huống kiểm thử | Kết quả mong đợi |
| :--- | :--- | :--- |
| **1. Happy Path** | Học viên có 10 bài thi, vào xem danh sách, lọc chứng chỉ, chuyển trang | Dữ liệu hiển thị mượt mà, phân trang đúng, số liệu KPI chính xác |
| **2. Negative** | Người dùng chưa đăng nhập gọi API `/api/v1/student/history` | Trả về HTTP 401 Unauthorized, frontend điều hướng về `/login` |
| **3. Boundary** | Học viên vừa hoàn thành bài thi đầu tiên (1 lượt thi) | KPI hiển thị tổng bài = 1, điểm TB = điểm bài thi đó, Trend Chart vẽ 1 điểm |
| **4. Edge Cases** | Bài thi có `timeSpentSeconds = 0` hoặc chưa kết thúc (`status = IN_PROGRESS`) | Thời gian hiển thị `< 1 phút`, điểm số để trống hoặc ghi "Chưa nộp" |
| **5. Security** | Cố tình truyền `userId` của người khác hoặc chỉnh sửa token | Backend chỉ lấy `userId` từ token xác thực, chặn đứng hoàn toàn IDOR |
| **6. UI/UX** | Màn hình tải dữ liệu hoặc mạng chậm | Hiển thị Skeleton/Spinner tải dữ liệu, không vỡ layout, responsive trên mobile |

---

## Bước 4: Bảng Test Cases Chuẩn Hóa 7 Cột

| Mã TC | Phân loại | Mô tả kịch bản kiểm thử | Tiền điều kiện | Các bước thực hiện | Dữ liệu kiểm thử | Kết quả mong đợi |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TC_HIST_STATS_01** | Happy Path | Lấy thống kê lịch sử của học viên thành công | Học viên đã có 5 lượt thi hoàn thành | 1. Gọi `GET /api/v1/student/history/stats` với token hợp lệ | Token user ID = 1 | - HTTP 200<br>- `totalAttempts = 5`<br>- `averageScore` tính đúng<br>- Danh sách trend có đủ 5 điểm |
| **TC_HIST_LIST_01** | Happy Path | Lọc danh sách lượt thi theo chứng chỉ IELTS | Học viên có lượt thi IELTS và TOEIC | 1. Gọi `GET /api/v1/student/history?cert=IELTS` | `cert=IELTS`, `page=0`, `size=10` | - HTTP 200<br>- Tất cả các item trả về đều có `examType` bắt đầu bằng `IELTS` |
| **TC_HIST_LIST_02** | Happy Path | Lọc lượt thi theo trạng thái IN_PROGRESS | Học viên có cả bài hoàn thành và đang làm dở | 1. Chọn chip "Đang làm dở" trên UI | `status=IN_PROGRESS` | - Danh sách chỉ hiển thị các bài chưa nộp<br>- Nút bấm là "Tiếp tục làm bài" |
| **TC_HIST_SEARCH_01** | Happy Path | Tìm kiếm lượt thi theo tên đề | Học viên có nhiều bài thi trong lịch sử | 1. Nhập từ khóa "Cambridge" vào ô tìm kiếm | `search=Cambridge` | - Danh sách chỉ hiển thị các bài có tiêu đề chứa "Cambridge" |
| **TC_HIST_SEC_01** | Security | Chặn truy cập lịch sử khi chưa đăng nhập | Không có token | 1. Gửi request đến `/api/v1/student/history` không header Authorization | Không kèm Bearer token | - HTTP 401 Unauthorized<br>- Không rò rỉ dữ liệu của bất kỳ ai |
| **TC_HIST_UI_01** | UI/UX | Hiển thị Empty State khi chưa có lượt thi nào | Học viên mới đăng ký tài khoản | 1. Truy cập `/student/history` | User ID mới | - Hiển thị minh họa "Chưa có lịch sử làm bài"<br>- Có nút "Khám phá Thư viện Đề thi" dẫn đến `/student/library` |
| **TC_HIST_NAV_01** | UI/UX | Điều hướng đúng khi click "Xem chi tiết" và "Tiếp tục" | Có các thẻ bài thi hiển thị | 1. Bấm vào bài hoàn thành<br>2. Quay lại, bấm vào bài làm dở | `attemptId = 12` (COMPLETED)<br>`attemptId = 15` (IN_PROGRESS) | - Bài 12 dẫn đến `/attempts/12/result`<br>- Bài 15 dẫn đến `/attempts/15/workspace` |
