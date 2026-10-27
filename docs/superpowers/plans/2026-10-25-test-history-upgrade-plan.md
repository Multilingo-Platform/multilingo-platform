# Implementation Plan: Nâng Cấp Toàn Diện Trang Lịch Sử Làm Bài (Test History)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thay thế toàn bộ dữ liệu mock bằng luồng API thực tế, bổ sung Dashboard thống kê chỉ số KPI, biểu đồ xu hướng điểm số (Score Trend Chart), bộ lọc đa tiêu chí và thẻ kết quả tương tác cao cấp cho trang Lịch sử làm bài.

**Architecture:** 
- Backend: Tạo phân hệ `history` trong student exam testing (`StudentHistoryController`, `StudentHistoryService`, mở rộng `TestAttemptRepository`) hỗ trợ phân trang, tìm kiếm, lọc theo chứng chỉ/chế độ/trạng thái và tổng hợp chỉ số học tập.
- Frontend: Xây dựng Feature-based UI tại `features/history/` gồm API client, Types, Component Thống kê KPI, Biểu đồ trực quan hóa xu hướng điểm số SVG và giao diện `TestHistory.tsx` đồng bộ với tông màu ấm áp của Multilingo.

**Tech Stack:** Spring Boot 3, Spring Data JPA, React 19, TypeScript, Lucide Icons, CSS Variables.

**Spec:** [docs/superpowers/specs/2026-10-25-test-history-upgrade-spec.md](file:///d:/IT4/PTPMMNM/multilingo-platform/docs/superpowers/specs/2026-10-25-test-history-upgrade-spec.md)  
**AC & Test Design:** [docs/superpowers/specs/2026-10-25-test-history-upgrade-AC.md](file:///d:/IT4/PTPMMNM/multilingo-platform/docs/superpowers/specs/2026-10-25-test-history-upgrade-AC.md)

---

## Global Constraints
- Primary Key của các Entity luôn là `Integer / INT`.
- Mọi Controller trả về `ResponseEntity<ApiResponse<T>>`.
- Lấy `userId` an toàn từ `@AuthenticationPrincipal CustomUserDetails`, nghiêm cấm tin cậy `userId` từ request body/params.
- Không tự ý thực hiện `git commit` nếu chưa hiển thị diff và được người dùng phê duyệt rõ ràng.

---

## Tasks

### Task 1: Backend DTOs & Mở rộng TestAttemptRepository
- [ ] **Step 1.1:** Tạo DTO thống kê `StudentHistoryStatsResponse.java` và `RecentScoreTrendItem.java` tại `backend/src/main/java/com/multilingo/backend/modules/testing/dto/response/`.
- [ ] **Step 1.2:** Tạo DTO lịch sử lượt thi `StudentHistoryItemResponse.java` tại `backend/src/main/java/com/multilingo/backend/modules/testing/dto/response/`.
- [ ] **Step 1.3:** Cập nhật `TestAttemptRepository.java`:
  - Thêm phương thức truy vấn `findUserAttempts(...)` với `JOIN Exam e ON a.examId = e.id`, lọc theo `search`, `certPrefix`, `mode`, `status` kèm phân trang `Pageable`.
  - Thêm phương thức `sumTimeSpentSecondsByUserId(@Param("userId") Integer userId)`.
  - Thêm phương thức `countTargetAchievedByUserId(@Param("userId") Integer userId)`.
  - Thêm phương thức `findTop10ByUserIdAndStatusOrderByEndTimeDesc(...)`.
- [ ] **Step 1.4:** Chạy `./mvnw compile` để đảm bảo không có lỗi cú pháp.

---

### Task 2: Backend Service & Controller với TDD
- [ ] **Step 2.1:** Khai báo interface `StudentHistoryService.java` với 2 hàm: `getStudentStats(Integer userId)` và `getStudentHistory(Integer userId, String search, String cert, String mode, String status, int page, int size, String sort)`.
- [ ] **Step 2.2:** Viết unit test `StudentHistoryServiceImplTest.java` tại `backend/src/test/java/com/multilingo/backend/modules/testing/service/impl/`:
  - Test `getStudentStats_ComputesAverageScoreAndTrendCorrectly`.
  - Test `getStudentHistory_AppliesCertificateAndStatusFilter`.
  - Test `getStudentHistory_ReturnsEmptyWhenNoAttempts`.
- [ ] **Step 2.3:** Triển khai `StudentHistoryServiceImpl.java` đáp ứng đầy đủ logic và vượt qua unit tests.
- [ ] **Step 2.4:** Tạo controller `StudentHistoryController.java` tại `backend/src/main/java/com/multilingo/backend/modules/testing/controller/` chứa 2 endpoints:
  - `GET /api/v1/student/history/stats`
  - `GET /api/v1/student/history`
- [ ] **Step 2.5:** Viết integration test `StudentHistoryControllerIT.java` xác nhận authentication và serialization.
- [ ] **Step 2.6:** Chạy `./mvnw test -Dtest=StudentHistoryServiceImplTest,StudentHistoryControllerIT` xác nhận 100% tests PASS.

---

### Task 3: Frontend Types & API Client
- [ ] **Step 3.1:** Tạo `frontend/src/features/history/types/history.types.ts` định nghĩa interface:
  - `HistoryStatsResponse`, `ScoreTrendItem`
  - `HistoryAttemptItem`, `HistoryFilterParams`
- [ ] **Step 3.2:** Tạo `frontend/src/features/history/api/historyApi.ts` gọi đến các endpoint `/v1/student/history/stats` và `/v1/student/history`.
- [ ] **Step 3.3:** Kiểm tra type checking với `npx tsc -b`.

---

### Task 4: Frontend UI Components (KPIs & Biểu Đồ Trend Chart)
- [ ] **Step 4.1:** Tạo `frontend/src/features/history/components/HistoryKpiCards.tsx`:
  - 4 cards cao cấp: Tổng bài đã làm, Điểm trung bình, Thời gian luyện tập, Chuỗi ngày học liên tục.
- [ ] **Step 4.2:** Tạo `frontend/src/features/history/components/ScoreTrendChart.tsx`:
  - Biểu đồ xu hướng điểm số SVG đường cong mềm mại với tooltip khi hover và nhãn ngày thi.
- [ ] **Step 4.3:** Tạo `frontend/src/features/history/pages/student/TestHistory.css`:
  - Phong cách đồng nhất với hệ thống Multilingo (màu cam hổ phách, card bo góc mượt mà, responsive, không khoảng hở Navbar).

---

### Task 5: Hoàn thiện Trang Lịch Sử Làm Bài & Verification
- [ ] **Step 5.1:** Cập nhật `frontend/src/features/history/pages/student/TestHistory.tsx`:
  - Tích hợp gọi API thực tế qua `historyApi`.
  - Tabs chứng chỉ: `[Tất Cả]`, `[IELTS]`, `[TOEIC]`, `[NLTV]`.
  - Chips chế độ (`MOCK_TEST` / `PRACTICE`) & Trạng thái (`COMPLETED` / `IN_PROGRESS`).
  - Search input với debounce và Sort dropdown (`Mới nhất` / `Điểm cao nhất`).
  - Thẻ lượt thi với vòng điểm số, badges và các nút hành động:
    * `Xem chi tiết kết quả` (nếu `COMPLETED` ➔ điều hướng `/attempts/:id/result`).
    * `Tiếp tục làm bài` (nếu `IN_PROGRESS` ➔ điều hướng `/attempts/:id/workspace`).
    * `Làm lại đề này` (điều hướng `/student/exam/:examId`).
  - Xử lý Pagination và Empty State khi chưa có bài làm nào.
- [ ] **Step 5.2:** Kiểm tra `npx tsc -b` (0 lỗi).
- [ ] **Step 5.3:** Kiểm tra `npm run build` (build thành công).
- [ ] **Step 5.4:** Trình diễn kết quả và xin ý kiến phê duyệt của người dùng trước khi commit.
