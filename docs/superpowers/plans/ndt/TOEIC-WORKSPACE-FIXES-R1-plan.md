# TOEIC Workspace Fixes R1 — Danh sách câu, Mock audio và nhãn review

**Ngày:** 2026-10-18  
**Trạng thái:** PLANNED  
**Baseline:** `75c91d0` trên `feature/TV3-00-contract-audit`.

## Mục tiêu và ràng buộc

Part 1–2 hiển thị toàn bộ câu cùng Part để người học cuộn làm bài; Mock Test phát audio ETS đã được xác minh; review luôn có nhãn A–D/A–C và không nhận nhầm đáp án khi text lựa chọn rỗng.

- Không thay snapshot, đáp án hoặc kết quả lịch sử; không thay autosave, submit, deadline, grading hay section lock.
- Mock chỉ phát liên tục theo timeline server, không pause/seek/replay; Practice giữ hành vi hiện có.
- Không lộ spoken text trong Mock; với Part 1–2, review chỉ hiển thị nhãn lựa chọn và thông báo thiếu lời thoại.
- Không commit hoặc push.

## Root cause đã xác nhận

1. `ListeningPartContent` chọn `activeGroup` ở Part 1 và `activeView` ở Part 2, nên chỉ render một câu/nhóm; palette không phải nguyên nhân gốc.
2. Frontend đã map `listeningPlayback`; profile production vẫn `BLOCKED`, thiếu approval, asset hashes và metadata checksum nên backend fail closed thành `UNAVAILABLE`.
3. `QuestionReviewCard` dùng text rỗng như một khóa so khớp fallback; `''` có thể làm mọi option rỗng thành đã chọn/đúng, đồng thời UI không render ID option.

## TWF-01 — Render toàn bộ Part 1–2

**Sửa:**

- `frontend/src/features/exam/components/workspace/ListeningPartContent.tsx`
- `frontend/src/features/exam/components/workspace/ToeicWorkspace.tsx`
- `frontend/src/features/exam/pages/WorkspacePage.tsx` (chỉ khi cần giữ hành vi palette)
- `frontend/src/features/exam/__tests__/ToeicListeningWorkspace.test.tsx`
- `frontend/src/features/exam/__tests__/ToeicWorkspaceContract.test.tsx`

**Thực hiện:** Viết test RED: Part 1 gồm sáu group phải render đồng thời sáu ảnh/sáu câu; Part 2 phải render đủ 25 câu và không có Câu trước/Câu sau. Sau đó bỏ nhánh render theo `activeGroup`/`activeView`, duyệt groups theo thứ tự server, giữ DOM id `q-<questionId>` và active state chỉ cho palette/cuộn. Loại props step navigation không còn dùng. Giữ filter Practice, khóa input, sanitizer Mock và một audio player/Part.

**Nghiệm thu:** Palette chỉ cuộn tới câu; chọn/đánh dấu không làm biến mất card khác. Part 1 sáu ảnh/câu, Part 2 25 câu cùng tồn tại.

## TWF-02 — Xác minh và kích hoạt media profile ETS

**Sửa/tạo:**

- `backend/src/main/resources/testing/toeic-listening-media-profile.json`
- `backend/src/test/java/com/multilingo/backend/modules/testing/service/support/ToeicListeningMediaProfileTest.java`
- `backend/src/test/java/com/multilingo/backend/modules/testing/controller/ListeningPlaybackContractIT.java`
- `docs/datasets/toeic-listening-playback-verification.md`
- Append `docs/datasets/official-exams-media-audit.md`

**Thực hiện:** Ghi nhận `OWNER_RIGHTS_CONFIRMED_CHAT_2026-10-17`. Tải bốn asset vào thư mục tạm ngoài repository; ghi thời điểm, HTTP status, MIME, ETag, size và SHA-256. Đo `loadedmetadata` trong browser, xác nhận duration hữu hạn, play/seek kỹ thuật, CORS từ frontend origin và mở đầu thuộc đúng Part. Tính offsets/tổng duration, điền evidence, hashes và metadata checksum theo quy tắc Jackson hiện có. Test profile thật và snapshot bundle phải cho workspace `available: true`, GET `NOT_STARTED`, POST `RUNNING`; fixture thiếu/tampered/BLOCKED vẫn bị chặn. Test tự động không gọi CDN.

**Nghiệm thu:** Chỉ profile đủ evidence, đúng bundle/snapshot mới bật Mock audio. Không có fallback Practice hoặc bỏ validation.

## TWF-03 — Nhãn lựa chọn trong review

**Sửa:**

- `frontend/src/features/exam/components/review/QuestionReviewCard.tsx`
- `frontend/src/features/exam/__tests__/QuestionReviewCard.test.tsx`
- `frontend/src/features/exam/__tests__/reviewPageContract.test.tsx`

**Thực hiện:** Viết RED cho options text rỗng A–D/A–C, `userAnswer` rỗng/null/array rỗng và correct answer thiếu/rỗng. Render ID bằng React text riêng; chỉ fallback so khớp text khi text không rỗng. Khi một lựa chọn thiếu text, hiển thị: “Chưa có lời thoại cho các lựa chọn. Vui lòng nghe audio để đối chiếu.” Giữ sanitizer, verdict, score, explanation và multi-answer hiện có.

**Nghiệm thu:** Nhãn luôn hiện, text rỗng không tạo checked/correct giả, Part có text/rich HTML không hồi quy.

## TWF-04 — Regression và bàn giao

Chạy contract thật (page/hook/reducer/normalizer, chỉ mock HTTP/browser media), browser smoke 1366/1920 px + keyboard/focus/sticky audio, focused frontend/backend, `tsc`, build và `git diff --check`. Append handoff với evidence, AC mapping, media verification và request final review.

## Acceptance criteria

| AC | Kết quả |
|---|---|
| AC-01 | Part 1 có sáu ảnh/câu, Part 2 có 25 câu cùng render; không Next. |
| AC-02 | Palette, flags, Practice retry và khóa input vẫn đúng. |
| AC-03 | ETS Mock audio khả dụng chỉ nhờ profile có evidence thật và timeline server. |
| AC-04 | Ownership/snapshot/profile validation vẫn fail closed. |
| AC-05 | Review hiện A–D/A–C và thông báo thiếu lời thoại. |
| AC-06 | Text rỗng không tạo selected/correct giả; Part có text/multi-answer không hồi quy. |
| AC-07 | Autosave, submit, deadline, section lock, grading và snapshot lịch sử không đổi. |

## Lệnh xác minh

```powershell
# frontend
npx vitest run src/features/exam/__tests__/ToeicListeningWorkspace.test.tsx src/features/exam/__tests__/ToeicWorkspaceContract.test.tsx src/features/exam/__tests__/QuestionReviewCard.test.tsx src/features/exam/__tests__/reviewPageContract.test.tsx src/features/exam/__tests__/reviewContract.test.ts src/features/exam/__tests__/WorkspacePractice.test.tsx src/features/exam/__tests__/useListeningPlayback.test.tsx src/features/exam/__tests__/autosaveSubmitContract.test.tsx
npx tsc -b --pretty false
npm run build

# backend
.\mvnw.cmd '-Dtest=ToeicListeningMediaProfileTest,ListeningPlaybackTimelineTest,ListeningPlaybackContractIT,ToeicWorkspaceContractIT,ToeicWorkspaceProjectionTest,ExamReviewContractIT' test

# root
git diff --check
git status --short
```
