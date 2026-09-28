# Implementation Plan — Milestone 00 + Sprint 00

**Module:** TV3 — Không gian Thi thử, Luyện tập & Trợ lý AI  
**Tham chiếu:** [`plan.md`](./plan.md)  
**Quy tắc:** Chỉ thao tác trong phạm vi TV3. Mọi thay đổi file chung phải xin phép nhóm.

---

## Milestone 00 — Đồng bộ Contract liên module

> Milestone này **không viết code**. Đầu ra là tài liệu contract dùng chung.

### M00-01: Thống nhất JSON schema `content_data` với TV2

**Mục tiêu:** Có file `docs/contracts/content-data-schema.md` được TV2 xác nhận.

**Nội dung cần TV2 trả lời:**

1. Cấu trúc JSON bên trong `exam_parts.content_data` cho từng loại kỹ năng (Reading, Listening, Writing):
   - Field nào chứa bài đọc (`passage`)?
   - Field nào chứa câu hỏi (`questions`)?
   - Field nào chứa đáp án chuẩn (`correct_answer`)?
   - Field nào chứa lời giải (`explanation`)?
   - Field nào chứa audio URL (`shared_media.url`)?
2. Danh sách `question_type` (ví dụ: `SINGLE_CHOICE`, `MULTIPLE_CHOICE`, `FILL_IN_THE_BLANK`, `TRUE_FALSE_NOT_GIVEN`, `YES_NO_NOT_GIVEN`, `MATCHING`, `DIAGRAM_LABELING`, `ESSAY`).
3. Format `correct_answer` cho từng loại câu:
   - SINGLE_CHOICE: `"A"` hay `"option_id_xxx"`?
   - FILL_IN_THE_BLANK: Mảng đáp án thay thế `["answer1", "answer2"]`?
   - MATCHING: Map `{"1": "C", "2": "A"}`?
4. Convention cho `questionId` — unique trong toàn bộ đề hay chỉ trong Part?

**Template gợi ý gửi TV2:**

```json
// TV3 đề xuất format này. TV2 xác nhận hoặc phản hồi format thực tế:
{
  "part_title": "Part 1: Note Completion",
  "instruction": "Complete the notes below. Write NO MORE THAN TWO WORDS...",
  "shared_media": {
    "type": "AUDIO",
    "url": "/media/cam18-test1-listening-part1.mp3"
  },
  "question_groups": [
    {
      "group_id": "qg-001",
      "context_html": "<p>Bài đọc hoặc hướng dẫn nhóm câu hỏi...</p>",
      "questions": [
        {
          "question_id": "q-001",
          "question_number": 1,
          "question_type": "FILL_IN_THE_BLANK",
          "question_text": "The student's name is ___.",
          "options": null,
          "correct_answer": ["Sarah", "sarah"],
          "explanation": "Đáp án nghe được ở giây thứ 15...",
          "explanation_vi": "Bản dịch lời giải (nếu có)"
        },
        {
          "question_id": "q-002",
          "question_number": 2,
          "question_type": "SINGLE_CHOICE",
          "question_text": "What is the main topic?",
          "options": [
            {"id": "A", "text": "School project"},
            {"id": "B", "text": "Weekend plans"},
            {"id": "C", "text": "Weather"},
            {"id": "D", "text": "Sports"}
          ],
          "correct_answer": "A",
          "explanation": "Speaker nói rõ ở đoạn...",
          "explanation_vi": null
        }
      ]
    }
  ]
}
```

**File tạo:** `docs/contracts/content-data-schema.md`  
**Nghiệm thu:** TV2 đã review và xác nhận schema (comment hoặc commit).

---

### M00-02: Xác nhận Entity cây đề với TV2

**Nội dung cần xác nhận:**

| Câu hỏi | Ghi nhận |
|---|---|
| Entity `Exam` có những cột nào? (`id`, `title`, `exam_type`, `exam_language`, `is_published`, `created_at`?) | _Chờ TV2_ |
| Entity `ExamSection` có `duration_minutes` không? Ở cấp Section hay Part? | _Chờ TV2_ |
| Quan hệ FK: `ExamSection.exam_id → Exam.id`, `ExamPart.section_id → ExamSection.id`? (hiện tại `section_id` là String) | _Chờ TV2_ |
| `ExamPart` hiện tại dùng `Object contentData` — TV2 có kế hoạch đổi thành typed class không? | _Chờ TV2_ |

**Nghiệm thu:** Có bảng xác nhận đã điền, TV2 ký tên/commit.

---

### M00-03: Xác nhận JWT structure với TV1

**Nội dung cần xác nhận:**

| Câu hỏi | Ghi nhận |
|---|---|
| JWT payload có field nào? (`sub` = userId? `roles`? `subscription_tier`?) | _Chờ TV1_ |
| Cách lấy userId trong Controller: `SecurityContextHolder.getContext().getAuthentication().getName()`? Hay custom `@AuthenticationPrincipal`? | _Chờ TV1_ |
| Có interface/service nào kiểm tra `subscription_tier` (FREE/PREMIUM)? | _Chờ TV1_ |
| TV1 dự kiến hoàn thành JWT filter khi nào? | _Chờ TV1_ |

**Nghiệm thu:** Xác nhận hoặc ghi nhận "TV1 chưa sẵn sàng — TV3 dùng mock".

---

### M00-04: Quyết định timezone convention

**Lựa chọn:**
- **Phương án A:** Giữ `Asia/Ho_Chi_Minh` (hiện trạng Docker + JVM arg) → TV3 lưu ICT.
- **Phương án B:** Lưu trữ UTC, hiển thị ICT → cần sửa Docker/JVM (file chung).

**Nghiệm thu:** Có quyết định ghi trong meeting notes hoặc file này.

---

### M00-05: Xác nhận interface `user_quotas` với TV4

**Nội dung cần xác nhận:**

| Câu hỏi | Ghi nhận |
|---|---|
| Bảng `user_quotas` có những cột nào? | _Chờ TV4_ |
| TV3 cần gọi API nào để kiểm tra "user còn quota AI không"? | _Chờ TV4_ |
| TV3 cần gọi API nào để trừ 1 lượt quota sau khi gọi AI thành công? | _Chờ TV4_ |
| Hay TV3 tự đọc/ghi bảng `user_quotas` trực tiếp? | _Chờ TV4_ |

**Nghiệm thu:** Xác nhận hoặc ghi nhận "chưa sẵn sàng — TV3 dùng mock unlimited quota".

---

## Sprint 00 — Nền tảng và Contract

> **Phụ thuộc:** M00-01 (JSON schema) phải DONE trước khi bắt đầu Phase B và C.
> 
> Sprint 00 chia thành 4 Phase, thực hiện tuần tự.

---

## Phase A: Thiết lập cấu trúc project (S00-01, S00-13)

> Phase này làm **đầu tiên**, không phụ thuộc Milestone 00.

### Task S00-01: Ghi baseline build

**Mục tiêu:** Chụp lại trạng thái hiện tại của project, xác định rõ cái gì đã có, cái gì chưa.

**Hành động:**

1. Chạy backend build và ghi lại output:
   ```powershell
   cd d:\Project\University\multilingo-platform\backend
   .\mvnw.cmd compile 2>&1 | Tee-Object -FilePath ..\docs\ndt\baseline-build-log.txt
   ```
2. Chạy frontend build:
   ```powershell
   cd d:\Project\University\multilingo-platform\frontend
   npm run build 2>&1 | Tee-Object -FilePath ..\docs\ndt\baseline-frontend-log.txt
   ```
3. Tạo file `docs/ndt/baseline.md` ghi nhận:

| Hạng mục | Kết quả hiện tại |
|---|---|
| Backend compile | ✅/❌ + cảnh báo (nếu có) |
| Frontend build | ✅/❌ |
| Entity đã có | `ExamPart` |
| Controller đã có | `TestController` (hello), `ExamTestController` (upload-audio, latest-part) |
| DTO đã có | `ExamPartDto` |
| Repository đã có | `ExamPartRepository` |
| Config đã có | `SecurityConfig` (permitAll /api/test/**) |
| Database | PostgreSQL via Docker (port 5433→5432), `ddl-auto=update` |
| Frontend component đã có | `AudioUploader`, `StudentExamView` |
| Test hiện có | Không có test nào |
| Migration tool | Chưa có (dùng Hibernate auto-DDL) |

**Đầu ra:** File `docs/ndt/baseline.md`  
**Nghiệm thu:** File tồn tại, nội dung khớp thực tế.

---

### Task S00-13: Xác định package structure riêng cho TV3

**Mục tiêu:** Tạo cấu trúc thư mục riêng biệt cho TV3, không giẫm vào code người khác.

#### Backend — Cấu trúc thư mục

```
backend/src/main/java/com/multilingo/backend/
├── config/                    ← [TV1 sở hữu] KHÔNG CHẠM
├── controller/                ← [Chung] KHÔNG CHẠM
├── dto/                       ← [Chung] KHÔNG CHẠM
├── entity/                    ← [Chung] KHÔNG CHẠM
├── repository/                ← [Chung] KHÔNG CHẠM
│
└── exam/                      ← ★ PACKAGE MỚI CỦA TV3
    ├── controller/
    │   └── (AttemptController.java sẽ tạo ở Sprint 01)
    ├── service/
    │   └── (GradingEngineService.java sẽ tạo ở Sprint 04)
    ├── dto/
    │   ├── request/
    │   │   └── (CreateAttemptRequest.java sẽ tạo ở Sprint 01)
    │   └── response/
    │       └── (WorkspaceResponse.java sẽ tạo ở Sprint 01)
    ├── entity/
    │   └── (TestAttempt.java sẽ tạo ở Sprint 01)
    ├── repository/
    │   └── (TestAttemptRepository.java sẽ tạo ở Sprint 01)
    ├── adapter/
    │   └── (ExamDataAdapter.java — đọc cây đề, Sprint 01)
    └── ai/
        └── (GeminiAIService.java sẽ tạo ở Sprint 08)
```

**Hành động cụ thể — tạo thư mục:**

```powershell
$base = "d:\Project\University\multilingo-platform\backend\src\main\java\com\multilingo\backend\exam"
$dirs = @("controller", "service", "dto\request", "dto\response", "entity", "repository", "adapter", "ai")
foreach ($d in $dirs) {
    New-Item -ItemType Directory -Path "$base\$d" -Force
}
```

Mỗi thư mục tạo một file `package-info.java` để Git track được:

```java
// File: exam/package-info.java
/**
 * Module TV3: Không gian Thi thử, Luyện tập & Trợ lý AI (Gemini).
 * Package gốc cho toàn bộ nghiệp vụ thi thử do TV3 phụ trách.
 */
package com.multilingo.backend.exam;
```

#### Frontend — Cấu trúc thư mục

```
frontend/src/
├── api/
│   └── axiosClient.ts           ← [Chung] KHÔNG CHẠM
├── components/
│   ├── AudioUploader.tsx        ← [TV2 demo] KHÔNG CHẠM
│   └── StudentExamView.tsx      ← [TV2 demo] KHÔNG CHẠM
├── store/
│   ├── store.ts                 ← [Chung] KHÔNG CHẠM
│   └── hooks.ts                 ← [Chung] KHÔNG CHẠM
│
└── features/                    ← ★ THƯ MỤC MỚI CỦA TV3
    └── exam/
        ├── api/
        │   └── (attemptApi.ts sẽ tạo ở Sprint 02)
        ├── components/
        │   ├── workspace/
        │   │   └── (ExamWorkspace.tsx sẽ tạo ở Sprint 02)
        │   ├── renderers/
        │   │   └── (SingleChoiceRenderer.tsx sẽ tạo ở Sprint 02)
        │   ├── result/
        │   │   └── (ResultPage.tsx sẽ tạo ở Sprint 06)
        │   └── writing/
        │       └── (WritingEditor.tsx sẽ tạo ở Sprint 08)
        ├── hooks/
        │   └── (useExamWorkspace.ts sẽ tạo ở Sprint 02)
        ├── store/
        │   └── (attemptSlice.ts sẽ tạo ở Sprint 02)
        ├── types/
        │   └── (exam.types.ts sẽ tạo ở Sprint 00 Phase B)
        └── __tests__/
            └── (sẽ tạo ở Sprint 00 Phase A — S00-11)
```

**Hành động cụ thể:**

```powershell
$base = "d:\Project\University\multilingo-platform\frontend\src\features\exam"
$dirs = @("api", "components\workspace", "components\renderers", "components\result", "components\writing", "hooks", "store", "types", "__tests__")
foreach ($d in $dirs) {
    New-Item -ItemType Directory -Path "$base\$d" -Force
}
```

Tạo file `types/index.ts` trống (placeholder):

```typescript
// frontend/src/features/exam/types/index.ts
// TV3 Exam types — sẽ bổ sung ở Phase B (contract)
export {};
```

**Đầu ra:** Cấu trúc thư mục đã tạo, `package-info.java` tồn tại.  
**Nghiệm thu:** Backend compile thành công, Frontend build thành công sau khi thêm thư mục.

---

## Phase B: Contract & State Machine (S00-05 → S00-08)

> **Phụ thuộc:** M00-01 phải DONE (có JSON schema từ TV2).
> 
> Phase này tạo tài liệu TypeScript types + Java DTO contracts — chưa implement logic.

### Task S00-05: Contract cây đề và loại câu hỏi

**Mục tiêu:** Định nghĩa TypeScript types cho cấu trúc đề thi mà TV3 sẽ nhận từ TV2 (hoặc từ fixture).

**File tạo:** `frontend/src/features/exam/types/exam.types.ts`

```typescript
// === Cấu trúc đề thi (nhận từ TV2 hoặc fixture) ===

export type SkillType = 'READING' | 'LISTENING' | 'WRITING';

export type QuestionType =
  | 'SINGLE_CHOICE'
  | 'MULTIPLE_CHOICE'
  | 'FILL_IN_THE_BLANK'
  | 'TRUE_FALSE_NOT_GIVEN'
  | 'YES_NO_NOT_GIVEN'
  | 'MATCHING'
  | 'DIAGRAM_LABELING'
  | 'ESSAY';

export interface ExamOption {
  id: string;      // "A", "B", "C", "D"
  text: string;
}

export interface Question {
  question_id: string;
  question_number: number;
  question_type: QuestionType;
  question_text: string;
  options: ExamOption[] | null;   // null cho FILL_IN, ESSAY
  // KHÔNG có correct_answer — server giữ
  // KHÔNG có explanation — chỉ trả về ở result
}

export interface QuestionGroup {
  group_id: string;
  context_html: string | null;   // Bài đọc / hướng dẫn nhóm
  questions: Question[];
}

export interface SharedMedia {
  type: 'AUDIO' | 'IMAGE';
  url: string;
}

export interface ExamPartContent {
  part_title: string;
  instruction: string;
  shared_media: SharedMedia | null;
  question_groups: QuestionGroup[];
}

export interface ExamPart {
  id: string;         // UUID
  part_number: number;
  content: ExamPartContent;
}

export interface ExamSection {
  id: string;
  skill_type: SkillType;
  duration_minutes: number | null;  // null nếu Practice
  parts: ExamPart[];
}

export interface ExamTree {
  exam_id: string;
  title: string;
  exam_type: string;  // 'IELTS', 'TOEIC', 'VNLTV'
  sections: ExamSection[];
}
```

**Lưu ý chuẩn hóa:**
- `ESSAY` và `WRITING_ESSAY` → normalize thành `ESSAY` khi nhận từ TV2 (xử lý trong adapter).
- Audio URL: Fixture dùng path tương đối `/fixtures/audio/...`, production dùng URL đầy đủ.

**Nghiệm thu:** File TypeScript compile thành công (`npx tsc --noEmit`).

---

### Task S00-06: Contract câu trả lời và flags

**File tạo:** `frontend/src/features/exam/types/answer.types.ts`

```typescript
// === Câu trả lời của học viên ===

export type AnswerValue =
  | string             // SINGLE_CHOICE: "A", FILL_IN: "answer text"
  | string[]           // MULTIPLE_CHOICE: ["A", "C"]
  | Record<string, string>  // MATCHING: { "1": "C", "2": "A" }
  | null;              // Bỏ trống

export interface UserAnswer {
  question_id: string;
  answer: AnswerValue;
}

export interface PartAnswers {
  part_id: string;
  answers: UserAnswer[];
}

// === Payload gửi lên server ===

export interface SaveDraftPayload {
  attempt_id: string;
  version: number;           // Optimistic locking
  parts: PartAnswers[];
}

// === Kết quả chấm (server trả về) ===

export type CorrectnessFlag = 'CORRECT' | 'INCORRECT' | 'SKIPPED';

export interface QuestionResult {
  question_id: string;
  user_answer: AnswerValue;
  correct_answer: AnswerValue;    // Chỉ có trong response result
  flag: CorrectnessFlag;
  explanation: string | null;
  explanation_vi: string | null;
}

export interface PartResult {
  part_id: string;
  correct_count: number;
  total_count: number;
  questions: QuestionResult[];
}

export interface SkillStats {
  skill_type: string;
  correct_count: number;
  total_count: number;
  accuracy_percent: number;
}

export interface AttemptResult {
  attempt_id: string;
  status: AttemptStatus;
  total_correct: number;
  total_questions: number;
  overall_accuracy_percent: number;
  skill_stats: SkillStats[];
  time_spent_seconds: number;
  parts: PartResult[];
  has_writing: boolean;
  writing_status: WritingGradingStatus | null;
}

export type AttemptStatus = 'IN_PROGRESS' | 'AI_GRADING' | 'COMPLETED';
export type WritingGradingStatus = 'PENDING' | 'GRADING' | 'COMPLETED' | 'FAILED';
```

**Ví dụ câu trả lời đúng, sai, bỏ trống:**

```json
// Đúng — SINGLE_CHOICE
{ "question_id": "q-001", "answer": "A" }

// Sai — FILL_IN_THE_BLANK (đáp án chuẩn: ["Sarah"])
{ "question_id": "q-002", "answer": "sara" }

// Bỏ trống
{ "question_id": "q-003", "answer": null }

// Đúng — MULTIPLE_CHOICE (đáp án chuẩn: ["A", "C"])
{ "question_id": "q-004", "answer": ["A", "C"] }

// Sai — MULTIPLE_CHOICE (chọn thiếu)
{ "question_id": "q-004", "answer": ["A"] }
```

**Nghiệm thu:** TypeScript compile thành công.

---

### Task S00-07: Contract API — Request/Response và Error

**File tạo:** `docs/ndt/contracts/api-contract.md`

```markdown
## API Contract — TV3 Exam Module

Base URL: `/api/attempts`

### POST /api/attempts — Tạo phiên thi mới

Request:
{
  "exam_id": "uuid",
  "test_scope": "FULL_EXAM" | "SINGLE_SKILL" | "SINGLE_PART",
  "test_mode": "MOCK_TEST" | "PRACTICE",
  "section_id": "uuid | null",    // bắt buộc khi SINGLE_SKILL
  "part_id": "uuid | null"        // bắt buộc khi SINGLE_PART
}

Response 201:
{
  "attempt_id": "uuid",
  "status": "IN_PROGRESS",
  "workspace": { ... ExamTree đã snapshot, KHÔNG có correct_answer ... },
  "deadline": "2026-09-28T15:30:00+07:00 | null",
  "version": 0
}

### Error Response Convention (tất cả API):

{
  "error_code": "ATTEMPT_NOT_FOUND",
  "message": "Phiên làm bài không tồn tại.",
  "details": null
}

HTTP Status codes:
- 400: Bad Request (validation fail)
- 401: Unauthorized (chưa đăng nhập)
- 403: Forbidden (không phải chủ sở hữu attempt)
- 404: Not Found
- 409: Conflict (attempt đã nộp, version conflict)
- 429: Too Many Requests (hết quota AI)
- 500: Internal Server Error
```

**File tạo thêm:** `frontend/src/features/exam/types/api.types.ts`

```typescript
// === API Request/Response Types ===

export type TestScope = 'FULL_EXAM' | 'SINGLE_SKILL' | 'SINGLE_PART';
export type TestMode = 'MOCK_TEST' | 'PRACTICE';

export interface CreateAttemptRequest {
  exam_id: string;
  test_scope: TestScope;
  test_mode: TestMode;
  section_id: string | null;
  part_id: string | null;
}

export interface WorkspaceResponse {
  attempt_id: string;
  status: AttemptStatus;
  workspace: ExamTree;        // Snapshot — KHÔNG có correct_answer
  deadline: string | null;    // ISO 8601
  version: number;
  saved_answers: PartAnswers[];  // Đáp án đã lưu (khi resume)
}

export interface ApiError {
  error_code: string;
  message: string;
  details: Record<string, string> | null;
}
```

**Nghiệm thu:** Tài liệu contract có ví dụ request/response cho tất cả 9 API endpoint.

---

### Task S00-08: Bảng chuyển trạng thái và quy tắc timer

**File tạo:** `docs/ndt/contracts/state-machine.md`

```
## Trạng thái Attempt

          ┌──────────────┐
          │ IN_PROGRESS  │
          └──────┬───────┘
                 │ submit (thủ công hoặc timeout)
                 ▼
    ┌────────────┴────────────┐
    │ Có Writing?             │
    │                         │
    │ KHÔNG        CÓ         │
    ▼              ▼          │
┌──────────┐ ┌──────────────┐│
│COMPLETED │ │ AI_GRADING   ││
└──────────┘ └──────┬───────┘│
                    │ Tất cả Writing đã chấm xong
                    ▼
              ┌──────────┐
              │COMPLETED │
              └──────────┘

## Quy tắc Timer

| Scope + Mode | Có deadline | Nguồn thời lượng |
|---|---|---|
| FULL_EXAM + MOCK_TEST | ✅ | Tổng `duration_minutes` của tất cả Section |
| SINGLE_SKILL + MOCK_TEST | ✅ | `duration_minutes` của Section đã chọn |
| SINGLE_PART + MOCK_TEST | ✅ | `duration_minutes` riêng của Part (nếu có), fallback Section |
| Bất kỳ + PRACTICE | ❌ | Không có deadline, không đếm ngược |

## Quy tắc điểm

- Điểm thô = số câu khách quan đúng / tổng số câu khách quan.
- KHÔNG cộng điểm Writing vào tổng điểm khách quan.
- KHÔNG tự quy đổi ra band IELTS/TOEIC.
- Lưu: `correct_count`, `total_count`, `accuracy_percent` cho mỗi skill.
```

**Nghiệm thu:** Bảng trạng thái khớp với tài liệu đặc tả UC08→UC10. Điểm khác biệt (nếu có) ghi rõ.

---

## Phase C: Tạo Fixture dữ liệu mẫu (S00-09, S00-10)

> **Phụ thuộc:** M00-01 DONE + Phase B contract đã viết.

### Task S00-09: Fixture Reading

**Mục tiêu:** Tạo 1 fixture Reading hợp lệ + 1 fixture lỗi cấu trúc.

**File tạo:**
- `docs/ndt/fixtures/reading-valid.json` — Đề Reading IELTS mẫu gồm 1 Part, 3 QuestionGroup, ~13 câu (MCQ + TFNG + Fill-in).
- `docs/ndt/fixtures/reading-invalid.json` — Thiếu `correct_answer`, `question_type` sai giá trị.

**Yêu cầu fixture hợp lệ:**
1. Có ít nhất 3 loại câu hỏi khác nhau: `SINGLE_CHOICE`, `TRUE_FALSE_NOT_GIVEN`, `FILL_IN_THE_BLANK`.
2. `question_id` unique trong Part.
3. `correct_answer` format đúng theo từng `question_type`.
4. Có `explanation` cho ít nhất 3 câu.
5. JSON hợp lệ, parse được.

**Yêu cầu fixture lỗi:**
1. Thiếu `correct_answer` ở 1 câu.
2. `question_type` = `"INVALID_TYPE"`.
3. `question_id` trùng lặp.
4. → Dùng để test validation logic ở Sprint 01.

**Nghiệm thu:** Cả 2 file JSON parse được. Fixture hợp lệ tuân theo schema M00-01.

---

### Task S00-10: Fixture Listening + Writing

**File tạo:**
- `docs/ndt/fixtures/listening-valid.json` — 1 Part Listening, có `shared_media.url` trỏ đến audio placeholder.
- `docs/ndt/fixtures/writing-valid.json` — 1 Part Writing Task 2 (ESSAY), có `instruction` + rubric tham khảo.

**Yêu cầu Listening fixture:**
1. Có `shared_media.type = "AUDIO"` và `url` placeholder.
2. Có ít nhất 2 loại câu: `SINGLE_CHOICE`, `FILL_IN_THE_BLANK`.
3. Có `duration_minutes` (ví dụ: 10 phút cho 1 Part).

**Yêu cầu Writing fixture:**
1. `question_type = "ESSAY"`.
2. `instruction` chứa đề bài Writing Task 2 mẫu.
3. `correct_answer = null` (bài tự luận không có đáp án chuẩn).
4. Không có `options`.

**Nghiệm thu:** JSON hợp lệ, tuân theo schema M00-01.

---

## Phase D: Thiết lập môi trường test (S00-11, S00-12)

> Phase này có thể làm **song song** với Phase B/C.

### Task S00-11: Frontend test setup

**Mục tiêu:** Cài Vitest + React Testing Library, chạy được 1 test mẫu.

**Hành động:**

1. Cài dependency test (⚠️ thêm vào `package.json` — **xin phép nhóm** nếu là policy):
   ```powershell
   cd d:\Project\University\multilingo-platform\frontend
   npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
   ```

2. Thêm config test vào `vite.config.ts` (⚠️ file chung — **cần xin phép**):
   ```typescript
   // Thêm vào defineConfig:
   test: {
     globals: true,
     environment: 'jsdom',
     setupFiles: './src/test-setup.ts',
   }
   ```

3. Tạo file setup: `frontend/src/test-setup.ts`
   ```typescript
   import '@testing-library/jest-dom';
   ```

4. Tạo test mẫu: `frontend/src/features/exam/__tests__/smoke.test.ts`
   ```typescript
   import { describe, it, expect } from 'vitest';

   describe('TV3 Exam Module - Smoke Test', () => {
     it('should verify test environment is working', () => {
       expect(1 + 1).toBe(2);
     });
   });
   ```

5. Thêm script test vào `package.json` (⚠️ file chung):
   ```json
   "scripts": {
     "test": "vitest run",
     "test:watch": "vitest"
   }
   ```

6. Chạy: `npm test`

**Nghiệm thu:** `npm test` pass với 1 test xanh.

---

### Task S00-12: Backend integration test setup (Testcontainers)

**Mục tiêu:** Chạy được 1 integration test với PostgreSQL container riêng, không dùng DB làm việc.

**Hành động:**

1. Thêm dependency Testcontainers vào `pom.xml` (⚠️ file chung — **xin phép nhóm**):
   ```xml
   <dependency>
       <groupId>org.testcontainers</groupId>
       <artifactId>postgresql</artifactId>
       <scope>test</scope>
   </dependency>
   <dependency>
       <groupId>org.testcontainers</groupId>
       <artifactId>junit-jupiter</artifactId>
       <scope>test</scope>
   </dependency>
   ```

2. Tạo file: `backend/src/test/java/com/multilingo/backend/exam/BaseIntegrationTest.java`
   ```java
   package com.multilingo.backend.exam;

   import org.springframework.boot.test.context.SpringBootTest;
   import org.springframework.test.context.DynamicPropertyRegistry;
   import org.springframework.test.context.DynamicPropertySource;
   import org.testcontainers.containers.PostgreSQLContainer;
   import org.testcontainers.junit.jupiter.Container;
   import org.testcontainers.junit.jupiter.Testcontainers;

   @SpringBootTest
   @Testcontainers
   public abstract class BaseIntegrationTest {

       @Container
       static PostgreSQLContainer<?> postgres =
           new PostgreSQLContainer<>("postgres:16-alpine")
               .withDatabaseName("multilingo_test")
               .withUsername("test")
               .withPassword("test");

       @DynamicPropertySource
       static void configureProperties(DynamicPropertyRegistry registry) {
           registry.add("spring.datasource.url", postgres::getJdbcUrl);
           registry.add("spring.datasource.username", postgres::getUsername);
           registry.add("spring.datasource.password", postgres::getPassword);
       }
   }
   ```

3. Tạo smoke test: `backend/src/test/java/com/multilingo/backend/exam/SmokeIntegrationTest.java`
   ```java
   package com.multilingo.backend.exam;

   import org.junit.jupiter.api.Test;
   import static org.assertj.core.api.Assertions.assertThat;

   class SmokeIntegrationTest extends BaseIntegrationTest {

       @Test
       void contextLoads() {
           assertThat(postgres.isRunning()).isTrue();
       }
   }
   ```

4. Chạy: `.\mvnw.cmd test -pl backend -Dtest="com.multilingo.backend.exam.*"`

**Nghiệm thu:** Test pass, PostgreSQL container start/stop tự động, không ảnh hưởng DB làm việc.

---

## Phase D-bis: Các task cần xin phép nhóm (S00-02, S00-03, S00-04)

> ⚠️ **KHÔNG tự ý thực hiện.** Ghi nhận ở đây để khi được phép thì có sẵn hướng dẫn.

### Task S00-02: Gộp Maven plugin trùng

**Vấn đề:** `pom.xml` dòng 93-96 và 97-103 khai báo `spring-boot-maven-plugin` hai lần.

**Sửa:** Gộp thành 1 block duy nhất, giữ `<jvmArguments>`:
```xml
<plugin>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-maven-plugin</artifactId>
    <configuration>
        <jvmArguments>-Duser.timezone=Asia/Ho_Chi_Minh</jvmArguments>
    </configuration>
</plugin>
```

**Trạng thái:** 🔒 BLOCKED — chờ xin phép nhóm.

### Task S00-03: Tách profile database

**Sửa:** Tạo `application-dev.properties` trỏ port 5433 (Docker), giữ `application.properties` mặc định.

**Trạng thái:** 🔒 BLOCKED — chờ xin phép nhóm.

### Task S00-04: Timezone convention

**Trạng thái:** 🔒 BLOCKED — chờ quyết định M00-04.

---

## Checklist tổng kết Sprint 00

| Phase | Task | Trạng thái | Phụ thuộc |
|---|---|---|---|
| A | S00-01 Baseline | TODO | Không |
| A | S00-13 Package structure | TODO | Không |
| B | S00-05 Contract cây đề | TODO | M00-01 |
| B | S00-06 Contract câu trả lời | TODO | M00-01 |
| B | S00-07 Contract API | TODO | Không |
| B | S00-08 State machine | TODO | Không |
| C | S00-09 Fixture Reading | TODO | S00-05 |
| C | S00-10 Fixture Listening+Writing | TODO | S00-05 |
| D | S00-11 Frontend test | TODO | S00-13 |
| D | S00-12 Backend test | TODO | S00-13 |
| D-bis | S00-02 Maven plugin | BLOCKED | Xin phép nhóm |
| D-bis | S00-03 DB profile | BLOCKED | Xin phép nhóm |
| D-bis | S00-04 Timezone | BLOCKED | M00-04 |

**Thứ tự thực hiện đề xuất:**

```
Phase A (S00-01, S00-13) ──┬──→ Phase D (S00-11, S00-12) ← có thể song song
                           │
                           └──→ Phase B (S00-07, S00-08 trước ── S00-05, S00-06 sau khi M00-01 DONE)
                                        │
                                        └──→ Phase C (S00-09, S00-10)
```

**Kết thúc Sprint 00 khi:**
- [ ] Cấu trúc thư mục TV3 tồn tại (backend + frontend)
- [ ] Contract TypeScript types compile thành công
- [ ] Tài liệu API contract có ví dụ request/response
- [ ] Fixture JSON hợp lệ theo schema M00-01
- [ ] `npm test` pass (frontend)
- [ ] Integration test pass với Testcontainers (backend)
- [ ] Baseline build đã ghi nhận
