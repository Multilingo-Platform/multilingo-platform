# TV3-05 — Dynamic Picker/Start Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: dùng test-driven-development; thực hiện từng subtask theo Red → Green → Refactor. Không commit/push nếu chưa được người dùng duyệt.

**Goal:** Thay metadata và ID section/part hardcode trên trang bắt đầu bằng dữ liệu thật từ TV3-04, đồng thời bảo đảm SINGLE_PART + MOCK_TEST dùng thời lượng section chứa part.

**Architecture:** ExamStartPage tải cấu trúc đề published từ GET /api/v1/exams/{id}/structure, hiển thị metadata thật và truyền sections vào ScopeModePicker. Picker chỉ dùng ID thật từ response. Backend sửa tối thiểu phép tính duration cho single-part, không đổi endpoint hoặc database.

**Tech Stack:** React 19, TypeScript 6, React Router 7, Axios, Vitest, Testing Library, Java 21, Spring Boot 3.3.4, JUnit 5, Mockito.

**Specs:**

- docs/superpowers/specs/2026-10-08-tv3-00-contract-audit.md
- docs/ndt/contracts/state-machine.md
- docs/superpowers/plans/ndt/TV3-04-plan.md

## 1. Verified repository findings

- Branch: feature/TV3-00-contract-audit; HEAD 2a74644 (TV3-04 implemented).
- Worktree currently has only TV3-03-review.patch untracked; preserve it.
- ExamStartPage hardcodes IELTS/Cambridge metadata and ScopeModePicker hardcodes section IDs 1/2/3 and part IDs 1/2/3.
- No ExamStartPage test exists.
- TV3-04 provides authenticated published-only GET /api/v1/exams/{id}/structure with camelCase fields: exam id/code/title/type/durationMinutes, sections id/skillType/title/durationMinutes/orderIndex, parts id/partNumber/title.
- SINGLE_PART + MOCK_TEST currently reads PartFixture.durationMinutes, but DbExamAdapter does not assign it. The state-machine contract requires the duration of the containing section. This plan includes the minimal backend fix.
- Baseline: frontend focused picker/API tests 10 pass; frontend build passes with an existing >500 kB chunk warning; lint exits 0 with existing warnings. Backend focused unit tests 7 pass. TestAttemptServiceTest has 14 baseline errors (Exam not found: 1) because DbExamAdapter @Primary overrides the test fixture; do not use that class as the green criterion.

## 2. Scope, contracts and data flow

1. Parse a positive integer examId from /exams/:examId/start or /student/exam/:examId.
2. Call getExamStructure(examId) while showing an accessible loading state.
3. Render server metadata and pass structure.sections to ScopeModePicker.
4. Picker submits the actual section/part IDs to the existing createAttempt API.
5. Navigate to /attempts/{attemptId} only after successful creation.
6. For single-part mock attempts, backend resolves duration from the section containing the part.

Add to frontend/src/features/exam/types/api.types.ts:

~~~ts
export interface LearnerExamStructurePart {
  id: number;
  partNumber: number;
  title: string | null;
}

export interface LearnerExamStructureSection {
  id: number;
  skillType: string;
  title: string;
  durationMinutes: number | null;
  orderIndex: number;
  parts: LearnerExamStructurePart[];
}

export interface LearnerExamStructure {
  id: number;
  code: string;
  title: string;
  type: string;
  durationMinutes: number | null;
  sections: LearnerExamStructureSection[];
}
~~~

Add getExamStructure(examId: number): Promise<LearnerExamStructure> in a new examApi.ts. It must call /v1/exams/{examId}/structure, return res.data, and throw the envelope/error message when the request fails.

ScopeModePicker must receive:

~~~ts
interface ScopeModePickerProps {
  examId: number;
  sections: LearnerExamStructureSection[];
  initialMode?: TestMode | '';
  initialScope?: TestScope | '';
  onSubmit: (req: CreateAttemptRequest) => void;
  isLoading: boolean;
  error: string | null;
}
~~~

Payload mapping:

| Scope | section_id | part_id |
|---|---:|---:|
| FULL_EXAM | null | null |
| SINGLE_SKILL | selected real section ID | null |
| SINGLE_PART | containing section ID | selected real part ID |

Invalid route/query values must never be submitted. Empty structure must show an accessible empty state and must not render a startable picker. A failed fetch gets a retry action; a failed create attempt keeps the current selection.

## 3. Exact file change matrix

Create:

- frontend/src/features/exam/api/examApi.ts
- frontend/src/features/exam/__tests__/examApi.test.ts
- frontend/src/features/exam/pages/__tests__/ExamStartPage.test.tsx
- backend/src/test/java/com/multilingo/backend/modules/testing/service/TestAttemptSinglePartDurationTest.java
- docs/superpowers/plans/ndt/TV3-05-plan.md
- docs/superpowers/plans/ndt/TV3-05-handoff.md

Modify:

- frontend/src/features/exam/types/api.types.ts
- frontend/src/features/exam/components/ScopeModePicker.tsx
- frontend/src/features/exam/__tests__/ScopeModePicker.test.tsx
- frontend/src/features/exam/pages/ExamStartPage.tsx
- backend/src/main/java/com/multilingo/backend/modules/testing/service/impl/TestAttemptServiceImpl.java

Do not modify TV3-04 files, ExamLibrary.tsx, router/auth, entity/repository/migration, pom.xml, dependencies, workspace/result/review/Gemini, or TV3-03-review.patch.

## 4. Implementation subtasks

### TV3-05-01 — Frontend API contract

**Files:** create examApi.ts and examApi.test.ts; modify api.types.ts.

**Steps:**

- [ ] Write tests for the exact /v1/exams/42/structure path, camelCase response, success=false/data=null, and Axios 404/403 message extraction.
- [ ] Run npm test -- --run src/features/exam/__tests__/examApi.test.ts; confirm the new tests fail before implementation.
- [ ] Add the three typed interfaces and getExamStructure implementation; do not use an admin endpoint or mock fallback.
- [ ] Re-run the focused test.

**Acceptance:** The client returns the typed published structure and exposes a useful error message without adding a dependency or global cache.

### TV3-05-02 — Dynamic ScopeModePicker

**Files:** modify ScopeModePicker.tsx and ScopeModePicker.test.tsx.

**Steps:**

- [ ] Replace test constants with sections {id:70, parts:[701,709]} and {id:95, parts:[951]}, plus an empty section and a null-title part.
- [ ] Add tests for full exam, single skill, single part, section change clearing part, empty section, and part-title fallback.
- [ ] Run the picker test and observe failure caused by the existing hardcoded options.
- [ ] Remove section/part constants; render section title with skillType fallback and parts in server order.
- [ ] Reset section/part on scope changes and part on section changes.
- [ ] Add aria-pressed to scope/mode/section/part buttons and aria-busy to the form.
- [ ] Re-run the picker tests.

**Acceptance:** No section/part ID is invented in the component; every submitted ID came from props; unavailable parts keep submit disabled.

### TV3-05-03 — Dynamic ExamStartPage

**Files:** create pages/__tests__/ExamStartPage.test.tsx; modify ExamStartPage.tsx.

**Steps:**

- [ ] Mock getExamStructure and createAttempt; use MemoryRouter with both start routes.
- [ ] Test loading status, successful server metadata, invalid IDs (abc, 1abc, 0, -1, 1.5), fetch error/retry, empty sections, invalid query params, successful navigation, and create-error retention.
- [ ] Run the page tests before implementation.
- [ ] Validate the full ID string as a positive integer; do not rely on parseInt alone.
- [ ] Add separate structure-loading/error and attempt-starting/error state.
- [ ] Fetch only for a valid ID; ignore stale responses after unmount or route change.
- [ ] Render role=status while loading, role=alert for errors, and a retry button.
- [ ] Render code/title/type/duration and section/part counts from the response. Use generic copy where the API has no description; remove Cambridge/IELTS and fake candidate/question values.
- [ ] Do not mount the picker until the structure is valid and non-empty; pass sections through.
- [ ] Validate mode/scope query parameters against the two existing enums.
- [ ] Preserve selections on createAttempt failure and navigate only on success.
- [ ] Re-run page tests and the combined frontend focus command.

**Acceptance:** Both start routes use real server metadata and IDs; loading/error/empty states are recoverable and accessible; no mock data or sensitive contentData is rendered.

### TV3-05-04 — Backend compatibility for Single-Part Mock Test

**Files:** create TestAttemptSinglePartDurationTest.java; modify TestAttemptServiceImpl.java.

**Steps:**

- [ ] Create an isolated Mockito unit test for TestAttemptServiceImpl, avoiding the known failing Spring TestAttemptServiceTest.
- [ ] Fixture: exam duration 120; section ID 70/duration 60; part ID 701/duration null.
- [ ] Add tests that single-part mock succeeds with a 60-minute deadline and snapshot duration 60, unknown part throws RESOURCE_NOT_FOUND, and invalid section duration throws INVALID_REQUEST without saving.
- [ ] Run the test and confirm current behavior fails because part duration is null.
- [ ] Add findSectionContainingPart(ExamFixture, Integer) with null-safe section/part traversal.
- [ ] Make resolveDuration use the containing section duration for SINGLE_PART.
- [ ] Make buildExamSnapshot preserve containing-section duration and assign it to the filtered exam snapshot; do not add a schema field.
- [ ] Run the new test and TV3-04 focused regression.

**Acceptance:** SINGLE_PART + MOCK_TEST has a valid deadline and filtered snapshot using the containing section duration; no entity, adapter, migration or endpoint changes.

### TV3-05-05 — Regression and handoff

**Commands:**

~~~powershell
cd frontend
npm test -- --run src/features/exam/__tests__/examApi.test.ts src/features/exam/__tests__/ScopeModePicker.test.tsx src/features/exam/pages/__tests__/ExamStartPage.test.tsx
npm test -- --run
npm run lint
npm run build

cd ..\backend
.\mvnw.cmd "-Dtest=TestAttemptSinglePartDurationTest,TestAttemptWorkspaceResponseTest,LearnerExamStructureServiceTest,LearnerExamStructureControllerIT" test

cd ..
git diff --check
git status --short
~~~

**Acceptance:** All TV3-05 focused tests pass; frontend full suite/lint/build pass; no unauthorized files or API/database changes; no commit/push. Record the known TestAttemptServiceTest baseline separately and do not claim full backend success.

## 5. Test matrix and acceptance criteria

| ID | Scenario | Expected result |
|---|---|---|
| TC_TV305_API_01 | Fetch published structure | Correct learner URL and typed response |
| TC_TV305_API_02 | Envelope/API error | Clear thrown message |
| TC_TV305_PICKER_01 | Full exam | Both target IDs null |
| TC_TV305_PICKER_02 | Single skill | Real section ID submitted |
| TC_TV305_PICKER_03 | Single part | Real containing section and part IDs submitted |
| TC_TV305_PICKER_04 | Change section | Old part cleared and options filtered |
| TC_TV305_PICKER_05 | Null part title | Part number fallback |
| TC_TV305_PICKER_06 | Empty section | Message shown and submit disabled |
| TC_TV305_START_01 | Loading | role=status is present; picker absent |
| TC_TV305_START_02 | Dynamic metadata | No Cambridge/IELTS hardcode |
| TC_TV305_START_03 | Invalid route ID | No API request |
| TC_TV305_START_04 | Fetch error/retry | Alert then successful reload |
| TC_TV305_START_05 | Empty exam | Cannot start |
| TC_TV305_START_06 | Create error | Form retained; no navigation |
| TC_TV305_START_07 | Invalid query enum | Invalid value never submitted |
| TC_TV305_BE_01 | Single-part mock | Deadline/snapshot use section duration |
| TC_TV305_BE_02 | Part outside exam | No attempt saved |
| TC_TV305_BE_03 | Invalid duration | INVALID_REQUEST |
| TC_TV305_A11Y_01 | Selected/loading/error states | aria-pressed, aria-busy, status and alert present |

### Gherkin acceptance criteria

~~~gherkin
Scenario: Start a published exam using real structure metadata
  Given an authenticated learner opens a valid exam start route
  When the learner structure API succeeds
  Then the page displays the API code, title, type and duration
  And the picker displays the API section and part labels
  And selecting a part submits that part's real ID

Scenario: Recover from structure loading failure
  Given the structure API returns an error
  When the learner opens the start page
  Then an accessible error and retry action are shown
  And no attempt request is sent until structure loading succeeds

Scenario: Single-part mock test uses containing section duration
  Given a part has no own duration and belongs to a section with duration 60
  When a SINGLE_PART MOCK_TEST attempt is created
  Then the deadline is calculated using 60 minutes
  And the filtered snapshot duration is 60 minutes
~~~

## 6. Security, compatibility and UI rules

- Use only the published learner structure endpoint; never call admin exam detail APIs.
- Do not render or type contentData, questions, answers, explanations or grading fields on the start page.
- Use React text interpolation; no dangerouslySetInnerHTML.
- Keep createAttempt payload mapping and existing routes backward-compatible.
- Do not infer section IDs from array indexes or part numbers.
- Backend remains authoritative for ownership, published state and target validation.
- Add accessible loading/error/selection semantics without changing the existing visual direction.
- No DB migration, dependency, entity or repository change.
- Preserve all pre-existing TV3-03 changes.

## 7. Risks, blockers and out-of-scope

Dependencies:

- TV3-04 endpoint must be available before the frontend flow can succeed.
- ExamLibrary remains a hardcoded catalog and is outside this task.

Known baseline:

- TestAttemptServiceTest errors because the test profile selects DbExamAdapter @Primary with an empty DB; do not fix that unrelated baseline in TV3-05.
- Existing frontend lint warnings and build chunk-size warning are not regressions unless they appear in changed files.

Out of scope:

- Dynamic Exam Library/catalog API.
- Router/auth refactor or global 401/403 normalization.
- Unpublished-attempt backend authorization cleanup.
- Workspace, autosave/version, result/review or Gemini work.
- TV3-04 P2 test hardening.
- Migration, dependency changes, commit and push.

## 8. Definition of Done

- Start page and picker contain no hardcoded exam/section/part metadata.
- Both start routes load the same dynamic structure flow.
- Loading, retry, empty and create-error states are tested and accessible.
- Single-part mock uses the containing section duration.
- Focused backend/frontend tests pass; frontend full suite, lint and build pass.
- Diff is limited to the matrix above and existing user changes are untouched.
- Handoff contains complete test evidence and remains append-only.

## 9. Gemini execution and Codex review checklist

Gemini must read this plan and GEMINI.md, run git status --short, implement only the five subtasks in order, and stop with BLOCKED if the actual API contract differs. No staging, commit, push, rebase or branch switch.

Codex review must independently verify the learner endpoint, absence of hardcoded IDs, invalid-route/query behavior, accessibility states, containing-section duration, focused test logs, full frontend verification and scope protection.

Recommended order: TV3-05-01 → TV3-05-02 → TV3-05-03 → TV3-05-04 → TV3-05-05.
