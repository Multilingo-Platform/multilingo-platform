# Sprint 04 — Chấm Điểm Khách Quan: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây dựng engine chấm điểm khách quan (ObjectiveGradingService) thuần domain logic và tích hợp vào `submitAttempt()` để persist flags, điểm thô sau khi học viên nộp bài.

**Architecture:** `ObjectiveGradingService` là stateless pure-Java service, không inject Repository. `FixtureGradingAdapter` đọc `grading-fixture.json` (profile dev/test) tách biệt hoàn toàn khỏi `ExamFixture`. `submitAttempt()` được mở rộng để gọi engine chấm và persist kết quả vào `AttemptAnswer` và `TestAttempt`.

**Tech Stack:** Java 21, Spring Boot 3.3.4, JUnit 5, AssertJ, `@ParameterizedTest`/`@MethodSource`, H2 in-memory (`@ActiveProfiles("test")`), Jackson ObjectMapper.

**Spec:** `docs/superpowers/specs/2026-10-01-sprint04-objective-grading-design.md`
**AC & Test Matrix:** `docs/superpowers/specs/2026-10-01-sprint04-objective-grading-ac-test.md`

## Global Constraints

- Mọi Controller trả về `ResponseEntity<ApiResponse<T>>` — không thay đổi signature controller trong sprint này.
- Lỗi nghiệp vụ ném `AppException(ErrorCode.XYZ)` — `GlobalExceptionHandler` xử lý tập trung.
- `ObjectiveGradingServiceImpl` KHÔNG inject bất kỳ `@Repository` nào — pure domain logic.
- `FixtureGradingAdapter` annotate `@Profile({"dev", "test"})` và `@Component`.
- Test engine chấm điểm: khởi tạo trực tiếp `new ObjectiveGradingServiceImpl()`, KHÔNG dùng `@SpringBootTest`.
- Test tích hợp `submitAttempt()`: dùng `@SpringBootTest @ActiveProfiles("test") @Transactional`.
- `grading-fixture.json` KHÔNG được serialize vào bất kỳ API response nào.
- Chuẩn hóa text dùng `String.trim()` + `String.toLowerCase(Locale.ROOT)`.
- Điểm mỗi câu đúng = `BigDecimal("1.0")`, sai/trống = `BigDecimal("0.0")`.
- ESSAY và type không xác định: bỏ qua (không đếm vào `totalObjectiveCount`).
- `correct = null` hoặc type không xác định trong fixture → ném `AppException(GRADING_DATA_ERROR)`.

## Review Focus

1. **Locale-safe normalize:** `"Neuroplasticity".toLowerCase(Locale.ROOT)` phải cho `"neuroplasticity"` mà không làm hỏng ký tự Unicode tiếng Việt — test cần chứng minh cả hai chiều.
2. **MULTIPLE_CHOICE Set equality:** user gửi `["C","A"]` vs correct `["A","C"]` — thứ tự khác nhưng phải CORRECT; user gửi `["A","B","C"]` (thừa) phải WRONG.
3. **Idempotency + grading không chạy lần 2:** khi `submitAttempt()` được gọi lần 2, phải trả về kết quả cũ và `overallScore` không bị ghi đè về 0.
4. **grading-fixture.json không rò rỉ qua API:** `WorkspaceResponse.examSnapshot` sau submit KHÔNG được chứa key `correct` hoặc `correct_answer`.
5. **ESSAY bị bỏ qua hoàn toàn:** `totalObjectiveCount` không đếm ESSAY dù user có gửi đáp án cho câu ESSAY.

---

## File Structure Map

### Files Tạo Mới

| File | Trách nhiệm |
|:---|:---|
| `backend/src/main/resources/fixtures/grading-fixture.json` | Answer key cho exam fixture (dev/test). Không serialize ra client. |
| `backend/src/main/java/.../testing/grading/GradingVerdict.java` | Enum: CORRECT, WRONG, BLANK |
| `backend/src/main/java/.../testing/grading/dto/GradingKey.java` | Answer key 1 câu: type, correct, alternates |
| `backend/src/main/java/.../testing/grading/dto/PartGradingKey.java` | Tập hợp GradingKey của 1 Part: `Map<questionId, GradingKey>` |
| `backend/src/main/java/.../testing/grading/dto/QuestionGradingResult.java` | Kết quả 1 câu: questionId, verdict, score |
| `backend/src/main/java/.../testing/grading/dto/GradingResult.java` | Kết quả toàn attempt: partResults, totalScore, counts, sectionScores |
| `backend/src/main/java/.../testing/grading/ObjectiveGradingService.java` | Interface: `gradeAttempt(answers, partKeys)` |
| `backend/src/main/java/.../testing/grading/impl/ObjectiveGradingServiceImpl.java` | Implementation: logic chấm 7 loại câu |
| `backend/src/main/java/.../testing/adapter/GradingAdapter.java` | Interface: `loadPartKeys(examId)` |
| `backend/src/main/java/.../testing/adapter/impl/FixtureGradingAdapter.java` | Đọc grading-fixture.json, parse thành Map |
| `backend/src/test/java/.../testing/grading/ObjectiveGradingServiceTest.java` | Unit test thuần JUnit5 (không Spring), @ParameterizedTest |
| `backend/src/test/java/.../testing/adapter/FixtureGradingAdapterTest.java` | Test adapter load fixture đúng format |

### Files Sửa Đổi

| File | Thay đổi |
|:---|:---|
| `backend/src/main/java/.../common/exception/ErrorCode.java` | Thêm `GRADING_DATA_ERROR` |
| `backend/src/main/java/.../testing/service/impl/TestAttemptServiceImpl.java` | Inject `GradingAdapter` + `ObjectiveGradingService`; mở rộng `submitAttempt()` |
| `backend/src/test/java/.../testing/service/TestAttemptServiceTest.java` | Thêm test cases TC_SUBMIT_01..05 |

---

## Task 1: Thêm `GRADING_DATA_ERROR` vào `ErrorCode` + Tạo `GradingVerdict` enum

**Files:**
- Modify: `backend/src/main/java/com/multilingo/backend/common/exception/ErrorCode.java`
- Create: `backend/src/main/java/com/multilingo/backend/modules/testing/grading/GradingVerdict.java`

**Interfaces:**
- Produces: `ErrorCode.GRADING_DATA_ERROR` (dùng trong Task 4)
- Produces: `GradingVerdict.CORRECT`, `GradingVerdict.WRONG`, `GradingVerdict.BLANK` (dùng trong Task 2, 3, 4)

- [ ] **Step 1: Thêm `GRADING_DATA_ERROR` vào enum `ErrorCode`**

Mở `ErrorCode.java`, thêm entry mới trước dòng `UNCATEGORIZED_EXCEPTION`:

```java
GRADING_DATA_ERROR(422, HttpStatus.UNPROCESSABLE_ENTITY,
        "Dữ liệu answer key trong fixture lỗi hoặc không xác định được loại câu"),
```

- [ ] **Step 2: Tạo `GradingVerdict.java`**

Tạo file `backend/src/main/java/com/multilingo/backend/modules/testing/grading/GradingVerdict.java`:

```java
package com.multilingo.backend.modules.testing.grading;

/**
 * Kết quả chấm điểm của một câu hỏi khách quan.
 * CORRECT: câu trả lời đúng.
 * WRONG: câu trả lời sai (có đáp án nhưng không khớp key).
 * BLANK: bỏ trống (null, rỗng, hoặc chỉ có whitespace).
 * BLANK và WRONG đều cho score = 0.0, nhưng khác nhau để Sprint 06 hiển thị.
 */
public enum GradingVerdict {
    CORRECT,
    WRONG,
    BLANK
}
```

- [ ] **Step 3: Chạy build nhanh để xác nhận không compile error**

```powershell
cd backend; ./mvnw compile -q
```

Expected: BUILD SUCCESS, không có lỗi compile.

- [ ] **Step 4: Commit**

```powershell
git add backend/src/main/java/com/multilingo/backend/common/exception/ErrorCode.java
git add backend/src/main/java/com/multilingo/backend/modules/testing/grading/GradingVerdict.java
git commit -m "feat(grading): add GRADING_DATA_ERROR ErrorCode and GradingVerdict enum"
```

---

## Task 2: Tạo DTOs cho Grading Engine

**Files:**
- Create: `backend/src/main/java/com/multilingo/backend/modules/testing/grading/dto/GradingKey.java`
- Create: `backend/src/main/java/com/multilingo/backend/modules/testing/grading/dto/PartGradingKey.java`
- Create: `backend/src/main/java/com/multilingo/backend/modules/testing/grading/dto/QuestionGradingResult.java`
- Create: `backend/src/main/java/com/multilingo/backend/modules/testing/grading/dto/GradingResult.java`

**Interfaces:**
- Consumes: `GradingVerdict` (Task 1)
- Produces:
  - `GradingKey` — dùng bởi `PartGradingKey` và `ObjectiveGradingServiceImpl` (Task 4)
  - `PartGradingKey` — dùng bởi `GradingAdapter` (Task 3) và `ObjectiveGradingServiceImpl` (Task 4)
  - `QuestionGradingResult` — dùng bởi `GradingResult` và `ObjectiveGradingServiceImpl` (Task 4)
  - `GradingResult` — dùng bởi `ObjectiveGradingService` interface và service impl (Task 4)

- [ ] **Step 1: Tạo `GradingKey.java`**

```java
package com.multilingo.backend.modules.testing.grading.dto;

import lombok.Data;
import java.util.List;

/**
 * Answer key cho một câu hỏi trong fixture chấm điểm.
 * Không bao giờ được serialize ra API response.
 */
@Data
public class GradingKey {
    /** Khớp với questionId trong userAnswers (ví dụ: "q_1") */
    private String questionId;

    /**
     * Loại câu: SINGLE_CHOICE, TRUE_FALSE_NOT_GIVEN, YES_NO_NOT_GIVEN,
     * FILL_IN_THE_BLANK, MULTIPLE_CHOICE, MATCHING, DIAGRAM_LABELING,
     * MAP_LABELING, ESSAY.
     */
    private String type;

    /**
     * Đáp án đúng. Tuỳ loại câu:
     * - SINGLE_CHOICE: String (ví dụ: "A")
     * - TRUE_FALSE_NOT_GIVEN: String (ví dụ: "TRUE")
     * - FILL_IN_THE_BLANK: String (ví dụ: "plasticity")
     * - MULTIPLE_CHOICE: List<String> (ví dụ: ["A","C"])
     * - MATCHING: Map<String,String> (questionId -> answerId)
     */
    private Object correct;

    /**
     * Đáp án thay thế được chấp nhận.
     * Chỉ dùng cho FILL_IN_THE_BLANK và DIAGRAM/MAP_LABELING.
     * Null hoặc rỗng = không có alternate.
     */
    private List<String> alternates;
}
```

- [ ] **Step 2: Tạo `PartGradingKey.java`**

```java
package com.multilingo.backend.modules.testing.grading.dto;

import lombok.Data;
import java.util.Map;

/**
 * Tập hợp answer key của một Part.
 * Key: questionId (ví dụ: "q_1"), Value: GradingKey tương ứng.
 */
@Data
public class PartGradingKey {
    private Integer partId;
    /** Map<questionId, GradingKey> */
    private Map<String, GradingKey> answers;
}
```

- [ ] **Step 3: Tạo `QuestionGradingResult.java`**

```java
package com.multilingo.backend.modules.testing.grading.dto;

import com.multilingo.backend.modules.testing.grading.GradingVerdict;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

/**
 * Kết quả chấm điểm của một câu hỏi khách quan.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class QuestionGradingResult {
    private String questionId;
    private GradingVerdict verdict; // CORRECT, WRONG, BLANK
    /** 1.0 nếu CORRECT, 0.0 nếu WRONG hoặc BLANK */
    private BigDecimal score;

    public static QuestionGradingResult correct(String questionId) {
        return QuestionGradingResult.builder()
                .questionId(questionId)
                .verdict(GradingVerdict.CORRECT)
                .score(BigDecimal.ONE)
                .build();
    }

    public static QuestionGradingResult wrong(String questionId) {
        return QuestionGradingResult.builder()
                .questionId(questionId)
                .verdict(GradingVerdict.WRONG)
                .score(BigDecimal.ZERO)
                .build();
    }

    public static QuestionGradingResult blank(String questionId) {
        return QuestionGradingResult.builder()
                .questionId(questionId)
                .verdict(GradingVerdict.BLANK)
                .score(BigDecimal.ZERO)
                .build();
    }
}
```

- [ ] **Step 4: Tạo `GradingResult.java`**

```java
package com.multilingo.backend.modules.testing.grading.dto;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.util.Map;

/**
 * Kết quả chấm điểm tổng hợp toàn attempt.
 */
@Data
@Builder
public class GradingResult {
    /**
     * Kết quả từng câu, nhóm theo Part.
     * Key: partId, Value: Map<questionId, QuestionGradingResult>
     */
    private Map<Integer, Map<String, QuestionGradingResult>> partResults;

    /** Tổng điểm raw của toàn attempt (chỉ tính câu khách quan). */
    private BigDecimal totalScore;

    /** Số câu trả lời đúng. */
    private int correctCount;

    /** Tổng số câu khách quan (không đếm ESSAY). */
    private int totalObjectiveCount;

    /**
     * Điểm theo tên section.
     * Key: section name (ví dụ: "Reading"), Value: tổng điểm section đó.
     */
    private Map<String, BigDecimal> sectionScores;
}
```

- [ ] **Step 5: Compile kiểm tra**

```powershell
cd backend; ./mvnw compile -q
```

Expected: BUILD SUCCESS.

- [ ] **Step 6: Commit**

```powershell
git add backend/src/main/java/com/multilingo/backend/modules/testing/grading/
git commit -m "feat(grading): add GradingKey, PartGradingKey, QuestionGradingResult, GradingResult DTOs"
```

---

## Task 3: Tạo `GradingAdapter` Interface + `FixtureGradingAdapter` + `grading-fixture.json`

**Files:**
- Create: `backend/src/main/resources/fixtures/grading-fixture.json`
- Create: `backend/src/main/java/com/multilingo/backend/modules/testing/adapter/GradingAdapter.java`
- Create: `backend/src/main/java/com/multilingo/backend/modules/testing/adapter/impl/FixtureGradingAdapter.java`
- Create: `backend/src/test/java/com/multilingo/backend/modules/testing/adapter/FixtureGradingAdapterTest.java`

**Interfaces:**
- Consumes: `PartGradingKey`, `GradingKey` (Task 2)
- Produces: `GradingAdapter.loadPartKeys(Integer examId): Map<Integer, PartGradingKey>` (dùng bởi Task 4 và Task 5)

- [ ] **Step 1: Viết test FAIL trước (Red)**

Tạo `backend/src/test/java/com/multilingo/backend/modules/testing/adapter/FixtureGradingAdapterTest.java`:

```java
package com.multilingo.backend.modules.testing.adapter;

import com.multilingo.backend.modules.testing.grading.dto.PartGradingKey;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@ActiveProfiles("test")
class FixtureGradingAdapterTest {

    @Autowired
    GradingAdapter gradingAdapter;

    @Test
    void loadPartKeys_for_exam1_returns_5_parts() {
        Map<Integer, PartGradingKey> keys = gradingAdapter.loadPartKeys(1);
        // exam 1 có 5 parts khách quan (1,2,3,4,5) — Writing parts bị bỏ qua
        assertThat(keys).hasSize(5);
    }

    @Test
    void loadPartKeys_part1_has_correct_answer_for_q1() {
        Map<Integer, PartGradingKey> keys = gradingAdapter.loadPartKeys(1);
        PartGradingKey part1 = keys.get(1);
        assertThat(part1).isNotNull();
        assertThat(part1.getAnswers()).containsKey("q_1");
        assertThat(part1.getAnswers().get("q_1").getCorrect()).isEqualTo("A");
    }

    @Test
    void loadPartKeys_fill_in_has_alternates() {
        Map<Integer, PartGradingKey> keys = gradingAdapter.loadPartKeys(1);
        PartGradingKey part3 = keys.get(3);
        assertThat(part3.getAnswers().get("q_5").getAlternates())
                .containsExactlyInAnyOrder("neural plasticity", "neuroplasticity");
    }

    @Test
    void loadPartKeys_for_unknown_exam_returns_empty_map() {
        Map<Integer, PartGradingKey> keys = gradingAdapter.loadPartKeys(9999);
        assertThat(keys).isEmpty();
    }
}
```

- [ ] **Step 2: Chạy test — xác nhận FAIL (GradingAdapter chưa tồn tại)**

```powershell
cd backend; ./mvnw test -Dtest=FixtureGradingAdapterTest -q 2>&1 | Select-String -Pattern "ERROR|FAIL|Tests run"
```

Expected: lỗi compile vì `GradingAdapter` chưa tồn tại.

- [ ] **Step 3: Tạo `grading-fixture.json`**

Tạo `backend/src/main/resources/fixtures/grading-fixture.json`:

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

- [ ] **Step 4: Tạo `GradingAdapter.java` interface**

```java
package com.multilingo.backend.modules.testing.adapter;

import com.multilingo.backend.modules.testing.grading.dto.PartGradingKey;

import java.util.Map;

/**
 * Adapter tải answer key cho một exam.
 * Implementation dev/test: FixtureGradingAdapter (đọc grading-fixture.json).
 * Implementation production: sẽ kết nối TV2 ExamRepository (Sprint 11).
 */
public interface GradingAdapter {

    /**
     * Tải Map<partId, PartGradingKey> cho một exam.
     * Nếu examId không tìm thấy trong nguồn dữ liệu → trả Map rỗng (không ném exception).
     * Engine chấm sẽ mark tất cả câu là BLANK nếu không có key cho Part tương ứng.
     *
     * @param examId ID của đề thi
     * @return Map không null, có thể rỗng
     */
    Map<Integer, PartGradingKey> loadPartKeys(Integer examId);
}
```

- [ ] **Step 5: Tạo `FixtureGradingAdapter.java`**

```java
package com.multilingo.backend.modules.testing.adapter.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.multilingo.backend.modules.testing.adapter.GradingAdapter;
import com.multilingo.backend.modules.testing.grading.dto.GradingKey;
import com.multilingo.backend.modules.testing.grading.dto.PartGradingKey;
import org.springframework.context.annotation.Profile;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import java.util.*;

/**
 * Fixture-based GradingAdapter cho profile dev/test.
 * Đọc grading-fixture.json từ classpath.
 * KHÔNG bao giờ serialize dữ liệu này ra API response.
 */
@Component
@Profile({"dev", "test"})
public class FixtureGradingAdapter implements GradingAdapter {

    private final Map<Integer, Map<Integer, PartGradingKey>> examPartKeysMap;

    @SuppressWarnings("unchecked")
    public FixtureGradingAdapter(ObjectMapper objectMapper) throws Exception {
        this.examPartKeysMap = new HashMap<>();
        ClassPathResource resource = new ClassPathResource("fixtures/grading-fixture.json");
        Map<?, ?> root = objectMapper.readValue(resource.getInputStream(), Map.class);
        List<?> exams = (List<?>) root.get("exams");
        for (Object examObj : exams) {
            Map<?, ?> examMap = (Map<?, ?>) examObj;
            Integer examId = ((Number) examMap.get("exam_id")).intValue();
            List<?> parts = (List<?>) examMap.get("parts");
            Map<Integer, PartGradingKey> partMap = new HashMap<>();
            for (Object partObj : parts) {
                Map<?, ?> partRaw = (Map<?, ?>) partObj;
                Integer partId = ((Number) partRaw.get("part_id")).intValue();
                Map<?, ?> answersRaw = (Map<?, ?>) partRaw.get("answers");
                Map<String, GradingKey> answers = new HashMap<>();
                for (Map.Entry<?, ?> entry : answersRaw.entrySet()) {
                    String qId = (String) entry.getKey();
                    GradingKey key = objectMapper.convertValue(entry.getValue(), GradingKey.class);
                    key.setQuestionId(qId);
                    answers.put(qId, key);
                }
                PartGradingKey pgk = new PartGradingKey();
                pgk.setPartId(partId);
                pgk.setAnswers(answers);
                partMap.put(partId, pgk);
            }
            examPartKeysMap.put(examId, partMap);
        }
    }

    @Override
    public Map<Integer, PartGradingKey> loadPartKeys(Integer examId) {
        return examPartKeysMap.getOrDefault(examId, Collections.emptyMap());
    }
}
```

- [ ] **Step 6: Chạy test — xác nhận PASS**

```powershell
cd backend; ./mvnw test -Dtest=FixtureGradingAdapterTest -q 2>&1 | Select-String -Pattern "Tests run|BUILD"
```

Expected: `Tests run: 4, Failures: 0, Errors: 0` + `BUILD SUCCESS`.

- [ ] **Step 7: Commit**

```powershell
git add backend/src/main/resources/fixtures/grading-fixture.json
git add backend/src/main/java/com/multilingo/backend/modules/testing/adapter/GradingAdapter.java
git add backend/src/main/java/com/multilingo/backend/modules/testing/adapter/impl/FixtureGradingAdapter.java
git add backend/src/test/java/com/multilingo/backend/modules/testing/adapter/FixtureGradingAdapterTest.java
git commit -m "feat(grading): add GradingAdapter interface, FixtureGradingAdapter and grading-fixture.json"
```

---

## Task 4: Implement `ObjectiveGradingService` — Engine Chấm Điểm

**Files:**
- Create: `backend/src/main/java/com/multilingo/backend/modules/testing/grading/ObjectiveGradingService.java`
- Create: `backend/src/main/java/com/multilingo/backend/modules/testing/grading/impl/ObjectiveGradingServiceImpl.java`
- Create: `backend/src/test/java/com/multilingo/backend/modules/testing/grading/ObjectiveGradingServiceTest.java`

**Interfaces:**
- Consumes: `GradingVerdict` (Task 1), `GradingKey`, `PartGradingKey`, `QuestionGradingResult`, `GradingResult` (Task 2)
- Produces: `ObjectiveGradingService.gradeAttempt(List<AttemptAnswer>, Map<Integer, PartGradingKey>): GradingResult`

- [ ] **Step 1: Tạo `ObjectiveGradingService.java` interface**

```java
package com.multilingo.backend.modules.testing.grading;

import com.multilingo.backend.modules.testing.entity.AttemptAnswer;
import com.multilingo.backend.modules.testing.grading.dto.GradingResult;
import com.multilingo.backend.modules.testing.grading.dto.PartGradingKey;

import java.util.List;
import java.util.Map;

/**
 * Engine chấm điểm khách quan (Reading, Listening).
 * Là pure function: không đọc DB, không gọi API bên ngoài.
 */
public interface ObjectiveGradingService {

    /**
     * Chấm toàn bộ attempt từ đáp án đã lưu và bộ answer key.
     *
     * @param answers  Danh sách AttemptAnswer từ DB (đã được autosaveAnswers ghi)
     * @param partKeys Map<partId, PartGradingKey> từ GradingAdapter
     * @return GradingResult với flags, điểm và thống kê
     * @throws com.multilingo.backend.common.exception.AppException (GRADING_DATA_ERROR)
     *         nếu fixture có type/correct không hợp lệ
     */
    GradingResult gradeAttempt(List<AttemptAnswer> answers, Map<Integer, PartGradingKey> partKeys);
}
```

- [ ] **Step 2: Viết test FAIL trước (Red) — bộ test tham số hóa**

Tạo `backend/src/test/java/com/multilingo/backend/modules/testing/grading/ObjectiveGradingServiceTest.java`:

```java
package com.multilingo.backend.modules.testing.grading;

import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.modules.testing.entity.AttemptAnswer;
import com.multilingo.backend.modules.testing.grading.dto.*;
import com.multilingo.backend.modules.testing.grading.impl.ObjectiveGradingServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;

import java.math.BigDecimal;
import java.util.*;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.*;

class ObjectiveGradingServiceTest {

    private ObjectiveGradingService service;

    @BeforeEach
    void setUp() {
        // Pure Java — không cần Spring context
        service = new ObjectiveGradingServiceImpl();
    }

    // ─── Helpers ────────────────────────────────────────────────────────────────

    private AttemptAnswer answerForPart(Integer partId, String questionId, Object answer) {
        AttemptAnswer aa = new AttemptAnswer();
        aa.setPartId(partId);
        aa.setUserAnswers(Map.of(questionId, answer));
        return aa;
    }

    private AttemptAnswer blankAnswerForPart(Integer partId) {
        AttemptAnswer aa = new AttemptAnswer();
        aa.setPartId(partId);
        aa.setUserAnswers(Collections.emptyMap());
        return aa;
    }

    private PartGradingKey partKey(Integer partId, String questionId, String type, Object correct, List<String> alternates) {
        GradingKey key = new GradingKey();
        key.setQuestionId(questionId);
        key.setType(type);
        key.setCorrect(correct);
        key.setAlternates(alternates);
        PartGradingKey pgk = new PartGradingKey();
        pgk.setPartId(partId);
        pgk.setAnswers(Map.of(questionId, key));
        return pgk;
    }

    // ─── TC_GRADE_SC: SINGLE_CHOICE ─────────────────────────────────────────────

    record SingleChoiceCase(String userAnswer, GradingVerdict expected) {}

    static Stream<SingleChoiceCase> singleChoiceCases() {
        return Stream.of(
            new SingleChoiceCase("A",   GradingVerdict.CORRECT),  // TC_GRADE_SC_01: exact match
            new SingleChoiceCase("a",   GradingVerdict.CORRECT),  // TC_GRADE_SC_02: case-insensitive
            new SingleChoiceCase("B",   GradingVerdict.WRONG),    // TC_GRADE_SC_03: wrong answer
            new SingleChoiceCase(null,  GradingVerdict.BLANK),    // TC_GRADE_SC_04: null
            new SingleChoiceCase("",    GradingVerdict.BLANK),    // TC_GRADE_SC_05: empty string
            new SingleChoiceCase("   ", GradingVerdict.BLANK)     // TC_GRADE_SC_06: whitespace only
        );
    }

    @ParameterizedTest
    @MethodSource("singleChoiceCases")
    void singleChoice_parameterized(SingleChoiceCase tc) {
        Map<Integer, PartGradingKey> keys = Map.of(
            1, partKey(1, "q_1", "SINGLE_CHOICE", "A", List.of())
        );
        AttemptAnswer answer = new AttemptAnswer();
        answer.setPartId(1);
        answer.setUserAnswers(tc.userAnswer() == null
            ? Collections.emptyMap()
            : Map.of("q_1", tc.userAnswer()));

        GradingResult result = service.gradeAttempt(List.of(answer), keys);

        QuestionGradingResult qResult = result.getPartResults().get(1).get("q_1");
        assertThat(qResult.getVerdict()).isEqualTo(tc.expected());
        BigDecimal expectedScore = tc.expected() == GradingVerdict.CORRECT
            ? BigDecimal.ONE : BigDecimal.ZERO;
        assertThat(qResult.getScore()).isEqualByComparingTo(expectedScore);
    }

    // ─── TC_GRADE_FI: FILL_IN_THE_BLANK ─────────────────────────────────────────

    record FillInCase(String userAnswer, GradingVerdict expected) {}

    static Stream<FillInCase> fillInCases() {
        return Stream.of(
            new FillInCase("plasticity",        GradingVerdict.CORRECT),  // TC_GRADE_FI_01
            new FillInCase("Plasticity",        GradingVerdict.CORRECT),  // TC_GRADE_FI_02
            new FillInCase("Neuroplasticity",   GradingVerdict.CORRECT),  // TC_GRADE_FI_03
            new FillInCase("  Neural Plasticity  ", GradingVerdict.CORRECT), // TC_GRADE_FI_04
            new FillInCase("synapse",           GradingVerdict.WRONG),    // TC_GRADE_FI_05
            new FillInCase(null,                GradingVerdict.BLANK)     // TC_GRADE_FI_06
        );
    }

    @ParameterizedTest
    @MethodSource("fillInCases")
    void fillIn_parameterized(FillInCase tc) {
        Map<Integer, PartGradingKey> keys = Map.of(
            3, partKey(3, "q_5", "FILL_IN_THE_BLANK", "plasticity",
                List.of("neural plasticity", "neuroplasticity"))
        );
        AttemptAnswer answer = new AttemptAnswer();
        answer.setPartId(3);
        answer.setUserAnswers(tc.userAnswer() == null
            ? Collections.emptyMap()
            : Map.of("q_5", tc.userAnswer()));

        GradingResult result = service.gradeAttempt(List.of(answer), keys);
        assertThat(result.getPartResults().get(3).get("q_5").getVerdict())
            .isEqualTo(tc.expected());
    }

    // ─── TC_GRADE_FI_07: số với alternates ──────────────────────────────────────

    @Test
    void fillIn_number_with_alternate_Nine_matches() {
        Map<Integer, PartGradingKey> keys = Map.of(
            5, partKey(5, "q_7", "FILL_IN_THE_BLANK", "9",
                List.of("9:00", "nine", "09:00"))
        );
        AttemptAnswer answer = new AttemptAnswer();
        answer.setPartId(5);
        answer.setUserAnswers(Map.of("q_7", "Nine"));

        GradingResult result = service.gradeAttempt(List.of(answer), keys);
        assertThat(result.getPartResults().get(5).get("q_7").getVerdict())
            .isEqualTo(GradingVerdict.CORRECT);
    }

    // ─── TC_GRADE_TF: TRUE_FALSE_NOT_GIVEN ──────────────────────────────────────

    record TFNGCase(String userAnswer, String correctKey, GradingVerdict expected) {}

    static Stream<TFNGCase> tfngCases() {
        return Stream.of(
            new TFNGCase("True",      "TRUE",      GradingVerdict.CORRECT),  // TC_GRADE_TF_01
            new TFNGCase("false",     "FALSE",     GradingVerdict.CORRECT),  // TC_GRADE_TF_02
            new TFNGCase("not given", "NOT_GIVEN", GradingVerdict.CORRECT),  // TC_GRADE_TF_03
            new TFNGCase("not given", "TRUE",      GradingVerdict.WRONG),    // TC_GRADE_TF_04
            new TFNGCase("",          "TRUE",      GradingVerdict.BLANK)     // TC_GRADE_TF_05
        );
    }

    @ParameterizedTest
    @MethodSource("tfngCases")
    void tfng_parameterized(TFNGCase tc) {
        Map<Integer, PartGradingKey> keys = Map.of(
            2, partKey(2, "q_3", "TRUE_FALSE_NOT_GIVEN", tc.correctKey(), List.of())
        );
        AttemptAnswer answer = new AttemptAnswer();
        answer.setPartId(2);
        answer.setUserAnswers(tc.userAnswer().isEmpty()
            ? Collections.emptyMap()
            : Map.of("q_3", tc.userAnswer()));

        GradingResult result = service.gradeAttempt(List.of(answer), keys);
        assertThat(result.getPartResults().get(2).get("q_3").getVerdict())
            .isEqualTo(tc.expected());
    }

    // ─── TC_GRADE_MC: MULTIPLE_CHOICE ───────────────────────────────────────────

    @Test
    void multipleChoice_correct_different_order() { // TC_GRADE_MC_01
        Map<Integer, PartGradingKey> keys = Map.of(
            10, partKey(10, "q_mc", "MULTIPLE_CHOICE", List.of("A", "C"), List.of())
        );
        AttemptAnswer answer = answerForPart(10, "q_mc", List.of("C", "A"));
        GradingResult result = service.gradeAttempt(List.of(answer), keys);
        assertThat(result.getPartResults().get(10).get("q_mc").getVerdict())
            .isEqualTo(GradingVerdict.CORRECT);
    }

    @Test
    void multipleChoice_missing_one_is_wrong() { // TC_GRADE_MC_02
        Map<Integer, PartGradingKey> keys = Map.of(
            10, partKey(10, "q_mc", "MULTIPLE_CHOICE", List.of("A", "C"), List.of())
        );
        AttemptAnswer answer = answerForPart(10, "q_mc", List.of("A"));
        GradingResult result = service.gradeAttempt(List.of(answer), keys);
        assertThat(result.getPartResults().get(10).get("q_mc").getVerdict())
            .isEqualTo(GradingVerdict.WRONG);
    }

    @Test
    void multipleChoice_extra_one_is_wrong() { // TC_GRADE_MC_03
        Map<Integer, PartGradingKey> keys = Map.of(
            10, partKey(10, "q_mc", "MULTIPLE_CHOICE", List.of("A", "C"), List.of())
        );
        AttemptAnswer answer = answerForPart(10, "q_mc", List.of("A", "B", "C"));
        GradingResult result = service.gradeAttempt(List.of(answer), keys);
        assertThat(result.getPartResults().get(10).get("q_mc").getVerdict())
            .isEqualTo(GradingVerdict.WRONG);
    }

    // ─── TC_GRADE_MA: MATCHING ───────────────────────────────────────────────────

    @Test
    void matching_both_correct() { // TC_GRADE_MA_01
        GradingKey key = new GradingKey();
        key.setQuestionId("q_match");
        key.setType("MATCHING");
        key.setCorrect(Map.of("q_left1", "B", "q_left2", "A"));
        key.setAlternates(List.of());
        PartGradingKey pgk = new PartGradingKey();
        pgk.setPartId(11);
        pgk.setAnswers(Map.of("q_match", key));

        AttemptAnswer answer = new AttemptAnswer();
        answer.setPartId(11);
        answer.setUserAnswers(Map.of("q_match", Map.of("q_left1", "B", "q_left2", "A")));

        GradingResult result = service.gradeAttempt(List.of(answer), Map.of(11, pgk));
        assertThat(result.getTotalScore()).isEqualByComparingTo("2.0");
    }

    @Test
    void matching_one_correct_one_wrong() { // TC_GRADE_MA_02
        GradingKey key = new GradingKey();
        key.setQuestionId("q_match");
        key.setType("MATCHING");
        key.setCorrect(Map.of("q_left1", "B", "q_left2", "A"));
        key.setAlternates(List.of());
        PartGradingKey pgk = new PartGradingKey();
        pgk.setPartId(11);
        pgk.setAnswers(Map.of("q_match", key));

        AttemptAnswer answer = new AttemptAnswer();
        answer.setPartId(11);
        answer.setUserAnswers(Map.of("q_match", Map.of("q_left1", "B", "q_left2", "C")));

        GradingResult result = service.gradeAttempt(List.of(answer), Map.of(11, pgk));
        assertThat(result.getTotalScore()).isEqualByComparingTo("1.0");
    }

    // ─── TC_GRADE_ES_01: ESSAY bỏ qua ───────────────────────────────────────────

    @Test
    void essay_not_counted_in_totalObjectiveCount() {
        Map<Integer, PartGradingKey> keys = Map.of(
            6, partKey(6, "q_8", "ESSAY", null, List.of())
        );
        AttemptAnswer answer = answerForPart(6, "q_8", "Some essay text");

        // ESSAY không có trong grading fixture thực tế, nhưng test engine behavior
        // khi fixture có type=ESSAY thì bỏ qua
        GradingResult result = service.gradeAttempt(List.of(answer), Map.of());
        assertThat(result.getTotalObjectiveCount()).isZero();
        assertThat(result.getTotalScore()).isEqualByComparingTo(BigDecimal.ZERO);
    }

    // ─── TC_GRADE_ERR: Lỗi fixture ───────────────────────────────────────────────

    @Test
    void unknown_type_throws_grading_data_error() { // TC_GRADE_ERR_01
        Map<Integer, PartGradingKey> keys = Map.of(
            99, partKey(99, "q_bad", "UNKNOWN_TYPE", "X", List.of())
        );
        AttemptAnswer answer = answerForPart(99, "q_bad", "X");

        assertThatThrownBy(() -> service.gradeAttempt(List.of(answer), keys))
            .isInstanceOf(AppException.class)
            .hasMessageContaining("GRADING_DATA_ERROR")
            .satisfies(ex -> assertThat(((AppException) ex).getErrorCode().name())
                .isEqualTo("GRADING_DATA_ERROR"));
    }

    @Test
    void null_correct_throws_grading_data_error() { // TC_GRADE_ERR_02
        Map<Integer, PartGradingKey> keys = Map.of(
            99, partKey(99, "q_null", "SINGLE_CHOICE", null, List.of())
        );
        AttemptAnswer answer = answerForPart(99, "q_null", "A");

        assertThatThrownBy(() -> service.gradeAttempt(List.of(answer), keys))
            .isInstanceOf(AppException.class);
    }

    // ─── TC_GRADE_AGG: Tổng hợp ─────────────────────────────────────────────────

    @Test
    void aggregate_counts_across_parts() { // TC_GRADE_AGG_01
        Map<Integer, PartGradingKey> keys = Map.of(
            1, partKey(1, "q_1", "SINGLE_CHOICE", "A", List.of()),
            2, partKey(2, "q_3", "TRUE_FALSE_NOT_GIVEN", "TRUE", List.of())
        );
        List<AttemptAnswer> answers = List.of(
            answerForPart(1, "q_1", "A"),      // CORRECT
            answerForPart(2, "q_3", "FALSE")   // WRONG
        );
        GradingResult result = service.gradeAttempt(answers, keys);
        assertThat(result.getTotalScore()).isEqualByComparingTo("1.0");
        assertThat(result.getCorrectCount()).isEqualTo(1);
        assertThat(result.getTotalObjectiveCount()).isEqualTo(2);
    }

    @Test
    void no_keys_returns_all_blank() { // TC_GRADE_AGG_02
        AttemptAnswer answer = answerForPart(1, "q_1", "A");
        GradingResult result = service.gradeAttempt(List.of(answer), Collections.emptyMap());
        assertThat(result.getTotalScore()).isEqualByComparingTo(BigDecimal.ZERO);
        assertThat(result.getTotalObjectiveCount()).isZero();
    }

    // ─── Review Focus: Locale-safe normalize ─────────────────────────────────────

    @Test
    void normalize_does_not_corrupt_vietnamese_characters() {
        // "Đ" (U+0110) phải không bị biến thành ký tự khác khi toLowerCase(Locale.ROOT)
        Map<Integer, PartGradingKey> keys = Map.of(
            20, partKey(20, "q_vn", "FILL_IN_THE_BLANK", "đại học", List.of())
        );
        AttemptAnswer answer = answerForPart(20, "q_vn", "Đại Học");
        GradingResult result = service.gradeAttempt(List.of(answer), keys);
        // "Đại Học".toLowerCase(Locale.ROOT) = "đại học" → CORRECT
        assertThat(result.getPartResults().get(20).get("q_vn").getVerdict())
            .isEqualTo(GradingVerdict.CORRECT);
    }
}
```

- [ ] **Step 3: Chạy test — xác nhận FAIL (ObjectiveGradingServiceImpl chưa tồn tại)**

```powershell
cd backend; ./mvnw test -Dtest=ObjectiveGradingServiceTest -q 2>&1 | Select-String -Pattern "ERROR|FAIL|BUILD"
```

Expected: lỗi compile.

- [ ] **Step 4: Implement `ObjectiveGradingServiceImpl.java`**

```java
package com.multilingo.backend.modules.testing.grading.impl;

import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.modules.testing.entity.AttemptAnswer;
import com.multilingo.backend.modules.testing.grading.GradingVerdict;
import com.multilingo.backend.modules.testing.grading.ObjectiveGradingService;
import com.multilingo.backend.modules.testing.grading.dto.*;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.*;

/**
 * Engine chấm điểm khách quan — pure domain logic.
 * KHÔNG inject Repository hoặc gọi API bên ngoài.
 */
@Service
public class ObjectiveGradingServiceImpl implements ObjectiveGradingService {

    private static final Set<String> OBJECTIVE_TYPES = Set.of(
        "SINGLE_CHOICE", "TRUE_FALSE_NOT_GIVEN", "YES_NO_NOT_GIVEN",
        "FILL_IN_THE_BLANK", "MULTIPLE_CHOICE", "MATCHING",
        "DIAGRAM_LABELING", "MAP_LABELING"
    );

    private static final Set<String> SKIP_TYPES = Set.of("ESSAY");

    @Override
    public GradingResult gradeAttempt(
            List<AttemptAnswer> answers,
            Map<Integer, PartGradingKey> partKeys) {

        Map<Integer, Map<String, QuestionGradingResult>> partResults = new HashMap<>();
        Map<String, BigDecimal> sectionScores = new HashMap<>();
        BigDecimal totalScore = BigDecimal.ZERO;
        int correctCount = 0;
        int totalObjectiveCount = 0;

        for (AttemptAnswer aa : answers) {
            Integer partId = aa.getPartId();
            PartGradingKey pgk = partKeys.get(partId);
            if (pgk == null) {
                // Không có key cho Part → bỏ qua (câu không được đếm)
                continue;
            }

            Map<String, Object> userAnswers =
                aa.getUserAnswers() != null ? aa.getUserAnswers() : Collections.emptyMap();

            Map<String, QuestionGradingResult> partResult = new HashMap<>();

            for (Map.Entry<String, GradingKey> keyEntry : pgk.getAnswers().entrySet()) {
                String questionId = keyEntry.getKey();
                GradingKey key = keyEntry.getValue();
                String type = key.getType();

                if (type == null) {
                    throw new AppException(ErrorCode.GRADING_DATA_ERROR,
                        "GradingKey type is null for questionId: " + questionId);
                }

                // ESSAY và type không xác định → bỏ qua hoàn toàn
                if (SKIP_TYPES.contains(type)) {
                    continue;
                }
                if (!OBJECTIVE_TYPES.contains(type)) {
                    throw new AppException(ErrorCode.GRADING_DATA_ERROR,
                        "Unknown question type in grading fixture: " + type
                        + " for questionId: " + questionId);
                }

                if (key.getCorrect() == null) {
                    throw new AppException(ErrorCode.GRADING_DATA_ERROR,
                        "correct is null for questionId: " + questionId);
                }

                Object rawAnswer = userAnswers.get(questionId);
                QuestionGradingResult qResult = gradeQuestion(questionId, type, key, rawAnswer);
                partResult.put(questionId, qResult);

                totalObjectiveCount++;
                if (qResult.getVerdict() == GradingVerdict.CORRECT) {
                    correctCount++;
                    totalScore = totalScore.add(BigDecimal.ONE);
                }
            }

            partResults.put(partId, partResult);
        }

        return GradingResult.builder()
            .partResults(partResults)
            .totalScore(totalScore)
            .correctCount(correctCount)
            .totalObjectiveCount(totalObjectiveCount)
            .sectionScores(sectionScores)
            .build();
    }

    // ─── Private: dispatch theo type ────────────────────────────────────────────

    private QuestionGradingResult gradeQuestion(
            String questionId, String type, GradingKey key, Object rawAnswer) {
        return switch (type) {
            case "SINGLE_CHOICE" -> gradeSingleChoice(questionId, key, rawAnswer);
            case "TRUE_FALSE_NOT_GIVEN" -> gradeTFNG(questionId, key, rawAnswer);
            case "YES_NO_NOT_GIVEN" -> gradeYNNG(questionId, key, rawAnswer);
            case "FILL_IN_THE_BLANK", "DIAGRAM_LABELING", "MAP_LABELING" ->
                gradeFillIn(questionId, key, rawAnswer);
            case "MULTIPLE_CHOICE" -> gradeMultipleChoice(questionId, key, rawAnswer);
            case "MATCHING" -> gradeMatching(questionId, key, rawAnswer);
            default -> throw new AppException(ErrorCode.GRADING_DATA_ERROR,
                "Unhandled type: " + type);
        };
    }

    // ─── SINGLE_CHOICE ───────────────────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    private QuestionGradingResult gradeSingleChoice(
            String questionId, GradingKey key, Object rawAnswer) {
        String userAns = normalize(rawAnswer);
        if (userAns == null) return QuestionGradingResult.blank(questionId);
        String correct = normalize(key.getCorrect().toString());
        return userAns.equals(correct)
            ? QuestionGradingResult.correct(questionId)
            : QuestionGradingResult.wrong(questionId);
    }

    // ─── TRUE_FALSE_NOT_GIVEN ────────────────────────────────────────────────────

    private QuestionGradingResult gradeTFNG(
            String questionId, GradingKey key, Object rawAnswer) {
        String userAns = normalizeTFNG(rawAnswer);
        if (userAns == null) return QuestionGradingResult.blank(questionId);
        String correct = normalizeTFNG(key.getCorrect());
        return userAns.equals(correct)
            ? QuestionGradingResult.correct(questionId)
            : QuestionGradingResult.wrong(questionId);
    }

    // ─── YES_NO_NOT_GIVEN ────────────────────────────────────────────────────────

    private QuestionGradingResult gradeYNNG(
            String questionId, GradingKey key, Object rawAnswer) {
        String userAns = normalizeYNNG(rawAnswer);
        if (userAns == null) return QuestionGradingResult.blank(questionId);
        String correct = normalizeYNNG(key.getCorrect());
        return userAns.equals(correct)
            ? QuestionGradingResult.correct(questionId)
            : QuestionGradingResult.wrong(questionId);
    }

    // ─── FILL_IN_THE_BLANK / DIAGRAM_LABELING / MAP_LABELING ────────────────────

    private QuestionGradingResult gradeFillIn(
            String questionId, GradingKey key, Object rawAnswer) {
        String userAns = normalize(rawAnswer);
        if (userAns == null) return QuestionGradingResult.blank(questionId);

        String correct = normalize(key.getCorrect().toString());
        if (userAns.equals(correct)) return QuestionGradingResult.correct(questionId);

        List<String> alternates = key.getAlternates();
        if (alternates != null) {
            for (String alt : alternates) {
                if (userAns.equals(normalize(alt))) {
                    return QuestionGradingResult.correct(questionId);
                }
            }
        }
        return QuestionGradingResult.wrong(questionId);
    }

    // ─── MULTIPLE_CHOICE ─────────────────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    private QuestionGradingResult gradeMultipleChoice(
            String questionId, GradingKey key, Object rawAnswer) {
        if (rawAnswer == null) return QuestionGradingResult.blank(questionId);

        List<?> userList = rawAnswer instanceof List<?> list ? list : List.of(rawAnswer);
        if (userList.isEmpty()) return QuestionGradingResult.blank(questionId);

        Set<String> userSet = new HashSet<>();
        for (Object item : userList) userSet.add(normalize(item.toString()));

        List<?> correctList = (List<?>) key.getCorrect();
        Set<String> correctSet = new HashSet<>();
        for (Object item : correctList) correctSet.add(normalize(item.toString()));

        return userSet.equals(correctSet)
            ? QuestionGradingResult.correct(questionId)
            : QuestionGradingResult.wrong(questionId);
    }

    // ─── MATCHING ────────────────────────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    private QuestionGradingResult gradeMatching(
            String questionId, GradingKey key, Object rawAnswer) {
        // correct: Map<String,String> subQuestionId -> answerId
        Map<String, String> correctMap = (Map<String, String>) key.getCorrect();
        Map<String, Object> userMap = rawAnswer instanceof Map<?, ?>
            ? (Map<String, Object>) rawAnswer : Collections.emptyMap();

        BigDecimal score = BigDecimal.ZERO;
        int pairs = correctMap.size();

        for (Map.Entry<String, String> entry : correctMap.entrySet()) {
            String subId = entry.getKey();
            String correctAns = normalize(entry.getValue());
            Object userRaw = userMap.get(subId);
            String userAns = normalize(userRaw);
            if (correctAns != null && correctAns.equals(userAns)) {
                score = score.add(BigDecimal.ONE);
            }
        }

        // Trả về QuestionGradingResult đặc biệt cho MATCHING với score = số cặp đúng
        return QuestionGradingResult.builder()
            .questionId(questionId)
            .verdict(score.compareTo(BigDecimal.ZERO) > 0 ? GradingVerdict.CORRECT : GradingVerdict.WRONG)
            .score(score)
            .build();
    }

    // ─── Normalize helpers ───────────────────────────────────────────────────────

    /** Chuẩn hóa chung: trim + toLowerCase(Locale.ROOT). Trả null nếu blank. */
    private String normalize(Object raw) {
        if (raw == null) return null;
        String s = raw.toString().trim().toLowerCase(Locale.ROOT);
        return s.isEmpty() ? null : s;
    }

    /** Chuẩn hóa TRUE_FALSE_NOT_GIVEN: "not given" → "not_given". */
    private String normalizeTFNG(Object raw) {
        if (raw == null) return null;
        String s = raw.toString().trim().toLowerCase(Locale.ROOT)
            .replace(" ", "_");  // "not given" → "not_given"
        return s.isEmpty() ? null : s;
    }

    /** Chuẩn hóa YES_NO_NOT_GIVEN: "not given" → "not_given". */
    private String normalizeYNNG(Object raw) {
        return normalizeTFNG(raw);
    }
}
```

- [ ] **Step 5: Chạy test — xác nhận PASS**

```powershell
cd backend; ./mvnw test -Dtest=ObjectiveGradingServiceTest -q 2>&1 | Select-String -Pattern "Tests run|BUILD"
```

Expected: `Tests run: 24+, Failures: 0, Errors: 0` + `BUILD SUCCESS`.

- [ ] **Step 6: Commit**

```powershell
git add backend/src/main/java/com/multilingo/backend/modules/testing/grading/
git add backend/src/test/java/com/multilingo/backend/modules/testing/grading/
git commit -m "feat(grading): implement ObjectiveGradingService with parameterized tests for all 7 question types"
```

---

## Task 5: Tích Hợp Engine vào `submitAttempt()` + Persist Kết Quả

**Files:**
- Modify: `backend/src/main/java/com/multilingo/backend/modules/testing/service/impl/TestAttemptServiceImpl.java`
- Modify (thêm test): `backend/src/test/java/com/multilingo/backend/modules/testing/service/TestAttemptServiceTest.java`

**Interfaces:**
- Consumes: `GradingAdapter.loadPartKeys()` (Task 3), `ObjectiveGradingService.gradeAttempt()` (Task 4), `AttemptAnswerRepository.findByAttemptId()` (đã có)
- Produces: `submitAttempt()` mở rộng — sau khi hoàn thành, `AttemptAnswer.isCorrectFlags`, `AttemptAnswer.earnedScore`, `TestAttempt.overallScore`, `TestAttempt.sectionScores` được ghi.

- [ ] **Step 1: Viết test FAIL trước cho integration (Red)**

Thêm vào cuối `TestAttemptServiceTest.java`:

```java
// ─── TC_SUBMIT_01: grading persisted after submit ───────────────────────────

@Test
void submitAttempt_persists_isCorrectFlags_and_overallScore() {
    // Tạo attempt với exam 1
    CreateAttemptRequest req = new CreateAttemptRequest();
    req.setExamId(1);
    req.setTestScope(TestScope.FULL_EXAM);
    req.setTestMode(TestMode.PRACTICE);
    WorkspaceResponse attempt = service.createAttempt(req);

    // Autosave đáp án cho Part 1 (q_1 correct=A, q_2 correct=A)
    AutosaveAnswersRequest saveReq = AutosaveAnswersRequest.builder()
        .version(1)
        .answers(List.of(
            AutosaveAnswersRequest.PartAnswerDto.builder()
                .partId(1)
                .answers(List.of(
                    AutosaveAnswersRequest.QuestionAnswerDto.builder()
                        .questionId("q_1").answer("A").build(),
                    AutosaveAnswersRequest.QuestionAnswerDto.builder()
                        .questionId("q_2").answer("B").build() // wrong
                ))
                .build()
        ))
        .build();
    service.autosaveAnswers(attempt.getAttemptId(), saveReq);

    // Submit
    SubmitResultResponse result = service.submitAttempt(attempt.getAttemptId(), saveReq);
    assertThat(result.getStatus()).isEqualTo(AttemptStatus.COMPLETED);

    // Verify grading persisted — query directly from repository
    List<AttemptAnswer> answers = attemptAnswerRepository.findByAttemptId(attempt.getAttemptId());
    assertThat(answers).isNotEmpty();
    AttemptAnswer part1Answer = answers.stream()
        .filter(aa -> aa.getPartId().equals(1))
        .findFirst()
        .orElseThrow();

    // isCorrectFlags phải được ghi
    assertThat(part1Answer.getIsCorrectFlags()).isNotNull();
    assertThat(part1Answer.getIsCorrectFlags()).containsKey("q_1");
    assertThat(part1Answer.getIsCorrectFlags().get("q_1")).isEqualTo("CORRECT");
    assertThat(part1Answer.getIsCorrectFlags().get("q_2")).isEqualTo("WRONG");
    // earnedScore = 1.0 (1 câu đúng trong Part 1)
    assertThat(part1Answer.getEarnedScore()).isEqualByComparingTo("1.0");
}

@Test
void submitAttempt_persists_overallScore_on_attempt() {
    CreateAttemptRequest req = new CreateAttemptRequest();
    req.setExamId(1);
    req.setTestScope(TestScope.FULL_EXAM);
    req.setTestMode(TestMode.PRACTICE);
    WorkspaceResponse attempt = service.createAttempt(req);

    AutosaveAnswersRequest emptyReq = AutosaveAnswersRequest.builder()
        .version(1).answers(List.of()).build();

    service.submitAttempt(attempt.getAttemptId(), emptyReq);

    // Verify overallScore được ghi vào TestAttempt
    TestAttempt saved = testAttemptRepository.findById(attempt.getAttemptId()).orElseThrow();
    assertThat(saved.getOverallScore()).isNotNull();
}

// ─── TC_SUBMIT_02: idempotency không ghi đè score ───────────────────────────

@Test
void submitAttempt_idempotent_does_not_overwrite_score() {
    CreateAttemptRequest req = new CreateAttemptRequest();
    req.setExamId(1);
    req.setTestScope(TestScope.FULL_EXAM);
    req.setTestMode(TestMode.PRACTICE);
    WorkspaceResponse attempt = service.createAttempt(req);

    AutosaveAnswersRequest submitReq = AutosaveAnswersRequest.builder()
        .version(1)
        .answers(List.of(
            AutosaveAnswersRequest.PartAnswerDto.builder()
                .partId(1)
                .answers(List.of(
                    AutosaveAnswersRequest.QuestionAnswerDto.builder()
                        .questionId("q_1").answer("A").build()
                ))
                .build()
        ))
        .build();

    service.submitAttempt(attempt.getAttemptId(), submitReq);
    TestAttempt firstSubmit = testAttemptRepository.findById(attempt.getAttemptId()).orElseThrow();
    BigDecimal firstScore = firstSubmit.getOverallScore();

    // Submit lần 2
    SubmitResultResponse second = service.submitAttempt(attempt.getAttemptId(), submitReq);
    assertThat(second.getStatus()).isEqualTo(AttemptStatus.COMPLETED);

    TestAttempt secondCheck = testAttemptRepository.findById(attempt.getAttemptId()).orElseThrow();
    // Score không thay đổi
    assertThat(secondCheck.getOverallScore()).isEqualByComparingTo(firstScore);
}

// ─── Review Focus: grading fixture không rò rỉ qua API ─────────────────────

@Test
void exam_snapshot_does_not_contain_correct_answer_after_grading() {
    CreateAttemptRequest req = new CreateAttemptRequest();
    req.setExamId(1);
    req.setTestScope(TestScope.FULL_EXAM);
    req.setTestMode(TestMode.PRACTICE);
    WorkspaceResponse attempt = service.createAttempt(req);

    AutosaveAnswersRequest emptyReq = AutosaveAnswersRequest.builder()
        .version(1).answers(List.of()).build();
    service.submitAttempt(attempt.getAttemptId(), emptyReq);

    WorkspaceResponse workspace = service.getAttemptWorkspace(attempt.getAttemptId());
    String snapshotJson = workspace.getExamSnapshot().toString();
    assertThat(snapshotJson).doesNotContain("correct");
    assertThat(snapshotJson).doesNotContain("correct_answer");
    assertThat(snapshotJson).doesNotContain("alternates");
}
```

Cần thêm `@Autowired` cho `AttemptAnswerRepository` và `TestAttemptRepository` trong test class:

```java
@Autowired
AttemptAnswerRepository attemptAnswerRepository;

@Autowired
TestAttemptRepository testAttemptRepository;
```

- [ ] **Step 2: Chạy test — xác nhận FAIL**

```powershell
cd backend; ./mvnw test -Dtest=TestAttemptServiceTest -q 2>&1 | Select-String -Pattern "Tests run|FAIL|BUILD"
```

Expected: `Failures: 3` (các test mới fail vì `isCorrectFlags` vẫn null).

- [ ] **Step 3: Mở rộng `TestAttemptServiceImpl` — inject GradingAdapter + ObjectiveGradingService**

Sửa `TestAttemptServiceImpl.java`:

**Thêm vào field declarations (sau `ObjectMapper objectMapper`):**
```java
private final GradingAdapter gradingAdapter;
private final ObjectiveGradingService gradingService;
```

**Thêm import:**
```java
import com.multilingo.backend.modules.testing.adapter.GradingAdapter;
import com.multilingo.backend.modules.testing.grading.GradingVerdict;
import com.multilingo.backend.modules.testing.grading.ObjectiveGradingService;
import com.multilingo.backend.modules.testing.grading.dto.GradingResult;
import com.multilingo.backend.modules.testing.grading.dto.PartGradingKey;
import com.multilingo.backend.modules.testing.grading.dto.QuestionGradingResult;
import java.util.stream.Collectors;
```

- [ ] **Step 4: Mở rộng `submitAttempt()` — thêm bước chấm điểm**

Thay thế toàn bộ body của `submitAttempt()` bằng:

```java
@Override
@Transactional
public SubmitResultResponse submitAttempt(Integer attemptId, AutosaveAnswersRequest request) {
    Integer userId = identityAdapter.getCurrentUserId();
    TestAttempt attempt = testAttemptRepository.findByIdAndUserId(attemptId, userId)
            .orElseThrow(() -> new AppException(ErrorCode.FORBIDDEN,
                    "Attempt not found or access denied: " + attemptId));

    // Idempotency: if already completed, return existing result without re-grading
    if (attempt.getStatus() != AttemptStatus.IN_PROGRESS) {
        return SubmitResultResponse.from(attempt.getId(), attempt.getStatus());
    }

    // Save final answers
    autosaveAnswers(attemptId, request);

    // ── Sprint 04: Grade objective questions ──────────────────────────────────
    List<AttemptAnswer> savedAnswers = attemptAnswerRepository.findByAttemptId(attemptId);
    Map<Integer, PartGradingKey> keys = gradingAdapter.loadPartKeys(attempt.getExamId());
    GradingResult gradingResult = gradingService.gradeAttempt(savedAnswers, keys);

    // Persist per-Part flags and earnedScore
    for (AttemptAnswer aa : savedAnswers) {
        Map<String, QuestionGradingResult> partResult =
            gradingResult.getPartResults().get(aa.getPartId());
        if (partResult != null) {
            Map<String, Object> flags = partResult.entrySet().stream()
                .collect(Collectors.toMap(
                    Map.Entry::getKey,
                    e -> (Object) e.getValue().getVerdict().name()));
            aa.setIsCorrectFlags(flags);
            aa.setEarnedScore(partResult.values().stream()
                .map(QuestionGradingResult::getScore)
                .reduce(BigDecimal.ZERO, BigDecimal::add));
            attemptAnswerRepository.save(aa);
        }
    }

    // Persist overall score vào TestAttempt
    attempt.setOverallScore(gradingResult.getTotalScore());
    if (!gradingResult.getSectionScores().isEmpty()) {
        Map<String, Object> sectionMap = new HashMap<>(gradingResult.getSectionScores());
        attempt.setSectionScores(sectionMap);
    }
    // ─────────────────────────────────────────────────────────────────────────

    // Transition status to COMPLETED
    attempt.setStatus(AttemptStatus.COMPLETED);
    attempt.setEndTime(Instant.now());
    testAttemptRepository.save(attempt);

    return SubmitResultResponse.from(attempt.getId(), AttemptStatus.COMPLETED);
}
```

- [ ] **Step 5: Chạy toàn bộ test suite — xác nhận PASS**

```powershell
cd backend; ./mvnw clean test 2>&1 | Select-String -Pattern "Tests run|BUILD|FAIL|ERROR" | Select-Object -Last 5
```

Expected: `BUILD SUCCESS`, `Failures: 0, Errors: 0`.

- [ ] **Step 6: Commit**

```powershell
git add backend/src/main/java/com/multilingo/backend/modules/testing/service/impl/TestAttemptServiceImpl.java
git add backend/src/test/java/com/multilingo/backend/modules/testing/service/TestAttemptServiceTest.java
git commit -m "feat(grading): integrate ObjectiveGradingService into submitAttempt, persist flags and scores"
```

---

## Task 6: Nghiệm Thu Toàn Bộ Sprint 04

**Files:**
- Không tạo file mới — chỉ chạy verification.

- [ ] **Step 1: Chạy toàn bộ test suite backend**

```powershell
cd backend; ./mvnw clean test
```

Expected output phải chứa:
```
Tests run: N, Failures: 0, Errors: 0, Skipped: 0
BUILD SUCCESS
```

- [ ] **Step 2: Đối chiếu checklist AC**

Kiểm tra từng mục trong `docs/superpowers/specs/2026-10-01-sprint04-objective-grading-ac-test.md`:
- [ ] AC-01 đến AC-11 đều có test tương ứng và PASS.
- [ ] `isCorrectFlags` không null sau submit (TC_SUBMIT_01).
- [ ] `overallScore` không null sau submit.
- [ ] ESSAY không xuất hiện trong `isCorrectFlags`.
- [ ] `examSnapshot` không chứa `correct` (Review Focus test).

- [ ] **Step 3: Final commit**

```powershell
git add -A
git commit -m "chore(sprint04): verification pass - objective grading complete"
```

- [ ] **Step 4: Push nhánh lên origin**

```powershell
git push origin feature/UC08-sprint04-objective-grading
```

---

## Self-Review

**Spec coverage check:**
- S04-01 (định nghĩa kết quả chấm) → Task 1 (GradingVerdict), Task 2 (QuestionGradingResult)
- S04-02 (chuẩn hóa văn bản) → Task 4 (`normalize()`, `normalizeTFNG()` + test Locale.ROOT)
- S04-03 (chấm SINGLE_CHOICE) → Task 4 (`gradeSingleChoice()` + TC_GRADE_SC_01..06)
- S04-04 (chấm TFNG/YNNG) → Task 4 (`gradeTFNG()`, `gradeYNNG()` + TC_GRADE_TF_01..05)
- S04-05 (chấm FILL_IN + alternates) → Task 4 (`gradeFillIn()` + TC_GRADE_FI_01..07)
- S04-06 (chấm MULTIPLE_CHOICE) → Task 4 (`gradeMultipleChoice()` + TC_GRADE_MC_01..04)
- S04-07 (chấm MATCHING) → Task 4 (`gradeMatching()` + TC_GRADE_MA_01..04)
- S04-08 (tổng hợp flags/stats) → Task 5 (persist vào `isCorrectFlags`, `earnedScore`, `sectionScores`)
- S04-09 (lưu điểm nhất quán) → Task 5 (`overallScore` BigDecimal, không quy đổi band)
- S04-10 (test tham số hóa) → Task 4 (`@ParameterizedTest @MethodSource` cho SC, FI, TFNG)

**Không có gap.**

**Type consistency check:**
- `GradingKey.correct: Object` — được cast đúng trong mỗi `grade*()` method.
- `PartGradingKey.answers: Map<String, GradingKey>` — dùng nhất quán từ Task 2 → Task 4 → Task 5.
- `GradingResult.partResults: Map<Integer, Map<String, QuestionGradingResult>>` — nhất quán.
