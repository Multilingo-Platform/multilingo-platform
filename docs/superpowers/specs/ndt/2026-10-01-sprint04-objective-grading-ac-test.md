# Sprint 04 — Acceptance Criteria & Test Matrix

**Spec nguồn:** `docs/superpowers/specs/2026-10-01-sprint04-objective-grading-design.md`
**Ngày:** 2026-10-01

---

## Phần A: Phân Tích Scope & Actor

### Actor
- **Duy nhất:** `TestAttemptServiceImpl.submitAttempt()` gọi nội bộ `ObjectiveGradingService`.
- Không có Actor HTTP/Client trực tiếp — engine không có endpoint riêng.

### In-Scope
- Engine chấm 7 loại câu khách quan (SINGLE_CHOICE, TFNG, YNNG, FILL_IN, MULTIPLE_CHOICE, MATCHING, DIAGRAM/MAP_LABELING).
- Chuẩn hóa text (trim + lowercase Locale.ROOT).
- Persist flags, điểm vào entity sau submit.
- Xử lý lỗi fixture rõ ràng (không silent fail).

### Out-of-Scope
- ESSAY/Writing, Sprint 06 result API, band conversion, Production GradingAdapter.

---

## Phần B: Acceptance Criteria (Gherkin)

### AC-01: Chấm đúng câu SINGLE_CHOICE

```gherkin
Scenario: Chấm đúng câu Single Choice
  Given Attempt đang IN_PROGRESS
  And answer key của "q_1" là type=SINGLE_CHOICE, correct="A"
  When user trả lời "q_1" = "A"
  Then verdict của "q_1" = CORRECT
  And score của "q_1" = 1.0
```

### AC-02: Chấm sai câu SINGLE_CHOICE

```gherkin
Scenario: Chấm sai câu Single Choice
  Given answer key của "q_1" là SINGLE_CHOICE correct="A"
  When user trả lời "q_1" = "B"
  Then verdict = WRONG
  And score = 0.0
```

### AC-03: Câu bỏ trống (null, rỗng, whitespace)

```gherkin
Scenario: Câu bỏ trống cho verdict BLANK
  Given answer key tồn tại cho "q_1"
  When user trả lời "q_1" = null (hoặc "" hoặc "   ")
  Then verdict = BLANK
  And score = 0.0
  And BLANK không khác gì WRONG về điểm
```

### AC-04: FILL_IN_THE_BLANK với alternate answers

```gherkin
Scenario: Chấm đúng Fill-in qua alternate answer
  Given answer key "q_5": correct="plasticity", alternates=["neural plasticity", "neuroplasticity"]
  When user nhập "Neuroplasticity" (khác case, có dấu)
  Then normalize = "neuroplasticity"
  And khớp với alternates[1]
  And verdict = CORRECT

Scenario: Chấm sai Fill-in không có trong alternates
  When user nhập "synapse"
  Then normalize = "synapse"
  And không khớp correct và alternates
  And verdict = WRONG
```

### AC-05: TRUE_FALSE_NOT_GIVEN normalize

```gherkin
Scenario: Normalize "not given" về NOT_GIVEN
  Given answer key "q_3": type=TRUE_FALSE_NOT_GIVEN, correct="TRUE"
  When user trả lời "not given"
  Then normalize = "not_given"
  And không khớp "true"
  And verdict = WRONG

Scenario: Normalize "True" (viết hoa) về TRUE
  When user trả lời "True"
  Then normalize = "true"
  And khớp correct "TRUE" (normalized = "true")
  And verdict = CORRECT
```

### AC-06: MULTIPLE_CHOICE so sánh Set

```gherkin
Scenario: Đúng khi chọn đúng đủ bộ
  Given correct = ["A", "C"]
  When user chọn ["C", "A"] (thứ tự khác)
  Then userSet == correctSet
  And verdict = CORRECT

Scenario: Sai khi chọn thiếu
  Given correct = ["A", "C"]
  When user chọn ["A"]
  Then verdict = WRONG

Scenario: Sai khi chọn thừa
  Given correct = ["A", "C"]
  When user chọn ["A", "B", "C"]
  Then verdict = WRONG
```

### AC-07: MATCHING chấm từng cặp độc lập

```gherkin
Scenario: Chấm Matching từng câu
  Given correct = {"q_left1": "B", "q_left2": "A"}
  When user trả lời {"q_left1": "B", "q_left2": "C"}
  Then q_left1 = CORRECT (1.0)
  And q_left2 = WRONG (0.0)
  And totalScore của Part = 1.0
```

### AC-08: ESSAY bị bỏ qua hoàn toàn

```gherkin
Scenario: ESSAY không tính vào totalObjectiveCount
  Given attempt có Part 6 (Writing) với q_8 type=ESSAY
  When gradeAttempt() được gọi
  Then q_8 KHÔNG xuất hiện trong partResults
  And totalObjectiveCount không đếm q_8
  And totalScore không cộng điểm của q_8
```

### AC-09: Điểm được persist sau submit

```gherkin
Scenario: Submit lưu flags và điểm vào DB
  Given attempt IN_PROGRESS với đáp án đã autosave
  When submitAttempt() được gọi
  Then AttemptAnswer.isCorrectFlags được ghi (Map questionId → verdict)
  And AttemptAnswer.earnedScore = tổng điểm Part
  And TestAttempt.overallScore = tổng điểm toàn attempt
  And TestAttempt.sectionScores = Map sectionName → điểm
  And TestAttempt.status = COMPLETED
```

### AC-10: Fixture lỗi bị reject rõ ràng

```gherkin
Scenario: Type không xác định trong fixture ném exception
  Given grading fixture có question với type="UNKNOWN_TYPE"
  When gradeAttempt() gặp câu này
  Then ném AppException với ErrorCode.GRADING_DATA_ERROR
  And không âm thầm trả BLANK hay 0 điểm

Scenario: correct = null trong fixture ném exception
  Given grading fixture có câu với correct = null
  When gradeAttempt() gặp câu này
  Then ném AppException với ErrorCode.GRADING_DATA_ERROR
```

### AC-11: Idempotency sau submit vẫn giữ nguyên điểm

```gherkin
Scenario: Gọi submit lần 2 trả về kết quả cũ không chấm lại
  Given attempt đã COMPLETED với overallScore = 5.0
  When submitAttempt() được gọi lần 2
  Then trả về SubmitResultResponse với status = COMPLETED
  And overallScore vẫn = 5.0 (không bị reset)
```

---

## Phần C: Business Rules Checklist

- [ ] Điểm mỗi câu đúng = 1.0, sai/bỏ trống = 0.0, không có điểm âm.
- [ ] BLANK và WRONG có cùng score = 0.0 nhưng verdict khác nhau (phục vụ Sprint 06 hiển thị).
- [ ] Chuẩn hóa dùng `Locale.ROOT` không được phá vỡ ký tự Unicode tiếng Việt.
- [ ] ESSAY không tính vào `totalObjectiveCount` và không tính điểm.
- [ ] `grading-fixture.json` KHÔNG bao giờ được include trong bất kỳ API response nào.
- [ ] Engine là pure function: cùng input → cùng output, không phụ thuộc state bên ngoài.
- [ ] Nếu `loadPartKeys()` trả Map rỗng → tất cả câu mark BLANK (không ném exception).
- [ ] `GRADING_DATA_ERROR` được ném khi fixture có type null/không xác định hoặc correct null.

---

## Phần D: Ma Trận Test Cases

### Module: TC_GRADE (ObjectiveGradingService)

| Mã TC | Phân loại | Mô tả kịch bản | Tiền điều kiện | Dữ liệu kiểm thử | Kết quả mong đợi |
|:---|:---|:---|:---|:---|:---|
| **TC_GRADE_SC_01** | Happy Path | SINGLE_CHOICE đúng (exact match) | Key: correct="A" | user="A" | CORRECT, score=1.0 |
| **TC_GRADE_SC_02** | Happy Path | SINGLE_CHOICE đúng (khác case) | Key: correct="A" | user="a" | CORRECT, score=1.0 |
| **TC_GRADE_SC_03** | Negative | SINGLE_CHOICE sai | Key: correct="A" | user="B" | WRONG, score=0.0 |
| **TC_GRADE_SC_04** | Edge | SINGLE_CHOICE null | Key: correct="A" | user=null | BLANK, score=0.0 |
| **TC_GRADE_SC_05** | Edge | SINGLE_CHOICE chuỗi rỗng | Key: correct="A" | user="" | BLANK, score=0.0 |
| **TC_GRADE_SC_06** | Edge | SINGLE_CHOICE chỉ whitespace | Key: correct="A" | user="   " | BLANK, score=0.0 |
| **TC_GRADE_FI_01** | Happy Path | FILL_IN khớp correct | correct="plasticity" | user="plasticity" | CORRECT, score=1.0 |
| **TC_GRADE_FI_02** | Happy Path | FILL_IN khớp correct khác case | correct="plasticity" | user="Plasticity" | CORRECT, score=1.0 |
| **TC_GRADE_FI_03** | Happy Path | FILL_IN khớp alternate | correct="plasticity", alt=["neuroplasticity"] | user="Neuroplasticity" | CORRECT, score=1.0 |
| **TC_GRADE_FI_04** | Happy Path | FILL_IN khớp alternate có khoảng trắng | alt=["neural plasticity"] | user="  Neural Plasticity  " | CORRECT, score=1.0 |
| **TC_GRADE_FI_05** | Negative | FILL_IN không khớp correct lẫn alternates | correct="plasticity", alt=[] | user="synapse" | WRONG, score=0.0 |
| **TC_GRADE_FI_06** | Edge | FILL_IN blank | correct="plasticity" | user=null | BLANK, score=0.0 |
| **TC_GRADE_FI_07** | Edge | FILL_IN số + alternate | correct="9", alt=["nine","9:00"] | user="Nine" | CORRECT (normalize → "nine" khớp alt) |
| **TC_GRADE_TF_01** | Happy Path | TFNG "True" → TRUE khớp | correct="TRUE" | user="True" | CORRECT |
| **TC_GRADE_TF_02** | Happy Path | TFNG "false" → FALSE khớp | correct="FALSE" | user="false" | CORRECT |
| **TC_GRADE_TF_03** | Happy Path | TFNG "not given" → NOT_GIVEN khớp | correct="NOT_GIVEN" | user="not given" | CORRECT |
| **TC_GRADE_TF_04** | Negative | TFNG "not given" khi correct=TRUE | correct="TRUE" | user="not given" | WRONG |
| **TC_GRADE_TF_05** | Edge | TFNG blank → BLANK | correct="TRUE" | user="" | BLANK |
| **TC_GRADE_MC_01** | Happy Path | MULTIPLE_CHOICE đúng đủ bộ (khác thứ tự) | correct=["A","C"] | user=["C","A"] | CORRECT, score=1.0 |
| **TC_GRADE_MC_02** | Negative | MULTIPLE_CHOICE chọn thiếu | correct=["A","C"] | user=["A"] | WRONG, score=0.0 |
| **TC_GRADE_MC_03** | Negative | MULTIPLE_CHOICE chọn thừa | correct=["A","C"] | user=["A","B","C"] | WRONG, score=0.0 |
| **TC_GRADE_MC_04** | Negative | MULTIPLE_CHOICE chọn sai hoàn toàn | correct=["A","C"] | user=["B","D"] | WRONG, score=0.0 |
| **TC_GRADE_MC_05** | Edge | MULTIPLE_CHOICE null | correct=["A","C"] | user=null | BLANK, score=0.0 |
| **TC_GRADE_MA_01** | Happy Path | MATCHING đúng cả 2 cặp | correct={q1:"B",q2:"A"} | user={q1:"B",q2:"A"} | 2 CORRECT, totalScore=2.0 |
| **TC_GRADE_MA_02** | Negative | MATCHING 1 đúng 1 sai | correct={q1:"B",q2:"A"} | user={q1:"B",q2:"C"} | q1=CORRECT, q2=WRONG, totalScore=1.0 |
| **TC_GRADE_MA_03** | Negative | MATCHING sai cả 2 | correct={q1:"B",q2:"A"} | user={q1:"A",q2:"B"} | WRONG WRONG, totalScore=0.0 |
| **TC_GRADE_MA_04** | Edge | MATCHING bỏ trống một cặp | correct={q1:"B",q2:"A"} | user={q1:"B",q2:null} | q1=CORRECT, q2=BLANK, totalScore=1.0 |
| **TC_GRADE_ES_01** | Edge | ESSAY không tính vào totalObjectiveCount | type=ESSAY | bất kỳ | Câu không xuất hiện trong result, totalObjectiveCount không tăng |
| **TC_GRADE_ERR_01** | Security/Data | Type không xác định ném exception | type="UNKNOWN_TYPE" | bất kỳ | AppException(GRADING_DATA_ERROR) |
| **TC_GRADE_ERR_02** | Security/Data | correct=null ném exception | correct=null | bất kỳ | AppException(GRADING_DATA_ERROR) |
| **TC_GRADE_AGG_01** | Happy Path | Tổng hợp nhiều Part | Part1: q1=CORRECT, Part2: q3=WRONG | — | totalScore=1.0, correctCount=1, totalObjectiveCount=2 |
| **TC_GRADE_AGG_02** | Edge | Không có key cho Part (Map rỗng) | loadPartKeys() trả {} | bất kỳ đáp án | Tất cả câu = BLANK, totalScore=0.0 (không exception) |

### Module: TC_SUBMIT (submitAttempt tích hợp với grading)

| Mã TC | Phân loại | Mô tả kịch bản | Kết quả mong đợi |
|:---|:---|:---|:---|
| **TC_SUBMIT_01** | Happy Path | Submit lần 1, chấm điểm và persist | status=COMPLETED, overallScore!=null, isCorrectFlags!=null |
| **TC_SUBMIT_02** | Edge | Submit lần 2 (idempotent) | trả COMPLETED, không chấm lại, score không đổi |
| **TC_SUBMIT_03** | Edge | Submit khi attempt đã COMPLETED | trả 200 với data cũ, không exception |
| **TC_SUBMIT_04** | Negative | Submit attempt của user khác | AppException(FORBIDDEN) |
| **TC_SUBMIT_05** | Negative | Submit attemptId không tồn tại | AppException(FORBIDDEN) |

---

## Phần E: Checklist Nghiệm Thu Cuối Sprint

Trước khi tuyên bố Sprint 04 DONE, phải pass đầy đủ:

- [ ] `./mvnw clean test` → `BUILD SUCCESS`, `Failures: 0, Errors: 0`
- [ ] Tất cả TC_GRADE_* đều có test case tương ứng trong `ObjectiveGradingServiceTest`
- [ ] Tất cả TC_SUBMIT_* đều có test case trong `TestAttemptServiceTest`
- [ ] Test tham số hóa (`@ParameterizedTest`) bao phủ ít nhất SINGLE_CHOICE, FILL_IN, TFNG, MULTIPLE_CHOICE
- [ ] `AttemptAnswer.isCorrectFlags` được ghi đúng sau submit (verified qua DB query trong test)
- [ ] `TestAttempt.overallScore` không null sau submit
- [ ] ESSAY không xuất hiện trong `isCorrectFlags` (verified)
- [ ] `grading-fixture.json` không expose qua bất kỳ endpoint nào (verified bằng IT test)
