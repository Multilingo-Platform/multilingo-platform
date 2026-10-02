# Kế hoạch triển khai TV3 theo 12 sprint chức năng

## 1. Phạm vi và các quyết định đã chốt

Triển khai toàn bộ nghiệp vụ TV3: UC08, UC08.1, UC08.4, UC08.5, UC09/UC09.1, UC09.2, UC10/UC10.1 và UC10.2.

Các lựa chọn đã thống nhất:

- Triển khai giao diện trong **frontend**; sử dụng web-ui làm tài liệu tham khảo về bố cục.
- Chia sprint theo chức năng, không gắn ngày bắt đầu và kết thúc.
- Mỗi task hướng đến **1–3 giờ làm tập trung**, có kết quả kiểm tra riêng. Task vượt mức này phải tách tiếp trước khi thực hiện.
- Dùng fixture và người dùng giả lập trong dev/test khi TV1, TV2 chưa sẵn sàng. Tích hợp thật là điều kiện nghiệm thu cuối.
- Chấm điểm khách quan bằng số câu đúng và tỷ lệ chính xác trước. Chưa tự đặt bảng quy đổi IELTS/TOEIC/VNLTV.
- Mock Test toàn đề dùng tổng thời lượng các Section; một kỹ năng dùng thời lượng Section; một Part dùng thời lượng riêng của Part.
- Giữ stack thực tế của repo: Java 21, Spring Boot 3.3.4, PostgreSQL 16, React 19 và TypeScript 6.

**Hiện trạng đã kiểm tra:** frontend build thành công; backend compile thành công nhưng có cảnh báo trùng Maven plugin. Backend mới có API demo cho ExamPart, chưa có phiên thi, chấm điểm hoặc Gemini. Màn hình thi và kết quả trong web-ui dùng dữ liệu mẫu. Chưa chạy integration test với database.

**Bàn giao tài liệu:** 12 file Markdown tương ứng 12 sprint, đặt trong `docs/ndt`. Hiện phiên làm việc đang ở Plan Mode nên chưa ghi file; nội dung và cách chia dưới đây là bản để duyệt trước khi tạo bộ tài liệu và triển khai code.

Không bao gồm xây lại đăng nhập, CMS đề thi, thanh toán, từ điển, Flashcard, Dashboard năng lực hoặc chấm Speaking. Những phần này chỉ xuất hiện dưới dạng điểm tích hợp với thành viên phụ trách.

## 2. Quy ước áp dụng cho tất cả sprint

Mỗi file sprint phải có:

1. Mục tiêu, use case và đầu ra có thể demo.
2. Điều kiện bắt đầu và task phụ thuộc.
3. Quyết định kỹ thuật, API và dữ liệu liên quan.
4. Checklist task theo mẫu bên dưới.
5. Kịch bản kiểm thử và điều kiện kết thúc sprint.
6. Phần ghi nhận kết quả thực tế, lỗi còn tồn tại và điểm bàn giao.

Mỗi task có ID dạng `TV3-S02-05`, kèm:

| Thuộc tính | Nội dung bắt buộc |
|---|---|
| Trạng thái | TODO, IN_PROGRESS, BLOCKED hoặc DONE |
| Công việc | Một thay đổi cụ thể, có giới hạn |
| Phụ thuộc | ID task cần hoàn thành trước |
| Đầu ra | Code, contract, fixture hoặc kết quả kiểm thử |
| Nghiệm thu | Điều kiện quan sát hoặc kiểm tra được |
| Ước lượng | 1–3 giờ; chưa bao gồm thời gian chờ thành viên khác |
| Bằng chứng | Test, ảnh demo hoặc commit tương ứng |

Task chỉ chuyển sang DONE khi đạt tiêu chí nghiệm thu. Việc UI hiển thị được dữ liệu mẫu không được tính là hoàn thành kết nối backend.

### Contract và nguyên tắc kỹ thuật xuyên suốt

- Backend quyết định chủ sở hữu, quyền truy cập, thời gian, trạng thái và điểm; không nhận các giá trị này từ client để làm căn cứ.
- Dùng cấu trúc `Exam → Section → Part → QuestionGroup → Question`. Chuẩn hóa dữ liệu demo dạng phẳng tại adapter; không để nhiều định dạng lan vào nghiệp vụ.
- Mỗi câu trả lời định danh bằng `partId + questionId`, tránh trùng mã câu giữa các Part.
- Workspace dùng DTO riêng theo danh sách trường được phép trả về. Answer key, lời giải và AI feedback không nằm trong payload làm bài.
- Đóng băng nội dung đề theo từng attempt bằng snapshot phía server, để việc sửa đề sau đó không làm thay đổi cách chấm bài đang làm hoặc đã nộp.
- Trạng thái: `IN_PROGRESS → SUBMITTED → COMPLETED` với bài khách quan (nếu lỗi chấm chuyển `GRADING_FAILED`); `IN_PROGRESS → SUBMITTED → AI_GRADING → COMPLETED` với bài có Writing (nếu hết quota AI chuyển `AI_GRADING_QUEUED`); `EXPIRED` khi attempt quá hạn được hệ thống tự động chốt bài.
- Hints chỉ dùng trong Practice Writing. Xem kết quả hoặc feedback không kích hoạt chấm lại.
- Khi chưa có quy đổi chứng chỉ, lưu điểm thô và thông tin đơn vị điểm. Không cộng điểm khách quan với điểm Writing để tạo một tổng điểm không có ý nghĩa.
- Các thay đổi schema cần thiết phải có migration và ghi rõ lý do, gồm snapshot đề, deadline, kiểm soát phiên bản đáp án và dữ liệu điều phối chấm Writing.
- Production dùng thông tin xác thực của TV1; fixture identity chỉ hoạt động trong profile dev/test.

### Phối hợp liên module

Mọi thay đổi nằm ngoài phạm vi code riêng của TV3 (ví dụ: `pom.xml`, `application.properties`, `docker-compose.yml`, `SecurityConfig.java` hoặc Entity/DTO của TV khác) đều **bắt buộc phải xin phép trưởng nhóm hoặc thành viên sở hữu trước khi thực hiện**. Trong dev/test, TV3 dùng fixture và mock; không tự ý sửa code chung để phục vụ module mình.

Nhóm API dự kiến, được mô tả chi tiết trong Sprint 00:

| API | Trách nhiệm |
|---|---|
| `POST /api/attempts` | Tạo phiên từ exam, scope và mode |
| `GET /api/attempts/{id}` | Khôi phục workspace và đáp án đã lưu |
| `PUT /api/attempts/{id}/answers` | Lưu nháp có kiểm soát phiên bản |
| `POST /api/attempts/{id}/submit` | Nộp bài thủ công hoặc do timeout |
| `POST /api/attempts/{id}/practice-check` | Kiểm tra câu khách quan trong Practice |
| `POST /api/attempts/{id}/writing-hints` | Gợi ý Writing trong Practice |
| `GET /api/attempts/{id}/result` | Xem điểm và lời giải |
| `GET /api/attempts/{id}/writing-feedback` | Đọc feedback đã lưu |
| `POST /api/attempts/{id}/writing-retry` | Yêu cầu thử lại phần AI đã lỗi, có giới hạn |

Đây là API được đề xuất bổ sung, chưa tồn tại trong source hiện tại.

## 3. Nội dung từng file sprint

### Milestone 00 — Đồng bộ Contract liên module (Trước Sprint 00)

**Mục tiêu:** Thống nhất các hợp đồng dữ liệu với TV1 và TV2 TRƯỚC khi TV3 tạo fixture, đảm bảo tích hợp Sprint 11 không bị lỗi format.  
**Đầu ra:** Tài liệu contract dùng chung trong `docs/contracts/`.

| ID | Hành động | Phối hợp với | Trạng thái |
|---|---|---|---|
| M00-01 | Thống nhất JSON schema `content_data` của `exam_parts`: danh sách loại câu hỏi (MCQ, Fill-in, Matching, T/F/NG, Essay…), format đáp án chuẩn `correct_answer`, format lời giải, audio URL convention. Ghi vào `docs/contracts/content-data-schema.md`. | **TV2** | TODO |
| M00-02 | Xác nhận cấu trúc Entity cây đề: `Exam`, `ExamSection`, `ExamPart` gồm các cột, kiểu dữ liệu, quan hệ FK. Đặc biệt xác nhận `duration_minutes` ở cấp nào (Section hay Part). | **TV2** | TODO |
| M00-03 | Xác nhận JWT token structure và cách lấy `userId` từ Spring Security Context. Xác nhận interface kiểm tra `subscription_tier` (FREE/PREMIUM). | **TV1** | TODO |
| M00-04 | Quyết định timezone convention toàn dự án: Thống nhất lưu UTC (`timestamptz` / `Instant` trong database & backend), API trả chuẩn ISO-8601 UTC (`...Z`), Frontend tự format theo Local Time. | **Toàn nhóm** | DONE |
| M00-05 | Xác nhận interface đọc `user_quotas` để kiểm tra hạn mức AI. Bảng `user_quotas` do TV4 sở hữu. | **TV4** | TODO |

**Kết thúc milestone:** Có ít nhất file `docs/contracts/content-data-schema.md` được TV2 xác nhận. Các quyết định M00-03, M00-04, M00-05 được ghi nhận (có thể trong file này hoặc meeting notes).

---

### Sprint 00 — Nền tảng và contract

**File:** `docs/ndt/00-foundation-and-contracts.md`  
**Đầu ra:** môi trường phát triển rõ ràng, contract TV3 và bộ fixture thống nhất.  
**Phụ thuộc:** Milestone 00 (ít nhất M00-01 phải DONE).

| ID | Task nhỏ và tiêu chí nghiệm thu |
|---|---|
| S00-01 | Ghi baseline build, cấu hình và thay đổi hiện có; xác định phần nào chưa được kiểm thử. |
| S00-02 | ⚠️ **CẦN XIN PHÉP NHÓM** — Hợp nhất khai báo Maven plugin trùng trong `pom.xml`, bảo toàn cấu hình đang có; backend compile không còn cảnh báo trùng plugin. |
| S00-03 | ⚠️ **CẦN XIN PHÉP NHÓM** — Tách cấu hình database theo môi trường (thêm `application-dev.properties`, `application-test.properties`); chạy local với PostgreSQL ở đúng cổng Compose cung cấp. |
| S00-04 | ⚠️ **CẦN XIN PHÉP NHÓM** — Thống nhất timezone cho dữ liệu thời gian theo quyết định M00-04; có kiểm tra round-trip thời gian qua API. |
| S00-05 | Viết contract cây đề và danh sách loại câu hỏi **dựa trên kết quả M00-01**; ghi rõ cách chuẩn hóa ESSAY/WRITING_ESSAY và audio. |
| S00-06 | Viết contract câu trả lời, flags và thống kê; có ví dụ câu đúng, sai, bỏ trống và chọn nhiều đáp án. |
| S00-07 | Viết contract API, response lỗi và ownership; xác định rõ trường client được gửi. |
| S00-08 | Viết bảng chuyển trạng thái (bổ sung trạng thái trung gian `SUBMITTED`, lỗi chấm `GRADING_FAILED`, quá hạn `EXPIRED`, hàng đợi AI `AI_GRADING_QUEUED`), quy tắc timer và điểm; ghi nhận điểm khác biệt giữa tài liệu và diagram hiện có. |
| S00-09 | Tạo fixture Reading hợp lệ và fixture có lỗi cấu trúc để kiểm thử validation. Fixture phải tuân theo schema M00-01. |
| S00-10 | Tạo fixture Listening và Writing, gồm thời lượng Part và các định dạng media cần dùng. Fixture phải tuân theo schema M00-01. |
| S00-11 | Thiết lập unit/component test frontend; một test mẫu chạy được trong lệnh kiểm tra. |
| S00-12 | Thiết lập integration test PostgreSQL độc lập bằng Testcontainers; không sử dụng database làm việc của thành viên. |
| S00-13 | Xác định package structure riêng cho TV3: Backend đặt trong `com.multilingo.backend.exam.*` (hoặc tương đương), Frontend đặt trong `src/features/exam/*`. Tạo thư mục và README mô tả cấu trúc. |

**Kết thúc sprint:** contract có ví dụ request/response, fixture dùng thống nhất cho frontend và backend, môi trường test chạy độc lập.

### Sprint 01 — Lưu trữ và khởi tạo phiên thi

**File:** `docs/ndt/01-attempt-persistence-and-start.md`  
**Đầu ra:** tạo và đọc lại một attempt từ backend.  
**Phụ thuộc:** Sprint 00.

| ID | Task nhỏ và tiêu chí nghiệm thu |
|---|---|
| S01-01 | Thiết lập migration có phiên bản; database mới tạo được schema TV3 theo thứ tự phụ thuộc. |
| S01-02 | Tạo migration test_attempts, gồm deadline, snapshot đề và version; ghi rõ phần bổ sung so với tài liệu. |
| S01-03 | Tạo migration attempt_answers; bảo đảm mỗi attempt chỉ có một bản ghi cho mỗi Part. |
| S01-04 | Ánh xạ entity và enum của attempt; lưu/đọc đủ ba scope và hai mode. |
| S01-05 | Ánh xạ JSONB của đáp án; kiểm thử round-trip Unicode và câu chọn nhiều đáp án. |
| S01-06 | Tạo adapter lấy người dùng hiện tại; không nhận userId từ request nghiệp vụ. |
| S01-07 | Tạo adapter đọc cây đề; fixture dev/test và nguồn dữ liệu thật tuân theo cùng contract. |
| S01-08 | Validate đề, scope và quan hệ Section/Part; chặn Part nằm ngoài đề đã chọn. |
| S01-09 | Tạo snapshot server-side cho attempt; sửa fixture gốc không làm thay đổi snapshot. |
| S01-10 | Tính deadline từ cấu hình đề; Practice không có deadline, Mock thiếu thời lượng bị từ chối rõ ràng. |
| S01-11 | Implement API tạo attempt và DTO workspace an toàn; bổ sung `serverTime` (UTC ISO-8601), `deadline` và trạng thái `EXPIRED`; response không có answer key hoặc lời giải. |
| S01-12 | Implement API đọc attempt; bổ sung `serverTime`, `deadline`, trạng thái `SUBMITTED`/`EXPIRED`; test người dùng khác, ID không tồn tại và attempt đã nộp. |

**Kết thúc sprint:** start/read hoạt động với PostgreSQL test; kiểm thử ownership và chống lộ đáp án đạt.

### Sprint 02 — Workspace và nhập đáp án

**File:** `docs/ndt/02-exam-workspace.md`  
**Đầu ra:** frontend hiển thị đề từ API và nhập được các loại đáp án.  
**Phụ thuộc:** Sprint 01.

| ID | Task nhỏ và tiêu chí nghiệm thu |
|---|---|
| S02-01 | Tạo route khởi tạo theo examId và route làm bài theo attemptId; không dùng hai loại ID thay thế nhau. |
| S02-02 | Tạo màn hình chọn scope/mode; danh sách Section/Part lấy từ contract đề. |
| S02-03 | Tạo API client và TypeScript types cho attempt; dùng cấu hình API URL hiện có. |
| S02-04 | Tạo state đáp án theo attempt/Part/question; đổi câu không làm mất câu trả lời. |
| S02-05 | Tạo khung workspace, loading, lỗi tải và thao tác thử lại. |
| S02-06 | Render Reading và nội dung HTML đã làm sạch; kiểm thử nội dung chứa script bị chặn. |
| S02-07 | Tạo trình phát audio theo Part/group; chuyển Part dừng audio cũ và xử lý URL lỗi. |
| S02-08 | Tạo renderer chọn một đáp án, TRUE/FALSE/NOT GIVEN và YES/NO/NOT GIVEN. |
| S02-09 | Tạo renderer nhiều đáp án; state phản ánh đúng tập lựa chọn khi thêm hoặc bỏ chọn. |
| S02-10 | Tạo renderer điền từ, map và diagram labeling; đáp án ánh xạ đúng từng questionId. |
| S02-11 | Tạo renderer matching và editor Writing cơ bản; dữ liệu trả về đúng kiểu đã định nghĩa. |
| S02-12 | Tạo bảng điều hướng câu hỏi với trạng thái đã trả lời/bỏ trống; kiểm thử chuyển Section/Part và bàn phím. |

**Kết thúc sprint:** làm được đề fixture đầy đủ trên frontend; không còn câu hỏi hoặc đáp án đúng hard-code trong workspace.

### Sprint 03 — Lưu nháp và khôi phục bài làm

**File:** `docs/ndt/03-autosave-and-resume.md`  
**Đầu ra:** tải lại trang vẫn khôi phục được đáp án đã lưu.  
**Phụ thuộc:** Sprint 02.

| ID | Task nhỏ và tiêu chí nghiệm thu |
|---|---|
| S03-01 | Validate payload lưu nháp; từ chối câu và Part không thuộc snapshot của attempt. |
| S03-02 | Implement lưu nháp theo transaction; lỗi một phần không tạo trạng thái lưu dang dở. |
| S03-03 | Thêm kiểm soát version; request cũ không ghi đè đáp án mới hơn. |
| S03-04 | Bổ sung đáp án và version vào API khôi phục workspace. |
| S03-05 | Tạo autosave theo cấu hình, chu kỳ mặc định 15 giây kèm dirty-flag (chỉ gửi khi có thay đổi); thêm cơ chế flush trước deadline (khi còn < 30s) và gửi qua `navigator.sendBeacon` khi sự kiện `visibilitychange` (rời trang/ẩn tab). |
| S03-06 | Chỉ gửi khi dữ liệu thay đổi; tuần tự hóa request để tránh chồng lượt lưu; autosave tự kiểm tra deadline và dừng ngay khi nhận mã 409 (bài đã nộp/quá hạn). |
| S03-07 | Hiển thị trạng thái đang lưu, đã lưu và chưa lưu được. |
| S03-08 | Giữ đáp án trong phiên khi mất mạng và thử lưu lại khi kết nối phục hồi. |
| S03-09 | Xử lý xung đột nhiều tab bằng thông báo và đồng bộ lại; không tự ghi đè âm thầm. |
| S03-10 | Kiểm thử reload, response đến muộn, lỗi mạng và request lưu nháp sau khi attempt đã kết thúc. |

**Kết thúc sprint:** đáp án đã được server xác nhận tồn tại sau reload; UI không báo “đã lưu” khi request thất bại.

### Sprint 04 — Chấm điểm khách quan

**File:** `docs/ndt/04-objective-grading.md`  
**Đầu ra:** bộ chấm Reading/Listening có test độc lập và điểm thô chính xác.  
**Phụ thuộc:** Sprint 01; dùng fixture Sprint 00.

| ID | Task nhỏ và tiêu chí nghiệm thu |
|---|---|
| S04-01 | Định nghĩa kết quả chấm của một câu: đúng, sai, bỏ trống và điểm thô. |
| S04-02 | Implement chuẩn hóa văn bản theo loại câu; trim và xử lý hoa/thường không làm mất dấu tiếng Việt. |
| S04-03 | Implement chấm chọn một đáp án; đối chiếu định danh đáp án thay vì chuỗi hiển thị tùy ý. |
| S04-04 | Implement chấm TRUE/FALSE/NOT GIVEN và YES/NO/NOT GIVEN theo token chuẩn. |
| S04-05 | Implement chấm điền từ/labeling, gồm các đáp án thay thế được contract cho phép. |
| S04-06 | Implement chấm nhiều đáp án bằng so sánh tập hợp; chọn thiếu hoặc thừa không được điểm câu đó. |
| S04-07 | Implement chấm matching theo từng câu; kiểm thử nhầm cặp và câu bỏ trống. |
| S04-08 | Tổng hợp flags, số câu đúng/tổng và skill_stats; không đếm Writing là câu khách quan sai. |
| S04-09 | Lưu điểm và đơn vị điểm nhất quán; không tự quy đổi ra band hoặc trộn thang điểm. |
| S04-10 | Tạo bộ test tham số hóa cho tất cả loại câu; dữ liệu đề lỗi bị báo lỗi thay vì âm thầm chấm 0. |

**Kết thúc sprint:** cùng input và snapshot luôn cho cùng kết quả; không phụ thuộc UI hoặc Gemini.

### Sprint 05 — Timer và nộp bài

**File:** `docs/ndt/05-timer-and-submission.md`  
**Đầu ra:** nộp bài thủ công và tự thu bài dùng chung một luồng đáng tin cậy.  
**Phụ thuộc:** Sprint 03 và Sprint 04.

| ID | Task nhỏ và tiêu chí nghiệm thu |
|---|---|
| S05-01 | Tạo submit service cho pha đóng bài (Finalize Attempt): nhận `finalAnswers`, `baseVersion`, `reason` (`MANUAL` / `TIMEOUT_CLIENT` / `TIMEOUT_SERVER`), chuyển trạng thái `SUBMITTED`. Việc chấm điểm tách sang task riêng. |
| S05-02 | Tách đóng bài và chấm điểm thành hai pha riêng biệt: pha chấm điểm chạy sau khi đóng bài; lỗi chấm điểm chuyển trạng thái `GRADING_FAILED`, không làm mất hoặc rollback trạng thái bài đã đóng (`SUBMITTED`). |
| S05-03 | Khóa và cập nhật attempt trong transaction: dùng `SELECT ... FOR UPDATE`, xử lý idempotency, hai request submit song song chỉ tạo một kết quả, request lặp trả kết quả đã chốt. |
| S05-04 | Cố định `end_time = min(now, deadline)`: bảo đảm `end_time` không bao giờ vượt deadline; đóng băng dữ liệu đáp án cuối cùng. |
| S05-05 | Điều phối trạng thái kết quả và job Writing: tạo job chấm Writing trong cùng transaction đóng bài (không tạo sau commit); nếu hết quota AI, vẫn hoàn tất đóng bài và chấm khách quan, phần Writing chuyển `AI_GRADING_QUEUED` để retry sau; bài thuần khách quan chuyển `COMPLETED`. |
| S05-06 | Cấu hình Grace Window (15 giây) cho submit do timeout: chỉ chấp nhận cho request submit có `reason=TIMEOUT_CLIENT` (trong vòng `deadline + 15s`) để nhận payload cuối; autosave thường sau deadline lập tức bị từ chối. |
| S05-07 | Cơ chế Lazy Finalize cho attempt quá hạn: `GET /attempts/{id}` và `/result` phát hiện attempt `IN_PROGRESS` có `now > deadline` thì tự động finalize ngay và trả trạng thái `EXPIRED` (hoặc `SUBMITTED`), ngăn học viên reload gõ tiếp trước khi cron chạy. |
| S05-08 | Tạo countdown phía frontend dựa trên deadline/server time: lấy `serverTime` khi tải attempt, tính `offset = serverTime - Date.now()` một lần, tính thời gian còn lại từ `deadline` ở mỗi tick (không trừ dần), tự động tính lại khi có sự kiện `visibilitychange`. |
| S05-09 | Tạo hộp xác nhận nộp bài thủ công: hiển thị số câu đã làm / bỏ trống, cảnh báo câu chưa hoàn thành, chặn double-click và hiển thị loading state. |
| S05-10 | Tự động nộp bài khi hết giờ và UX phục hồi lỗi: khi countdown về 0, khóa toàn bộ nhập liệu, hiển thị overlay "Hết giờ! Đang nộp bài...", gửi submit kèm `reason=TIMEOUT_CLIENT`; nếu lỗi mạng có cơ chế retry với backoff, nút "Thử nộp lại"; nếu backend đã chốt bài thì tự chuyển sang trang kết quả. |
| S05-11 | Phân xử autosave và submit: endpoint autosave tự kiểm tra deadline (chặn sau deadline, không phụ thuộc cron); autosave sau khi bài đã nộp hoặc quá hạn trả về HTTP 409 với mã lỗi riêng (`ATTEMPT_ALREADY_SUBMITTED` / `ATTEMPT_EXPIRED`) để frontend dừng timer autosave. |
| S05-12 | ⚠️ **CẦN XIN PHÉP NHÓM** — Background scheduler quét attempt quá hạn (Cron finalize): cấu hình `@Scheduled` định kỳ quét các attempt `IN_PROGRESS` có `deadline + 15s < now`, sử dụng `SELECT FOR UPDATE SKIP LOCKED`, xử lý theo batch kèm index `(status, deadline)`, gọi submit service với `reason=TIMEOUT_SERVER`. |
| S05-13 | Test backend đồng thời và deadline: kiểm thử 2 request submit đồng thời, nộp tay song song timeout server, autosave muộn sau submit, nộp trong grace window vs sau grace window. |
| S05-14 | Test frontend countdown và fake timers: component/unit test đếm ngược với fake timers, bù `offset`, sự kiện tab ẩn/hiện (`visibilitychange`), tự động khóa form và overlay retry. |
| S05-15 | Test E2E mất mạng, đóng trình duyệt và Practice: kiểm thử mất mạng lúc hết giờ, đóng trình duyệt / reload sau deadline (lazy finalize kích hoạt), Practice không có timer / không tự hết giờ. |

**Mặc định về quá hạn:** server là nguồn thời gian chuẩn; deadline cứng cho mọi thao tác sửa bài và autosave thường; riêng request submit `reason=TIMEOUT_CLIENT` được chấp nhận trong grace window cấu hình (15 giây), chỉ để nhận payload cuối. Đáp án đến sau grace window hoặc autosave sau deadline bị từ chối với HTTP 409 (`ATTEMPT_EXPIRED`). Attempt quá hạn mà client không gửi submit sẽ được server chốt tự động qua Lazy Finalize (khi reload/truy cập lại) hoặc Background Scheduler định kỳ (`reason=TIMEOUT_SERVER`). UI phải thể hiện rõ overlay và trạng thái nộp bài để học viên yên tâm bài làm đã được ghi nhận.

**Kết thúc sprint:** bài khách quan có thể làm → nộp → lưu điểm (hoặc `GRADING_FAILED` nếu lỗi); bài Writing được lưu và chuyển `AI_GRADING` / `AI_GRADING_QUEUED` chờ pipeline AI của Sprint 09.

### Sprint 06 — Kết quả và lời giải khách quan

**File:** `docs/ndt/06-objective-results.md`  
**Đầu ra:** xem điểm và chữa bài từ dữ liệu thật.  
**Phụ thuộc:** Sprint 05.

| ID | Task nhỏ và tiêu chí nghiệm thu |
|---|---|
| S06-01 | Implement truy vấn kết quả theo attemptId và chủ sở hữu. |
| S06-02 | Chặn lấy lời giải khi attempt còn IN_PROGRESS hoặc không thuộc người dùng. |
| S06-03 | Tạo Result DTO từ snapshot và kết quả đã lưu; không phụ thuộc bản đề đã bị chỉnh sửa. |
| S06-04 | Tạo trang kết quả với số câu đúng/tổng, tỷ lệ và thời gian làm bài. |
| S06-05 | Tạo danh sách câu đúng, sai, bỏ trống với màu và nhãn văn bản tương ứng. |
| S06-06 | Tạo phần xem đáp án đã chọn và đáp án chuẩn của một câu. |
| S06-07 | Hiển thị lời giải và bản dịch khi dữ liệu đề có; không tạo nội dung dịch giả. |
| S06-08 | Thể hiện phần khách quan đã có kết quả và Writing còn chờ riêng biệt. |
| S06-09 | Test deep link, refresh, ID sai, khác chủ sở hữu và đề gốc bị sửa sau khi nộp. |

**Kết thúc sprint:** mọi con số trên trang kết quả truy được về dữ liệu backend; không còn điểm mẫu 6.5 hoặc tỷ lệ mẫu.

### Sprint 07 — Practice và Highlight

**File:** `docs/ndt/07-practice-and-highlighting.md`  
**Đầu ra:** luyện tập có phản hồi từng câu; Reading có highlight local.  
**Phụ thuộc:** Sprint 06.

| ID | Task nhỏ và tiêu chí nghiệm thu |
|---|---|
| S07-01 | Implement API kiểm tra một câu Practice; xác minh ownership, mode và câu thuộc attempt. |
| S07-02 | Tái sử dụng bộ chấm khách quan; phản hồi chỉ chứa thông tin của câu được kiểm tra. |
| S07-03 | Tạo thao tác kiểm tra câu trên UI; đáp án đang nhập dở không tự gửi liên tục. |
| S07-04 | Hiển thị đúng/sai và lời giải sau khi kiểm tra; Mock Test không gọi được API này. |
| S07-05 | Khi sửa đáp án, đánh dấu phản hồi cũ đã hết hiệu lực và cho kiểm tra lại. |
| S07-06 | Hoàn thiện kết thúc Practice và làm lại; làm lại từ kết quả tạo attempt mới. |
| S07-07 | Bắt vùng chọn hợp lệ trong Reading; không nhận vùng chọn ngoài bài đọc. |
| S07-08 | Lưu offset highlight trong state và render mark qua React; không sửa DOM gây lệch state. |
| S07-09 | Xử lý vùng chọn trùng/chồng nhau và chuyển Part; highlight không bị gán sang bài khác. |
| S07-10 | Test Highlight không gọi API; định nghĩa callback tích hợp từ điển cho TV5 nhưng chưa triển khai từ điển. |

**Kết thúc sprint:** hoàn thành UC08 phần Practice và UC08.1. Highlight tồn tại trong phiên workspace, không cam kết lưu qua reload.

### Sprint 08 — Writing Editor và AI Hints

**File:** `docs/ndt/08-writing-editor-and-hints.md`  
**Đầu ra:** học viên viết bài và nhận dàn ý, từ vựng từ Gemini.  
**Phụ thuộc:** Sprint 07.  
**Lưu ý dependency:** Sprint này cần thêm Gemini SDK dependency vào `pom.xml` (ví dụ `google-cloud-vertexai` hoặc Google AI Java SDK). Đây là file dùng chung — ⚠️ **CẦN XIN PHÉP NHÓM** trước khi thêm.

| ID | Task nhỏ và tiêu chí nghiệm thu |
|---|---|
| S08-01 | Hoàn thiện editor Writing với word count; nội dung dùng chung cơ chế lưu nháp. |
| S08-02 | ⚠️ **CẦN XIN PHÉP NHÓM** — Thêm Gemini SDK dependency vào `pom.xml`. Tạo cấu hình Gemini ở backend; API key không xuất hiện trong bundle frontend hoặc log. |
| S08-03 | Tạo Gemini client với model cấu hình được, timeout và giới hạn kích thước phản hồi. |
| S08-04 | Tạo prompt Hints lấy đề từ snapshot; yêu cầu dàn ý và 5–10 từ vựng. |
| S08-05 | Tạo DTO/parser Hints; phản hồi sai cấu trúc bị từ chối có kiểm soát. |
| S08-06 | Implement API Hints chỉ cho Practice Writing còn hoạt động và đúng chủ sở hữu. |
| S08-07 | Tạo điểm tích hợp entitlement/quota với TV1 (theo kết quả M00-05); fixture chỉ hoạt động trong dev/test. |
| S08-08 | Tạo sidebar Hints với trạng thái tải, thành công, hết hạn mức và lỗi dịch vụ. |
| S08-09 | Xử lý thử lại có giới hạn; lỗi Hints không làm mất nội dung bài viết. |
| S08-10 | Test bằng Gemini giả lập; xác nhận Hints không ghi vào ai_feedback chấm bài. |

**Kết thúc sprint:** pipeline Hints chạy từ UI qua backend; model khả dụng được xác minh khi cấu hình tích hợp thật.

### Sprint 09 — Chấm Writing bất đồng bộ

**File:** `docs/ndt/09-writing-ai-grading.md`  
**Đầu ra:** Writing đã nộp được chấm, lưu feedback và phục hồi được sau lỗi.  
**Phụ thuộc:** Sprint 08.

| ID | Task nhỏ và tiêu chí nghiệm thu |
|---|---|
| S09-01 | Định nghĩa schema feedback: bốn tiêu chí, nhận xét, đoạn gốc và đề xuất sửa. |
| S09-02 | Viết prompt chấm, tách đề bài và nội dung học viên; yêu cầu phản hồi đúng schema. |
| S09-03 | Thêm bảng điều phối job Writing bằng migration; job gắn với bài Writing và có khóa chống tạo trùng. |
| S09-04 | Tạo job sau khi bài nộp được commit; bổ sung cơ chế tìm lại bài chờ chưa có job. |
| S09-05 | Implement worker nhận job bằng claim/lease; gọi Gemini ngoài transaction database. |
| S09-06 | Validate phản hồi: trường bắt buộc, điểm trong miền cho phép và nội dung sửa hợp lệ. |
| S09-07 | Lưu feedback của từng bài Writing theo transaction; phản hồi lỗi không ghi đè feedback hợp lệ. |
| S09-08 | Tổng hợp trạng thái attempt; chỉ COMPLETED khi mọi phần Writing đã xử lý xong. |
| S09-09 | Implement retry tự động tối đa ba lần tổng cộng, có backoff; lỗi cấu hình không retry vô hạn. |
| S09-10 | Implement retry thủ công cho job đã lỗi, có cooldown; không chấm lại bài đã thành công. |
| S09-11 | Phục hồi job khi backend restart; job hết lease được xử lý lại mà không lưu trùng hoặc tính quota trùng. |
| S09-12 | Test timeout, rate limit, JSON lỗi, hai worker và một trong nhiều bài Writing bị lỗi. |

**Chính sách kết quả:** điểm Writing là đánh giá tham khảo theo rubric đã cấu hình. Không tự gắn thang IELTS cho mọi chứng chỉ. Bài Writing bỏ trống được xử lý xác định với thông báo “không có bài viết”, không gọi Gemini để tạo nhận xét giả.

**Kết thúc sprint:** lỗi hết retry được hiển thị là “chưa chấm được”, thay vì để UI báo “đang chấm” vô thời hạn. Attempt chưa đủ kết quả vẫn giữ AI_GRADING.

### Sprint 10 — AI Feedback và Diff-View

**File:** `docs/ndt/10-writing-feedback-and-diff.md`  
**Đầu ra:** xem rubric và so sánh bài gốc với đề xuất sửa.  
**Phụ thuộc:** Sprint 09.

| ID | Task nhỏ và tiêu chí nghiệm thu |
|---|---|
| S10-01 | Implement API feedback đọc bài gốc và feedback đã lưu, kiểm tra ownership. |
| S10-02 | Tạo response phân biệt chờ, đang chấm, lỗi và đã có feedback. |
| S10-03 | Tạo tab Writing trong trang kết quả và chọn đúng bài Writing cần xem. |
| S10-04 | Render bốn tiêu chí và nhận xét; không hiển thị số điểm mẫu khi chưa có kết quả. |
| S10-05 | Tạo hàm diff cho bài gốc/đề xuất; test thêm, xóa, thay thế và tiếng Việt có dấu. |
| S10-06 | Render đoạn cần sửa màu đỏ, đề xuất màu xanh và gạch chân; có nhãn hỗ trợ người khó phân biệt màu. |
| S10-07 | Render nội dung AI dưới dạng văn bản an toàn; không thực thi HTML từ phản hồi. |
| S10-08 | Poll trạng thái có giới hạn, dừng khi hoàn tất/lỗi/unmount; nút retry chỉ xuất hiện đúng trạng thái. |
| S10-09 | Test reload trang feedback và chuyển bài; GET feedback không tạo thêm lời gọi Gemini. |

**Kết thúc sprint:** hoàn thành UC10.2; Diff-View tái dựng hoàn toàn từ dữ liệu đã lưu.

### Sprint 11 — Tích hợp thật và nghiệm thu TV3

**File:** `docs/ndt/11-integration-and-acceptance.md`  
**Đầu ra:** luồng TV3 hoạt động với hệ thống thật và có bằng chứng nghiệm thu.  
**Phụ thuộc:** Sprint 00–10; contract thực tế từ TV1 và TV2.

| ID | Task nhỏ và tiêu chí nghiệm thu |
|---|---|
| S11-01 | Thay fixture identity bằng xác thực TV1; test token thiếu/hết hạn và truy cập attempt người khác. |
| S11-02 | Kết nối entitlement/quota thật; không còn quyết định quyền dựa trên dữ liệu client. |
| S11-03 | Kết nối cây đề TV2, gồm thời lượng Part; test đề chưa xuất bản, JSON không hợp lệ và media lỗi. |
| S11-04 | Kiểm tra thứ tự migration, khóa ngoại và dữ liệu cũ; không tự xóa dữ liệu demo không tương thích. |
| S11-05 | Giới hạn API demo trả raw ExamPart vào môi trường phù hợp; kiểm tra không có đường vòng lộ answer key. |
| S11-06 | Hoàn thiện contract bàn giao kết quả/thời lượng cho TV4–TV5 và callback ngữ cảnh đọc cho TV5. |
| S11-07 | Tạo E2E từ bắt đầu → làm bài → nộp → kết quả cho ba scope, Mock/Practice và các nhóm câu hỏi. |
| S11-08 | Tạo E2E Writing Hints → nộp bài → AI feedback → Diff-View, bao gồm nhánh Gemini lỗi và retry. |
| S11-09 | Chạy regression trong CI, kiểm tra route khi refresh và cấu hình môi trường; không tự deploy. |
| S11-10 | Hoàn thiện hướng dẫn chạy/demo, đối chiếu task–UC–test và ghi nhận mọi phụ thuộc chưa được bàn giao. |

**Kết thúc sprint:** toàn bộ tám use case TV3 có kịch bản demo và test tương ứng. Nếu TV1/TV2 chưa bàn giao, ghi rõ tích hợp bị BLOCKED; không nghiệm thu toàn bộ bằng fixture.

## 4. Kiểm thử và thứ tự triển khai

Triển khai lần lượt Sprint 00 → 11. Bộ chấm ở Sprint 04 có thể được phát triển ngay sau Sprint 01 nếu cần thay đổi thứ tự, nhưng submit chỉ nghiệm thu khi đã có cả lưu nháp và bộ chấm.

Các nhóm kiểm thử bắt buộc:

- **Backend:** unit test chuẩn hóa/chấm điểm; integration test PostgreSQL cho JSONB, transaction, ownership, deadline và nộp trùng.
- **Frontend:** component test renderer, state đáp án, autosave, countdown, Highlight và Diff-View.
- **Contract:** workspace không lộ đáp án; questionId và Part khớp snapshot; DTO frontend/backend thống nhất.
- **AI:** dùng phản hồi giả lập cho test tự động; smoke test Gemini thật là bước riêng, ghi rõ model và kết quả.
- **E2E:** Mock, Practice, ba scope, tải lại trang, mất mạng, hết giờ, nộp đồng thời và AI chấm lỗi.

Bộ tài liệu cuối cùng gồm **1 Milestone + 12 Sprint, ~132 task**, với checklist, phụ thuộc và nghiệm thu theo từng sprint. Sau khi kế hoạch được duyệt, triển khai từng sprint và đối chiếu đầu ra trước khi chuyển sang sprint tiếp theo.

## 5. Danh sách task cần xin phép nhóm trước khi thực hiện

Các task dưới đây can thiệp vào file/cấu hình dùng chung cho toàn bộ dự án. TV3 **KHÔNG được tự ý thực hiện** mà phải được sự đồng ý của trưởng nhóm hoặc thành viên sở hữu file.

| Task | Nội dung | File bị ảnh hưởng |
|---|---|---|
| S00-02 | Gộp Maven plugin trùng | `backend/pom.xml` |
| S00-03 | Tách profile database | `backend/src/main/resources/application.properties` |
| S00-04 | Timezone convention | `docker-compose.yml`, `pom.xml` (JVM args) |
| S05-12 | Cấu hình `@EnableScheduling` / ShedLock cho cron quét timeout | `backend/pom.xml`, class cấu hình `SchedulingConfig.java` |
| S08-02 | Thêm Gemini SDK dependency | `backend/pom.xml` |
