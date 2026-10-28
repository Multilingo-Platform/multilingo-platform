# RD-09 — Regression và browser smoke

Ngày chạy: 2026-10-28. Executor: Codex. Baseline: `4f968b6`, branch `feature/UC08.1-highlight-auto-r1`, workspace đã có thay đổi RD-01…08. Chỉ thêm regression và evidence RD-09; không đổi production, không stage/commit/push. Trạng thái: **IMPLEMENTED, chờ review**, chưa nghiệm thu toàn feature.

## Phạm vi kiểm chứng

- Backend: service/coordinator/repositories thật, Gemini/media giả qua `MultilingualIntegrationSupport`. Các fixture chỉ chứa nội dung tổng hợp. Không đánh giá chất lượng dịch của provider thật.
- PostgreSQL 16: container thử nghiệm `tv3-multilingual-test-20261021`, DB allowlist `tv3_multilingual_test`, helper `MultilingualPostgresDatabase`, schema UUID. Không dùng application DB. Credentials lấy từ môi trường, không ghi vào tài liệu.
- Frontend: `WorkspacePage`, hooks, Redux store, normalizers và form thật; mock HTTP và geometry của JSDOM. Browser dùng Chrome headless/Playwright với HTTP fixture, chặn origin ngoài localhost; không có backend app, provider hay CDN thật.

## Automated gates

| Gate | Kết quả thực chạy |
|---|---|
| Backend focused, 12 classes theo plan | **PASS: 108 tests**, không fail/error/skip |
| Lifecycle + PostgreSQL sau khi thêm save/readback Flashcard | **PASS: 7 tests**, không fail/error/skip |
| PostgreSQL riêng, bao gồm concurrency assertion cuối | **PASS: 4 tests**, không fail/error/skip |
| Frontend focused | **PASS: 14 files / 233 tests** |
| File contract RD-09 sau dọn imports và thêm Mock zero-GET-deck assertion | **PASS: 1 file / 2 tests** |
| `npx tsc -b --pretty false` | **PASS**, exit 0 |
| `npm run lint` | **PASS**, exit 0; còn warnings trong workspace hiện hữu |
| `npm run build` | **PASS** (`tsc -b && vite build`); còn cảnh báo chunk >500 kB |
| `git diff --check`, cached check và kiểm tra whitespace các file RD-09 mới | **PASS**; staged rỗng |

Các số test chồng lặp giữa các lần chạy, không cộng thành tổng duy nhất. Run backend 108 diễn ra trước khi bổ sung Flashcard readback; run 7 và run PostgreSQL 4 xác minh phần bổ sung. Frontend 233 trước khi bỏ unused imports; run 2 xác minh lại file đó.

Backend, chạy từ `backend` với `TV3_PG_TEST_URL/USER/PASSWORD` trỏ đúng DB thử nghiệm:

```powershell
.\mvnw.cmd '-Dtest=WorkspaceTextSourceReaderTest,DictionaryNativeLanguageResolverTest,DictionaryLookupV3RequestValidatorTest,PracticeDictionaryV3ContractIT,DictionaryLookupTransactionCoordinatorTest,DictionaryLookupContextReaderTest,AttemptLanguageResolverTest,UserQuotaReservationServiceTest,WorkspaceDictionaryLifecycleIT,WorkspaceDictionaryPostgresIT,DbExamAdapterSnapshotTest,SubmitAttemptImmutableKeysTest' test
.\mvnw.cmd '-Dtest=WorkspaceDictionaryLifecycleIT,WorkspaceDictionaryPostgresIT' test
.\mvnw.cmd '-Dtest=WorkspaceDictionaryPostgresIT' test
```

Frontend, chạy từ `frontend`:

```powershell
npx vitest run src/features/exam/__tests__/WorkspaceTextAnnotation.test.tsx src/features/exam/__tests__/WorkspaceSelectionPopover.test.tsx src/features/exam/__tests__/dictionaryLookupV3Contract.test.ts src/features/exam/__tests__/workspaceDictionaryRedesignContract.test.tsx src/features/exam/utils/__tests__/highlightColorRanges.test.ts src/features/exam/__tests__/AutoHighlightWorkspace.test.tsx src/features/exam/__tests__/PracticeDictionaryPopover.test.tsx src/features/exam/__tests__/usePracticeDictionary.test.tsx src/features/exam/__tests__/DictionaryFlashcardForm.test.tsx src/features/exam/__tests__/answerSlice.test.ts src/features/exam/__tests__/ReadingHighlightsReview.test.tsx src/features/exam/__tests__/WorkspaceAnnotationsReview.test.tsx src/features/exam/__tests__/WorkspacePage.test.tsx src/features/exam/__tests__/WorkspaceWritingHints.test.tsx --maxWorkers=2
npx vitest run src/features/exam/__tests__/workspaceDictionaryRedesignContract.test.tsx --maxWorkers=2
npx tsc -b --pretty false
npm run lint
npm run build
```

`highlightColorRanges.test.ts` nằm trong `utils/__tests__`, đã dùng đường dẫn thực tế thay đường dẫn dự kiến trong plan. Không chạy full suites hoặc `GenerateTemplateTest`/test ghi workbook; scope người dùng yêu cầu focused tests.

Backend mới kiểm tra replay UUID giữ native vi sau profile đổi fr, UUID mới dùng fr, payload conflict, Mock/blank-native bị chặn trước provider, attempt version/timestamp/answers không đổi sau lookup, autosave/submit thật và reject lookup sau submit. Deck/card được tạo rồi đọc lại bằng service/repository thật. Lease expiry recovery/refund chỉ một lần, late completion bị fence. Hai thread cùng UUID chỉ có một reservation, thread còn lại nhận `DICTIONARY_LOOKUP_IN_PROGRESS`; quota tăng một và refund đúng một lần.

Frontend mới kiểm tra drag option → mark → recolor → lookup một click → save success; identity option đúng, không ghi answers/đổi dirty/pendingVersion/version khi annotation. Mock không mount lookup/không POST; click radio B bình thường vẫn cập nhật answer.

## Browser gates

Chrome headless trên Windows, height 900 px, fixture Reading và Listening. Lệnh điều khiển: `npx --no-install --package @playwright/cli playwright-cli -s=rd09 run-code --filename <fixture-script>`. Không cài dependency mới. Evidence local (ignored): `output/playwright/rd09/evidence.json`, `PRACTICE-{375,768,1366,1920}.png`, `MOCK_TEST-{375,768,1366,1920}.png`.

| Kịch bản | Kết quả |
|---|---|
| Mouse drag option, recolor green, bounds popup tại 375/768/1366/1920, cả Practice và Mock | **PASS**, 8 tổ hợp; screenshot 375 được xem trực tiếp |
| Practice click Tra từ → native vi result → save Flashcard | **PASS**, mỗi viewport đúng 1 lookup và 1 card HTTP fixture |
| Mock highlight/palette | **PASS**, mỗi viewport 0 lookup, 0 save card và 0 GET deck; rerun browser đã ghi riêng `deckRequests` |
| Drag không chọn radio/không autosave; Escape và click radio B bình thường | **PASS** cả 8 tổ hợp |
| Passage `PART_CONTENT` và prompt `QUESTION_TEXT`, mouse drag/recolor pink | **PASS** tại 1366 px |
| Keyboard xác nhận Highlight, focus vào palette, Tab trong palette, Escape đóng | **PASS với native Range tạo sẵn**; Enter/Tab/Escape dùng keyboard thật |
| Listening question annotation khi audio đang phát | **PASS** với WAV tổng hợp 5 giây: vẫn playing, currentTime tiến, media error null |
| Chọn static text hoàn toàn bằng Shift+Arrow | **SKIP**: headless không có static-text caret; không suy từ Range tạo sẵn thành native keyboard-selection PASS |
| Native touch/pen, OS IME và browser zoom thực | **SKIP**, chưa kiểm chứng trong môi trường này; automated pointer/viewport tests không thay thế thiết bị thật |

Browser save là HTTP fixture trong bộ nhớ; bằng chứng lưu/đọc lại PostgreSQL là backend lifecycle riêng, không phải một browser-to-DB E2E. Browser không cover mọi renderer/mọi skill; phần đó dựa trên automated source tests và evidence RD-05/RD-08.

Để tái kiểm thủ công trên môi trường thử nghiệm: mở Practice ở từng viewport, kéo option rồi đổi màu, kiểm radio/answer giữ nguyên, click Tra từ một lần và lưu thẻ; mở deck kiểm nội dung. Lặp lại Mock, kiểm không có action/request Dictionary/Flashcard. Kiểm passage/prompt, keyboard Highlight/Tab/Escape và Listening đang phát. Native touch/pen/zoom cần chạy bổ sung trên môi trường phù hợp.

## AC mapping và giới hạn

| AC | Evidence |
|---|---|
| 01 | WorkspaceTextAnnotation + source reader; browser option/passage/question; RD-05 evidence cho toàn renderer |
| 02 | AutoHighlightWorkspace/WorkspaceSelectionPopover; browser mouse, seeded keyboard confirm/focus; native keyboard/touch còn SKIP |
| 03 | Contract RD-09 + browser 8 tổ hợp; Practice lookup/card và Mock zero-call |
| 04 | Native resolver/v3 contract + real-PG profile change/missing native |
| 05 | Coordinator/context/quota regression + real-PG replay/conflict/concurrency/recovery/fencing |
| 06 | highlightColorRanges + review/archive suites; browser green/pink và palette 5 màu |
| 07 | AnswerSlice + RD-09 Redux invariants + browser drag/click/autosave boundary |
| 08 | WorkspaceTextSourceReader/validator + snapshot/immutable keys suites; RD-08 archive scope evidence |
| 09 | ReadingHighlightsReview + WorkspaceAnnotationsReview, bao gồm Matching Information fix RD08-R01 |
| 10 | WorkspacePage/WorkspaceWritingHints/dictionary retry/Flashcard + real submit và synthetic browser audio |

Đã có các lần **FAIL do harness**: H2 không hỗ trợ quota SQL PostgreSQL và native null vi phạm NOT NULL; fixture gọi UUID mới trong cooldown; selector browser dùng visible cho native option/thiếu tiền tố nút; audio fixture dùng string thay object url. Đã sửa fixture/test setup và chạy lại các gate liên quan. Không gọi các lỗi harness này là product RED; không sửa production trong RD-09.

Residual: chưa có provider thật, CDN thật, native touch/pen/zoom/IME, browser nối backend thật hoặc full-suite evidence. JSDOM media warnings không được dùng làm evidence playback. Không có defect sản phẩm mới được xác nhận trong scope đã chạy. Reviewer cần xem toàn feature theo AC-01…10 trước khi kết luận PASS/rollout; tài liệu này chỉ là evidence thực thi RD-09.

Cleanup: truy vấn `information_schema.schemata` trên DB thử nghiệm sau run cuối trả **0** schema `tv3_ml_*`. Đã đóng session browser `rd09`, xóa storage/cookies của fixture, dừng Vite PID do task tạo và trả container test về `exited` như ban đầu. Giữ Docker engine và các service khác nguyên trạng. Không seed hoặc sửa application DB.
