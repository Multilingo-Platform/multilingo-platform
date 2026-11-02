# Writing AI: sửa lỗi reconstruction khi chấm bài

## Bằng chứng và nguyên nhân

Đọc PostgreSQL local bằng transaction READ ONLY: jobs 34–39 (attempts 101–103, Writing Parts 19/20) đều FAILED, last_error_code=MALFORMED_OUTPUT, model_metadata.validationCode=RECONSTRUCTION_MISMATCH. Không đọc/in essay hoặc phản hồi AI ra log. Contract provider đang yêu cầu AI tự đếm offset UTF-16 và đồng thời tạo correctedEssay độc lập; hai biểu diễn không khớp nên strict parser từ chối.

## Sửa tại ranh giới provider

- Provider trả corrections gồm original (đoạn trích nguyên văn, duy nhất trong essay), replacement, explanation. Không trả start/end hoặc correctedEssay.
- Server tìm exact match theo nội dung gốc không trim/normalize; từ chối anchor thiếu, trùng vị trí hoặc chồng lấn. Sắp edits theo vị trí thật, tự dựng correctedEssay và diff.
- Giữ validation score, field allowlist, duplicate JSON keys, số lượng/độ dài corrections, Unicode/surrogate safety và reconstruction invariant hiện hữu.
- Parser cũ tiếp tục đọc/kiểm tra kết quả đã lưu, response API không đổi. Không migration, không tự chạy lại job FAILED/UNAVAILABLE, không thay quota/retry.
- Prompt English, feedback đa ngôn ngữ và rubric generic dùng cùng contract anchored.

## Nghiệm thu và regression

| Ca | Mong đợi |
|---|---|
| Anchor exact, nhiều edits, thứ tự model khác thứ tự essay | Server dựng offsets/correctedEssay/diff đúng |
| Emoji, CRLF, whitespace | Giữ nguyên text gốc, offsets UTF-16 đúng |
| Không có edits | Bài sửa bằng nguyên văn bài gốc |
| Anchor thiếu/ambiguous/chồng lấn | Fail closed CORRECTIONS_INVALID, không đoán vị trí |
| Model trả offsets/correctedEssay kiểu cũ | Từ chối ở provider boundary mới |
| Sai schema/score/limits/visualObservations | Giữ validation hiện hữu |
| Feedback/job cũ và frontend | API/persisted schema vẫn tương thích |

Chạy RED/GREEN focused parser/generator/worker/prompt, regression Writing feedback và backend clean test. Thử provider bằng essay tổng hợp nếu môi trường cho phép, chỉ in mã lỗi và thống kê; không dùng dữ liệu bài viết người dùng để thử lại.

## Bằng chứng triển khai

- RED: generator với anchored response hợp lệ thất bại `Missing correctedEssay text`; test anchor invalid nhận sai nhóm lỗi so với contract mới. Sau sửa, focused parser/generator/prompt/worker và regression WritingFeedbackContractIT/WritingGradingResultCompatibilityIT đều exit 0.
- Backend `mvnw.cmd -q clean test`: 1.873 tests, 0 failures/errors, 1 skipped. Workbook bị test sinh lại được khôi phục về bản Git.
- Frontend WritingFeedbackTask/Panel/Contract: 3 files, 64 tests PASS. Không đổi public response schema.
- Gemini thật với cấu hình local hiện hữu, chỉ dùng dữ liệu tổng hợp: text SUCCESS, 5 corrections, reconstruction=true; biểu đồ tự tạo SUCCESS, 4 corrections, reconstruction=true. Không lưu/in provider response hay credential, không tạo/requeue attempt người dùng.
- Review độc lập: PASS, không phát hiện lỗi introduced P0/P1/P2 trong phạm vi anchored contract.

Sau khi restart backend, attempt mới sử dụng provider contract mới. Nút cập nhật nhận xét chỉ đọc trạng thái; các job FAILED cũ vẫn terminal và không được tự sửa dữ liệu.
