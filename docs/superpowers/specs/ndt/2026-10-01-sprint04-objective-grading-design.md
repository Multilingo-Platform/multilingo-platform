# Sprint 04 — Chấm Điểm Khách Quan: Design Spec

**Ngày soạn:** 2026-10-01
**Sprint:** 04 — Objective Grading
**Phụ thuộc:** Sprint 01 (TestAttempt entity), Sprint 03 (autosaveAnswers + submitAttempt)
**Nhánh:** `feature/UC08-sprint04-objective-grading`

---

## 1. Mục Tiêu & Bối Cảnh

### Vấn đề hiện tại

`submitAttempt()` trong `TestAttemptServiceImpl` hiện chỉ làm duy nhất một việc: đổi status → `COMPLETED`. Không có bước nào chấm điểm, không có flag đúng/sai, không có điểm thô. Các field đã khai báo sẵn trong entity nhưng chưa được ghi:
- `AttemptAnswer.isCorrectFlags` — luôn null
- `AttemptAnswer.earnedScore` — luôn null
- `TestAttempt.overallScore` — luôn null
- `TestAttempt.sectionScores` — luôn null

### Mục tiêu Sprint 04

Xây dựng **engine chấm điểm khách quan** (Reading + Listening) hoạt động hoàn toàn độc lập với HTTP Layer, UI và AI. Sau Sprint 04:
- Cùng một bộ đáp án + answer key luôn cho cùng một kết quả (deterministic).
- Điểm thô và flags được persist vào database ngay khi `submitAttempt()` hoàn tất.
- ESSAY/Writing bị bỏ qua hoàn toàn, không tính vào điểm khách quan.

---

## 2. Actor & Điều Kiện Tiên Quyết

**Actor duy nhất:** `TestAttemptService.submitAttempt()` — engine chấm không có HTTP endpoint riêng; được gọi nội bộ.

**Điều kiện tiên quyết:**
- Attempt đang ở trạng thái `IN_PROGRESS`.
- Đáp án đã được lưu vào `attempt_answers` qua `autosaveAnswers()`.
- `grading-fixture.json` phải tồn tại tại `classpath:fixtures/grading-fixture.json` trong profile `dev` và `test`.

---

## 3. Kiến Trúc — Phương Án Đã Chốt (Phương Án A)

**Pure Domain Service** — stateless, không phụ thuộc Spring context, test thuần JUnit5.

### 3.1 Cấu Trúc Package Mới

```
com.multilingo.backend.modules.testing.
├── grading/
│   ├── ObjectiveGradingService.java          ← Interface
│   ├── GradingVerdict.java                   ← Enum: CORRECT, WRONG, BLANK
│   ├── dto/
│   │   ├── GradingKey.java                   ← Answer key cho 1 câu hỏi
│   │   ├── PartGradingKey.java               ← Answer key toàn bộ 1 Part
│   │   ├── QuestionGradingResult.java        ← Kết quả chấm 1 câu
│   │   └── GradingResult.java               ← Kết quả tổng hợp toàn attempt
│   └── impl/
│       └── ObjectiveGradingServiceImpl.java
└── adapter/
    ├── GradingAdapter.java                   ← Interface
    └── impl/
        └── FixtureGradingAdapter.java        ← @Profile("dev", "test")
```

### 3.2 Luồng Tích Hợp

```
POST /api/attempts/{id}/submit
  └─ TestAttemptServiceImpl.submitAttempt()
        ├─ 1. Ownership + idempotency check (đã có)
        ├─ 2. autosaveAnswers() — lưu đáp án cuối (đã có)
        ├─ 3. gradingAdapter.loadPartKeys(examId) ← MỚI Sprint 04
        ├─ 4. gradingService.gradeAttempt(answers, keys) ← MỚI Sprint 04
        ├─ 5. persist GradingResult vào AttemptAnswer + TestAttempt ← MỚI Sprint 04
        └─ 6. attempt.status = COMPLETED (đã có)
```

---

## 4. Data Model

### 4.1 File Mới: `grading-fixture.json`

**Path:** `backend/src/main/resources/fixtures/grading-fixture.json`

**Nguyên tắc bảo mật:** File này TUYỆT ĐỐI KHÔNG được serialize vào bất kỳ API response nào. `GradingAdapter` chỉ đọc file này server-side. Không bao giờ được thêm `correct_answer` vào `ExamFixture` hay `PartFixture`.

```json
{
  "exams": [
    {
      "exam_id": 1,
      "parts": [
        {
          "part_id": 1,
          "answers": {
            "q_1": { "type": "SINGLE_CHOICE", "correct": "A", "alternates": [] },
            "q_2": { "type": "SINGLE_CHOICE", "correct": "A", "alternates": [] }
          }
        },
        {
          "part_id": 2,
          "answers": {
            "q_3": { "type": "TRUE_FALSE_NOT_GIVEN", "correct": "TRUE", "alternates": [] },
            "q_4": { "type": "TRUE_FALSE_NOT_GIVEN", "correct": "FALSE", "alternates": [] }
          }
        },
        {
          "part_id": 3,
          "answers": {
            "q_5": {
              "type": "FILL_IN_THE_BLANK",
              "correct": "plasticity",
              "alternates": ["neural plasticity", "neuroplasticity"]
            }
          }
        },
        {
          "part_id": 4,
          "answers": {
            "q_6": { "type": "SINGLE_CHOICE", "correct": "A", "alternates": [] }
          }
        },
        {
          "part_id": 5,
          "answers": {
            "q_7": {
              "type": "FILL_IN_THE_BLANK",
              "correct": "9",
              "alternates": ["9:00", "nine", "09:00"]
            }
          }
        }
      ]
    }
  ]
}
```

> Part 6 và 7 (Writing/ESSAY) không có trong grading-fixture — engine bỏ qua hoàn toàn.

### 4.2 DTOs Mới

**`GradingKey`** — answer key cho 1 câu:

| Field | Type | Mô tả |
|:---|:---|:---|
| `questionId` | String | ID câu hỏi (khớp với userAnswers key) |
| `type` | String | Loại câu: SINGLE_CHOICE, TFNG, YNNG, FILL_IN_THE_BLANK, MULTIPLE_CHOICE, MATCHING |
| `correct` | Object | String, List\<String\>, hoặc Map\<String,String\> tùy loại câu |
| `alternates` | List\<String\> | Đáp án thay thế chấp nhận được (chỉ FILL_IN) |

**`QuestionGradingResult`** — kết quả 1 câu:

| Field | Type | Mô tả |
|:---|:---|:---|
| `questionId` | String | ID câu hỏi |
| `verdict` | GradingVerdict | CORRECT / WRONG / BLANK |
| `score` | BigDecimal | 1.0 nếu CORRECT, 0.0 nếu WRONG/BLANK |

**`GradingResult`** — tổng hợp attempt:

| Field | Type | Mô tả |
|:---|:---|:---|
| `partResults` | Map\<Integer, Map\<String, QuestionGradingResult\>\> | partId → questionId → kết quả từng câu |
| `totalScore` | BigDecimal | Tổng điểm khách quan toàn attempt |
| `correctCount` | int | Số câu đúng |
| `totalObjectiveCount` | int | Tổng câu khách quan (không đếm ESSAY) |
| `sectionScores` | Map\<String, BigDecimal\> | Điểm theo section name |

### 4.3 Persistence — Columns Được Ghi Trong Sprint 04

| Column DB | Field Entity | Nội dung được ghi |
|:---|:---|:---|
| `attempt_answers.is_correct_flags` | `AttemptAnswer.isCorrectFlags` | `Map<questionId, "CORRECT"/"WRONG"/"BLANK">` |
| `attempt_answers.earned_score` | `AttemptAnswer.earnedScore` | Tổng điểm raw của Part |
| `test_attempts.overall_score` | `TestAttempt.overallScore` | Tổng điểm raw toàn attempt |
| `test_attempts.section_scores` | `TestAttempt.sectionScores` | `Map<sectionName, score>` |

---

## 5. Quy Tắc Chấm Điểm (Grading Rules)

### 5.1 Quy Tắc Chung
- Điểm mỗi câu đúng = 1.0 raw point (không quy đổi band hoặc scale).
- Điểm sai hoặc bỏ trống = 0.0.
- Câu bỏ trống: null, chuỗi rỗng, hoặc chuỗi chỉ có whitespace sau trim().
- ESSAY và bất kỳ type không xác định → bỏ qua, KHÔNG tính vào `totalObjectiveCount`.

### 5.2 Quy Tắc Chuẩn Hóa Text (áp dụng cho FILL_IN + TFNG + YNNG)
1. `trim()` — loại bỏ khoảng trắng đầu và cuối.
2. `toLowerCase(Locale.ROOT)` — chuyển thường bằng Locale.ROOT (bảo toàn Unicode tiếng Việt).
3. Chuỗi rỗng sau bước 1+2 → coi là BLANK, verdict = BLANK.

### 5.3 Quy Tắc Theo Từng Loại Câu

| Loại | Quy tắc chấm |
|:---|:---|
| `SINGLE_CHOICE` | So sánh answerId sau normalize (case-insensitive). Chỉ so sánh ID (A/B/C/D), không so sánh display text. |
| `YES_NO_NOT_GIVEN` | Normalize về 3 token chuẩn: YES, NO, NOT_GIVEN. Reject token không xác định → `GRADING_DATA_ERROR`. |
| `TRUE_FALSE_NOT_GIVEN` | Normalize về: TRUE, FALSE, NOT_GIVEN. Chấp nhận "not given" → NOT_GIVEN, "true" → TRUE. |
| `FILL_IN_THE_BLANK` | Normalize user answer → so sánh với `correct` (normalized). Nếu không khớp, thử từng `alternates` (normalized). |
| `MULTIPLE_CHOICE` | So sánh Set (thứ tự không quan trọng). Đúng khi userSet == correctSet. Thiếu 1 hoặc thừa 1 → WRONG. |
| `MATCHING` | Chấm từng cặp độc lập. `correct` là Map\<questionId, answerId\>. Mỗi cặp cho 1 điểm riêng. |
| `DIAGRAM_LABELING` | Tương tự FILL_IN_THE_BLANK: normalize + alternates. |
| `MAP_LABELING` | Tương tự FILL_IN_THE_BLANK. |
| `ESSAY` | Bỏ qua hoàn toàn. Không tính điểm, không tính vào totalObjectiveCount. |

### 5.4 Xử Lý Lỗi Fixture

Nếu `grading-fixture.json` chứa `type` không xác định hoặc `correct` là null:
- Ném `AppException(ErrorCode.GRADING_DATA_ERROR)` — không âm thầm trả 0 điểm.
- Đảm bảo mọi lỗi fixture bị phát hiện ngay trong test, không lọt vào production.

---

## 6. Interface Contract

### 6.1 `GradingAdapter`

```java
public interface GradingAdapter {
    /**
     * Load answer keys cho tất cả Parts của một exam.
     * Nếu examId không có trong grading fixture → trả Map rỗng (không ném exception).
     * Engine sẽ mark tất cả câu là BLANK nếu không có key cho Part đó.
     *
     * @param examId ID của đề thi (từ attempt.getExamId())
     * @return Map<partId, PartGradingKey>
     */
    Map<Integer, PartGradingKey> loadPartKeys(Integer examId);
}
```

### 6.2 `ObjectiveGradingService`

```java
public interface ObjectiveGradingService {
    /**
     * Chấm điểm toàn bộ attempt từ danh sách AttemptAnswer đã lưu và bộ answer key.
     * Phương thức này là PURE FUNCTION: không đọc DB, không gọi API bên ngoài.
     *
     * @param answers  Danh sách AttemptAnswer đã persist
     * @param partKeys Map<partId, PartGradingKey> từ GradingAdapter
     * @return GradingResult chứa flags, điểm thô, thống kê
     * @throws AppException(GRADING_DATA_ERROR) nếu fixture có type/correct không hợp lệ
     */
    GradingResult gradeAttempt(List<AttemptAnswer> answers, Map<Integer, PartGradingKey> partKeys);
}
```

---

## 7. Tích Hợp với `submitAttempt()` — Pseudocode

```java
// Sau autosaveAnswers(), trước khi set COMPLETED:

List<AttemptAnswer> savedAnswers =
    attemptAnswerRepository.findByAttemptId(attemptId);

Map<Integer, PartGradingKey> keys =
    gradingAdapter.loadPartKeys(attempt.getExamId());

GradingResult result =
    gradingService.gradeAttempt(savedAnswers, keys);

// Persist per-Part flags và earnedScore
for (AttemptAnswer aa : savedAnswers) {
    Map<String, QuestionGradingResult> partResult =
        result.getPartResults().get(aa.getPartId());
    if (partResult != null) {
        Map<String, Object> flags = partResult.entrySet().stream()
            .collect(toMap(Entry::getKey, e -> e.getValue().getVerdict().name()));
        aa.setIsCorrectFlags(flags);
        aa.setEarnedScore(partResult.values().stream()
            .map(QuestionGradingResult::getScore)
            .reduce(BigDecimal.ZERO, BigDecimal::add));
        attemptAnswerRepository.save(aa);
    }
}

// Persist overall scores vào TestAttempt
attempt.setOverallScore(result.getTotalScore());
attempt.setSectionScores(convertSectionScoresToMap(result.getSectionScores()));
attempt.setStatus(AttemptStatus.COMPLETED);
attempt.setEndTime(Instant.now());
testAttemptRepository.save(attempt);
```

---

## 8. Ràng Buộc Kỹ Thuật

- `ObjectiveGradingServiceImpl` dùng `@Service` nhưng KHÔNG inject bất kỳ `@Repository` nào — pure domain logic.
- `FixtureGradingAdapter` dùng `@Profile({"dev", "test"})` — tương tự pattern `FixtureExamAdapter` đã có.
- Toàn bộ test engine chấm điểm dùng JUnit5 thuần (`new ObjectiveGradingServiceImpl()`), không cần `@SpringBootTest`.
- Bộ test tham số hóa dùng `@ParameterizedTest` với `@MethodSource` (S04-10).
- Không import bất kỳ dependency UI framework hoặc Gemini API.

---

## 9. ErrorCode Mới Cần Thêm vào `ErrorCode.java`

```java
GRADING_DATA_ERROR(422, HttpStatus.UNPROCESSABLE_ENTITY,
    "Dữ liệu answer key trong fixture lỗi hoặc không xác định được loại câu")
```

---

## 10. Scope

### In-Scope Sprint 04
- Engine chấm điểm 7 loại câu khách quan: SINGLE_CHOICE, TFNG, YNNG, FILL_IN_THE_BLANK, MULTIPLE_CHOICE, MATCHING, DIAGRAM/MAP_LABELING.
- `FixtureGradingAdapter` đọc `grading-fixture.json` (dev/test profile).
- Persist `isCorrectFlags`, `earnedScore`, `overallScore`, `sectionScores` sau submit.
- Bộ test tham số hóa đầy đủ cho mọi loại câu và edge case.
- Thêm `GRADING_DATA_ERROR` vào `ErrorCode`.
- Thêm `findByAttemptId()` vào `AttemptAnswerRepository` nếu chưa có.

### Out-of-Scope Sprint 04
- Chấm điểm Writing/ESSAY → Sprint 09 (AI Grading pipeline).
- API `GET /api/attempts/{id}/result` trả kết quả cho client → Sprint 06.
- Quy đổi điểm thô sang band IELTS/TOEIC → ngoài scope TV3.
- `GradingAdapter` production kết nối TV2 → Sprint 11 (Integration).
