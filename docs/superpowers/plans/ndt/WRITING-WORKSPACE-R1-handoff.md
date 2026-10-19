# WRITING-WORKSPACE-R1 — Handoff

## 2026-10-19 — Implementer — COMPLETED

**Feature:** WRITING-WORKSPACE-R1 — Đề bên trái, bài làm bên phải.  
**Baseline:** `2d23a9419f87e0757871be947fcd8438e763c5d8`, branch `feature/TV3-00-contract-audit`.  
**Subtasks:** WW-01 (COMPLETED), WW-02 (COMPLETED), WW-03 (COMPLETED), WW-04 (COMPLETED).

### Task status table

| Task | Title | Status | Files | Tests |
|---|---|---|---|---|
| WW-01 | Component đề Writing dùng chung cho desktop/mobile | COMPLETED | `WritingPromptContent.tsx` | `WritingPromptContent.test.tsx` (6/6 PASS) |
| WW-02 | Tích hợp layout và loại bỏ render trùng | COMPLETED | `WorkspacePage.tsx` | `WritingWorkspaceLayout.test.tsx` (5/5 PASS) |
| WW-03 | Editor không phụ trách hiển thị đề | COMPLETED | `EssayRenderer.tsx`, `QuestionRenderer.tsx` | `EssayRenderer.test.tsx` (8/8 PASS) |
| WW-04 | Contract regression, browser và bàn giao | COMPLETED | `CambridgeIeltsWorkspaceContract.test.tsx`, `WorkspaceWritingHints.test.tsx` | Full suite (89 test files, 1617 tests PASS) |

---

### Verification Evidence

1. **Unit & Integration Tests:**
   - `WritingPromptContent.test.tsx`: 6/6 tests PASS.
   - `WritingWorkspaceLayout.test.tsx`: 5/5 tests PASS.
   - `EssayRenderer.test.tsx`: 8/8 tests PASS.
   - `CambridgeIeltsWorkspaceContract.test.tsx`: 6/6 tests PASS.
   - `WorkspaceWritingHints.test.tsx`: 24/24 tests PASS.
   - `WorkspacePage.test.tsx`: 41/41 tests PASS.
   - `ToeicReadingWorkspace.test.tsx`: 23/23 tests PASS.
   - **Full test suite:** 89 test files passed, 1617 tests passed (0 failures).

2. **Build & Lint Verification:**
   - `tsc -b`: 0 errors.
   - `vite build`: Built cleanly in 1.21s, dist output generated.
   - `npm run lint`: 0 errors.

3. **Browser Live Verification (Attempt 57 - http://localhost:5173/attempts/57):**
   - **Task 1 (Desktop):**
     - Left pane: Hiển thị đầy đủ nhãn `WRITING TASK 1`, `IELTS Academic Writing`, tiêu đề `Writing Task 1`, khung hướng dẫn (20 phút, 150 từ), 3 bảng biểu dân số New York City rõ ràng, sắc nét và đoạn mô tả yêu cầu đề bài.
     - Right pane: Ô textarea soạn thảo bài viết nằm ngay đầu card, thanh đếm từ nằm ngay bên dưới textarea (`Yêu cầu tối thiểu 150 từ`, `0 / 150 từ`). Đề bài và ảnh bảng biểu không bị lặp lại ở cột bên phải.
     - Right sidebar: Sidebar "CHỌN PHẦN THI" và Question Palette giữ nguyên vị trí và tương tác.
     - Screenshot evidence: `C:/Users/admin/.gemini/antigravity/brain/4199b6ef-d3f2-4d62-8e2d-a9b0c1353a28/.system_generated/steps/121/media_0.png`
   - **Task 2 (Desktop):**
     - Left pane: Hiển thị tiêu đề `Writing Task 2`, hướng dẫn (40 phút, 250 từ), nội dung đề bài chuẩn.
     - Right pane: Chỉ có ô textarea soạn thảo bài viết với thanh đếm từ (`Yêu cầu tối thiểu 250 từ`, `0 / 250 từ`). Không bị lặp đề.
     - Screenshot evidence: `C:/Users/admin/.gemini/antigravity/brain/4199b6ef-d3f2-4d62-8e2d-a9b0c1353a28/.system_generated/steps/127/media_0.png`
   - **An toàn dữ liệu:**
     - Attempt 57 không bị gửi submit hoặc thay đổi nội dung bài làm.


4. **Writing Prompt Deduplication Fix:**
   - **Phát hiện:** Cột trái render 2 lần đoạn văn bản đề bài (1 lần từ `group.content_html` và 1 lần lặp lại từ `q.question_text` có prefix `"Writing Task 1:"` / `"Writing Task 2:"` kèm newlines `\n\n`).
   - **Xử lý:** Bổ sung hàm `normalizePromptText` chuẩn hóa văn bản (bỏ HTML tags, bỏ prefix task/câu/question dạng hoa/thường, chuẩn hóa mọi khoảng trắng và dấu cách). Deduplicate triệt để cả trường hợp prefix và newlines, đồng thời lưu `seenPromptTexts`.
   - **Tests:** Thêm 2 test cases trong `WritingPromptContent.test.tsx` (tổng 8/8 PASS).
   - **Browser Verification:** Ảnh chụp `media_0.png` (Task 1) và `media_0.png` (Task 2) tại step 154 và 166 của subagent `4199b6ef-d3f2-4d62-8e2d-a9b0c1353a28` xác nhận văn bản đề bài chỉ xuất hiện DUY NHẤT 1 LẦN.
