# TV3-14 — Review UI và Part động

> Dành cho executor: triển khai tuần tự từng task theo RED → GREEN. Đọc plan và handoff trước khi sửa; không commit hoặc push.

**Goal:** Trang review tải danh sách Part từ backend và chỉ tải lời giải của Part được chọn; dữ liệu lịch sử phải khớp snapshot của lần thi, không lộ đáp án khi bài còn đang diễn ra.

**Architecture:** Result API cung cấp metadata điều hướng Part đã được kiểm soát; review API TV3-13 trả dữ liệu của đúng Part. URL query là nguồn lựa chọn Part; hook tải review giữ state theo attempt và Part, không lưu cache hoặc dữ liệu bài làm vào Redux/localStorage.

**Tech stack:** React, TypeScript, Redux Toolkit hiện có, Axios, Vitest, React Testing Library, Tailwind, Lucide; dùng sanitizer và component HTML hiện có.

**Spec:** Yêu cầu TV3-14 trong hội thoại; contract đã duyệt của TV3-13. Trước khi triển khai, đọc docs/superpowers/plans/ndt/TV3-13-plan.md, TV3-13-handoff.md và implementation/handoff mới nhất. Nếu contract thực tế khác plan, cập nhật handoff để xin quyết định; không tự tạo fallback làm thay đổi security boundary.

## Global constraints

- Chỉ thay đổi frontend và tài liệu TV3-14; không sửa backend contract/schema trong task này.
- Giữ nguyên TV3-13 ownership, submitted-only access và snapshot bất biến; không thêm đáp án/lời giải vào workspace/start API.
- Result API là nguồn danh sách Part; review API chỉ được gọi cho Part đang chọn.
- Không đọc đáp án từ Redux, workspace state, local draft hoặc submit response; không tự chấm lại.
- Không gọi exam/structure/workspace API để tái dựng nội dung câu hỏi.
- Không polling, tự retry, cache bền vững, hoặc ghi review payload vào Redux/localStorage.
- Giữ review route/API hiện có và query partId; xác minh URL/API chính xác bằng code trước khi sửa.
- Không log token, câu trả lời, essay, đáp án đúng hoặc explanation.
- Giữ nguyên thay đổi người dùng trong working tree; không commit/push.

## Review focus

1. Direct URL với attempt/Part sai định dạng không được gọi review API hoặc làm lộ dữ liệu.
2. Chuyển Part nhanh A → B → A không để response cũ ghi đè Part hiện hành.
3. questionId là string và chỉ duy nhất trong Part; cùng ID ở hai Part không được nhập nhằng.
4. Null answer/score và ESSAY đang chờ chấm phải giữ nguyên ý nghĩa, không bị biến thành đáp án sai hoặc điểm 0.
5. Prompt, context, options và explanation chứa HTML-like text phải được render an toàn; media không autoplay.

## Contract frontend

Giữ review API của TV3-13. Frontend chuẩn hóa response runtime trước khi render. Contract TV3-13 được mô tả bằng camelCase: attemptId, partId, questions, questionGroups, partStats, examData; câu hỏi có questionId dạng string, prompt/options/context, user answer, verdict, nullable correct answer/explanation và grading metadata nếu có. Verdict chuẩn frontend là CORRECT | WRONG | BLANK | PENDING, ánh xạ chỉ theo enum được TV3-13 chốt. Không tự suy ra verdict từ answer.

Result response cung cấp metadata điều hướng reviewParts (ID và label, cùng metadata được contract backend duyệt). Nếu field vắng mặt trên response legacy thì chuẩn hóa thành danh sách rỗng; nếu field hiện diện nhưng sai shape/ID trùng thì contract error. Không suy ra Part từ số thứ tự cố định hay exam template hiện tại.

Trạng thái Writing nối với result summary bằng khóa (partId, questionId). Điểm null tiếp tục hiển thị là chưa có dữ liệu; PENDING/QUEUED/FAILED/UNAVAILABLE không bị diễn giải thành verdict khách quan.

## Acceptance criteria

- **AC-01 — Part động:** danh sách Part và label đến từ result backend, giữ thứ tự backend; không hard-code Part ID.
- **AC-02 — Scope API:** mỗi lần tải review chỉ gửi attempt ID và Part ID đang chọn; payload chỉ chứa Part đó.
- **AC-03 — URL:** query partId phản ánh lựa chọn; direct URL, reload, back/forward hoạt động; query thiếu chọn Part đầu tiên hợp lệ; query sai không gọi review API.
- **AC-04 — Contract/data:** questionId giữ kiểu string; groups, context, options, user answer, verdict, correct answer, explanation và null được hiển thị theo response đã validate, không grading phía client.
- **AC-05 — Writing:** pending/failed và score null hiển thị chính xác từ backend; không tạo điểm hoặc đáp án giả.
- **AC-06 — Race/error:** state scoped theo attempt+Part; response stale/abort không sửa context mới; lỗi mạng khi refresh cùng Part giữ dữ liệu hợp lệ kèm cảnh báo, còn 4xx/contract error xóa dữ liệu không còn được phép hiển thị.
- **AC-07 — Security:** không gọi workspace/exam/structure API, không chạm local draft/Redux answers, không render HTML không sanitize, không tự động phát media.
- **AC-08 — UX/accessibility:** loading, empty, error và retry thủ công có ngữ nghĩa accessible; Part navigation dùng link/button phù hợp, focus nhìn thấy và hoạt động bàn phím.
- **AC-09 — Regression:** integration tests đi qua page, hooks, normalizer và API thật; frontend tests, lint/build đạt, không thêm warning mới.

## Subtasks

Phụ thuộc tuần tự: 14-01 → 14-02 → 14-03 → 14-04 → 14-05 → 14-06. Mỗi task có test/review gate riêng.

### TV3-14-01 — Danh sách Part từ result contract

**Files**

- Sửa: frontend/src/features/exam/types/api.types.ts
- Sửa: frontend/src/features/exam/api/resultContract.ts
- Sửa: frontend/src/features/exam/__tests__/resultContract.test.ts
- Tạo: frontend/src/features/exam/__tests__/fixtures/attemptResult.ts
- Đối chiếu, không sửa nếu không cần: backend result DTO/mapper/service liên quan TV3-13.

**Steps**

- [ ] Đọc implementation và handoff TV3-13; ghi lại field wire thật, nullable rules, nguồn và thứ tự Part.
- [ ] Thêm fixture cho result nhiều Part, Writing-only, summary unavailable, reviewParts vắng mặt và field hiện diện sai.
- [ ] Viết test: ID Part dương hợp lệ, label string, thứ tự backend được giữ, ID trùng hoặc ID/label sai kiểu tạo contract error.
- [ ] Chạy test normalizer để xác nhận test mới fail trước implementation.
- [ ] Bổ sung projection reviewParts vào normalized result; absent tương thích thành danh sách rỗng, malformed-present bị từ chối.
- [ ] Không đọc legacy answer/explanation fields; không suy ra Part từ exam hiện hành hoặc resultSummary.byPart.
- [ ] Chạy lại result contract tests và kiểm tra input không bị mutate.

**Test:** chạy tại frontend: npm test -- src/features/exam/__tests__/resultContract.test.ts

**Acceptance:** AC-01, AC-04, AC-07.

### TV3-14-02 — Review DTO/API normalizer và request có giới hạn

**Files**

- Sửa: frontend/src/features/exam/types/api.types.ts
- Sửa: frontend/src/features/exam/api/attemptApi.ts
- Tạo: frontend/src/features/exam/api/reviewContract.ts
- Tạo: frontend/src/features/exam/__tests__/reviewContract.test.ts
- Sửa: frontend/src/features/exam/__tests__/attemptApi.test.ts
- Tạo: frontend/src/features/exam/__tests__/fixtures/attemptReview.ts

**Interfaces dự kiến** (điều chỉnh theo contract đã merge của TV3-13):

- normalizeAttemptReview(data: unknown, expectedAttemptId: number, expectedPartId: number): ExamReviewResponse
- getAttemptReview(attemptId: number, partId: number, options?: { signal?: AbortSignal }): Promise<ExamReviewResponse>

**Steps**

- [ ] Đối chiếu URL, envelope, enum verdict, grouping và answer-value union trong API/DTO TV3-13; không đoán camelCase/wire mapping.
- [ ] Viết contract tests cho attempt/part mismatch, question ID dạng string, cùng question ID khác Part, duplicate trong một Part, malformed group, null/empty values, unknown verdict và question ngoài scope.
- [ ] Viết API tests cho đúng method/path/query, invalid IDs không tạo request, envelope lỗi và truyền AbortSignal.
- [ ] Chạy tests để xác nhận RED.
- [ ] Implement normalizer allowlist; yêu cầu response attempt/part đúng request và mọi question thuộc đúng Part.
- [ ] Giữ nguyên answer-value union theo contract; không ép object thành chuỗi, trim nội dung hoặc loại null/empty.
- [ ] Dùng bounded request deadline 10.000 ms đã có từ TV3-12/attemptApi; không sửa shared Axios interceptor.
- [ ] Chạy review contract, result contract và attempt API tests.

**Tests:** chạy tại frontend: npm test -- src/features/exam/__tests__/reviewContract.test.ts src/features/exam/__tests__/resultContract.test.ts src/features/exam/__tests__/attemptApi.test.ts

**Acceptance:** AC-02, AC-04, AC-06, AC-07.

### TV3-14-03 — Hook tải review scoped theo attempt và Part

**Files**

- Tạo: frontend/src/features/exam/hooks/useExamReview.ts
- Tạo: frontend/src/features/exam/__tests__/useExamReview.test.tsx

**Interface dự kiến**

- useExamReview(attemptId: number | null, partId: number | null) trả data, loading, refreshing, error, refreshError và reload().
- Phân biệt invalid-selection, not-authorized, not-submitted, not-found, contract và request; map theo status/code thật của backend.

**Steps**

- [ ] Viết tests initial load, invalid selection, manual reload, double click và API reject.
- [ ] Dùng deferred promises kiểm tra A → B → A, đổi attempt cùng Part ID, unmount/remount và StrictMode cleanup.
- [ ] Kiểm tra abort, timeout, late resolve/reject/finally không thay state/context mới.
- [ ] Chạy tests xác nhận RED.
- [ ] Đặt request identity/generation trước await; request mới abort request cũ và chỉ completion đúng identity được commit.
- [ ] Không render dữ liệu Part cũ khi props đã đổi, kể cả trước effect cleanup.
- [ ] Refresh cùng selection: lỗi mạng/timeout giữ dữ liệu đã validate kèm warning; permission/not-submitted/not-found/contract error xóa dữ liệu.
- [ ] Chỉ retry qua thao tác người dùng; không interval, focus listener, cache hoặc local storage.
- [ ] Chạy hook tests và API tests.

**Tests:** chạy tại frontend: npm test -- src/features/exam/__tests__/useExamReview.test.tsx src/features/exam/__tests__/attemptApi.test.ts

**Acceptance:** AC-06, AC-07.

### TV3-14-04 — Trình bày câu hỏi, verdict, answer và explanation

**Files**

- Đối chiếu/sửa có phạm vi: frontend/src/features/exam/components/review/QuestionReviewCard.tsx
- Đối chiếu/sửa có phạm vi: frontend/src/features/exam/components/review/PartReviewContent.tsx
- Đối chiếu/sửa có phạm vi: frontend/src/features/exam/components/review/QuestionPalette.tsx
- Đối chiếu/sửa có phạm vi: frontend/src/features/exam/components/review/ExplanationBox.tsx
- Tạo hoặc sửa theo cấu trúc thật: frontend/src/features/exam/utils/reviewPresentation.ts
- Tạo/sửa tests cạnh component/utilities tương ứng dưới frontend/src/features/exam/__tests__/

**Steps**

- [ ] Kiểm tra components hiện có và xác định trách nhiệm có thể tái dùng; không tạo component trùng.
- [ ] Viết tests cho mọi verdict, chưa trả lời, pending essay, null score, Unicode, multiline answer, groups, context và options.
- [ ] Viết tests cho filter tất cả/sai/chưa trả lời và mapping palette theo question ID string trong Part hiện tại.
- [ ] Xác nhận tests đỏ trước khi đổi render.
- [ ] Render prompt/context/options theo group và thứ tự backend; không dùng label làm key.
- [ ] Hiển thị user answer, verdict, correct answer và explanation chỉ từ response đã normalize; dữ liệu thiếu có nhãn chưa có dữ liệu, không bịa.
- [ ] Nối trạng thái Writing bằng tuple (partId, questionId); null score không thành 0; pending/failed dùng nhãn backend.
- [ ] Dùng HtmlContent/sanitizer hiện có cho rich text; answer/essay luôn render text. Không dùng dangerouslySetInnerHTML trực tiếp.
- [ ] Media không autoplay; dừng/unmount media khi đổi Part.
- [ ] Đảm bảo list/table có label accessible và focus rõ; chạy component tests.

**Tests:** npm test -- src/features/exam/__tests__/QuestionReviewCard.test.tsx src/features/exam/__tests__/PartReviewContent.test.tsx src/features/exam/__tests__/QuestionPalette.test.tsx src/features/exam/__tests__/reviewPresentation.test.ts

**Acceptance:** AC-04, AC-05, AC-07, AC-08.

### TV3-14-05 — Trang review Part động, URL và CTA từ result

**Files**

- Sửa: frontend/src/features/exam/pages/ExamReviewPage.tsx
- Sửa: frontend/src/features/exam/pages/ExamResultPage.tsx
- Tạo/sửa: frontend/src/features/exam/pages/__tests__/ExamReviewPage.test.tsx
- Tạo/sửa: frontend/src/features/exam/pages/__tests__/ExamResultPage.test.tsx

**Steps**

- [ ] Đọc route declaration và trang review; xác minh format path/query, luồng back/history và data source của result page.
- [ ] Viết page tests: direct URL, nhiều Part động, query thiếu/sai/không thuộc attempt, reload, browser back/forward và loading/error/empty.
- [ ] Viết result-page test cho CTA chỉ xuất hiện khi có reviewParts và tạo link tới Part đầu tiên hợp lệ.
- [ ] Chạy tests để xác nhận RED.
- [ ] Dùng reviewParts từ result hook làm navigation; URL query partId là nguồn selection, absent chọn Part backend đầu tiên.
- [ ] Query sai hoặc Part không thuộc reviewParts: không gọi review API; hiển thị lỗi lựa chọn và link về Part hợp lệ.
- [ ] Khi chọn Part, cập nhật query bằng router API phù hợp để back/forward đổi selection; không full-page reload.
- [ ] Hiển thị attempt metadata từ result API và câu hỏi từ review API; không gọi workspace/exam/structure API.
- [ ] Thêm CTA “Xem bài làm và lời giải” trên result page khi reviewParts không rỗng; URL dùng attempt ID và Part đầu tiên backend cung cấp.
- [ ] Giữ navigation hiện có; không thêm CTA/link không có đích hợp lệ.
- [ ] Loading dùng role=status/aria-live; lỗi dùng role=alert; retry là button truy cập được bằng keyboard.
- [ ] Chạy page tests và kiểm tra direct route.

**Tests:** npm test -- src/features/exam/pages/__tests__/ExamReviewPage.test.tsx src/features/exam/pages/__tests__/ExamResultPage.test.tsx

**Acceptance:** AC-01–03, AC-06–08.

### TV3-14-06 — Integration regression, responsive QA và handoff

**Files**

- Tạo: frontend/src/features/exam/__tests__/reviewPageContract.test.tsx
- Sửa khi fixture bị ảnh hưởng: các test TV3-12 result contract/page liên quan.
- Cập nhật append-only: docs/superpowers/plans/ndt/TV3-14-plan.md
- Cập nhật append-only: docs/superpowers/plans/ndt/TV3-14-handoff.md

**Steps**

- [x] Tạo integration test dùng ExamReviewPage, useExamReview, normalizer và getAttemptReview thật; chỉ mock HTTP/router/browser boundary.
- [x] Kiểm chứng result route → dynamic review link → GET đúng Part → render prompt, user answer, verdict, correct answer và explanation.
- [x] Đổi Part rồi back/forward; xác nhận mỗi request chỉ lấy Part query hiện tại, không gọi API cho Part khác.
- [x] Tạo race test Part A → B → A và permission error; xác nhận stale response không xuất hiện và dữ liệu bị xóa khi quyền bị từ chối.
- [x] Xác nhận không gọi workspace/exam/structure API, không PUT/POST, không đọc/xóa draft hoặc Redux answers.
- [x] Chạy focused tests của 14-01 đến 14-06; sau đó full frontend suite, lint, build và git diff --check.
- [x] So sánh lint warnings với baseline; phân biệt warning có sẵn.
- [x] Kiểm tra UI tại 375/768/1280 px, keyboard-only, nhãn tiếng Việt dài và media không autoplay bằng browser với HTTP mock; không tạo attempt thật.
- [x] Append files, RED/GREEN evidence, test output, AC mapping, residual risks và yêu cầu final review vào handoff.

**Focused tests:** npm test -- src/features/exam/__tests__/reviewContract.test.ts src/features/exam/__tests__/useExamReview.test.tsx src/features/exam/__tests__/reviewPresentation.test.ts src/features/exam/pages/__tests__/ExamReviewPage.test.tsx src/features/exam/pages/__tests__/ExamResultPage.test.tsx src/features/exam/__tests__/reviewPageContract.test.tsx

**Final verification:** tại frontend chạy npm test, npm run lint, npm run build; tại repo root chạy git diff --check và git status --short.

**Acceptance:** AC-01–09; integration evidence đi qua luồng frontend thật, không chỉ mock hook.

## Test matrix

| TC | Loại | Kịch bản | Kết quả mong đợi | Task |
|---|---|---|---|---|
| 14-01 | Happy path | Result có nhiều Part | Hiển thị đúng label/order từ backend | 01, 05 |
| 14-02 | Happy path | Mở review trực tiếp với attempt/Part hợp lệ | Chỉ GET Part yêu cầu | 02, 03, 05 |
| 14-03 | Boundary | Query thiếu, sai định dạng, Part lạ | Thiếu thì chọn Part đầu; sai thì không gọi review GET | 05 |
| 14-04 | Integrity | Wrong attempt/part trong response | Contract error, không render payload | 02, 03 |
| 14-05 | Integrity | IDs là string, trùng giữa Part nhưng không trong Part | Định danh chính xác theo Part | 02, 04 |
| 14-06 | Edge | Null/empty answer hoặc explanation | Giữ null/empty; không tự điền hoặc chấm | 02, 04 |
| 14-07 | Edge | ESSAY pending/failed, score null | Hiển thị trạng thái; không tạo điểm 0 | 04 |
| 14-08 | Race | A → B → A, StrictMode và late reject | Chỉ context mới cập nhật UI | 03, 06 |
| 14-09 | Security | Unauthorized/forbidden/not submitted | Không hiển thị dữ liệu cũ hoặc lời giải | 03, 05, 06 |
| 14-10 | Security | HTML/script-like text trong prompt/explanation | Hiển thị an toàn, không thực thi | 04 |
| 14-11 | Boundary | Request quá 10 giây hoặc abort | Dừng chờ; không áp dụng response stale | 02, 03 |
| 14-12 | Integration | Result CTA sang review | URL dùng attempt và Part backend đầu tiên | 05, 06 |
| 14-13 | Regression | Chuyển Part rồi back/forward | URL, selection và nội dung đồng bộ | 05, 06 |
| 14-14 | Data isolation | Local draft/Redux khác review backend | Không đọc/ghi/xóa draft; UI dùng review response | 03, 06 |
| 14-15 | Accessibility | Keyboard, screen reader và viewport nhỏ | Điều hướng/loading/error sử dụng được | 04–06 |
| 14-16 | API scope | Chọn một Part trong bài nhiều Part | Không tải payload/API cho Part khác | 02, 05, 06 |

## Definition of Done

- Mỗi AC có test/evidence hoặc ghi rõ chưa kiểm chứng.
- Live mock không thể gọi review; backend TV3-13 vẫn là enforcement thực sự.
- Historical review lấy đúng snapshot theo attempt; UI không truy vấn đề hiện hành.
- Chỉ Part đang chọn được yêu cầu và render; không có đáp án/explanation ngoài scope.
- Không có lỗi stale response, false score hoặc HTML injection.
- Frontend tests, lint và build đạt; không phát sinh warning mới.
- Handoff append-only kết luận PASS, NEED_FIX hoặc BLOCKED, kèm bằng chứng và residual risks.
- Không commit hoặc push.

## Ngoài phạm vi

- Thay đổi backend review contract hoặc snapshot/grading architecture của TV3-13.
- Review toàn bài bằng một API tải tất cả Part.
- Tạo/chỉnh sửa đáp án, giải thích hoặc chấm lại từ frontend.
- Thiết kế lại result page ngoài CTA cần thiết.
- Tự động retry/polling, cache review hoặc lưu essay/answer vào browser storage.
- Thay đổi quyền admin/teacher hoặc auth routing.
