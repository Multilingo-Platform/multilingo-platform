# Review và nghiệm thu sửa lỗi Exam/Writing — 2026-11-02

Phạm vi: spec và plan `2026-11-02-confirmed-exam-and-writing-fixes`, gồm popup, SRS, prompt, MULTI_PART, quota Writing, ảnh HTML và chẩn đoán phản hồi AI. Người dùng yêu cầu sửa các finding, review lại, commit/push và merge PR vào develop.

## Vòng sửa sau review

| Finding | Thay đổi | Bằng chứng regression |
|---|---|---|
| Popup giữ cap của loading | Đo chiều cao tự nhiên trước khi áp cap viewport; theo dõi thay đổi nội dung/form/details | RED 140px thay vì 600px; GREEN loading → ready → details mở |
| Writing lặp prompt trên mobile | Workspace truyền showPrompt=false, dùng panel prompt hiện hữu | RED prompt nằm trong fieldset editor; GREEN không lặp |
| HTML thêm khoảng trắng trong từ/số | Giữ text node nguyên dạng; chỉ thêm khoảng cách tại block/line boundary | RED `1 0%`, `un employment`; GREEN `10%`, `unemployment` |
| CJK không tách câu thiếu whitespace | Tách sau dấu 。！？, giữ nguyên chuỗi dấu câu | RED ba case Nhật/Trung lấy cả đoạn; GREEN lấy đúng câu |
| MALFORMED_OUTPUT hứa retry qua GET | Thông báo kết quả chấm chưa có, bỏ hướng dẫn retry không khả dụng | RED thông báo chứa lời hứa thử lại; GREEN thông báo terminal |

Review độc lập phát hiện thêm P2: popup thiếu visualViewport.offsetLeft khi zoom và pan ngang. Đã thêm offsetLeft vào phép clamp và component; RED left=12 thay vì 162, GREEN đúng vùng nhìn thấy.

## Review cuối

Reviewer độc lập đọc toàn bộ diff so với HEAD/develop, gồm file untracked: **PASS**, không còn finding P0/P1/P2 đã xác nhận. Đã kiểm tra lại năm finding ban đầu và offsetLeft. `git diff --check` sạch.

## Kiểm tra trên cây code cuối

- Backend: `mvnw.cmd -q clean test` exit 0. Surefire: 1.867 test, 0 failures/errors, 1 skipped (`ETSWorkbookAuditTest`). Workbook được test sinh lại đã khôi phục về bản Git.
- Frontend: `npm test -- --testTimeout=10000` exit 0; 141 files, 2.033 test pass.
- Frontend: `npm run build` exit 0; còn cảnh báo chunk JS lớn hơn 500 KB.
- Frontend: `npm run lint` exit 0; còn cảnh báo unused/hooks/fast-refresh ở code hiện hữu.
- Build ban đầu phát hiện fixture test mới thiếu field V3; đã bổ sung source/policyVersion, chạy lại build và toàn bộ frontend tests thành công.

## Giới hạn

Chưa chạy browser/mobile thực, PostgreSQL integration hoặc gọi provider thật trong lượt này. Không deploy production, không chạy lại job terminal, không sửa attempt 42 hoặc flashcard cũ trong DB. Merge develop không tương đương nghiệm thu môi trường production.
