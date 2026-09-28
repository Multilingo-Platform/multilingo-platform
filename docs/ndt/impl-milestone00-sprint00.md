# Implementation Plan — Milestone 00 + Sprint 00

**Module:** TV3 — Không gian Thi thử, Luyện tập & Trợ lý AI  
**Branch:** `feature/UC08-testing-module-foundation`  
**Stack:** Java 21, Spring Boot 3.3.4, PostgreSQL 16 (port 5434), React 19, TypeScript  
**Tham chiếu:** [`plan.md`](file:///d:/Project/University/multilingo-platform/docs/ndt/plan.md) · [`git-workflow.md`](file:///d:/Project/University/multilingo-platform/.agents/rules/git-workflow.md)  
**Quy tắc:** Chỉ thao tác trong `modules/testing/`. Mọi thay đổi file chung phải xin phép nhóm.

---

## Trạng thái sau khi merge từ `origin/develop`

> [!IMPORTANT]
> Merge đã cung cấp sẵn toàn bộ kiến trúc base. Nhiều task đã DONE. Đọc kỹ phần này trước khi làm.

| Hạng mục | Trạng thái | Ghi chú |
|---|---|---|
| `BaseEntity` | ✅ **CÓ SẴN** | `Integer id` (auto-increment), `Instant createdAt/updatedAt` |
| `ApiResponse<T>` | ✅ **CÓ SẴN** | Builder + static factory `success()`, `error()` |
| `AppException` + `ErrorCode` | ✅ **CÓ SẴN** | Đã có `QUOTA_EXCEEDED`, `RESOURCE_NOT_FOUND`, `FORBIDDEN`... |
| `GlobalExceptionHandler` | ✅ **CÓ SẴN** | Xử lý AppException, Validation, 404, 405, JSON parse error |
| `Exam`, `ExamSection`, `ExamPart` | ✅ **CÓ SẴN** | FK đầy đủ. `duration_minutes` ở `ExamSection` (default 60) |
| `TestAttempt` entity | ⚠️ **THIẾU 3 CỘT** | Cần thêm `deadline`, `exam_snapshot`, `version` |
| `AttemptAnswer` entity | ✅ **ĐẦY ĐỦ** | Không cần sửa |
| Package `modules/testing/` | ✅ **ĐÃ TẠO** | `controller/`, `dto/`, `entity/`, `repository/`, `service/` |
| H2 test dependency | ✅ **CÓ SẴN** | `spring-boot-starter-test` + H2 trong `pom.xml` |
| Spring Security | ✅ **CÓ SẴN** | `anyRequest().authenticated()` — TV3 endpoint bị chặn cho đến khi TV1 xong JWT |

---

## Quy chuẩn kỹ thuật bắt buộc (xác nhận từ codebase)

### Entity pattern

```java
@Entity
@Table(name = "test_attempts")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class TestAttempt extends BaseEntity {
    // BaseEntity cấp: Integer id, Instant createdAt, Instant updatedAt (tự động)
    // KHÔNG tự khai báo lại id

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "exam_snapshot", columnDefinition = "jsonb")
    private Map<String, Object> examSnapshot;
}
```

### Controller pattern

```java
@RestController
@RequestMapping("/api/attempts")
@RequiredArgsConstructor
public class TestAttemptController {

    @PostMapping
    public ResponseEntity<ApiResponse<WorkspaceResponse>> create(
            @Valid @RequestBody CreateAttemptRequest request) {
        WorkspaceResponse response = service.create(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Tạo phiên thi thành công", response));
    }
}
```

### Exception pattern

```java
// Dùng ErrorCode sẵn có:
throw new AppException(ErrorCode.RESOURCE_NOT_FOUND);
throw new AppException(ErrorCode.FORBIDDEN, "Bạn không phải chủ sở hữu phiên thi này");
throw new AppException(ErrorCode.QUOTA_EXCEEDED);

// Cần thêm vào ErrorCode ở Sprint 01 (file chung — xin phép nhóm):
// ATTEMPT_ALREADY_SUBMITTED, EXAM_NOT_PUBLISHED, VERSION_CONFLICT
```

### Error response thực tế

```json
{
  "success": false,
  "code": 404,
  "message": "Không tìm thấy tài nguyên yêu cầu",
  "timestamp": "2026-09-28T15:00:00Z"
}
```

---

## Milestone 00 — Đồng bộ Contract liên module

| ID | Hành động | Phối hợp | Trạng thái |
|---|---|---|---|
| M00-01 | Thống nhất JSON schema `content_data` với TV2 | **TV2** | TODO |
| M00-02 | Xác nhận Entity cây đề | **TV2** | ✅ **DONE** — `Exam`, `ExamSection`, `ExamPart` đã merge |
| M00-03 | Xác nhận JWT token structure, cách lấy userId | **TV1** | TODO |
| M00-04 | Timezone convention | **Toàn nhóm** | ✅ **DONE** — `BackendApplication.java` set UTC; TV3 lưu `Instant` |
| M00-05 | Xác nhận interface `user_quotas` | **TV4** | TODO |

### M00-01: Template JSON schema gửi TV2

Ghi kết quả vào `docs/contracts/content-data-schema.md`.

```json
{
  "part_title": "Part 1: Note Completion",
  "instruction": "Complete the notes below. Write NO MORE THAN TWO WORDS...",
  "shared_media": { "type": "AUDIO", "url": "/media/cam18-test1-part1.mp3" },
  "question_groups": [
    {
      "group_id": "qg-001",
      "context_html": "<p>Hướng dẫn nhóm...</p>",
      "questions": [
        {
          "question_id": "q-001",
          "question_number": 1,
          "question_type": "FILL_IN_THE_BLANK",
          "question_text": "The student's name is ___.",
          "options": null,
          "correct_answer": ["Sarah", "sarah"],
          "explanation": "Đáp án nghe được ở giây thứ 15.",
          "explanation_vi": null
        },
        {
          "question_id": "q-002",
          "question_number": 2,
          "question_type": "SINGLE_CHOICE",
          "question_text": "What is the main topic?",
          "options": [{"id": "A", "text": "School"}, {"id": "B", "text": "Weather"}],
          "correct_answer": "A",
          "explanation": "Speaker đề cập rõ ở đoạn đầu.",
          "explanation_vi": null
        }
      ]
    }
  ]
}
```

**TV3 cần TV2 xác nhận:** (1) danh sách `question_type` enum; (2) format `correct_answer` theo từng loại; (3) `question_id` unique trong Part hay toàn đề?

### M00-03: Câu hỏi gửi TV1

```
1. JWT payload fields: sub (userId Integer?), roles (List<String>?), subscription_tier?
2. Cách lấy userId: SecurityContextHolder? @AuthenticationPrincipal CustomUserDetails?
3. TV1 dự kiến hoàn thành JWT filter khi nào?
```

---

## Sprint 00 — Nền tảng và Contract

> **Phụ thuộc Sprint:** M00-01 phải DONE trước Phase B và C.  
> **Phase A và D có thể làm ngay.**

---

## Phase A: Baseline (S00-01)

### Task S00-01: Ghi baseline build

```powershell
# Backend
cd d:\Project\University\multilingo-platform\backend
.\mvnw.cmd compile

# Frontend
cd d:\Project\University\multilingo-platform\frontend
npm run build
```

**Tạo `docs/ndt/baseline.md`:**

| Hạng mục | Trạng thái sau merge |
|---|---|
| Spring Boot | 3.3.4 |
| Branch | `feature/UC08-testing-module-foundation` |
| Backend compile | _[kết quả thực tế]_ |
| Frontend build | _[kết quả thực tế]_ |
| Maven plugin trùng | ⚠️ Còn — 2 lần `spring-boot-maven-plugin` (dòng 83-86 và 87-93) |
| Entity TV2 | `Exam`, `ExamSection`, `ExamPart` (FK đầy đủ) |
| Entity TV3 | `TestAttempt` (thiếu 3 cột), `AttemptAnswer` (đầy đủ) |
| Base Architecture | `BaseEntity`, `ApiResponse<T>`, `AppException`, `ErrorCode`, `GlobalExceptionHandler` |
| DB | PostgreSQL port 5434, env var fallback |
| H2 test | `spring-boot-starter-test` + H2 scope=test |
| Timezone | UTC trong code, ICT trong pom.xml JVM arg (mâu thuẫn nhỏ — TV3 dùng Instant là OK) |
| Security | `anyRequest().authenticated()` — TV3 endpoint cần disable trong test profile |

**Cấu trúc package TV3 thực tế:**
```
com.multilingo.backend.modules.testing/
├── controller/          [.gitkeep]  ← TV3 tạo tại đây
├── dto/request/         [.gitkeep]
├── dto/response/        [.gitkeep]
├── entity/
│   ├── TestAttempt.java    ← CÓ, thiếu: deadline, exam_snapshot, version
│   └── AttemptAnswer.java  ← CÓ, đầy đủ
├── repository/          [.gitkeep]
└── service/impl/        [.gitkeep]
```

**`features/exam/` frontend chưa có** — tạo ở Phase D.

**Nghiệm thu:** File `docs/ndt/baseline.md` tồn tại, nội dung khớp thực tế.

---

## Phase B: TypeScript Contract (S00-05 → S00-08)

> **Phụ thuộc:** M00-01 DONE.

### Task S00-05: TypeScript types — Cây đề

**File tạo:** `frontend/src/features/exam/types/exam.types.ts`

```typescript
export type SkillType = 'READING' | 'LISTENING' | 'WRITING';

export type QuestionType =
  | 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE'
  | 'FILL_IN_THE_BLANK'
  | 'TRUE_FALSE_NOT_GIVEN' | 'YES_NO_NOT_GIVEN'
  | 'MATCHING' | 'DIAGRAM_LABELING' | 'ESSAY';

export interface ExamOption { id: string; text: string; }

export interface Question {
  question_id: string;
  question_number: number;
  question_type: QuestionType;
  question_text: string;
  options: ExamOption[] | null;
  // KHÔNG có correct_answer — server giữ bí mật
}

export interface QuestionGroup {
  group_id: string;
  context_html: string | null;
  questions: Question[];
}

export interface ExamPartContent {
  part_title: string;
  instruction: string;
  shared_media: { type: 'AUDIO' | 'IMAGE'; url: string } | null;
  question_groups: QuestionGroup[];
}

export interface ExamPart {
  id: number;           // Integer (BaseEntity.id)
  part_number: number;
  content: ExamPartContent;
}

export interface ExamSection {
  id: number;
  skill_type: SkillType;
  title: string;
  duration_minutes: number;   // Luôn có — ExamSection.durationMinutes default=60
  parts: ExamPart[];
}

export interface ExamSnapshot {
  exam_id: number;
  code: string;
  title: string;
  type: string;
  sections: ExamSection[];
}
```

**Nghiệm thu:** `npx tsc --noEmit` 0 lỗi.

---

### Task S00-06: TypeScript types — Câu trả lời & Kết quả

**File tạo:** `frontend/src/features/exam/types/answer.types.ts`

```typescript
export type AnswerValue = string | string[] | Record<string, string> | null;
export type AttemptStatus = 'IN_PROGRESS' | 'AI_GRADING' | 'COMPLETED';
export type WritingGradingStatus = 'PENDING' | 'GRADING' | 'COMPLETED' | 'FAILED';
export type CorrectnessFlag = 'CORRECT' | 'INCORRECT' | 'SKIPPED';

export interface UserAnswer { question_id: string; answer: AnswerValue; }
export interface PartAnswers { part_id: number; answers: UserAnswer[]; }

export interface SaveDraftPayload {
  attempt_id: number;
  version: number;      // Optimistic locking
  parts: PartAnswers[];
}

export interface SkillStats {
  skill_type: string;
  correct_count: number;
  total_count: number;
  accuracy_percent: number;
}

export interface AttemptResult {
  attempt_id: number;
  status: AttemptStatus;
  total_correct: number;
  total_questions: number;
  overall_accuracy_percent: number;
  skill_stats: SkillStats[];
  time_spent_seconds: number;
  has_writing: boolean;
  writing_status: WritingGradingStatus | null;
}
```

---

### Task S00-07: TypeScript types — API

**File tạo:** `frontend/src/features/exam/types/api.types.ts`

```typescript
import type { AttemptStatus, PartAnswers } from './answer.types';
import type { ExamSnapshot } from './exam.types';

export type TestScope = 'FULL_EXAM' | 'SINGLE_SKILL' | 'SINGLE_PART';
export type TestMode = 'MOCK_TEST' | 'PRACTICE';

export interface CreateAttemptRequest {
  exam_id: number;
  test_scope: TestScope;
  test_mode: TestMode;
  section_id: number | null;
  part_id: number | null;
}

export interface WorkspaceResponse {
  attempt_id: number;
  status: AttemptStatus;
  workspace: ExamSnapshot;      // Snapshot không có correct_answer
  deadline: string | null;      // ISO 8601 UTC
  version: number;
  saved_answers: PartAnswers[];
}

export interface ApiResponse<T> {
  success: boolean;
  code: number;
  message: string;
  data: T | null;
  timestamp: string;
}
```

**9 API endpoint TV3 sở hữu:**

| Method | Path | Mô tả |
|---|---|---|
| POST | `/api/attempts` | Tạo phiên thi |
| GET | `/api/attempts/{id}/workspace` | Lấy workspace (resume) |
| PATCH | `/api/attempts/{id}/draft` | Autosave |
| POST | `/api/attempts/{id}/submit` | Nộp bài |
| GET | `/api/attempts/{id}/result` | Kết quả |
| POST | `/api/attempts/{id}/writing-hints` | AI gợi ý (Practice only) |
| GET | `/api/attempts/{id}/writing-grade` | Kết quả chấm Writing AI |
| GET | `/api/attempts/history` | Lịch sử thi |
| GET | `/api/attempts/history/{examId}` | Lịch sử theo đề |

---

### Task S00-08: State machine và quy tắc timer

**File tạo:** `docs/ndt/contracts/state-machine.md`

```
Trạng thái Attempt:
  IN_PROGRESS → [submit/timeout] → COMPLETED (không có Writing)
  IN_PROGRESS → [submit/timeout] → AI_GRADING → [AI xong] → COMPLETED

Quy tắc timer:
| Scope + Mode             | deadline | Nguồn thời lượng                  |
| FULL_EXAM + MOCK_TEST    | Có       | Tổng ExamSection.durationMinutes  |
| SINGLE_SKILL + MOCK_TEST | Có       | ExamSection.durationMinutes       |
| SINGLE_PART + MOCK_TEST  | Có       | ExamSection.durationMinutes       |
| Bất kỳ + PRACTICE        | Không    | Không đếm ngược                   |

Quy tắc điểm:
- Điểm thô = correct / total (câu khách quan).
- KHÔNG cộng Writing. KHÔNG quy đổi band IELTS/TOEIC.
- Lưu: correct_count, total_count, accuracy_percent theo từng skill.
```

---

## Phase C: Fixture (S00-09, S00-10)

> **Phụ thuộc:** M00-01 DONE + Phase B.

### Task S00-09: Fixture Reading

| File | Mục đích |
|---|---|
| `docs/ndt/fixtures/reading-valid.json` | 1 Part, ≥3 loại câu (SINGLE_CHOICE, TFNG, FILL_IN), có explanation |
| `docs/ndt/fixtures/reading-invalid.json` | Thiếu correct_answer, question_type sai, question_id trùng |

### Task S00-10: Fixture Listening + Writing

| File | Mục đích |
|---|---|
| `docs/ndt/fixtures/listening-valid.json` | Có shared_media AUDIO, ≥2 loại câu |
| `docs/ndt/fixtures/writing-valid.json` | ESSAY, correct_answer=null, options=null |

---

## Phase D: Test setup (S00-11, S00-12)

### Task S00-11: Frontend Vitest setup

> [!WARNING]
> Sửa `vite.config.ts` và `package.json` là file chung — **xin phép nhóm trước**.

```powershell
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
```

Thêm vào `vite.config.ts`:
```typescript
test: { globals: true, environment: 'jsdom', setupFiles: './src/test-setup.ts' }
```

Tạo `frontend/src/features/exam/__tests__/smoke.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
describe('TV3 Smoke', () => {
  it('test env works', () => expect(1 + 1).toBe(2));
});
```

**Nghiệm thu:** `npm test` — 1 test PASS.

---

### Task S00-12: Backend H2 integration test

> Dùng H2 (đã có trong `pom.xml`) theo quy định `git-workflow.md`. Không thêm Testcontainers.

**Tạo:** `backend/src/test/resources/application-test.properties`
```properties
spring.datasource.url=jdbc:h2:mem:testdb;DB_CLOSE_DELAY=-1;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE
spring.datasource.driver-class-name=org.h2.Driver
spring.datasource.username=sa
spring.datasource.password=
spring.jpa.database-platform=org.hibernate.dialect.H2Dialect
spring.jpa.hibernate.ddl-auto=create-drop
spring.security.user.name=test
spring.security.user.password=test
```

**Tạo:** `backend/src/test/java/com/multilingo/backend/modules/testing/SmokeTest.java`
```java
package com.multilingo.backend.modules.testing;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@ActiveProfiles("test")
class SmokeTest {
    @Test
    void contextLoads() {
        assertThat(true).isTrue();
    }
}
```

```powershell
cd d:\Project\University\multilingo-platform\backend
.\mvnw.cmd test -Dtest="com.multilingo.backend.modules.testing.SmokeTest"
```

**Nghiệm thu:** `BUILD SUCCESS`, không kết nối PostgreSQL thật.

---

## Checklist tổng kết Sprint 00

| Phase | Task | Trạng thái | Phụ thuộc |
|---|---|---|---|
| Milestone | M00-01 JSON schema | TODO | Họp TV2 |
| Milestone | M00-02 Entity cây đề | ✅ DONE | — |
| Milestone | M00-03 JWT | TODO | Họp TV1 |
| Milestone | M00-04 Timezone | ✅ DONE | — |
| Milestone | M00-05 Quota | TODO | Họp TV4 |
| A | S00-01 Baseline | TODO | Không có |
| A | ~~S00-13 Package~~ | ✅ DONE | — |
| B | S00-05 TS types cây đề | TODO | M00-01 |
| B | S00-06 TS types câu trả lời | TODO | M00-01 |
| B | S00-07 TS types API | TODO | Không có |
| B | S00-08 State machine | TODO | Không có |
| C | S00-09 Fixture Reading | TODO | S00-05 |
| C | S00-10 Fixture Listening+Writing | TODO | S00-05 |
| D | S00-11 Frontend test | TODO | Xin phép nhóm |
| D | S00-12 Backend H2 test | TODO | S00-01 |
| D-bis | S00-02 Maven plugin | BLOCKED | Xin phép nhóm |
| D-bis | S00-03 DB profile | LOW PRIORITY | — |
| D-bis | S00-04 Timezone | ✅ DONE | — |

**Kết thúc Sprint 00 khi:**
- [ ] `docs/ndt/baseline.md` tồn tại
- [ ] TypeScript types compile (`npx tsc --noEmit`)
- [ ] State machine document hoàn chỉnh
- [ ] Fixture JSON hợp lệ (sau khi có M00-01)
- [ ] Backend smoke test PASS (`./mvnw test`)
- [ ] Frontend smoke test PASS (`npm test`)
