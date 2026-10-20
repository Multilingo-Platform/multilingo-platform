# TOEIC Workspace Fixes R1 — Handoff

## 2026-10-18 — Codex Planner — PLANNED

- **Baseline:** `75c91d0`, branch `feature/TV3-00-contract-audit`; working tree clean at executor preflight.
- **Plan:** `docs/superpowers/plans/ndt/TOEIC-WORKSPACE-FIXES-R1-plan.md`.
- **Tasks:** TWF-01 render Part 1–2; TWF-02 verify/activate listening media profile; TWF-03 review option labels; TWF-04 regression and handoff.
- **Root causes:** Part 1/2 are filtered by `activeGroup`/`activeView`; profile is intentionally `BLOCKED`; review matches blank option text as an answer fallback.
- **Planning evidence:** frontend focused 4 files / 107 tests PASS; media profile 20 tests PASS; `git diff --check` PASS. jsdom baseline logs `HTMLMediaElement.pause()` not implemented.
- **Locked decisions:** whole Part render, palette scroll-only, server-authoritative Mock audio, no transcript insertion, option IDs always visible, text fallback only when nonempty. Owner confirmed rights on 2026-10-17 (`OWNER_RIGHTS_CONFIRMED_CHAT_2026-10-17`).
- **No production implementation evidence yet.** No commit or push.

## 2026-10-18 — Codex Executor — TWF-01 IN_PROGRESS

- Beginning RED → GREEN for full Part 1/2 rendering. Existing active state stays palette-only; Mock sanitization and Practice filtering are in scope regression checks.

## 2026-10-18 — Codex Executor — TWF-01 IMPLEMENTED

- **Changed:** `ListeningPartContent.tsx`, `ToeicWorkspace.tsx`, `ToeicListeningWorkspace.test.tsx`, `ToeicWorkspaceContract.test.tsx`.
- **Behavior:** Part 1 now renders every server-ordered group with its own stable image/card; Part 2 renders every provided question and no longer has previous/next controls. The palette retains active-question state and scrolls to a mounted DOM node.
- **RED evidence:** 5 new expectations failed against the previous implementation: Part 1/2 only rendered one card, no group-specific photo ID, and the old integration assumed Next.
- **GREEN evidence:** `npx vitest run src/features/exam/__tests__/ToeicListeningWorkspace.test.tsx src/features/exam/__tests__/ToeicWorkspaceContract.test.tsx` → 2 files, 37 tests PASS.
- **AC:** AC-01 and the rendering/palette portion of AC-02. Mock labels-only sanitization, Practice feedback and locked input remain covered by the focused suite.

## 2026-10-18 — Codex Executor — TWF-02 IN_PROGRESS

- Starting independent asset/browser verification before any production profile is marked `VERIFIED`; no CDN result will be substituted with synthetic metadata.

## 2026-10-18 — Codex Executor — TWF-02 IMPLEMENTED

- **Changed:** production listening profile; `ToeicListeningMediaProfileTest`; `ListeningPlaybackContractIT`; `docs/datasets/toeic-listening-playback-verification.md`; append-only ETS audio update in `official-exams-media-audit.md`.
- **Real asset evidence:** all four Cloudinary tracks returned HTTP 200 / `audio/mpeg`; ETag/content-length match downloaded files. Browser `loadedmetadata`, cross-origin anonymous CORS fetch, seek and muted playback PASS. Hashes, browser durations, cumulative offsets and Jackson metadata checksum are documented in the new verification file.
- **Source binding:** profile URLs equal bundle `shared_audio` Part 1–4; `OWNER_RIGHTS_CONFIRMED_CHAT_2026-10-17` is now the explicit approval reference. The profile remains fail-closed on tamper, missing evidence or incompatible snapshot.
- **RED/GREEN:** `ToeicListeningMediaProfileTest` failed with the old BLOCKED profile (`TOEIC listening media verification is unavailable`), then passed after verified evidence. `ListeningPlaybackContractIT` runs a new unmocked classpath-profile case: workspace `NOT_STARTED`/available, GET `NOT_STARTED`, POST `RUNNING`.
- **Verification:** profile unit 20/20 PASS; playback contract integration 20/20 PASS (report confirms unmocked production-profile test). Existing backend compiler warnings are unrelated (`UserMapper` phone mapping and unchecked `ExamContentNormalizer`).
- **AC:** AC-03 and AC-04 at contract/profile level. No user-owned local backend process was stopped or restarted; the test classpath loaded the updated resource.

## 2026-10-18 — Codex Executor — TWF-03 IN_PROGRESS

- Starting RED tests for option IDs, blank answer matching and a real review page/normalizer fixture.

## 2026-10-18 — Codex Executor — TWF-03 IMPLEMENTED

- **Changed:** `QuestionReviewCard.tsx`, `QuestionReviewCard.test.tsx`, `reviewPageContract.test.tsx`.
- **Behavior:** Every review option now renders its ID as ordinary React text. An option with absent or empty text produces one per-question audio-only notice. ID comparison remains primary; legacy content comparison is used only for non-empty content, so `''`, `null` and `[]` cannot select or mark every blank option.
- **RED/GREEN:** New component and real page/API-normalizer tests failed before the change (missing IDs and blank-text false selections), then `npx vitest run src/features/exam/__tests__/QuestionReviewCard.test.tsx src/features/exam/__tests__/reviewPageContract.test.tsx` → 2 files, 40 tests PASS.
- **AC:** AC-05 and AC-06. Existing rich HTML, multi-answer and sanitized rendering remain covered by the same suite.

## 2026-10-18 — Codex Executor — TWF-04 IN_PROGRESS

- Running the approved cross-feature frontend/backend regression, typecheck/build and diff checks. Browser smoke requires an authenticated, compatible local attempt and will be recorded separately from automated evidence.

## 2026-10-18 — Codex Executor — TWF-04 IMPLEMENTED

- **Frontend regression:** `npx vitest run src/features/exam/__tests__/ToeicListeningWorkspace.test.tsx src/features/exam/__tests__/ToeicWorkspaceContract.test.tsx src/features/exam/__tests__/QuestionReviewCard.test.tsx src/features/exam/__tests__/reviewPageContract.test.tsx src/features/exam/__tests__/reviewContract.test.ts src/features/exam/__tests__/WorkspacePractice.test.tsx src/features/exam/__tests__/useListeningPlayback.test.tsx src/features/exam/__tests__/autosaveSubmitContract.test.tsx` → 8 files, 194 tests PASS.
- **Build:** `npx tsc -b --pretty false` PASS; `npm run build` PASS. Vite vẫn báo bundle lớn hơn 500 kB, là warning baseline/ngoài phạm vi, không có lỗi lint/type.
- **Backend regression:** `./mvnw.cmd '-Dtest=ToeicListeningMediaProfileTest,ListeningPlaybackTimelineTest,ListeningPlaybackContractIT,ToeicWorkspaceContractIT,ToeicWorkspaceProjectionTest,ExamReviewContractIT' test` → 97 tests, 0 failure/error/skip, BUILD SUCCESS. Có warning compiler baseline về `UserMapper.phone` và unchecked `ExamContentNormalizer`.
- **Repository:** `git diff --check` PASS. Không commit hoặc push.
- **Browser smoke:** Chưa chạy trên một attempt Mock `IN_PROGRESS` xác thực do không dừng/restart backend do người dùng sở hữu và không tạo/sửa attempt thật trong lượt này. Không dùng kết quả automated để tuyên bố đã kiểm tra viewport 1366/1920 hay keyboard với backend thật. Đây là kiểm chứng còn lại trước release UI.
- **AC mapping:** AC-01/02 qua whole-Part và palette contract; AC-03/04 qua profile/endpoint contracts và asset audit; AC-05/06 qua component + normalizer/page contracts; AC-07 qua regression không đổi autosave/submit/lock/snapshot.

## 2026-10-18 — Codex Reviewer — PASS

- Review toàn bộ working-tree diff so với baseline `75c91d0`: không có P0/P1. TWF-01 render toàn Part, TWF-02 fail-closed theo profile/snapshot, TWF-03 không còn empty-text false match; không thấy ảnh hưởng tới autosave, submit, grading, deadline, section lock hoặc snapshot.
- **P2 đã xử lý:** evidence TWF-04 và giới hạn browser smoke được ghi rõ trong entry ngay trên.
- Không xác minh độc lập quyền sử dụng hoặc toàn bộ nội dung audio ngoài reference quyền do chủ dự án cung cấp.

---

## 2026-10-18 — Codex Reviewer — Re-review toàn feature TOEIC Workspace Fixes R1

**Agent:** Codex Reviewer  
**Scope:** TWF-01–TWF-04, toàn bộ AC-01–AC-07; baseline HEAD `75c91d0`, staged rỗng; review đủ 11 tracked diffs và 3 tài liệu untracked liên quan.  
**Decision: PASS — không có P0/P1 được xác nhận; 1 P2 không chặn nghiệm thu.**

### Finding IN-SCOPE

- **TWF-R1-F1 — P2: palette cuộn đầu card vào dưới sticky audio khi Part 1/2 nay render dạng danh sách.**
  - **Vị trí thay đổi kích hoạt:** `frontend/src/features/exam/components/workspace/ListeningPartContent.tsx:213`; tích hợp với `QuestionCard.tsx:56` (scroll margin chỉ 16px) và `WorkspacePage.tsx:1615-1620` (scrollIntoView block start).
  - **Kịch bản đã tái hiện:** dùng keyboard Enter trên palette câu 20 ở Part 2; aria-current cập nhật đúng và đủ 25 card còn trong DOM, nhưng tại viewport 1920×900, card top=80px trong khi sticky header chiếm y=88–126px, che số câu/nút đánh dấu. Tại 1366×900 cũng có overlap (card top=99px, header bottom=126px). Với trạng thái audio báo lỗi, header cao hơn và có thể che cả lựa chọn đầu. Trước R1 Part 2 chỉ có một card, nên đường cuộn giữa các card này mới xuất hiện trong R1.
  - **Sửa tối thiểu:** áp scroll-padding-top cho vùng cuộn hoặc scroll-margin-top của card theo chiều cao sticky header thực tế, kể cả trạng thái blocked/error; giữ sticky audio.
  - **Regression:** browser test navigate bằng click/Enter tới câu giữa danh sách tại 1366/1920; assert phần header của card nằm dưới đáy sticky audio và vẫn thao tác đánh dấu được. Đây là P2 vì người học vẫn có thể cuộn tay để thấy đầu card.

### Acceptance và tính đúng đắn

| AC | Đánh giá |
|---|---|
| AC-01 | PASS — Part 1 sáu ảnh/câu; Part 2 25 câu đồng thời, bỏ Next/Previous; thứ tự nhóm/câu giữ từ server. |
| AC-02 | PASS chức năng palette/flag/Practice filter/lock; có P2 scroll offset nêu trên. |
| AC-03 | PASS theo profile/evidence — profile thật VERIFIED, checksum loader hợp lệ; đối chiếu trực tiếp bốn URL bằng URL bundle canonical; counts 6/25/39/30. Workspace/GET/POST integration chạy profile mặc định thật. |
| AC-04 | PASS — không nới validation hoặc ownership; focused tests giữ fail-closed cho profile tampered/missing/BLOCKED và snapshot không khớp. |
| AC-05 | PASS — option ID render bằng React text, empty-text notice hiện theo contract. |
| AC-06 | PASS — blank/null/empty array không so khớp text rỗng; ID, text có nội dung, rich HTML/multi-answer và page-normalizer regressions xanh. |
| AC-07 | PASS — diff không đổi autosave/submit/deadline/grading/section lock hoặc historical snapshot; focused regression xanh. |

### Reviewer-run verification

Frontend, từ frontend:

```powershell
npx vitest run src/features/exam/__tests__/ToeicListeningWorkspace.test.tsx src/features/exam/__tests__/ToeicWorkspaceContract.test.tsx src/features/exam/__tests__/QuestionReviewCard.test.tsx src/features/exam/__tests__/reviewPageContract.test.tsx src/features/exam/__tests__/reviewContract.test.ts src/features/exam/__tests__/WorkspacePractice.test.tsx src/features/exam/__tests__/useListeningPlayback.test.tsx src/features/exam/__tests__/autosaveSubmitContract.test.tsx
```

**8 files / 194 tests PASS**, exit 0 (18.38s). Có hai jsdom pause-not-implemented notices; không có test failure.

Backend, từ backend:

```powershell
.\mvnw.cmd '-Dtest=ToeicListeningMediaProfileTest,ListeningPlaybackTimelineTest,ListeningPlaybackContractIT,ToeicWorkspaceContractIT,ToeicWorkspaceProjectionTest,ExamReviewContractIT' test
```

**97 tests, 0 failures/errors/skips; BUILD SUCCESS**, exit 0 (1m10s). Dùng test profile/H2, không DB developer. Test unmocked default media profile thực sự đi qua workspace summary → GET NOT_STARTED → POST RUNNING.

- **Browser smoke reviewer-run mới (skill playwright):** Chromium với production WorkspacePage/store/normalizer/hook/components được load từ Vite hiện có, MemoryRouter và fixture Mock cô lập; chỉ thay HTTP/browser media. Không tạo/sửa attempt thật hoặc restart server.
- 1366×900 và 1920×900: Part 1 có sáu ảnh/sáu card sau chọn A/đánh dấu; không horizontal overflow. Part 2 có 25 card, không Next/Previous; palette Enter giữ focus/outline và aria-current; một audio element, native controls=false, header sticky. Ghi nhận P2 overlap ở trên. Mock media dùng WAV im lặng để kiểm tra layout, không dùng smoke này làm bằng chứng audio ETS thực sự phát.
- Browser probe/ảnh/console được lưu ngoài repository trong TEMP; đã đóng browser session riêng và chuyển diagnostics CLI ra TEMP. Không để path source/test mới trong worktree.
- **Reviewer-run:** `git diff --check` exit 0 (notices LF/CRLF); staged rỗng. Đối chiếu JSON profile/bundle cho cả bốn URL cho kết quả match.
- **Executor-reported, không chạy lại lượt này:** typecheck/build PASS; tải/hash audio thật, Chromium loadedmetadata/CORS/seek/muted playback và approval reference trong `docs/datasets/toeic-listening-playback-verification.md`. Reviewer kiểm tra tính nhất quán tài liệu/profile/tests, không tải hoặc nghe lại CDN, không xác minh độc lập quyền sử dụng/toàn bộ nội dung lời thoại.
- Không chạy full frontend/backend suite. Browser smoke với backend/attempt xác thực thật vẫn là follow-up trước release, không đồng nhất với fixture smoke vừa chạy.

### OUT-OF-SCOPE và next action

- Không xác nhận defect ngoài phạm vi mới; không mở lại các vấn đề dataset/import/grading hoặc redesign đã nghiệm thu.
- **Next action:** có thể nghiệm thu phần chức năng R1; chỉnh TWF-R1-F1 khi hoàn thiện UI và giữ kiểm tra deployment/CSP/audio thật trong release checklist. Lượt này chỉ append handoff; không sửa production code/tests/plan, không stage/commit/push.

