---
name: multilingo-feature-development
description: "BẮT BUỘC sử dụng khi phát triển tính năng mới cho Multilingo Platform. Hướng dẫn quy trình từ đối soát Use Case → lập kế hoạch → TDD → nghiệm thu theo đúng phương pháp luận Superpowers của dự án."
---

# Quy Trình Phát Triển Tính Năng Multilingo (Feature Development Workflow)

Skill này hướng dẫn quy trình bắt buộc khi phát triển bất kỳ tính năng (Use Case) nào cho Multilingo Platform. Tuân thủ nghiêm ngặt phương pháp luận Superpowers đã được chuẩn hóa tại `GEMINI.md`.

**Công bố khi bắt đầu:** "Tôi đang sử dụng skill `multilingo-feature-development` để phát triển tính năng theo quy trình chuẩn."

---

## Bước 1: Đối Soát & Chuẩn Bị Đặc Tả Nghiệp Vụ (Brainstorming & Spec)

### Trường hợp A: Tính năng ĐÃ CÓ đặc tả trong `docs/DacTa/`
1. **Tìm và đọc kỹ tài liệu đặc tả Use Case** tại `docs/DacTa/`:
   - File đặc tả thường có dạng: `AD_UC<Mã>_<TÊN_CHỨC_NĂNG>.md`
   - Ví dụ: `AD_UC11_TRA_CUU_TU_DIEN.md`, `AD_UC01_DANG_NHAP.md`
2. **Đối chiếu với Database Schema** tại `docs/DATABASE_SPECIFICATION.md`:
   - Xác định các bảng liên quan, khóa chính, khóa ngoại, index.
3. **Tạo Spec tóm tắt tại** `docs/superpowers/specs/<tên-tính-năng>.md`:
   - Tóm tắt Actor, Input/Output, Business Rules, Error Cases.
   - Xác nhận với user trước khi lập kế hoạch.

### Trường hợp B: Tính năng CHƯA CÓ đặc tả (BẮT BUỘC viết Spec trước)
1. **Kích hoạt Brainstorming làm rõ yêu cầu:**
   - Đặt câu hỏi phỏng vấn user: Mục đích tính năng? Người dùng là ai? Luồng dữ liệu ra sao?
   - Xác định rõ: Input dữ liệu gì? Output trả về gì? Xử lý ngoại lệ như thế nào?
   - Cần thêm / sửa bảng nào trong Database? (đối chiếu `docs/DATABASE_SPECIFICATION.md`).
2. **Soạn thảo tài liệu Đặc tả chi tiết tại** `docs/superpowers/specs/<tên-tính-năng>.md`:
   - Cấu trúc tài liệu:
     * **1. Mục tiêu & Bối cảnh**
     * **2. Actor & Điều kiện tiên quyết**
     * **3. Luồng chính (Happy Path)**
     * **4. Luồng phụ & Ngoại lệ (Edge cases, Error Codes)**
     * **5. Thiết kế API Contract (Endpoint, Request DTO, Response DTO)**
     * **6. Thiết kế Database (Bảng, Cột, Khóa ngoại)**
3. **Yêu cầu User phê duyệt Spec:**
   - **TUYỆT ĐỐI KHÔNG** nhảy vào code khi Spec chưa được User chấp thuận.


---

## Bước 2: Thiết Kế Tiêu Chí Nghiệm Thu & Test Cases (Acceptance Criteria & Test Design)

Trước khi lập kế hoạch chia nhỏ task, sử dụng skill `acceptance-criteria-and-test-design`:
1. **Phân tích Phạm vi & Tác nhân (Scope & Actors):** Xác định Role và ranh giới In-scope / Out-of-scope.
2. **Soạn thảo Acceptance Criteria (AC):**
   - Định dạng Gherkin (`Given - When - Then - And`) cho các kịch bản hành vi chính.
   - Checklist Quy tắc nghiệp vụ (Business Rules Checklist: validation, DB constraints, bảo mật).
3. **Thiết kế Ma trận Kiểm thử 6 khía cạnh:**
   - Happy Path (Luồng chuẩn)
   - Negative Cases (Bỏ trống trường, sai định dạng, tài nguyên không tồn tại)
   - Boundary Value Analysis (Cận biên min-1, min, max, max+1)
   - Edge Cases & State Handling (Khoảng trắng, Unicode tiếng Việt, spam click, timeout)
   - Security & Data Integrity (XSS, SQLi, Rate Limiting, RBAC/IDOR)
   - UI/UX & Accessibility (Loading spinner, disabled buttons, vị trí thông báo lỗi)
4. **Lập Bảng Test Cases chuẩn hóa:** Mã `TC_[MODULE]_[HÀNH_ĐỘNG]_[STT]` để làm đầu vào cho Implementation Plan và TDD.

---

## Bước 3: Lập Kế Hoạch Chia Nhỏ Task (Writing Plans)

1. **Tạo Implementation Plan** tại `docs/superpowers/plans/YYYY-MM-DD-<tên-tính-năng>.md` dựa trên danh sách AC và Test Cases đã chốt ở Bước 2.
2. Chia thành từng task **2 – 5 phút**, mỗi task có:
   - Files tạo mới / sửa.
   - Bài test cụ thể (test code, không phải placeholder) bao phủ các test cases tương ứng.
   - Lệnh chạy test xác nhận kết quả.
3. Trình bày kế hoạch cho user duyệt trước khi triển khai.

---

## Bước 4: Triển Khai TDD (Test-Driven Development)

Với **mỗi task** trong kế hoạch, tuân thủ chu trình TDD:

### 4.1 Red (Viết test trước)
- Viết Unit Test hoặc `@WebMvcTest` cho hành vi mong muốn.
- Chạy test → Xác nhận test **FAIL** (vì chưa có implementation).

### 4.2 Green (Viết code tối thiểu)
- Viết mã tối thiểu để bài test **PASS**.
- Tuân thủ quy chuẩn Base Architecture:
  - Entity kế thừa `BaseEntity`.
  - Controller trả về `ResponseEntity<ApiResponse<T>>`.
  - Lỗi nghiệp vụ ném `AppException(ErrorCode.XYZ)`.

### 4.3 Refactor
- Tối ưu mã nguồn, tách helper, chuẩn hóa naming.
- Chạy lại test → Xác nhận vẫn **PASS**.

---

## Bước 5: Nghiệm Thu (Verification Before Completion)

**BẮT BUỘC** trước khi tuyên bố hoàn thành:

```bash
# Backend: Toàn bộ test suite phải PASS 100%
cd backend && ./mvnw clean test

# Frontend: Lint và Build phải thành công
cd frontend && npm run lint && npm run build
```

Tiêu chuẩn đạt:
- `Tests run: N, Failures: 0, Errors: 0, Skipped: 0` → `BUILD SUCCESS`
- `Found 0 warnings and 0 errors` (Frontend lint)
- `✓ built in ...ms` (Frontend build)

**Đối chiếu bảng Test Cases & AC** đã thiết kế ở Bước 2 và **cung cấp log đầy đủ** cho user làm bằng chứng nghiệm thu.

---

## Checklist Tham Chiếu Nhanh

- [ ] Đã đọc Use Case tại `docs/DacTa/`
- [ ] Đã đối chiếu Database Schema
- [ ] Đã tạo Spec và được user duyệt
- [ ] Đã thiết kế AC & Ma trận Test Cases (`acceptance-criteria-and-test-design`)
- [ ] Đã tạo Implementation Plan và được user duyệt (`writing-plans`)
- [ ] Mỗi task tuân thủ TDD (Red → Green → Refactor)
- [ ] Entity kế thừa `BaseEntity` (id INT)
- [ ] Controller trả về `ResponseEntity<ApiResponse<T>>`
- [ ] Lỗi nghiệp vụ ném `AppException(ErrorCode.XYZ)`
- [ ] `./mvnw clean test` PASS 100%
- [ ] `npm run lint && npm run build` PASS 100%
