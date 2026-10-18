# TOEIC Workspace Redesign — Part 1–7

**Ngày:** 2026-10-17  
**Trạng thái:** PLANNED  
**Phạm vi:** Làm mới không gian làm bài TOEIC theo từng Part, dựa trên UI BRIEF và dữ liệu thực tế của ETS 2024 Test 1. Chỉ thay đổi workspace desktop; không thay đổi trang chủ, setup, thư viện, kết quả, review, IELTS, Writing/Speaking hoặc layout mobile.

## Mục tiêu

Tạo workspace nhất quán cho TOEIC Part 1–7, hiển thị đúng nội dung và số câu toàn đề, hỗ trợ Mock Test có audio theo thời gian server và Practice có điều khiển nghe lại. Không để đáp án, transcript hoặc gợi ý suy ra đáp án rò rỉ vào Mock Test. Giữ nguyên autosave, restore, submit, deadline, khóa section và snapshot lịch sử hiện có.

## Thiết kế Stitch

Tạo project desktop mới `Multilingo TOEIC Workspace` trong Stitch, không sửa project/screen hiện có. Giữ nhận diện amber/cam hiện tại (`#d97706`, hover `#b45309`), nền trắng/slate, Plus Jakarta Sans/Inter và Lucide. Thiết kế ở chiều rộng 1366, 1440 và 1920 px.

Tạo design system và các screen:

1. Mock Part 1: một ảnh lớn, bốn lựa chọn chỉ có nhãn A–D.
2. Mock Part 2: một câu hiện tại, chỉ có nhãn A–C; không hiện transcript/câu được phát.
3. Mock Part 3: một nhóm hội thoại ba câu, vùng tham chiếu bên trái khi có ảnh.
4. Mock Part 4: một nhóm bài nói ba câu, vùng tham chiếu bên trái khi có ảnh.
5. Mock Part 5: câu độc lập trong cột đơn giữa trang.
6. Mock Part 6: passage và câu hỏi chia đôi, không tạo anchor giả.
7. Mock Part 7: toàn bộ nội dung nhóm ở pane trái, câu hỏi ở pane phải, hai pane cuộn riêng và có thanh chia.
8. Practice Part 2 sau khi kiểm tra đáp án: trạng thái phản hồi và transcript chỉ khi snapshot thực sự có.
9. Practice Part 4 có media: điều khiển tua lại 10 giây và tốc độ 0.75×/1×/1.25×/1.5×.
10. Mock khôi phục sau reload/mất mạng: audio bám đồng hồ server hiện tại, không phát bù đoạn đã lỡ.

Khung chung: header cao 64 px; sidebar Part/câu rộng 288 px, cuộn độc lập; vùng nội dung tối đa 840 px; Reading split mặc định 50/50, giới hạn 30–70%, có nút/keyboard để đổi kích thước và khôi phục 50/50. Số câu toàn đề hiển thị 1–200; trạng thái đã trả lời dựa trên `isAnswered`, đánh dấu cờ không chỉ dựa vào màu. Câu/Part bị khóa không được điều hướng. Dùng “Đánh dấu” thay “Xem lại”. Mọi trạng thái có nhãn chữ và focus rõ.

Mock Listening dùng audio tùy chỉnh, không có pause/seek/replay; chỉ phát liên tục và tự chuyển Listening Part theo timeline. Chuyển sang Reading tiếp tục qua xác nhận/khóa Listening đang có. Practice có điều khiển nghe lại. Khi đổi Part, dừng media của Part trước. Không sao chép mã HTML Stitch vào production; xem Stitch như đặc tả thị giác.

## Quyết định đã chốt

- Giữ màu amber/cam và tạo Stitch project riêng.
- Bao gồm backend TV3 tối thiểu để Mock audio dùng timeline authoritative từ server và workspace Mock không trả transcript/answer clue.
- Mock audio không pause/seek/replay; tự chuyển Listening Part. Reading lock/confirmation giữ workflow hiện tại.
- Chỉ hiện transcript/listening text trong Practice sau “Kiểm tra đáp án”, nếu dữ liệu snapshot có trường rõ ràng.
- Reload/network recovery bám thời gian server hiện tại; không phát bù audio đã lỡ.
- Part 7 giữ toàn bộ `content_html` của nhóm trong pane trái có cuộn riêng; không suy ra passage tabs.
- Giữ nguyên deadline hiện tại của attempt; không thêm deadline Listening/Reading riêng.

## Hiện trạng repository và ràng buộc

- `frontend/src/features/exam/pages/WorkspacePage.tsx` là trang lớn hiện tại, đã xử lý workspace hydration, route/generation guards, section lock, autosave/submit và trạng thái hết giờ. Tách view TOEIC theo content/group nhưng giữ luồng lifecycle chung.
- `QuestionPalette.tsx` chưa đọc đủ mọi hình dạng `questionGroups`; câu canonical như `q_001` không có `question_number`, nên hiện có thể thiếu số hiển thị. Cần bổ sung số toàn đề ở projection FE, không dùng index mảng hay DB ID.
- `AudioPlayer.tsx` hiện dùng native controls. `HtmlContent.tsx` có thể thêm controls cho audio/video nhúng; ReferencePane TOEIC phải vô hiệu hóa đường media nhúng để không vượt custom player.
- `examPartUtils.ts` hiện có thể tính sai nhãn Part cho Reading khi Part number không có trong title hoặc dùng số Part của section.
- TOEIC runtime bundle có 7 Part/200 câu, audio ở Part 1–4; audio map chỉ có URL, không có duration. Part 1 có 6 câu, Part 2 có 25, Part 3/4 là nhóm 3 câu, Part 5 một nhóm, Part 6 bốn nhóm, Part 7 mười lăm nhóm. ID câu là `q_001`…`q_200`, không có trường số câu riêng.
- TOEIC Part 1/2 có options rỗng về text; UI cần hiển thị nhãn lựa chọn theo thứ tự, không chèn nội dung đọc thành tiếng.
- Part 7 có `content_html` nguyên nhóm; không có cấu trúc passage con đáng tin để tách tab. Part 6 blanks đang là văn bản tĩnh, không có mapping tương tác được xác minh.
- `ExamFixture` và `ExamSnapshot` hiện không có code/type; nếu thêm, phải tương thích snapshot/fixture cũ và chỉ áp dụng với attempt mới. Không suy ra exam identity từ title hay mutable DB row.
- `WorkspaceSnapshotSanitizer` đã loại secret grading fields nhưng chưa có chế độ loại transcript/clue theo Mock. Practice feedback có thể trả nội dung theo từng câu sau khi kiểm tra đáp án; không trả transcript của cả nhóm.
- `TestAttempt` dùng `version` thủ công cho câu trả lời, không phải `@Version`. Playback state không được sửa answer version hoặc snapshot.
- Frontend focused baseline chạy được: 5 files / 64 tests PASS. `git diff --check` PASS với cảnh báo LF/CRLF sẵn có. Working tree có thay đổi chính thức ETS/IELTS chưa commit; phải giữ nguyên.

### Không được thay đổi

- Không thay API autosave/submit, versioning đáp án, deadline, authoritative restore, dirty-confirm, route guard, section lock, result/review hoặc lịch sử attempt.
- Không thay shared Axios, auth, dependency, UI framework, IELTS/Writing renderer hoặc quy tắc media chung ngoài điểm tích hợp TOEIC cần thiết.
- Không đưa transcript, đáp án, explanation, grading key, cue/offset nhạy cảm vào start/workspace Mock response hoặc DOM.
- Không gọi CDN thật trong automated tests; dùng HTTP/browser mock. Không tuyên bố CDN URL là DRM hoặc playback hoàn toàn không thể bị người dùng trực tiếp truy cập.
- Không đưa tìm kiếm AI/lookup vào Mock Test; giữ Practice behavior có sẵn.

## Thiết kế kỹ thuật

### Workspace projection và số câu

Thêm projection server-side cho attempt mới để đưa `examCode`/`examType` từ dữ liệu exam vào snapshot lúc tạo attempt. Tương thích snapshot cũ bằng fallback rõ ràng theo `examCode` đã lưu nếu có; không tra title hay mutable exam row để suy đoán. Project `question_number` chỉ trong response dùng cho UI, không sửa dữ liệu snapshot/grading.

Số chính thức lấy từ explicit source question number khi có; với bundle TOEIC này, parse `q_001` thành 1 theo pattern canonical và giới hạn trong phạm vi Part/attempt đã kiểm tra. Không dùng index mảng, `id` DB hay nội dung prompt làm nguồn số. Với Part 3/4, bỏ prefix “Question N” khỏi prompt chỉ khi số khớp số canonical; nếu không khớp thì giữ nguyên văn bản để tránh mất nội dung.

### Mock audio authoritative

Thêm bảng playback riêng theo attempt, với khóa/FK duy nhất cho attempt, `started_at`, danh sách Listening tracks đã đóng băng và thông tin cần thiết để tính timeline. Không lưu đáp án hoặc sửa attempt answer version. Thời lượng từng audio phải được đo/đối chiếu trong lúc triển khai; không bịa duration. Track config có version/checksum và phải được kiểm tra với snapshot attempt trước khi bắt đầu.

API đề xuất:

```text
GET  /api/v1/attempts/{id}/listening-playback
POST /api/v1/attempts/{id}/listening-playback/start
```

POST start không nhận duration, URL hoặc vị trí từ client; idempotent theo attempt. Response gồm `attemptId`, status (`NOT_STARTED|RUNNING|FINISHED|LOCKED|CLOSED|UNAVAILABLE`), `serverTime`, `startedAt`, `activePartId`, `positionMs` và danh sách track `{partId, partNumber, audioUrl, durationMs, startOffsetMs}`. Chỉ owner, TOEIC `MOCK_TEST`, còn hạn và state cho phép mới đọc/bắt đầu. Practice không dùng timeline này. Lỗi media/thiếu duration báo `UNAVAILABLE` an toàn; không thay đổi deadline toàn attempt.

Client chỉ fetch khi mount, sau start, tại ranh giới track/Part và sau reconnect; không polling liên tục. Tính playback từ server timestamp cộng monotonic elapsed; khi resume nhảy tới thời điểm hiện tại và không phát lại phần đã qua. Chỉ có một audio element hoạt động. Chuyển qua Reading được đồng bộ với section lock/confirm hiện có.

### Chế độ nội dung

Mock Part 1/2 không trả và không render transcript, lựa chọn đọc thành tiếng hoặc clue trong context. Part 3/4 có thể hiện câu hỏi/options từ snapshot đã sanitize, nhưng không có transcript. Practice trả listening detail theo đúng câu chỉ sau feedback request hợp lệ; không suy transcript từ explanation. `HtmlContent` trong pane TOEIC không được phép tạo audio/video controls phụ.

### Layout và tương tác

Chỉ render pane tham chiếu khi data của group có ảnh hoặc nội dung đọc. Part 3/4 bám đúng `questionGroups` backend. Part 5 là danh sách một cột. Part 6 hiển thị passage và câu hỏi chia đôi; blank anchors giữ dạng tĩnh nếu source không có map. Part 7 giữ nguyên cả group HTML bên trái. Hai pane cuộn độc lập; resize có nút tăng/giảm và reset cùng bàn phím, không chỉ kéo chuột.

Highlight key phải gồm attempt + part + group + content hash để không rò highlight qua group/attempt. Không làm rơi sanitizer hiện tại. QuestionPalette phải có `aria-current`, trạng thái đã trả lời/flag có biểu tượng và chữ/accessible name, phím Enter/Space chỉ kích hoạt một lần.

## Subtasks

Triển khai tuần tự `TW-01 → TW-09`. Mỗi task: RED → GREEN, kiểm tra diff, append handoff; không chuyển tiếp khi có P0/P1 chưa xử lý.

### TW-01 — Stitch design system và màn hình theo brief

**Deliverable:** Stitch project riêng `Multilingo TOEIC Workspace`; 10 screens liệt kê ở phần “Thiết kế Stitch”; lưu project ID, screen IDs, links/ảnh xem trước và mapping screen → Part/state trong handoff.

**Files:**

- Tài liệu tham chiếu: `docs/superpowers/plans/ndt/TOEIC-WORKSPACE-REDESIGN-plan.md`
- Handoff cập nhật: `docs/superpowers/plans/ndt/TOEIC-WORKSPACE-REDESIGN-handoff.md`

**Các bước:**

1. Tạo project desktop mới, giữ amber branding, không sửa các project Stitch cũ.
2. Tạo design system tokens cho màu, typography, spacing, surfaces, focus, status và table/reading split.
3. Generate 10 screens từ spec; mỗi screen ghi rõ mode, Part, audio state, content pane và interaction state.
4. Kiểm tra các màn ở 1366/1440/1920 px; kiểm tra focus/keyboard, text tiếng Việt, scroll độc lập và không dùng mock result để lấp data thật.
5. Ghi Stitch references; không chép generated HTML/CSS vào source.

**Acceptance:** Đủ 10 screen; cùng token/brand; mỗi Part có bố cục/interaction đúng brief; Stitch output không sửa production repository.

### TW-02 — Backend projection số câu và lọc nội dung Mock

**Sửa:**

- `backend/src/main/java/com/multilingo/backend/modules/testing/adapter/dto/ExamFixture.java`
- `backend/src/main/java/com/multilingo/backend/modules/testing/adapter/impl/DbExamAdapter.java`
- `backend/src/main/java/com/multilingo/backend/modules/testing/service/impl/TestAttemptServiceImpl.java`
- `backend/src/main/java/com/multilingo/backend/modules/testing/dto/response/PracticeFeedbackResponse.java`
- `backend/src/main/java/com/multilingo/backend/modules/testing/service/support/PracticeFeedbackEvaluator.java`

**Tạo:**

- `backend/src/main/java/com/multilingo/backend/modules/testing/service/support/ToeicWorkspaceProjection.java`
- `backend/src/test/java/com/multilingo/backend/modules/testing/service/support/ToeicWorkspaceProjectionTest.java`

**Các bước:**

1. Viết tests cho `q_001`–`q_200`, group boundaries, legacy snapshots và prompt Part 3/4 có prefix đúng/sai.
2. Ghi RED.
3. Lưu exam code/type vào snapshot của attempt mới; không thay đổi snapshot cũ.
4. Thêm số câu vào workspace projection bằng allowlist TOEIC và canonical ID; đảm bảo không mutate snapshot.
5. Với Mock, loại transcript/listening text/answer clue ở server response; giữ grading secrets server-side như sanitizer hiện có.
6. Practice feedback có thể trả `listeningDetail` nullable theo đúng question sau khi quyền/mode/đáp án đã được xác nhận; không dùng explanation làm transcript.
7. Chạy focused tests projection, sanitizer, workspace, Practice feedback.

**Tests:** `ToeicWorkspaceProjectionTest`, `WorkspaceSnapshotSanitizerTest`, `TestAttemptWorkspaceResponseTest`, `PracticeFeedbackContractIT`, `PracticeFeedbackServiceTest`.

**Acceptance:** Mock response/DOM không lộ lời giải hay nội dung audio; số câu đúng toàn đề; Practice chỉ nhận listening detail thuộc câu được chấm; snapshot cũ giữ nguyên.

### TW-03 — Timeline audio và persistence độc lập

**Tạo:**

- `backend/src/main/java/com/multilingo/backend/modules/testing/adapter/entity/AttemptListeningPlayback.java`
- `backend/src/main/java/com/multilingo/backend/modules/testing/adapter/repository/AttemptListeningPlaybackRepository.java`
- `backend/src/main/java/com/multilingo/backend/modules/testing/service/support/ListeningPlaybackTimeline.java`
- `backend/src/main/java/com/multilingo/backend/modules/testing/service/support/ToeicListeningMediaProfile.java`
- `backend/src/main/resources/testing/toeic-listening-media-profile.json`
- `backend/src/main/resources/db/migration/V20261017190000__create_attempt_listening_playback.sql`
- `backend/src/test/java/com/multilingo/backend/modules/testing/service/support/ListeningPlaybackTimelineTest.java`
- `backend/src/test/java/com/multilingo/backend/modules/testing/service/support/ToeicListeningMediaProfileTest.java`

**Các bước:**

1. Xác minh migration naming/ORM conventions trước khi viết migration.
2. Đo/đối chiếu duration của bốn audio bằng metadata đã được duyệt; ghi nguồn và checksum trong profile. Không tải media từ automated tests.
3. Viết pure timeline tests cho trước start, Part boundary, cuối Listening, elapsed vượt playlist, timezone/clock boundary và retry idempotency.
4. Lưu `started_at` và frozen track list theo attempt; ràng buộc unique/FK.
5. Dùng injected `Clock`; việc tính timeline không nhận client position/duration.
6. Kiểm tra playback write không sửa `TestAttempt.version`, answers, snapshot hay deadline.

**Tests:** Unit timeline/profile; repository integration trên PostgreSQL test riêng cho unique/FK/transaction.

**Acceptance:** Cùng attempt luôn có một playlist/timeline lịch sử; duration đến từ metadata đã kiểm tra; không phát sinh thay đổi answer version.

### TW-04 — Playback API, xác thực và điều phối server

**Tạo:**

- `backend/src/main/java/com/multilingo/backend/modules/testing/controller/ListeningPlaybackController.java`
- `backend/src/main/java/com/multilingo/backend/modules/testing/service/ListeningPlaybackService.java`
- `backend/src/main/java/com/multilingo/backend/modules/testing/dto/response/ListeningPlaybackResponse.java`
- `backend/src/test/java/com/multilingo/backend/modules/testing/controller/ListeningPlaybackContractIT.java`

**Sửa:**

- `backend/src/main/java/com/multilingo/backend/modules/testing/dto/response/WorkspaceResponse.java`
- `backend/src/main/java/com/multilingo/backend/modules/testing/service/impl/TestAttemptServiceImpl.java`

**Các bước:**

1. Test contract GET/POST start, owner, attempt mode/scope, submitted/expired/closed/locked và unknown attempt.
2. Test start đồng thời/idempotent trong PostgreSQL test riêng.
3. Validate attempt và Mock mode trước khi trả playlist/status.
4. POST start không nhận URL, duration hoặc position; playlist lấy từ immutable attempt snapshot/profile đã kiểm tra.
5. Tính `activePartId`/`positionMs` bằng server `Clock`; trả state safe `UNAVAILABLE` khi thiếu cấu hình media.
6. Không thêm thông tin playback vào exam start/catalog; workspace chỉ expose state/endpoint cần thiết, không transcript/cue secrets.
7. Đảm bảo GET không tạo side effect ngoài lazy start đã được chỉ định; ưu tiên GET thuần và POST start tường minh.

**Tests:** `ListeningPlaybackContractIT`, `TestAttemptWorkspaceResponseTest`, authorization integration và version-stability assertion.

**Acceptance:** Chỉ chủ attempt TOEIC Mock hợp lệ đọc/bắt đầu timeline; Practice/IELTS/attempt đã submit/expired bị chặn; replay-safe và không ảnh hưởng autosave/submit.

### TW-05 — Model frontend, mapping câu hỏi và palette

**Sửa:**

- `frontend/src/features/exam/api/attemptApi.ts`
- `frontend/src/features/exam/types/api.types.ts`
- `frontend/src/features/exam/types/exam.types.ts`
- `frontend/src/features/exam/utils/examPartUtils.ts`
- `frontend/src/features/exam/components/QuestionPalette.tsx`

**Tạo:**

- `frontend/src/features/exam/utils/toeicWorkspaceModel.ts`
- `frontend/src/features/exam/hooks/useToeicWorkspaceNavigation.ts`
- `frontend/src/features/exam/__tests__/toeicWorkspaceModel.test.ts`
- `frontend/src/features/exam/__tests__/useToeicWorkspaceNavigation.test.tsx`

**Các bước:**

1. Viết tests canonical 200 numbering, Part number, nested groups, missing/duplicate IDs, no DB/index fallback, q prompt prefix và aria navigation.
2. Ghi RED.
3. Normalize response camel/snake aliases tại API boundary; không thay shared contract fields khác.
4. Tạo view model TOEIC theo server Part/group order, tính số từ `question_id` canonical hoặc explicit field.
5. Sửa helper Part title để dùng `part_number`/`partNumber` và quy tắc TOEIC, không lấy số thứ tự section làm Part.
6. QuestionPalette duyệt nested `questionGroups` kể cả khi không có flat list; hiện câu số toàn đề, `aria-current`, answered/flag label.
7. Dùng native button semantics; bỏ xử lý Enter trùng click; kiểm tra Enter/Space gọi navigation một lần.
8. Giữ guard locked section, route identity và active question độc lập.

**Tests:** `toeicWorkspaceModel.test.ts`, `QuestionPalette.test.tsx`, `examPartUtils.test.ts`, `useToeicWorkspaceNavigation.test.tsx`.

**Acceptance:** Câu 1–200 ổn định qua Part/group; không hiện số từ array index/DB ID; keyboard/accessibility states đúng.

### TW-06 — Audio player theo mode và timeline

**Sửa:**

- `frontend/src/features/exam/components/AudioPlayer.tsx`
- `frontend/src/features/exam/__tests__/AudioPlayer.test.tsx`

**Tạo:**

- `frontend/src/features/exam/api/listeningPlaybackApi.ts`
- `frontend/src/features/exam/hooks/useListeningPlayback.ts`
- `frontend/src/features/exam/__tests__/useListeningPlayback.test.tsx`

**Các bước:**

1. Test Practice controls (rewind 10 giây, tốc độ), Mock không có pause/seek/replay, URL/Part transition dừng audio trước.
2. Test mock timeline offsets, browser autoplay rejection, stalled media, reload, offline/online, stale attempt response và StrictMode cleanup.
3. Ghi RED.
4. Thêm API client/types cho GET timeline và idempotent POST start, có AbortSignal; không dùng GET result/write retry helper tùy tiện.
5. Mock mode preloads trạng thái; chỉ POST start khi người dùng bắt đầu. Tính elapsed theo `serverTime` và monotonic clock.
6. Phát đúng một track tại thời điểm hiện tại; tự đổi Part theo server offsets; bỏ qua đoạn đã lỡ sau reload/reconnect.
7. Practice controls chỉ hiện trong Practice; tốc độ reset theo quyết định UX thống nhất và được test.
8. Không cho native controls mở menu download/seek trong Mock; xử lý lỗi autoplay bằng thông điệp có thao tác tiếp tục an toàn, không đóng băng server timeline.

**Tests:** `AudioPlayer.test.tsx`, `useListeningPlayback.test.tsx`, API contract tests với HTTP mock.

**Acceptance:** Mock không tua/dừng audio qua UI; đồng hồ server quyết định Part/position; Practice được nghe lại; một media element hoạt động; không replay phần đã qua.

### TW-07 — Listening UI cho Part 1–4

**Sửa:**

- `frontend/src/features/exam/pages/WorkspacePage.tsx`
- `frontend/src/features/exam/components/renderers/SingleChoiceRenderer.tsx`
- `frontend/src/features/exam/types/exam.types.ts`

**Tạo:**

- `frontend/src/features/exam/components/workspace/ToeicWorkspace.tsx`
- `frontend/src/features/exam/components/workspace/WorkspaceFrame.tsx`
- `frontend/src/features/exam/components/workspace/ListeningPartContent.tsx`
- `frontend/src/features/exam/components/workspace/QuestionCard.tsx`
- `frontend/src/features/exam/__tests__/ToeicListeningWorkspace.test.tsx`

**Các bước:**

1. Test P1 photo group/options labels-only; P2 one question/current labels A–C; P3/4 one group with question range and correct media; Mock DOM không có spoken content.
2. Test Practice answer feedback reveal transcript chỉ sau kiểm tra và chỉ khi response có trường đó; sửa answer invalidates paired/current feedback state.
3. Ghi RED.
4. Tách nhánh render TOEIC theo `examCode`/`examType` snapshot, giữ IELTS/general renderer hiện có.
5. Part 1 render một group/photo lớn; P1/2 options rỗng render nhãn alphabet theo thứ tự, không thêm prompt transcript.
6. P2 hiển thị câu đang chọn tách biệt Part/track đang phát; không tuyên bố biết question cue timing nếu server profile không chứa cue offsets.
7. P3/4 render đúng group, câu hỏi/options, media tham chiếu theo group; không lặp audio controls.
8. Đổi “Xem lại” thành “Đánh dấu”, giữ flag state/keyboard.
9. Duy trì fieldset disabled khi locked/submitting/expired; Practice answer-check giữ controller hiện tại.
10. `HtmlContent`/ReferencePane chặn embedded audio/video trong TOEIC để tránh bypass custom player.

**Tests:** `ToeicListeningWorkspace.test.tsx`, `WorkspacePage.test.tsx`, `PracticeFeedbackUI.test.tsx`, `WorkspacePractice.test.tsx`.

**Acceptance:** P1–P4 theo brief; Mock client DOM không chứa transcript/clues; lock/submit/autosave/Practice cũ không hồi quy.

### TW-08 — Reading UI Part 5–7

**Sửa:**

- `frontend/src/features/exam/pages/WorkspacePage.tsx`
- `frontend/src/features/exam/components/content/HtmlContent.tsx` (chỉ thêm tùy chọn cục bộ nếu cần)
- `frontend/src/features/exam/hooks/useTextSelection.ts`
- `frontend/src/features/exam/utils/highlightStorage.ts` (hoặc file hiện tại tương đương sau xác minh)

**Tạo:**

- `frontend/src/features/exam/components/workspace/ReadingPartContent.tsx`
- `frontend/src/features/exam/components/workspace/ReferencePane.tsx`
- `frontend/src/features/exam/__tests__/ToeicReadingWorkspace.test.tsx`

**Các bước:**

1. Test P5 centered one-column; P6 split with multiple groups; P7 whole-group HTML and questions in independent scroll panes.
2. Test resize mouse + keyboard/buttons/reset 30–70%; narrow-height/sticky controls; focus not hidden.
3. Test P6 blanks are static when source has no mapping; no false interactive anchors.
4. Test sanitizer, malicious HTML, embedded audio/video suppression, highlight namespace by attempt/part/group/content hash.
5. Ghi RED.
6. Render layout by `questionGroups` and content shape; do not branch only on skill/listening.
7. Keep P7 content as one HTML group; do not parse fake subpassages from delimiters.
8. Expose resize buttons (`narrower`, `wider`, `reset`) and keyboard separator semantics; preserve minimum widths and focus-visible outline.
9. Keep highlight/selection only in Practice where currently allowed; disable AI lookup in Mock.
10. Preserve DOMPurify path; ReferencePane renders sanitized text/media images without executable inline media.

**Tests:** `ToeicReadingWorkspace.test.tsx`, `WorkspacePage.test.tsx`, existing `HtmlContent` and highlight tests.

**Acceptance:** Part 5–7 đúng bố cục, pane cuộn/resize truy cập được; không thêm mapping/cấu trúc không có trong nguồn.

### TW-09 — Regression xuyên suốt và bàn giao

**Tạo:**

- `frontend/src/features/exam/__tests__/ToeicWorkspaceContract.test.tsx`
- `backend/src/test/java/com/multilingo/backend/modules/testing/controller/ToeicWorkspaceContractIT.java`

**Các bước:**

1. Frontend contract test chạy page, view-model, hooks, reducers/API normalizer thật; chỉ mock HTTP/audio/browser media.
2. Backend integration dùng DB adapter/sanitizer/playback timeline thật.
3. Verify 7 Parts, 200 câu và chuỗi số toàn đề `1…200`; Part 3/4 nhóm ba câu; Reading pane/group boundaries.
4. Verify Mock start → timeline → reload/reconnect → audio nhảy tới server hiện tại; Practice nghe lại/transcript reveal sau feedback.
5. Verify pending autosave + submit, resume/restore, deadline, section lock, answer version và result/history không bị thay đổi bởi playback.
6. Verify direct Mock workspace/start/GET không chứa solutions/transcript, Practice blocked trong Mock và ownership errors không lộ dữ liệu.
7. Browser kiểm thử desktop 1366/1440/1920, keyboard-only navigation, focus visibility, flag/answered states, sticky audio và independent scrolling; không tạo attempt thật.
8. Chạy focused suites; full frontend test/lint/build và focused backend suites với PostgreSQL test riêng. Không chạy `GenerateTemplateTest` vì ghi workbook.
9. `git diff --check`, ghi trạng thái dirty baseline, files/tests, AC mapping, Stitch IDs và risk vào handoff; dừng chờ final review.

**Tests:** `ToeicWorkspaceContract.test.tsx`, `ToeicWorkspaceContractIT.java`, regression `WorkspacePage`, `useAutosave`, `useAttemptSubmission`, workspace sanitizer, `PracticeFeedbackContractIT`.

**Acceptance:** AC-01–AC-10 đạt; end-to-end evidence bao gồm server projection + rendered UI + audio timeline; handoff ghi chính xác kết quả.

## Acceptance Criteria

| AC | Tiêu chí |
|---|---|
| AC-01 | Stitch project riêng có đủ 10 screen Part/state, cùng token amber và mapping rõ tới brief. |
| AC-02 | TOIEC question palette/header hiển thị số toàn đề 1–200 đúng Part/group; không dùng array index/DB ID. |
| AC-03 | P1–P7 hiển thị theo group/content shape thực; P6 blank tĩnh khi thiếu map; P7 giữ nguyên whole-group HTML. |
| AC-04 | Mock response và rendered DOM không chứa transcript, spoken prompt/option hay answer-derived clue. |
| AC-05 | Mock Listening bắt đầu một lần, server quyết định vị trí/Part qua reload; không seek/pause/replay hay phát bù. |
| AC-06 | Practice giữ điều khiển audio; transcript chỉ hiện sau check và chỉ nếu snapshot cung cấp. |
| AC-07 | Keyboard/focus/resize/flag/answered states dễ nhận biết, truy cập được; mỗi key event điều hướng một lần. |
| AC-08 | Autosave, submit, restore, deadline, lock, attempt version và snapshot history không bị playback/UI đổi. |
| AC-09 | IELTS/general renderer và Writing/Review flow không hồi quy. |
| AC-10 | Tests, lint/build, diff check và handoff có evidence; không phát sinh dependency hoặc endpoint không được duyệt. |

## Ma trận kiểm thử

| TC | Scenario | Kết quả |
|---|---|---|
| TW-TC-01 | TOEIC 200 ID canonical qua 7 Part | Hiển thị liên tục 1–200, Part 7 kết thúc 200 |
| TW-TC-02 | Part thiếu number hoặc legacy snapshot | Dùng explicit/canonical value; không dùng index/title |
| TW-TC-03 | P1/P2 empty option text | Nhãn A–D/A–C hiện; text spoken không có trong Mock payload/DOM |
| TW-TC-04 | P3/P4 group có 3 câu và graphic | Đúng group/media, range đúng, không duplicate prompt/audio |
| TW-TC-05 | P6 thiếu anchor mapping | Blank tĩnh; không tạo input hoặc click target giả |
| TW-TC-06 | P7 multi-document group | Whole HTML ở pane trái, câu hỏi phải, cuộn độc lập |
| TW-TC-07 | Palette keyboard | Enter/Space navigate một lần; aria-current/flag/answered đúng |
| TW-TC-08 | Mock playback start race | Một playback row/playlist; không đổi answer version |
| TW-TC-09 | Reload/reconnect giữa track | Position/Part từ server clock; không replay missed audio |
| TW-TC-10 | Practice audio/check answer | Rewind/rates khả dụng; transcript chỉ sau check nếu có |
| TW-TC-11 | Unauthorized/wrong mode/expired | Không có timeline; response không tiết lộ media details |
| TW-TC-12 | Autosave pending/submit/deadline | Playback không đổi kết quả write/version/deadline |
| TW-TC-13 | Embedded media/malicious HTML | Sanitized; Mock không sinh native audio/video controls |
| TW-TC-14 | Route A→B→A/StrictMode | Response cũ không tác động attempt hiện hành; không kẹt state |
| TW-TC-15 | Existing IELTS/Review | Renderer và contract không thay đổi |

## Lệnh xác minh dự kiến

Frontend, từ `frontend/`:

```powershell
npm test -- src/features/exam/__tests__/ToeicWorkspaceContract.test.tsx src/features/exam/__tests__/ToeicListeningWorkspace.test.tsx src/features/exam/__tests__/ToeicReadingWorkspace.test.tsx src/features/exam/__tests__/toeicWorkspaceModel.test.ts src/features/exam/__tests__/useListeningPlayback.test.tsx src/features/exam/__tests__/AudioPlayer.test.tsx src/features/exam/__tests__/QuestionPalette.test.tsx src/features/exam/__tests__/WorkspacePage.test.tsx
npm test
npm run lint
npm run build
```

Backend, từ `backend/`:

```powershell
./mvnw.cmd '-Dtest=ToeicWorkspaceProjectionTest,ListeningPlaybackTimelineTest,ToeicListeningMediaProfileTest,ListeningPlaybackContractIT,ToeicWorkspaceContractIT,TestAttemptWorkspaceResponseTest,WorkspaceSnapshotSanitizerTest,PracticeFeedbackContractIT,SubmitAttemptImmutableKeysTest,DbExamAdapterSnapshotTest' test
```

`GenerateTemplateTest` bị loại khỏi lệnh vì test ghi workbook. PostgreSQL integration dùng database test riêng; không dùng DB local có người dùng.

Root:

```powershell
git diff --check
git status --short
```

Không gọi lệnh nào ở lượt lập plan.

## Definition of Done

- AC-01–AC-10 có evidence; điều kiện phụ thuộc media duration được ghi rõ.
- Stitch references ghi trong handoff và khớp các Part/state.
- Backend Mock data projection không lộ listening content/answer clues; Practice reveal chỉ theo contract đã chốt.
- Full frontend suite, lint/build và focused backend/PostgreSQL tests có kết quả ghi chính xác.
- Không đổi deadline/answers/submission semantics; không ảnh hưởng IELTS/Writing/Review.
- Không thêm dependencies hoặc gọi provider/media CDN thật từ tests.
- Handoff append theo từng task; cuối cùng Codex review toàn feature.
- Không commit hoặc push.
