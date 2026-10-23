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
