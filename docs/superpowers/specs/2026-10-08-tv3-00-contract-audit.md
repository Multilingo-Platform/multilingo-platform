# TV3-00 — Audit và thiết lập hợp đồng triển khai TV3

**Ngày audit:** 2026-10-08  
**Nhánh:** `feature/TV3-00-contract-audit`  
**Phạm vi:** UC08, UC08.4, UC08.5, UC09/09.1, UC09.2, UC10/10.1, UC10.2  
**Deferred khỏi TV3-00, không loại khỏi kế hoạch TV3:** UC08.1 chi tiết highlight.  
**Ngoài phạm vi:** sửa production code, migration, commit; dictionary/flashcard của TV5; API authoring/catalog của TV2.

## 1. Nguồn bằng chứng

Audit dựa trên:

- `GEMINI.md`, `.agents/README.md`, `.agents/rules/*`.
- `PHAN_CONG_NHIEM_VU_5_NGUOI.md`.
- `Dac_ta_Usecase_UC08_UC10.md`.
- `docs/ndt/contracts/content-data-schema.md`.
- Mã nguồn và test hiện tại trong `backend/.../modules/testing/`, `backend/.../modules/exam/`, `frontend/src/features/exam/`, `frontend/src/features/exams/`.

Hợp đồng nội dung chuẩn được lấy từ `content-data-schema.md`: `ExamPart.content_data` chứa `part_title`, `instruction`, `shared_audio`, `shared_media`, `content_html`, `question_groups[]`; câu hỏi nằm trong `question_groups[].questions[]`.

## 2. Trạng thái triển khai hiện tại

| Khu vực | Trạng thái | Bằng chứng chính |
|---|---|---|
| Tạo attempt | Một phần | Có `POST /api/v1/attempts`, xác định user từ JWT và tạo snapshot; chưa kiểm tra đề đã publish. |
| Chọn scope/mode | Một phần | Backend có `FULL_EXAM`, `SINGLE_SKILL`, `SINGLE_PART`; frontend dùng ID section/part cố định `1,2,3`. |
| Workspace | Một phần | Có create/resume, timer, renderer, autosave hook; snapshot DB adapter không đọc schema nhóm chuẩn. |
| Autosave/resume | Một phần, chưa an toàn | Có lưu `attempt_answers`; request có `version`, nhưng backend bỏ qua version và response workspace không trả `version`/`savedAnswers`. |
| Section lock | Một phần | Có endpoint lock; chưa xác thực section thuộc attempt và write vào section đã lock bị bỏ qua im lặng. |
| Timeout | Một phần | Có timer client, scheduler và lazy finalize; luồng lỗi client có thể chuyển trang dù submit thất bại. |
| Submit idempotent | Có nền tảng | Backend khóa row và trả trạng thái hiện có khi attempt đã kết thúc. `baseVersion` chưa được kiểm tra. |
| Chấm khách quan | Một phần | Có engine thuần domain và lưu kết quả; adapter chỉ đọc `content_data.questions` dạng phẳng. |
| Result | Backend một phần, frontend giả lập | Backend có endpoint; `ExamResultPage` đang dùng dữ liệu hardcode và không gọi API. |
| Review | Một phần, hợp đồng lệch | Có endpoint owner-only; frontend dùng tab part cố định và shape câu hỏi/kết quả không khớp backend. |
| Gemini Writing Hints | Chưa có | Không có controller/service/provider/quota integration cho hint. |
| Gemini Writing Grading | Chưa hoàn chỉnh | Submit có thể vào `AI_GRADING`/`AI_GRADING_QUEUED`, nhưng không có worker/provider hoàn tất chấm. |

## 3. Ánh xạ use case sang mã nguồn

| Use case | Hiện có | Thiếu/không đúng |
|---|---|---|
| UC08 — làm bài | `TestAttemptController`, `TestAttemptServiceImpl`, `WorkspacePage`, renderer | Đề publish, catalog thật, ID động, canonical content, resume từ server, giữ draft khi lỗi mạng. |
| UC08.1 — highlight | Có utility/component và test highlight ở frontend | **Deferred:** chưa audit/điều chỉnh trong TV3-00; vẫn là trách nhiệm TV3 và phải đưa vào kế hoạch sau khi workspace contract ổn định. |
| UC08.4 — gợi ý Writing | Không có triển khai | Practice-only, quota, Gemini backend-only, retry/fallback, 5–10 từ vựng. |
| UC08.5 — hết giờ | `useExamTimer`, `TimeUpOverlay`, scheduler, submit reason | Khóa input chắc chắn, retry an toàn, không chuyển trang giả khi submit lỗi, ranh giới grace thống nhất. |
| UC09/09.1 — chấm khách quan | `ObjectiveGradingServiceImpl` | Loại câu canonical, key nhóm, đáp án thay thế nằm trong `correct_answer`, dữ liệu part không có câu trả lời. |
| UC09.2 — chấm Writing | Trạng thái AI trong attempt | Không có Gemini worker, tiêu chí, retry 3 lần, too-short = 0, feedback/diff. |
| UC10/10.1 — kết quả/review | Hai endpoint backend, trang review cơ bản | Result hardcode; review shape lệch; chưa có explanation/correct answer an toàn sau submit. |
| UC10.2 — Writing feedback | Không có | Polling trạng thái, 4 tiêu chí, corrected essay và diff. |

## 4. Các khoảng trống đã xác nhận

### P0 — chặn tính đúng và an toàn

1. **Adapter đọc sai cấu trúc nội dung chuẩn.** `DbExamAdapter` và `DbGradingAdapter` đọc `content_data.questions`; tài liệu chuẩn đặt câu hỏi trong `question_groups[].questions[]`.
2. **Sanitize không đệ quy.** `DbExamAdapter` chỉ xóa `correct_answer` và `explanation` ở list phẳng; không xóa `ai_prompt_context` và không xử lý JSON lồng nhau.
3. **Workspace không trả trạng thái lưu có thẩm quyền.** `WorkspaceResponse` thiếu `version` và `savedAnswers`, trong khi frontend cần cả hai để resume.
4. **Optimistic locking chưa hoạt động.** Backend không so sánh/tăng `version`; `baseVersion` khi submit cũng bị bỏ qua.
5. **Không ràng buộc answer vào scope/snapshot.** Autosave có thể nhận `partId`/`questionId` không thuộc attempt.
6. **Attempt có thể tạo từ đề chưa publish.** `DbExamAdapter.findById` không lọc `published`.
7. **Review chưa có nguồn dữ liệu đúng và bất biến.** Snapshot hiện tại bị lược bỏ grading key/explanation; đọc trực tiếp nội dung TV2 sau này có thể thay đổi so với lúc bắt đầu attempt.
8. **AI grading bị kẹt.** Có trạng thái `AI_GRADING`/`AI_GRADING_QUEUED` nhưng không có worker để đi tới `COMPLETED` hoặc `GRADING_FAILED`.

### P1 — sai hành vi use case/API

1. `MATCHING_FEATURES` và `MATCHING_HEADINGS` bị coi là loại không hợp lệ; engine chỉ nhận `MATCHING`.
2. `FILL_IN_THE_BLANK`/`DIAGRAM_LABELING` không xử lý đúng `correct_answer` dạng mảng theo schema.
3. Frontend và backend dùng hai shape snapshot khác nhau; frontend dựa nhiều vào `any` và fallback.
4. `AttemptStatus` frontend thiếu `SUBMITTED`, `AI_GRADING_QUEUED`, `GRADING_FAILED`, `EXPIRED`.
5. Frontend dùng verdict `INCORRECT/SKIPPED` hoặc boolean; backend dùng `CORRECT/WRONG/BLANK`.
6. `ScopeModePicker`, `ExamStartPage`, `ExamResultPage`, tab part của `ExamReviewPage` dùng dữ liệu cố định.
7. Khi submit lỗi, workspace xóa local draft; timeout có thể chuyển sang result dù server chưa nhận submit.
8. Không có luồng phục hồi draft từ localStorage khi mở lại trang.
9. Lock section không báo lỗi khi ghi vào phần đã khóa và không kiểm tra section thuộc attempt.
10. `timeSpentSeconds` không được cập nhật.
11. Review/result được trả ở các trạng thái AI chưa hoàn tất; policy “fully graded” của UC10 chưa được áp dụng thống nhất.
12. Phát hiện Writing dựa vào tên section chứa `WRITING`, không dựa vào câu `ESSAY`.

### P2 — chất lượng hợp đồng và test

1. Chưa có test DB adapter với JSON canonical có nhiều `question_groups`.
2. Test sanitize hiện tại không dùng payload lồng sâu độc hại.
3. Test frontend mock theo shape riêng nên không phát hiện tích hợp backend/frontend bị lệch.
4. Repository không khai báo thứ tự section/part; thứ tự hiển thị có thể không ổn định.
5. TV2 builder hiện sinh các tên/type khác schema (`shared_content_html`, metadata, `MULTIPLE_CHOICE_MULTI`, `WRITING_ESSAY`).

## 5. Hợp đồng API đề xuất

Nguyên tắc:

- Giữ nguyên các endpoint đã tồn tại; không thêm endpoint hoặc cột DB trong TV3-00.
- JSON outer DTO dùng camelCase theo Jackson hiện tại; `content_data` giữ đúng snake_case theo schema tài liệu.
- Mọi endpoint attempt lấy user từ SecurityContext, không nhận `userId` từ client.
- Workspace luôn là bản sao đã sanitize đệ quy. Dữ liệu grading nội bộ không được trả trước khi policy cho phép.

### 5.1 Các endpoint hiện có

| Endpoint | Request chuẩn hóa | Response/quy tắc đề xuất |
|---|---|---|
| `POST /api/v1/attempts` | `{examId,testScope,testMode,targetSectionId?,targetPartId?}` | `201 WorkspaceResponse`; chỉ đề publish; ID mục tiêu phải thuộc đề; scope cắt đúng snapshot. |
| `GET /api/v1/attempts/{id}/workspace` | Không có body | Chỉ owner; trả cùng `WorkspaceResponse`, gồm answers/version có thẩm quyền; lazy timeout nếu quá deadline + grace. |
| `PUT /api/v1/attempts/{id}/answers` | `{version,answers:[{part_id,answers:[{question_id,answer}]}]}` | Chỉ `IN_PROGRESS`; version phải khớp; part/question thuộc scope; tăng và trả version mới. Sai version/state/lock trả conflict, không bỏ qua im lặng. |
| `POST /api/v1/attempts/{id}/sections/{sectionId}/lock` | Không có body | Chỉ owner, `FULL_EXAM + MOCK_TEST + IN_PROGRESS`; section thuộc snapshot; idempotent. |
| `POST /api/v1/attempts/{id}/submit` | `{reason,baseVersion?,finalAnswers?}` | Owner-only, atomic, idempotent; `TIMEOUT_SERVER` chỉ do server tạo; final answers tuân cùng validation autosave. |
| `GET /api/v1/attempts/{id}/result` | Không có body | Chỉ owner; chỉ trả kết quả hoàn chỉnh khi `COMPLETED`; trạng thái AI chưa xong trả “not ready” nhất quán. |
| `GET /api/v1/attempts/{id}/review/{partId}` | Không có body | Chỉ owner, sau submit theo policy; part thuộc scope; không trả `ai_prompt_context`; correct answer/explanation chỉ xuất hiện tại đây sau khi được phép. |

`GET /api/v1/attempts/{id}` đang là alias của workspace. Nên giữ để tương thích, nhưng frontend chỉ dùng `/workspace`.

### 5.2 WorkspaceResponse tối thiểu

Các field đã tồn tại được giữ nguyên; bổ sung dữ liệu từ field/bảng hiện có, không cần migration:

```json
{
  "attemptId": 42,
  "status": "IN_PROGRESS",
  "testScope": "FULL_EXAM",
  "testMode": "MOCK_TEST",
  "startTime": "2026-10-08T12:00:00Z",
  "deadline": "2026-10-08T14:00:00Z",
  "serverTime": "2026-10-08T12:01:00Z",
  "gracePeriodSeconds": 15,
  "version": 3,
  "savedAnswers": [
    {"part_id": 10, "answers": [{"question_id": "q1", "answer": "A"}]}
  ],
  "lockedSections": [],
  "examSnapshot": {}
}
```

`examSnapshot` phải giữ nội dung canonical theo từng part, bao gồm `content_html` và `question_groups`, nhưng bản trả về workspace phải xóa đệ quy ít nhất:

- `correct_answer`
- `explanation`
- `ai_prompt_context`
- dữ liệu feedback/chấm AI nếu có

Không mutate object snapshot đang lưu khi sanitize.

### 5.3 Autosave và version

- `version` lấy từ `test_attempts.version` hiện có.
- Server so sánh version trong cùng transaction/row lock.
- Save thành công: ghi toàn bộ answer của các part gửi lên, tăng version đúng một lần và trả version mới.
- Version cũ: không ghi gì, trả conflict để client tải lại workspace.
- Request rỗng không được vô tình xóa câu trả lời cũ trừ khi hợp đồng “clear answer” thể hiện rõ bằng question ID và answer rỗng.
- Mọi write sau submit, expired, section lock hoặc ngoài scope đều bị từ chối rõ ràng.

Response autosave hiện là `ApiResponse<Void>`. Thay đổi nhỏ nhất là trả DTO chỉ chứa `version`; frontend dùng version này làm `baseVersion` tiếp theo.

### 5.4 Submit/state machine

```text
IN_PROGRESS
  ├─ objective-only ───────────────> COMPLETED
  ├─ có ESSAY + quota ─────────────> AI_GRADING ──> COMPLETED | GRADING_FAILED
  ├─ có ESSAY + hết quota ─────────> AI_GRADING_QUEUED
  └─ hết hạn không hoàn tất được ──> EXPIRED
```

- `MANUAL` và `TIMEOUT_CLIENT` là input hợp lệ từ client.
- `TIMEOUT_SERVER` là nguyên nhân nội bộ của scheduler/lazy finalize, không cho client tự chọn.
- Submit lặp lại trả cùng trạng thái/kết quả, không chấm hoặc trừ quota lần hai.
- Payload cuối cùng và chuyển trạng thái phải cùng transaction.
- Grace 15 giây dùng thống nhất giữa request submit, scheduler và lazy finalize.

### 5.5 Result/review

Không tạo một schema tổng hợp mới trong TV3-00. Backend hiện serialize `GradingResult`, vì vậy frontend trước mắt phải dùng đúng shape đang có:

```json
{
  "partResults": {
    "10": {
      "q1": {"questionId": "q1", "verdict": "CORRECT", "score": 1}
    }
  },
  "totalScore": 1,
  "correctCount": 1,
  "totalObjectiveCount": 1,
  "sectionScores": {"READING": 1}
}
```

Review lấy danh sách part từ `partResults`/snapshot thay vì `[1,2,3,4]`. Dữ liệu câu hỏi dùng string `question_id`, `question_text`, option `{id,text}` theo schema.

Để vừa bất biến vừa an toàn, hướng nhỏ nhất cần đánh giá ở task triển khai là lưu snapshot đầy đủ trong trường `exam_snapshot` hiện có, rồi luôn tạo deep-copy đã sanitize khi trả workspace. Review sau submit lấy từ snapshot đó và vẫn loại `ai_prompt_context`. Các attempt cũ có snapshot thiếu key phải được xử lý graceful, không suy đoán đáp án.

### 5.6 Gemini

Repository hiện **không có endpoint Gemini**. Vì yêu cầu không được tự đặt API, TV3-00 chưa chốt URL/request/response mới. Task triển khai chỉ được bắt đầu sau khi thống nhất riêng:

- API hint Practice Writing, quota của TV1 và format 5–10 từ.
- Cơ chế worker/job chấm Writing, retry tối đa 3 lần, trạng thái lỗi.
- Schema 4 tiêu chí, feedback tổng, corrected essay và diff.

Hợp đồng bắt buộc dù chọn endpoint nào:

- Gemini chỉ gọi từ backend; API key qua config/environment.
- Chỉ Practice Writing được xin hint; Mock Test luôn bị từ chối.
- Không log essay, raw prompt, API key hoặc raw response nhạy cảm.
- `ai_prompt_context` không bao giờ ra workspace/preview/start page.
- Bài ≤ 10 từ nhận 0 theo đặc tả và không cần gọi Gemini.
- Parse lỗi có fallback theo use case; lỗi cuối chuyển trạng thái có thể phục hồi, không kẹt vô hạn.

## 6. Acceptance criteria

### AC-01 — Nội dung workspace đúng schema và không rò dữ liệu

**Given** đề publish có nhiều `question_groups` và các key nhạy cảm lồng sâu  
**When** owner tạo hoặc mở lại attempt  
**Then** mọi group/question hợp lệ xuất hiện đúng thứ tự, và response không chứa `correct_answer`, `explanation`, `ai_prompt_context` hoặc AI feedback ở bất kỳ độ sâu nào.

### AC-02 — Scope dùng ID thật

**Given** metadata đề từ server  
**When** người học chọn full exam, một skill hoặc một part  
**Then** frontend gửi đúng ID của đề; backend từ chối ID không thuộc đề và snapshot chỉ chứa scope đã chọn.

### AC-03 — Chỉ đề publish được bắt đầu

**Given** đề không tồn tại hoặc chưa publish  
**When** tạo attempt  
**Then** server không tạo record attempt và không trả nội dung đề.

### AC-04 — Resume có thẩm quyền từ server

**Given** attempt đang làm đã có answers/version/deadline  
**When** reload hoặc đăng nhập lại  
**Then** workspace khôi phục đúng answers, locked sections và timer theo server time; local draft chỉ là fallback rõ ràng.

### AC-05 — Autosave có optimistic locking

**Given** client gửi version hiện tại  
**When** save hợp lệ  
**Then** server lưu atomic và trả version mới; version cũ trả conflict và không ghi đè dữ liệu mới hơn.

### AC-06 — Server kiểm soát phạm vi write

**Given** part/question ngoài snapshot, section đã lock, attempt đã submit hoặc expired  
**When** autosave/final save  
**Then** server từ chối, dữ liệu cũ không đổi và lỗi đủ rõ để UI dừng nhập.

### AC-07 — Timeout và submit idempotent

**Given** Mock Test đến hạn  
**When** client submit trong grace, retry do mạng, hoặc scheduler finalize  
**Then** chỉ có một kết quả cuối; input bị khóa; không chấm/trừ quota hai lần; client không hiển thị hoàn tất trước xác nhận server.

### AC-08 — Chấm đúng các loại câu canonical

**Given** key canonical cho mọi loại khách quan  
**When** chấm câu đúng/sai/trống và accepted alternatives  
**Then** verdict là `CORRECT/WRONG/BLANK`, normalize trim/lowercase đúng, và score/count nhất quán cho `MATCHING_FEATURES`, `MATCHING_HEADINGS`, map/diagram/fill.

### AC-09 — Practice feedback không rò sang Mock Test

**Given** hai attempt cùng đề ở Practice và Mock Test  
**When** còn `IN_PROGRESS`  
**Then** Mock Test không nhận đáp án, explanation hay feedback; mọi chức năng feedback tức thời chỉ cho Practice theo policy đã chốt.

### AC-10 — Result/review dùng dữ liệu thật

**Given** attempt `COMPLETED`  
**When** mở result/review  
**Then** UI gọi API, hiển thị part/question thật, đáp án người học, verdict và explanation được phép; không dùng fixture/tab cố định.

### AC-11 — Ownership và trạng thái

**Given** user khác owner hoặc attempt chưa đạt trạng thái cho phép  
**When** đọc/ghi workspace, answers, submit, result hoặc review  
**Then** server từ chối; không tiết lộ sự tồn tại/nội dung nhạy cảm ngoài policy dự án.

### AC-12 — Writing hint an toàn

**Given** owner ở Practice Writing và còn quota  
**When** yêu cầu hint  
**Then** backend trả outline và 5–10 từ gợi ý, cập nhật quota đúng một lần; Mock Test/hết quota bị từ chối; không lộ prompt/key.

### AC-13 — Writing grading hoàn tất được

**Given** bài Writing đã submit  
**When** bài > 10 từ  
**Then** worker chấm bốn tiêu chí, retry tối đa ba lần, lưu feedback/corrected essay/diff và kết thúc `COMPLETED` hoặc `GRADING_FAILED`; bài ≤ 10 từ nhận 0 không gọi Gemini.

### AC-14 — Không có dữ liệu giả production

**Given** exam/attempt bất kỳ  
**When** mở start, result hoặc review  
**Then** mọi nội dung đến từ API có thẩm quyền; thiếu dependency thì hiển thị trạng thái lỗi/loading, không thay bằng mock response.

## 7. Ma trận test cần có — 29 scenario

| ID | Tầng | Kịch bản | Kết quả mong đợi | Hiện trạng |
|---|---|---|---|---|
| BE-ADP-01 | Unit adapter | Parse 2 group, nhiều câu canonical | Đủ câu, đúng thứ tự | Thiếu |
| BE-SEC-01 | Unit adapter | Key nhạy cảm lồng nhiều cấp | Sanitized đệ quy, source không mutate | Thiếu |
| BE-SEC-02 | Integration | User B truy cập attempt của A trên mọi endpoint | Bị từ chối | Thiếu kiểm thử xuyên endpoint |
| BE-CRT-01 | Service | Đề chưa publish | Không tạo attempt | Thiếu |
| BE-SCP-01 | Service | section/part không thuộc đề | Validation fail | Một phần |
| BE-SAV-01 | Service | Save đúng version | Lưu và tăng version | Thiếu |
| BE-SAV-02 | Service | Hai client cùng version | Một save thắng, save cũ conflict | Thiếu |
| BE-SAV-03 | Service | part/question ngoài scope | Không ghi | Thiếu |
| BE-SAV-04 | Service | save sau lock/submit/expiry | Conflict, không đổi dữ liệu | Một phần |
| BE-RSM-01 | Controller IT | Resume sau autosave | Trả đúng savedAnswers/version | Thiếu |
| BE-SUB-01 | Service | Submit lặp lại | Một kết quả, không side effect lặp | Có nền tảng |
| BE-TMO-01 | Service | Client trong/ngoài grace | Quyết định thống nhất | Một phần |
| BE-TMO-02 | Scheduler | Scheduler và submit chạy đồng thời | Một finalization | Thiếu concurrency test |
| BE-GRD-01 | Unit grading | Tất cả type canonical | Không có unknown type | Thiếu matching canonical |
| BE-GRD-02 | Unit grading | Fill/diagram accepted answer array | Nhận mọi đáp án hợp lệ | Thiếu |
| BE-REV-01 | Integration | Review trước/sau trạng thái cho phép | Chặn/trả đúng policy | Thiếu |
| BE-REV-02 | Integration | Review part ngoài scope | Bị từ chối | Thiếu |
| BE-AI-01 | Unit/service | Hint Practice vs Mock | Chỉ Practice được gọi provider | Chưa có |
| BE-AI-02 | Unit/service | Essay ≤ 10 từ | 0 điểm, không gọi provider | Chưa có |
| BE-AI-03 | Unit/service | Provider lỗi 3 lần/JSON lỗi | Retry/fallback/trạng thái cuối | Chưa có |
| FE-STA-01 | Component | Metadata đề có ID không liên tiếp | Picker gửi đúng ID thật | Test hiện củng cố hardcode |
| FE-RSM-01 | Hook/page | Reload với savedAnswers/version | UI hydrate đúng | Mock có, backend contract thiếu |
| FE-SAV-01 | Hook/page | Autosave 409 | Dừng ghi, báo conflict, cho reload | Một phần |
| FE-OFF-01 | Page | Submit lỗi mạng | Giữ draft, không chuyển result | Thiếu |
| FE-TMO-01 | Page | Hết giờ, retry rồi thành công | Khóa input và chỉ chuyển sau xác nhận | Một phần |
| FE-RES-01 | Page | Result thật objective/AI pending | Render/poll đúng, không hardcode | Thiếu |
| FE-REV-01 | Page | Part IDs động, canonical questions | Tab và review đúng dữ liệu | Thiếu |
| E2E-01 | API/UI | Full Mock Test objective | create → save → timeout/submit → result/review | Thiếu |
| E2E-02 | API/UI | Practice Writing + AI | hint → save → submit → poll → feedback | Chưa thể chạy |

## 8. File dự kiến cần thay đổi ở các task sau

### TV3 backend

- `backend/src/main/java/com/multilingo/backend/modules/testing/adapter/impl/DbExamAdapter.java`
- `backend/src/main/java/com/multilingo/backend/modules/testing/adapter/impl/DbGradingAdapter.java`
- `backend/src/main/java/com/multilingo/backend/modules/testing/adapter/dto/{ExamFixture,SectionFixture,PartFixture}.java`
- `backend/src/main/java/com/multilingo/backend/modules/testing/dto/request/{AutosaveAnswersRequest,SubmitAttemptRequest}.java`
- `backend/src/main/java/com/multilingo/backend/modules/testing/dto/response/{WorkspaceResponse,ExamResultResponse,ExamReviewResponse}.java`
- `backend/src/main/java/com/multilingo/backend/modules/testing/grading/impl/ObjectiveGradingServiceImpl.java`
- `backend/src/main/java/com/multilingo/backend/modules/testing/service/impl/TestAttemptServiceImpl.java`
- `backend/src/main/java/com/multilingo/backend/modules/testing/service/scheduler/AttemptExpirationScheduler.java`
- Test tương ứng trong `backend/src/test/java/com/multilingo/backend/modules/testing/`.

Gemini cần lớp provider/service/worker mới trong module testing, nhưng tên file và API chưa chốt ở TV3-00.

### TV3 frontend

- `frontend/src/features/exam/types/{api.types,answer.types,exam.types}.ts`
- `frontend/src/features/exam/api/attemptApi.ts`
- `frontend/src/features/exam/hooks/{useWorkspace,useAutosave,useExamTimer}.ts`
- `frontend/src/features/exam/store/answerSlice.ts`
- `frontend/src/features/exam/components/ScopeModePicker.tsx`
- `frontend/src/features/exam/pages/{ExamStartPage,WorkspacePage,ExamResultPage,ExamReviewPage}.tsx`
- Test tương ứng trong `frontend/src/features/exam/**/__tests__/`.

### Biên sở hữu TV2 — chỉ thay sau khi thống nhất

- Read-only student exam metadata/detail API để start page và picker nhận đề publish, section, part, duration.
- Validation/normalization `ExamPart.content_data` theo tài liệu canonical.
- Thứ tự section/part ổn định.
- TV3 không sửa admin authoring/catalog trong task triển khai nếu chưa thống nhất với TV2.

## 9. Rủi ro và dependency

| Rủi ro/dependency | Mức | Xử lý đề xuất |
|---|---|---|
| TV2 builder sinh dữ liệu khác schema tài liệu | Cao | Chốt một canonical contract; thêm contract test chung trước khi sửa UI workspace. |
| Chưa có student-facing exam detail API | Cao | TV2 cung cấp read-only published metadata; TV3 không dùng admin API. |
| Snapshot an toàn vs review bất biến | Cao | Lưu full snapshot server-side trong field hiện có, sanitize deep-copy khi trả workspace; review chỉ sau policy. |
| Attempt cũ có snapshot shape cũ | Cao | Parser tolerant và fallback “không có dữ liệu review”; không suy đoán key. |
| Gemini quota thuộc TV1 | Cao | Dùng một port/service quota rõ ràng, idempotency key theo attempt/action. |
| Provider Gemini lỗi/latency/JSON sai | Cao | Backend-only, timeout, retry hữu hạn, trạng thái terminal, không log nội dung nhạy cảm. |
| Cạnh tranh submit/scheduler/autosave | Cao | Row lock + version + transaction + concurrency tests. |
| Practice feedback rò vào Mock Test | Cao | Policy check ở service backend, không chỉ ẩn nút frontend. |
| Thay đổi DTO gây vỡ frontend hiện tại | Trung bình | Giữ alias khi hợp lý, thêm contract tests, chuyển frontend/backend trong cùng task nhỏ. |
| Không có duration ở ExamPart | Trung bình | SINGLE_PART Mock Test cần quyết định từ TV2: duration nguồn nào; không tự thêm cột. |

## 10. Thứ tự triển khai nhỏ nhất và an toàn

1. **Chốt biên TV2 + contract tests:** canonical `content_data`, published metadata, thứ tự và duration; thêm test adapter/sanitize trước.
2. **Sửa workspace/resume:** snapshot canonical, sanitize đệ quy, `savedAnswers/version`, validate scope và ID thật.
3. **Sửa write lifecycle:** optimistic lock, autosave response, lock, submit atomic/idempotent, timeout/grace và offline retry.
4. **Sửa objective grading:** đọc key từ group và hỗ trợ đúng tất cả type/answer canonical.
5. **Sửa result/review:** dùng API thật, part động, policy trạng thái và nguồn explanation bất biến.
6. **Thiết kế rồi làm Gemini hints:** chỉ sau khi TV1 quota contract sẵn sàng.
7. **Thiết kế rồi làm Gemini grading worker:** state transition, retry, feedback/diff, polling UI.
8. **Deferred UC08.1 — Highlight:** audit riêng behavior lưu/khôi phục highlight, giới hạn theo passage/part và regression sau khi workspace contract ổn định; không xem UC08.1 là bị loại khỏi TV3.
9. **Chạy integration/E2E và security regression** cho Mock Test, Practice, ownership và data leakage.

Mỗi bước sau TV3-00 phải làm TDD: test đỏ tập trung → thay đổi nhỏ nhất → test xanh → refactor → chạy test/build liên quan. Không tự động bắt đầu TV3-01 từ tài liệu này.

## 11. Kết luận quyết định TV3-00

- Có thể tái sử dụng nền tảng attempt, ownership query, scheduler và objective grading hiện tại.
- Chưa thể coi luồng TV3 production-ready vì contract nội dung, resume/version, result/review và AI grading chưa khép kín.
- Ưu tiên đầu tiên không phải Gemini mà là contract TV2–TV3 và chống rò dữ liệu ở snapshot.
- Không cần migration để sửa phần lớn P0: `version`, `attempt_answers`, `exam_snapshot`, `result_summary`, `ai_feedback` đã tồn tại.
- Không triển khai API Gemini trước khi có quyết định contract riêng; TV3-00 không đặt tên endpoint mới.
- Ma trận kiểm thử gồm đúng **29 scenario**; UC08.1 được đánh dấu **deferred**, không bị loại khỏi kế hoạch TV3.

## 12. Kết quả kiểm chứng baseline

| Lệnh | Kết quả |
|---|---|
| `backend/.\mvnw.cmd clean test` | **FAIL:** 208 test, 10 failure, 27 error. Nhóm testing dùng `DbExamAdapter`/`DbGradingAdapter` có `@Primary` trong profile test thay vì fixture adapter, nên DB rỗng dẫn đến `Exam not found`, 404/403 và grading key rỗng. Đây là lỗi baseline, TV3-00 không sửa production code. |
| `backend/.\mvnw.cmd "-Dtest=ObjectiveGradingServiceTest,SubmitAttemptRequestTest" test` | **PASS:** 34 test, 0 failure, 0 error. |
| `frontend/npm test -- --run` | **PASS:** 27 test file, 154 test. |
| `frontend/npm run build` | **PASS:** TypeScript và Vite build thành công; có warning chunk chính lớn hơn 500 kB. |

Việc frontend test xanh không phủ nhận các gap tích hợp: test hiện dùng mock/shape nội bộ và chưa chạy với response thật của backend.
