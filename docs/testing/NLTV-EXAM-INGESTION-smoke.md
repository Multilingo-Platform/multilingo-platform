# NLTV R1 — PostgreSQL và application smoke (2026-10-21)

Trạng thái: đã thực hiện các kiểm tra dưới đây, chờ re-review. Không thay thế quyết định nghiệm thu full feature.

## Target và publication

- Docker container `multilingo-postgres`, compose working directory đúng repository, PostgreSQL 16.15, host port 5434, database `multilingodb`. Native PostgreSQL 5432 không được dùng.
- Đã khởi động container có sẵn; không tạo lại volume. Ban đầu chưa có `NLTV-SAMPLE-T1-V1`.
- Runner chỉ nhận key `nltv-sample-test-1`, `publish-approved=false`: seed draft **exam ID 4**, section IDs **8/9/10**, Part IDs **21–29**, 107 mục, 180 phút.
- Draft structure trả HTTP **404**. Admin dataset-export có canonical checksum `23512faa7c9d70bec7b7c7f7b8d8ba721282373cc74059897545d9a09e84f989`, khớp runtime bundle, trước khi PATCH riêng `/api/v1/admin/exams/4/status?isPublished=true`.
- Sau publish: authenticated structure HTTP 200; anonymous structure HTTP **401**; library filter NLTV + tiếng Việt hiển thị đúng một đề.

## PostgreSQL regression

`NltvDatasetPostgresIT` chỉ bật khi `OFFICIAL_EXAM_POSTGRES_TEST_URL` trỏ database tên `official_exams_test`; không nhận `multilingodb`. Chạy cùng PostgreSQL container, host 5434. Username/password lấy từ cấu hình container vào biến môi trường, không ghi vào evidence.

```powershell
cd backend
# Đặt OFFICIAL_EXAM_POSTGRES_TEST_URL/USERNAME/PASSWORD trong môi trường local.
.\mvnw.cmd '-Dtest=NltvDatasetPostgresIT' test
```

Kết quả cuối: **3 tests PASS, 0 failures/errors/skips**, BUILD SUCCESS.

1. Seed draft ẩn khỏi catalog; explicit publish và seed lại giữ cùng exam/Part IDs và checksum.
2. Code có nội dung khác bị CONFLICT, không ghi đè/publish.
3. Batch tạo/publish NLTV rồi gặp conflict ở bundle kế tiếp phải rollback NLTV cùng các Part. Test chạy ngoài transaction của test để kiểm tra transaction thật của service. Chỉ dọn các exam do test vừa tạo trên database riêng.

Không sửa production để đạt các kiểm tra này; không có RED→GREEN cho một bug code mới. Đây là regression bổ sung cho behavior đã tồn tại.

## HTTP lifecycle trên ứng dụng thật

`scripts/testing/smoke-nltv-ingestion.ps1 -ExamId 4` nhận JWT local admin qua `NLTV_SMOKE_ACCESS_TOKEN`, tự kiểm tra code/checksum trước khi tạo attempt. Script không publish và không in token/keys/essay.

| Kiểm tra | Practice #74 | Mock #76 |
| --- | --- | --- |
| FULL_EXAM, real Part IDs, workspace không có private grading fields | PASS | PASS |
| Deadline | null, PASS | 180 phút, PASS |
| Autosave/version/resume, hai essay giữ nguyên văn | PASS | PASS |
| Khóa Listening rồi Reading và restore lockedSections | không áp dụng | PASS |
| Submit gồm finalAnswers, submit lại idempotent | PASS | PASS |
| Objective total/raw score với toàn bộ đáp án đúng | 105/105 | 105/105 |
| Review toàn bộ 9 Parts sau submit | PASS | PASS |
| Essay feedback | UNAVAILABLE / UNSUPPORTED_LANGUAGE, điểm null | UNAVAILABLE / UNSUPPORTED_LANGUAGE, điểm null |

Lượt script đầu (#73) dừng vì assertion nhầm trạng thái public summary với trạng thái job. Contract hiện tại aggregate attempt/summary thành `GRADING_FAILED`/`FAILED` khi job UNAVAILABLE; endpoint feedback riêng trả đúng reason. Đã sửa expectation của script và chạy lại cả hai mode thành công, không sửa contract production. #73 được giữ lại, không xóa dữ liệu attempt.

DB xác nhận toàn bộ 10 jobs của smoke attempts #73–77 có **0 READY, 0 quota_reserved**. Runtime tắt Gemini/dispatcher nên không gọi provider. #75 và #77 là attempts tạo từ browser; sau kiểm tra đều được submit, không còn smoke attempt IN_PROGRESS.

## Browser tại http://localhost:5173

- Đăng nhập qua UI bằng tài khoản admin local hiện có, mở library → đề ID4 → Practice FULL_EXAM (#75).
- Bốn audio Part1–4 phát từ origin ứng dụng, currentTime tăng; `audio.error=null`. Durations browser khoảng 941.740 / 826.430 / 767.998 / 802.807 giây. Không tuyên bố nghe/transcribe lại nội dung audio.
- Part7: word bank còn nguyên, 10 ô có accessible labels, passage masked, không có audio. Nhập một ô, reload, quay lại Part7 và giữ đúng giá trị.
- Essay Part8: ảnh tải thành công natural size 490×306, min_words120; nhập tiếng Việt, reload và giữ nguyên văn. UI submit giữ cả sửa đổi cuối, kiểm tra lại qua workspace API #75.
- Result #75 hiển thị số objective105; mở feedback thấy “Chưa hỗ trợ chấm Writing tiếng Việt.” và chưa có điểm.
- Browser Mock #77: bắt đầu FULL_EXAM, đồng hồ khoảng 2:59:51, audio phát và currentTime tăng. **Chưa xác minh thao tác xác nhận chuyển section bằng browser:** IAB/CDP timeout tại `window.confirm`; API lock/restore đã PASS trong script #76. Không tính bước browser này PASS. #77 được submit qua HTTP sau đó.

Evidence responsive được chụp ở 375×812, 768×1024 và 1366×900; viewport override đã reset sau kiểm tra. Các ảnh nằm trong `evidence/nltv-r1/`: `part7-375.png`, `essay-375.png`, `part7-768.png`, `part7-1366.png`, `mock-1366.png`, `writing-result-1366.png`.

## Bảo toàn dữ liệu và giới hạn

- 72 hàng test_attempts cũ (IDs≤72) giữ nguyên checksum trước/sau: `cf2a6d5ab7270555ca7f023cc0cc6f4b`. Ba hàng exams khác giữ nguyên checksum `c97a6f6bcbb3da2c312c1afcf89cd8ce`. Không xóa attempts.
- Runtime dùng command-line overrides `spring.flyway.enabled=false`, `spring.jpa.hibernate.ddl-auto=none` để giữ nguyên schema target; Flyway latest vẫn `20261020120000`. Migration dictionary của TV3-MULTILINGUAL chưa áp dụng và không thuộc việc này.
- Các overrides khác: chỉ seed key NLTV/draft, mock-data=false, Gemini/image-fetch=false, Writing grading=true/images=false/dispatcher=false, hints/dictionary=false, bind localhost8088. Frontend Vite localhost5173 proxy tới8088. Không thay cấu hình seed mặc định hoặc file application-dev.
- Lần startup đầu thất bại vì images-enabled từ dev còn true trong khi image-fetch=false; đã sửa command-line override thành images-enabled=false trước seed. Đây là cấu hình smoke, không phải bug production.
- Không chạy lại full suite; kết quả focused mới là PostgreSQL3 PASS và HTTP smoke ở trên. Không kiểm tra provider thật, dictionary v2, tài khoản non-owner, hoặc thông qua reverse proxy production.
- Rollback publication nếu cần: authenticated admin PATCH `/api/v1/admin/exams/4/status?isPublished=false`; giữ nguyên attempts và bundle. Chưa thực hiện unpublish vì yêu cầu là xuất bản đề.

## 2026-10-23 — R1 runtime recheck — BLOCKED / partial

This is an append-only recheck; it does not replace the 2026-10-21 report above.

- App DB read-only preflight now saw 7 attempts/31 answers before this smoke, while the earlier report documented attempts through #77 and 72 historical rows. State differs; this run does not infer that either count is wrong. Exam ID 4 is already published, has the registered NLTV code/type/language/duration, all nine Parts carry the approved source SHA, and Part question counts match the source. No republish/unpublish/seed was run.
- PostgreSQL regression was rerun against isolated `official_exams_test`: `NltvDatasetPostgresIT` — **3/3 PASS**. Afterwards the test DB had 0 exam/section/part rows.
- Focused backend suite — **75 tests, 0 failures/errors, 3 PostgreSQL tests skipped** in that run; the dedicated PG run above passed those three. Frontend focused NLTV suite — **6 files / 42 tests PASS**.
- Browser catalog/detail/start rendered the published exam. Screenshots at 375/768/1366 px are in `output/playwright/NLTV-EXAM-INGESTION-20261023/`. A new Practice attempt **88** was created and its workspace rendered. Reload then returned 502 for workspace/profile. Do not delete this attempt; its final persisted status could not be re-read.
- At `2026-10-23 16:50:23 +07`, Docker reported `multilingo-postgres` exited 0 and its log recorded an administrator shutdown. The existing backend/proxy stopped serving requests. No restart was attempted because the shutdown owner was unknown. Browser local storage/cookies were cleared and the temporary browser was closed.
- The previous 2026-10-21 browser and Practice/Mock smoke evidence remains present above, but this recheck did not reproduce its full lifecycle. Reconcile the current DB/history state and complete/resume the new smoke attempt only after the database owner restores the service. Current release status remains BLOCKED.

## 2026-10-23 — R1 runtime recheck sau khi người dùng yêu cầu tiếp tục

- Người dùng xác nhận Docker vừa được tắt có chủ đích. Khởi động lại container PostgreSQL theo yêu cầu; container healthy. Backend smoke tạm thời trỏ `localhost:5434/multilingodb`, schema validate, tắt Flyway/seeders/schedulers/dispatcher/provider. Frontend Vite có sẵn trên cổng 5173.
- Trước lượt này exam ID 4 có 7 attempts/31 answers; toàn DB có 87 attempts. Exam vẫn published, đúng code/type/language/duration và chín Part có checksum R1/counts đã duyệt. Không seed/publish/unpublish, không sửa exam hay attempts lịch sử.
- **Practice #88:** workspace được resume sau reload; một câu đã autosave và còn selected sau reload. Submit, result và review đều tải được. Attempt giữ trạng thái cuối `GRADING_FAILED`; hai job Writing `UNAVAILABLE`/`MULTILINGUAL_GRADING_DISABLED`, 0 quota reservation, 0 provider dispatch; điểm Writing null.
- **Mock #89:** đồng hồ 180 phút hiển thị; 55 câu Listening đã autosave. Khi chuyển từ Listening sang Reading, UI hiện xác nhận không thể quay lại; sau khi xác nhận, section Listening ID 8 được ghi vào `locked_sections` và nút Listening bị disabled. Submit, result và review tải được. Hai job Writing unavailable, 0 quota reservation/provider dispatch; điểm Writing null.
- Review browser phát được audio Part 1: `currentTime≈8.15s`, `readyState=4`, `error=null`. Cùng smoke report 2026-10-21 đã xác minh playback và durations cho cả bốn audio Part 1–4. Responsive evidence có sẵn: start page 375/768/1366 px, Practice workspace 375 px không tràn ngang, Mock/review 1280 px không tràn ngang.
- Kết quả test đã chạy: backend focused **75 tests, 0 failures/errors, 3 PG skips**, sau đó PostgreSQL `NltvDatasetPostgresIT` **3/3 PASS** trên DB thử nghiệm riêng và để DB đó rỗng; frontend NLTV **6 files / 42 tests PASS**. Source không đổi nên không chạy lại.
- Hai smoke attempts được giữ lại (ID 88, 89); tổng DB sau lượt này 89 attempts, exam ID 4 có 9. Báo cáo cũ “72 historical rows IDs≤72” không mâu thuẫn với con số 7 attempt riêng exam ID 4 ở lần preflight; không thay đổi dữ liệu lịch sử.
- Khi essay để trống, summary UI dùng trạng thái tổng hợp “Chấm bài thất bại”/“Chấm Writing thất bại” cho job unavailable và hiển thị chưa có điểm. Không có provider call hoặc quota reservation. Handoff 2026-10-21 ghi nhận với essay đã nhập, mở Writing feedback sẽ nêu “Chưa hỗ trợ chấm Writing tiếng Việt.” Không lưu câu hỏi, câu trả lời hoặc answer key vào báo cáo.
- Không commit/push; smoke hoàn tất trong phạm vi cho phép và dừng để review.
