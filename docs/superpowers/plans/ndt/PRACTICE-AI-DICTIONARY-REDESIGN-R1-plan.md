# Tra từ AI & Highlight R2 — Kế hoạch triển khai

> **For agentic workers:** Thực hiện tuần tự RD-01 → RD-09. Mỗi task dùng TDD: thêm regression, xác nhận RED, sửa tối thiểu, chạy GREEN, rồi cập nhật handoff. Không commit/push nếu chưa được yêu cầu.

**Ngày:** 2026-10-27
**Trạng thái:** PLANNED
**Baseline:** HEAD `4f968b6`, branch `feature/UC08.1-highlight-auto-r1`, working tree sạch.

**Goal:** Thống nhất highlight và tra từ trong workspace: thả vùng chọn để tô màu và mở popup; Practice có thể tra vùng chọn sang ngôn ngữ mẹ đẻ và lưu Flashcard, Mock chỉ có công cụ highlight.

**Architecture:** Một registry văn bản tĩnh có identity ổn định nối các vùng đề, câu hỏi và lựa chọn với offset DOM. Popup dùng chung cho palette màu, xóa và hành động Tra từ; backend tự lấy ngôn ngữ đề từ snapshot và ngôn ngữ đích từ `User.nativeLanguage`, đồng thời giữ nguyên API Dictionary v1/v2.

**Tech stack:** Java 21, Spring Boot, Jackson, PostgreSQL JSONB hiện có, React, TypeScript, Redux Toolkit, DOMPurify, Vitest/RTL, JUnit/Mockito. Không thêm dependency, bảng hoặc migration.

**Spec liên quan:** `docs/superpowers/plans/ndt/UC08.1-HIGHLIGHT-AUTO-R1-plan.md`; các contract Dictionary đa ngôn ngữ hiện có trong `docs/superpowers/plans/ndt/TV3-MULTILINGUAL-completion-plan.md` và handoff tương ứng.

## Phạm vi và ràng buộc chung

- Tác nhân là học viên đã đăng nhập trong một attempt Practice hoặc Mock đang hoạt động.
- Cho highlight/tra từ trên nội dung đề tĩnh: tiêu đề/hướng dẫn, passage/group content, prompt câu hỏi và text option hiển thị.
- Không gắn công cụ vào câu trả lời học viên, essay, feedback, explanation, đáp án đúng ẩn, hoặc transcript/solution chỉ hiện sau khi chấm.
- Practice: tô màu và Tra từ; Mock: tô màu/xóa, tuyệt đối không gọi Dictionary hay Flashcard API.
- Tra từ luôn dùng `User.nativeLanguage` đã lưu từ onboarding. Không có selector đổi ngôn ngữ; không fallback âm thầm sang UI locale.
- Tái sử dụng Flashcard hiện tại và giữ cặp ngôn ngữ do response Dictionary xác nhận.
- Không thay answer payload/version/autosave, section lock, deadline, submit hoặc dữ liệu attempt lịch sử.
- Giữ nguyên API Dictionary v1/v2 cho consumer/job cũ; thêm contract v3 riêng, không đổi fingerprint/context v1/v2.
- Nội dung HTML phải qua pipeline sanitizer hiện tại; text thuần phải được render như text, không parse thành HTML.
- Offset DOM tiếp tục là UTF-16; từ chối cắt giữa surrogate pair. Mỗi selection chỉ thuộc một text source.
- Archive highlight mới có màu; dữ liệu archive cũ được đọc tương thích và quy về màu vàng.
- Không gọi Gemini/CDN thật, không dùng database ứng dụng cho test, không seed đề, không commit/push.

## Root cause đã xác nhận trong repository

1. `SelectionToolbar` hiện cung cấp action Highlight và Tra từ AI riêng; `PracticeDictionaryPopover` còn bước chọn ngôn ngữ và nút lookup thứ hai, nên lookup không phải thao tác trực tiếp từ selection popup.
2. Highlight R1 đang chỉ đăng ký passage Reading; prompt câu hỏi, option và một số nội dung Listening/Writing render ở các component khác nên không có scope/offset chung.
3. Popup đang xử lý selection theo hook riêng; vòng đời đóng ngoài/new selection và palette chưa hợp nhất. Option renderer có `onClick`/radio default activation nên thao tác kéo chọn có thể vô tình đổi đáp án nếu không chặn click kết thúc ở capture phase.
4. Highlight model/storage hiện chỉ có một màu vàng (`Highlight` không có `color`); merge hiện tại không thể áp màu mới cho đúng vùng mà vẫn giữ các phần ngoài vùng chọn.
5. Dictionary v2 cho phép chọn `meaningLanguage`; resolver chung dùng native language làm mặc định nhưng còn fallback theo policy AI hiện có. Yêu cầu này cần policy native-only riêng mà không đổi Hints/feedback hoặc replay cũ.
6. `nativeLanguage` được lưu qua `StudentOnboardingServiceImpl` và đọc qua `DbLearningLanguageAdapter`, nhưng chưa có contract riêng cho Dictionary workspace buộc dùng giá trị này.

## Contract và quyết định thiết kế

### Text source identity

FE và BE dùng source discriminator ổn định, không dùng index mảng:

```ts
type WorkspaceTextSource =
  | { kind: 'PART_TITLE' | 'PART_INSTRUCTION' | 'PART_CONTENT' }
  | { kind: 'GROUP_INSTRUCTION' | 'GROUP_CONTENT'; groupId: string }
  | { kind: 'QUESTION_TEXT'; questionId: string }
  | { kind: 'OPTION_TEXT'; questionId: string; optionId: string };
```

Một selection nằm trọn trong một source. Selection vượt qua hai source bị từ chối. Source phải được dựng từ snapshot/workspace response đã sanitize, không quét toàn DOM để suy ra nội dung bí mật. Các option của `<select>` được cung cấp thêm dưới dạng text tĩnh có thể chọn cạnh control; control native hiện hữu vẫn dùng để trả lời.

### Popup và màu

- Desktop mouse/trackpad: khi selection hợp lệ được thả, tự áp màu hiện hành và mở popup. Popup không cần nút xác nhận Highlight.
- Touch, pen và keyboard giữ luồng xác nhận Highlight hiện tại của R1 để không tô khi người dùng đang chọn/cursoring.
- Popup selection mới thay popup cũ; click ngoài đóng; thao tác trong portal không bị coi là click ngoài.
- Palette gồm vàng `#FEF08A`, xanh lá `#BBF7D0`, xanh dương `#BAE6FD`, hồng `#FBCFE8`, tím `#DDD6FE`. Màu mặc định vàng; lựa chọn màu giữ trong workspace hiện tại, reload chỉ khôi phục màu vùng đã lưu và mặc định màu thao tác mới về vàng.
- Khi đổi màu trên vùng đã chọn, chỉ vùng đó đổi màu; các phần ngoài giữ màu cũ. Các lớp cũ được tách nếu cần. Chỉ merge các vùng chồng/tiếp giáp cùng màu; khoảng trắng vẫn tách.
- Xóa từ popup selection xóa đúng đoạn chọn; click highlight cũ mở popup xóa cả cụm hiện hữu.
- Màu được biểu thị bằng fill nhạt và nhãn/accessibility; focus dễ thấy, tên màu cho screen reader, trạng thái `aria-pressed`.
- Mock hiển thị popup palette/xóa nhưng không có action Tra từ/Flashcard.

### Dictionary v3

```http
POST /api/v3/attempts/{attemptId}/dictionary-lookups
```

```json
{
  "requestId": "uuid",
  "partId": 7,
  "source": { "kind": "OPTION_TEXT", "questionId": "q_012", "optionId": "B" },
  "selectedText": "sample phrase",
  "contextText": "sentence containing the selected phrase"
}
```

Request không nhận `learningLanguage`, `meaningLanguage`, user ID, raw URL hoặc arbitrary fields. Source language được xác nhận từ attempt snapshot, target language chỉ từ DB `User.nativeLanguage`. Native language thiếu/không hợp lệ → lỗi cố định trước quota reservation và provider; highlight vẫn dùng được.

Response mang identity đầy đủ (`requestId`, `attemptId`, `partId`, `source`, `selectedText`, `sourceContext`), `policyVersion: NATIVE_PROFILE_V1` và `definition` schema 2 hiện hữu (`learningLanguage`, `meaningLanguage`, `meaning`, `phonetic`, `partOfSpeech`, `example`, `exampleTranslation`). Backend bảo đảm `meaningLanguage` là native đã đóng băng. V1/v2 replay tiếp tục dùng context/fingerprint cũ; cùng UUID v3 retry dùng policy/ngôn ngữ đã lưu, UUID mới dùng hồ sơ hiện tại.

Backend kiểm tra auth/ownership, Practice mode, attempt IN_PROGRESS, section chưa khóa, source thuộc part/snapshot công khai, selection/context trong source và quota trước provider. Giữ lock order attempt → quota → ledger, lease fencing, idempotency, refund và provider ngoài transaction. Không lưu toàn passage trong ledger; identity source được chuyển thành document key ổn định nằm trong giới hạn cột hiện có.

### Archive highlight

Tạo schema 2 với key `exam_highlights_v2_<ownerId>_<attemptId>`, archive identity theo owner/attempt/part/source/contentHash và range có `color` từ allowlist. Nếu v2 tồn tại, kể cả archive rỗng hợp lệ, nó có ưu tiên; nếu chưa có mới đọc v1 và gán yellow. Không xóa v1 trong release này.

## Kế hoạch theo task

Mọi đường dẫn tính từ repository root `D:/Project/University/multilingo-platform/`.

### RD-01 — Source catalog và chuẩn hóa văn bản dùng chung

**Files:**

- Tạo `backend/src/main/java/com/multilingo/backend/modules/testing/dto/request/WorkspaceTextSource.java`.
- Tạo `backend/src/main/java/com/multilingo/backend/modules/testing/service/support/WorkspaceTextSourceReader.java`.
- Tạo `backend/src/test/java/com/multilingo/backend/modules/testing/service/support/WorkspaceTextSourceReaderTest.java`.
- Tạo `frontend/src/features/exam/types/workspaceText.types.ts`.
- Tạo `frontend/src/features/exam/utils/workspaceTextDocuments.ts`.
- Tạo `frontend/src/features/exam/__tests__/workspaceTextDocuments.test.ts`.

**Các bước:**

- [ ] Khóa enum/source schema và JSON mapping; từ chối field lạ/ID rỗng/ID vượt giới hạn.
- [ ] FE dựng document từ title, instruction, content, question prompt, authored options; không nhận essay/answer/feedback.
- [ ] Tách rõ plain text và sanitized HTML; plain text không đi qua HTML parser.
- [ ] BE chỉ đọc allowlist public fields từ part/group/question/options trong snapshot projection; không quét raw snapshot.
- [ ] Đồng bộ whitespace/entity behavior cho text liền inline, block, bảng, HTML entity và Unicode bằng fixture literal chung.
- [ ] Tính content hash từ prepared/sanitized text; range UTF-16 và boundary surrogate hợp lệ.
- [ ] Test source không tồn tại, source ngoài part, prompt injection/script, context giả và selection băng qua hai source.

**Tests:** `WorkspaceTextSourceReaderTest`, `workspaceTextDocuments.test.ts`.

**Nghiệm thu:** cùng source tạo cùng identity/hash/text ở FE và BE; private grading data không thể trở thành source.

### RD-02 — Native-language policy riêng cho Dictionary

**Files:**

- Tạo `backend/src/main/java/com/multilingo/backend/modules/testing/service/support/DictionaryNativeLanguageResolver.java`.
- Tạo `backend/src/main/java/com/multilingo/backend/modules/testing/dto/response/DictionaryLanguageContextResponse.java`.
- Tạo `backend/src/test/java/com/multilingo/backend/modules/testing/service/support/DictionaryNativeLanguageResolverTest.java`.
- Sửa `backend/src/main/java/com/multilingo/backend/modules/testing/dto/response/WorkspaceResponse.java`.
- Sửa mapping workspace trong `backend/src/main/java/com/multilingo/backend/modules/testing/service/impl/TestAttemptServiceImpl.java`.
- Sửa `backend/src/main/java/com/multilingo/backend/common/exception/ErrorCode.java` (hoặc vị trí enum thực tế sau khi xác minh) để thêm lỗi native language bắt buộc.

**Các bước:**

- [ ] Đọc `User.nativeLanguage` bằng adapter/repository hiện có; chuẩn hóa qua `LearningLanguageCatalog`.
- [ ] Trả metadata riêng cho Dictionary; không đổi `AttemptLanguageContextResponse` đang dùng Hints/feedback.
- [ ] Khi native language thiếu/sai, metadata báo unavailable và lookup bị chặn trước quota/provider; không fallback sang UI locale hoặc exam language.
- [ ] Workspace core tiếp tục mở nếu metadata Dictionary unavailable.
- [ ] Test native code base/region/script, alias được hỗ trợ, null, unsupported, user không sở hữu attempt.

**Nghiệm thu:** workspace trả đúng native language của owner và không lộ thông tin nhạy cảm; Hints/feedback không đổi.

### RD-03 — API v3, validator và ledger replay an toàn

**Files:**

- Tạo trong `backend/src/main/java/com/multilingo/backend/modules/testing/`: `controller/PracticeDictionaryV3Controller.java`, `dto/request/DictionaryLookupV3Request.java`, `dto/response/DictionaryLookupV3Response.java`, `service/PracticeDictionaryV3Service.java`, `service/impl/PracticeDictionaryV3ServiceImpl.java`, `service/support/DictionaryLookupV3RequestValidator.java`.
- Sửa `service/support/DictionaryLookupTransactionCoordinator.java`, `entity/DictionaryLookupRequestRecord.java` và repository chỉ khi cần thêm lookup/replay v3.
- Tests: `DictionaryLookupV3RequestValidatorTest`, `PracticeDictionaryV3ContractIT`, mở rộng `DictionaryLookupTransactionCoordinatorTest`.

**Các bước:**

- [ ] Thêm validator body ≤16 KiB, UUID, source discriminator allowlist, IDs, selection/context giới hạn và từ chối field language/client identity.
- [ ] V3 xác nhận owner, Practice, IN_PROGRESS, part/source/section lock và nội dung passage công khai trước quota/provider.
- [ ] Tạo fingerprint v3 gồm version + source identity + payload chuẩn hóa; giữ byte/fingerprint v1/v2.
- [ ] Ghi policy, source language, native language và prompt version vào `context_json`; không lưu toàn passage.
- [ ] Replay cùng UUID trả kết quả đã đóng băng; payload/source khác conflict; UUID mới dùng native profile hiện tại.
- [ ] Bảo toàn lock order, reservation/refund, lease/run fencing, late completion và provider ngoài transaction.
- [ ] Dùng generator/output parser v2 hiện có; không thay Gemini transport.
- [ ] Test Mock, sai owner, source giả, answer/explanation source, locked/completed, provider error, quota exhaustion, refund một lần, replay khi native profile đổi.

**Nghiệm thu:** API v3 đúng native language; v1/v2 contract regression nguyên vẹn; lỗi access/input không tốn quota.

### RD-04 — Màu, overlay range và lưu trữ schema 2

**Files:**

- Tạo `frontend/src/features/exam/utils/highlightColors.ts` và `frontend/src/features/exam/utils/__tests__/highlightColorRanges.test.ts`.
- Sửa `frontend/src/features/exam/utils/highlightUtils.ts`, `htmlHighlight.ts`, `highlightStorage.ts`, `store/answerSlice.ts`, `hooks/useHighlightPersistence.ts`.
- Mở rộng tests hiện có `highlightUtils.test.ts`, `htmlHighlight.test.ts`, `highlightStorage.test.ts`, `answerSlice.test.ts`, `useHighlightPersistence.test.tsx`.

**Các bước:**

- [ ] Thêm enum 5 màu cùng giá trị/nhãn cố định; input màu không thuộc allowlist bị loại.
- [ ] Đổi model highlight/archive thành range có màu; migration v1→v2 gán yellow, giữ v1.
- [ ] Viết overlay thuần: cắt các range cũ tại selection, thay phần giao bằng màu mới, giữ phần ngoài và ID ổn định; không mutate input.
- [ ] Normalize/merge chỉ range cùng màu chồng hoặc tiếp giáp; khoảng trắng không tự gộp.
- [ ] Tách action recolor-selection, delete-selection và delete-cluster; giữ lock/context guards.
- [ ] Highlight không làm dirty answers, tăng pendingVersion hoặc kích hoạt autosave.
- [ ] Test range rỗng/sai/NaN/out-of-bounds/surrogate; overlap hai màu, selection cắt nhiều cluster, reload/archive rỗng.

**Nghiệm thu:** đổi màu chính xác vùng chọn, màu ngoài vùng không đổi; archive cũ đọc được và không chạm answers.

### RD-05 — Gắn annotation vào mọi nội dung đề tĩnh

**Files:**

- Tạo `frontend/src/features/exam/components/content/WorkspaceText.tsx`, `frontend/src/features/exam/hooks/useWorkspaceAnnotations.ts`, `frontend/src/features/exam/__tests__/WorkspaceTextAnnotation.test.tsx`.
- Sửa `pages/WorkspacePage.tsx`, `components/workspace/QuestionCard.tsx`, `ReferencePane.tsx`, `ReadingPartContent.tsx`, `ListeningPartContent.tsx`, `WritingPromptContent.tsx`.
- Sửa `components/renderers/QuestionRenderer.tsx`, `SingleChoiceRenderer.tsx`, `MultipleChoiceRenderer.tsx`, `TFNGRenderer.tsx`, `MatchingRenderer.tsx`, `MatchingInformationRenderer.tsx`, `MapLabelingRenderer.tsx`, `FillInBlankRenderer.tsx`, `EssayRenderer.tsx`.

**Các bước:**

- [ ] Bọc từng static source bằng `WorkspaceText`, truyền typed identity, format mode, sanitized HTML/text và archive ranges.
- [ ] Giữ fallback render hiện có ngoài workspace; không gắn global MutationObserver.
- [ ] Annotate authored prompt/option text; không annotate inputs, user essay, explanation, answer feedback hoặc hidden spoken options.
- [ ] Với Matching native select, render thêm option bank tĩnh có thể chọn cạnh select; giữ native select làm control trả lời.
- [ ] TFNG/YNNG chỉ annotate token choices canonical công khai do question type xác định; không đọc hidden keys.
- [ ] Bắt trailing click ở root capture phase khi gesture là selection đã commit, trước label/radio default activation; click bình thường và keyboard vẫn chọn đáp án.
- [ ] Gắn `lang` theo exam snapshot; sanitizer không thực thi HTML hoặc thay đổi thứ tự media/table.
- [ ] Test cả 3 skills, mọi renderer, option drag không đổi answer, click/keyboard thật vẫn hoạt động, radio label/default action, mobile single interactive render, hidden transcript không lộ.

**Nghiệm thu:** mọi text tĩnh hiển thị trong workspace có thể chọn/highlight/tra theo source; user input và secret không bị annotate.

### RD-06 — Popup chung theo selection và mode

**Files:**

- Tạo `frontend/src/features/exam/components/content/WorkspaceSelectionPopover.tsx`, `frontend/src/features/exam/hooks/useWorkspaceSelectionPopover.ts`, `frontend/src/features/exam/__tests__/WorkspaceSelectionPopover.test.tsx`.
- Sửa `hooks/useTextSelection.ts`, `components/content/SelectionToolbar.tsx`, `pages/WorkspacePage.tsx`, `locales/vi/exam.json`, `locales/en/exam.json` (hoặc resource i18n exam đang dùng sau khi xác minh).

**Các bước:**

- [ ] Sau mouse/trackpad release, commit highlight màu hiện hành và mở một popup gắn với cùng frozen selection snapshot.
- [ ] Touch/pen/keyboard giữ thao tác xác nhận Highlight R1; sau xác nhận mở popup cùng source/range.
- [ ] Popup selection mới thay cũ; click ngoài/Escape/scroll/resize/context/part/attempt đổi/lock/submit đóng an toàn.
- [ ] Pointer trong portal không bị ngoài-click; focus, Escape, accessible names, `aria-pressed` palette và focus return được kiểm tra.
- [ ] Clamp theo kích thước popup đo thực tế và viewport, kể cả mobile/zoom; không dùng height/width ước đoán cố định.
- [ ] Practice hiển thị nút Tra từ; Mock không mount lookup action/hook và không phát request Dictionary/Flashcard.
- [ ] Long selection vẫn tô và mở popup; lookup disable theo giới hạn hiện hữu với thông báo có thể hiểu.
- [ ] Click vào mark cũ mở popup xóa cụm; click ngoài đóng; xóa vùng selection hiện tại không xóa cả cụm ngoài vùng.

**Nghiệm thu:** chỉ một popup đúng selection; popup không dùng stale context và không che vùng điều khiển ở viewport nhỏ.

### RD-07 — Tra từ một bước và giữ Flashcard

**Files:**

- Tạo `frontend/src/features/exam/api/dictionaryLookupV3Contract.ts`, `frontend/src/features/exam/__tests__/dictionaryLookupV3Contract.test.ts`.
- Sửa `api/dictionaryLookupApi.ts`, `hooks/usePracticeDictionary.ts`, `utils/dictionarySelection.ts`, `types/api.types.ts`, `api/attemptApi.ts`, `components/practice/PracticeDictionaryPopover.tsx`, `DictionaryFlashcardForm.tsx`, `api/dictionaryFlashcardApi.ts`.
- Mở rộng tests `usePracticeDictionary.test.tsx`, `PracticeDictionaryPopover.test.tsx`, `DictionaryFlashcardForm.test.tsx`.

**Các bước:**

- [ ] Thêm client/normalizer v3; giữ v1/v2 exports và abort deadline 40 giây.
- [ ] Popup gọi lookup ngay khi bấm Tra từ; bỏ selector ngôn ngữ và bước bấm Tra từ thứ hai.
- [ ] Request chứa selection/source đã đóng băng, không gửi language/user ID; validate response identity/source/policy/schema/language.
- [ ] Hủy hoặc vô hiệu hóa request khi popup đóng, selection/source/part/account/attempt đổi, submit/lock; response trễ không cập nhật UI.
- [ ] Retry chưa xác nhận giữ request ID và frozen target; thao tác lookup mới tạo UUID mới.
- [ ] Giữ giới hạn selectedText hiện có (1–80 code points; tối đa 5 từ cho ngôn ngữ tách bằng space, zh/ja theo code points); không cắt surrogate/context.
- [ ] Dùng kết quả v3 cho Flashcard form; giữ list/tạo deck/lưu theo language pair trong response, duplicate handling và stale-response guard.
- [ ] Test native language null/error, same-language, CJK, 80/81, wrong response identity, retry, timeout, late response, double click, flashcard read-back.

**Nghiệm thu:** một click từ popup tạo đúng request; nghĩa chỉ về ngôn ngữ mẹ đẻ DB; Flashcard hoạt động như hiện tại; Mock không gọi endpoint.

### RD-08 — Review chỉ đọc với nhiều màu

**Files:**

- Sửa `frontend/src/features/exam/pages/ExamReviewPage.tsx`, `components/review/PartReviewContent.tsx`, `components/review/QuestionReviewCard.tsx`.
- Tạo `frontend/src/features/exam/__tests__/WorkspaceAnnotationsReview.test.tsx`.

**Các bước:**

- [ ] Dùng cùng source builder, hash và sanitized text như workspace; render highlight màu đúng source.
- [ ] Review marks read-only, không toolbar/delete listeners/tab stop.
- [ ] Chỉ khôi phục archive khớp owner/attempt/part/source/hash; archive hỏng hoặc mismatch bỏ qua an toàn.
- [ ] Không ghi storage từ review; permission/contract failure xóa context cũ.
- [ ] Giữ verdict, đáp án đúng/đã chọn, explanations và result summary hiện hành.
- [ ] Test review sau submit, màu cũ/v2, mismatch hash, account/attempt switch, missing/corrupt archive, no-write.

**Nghiệm thu:** review hiển thị màu đúng vùng dưới dạng read-only và không làm rò annotation giữa người dùng/lượt thi.

### RD-09 — Lifecycle, PostgreSQL, browser và bàn giao

**Files:**

- Tạo `backend/src/test/java/com/multilingo/backend/modules/testing/controller/WorkspaceDictionaryLifecycleIT.java`.
- Tạo `backend/src/test/java/com/multilingo/backend/modules/testing/repository/WorkspaceDictionaryPostgresIT.java`.
- Tạo `frontend/src/features/exam/__tests__/workspaceDictionaryRedesignContract.test.tsx`.
- Tạo `docs/testing/PRACTICE-AI-DICTIONARY-REDESIGN-R1-smoke.md`.
- Cập nhật plan/handoff này append-only.

**Các bước:**

- [ ] Backend lifecycle dùng service/coordinator/repository thật, provider giả; FE dùng page/hooks/store/normalizers thật, chỉ mock HTTP và browser APIs.
- [ ] Luồng Practice: chọn text option → release → highlight → đổi màu → popup → Tra từ → kết quả → lưu Flashcard → đọc lại deck.
- [ ] Luồng Mock: chọn text → release → highlight/popup màu → không có Tra từ, không có API Dictionary/Flashcard request.
- [ ] Chứng minh chọn option khi không kéo vẫn hoạt động; drag highlight không đổi answer/dirty/pendingVersion/autosave payload.
- [ ] PostgreSQL dùng helper `MultilingualPostgresDatabase` với `TV3_PG_TEST_URL/USER/PASSWORD`, chỉ allowlist DB `tv3_multilingual_test`, UUID schema; không dùng app DB.
- [ ] Test UUID replay khi native language đổi, payload conflict, hai request cùng lúc, quota reserve/refund, crash recovery/late completion.
- [ ] Browser 375/768/1366/1920px: pointer, keyboard, touch nếu môi trường hỗ trợ; kiểm tra popup viewport, focus, passage/câu hỏi/options, màu và audio không bị ảnh hưởng.
- [ ] Chạy focused frontend/backend, PostgreSQL, typecheck/lint/build và `git diff --check`; ghi PASS/FAIL/SKIP riêng.
- [ ] Ghi residual risks, AC mapping, browser/PG evidence và yêu cầu final review toàn feature.

**Nghiệm thu:** end-to-end provider giả và DB thử nghiệm chứng minh policy, storage, quota và không ảnh hưởng answers; browser evidence tách khỏi automated evidence.

## Tiêu chí nghiệm thu

| AC | Điều kiện bắt buộc |
|---|---|
| AC-01 | Selection trên mọi nội dung đề tĩnh ở Listening/Reading/Writing và mọi question/option source được nhận diện ổn định; mỗi selection chỉ trong một source. |
| AC-02 | Thả chuột/trackpad tự highlight và mở popup; touch/pen/keyboard giữ luồng xác nhận R1; popup ngoài-click/new selection/part/attempt/lock đóng đúng. |
| AC-03 | Popup Practice có Tra từ một bước và Flashcard; Mock chỉ highlight/xóa, không gọi Dictionary/Flashcard API. |
| AC-04 | Dictionary v3 dùng source từ snapshot và target đúng native language DB; không selector/fallback; sai/missing native chặn trước quota/provider. |
| AC-05 | API v1/v2, fingerprint, replay, quota/lease/refund cũ không đổi; v3 replay giữ language/source đã đóng băng. |
| AC-06 | Năm màu accessible; đổi màu phủ chính xác range, giữ phần ngoài và merge theo màu; archive v1 được đọc thành yellow và v2 lưu màu. |
| AC-07 | Drag trên label/radio/select không đổi đáp án; click/keyboard answer bình thường vẫn hoạt động; không dirty/autosave do annotation. |
| AC-08 | Sanitizer, secret filtering, owner/attempt/part/hash scoping và UTF-16/surrogate validation giữ an toàn. |
| AC-09 | Review phục hồi highlight màu đúng và read-only; hỏng/mismatch được bỏ qua, không ghi storage. |
| AC-10 | Regression autosave/resume/submit/locks, R1 auto highlight, Practice retry, Hints, audio và Flashcard đều đạt. |

### Ma trận kiểm thử tối thiểu

| TC | Kịch bản | Kết quả |
|---|---|---|
| TC-01 | Chọn câu trong passage, câu hỏi và option ở từng skill | Range đúng source; hash/offset ổn định |
| TC-02 | Kéo trên radio/label rồi thả | Tô đúng đoạn; radio/answer không đổi |
| TC-03 | Click radio hoặc dùng keyboard bình thường | Answer thay đổi đúng như trước |
| TC-04 | Popup click ngoài, pointer bên trong portal, Escape, source mới | Đóng/mở đúng; không giữ snapshot stale |
| TC-05 | Practice một click Tra từ; Mock gọi API giả | Practice đúng native language; Mock zero Dictionary/Flashcard calls |
| TC-06 | Native profile null/invalid/đổi giữa retry | Lookup mới bị chặn khi thiếu; retry UUID cũ giữ target cũ |
| TC-07 | Selection 1/80/81 code points, zh/ja, emoji/surrogate | Boundary đúng, không cắt cặp surrogate |
| TC-08 | Đổi màu cắt qua một hoặc nhiều highlight | Chỉ vùng chọn đổi; range ngoài được giữ/tách đúng |
| TC-09 | Đọc archive v1, v2 thiếu, v2 rỗng, sai schema/hash | V1→yellow; v2 có ưu tiên; lỗi bị bỏ qua an toàn |
| TC-10 | User/attempt/source khác hoặc section locked | Không khôi phục/gọi API; state cũ bị đóng |
| TC-11 | Answer save/submit song song với annotation | Request/payload/version answers không đổi |
| TC-12 | Replay/conflict/concurrency/refund trên PostgreSQL | Một reservation hợp lệ; fencing/refund đúng một lần |

## Lệnh verification dự kiến

Frontend focused (các file mới và regression hiện có):

```powershell
npx vitest run src/features/exam/__tests__/WorkspaceTextAnnotation.test.tsx src/features/exam/__tests__/WorkspaceSelectionPopover.test.tsx src/features/exam/__tests__/dictionaryLookupV3Contract.test.ts src/features/exam/__tests__/workspaceDictionaryRedesignContract.test.tsx src/features/exam/__tests__/highlightColorRanges.test.ts src/features/exam/__tests__/AutoHighlightWorkspace.test.tsx src/features/exam/__tests__/PracticeDictionaryPopover.test.tsx src/features/exam/__tests__/usePracticeDictionary.test.tsx src/features/exam/__tests__/DictionaryFlashcardForm.test.tsx src/features/exam/__tests__/answerSlice.test.ts src/features/exam/__tests__/ReadingHighlightsReview.test.tsx --maxWorkers=2
npx tsc -b --pretty false
npm run lint
npm run build
```

Backend focused (bổ sung suite v3, resolver, reader và regression v1/v2/quota/snapshot):

```powershell
.\mvnw.cmd '-Dtest=WorkspaceTextSourceReaderTest,DictionaryNativeLanguageResolverTest,DictionaryLookupV3RequestValidatorTest,PracticeDictionaryV3ContractIT,DictionaryLookupTransactionCoordinatorTest,DictionaryLookupContextReaderTest,AttemptLanguageResolverTest,UserQuotaReservationServiceTest,WorkspaceDictionaryLifecycleIT,WorkspaceDictionaryPostgresIT,DbExamAdapterSnapshotTest,SubmitAttemptImmutableKeysTest' test
```

PostgreSQL riêng:

```powershell
.\mvnw.cmd '-Dtest=WorkspaceDictionaryPostgresIT' test
```

Skip vì thiếu DB không phải PASS. Nếu chạy broad backend, dùng `-Dtest=*,!GenerateTemplateTest`; không gọi đây là full suite nguyên bản. Không chạy test ghi workbook. Tại root chạy `git diff --check`, `git status --short`.

## Handoff/rollout

Khởi tạo tại `PRACTICE-AI-DICTIONARY-REDESIGN-R1-handoff.md` với RD-01…RD-09 là `PLANNED`, append-only.

Rollout: backend source/native/v3 contract trước → frontend source wrappers và archive v2 → popup/Flashcard → provider-fake/PG/browser gates → staging. Giữ v1/v2 API và archive v1 để rollback. Không bật nếu chưa xác minh profile native, quyền/ownership, quota fencing và Mock zero-call.

Definition of Done: AC-01–10 có evidence; provider giả không bị gọi là xác nhận chất lượng dịch AI; PostgreSQL/browser được báo riêng; reviewer nghiệm thu toàn feature; không đổi lịch sử attempt; không commit/push.

## 2026-10-28 — RD-09 execution / rollout evidence (append-only)

- RD-09 **IMPLEMENTED, chờ review**; đã tạo backend lifecycle/PostgreSQL tests, frontend workspace contract và `docs/testing/PRACTICE-AI-DICTIONARY-REDESIGN-R1-smoke.md`. Không đổi production hoặc các checklist/history phía trên.
- Backend focused **108 PASS**; sau Flashcard readback **7 PASS**; PostgreSQL riêng sau assertion concurrency cuối **4 PASS**, không skip. Frontend **14 files/233 PASS**, contract sau import cleanup **2 PASS**; tsc/lint/build và diff checks PASS. Không cộng các lần chạy chồng lặp.
- Browser HTTP fixture: 8 tổ hợp viewport 375/768/1366/1920 × Practice/Mock PASS, source passage/question/options, màu, answer click và synthetic Listening audio PASS. Keyboard confirm/focus/Tab/Escape PASS với Range tạo sẵn. Native keyboard selection/touch/pen/zoom/IME SKIP. Đây không phải browser-to-DB E2E hoặc provider thật verification.
- DB thử nghiệm allowlist `tv3_multilingual_test`, UUID schema; cleanup còn 0 schema test. Browser/Vite task-owned đã đóng, container test trở lại exited. Không application DB/seed/stage/commit/push/rebase.
- AC mapping, commands, harness failures và residual risks đã ghi trong smoke và handoff. **Gate còn lại:** reviewer nghiệm thu RD-09 và toàn feature; chưa kết luận feature PASS, chưa rollout/staging.

- Final RD-09 rerun: contract 2/2 PASS sau assertion Mock zero GET deck; browser 4 viewport Mock đều lookup/card/deck GET bằng 0, typecheck exit 0. Evidence và cleanup đã cập nhật trong smoke/handoff.
