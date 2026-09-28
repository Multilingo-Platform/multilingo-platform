# Tổng hợp Câu hỏi Đồng bộ Contract Liên Module (Dành cho TV1, TV2, TV4)

**Người gửi:** TV3 (Không gian Thi thử, Luyện tập & Trợ lý AI)  
**Tài liệu tham chiếu:** [`content-data-schema.md`](file:///d:/Project/University/multilingo-platform/docs/ndt/contracts/content-data-schema.md)

---

## 1. Gửi Thành viên 2 (TV2 — Quản lý Đề thi & Phần thi)

> **Mục tiêu:** Chốt cấu trúc trường JSONB `ExamPart.content_data` để TV3 render giao diện làm bài, autosave và chấm điểm tự động.

1. **Cấu trúc JSON Schema:** TV3 đã soạn thảo bản đặc tả chi tiết tại `docs/ndt/contracts/content-data-schema.md`. TV2 vui lòng review và xác nhận cấu trúc `part_title`, `instruction`, `shared_media`, `question_groups`, `questions`.
2. **Loại câu hỏi (`QuestionType`):** TV3 hiện hỗ trợ các enum sau:
   - `SINGLE_CHOICE`, `MULTIPLE_CHOICE`
   - `FILL_IN_THE_BLANK`
   - `TRUE_FALSE_NOT_GIVEN`, `YES_NO_NOT_GIVEN`
   - `MATCHING`, `DIAGRAM_LABELING`
   - `ESSAY` (Tự luận / Writing)
   *TV2 có cần thêm hoặc sửa đổi loại câu hỏi nào không?*
3. **Phạm vi duy nhất của mã câu hỏi (`question_id`):** `question_id` sẽ đảm bảo duy nhất trong từng Part hay duy nhất trên toàn bộ Exam? (TV3 đề xuất duy nhất trên toàn Exam để thuận tiện lưu và map đáp án).
4. **Media Asset URL:** Audio/hình ảnh trong `shared_media.url` sẽ được lưu dưới dạng đường dẫn tương đối nội bộ hay URL Cloudinary/S3?

---

## 2. Gửi Thành viên 1 (TV1 — Xác thực & Phân quyền / Auth & User)

> **Mục tiêu:** Thống nhất cơ chế bảo mật và lấy thông tin người dùng (`userId`) trong các API phiên thi.

1. **JWT Payload Structure:** Token JWT khi gửi lên Header `Authorization: Bearer <token>` sẽ chứa những thông tin gì?
   - `sub`: Có phải là `userId` dạng Integer/Long hay Username/Email?
   - Roles / Permissions: Lưu trong claim nào (`roles`, `scope`, `authorities`)?
2. **Cách trích xuất User trong Controller / Service:**
   - TV1 cung cấp utility class nào (ví dụ: `SecurityUtils.getCurrentUserId()`), hay inject qua `@AuthenticationPrincipal CustomUserDetails`?
3. **Kế hoạch hoàn thành JWT Filter:** Khi nào TV1 sẽ hoàn tất Security Filter để TV3 tích hợp kiểm tra phân quyền thực tế?

---

## 3. Gửi Thành viên 4 (TV4 — Gamification, Quota & Billing)

> **Mục tiêu:** Ràng buộc kiểm tra quota trước khi người dùng bắt đầu làm bài thi thử hoặc gửi yêu cầu AI giải thích.

1. **Interface / Service Quota:** TV4 sẽ cung cấp Interface như thế nào để TV3 gọi kiểm tra quota lượt thi thử và lượt gọi AI?
   - Ví dụ đề xuất: `boolean quotaService.hasAttemptQuota(Integer userId, ExamType type)` và `void quotaService.consumeAttemptQuota(Integer userId)`.
2. **Xử lý khi hết quota:**
   - TV3 sẽ throw `new AppException(ErrorCode.QUOTA_EXCEEDED)` khi nhận thấy người dùng đã hết lượt làm bài. TV4 có cần trả về số lượt còn lại để TV3 hiển thị cảnh báo trên UI không?
