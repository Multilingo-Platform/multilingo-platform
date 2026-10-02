# Fix CBT Exam Workspace & Attempt Scope Issues Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the 3 critical CBT exam engine defects: (1) Instant auto-submit redirect on MOCK_TEST, (2) Raw JSON fallback / missing questions and passage in PRACTICE mode, and (3) Ineffective scope filtering for SINGLE_SKILL and SINGLE_PART.

**Architecture:** 
- In Backend (`TestAttemptServiceImpl`), dynamically filter `ExamFixture` sections and parts into `exam_snapshot` based on `CreateAttemptRequest.testScope` and target IDs. Add `contentHtml` support to `PartFixture` and provide rich reading passages in `exam-fixture.json`.
- In Frontend (`useExamTimer`), eliminate the race condition where `isExpired` becomes prematurely `true` before `timeLeftMs` updates on receiving a non-null `deadline`.
- In Frontend (`WorkspacePage`), normalize question extraction to support both `part.questions` and `part.content.question_groups`, and read `part.contentHtml` for the reading passage left pane.

**Tech Stack:** Java 17, Spring Boot 3.3.4, Hibernate JPA, JUnit 5, AssertJ, React 19, TypeScript, Redux Toolkit, Vitest, Testing Library.

**Spec / Issue Reference:** User defect report from 2026-10-02 regarding Mock Test auto-submit, Practice mode raw JSON fallback, and Single Skill / Single Part scope persistence.

## Global Constraints
- Every entity and controller follows base rules: `ApiResponse<T>`, `AppException(ErrorCode.XYZ)`.
- No breaking changes to existing passing test suites (13 Vitest files / 75 frontend tests, all Spring Boot backend tests).
- All changes must pass `mvn clean test` and `npm test` + `npm run build`.

## Review Focus
1. `useExamTimer` transition from `null` to a valid future timestamp: Must NEVER evaluate `isExpired=true` during the render phase.
2. `WorkspacePage` question rendering: `partQuestions` must resolve directly from `part.questions` array, preventing fallback `<pre>` block.
3. `WorkspacePage` reading passage: `passageHtml` must render valid HTML from `part.contentHtml` with AI dictionary selection enabled.
4. `SINGLE_SKILL` attempt creation: `exam_snapshot` must strictly contain 1 section (e.g. Reading) and its duration.
5. `SINGLE_PART` attempt creation: `exam_snapshot` must strictly contain 1 section with 1 part (e.g. Part 2) and its duration.

---

### Task 1: Backend - Add `contentHtml` to `PartFixture` and enrich `exam-fixture.json`

**Files:**
- Modify: `backend/src/main/java/com/multilingo/backend/modules/testing/adapter/dto/PartFixture.java`
- Modify: `backend/src/main/resources/fixtures/exam-fixture.json`
- Test: `backend/src/test/java/com/multilingo/backend/modules/testing/adapter/FixtureExamAdapterTest.java`

**Interfaces:**
- `PartFixture`: adds `private String contentHtml;` and `private String instruction;`
- `exam-fixture.json`: supplies `contentHtml` with HTML passages for Reading Parts 1, 2, and 3.

- [ ] **Step 1: Write the failing test in `FixtureExamAdapterTest.java`**
Add assertion that Reading Part 1 contains non-null `contentHtml`:
```java
@Test
void findById_returns_parts_with_contentHtml() {
    ExamFixture exam = adapter.findById(1).orElseThrow();
    PartFixture part1 = exam.getSections().get(0).getParts().get(0);
    assertThat(part1.getContentHtml()).isNotNull();
    assertThat(part1.getContentHtml()).contains("reading-passage");
}
```

- [ ] **Step 2: Run test to verify it fails**
Run: `powershell -Command "cd backend; .\mvnw.cmd test -Dtest=FixtureExamAdapterTest"`
Expected: FAIL (cannot find symbol `getContentHtml`)

- [ ] **Step 3: Update `PartFixture.java` and `exam-fixture.json`**
Add fields to `PartFixture.java`:
```java
private String contentHtml;
private String instruction;
```
Add `contentHtml` and `instruction` to Reading Parts in `backend/src/main/resources/fixtures/exam-fixture.json` using the passage text from `IeltsReading.txt`.

- [ ] **Step 4: Run test to verify it passes**
Run: `powershell -Command "cd backend; .\mvnw.cmd test -Dtest=FixtureExamAdapterTest"`
Expected: BUILD SUCCESS

- [ ] **Step 5: Commit**
```bash
git add backend/src/main/java/com/multilingo/backend/modules/testing/adapter/dto/PartFixture.java \
        backend/src/main/resources/fixtures/exam-fixture.json \
        backend/src/test/java/com/multilingo/backend/modules/testing/adapter/FixtureExamAdapterTest.java
git commit -m "feat(testing): add contentHtml and reading passages to exam fixture"
```

---

### Task 2: Backend - Implement Scope Filtering for Exam Snapshot in `TestAttemptServiceImpl`

**Files:**
- Modify: `backend/src/main/java/com/multilingo/backend/modules/testing/service/impl/TestAttemptServiceImpl.java:66,240-249`
- Test: `backend/src/test/java/com/multilingo/backend/modules/testing/service/TestAttemptServiceTest.java`

**Interfaces:**
- Consumes: `CreateAttemptRequest.getTestScope()`, `getTargetSectionId()`, `getTargetPartId()`
- Produces: `buildExamSnapshot(ExamFixture exam, CreateAttemptRequest request)` returning filtered Map containing only target section / part.

- [ ] **Step 1: Write failing tests in `TestAttemptServiceTest.java`**
Add unit tests for `SINGLE_SKILL` and `SINGLE_PART` snapshot filtering:
```java
@Test
void createAttempt_single_skill_filters_exam_snapshot_to_single_section() {
    CreateAttemptRequest req = new CreateAttemptRequest();
    req.setExamId(1);
    req.setTestScope(TestScope.SINGLE_SKILL);
    req.setTestMode(TestMode.PRACTICE);
    req.setTargetSectionId(1); // Reading

    WorkspaceResponse response = service.createAttempt(req);

    assertThat(response.getExamSnapshot()).isNotNull();
    @SuppressWarnings("unchecked")
    List<Map<String, Object>> sections = (List<Map<String, Object>>) response.getExamSnapshot().get("sections");
    assertThat(sections).hasSize(1);
    assertThat(sections.get(0).get("id")).isEqualTo(1);
    assertThat(response.getExamSnapshot().get("durationMinutes")).isEqualTo(60);
}

@Test
void createAttempt_single_part_filters_exam_snapshot_to_single_part() {
    CreateAttemptRequest req = new CreateAttemptRequest();
    req.setExamId(1);
    req.setTestScope(TestScope.SINGLE_PART);
    req.setTestMode(TestMode.PRACTICE);
    req.setTargetPartId(2); // Reading Part 2

    WorkspaceResponse response = service.createAttempt(req);

    assertThat(response.getExamSnapshot()).isNotNull();
    @SuppressWarnings("unchecked")
    List<Map<String, Object>> sections = (List<Map<String, Object>>) response.getExamSnapshot().get("sections");
    assertThat(sections).hasSize(1);
    @SuppressWarnings("unchecked")
    List<Map<String, Object>> parts = (List<Map<String, Object>>) sections.get(0).get("parts");
    assertThat(parts).hasSize(1);
    assertThat(parts.get(0).get("id")).isEqualTo(2);
    assertThat(response.getExamSnapshot().get("durationMinutes")).isEqualTo(20);
}
```

- [ ] **Step 2: Run test to verify it fails**
Run: `powershell -Command "cd backend; .\mvnw.cmd test -Dtest=TestAttemptServiceTest#createAttempt_single_skill_filters_exam_snapshot_to_single_section"`
Expected: FAIL (sections has size 3 instead of 1)

- [ ] **Step 3: Implement snapshot filtering in `TestAttemptServiceImpl.java`**
Update `buildExamSnapshot(ExamFixture exam, CreateAttemptRequest request)`:
```java
    @SuppressWarnings("unchecked")
    private Map<String, Object> buildExamSnapshot(ExamFixture exam, CreateAttemptRequest request) {
        if (request.getTestScope() == TestScope.FULL_EXAM) {
            return objectMapper.convertValue(exam, Map.class);
        }

        // Deep copy / clone via Jackson
        ExamFixture cloned = objectMapper.convertValue(
                objectMapper.convertValue(exam, Map.class), ExamFixture.class);

        if (request.getTestScope() == TestScope.SINGLE_SKILL) {
            SectionFixture targetSection = cloned.getSections().stream()
                    .filter(s -> request.getTargetSectionId().equals(s.getId()))
                    .findFirst()
                    .orElseThrow(() -> new AppException(ErrorCode.RESOURCE_NOT_FOUND,
                            "Section not found: " + request.getTargetSectionId()));

            cloned.setSections(List.of(targetSection));
            cloned.setDurationMinutes(targetSection.getDurationMinutes());
            return objectMapper.convertValue(cloned, Map.class);
        }

        if (request.getTestScope() == TestScope.SINGLE_PART) {
            for (SectionFixture section : cloned.getSections()) {
                for (PartFixture part : section.getParts()) {
                    if (request.getTargetPartId().equals(part.getId())) {
                        section.setParts(List.of(part));
                        section.setDurationMinutes(part.getDurationMinutes());
                        cloned.setSections(List.of(section));
                        cloned.setDurationMinutes(part.getDurationMinutes());
                        return objectMapper.convertValue(cloned, Map.class);
                    }
                }
            }
            throw new AppException(ErrorCode.RESOURCE_NOT_FOUND,
                    "Part not found: " + request.getTargetPartId());
        }

        return objectMapper.convertValue(exam, Map.class);
    }
```
Update call at line 66:
```java
Map<String, Object> snapshot = buildExamSnapshot(exam, request);
```

- [ ] **Step 4: Run test to verify it passes**
Run: `powershell -Command "cd backend; .\mvnw.cmd test -Dtest=TestAttemptServiceTest"`
Expected: ALL PASS

- [ ] **Step 5: Commit**
```bash
git add backend/src/main/java/com/multilingo/backend/modules/testing/service/impl/TestAttemptServiceImpl.java \
        backend/src/test/java/com/multilingo/backend/modules/testing/service/TestAttemptServiceTest.java
git commit -m "fix(testing): filter exam snapshot sections and parts according to test scope"
```

---

### Task 3: Frontend - Fix `useExamTimer` Race Condition & Premature Auto-Submit

**Files:**
- Modify: `frontend/src/features/exam/hooks/useExamTimer.ts:28-63`
- Modify: `frontend/src/features/exam/pages/WorkspacePage.tsx:115-121`
- Test: `frontend/src/features/exam/__tests__/useExamTimer.test.ts`

**Interfaces:**
- `useExamTimer(deadline: string | null, serverTimeOffset?: number)`: Synchronously synchronizes state on prop changes so that `isExpired` never defaults to `true` on the initial deadline update.

- [ ] **Step 1: Write failing test in `useExamTimer.test.ts`**
Add test for transition from `null` to future deadline:
```ts
it('does not prematurely set isExpired=true when transitioning from null to a future deadline', () => {
  const { result, rerender } = renderHook(({ dl }) => useExamTimer(dl), {
    initialProps: { dl: null as string | null },
  });
  expect(result.current.isPractice).toBe(true);
  expect(result.current.isExpired).toBe(false);

  const futureDeadline = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  rerender({ dl: futureDeadline });

  expect(result.current.isPractice).toBe(false);
  expect(result.current.isExpired).toBe(false);
  expect(result.current.timeLeftMs).toBeGreaterThan(0);
});
```

- [ ] **Step 2: Run test to verify failure**
Run: `powershell -Command "cd frontend; npx vitest run useExamTimer"`
Expected: FAIL (on rerender, `isExpired` is true and `timeLeftMs` is 0)

- [ ] **Step 3: Fix `useExamTimer.ts` and `WorkspacePage.tsx`**
In `useExamTimer.ts`:
```ts
export function useExamTimer(
  deadline: string | null,
  serverTimeOffset: number = 0
): ExamTimerResult {
  const isPractice = deadline === null;

  const computeTimeLeft = (dl: string | null): number => {
    if (dl === null || !dl) return 0;
    const serverAdjustedNow = Date.now() + serverTimeOffset;
    return Math.max(0, Date.parse(dl) - serverAdjustedNow);
  };

  const [timeLeftMs, setTimeLeftMs] = useState<number>(() => computeTimeLeft(deadline));
  const [prevDeadline, setPrevDeadline] = useState<string | null>(deadline);

  // Synchronize state immediately during render if deadline prop changes
  if (deadline !== prevDeadline) {
    setPrevDeadline(deadline);
    setTimeLeftMs(computeTimeLeft(deadline));
  }

  useEffect(() => {
    if (isPractice) return;

    setTimeLeftMs(computeTimeLeft(deadline));

    const id = setInterval(() => {
      setTimeLeftMs(computeTimeLeft(deadline));
    }, 500);

    return () => clearInterval(id);
  }, [deadline, isPractice, serverTimeOffset]);

  const hasExpired = !isPractice && deadline !== null && timeLeftMs === 0;

  return {
    timeLeftMs,
    isExpired: hasExpired,
    displayTime: isPractice ? '' : formatTime(timeLeftMs),
    isPractice,
  };
}
```

In `WorkspacePage.tsx`:
Add safety check in auto-submit `useEffect`:
```tsx
  // Auto-submit when time expires
  useEffect(() => {
    if (
      isExpired &&
      !showOverlay &&
      !isSubmitting &&
      workspace &&
      workspace.status === 'IN_PROGRESS' &&
      workspace.deadline !== null
    ) {
      setShowOverlay(true);
      handleSubmit();
    }
  }, [isExpired, showOverlay, isSubmitting, workspace]);
```

- [ ] **Step 4: Run timer tests to verify they pass**
Run: `powershell -Command "cd frontend; npx vitest run useExamTimer"`
Expected: ALL PASS (including the new transition test)

- [ ] **Step 5: Commit**
```bash
git add frontend/src/features/exam/hooks/useExamTimer.ts \
        frontend/src/features/exam/pages/WorkspacePage.tsx \
        frontend/src/features/exam/__tests__/useExamTimer.test.ts
git commit -m "fix(exam): eliminate race condition in useExamTimer causing immediate auto-submit"
```

---

### Task 4: Frontend - Question and Passage Normalization in `WorkspacePage`

**Files:**
- Modify: `frontend/src/features/exam/pages/WorkspacePage.tsx:50-85,183-185,258-278`
- Test: `frontend/src/features/exam/__tests__/WorkspacePage.test.tsx`

**Interfaces:**
- Consumes: `part.questions` (from backend fixture) or `part.content.question_groups[].questions`
- Consumes: `part.contentHtml` or `part.content?.content_html`

- [ ] **Step 1: Write test in `WorkspacePage.test.tsx` verifying questions render from `part.questions`**
Add test case where workspace has `part.questions` directly without `content.question_groups`:
```tsx
it('renders questions directly from part.questions array', async () => {
  // mock workspace with part.questions: [{ question_id: 'q_direct_1', question_number: 1, type: 'SINGLE_CHOICE', question_text: 'Direct question' }]
  // verify question text is displayed and raw JSON pre is NOT rendered
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `powershell -Command "cd frontend; npx vitest run WorkspacePage"`
Expected: FAIL

- [ ] **Step 3: Implement data normalization in `WorkspacePage.tsx`**
Update `currentPartQuestions`, `partQuestions`, `allQuestions`, and `passageHtml`:
```tsx
  // Active part questions extraction: supports both part.questions & part.content.question_groups
  const currentPartQuestions = useMemo(() => {
    if (!currentPart) return [];
    if (Array.isArray((currentPart as any).questions) && (currentPart as any).questions.length > 0) {
      return (currentPart as any).questions;
    }
    return currentPart?.content?.question_groups?.flatMap((g: any) => g.questions ?? []) ?? [];
  }, [currentPart]);

  const partQuestions: Question[] = useMemo(() => {
    return currentPartQuestions.map((q: any) => ({
      ...q,
      question_id: q.question_id || String(q.id),
      question_number: q.question_number ?? q.id,
      type: q.type === 'MCQ' ? 'SINGLE_CHOICE' : q.type === 'FILL_IN' ? 'FILL_IN_THE_BLANK' : q.type,
      question_text: q.question_text || q.prompt || '',
      options: q.options ?? null,
    }));
  }, [currentPartQuestions]);

  // Compute all questions across all parts
  const allQuestions = useMemo(() => {
    return allParts.flatMap((p: any) => {
      if (Array.isArray(p.questions) && p.questions.length > 0) {
        return p.questions;
      }
      return p.content?.question_groups?.flatMap((g: any) => g.questions ?? []) ?? [];
    });
  }, [allParts]);

  const passageHtml = (currentPart as any)?.contentHtml || currentPart?.content?.content_html;
```

- [ ] **Step 4: Run frontend tests to verify all 13 test files pass**
Run: `powershell -Command "cd frontend; npm test"`
Expected: 13/13 passed

- [ ] **Step 5: Commit**
```bash
git add frontend/src/features/exam/pages/WorkspacePage.tsx \
        frontend/src/features/exam/__tests__/WorkspacePage.test.tsx
git commit -m "fix(exam): normalize question and passage extraction from backend exam snapshot"
```

---

### Task 5: End-to-End Verification & Service Validation

**Files:**
- Verification only

- [ ] **Step 1: Run full backend build and test suite**
Run: `powershell -Command "cd backend; .\mvnw.cmd test"`
Expected: BUILD SUCCESS (0 failures, 0 errors)

- [ ] **Step 2: Run full frontend build and test suite**
Run: `powershell -Command "cd frontend; npm run build; npm test"`
Expected: BUILD SUCCESS, 13 test files passed

- [ ] **Step 3: Restart backend and frontend background daemons to load changes**
Restart backend and frontend dev servers.

- [ ] **Step 4: Manual API / UI Verification**
Verify with node fetch:
1. `POST /api/v1/attempts` with `testScope=SINGLE_SKILL`, `targetSectionId=1` -> verify response only has 1 section.
2. `POST /api/v1/attempts` with `testScope=SINGLE_PART`, `targetPartId=2` -> verify response only has 1 part.
3. Open `http://localhost:5173/attempts/{id}` for MOCK_TEST -> verify countdown starts, no auto-redirect occurs.
4. Open `http://localhost:5173/attempts/{id}` for PRACTICE -> verify Reading passage appears on left, questions appear on right, QuestionPalette shows question count, and no `<pre>` JSON exists.
