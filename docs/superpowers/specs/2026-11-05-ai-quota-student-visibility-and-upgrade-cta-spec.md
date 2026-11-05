# Spec: Student AI Quota Visibility & Upgrade CTA Enhancement

## 1. Bối cảnh & Mục tiêu (Context & Objectives)
- **Hiện trạng:**
  - Hệ thống Quota đã quản lý hạn mức người dùng qua bảng `user_quotas` cho các tính năng: `AI_WRITING_HINTS`, `AI_WRITING_GRADING`, `DICTIONARY_LOOKUP`.
  - Tuy nhiên, học viên chưa có cách nào để biết mình đã dùng bao nhiêu lượt, còn lại bao nhiêu lượt trong ngày trước khi bị chặn với lỗi `429 (QUOTA_EXCEEDED)`.
  - Khi học viên gặp lỗi hết hạn mức (429) ở `WritingHintsPanel` hoặc `PracticeDictionaryPopover`, hệ thống chỉ hiển thị thông báo text tĩnh mà chưa có nút kêu gọi hành động (Call To Action - CTA) dẫn học viên tới trang nâng cấp gói hội viên Premium (`/student/premium`).
- **Mục tiêu:**
  1. Xây dựng API `GET /api/v1/student/quotas` để học viên truy vấn danh sách hạn mức AI của mình trong ngày hôm nay.
  2. Cải tiến giao diện `WritingHintsPanel` và `PracticeDictionaryPopover`:
     - Hiển thị badge hạn mức trực quan.
     - Khi gặp lỗi `QUOTA_EXCEEDED` (HTTP 429), hiển thị thẻ cảnh báo thân thiện kèm nút bấm điều hướng nhanh tới `/student/premium`.

---

## 2. Phạm vi & Tác nhân (Scope & Actors)
- **Actors:**
  - `Học viên (Student)`: Đã đăng nhập, có tài khoản `FREE` hoặc `PREMIUM`.
- **In-Scope:**
  - Backend:
    - Endpoint `GET /api/v1/student/quotas` trả về danh sách hạn mức các tính năng AI của học viên (`AI_WRITING_HINTS`, `AI_WRITING_GRADING`, `DICTIONARY_LOOKUP`).
    - Service logic: Tính toán số lượt đã dùng (`usedCount`), số lượt tối đa (`maxLimit`), số lượt còn lại (`remaining = max(0, maxLimit - usedCount)`), và thời điểm reset (`resetDate`).
    - Hỗ trợ lazy initialization: Nếu học viên chưa có dòng trong `user_quotas` hôm nay, nạp hạn mức từ template tương ứng với `subscriptionTier` (`0` cho FREE, `-1` cho PREMIUM) với `usedCount = 0`.
  - Frontend:
    - `studentQuotaApi.ts` gọi `GET /api/v1/student/quotas`.
    - `WritingHintsPanel.tsx`: Thêm nút/link CTA "Nâng cấp gói Premium" khi `state.error?.kind === 'quota'`, điều hướng tới `/student/premium`.
    - `PracticeDictionaryPopover.tsx`: Thêm nút CTA "Nâng cấp Premium" khi `error.kind === 'quota'`, điều hướng tới `/student/premium`.
    - Hỗ trợ đa ngôn ngữ (Tiếng Việt & Tiếng Anh).
- **Out-of-Scope:**
  - Thay đổi logic trừ quota hoặc atomic reservation ở tầng Transaction Coordinator (đã hoạt động ổn định và có 350+ tests bảo vệ).
  - Tích hợp thêm cổng thanh toán mới.

---

## 3. Thiết kế Kỹ thuật Backend (Backend Design)

### 3.1 DTO: `StudentQuotaResponse`
```java
package com.multilingo.backend.modules.analytics.dto.response;

import lombok.Builder;
import lombok.Getter;
import java.time.Instant;

@Getter
@Builder
public class StudentQuotaResponse {
    private String featureCode;
    private String featureName;
    private Integer usedCount;
    private Integer maxLimit;
    private Integer remaining;
    private String tier;
    private Instant resetDate;
}
```

### 3.2 Service Interface & Implementation
Trong `QuotaService.java`:
```java
List<StudentQuotaResponse> getMyQuotas(Integer userId);
```
Triển khai trong `QuotaServiceImpl.java`:
- Lấy thông tin người dùng từ `UserRepository` để xác định `subscriptionTier` (FREE hoặc VIP/PREMIUM).
- Duyệt qua các tính năng AI trọng tâm: `AI_WRITING_HINTS`, `AI_WRITING_GRADING`, `DICTIONARY_LOOKUP`.
- Với mỗi tính năng, truy vấn `userQuotaRepository.findByUserIdAndFeatureCode(userId, featureCode)`.
- Nếu chưa có dòng hoặc `resetDate <= now`:
  - Lấy `maxLimit` từ template (`userId = 0` nếu FREE, `-1` nếu VIP).
  - Gán `usedCount = 0`, `remaining = maxLimit`.
- Nếu đã có dòng và `resetDate > now`:
  - `usedCount = q.getUsedCount()`.
  - `maxLimit = q.getMaxLimit()`.
  - `remaining = Math.max(0, maxLimit - usedCount)`.
- Trả về danh sách `StudentQuotaResponse`.

### 3.3 Controller: `StudentQuotaController.java`
- Package: `com.multilingo.backend.modules.analytics.controller`
- Route: `GET /api/v1/student/quotas`
- Quyền truy cập: Bất kỳ người dùng đã xác thực (Authenticated User).
- Trả về: `ResponseEntity<ApiResponse<List<StudentQuotaResponse>>>`.

---

## 4. Thiết kế Kỹ thuật Frontend (Frontend Design)

### 4.1 API Client: `studentQuotaApi.ts`
- File: `frontend/src/features/student/api/studentQuotaApi.ts`
- Cung cấp hàm: `getMyQuotas(): Promise<StudentQuotaResponse[]>`.

### 4.2 Giao diện `WritingHintsPanel.tsx`
- Khi `state.error?.kind === 'quota'`:
  - Hiển thị banner cảnh báo:
    - Biểu tượng `Sparkles` màu hổ phách / cam.
    - Tiêu đề: "Bạn đã dùng hết hạn mức gợi ý AI hôm nay".
    - Nội dung: "Học viên gói Free có 5 lượt gợi ý/ngày. Hãy nâng cấp lên gói Hội viên VIP để nhận 20 lượt gợi ý mỗi ngày."
    - Nút bấm: `<button onClick={() => navigate('/student/premium')}>Nâng cấp Premium</button>`.

### 4.3 Giao diện `PracticeDictionaryPopover.tsx`
- Khi `error.kind === 'quota'`:
  - Hiển thị thông báo hết hạn mức tra từ kèm nút:
    - `<button onClick={() => window.open('/student/premium', '_blank')}>Nâng cấp Premium (500 lượt/ngày)</button>`.

