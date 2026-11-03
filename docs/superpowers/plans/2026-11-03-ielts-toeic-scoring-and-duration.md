# IELTS/TOEIC Scoring and Duration Implementation Plan

## Review remediation ledger — 2026-11-03

- RED: focused history/service/repository/controller regressions ran 60 tests: 9 failures and 4 errors. Confirmed missing-unit NPE, legacy total null, excluded certificate counts and coerced time tokens. Existing Practice controller assertion still expected an unlimited deadline; aligned it with approved timed Practice behavior.
- Fixes: default absent aggregate list to empty; preserve null-unit legacy raw; COUNT all completed with raw-only conditional MAX; field-local strict JSON integer deserializer.
- GREEN: focused Maven run explicitly including TestAttemptControllerIT passed 74 tests (22 controller HTTP cases), covering valid aliases/null/bounds, HTTP400 code and no inserts on rejection, legacy Practice/Mock manual/timeout/idempotent submit and result read, empty/mixed/raw history, real repository counts and library flags.
- Full verification: `mvnw.cmd clean test` passed 1,918 tests, 0 failures/errors, 1 skipped (`ETSWorkbookAuditTest`: missing optional `ets.source` property). Frontend: 141 files / 2,042 tests passed; lint exited successfully with existing warnings; build passed with chunk-size warning. `git diff --check` clean.
- Independent review and re-review: PASS for four fixes and expanded tests, no remaining in-scope findings. Automated smoke exercised HTTP creation plus service/repository resume, submission, result/history and library paths. PostgreSQL migration and manual browser/deploy smoke were not exercised; repository tests used H2. No commits, backfill or additional migration.
- Verification logs preserved in the OS temporary directory as `multilingo-four-findings-{red,green,full-backend,frontend-tests,frontend-lint,frontend-build}.log`. Full tests regenerated `backend/Exam_Template.xlsx`; restored that generated artifact to its original clean state.

> **For agentic workers:** Execute in order with test-driven development (red → green → refactor).

**Goal:** Add scoped custom duration with server-enforced deadlines and versioned IELTS/TOEIC full-exam score projections.

**Architecture:** Keep objective grading raw and add a deterministic certificate-score projection over verified attempt snapshot/results. Resolve effective time on the server, save policy metadata in the immutable snapshot, and use the existing attempt locks for asynchronous Writing score refresh.

**Tech Stack:** Spring Boot/Java/Jackson/PostgreSQL JSON, React/TypeScript/Vitest, Maven.

**Spec:** `docs/superpowers/specs/2026-11-03-ielts-toeic-scoring-and-duration.md`

## Global Constraints

- Snapshot is the source of truth for an existing attempt; never reload mutable exam content for grading.
- Preserve raw per-question scoring, review, answer-group semantics, identity/ownership, autosave versioning, and 15-second timeout grace.
- Add only the nullable `score_unit` migration needed to keep SQL aggregates from mixing raw, IELTS, TOEIC, and legacy scores; leave historical rows null.
- Existing attempts remain unchanged and are not regraded.
- Run backend full suite, frontend full suite, lint, and build as required by the approved acceptance plan.

## Review Focus

- Full-mode and scoped-mode time overrides cannot be forged in API requests.
- Practice deadlines reach the same server expiration protection as Mock deadlines.
- Raw score data and scaled scores cannot be mistaken for one another in history/trends.
- Partial/pending Writing and missing Speaking never become zero-valued IELTS skills.
- Fixed interpolation remains bounded, monotone, and rounded to a multiple of five.

---

### Task 1: Add duration and certificate projection domain tests

**Files:**
- Create: `backend/src/test/java/com/multilingo/backend/modules/testing/util/AttemptDurationPolicyTest.java`
- Create: `backend/src/test/java/com/multilingo/backend/modules/testing/grading/CertificateScoreProjectorTest.java`

- [ ] Test default/custom duration validation and all bounds.
- [ ] Test IELTS skill lookup, half-band rounding, `<4.0`, incomplete task, and missing skill.
- [ ] Test all 101 TOEIC raw counts for monotonicity/range/multiple-of-five plus every anchor.
- [ ] Run focused Maven tests and verify failure before production changes.

### Task 2: Implement deterministic certificate scoring

**Files:**
- Create: `backend/src/main/java/com/multilingo/backend/modules/testing/grading/CertificateScoreProjector.java`
- Modify: `backend/src/main/java/com/multilingo/backend/modules/testing/dto/response/ResultSummaryResponse.java`
- Test: `backend/src/test/java/com/multilingo/backend/modules/testing/grading/CertificateScoreProjectorTest.java`

- [ ] Implement pure IELTS/TOEIC conversions and unavailable reasons from the spec.
- [ ] Add a nullable backward-compatible `certificateScore` response DTO.
- [ ] Preserve raw objective summary and use exact decimals/rounding rules.
- [ ] Run focused converter/DTO tests; refactor only after green.

### Task 3: Resolve and persist attempt duration policy

**Files:**
- Modify: `backend/src/main/java/com/multilingo/backend/modules/testing/dto/request/CreateAttemptRequest.java`
- Modify: `backend/src/main/java/com/multilingo/backend/modules/testing/service/impl/TestAttemptServiceImpl.java`
- Tests: focused `TestAttemptServiceTest` and request validation tests.

- [ ] Write failing tests for scoped custom/default times, full IELTS/TOEIC fixed times, missing defaults, invalid bounds, and full override rejection.
- [ ] Add `timeLimitMinutes`/`time_limit_minutes`, resolve it server-side, and persist the effective time/version in the attempt snapshot.
- [ ] Apply fixed full duration based on canonical type and preserve configured duration for other exams.
- [ ] Keep FULL_EXAM versus SINGLE/MULTI scope distinction authoritative.
- [ ] Run service/request focused tests.

### Task 4: Enforce deadlines in both modes

**Files:**
- Modify: `backend/src/main/java/com/multilingo/backend/modules/testing/service/impl/TestAttemptServiceImpl.java`
- Modify: `backend/src/main/java/com/multilingo/backend/modules/testing/service/scheduler/AttemptExpirationScheduler.java`
- Tests: attempt lifecycle, autosave, resume, submit, and scheduler concurrency tests.

- [ ] Add regression tests showing Practice deadline autosave rejection and automatic finalization.
- [ ] Update guards that currently check only `MOCK_TEST` to honor any non-null server-issued deadline.
- [ ] Preserve grace behavior, idempotency, and no deadline reset on resume.
- [ ] Run focused lifecycle/scheduler tests.

### Task 5: Add accessible duration picker and API field

**Files:**
- Modify: `frontend/src/features/exam/components/ScopeModePicker.tsx`
- Modify: `frontend/src/features/exam/types/api.types.ts`
- Tests: `frontend/src/features/exam/__tests__/ScopeModePicker.test.tsx` and start-page tests.

- [ ] Test presets, custom 1–360 validation, default preview, scope/mode changes, full fixed-time display, and no stale override submission.
- [ ] Add labeled native select and custom numeric input with inline accessible validation.
- [ ] Show the server-compatible projected duration and update the attempt request type.
- [ ] Run focused Vitest tests.

### Task 6: Build and integrate certificate result projection

**Files:**
- Modify: `backend/src/main/java/com/multilingo/backend/modules/testing/service/support/AttemptResultSummaryMapper.java`
- Modify: `backend/src/main/java/com/multilingo/backend/modules/testing/service/impl/TestAttemptServiceImpl.java`
- Modify: `backend/src/main/java/com/multilingo/backend/modules/testing/service/support/WritingGradingTransactionCoordinator.java`
- Tests: result summary, writing lifecycle, and compatibility tests.

- [ ] Add failing tests for IELTS/TOEIC full result projection and raw scope preservation.
- [ ] Build the score from the stored attempt snapshot, verified objective summary, and eligible Writing grades.
- [ ] Persist policy/unit metadata and scaled overall score only for new full certificate attempts.
- [ ] Refresh the projection under the existing attempt lock when Writing grading finalizes; do not recalculate historical jobs/attempts lacking policy metadata.
- [ ] Run focused result and asynchronous Writing tests.

### Task 7: Render score units and make history aggregates safe

**Files:**
- Modify: `frontend/src/features/exam/api/resultContract.ts`
- Modify: `frontend/src/features/exam/components/result/ObjectiveResultSummary.tsx`
- Modify: `frontend/src/features/exam/pages/ExamResultPage.tsx`
- Modify: history/result UI and aggregate repository queries identified during implementation.
- Tests: result contract/UI and history aggregate tests.

- [ ] Accept legacy result responses without certificate score and validate new score units/statuses.
- [ ] Show raw correctness and the certificate score separately, with TOEIC estimate and unavailable reasons labeled.
- [ ] Show IELTS skill bands without Overall when Speaking is absent or a required skill/Writing score is unavailable.
- [ ] Filter history/trends so only comparable scaled policy units contribute; keep legacy display intact.
- [ ] Run focused frontend/backend history tests.

### Task 8: Full verification and review

**Files:** final diff only.

- [ ] Run `.\mvnw.cmd clean test` in `backend` and record aggregate result.
- [ ] Run `npm test`, `npm run lint`, and `npm run build` in `frontend`.
- [ ] Run `git diff --check`; review all result/history queries and deadline guards.
- [ ] Resolve all introduced review findings, rerun affected tests, and review again.
- [ ] Present final diff for user review before any commit; do not commit without that separate approval.
