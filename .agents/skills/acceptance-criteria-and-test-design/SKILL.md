---
name: acceptance-criteria-and-test-design
description: Use when defining acceptance criteria (AC), designing test cases, test scenarios, QA checklists, or edge case matrices before implementing features or bug fixes, or preparing verification documentation for Jira/TestRail.
---

# Acceptance Criteria & Test Design Skill

Kỹ năng chuẩn hóa quy trình đặc tả **Tiêu chí nghiệm thu (Acceptance Criteria - AC)** và **Thiết kế kịch bản kiểm thử toàn diện (Test Scenarios / Test Cases)** trước khi lập trình hoặc để bàn giao cho đội ngũ QA/Tester.

---

## 🎯 Khi nào sử dụng kỹ năng này?

- **Trước khi viết Implementation Plan (`writing-plans`):** Chuyển yêu cầu từ `brainstorming` hoặc Jira ticket thành các tiêu chí nghiệm thu rõ ràng, có thể đo lường và kiểm chứng được.
- **Khi tiếp nhận User Story / Task mới:** Phân tích mọi góc độ nghiệp vụ, ca biên (Edge cases), giới hạn dữ liệu và bảo mật.
- **Khi thiết kế tài liệu kiểm thử cho QA/QC:** Tạo bảng test cases chuẩn hóa phục vụ quản lý trên Jira, TestRail, Confluence hoặc Git docs.
- **Trước khi nghiệm thu (`verification-before-completion`):** Dùng bảng AC và Test Cases làm checklist đối chiếu bằng chứng thực tế.

---

## 📋 Quy trình 4 Bước Chuẩn (The 4-Step Process)

```
[1. Phân tích Scope & Actor] ──> [2. Soạn thảo AC (Gherkin/Checklist)] ──> [3. Thiết kế Ma trận Test Cases] ──> [4. Xuất Báo cáo Jira/TestRail]
```

### Bước 1: Phân tích Phạm vi & Tác nhân (Scope & Actors)
1. **Xác định Persona/Role:** Ai là người thực hiện hành động? (Khách vãng lai, Khách đã đăng nhập, Chủ sân, Quản trị viên hệ thống).
2. **Xác định ranh giới (Scope Boundaries):**
   - **In-Scope:** Những gì hệ thống **phải** xử lý trong task này.
   - **Out-of-Scope:** Những gì để lại các phase sau, tránh bị phình to phạm vi (scope creep).

---

### Bước 2: Soạn thảo Tiêu chí nghiệm thu (Acceptance Criteria - AC)

Sử dụng kết hợp 2 định dạng chuẩn:

#### 1. Định dạng Gherkin (Kịch bản hành vi chính)
```gherkin
Kịch bản: [Tên kịch bản]
Given [Tiền điều kiện / Trạng thái ban đầu của hệ thống]
When [Hành động người dùng thực hiện]
Then [Kết quả mong đợi hiển thị trên giao diện hoặc trong CSDL]
And [Các tác động phụ: gửi email, ghi log, sinh token, cập nhật Redis]
```

#### 2. Định dạng Checklist Quy tắc nghiệp vụ (Business Rules Checklist)
- **Ràng buộc trường dữ liệu:** Bắt buộc/Tùy chọn, kiểu dữ liệu, độ dài tối thiểu/tối đa, regex.
- **Xử lý trùng lặp / Ràng buộc toàn vẹn CSDL:** Unique constraint, foreign keys.
- **Bảo mật:** Không log thông tin nhạy cảm (mật khẩu thô, OTP), mã hóa BCrypt/Argon2, rate limit.

---

### Bước 3: Thiết kế Ma trận Kịch bản kiểm thử (Comprehensive Test Matrix)

Mọi tính năng/bug fix bắt buộc phải được quét qua **6 khía cạnh kiểm thử**:

1. **Happy Path (Luồng chuẩn):** Dữ liệu hợp lệ, quy trình lý tưởng từ đầu đến cuối.
2. **Negative Cases (Luồng lỗi):**
   - Bỏ trống trường bắt buộc.
   - Dữ liệu sai định dạng (email không có @, số điện thoại chứa chữ, ngày quá khứ).
   - Tài nguyên không tồn tại (ID 404, user bị khóa).
3. **Boundary Value Analysis (Phân tích giá trị biên - BVA):**
   - Kiểm tra cận biên: `Min - 1`, `Min`, `Min + 1`, `Max - 1`, `Max`, `Max + 1`.
   - Ví dụ mật khẩu 6-64 ký tự: Thử 5 ký tự (Fail), 6 ký tự (Pass), 64 ký tự (Pass), 65 ký tự (Fail).
4. **Edge Cases & State Handling (Ca biên & Trạng thái):**
   - Chứa khoảng trắng đầu/cuối/ở giữa (leading/trailing whitespace).
   - Ký tự Unicode, Emoji, dấu tiếng Việt có dấu/không dấu.
   - Thao tác nhanh liên tục (Spam click / Double click nút Submit).
   - Network timeout, mất kết nối mạng giữa chừng, token hết hạn khi đang thao tác.
5. **Security & Data Integrity:**
   - XSS injection trong input text (`<script>alert(1)</script>`).
   - SQL Injection (`' OR '1'='1`).
   - Rate Limiting / Brute Force (thử OTP sai quá số lần quy định, cooldown gửi lại).
   - Phân quyền (RBAC / IDOR - user thường cố gọi API của Admin).
6. **UI/UX & Accessibility:**
   - Trạng thái Loading spinner và disabled nút bấm khi đang gọi API.
   - Thông báo lỗi rõ ràng, đặt đúng vị trí ô input tương ứng, màu sắc trực quan.
   - Hỗ trợ phím tắt (Enter để submit), `aria-label` cho các nút icon (như nút ẩn/hiện mật khẩu).

---

### Bước 4: Mẫu Bảng Test Case Chuẩn Hóa (Standard Test Case Template)

Quy tắc đặt mã Test Case: `TC_[MÃ_MODULE]_[HÀNH_ĐỘNG]_[STT]` *(Ví dụ: `TC_AUTH_RESET_PWD_01`)*

| Mã TC | Phân loại | Mô tả kịch bản kiểm thử | Tiền điều kiện | Các bước thực hiện | Dữ liệu kiểm thử | Kết quả mong đợi |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TC_01** | Happy Path | Gửi OTP thành công | User đã đăng ký tài khoản | 1. Nhập email hợp lệ<br>2. Bấm "Gửi mã" | `user@example.com` | - Nhận toast thành công<br>- Chuyển sang bước 2<br>- Bắt đầu cooldown 60s<br>- Email OTP được gửi |
| **TC_02** | Negative | Nhập email không tồn tại | User chưa đăng ký tài khoản | 1. Nhập email lạ<br>2. Bấm "Gửi mã" | `notfound@example.com` | - Báo lỗi "Email không tồn tại trong hệ thống"<br>- Không chuyển bước |
| **TC_03** | Boundary | Mật khẩu mới 5 ký tự | Đang ở bước đổi mật khẩu | 1. Nhập mật khẩu 5 ký tự<br>2. Bấm Submit | `Abc1@` (5 ký tự) | - Báo lỗi đỏ: "Mật khẩu mới phải từ 6 đến 64 ký tự"<br>- Không gửi request |
| **TC_04** | Security | Chống spam gửi mã OTP | Vừa gửi mã OTP thành công | 1. Cố bấm nút gửi lại mã khi cooldown > 0 | N/A | - Nút ở trạng thái disabled<br>- Hiển thị thời gian đếm ngược còn lại |
| **TC_05** | Edge Case | Nhập mã OTP đã hết hạn | OTP sinh quá 10 phút | 1. Nhập OTP cũ<br>2. Bấm xác thực | `123456` (đã quá 10p) | - Báo lỗi "Mã OTP đã hết thời gian hiệu lực"<br>- Không cho đổi mật khẩu |

---

## 🔗 Liên kết với các Skill khác trong Superpowers

- **Sau `brainstorming`:** Khi đã thống nhất ý tưởng, kích hoạt skill này để chốt toàn bộ AC và Test Cases trước khi chuyển giao.
- **Trước `writing-plans`:** Tác giả implementation plan sẽ dựa trực tiếp vào bảng AC và Test Cases này để viết các task TDD (Test-Driven Development) tương ứng.
- **Trước `verification-before-completion`:** Kiểm tra từng dòng trong bảng Test Case để đảm bảo 100% kịch bản đã được chạy thử và pass trên thực tế.
