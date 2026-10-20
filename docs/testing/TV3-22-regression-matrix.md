# Ma Trận Regression & Traceability Toàn Bộ TV3 (TV3-04–21 & TOEIC R1)

**Tài liệu:** `docs/testing/TV3-22-regression-matrix.md`  
**Ngày thiết lập:** 2026-10-18  
**Baseline Git Commit:** `5b3442efffb7c098b86eb1833408a1903b5d21ff`  
**Nhánh:** `feature/TV3-00-contract-audit`  
**Trạng thái Workbook Template:** SHA-256 `2A9045FE5FAB8562ED675D1EA9991CD476DB32910A5C6507636869FADD8781B8` (Bất biến)  
**Trạng thái final gate:** **PASS** — Broad gate 5/5 step PASS ngày 2026-10-19 sau re-FIX G-01/G-02 (vòng 1) và re-FIX R-01–R-04 theo full-feature review (vòng 2; xem mục 6); AC-08/AC-09 PASS, chờ Codex re-review.

---

## 1. Mục Tiêu & Kiến Trúc Kiểm Chứng

Tài liệu này xác lập ma trận đối soát truy xuất nguồn gốc (Traceability Matrix) và quy chuẩn nghiệm thu cho toàn bộ nền tảng TV3 (TV3-04 đến TV3-21) cùng bản sửa đổi TOEIC Workspace Fixes R1. Ma trận phân định ranh giới kỹ thuật rõ ràng giữa các tầng kiểm thử, ngăn chặn việc nhầm lẫn giữa kiểm thử cục bộ/mock và kiểm thử tích hợp thực tế.

### Phân Định Ranh Giới Kỹ Thuật (Test Scope & Boundaries)

1. **Unit & Calculation Tests (Thuần Logic / In-Memory):**
   - *Phạm vi:* Kiểm tra thuật toán, phép chiếu số câu, tính toán timeline, chuẩn hóa cấu trúc dữ liệu, Redux reducers.
   - *Đặc điểm:* Chạy trên JVM/Node.js, không kết nối cơ sở dữ liệu hay mạng bên ngoài. Không được coi là kiểm thử End-to-End.
   - *Ví dụ:* `ToeicWorkspaceProjectionTest`, `ListeningPlaybackTimelineTest`, `ToeicListeningMediaProfileTest`, `examPartUtils.test.ts`.

2. **Backend Slice & Contract Integration Tests (Spring MockMvc + H2 / Repository):**
   - *Phạm vi:* Kiểm tra toàn bộ luồng HTTP REST API, serialization, Spring Security filter chain, Bean validation, phân quyền `CustomUserDetails`, xử lý ngoại lệ `AppException`, và hợp đồng dữ liệu DTO.
   - *Đặc điểm:* Sử dụng H2 in-memory DB và fake service/provider boundary. Chứng minh hành vi controller và serialization chính xác.
   - *Ví dụ:* `ListeningPlaybackContractIT`, `PracticeFeedbackContractIT`, `ResultSummaryContractIT`, `ExamReviewContractIT`, `WritingFeedbackContractIT`, `WritingHintsContractIT`, `WritingGradingLifecycleIT`.

3. **Database Concurrency & Transactional Tests (PostgreSQL Test Riêng Biệt):**
   - *Phạm vi:* Kiểm tra khóa bi quan (`SELECT ... FOR UPDATE`), transaction rollback, độ chính xác số thực (`numeric(10,2)` sau migration TV3), ràng buộc duy nhất (Unique Constraints), cascading deletes, và Flyway migrations.
   - *Đặc điểm:* BẮT BUỘC thực thi trên cơ sở dữ liệu PostgreSQL thử nghiệm độc lập (`TV3_PG_TEST_*`, `TW03_POSTGRES_TEST_*`, `TW04_POSTGRES_TEST_*`). Tuyệt đối không dùng DB production hay DB chứa dữ liệu người dùng. Không chấp nhận trạng thái SKIP khi thiếu thông tin đăng nhập.
   - *Ví dụ:* `ResultScorePrecisionPostgresIT`, `ExamReviewPostgresIT`, `WritingHintPostgresIT`, `WritingGradingPostgresIT`, `AttemptListeningPlaybackPostgresIT`, `ListeningPlaybackStartConcurrencyPostgresIT`.

4. **Frontend Integration & Contract Tests (Vitest + React Testing Library + Redux Store Thật):**
   - *Phạm vi:* Kiểm tra vòng đời giao diện từ Router -> Store -> Components -> API clients/normalizers thật.
   - *Đặc điểm:* Chỉ mock tại ranh giới HTTP network, Clock, và HTMLAudioElement. Không mock hooks nghiệp vụ của chính tính năng.
   - *Ví dụ:* `ToeicWorkspaceContract.test.tsx`, `WorkspacePage.test.tsx`, `writingFeedbackPageContract.test.tsx`, `autosaveSubmitContract.test.tsx`, `tv3LifecycleContract.test.tsx`.

5. **Browser Smoke & Accessibility Verification (Playwright / Browser Context):**
   - *Phạm vi:* Kiểm tra hiển thị responsive (375px, 768px, 1366px, 1920px), điều hướng phím (keyboard tab/space/enter navigation), tương phản, aria labels, và hành vi cuộn độc lập.
   - *Đặc điểm:* Chạy với fixture/API mock kiểm soát, không gọi Gemini AI hay tải CDN âm thanh thật.

---

## 2. Ma Trận Traceability TV3-04 – TV3-21 & TOEIC Workspace Fixes R1

**Quy ước đường dẫn (đã kiểm chứng tồn tại trên repo ngày 2026-10-19):**

- `BT` = `backend/src/test/java/com/multilingo/backend/modules/testing`
- `BA` = `backend/src/test/java/com/multilingo/backend/modules/analytics`
- `FT` = `frontend/src/features/exam/__tests__`
- `FP` = `frontend/src/features/exam/pages/__tests__`

**Quy ước evidence theo tên log do runner tạo:** Focused → `01_backend_focused.log` + `02_frontend_focused.log`; Broad → `01_backend_broad.log` + `02_frontend_full.log`; Postgres → `01_postgres_tv3_suites.log` + `02_postgres_playback_suites.log`; các log nằm trong `.superpowers/tv3-22/<ts>/`. Mọi feature đều được Broad chạy đủ (backend broad = toàn bộ backend tests, frontend full = toàn bộ frontend tests), nên "Focused, Broad" nghĩa lớp Focused phủ chính xác các test có suite membership ở Focused.

Feature mapping dưới đây đối chiếu từng hàng với approved plan cùng ID (`TV3-<xx>-plan.md`) — tên tính năng lấy trực tiếp từ tiêu đề plan.

| Module ID | Tên Module / Tính Năng (theo approved plan) | Tiêu Chuẩn Nghiệm Thu (AC) | Kịch Bản Test (TC) | Lớp Kiểm Thử (Test Class / File Path) | Tầng Kiểm Thử | Gate Thực Thi | Evidence Output Path |
|:---|:---|:---|:---|:---|:---|:---|:---|
| **TV3-04** | Learner Exam Structure API | AC-02 | TC_TV3_22_01 | `BT/controller/LearnerExamStructureControllerIT.java`<br>`BT/service/LearnerExamStructureServiceTest.java` | Contract IT & Service Test | Broad | `01_backend_broad.log` |
| **TV3-05** | Dynamic Picker/Start Page | AC-02 | TC_TV3_22_01 | `BT/service/TestAttemptSinglePartDurationTest.java`<br>`FT/examApi.test.ts`<br>`FT/ScopeModePicker.test.tsx`<br>`FP/ExamStartPage.test.tsx` | Service Test + Frontend Integration | Broad | `01_backend_broad.log` + `02_frontend_full.log` |
| **TV3-06** | Server-Authoritative Autosave Version | AC-02 | TC_TV3_22_01, TC_TV3_22_02 | `BT/service/TestAttemptAutosaveVersionTest.java`<br>`BT/service/TestAttemptAutosaveConcurrencyIT.java`<br>`BT/controller/TestAttemptAutosaveControllerTest.java`<br>`FT/SaveStatusBadge.test.tsx`<br>`FT/useAutosave.test.tsx` | Backend Service/Concurrency + Frontend | Broad | `01_backend_broad.log` + `02_frontend_full.log` |
| **TV3-07** | Resume Contract Từ Backend | AC-02 | TC_TV3_22_01, TC_TV3_22_06 | `BT/controller/TestAttemptResumeControllerIT.java`<br>`BT/service/TestAttemptResumeConcurrencyIT.java`<br>`BT/service/TestAttemptWorkspaceResponseTest.java`<br>`BT/util/WorkspaceSnapshotSanitizerTest.java`<br>`FT/resumeContract.test.tsx`<br>`FT/useWorkspace.test.tsx` | Contract IT + Service + Frontend | Focused, Broad | `01_backend_focused.log` + `01_backend_broad.log` + `02_frontend_full.log` |
| **TV3-08** | Autosave + Restore + finalAnswers Ở Frontend | AC-02 | TC_TV3_22_01, TC_TV3_22_02, TC_TV3_22_03 | `FT/autosaveSubmitContract.test.tsx`<br>`FT/useAttemptSubmission.test.tsx`<br>`FT/answerSlice.test.ts`<br>`FT/answerSnapshot.test.ts`<br>`FT/attemptApi.test.ts` | Frontend Integration & Contract | Focused, Broad | `02_frontend_focused.log` + `02_frontend_full.log` |
| **TV3-09** | Hết Giờ, Khóa Form Và Nộp Một Lần | AC-02 | TC_TV3_22_04 | `BT/service/TestAttemptGracePeriodTest.java`<br>`BT/service/TestAttemptSubmitConcurrencyIT.java`<br>`BT/service/TestAttemptSchedulerSubmitConcurrencyIT.java`<br>`FT/TimeUpOverlay.test.tsx`<br>`FT/SubmitOverlay.test.tsx`<br>`FT/SubmitConfirmModal.test.tsx`<br>`FT/autosaveSubmitContract.test.tsx` | Backend Service/Concurrency + Frontend | Focused, Broad | `01_backend_focused.log` + `02_frontend_focused.log` (autosaveSubmitContract) + `01_backend_broad.log` + `02_frontend_full.log` |
| **TV3-10** | Chính Xác Hóa Objective Grading (Accurizing & Correction) | AC-02 | TC_TV3_22_01 | `BT/grading/ObjectiveGradingServiceTest.java`<br>`BT/grading/OfficialExamGradingCountTest.java`<br>`BT/adapter/impl/DbGradingAdapterTest.java` | Grading Service & Adapter Test | Broad | `01_backend_broad.log` |
| **TV3-11** | Result Summary Backend | AC-02, AC-06 | TC_TV3_22_01 | `BT/controller/ResultSummaryContractIT.java`<br>`BT/controller/TestAttemptResultControllerIT.java`<br>`BT/util/AttemptResultScopeTest.java`<br>`BT/util/AttemptDurationTest.java`<br>`BT/service/support/AttemptResultSummaryMapperTest.java`<br>`BT/service/support/AttemptGradingInputFactoryTest.java`<br>`BT/service/ResultFinalizationServiceTest.java`<br>`BT/service/SubmissionServiceTest.java`<br>`BT/repository/ResultScorePrecisionTest.java`<br>`BT/repository/ResultScorePrecisionPostgresIT.java` | Contract IT + Unit + PostgreSQL IT | Focused, Broad, Postgres | `01_backend_focused.log` + `01_backend_broad.log` + `01_postgres_tv3_suites.log` |
| **TV3-12** | Result Page Bằng Dữ Liệu Thật | AC-02 | TC_TV3_22_01, TC_TV3_22_11 | `FP/ExamResultPage.test.tsx`<br>`FT/ResultSummary.test.tsx`<br>`FT/resultPageContract.test.tsx`<br>`FT/resultPresentation.test.ts`<br>`FT/useAttemptResult.test.tsx`<br>`FT/resultContract.test.ts` | Frontend Integration | Broad | `02_frontend_full.log` |
| **TV3-13** | Exam Review Backend | AC-02, AC-05 | TC_TV3_22_01, TC_TV3_22_15 | `BT/controller/ExamReviewContractIT.java`<br>`BT/dto/response/ExamReviewResponseTest.java`<br>`BT/repository/ExamReviewPostgresIT.java` | Contract IT + DTO Test + PostgreSQL IT | Focused, Broad, Postgres | `01_backend_focused.log` + `01_backend_broad.log` + `01_postgres_tv3_suites.log` |
| **TV3-14** | Review UI Và Part Động | AC-02 | TC_TV3_22_11, TC_TV3_22_15 | `FP/ExamReviewPage.test.tsx`<br>`FT/QuestionReviewCard.test.tsx`<br>`FT/reviewPageContract.test.tsx`<br>`FT/useExamReview.test.tsx`<br>`FT/reviewContract.test.ts` | Frontend Integration | Broad | `02_frontend_full.log` |
| **TV3-15** | API Phản Hồi Tức Thì Cho Practice (Practice Feedback) | AC-03 | TC_TV3_22_07 | `BT/controller/PracticeFeedbackContractIT.java`<br>`BT/controller/PracticeFeedbackControllerIT.java`<br>`BT/service/PracticeFeedbackServiceTest.java`<br>`BT/service/support/PracticeFeedbackEvaluatorTest.java`<br>`BT/service/support/PracticeFeedbackRequestValidatorTest.java`<br>`BT/dto/response/PracticeFeedbackResponseTest.java` | Contract IT + Service Test | Focused, Broad | `01_backend_focused.log` + `01_backend_broad.log` |
| **TV3-16** | Practice UI Và Luyện Lại Câu Sai | AC-03 | TC_TV3_22_07 | `FT/WorkspacePractice.test.tsx`<br>`FT/PracticeFeedbackUI.test.tsx`<br>`FT/practiceWorkspaceContract.test.tsx`<br>`FT/practiceRetry.test.ts`<br>`FT/practiceFeedbackContract.test.ts`<br>`FT/usePracticeFeedback.test.tsx` | Frontend Integration | Broad | `02_frontend_full.log` |
| **TV3-17** | Gemini HTTP Client Infrastructure | AC-04 | TC_TV3_22_09 | `BT/ai/gemini/BoundedBodySubscriberTest.java`<br>`BT/ai/gemini/GeminiConfigurationTest.java`<br>`BT/ai/gemini/GeminiContractTest.java`<br>`BT/ai/gemini/GeminiHttpContractTest.java`<br>`BT/ai/gemini/GeminiPayloadCodecTest.java`<br>`BT/ai/gemini/GeminiPropertiesTest.java`<br>`BT/ai/gemini/GeminiSecurityTest.java`<br>`BT/ai/gemini/HttpGeminiClientTest.java` | Unit/Contract Test Với HTTP Boundary Giả (không gọi Gemini thật) | Broad | `01_backend_broad.log` |
| **TV3-18** | Writing Hints API (Quota/Idempotency) | AC-03, AC-06 | TC_TV3_22_08 | `BT/controller/WritingHintsContractIT.java`<br>`BT/service/WritingHintsServiceTest.java`<br>`BA/service/UserQuotaReservationServiceTest.java`<br>`BT/service/support/WritingHintContextReaderTest.java`<br>`BT/ai/hints/WritingHintGeneratorTest.java`<br>`BT/ai/hints/WritingHintPromptFactoryTest.java`<br>`BT/repository/WritingHintPostgresIT.java`<br>`BT/repository/WritingHintPostgresTransactionIT.java` | Contract IT + Service + PostgreSQL IT | Focused, Broad, Postgres | `01_backend_focused.log` + `01_backend_broad.log` + `01_postgres_tv3_suites.log` |
| **TV3-19** | Writing Hints UI | AC-03 | TC_TV3_22_08 | `FT/WritingHintsPanel.test.tsx`<br>`FT/WorkspaceWritingHints.test.tsx`<br>`FT/useWritingHints.test.tsx`<br>`FT/writingHintsWorkspaceContract.test.tsx`<br>`FT/writingHintsContract.test.ts`<br>`FT/writingHintsErrors.test.ts` | Frontend Integration | Broad | `02_frontend_full.log` |
| **TV3-20** | AI Chấm Writing Sau Submit (Backend Grading Pipeline) | AC-04 | TC_TV3_22_09, TC_TV3_22_10 | `BT/service/WritingGradingLifecycleIT.java`<br>`BT/ai/grading/WritingGradingGeneratorTest.java`<br>`BT/ai/grading/WritingGradingPromptFactoryTest.java`<br>`BT/ai/grading/WritingGradingImageLoaderTest.java`<br>`BT/ai/grading/WritingGradingOutputParserTest.java`<br>`BT/ai/grading/WritingGradingSecurityTest.java`<br>`BT/config/WritingGradingPropertiesTest.java`<br>`BT/service/support/WritingGradingEnqueuerTest.java`<br>`BT/service/worker/WritingGradingWorkerTest.java`<br>`BT/service/worker/WritingGradingWorkerIT.java`<br>`BT/service/AttemptGradingSameVersionTest.java`<br>`BT/util/SnapshotGradingKeyExtractorTest.java`<br>`BT/repository/WritingGradingPostgresIT.java`<br>`BT/service/support/WritingGradingPostgresTransactionIT.java` | Lifecycle IT + Unit + PostgreSQL IT | Focused, Broad, Postgres | `01_backend_focused.log` + `01_backend_broad.log` + `01_postgres_tv3_suites.log` |
| **TV3-21** | AI Feedback + Diff-View (Writing Feedback UI) | AC-04 | TC_TV3_22_10 | `BT/controller/WritingFeedbackContractIT.java`<br>`FT/writingFeedbackPageContract.test.tsx`<br>`FT/WritingDiffView.test.tsx`<br>`FT/WritingCorrectionsList.test.tsx`<br>`FT/WritingFeedbackTask.test.tsx`<br>`FT/WritingFeedbackPanel.test.tsx`<br>`FT/useWritingFeedback.test.tsx`<br>`FT/writingFeedbackContract.test.ts`<br>`FT/writingFeedbackPresentation.test.ts` | Backend Contract IT + Frontend Integration | Focused, Broad | `01_backend_focused.log` + `02_frontend_focused.log` + `02_frontend_full.log` |
| **TOEIC R1** | TOEIC Workspace Fixes R1 — Part 1 sáu ảnh, Part 2 25 câu, server playback | AC-07 | TC_TV3_22_13, TC_TV3_22_14, TC_TV3_22_15 | `BT/controller/ListeningPlaybackContractIT.java`<br>`BT/service/support/ListeningPlaybackTimelineTest.java`<br>`BT/service/support/ToeicListeningMediaProfileTest.java`<br>`BT/service/support/ToeicWorkspaceProjectionTest.java`<br>`BT/adapter/repository/AttemptListeningPlaybackPostgresIT.java`<br>`BT/service/ListeningPlaybackStartConcurrencyPostgresIT.java`<br>`FT/ToeicWorkspaceContract.test.tsx`<br>`FT/AudioPlayer.test.tsx`<br>`FT/OfficialExamWorkspaceContract.test.tsx`<br>`FT/examPartUtils.test.ts` | Full Stack (Controller IT, Unit, PostgreSQL IT, UI) | Focused, Broad, Postgres | `01_backend_focused.log` + `02_frontend_focused.log` + `02_postgres_playback_suites.log` + `01_backend_broad.log` + `02_frontend_full.log` |
| **TV3-22** | Regression Và Bàn Giao Toàn Bộ TV3 (cross-cutting) | AC-01–AC-09 | TC_TV3_22_01, TC_TV3_22_05, TC_TV3_22_06, TC_TV3_22_16, TC_TV3_22_17 | `BT/controller/Tv3LifecycleContractIT.java`<br>`BT/controller/Tv3AccessContractIT.java`<br>`BT/service/SubmitAttemptImmutableKeysTest.java`<br>`FT/tv3LifecycleContract.test.tsx`<br>`FT/fixtures/tv3Regression.ts` (shared fixture) | Cross-cutting Contract IT + Frontend Contract | Focused, Broad | `01_backend_focused.log` + `02_frontend_focused.log` + `01_backend_broad.log` + `02_frontend_full.log`; browser smoke: `docs/testing/TV3-22-browser-smoke.md` |

**Đối chứng rành mạch:** TV3-04–21 không lặp class với nhau; class dùng chung giữa nhiều task (ví dụ autosaveSubmitContract giữa TV3-08/09, SubmissionServiceTest/ResultFinalizationServiceTest giữa TV3-11/20...) chỉ giữ lại ở task sở hữu plan tương ứng; TV3-22 giữ các cross-cutting contract regressions (lifecycle/access/snapshot immutability của riêng TV3-22).

---

## 3. Danh Mục Chi Tiết 17 Test Cases Chuẩn Hóa

### TC_TV3_22_01 — Happy Path Vòng Đời Bài Thi
- **Mục tiêu:** Kiểm tra toàn bộ luồng chính: Start -> Workspace -> Autosave -> Submit -> Result -> Review.
- **Tiêu chuẩn mong đợi:** Dữ liệu hoàn toàn đồng bộ với backend; không dùng mock result trong môi trường tích hợp; version số lần lưu bám sát server.
- **Phụ trách:** Subtasks TV3-22-02, TV3-22-03.

### TC_TV3_22_02 — Race Condition Khi Submit Trong Lúc Deferred PUT Đang Chạy
- **Mục tiêu:** Thí sinh chỉnh sửa câu hỏi (đáp án C) trong lúc request lưu bản nháp (đáp án B) đang pending trên mạng, sau đó nhấn Nộp bài ngay lập tức.
- **Tiêu chuẩn mong đợi:** Đúng 1 request PUT và 1 request POST; POST nộp bài chờ PUT hoàn thành và gửi đúng phiên bản mới nhất cùng đáp án C (`finalAnswers=C`); không có hiện tượng nộp nhầm bản nháp cũ.
- **Phụ trách:** Subtask TV3-22-03.

### TC_TV3_22_03 — Xử Lý Lỗi Khi Nộp Bài (Network Timeout, 409, 1601, 401)
- **Mục tiêu:** Kiểm tra phản ứng giao diện khi submit gặp sự cố đường truyền hoặc xung đột phiên bản.
- **Tiêu chuẩn mong đợi:** Tuyệt đối không điều hướng thành công giả mạo (no false-success navigation); giữ nguyên dữ liệu nháp của thí sinh trên giao diện; hiển thị đúng mã lỗi và thông báo hướng dẫn retry.
- **Phụ trách:** Subtasks TV3-22-02, TV3-22-03.

### TC_TV3_22_04 — Ranh Giới Thời Gian Làm Bài & Thời Gian Ân Hạn (Grace Period)
- **Mục tiêu:** Kiểm tra nộp bài ngay trước deadline, ngay sau deadline và vượt quá thời gian ân hạn (+15 giây).
- **Tiêu chuẩn mong đợi:** Server chốt thời gian dựa trên `Clock` chuẩn của server; ngoài grace period từ chối với lỗi 409 `ATTEMPT_EXPIRED`; không chấp nhận việc client tự ý điều chỉnh giờ hệ thống.
- **Phụ trách:** Subtasks TV3-22-02, TV3-22-03.

### TC_TV3_22_05 — Bảo Mật & Phân Quyền Truy Cập (Security & Access Control)
- **Mục tiêu:** Người dùng A cố tình đọc hoặc sửa attempt của Người dùng B; xem bài giải Review khi attempt vẫn đang `IN_PROGRESS`.
- **Tiêu chuẩn mong đợi:** Từ chối bằng `403 FORBIDDEN`; không làm lộ đáp án đúng hay transcript; không phát sinh bất kỳ thay đổi nào trong cơ sở dữ liệu.
- **Phụ trách:** Subtask TV3-22-02.

### TC_TV3_22_06 — Tính Bất Biến Của Đề Thi Lịch Sử (Exam Snapshot Integrity)
- **Mục tiêu:** Admin sửa đổi nội dung câu hỏi, xóa đáp án hoặc Unpublish đề thi sau khi thí sinh đã bắt đầu làm bài.
- **Tiêu chuẩn mong đợi:** Toàn bộ nội dung câu hỏi, đề bài, và đáp án trong attempt của thí sinh vẫn giữ nguyên theo snapshot tại thời điểm bắt đầu thi; không bị ảnh hưởng bởi các thay đổi trên đề gốc.
- **Phụ trách:** Subtask TV3-22-02.

### TC_TV3_22_07 — Chế Độ Luyện Tập (Practice Mode & Feedback)
- **Mục tiêu:** Kiểm tra tính năng kiểm tra đáp án tức thì, làm lại câu sai (retry), và bảo vệ chế độ Mock Test.
- **Tiêu chuẩn mong đợi:** Phản hồi chi tiết chỉ mở ra khi bấm kiểm tra; chế độ Practice không ghi đè đáp án chính thức vào attempt; Mock test bị chặn không cho gọi API feedback.
- **Phụ trách:** Subtasks TV3-22-02, TV3-22-03.

### TC_TV3_22_08 — Hạn Mức Gợi Ý & Tính Bất Biến (Hints Quota & Idempotency)
- **Mục tiêu:** Thí sinh gọi gợi ý Writing nhiều lần liên tiếp khi mạng chập chờn hoặc khi hạn mức sử dụng (Quota) đã hết.
- **Tiêu chuẩn mong đợi:** Request lặp lại không trừ quota hai lần; khi quota cạn trả về mã lỗi 429 / 1602 an toàn; không gây crash tiến trình chấm bài.
- **Phụ trách:** Subtasks TV3-22-02, TV3-22-03.

### TC_TV3_22_09 — Điều Phối Đánh Giá Writing & Ranh Giới AI Giả Lập
- **Mục tiêu:** Chấm bài Writing với 0, 1, hoặc 2 hình ảnh tham chiếu; kiểm tra hành vi khi fetcher ảnh hoặc AI provider trả về lỗi, timeout, hoặc stale lease.
- **Tiêu chuẩn mong đợi:** Vòng đời chấm bài (Job status) chuyển trạng thái chuẩn (`QUEUED`, `PROCESSING`, `COMPLETED`, `FAILED`); fake provider mô phỏng đầy đủ dữ liệu chấm điểm mà không tạo bất kỳ kết nối mạng thực tế nào tới Google Gemini.
- **Phụ trách:** Subtask TV3-22-02.

### TC_TV3_22_10 — Ranh Giới Nội Dung Bài Viết Writing
- **Mục tiêu:** Nộp bài luận rỗng, bài luận chứa ký tự đặc biệt / Unicode / emoji, hoặc bài luận có độ dài biên (8.000 ký tự so với 8.001 ký tự).
- **Tiêu chuẩn mong đợi:** Xử lý văn bản an toàn, không lỗi mã hóa ký tự; cắt tỉa hoặc từ chối chính xác theo hợp đồng API nếu vượt ngưỡng tối đa.
- **Phụ trách:** Subtasks TV3-22-02, TV3-22-03.

### TC_TV3_22_11 — Quản Lý State Frontend & Chống Nháy Dữ Liệu Cũ
- **Mục tiêu:** Thí sinh điều hướng nhanh giữa các trang kết quả (Route A -> B -> A) hoặc refresh trang khi gặp lỗi 403 / payload dị thường.
- **Tiêu chuẩn mong đợi:** Xóa sạch dữ liệu bài cũ trước khi nạp bài mới; response trả về muộn từ bài trước bị hủy bỏ an toàn, không gây nhầm lẫn điểm số giữa hai bài thi.
- **Phụ trách:** Subtask TV3-22-03.

### TC_TV3_22_12 — Kiểm Thử Giao Tác & Ràng Buộc Cơ Sở Dữ Liệu PostgreSQL
- **Mục tiêu:** Kiểm tra khóa bi quan, tính nguyên tử của giao tác (transaction isolation), tính chính xác của điểm số `DECIMAL(5,2)`, và ràng buộc `UNIQUE(attempt_id)` của playback.
- **Tiêu chuẩn mong đợi:** Thực thi 100% trên container/instance PostgreSQL thử nghiệm riêng biệt; các phép thử commit/rollback chứng minh hiệu lực thực tế; không một test nào bị skip.
- **Phụ trách:** Subtask TV3-22-04.

### TC_TV3_22_13 — Khắc Phục Giao Diện TOEIC R1 (Part 1 Sáu Ảnh & Part 2 25 Câu)
- **Mục tiêu:** Màn hình làm bài TOEIC hiển thị đồng thời đủ 6 ảnh và 6 câu ở Part 1; hiển thị đủ 25 câu ở Part 2; question palette cuộn mượt và đánh dấu cờ/trạng thái chuẩn xác.
- **Tiêu chuẩn mong đợi:** Không bị ẩn câu; chọn đáp án phản hồi ngay lập tức; chuyển câu bằng phím số hoặc click palette đồng bộ chính xác.
- **Phụ trách:** Subtasks TV3-22-03, TV3-22-05.

### TC_TV3_22_14 — Phát Âm Thanh Server-Authoritative Cho Mock Test
- **Mục tiêu:** Thí sinh làm bài Mock Listening: audio phát liên tục theo timeline của server; reload trình duyệt hoặc mất mạng tự động đồng bộ theo giờ server hiện tại mà không phát bù đoạn đã qua.
- **Tiêu chuẩn mong đợi:** Không có nút Pause/Seek/Replay trong Mock; chỉ tồn tại đúng 1 session phát âm thanh hợp lệ; khởi tạo lặp lại là idempotent.
- **Phụ trách:** Subtasks TV3-22-02, TV3-22-03, TV3-22-05.

### TC_TV3_22_15 — Tính Toàn Vẹn Của Trang Review Lựa Chọn Rỗng
- **Mục tiêu:** Kiểm tra giao diện xem lại bài giải (Review Page) của Part 1 và Part 2 khi các lựa chọn A–D hoặc A–C có nội dung text rỗng (`""`).
- **Tiêu chuẩn mong đợi:** Vẫn hiển thị rõ ràng các nhãn `(A)`, `(B)`, `(C)`, `(D)`; không tự ý tích chọn nhầm đáp án; hiển thị đúng kết quả đúng/sai của thí sinh.
- **Phụ trách:** Subtasks TV3-22-03, TV3-22-05.

### TC_TV3_22_16 — Khả Năng Tiếp Cận & Thao Tác Bàn Phím (Accessibility & Focus)
- **Mục tiêu:** Thí sinh chỉ sử dụng bàn phím (Tab, Shift+Tab, Phím mũi tên, Space, Enter, Phím số 1–4) để làm toàn bộ bài thi trên các kích thước màn hình 375px, 768px, 1366px, 1920px.
- **Tiêu chuẩn mong đợi:** Chỉ báo focus rõ ràng; tiêu đề cố định không che khuất câu hỏi; Diff View của Writing mở rộng và đọc được trên mọi màn hình.
- **Phụ trách:** Subtask TV3-22-05.

### TC_TV3_22_17 — Giám Sát Độ Sạch Mã Nguồn & Tính Toàn Vẹn Workbook
- **Mục tiêu:** Kiểm tra toàn bộ mã nguồn trước khi bàn giao: không phát sinh trailing whitespace mới, không có commit/push tự động, và file workbook mẫu không bị biến dạng.
- **Tiêu chuẩn mong đợi:** `git diff --check` đạt exit 0; SHA-256 của `backend/Exam_Template.xlsx` khớp tuyệt đối với baseline; warnings của linter không tăng thêm so với 56 warnings ban đầu.
- **Phụ trách:** Subtasks TV3-22-01, TV3-22-06.

---

## 4. Quản Trị Rủi Ro & Cơ Chế Khắc Phục (Risk Mitigation Matrix)

| # | Rủi Ro Xác Định | Cấp Độ | Cơ Chế Phòng Ngừa & Kiểm Soát |
|:---|:---|:---:|:---|
| 1 | **Flake do Vitest Concurrency** | Trung bình | Giới hạn số worker `--maxWorkers=2` khi chạy full suite frontend; điều tra tận gốc nguyên nhân race condition thay vì tăng bừa timeout toàn cục. |
| 2 | **Thiếu bảng Prerequisite trong PostgreSQL Test** | Cao | Kiểm tra và bổ sung bảng cấu trúc V1 (`user_study_stats`, `daily_study_logs`) vào fixture riêng của test trước khi chạy Flyway migration; tuyệt đối không can thiệp sửa file migration chính thức. |
| 3 | **Đồng thời Submit nhiều Tab (Multi-tab Stale Submit)** | Trung bình | Ghi nhận rõ ràng trong tài liệu bàn giao: Backend hiện tại chưa enforce `baseVersion` khi nộp bài; các test không được assert sai lệch thực tế này. |
| 4 | **Chi phí / Network Flake từ External AI Provider** | Nghiêm trọng | Sử dụng 100% fake AI provider/fetcher trong toàn bộ các test tự động; cách ly hoàn toàn network call ra ngoài. |
| 5 | **Biến dạng Workbook `Exam_Template.xlsx`** | Cao | Loại trừ `GenerateTemplateTest` khỏi broad backend suite (`-Dtest=*,!GenerateTemplateTest`); runner tự động đối soát mã băm SHA-256 trước và sau mỗi lượt chạy. |
| 6 | **Rò rỉ Thông Tin Đăng Nhập / Bí Mật trong Evidence** | Nghiêm trọng | Runner lọc và chỉ ghi nhận trạng thái cấu hình của biến môi trường (Configured/Not Configured); thư mục `.superpowers/` được đưa vào `.gitignore`. |

---

## 5. Quy Chuẩn Báo Cáo & Lưu Trữ Bằng Chứng (Evidence Standards)

Mỗi lần kích hoạt runner kiểm thử qua `scripts/testing/run-tv3-regression.ps1`, một thư mục định danh thời gian sẽ được khởi tạo tại `.superpowers/tv3-22/<yyyyMMdd_HHmmssZ>/` chứa các artifacts:
1. `manifest.json`: Lưu trữ thông tin Git HEAD, Branch, trạng thái Working Tree, mã băm SHA-256 của workbook, và trạng thái biến môi trường an toàn.
2. `summary.md`: Báo cáo tóm tắt kết quả kiểm thử, thời gian thực thi, số lượng test case, và exit code của từng lệnh.
3. `<gate-name>-<step>.log`: Lưu trữ toàn bộ stdout/stderr chi tiết của lệnh thực thi để phục vụ truy vết lỗi (Root Cause Analysis).

**Audit Vitest (R-02):** cả `npx vitest run ...` (Focused frontend) và `npm test -- --maxWorkers=2` (Broad frontend) đều đi qua cùng một Vitest summary audit trong runner. Audit từ chối (fail-closed, exit 1) khi: summary thiếu (`MISSING_VITEST_SUMMARY`), zero/zero-passed (`REJECTED_ZERO_TESTS`), có skipped/todo (`REJECTED_SKIPPED_TESTS`) hoặc passed ≠ total (`INCONSISTENT_VITEST_COUNTS`); exit code khác 0 luôn giữ `FAIL`. Regression probes chạy bằng lệnh (in-memory, không chạy gate): `run-tv3-regression.ps1 -Gate Focused -RunVitestAuditProbes`.

---

## 6. Kết Quả Final Gate TV3-22-06 — 2026-10-19 (re-gate vòng 2 sau re-FIX R-01–R-04)

**Trạng thái gate:** **PASS** — vòng gate đầu (20261019_032920Z) NEED_FIX vì G-01/G-02; vòng 2 (20261019_043833Z) PASS sau re-FIX G-01/G-02; vòng 3 (dưới đây) PASS sau re-FIX R-01–R-04 theo Codex full-feature review. Broad gate chạy trọn 5 step trong runner với `PASS_WITH_DOCUMENTED_SKIPS` và manifest audit đầy đủ.

| Gate | Lệnh / phạm vi | Kết quả | Evidence |
|---|---|---|---:|
| Focused | `run-tv3-regression.ps1 -Gate Focused` | **PASS** — backend 199 tests, frontend 130 tests; 0 failure/error/skip | `.superpowers/tv3-22/20261019_083529Z/` |
| Backend broad | `mvnw.cmd clean test -Dtest=*,!GenerateTemplateTest` | **PASS** — 1.887 run, 0 failures, 0 errors, 31 skipped; audit `PASS_WITH_DOCUMENTED_SKIPS` | `.superpowers/tv3-22/20261019_083720Z/01_backend_broad.log` |
| Frontend full | `npm test -- --maxWorkers=2` | **PASS** — 86 files / 1.597 tests; manifest `AuditVerdict=VERIFIED_PASS`, TestsRun=1597, Skipped=0 (audit Vitest giờ áp dụng cho cả `npm test` — R-02) | `.superpowers/tv3-22/20261019_083720Z/02_frontend_full.log` + `manifest.json` |
| Frontend lint | `npm run lint` | **PASS (exit 0)** — 56 warnings, bằng baseline tổng | `.superpowers/tv3-22/20261019_083720Z/03_frontend_lint.log` |
| Frontend build | `npm run build` | **PASS (exit 0)** — `tsc -b` + `vite build` | `.superpowers/tv3-22/20261019_083720Z/04_frontend_build.log` |
| PostgreSQL | `run-tv3-regression.ps1 -Gate Postgres` trên cluster 17.9 tạm, 3 database riêng | **PASS** — 25 + 5 tests; 0 skip | `.superpowers/tv3-22/20261019_033618Z/` |
| Hygiene | `git diff --check`; workbook SHA-256 pre/post run | **PASS** — không whitespace error; hash khớp baseline; runner exit 0 | `.superpowers/tv3-22/20261019_083720Z/05_git_diff_check.log` + `manifest.json`/`summary.md` |

**Ghi chú:** Broad gate không retry; 31 skip trong broad nằm trong 10 lớp allowlist đã kiểm tra khớp (6 TV3 PG suites qua `TV3_PG_TEST_URL` = 24 tests, `AttemptListeningPlaybackPostgresIT` = 4, `ListeningPlaybackStartConcurrencyPostgresIT` = 1, `OfficialCatalogPostgresIT` = 1, `ETSWorkbookAuditTest` opt-in `ets.source` = 1). Audit Broad fail-closed: lớp skip ngoài allowlist bị `REJECTED_UNEXPECTED_SKIPPED_TESTS`; Focused giữ strict `REJECTED_SKIPPED_TESTS`. Lần này `01_backend_broad.log` chứa chuẩn `[WARNING] Tests run:...` được parser chấp nhận; `02_frontend_full` lần đầu có audit Vitest trên `npm test` (R-02). PostgreSQL gate riêng giữ nguyên evidence `20261019_033618Z` (không đổi DB contract; không chạy lại vì scope re-FIX không đụng DB test). Ghi chú lịch sử: hai lượt re-gate trung gian vòng trước (043415Z/043714Z) FAIL vì môi trường (Maven mồ côi giữ lock `backend/target`), đã dọn tiến trình rồi PASS — chi tiết trong handoff.

### 6.1. Findings mở

**Đã xử lý trong re-FIX (vòng 1 — G-01/G-02/P2):** hai test legacy được cập nhật theo snapshot/grading contract hiện tại và fixture review khai báo type wire `ExamReviewResponse`; broad backend và `npm run build` PASS. Chi tiết: `TV3-22-handoff.md` mục re-FIX TV3-22-06.

**Đã xử lý trong re-FIX vòng 2 — R-01–R-04 theo Codex full-feature re-review 2026-10-19:**

| ID | Mức | Disposition |
|---|---|---|
| R-01 | P1 | Mục 2 viết lại toàn bộ: feature mapping đối chiếu từng hàng với approved plan cùng ID; 76 đường dẫn test được script kiểm chứng tồn tại (0 miss); tên log khớp runner thật; bỏ tham chiếu không tồn tại (`GeminiWritingEvaluator.java`, `WritingEvaluationPromptBuilder.java`) và production-source-as-evidence. |
| R-02 | P1 | Runner: `npm test` (Broad frontend) đi qua cùng Vitest audit; audit từ chối zero-pass/all-skipped, skipped/todo, missing-summary; exit ≠ 0 luôn giữ FAIL. 10 regression probes in-memory đều PASS (`-RunVitestAuditProbes`); Broad thật ghi nhận `02_frontend_full AuditVerdict=VERIFIED_PASS` (1597/0). |
| R-03 | P2 | `Tv3LifecycleContractIT.testExamSnapshotImmutability_whenExamModifiedOrUnpublished` giờ deep-copy và đột biến text/options/correct_answer/explanation của nested question trước submit, selfie-kiểm chứng live content đã đổi, rồi assert result/review trả dữ liệu snapshot gốc ("A", explanation gốc); `Tv3LifecycleContractIT` 4/4 PASS. |
| R-04 | P2 | Docs ghi **73 screenshot được `summary.json` tham chiếu + 9 PNG không tham chiếu (82 PNG trên đĩa)** tại `TV3-22-browser-smoke.md` và `TV3-22-handover.md`; matrix/handover đồng bộ evidence Broad/Focused mới. |

Không có P0/P1 production runtime được xác nhận. Findings còn mở:

| ID | Mức | Vị trí | Mô tả / tác động | Đề xuất |
|---|---|---|---|---|
| F-01 | P2 | `WorkspaceFrame.tsx:33` | Token cực dài không khoảng trắng trong instruction bị clip. Nội dung dài/Unicode/HTML-like bình thường PASS. | `overflow-wrap:anywhere`/`min-width:0` + regression browser. |
| F-02 | P2 | `WritingFeedbackTask.tsx:34` | Header feedback Writing mở rộng quá viewport với token cực dài. | Cho phép wrap/ellipsis có kiểm soát; test 375px. |
| F-03 | P2 | `PartReviewContent.tsx:135` | Tiêu đề part review mở rộng với token cực dài. | Wrap/ellipsis + regression browser. |

### 6.2. AC mapping

| AC | Trạng thái | Bằng chứng / blocker |
|---|---|---|
| AC-01 | **PASS** | Ma trận traceability đầy đủ TV3-04–21 + R1 + TV3-22; feature mapping đối chiếu plan ID, 76 đường dẫn kiểm chứng tồn tại (fix R-01). |
| AC-02 | **PASS** | `Tv3LifecycleContractIT`, frontend lifecycle/autosave; focused 199 + 130; snapshot immutability test được siết theo R-03. |
| AC-03 | **PASS** | Practice feedback/Hints contract + fake provider; focused suites. |
| AC-04 | **PASS** | Writing lifecycle + Postgres 25 TV3 tests; no real provider. |
| AC-05 | **PASS** | `Tv3AccessContractIT`, ownership/live-attempt restrictions. |
| AC-06 | **PASS** | PostgreSQL 17.9 cluster riêng, 3 DB, 30 tests, 0 skip. |
| AC-07 | **PASS** | TOEIC R1 frontend contract + browser smoke 49 scenarios; 3 P2 residual UI findings. |
| AC-08 | **PASS** | Broad 5/5 step PASS (`20261019_083720Z`, runner exit 0): backend 1.887/0/0/31 `PASS_WITH_DOCUMENTED_SKIPS`; frontend full 1.597 với Vitest audit `VERIFIED_PASS` (fix R-02); lint exit 0; build exit 0. |
| AC-09 | **PASS** | Handover + review request đầy đủ và đồng bộ evidence mới; matrix/handoff/handover nhất quán theo R-04; chờ Codex re-review. |

### 6.3. Giới hạn

- Browser smoke dùng API mock, không chứng minh deployment/staging, PostgreSQL production, audio CDN/CORS/Range, Gemini thật hoặc screen-reader/WCAG đầy đủ.
- Chưa có xác nhận staging/PG credentials; mọi kết quả PostgreSQL là cluster tạm trên loopback và đã xóa sau chạy.
- F-01–F-03 là residual risk P2 với token cực dài, không phải lỗi nội dung thông thường.
