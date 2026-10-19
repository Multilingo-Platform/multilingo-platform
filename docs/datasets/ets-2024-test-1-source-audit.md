# ETS 2024 Test 1 — Kiểm tra nguồn và điều kiện đóng gói

Ngày: 2026-10-13. Trạng thái: **BLOCKED_CONTENT — chưa phải dataset đã duyệt**.

## Nguồn

- File gốc: `E:/Downloads/ETS_2024_Test_1 (1).xlsx`, giữ nguyên, không đưa vào Git.
- SHA-256: `5d0a4415c3c1d49dc55d8150e6454e7144eda843d1a7c3aacb20efbc095699ce`.
- Sheet: `Thông Tin Đề Thi`, `Exam Template`, `Hướng dẫn điền Form`.
- 7 Part, 50 nhóm, 200 câu; số câu theo Part: 6/25/39/30/30/16/54.
- Có 4 URL audio cấp Part và 11 URL ảnh cấp nhóm. Chưa tải, kiểm tra nội dung, khả năng truy cập hoặc quyền sử dụng.

## Hiệu chỉnh phân tích ban đầu

Giá trị XML `<v>44</v>` với `t="s"` là chỉ số shared-string; phần tử thứ 44 trong sharedStrings.xml là chuỗi rỗng. Đây **không phải giá trị ô 44**. Apache POI đọc giá trị thực và test trên file gốc xác nhận số lượng, checksum và trạng thái không thể xuất bản.

| Phạm vi trong Exam Template | Cần xử lý |
|---|---|
| L136:L201, q_135–q_200 | Thiếu 66 answer key; cần nguồn đáp án được đối chiếu |
| M2:M201 | Thiếu 200 giải thích |
| Các ô F cấp nhóm, trừ nhóm đầu Part 6 tại F132 | 49 nhóm chưa có context; Part 6–7 cần passage hoàn chỉnh |
| H136:K201 | 66 câu cuối chưa có nội dung lựa chọn |
| H2:K32 | 31 câu Part 1–2 có lựa chọn qua audio; giữ option ID, không bịa text |
| K8:K32 | Part 2 D trống; canonical chỉ có A/B/C, không thêm D |
| N cấp Part 1–4 và O cấp nhóm có URL | Người biên tập kiểm tra media, sự phù hợp với câu hỏi và quyền sử dụng |

P2 audio có ba lựa chọn; ô D trống không chứng minh có lựa chọn D. Các ô media câu hỏi trống và audio Part 5–7 trống không tự thân là lỗi nếu media được đặt đúng ở cấp nhóm/Part. Context trống của Part nghe không được tự sinh transcript.

## Luồng sử dụng

1. Admin/content creator tải Excel v2 qua preview. Preview không ghi DB; báo cáo có sheet/ô/question ID.
2. Lưu nháp để biên tập. Lỗi cấu trúc bị từ chối; lỗi nội dung ngăn xuất bản. Học viên không thể bắt đầu đề nháp.
3. Bổ sung dữ liệu từ nguồn được phép sử dụng; đối chiếu từng answer key, passage, giải thích và media. Không dùng AI tự điền.
4. Sau khi đạt validator, gọi `GET /api/v1/admin/exams/{id}/dataset-export`. Bundle hiện giới hạn ETS Test 1 đầy đủ 7 Part/200 câu; không phải exporter mọi chứng chỉ.
5. Bundle có schemaVersion=1, datasetKey=ets-2024-test-1, version=1, mã TOEIC-ETS-2024-T1-V1, source SHA và checksum nội dung canonical.
6. Export để approvalReference=null. Sau review nội dung và quyền sử dụng, ghi reference phê duyệt vào source.approvalReference. Không sửa nội dung request sau khi tính checksum; nếu sửa, lưu DB và export lại.
7. Chỉ sau phê duyệt mới thêm `backend/src/main/resources/datasets/exams/ets-2024-test-1.v1.json`. Hiện **chưa tạo file này**.
8. Seed bằng cấu hình `exam.default-dataset.enabled=true` trên môi trường cần nạp. Mặc định false. Runner chỉ đọc glob classpath cố định, không lấy URL/path từ manifest.

Seed lưu unpublished. Mã chưa có được tạo trong transaction; nội dung tương đương bỏ qua (không đổi published); khác nội dung báo conflict và rollback, không ghi đè. Phiên bản mới cần version/code mới và review riêng.

## Giới hạn xác nhận

- Validator và checksum không chứng minh đáp án đúng hoặc quyền xuất bản; approvalReference là ghi nhận người duyệt, không phải chữ ký số.
- URL đúng cú pháp HTTPS không bảo đảm media truy cập được.
- Tests dùng nội dung tổng hợp và H2 riêng; không chứng minh nguồn ETS đã hoàn chỉnh, chưa chạy PostgreSQL smoke.
- Không nạp vào DB đang dùng, không tạo attempt thật, không sửa file Excel gốc.
- Attempt đã tồn tại dùng snapshot lịch sử; việc sửa hoặc unpublish đề hiện tại không thay grading/review cũ.
