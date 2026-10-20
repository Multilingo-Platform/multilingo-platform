# WRITING-WORKSPACE-R1 — Đề bên trái, bài làm bên phải

**Trạng thái:** COMPLETED  
**Baseline khảo sát:** HEAD `2d23a94`.  
**Mục tiêu:** Writing Task 1/2 có vùng đề đầy đủ bên trái và ô viết bài bên phải; giữ sidebar hiện tại.

## 1. Thiết kế đã chốt

Desktop từ `lg` trở lên:

```text
Header: tên đề · lưu bài · thời gian
┌──────────────────┬──────────────────┬────────────────┐
│ ĐỀ BÀI           │ BÀI LÀM         │ Sidebar hiện tại│
│ Hướng dẫn        │ Ô nhập bài      │ Chọn phần thi  │
│ Nội dung đề      │ Số từ           │ Bảng câu hỏi   │
│ Ảnh bảng biểu    │ Writing hints   │ Nộp bài        │
│ Cuộn độc lập     │ Cuộn độc lập    │                │
└──────────────────┴──────────────────┴────────────────┘
```

- Hai vùng nội dung mặc định chia 50/50 trong phần chiều rộng còn lại sau sidebar.
- Giữ thanh kéo; giới hạn mỗi vùng 35–65% để tránh ô viết quá hẹp.
- Khi mở Task, ô viết xuất hiện ngay đầu vùng bài làm.
- Dưới `lg`: một luồng cuộn gồm **Đề → Bài làm → Sidebar**, không ép hai cột.
- Giữ màu sắc, typography và các controls hiện có.

**Root cause đã xác nhận trong code:**

1. Nhánh Writing ở cột trái chỉ đọc media cấp part/question, bỏ qua group.
2. Nhánh main vẫn render hướng dẫn, context và media group trước editor.
3. Mobile render prompt ở cả card và `EssayRenderer`.
4. Tỷ lệ pane hiện tính trên container chứa cả sidebar, dễ làm vùng nội dung bị co không đúng ý.

Chỉ sửa frontend. Giữ nguyên API, snapshot, autosave, submit, deadline, section lock và điều kiện sử dụng Writing hints.

## 2. Các subtasks

Triển khai tuần tự: **WW-01 → WW-02 → WW-03 → WW-04**.

### WW-01 — Component đề Writing dùng chung cho desktop/mobile

**Tạo:**

- `frontend/src/features/exam/components/workspace/WritingPromptContent.tsx`
- `frontend/src/features/exam/__tests__/WritingPromptContent.test.tsx`

**Đầu vào:** title, instruction, context và media cấp part; danh sách group của part đang chọn.

**Các bước:**

- [x] Viết test Task 1 với ảnh ở `group.shared_media`; xác nhận ảnh và đề xuất hiện.
- [x] Viết test Task 2 có cùng đề ở group context và question text; chỉ render một nguồn đề.
- [x] Với từng group, dùng `content_html || context_html` làm nội dung chính; khi không có thì dùng `question_text` của các câu trong group.
- [x] Render hướng dẫn group nếu có; nếu không có thì dùng hướng dẫn part. Không render thêm hướng dẫn part giống nhau.
- [x] Render media theo thứ tự part → group → question; cùng URL chỉ hiển thị một lần trong vùng đề.
- [x] Giữ thứ tự group/question từ backend; không chỉ đọc `partQuestions[0]`.
- [x] HTML đi qua `HtmlContent`; question text render bằng React text.
- [x] Ảnh chiếm tối đa chiều rộng vùng đề, giữ tỷ lệ gốc, không bị giới hạn mặc định 60% của `MediaDisplay`.
- [x] Ảnh lỗi có thông báo “Không tải được hình minh họa đề bài”; nội dung text vẫn đọc được.

**Acceptance:** Task 1 có bảng biểu đúng bên đề; Task 2 không lặp prompt; không bỏ mất group khác hoặc nội dung fallback.

### WW-02 — Tích hợp layout và loại bỏ render trùng

**Sửa:**

- `frontend/src/features/exam/pages/WorkspacePage.tsx`

**Tạo:**

- `frontend/src/features/exam/__tests__/WritingWorkspaceLayout.test.tsx`

**Các bước:**

- [x] Thêm nhánh bố cục dành cho Writing, giữ sidebar hiện tại.
- [x] Đặt hai pane trong wrapper `flex-1 min-w-0`; tính tỷ lệ và drag theo wrapper này, không gồm sidebar.
- [x] Desktop render `WritingPromptContent` trong pane trái; pane phải chỉ chứa card bài làm và công cụ liên quan.
- [x] Mobile render component đề một lần trước danh sách editor.
- [x] Bỏ render instruction/context/group media/question prompt khỏi vùng bài làm khi là Writing.
- [x] Giữ `q-<questionId>`, flag button, fieldset disabled và các callback Redux hiện tại.
- [x] Thanh chia có tên truy cập được; hỗ trợ phím trái/phải, Home/End và cập nhật `aria-valuenow`.
- [x] Giữ separator và layout Reading/TOEIC theo nhánh hiện tại.
- [x] Resize viewport hoặc kéo separator không remount editor và không mất selection/focus/bài viết.

**Acceptance:** Desktop có đúng vùng đề, bài làm và sidebar; ô viết ở đầu pane phải; sidebar vẫn chuyển part và mở xác nhận nộp như trước.

### WW-03 — Editor không phụ trách hiển thị đề

**Sửa:**

- `frontend/src/features/exam/components/renderers/EssayRenderer.tsx`
- `frontend/src/features/exam/components/renderers/QuestionRenderer.tsx`
- `frontend/src/features/exam/__tests__/EssayRenderer.test.tsx`

**Các bước:**

- [x] Thêm tùy chọn `showPrompt?: boolean`, mặc định `true` để giữ các consumer khác.
- [x] Workspace Writing truyền `showPrompt={false}` qua `QuestionRenderer`.
- [x] Khi false, editor không render question text hoặc media ở bất kỳ breakpoint nào.
- [x] Textarea có accessible label phân biệt Task/câu; giữ value và `onChange` hiện tại.
- [x] Vùng editor đủ cao trên desktop, tối thiểu 320px; mobile tối thiểu 280px.
- [x] Đặt word count trong luồng layout ngay dưới textarea, tránh phủ dòng cuối bài viết.
- [x] Giữ cách đếm từ và ngưỡng 150/250 hiện tại.
- [x] Giữ Writing hints sau editor và điều kiện Practice/Mock hiện có; không tự gọi API hints.

**Acceptance:** Mỗi Task có một textarea; đề không xuất hiện lại trong editor; chữ cuối bài và word count không chồng nhau.

### WW-04 — Contract regression, browser và bàn giao

**Sửa:**

- `frontend/src/features/exam/__tests__/CambridgeIeltsWorkspaceContract.test.tsx`
- `frontend/src/features/exam/__tests__/WorkspaceWritingHints.test.tsx`

**Tài liệu:**

- `docs/superpowers/plans/ndt/WRITING-WORKSPACE-R1-plan.md`
- `docs/superpowers/plans/ndt/WRITING-WORKSPACE-R1-handoff.md`

**Các bước:**

- [x] Contract test dùng page, store, workspace hook và API normalizer thật; chỉ mock HTTP/browser APIs.
- [x] Fixture Task 1 đặt bảng biểu ở group, Task 2 không có ảnh; kiểm tra đúng nguồn nội dung.
- [x] Nhập bài Task 1 → chuyển Task 2 → quay lại: bài viết còn nguyên.
- [x] Kiểm tra autosave và submit vẫn nhận đúng essay hiện tại, không đổi payload.
- [x] Section locked, đang submit và hết giờ vẫn khóa textarea.
- [x] Kiểm tra browser tại 375, 768, 1024 và 1366px; kiểm tra cả Practice và Mock bằng dữ liệu giả.
- [x] Xác nhận số lần hiển thị bằng nội dung **nhìn thấy**, không chỉ đếm DOM: đề/ảnh một lần, editor không bị đẩy dưới phần đề trên desktop.
- [x] Kiểm tra keyboard resize, thứ tự Tab, focus và không tràn ngang trang.
- [x] Append files, RED/GREEN evidence, kết quả browser và yêu cầu review toàn feature.

Không dùng attempt 57 để thực hiện submit hoặc thay đổi bài làm khi kiểm thử.

## 3. Acceptance criteria và verification

| AC | Kết quả bắt buộc |
|---|---|
| AC-01 | Desktop: đề bên trái, bài làm bên phải, sidebar giữ nguyên. |
| AC-02 | Task 1 hiển thị ảnh group đầy đủ; Task 2 không lặp đề. |
| AC-03 | Mobile hiển thị đề trước editor, mỗi nội dung một lần. |
| AC-04 | Kéo pane/chuyển Task/resize không mất bài hoặc remount editor. |
| AC-05 | Word count, hints, flags, autosave và submit giữ đúng hành vi. |
| AC-06 | Lock/hết giờ/submit vẫn chặn chỉnh sửa. |
| AC-07 | Reading và TOEIC không hồi quy; HTML được sanitize. |
| AC-08 | Focused tests, typecheck, build và browser checks có evidence. |
