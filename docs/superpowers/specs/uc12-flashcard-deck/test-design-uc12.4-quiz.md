# UC012.4 — AC và Test Design Practice

Cập nhật 2026-10-12; bản test design, chưa chạy và chưa phải báo cáo PASS. Nguồn: [uc12.4-hoc-tu-vung.md](uc12.4-hoc-tu-vung.md).

## 1. Scope và Actors

Actor: học viên đã xác thực, ownerdeck/phiên. In-scope: các quy tắc API/persistence/FE trong đặc tả nguồn; out-of-scope: chứng nhận/chốngbot hoàn toàn, thaySRS, thêm broker/WebSocket.

## 2. AC và business checklist

~~~gherkin
Feature: Practice Redis và receipt nguyên tử
  Scenario: Hoàn thành tự sync
    Given phiên hợp lệ đã tải
    When chọn câu cuối
    Then FE phản hồi ngay và tự gửi frozen body
    And BE chấm đủ câu, cộng10XP một lần sau commit

  Scenario: Concurrent completion
    Given hai request cùng phiên và cùng body
    When insert receipt bằng ON CONFLICT
    Then chỉ một request cập nhật thống kê
    And request còn lại đọc stored result bằng SELECT kế tiếp

  Scenario: Rollback và cleanup
    Given snapshot Redis còn hạn
    When PostgreSQL rollback
    Then snapshot không bị xóa
    When commit thành công nhưng Redis cleanup lỗi
    Then response vẫn xác nhận thành công

  Scenario: Khác body khi retry
    Given receipt đã commit
    When BE tính hash body mới khác hash đã lưu
    Then trả409 không side effect
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
| TC_PRAC_CREATE_01 | Happy | Tạo snapshot Redis | Owner có deck 10 từ | POST tạo phiên | limit=10, ALL | 201; 10 câu có đáp án; không insert PostgreSQL |
| TC_PRAC_CREATE_02 | Boundary | Ngưỡng nội dung và limit | Deck theo bộ lọc | Tạo phiên với dữ liệu biên | 3 thẻ; 4 thẻ/3 nghĩa; 4 thẻ/4 nghĩa; limit=3, 4, 20, 21 | Thiếu nội dung: 422; limit=3 hoặc21: 400; các trường hợp hợp lệ tạo đủ câu |
| TC_PRAC_FE_01 | UI/UX | Phản hồi cục bộ | Phiên đã tải | Offline chọn đúng/sai và bấm đúp | Options A/B | Không gọi HTTP chấm từng câu; chỉ nhận lựa chọn đầu; tra correctOptionId |
| TC_PRAC_SUBMIT_01 | Happy | Tự ghi nhận khi đủ câu | Phiên 10 câu | Chọn câu cuối | 8 đúng, 65 giây | 10 XP; 80%; một receipt; counters đúng; cộng1 phút |
| TC_PRAC_VALIDATE_01 | Negative | Chặn payload sai | Snapshot còn hạn | Gửi body lỗi | Thiếu/thừa/trùng câu; option lạ; duration=-1 hoặc86401; field XP | 400; không ghi receipt, XP hoặc nhật ký |
| TC_PRAC_REPLAY_01 | Edge | Mất response sau commit | Receipt đã commit, Redis đã xóa | Gửi lại frozen body | Cùng session; đảo thứ tự answers | 200 cùng stored result; không cộng lại; hash không đổi |
| TC_PRAC_REPLAY_02 | Security | Payload khác cùng phiên | Receipt đã commit | Gửi lại body khác | Đổi option hoặc duration | 409; không tin hash client |
| TC_PRAC_CONCURRENT_01 | Edge | Hai request cùng body | PostgreSQL thật; snapshot Redis | Hai connection cùng complete bằng barrier | Cùng session/body | Một winner; cả hai nhận200; một receipt và10 XP |
| TC_PRAC_CONCURRENT_02 | Security | Hai request khác body | PostgreSQL thật | Complete đồng thời | Cùng session, answers khác | Winner200, loser409; chỉ một lần cập nhật |
| TC_PRAC_ROLLBACK_01 | Edge | Lỗi sau reserve receipt | Snapshot còn hạn | Inject lỗi sau insert receipt hoặc trong stats | Lỗi DB | Rollback toàn bộ; key Redis còn; retry ghi nhận một lần |
| TC_PRAC_CLEANUP_01 | Edge | Cleanup Redis thất bại | PostgreSQL commit thành công | Inject lỗi delete Redis | Connection timeout | 200 confirmed; dữ liệu DB đúng; key tự hết TTL |
| TC_PRAC_EXPIRY_01 | Boundary | Hạn tuyệt đối và replay | Clock injectable | Complete trước/bằng/sau expiresAt; replay terminal | -1ms/0/+1ms; Redis phục hồi key cũ | Trước hạn nhận; bằng/sau hạn410; receipt còn thì replay 200 |
| TC_PRAC_PRUNE_01 | Edge | Dọn receipt | Có receipt đã/chưa đến retainUntil | Chạy job batch | retainUntil, sessionExpiresAt | Không xóa chưa hạn; tối đa1000 row/batch; phiên cũ không nhận thưởng lại |
| TC_PRAC_SEC_01 | Security | JWT, IDOR, đổi tài khoản | Phiên thuộc A | B complete; anonymous; local A khi đăng nhập B | Token A/B | 403/401; không sync dữ liệu A dưới B |
| TC_PRAC_NETWORK_01 | Edge | Lỗi tạm và hết hạn | FE đã lưu frozen body | Redis timeout; key thiếu | 503/5xx/410 | Retry503/5xx; 410 terminal; không đổi body; phân biệt XP dự kiến/đã nhận |
| TC_PRAC_LOCAL_01 | UI/UX | Reload và storage lỗi | Snapshot local theo tài khoản | Reload; quota lỗi; parent rerender | sessionId/userId/expiresAt | Resume đúng khi app tải được; cảnh báo memory-only; không sinh lại đề |
| TC_PRAC_STATS_01 | Edge | Tạo stats/log đồng thời | PostgreSQL; chưa có stats/log | Practice, Test, SRS ghi nhận song song | Cùng user/ngày | Một stats/log; upsert và lock order không mất tổng hoặc deadlock |
| TC_PRAC_STREAK_01 | Boundary | Ngày và thời lượng | Clock injectable | Học cùng ngày/ngày sau/cách ngày; retry | Asia/Ho_Chi_Minh; duration=0, 59, 60 | Streak giữ/tăng/reset đúng; replay result cũ; phút 0, 0, 1 |
| TC_PRAC_MIGRATE_01 | Regression | Rollout bảo toàn dữ liệu | Bảng Quiz cũ có dữ liệu | Migration mới và switch flag | Phiên active/completed và rewards | Không DROP; giữ lịch sử; drain phiên cũ; không backfill XP suy đoán |
| TC_PRAC_SRS_01 | Regression | Không can thiệp SRS | Thẻ có các chỉ số SRS | Complete Practice | Đáp án đúng/sai | SRS fields không đổi; không tăng flashcards_reviewed |
| TC_PRAC_A11Y_01 | UI/UX | Audio, keyboard, mobile | Viewport320px; audio bị chặn | Phím1–4/Enter; mute; unmount | Text dài; zoom200% | Mọi đáp án/nút truy cập được; audio lỗi không cản học; cleanup context |
| TC_PRAC_REPLAY_03 | Edge | Receipt xuất hiện giữa hai lần đọc | Lookup đầu chưa thấy receipt | Winner commit và xóa Redis trước GET của loser | Cùng body; key thiếu | Loser đọc lại receipt và trả 200; không báo410 sai |

## 5. Bằng chứng nghiệm thu

Unit: generator/validation/hash/Clock/scorer; MockMvc security filters:JWT/IDOR/DTO. PostgreSQL thật cho ON CONFLICT/CAS/row locks/JSONB/rollback; Redis thật cho TTL/lỗi kết nối lúc cleanup. Mock/H2 không chứng minh concurrency. Hai connections và barrier để cùng tranh chấp; kiểm tra row count và delta XP/log, không chỉ response 200.

Nghiệm thu FE dựa trên `npm run build` (type-check và bundle sạch 0 lỗi) kết hợp Browser QA thực tế trên trình duyệt (mobile, audio, local storage). Backend chạy `mvn clean test`; integration profile vocab-integration trên DB/Redis test riêng cấu hình bằng TEST_DB_URL/TEST_DB_USER/TEST_DB_PASSWORD/TEST_REDIS_HOST/TEST_REDIS_PORT. Kế hoạch chịu trách nhiệm tạo profile nếu chưa có; thiếu env báo lỗi rõ, không fallback production. Checklist chỉ đánh PASS khi có log thực.
