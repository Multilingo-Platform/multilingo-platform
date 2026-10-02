# Sprint 05 — Acceptance Criteria & Test Matrix: Timer & Nộp Bài

**Spec nguồn:** `docs/superpowers/specs/2026-10-02-sprint05-timer-and-submission-design.md`  
**Ngày soạn:** 2026-10-02  
**Sprint:** 05 — Timer và Nộp Bài  
**Kỹ năng chuẩn hóa:** `acceptance-criteria-and-test-design`  

---

## Phần A: Phân Tích Scope & Actors

### 1. Danh Sách Actors
1. **Học Viên (Frontend Client):** Thao tác làm bài, chủ động nộp bài (MANUAL), hoặc để đồng hồ đếm ngược hết giờ tự động nộp (TIMEOUT_CLIENT).
2. **Backend Submission Controller & Service:** Tiếp nhận yêu cầu, phân xử deadline, chốt bài (`SUBMITTED`), kích hoạt chấm điểm khách quan.
3. **Lazy Finalizer (Query Hook):** Kích hoạt ngầm khi có request `GET /attempts/{id}` hoặc `GET /attempts/{id}/result` tới bài thi đã quá hạn.
4. **Background Expiration Scheduler (Cron Job):** Quét định kỳ các bài thi quá hạn để tự động thu hồi (`TIMEOUT_SERVER`).

### 2. Phạm Vi Kiểm Thử (In-Scope)
- Nộp bài thủ công (`reason = MANUAL`) đúng hạn và xử lý từ chối khi quá hạn.
- Tự động nộp bài khi hết giờ (`reason = TIMEOUT_CLIENT`) trong khoảng **Grace Window (15 giây)**.
- Từ chối nộp bài hoặc từ chối nhận payload mới khi quá Grace Window (> deadline + 15s).
- Cố định `end_time = min(now, deadline)`.
- Kiến trúc 2 pha: Đóng bài độc lập với Chấm điểm; lỗi chấm điểm chuyển `GRADING_FAILED`, không mất trạng thái `SUBMITTED`.
- Lazy Finalize khi người dùng gọi API đọc attempt sau deadline.
- Background Scheduler định kỳ quét attempt quá hạn bằng `SELECT FOR UPDATE SKIP LOCKED`.
- Autosave độc lập kiểm tra deadline và trả về HTTP 409 khi bài đã chốt hoặc quá hạn.
- Xử lý hạn mức AI (AI Quota) khi nộp bài có kỹ năng Writing.
- Frontend countdown timer bù `offset = serverTime - clientNow`, tính lại khi `visibilitychange`.
- Frontend UX khi hết giờ: khóa form, hiển thị overlay "Đang nộp bài...", retry có backoff, tự động điều hướng kết quả khi nhận 409.
- Chế độ Practice: không có deadline, không đếm ngược, không bị thu bài tự động.

### 3. Ngoài Phạm Vi (Out-of-Scope)
- Chi tiết logic gọi Gemini AI chấm bài tự luận Writing (thuộc Sprint 09).
- Giao diện Diff-View sửa lỗi Writing (thuộc Sprint 10).
- Hiển thị bảng tra cứu lời giải chi tiết và bản dịch từng câu (thuộc Sprint 06).

---

## Phần B: Acceptance Criteria (Gherkin Scenarios)

### AC-01: Nộp bài thủ công đúng hạn (Happy Path)
```gherkin
Scenario: Học viên chủ động bấm nộp bài trước khi hết giờ
  Given Attempt đang ở trạng thái IN_PROGRESS
  And Chế độ làm bài là MOCK_TEST với deadline là 10:30:00 UTC
  And Thời điểm hiện tại là 10:25:00 UTC (now < deadline)
  When Học viên gửi request POST /api/attempts/{id}/submit với reason=MANUAL kèm finalAnswers
  Then Hệ thống cập nhật end_time = 10:25:00 UTC
  And Trạng thái attempt chuyển sang SUBMITTED
  And Hệ thống thực thi chấm điểm khách quan
  And Nếu bài thuần trắc nghiệm, trạng thái chuyển sang COMPLETED với điểm overallScore được cập nhật
  And Response trả về HTTP 200 OK
```

### AC-02: Nộp bài thủ công quá hạn bị từ chối
```gherkin
Scenario: Học viên cố tình gửi request MANUAL sau khi deadline đã qua
  Given Attempt đang ở trạng thái IN_PROGRESS có deadline là 10:30:00 UTC
  And Thời điểm hiện tại là 10:30:05 UTC (now > deadline)
  When Học viên gửi request POST /api/attempts/{id}/submit với reason=MANUAL
  Then Hệ thống từ chối nhận bài và ném AppException với mã ATTEMPT_EXPIRED (HTTP 409)
  And Đáp án gửi kèm không được ghi nhận vào cơ sở dữ liệu
```

### AC-03: Tự động nộp bài khi hết giờ trong Grace Window (15 giây)
```gherkin
Scenario: Frontend đếm ngược về 0 và gửi submit do timeout trong khoảng 15 giây ân hạn
  Given Attempt đang IN_PROGRESS có deadline là 10:30:00 UTC
  And Thời điểm server nhận request là 10:30:08 UTC (now <= deadline + 15s)
  When Request gửi đến với reason=TIMEOUT_CLIENT kèm finalAnswers
  Then Hệ thống chấp nhận ghi nhận finalAnswers vào attempt_answers
  And Cố định end_time = 10:30:00 UTC (bằng đúng deadline, không lấy 10:30:08)
  And Trạng thái chuyển sang SUBMITTED và tiến hành chấm điểm
  And Trả về HTTP 200 OK
```

### AC-04: Tự động nộp bài quá Grace Window (> 15 giây)
```gherkin
Scenario: Request TIMEOUT_CLIENT đến quá muộn do nghẽn mạng nặng
  Given Attempt đang IN_PROGRESS có deadline là 10:30:00 UTC
  And Thời điểm server nhận request là 10:30:25 UTC (now > deadline + 15s)
  When Request gửi đến với reason=TIMEOUT_CLIENT kèm finalAnswers mới
  Then Hệ thống từ chối cập nhật finalAnswers mới
  And Tự động chốt bài với đáp án đã autosave gần nhất
  And Cố định end_time = 10:30:00 UTC
  And Chuyển trạng thái sang SUBMITTED và chấm điểm bình thường
```

### AC-05: Cố định end_time luôn là min(now, deadline)
```gherkin
Scenario: Kiểm tra giá trị end_time không bao giờ vượt quá deadline
  Given Attempt có deadline là T_deadline
  When Nộp bài tại thời điểm T_now
  Then Giá trị end_time lưu trong database phải thỏa mãn: end_time == min(T_now, T_deadline)
```

### AC-06: Tách 2 pha - Lỗi chấm điểm không rollback trạng thái đóng bài
```gherkin
Scenario: Lỗi phát sinh trong quá trình chấm điểm khách quan (Objective Grading)
  Given Attempt nộp bài hợp lệ và chuyển trạng thái SUBMITTED thành công
  When Bộ chấm điểm ObjectiveGradingService gặp lỗi ngoại lệ hệ thống (ví dụ: lỗi parsing fixture)
  Then Transaction đóng bài không bị rollback
  And Đáp án cuối cùng và end_time của học viên vẫn được bảo lưu an toàn
  And Trạng thái của attempt chuyển sang GRADING_FAILED
  And Response trả về thông báo bài đã nộp nhưng việc chấm điểm đang chờ xử lý lại
```

### AC-07: Xử lý đồng thời và tính Idempotency (Hai request submit song song)
```gherkin
Scenario: Gửi 2 request submit đồng thời cùng lúc (Double-click hoặc vừa bấm nộp vừa hết giờ)
  Given Attempt đang ở trạng thái IN_PROGRESS
  When Hai request submit được gửi đến server gần như đồng thời
  Then Nhờ cơ chế SELECT ... FOR UPDATE, chỉ có duy nhất 1 request thực hiện đóng bài và chấm điểm
  And Request thứ hai nhận thấy trạng thái đã là SUBMITTED/COMPLETED
  And Request thứ hai trả về kết quả đã có mà không chạy lại pipeline chấm điểm
  And Không phát sinh bản ghi trùng lặp hay xung đột dữ liệu
```

### AC-08: Cơ chế Lazy Finalize khi truy vấn attempt quá hạn
```gherkin
Scenario: Học viên tắt máy trước khi hết giờ, sau đó mở lại trang sau deadline (khi cron chưa chạy)
  Given Attempt MOCK_TEST có deadline là 10:00:00 UTC, hiện tại là 10:10:00 UTC
  And Trạng thái attempt trong database vẫn là IN_PROGRESS
  When Học viên thực hiện gọi GET /api/attempts/{id}
  Then Hệ thống phát hiện now > deadline
  And Hệ thống tự động kích hoạt Lazy Finalize, chốt bài với reason=TIMEOUT_SERVER
  And Trạng thái attempt chuyển sang EXPIRED hoặc SUBMITTED
  And Response trả về trạng thái đã kết thúc, học viên không thể tiếp tục chỉnh sửa bài làm
```

### AC-09: Background Scheduler quét attempt quá hạn
```gherkin
Scenario: Cron job định kỳ dọn dẹp các attempt bị bỏ rơi sau deadline
  Given Trong database có các attempt IN_PROGRESS có deadline đã qua quá 15 giây (now > deadline + 15s)
  When Background Scheduler kích hoạt (mỗi 30 giây)
  Then Scheduler thực hiện query với FOR UPDATE SKIP LOCKED
  And Gọi finalize cho từng attempt theo batch với reason=TIMEOUT_SERVER
  And Cố định end_time = deadline và kích hoạt chấm điểm
  And Trạng thái chuyển từ IN_PROGRESS sang SUBMITTED / COMPLETED
```

### AC-10: Xung đột Autosave sau khi đã nộp hoặc sau deadline
```gherkin
Scenario: Request autosave ngầm gửi đến sau khi bài thi đã được nộp hoặc đã hết hạn
  Given Attempt đã có trạng thái SUBMITTED (hoặc COMPLETED, EXPIRED)
  When Client gửi request PUT /api/attempts/{id}/answers
  Then Server lập tức trả về mã lỗi HTTP 409 Conflict với error code ATTEMPT_ALREADY_SUBMITTED
  And Phía Frontend bắt mã lỗi này và hủy bỏ hoàn toàn timer autosave ngầm
```

### AC-11: Xử lý Quota AI khi nộp bài thi có Writing
```gherkin
Scenario: Nộp bài có Writing nhưng tài khoản/hệ thống đã hết quota AI
  Given Attempt gồm cả phần trắc nghiệm và phần Writing Task
  And Tài khoản học viên đã hết hạn mức AI
  When Học viên nộp bài
  Then Phần thi khách quan vẫn được chấm điểm bình thường và ghi nhận điểm
  And Job Writing được tạo trong cùng transaction đóng bài với trạng thái AI_GRADING_QUEUED
  And Bài thi được chốt thành công, không chặn hoặc từ chối bài thi của học viên
```

### AC-12: Frontend Countdown Timer bù offset và chống timer drift
```gherkin
Scenario: Đồng hồ đếm ngược hoạt động chính xác khi tab trình duyệt bị ẩn
  Given Client nhận serverTime và deadline từ API backend
  And Client tính toán timeOffset = serverTime - Date.now()
  When Học viên chuyển sang tab khác trong 10 phút rồi quay lại
  And Sự kiện visibilitychange kích hoạt
  Then Client tính toán lại remainingTime dựa trên deadline và timeOffset
  And Thời gian hiển thị nhảy chính xác về mốc thực tế mà không bị trôi/chậm giờ
```

### AC-13: Frontend UX khi hết giờ và xử lý lỗi mạng
```gherkin
Scenario: Đếm ngược về 00:00, tự động khóa giao diện và xử lý sự cố mạng
  When Countdown timer chạm mốc 00:00
  Then Toàn bộ các ô nhập liệu, radio, nút bấm trong workspace bị vô hiệu hóa
  And Overlay modal "Hết giờ làm bài! Hệ thống đang tự động nộp bài..." hiển thị cố định
  And Frontend tự động gửi request submit do timeout
  And Nếu gặp lỗi mất mạng: Overlay hiển thị thông báo lỗi kèm cơ chế retry tự động và nút "Thử nộp lại"
  And Nếu server trả về 409 (đã chốt bài): Tự động chuyển hướng sang trang kết quả
```

### AC-14: Chế độ Practice không có timer
```gherkin
Scenario: Học viên làm bài ở chế độ Luyện tập (PRACTICE)
  Given Attempt có test_mode = PRACTICE
  Then Workspace không hiển thị đồng hồ đếm ngược deadline
  And Bài thi không bao giờ bị thu bài tự động hay hết hạn
  And Học viên có thể làm bài và nộp bài bất kỳ lúc nào
```

---

## Phần C: Ma Trận Test Cases (Test Matrix)

| Test ID | Hạng Mục | Kịch Bản Kiểm Thử | Dữ Liệu / Tiền Điều Kiện | Kỳ Vọng (Expected Output) | Mức Độ |
|---|---|---|---|---|---|
| **TC-S05-01** | Backend Finalize | Submit thủ công hợp lệ | Mode MOCK, `now < deadline`, `reason=MANUAL` | `status=SUBMITTED`, `end_time=now`, HTTP 200 | P0 (Critical) |
| **TC-S05-02** | Backend Finalize | Submit thủ công quá hạn | `now > deadline`, `reason=MANUAL` | Ném `AppException(ATTEMPT_EXPIRED)`, HTTP 409 | P0 (Critical) |
| **TC-S05-03** | Backend Grace | Submit timeout trong Grace Window | `now = deadline + 10s`, `reason=TIMEOUT_CLIENT` | Chấp nhận finalAnswers, `end_time=deadline`, HTTP 200 | P0 (Critical) |
| **TC-S05-04** | Backend Grace | Submit timeout ngoài Grace Window | `now = deadline + 20s`, `reason=TIMEOUT_CLIENT` | Bỏ qua finalAnswers, chốt bằng đáp án cũ, `end_time=deadline` | P0 (Critical) |
| **TC-S05-05** | Backend Constraint| Kiểm tra `end_time = min(now, deadline)` | Nộp lúc `now < deadline` và lúc `now > deadline` | `end_time` không bao giờ lớn hơn `deadline` | P0 (Critical) |
| **TC-S05-06** | Two-phase Submission| Chấm điểm lỗi không rollback chốt bài | Châm điểm ném ngoại lệ RuntimeException | `status=GRADING_FAILED`, đáp án và `end_time` vẫn được lưu | P1 (High) |
| **TC-S05-07** | Concurrency | 2 request submit đồng thời | Gửi song song 2 request submit cùng 1 attempt | `FOR UPDATE` khóa dòng, 1 request xử lý, request 2 trả kết quả đã có | P1 (High) |
| **TC-S05-08** | Lazy Finalize | GET attempt sau deadline | `status=IN_PROGRESS`, `now > deadline` khi gọi GET | Tự động chốt bài, trả DTO với `status=EXPIRED` / `SUBMITTED` | P0 (Critical) |
| **TC-S05-09** | Lazy Finalize | GET result khi chưa nộp nhưng quá hạn | `now > deadline`, chưa submit | Kích hoạt finalize, chấm điểm và trả kết quả | P1 (High) |
| **TC-S05-10** | Autosave Conflict | Autosave sau khi đã SUBMITTED | `status=SUBMITTED`, gọi PUT answers | Trả lỗi HTTP 409 `ATTEMPT_ALREADY_SUBMITTED` | P0 (Critical) |
| **TC-S05-11** | Autosave Conflict | Autosave khi `now > deadline` | `now > deadline`, chưa submit, gọi PUT answers | Trả lỗi HTTP 409 `ATTEMPT_EXPIRED` | P0 (Critical) |
| **TC-S05-12** | Background Cron | Scheduler quét attempt quá hạn | Attempt `IN_PROGRESS` có `deadline < now - 15s` | Cron tự động chốt bài với `reason=TIMEOUT_SERVER` | P1 (High) |
| **TC-S05-13** | AI Quota Handling | Nộp bài Writing khi hết quota AI | Bài có Writing, tài khoản hết quota | Chấm khách quan bình thường, Writing gán `AI_GRADING_QUEUED` | P1 (High) |
| **TC-S05-14** | Frontend Countdown | Bù offset thời gian server | `serverTime` lệch máy client 5 phút | Đồng hồ đếm đúng theo giờ server, không phụ thuộc client clock | P0 (Critical) |
| **TC-S05-15** | Frontend Drift | Chuyển tab và bù thời gian | Ẩn tab trình duyệt 2 phút | Sự kiện `visibilitychange` cập nhật đúng thời gian còn lại | P1 (High) |
| **TC-S05-16** | Frontend Auto-submit | Khóa input và overlay khi hết giờ | Countdown chạm 00:00 | Toàn bộ radio/input bị disable, overlay loading hiện lên | P0 (Critical) |
| **TC-S05-17** | Frontend Retry UX | Lỗi mạng khi auto-submit | Ngắt kết nối mạng lúc timeout | Hiện thông báo retry backoff, có nút "Thử nộp lại" | P1 (High) |
| **TC-S05-18** | Frontend Conflict UX| Tự chuyển trang kết quả khi nhận 409 | Server đã chốt bài trước đó | Frontend tự động push route sang `/exam/result/{id}` | P1 (High) |
| **TC-S05-19** | Practice Mode | Làm bài và nộp ở chế độ Practice | Mode PRACTICE | Không có timer đếm ngược, nộp bài thành công | P2 (Medium) |
| **TC-S05-20** | Modal Submit | Xác nhận nộp bài thủ công | Bấm nút "Nộp bài" trước khi hết giờ | Modal hiển thị số câu chưa làm, chặn double-click | P2 (Medium) |
