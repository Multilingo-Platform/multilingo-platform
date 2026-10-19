# TV3-22-05 — Browser Smoke & Accessibility Verification

**Tài liệu:** `docs/testing/TV3-22-browser-smoke.md`  
**Ngày chạy:** 2026-10-19  
**Task:** TV3-22-05 — Browser smoke responsive/accessibility, API/media có kiểm soát  
**HEAD:** `5b3442efffb7c098b86eb1833408a1903b5d21ff`  
**Nhánh:** `feature/TV3-00-contract-audit`  
**Kết quả tổng:** **200 PASS / 6 WARN / 0 FAIL** trong **49 scenario browser** (206 assertion).  
**Trạng thái:** IMPLEMENTED — có 3 finding P2 cho extreme unbroken token; không sửa production code trong task này.

---

## 1. Mục tiêu và phạm vi

Tài liệu này ghi lại bằng chứng browser thật cho các luồng TV3 trên frontend local, dùng Playwright với API mock có kiểm soát. Trọng tâm:

- Responsive tại **375, 768, 1366 và 1920 px**.
- Picker, workspace, Part 1/2, audio sticky, question palette, result, review và Writing Diff.
- Keyboard-only: điều hướng, chọn đáp án, flag, disclosure, retry và Diff-View.
- Focus không bị sticky header che.
- Loading/error/empty/unavailable states.
- Text dài, Unicode và HTML-like không tràn hoặc thực thi.
- Tách biệt rõ **mock smoke** với **backend HTTP integration** và **staging/PG thật**.

Đây **không phải** kiểm thử end-to-end với backend thật, không phải PostgreSQL test, không phải kiểm thử bảo mật thực tế và không phải full WCAG audit.

---

## 2. Môi trường và cách chạy

| Thành phần | Giá trị |
|---|---|
| Frontend | Vite `^8.2.0`, chạy tại `http://127.0.0.1:5173` |
| Lệnh frontend | `cd frontend; npm run dev -- --host 127.0.0.1 --port 5173 --strictPort` |
| Browser | Google Chrome `155.0.8059.84` qua `channel: 'chrome'` |
| Playwright | `1.64.0-alpha-1790635538000` (từ `npx` cache, **không** thêm dependency) |
| Node | `v24.14.1` |
| Hệ điều hành | Windows, PowerShell |
| Evidence | `.superpowers/tv3-22/20261019_093840Z/browser/` (đã ignore bởi `.superpowers/`) |
| Harness | `.superpowers/tv3-22/20261019_093840Z/browser/smoke.cjs` |

Lệnh chạy harness (đường dẫn `NODE_PATH` là path thực tế của máy chạy):

```powershell
$env:NODE_PATH = "C:\Users\admin\AppData\Local\npm-cache\_npx\31e32ef8478fbf80\node_modules"
node .superpowers/tv3-22/20261019_093840Z/browser/smoke.cjs
```

### 2.1. Ranh giới mock

- App thật được Vite phục vụ; **không** mock React hook, router hoặc component.
- Mọi request có path bắt đầu `/api/` được Playwright `page.route` trả fixture. Các module nguồn `/src/.../api/...` không bị chặn.
- Auth được seed bằng `localStorage` (`token`, `user`) để không gọi login thật.
- Không tạo attempt thật, không gọi AI/provider, không ghi database.
- Audio dùng data URI WAV im lặng; ảnh dùng data URI SVG. Không có request audio/media ra CDN.
- Google Fonts CSS được thay bằng stylesheet rỗng; Google Identity Services được trả JavaScript rỗng. Vì vậy typography dùng fallback font và không có nội dung Google thật.
- Route mock cho `accounts.google.com` và `fonts.googleapis.com` **được ghi nhận là request của browser nhưng được fulfill locally**; đây không phải bằng chứng “zero external request”, mà là bằng chứng **không tải nội dung bên ngoài**. Không có request `fonts.gstatic.com`, audio, media hay AI provider.

### 2.2. Fixture ID và route

| Fixture ID | Route | Dữ liệu |
|---|---|---|
| `F-PICKER-01` | `/exams/1/start` | Exam structure 2 sections/3 parts |
| `F-PICKER-LOADING-01` | `/exams/4/start` | Structure delay 15 giây |
| `F-PICKER-ERROR-01` | `/exams/3/start` | Structure HTTP 500, retry được bật |
| `F-PICKER-EMPTY-01` | `/exams/2/start` | Structure không có part, start bị chặn |
| `F-WS-TOEIC-01` | `/attempts/8801` | Practice TOEIC, Part 1/2, data URI media |
| `F-WS-TOEIC-MOCK-02` | `/attempts/8802` | Mock audio unavailable |
| `F-WS-TOEIC-LONG-03` | `/attempts/8803` | Text dài tự nhiên + Unicode + HTML-like |
| `F-WS-ERROR-04` | `/attempts/8804` | Workspace HTTP 500, retry |
| `F-WS-TOEIC-STRESS-05` | `/attempts/8805` | Extreme unbroken token (residual-risk probe) |
| `F-RESULT-01` | `/attempts/77/result` | Result summary + Writing pending |
| `F-RESULT-ERROR-01` | `/attempts/77/result` | Result HTTP 500 |
| `F-RESULT-LOADING-01` | `/attempts/77/result` | Result delay 15 giây |
| `F-WRITING-FEEDBACK-01` | `/attempts/77/result` + feedback | Writing DONE, Diff-View |
| `F-WRITING-STRESS-02` | `/attempts/77/result` + stress feedback | Extreme label (residual-risk probe) |
| `F-RESULT-UNAVAILABLE-02` | `/attempts/78/result` | Writing unavailable |
| `F-REVIEW-01` | `/attempts/77/review?partId=201` | Review Part 201, answer labels, palette |
| `F-REVIEW-STRESS-02` | `/attempts/77/review?partId=201&smoke=stress` | Extreme part title (residual-risk probe) |

Các attempt `77`, `78`, `8801`–`8805` là synthetic ID, không tồn tại trong database thật.

---

## 3. Ma trận responsive và kết quả

Tất cả các ô dưới đây là **PASS** trừ các dòng stress được ghi rõ.

| Khu vực | 375 px | 768 px | 1366 px | 1920 px | Bằng chứng tiêu biểu |
|---|---:|---:|---:|---:|---|
| Picker: render, scope/section/mode, start | PASS | PASS | PASS | PASS | `v<w>_picker_F-PICKER-01.png`, `v<w>_picker-selected_F-PICKER-01.png` |
| Picker: loading | PASS | PASS | — | PASS | `v<w>_picker-loading_F-PICKER-LOADING-01.png` |
| Picker: error + keyboard retry + recovery | PASS | PASS | — | PASS | `v<w>_picker-error_F-PICKER-ERROR-01.png` |
| Picker: empty + start blocked | PASS | PASS | — | PASS | `v<w>_picker-empty_F-PICKER-EMPTY-01.png` |
| Workspace Part 1: instruction, radio, flag | PASS | PASS | PASS | PASS | `v<w>_workspace-part1_F-WS-TOEIC-01.png` |
| Workspace Part 2: switcher, render | PASS | PASS | PASS | PASS | `v<w>_workspace-part2_F-WS-TOEIC-01.png` |
| Audio sticky + focus after scroll | PASS | PASS | PASS | PASS | `v<w>_workspace-sticky-audio_F-WS-TOEIC-01.png` |
| Palette: keyboard nav + `aria-current` | PASS | PASS | PASS | PASS | `v<w>_palette_F-WS-TOEIC-01.png` |
| Workspace: mock audio unavailable | PASS | PASS | — | PASS | `v<w>_workspace-unavailable_F-WS-TOEIC-MOCK-02.png` |
| Workspace: long/Unicode/HTML-like | PASS | PASS | — | PASS | `v<w>_workspace-long_F-WS-TOEIC-LONG-03.png` |
| Workspace: error + keyboard retry + recovery | PASS | PASS | — | PASS | `v<w>_workspace-error_F-WS-ERROR-04.png` |
| Result: render, table, Writing disclosure | PASS | PASS | PASS | PASS | `v<w>_result_F-RESULT-01.png` |
| Result: loading | PASS | PASS | — | PASS | `v<w>_result-loading_F-RESULT-LOADING-01.png` |
| Result: error | PASS | PASS | — | PASS | `v<w>_result-error_F-RESULT-ERROR-01.png` |
| Writing unavailable disclosure | PASS | PASS | — | PASS | `v<w>_writing-unavailable_F-RESULT-UNAVAILABLE-02.png` |
| Writing Diff-View compare/original/corrected | PASS | PASS | PASS | PASS | `v<w>_writing-diff_F-WRITING-FEEDBACK-01.png`, `...-viewport...` |
| Review: render, answer labels, palette | PASS | PASS | PASS | PASS | `v<w>_review_F-REVIEW-01.png` |
| Stress: extreme unbroken token | **WARN** | — | **WARN** | — | `v375_workspace-stress_...`, `v375_review-stress_...` |
| Stress: extreme Writing label | **WARN** | — | **WARN** | — | `v375_writing-stress_...`, `v1366_writing-stress_...` |

`<w>` là `375`, `768`, `1366`, `1920`; không phải mọi state đều chạy ở mọi viewport. Các state được chạy tại 375/768/1920; stress chỉ tại 375/1366 để giới hạn thời gian, trong khi matrix chính phủ đủ 4 viewport.

### 3.1. Keyboard-only và focus

Mỗi bước dưới đây được thực hiện bằng `Tab`/`Shift+Tab` và `Enter`/`Space`, không dùng chuột:

| Luồng | Số Tab (375 / 768 / 1366 / 1920) | Kết quả |
|---|---|---|
| Picker → scope option | 5 / 5 / 10 / 10 | PASS; `covered=false` |
| Picker → section option | 2 / 2 / 2 / 2 | PASS; `covered=false` |
| Picker → mode option | 3 / 3 / 3 / 3 | PASS; `covered=false` |
| Workspace → flag | 9 / 9 / 9 / 9 | PASS; toggle `aria-pressed=true` |
| Workspace → answer radio | 1 / 1 / 1 / 1 | PASS; chọn được đáp án A |
| Workspace → palette question | 8 / 8 / 8 / 8 | PASS; `aria-current=true` sau Enter |
| Workspace → Part 2 switcher | 21 / 21 / 21 / 21 | PASS; Part 2 render |
| Result → Writing disclosure | 9 / 9 / 14 / 14 | PASS; panel mở |
| Result → Diff-View “Bài gốc” | 3 / 3 / 3 / 3 | PASS; `aria-pressed=true` |
| Result → Diff-View “Bản sửa” | 1 / 1 / 1 / 1 | PASS; `aria-pressed=true` |
| Review → question palette | 10 / 10 / 15 / 15 | PASS; `covered=false` |
| Picker error → retry | 3 / 3 / — / 8 | PASS; recovery |
| Workspace error → retry | 1 / 1 / — / 1 | PASS; recovery |

Không có focus nào bị sticky header che: tất cả check keyboard trả `overlappingSticky: []` và `covered: false`.

Audio sticky được đo sau khi cuộn:

| Viewport | `scrollTop` / `maxScroll` | Header top | Scroller top + padding | Kết quả |
|---|---:|---:|---:|---|
| 375 | 600 / 682 | 80 | 64 + 16 | PASS, position `sticky`, z-index 20 |
| 768 | 162 / 162 | 88 | 64 + 24 | PASS, position `sticky`, z-index 20 |
| 1366 | 418 / 418 | 88 | 64 + 24 | PASS, position `sticky`, z-index 20 |
| 1920 | 106 / 106 | 124 | 64 + 24 | PASS; nội dung ngắn nên header không cần “dính” lâu, vẫn hiển thị đúng |

Focus của disclosure result tại 375 và 1920 nằm sát mép dưới viewport nhưng **không bị che**; Enter vẫn mở panel và các kiểm tra Diff-View sau đó đều PASS.

---

## 4. Loading, error, empty, unavailable

| State | Kết quả quan sát | Kết quả |
|---|---|---|
| Picker loading | `role=status` hiển thị “Đang tải thông tin đề thi...” | PASS |
| Picker error | `role=alert` hiển thị lỗi mock; focus tới “Thử lại”; sau Enter form picker xuất hiện | PASS |
| Picker empty | “Đề thi chưa có phần thi nào.” và nút bắt đầu bị chặn | PASS |
| Workspace unavailable | `data-testid="toeic-audio-unavailable"` hiển thị; không tràn ngang | PASS |
| Workspace error | `role=alert` hiển thị lỗi HTTP 500; focus “Thử lại”; retry phục hồi workspace | PASS |
| Result loading | `role=status` hiển thị “Đang tải kết quả…” | PASS |
| Result error | `role=alert` hiển thị “Không tải được kết quả. Vui lòng thử lại.” | PASS |
| Writing unavailable | Disclosure vẫn keyboard-accessible; trạng thái unavailable hiển thị | PASS |
| HTML-like text | Không có `window.__tv3Pwned`, không có inline handler, không có injected script | PASS |
| Long/Unicode text | Không tràn ngang ở 375/768/1920 với text tự nhiên | PASS |

---

## 5. Findings P2 — extreme unbroken token

Ba finding dưới đây chỉ tái hiện với **một token rất dài không có khoảng trắng** (stress probe). Text dài tự nhiên, tiếng Việt, tiếng Nhật, emoji và HTML-like đều PASS. Không có P0/P1 trong phạm vi mock smoke.

### F-01 — Workspace instruction bị cắt với token không khoảng trắng

- **Severity:** P2.
- **Vị trí:** `frontend/src/features/exam/components/workspace/WorkspaceFrame.tsx:33` — container `toeic-part-instruction` không có `break-words` / `overflow-wrap`.
- **Tái hiện:** `F-WS-TOEIC-STRESS-05`, route `/attempts/8805`, viewport 375 và 1366.
- **Bằng chứng:** `summary.json` → `workspace-stress@375` / `workspace-stress@1366`; screenshot `v375_workspace-stress_F-WS-TOEIC-STRESS-05.png`.
- **Số đo:** instruction `scrollWidth=2240`, `clientWidth=339` (375) và `clientWidth=764` (1366). Trang không có horizontal scroll vì nội dung bị clip trong workspace, nên người dùng không đọc được phần cuối.
- **Ảnh hưởng:** chỉ với URL/token không có break opportunity; không ảnh hưởng câu hỏi/đoạn văn thông thường.
- **Gợi ý fix tối thiểu (không áp dụng trong task này):** thêm `break-words [overflow-wrap:anywhere]` (và `min-w-0` nếu là flex item) cho container instruction.

### F-02 — Writing feedback header tràn khi label cực dài

- **Severity:** P2.
- **Vị trí:** `frontend/src/features/exam/components/result/writing/WritingFeedbackTask.tsx:34` — `div.space-y-1` là flex item nhưng thiếu `min-w-0` / `max-w-full`; `h3` đã có `break-words` nhưng parent vẫn giữ min-content width.
- **Tái hiện:** `F-WRITING-STRESS-02`, `/attempts/77/result`, mở Writing feedback.
- **Bằng chứng:** `summary.json` → `result-stress@375` / `result-stress@1366`; screenshot `v375_writing-stress_F-WRITING-STRESS-02.png`.
- **Số đo:** `docScrollWidth=2977` so với viewport 375; `docScrollWidth=3152` so với viewport 1366. Target task `scrollWidth=2943`, `clientWidth=948` (1366).
- **Ảnh hưởng:** page có horizontal scrollbar; label/task header đẩy layout rộng, dù nội dung feedback bên trong đã wrap.
- **Gợi ý fix tối thiểu (không áp dụng):** thêm `min-w-0`/`max-w-full` cho wrapper và bảo đảm header flex item có thể shrink.

### F-03 — Review part header tràn với title cực dài

- **Severity:** P2.
- **Vị trí:** `frontend/src/features/exam/components/review/PartReviewContent.tsx:135` — `<h2>` không có `break-words`; parent stats/header flex không có `min-w-0`.
- **Tái hiện:** `F-REVIEW-STRESS-02`, `/attempts/77/review?partId=201&smoke=stress`.
- **Bằng chứng:** `summary.json` → `review-stress@375` / `review-stress@1366`; screenshot `v375_review-stress_F-REVIEW-STRESS-02.png`, `v1366_review-stress_F-REVIEW-STRESS-02.png`.
- **Số đo:** `docScrollWidth=3424` (375) và `3731` (1366); title `h2` rộng 3387 px ở 1366, đẩy stats sang phải.
- **Ảnh hưởng:** page horizontal scroll; review header không đọc được trọn vẹn trên mobile.
- **Gợi ý fix tối thiểu (không áp dụng):** `min-w-0` cho container header và `break-words [overflow-wrap:anywhere]` cho `h2`.

**Không sửa các finding này trong TV3-22-05** theo quyết định handoff: defect xác nhận được ghi finding và chuyển sang fix riêng; không mở rộng scope thành production fix.

---

## 6. Mock smoke khác backend HTTP integration như thế nào

| Khía cạnh | Lần chạy này | Backend HTTP / staging |
|---|---|---|
| API | Playwright route mock toàn bộ `/api/**` | Spring Boot thật, security filter, controller/service/repository |
| Auth | `localStorage` fixture | Login/token thật, ownership/role thật |
| Attempt | Synthetic ID, không persist | Attempt thật trong PostgreSQL test/staging |
| Audio | Data URI WAV im lặng | URL audio thật, Range/CORS/auth/streaming |
| AI/Writing | Fixture JSON | Fake provider trong test hoặc provider theo cấu hình staging |
| Database | Không dùng | PostgreSQL riêng (TV3-22-04) hoặc staging DB |
| Kết luận | UI/render/keyboard/state với dữ liệu kiểm soát | Phải chạy checklist staging bên dưới |

Lần chạy này **không** chứng minh:

- Backend trả đúng contract hoặc đúng quyền sở hữu.
- Audio thật phát được, seek/range/CORS hoạt động.
- Dữ liệu result/review đúng với snapshot lịch sử.
- Deployment/staging hoạt động.
- Full WCAG compliance; chưa có screen reader hay axe scan.

Các bằng chứng backend HTTP nằm ở TV3-22-02/03; PostgreSQL thật ở TV3-22-04; broad gates ở TV3-22-06.

---

## 7. Checklist staging cho người vận hành

Chỉ dùng **attempt thử** và **tài khoản test**; không dùng attempt lịch sử, không dùng dữ liệu người dùng thật.

### 7.1. Chuẩn bị

- [ ] Xác nhận staging URL, build/commit và feature flags của TV3.
- [ ] Xác nhận migration PostgreSQL đã chạy trên staging/test DB; không chạy migration production.
- [ ] Chuẩn bị exam test có Part 1 listening (ảnh + audio), Part 2 đủ 25 câu, ít nhất một Writing task.
- [ ] Chuẩn bị hai tài khoản: owner của attempt thử và một tài khoản khác để kiểm tra 403/404.
- [ ] Ghi lại exam ID, part ID, attempt ID dự kiến và thời điểm bắt đầu.

### 7.2. Picker và tạo attempt

- [ ] Mở picker; chọn scope/mode bằng keyboard; xác nhận nút bắt đầu chỉ bật khi hợp lệ.
- [ ] Bắt đầu Practice; ghi attempt ID thật và kiểm tra route workspace.
- [ ] Xác nhận không có request AI/provider/CDN ngoài domain staging và storage âm thanh đã cấu hình.

### 7.3. Workspace và playback

- [ ] Part 1: ảnh hiển thị, audio phát được, timeline/seek/volume hoạt động.
- [ ] Cuộn xuống: audio header vẫn sticky, không che focus; thử `Tab` tới flag, radio, palette và Part 2.
- [ ] Flag/answer cập nhật đúng; palette nhảy đúng câu; `aria-current` đúng.
- [ ] Reload giữa bài: autosave/resume khôi phục đúng đáp án và thời gian.
- [ ] Part 2: đủ 25 câu, số thứ tự và palette đúng.
- [ ] Mock Test: playback theo timeline server; thử reload và concurrent tab.
- [ ] Practice: kiểm tra retry/wrong-answer feedback nếu có.

### 7.4. Submit, result, review, Writing

- [ ] Submit; xác nhận không false-success khi timeout/409/401.
- [ ] Result: summary, status, objective/writing sections hiển thị đúng.
- [ ] Review: đáp án A–D/A–C, answer rỗng/null/array không bịa đáp án; review đúng snapshot.
- [ ] Writing feedback: disclosure, Diff-View compare/original/corrected, unavailable/error state.
- [ ] Kiểm tra owner và tài khoản khác: attempt không thuộc owner phải bị từ chối; không lộ answer key trong workspace.

### 7.5. Responsive và accessibility

- [ ] Lặp lại các bước chính tại 375, 768, 1366, 1920 px.
- [ ] Keyboard-only toàn luồng: picker → workspace → submit → result → review → Diff-View.
- [ ] Focus luôn thấy, không bị header/palette che; alert/status có `role` đúng.
- [ ] Kiểm tra long/Unicode/HTML-like text trên staging; không có script execution.
- [ ] Ghi screenshot, HAR/network (đã redact token), console và attempt ID vào artifact kiểm thử.

### 7.6. Dọn dẹp và tiêu chí dừng

- [ ] Xóa hoặc đánh dấu attempt thử theo quy trình staging; không xóa dữ liệu người dùng.
- [ ] Nếu thấy P0/P1 (lộ answer key, sai quyền, audio không phát, false-success, sai attempt) → dừng và báo blocker.
- [ ] Không tuyên bố “đã xác minh deployment” nếu chưa hoàn thành checklist này.

---

## 8. Artifacts và cách đọc

Thư mục: `.superpowers/tv3-22/20261019_093840Z/browser/`

| File | Nội dung |
|---|---|
| `summary.json` | 206 assertion: 200 PASS, 6 WARN, 0 FAIL; chi tiết từng area/name/status/detail |
| `run.log` | Log đầy đủ của lần chạy cuối |
| `console.json` | 162 console event; chỉ có 15 lỗi HTTP 500 **cố ý** từ mock error; không có lỗi JavaScript ngoài dự kiến |
| `api-requests.json` | Log request `/api/**` do mock xử lý; synthetic fixtures |
| `request-log.json` | Request của browser; không có media/audio; external font/GSI được intercept locally |
| `smoke.cjs` | Harness Playwright tái lập |
| `v<w>_*.png` | 73 screenshot có trong `summary.json` (viewport, route và fixture ID nằm trong tên file); thư mục còn 9 PNG từ lần chạy trước không được `summary.json` tham chiếu — harness tái dùng thư mục output, thực thi theo lượt cần thư mục riêng hoặc dọn output cũ |

Screenshot tiêu biểu:

- `v375_picker_F-PICKER-01.png`, `v1920_picker_F-PICKER-01.png`
- `v375_workspace-part1_F-WS-TOEIC-01.png`, `v768_workspace-part2_F-WS-TOEIC-01.png`
- `v375_workspace-sticky-audio_F-WS-TOEIC-01.png`
- `v375_palette_F-WS-TOEIC-01.png`
- `v375_result_F-RESULT-01.png`, `v375_writing-diff_F-WRITING-FEEDBACK-01.png`
- `v375_review_F-REVIEW-01.png`, `v1920_review_F-REVIEW-01.png`
- `v375_picker-error_F-PICKER-ERROR-01.png`, `v375_workspace-error_F-WS-ERROR-04.png`
- `v375_workspace-stress_F-WS-TOEIC-STRESS-05.png`, `v375_writing-stress_F-WRITING-STRESS-02.png`, `v375_review-stress_F-REVIEW-STRESS-02.png`

Ghi chú: `debug*` và `run-subset.log` đã được xóa khỏi evidence folder sau khi hoàn tất; chỉ còn artifact của lần chạy cuối.

---

## 9. Đối chiếu acceptance criteria

| AC / TC | Kết quả | Ghi chú |
|---|---|---|
| AC-07 (browser evidence) | **PASS cho nội dung thông thường; 3 P2 residual** | Picker/workspace/Part 1/2/palette/flag/answer/review/Writing Diff render và keyboard được ở 4 viewport; extreme unbroken token có F-01/F-02/F-03 |
| AC-08 | **Không đánh giá trong task này** | Full suite/lint/build thuộc TV3-22-06 |
| AC-09 | **Partial** | Command, evidence, limitations và staging checklist đã ghi; final feature review chưa chạy |
| TC_TV3_22_14 | **Partial** | Mock audio/data URI và timeline UI được kiểm tra; playback server thật chưa chạy |
| TC_TV3_22_15 | **Partial** | Answer labels A–D/A–C, rỗng/null/array trong review fixture; backend review HTTP thật không có trong mock smoke |
| TC_TV3_22_16 | **PASS cho long/Unicode/HTML-like thông thường; P2 cho extreme token** | Keyboard, alert/status, small viewport, essay dài; focus không bị sticky che; 3 finding P2 |

**Kết luận:** TV3-22-05 implementation hoàn tất với browser evidence rõ ràng và phân biệt mock/HTTP. Không có P0/P1 trong phạm vi mock. Ba finding P2 cần được xử lý ở task fix riêng hoặc được reviewer chấp nhận là residual risk. Không commit/push; dừng chờ review.
