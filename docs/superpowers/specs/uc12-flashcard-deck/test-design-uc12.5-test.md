# UC012.5 — AC và Test Design Thi thử

Cập nhật 2026-10-12; bản test design, chưa chạy và chưa phải báo cáo PASS. Nguồn: [uc12.5-kiem-tra-tu-vung.md](uc12.5-kiem-tra-tu-vung.md).

## 1. Scope và Actors

Actor: học viên đã xác thực, ownerdeck/phiên. In-scope: các quy tắc API/persistence/FE trong đặc tả nguồn; out-of-scope: chứng nhận/chốngbot hoàn toàn, thaySRS, thêm broker/WebSocket.

## 2. AC và business checklist

~~~gherkin
Feature: Thi thử PostgreSQL với CAS và terminal transition
  Scenario: Hai tab cùng version
    Given progressVersion bằng3
    When hai tab gửi expectedVersion3 và body khác nhau
    Then chỉ một tab nhận200version4
    And tab còn lại nhận409 và đối soát bằng Resume

  Scenario: Submit đua scheduler
    Given bài ởIN_PROGRESS đã quá deadline
    When submit và scheduler tranh chấp
    Then lock hàng và recheck status chỉ finalise một lần
    And chỉ saved progress được chấm, không nhận answer mới

  Scenario: Timeout không có lựa chọn
    Given bài chưa có câu trả lời
    When tự thu bài
    Then lưu TIMED_OUT0điểm0XP
    And không tăng streak hoặc phút học

  Scenario: Snapshot và review
    Given bài đã đóng rồi nguồn bịxóa
    When owner mởreview
    Then trả snapshot đã lưu
    And mọi API đang thi không lộ đápán
~~~

- [ ] JWT/owner; DTOwhitelist; validation câu/option/limit.
- [ ] Retry/terminal/transaction đúng; không double XP hoặc mấtstats.
- [ ] Lưutrữ/cleanup/config đúng đặc tả; khôngxóadữ liệucũ trong rollout.
- [ ] FE state/account/storage/keyboard/mobile và lỗi mạngcó hànhvi rõ.
- [ ] Nguồn thống kêtáchPractice/Test/SRS; Clock/timezone và không sửaSRS.

## 3. Ma trận sáu khía cạnh

| Khía cạnh | Coverage |
| --- | --- |
| Happy | Các case Happy |
| Negative | Payload/option/version/status sai |
| Boundary | Limit/hạn/ngày và nội dung 4 thẻ/4 nghĩa |
| Edge | Concurrent/replay/rollback/network |
| Security | JWT/IDOR/đáp án và sửa payload |
| UI/UX | Keyboard/mobile/focus/save pending/conflict |

Regression và migration là coverage bổ sung, không thay UI/UX.

## 4. Test cases — bảy cột

| Mã TC | Phân loại | Kịch bản | Tiền điều kiện | Các bước thực hiện | Dữ liệu | Kết quả mong đợi |
| --- | --- | --- | --- | --- | --- | --- |
| TC_TEST_GEN_01 | Happy | Sinh đề và Resume giấu đáp án | Owner có đủ nội dung | Generate và Resume | limit=10 | Snapshot PG; DTO không correctKey/explanation; có serverTime |
| TC_TEST_GEN_02 | Boundary | Limit và nội dung biên | Deck theo đặc tả | Generate nhiều bộ dữ liệu | limit=3, 4, 20, 21; 4 thẻ/3 nghĩa | 400 sai limit; 422 thiếu nội dung; các trường hợp khác hợp lệ |
| TC_TEST_PROGRESS_01 | Happy | CAS full snapshot | Version0, IN_PROGRESS | PUT expectedVersion=0 | Hai answers | 200 version1; lưu full snapshot |
| TC_TEST_PROGRESS_02 | Edge | Retry autosave mất response | Version1 đã commit từ expected0 | Gửi body cũ | Hash giống nhau | 200 version1; không tăng version lần nữa |
| TC_TEST_PROGRESS_03 | Edge | Hai tab xung đột | Cùng đọc version3 | PUT song song expectedVersion=3 | Hai body khác nhau | Một tab200/version4; tab còn lại409; không ghi đè âm thầm |
| TC_TEST_PROGRESS_04 | Negative | Bỏ chọn và validation | Version1 | PUT full snapshot | answers=[]; flagged với null; duplicate/option lạ | Xóa lựa chọn/giữ cờ hợp lệ; body lỗi400 |
| TC_TEST_RESUME_01 | UI/UX | F5 hoặc đổi thiết bị | BE đã xác nhận progress | GET Resume | Token của owner | Đề, savedAnswers, version, deadline; không hứa phục hồi unsaved edits |
| TC_TEST_SUBMIT_01 | Happy | Nộp đúng hạn | Version3, IN_PROGRESS | Submit expectedVersion=3 | 8/10 đúng | 80 điểm; 20 XP; COMPLETED; summary PG; một stats delta |
| TC_TEST_SUBMIT_02 | Edge | Final payload stale | Server version4 | Submit expectedVersion=3 | Tab cũ | 409 TEST_VERSION_CONFLICT; không đóng bài hoặc ghi thưởng |
| TC_TEST_REPLAY_01 | Edge | Retry bài terminal | Attempt đã terminal | Submit lại cùng hoặc khác body | Cùng testToken | 200 stored result; không đổi lựa chọn/XP/nhật ký |
| TC_TEST_DEADLINE_01 | Boundary | Hạn chót | Clock injectable | Submit tại các mốc | deadline-1ms, deadline, deadline+1ms | Trước/bằng hạn nhận final body; sau hạn chấm saved progress thành TIMED_OUT |
| TC_TEST_SCHED_01 | Edge | Submit và scheduler nhiều node | PostgreSQL thật | Hai worker và submit dùng barrier | Token cùng bài; quá grace | Lock và reload; finalise một lần; một delta XP; worker dư no-op |
| TC_TEST_SCHED_02 | Edge | Bỏ mặc không trả lời | Bài chưa có lựa chọn | Scheduler finalise | 0 answers | TIMED_OUT, 0 điểm, 0 XP; không streak/phút; attempt count tăng 1 |
| TC_TEST_SCHED_03 | Happy | Timeout có câu đã lưu | 6/10 đã chọn | Scheduler finalise | 3 đúng trong6 lựa chọn | 30 điểm; 20 XP; answeredCount=6, không dùng totalQuestions=10 |
| TC_TEST_TERMINAL_01 | Security | Progress và Review theo trạng thái | ACTIVE hoặc terminal | PUT sau đóng; GET Review trước/sau đóng | Token owner | Terminal progress409; active review400; terminal review200 |
| TC_TEST_SEC_01 | Security | JWT và owner trên mọi API | Bài thuộc A | B Resume/progress/submit/review; anonymous | Token A/B | 403/401 trước lộ state/đáp án; không side effect |
| TC_TEST_ROLLBACK_01 | Edge | Lỗi khi ghi thưởng | PostgreSQL thật | Inject lỗi sau score/trong stats | Lỗi DB | Attempt và stats rollback; retry finalise một lần |
| TC_TEST_SNAPSHOT_01 | Regression | Edit/delete dữ liệu nguồn | Bài có snapshot | Sửa/xóa thẻ hoặc deck; Review | FK deck SET NULL | Snapshot/tên deck/kết quả còn; không đọc card hiện tại |
| TC_TEST_SRS_01 | Regression | Không sửa SRS | Thẻ có lịch ôn | Completed hoặc timeout | Score90; SRS fields | Không tự nâng MASTERED; status/interval/ease/ngày ôn không đổi |
| TC_TEST_STATS_01 | Edge | Ba nguồn học cùng ngày | Stats/log chưa có | Complete đồng thời | VOCAB_TEST/PRACTICE/SRS | Không mất totals; counters nguồn tách; streak tính một ngày |
| TC_TEST_A11Y_01 | UI/UX | Timer, Palette, conflict | Bài đang thi | Chuyển câu/flag; mạng trễ; conflict | serverTime và local edits | Không spinner mỗi chọn; saved/pending rõ; 409 đối soát, không tự ghi đè tab khác |
| TC_TEST_RETENTION_01 | Edge | Lưu giữ Assessment | Attempt theo chính sách | Kiểm tra tác vụ retention | Active/terminal chưa/đã hạn | Không xóa active hoặc chưa hạn; không dùng TTL Practice |
| TC_TEST_PROGRESS_05 | Security | Autosave quá hạn hoặc sau terminal | Bài quá deadline hoặc đã đóng | PUT progress | expectedVersion hợp lệ nhưng sai state/time | 410 quá hạn, 409 terminal; không đổi saved answers/result |
| TC_TEST_EMPTY_01 | Boundary | Nộp thủ công không chọn câu | IN_PROGRESS còn hạn | Submit answers=[] | expectedVersion hiện tại | COMPLETED, 0 XP, không streak/phút; lưu điểm0 và attempt count |

## 5. Bằng chứng nghiệm thu

Unit: generator/validation/hash/Clock/scorer; MockMvc security filters:JWT/IDOR/DTO. PostgreSQL thật cho ON CONFLICT/CAS/row locks/JSONB/rollback; Redis thật cho TTL/lỗi kết nối lúc cleanup. Mock/H2 không chứng minh concurrency. Hai connections và barrier để cùng tranh chấp; kiểm tra row count và delta XP/log, không chỉ response 200.

Nghiệm thu FE dựa trên `npm run build` (type-check và bundle sạch 0 lỗi) kết hợp Browser QA thực tế trên trình duyệt (Timer, Palette, Focus mode, review answers). Backend chạy `mvn clean test`; integration profile vocab-integration trên DB/Redis test riêng cấu hình bằng TEST_DB_URL/TEST_DB_USER/TEST_DB_PASSWORD/TEST_REDIS_HOST/TEST_REDIS_PORT. Kế hoạch chịu trách nhiệm tạo profile nếu chưa có; thiếu env báo lỗi rõ, không fallback production. Checklist chỉ đánh PASS khi có log thực.
