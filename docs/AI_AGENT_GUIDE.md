# 🤖 HƯỚNG DẪN SỬ DỤNG AI AGENT CHO TEAM MULTILINGO
*Tài liệu hướng dẫn cách prompt, giao tiếp và phối hợp hiệu quả với AI Agent (Antigravity / Gemini / Claude)*

---

## MỤC LỤC
1. [Tổng Quan Cách AI Agent Hoạt Động](#1-tổng-quan-cách-ai-agent-hoạt-động)
2. [Quy Trình Làm Việc Chuẩn Với AI](#2-quy-trình-làm-việc-chuẩn-với-ai)
3. [Hướng Dẫn Viết Prompt Hiệu Quả](#3-hướng-dẫn-viết-prompt-hiệu-quả)
4. [Các Kịch Bản Thường Gặp & Prompt Mẫu](#4-các-kịch-bản-thường-gặp--prompt-mẫu)
5. [Những Điều KHÔNG NÊN Làm](#5-những-điều-không-nên-làm)

---

## 1. TỔNG QUAN CÁCH AI AGENT HOẠT ĐỘNG

Khi bạn mở dự án Multilingo, AI Agent sẽ **tự động** nạp toàn bộ cấu hình từ thư mục gốc của dự án:

| Nguồn | Đường dẫn | Vai trò |
| :--- | :--- | :--- |
| **Quy tắc cốt lõi** | `GEMINI.md` | Phương pháp luận Superpowers + Tiêu chuẩn Base Architecture |
| **Rules chi tiết (4)** | `.agents/rules/*.md` | Quy chuẩn Backend, Frontend, Docker & Git Rebase/Force-push |
| **Bộ kỹ năng Superpowers (12)** | `.agents/skills/<skill>/` | `brainstorming`, `acceptance-criteria-and-test-design`, `writing-plans`, `test-driven-development`, `executing-plans`, `verification-before-completion`, `systematic-debugging`, `subagent-driven-development`, `using-superpowers`, `requesting-code-review`, `receiving-code-review`, `finishing-a-development-branch` |
| **Kỹ năng riêng Multilingo (3)** | `.agents/skills/<skill>/` | `multilingo-feature-development`, `multilingo-crud-generator`, `multilingo-debugging` |

> 🎉 **ĐẶC BIỆT DÀNH CHO TEAM:** Toàn bộ bộ kỹ năng **Superpowers** đã được tích hợp sẵn **100% bên trong thư mục `.agents/skills/`** của repository. Bất kỳ thành viên nào chỉ cần `git clone` về là AI Agent có đầy đủ quy trình làm việc chuẩn ngay lập tức, **KHÔNG CẦN CÀI ĐẶT THÊM BẤT KỲ CÁI GÌ**!

---

## 2. QUY TRÌNH LÀM VIỆC CHUẨN VỚI AI

### Sơ đồ quy trình tổng thể:

```
┌─────────────────────────────────────────────────────────────┐
│                  TÍNH NĂNG MỚI (Use Case)                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   ĐÃ CÓ Đặc tả (docs/DacTa/)?                              │
│     ├── CÓ  ──→ Bước 2: Thiết kế AC & Test Cases            │
│     └── CHƯA ──→ Bước 1: Viết Đặc tả trước                  │
│                                                              │
│   Bước 1: Viết Đặc tả (Spec/Use Case)                       │
│     → Yêu cầu AI brainstorming + viết spec                   │
│     → Review & duyệt spec                                    │
│                                                              │
│   Bước 2: Thiết kế AC & Test Cases                          │
│     → acceptance-criteria-and-test-design                   │
│     → AC (Gherkin/Checklist) + Ma trận 6 khía cạnh test     │
│                                                              │
│   Bước 3: Lập Kế hoạch chia nhỏ Task (Plans)                │
│     → AI tạo plan tại docs/superpowers/plans/                │
│     → Review & duyệt plan                                    │
│                                                              │
│   Bước 4: Triển khai từng Task (TDD)                         │
│     → AI code theo TDD: Test trước → Code sau                │
│     → Mỗi task xong → chạy test xác nhận                     │
│                                                              │
│   Bước 5: Nghiệm thu                                        │
│     → Đối chiếu bảng Test Cases & AC                         │
│     → mvn clean test PASS 100%                               │
│     → npm run lint && npm run build PASS                      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### ⚠️ QUAN TRỌNG: Tính năng CHƯA CÓ đặc tả

Nếu tính năng bạn muốn phát triển **chưa có file đặc tả** trong `docs/DacTa/`, bạn **BẮT BUỘC** phải yêu cầu AI viết đặc tả trước. Quy trình:

1. **Yêu cầu AI brainstorming** → AI sẽ hỏi bạn về nghiệp vụ, input/output, quy tắc.
2. **AI viết Spec** tại `docs/superpowers/specs/<tên-tính-năng>.md`.
3. **Bạn review** → Duyệt hoặc yêu cầu sửa.
4. Sau khi spec được duyệt → Mới chuyển sang lập kế hoạch và code.

---

## 3. HƯỚNG DẪN VIẾT PROMPT HIỆU QUẢ

### 3.1. Nguyên tắc chung

| ✅ NÊN | ❌ KHÔNG NÊN |
| :--- | :--- |
| Nêu rõ **mục tiêu** và **bối cảnh** | Viết quá chung chung: "code cho tôi cái gì đó" |
| Đề cập tên **Use Case / bảng / API** cụ thể | Để AI tự đoán nghiệp vụ |
| Yêu cầu AI **tuân thủ quy trình Superpowers** | Bỏ qua bước spec/plan, nhảy thẳng vào code |
| Duyệt từng bước: Spec → Plan → Code | Duyệt tất cả cùng lúc mà không đọc |
| Tag file bằng `@[tên-file]` khi cần AI đọc | Copy paste nội dung file vào chat |

### 3.2. Cấu trúc một prompt tốt

```
[Bối cảnh]: Tôi đang làm tính năng gì / ở bước nào
[Mục tiêu]: Tôi muốn AI làm gì cụ thể
[Skill / Ràng buộc]: Sử dụng skill @[tên-skill] để thực hiện
[Tham chiếu]: @[file liên quan] nếu có
```

### 3.3. Cách Tag & Kích Hoạt Trực Tiếp Skill (Skill Chaining)

Bạn có thể kích hoạt chính xác kỹ năng mong muốn theo 2 cách:
* **Cách 1 (Gõ trực tiếp tên skill):** Trong câu prompt chỉ định: `"Sử dụng skill <tên-skill> để..."`
* **Cách 2 (Tag file skill bằng `@`):** Gõ `@` rồi chọn file `SKILL.md` tương ứng trong `.agents/skills/<tên-skill>/SKILL.md`.

#### 🔗 Chuỗi Skill chuẩn cho Tính Năng Mới (Skill Chaining Flow)

```
Bước 1: @brainstorming hoặc @multilingo-feature-development
  │   (Khảo sát yêu cầu & viết Spec)
  ▼
Bước 2: @acceptance-criteria-and-test-design
  │   (Soạn AC Gherkin & Ma trận 6 khía cạnh Test Cases)
  ▼
Bước 3: @writing-plans
  │   (Lập Implementation Plan chia nhỏ task 2-5 phút)
  ▼
Bước 4: @test-driven-development (TDD)
  │   (Red → Green → Refactor cho từng task)
  │   ├── Kết hợp @multilingo-crud-generator (nếu sinh CRUD Backend)
  │   ├── Kết hợp @api-and-interface-design (nếu làm REST API Contract)
  │   └── Kết hợp @frontend-ui-engineering (nếu dựng UI React)
  ▼
Bước 5: @verification-before-completion
  │   (Chạy mvn clean test & npm run build, chứng minh bằng log)
  ▼
Bước 6: @code-review-and-quality / @requesting-code-review
      (Review code, xin phép trước khi git commit)
```

---

## 4. CÁC KỊCH BẢN THƯỜNG GẶP & PROMPT MẪU

### 🟢 Kịch bản 1: Phát triển tính năng mới ĐÃ CÓ đặc tả

```
Tôi muốn triển khai Use Case UC11 - Tra cứu Từ điển.
Đặc tả đầy đủ tại @[docs/DacTa/AD_UC11_TRA_CUU_TU_DIEN.md].
Áp dụng quy trình Superpowers theo @[GEMINI.md]:
1. Brainstorming đối soát đặc tả
2. Thiết kế tiêu chí nghiệm thu & ma trận test cases
3. Lập kế hoạch chia nhỏ task
4. Triển khai TDD
5. Nghiệm thu mvn clean test
Bắt đầu bước 1 ngay.
```

### 🟡 Kịch bản 2: Tính năng mới CHƯA CÓ đặc tả

```
Tôi muốn thêm tính năng "Xuất kết quả thi ra PDF".
Tính năng này CHƯA CÓ đặc tả trong docs/DacTa/.
Hãy giúp tôi:
1. Brainstorming phân tích nghiệp vụ tính năng này
2. Viết đặc tả Use Case tại docs/superpowers/specs/export-exam-result-pdf.md
3. Sau khi tôi duyệt spec, mới lập kế hoạch triển khai
```

### 🔵 Kịch bản 3: Tạo nhanh bộ CRUD cho một bảng mới

```
Tạo bộ CRUD hoàn chỉnh cho bảng `questions` theo quy chuẩn Base Architecture.
Thông tin bảng:
- title: VARCHAR, NOT NULL
- content: TEXT
- difficulty: INT (1-5)
- exam_id: FK -> exams(id)
Tuân thủ TDD, Entity kế thừa BaseEntity, Controller trả ApiResponse<T>.
```

### 🔴 Kịch bản 4: Gặp lỗi runtime / test fail

```
Tôi gặp lỗi khi chạy backend:
[Paste stack trace hoặc error log ở đây]

Hãy phân tích root cause và đề xuất cách sửa.
Sau khi sửa, chạy lại mvn clean test xác nhận PASS 100%.
```

### 🟣 Kịch bản 5: Rebase nhánh feature

```
Nhánh feature/UC11-dictionary-lookup của tôi đang bị lạc hậu so với develop.
Hướng dẫn tôi rebase lại cho đúng quy trình.
```

### ⚪ Kịch bản 6: Review kiến trúc / Refactor

```
Kiểm tra toàn bộ cấu trúc hiện tại của module [tên module].
Đánh giá có tuân thủ quy chuẩn @[GEMINI.md] không.
Nếu có vi phạm, đề xuất refactor.
```

---

## 5. NHỮNG ĐIỀU KHÔNG NÊN LÀM

### ❌ Bỏ qua bước Spec / Plan
> *"Code luôn cho tôi chức năng quản lý đề thi đi"*

**Tại sao không?** Không có đặc tả → AI code theo phỏng đoán → Phải sửa đi sửa lại → Tốn thời gian gấp 3 lần.

**Nên làm:** Yêu cầu AI viết spec trước, review kỹ, rồi mới code.

### ❌ Tự ý phá vỡ quy chuẩn Base Architecture
> *"Tạo Entity không cần BaseEntity, dùng UUID cho nhanh"*

**Tại sao không?** Toàn bộ hệ thống (Controller, Service, Exception, Test) đã được xây dựng xung quanh quy chuẩn `INT id` + `BaseEntity` + `ApiResponse<T>`. Phá vỡ sẽ gây lỗi domino.

### ❌ Force push lên `develop` hoặc `main`
> *"Cứ force push cho nhanh"*

**Tại sao không?** Sẽ xóa commit của các thành viên khác. Chỉ dùng `--force-with-lease` trên nhánh feature cá nhân.

### ❌ Commit mà không chạy test
> *"Commit thôi, test sau"*

**Tại sao không?** CI sẽ fail → Block cả team → Mất uy tín.

**Quy tắc bắt buộc:**
```bash
# Trước MỌI commit
cd backend && ./mvnw clean test
cd frontend && npm run lint && npm run build
```

---

## PHỤ LỤC: BẢNG TRA CỨU SKILL & CHUỖI GỌI (SKILL CHEATSHEET)

Dưới đây là bảng tra cứu chính xác skill cần tag cho từng công việc cụ thể:

| Công việc muốn làm | Skill cần tag / kích hoạt | Bước / Skill tiếp theo | Ví dụ Prompt tag mẫu |
| :--- | :--- | :--- | :--- |
| **Phát triển Use Case có sẵn đặc tả** | `@multilingo-feature-development` | `@acceptance-criteria-and-test-design` | *"Dùng @multilingo-feature-development đối soát @[docs/DacTa/AD_UC...md] và chuẩn bị spec."* |
| **Làm tính năng mới chưa có đặc tả** | `@brainstorming` | `@acceptance-criteria-and-test-design` | *"Dùng @brainstorming phỏng vấn tôi để viết spec cho tính năng [Tên tính năng] vào docs/superpowers/specs/."* |
| **Thiết kế Tiêu chí & Test Cases** | `@acceptance-criteria-and-test-design` | `@writing-plans` | *"Dùng @acceptance-criteria-and-test-design thiết kế AC Gherkin và ma trận 6 khía cạnh test cases cho spec vừa tạo."* |
| **Lập kế hoạch phân rã Task (Plan)** | `@writing-plans` | `@test-driven-development` | *"Dùng @writing-plans lập kế hoạch chia nhỏ task (2-5 phút) vào docs/superpowers/plans/ dựa trên AC và Test Cases."* |
| **Code tính năng theo chuẩn TDD** | `@test-driven-development` | `@verification-before-completion` | *"Triển khai Task 1 trong plan theo @test-driven-development: viết test FAIL trước, sau đó mới viết code."* |
| **Sinh nhanh trọn bộ CRUD Backend** | `@multilingo-crud-generator` | `@verification-before-completion` | *"Dùng @multilingo-crud-generator tạo bộ Entity, DTO, Repo, Service, Controller cho bảng [tên_bảng]."* |
| **Thiết kế REST API & DTO chuẩn** | `@api-and-interface-design` | `@test-driven-development` | *"Dùng @api-and-interface-design thiết kế contract API và DTO cho endpoint [tên_endpoint]."* |
| **Xây dựng Giao diện React/UI** | `@frontend-ui-engineering` | `@browser-testing-with-devtools` | *"Dùng @frontend-ui-engineering dựng component [tên UI] theo Feature-based, chuẩn responsive và Tailwind."* |
| **Sửa lỗi / Fix bug / Test fail** | `@systematic-debugging` (hoặc `@multilingo-debugging`) | `@verification-before-completion` | *"Dùng @systematic-debugging điều tra root cause lỗi sau: [paste log], giải thích và vá lỗi có test guard."* |
| **Làm sạch / Đơn giản hóa code** | `@code-simplification` | `@verification-before-completion` | *"Dùng @code-simplification tối ưu file [đường dẫn], giữ nguyên logic nghiệp vụ và test."* |
| **Kiểm tra bảo mật / OWASP / Auth** | `@security-and-hardening` | `@verification-before-completion` | *"Dùng @security-and-hardening rà soát lỗ hổng bảo mật, SQLi và IDOR trong module [tên module]."* |
| **Tối ưu truy vấn & hiệu năng** | `@performance-optimization` | `@verification-before-completion` | *"Dùng @performance-optimization kiểm tra và xử lý N+1 query tại service [tên service]."* |
| **Chạy kiểm thử & Nghiệm thu** | `@verification-before-completion` | `@requesting-code-review` | *"Dùng @verification-before-completion chạy mvn clean test & npm run build, xuất log chứng minh PASS 100%."* |
| **Review code & Trước khi Commit** | `@requesting-code-review` (hoặc `@code-review-and-quality`) | Người dùng xác nhận commit | *"Dùng @requesting-code-review review diff các file đã sửa, tóm tắt thay đổi để tôi duyệt trước khi commit."* |
| **Hoàn tất nhánh & Dọn branch** | `@finishing-a-development-branch` | Hoàn thành | *"Dùng @finishing-a-development-branch hướng dẫn tôi merge/rebase nhánh feature này vào develop."* |

