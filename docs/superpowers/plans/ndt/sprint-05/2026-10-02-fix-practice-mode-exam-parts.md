# Kế hoạch khắc phục lỗi: Chế độ Practice Mode thiếu câu hỏi và phần thi (Part)

> **Mã lỗi:** BUG-S05-PRACTICE-PARTS  
> **Kỹ năng áp dụng:** `fix-bug`, `writing-plans`  
> **Trạng thái:** Chờ người dùng phê duyệt (CHƯA THỰC THI)  

---

## 1. Mô tả sự cố & Triệu chứng thực tế

* **Hiện tượng:**
  * Khi người dùng bấm vào thẻ **"Luyện tập Practice Mode"** từ Trang chủ (`http://localhost:5173/`), hệ thống chuyển hướng đến `http://localhost:5173/exams/2/start`.
  * Từ trang thiết lập phòng thi của Exam 2, bấm "Bắt đầu làm bài" thì đề thi chỉ hiển thị duy nhất **1 câu hỏi**, không có nội dung bài đọc ("Không có nội dung bài đọc cho phần thi này"), và không có các Part khác (Reading Part 2, 3, Listening, Writing) như trong Ảnh 1 (`/attempts/73`).
  * Trong khi đó, nếu vào làm bài từ `http://localhost:5173/exams/1/start`, đề thi hiển thị đầy đủ cả 3 Section (Reading, Listening, Writing), 7 Parts và 9 câu hỏi kèm toàn bộ bài đọc học thuật như trong Ảnh 2 (`/attempts/74`).

---

## 2. Phân tích Nguyên nhân gốc rễ (Root Cause Analysis)

Qua quá trình rà soát mã nguồn Frontend và Backend Fixture, phát hiện **3 nguyên nhân gốc rễ** đan xen:

### Nguyên nhân 1: Nhầm lẫn giữa khái niệm `ExamId` (Mã đề thi) và `TestMode` (Chế độ thi)
* Trong kiến trúc của hệ thống Multilingo:
  * **Exam (Đề thi):** Đại diện cho nội dung đề (ví dụ: Exam 1 là *IELTS Academic Cambridge 19 Test 01*).
  * **TestMode (Chế độ thi):** Là chế độ khi người dùng tạo phiên làm bài (`MOCK_TEST` có bấm giờ / tự nộp, hoặc `PRACTICE` tự do không giới hạn giờ, hỗ trợ tra từ AI). **Mọi đề thi chuẩn (như Exam 1) đều hỗ trợ cả 2 chế độ này.**
* Tuy nhiên, tại `frontend/src/App.tsx` (dòng 231-232):
  ```tsx
  {/* Card 2: Practice Mode */}
  <Link to="/exams/2/start" ...>
    Luyện tập Practice Mode
  </Link>
  ```
  Developer trước đó đã hardcode thẻ Practice Mode dẫn tới **Exam ID = 2** thay vì dẫn tới **Exam ID = 1** kèm chế độ `mode=PRACTICE`.

### Nguyên nhân 2: Dữ liệu mẫu (Fixture) của Exam ID 2 là Stub đơn giản không đầy đủ
* Kiểm tra `backend/src/main/resources/fixtures/exam-fixture.json`:
  * **Exam 1 (`id: 1`):** Là đề thi IELTS đầy đủ (`IELTS Mock Test - Full`) gồm:
    * 3 kỹ năng: Reading (3 parts, passages HTML, 5 câu), Listening (2 parts, 2 câu), Writing (2 tasks, 2 câu) $\rightarrow$ Tổng cộng 9 câu hỏi.
  * **Exam 2 (`id: 2`):** Được tạo ra ban đầu chỉ nhằm mục đích kiểm thử Unit Test cho trường hợp đề thi không có thời lượng (`durationMinutes: null` trong `TestAttemptServiceTest` và `FixtureExamAdapterTest`).
  * Cấu trúc thực tế của Exam 2 chỉ có:
    * 1 Section (`Reading Only`), 1 Part (`Reading Part 1`), **không có nội dung bài đọc (`contentHtml: null`)**, và chỉ có **đúng 1 câu hỏi trắc nghiệm** (`question_number: 1`).
* Khi người dùng tạo bài thi từ `/exams/2/start`, Backend lấy snapshot của Exam 2 $\rightarrow$ Kết quả trong giao diện làm bài chỉ có đúng 1 câu hỏi đơn độc.

### Nguyên nhân 3: `ExamStartPage` và `ScopeModePicker` thiếu hỗ trợ URL Search Params
* Tại `frontend/src/features/exam/pages/ExamStartPage.tsx`:
  * Tiêu đề và mô tả đề thi bị hardcode chữ *"IELTS Academic Reading - Cambridge 19 Test 01 - 40 câu - 3 Passages"* cho mọi `examId`.
  * Không đọc URL query params (ví dụ: `?mode=PRACTICE&scope=FULL_EXAM`).
* Tại `frontend/src/features/exam/components/ScopeModePicker.tsx`:
  * Cả `scope` và `mode` đều khởi tạo rỗng `''`. Dù người dùng đã bấm thẻ "Luyện tập Practice Mode" từ Trang chủ, họ vẫn phải chọn lại thủ công từ đầu.
  * Danh sách `SECTION_OPTIONS` (id: 1, 2, 3) được thiết kế cố định theo các Section của Exam 1.

---

## 3. Các quyết định cần xác nhận (User Review Required)

> [!IMPORTANT]
> **Quyết định 1: Định tuyến Thẻ Practice Mode trên Trang chủ**
> * Khi người dùng bấm **"Luyện tập Practice Mode"** trên Trang chủ, hệ thống sẽ điều hướng tới:
>   `/exams/1/start?mode=PRACTICE&scope=FULL_EXAM`
>   (Tự động chọn sẵn chế độ Luyện tập và phạm vi Toàn bộ đề cho bài thi IELTS Cam 19).
> * Đồng thời, thẻ **"Thi thử Mock Test (IELTS)"** sẽ điều hướng tới:
>   `/exams/1/start?mode=MOCK_TEST&scope=FULL_EXAM`

> [!TIP]
> **Quyết định 2: Bổ sung nội dung hoàn chỉnh cho Exam ID 2 trong Backend Fixture**
> * Để tránh việc bất kỳ người dùng nào truy cập trực tiếp URL `/exams/2/start` (hoặc từ Thư viện đề thi) gặp tình trạng "chỉ có 1 câu và không có bài đọc", ta sẽ đồng thời:
>   1. Bổ sung nội dung hoàn chỉnh cho Exam 2 trong `exam-fixture.json` (ví dụ: bài đọc IELTS General Reading với đầy đủ đoạn văn và câu hỏi mẫu).
>   2. Vẫn giữ nguyên `durationMinutes: null` để đảm bảo 100% các Unit Test hiện có (`createAttempt_mock_test_with_null_duration_exam_throws_invalid_request`, `findById_handles_null_duration_gracefully`) tiếp tục PASS.

---

## 4. Kế hoạch thay đổi chi tiết (Proposed Changes)

### Component 1: Frontend Routing & Pre-selection (UI/UX)

#### [MODIFY] `frontend/src/App.tsx`
* Sửa link thẻ Hero CTA Card 2 (Practice Mode): từ `/exams/2/start` thành `/exams/1/start?mode=PRACTICE&scope=FULL_EXAM`.
* Sửa link thẻ Hero CTA Card 1 (Mock Test): từ `/exams/1/start` thành `/exams/1/start?mode=MOCK_TEST&scope=FULL_EXAM`.
* Rà soát các link trong phần Thư viện đề thi (Library Section) đảm bảo liên kết hợp lý.

#### [MODIFY] `frontend/src/features/exam/pages/ExamStartPage.tsx`
* Nhận query parameters bằng `useSearchParams()`:
  * `mode`: `PRACTICE` | `MOCK_TEST`
  * `scope`: `FULL_EXAM` | `SINGLE_SKILL` | `SINGLE_PART`
* Truyền `initialMode` và `initialScope` xuống `ScopeModePicker`.
* Hiển thị thông tin tiêu đề đề thi phù hợp (nếu `examId === 2` hiển thị tiêu đề General Reading, nếu `examId === 1` hiển thị Cam 19 Academic).

#### [MODIFY] `frontend/src/features/exam/components/ScopeModePicker.tsx`
* Mở rộng interface Props:
  ```ts
  interface ScopeModePickerProps {
    examId: number;
    initialMode?: TestMode | '';
    initialScope?: TestScope | '';
    onSubmit: (req: CreateAttemptRequest) => void;
    isLoading: boolean;
    error: string | null;
  }
  ```
* Khởi tạo state `mode` và `scope` với giá trị ban đầu nếu có từ props:
  ```ts
  const [scope, setScope] = useState<TestScope | ''>(initialScope || '');
  const [mode, setMode] = useState<TestMode | ''>(initialMode || '');
  ```

---

### Component 2: Backend Exam Fixture (Dữ liệu đề thi)

#### [MODIFY] `backend/src/main/resources/fixtures/exam-fixture.json`
* Cập nhật Exam ID 2 từ dạng 1 câu rỗng thành một đề thi hoàn chỉnh:
  * Giữ nguyên `durationMinutes: null` (đáp ứng điều kiện kiểm thử của Backend).
  * Thêm nội dung bài đọc `contentHtml` với định dạng chuẩn `<div class='reading-passage space-y-4'>...</div>`.
  * Bổ sung đầy đủ các câu hỏi và các Part tương ứng để nếu học viên vào làm Exam 2 ở chế độ Practice, bài thi vẫn hiển thị trọn vẹn, không bị lỗi thiếu Part hay thiếu bài đọc.

---

## 5. Kế hoạch kiểm thử & Xác minh (Verification Plan)

### Automated Tests
1. **Frontend Unit Tests:**
   * Chạy `npm test` trong thư mục `frontend/` để đảm bảo các component `ScopeModePicker`, `ExamStartPage`, và `WorkspacePage` vẫn pass 100%.
2. **Backend Regression Tests:**
   * Chạy `mvn test -Dtest=TestAttemptServiceTest,FixtureExamAdapterTest,TestAttemptControllerIT` để đảm bảo:
     * Bài test `createAttempt_mock_test_with_null_duration_exam_throws_invalid_request` trên Exam 2 vẫn ném lỗi khi chọn Mock Test.
     * Bài test `findById_handles_null_duration_gracefully` trên Exam 2 vẫn nhận diện đúng `durationMinutes == null`.
     * Toàn bộ 109 backend tests tiếp tục PASS.

### Manual Verification (Kiểm thử thực tế)
1. **Truy cập Trang chủ:** Vào `http://localhost:5173/`.
2. **Click "Luyện tập Practice Mode":**
   * Xác nhận trang chuyển hướng đến `http://localhost:5173/exams/1/start?mode=PRACTICE&scope=FULL_EXAM`.
   * Thấy ô "Toàn bộ đề" và ô "Practice" đã được chọn sẵn viền xanh lá.
3. **Bấm "Bắt đầu làm bài":**
   * Chuyển vào Workspace `/attempts/:id`.
   * Xác nhận giao diện hiển thị đầy đủ bài đọc bên trái, danh sách 7 Parts bên phải (Reading Part 1-3, Listening Part 1-2, Writing Task 1-2) và toàn bộ 9 câu hỏi trong bảng câu hỏi.
   * Góc trên bên phải hiển thị huy hiệu `• Practice Mode`, không có đồng hồ đếm ngược.
4. **Kiểm tra trực tiếp Exam 2 (Fallback):**
   * Truy cập `http://localhost:5173/exams/2/start`.
   * Bấm bắt đầu làm bài ở chế độ Practice $\rightarrow$ Đề thi hiển thị đầy đủ bài đọc và câu hỏi, không còn bị rỗng hay chỉ có 1 câu đơn độc.
