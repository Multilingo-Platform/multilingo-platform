# Sprint 03 — Exam Integration, Autosave & Timer: Design Spec

**Ngày:** 2026-09-30
**Sprint:** S03 — WorkspaceShell Integration + Autosave + Timer + Submit
**Tác giả:** TV3
**Phụ thuộc:** Sprint 02 — answerSlice, 8 renderers, AudioPlayer, QuestionPalette đã GREEN
**Đầu ra:** Học viên có thể làm bài thi đầy đủ trong một màn hình duy nhất, bài được lưu tự động, và nộp bài khi hết giờ hoặc chủ động bấm nộp.

---

## 1. Mục tiêu & Scope

### In-Scope (Sprint 03)
- **WorkspaceShell:** Tích hợp toàn bộ Components (AudioPlayer, QuestionPalette, QuestionRenderer) vào layout màn hình làm bài hoàn chỉnh.
- **Timer:** Hook `useExamTimer` đếm ngược dựa trên `deadline` từ `WorkspaceResponse`, chống lỗi tab ẩn và reload trang.
- **Autosave:** Hook `useAutosave` dùng `setInterval` polling 15 giây, chỉ gọi API `PUT /v1/attempts/{id}/answers` khi Redux có thay đổi (`isDirty`).
- **SaveStatus UI:** Component `SaveStatusBadge` hiển thị trạng thái "Đang lưu..." / "Đã lưu" / "Đang thử lại..." ở góc màn hình.
- **localStorage fallback:** Ghi đáp án vào `localStorage` mỗi khi Redux thay đổi để phòng trường hợp tab bị tắt lúc rớt mạng.
- **Submit flow:** Nút "Nộp bài" thủ công + Auto-submit khi Timer về 00:00, kèm màn hình Overlay khóa thao tác.
- **Backend API mới:** `PUT /api/v1/attempts/{id}/answers` (autosave) + `POST /api/v1/attempts/{id}/submit`.
- **Backend Watchdog (Cron Job):** Tự động finalize các attempt đã hết `deadline` nhưng chưa submitted.
- **Idempotent Submit:** Backend đảm bảo gọi submit nhiều lần không chấm điểm hai lần.

### Out-of-Scope (để Sprint sau)
- Xem kết quả / điểm chi tiết sau khi nộp bài (Sprint 04)
- Chấm điểm tức thì Practice Mode (Sprint 05)
- AI Writing hints/feedback (Sprint 07+)
- Tích hợp auth thật từ TV1 (vẫn dùng fixture identity)

---

## 2. Quyết định kỹ thuật đã chốt

| Quyết định | Lựa chọn | Lý do |
|---|---|---|
| Timer architecture | `targetEndTime = Date.parse(deadline)`, UI dùng `Date.now()` | Chống throttle khi tab ẩn; chống gian lận reload trang. Không phụ thuộc vào server-push. |
| Autosave trigger | Polling interval 15s + `isDirty` guard | Không gọi API khi gõ từng phím (tránh quá tải); vẫn đảm bảo lưu kịp dù gõ Essay liên tục 15 phút. |
| Autosave error handling | Giữ `isDirty = true`, retry interval sau | Không chặn gõ bài; interval tiếp theo tự gửi lại đáp án mới nhất. |
| localStorage fallback | Ghi vào `localStorage[attemptId]` mỗi khi `setAnswer` dispatch | Bảo vệ lớp cuối khi tab bị đóng đột ngột lúc rớt mạng. |
| Submit blocking | Nút Submit disabled khi `isDirty = true` | Đảm bảo đáp án cuối cùng đã đến server trước khi chốt bài. |
| Auto-submit khi hết giờ | Frontend hiện Overlay → gọi API → retry nếu lỗi mạng | UX rõ ràng, học viên không thao tác tiếp được nhưng biết trạng thái. |
| Backend finalize authority | Cron Job là source of truth, FE là UX phụ | Bảo vệ trường hợp FE mất mạng vĩnh viễn. Backend tự chốt bài theo `deadline`. |
| Submit idempotency | Check `status != IN_PROGRESS` trước khi chấm, trả kết quả cũ nếu đã submitted | Tránh double-scoring khi FE retry hoặc FE + Cron Job cùng submit. |
| PRACTICE mode timer | `deadline = null` → ẩn Timer hoàn toàn | Practice không giới hạn thời gian theo spec UC09. |

---

## 3. Cấu trúc file đề xuất

### Frontend (mới/sửa)

```
frontend/src/features/exam/
├── api/
│   └── attemptApi.ts              # [SỬA] Thêm autosaveAnswers(), submitAttempt()
├── components/
│   ├── WorkspaceShell.tsx         # [MỚI] Layout chính: header + left-panel + right-panel
│   ├── SaveStatusBadge.tsx        # [MỚI] "Đang lưu..." / "Đã lưu" / "Đang thử lại..."
│   ├── TimerDisplay.tsx           # [MỚI] Hiển thị MM:SS, đỏ khi < 5 phút
│   ├── SubmitOverlay.tsx          # [MỚI] Màn hình khóa khi hết giờ, kèm retry button
│   ├── SubmitConfirmModal.tsx     # [MỚI] Dialog xác nhận khi bấm nộp bài thủ công
│   ├── AudioPlayer.tsx            # [GIỮ] Không sửa
│   ├── QuestionPalette.tsx        # [GIỮ] Không sửa
│   └── renderers/                 # [GIỮ] Không sửa
├── hooks/
│   ├── useWorkspace.ts            # [GIỮ] Không sửa
│   ├── useExamTimer.ts            # [MỚI] Timer hook: tính timeLeft từ deadline
│   └── useAutosave.ts             # [MỚI] Autosave hook: polling + isDirty guard
├── store/
│   └── answerSlice.ts             # [SỬA] Thêm isDirty, lastSavedAt, setSaveStatus
└── pages/
    └── WorkspacePage.tsx          # [SỬA] Render WorkspaceShell, kết nối hooks
```

### Backend (mới/sửa)

```
backend/src/main/java/com/multilingo/backend/modules/testing/
├── controller/
│   └── TestAttemptController.java  # [SỬA] Thêm PUT /answers + POST /submit
├── dto/
│   ├── request/
│   │   ├── AutosaveAnswersRequest.java  # [MỚI]
│   │   └── SubmitAttemptRequest.java   # [MỚI]
│   └── response/
│       └── SubmitResultResponse.java   # [MỚI] attemptId, status, redirectUrl
├── service/
│   ├── TestAttemptService.java        # [SỬA] Interface + autosave, submit
│   ├── impl/
│   │   └── TestAttemptServiceImpl.java # [SỬA] Logic autosave + submit + idempotency
│   └── AttemptWatchdogService.java    # [MỚI] @Scheduled cron job finalize
└── entity/
    └── TestAttempt.java               # [GIỮ] Đã có deadline field
```

---

## 4. API Contracts

### 4.1. API mới cần thêm vào `attemptApi.ts` (Frontend)

```typescript
// PUT /api/v1/attempts/:id/answers
// Autosave — ghi đáp án nháp lên server
autosaveAnswers(attemptId: number, req: AutosaveRequest): Promise<void>

// POST /api/v1/attempts/:id/submit
// Nộp bài chính thức (thủ công hoặc auto khi hết giờ)
submitAttempt(attemptId: number, req: AutosaveRequest): Promise<SubmitResult>
```

```typescript
interface AutosaveRequest {
  version: number;         // version hiện tại từ Redux, dùng để Backend detect conflict
  answers: PartAnswers[];  // toàn bộ đáp án từ Redux answers[partId][questionId]
}

interface SubmitResult {
  attempt_id: number;
  status: 'COMPLETED' | 'AI_GRADING';
  redirect_url: string;   // '/attempts/:id/result'
}
```

### 4.2. Backend API mới

```
PUT /api/v1/attempts/{id}/answers
  Body: AutosaveAnswersRequest { version: int, answers: List<PartAnswerDto> }
  Response 200: ApiResponse<Void>
  Response 409: Conflict (version không khớp — học viên mở 2 tab cùng lúc)
  Response 403: Không phải chủ sở hữu attempt
  Response 404: Attempt không tồn tại

POST /api/v1/attempts/{id}/submit
  Body: SubmitAttemptRequest { answers: List<PartAnswerDto> }  // optional, gửi đáp án cuối cùng
  Response 200: ApiResponse<SubmitResultResponse> — Nếu đã submitted trước, trả kết quả cũ
  Response 403: Không phải chủ sở hữu attempt
  Response 404: Attempt không tồn tại
```

---

## 5. Redux State — Mở rộng `answerSlice.ts`

### State shape mở rộng

```typescript
interface AnswerState {
  attemptId: number | null;
  version: number;
  answers: Record<number, Record<string, AnswerValue>>;

  // --- Mới thêm cho Sprint 03 ---
  isDirty: boolean;         // true khi có đáp án chưa được Autosave lên server thành công
  lastSavedAt: number | null;  // timestamp (ms) lần Autosave thành công gần nhất
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';  // trạng thái hiện thị SaveStatusBadge
}
```

### Actions mới

| Action | Payload | Mô tả |
|---|---|---|
| `setAnswer` | `{ partId, questionId, value }` | [SỬA] Thêm `state.isDirty = true` sau khi ghi |
| `markSaveSuccess` | `{ savedAt: number }` | Gọi sau khi API autosave thành công. Set `isDirty=false`, `lastSavedAt`, `saveStatus='saved'` |
| `markSavePending` | — | Gọi khi bắt đầu gọi API. Set `saveStatus='saving'` |
| `markSaveError` | — | Gọi khi API lỗi. Set `saveStatus='error'`, giữ `isDirty=true` |
| `clearAnswers` | — | [GIỮ] Reset về `initialState` khi unmount WorkspacePage |

### Invariants (bất biến)
- `setAnswer` chỉ ghi khi `attemptId !== null`
- `isDirty = false` → chỉ được xảy ra sau khi API autosave trả HTTP 200
- `saveStatus = 'saved'` chỉ xảy ra cùng lúc với `isDirty = false`
- State không bao giờ chứa `correct_answer`

---

## 6. Component Interfaces

### `useExamTimer(deadline: string | null)`

```typescript
interface ExamTimerResult {
  timeLeftMs: number;       // còn bao nhiêu ms, đã clamp về 0
  isExpired: boolean;       // true khi timeLeftMs === 0
  displayTime: string;      // "45:30" hoặc "01:05:30" nếu > 1 giờ
  isPractice: boolean;      // true khi deadline === null (PRACTICE mode)
}
```
- Thuật toán: `timeLeftMs = Math.max(0, Date.parse(deadline) - Date.now())`
- `setInterval` mỗi 500ms để tránh giật khi tab quay lại
- Cleanup `clearInterval` khi unmount

### `useAutosave(attemptId: number | null)`

```typescript
// Hook không trả về gì — tự điều phối trong nền
// Polling interval: 15s (AUTOSAVE_INTERVAL_MS)
// Điều kiện gọi API: isDirty === true && attemptId !== null && saveStatus !== 'saving'
// Khi thành công: dispatch(markSaveSuccess({ savedAt: Date.now() }))
// Khi thất bại: dispatch(markSaveError())
```

### `WorkspaceShell`

```typescript
interface WorkspaceShellProps {
  workspace: WorkspaceResponse;
}
```

Layout 2 cột:
- **Left (70%):** Nội dung đề thi (cuộn được) + renderers câu hỏi
- **Right (30%):** TimerDisplay + QuestionPalette + nút Nộp bài
- **Header (sticky):** Tên đề thi + SaveStatusBadge

### `TimerDisplay`

```typescript
interface TimerDisplayProps {
  displayTime: string;
  isExpired: boolean;
  isPractice: boolean;   // nếu true → render null (ẩn)
}
```
- Màu chữ chuyển đỏ khi `timeLeftMs < 5 * 60 * 1000` (dưới 5 phút)

### `SaveStatusBadge`

```typescript
// Đọc trực tiếp từ Redux store (không nhận props)
// idle → không hiển thị gì
// saving → spinner + "Đang lưu..."
// saved → checkmark + "Đã lưu" (tự ẩn sau 3s)
// error → warning icon + "Chưa lưu được — đang thử lại"
```

### `SubmitOverlay`

```typescript
interface SubmitOverlayProps {
  visible: boolean;
  isRetrying: boolean;
  onRetry: () => void;
}
```
- Khi `visible = true`: full-screen backdrop, không cho thao tác
- Nội dung: "Hết thời gian! Đang nộp bài..." hoặc "Nộp bài thất bại — [Thử lại]"

---

## 7. Data Flow

### 7.1. Autosave flow

```
[setInterval 15s] →
  read isDirty, saveStatus from Redux
  if isDirty === false → skip
  if saveStatus === 'saving' → skip (đang gọi rồi, tránh double-call)
  dispatch(markSavePending)
  → attemptApi.autosaveAnswers(attemptId, { version, answers })
  → HTTP 200 → dispatch(markSaveSuccess)
  → HTTP 4xx/5xx → dispatch(markSaveError)   // isDirty giữ true, retry interval sau
```

### 7.2. Timer flow

```
WorkspacePage mount
  → useExamTimer(workspace.deadline)
  → isPractice → hide timer
  → setInterval 500ms: timeLeftMs = Date.parse(deadline) - Date.now()
  → timeLeftMs === 0 → isExpired = true

useEffect([isExpired])
  → if isExpired: setShowOverlay(true)
  → attemptApi.submitAttempt(attemptId, currentAnswers)
  → success → navigate('/attempts/' + id + '/result')
  → error → show retry button in Overlay
```

### 7.3. Manual Submit flow

```
User bấm "Nộp bài"
  → isDirty === true → Toast "Vui lòng chờ, đang lưu..."  (nút vẫn disabled)
  → isDirty === false → Mở SubmitConfirmModal
  → Xác nhận → setShowOverlay(true)
  → attemptApi.submitAttempt(...)
  → success → navigate('/attempts/' + id + '/result')
```

### 7.4. localStorage fallback flow

```
mỗi khi setAnswer dispatch
  → answerSlice middleware (hoặc useEffect trong WorkspacePage)
  → localStorage.setItem('exam_draft_' + attemptId, JSON.stringify(answers))

Khi WorkspacePage mount + isDirty trong Redux = false nhưng có bản trong localStorage
  → Khôi phục nếu localStorage.version > workspace.version  (nghĩa là đã gõ mà chưa kịp sync)
  → Thông báo nhỏ: "Tìm thấy bản nháp chưa lưu, đã khôi phục"
```

---

## 8. Error Handling

| Tình huống | Xử lý UI | Xử lý Data |
|---|---|---|
| Autosave API lỗi mạng | `saveStatus='error'` → badge "Đang thử lại..." | Giữ `isDirty=true`, retry interval tiếp theo |
| Autosave 409 Conflict | Toast cảnh báo "Phát hiện xung đột phiên" | Reload workspace để lấy version mới nhất từ server |
| Submit API lỗi mạng | Overlay hiện nút "Thử nộp lại" | Giữ nguyên đáp án trong Redux và localStorage |
| Submit 409 (đã submitted) | Redirect thẳng sang result page | Backend trả `redirect_url` trong response body |
| Timer hết giờ + rớt mạng | Overlay khóa + nút retry | Backend Watchdog sẽ tự finalize sau 1-2 phút |
| WorkspacePage unmount bất thường | Autosave interval tự clearInterval | localStorage đã có bản draft mới nhất |

---

## 9. Backend — Cron Job (AttemptWatchdogService)

```java
@Component
@RequiredArgsConstructor
public class AttemptWatchdogService {

    @Scheduled(fixedDelay = 60_000)  // mỗi 60 giây
    @Transactional
    public void finalizeExpiredAttempts() {
        // Tìm tất cả attempt: status=IN_PROGRESS AND deadline < NOW()
        List<TestAttempt> expired = attemptRepo.findExpiredAttempts(Instant.now());
        for (TestAttempt attempt : expired) {
            attempt.setStatus(AttemptStatus.COMPLETED);
            // Chấm điểm từ attempt_answers đã lưu nháp
        }
        attemptRepo.saveAll(expired);
    }
}
```

**Idempotency pattern cho Submit API:**
```java
public SubmitResultResponse submitAttempt(int attemptId, ...) {
    TestAttempt attempt = repo.findById(attemptId).orElseThrow();
    if (attempt.getStatus() != AttemptStatus.IN_PROGRESS) {
        // Đã submitted trước đó — trả về kết quả cũ, KHÔNG chấm lại
        return SubmitResultResponse.from(attempt);
    }
    // ... logic chấm điểm và chuyển trạng thái
}
```

---

## 10. Acceptance Criteria

### AC-01: Timer chính xác

```gherkin
Scenario: Timer không bị throttle khi ẩn tab
  Given Học viên mở workspace, còn 60:00
  When Chuyển sang tab khác 5 phút, quay lại
  Then Timer hiển thị ~55:00 (chính xác ±2s)

Scenario: F5 không reset timer
  Given Học viên đang làm bài, còn 45:30
  When Bấm F5 reload trang
  Then Workspace reload, Timer tiếp tục hiển thị ~45:30 (dựa trên deadline từ server)

Scenario: PRACTICE mode ẩn timer
  Given test_mode = PRACTICE, deadline = null
  When Workspace render
  Then Không có component TimerDisplay trên màn hình
```

### AC-02: Autosave polling

```gherkin
Scenario: Autosave kích hoạt đúng chu kỳ
  Given isDirty = true
  When 15 giây trôi qua
  Then Gọi đúng 1 lần PUT /v1/attempts/{id}/answers
  And saveStatus chuyển 'saving' → 'saved'
  And isDirty = false

Scenario: Không gọi API khi không có thay đổi
  Given isDirty = false
  When 15 giây trôi qua
  Then Không gọi API (zero network request)

Scenario: Rớt mạng — retry tự động
  Given isDirty = true, Wifi tắt
  When Autosave trigger, API lỗi
  Then saveStatus = 'error', isDirty vẫn = true
  And 15 giây sau → tự động thử lại
```

### AC-03: localStorage fallback

```gherkin
Scenario: Ghi đáp án vào localStorage
  Given Học viên chọn đáp án câu 1
  When dispatch(setAnswer) thành công
  Then localStorage['exam_draft_42'] được cập nhật với đáp án mới

Scenario: Khôi phục bản nháp khi mở lại tab
  Given Học viên đóng tab lúc rớt mạng, isDirty = true chưa được lưu
  When Mở lại workspace cùng attemptId
  Then Phát hiện localStorage có version mới hơn server
  And Hiển thị toast "Tìm thấy bản nháp chưa lưu, đã khôi phục"
```

### AC-04: Submit flow

```gherkin
Scenario: Nộp bài thủ công thành công
  Given isDirty = false (đã autosave)
  When Bấm "Nộp bài" → xác nhận modal
  Then Overlay hiện lên
  And POST /v1/attempts/{id}/submit được gọi
  And Redirect sang /attempts/{id}/result

Scenario: Nộp bài bị chặn khi chưa lưu
  Given isDirty = true
  When Bấm "Nộp bài"
  Then Toast "Vui lòng chờ, đang lưu bài..."
  And Không mở modal xác nhận

Scenario: Auto-submit khi hết giờ
  Given Timer về 00:00
  When Timer isExpired = true
  Then Overlay khóa toàn màn hình, không cho thao tác
  And POST submit được gọi tự động
```

### AC-05: Submit idempotency

```gherkin
Scenario: Submit nhiều lần không chấm điểm hai lần
  Given Attempt đã ở trạng thái COMPLETED
  When Gọi POST /v1/attempts/{id}/submit lần 2 (do retry)
  Then HTTP 200 trả về kết quả cũ
  And Điểm số không thay đổi
```

---

## 11. Test Matrix

| Mã TC | Phân loại | Mô tả kịch bản | Tiền điều kiện | Dữ liệu test | Kết quả mong đợi |
| :--- | :--- | :--- | :--- | :--- | :--- |
| TC_S03_TIMER_01 | Happy Path | Timer tính giờ chính xác sau khi ẩn tab | deadline = now + 60 phút | Ẩn tab 5 phút | Hiển thị ~55:00, sai lệch < 2s |
| TC_S03_TIMER_02 | Happy Path | F5 reload không reset timer | deadline = now + 45:30 | Bấm F5 | Workspace load, timer ~45:30 |
| TC_S03_TIMER_03 | Happy Path | PRACTICE ẩn timer | test_mode=PRACTICE, deadline=null | Render workspace | Không có TimerDisplay |
| TC_S03_TIMER_04 | Edge Case | Mở workspace khi đã quá deadline | deadline = 1 giờ trước | Mount component | isExpired=true ngay lập tức, Overlay hiện |
| TC_S03_AS_01 | Happy Path | Autosave gọi API sau 15s | isDirty=true | Chờ 15s | PUT /answers được gọi, isDirty=false |
| TC_S03_AS_02 | Happy Path | Không gọi API khi không đổi | isDirty=false | Chờ 15s | 0 network request |
| TC_S03_AS_03 | Negative | API lỗi → retry tự động | isDirty=true, server trả 500 | Trigger autosave | saveStatus='error'; 15s sau tự retry |
| TC_S03_AS_04 | Edge Case | Không gọi 2 lần cùng lúc | isDirty=true, saveStatus='saving' | Interval fire | Bỏ qua (guard condition) |
| TC_S03_LS_01 | Edge Case | Lưu vào localStorage khi setAnswer | Workspace load | dispatch setAnswer | localStorage['exam_draft_42'] có đáp án |
| TC_S03_LS_02 | Edge Case | Khôi phục từ localStorage | localStorage.version > server.version | Mount workspace | Toast khôi phục + đáp án cũ hiện lên |
| TC_S03_SUB_01 | Happy Path | Nộp bài thủ công thành công | isDirty=false | Bấm nộp → xác nhận | Overlay, POST submit, redirect result |
| TC_S03_SUB_02 | Negative | Nộp bài bị chặn khi isDirty=true | isDirty=true | Bấm nộp | Toast cảnh báo, không mở modal |
| TC_S03_SUB_03 | Happy Path | Auto-submit khi hết giờ | Timer isExpired=true | Timer → 0 | Overlay tự động, POST submit gọi |
| TC_S03_SUB_04 | Negative | Submit lỗi mạng → retry | submit trả 503 | Bấm nộp | Overlay giữ + nút "Thử nộp lại" |
| TC_S03_SUB_05 | Security | Idempotent submit | attempt đã COMPLETED | POST submit lần 2 | HTTP 200, điểm không đổi |
| TC_S03_WD_01 | System | Watchdog finalize expired attempt | attempt IN_PROGRESS, deadline -5 phút | Cron trigger | status → COMPLETED trong DB |

---

## 12. Lưu ý kỹ thuật cần verify trước khi implement

1. **`WorkspaceResponse.deadline`:** Backend trả `Instant` (ISO-8601 UTC). Frontend cần `Date.parse(deadline)` để ra timestamp ms — kiểm tra JSON serialization thực tế.
2. **`WorkspaceResponse.startTime`:** Hiện đã có trong DTO nhưng chưa có `durationMinutes` — cần thêm field này hoặc tính từ `deadline - startTime`.
3. **`answerSlice.version`:** Hiện đang increment bởi server khi load workspace. Cần quyết định: version do FE tự tăng mỗi lần `setAnswer`, hay chỉ dùng timestamp?
4. **localStorage key collision:** Dùng `exam_draft_${attemptId}` để tránh conflict giữa các lần thi khác nhau.

---

*Spec sẵn sàng. Bước tiếp theo: dùng `writing-plans` để tạo Implementation Plan chia nhỏ các task TDD (2–5 phút mỗi task).*
