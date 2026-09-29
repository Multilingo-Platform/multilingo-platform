# Sprint 02 — Exam Workspace: Design Spec

**Ngày:** 2026-09-29  
**Sprint:** S02 — Workspace và nhập đáp án  
**Tác giả:** TV3  
**Phụ thuộc:** Sprint 01 — `POST /api/v1/attempts`, `GET /api/v1/attempts/{id}` đã GREEN  
**Đầu ra:** Frontend hiển thị đề từ API và nhập được các loại đáp án.

---

## 1. Mục tiêu & Scope

### In-Scope (Sprint 02)
- Routing: `/exams/:examId/start` (scope/mode picker) và `/attempts/:attemptId` (workspace)
- API client có type cho attempt (tạo + đọc workspace)
- Redux slice quản lý đáp án per-part/per-question
- Workspace shell với loading/error/retry
- Render HTML an toàn (DOMPurify)
- Audio player per Part hoặc per group
- Renderer cho 8 loại câu hỏi: SINGLE_CHOICE, TRUE_FALSE_NOT_GIVEN, YES_NO_NOT_GIVEN, MULTIPLE_CHOICE, FILL_IN_THE_BLANK, MAP_LABELING, DIAGRAM_LABELING, MATCHING (FEATURES + HEADINGS), ESSAY
- Question palette với trạng thái answered/blank và keyboard nav

### Out-of-Scope (để Sprint sau)
- Autosave / lưu nháp lên server (Sprint 03)
- Timer và nộp bài (Sprint 05)
- Xem kết quả / điểm (Sprint 04+)
- Chấm Practice (Sprint 06+)
- AI Writing hints/feedback (Sprint 07+)
- Tích hợp auth thật từ TV1 (đang dùng fixture identity)

---

## 2. Quyết định kỹ thuật đã chốt

| Quyết định | Lựa chọn | Lý do |
|---|---|---|
| Answer state | Redux Toolkit slice | Thống nhất với store đã có, sẵn sàng cho Sprint 03 autosave, dễ debug DevTools |
| HTML sanitization | DOMPurify + dangerouslySetInnerHTML | Thư viện chuẩn ~20KB, XSS-safe, đã được audit rộng rãi |
| Scope/mode picker | Màn hình riêng `/exams/:examId/start` | Tách biệt luồng "thiết lập" với luồng "làm bài" |
| Danh sách Section/Part trong Picker | Hardcode form (không fetch) trong Sprint 02 | Endpoint GET exam chưa có; picker chỉ cần input scope/mode/sectionId/partId từ user |
| Attempt status = COMPLETED khi load | Redirect sang placeholder result page | Tránh workspace hiển thị bài đã nộp xong |
| Unknown question type | Render fallback component | Không crash, dễ phát hiện contract mismatch |

---

## 3. Cấu trúc file đề xuất

```
frontend/src/features/exam/
├── api/
│   └── attemptApi.ts              # axios wrapper + TypeScript types
├── components/
│   ├── ScopeModePicker.tsx        # Màn hình chọn scope/mode trước khi tạo attempt
│   ├── WorkspaceShell.tsx         # Container: loading / error / retry / render workspace
│   ├── AudioPlayer.tsx            # Audio player có kiểm soát (pause khi chuyển Part)
│   ├── QuestionPalette.tsx        # Bảng điều hướng câu hỏi (answered/blank + keyboard)
│   ├── content/
│   │   ├── HtmlContent.tsx        # DOMPurify wrapper cho content_html / context_html
│   │   └── MediaDisplay.tsx       # Renderer cho shared_media (image)
│   └── renderers/
│       ├── QuestionRenderer.tsx       # Dispatcher: switch(type) → đúng renderer
│       ├── SingleChoiceRenderer.tsx   # SINGLE_CHOICE → radio buttons
│       ├── TFNGRenderer.tsx           # TRUE_FALSE_NOT_GIVEN + YES_NO_NOT_GIVEN → 3-button group
│       ├── MultipleChoiceRenderer.tsx # MULTIPLE_CHOICE → checkboxes
│       ├── FillInBlankRenderer.tsx    # FILL_IN_THE_BLANK → text input(s)
│       ├── MapLabelingRenderer.tsx    # MAP_LABELING → select/radio với map image
│       ├── DiagramLabelingRenderer.tsx# DIAGRAM_LABELING → text inputs trên diagram
│       ├── MatchingRenderer.tsx       # MATCHING_FEATURES + MATCHING_HEADINGS → select per item
│       └── EssayRenderer.tsx          # ESSAY → textarea có word count
├── store/
│   └── answerSlice.ts             # Redux slice: attemptId, version, answers[partId][qId]
├── hooks/
│   └── useWorkspace.ts            # Custom hook: GET workspace, trả loading/error/data
└── pages/
    ├── ExamStartPage.tsx           # Route /exams/:examId/start
    └── WorkspacePage.tsx           # Route /attempts/:attemptId
```

---

## 4. Routing

Thêm vào `App.tsx` (không xóa routes cũ `/test-audio`, `/test-student`):

```tsx
<Route path="/exams/:examId/start" element={<ExamStartPage />} />
<Route path="/attempts/:attemptId" element={<WorkspacePage />} />
```

---

## 5. API Client (`attemptApi.ts`)

```typescript
// POST /api/v1/attempts
createAttempt(req: CreateAttemptRequest): Promise<ApiResponse<WorkspaceResponse>>

// GET /api/v1/attempts/:id
getWorkspace(attemptId: number): Promise<ApiResponse<WorkspaceResponse>>
```

Dùng `axiosClient` đã có (`src/api/axiosClient.ts`). Response interceptor đã unwrap `response.data`.

**Dependency mới cần install:**
```bash
npm install dompurify
npm install --save-dev @types/dompurify
```

---

## 6. Answer State (Redux Slice)

### State shape
```typescript
interface AnswerState {
  attemptId: number | null;
  version: number;
  // answers[partId][questionId] = AnswerValue
  answers: Record<number, Record<string, AnswerValue>>;
}
```

### Actions
| Action | Payload | Mô tả |
|---|---|---|
| `setAttemptContext` | `{ attemptId, version, savedAnswers: PartAnswers[] }` | Hydrate khi load workspace |
| `setAnswer` | `{ partId, questionId, value: AnswerValue }` | User trả lời / thay đổi đáp án |
| `clearAnswers` | — | Reset khi unmount WorkspacePage |

### Invariants
- `setAnswer` chỉ được ghi khi `attemptId !== null`
- State không bao giờ chứa `correct_answer`
- MULTIPLE_CHOICE bỏ hết → `[]` (mảng rỗng), không phải `null`

---

## 7. Component Interfaces

### `QuestionRenderer`
```typescript
interface QuestionRendererProps {
  question: Question;
  partId: number;
  currentAnswer: AnswerValue;
  onChange: (value: AnswerValue) => void;
}
```
- Switch theo `question.question_type`
- Fallback: `<div>Dạng câu hỏi chưa được hỗ trợ: {question.question_type}</div>`

### `AudioPlayer`
```typescript
interface AudioPlayerProps {
  url: string;
  durationSeconds?: number;
  isActive: boolean;  // false = pause ngay lập tức
}
```

### `HtmlContent`
```typescript
interface HtmlContentProps {
  html: string | null;
  className?: string;
}
```
- `null` → render nothing
- Luôn qua `DOMPurify.sanitize(html, { USE_PROFILES: { html: true } })`

---

## 8. Data Flow

```
User click "Bắt đầu"
  → ScopeModePicker.onSubmit()
  → attemptApi.createAttempt(req)
  → navigate("/attempts/" + data.attempt_id)

WorkspacePage mount
  → useWorkspace(attemptId)
  → attemptApi.getWorkspace(attemptId)
  → if COMPLETED → navigate("/attempts/" + id + "/result")
  → else dispatch(setAttemptContext(...))
  → WorkspaceShell render sections > parts > groups > questions

User chọn đáp án
  → QuestionRenderer.onChange(value)
  → dispatch(setAnswer({ partId, questionId, value }))
  → QuestionPalette tự update (selector từ slice)
```

---

## 9. Error Handling

| Tình huống | Xử lý UI |
|---|---|
| GET workspace 404 | "Không tìm thấy phiên thi" + nút về trang chủ |
| GET workspace 403 | "Bạn không có quyền xem phiên thi này" |
| GET workspace network error | Thông báo lỗi mạng + nút "Thử lại" |
| Attempt đã COMPLETED | Redirect sang `/attempts/:id/result` (placeholder) |
| Audio URL lỗi | Fallback text, không crash |
| content_html chứa script | DOMPurify strip hoàn toàn |
| question_type không nhận dạng | Fallback component, không crash |
| POST createAttempt thất bại | Hiển thị lỗi tại ScopeModePicker, giữ nguyên form |

---

## 10. Acceptance Criteria

### AC-01: Routing
```gherkin
Scenario: Tạo phiên thi mới từ ExamStartPage
  Given user ở /exams/1/start
  When chọn FULL_EXAM + MOCK_TEST và bấm "Bắt đầu"
  Then POST /api/v1/attempts với { exam_id:1, test_scope:"FULL_EXAM", test_mode:"MOCK_TEST", section_id:null, part_id:null }
  And redirect sang /attempts/{id}
  And workspace được render

Scenario: Truy cập workspace đang IN_PROGRESS
  Given attempt 5 = IN_PROGRESS
  When navigate tới /attempts/5
  Then GET /api/v1/attempts/5 được gọi
  And đáp án đã lưu hydrate vào Redux
```

### AC-02: Scope/Mode Picker
```gherkin
Scenario: scope = SINGLE_SKILL hiển thị chọn Section
  Given user ở ExamStartPage
  When chọn scope SINGLE_SKILL
  Then hiện input chọn section_id
  And part_id không bắt buộc / ẩn

Scenario: scope = SINGLE_PART
  When chọn scope SINGLE_PART
  Then hiện input chọn section_id VÀ part_id
```

**Business rules:**
- FULL_EXAM → section_id = null, part_id = null
- SINGLE_SKILL → section_id bắt buộc, part_id = null
- SINGLE_PART → cả hai bắt buộc
- Nút "Bắt đầu" disabled khi chưa điền đủ field bắt buộc

### AC-03: Answer State
```gherkin
Scenario: Chọn đáp án không làm mất câu khác
  Given answers[1]["q_001"] = "A"
  When chọn B cho q_002
  Then Redux: answers[1]["q_001"] = "A" VÀ answers[1]["q_002"] = "B"

Scenario: Chuyển Part giữ đáp án cũ
  Given answers[1]["q_001"] = "A"
  When chuyển sang Part 2
  Then answers[1]["q_001"] vẫn = "A"
```

### AC-04: HTML Render an toàn
```gherkin
Scenario: XSS bị chặn
  Given content_html = "<p>ok</p><script>alert(1)</script>"
  When HtmlContent render
  Then DOM không có thẻ <script>

Scenario: HTML hợp lệ render đúng
  Given content_html = "<h3>T</h3><p><strong>B</strong></p>"
  When render
  Then DOM đúng cấu trúc h3 + p + strong

Scenario: null không crash
  Given html = null
  When HtmlContent render
  Then không render gì, không crash
```

### AC-05: Audio Player
```gherkin
Scenario: Chuyển Part dừng audio cũ
  Given Part 1 đang phát audio
  When chuyển sang Part 2
  Then audio Part 1 bị pause

Scenario: URL lỗi → fallback
  Given audio URL trả lỗi
  When onerror fire
  Then hiển thị fallback text, không crash
```

### AC-06: Question Renderers
**AnswerValue shape theo type:**
- SINGLE_CHOICE → `string` (option id)
- MULTIPLE_CHOICE → `string[]`
- TRUE_FALSE_NOT_GIVEN → `"TRUE" | "FALSE" | "NOT GIVEN"`
- YES_NO_NOT_GIVEN → `"YES" | "NO" | "NOT GIVEN"`
- FILL_IN_THE_BLANK → `string`
- MAP_LABELING → `string` (option id)
- DIAGRAM_LABELING → `string`
- MATCHING_FEATURES / MATCHING_HEADINGS → `string`
- ESSAY → `string`
- Unknown → fallback, không crash

### AC-07: Question Palette
```gherkin
Scenario: Palette answered/blank chính xác
  Given Part 1 có 10 câu, đã trả lời q_001/q_003/q_005
  When render QuestionPalette
  Then ô 1, 3, 5 có style "answered", ô còn lại "blank"

Scenario: Keyboard Enter di chuyển tới câu hỏi
  Given focus tại ô số 3
  When bấm Enter
  Then scroll/focus tới question q_003
```

---

## 11. Test Matrix

| Mã TC | Phân loại | Mô tả | Tiền điều kiện | Dữ liệu test | Kết quả mong đợi |
|:---|:---|:---|:---|:---|:---|
| TC_WS_ROUTE_01 | Happy Path | Navigate workspace hợp lệ | attempt 5 IN_PROGRESS | attemptId=5 | Render workspace, hydrate Redux |
| TC_WS_ROUTE_02 | Negative | Workspace người khác | attempt 6 = user khác | attemptId=6 | 403 → thông báo không có quyền |
| TC_WS_ROUTE_03 | Negative | Attempt không tồn tại | không có attempt 999 | attemptId=999 | 404 → error + nút retry |
| TC_WS_ROUTE_04 | Edge Case | Attempt COMPLETED | attempt 7 COMPLETED | attemptId=7 | Redirect sang result placeholder |
| TC_WS_PICKER_01 | Happy Path | FULL_EXAM + MOCK_TEST | /exams/1/start | scope=FULL_EXAM, mode=MOCK_TEST | POST đúng payload, redirect |
| TC_WS_PICKER_02 | Boundary | Bắt đầu thiếu mode | chưa chọn mode | scope=FULL_EXAM | Nút disabled |
| TC_WS_PICKER_03 | Boundary | SINGLE_PART thiếu part_id | scope=SINGLE_PART, sectionId=1 | — | Nút disabled |
| TC_WS_ANS_01 | Happy Path | SINGLE_CHOICE → string | workspace load | partId=1, qId="q_001", option A | answers[1]["q_001"] = "A" |
| TC_WS_ANS_02 | Edge Case | Chuyển Part giữ đáp án | answers[1]["q_001"]="A" | Navigate Part 2 | answers[1]["q_001"] vẫn = "A" |
| TC_WS_ANS_03 | Happy Path | MULTIPLE_CHOICE add/remove | workspace load | Click B, C, bỏ B | answers = ["C"] |
| TC_WS_ANS_04 | Edge Case | MULTIPLE_CHOICE bỏ hết | answers=["B"] | Bỏ chọn B | answers = [] (không phải null) |
| TC_WS_HTML_01 | Security | XSS script tag bị strip | — | `<p>ok</p><script>alert(1)</script>` | Không có script trong DOM |
| TC_WS_HTML_02 | Security | Event handler bị strip | — | `<img onerror="alert(1)" src="x">` | onerror bị xóa |
| TC_WS_HTML_03 | Happy Path | HTML hợp lệ render đúng | — | `<h3>T</h3><p><strong>B</strong></p>` | DOM đúng cấu trúc |
| TC_WS_HTML_04 | Edge Case | html = null | — | html=null | Không render gì, không crash |
| TC_WS_AUDIO_01 | Happy Path | Mount với URL hợp lệ | — | url="http://cdn/a.mp3" | audio src đúng URL |
| TC_WS_AUDIO_02 | Negative | URL lỗi → fallback | — | onerror fire | Fallback text, không crash |
| TC_WS_AUDIO_03 | Edge Case | Chuyển Part → pause | Part 1 đang play | Navigate Part 2 | pause() gọi trên audio Part 1 |
| TC_WS_QTYPE_01 | Happy Path | SINGLE_CHOICE → radio | — | 4 options | 4 radio buttons |
| TC_WS_QTYPE_02 | Happy Path | TRUE_FALSE_NOT_GIVEN → 3 button | — | type=TRUE_FALSE_NOT_GIVEN | 3 buttons |
| TC_WS_QTYPE_03 | Happy Path | YES_NO_NOT_GIVEN → 3 button | — | type=YES_NO_NOT_GIVEN | 3 buttons |
| TC_WS_QTYPE_04 | Happy Path | FILL_IN_THE_BLANK → input | — | type=FILL_IN_THE_BLANK | input text render |
| TC_WS_QTYPE_05 | Happy Path | ESSAY → textarea | — | type=ESSAY | textarea render |
| TC_WS_QTYPE_06 | Happy Path | MULTIPLE_CHOICE → checkboxes | — | 4 options | 4 checkboxes |
| TC_WS_QTYPE_07 | Edge Case | Unknown type → fallback | — | type="FUTURE_TYPE" | Fallback text, không crash |
| TC_WS_PAL_01 | Happy Path | Palette answered/blank | 3/10 câu đã trả lời | — | 3 ô answered, 7 ô blank |
| TC_WS_PAL_02 | UI/UX | Keyboard Enter | Focus ô câu 3 | Bấm Enter | Scroll/focus q_003 |
| TC_WS_PAL_03 | Boundary | Palette 40 câu IELTS | 40 questions | Render palette | 40 ô hiển thị đủ |

---

## 12. Lưu ý Type mismatch cần verify trước khi implement

Contract JSON (`content-data-schema.md`) dùng field `"type"` cho question type.  
TypeScript types hiện tại (`exam.types.ts`) dùng `question_type`.  
Backend `WorkspaceResponse` là nguồn thật — cần kiểm tra field name trong response thực tế trước khi implement renderer.

---

*Spec sẵn sàng để chuyển sang `writing-plans` tạo implementation plan.*
