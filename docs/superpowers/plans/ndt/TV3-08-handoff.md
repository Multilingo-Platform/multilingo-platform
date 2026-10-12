# TV3-08 — Handoff / execution ledger

Plan: docs/superpowers/plans/ndt/TV3-08-plan.md. Append-only.

## 2026-10-10 — Codex Planner — PLANNED

Người dùng đã duyệt plan và yêu cầu triển khai. Decisions: backend-only restore; direct finalAnswers POST after pending PUT; giữ backup sau submit.
Planning baseline: HEAD676cf82; frontend253 PASS/lint25 warnings/build PASS. Không phải implementation evidence.
Tasks01–06: PLANNED. Dependencies01→02→03→04→05→06.
Residual: backend chưa enforce submit baseVersion; response không ack final snapshot; abort không rollback; storage best-effort.

## 2026-10-10 — Codex Executor — IN_PROGRESS

Task01 bắt đầu. Giữ nguyên dirty backend/infrastructure của người dùng; frontend ban đầu sạch.
Pre-flight: task01 helpers → task03/04 snapshot; task02 optional signal → task03/04 lifecycle; task03 barrier → task04 submit → task05 UI. Interfaces tương thích.
Ruling: Dùng checkout feature hiện tại và handoff làm ledger qua apply_patch, không tạo worktree/commit hoặc dùng scripts Bash — Windows workspace có dirty state cần bảo toàn, user cấm commit; chi phí nếu sai: ledger không có task script-generated brief/commit range, bù bằng task IDs và test evidence.
Ruling: Spec đã được duyệt chính là request/contract/AC trong plan, không mở vòng approval/spec mới — không thay scope; chi phí nếu sai: tài liệu spec không có file riêng.

## 2026-10-10 — Codex Executor — TV3-08-01 — IMPLEMENTED

Snapshot/draft helpers và 14 tests. RED: thiếu modules, sau interface stub 5 failed/9 passed; GREEN: 14/14. Full suite 267 tests PASS (33 files). AC-01: giữ clear values/essay/deep copy; invalid IDs/values bị từ chối, storage exceptions trả false.
Task02 IN_PROGRESS: canonical submit/bounded writes. Contract đổi có chủ đích, page consumer cập nhật tại task05.

## 2026-10-10 — Codex Executor — TV3-08-02/03 — IMPLEMENTED (focused)

Task02 RED: 12/28 failed (legacy body, invalid receipt/input, hanging/abort); GREEN 28/28. Canonical POST, signal cancellation, tổng deadline10s cả interceptor queue; no shared Axios edits.
Task03 RED: autosave9 failures và reducer dirty-race1 failure; GREEN 58/58 trong answerSlice/useAutosave/useWorkspace. Scoped revision/request, barrier, latest draft, 1601 vs other409, deadline/cancel.
Full regression gate chờ task05 cập nhật page consumer cũ; chưa gọi toàn feature PASS.
Ruling: Thêm utils/attemptErrors.ts để autosave/submit dùng cùng phân loại 1601/409, không parse message — tránh logic khác nhau; chi phí nếu sai: thêm một helper file trong feature, không đổi wire contract.
Task04 IN_PROGRESS.

## 2026-10-10 — Codex Executor — TV3-08-04/05 — IMPLEMENTED (focused)

Task04 RED8/9 failed trước hook implementation; GREEN9/9. Direct snapshot/baseVersion sau barrier, mutex, errors/conflict, deadline/retry, draft retention/storage warning, stale cancellation.
Task05 RED5/6 page-contract tests và alert tests failed trên hành vi cũ. UI tích hợp controllers; bỏ polling/pre-PUT/false409 navigation; timeout result callback chỉ confirmed; error/retry/return-to-editing.
Đã giữ toàn bộ TV3-07 lock/route tests. Build PASS sau cập nhật typed fixtures. Full regression run đầu:292 PASS/1 failure do resume test còn expect Axios2args; cập nhật expectation signal/timeout, không bỏ test.
Ruling: SaveStatusBadge.test.tsx cần thêm initialState fields vào fixture để TypeScript build sau state migration — test-only compatibility; chi phí nếu sai: một test file ngoài danh sách ban đầu, không production scope expansion.
Ruling: Thêm retryLabel cho timeout conflict để mở authoritative reload thay vì retry POST bị chặn — giữ dirty-confirm và tránh modal không có lối thoát; chi phí nếu sai: thêm optional frontend UI prop, không API change.
Task06 IN_PROGRESS: real pipeline integration và final review.

## 2026-10-10 — Codex Executor — TV3-08-06 — IMPLEMENTED; REVIEW_PENDING

Integration thật: `autosaveSubmitContract.test.tsx` dùng page, hooks, Redux và API normalizer; chỉ mock HTTP/browser. Sáu scenarios PASS: B PUT pending → edit C → chờ → v8 → POST C/base8; giữ draft sau thành công; fresh-store dùng backend B; conflict/reload/new version; timeout lỗi/retry/confirmed result; StrictMode/malformed receipt; khóa palette; warning storage trong timeout dialog.

Regression phát hiện lỗi serialize đồng bộ khiến autosave ref bị stuck: test RED (status error thay vì saved sau sửa giá trị), dời execution sang Promise microtask để ref được gán trước completion; GREEN useAutosave17/17. Bổ sung guard palette/section và warning ngay trong overlay. Palette test ban đầu chưa POST vì cooldown của câu bỏ trống; sửa helper chờ cooldown, assert POST/precondition trước kiểm tra khóa; integration6/6 GREEN.

Files mới: utils/answerSnapshot.ts, answerDraft.ts, attemptErrors.ts; hooks/useAttemptSubmission.ts; tests answerSnapshot, answerDraft, useAttemptSubmission, SubmitOverlay, autosaveSubmitContract. Files sửa: api/attemptApi.ts, types/api.types.ts, store/answerSlice.ts, hooks/useAutosave.ts, pages/WorkspacePage.tsx; SubmitOverlay, TimeUpModal, modals/TimeUpOverlay; tests attemptApi, answerSlice, useAutosave, useWorkspace, WorkspacePage, TimeUpOverlay, SaveStatusBadge, resumeContract. Không sửa shared Axios/dependency/backend/schema.

| AC | Evidence |
|---|---|
| 01 | answerSnapshot11/answerDraft3; hook và integration exact finalAnswers, null/empty/Unicode/deep copy |
| 02 | useAutosave single-flight/deadline/cancel; answerSlice scoped response; attemptApi version từ backend |
| 03 | useAutosave pending-edit/latest-error draft; scoped reducer dirty acknowledgment; integration C sau PUT B |
| 04 | useWorkspace metadata tests; resumeContract; fresh-store integration backend B khác draft C |
| 05 | useAttemptSubmission barrier/live snapshot/no PUT; integration đúng một PUT/base8 |
| 06 | API receipt validation/10s/abort/late response; hydration/A→B→A tests; double submit/StrictMode; 401/403/409 no result |
| 07 | WorkspacePage41/SubmitOverlay2/TimeUpOverlay3; timeout retry reason/read-only/result gate/storage warning |
| 08 | Full frontend verification bên dưới; TV3-07 regression giữ nguyên; độc lập review đang chạy |

Matrix coverage: TC01/05/07/08/12/16 → useAutosave, answerSlice và integration; TC02/09/11 → useAttemptSubmission + page; TC03/04/06 → attemptApi; TC10 → answerSnapshot + exact POST integration; TC13 → TimeUpOverlay/SubmitOverlay/page/integration; TC14 → resumeContract + integration; TC15 → answerDraft/submission/integration. Bổ sung boundaries1/MAX, interval14999+1, late transport success, A→B→A và401/403: focused61/61 PASS (3 files).

Verification trước bổ sung matrix cuối: frontend36 files/300 tests PASS; build PASS (bundle warning cũ); lint exit0,25 warnings cũ; diff check clean. Backend `.\\mvnw.cmd clean test`:274 tests PASS,0 failures/errors/skips; chỉ verification theo repository instructions, không sửa backend. GenerateTemplateTest tạo Exam_Template.xlsx; đã chuyển riêng output này sang `C:/Users/admin/AppData/Local/Temp/TV3-08-Exam_Template-20261010-173449.xlsx` để không thêm file backend vào diff; có thể phục hồi từ đó.

Vietnamese documentation validator: plan0 errors/1 warning (“hết giờ”); handoff0 errors/0 warnings. Giữ “hết giờ” vì đây là deadline bài thi, không phải network timeout (ruling: thuật ngữ rõ nghĩa cho người đọc; chi phí nếu sai: một cảnh báo glossary).

Review request: reviewer độc lập chỉ đọc frontend/docs working tree và untracked files so với HEAD676cf82, đối chiếu 5 Review Focus. Giữ branch/checkout hiện tại, không commit/push/merge hoặc xóa ledger theo yêu cầu người dùng; đây là lựa chọn keep-as-is của finishing-a-development-branch.

Residual risks không đổi: backend chưa enforce submit baseVersion; receipt không ack finalAnswers; abort không rollback; localStorage best-effort; không bảo đảm cross-tab/close-tab durability. Không xem local draft là nguồn restore chính thức.

## 2026-10-10 — Codex Reviewer / Executor — PASS

Review độc lập `/root/tv3_08_review` (read-only): đã đọc frontend diff/untracked so với HEAD676cf82, plan và tests; không phát hiện Critical/Important/Minor. Năm focus đạt theo review: dirty/draft khi edit giữa PUT; revision/request isolation; submit single-flight; không false-success từ409/network; serializer giữ clears/Unicode. Reviewer không chạy lại full suite; executor cung cấp fresh verification bên dưới.

Reviewer declined-to-judge và executor rulings: backend baseVersion/finalAnswers acknowledgment → ngoài scope, giữ rủi ro công khai; rollback sau abort → không thể bảo đảm từ frontend; cross-tab/local recovery/close-tab → excluded trong approved plan, không mở rộng feature; dirty backend/infrastructure → sở hữu người dùng, bảo toàn. Không có finding cần fix hoặc minor bị hoãn.

| Gate cuối | Command | Evidence |
|---|---|---|
| Exam focused | npm test -- src/features/exam/__tests__ | 26 files/278 tests PASS, exit0 |
| Full frontend | npm test | 36 files/307 tests PASS, exit0, 17:40:48 |
| TypeScript/build | npm run build | PASS, exit0; bundle-size warning sẵn có |
| Lint | npm run lint | exit0; 0 errors/25 warnings, không tăng baseline |
| Whitespace/scope | git diff --check; git status --short | exit0; frontend/docs TV3-08 và dirty user-owned baseline, không còn generated XLSX trong repo |
| Backend verification | .\\mvnw.cmd clean test | 274 tests PASS,0 failures/errors/skips; BUILD SUCCESS |
| Tài liệu tiếng Việt | validate_copy.py --register eng-impersonal | 0 errors; plan1/handoff2 glossary warnings do thuật ngữ deadline đã có ruling |

Tasks TV3-08-01–06: IMPLEMENTED; AC-01–08: PASS; review: PASS. HEAD vẫn676cf82, branch feature/TV3-00-contract-audit. Không commit/push/merge, không thay dependency/shared Axios/backend/schema. Plan được giữ để truy vết; handoff append-only. Các kỹ năng executing-plans/TDD/verification-before-completion định hướng triển khai và evidence; ui-ux-pro-max/ui-styling định hướng loading/error/retry; vietnamese-tech-writing kiểm tra tài liệu.

## 2026-10-10 — Codex Executor — TV3-08 FIX P2 — IMPLEMENTED; REVIEW_PENDING

Fix confirmed finding [P2] Phân biệt autosave đã dừng với đang retry:
- Root cause: Trước đó khi nhận HTTP 409 không phải mã 1601, `useAutosave` đặt `blocked.current = true` nhưng dispatch `markSaveError(operation)`, dẫn đến `saveStatus` là `'error'`. Hệ quả là `SaveStatusBadge` hiển thị "Đang thử lại..." trong khi autosave đã dừng hẳn PUT và không cung cấp nút reload.
- Fix: Cập nhật `useAutosave.ts` phân loại cả `isVersionConflict(error) || isHttpConflict(error)` kích hoạt `blocked.current = true` và dispatch `markSaveConflict(operation)`. `saveStatus` chuyển thành `'conflict'`, giúp `SaveStatusBadge` hiển thị cảnh báo thay đổi phiên làm bài cùng nút "Tải lại bản mới nhất". Khi reload, người dùng được hỏi xác nhận ghi đè thay đổi (dirty-confirm), draft cục bộ được bảo toàn (`exam_draft_{attemptId}`) và `setAttemptContext` khôi phục dữ liệu từ backend đồng thời mở khóa (`blocked.current = false`) cho chu kỳ autosave phiên bản mới.
- Network/500 errors tiếp tục dispatch `markSaveError(operation)` với `saveStatus = 'error'`, hiển thị "Đang thử lại..." và thực hiện retry tự động mỗi chu kỳ 15s.
- Focused regression tests:
  - `useAutosave.test.tsx`: Bổ sung test phân biệt retry mạng hoạt động định kỳ với autosave bị dừng do HTTP 409 non-1601; xác minh authoritative reload unblock và resume autosave với phiên bản mới.
  - `autosaveSubmitContract.test.tsx`: Bổ sung integration pipeline test xác nhận HTTP 409 non-1601 dừng PUT, hiển thị conflict badge thay vì text retry, dirty confirmation, bảo toàn draft trong localStorage, và tiếp tục autosave sau authoritative reload.

| Gate kiểm thử | Command | Kết quả |
|---|---|---|
| Exam focused | npm test -- src/features/exam/__tests__ | 26 files / 280 tests PASS, exit 0 |
| Full frontend | npm test | 36 files / 309 tests PASS, exit 0 |
| Frontend build | npm run build | PASS, exit 0 |
| Frontend lint | npm run lint | PASS, 0 errors, 25 warnings cũ (baseline không đổi) |
| Git diff check | git diff --check | Clean, exit 0 |

Không commit/push/merge. Dừng chờ Codex re-review.

## 2026-10-10 — Codex Executor — TV3-08 FIX P1 — IMPLEMENTED; REVIEW_PENDING

Fix confirmed finding [P1] Phân biệt non-version 409 với version conflict:
- Root cause: Trước đó ở bản sửa P2, mọi lỗi HTTP 409 đều dispatch `markSaveConflict`, gán `saveStatus='conflict'`. Khi một PUT đang chờ trả về 409 ATTEMPT_EXPIRED sau deadline, trạng thái conflict này khiến `pauseAndWait()` trả về `status: 'conflict'` và `useAttemptSubmission.ts` chặn TIMEOUT_CLIENT submit trước khi gửi POST, làm mất cơ hội nộp `finalAnswers` mới nhất trong 15s grace period.
- Fix:
  - Bổ sung trạng thái `stopped` vào `SaveStatus` và reducer `markSaveStopped` trong `answerSlice.ts`.
  - Trong `useAutosave.ts`: Tách rõ ràng `isVersionConflict(error)` (chỉ mã 1601) dispatch `markSaveConflict` (chặn submit do phiên bản lệch) khỏi `isHttpConflict(error)` (non-version 409) dispatch `markSaveStopped` và `blocked.current = true` (dừng các PUT tiếp theo nhưng không xem là version conflict).
  - `pauseAndWait()` trong `useAutosave.ts` chỉ trả về `status: 'conflict'` khi `saveStatus === 'conflict'` (mã 1601); khi `saveStatus === 'stopped'`, nó trả về `status: 'ready'`, cho phép submission barrier tiến hành gửi canonical submit request (`TIMEOUT_CLIENT` hoặc `MANUAL`) với `baseVersion` và `finalAnswers` snapshot.
  - `SaveStatusBadge.tsx`: Cập nhật render `saveStatus === 'stopped'` với thông báo cảnh báo "⚠️ Không thể tự động lưu" cùng nút "Tải lại bản mới nhất", không hiển thị "Đang thử lại...", đồng thời hỗ trợ authoritative reload kèm dirty-confirm và bảo toàn draft.
- Focused regression tests:
  - `useAutosave.test.tsx`: Xác minh non-version 409 đặt `saveStatus='stopped'`, dừng PUT retry, và `pauseAndWait()` trả về `ready` (ngược lại với mã 1601 trả về `conflict`).
  - `autosaveSubmitContract.test.tsx`:
    - Deferred PUT nhận 409 ATTEMPT_EXPIRED tại deadline +1 ms: Submission barrier cho phép gửi `TIMEOUT_CLIENT` POST với đáp án draft mới nhất C và `baseVersion 7`, không phát sinh thêm PUT, và draft được giữ an toàn.
    - Deferred PUT nhận mã 1601 tại deadline: Bị chặn hoàn toàn, không gửi POST và kích hoạt trạng thái conflict.
  - `SaveStatusBadge.test.tsx`: Xác minh badge render thông báo không thể tự động lưu và nút tải lại cho trạng thái `stopped`.
  - `answerSlice.test.ts`: Xác minh action `markSaveStopped` cập nhật `saveStatus='stopped'` và giữ nguyên `isDirty=true`.

| Gate kiểm thử | Command | Kết quả |
|---|---|---|
| Focused 4 files | npm test -- answerSlice.test.ts SaveStatusBadge.test.tsx useAutosave.test.tsx autosaveSubmitContract.test.tsx | 4 files / 61 tests PASS, exit 0 |
| Exam focused | npm test -- src/features/exam/__tests__ | 26 files / 285 tests PASS, exit 0 |
| Full frontend | npm test | 36 files / 314 tests PASS, exit 0 |
| Frontend build | npm run build | PASS, exit 0 |
| Frontend lint | npm run lint | PASS, 0 errors, 25 warnings cũ (baseline không đổi) |
| Git diff check | git diff --check | Clean, exit 0 |

Không commit/push/merge. Dừng chờ Codex re-review.
