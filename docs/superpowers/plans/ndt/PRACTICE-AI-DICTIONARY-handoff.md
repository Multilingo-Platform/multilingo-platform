# Practice AI Dictionary — Handoff

## 2026-10-20 — Codex Executor — IN_PROGRESS

**Approved plan:** `PRACTICE-AI-DICTIONARY-plan.md`  
**Baseline:** HEAD `2ceac14`, branch `feature/TV3-00-contract-audit`.  
**Working tree:** UC08.1 Highlight có staged/unstaged/untracked user work; giữ nguyên, không stash/reset/checkout.  
**Execution:** inline tuần tự DICT-01 → DICT-06; không commit/push.

### Baseline evidence

- Frontend: `npx vitest run src/features/exam/__tests__/ToeicReadingWorkspace.test.tsx src/features/exam/components/content/__tests__/SelectionToolbar.test.tsx src/features/exam/hooks/__tests__/useTextSelection.test.ts --maxWorkers=2` — 3 files, 30 tests PASS.
- Backend: `.\mvnw.cmd '-Dtest=UserQuotaReservationServiceTest,UserFlashcardServiceTest,UserFlashcardControllerTest' test` — 37 tests PASS, 0 failures/errors/skips.
- `git diff --check` PASS before feature changes.

### Approved decisions

- English → Vietnamese in IELTS/TOEIC Reading Practice.
- Quota FREE 20/day and active PREMIUM 500/day, configurable from admin templates; local calendar zone Asia/Ho_Chi_Minh.
- Keep selected passage context; Flashcard saved to user-owned en/vi deck; allow explicitly creating a private deck.
- Gemini provider is faked in automated tests; feature flag defaults off.

### Task ledger

| Task | State | Evidence |
|---|---|---|
| DICT-01 Contract/context validation | IMPLEMENTED | 12 focused tests PASS |
| DICT-02 Quota and request ledger | IMPLEMENTED — PostgreSQL gate pending | 25 focused tests PASS; no dedicated PostgreSQL URL |
| DICT-03 Gemini generation/API | IMPLEMENTED | 39 focused tests PASS; H2 Spring context PASS |
| DICT-04 Frontend popup/API | IMPLEMENTED | Focused tests/typecheck PASS; one unrelated dirty-baseline regression noted |
| DICT-05 Flashcard save | IN_PROGRESS | Focused API/component tests in progress |
| DICT-06 Integration/handoff | PLANNED | — |

### Residual risks to revisit

- HTML-to-text parity between browser and JDK parser must be proven with shared fixtures; reject mismatch before quota/provider.
- PostgreSQL test prerequisites may be absent; never report skipped concurrency evidence as PASS.
- Provider output is advisory; users must see that meanings are AI-generated.

## Append-only implementation entries

Executor appends each task's `IN_PROGRESS` and `IMPLEMENTED` evidence below. Final reviewer appends `PASS`, `NEED_FIX`, or `BLOCKED`; do not rewrite this baseline.

### 2026-10-20 — DICT-01 — IN_PROGRESS

- Prepared task brief with the plan execution scripts; baseline commit remains `2ceac14ccf01c99af218d3f40586ddc58c6c2537`.
- No production source changes yet. Existing UC08.1 tracked and untracked work is preserved.
- Test-first scope: strict request validation and extraction/verification of passage context from the requested snapshot Part/group only.

### 2026-10-20 — DICT-01 — IMPLEMENTED

- **Files:** added `DictionaryLookupRequest`, `DictionaryLookupResponse`, `DictionaryLookupRequestValidator`, `DictionaryLookupContextReader` and focused tests for the validator/context reader.
- **RED evidence:** focused Maven run initially failed at test compilation because the request and helper classes did not yet exist.
- **GREEN evidence:** `DictionaryLookupRequestValidatorTest,DictionaryLookupContextReaderTest` — 11 tests PASS, 0 failures/errors/skips. Covered canonical UUID, positive integer limits, body/context/selection bounds, unknown/duplicate JSON fields, Unicode selections, IELTS part-level passages, TOEIC group-scoped passages, entity decoding, script/style/comment/media exclusion, and rejection of mismatched Part/document/context/term.
- **Evidence correction:** the final focused suite reports 12 tests (8 validator + 4 context-reader); the earlier 11-test count above was from an intermediate run.
- The snapshot reader only examines the selected Reading Part or exact group ID; it does not traverse question content or other passage groups. Request/response `toString()` redacts text content.
- `git diff --check` PASS after DICT-01. Existing UC08.1 work remains untouched.
- **Not yet verified:** provider/API, quota ordering, Spring endpoint behavior, PostgreSQL concurrency, and browser behavior belong to later tasks.

### 2026-10-20 — DICT-02 — IN_PROGRESS

- Baseline remains `2ceac14ccf01c99af218d3f40586ddc58c6c2537`.
- DICT-01 is complete; DICT-02 now focuses on durable idempotency/reservations and daily quota provisioning. No DICT-02 production changes yet.
- Migration naming check found no existing version collision for `V20261020120000` at this point.

### 2026-10-20 — DICT-02 — IMPLEMENTED (PostgreSQL gate pending)

- **Files:** added daily quota provisioning, dictionary request entity/repository, transaction coordinator, recovery scheduler, and migration `V20261020120000__add_dictionary_lookup_requests.sql`; extended `UserQuotaRepository` with atomic first-use provisioning.
- **GREEN evidence:** `DictionaryLookupRequestValidatorTest,DictionaryLookupContextReaderTest,DictionaryLookupQuotaServiceTest,DictionaryLookupTransactionCoordinatorTest` — 25 tests PASS, 0 failures/errors/skips. Covered FREE/VIP templates and expiry, daily rollover in `Asia/Ho_Chi_Minh`, preserved usage on limit changes, replay/fingerprint conflict, active pending exclusion, lease recovery/refund, fencing of late completion, and storing only generated definition fields in replay JSON.
- Passage is not stored in the ledger. Result replay reconstructs the verified source context from the immutable attempt snapshot.
- `git diff --check` PASS.
- **PostgreSQL evidence remains pending:** `TV3_PG_TEST_URL` is not configured. No database was modified and no concurrency claim is made. Add/run the dedicated PostgreSQL integration test only against a separate test database before final acceptance.

### 2026-10-20 — DICT-03 — IN_PROGRESS

- DICT-02 has unit-level evidence; the PostgreSQL gate remains explicitly pending.
- DICT-03 is adding a disabled-by-default API and Gemini generator using the existing transport only. No Gemini credentials or live provider calls will be used.

### 2026-10-20 — DICT-03 — IMPLEMENTED

- **Files:** added strict dictionary output parser, prompt factory, generator, feature properties/configuration, service/controller, retry-after exception and focused unit/MockMvc tests; added dictionary error codes and documented opt-in settings.
- **GREEN evidence:** focused dictionary validation/quota/coordinator/generator/parser/prompt/service/controller run — 39 tests PASS, 0 failures/errors/skips.
- **Spring wiring evidence:** `SmokeTest` — 1 test PASS on isolated H2 `test` profile; application context and JPA repositories load. This does not verify the PostgreSQL migration or concurrency.
- **Safety:** feature defaults disabled; automated tests use Gemini mocks; controller responses are `no-store`, error messages are fixed and logs contain only error codes.
- **Still pending:** dedicated PostgreSQL migration/concurrency test; no PostgreSQL URL was configured. No live provider call or user database operation.
- `git diff --check` PASS at task boundary.

### 2026-10-20 — DICT-04 — IMPLEMENTED

- **Files:** added lookup request/response API types, strict response normalizer, 40-second bounded request API, selection-to-context builder, scoped Practice hook and accessible result popover; integrated in `WorkspacePage.tsx`. Extended the selection snapshot with a captured passage text value so lookup does not re-read mutable browser selection.
- **GREEN evidence:** lookup API/contract/hook/popover plus Reading toolbar/workspace regression — 37 tests PASS at the focused boundary. Added deadline, Mock no-call, lock/scope, repeated-selection single-flight, context-rehydrate late-response and unchanged-answer-state assertions; rerun evidence will be included in the final verification entry.
- `npx tsc -b --pretty false` PASS after DICT-04 integration.
- The `WorkspacePractice.test.tsx` broader run had one failure expecting a Reading group instruction in the question pane. The current dirty UC08.1 diff already suppresses Reading group instructions in `WorkspacePage.tsx` and moves passage rendering to `ReferencePane`; this code was present in the user-owned baseline and is outside the dictionary task. No edits were made to that behavior. Other tests in that run passed.
- **Safety:** Mock/locked/unverified documents do not dispatch; context includes only captured passage text; stale responses are aborted/ignored; lookup does not dispatch answer actions. Request retry preserves request ID.
- **Still pending:** browser visual/touch review and integrated E2E; no live API/provider calls.

### 2026-10-20 — DICT-05 — IN_PROGRESS

- Added flashcard API adapter and form tests before implementation; initial RED was unresolved module imports.
- Reuses existing deck/card endpoints; verifies private ownership and en/vi languages, validates API envelopes/card identity, preserves source context, handles duplicate `1210`, and reports ambiguous timeout without false success.
- Removed selected word from the existing add-card controller/service log messages; API/business behavior unchanged.

### 2026-10-20 — DICT-05 — IMPLEMENTED

- **Files:** added the Flashcard API adapter and `DictionaryFlashcardForm`; embedded the form in the dictionary result popover; added optional `userId` to the deck summary type; removed selected term text from the existing add-card controller/service log messages.
- **GREEN evidence:** the Flashcard API/component/popover tests passed in the combined frontend focused run. Covered owner/language filtering, private deck creation, preserving lookup data on save failure, duplicate handling, response validation, and ambiguous save timeout.
- “Đã lưu” is displayed only after a valid card response matching the selected deck and word. Existing vocab endpoints remain unchanged.

### 2026-10-20 — DICT-06 — IMPLEMENTED (external verification gates pending)

- **Files:** added `PracticeDictionaryContractIT.java` (Spring/MockMvc, isolated H2, mocked dictionary service) and `practiceDictionaryContract.test.tsx` (real hook, API normalizer, Flashcard form and Redux store; HTTP mocked).
- **Backend verification:** focused Maven run covering request/context validation, quota/coordinator, Gemini prompt/parser/generator, service/controller, integration contract and existing quota/Flashcard regressions — **81 tests PASS, 0 failures/errors/skips**. The application-context `SmokeTest` previously passed on isolated H2. No real provider or user database was used.
- **Frontend verification:** focused dictionary API/contracts/hook/popover/Flashcard, integration contract and Reading/highlight/autosave regression — **60 tests across 12 files PASS**. `npx tsc -b --pretty false` PASS; `npm run build` PASS (existing large-chunk warning); `npm run lint` exit 0. Direct `npx oxlint` on the new dictionary files passed without warnings. Full lint still reports repository warnings, including warnings in the pre-existing dirty `WorkspacePage.tsx`/Highlight work; no unrelated cleanup was attempted.
- `git diff --check` PASS after implementation edits.
- A broader `WorkspacePractice.test.tsx` check exposed one failure expecting a Reading group instruction in the main question pane. Root cause is the pre-existing user-owned UC08.1 diff that moves Reading content to `ReferencePane`; dictionary code did not introduce or change that behavior. No out-of-scope fix was made.
- **PostgreSQL gate remains pending:** `TV3_PG_TEST_URL` is not configured, so migration execution, reservation race/concurrency and crash-recovery integration have not been verified on PostgreSQL. No PostgreSQL-specific integration test was run and no database was modified. These checks are required before claiming full AC-04/rollout acceptance.
- **Browser gate remains unverified:** no live browser walkthrough at 375/768/1366 px or touch-device verification was performed. Automated popover/accessibility tests pass.
- **Final status:** implementation and isolated automated suites are complete; release acceptance is pending the dedicated PostgreSQL migration/concurrency gate and browser UX check. Feature remains disabled by default (`testing.dictionary-lookup.enabled=false`). No commit or push.

### 2026-10-20 — Codex Bug Fix — Dictionary loading indefinitely — FIXED (runtime availability pending)

- **Reported reproduction:** attempt 68, TOEIC Reading Part 7, select `verify` and click “Tra từ AI”; popup stayed on loading beyond 50 seconds.
- **Root cause:** `usePracticeDictionary.validScope` assumed `section.skill_type`, while `DbExamAdapter` serializes `SectionFixture.name = READING`. It also only matched `part.id` and checked locks using `section.id`, omitting the canonical snake/camel identity aliases supported by the workspace API. A rejected scope returned silently in `idle`. `WorkspacePage` then presented `idle` as `loading`, although no HTTP request/deadline had started. The observed indefinite spinner was therefore not evidence of a slow Gemini request.
- **Fix:** resolve Reading skill from `skill_type` or the DB snapshot `name`; resolve Part/section identities through their supported aliases; preserve section-lock validation. A rejected selection now returns a non-retryable context error and clears prior result/retry state. Pass the actual controller phase to the popover; an idle/cancelled lookup renders no dialog instead of a synthetic loading state.
- **Files changed in this bug-fix turn:** `frontend/src/features/exam/hooks/usePracticeDictionary.ts`, `components/practice/PracticeDictionaryPopover.tsx`, `pages/WorkspacePage.tsx`, `__tests__/usePracticeDictionary.test.tsx`, `__tests__/PracticeDictionaryPopover.test.tsx`, `__tests__/practiceDictionaryContract.test.tsx`, and this handoff. Existing tracked/untracked Highlight and dictionary implementation work was preserved. No backend/configuration/database edits in this fix.
- **RED evidence:** hook regressions failed with `idle` instead of `ready` for snake/camel workspace identities and `idle` instead of an error for rejected documents. The DB DTO regression failed until support for `SectionFixture.name` was added. The popover regression failed because a cancelled/idle dialog remained rendered.
- **GREEN evidence:** focused frontend command below: **11 files / 65 tests PASS**. Tests run the real workspace normalizer, dictionary API/deadline, hook, Redux and popover. Added page-level cases run `WorkspacePage`, `useWorkspace`, native DOM selection, selection toolbar, dictionary hook/API/normalizer with only HTTP/browser geometry mocked; both success and HTTP 503 leave loading. Covered canonical/alias identities, locked sections, invalid document, cancellation and a transport that never settles reaching the 40-second deadline.

```powershell
npx vitest run src/features/exam/__tests__/dictionaryLookupApi.test.ts src/features/exam/__tests__/dictionaryLookupContract.test.ts src/features/exam/__tests__/usePracticeDictionary.test.tsx src/features/exam/__tests__/PracticeDictionaryPopover.test.tsx src/features/exam/__tests__/practiceDictionaryContract.test.tsx src/features/exam/__tests__/DictionaryFlashcardForm.test.tsx src/features/exam/__tests__/dictionaryFlashcardApi.test.ts src/features/exam/__tests__/ToeicReadingWorkspace.test.tsx src/features/exam/components/content/__tests__/SelectionToolbar.test.tsx src/features/exam/__tests__/readingHighlightContract.test.tsx src/features/exam/__tests__/autosaveSubmitContract.test.tsx --maxWorkers=2
```

- **Other verification:** `npx tsc -b --pretty false` PASS; `npm run build` PASS with large-chunk warning; `npm run lint` exit 0 with repository warnings; `git diff --check` PASS. No warnings were cleaned up as part of this fix.
- **Full frontend run:** `npx vitest run --maxWorkers=2` — **99 files PASS / 2 files FAIL; 1,673 tests PASS / 2 FAIL**. Failures: `WorkspacePage.test.tsx` → “renders canonical reading question groups in order with group instructions and stable answer ids” (expects `Group one instruction` inside question pane), and `WorkspacePractice.test.tsx` → “handles retry flow: filters question groups to wrong question, preserves context, and exits retry” (expects `Choose the correct answer`). Both expectations concern the existing dirty Highlight Reading instruction relocation; this turn changed only the dictionary phase prop in `WorkspacePage`, not Reading instruction rendering. The latter failure was already recorded in the preceding handoff. Full run also emitted jsdom `HTMLMediaElement.pause()` notices. The two additional page-level dictionary cases were verified separately and in the final focused run after they were added; they are not counted in that full run.
- **Live browser evidence:** reopened `http://localhost:5173/attempts/68`, navigated to Part 7, dragged over `verify` and clicked “Tra từ AI”. After the fix, the popup immediately displayed “Tra từ AI hiện chưa khả dụng.” and a “Thử lại” button instead of remaining on loading. The live endpoint currently reports HTTP 503 (as classified by the real API/hook). Default configuration has `DICTIONARY_LOOKUP_ENABLED=false`; HTTP 503 can also represent provider unavailability, so the precise running-server configuration/provider cause has not been established. Successful real-provider translation is **not** claimed. No Flashcard save or exam submission was performed.
- **Acceptance scope:** fixes AC-05 loading/error behavior and workspace snapshot compatibility for AC-01/03, with AC-07 focused regressions green. Previous PostgreSQL concurrency/migration and real-provider rollout gates remain pending. No commit/push.
