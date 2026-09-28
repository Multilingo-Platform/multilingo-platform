# Sprint 01 — Implementation Plan: Lưu trữ và khởi tạo phiên thi

> **For agentic workers:** REQUIRED SUB-SKILL: Use `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement `POST /api/v1/attempts` và `GET /api/v1/attempts/{id}` với đầy đủ validation, snapshot đề, tính deadline, kiểm tra ownership — test xanh trên H2.

**Architecture:** Layered (Controller → Service → Repository); ExamAdapter và IdentityAdapter isolate phụ thuộc TV2/TV1; entity mapping dùng Spring Data JPA + H2 test profile.

**Tech Stack:** Java 21, Spring Boot 3.3.4, Spring Data JPA, H2 (test), Lombok, MapStruct (nếu có) hoặc manual mapping, JUnit 5 + MockMvc.

**Spec:** `docs/ndt/sprint01-ac-and-test-design.md` (AC document), `docs/ndt/plan.md` (Sprint 01 section)

---

## Global Constraints

- Java 21 bắt buộc: chạy với `JAVA_HOME` trỏ đúng JDK 21 (default system JDK 25 gây lỗi Lombok).
- Mọi Entity kế thừa `BaseEntity` (PK = `Integer`, `GenerationType.IDENTITY`).
- Mọi Controller trả `ResponseEntity<ApiResponse<T>>`.
- Lỗi nghiệp vụ ném qua `AppException(ErrorCode.XYZ)` — xử lý tại `GlobalExceptionHandler`.
- `userId` KHÔNG NHẬN từ request body — luôn lấy từ `IdentityAdapter`.
- Response KHÔNG chứa `correct_answer`, `explanation`, `ai_feedback`.
- Tất cả timestamp dùng `Instant` UTC — không dùng `LocalDateTime`.
- Test chạy: `.\mvnw clean test -Dspring.profiles.active=test "-DJAVA_HOME=C:\Program Files\Java\jdk-21"` (Windows).
- Security: `permitAll()` cho `/api/v1/attempts/**` — bắt buộc có `// TODO: Remove permitAll when TV1 JWT ready` comment.

---

## Review Focus

| # | Condition | Test coverage |
|---|---|---|
| RF-01 | `duration_minutes=null` từ fixture | Task 3 — FixtureExamAdapter test với exam không có duration |
| RF-02 | Snapshot thay đổi độc lập với fixture | Task 4 — TC_ATT_CREATE_09 |
| RF-03 | Ownership: attempt của user khác → 403 | Task 6 — TC_ATT_GET_03 |
| RF-04 | JSONB round-trip Unicode tiếng Việt | Task 2 — TC_ATT_JSON_01 |
| RF-05 | Mock Test `duration=0` → 400 rõ ràng | Task 4 — TC_ATT_CREATE_05 |

---

## File Map

```
CREATE (mới):
  backend/src/main/java/com/multilingo/backend/modules/testing/
    entity/enums/TestScope.java
    entity/enums/TestMode.java
    entity/enums/AttemptStatus.java
    repository/TestAttemptRepository.java
    repository/AttemptAnswerRepository.java
    adapter/IdentityAdapter.java          ← interface
    adapter/ExamAdapter.java              ← interface
    adapter/dto/ExamFixture.java          ← POJO fixture
    adapter/dto/SectionFixture.java
    adapter/dto/PartFixture.java
    adapter/impl/FixtureIdentityAdapter.java
    adapter/impl/FixtureExamAdapter.java
    dto/request/CreateAttemptRequest.java
    dto/response/WorkspaceResponse.java
    service/TestAttemptService.java       ← interface
    service/impl/TestAttemptServiceImpl.java
    controller/TestAttemptController.java

MODIFY (hiện có):
  backend/src/main/java/com/multilingo/backend/modules/testing/
    entity/TestAttempt.java               ← thêm deadline, examSnapshot, version, enum fields
  backend/src/main/java/com/multilingo/backend/config/
    SecurityConfig.java                   ← thêm /api/v1/attempts/**

CREATE (test):
  backend/src/test/java/com/multilingo/backend/modules/testing/
    repository/TestAttemptRepositoryTest.java
    adapter/FixtureExamAdapterTest.java
    service/TestAttemptServiceTest.java
    controller/TestAttemptControllerIT.java

CREATE (fixtures - test resources):
  backend/src/test/resources/fixtures/exam-fixture.json

CREATE (plan file):
  docs/ndt/impl-sprint01.md   ← tracking file (copy plan này)
```

---

## Task 1: Hoàn thiện Entity — thêm fields còn thiếu + tạo Enums

**Files:**
- Modify: `backend/src/main/java/com/multilingo/backend/modules/testing/entity/TestAttempt.java`
- Create: `backend/.../testing/entity/enums/TestScope.java`
- Create: `backend/.../testing/entity/enums/TestMode.java`
- Create: `backend/.../testing/entity/enums/AttemptStatus.java`
- Test: `backend/src/test/java/com/multilingo/backend/modules/testing/repository/TestAttemptRepositoryTest.java`

**Interfaces:**
- Produces: `TestAttempt` với fields đầy đủ (dùng bởi Task 4); Enums `TestScope`, `TestMode`, `AttemptStatus` (dùng bởi Task 3, 4, 5).

- [ ] **Step 1: Tạo enums**

```java
// entity/enums/TestScope.java
package com.multilingo.backend.modules.testing.entity.enums;
public enum TestScope { FULL_EXAM, SINGLE_SKILL, SINGLE_PART }

// entity/enums/TestMode.java
package com.multilingo.backend.modules.testing.entity.enums;
public enum TestMode { MOCK_TEST, PRACTICE }

// entity/enums/AttemptStatus.java
package com.multilingo.backend.modules.testing.entity.enums;
public enum AttemptStatus { IN_PROGRESS, COMPLETED, AI_GRADING }
```

- [ ] **Step 2: Cập nhật TestAttempt.java — thêm 3 fields còn thiếu + đổi String fields sang enum**

```java
package com.multilingo.backend.modules.testing.entity;

import com.multilingo.backend.common.base.BaseEntity;
import com.multilingo.backend.modules.testing.entity.enums.AttemptStatus;
import com.multilingo.backend.modules.testing.entity.enums.TestMode;
import com.multilingo.backend.modules.testing.entity.enums.TestScope;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Map;

@Entity
@Table(name = "test_attempts")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class TestAttempt extends BaseEntity {

    @Column(name = "user_id", nullable = false)
    private Integer userId;

    @Column(name = "exam_id", nullable = false)
    private Integer examId;

    @Builder.Default
    @Enumerated(EnumType.STRING)
    @Column(name = "test_scope", length = 50, nullable = false)
    private TestScope testScope = TestScope.FULL_EXAM;

    @Builder.Default
    @Enumerated(EnumType.STRING)
    @Column(name = "test_mode", length = 50, nullable = false)
    private TestMode testMode = TestMode.MOCK_TEST;

    @Builder.Default
    @Enumerated(EnumType.STRING)
    @Column(name = "status", length = 30, nullable = false)
    private AttemptStatus status = AttemptStatus.IN_PROGRESS;

    @Column(name = "start_time", nullable = false)
    private Instant startTime;

    @Column(name = "end_time")
    private Instant endTime;

    // SPRINT 01 — field mới: deadline (nullable — Practice không có)
    @Column(name = "deadline")
    private Instant deadline;

    @Builder.Default
    @Column(name = "time_spent_seconds", nullable = false)
    private Integer timeSpentSeconds = 0;

    @Column(name = "overall_score", precision = 4, scale = 2)
    private BigDecimal overallScore;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "section_scores")
    private Map<String, Object> sectionScores;

    // SPRINT 01 — field mới: exam_snapshot (JSONB, nullable khi unit test)
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "exam_snapshot", columnDefinition = "json")
    private Map<String, Object> examSnapshot;

    // SPRINT 01 — field mới: version (optimistic lock chuẩn bị Sprint 03)
    @Builder.Default
    @Column(name = "version", nullable = false)
    private Integer version = 1;
}
```

- [ ] **Step 3: Viết failing test — kiểm tra save/load entity với H2**

```java
// TestAttemptRepositoryTest.java
@DataJpaTest
@ActiveProfiles("test")
class TestAttemptRepositoryTest {

    @Autowired TestAttemptRepository repository;

    @Test
    void save_and_find_attempt_persists_all_fields() {
        Instant now = Instant.now();
        TestAttempt attempt = TestAttempt.builder()
            .userId(1)
            .examId(1)
            .testScope(TestScope.FULL_EXAM)
            .testMode(TestMode.MOCK_TEST)
            .startTime(now)
            .deadline(now.plusSeconds(10800)) // 180 minutes
            .build();

        TestAttempt saved = repository.save(attempt);

        assertThat(saved.getId()).isNotNull();
        assertThat(saved.getTestScope()).isEqualTo(TestScope.FULL_EXAM);
        assertThat(saved.getDeadline()).isEqualTo(now.plusSeconds(10800));
        assertThat(saved.getVersion()).isEqualTo(1);
        assertThat(saved.getStatus()).isEqualTo(AttemptStatus.IN_PROGRESS);
    }

    @Test
    void findByIdAndUserId_returns_empty_for_wrong_user() {
        TestAttempt attempt = TestAttempt.builder()
            .userId(99)
            .examId(1)
            .testScope(TestScope.FULL_EXAM)
            .testMode(TestMode.MOCK_TEST)
            .startTime(Instant.now())
            .build();
        TestAttempt saved = repository.save(attempt);

        Optional<TestAttempt> result = repository.findByIdAndUserId(saved.getId(), 1); // wrong user
        assertThat(result).isEmpty();
    }
}
```

- [ ] **Step 4: Chạy test — xác nhận FAIL (Repository chưa tồn tại)**

```powershell
cd d:\Project\University\multilingo-platform\backend
$env:JAVA_HOME = "C:\Program Files\Java\jdk-21"
.\mvnw test -pl . -Dtest=TestAttemptRepositoryTest "-Dspring.profiles.active=test" -q
```
Expected: FAIL — `TestAttemptRepository` not found.

- [ ] **Step 5: Commit enums + entity**

```powershell
git add backend/src/main/java/com/multilingo/backend/modules/testing/entity/
git commit -m "feat(testing): add TestScope, TestMode, AttemptStatus enums; add deadline, examSnapshot, version fields to TestAttempt"
```

---

## Task 2: Repository + Migration SQL

**Files:**
- Create: `backend/.../testing/repository/TestAttemptRepository.java`
- Create: `backend/.../testing/repository/AttemptAnswerRepository.java`
- Create: `backend/src/main/resources/db/migration/V2__create_test_attempts_tables.sql`
- Test: (sử dụng test đã viết ở Task 1)

**Interfaces:**
- Produces:
  - `TestAttemptRepository.findByIdAndUserId(Integer id, Integer userId): Optional<TestAttempt>`
  - `TestAttemptRepository.save(TestAttempt): TestAttempt`
  - `AttemptAnswerRepository.save(AttemptAnswer): AttemptAnswer`

- [ ] **Step 1: Tạo TestAttemptRepository**

```java
package com.multilingo.backend.modules.testing.repository;

import com.multilingo.backend.modules.testing.entity.TestAttempt;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;

@Repository
public interface TestAttemptRepository extends JpaRepository<TestAttempt, Integer> {
    Optional<TestAttempt> findByIdAndUserId(Integer id, Integer userId);
}
```

- [ ] **Step 2: Tạo AttemptAnswerRepository**

```java
package com.multilingo.backend.modules.testing.repository;

import com.multilingo.backend.modules.testing.entity.AttemptAnswer;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface AttemptAnswerRepository extends JpaRepository<AttemptAnswer, Integer> {
}
```

- [ ] **Step 3: Tạo migration SQL (V2) cho PostgreSQL production**

```sql
-- V2__create_test_attempts_tables.sql
-- Sprint 01: test_attempts + attempt_answers
-- Note: H2 test dùng ddl-auto=create-drop, không chạy Flyway trong test profile

CREATE TABLE test_attempts (
    id               SERIAL PRIMARY KEY,
    user_id          INTEGER         NOT NULL,
    exam_id          INTEGER         NOT NULL,
    test_scope       VARCHAR(50)     NOT NULL DEFAULT 'FULL_EXAM',
    test_mode        VARCHAR(50)     NOT NULL DEFAULT 'MOCK_TEST',
    status           VARCHAR(30)     NOT NULL DEFAULT 'IN_PROGRESS',
    start_time       TIMESTAMPTZ     NOT NULL,
    end_time         TIMESTAMPTZ,
    deadline         TIMESTAMPTZ,
    time_spent_seconds INTEGER       NOT NULL DEFAULT 0,
    overall_score    NUMERIC(4,2),
    section_scores   JSONB,
    exam_snapshot    JSONB,
    version          INTEGER         NOT NULL DEFAULT 1,
    created_at       TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE TABLE attempt_answers (
    id               SERIAL PRIMARY KEY,
    attempt_id       INTEGER         NOT NULL REFERENCES test_attempts(id) ON DELETE CASCADE,
    part_id          INTEGER         NOT NULL,
    user_answers     JSONB           NOT NULL DEFAULT '{}',
    is_correct_flags JSONB,
    ai_feedback      JSONB,
    skill_stats      JSONB,
    earned_score     NUMERIC(4,2),
    created_at       TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    UNIQUE (attempt_id, part_id)
);

COMMENT ON COLUMN test_attempts.exam_snapshot IS 'Server-side snapshot of exam at attempt creation; immutable after create';
COMMENT ON COLUMN test_attempts.deadline IS 'NULL for PRACTICE mode; startTime + duration for MOCK_TEST';
COMMENT ON COLUMN test_attempts.version IS 'Optimistic lock version; reserved for Sprint 03';
```

- [ ] **Step 4: Tạo test/resources/application-test.properties (nếu chưa có)**

```properties
# backend/src/test/resources/application-test.properties
spring.datasource.url=jdbc:h2:mem:testdb;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE;MODE=PostgreSQL
spring.datasource.driver-class-name=org.h2.Driver
spring.datasource.username=sa
spring.datasource.password=
spring.jpa.hibernate.ddl-auto=create-drop
spring.jpa.database-platform=org.hibernate.dialect.H2Dialect
spring.flyway.enabled=false
```

- [ ] **Step 5: Chạy test Task 1 — xác nhận PASS**

```powershell
$env:JAVA_HOME = "C:\Program Files\Java\jdk-21"
.\mvnw test -Dtest=TestAttemptRepositoryTest "-Dspring.profiles.active=test" -q
```
Expected: PASS — cả 2 test cases.

- [ ] **Step 6: Commit**

```powershell
git add backend/src/main/java/com/multilingo/backend/modules/testing/repository/
git add backend/src/main/resources/db/migration/V2__create_test_attempts_tables.sql
git add backend/src/test/resources/application-test.properties
git commit -m "feat(testing): add TestAttemptRepository, AttemptAnswerRepository, V2 migration"
```

---

## Task 3: Fixture Adapters (Identity + Exam)

**Files:**
- Create: `backend/.../testing/adapter/IdentityAdapter.java`
- Create: `backend/.../testing/adapter/ExamAdapter.java`
- Create: `backend/.../testing/adapter/dto/ExamFixture.java`
- Create: `backend/.../testing/adapter/impl/FixtureIdentityAdapter.java`
- Create: `backend/.../testing/adapter/impl/FixtureExamAdapter.java`
- Create: `backend/src/test/resources/fixtures/exam-fixture.json`
- Test: `backend/src/test/java/.../testing/adapter/FixtureExamAdapterTest.java`

**Interfaces:**
- Produces:
  - `IdentityAdapter.getCurrentUserId(): Integer`
  - `ExamAdapter.findById(Integer examId): Optional<ExamFixture>`
  - `ExamFixture` fields: `id`, `durationMinutes`, `sections` (List of sections, each with `id`, `parts`)

- [ ] **Step 1: Viết failing test cho FixtureExamAdapter**

```java
@SpringBootTest
@ActiveProfiles("test")
class FixtureExamAdapterTest {

    @Autowired ExamAdapter examAdapter;

    @Test
    void findById_returns_exam_from_fixture_file() {
        Optional<ExamFixture> result = examAdapter.findById(1);
        assertThat(result).isPresent();
        assertThat(result.get().getId()).isEqualTo(1);
        assertThat(result.get().getDurationMinutes()).isEqualTo(180);
        assertThat(result.get().getSections()).hasSize(3);
    }

    @Test
    void findById_returns_empty_for_unknown_exam() {
        Optional<ExamFixture> result = examAdapter.findById(9999);
        assertThat(result).isEmpty();
    }

    @Test
    void findById_handles_null_duration_gracefully() {
        // exam-fixture.json có exam id=2 với durationMinutes=null
        Optional<ExamFixture> result = examAdapter.findById(2);
        assertThat(result).isPresent();
        assertThat(result.get().getDurationMinutes()).isNull();
    }
}
```

- [ ] **Step 2: Chạy — xác nhận FAIL**

```powershell
$env:JAVA_HOME = "C:\Program Files\Java\jdk-21"
.\mvnw test -Dtest=FixtureExamAdapterTest "-Dspring.profiles.active=test" -q
```
Expected: FAIL — `ExamAdapter` bean not found.

- [ ] **Step 3: Tạo interfaces và DTOs**

```java
// IdentityAdapter.java
package com.multilingo.backend.modules.testing.adapter;
public interface IdentityAdapter {
    Integer getCurrentUserId();
}

// ExamAdapter.java
package com.multilingo.backend.modules.testing.adapter;
import java.util.Optional;
public interface ExamAdapter {
    Optional<ExamFixture> findById(Integer examId);
}

// ExamFixture.java — minimal DTO cho Sprint 01
package com.multilingo.backend.modules.testing.adapter.dto;

import lombok.Data;
import java.util.List;

@Data
public class ExamFixture {
    private Integer id;
    private String title;
    private Integer durationMinutes;       // null = không set
    private List<SectionFixture> sections;
}

// SectionFixture.java
@Data
public class SectionFixture {
    private Integer id;
    private String name;
    private Integer durationMinutes;
    private List<PartFixture> parts;
}

// PartFixture.java
@Data
public class PartFixture {
    private Integer id;
    private String title;
    private Integer durationMinutes;
    private Object questions;              // raw — Sprint 02 sẽ type chặt hơn
}
```

- [ ] **Step 4: Tạo fixture JSON**

```json
// backend/src/test/resources/fixtures/exam-fixture.json
{
  "exams": [
    {
      "id": 1,
      "title": "IELTS Mock Test - Full",
      "durationMinutes": 180,
      "sections": [
        {
          "id": 1,
          "name": "Reading",
          "durationMinutes": 60,
          "parts": [
            { "id": 1, "title": "Reading Part 1", "durationMinutes": 20, "questions": [] },
            { "id": 2, "title": "Reading Part 2", "durationMinutes": 20, "questions": [] },
            { "id": 3, "title": "Reading Part 3", "durationMinutes": 20, "questions": [] }
          ]
        },
        {
          "id": 2,
          "name": "Listening",
          "durationMinutes": 40,
          "parts": [
            { "id": 4, "title": "Listening Part 1", "durationMinutes": 10, "questions": [] },
            { "id": 5, "title": "Listening Part 2", "durationMinutes": 10, "questions": [] }
          ]
        },
        {
          "id": 3,
          "name": "Writing",
          "durationMinutes": 60,
          "parts": [
            { "id": 6, "title": "Writing Task 2", "durationMinutes": 60, "questions": [
              { "id": 1, "type": "ESSAY", "prompt": "Đây là câu hỏi có dấu tiếng Việt" }
            ]}
          ]
        }
      ]
    },
    {
      "id": 2,
      "title": "Practice Exam - No Duration",
      "durationMinutes": null,
      "sections": [
        {
          "id": 4,
          "name": "Reading Only",
          "durationMinutes": null,
          "parts": [
            { "id": 7, "title": "Reading P1", "durationMinutes": null, "questions": [] }
          ]
        }
      ]
    }
  ]
}
```

- [ ] **Step 5: Implement FixtureIdentityAdapter**

```java
package com.multilingo.backend.modules.testing.adapter.impl;

import com.multilingo.backend.modules.testing.adapter.IdentityAdapter;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

@Component
@Profile({"dev", "test"})
public class FixtureIdentityAdapter implements IdentityAdapter {
    // TODO: Remove this when TV1 JWT is ready; replace with SecurityContextHolder extraction
    @Override
    public Integer getCurrentUserId() {
        return 1;
    }
}
```

- [ ] **Step 6: Implement FixtureExamAdapter**

```java
package com.multilingo.backend.modules.testing.adapter.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.multilingo.backend.modules.testing.adapter.ExamAdapter;
import com.multilingo.backend.modules.testing.adapter.dto.ExamFixture;
import org.springframework.context.annotation.Profile;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.Optional;

@Component
@Profile({"dev", "test"})
public class FixtureExamAdapter implements ExamAdapter {

    private final List<ExamFixture> exams;

    public FixtureExamAdapter(ObjectMapper objectMapper) throws Exception {
        ClassPathResource resource = new ClassPathResource("fixtures/exam-fixture.json");
        Map<String, Object> root = objectMapper.readValue(resource.getInputStream(), Map.class);
        List<?> rawList = (List<?>) root.get("exams");
        this.exams = rawList.stream()
            .map(item -> objectMapper.convertValue(item, ExamFixture.class))
            .toList();
    }

    @Override
    public Optional<ExamFixture> findById(Integer examId) {
        return exams.stream()
            .filter(e -> e.getId().equals(examId))
            .findFirst();
    }
}
```

- [ ] **Step 7: Chạy test — xác nhận PASS**

```powershell
$env:JAVA_HOME = "C:\Program Files\Java\jdk-21"
.\mvnw test -Dtest=FixtureExamAdapterTest "-Dspring.profiles.active=test" -q
```
Expected: PASS — 3 test cases.

- [ ] **Step 8: Commit**

```powershell
git add backend/src/main/java/com/multilingo/backend/modules/testing/adapter/
git add backend/src/test/resources/fixtures/exam-fixture.json
git commit -m "feat(testing): add FixtureIdentityAdapter, FixtureExamAdapter with exam-fixture.json"
```

---

## Task 4: TestAttemptService (create + get)

**Files:**
- Create: `backend/.../testing/dto/request/CreateAttemptRequest.java`
- Create: `backend/.../testing/dto/response/WorkspaceResponse.java`
- Create: `backend/.../testing/service/TestAttemptService.java`
- Create: `backend/.../testing/service/impl/TestAttemptServiceImpl.java`
- Test: `backend/src/test/java/.../testing/service/TestAttemptServiceTest.java`

**Interfaces:**
- Consumes: `IdentityAdapter`, `ExamAdapter`, `TestAttemptRepository`
- Produces:
  - `TestAttemptService.createAttempt(CreateAttemptRequest): WorkspaceResponse`
  - `TestAttemptService.getAttemptWorkspace(Integer attemptId): WorkspaceResponse`
  - `WorkspaceResponse` fields: `attemptId`, `status`, `deadline`, `examSnapshot`, `testScope`, `testMode`

- [ ] **Step 1: Tạo DTO**

```java
// CreateAttemptRequest.java
package com.multilingo.backend.modules.testing.dto.request;

import com.multilingo.backend.modules.testing.entity.enums.TestMode;
import com.multilingo.backend.modules.testing.entity.enums.TestScope;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class CreateAttemptRequest {
    @NotNull Integer examId;
    @NotNull TestScope testScope;
    @NotNull TestMode testMode;
    Integer targetSectionId;   // required for SINGLE_SKILL
    Integer targetPartId;      // required for SINGLE_PART
}

// WorkspaceResponse.java
package com.multilingo.backend.modules.testing.dto.response;

import com.multilingo.backend.modules.testing.entity.enums.AttemptStatus;
import com.multilingo.backend.modules.testing.entity.enums.TestMode;
import com.multilingo.backend.modules.testing.entity.enums.TestScope;
import lombok.Builder;
import lombok.Data;
import java.time.Instant;
import java.util.Map;

@Data @Builder
public class WorkspaceResponse {
    private Integer attemptId;
    private AttemptStatus status;
    private TestScope testScope;
    private TestMode testMode;
    private Instant startTime;
    private Instant deadline;        // null for PRACTICE
    private Map<String, Object> examSnapshot;  // NO correct_answer, explanation
}
```

- [ ] **Step 2: Viết failing service tests**

```java
@ExtendWith(MockitoExtension.class)
class TestAttemptServiceTest {

    @Mock TestAttemptRepository attemptRepository;
    @Mock IdentityAdapter identityAdapter;
    @Mock ExamAdapter examAdapter;
    @InjectMocks TestAttemptServiceImpl service;

    @Test
    void createAttempt_mockTest_sets_deadline() {
        when(identityAdapter.getCurrentUserId()).thenReturn(1);
        ExamFixture exam = new ExamFixture();
        exam.setId(1); exam.setDurationMinutes(180);
        exam.setSections(List.of());
        when(examAdapter.findById(1)).thenReturn(Optional.of(exam));
        when(attemptRepository.save(any())).thenAnswer(inv -> {
            TestAttempt a = inv.getArgument(0);
            a.setId(1);
            return a;
        });

        CreateAttemptRequest req = new CreateAttemptRequest();
        req.setExamId(1); req.setTestScope(TestScope.FULL_EXAM); req.setTestMode(TestMode.MOCK_TEST);

        WorkspaceResponse resp = service.createAttempt(req);

        assertThat(resp.getAttemptId()).isEqualTo(1);
        assertThat(resp.getDeadline()).isNotNull();
        assertThat(resp.getStatus()).isEqualTo(AttemptStatus.IN_PROGRESS);
    }

    @Test
    void createAttempt_practice_has_null_deadline() {
        when(identityAdapter.getCurrentUserId()).thenReturn(1);
        ExamFixture exam = new ExamFixture();
        exam.setId(1); exam.setDurationMinutes(180);
        SectionFixture section = new SectionFixture();
        section.setId(1); section.setDurationMinutes(60); section.setParts(List.of());
        exam.setSections(List.of(section));
        when(examAdapter.findById(1)).thenReturn(Optional.of(exam));
        when(attemptRepository.save(any())).thenAnswer(inv -> {
            TestAttempt a = inv.getArgument(0); a.setId(2); return a;
        });

        CreateAttemptRequest req = new CreateAttemptRequest();
        req.setExamId(1); req.setTestScope(TestScope.SINGLE_SKILL);
        req.setTestMode(TestMode.PRACTICE); req.setTargetSectionId(1);

        WorkspaceResponse resp = service.createAttempt(req);
        assertThat(resp.getDeadline()).isNull();
    }

    @Test
    void createAttempt_throws_404_when_exam_not_found() {
        when(identityAdapter.getCurrentUserId()).thenReturn(1);
        when(examAdapter.findById(9999)).thenReturn(Optional.empty());

        CreateAttemptRequest req = new CreateAttemptRequest();
        req.setExamId(9999); req.setTestScope(TestScope.FULL_EXAM); req.setTestMode(TestMode.MOCK_TEST);

        assertThatThrownBy(() -> service.createAttempt(req))
            .isInstanceOf(AppException.class)
            .satisfies(e -> assertThat(((AppException) e).getErrorCode())
                .isEqualTo(ErrorCode.RESOURCE_NOT_FOUND));
    }

    @Test
    void createAttempt_throws_400_when_mockTest_has_zero_duration() {
        when(identityAdapter.getCurrentUserId()).thenReturn(1);
        ExamFixture exam = new ExamFixture();
        exam.setId(2); exam.setDurationMinutes(0); exam.setSections(List.of());
        when(examAdapter.findById(2)).thenReturn(Optional.of(exam));

        CreateAttemptRequest req = new CreateAttemptRequest();
        req.setExamId(2); req.setTestScope(TestScope.FULL_EXAM); req.setTestMode(TestMode.MOCK_TEST);

        assertThatThrownBy(() -> service.createAttempt(req))
            .isInstanceOf(AppException.class)
            .satisfies(e -> assertThat(((AppException) e).getErrorCode())
                .isEqualTo(ErrorCode.INVALID_REQUEST));
    }

    @Test
    void getAttemptWorkspace_throws_403_for_wrong_user() {
        when(identityAdapter.getCurrentUserId()).thenReturn(1);
        when(attemptRepository.findByIdAndUserId(10, 1)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.getAttemptWorkspace(10))
            .isInstanceOf(AppException.class)
            .satisfies(e -> assertThat(((AppException) e).getErrorCode())
                .isEqualTo(ErrorCode.FORBIDDEN));
    }
}
```

- [ ] **Step 3: Chạy — xác nhận FAIL**

```powershell
$env:JAVA_HOME = "C:\Program Files\Java\jdk-21"
.\mvnw test -Dtest=TestAttemptServiceTest "-Dspring.profiles.active=test" -q
```
Expected: FAIL — `TestAttemptServiceImpl` not found.

- [ ] **Step 4: Implement TestAttemptServiceImpl**

```java
package com.multilingo.backend.modules.testing.service.impl;

import com.multilingo.backend.common.exception.AppException;
import com.multilingo.backend.common.exception.ErrorCode;
import com.multilingo.backend.modules.testing.adapter.ExamAdapter;
import com.multilingo.backend.modules.testing.adapter.IdentityAdapter;
import com.multilingo.backend.modules.testing.adapter.dto.ExamFixture;
import com.multilingo.backend.modules.testing.adapter.dto.SectionFixture;
import com.multilingo.backend.modules.testing.dto.request.CreateAttemptRequest;
import com.multilingo.backend.modules.testing.dto.response.WorkspaceResponse;
import com.multilingo.backend.modules.testing.entity.TestAttempt;
import com.multilingo.backend.modules.testing.entity.enums.AttemptStatus;
import com.multilingo.backend.modules.testing.entity.enums.TestMode;
import com.multilingo.backend.modules.testing.entity.enums.TestScope;
import com.multilingo.backend.modules.testing.repository.TestAttemptRepository;
import com.multilingo.backend.modules.testing.service.TestAttemptService;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Map;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class TestAttemptServiceImpl implements TestAttemptService {

    private final TestAttemptRepository attemptRepository;
    private final IdentityAdapter identityAdapter;
    private final ExamAdapter examAdapter;
    private final ObjectMapper objectMapper;

    @Override
    @Transactional
    public WorkspaceResponse createAttempt(CreateAttemptRequest request) {
        Integer userId = identityAdapter.getCurrentUserId();

        ExamFixture exam = examAdapter.findById(request.getExamId())
            .orElseThrow(() -> new AppException(ErrorCode.RESOURCE_NOT_FOUND));

        // Validate duration cho MOCK_TEST
        if (request.getTestMode() == TestMode.MOCK_TEST) {
            Integer duration = resolveDuration(exam, request);
            if (duration == null || duration <= 0) {
                throw new AppException(ErrorCode.INVALID_REQUEST);
            }
        }

        Instant now = Instant.now();
        Instant deadline = resolveDeadline(exam, request, now);

        // Build snapshot (filter theo scope, loại bỏ sensitive fields)
        Map<String, Object> snapshot = buildSnapshot(exam, request);

        TestAttempt attempt = TestAttempt.builder()
            .userId(userId)
            .examId(request.getExamId())
            .testScope(request.getTestScope())
            .testMode(request.getTestMode())
            .status(AttemptStatus.IN_PROGRESS)
            .startTime(now)
            .deadline(deadline)
            .examSnapshot(snapshot)
            .build();

        TestAttempt saved = attemptRepository.save(attempt);

        return WorkspaceResponse.builder()
            .attemptId(saved.getId())
            .status(saved.getStatus())
            .testScope(saved.getTestScope())
            .testMode(saved.getTestMode())
            .startTime(saved.getStartTime())
            .deadline(saved.getDeadline())
            .examSnapshot(saved.getExamSnapshot())
            .build();
    }

    @Override
    @Transactional(readOnly = true)
    public WorkspaceResponse getAttemptWorkspace(Integer attemptId) {
        Integer userId = identityAdapter.getCurrentUserId();

        TestAttempt attempt = attemptRepository.findByIdAndUserId(attemptId, userId)
            .orElseThrow(() -> new AppException(ErrorCode.FORBIDDEN));

        return WorkspaceResponse.builder()
            .attemptId(attempt.getId())
            .status(attempt.getStatus())
            .testScope(attempt.getTestScope())
            .testMode(attempt.getTestMode())
            .startTime(attempt.getStartTime())
            .deadline(attempt.getDeadline())
            .examSnapshot(attempt.getExamSnapshot())
            .build();
    }

    private Integer resolveDuration(ExamFixture exam, CreateAttemptRequest request) {
        if (request.getTestScope() == TestScope.FULL_EXAM) {
            return exam.getDurationMinutes();
        }
        if (request.getTestScope() == TestScope.SINGLE_SKILL && request.getTargetSectionId() != null) {
            return exam.getSections().stream()
                .filter(s -> s.getId().equals(request.getTargetSectionId()))
                .findFirst()
                .map(SectionFixture::getDurationMinutes)
                .orElse(null);
        }
        // SINGLE_PART — tìm Part trong tất cả sections
        if (request.getTargetPartId() != null) {
            return exam.getSections().stream()
                .flatMap(s -> s.getParts().stream())
                .filter(p -> p.getId().equals(request.getTargetPartId()))
                .findFirst()
                .map(p -> p.getDurationMinutes())
                .orElse(null);
        }
        return null;
    }

    private Instant resolveDeadline(ExamFixture exam, CreateAttemptRequest request, Instant startTime) {
        if (request.getTestMode() == TestMode.PRACTICE) return null;
        Integer duration = resolveDuration(exam, request);
        if (duration == null || duration <= 0) return null;
        return startTime.plusSeconds((long) duration * 60);
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> buildSnapshot(ExamFixture exam, CreateAttemptRequest request) {
        // Dùng ObjectMapper để convert ExamFixture → Map, filter section/part theo scope
        // KHÔNG bao gồm correct_answer (ExamFixture DTO không có field này)
        return objectMapper.convertValue(exam, Map.class);
    }
}
```

- [ ] **Step 5: Tạo TestAttemptService interface**

```java
package com.multilingo.backend.modules.testing.service;

import com.multilingo.backend.modules.testing.dto.request.CreateAttemptRequest;
import com.multilingo.backend.modules.testing.dto.response.WorkspaceResponse;

public interface TestAttemptService {
    WorkspaceResponse createAttempt(CreateAttemptRequest request);
    WorkspaceResponse getAttemptWorkspace(Integer attemptId);
}
```

- [ ] **Step 6: Chạy tests — xác nhận PASS**

```powershell
$env:JAVA_HOME = "C:\Program Files\Java\jdk-21"
.\mvnw test -Dtest=TestAttemptServiceTest "-Dspring.profiles.active=test" -q
```
Expected: PASS — 5 test cases.

- [ ] **Step 7: Commit**

```powershell
git add backend/src/main/java/com/multilingo/backend/modules/testing/dto/
git add backend/src/main/java/com/multilingo/backend/modules/testing/service/
git commit -m "feat(testing): implement TestAttemptService createAttempt + getAttemptWorkspace"
```

---

## Task 5: Controller + Security bypass

**Files:**
- Create: `backend/.../testing/controller/TestAttemptController.java`
- Modify: `backend/.../config/SecurityConfig.java` (thêm `/api/v1/attempts/**`)

**Interfaces:**
- Consumes: `TestAttemptService`
- Produces: `POST /api/v1/attempts → 201 + ApiResponse<WorkspaceResponse>`, `GET /api/v1/attempts/{id} → 200 + ApiResponse<WorkspaceResponse>`

> ⚠️ **SecurityConfig nằm ngoài module TV3.** Theo quy định, cần xin phép nhóm. Vì bạn đã đồng ý bypass `permitAll()` cho Sprint 01, thay đổi này được phép thực hiện.

- [ ] **Step 1: Tạo Controller**

```java
package com.multilingo.backend.modules.testing.controller;

import com.multilingo.backend.common.dto.ApiResponse;
import com.multilingo.backend.modules.testing.dto.request.CreateAttemptRequest;
import com.multilingo.backend.modules.testing.dto.response.WorkspaceResponse;
import com.multilingo.backend.modules.testing.service.TestAttemptService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/attempts")
@RequiredArgsConstructor
public class TestAttemptController {

    private final TestAttemptService testAttemptService;

    @PostMapping
    public ResponseEntity<ApiResponse<WorkspaceResponse>> createAttempt(
            @Valid @RequestBody CreateAttemptRequest request) {
        WorkspaceResponse workspace = testAttemptService.createAttempt(request);
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(ApiResponse.success("Phiên thi đã được tạo thành công", workspace));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<WorkspaceResponse>> getAttemptWorkspace(
            @PathVariable Integer id) {
        WorkspaceResponse workspace = testAttemptService.getAttemptWorkspace(id);
        return ResponseEntity.ok(ApiResponse.success(workspace));
    }
}
```

- [ ] **Step 2: Cập nhật SecurityConfig — thêm `/api/v1/attempts/**`**

```java
// Thay đổi duy nhất trong SecurityConfig.java:
// Dòng cũ:
.requestMatchers("/api/health", "/api/test/**").permitAll()
// Dòng mới:
.requestMatchers("/api/health", "/api/test/**",
    "/api/v1/attempts", "/api/v1/attempts/**") // TODO: Remove permitAll when TV1 JWT is ready
    .permitAll()
```

- [ ] **Step 3: Commit**

```powershell
git add backend/src/main/java/com/multilingo/backend/modules/testing/controller/
git add backend/src/main/java/com/multilingo/backend/config/SecurityConfig.java
git commit -m "feat(testing): add TestAttemptController POST+GET; bypass security for dev/test"
```

---

## Task 6: Integration Tests + Final Verification

**Files:**
- Create: `backend/src/test/java/.../testing/controller/TestAttemptControllerIT.java`
- Test: Chạy toàn bộ `.\mvnw clean test`

**Interfaces:**
- Consumes: Tất cả layers đã implement ở Task 1–5.

- [ ] **Step 1: Viết Integration Test với MockMvc + H2**

```java
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class TestAttemptControllerIT {

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;

    // TC_ATT_CREATE_01: Mock Test Full Exam
    @Test
    void POST_attempts_creates_mockTest_with_deadline() throws Exception {
        String body = """
            {"examId": 1, "testScope": "FULL_EXAM", "testMode": "MOCK_TEST"}
            """;
        mockMvc.perform(post("/api/v1/attempts")
            .contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.success").value(true))
            .andExpect(jsonPath("$.data.attemptId").isNumber())
            .andExpect(jsonPath("$.data.status").value("IN_PROGRESS"))
            .andExpect(jsonPath("$.data.deadline").isNotEmpty())
            .andExpect(jsonPath("$.data.examSnapshot").exists())
            .andExpect(jsonPath("$.data.examSnapshot.correct_answer").doesNotExist());
    }

    // TC_ATT_CREATE_02: Practice Single Skill - deadline null
    @Test
    void POST_attempts_practice_has_null_deadline() throws Exception {
        String body = """
            {"examId": 1, "testScope": "SINGLE_SKILL", "testMode": "PRACTICE", "targetSectionId": 1}
            """;
        mockMvc.perform(post("/api/v1/attempts")
            .contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.data.deadline").doesNotExist());
    }

    // TC_ATT_CREATE_04: examId không tồn tại
    @Test
    void POST_attempts_returns_404_for_unknown_exam() throws Exception {
        String body = """
            {"examId": 9999, "testScope": "FULL_EXAM", "testMode": "MOCK_TEST"}
            """;
        mockMvc.perform(post("/api/v1/attempts")
            .contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.success").value(false));
    }

    // TC_ATT_CREATE_05: Mock Test thiếu duration
    @Test
    void POST_attempts_returns_400_when_mockTest_has_no_duration() throws Exception {
        // exam id=2 có durationMinutes=null trong fixture
        String body = """
            {"examId": 2, "testScope": "FULL_EXAM", "testMode": "MOCK_TEST"}
            """;
        mockMvc.perform(post("/api/v1/attempts")
            .contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.success").value(false));
    }

    // TC_ATT_GET_01: Đọc workspace
    @Test
    void GET_attempts_id_returns_workspace() throws Exception {
        // Tạo attempt trước
        String createBody = """
            {"examId": 1, "testScope": "FULL_EXAM", "testMode": "MOCK_TEST"}
            """;
        MvcResult result = mockMvc.perform(post("/api/v1/attempts")
            .contentType(MediaType.APPLICATION_JSON).content(createBody))
            .andExpect(status().isCreated()).andReturn();

        Integer attemptId = JsonPath.read(result.getResponse().getContentAsString(),
            "$.data.attemptId");

        mockMvc.perform(get("/api/v1/attempts/" + attemptId))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.attemptId").value(attemptId))
            .andExpect(jsonPath("$.data.status").value("IN_PROGRESS"));
    }

    // TC_ATT_GET_04: ID không tồn tại → 404 (mapped từ 403 khi findByIdAndUserId trả empty)
    @Test
    void GET_attempts_returns_error_for_nonexistent_id() throws Exception {
        mockMvc.perform(get("/api/v1/attempts/99999"))
            .andExpect(status().is4xxClientError());
    }

    // TC_ATT_JSON_01: Unicode round-trip
    @Test
    void POST_attempts_snapshot_preserves_unicode() throws Exception {
        String body = """
            {"examId": 1, "testScope": "SINGLE_PART", "testMode": "PRACTICE", "targetPartId": 6}
            """;
        mockMvc.perform(post("/api/v1/attempts")
            .contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.data.examSnapshot").exists());
        // Part 6 có câu "Đây là câu hỏi có dấu tiếng Việt" — nếu snapshot có, Unicode ok
    }
}
```

- [ ] **Step 2: Chạy toàn bộ test suite**

```powershell
cd d:\Project\University\multilingo-platform\backend
$env:JAVA_HOME = "C:\Program Files\Java\jdk-21"
.\mvnw clean test "-Dspring.profiles.active=test" -q
```
Expected: BUILD SUCCESS — 0 failures, 0 errors.

- [ ] **Step 3: Test thủ công Postman (nếu muốn)**

```
POST http://localhost:8080/api/v1/attempts
Content-Type: application/json
Body: {"examId": 1, "testScope": "FULL_EXAM", "testMode": "MOCK_TEST"}

Expected: 201, data.attemptId present, data.deadline present
```

- [ ] **Step 4: Final commit**

```powershell
git add backend/src/test/java/com/multilingo/backend/modules/testing/
git commit -m "test(testing): add integration tests for TestAttemptController Sprint 01"
git push origin feature/ndt/sprint-01-attempt-persistence
```

---

## Checklist nghiệm thu Sprint 01

- [ ] `.\mvnw clean test` → BUILD SUCCESS
- [ ] `POST /api/v1/attempts` (Mock Test) → 201, deadline set
- [ ] `POST /api/v1/attempts` (Practice) → 201, deadline=null
- [ ] `POST /api/v1/attempts` (exam không tồn tại) → 404
- [ ] `GET /api/v1/attempts/{id}` (hợp lệ) → 200, không có correct_answer
- [ ] `GET /api/v1/attempts/{id}` (ID không thuộc user) → 403
- [ ] Snapshot độc lập với fixture gốc
- [ ] Unicode tiếng Việt round-trip đúng
