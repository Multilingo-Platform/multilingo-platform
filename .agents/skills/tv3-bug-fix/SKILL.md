---
name: tv3-bug-fix
description: "Dùng khi phân tích và sửa bug trong luồng TV3 về exam attempt, practice/mock test, autosave, resume, grading hoặc result của Multilingo Platform."
---

# Sửa bug TV3

Dùng skill này cho bug thuộc các feature TV3 của exam attempt, practice/mock test, workspace, autosave/resume, submission, grading, review và result. Skill này bổ sung quy trình đặc thù TV3; vẫn tuân thủ yêu cầu trực tiếp của người dùng và repository rules.

## Quy trình

1. Xác định task/feature TV3 liên quan và hành vi sai cần sửa. Đọc `GEMINI.md`, rules áp dụng theo thư mục, cùng plan và handoff cụ thể nhất trong `docs/superpowers/plans/ndt/` (ví dụ `TV3-<id>-plan.md` và handoff tương ứng). Dùng acceptance criteria và ghi chú out-of-scope tại đó làm ranh giới; không suy rộng từ một task TV3 sang task khác.
2. Ghi nhận `git status` và staged, unstaged, untracked changes trước khi sửa. Giữ nguyên công việc có sẵn; chỉ sửa file cần cho nguyên nhân đã xác minh.
3. Dùng `systematic-debugging` để tái hiện lỗi, lần theo dữ liệu tới nguyên nhân gốc và đối chiếu implementation đang chạy với một call path tương tự hoạt động đúng. Nếu không tái hiện được, nêu rõ bằng chứng còn thiếu thay vì đoán.
4. Dùng `test-driven-development`: thêm regression test nhỏ thể hiện hành vi mong muốn, chạy để xác nhận test thất bại vì bug, rồi mới sửa tối thiểu. Dùng production code thật ở nơi phù hợp; chỉ mock ranh giới cần cô lập.
5. Chạy test mục tiêu trước, sau đó chạy các regression tests liên quan theo plan và repository rules. Nếu suite rộng không chạy được, ghi lệnh và lỗi/blocker cụ thể; không báo PASS dựa trên test chưa chạy.
6. Soát diff và status lần cuối để xác nhận không sửa ngoài scope. Cập nhật handoff chỉ khi task plan hoặc yêu cầu người dùng quy định; giữ nguyên các entry trước đó.

## Bất biến cần giữ trong TV3

- Quyền truy cập được quyết định từ identity và attempt lưu trên server. Field trong request như `userId`, `mode` hoặc trạng thái không cấp quyền. Khi lấy key/lời giải, kiểm tra owner, mode và trạng thái trước theo đúng plan của endpoint.
- Dùng Part ID và question ID thực trong snapshot. Định danh câu theo cặp `(partId, questionId)`; không đoán ID từ thứ tự hoặc trộn key của các Part.
- Với attempt đã tạo, snapshot là nguồn dữ liệu lịch sử cho nội dung và grading key. Không fallback sang đề TV2 hiện tại khi snapshot thiếu/sai dữ liệu; xử lý fail-closed theo error contract.
- Chấm bài bằng grading engine hiện có để giữ aliases, alternates, blank semantics và partial credit. Không đổi quy tắc chấm để làm vừa fixture của bug.
- Tách preview feedback khỏi autosave và submit. Preview không ghi answer, tăng version, đổi status/timestamp, hoặc sửa grading/result fields. Các thay đổi persistence thuộc service/lifecycle đã được plan chỉ định.
- Chỉ trả dữ liệu learner được phép xem tại trạng thái đó. Không serialize snapshot, toàn Part, grading-key object, alternates, admin fields hoặc nội dung nhạy cảm ngoài allowlist. Error và log không chứa answer, key, explanation hay token.
- Với resume/autosave và giao diện, giữ typed API contract, version/conflict semantics và dữ liệu người dùng đã sửa. Metadata refresh hoặc response trễ không được ghi đè edit mới hơn; submit phải flush theo contract và thể hiện conflict thay vì im lặng bỏ dữ liệu.

## Giới hạn thay đổi

Không sửa schema/migration, auth dùng chung, global exception handler, TV2 authoring/admin API, grading rules hay các feature không liên quan, trừ khi acceptance criteria của đúng task yêu cầu và người dùng đã cho phép. Không refactor tiện tay, không commit/push nếu chưa được yêu cầu. Nếu bug đòi đổi contract hoặc quyết định kiến trúc, trình bày bằng chứng và hỏi hướng xử lý trước khi mở rộng phạm vi.

Khi báo hoàn tất, nêu nguyên nhân, thay đổi, regression test và lệnh verification đã chạy; phân biệt test chạy thực tế với kết quả chỉ được báo lại, và liệt kê phần chưa xác minh.
