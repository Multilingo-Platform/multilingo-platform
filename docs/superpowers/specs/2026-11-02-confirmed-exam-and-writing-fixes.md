# Spec: Sửa các lỗi Exam Workspace, Flashcard và Writing AI

## Mục tiêu

Sửa các lỗi đã đối chiếu trong workspace: popup lưu flashcard bị khuất, ví dụ SRS lấy cả đoạn ngữ cảnh, prompt câu hỏi bị render hai lần, không tạo được attempt gồm nhiều Part, quota Writing không được cấp/reset thống nhất, ảnh `<img>` trong prompt Writing bị từ chối, và feedback không chỉ rõ nhóm validation của phản hồi Gemini.

## Phạm vi và quyết định

- Nhiều Part dùng scope `MULTI_PART` trong cả Practice/Mock; request có ít nhất hai `targetPartIds` khác nhau. Server giữ thứ tự Part/Section trong đề, chỉ đưa các Part chọn vào snapshot. Mock deadline bằng tổng thời lượng các Section chứa Part đã chọn, mỗi Section đúng một lần. Mock chuyển Part trong cùng Section; rời Section thì khóa Section cũ theo lifecycle hiện tại.
- Scope `FULL_EXAM`, `SINGLE_SKILL`, `SINGLE_PART` giữ contract cũ. Không nhận lẫn danh sách nhiều Part với section/part ID đơn.
- Flashcard mới lấy `definition.example`; fallback câu đầy đủ quanh từ trong `sourceContext`. Ví dụ dài được rút về tối đa 320 Unicode code point, ưu tiên vùng có từ. Flashcard cũ chỉ được rút gọn lúc hiển thị, không ghi DB.
- Quota riêng `AI_WRITING_HINTS` và `AI_WRITING_GRADING`; mặc định FREE 5, PREMIUM/VIP 20 lượt mỗi ngày theo `Asia/Ho_Chi_Minh`. Giữ used count, limit, reset của quota hiện hữu đến hết kỳ. Tự cấp khi thiếu; reset khi kỳ đã hết. Limit 0 tắt tính năng. Dòng trùng hoặc cấu hình hỏng fail-closed; không tự sửa dữ liệu. Mỗi lần Hint thành công hoặc mỗi essay được chấm chiếm một lượt; retry job hiện tại không đặt chỗ lần hai. Bỏ `WRITING_ASSISTANT` khỏi UI/quy tắc Writing, giữ hàng dữ liệu legacy.
- Bóc text/ảnh từ HTML snapshot bằng parser JDK hiện có. Giới hạn extraction vào Part/group/question đang chấm; gộp và dedupe ảnh HTML cùng media có cấu trúc; tối đa hai ảnh. ImageFetcher tiếp tục áp allowlist/HTTPS, redirect, MIME, size và deadline. Không fetch lúc submit, không sửa snapshot cũ, không thêm parser dependency.
- Parser output Writing giữ nguyên schema, score, corrections và reconstruction invariant. Thêm reason code nội bộ ổn định cho nhóm validation, lưu vào JSON `model_metadata.validationCode`; log chỉ chứa job/attempt ID và reason code. FE hiển thị thông báo an toàn theo `MALFORMED_OUTPUT`. Không retry hay requeue job `FAILED/UNAVAILABLE`; job đang `WAITING` giữ scheduler hiện hữu.
- Popup được đặt theo kích thước thực, viewport và visual viewport; giới hạn mép 12px, phần thân cuộn, khu vực lưu luôn dùng được.
- Workspace là nơi render prompt duy nhất. Fill-in-blank/Matching giữ `showPrompt=true` mặc định khi dùng độc lập.

## Acceptance criteria

1. Practice/Mock tạo attempt `MULTI_PART` với đúng danh sách hợp lệ; invalid, duplicate, thiếu hoặc lẫn scope selector trả lỗi 4xx, không tạo attempt.
2. Snapshot chứa đúng các Part đã chọn theo thứ tự đề; deadline Mock cộng Section duration không trùng, Practice deadline null; scope cũ không đổi.
3. Answer, autosave, grading, resume, result và review tiếp tục định danh từng câu bằng `(partId, questionId)` và chỉ thấy snapshot thuộc attempt.
4. Hint/grading quota được provision/reset độc lập và nguyên tử; concurrent reservations không vượt limit; 0 block; lỗi/refund không ảnh hưởng period mới.
5. Writing nhận ảnh hợp lệ từ `<img src>` nhưng từ chối URL/media không hợp lệ qua ImageFetcher; context chỉ lấy nguồn snapshot đã scope.
6. Parser trả reason code cho JSON/schema/score/limit/correction/reconstruction failures, vẫn từ chối dữ liệu sai; không đưa essay/provider response vào log/metadata/API.
7. Popup không khuất form lưu ở đáy desktop/mobile. Flashcard mới lưu ví dụ AI ưu tiên; thẻ cũ hiển thị câu ngắn, chứa từ. Prompt Fill-in-blank/Matching hiển thị đúng một lần.

## Giao diện công khai

- `TestScope` thêm `MULTI_PART`.
- Create attempt thêm `targetPartIds: number[]` (alias `part_ids`); các selector đơn hiện hữu tiếp tục hoạt động.
- Admin quota feature codes thêm `AI_WRITING_HINTS`, `AI_WRITING_GRADING`; bỏ `WRITING_ASSISTANT` khỏi danh sách chỉnh quota.
- Không đổi response schema của Writing feedback; `validationCode` là metadata nội bộ. `lastErrorCode=MALFORMED_OUTPUT` tiếp tục là mã public.

## Test design

| ID | Nhóm | Scenario | Kết quả mong đợi |
|---|---|---|---|
| TC_EXAM_MULTI_01 | Happy | Listening + Reading, Practice và Mock | Snapshot đúng hai Part; deadline đúng |
| TC_EXAM_MULTI_02 | Negative/Boundary | 0, 1, duplicate, ID ngoài đề, ID <=0, selector lẫn | 4xx, không lưu attempt |
| TC_EXAM_MULTI_03 | Regression/Security | Scope cũ, IDs không thuộc đề khác, review/resume | Hành vi cũ giữ nguyên; không lộ Part ngoài scope |
| TC_QUOTA_WRITING_01 | Happy/Boundary | FREE/PREMIUM; thiếu row; limit 0; qua nửa đêm VN | Provision/reset đúng limit, 0 bị block |
| TC_QUOTA_WRITING_02 | Edge/Integrity | Cạnh tranh reservation, row trùng/sai, refund qua kỳ mới | Không vượt mức; fail-closed; không giảm counter kỳ mới |
| TC_WRITING_MEDIA_01 | Happy/Negative/Security | img HTTPS trong scope; duplicate; data/relative/blocked/audio/>2 | Gộp ảnh an toàn hoặc trả terminal reason; không fetch ở submit |
| TC_WRITING_DIAG_01 | Negative/Privacy | Mỗi loại malformed JSON/score/corrections/reconstruction | reason code ổn định; không log essay/raw output |
| TC_UI_DICT_01 | UI/Accessibility | Popup sát đáy, resize/keyboard, tab/enter | Lưu flashcard luôn thấy và dùng được |
| TC_SRS_EXAMPLE_01 | Unicode/Regression | AI example, fallback context, câu dài, thẻ cũ | Ví dụ tối đa 320 code points, chứa từ, không ghi DB cũ |
| TC_QUESTION_RENDER_01 | Regression | Fill-in-blank, Matching, renderer standalone | Workspace một prompt; standalone vẫn có prompt |

## Ngoài phạm vi

Không retry/requeue attempt 42 hay job terminal cũ; không viết lại flashcard cũ; không sửa raw exam snapshot; không thay đổi prompt/schema/chính sách grading Gemini; không deploy tự động.
