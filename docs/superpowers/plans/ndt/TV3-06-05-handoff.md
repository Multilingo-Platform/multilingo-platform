# TV3-06-05 — Regression và bàn giao

## 2026-10-09 — Codex Reviewer Final Review

- Agent: Codex Reviewer.
- Reviewed subtask ID: TV3-06-05 — Regression và bàn giao; review toàn feature TV3-06 theo approved plan và execution/review handoffs. Kiểm tra các thay đổi staged, unstaged và untracked; không có staged changes.
- Decision: **PASS** — không có finding P0/P1/P2 thuộc phạm vi TV3-06.
- Verified acceptance criteria:
  - AC-01/02/03/04/08: Backend autosave dùng owner-scoped pessimistic lock và transaction; stale version trả conflict trước khi mutate; bản đúng version lưu và tăng version một; answers rỗng không xóa câu trả lời; submitted/expired/wrong-owner không sửa state. Controller response chỉ có version, HTTP conflict mapping và request validation phù hợp contract.
  - AC-05: Frontend chỉ nhận server version; reducer dùng pendingVersion để giữ dirty khi có edit mới; hook phân biệt lỗi mạng với conflict, lưu draft khi lỗi mạng, không lặp ghi khi conflict, bỏ qua response sau cleanup và tiếp tục autosave sau authoritative reload.
  - AC-06/07: Conflict alert có reload workspace; direct pre-submit flush dùng version response cho submit, non-dirty dùng version hiện tại, lỗi submit giữ version đã flush. Cleanup lifecycle chặn response cũ sau đổi attempt/unmount; focused regression kiểm tra unmount, hydrate attempt mới và response trễ.
  - Không thấy route/schema/dependency mới, thay đổi TV2/admin API hoặc scope expansion đáng kể. Subtask 05 regression và handoff được thực hiện; không dùng hạng mục ngoài scope trong plan làm blocker.
- Findings: Không có finding in-scope P0/P1/P2 được xác nhận.
- Independent verification:
  - Backend focused: `cd backend; .\mvnw.cmd "-Dtest=TestAttemptAutosaveVersionTest,TestAttemptAutosaveControllerTest,TestAttemptAutosaveConcurrencyIT,TestAttemptWorkspaceResponseTest,TestAttemptSinglePartDurationTest,LearnerExamStructureServiceTest,LearnerExamStructureControllerIT" test` — **28 tests passed**, BUILD SUCCESS.
  - Frontend full suite: `cd frontend; npm test -- --run` — **30 files, 194 tests passed**.
  - `npm run lint` — exit 0, 21 warnings; output gồm cảnh báo hiện có ở các file ngoài phạm vi và warning useMemo tại `WorkspacePage.tsx:382`, dòng này không thuộc diff TV3-06.
  - `npm run build` — `tsc -b && vite build` thành công; có cảnh báo kích thước chunk lớn.
  - `git diff --check` — exit 0; Git chỉ cảnh báo chuyển đổi newline LF/CRLF ở hai file test frontend.
- Hạn chế xác minh: Không chạy toàn bộ backend test suite; backend regression command trên là bộ focused theo plan. Không thực hiện kiểm thử browser/manual.
- OUT-OF-SCOPE: `BackendApplication.java` modified và `TV3-03-review.patch` untracked được giữ nguyên, không thuộc TV3-06. Baseline `DbExamAdapter` issue và các mục plan loại trừ (part/question/locked-section validation, submit `baseVersion` enforcement phía backend, submit/scheduler lifecycle) không đánh giá thành blocker của feature này.
- Next required action: Handoff TV3-06 hoàn tất; có thể chuyển feature sang bước tích hợp/merge theo quy trình dự án. Không có code, tests hay approved plan nào được reviewer chỉnh sửa; file handoff này được tạo vì chưa tồn tại theo đường dẫn người dùng yêu cầu. Không commit/push.
