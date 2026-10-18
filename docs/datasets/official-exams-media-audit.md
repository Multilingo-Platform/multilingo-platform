# Kiểm tra media cho hai bộ đề chính thức

Ngày kiểm tra: 2026-10-17  
Trạng thái: **BLOCKED — chưa xác minh media hoặc quyền sử dụng**

## Phạm vi đã kiểm tra

Parser đọc các workbook theo checksum đã ghi trong `official-exams-source-audit.md`, chuẩn hóa URL thành media có cấu trúc và đếm các URL duy nhất. Không gửi request mạng, không tải media và không sửa workbook nguồn.

| Bộ đề | Loại | Số tham chiếu | Vị trí nguồn đã xác định | Tải/MIME | Playback/render/CORS | Đúng Part/nội dung | Quyền sử dụng | Approval reference |
|---|---|---:|---|---|---|---|---|---|
| Cambridge IELTS 20 Test 1 | Audio | 4 | `Exam Template!R2`, `R12`, `R22`, `R32` | Chưa kiểm tra | Chưa kiểm tra | Chưa xác nhận bởi người | Chưa xác minh | Không có |
| Cambridge IELTS 20 Test 1 | Ảnh | 4 | HTML trong `Exam Template!F2`, `F32`, `F62`, `F82`; parser chuyển sang `shared_media` | Chưa kiểm tra | Chưa kiểm tra | Chưa xác nhận bởi người | Chưa xác minh | Không có |
| ETS 2024 Test 1 | Audio | 4 | Cột `N` của `Exam Template`, Part 1–4 | Chưa kiểm tra | Chưa kiểm tra | Chưa xác nhận bởi người | Chưa xác minh | Không có |
| ETS 2024 Test 1 | Ảnh | 11 | Các URL thật trong cột `O` của `Exam Template`; giá trị `44` bị loại theo profile nguồn | Chưa kiểm tra | Chưa kiểm tra | Chưa xác nhận bởi người | Chưa xác minh | Không có |

Tổng cộng: **8 audio và 15 ảnh**. Kiểm đếm URL không chứng minh URL còn hoạt động, MIME thật, khả năng phát/render, CORS, media khớp nội dung câu hỏi hoặc quyền sử dụng. Các URL trong passage không được tính là media.

## Quyết định phát hành

- Cả hai dataset đều **BLOCKED** để phát hành. Chưa có kiểm tra tải/MIME/playback-render/CORS hoặc xác nhận nội dung và quyền từ người có thẩm quyền.
- Không có approval reference; không tạo hai JSON bundle trong `backend/src/main/resources/datasets/exams/` và không publish dataset.
- Workbook Cambridge gốc vẫn có bảy marker tại `F42`, `F46`, `F51`, `F56`, `F69`, `F74`, `F79` và không bị sửa. Canonical output còn **BLOCKED** bởi bốn ô chưa xác minh: `F42`, `F46`, `F51` (Stress) và `F56` (Kākāpō).
- Ba ô Elms `F69`, `F74`, `F79` đã được hiệu chỉnh trong canonical Reading Part 6 bằng passage do chủ dự án cung cấp, chỉ khi checksum workbook khớp profile Cambridge đã audit. Xem nguồn, checksum và phạm vi correction tại [source audit](official-exams-source-audit.md). Correction này không thay thế kiểm tra media/content/rights hoặc cấp approval reference.
- Trước khi mở gate, người phụ trách nội dung cần kiểm tra từng URL trên môi trường trình duyệt được phép, ghi HTTP/MIME và kết quả phát/render/CORS, xác nhận media khớp Part/câu, xác nhận quyền sử dụng và cấp approval reference. Chỉ sau đó mới build bundle từ parser/canonical request, kiểm tra checksum và review nội dung.

## Kiểm chứng tự động hiện có

`OfficialExamDatasetTest` xác nhận parser nhận đủ 82 câu IELTS và 200 câu TOEIC, nhận diện tổng số tham chiếu media, loại answer-key clues/placeholder `44` khỏi TOEIC canonical request, không xuất `metadata.options`, và từ chối bundle thiếu approval hoặc có văn bản Cambridge chưa xác minh. Đây không thay thế kiểm tra media hoặc phê duyệt nội dung.


## TW-03 — Gate metadata timeline TOEIC (2026-10-17)

Profile `backend/src/main/resources/testing/toeic-listening-media-profile.json` có trạng thái **BLOCKED** và không có approval reference. Duration/ETag/content length đang lưu là metadata ứng viên từ implementation trước; lượt sửa này chưa có bằng chứng đo độc lập, hash SHA-256 của từng asset hoặc xác nhận playback/content/rights để nâng chúng thành VERIFIED. Chuỗi `OWNER_RIGHTS_CONFIRMED_CHAT_2026-10-17` đã được gỡ vì không có bằng chứng duyệt tương ứng trong audit này.

Loader chỉ chấp nhận profile có version xác minh, trạng thái VERIFIED, approval reference, nguồn bằng chứng duration, SHA-256 từng asset và checksum SHA-256 toàn metadata khớp. Checksum metadata bao gồm URL, duration, offset, ETag, content length, asset hash, nguồn và approval; đây là kiểm tra toàn vẹn, không thay thế việc đo asset hoặc phê duyệt quyền sử dụng. Khi thiếu bằng chứng/profile hợp lệ hoặc snapshot không ánh xạ đủ Part IDs thật, playback trả UNAVAILABLE và không tạo timeline mới.

Fixture VERIFIED dưới `src/test/resources/testing/` dùng URL `media.test`, hash và approval synthetic chỉ dành cho kiểm thử; không cấp quyền phát các URL ETS production. Automated tests không tải media. Các gate media/content/rights và quyết định BLOCKED ở trên vẫn giữ nguyên.

## TWF-02 — ETS TOEIC Listening playback (2026-10-18)

Quyết định BLOCKED phía trên được thay thế **riêng cho bốn audio TOEIC Part 1–4**. Chủ dự án xác nhận quyền sử dụng qua `OWNER_RIGHTS_CONFIRMED_CHAT_2026-10-17`. Bốn asset đã được tải độc lập ngoài repository: HTTP 200, `audio/mpeg`, ETag/content-length khớp, SHA-256 được ghi vào profile, Chromium tải metadata/seek/phát muted và CORS anonymous `fetch` đều PASS. URL profile khớp chính xác `shared_audio` của Part 1–4 trong bundle `TOEIC-ETS-2024-T1-V2`; offset/tổng thời lượng được tính lại từ duration browser.

Chi tiết timestamp, hash, duration và giới hạn xác minh nằm tại [toeic-listening-playback-verification.md](toeic-listening-playback-verification.md). `toeic-listening-media-profile.json` hiện chỉ `VERIFIED` khi toàn bộ evidence/hash/checksum hợp lệ; snapshot sai hoặc profile tampered vẫn `UNAVAILABLE`. IELTS và 11 ảnh ETS vẫn giữ trạng thái audit cũ, ngoài phạm vi TWF-02.
