# Confirmed Exam and Writing Issues Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Implement sequentially with TDD; do not retry/requeue terminal historical jobs or deploy.

**Goal:** Fix confirmed popup/SRS/prompt defects, support multi-Part attempts, make Writing quota admin and reservation agree, accept safe HTML image references, and identify malformed grader output safely.

**Architecture:** Keep changes at the existing React exam, attempt service, quota service, and snapshot grading boundaries. Add `MULTI_PART` as an additive attempt scope; reuse the quota reservation, image fetch, and strict parser infrastructure already present.

**Tech Stack:** React/TypeScript/Vitest; Java 21/Spring Boot/JUnit; PostgreSQL/Flyway only if a concrete schema change proves necessary.

**Spec:** `docs/superpowers/specs/2026-11-02-confirmed-exam-and-writing-fixes.md`

## Constraints

- Preserve user changes; keep old attempt scopes and `(partId, questionId)` identity.
- Use TDD and no new dependency. Do not expose essay/provider output/image URLs in logs or public contracts.
- Snapshot remains immutable. Do not fetch images during submit or modify historical attempts/cards.
- Practice has no deadline; Mock duration adds each selected Section once.
- Hint/grading defaults: FREE 5, PREMIUM/VIP 20; zero disables; legacy `WRITING_ASSISTANT` stays stored but is no longer consumed for these features.
- Terminal `FAILED/UNAVAILABLE` jobs remain terminal; retry an existing `WAITING` job only through the current scheduler.

## Review Focus

- Multi-Part IDs are validated against the selected published exam before attempt persistence.
- Sections containing several selected Parts count once in Mock duration and lock once on transition.
- The quota transaction never consumes a new period setting early or refunds a reservation into a later period.
- HTML extraction cannot fetch an unscoped URL or bypass the existing ImageFetcher policy.
- Validation reason metadata and logs contain only fixed codes/IDs, never essays or provider output.

## Tasks

### Task 1: Popup, flashcard example, and duplicate prompts

**Files:** popup/form/selection utility, SRS `FlipCard`, Fill-in-blank/Matching renderers and focused frontend tests.

- Add failing tests for viewport-edge placement, responsive size change, fixed save area, AI example priority, context fallback, old-card display truncation, and single workspace prompt.
- Implement a `ResizeObserver`/`visualViewport`-aware bounded popup; keep body scrolling and the save section reachable.
- Build a shared 320-code-point example helper with sentence segmentation. Prefer AI example; fallback to the source sentence. Apply helper at API save and old-card presentation only.
- Add optional `showPrompt` to affected renderers and pass `false` from `WorkspacePage`; preserve standalone default.
- Run focused Vitest tests for the changed components and API/selection helpers.

### Task 2: Additive multi-Part attempt contract and snapshot

**Files:** `TestScope`, `CreateAttemptRequest`, attempt start UI/types/API, `TestAttemptServiceImpl`, workspace navigation, result/history normalizers and focused backend/frontend tests.

- Add RED tests for aliases, validation, published-exam membership, snapshot filtering/order, Practice deadline, Mock sum with repeated Sections, and old-scope compatibility.
- Add `MULTI_PART`, `targetPartIds`, alias `part_ids`; require at least two distinct positive IDs only for that scope and reject mixed single-scope selectors.
- Resolve every Part against the published fixture. Filter cloned snapshot by selected IDs in source exam order; omit empty Sections.
- Sum configured duration once per retained Section; fail before saving when any required duration is missing/invalid. Leave old scope deadline paths unchanged.
- Add grouped checkbox selection that persists choices while changing skill filter, displays selected count/time, and submits the new scope. Extend resume/result/history labels and accepted scope validators.
- Extend the existing Mock skill lock logic to `MULTI_PART`; moving within a Section does not lock it, leaving a Section locks it, and a locked Section stays inaccessible after reload.
- Run focused AttemptService, attempt API, result normalization, workspace lifecycle, and ScopeModePicker tests.

### Task 3: Separate Writing quotas and admin controls

**Files:** `QuotaServiceImpl`, quota admin types/page, quota defaults/resolution in `UserQuotaReservationService`, repository provisioning query, corresponding quota service and admin tests.

- Add RED tests for two separate feature rows, defaults FREE 5/VIP 20, 0 limit, user first-use provisioning, daily reset at Ho Chi Minh midnight, concurrent reservations, duplicate/malformed rows, and period-safe refunds.
- Replace Writing Assistant admin configuration with `AI_WRITING_HINTS` and `AI_WRITING_GRADING`; retain Dictionary/Chat settings. Validate only supported feature codes.
- Generalize atomic first-use provisioning to both Writing codes using per-feature unique indexes already present; inspect migration history before adding any migration. Do not seed/migrate or delete legacy `WRITING_ASSISTANT` rows.
- Share tier limit resolution and daily reset behavior. Preserve a current nonexpired row's used count/limit/reset; apply admin/default limit on a new row or expired-period reset. Do not silently repair duplicates or invalid existing configuration.
- Keep grading's one-reservation-per-job and hints' one-reservation-per-success behavior; confirm retries do not reserve again and period-bound refund semantics remain intact.
- Run focused quota repository PostgreSQL IT, reservation, adapter, QuotaService and admin frontend tests.

### Task 4: Parse scoped HTML image references in grading context

**Files:** `WritingGradingContextReader`, a small HTML image projection helper using `ParserDelegator` (or existing JDK parser path), context-reader tests.

- Add RED tests for text-only HTML, a valid scoped `img src`, dedupe with structured media, missing `src`, `data:`/relative URL, non-image media, over two distinct images, and an image in another question.
- Project allowed HTML tags to text and extract only `<img src>` for the target part/group/question. Merge URLs in deterministic order with structured media and dedupe.
- Validate extracted references as absolute HTTPS URIs before `WritingGradingImageLoader`; keep host allowlist, redirects, MIME and byte-size policy in `ImageFetcher`.
- Do not change submit enqueue timing or historical snapshots. Job context stores only the approved references for that exact task.
- Run context reader, image loader/security, Writing enqueuer and focused submit tests.

### Task 5: Persist safe malformed-output validation reason

**Files:** `WritingGradingOutputParser`, `WritingGradingFailure`, `WritingGradingWorker`/coordinator metadata, frontend Writing feedback error mapping and targeted tests.

- Add RED tests mapping parser validation failures to fixed categories: malformed JSON, schema/field, score, size, correction layout, and reconstruction mismatch.
- Replace free-form parser validation messages in the failure object with an enum/reason code; preserve `MALFORMED_OUTPUT` as the public `lastErrorCode`.
- Persist the fixed code in `model_metadata.validationCode`; log only job ID, attempt ID, and reason code. Do not persist raw output, essay, snippets, URLs, or exception causes.
- Map `MALFORMED_OUTPUT` to a safe Vietnamese learner message; do not retry terminal results or reveal internal validation detail through the API.
- Run parser/generator/worker/coordinator/result-contract and feedback presentation tests.

## Final verification

- Run all focused tests above as each task completes.
- Run `backend/mvnw.cmd clean test` and `frontend/npm test`, `frontend/npm run lint`, `frontend/npm run build`; capture outputs and report existing warnings/failures accurately.
- Review diff, migration requirements, log fields, compatibility of all scope normalizers, and `git diff --check`.
- No deploy or historical job requeue. Validate the implementation with a newly created test attempt when an authorized non-production environment is available.
