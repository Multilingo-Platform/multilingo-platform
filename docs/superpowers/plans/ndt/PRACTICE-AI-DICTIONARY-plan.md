# Hoàn thiện Tra từ AI trong Practice

> **Executor:** triển khai tuần tự DICT-01–06 theo TDD; không commit hoặc push.

**Goal:** Trong Reading Practice, học viên chọn từ/cụm tiếng Anh, xem nghĩa tiếng Việt dựa trên passage và lưu thật vào bộ Flashcard riêng.

**Architecture:** `Selection snapshot → API contract → xác minh attempt/snapshot → quota ledger → Gemini JSON → popup → Flashcard API`. Từ điển chỉ dùng trong Practice; câu trả lời và answer key không đi vào prompt.

**Tech stack:** Java 21, Spring Boot, PostgreSQL, Gemini client hiện có, React, TypeScript, Vitest/RTL. Không thêm dependency.

**Baseline:** HEAD `2ceac14`, branch `feature/TV3-00-contract-audit`. Working tree có thay đổi và file chưa track của UC08.1 Highlight; phải giữ nguyên.

**Quyết định đã duyệt:** Anh → Việt; Reading IELTS/TOEIC; hiển thị nghĩa, từ loại, IPA nếu có, ví dụ và ngữ cảnh; người học chọn/tạo bộ thẻ private; quota FREE 20/ngày, PREMIUM còn hiệu lực 500/ngày theo template admin; provider Gemini hiện có.

## Contract

`POST /api/v1/attempts/{attemptId}/dictionary-lookups` nhận:

```ts
interface DictionaryLookupRequest {
  requestId: string; // UUID
  partId: number;
  documentId: string; // `part` hoặc group ID snapshot
  selectedText: string;
  contextText: string; // plain text, tối đa 1.000 code points
}
```

Response `ApiResponse<DictionaryLookupResponse>` chứa request/attempt/part/document identity, `selectedText`, `sourceContext`, ngôn ngữ `en`/`vi`, `meaningVi`, nullable `phonetic`/`partOfSpeech`, `exampleEn`/`exampleVi`.

Backend lấy danh tính từ SecurityContext và kiểm tra ownership, `PRACTICE`, `IN_PROGRESS`, Reading part chưa khóa, document/term/context nằm trong passage công khai của snapshot. FE context chỉ dùng định vị; backend xác minh rồi mới gửi context chuẩn hóa tới Gemini. Không quét toàn snapshot, không fallback sang dữ liệu client chưa xác minh.

Giới hạn: selected text 2–80 code points, tối đa 5 từ; body ≤16 KiB; ID positive Java integer; từ chối field ngoài contract. Gemini JSON, tối đa 2.048 output tokens, một lần gọi. Nghĩa bắt buộc; IPA/từ loại nullable. Nội dung render dạng text, response `Cache-Control: no-store`, lỗi/log không chứa prompt, passage, từ chọn, upstream body hoặc token. FE deadline toàn request 40 giây. Feature flag mặc định tắt.

Quota: `DICTIONARY_LOOKUP`; template FREE user 0 / VIP user -1; fallback 20/500 nếu thiếu template; template lỗi thì fail closed. PREMIUM hết hạn dùng FREE. Ngày theo `Asia/Ho_Chi_Minh`. Một request PENDING/user, cooldown 2 giây, idempotent theo requestId+fingerprint, reservation/refund một lần. Provider chạy ngoài transaction; lease = provider timeout +15 giây; recovery mỗi 60 giây; recheck attempt khi hoàn tất/replay.

Flashcard: tái sử dụng deck/card API. Chỉ bộ thẻ sở hữu có `targetLanguage=en`, `sourceLanguage=vi`; cho tạo bộ riêng trong popup. Lưu term/meaning/phonetic/pos và passage context vào `exampleSentence`. Chỉ báo thành công khi API xác nhận.

## Global constraints

- Giữ toàn bộ thay đổi người dùng hiện có, nhất là UC08.1; không commit/push.
- Không thêm dependency, không gọi Gemini thật trong tests.
- Không đổi answers, version, autosave, submit, restore hoặc dữ liệu lịch sử attempt.
- Mock, attempt không thuộc người gọi, sai document hoặc section khóa không được gọi provider hay trừ quota.
- Không sửa transport Gemini; chỉ dùng `GeminiClient` hiện có.

## Review focus

1. Context client lệch passage lịch sử; test bắt buộc xác minh scope/text trước quota.
2. Request cũ đến muộn sau đổi attempt/Part; test identity + epoch.
3. Hai request tranh quota cuối cùng / crash khi provider pending; test PostgreSQL concurrency, lease và refund.
4. AI output HTML/JSON lỗi hoặc quá dài; test giới hạn parser và render text.
5. Flashcard lưu thành công nhưng response lỗi/timeout; UI phải nói rõ trạng thái chưa xác nhận.

## Task 1: DICT-01 — Contract và đọc passage an toàn

**Tạo backend:** `modules/testing/dto/request/DictionaryLookupRequest.java`, `dto/response/DictionaryLookupResponse.java`, `service/support/DictionaryLookupRequestValidator.java`, `service/support/DictionaryLookupContextReader.java`; tests `DictionaryLookupRequestValidatorTest`, `DictionaryLookupContextReaderTest` trong cùng package test.

- [x] Viết tests trước: UUID/ID/biên, Unicode, tối đa 5 từ, body/context cap, extra fields, HTML entity, script/style/media, aliases part/group, sai scope/context.
- [x] Chạy test xác nhận fail vì contract/helpers chưa có.
- [x] Tạo DTO/validator bounded; trích plain text bằng JDK HTML parser; chuẩn hóa whitespace.
- [x] Resolve document chỉ trong Part được yêu cầu; xác minh cả context và term thuộc passage snapshot.
- [x] Chạy focused tests và xác nhận IELTS passage cấp Part, TOEIC group passage; invalid input dừng trước quota/provider.

## Task 2: DICT-02 — Quota ngày và request ledger

**Tạo:** `modules/analytics/service/DictionaryLookupQuotaService.java`; `modules/testing/entity/DictionaryLookupRequestRecord.java`, `repository/DictionaryLookupRequestRepository.java`, `service/support/DictionaryLookupTransactionCoordinator.java`, `service/scheduler/DictionaryLookupRecoveryScheduler.java`; migration `backend/src/main/resources/db/migration/V20261020120000__add_dictionary_lookup_requests.sql`.

**Sửa:** `modules/analytics/repository/UserQuotaRepository.java`.

- [ ] Viết tests quota cấp lần đầu, admin overrides, 20/500, PREMIUM hết hạn, midnight, tranh lượt cuối, replay/conflict, crash recovery, refund sau rollover, late completion.
- [ ] Chạy tests RED trước implementation.
- [ ] Migration precheck duplicate; partial unique index quota feature; ledger unique `(user_id,request_id)` và partial unique PENDING/user. Ledger không lưu passage.
- [x] Cấp quota atomically bằng insert-on-conflict/row lock; reserve/refund dùng `UserQuotaReservationService` với feature code cụ thể.
- [x] Begin/complete/fail/recovery dùng cùng thứ tự lock; lease provider timeout +15s; scheduler 60s.
- [ ] Chạy PostgreSQL integration trên DB thử nghiệm riêng; hiện môi trường chưa có `TV3_PG_TEST_URL`, không dùng database đang chạy của người dùng.

## Task 3: DICT-03 — Gemini generation và endpoint

**Tạo:** `modules/testing/ai/dictionary/DictionaryLookupPromptFactory.java`, `DictionaryLookupOutputParser.java`, `DictionaryLookupGenerator.java`, `service/PracticeDictionaryService.java`, `service/impl/PracticeDictionaryServiceImpl.java`, `controller/PracticeDictionaryController.java`, `config/DictionaryLookupProperties.java`, `DictionaryLookupConfiguration.java`.

**Sửa:** `common/exception/ErrorCode.java`, `backend/src/main/resources/application.properties`, `modules/testing/README.md`.

- [ ] Viết tests prompt/output/service/controller bằng Gemini giả: disabled, malformed/empty/oversized JSON, timeout, attempt state đổi, injection text, log sentinel.
- [ ] Chạy RED; sau đó thêm feature flag `testing.dictionary-lookup.enabled=false`, bounded request body và local error handlers `no-store`.
- [ ] Prompt chỉ chứa selected term + context đã xác minh; output parser enforce field lengths; backend dựng identity từ request.
- [ ] Service coordinator begin → provider ngoài transaction → complete/fail/refund; ánh xạ lỗi an toàn.
- [ ] Chạy focused backend tests; xác minh Mock/IDOR/locked/done không gọi Gemini.

## Task 4: DICT-04 — API normalizer, hook và popup

**Tạo frontend:** `features/exam/api/dictionaryLookupApi.ts`, `dictionaryLookupContract.ts`, `hooks/usePracticeDictionary.ts`, `utils/dictionarySelection.ts`, `components/practice/PracticeDictionaryPopover.tsx`.

**Sửa:** `features/exam/types/api.types.ts`, `pages/WorkspacePage.tsx`, tests liên quan.

- [ ] Viết tests normalizer/hook/popup: response mismatch, stale A→B→A, double click, cancel, timeout, Mock không gọi API, selection context và lock.
- [ ] Chạy RED.
- [ ] Dùng selection snapshot UC08.1; tạo plain-text context ≤1.000 code points cùng document identity; gửi UUID; không đọc lại browser selection khi submit.
- [ ] Hook mutex trước await, abort/invalidate khi đổi attempt/Part/document/hydration/submit/unmount. Retry người dùng rõ ràng; giữ requestId khi chưa biết request cũ đã commit hay chưa.
- [ ] Thay popup mock bằng loading/error/ready, display nghĩa/IPA/POS/examples/context; render React text; clamp viewport, Escape, focus/accessibility, quota retry time.
- [ ] Chạy frontend focused tests và typecheck.

## Task 5: DICT-05 — Lưu Flashcard

**Tạo:** `features/exam/components/practice/DictionaryFlashcardForm.tsx`, `features/exam/api/dictionaryFlashcardApi.ts`, `features/exam/__tests__/DictionaryFlashcardForm.test.tsx`.

**Sửa:** `backend/.../modules/vocab/controller/UserFlashcardController.java`, `service/impl/UserFlashcardServiceImpl.java` chỉ để bỏ term khỏi log add-card; không đổi API.

- [ ] Test deck owner/languages, create private deck, save payload, duplicate `1210`, timeout/ambiguous response và load lại.
- [ ] Chạy RED; dùng GET decks, POST decks, POST cards hiện có.
- [ ] Chỉ list bộ thẻ sở hữu có language pair en/vi; tạo deck private khi người dùng yêu cầu.
- [ ] Lưu selected term, meaning, phonetic/POS và sourceContext trong exampleSentence; không mất lookup data khi save lỗi.
- [ ] Thành công chỉ sau valid API response; duplicate báo riêng; timeout báo chưa xác nhận.
- [ ] Xóa term khỏi log ở hai điểm add-card liên quan; giữ ID/metadata cần cho chẩn đoán.
- [ ] Chạy frontend/backend tests focused.

## Task 6: DICT-06 — Integration và bàn giao

**Tạo:** `backend/src/test/java/com/multilingo/backend/modules/testing/controller/PracticeDictionaryContractIT.java`, `.../repository/DictionaryLookupPostgresIT.java`, `frontend/src/features/exam/__tests__/practiceDictionaryContract.test.tsx`.

- [ ] Integration dùng page/hook/API normalizer thật; HTTP và Gemini được giả lập. Verify lookup → save → GET card.
- [ ] Verify Mock/ownership/context invalid không gọi provider/quota; attempt đổi trạng thái lúc provider pending refund đúng.
- [ ] Verify lookup không dirty answers, đổi version, phát PUT; highlight/reload UC08.1 không hồi quy.
- [ ] Browser 375/768/1366px, chuột/bàn phím/touch, popup gần mép và lỗi/retry.
- [ ] Chạy focused backend/frontend, typecheck, lint, build, `git diff --check`; kiểm tra status và giữ nguyên dirty baseline.
- [ ] Append files, RED/GREEN, AC mapping, tests, residual risks; dừng chờ final review.

## Acceptance và verification

AC-01 tra Anh→Việt từ API thật; AC-02 backend xác minh snapshot/context và không gửi secrets/answers; AC-03 Practice/owner/scope/unlocked only; AC-04 quota/idempotency/concurrency/refund; AC-05 stale/error/retry UX; AC-06 Flashcard lưu thật; AC-07 answer/autosave/highlight invariants; AC-08 mobile/keyboard/XSS safety.

Backend focused: tests DICT mới + `UserQuotaReservationServiceTest`, `QuotaServiceTest`, `UserFlashcardServiceTest`, `UserFlashcardControllerTest`, `WritingHintsContractIT`. PostgreSQL concurrency test phải chạy trên database thử nghiệm riêng, không skip.

Frontend focused: tests DICT mới + `ToeicReadingWorkspace.test.tsx`, `SelectionToolbar.test.tsx`, `readingHighlightContract.test.tsx`, `autosaveSubmitContract.test.tsx`; typecheck, lint, build. Không gọi Gemini thật.

Rollout: feature mặc định tắt; staging sau migration/tests; flag tắt để ngừng tra mới, giữ Flashcards đã lưu. AI có thể sai; scope v1 chỉ Anh→Việt, lịch sử tra không đồng bộ thiết bị.
