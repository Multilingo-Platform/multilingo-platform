Theo dõi hành vi người dùng và đề thi

<img src=".\\srs-media/media/image1.png" style="width:6.26806in;height:4.56944in" />

<img src=".\\srs-media/media/image2.png" style="width:6.26806in;height:5.85in" />

<img src=".\\srs-media/media/image3.png" style="width:6.26806in;height:5.32569in" />

<table>
<colgroup>
<col style="width: 17%" />
<col style="width: 27%" />
<col style="width: 28%" />
<col style="width: 26%" />
</colgroup>
<thead>
<tr>
<th style="text-align: center;"><strong>Mã Use case</strong></th>
<th style="text-align: center;">A_Tracking</th>
<th style="text-align: center;"><strong>Tên Use case</strong></th>
<th style="text-align: center;">Theo dõi hành vi người dùng và Đề thi</th>
</tr>
</thead>
<tbody>
<tr>
<td style="text-align: center;"><strong>Tác nhân</strong></td>
<td colspan="3" style="text-align: center;">Quản trị viên</td>
</tr>
<tr>
<td style="text-align: center;"><strong>Sự kiện kích hoạt</strong></td>
<td colspan="3" style="text-align: left;">Quản trị viên truy cập vào phân hệ Theo dõi và Phân tích để yêu cầu xem báo cáo.</td>
</tr>
<tr>
<td style="text-align: center;"><strong>Tiền điều kiện</strong></td>
<td colspan="3" style="text-align: left;">Quản trị viên đã đăng nhập thành công vào hệ thống và được cấp quyền xem báo cáo.</td>
</tr>
<tr>
<td style="text-align: center;"><p><strong>Luồng sự kiện chính</strong></p>
<p><strong>(Thành công)</strong></p></td>
<td colspan="3"><table style="width:84%;">
<colgroup>
<col style="width: 9%" />
<col style="width: 19%" />
<col style="width: 54%" />
</colgroup>
<thead>
<tr>
<th style="text-align: center;"><strong>STT</strong></th>
<th style="text-align: center;"><strong>Thực hiện bởi</strong></th>
<th style="text-align: center;"><strong>Hành động</strong></th>
</tr>
</thead>
<tbody>
<tr>
<td style="text-align: center;">1</td>
<td style="text-align: left;">Quản trị viên</td>
<td>Truy cập vào phân hệ Theo dõi và Phân tích.</td>
</tr>
<tr>
<td style="text-align: center;">2</td>
<td style="text-align: left;">Quản trị viên</td>
<td>Chọn loại báo cáo cần theo dõi (Rẽ nhánh: Chọn xem theo Học viên).</td>
</tr>
<tr>
<td style="text-align: center;">3</td>
<td style="text-align: left;">Quản trị viên</td>
<td>Nhập địa chỉ Email hoặc Mã định danh (ID) của học viên cụ thể cần tra cứu.</td>
</tr>
<tr>
<td style="text-align: center;">4</td>
<td style="text-align: left;">Hệ thống</td>
<td>Tiếp nhận yêu cầu, truy xuất cơ sở dữ liệu để tổng hợp hồ sơ tiến trình học tập (bao gồm lịch sử làm bài, tổng thời gian học, thiết bị và địa chỉ mạng đã đăng nhập).</td>
</tr>
<tr>
<td style="text-align: center;">5</td>
<td style="text-align: left;">Hệ thống</td>
<td>Hiển thị bảng chi tiết tiến trình học của học viên lên màn hình.</td>
</tr>
<tr>
<td style="text-align: center;">6</td>
<td style="text-align: left;">Quản trị viên</td>
<td>Đọc phân tích báo cáo và thao tác xuất dữ liệu (nếu cần).</td>
</tr>
</tbody>
</table></td>
</tr>
<tr>
<td style="text-align: center;"><strong>Luồng sự kiện thay thế</strong></td>
<td colspan="3"><table style="width:84%;">
<colgroup>
<col style="width: 8%" />
<col style="width: 21%" />
<col style="width: 53%" />
</colgroup>
<thead>
<tr>
<th style="text-align: center;"><strong>STT</strong></th>
<th style="text-align: center;"><strong>Thực hiện bởi</strong></th>
<th style="text-align: center;"><strong>Hành động</strong></th>
</tr>
</thead>
<tbody>
<tr>
<td style="text-align: center;">2a</td>
<td>Quản trị viên</td>
<td>Chọn loại báo cáo cần theo dõi (Rẽ nhánh: Chọn xem theo Đề thi).</td>
</tr>
<tr>
<td style="text-align: center;">3a</td>
<td>Quản trị viên</td>
<td>Chọn một đề thi cụ thể hoặc yêu cầu xem thống kê toàn bộ kho đề.</td>
</tr>
<tr>
<td style="text-align: center;">4a</td>
<td>Hệ thống</td>
<td>Tính toán và tổng hợp dữ liệu thống kê của đề thi (tổng số lượt làm bài, điểm số trung bình, tỷ lệ hoàn thành).</td>
</tr>
<tr>
<td style="text-align: center;">5a</td>
<td>Hệ thống</td>
<td>Hiển thị bảng thống kê và biểu đồ hiệu quả của đề thi tương ứng. <em>(Sau bước này, luồng đi tiếp đến Bước 6 của luồng sự kiện chính).</em></td>
</tr>
<tr>
<td style="text-align: center;">3b</td>
<td>Hệ thống</td>
<td><em>(Trường hợp không có dữ liệu)</em>: Hiển thị thông báo lỗi không tìm thấy thông tin Học viên hoặc Đề thi, yêu cầu quản trị viên kiểm tra lại từ khóa tìm kiếm.</td>
</tr>
</tbody>
</table></td>
</tr>
<tr>
<td style="text-align: center;"><strong>Hậu điều kiện</strong></td>
<td colspan="3">Dữ liệu hành vi của học viên hoặc hiệu quả của kho đề thi được trích xuất và hiển thị chính xác để quản trị viên đối soát, đánh giá tình hình vận hành của nền tảng.</td>
</tr>
</tbody>
</table>

Quản trị người dùng tổng quan

<img src=".\\srs-media/media/image4.png" style="width:6.26806in;height:5.1375in" />

<img src=".\\srs-media/media/image5.png" style="width:6.26806in;height:5.24583in" />

<table>
<colgroup>
<col style="width: 17%" />
<col style="width: 27%" />
<col style="width: 28%" />
<col style="width: 26%" />
</colgroup>
<thead>
<tr>
<th style="text-align: center;"><strong>Mã Use case</strong></th>
<th style="text-align: center;">UC15</th>
<th style="text-align: center;"><strong>Tên Use case</strong></th>
<th style="text-align: center;">Quản trị Người dùng Tổng quan</th>
</tr>
</thead>
<tbody>
<tr>
<td style="text-align: center;"><strong>Tác nhân</strong></td>
<td colspan="3" style="text-align: center;">Quản trị viên</td>
</tr>
<tr>
<td style="text-align: center;"><strong>Sự kiện kích hoạt</strong></td>
<td colspan="3" style="text-align: left;">Quản trị viên truy cập vào phân hệ Quản lý người dùng để tra cứu danh sách hoặc xem chi tiết tài khoản học viên.</td>
</tr>
<tr>
<td style="text-align: center;"><strong>Tiền điều kiện</strong></td>
<td colspan="3" style="text-align: left;">Quản trị viên đã đăng nhập thành công vào hệ thống và được cấp quyền quản trị người dùng.</td>
</tr>
<tr>
<td style="text-align: center;"><p><strong>Luồng sự kiện chính</strong></p>
<p><strong>(Thành công)</strong></p></td>
<td colspan="3"><table style="width:84%;">
<colgroup>
<col style="width: 9%" />
<col style="width: 19%" />
<col style="width: 54%" />
</colgroup>
<thead>
<tr>
<th style="text-align: center;"><strong>STT</strong></th>
<th style="text-align: center;"><strong>Thực hiện bởi</strong></th>
<th style="text-align: center;"><strong>Hành động</strong></th>
</tr>
</thead>
<tbody>
<tr>
<td style="text-align: center;">1</td>
<td style="text-align: left;">Quản trị viên</td>
<td>Truy cập vào phân hệ Quản lý người dùng.</td>
</tr>
<tr>
<td style="text-align: center;">2</td>
<td style="text-align: left;">Hệ thống</td>
<td>Truy vấn danh sách tài khoản (phân trang).</td>
</tr>
<tr>
<td style="text-align: center;">3</td>
<td style="text-align: left;">Hệ thống</td>
<td>Hiển thị danh sách người dùng tổng quan.</td>
</tr>
<tr>
<td style="text-align: center;">4</td>
<td style="text-align: left;">Quản trị viên</td>
<td>Xem danh sách và chọn thao tác (Rẽ nhánh: Chọn Lọc / Tìm kiếm).</td>
</tr>
<tr>
<td style="text-align: center;">5</td>
<td style="text-align: left;">Quản trị viên</td>
<td>Nhập Email hoặc chọn bộ lọc (Trạng thái, Hạng VIP).</td>
</tr>
<tr>
<td style="text-align: center;">6</td>
<td style="text-align: left;">Hệ thống</td>
<td>Truy vấn dữ liệu theo điều kiện lọc.</td>
</tr>
<tr>
<td style="text-align: center;">7</td>
<td style="text-align: left;">Hệ thống</td>
<td>Cập nhật và hiển thị danh sách đã lọc</td>
</tr>
<tr>
<td style="text-align: center;">8</td>
<td style="text-align: left;">Quản trị viên</td>
<td>Tiếp tục quản trị hoặc kết thúc.</td>
</tr>
</tbody>
</table></td>
</tr>
<tr>
<td style="text-align: center;"><strong>Luồng sự kiện thay thế</strong></td>
<td colspan="3"><table style="width:84%;">
<colgroup>
<col style="width: 8%" />
<col style="width: 21%" />
<col style="width: 53%" />
</colgroup>
<thead>
<tr>
<th style="text-align: center;"><strong>STT</strong></th>
<th style="text-align: center;"><strong>Thực hiện bởi</strong></th>
<th style="text-align: center;"><strong>Hành động</strong></th>
</tr>
</thead>
<tbody>
<tr>
<td style="text-align: center;">4a</td>
<td>Quản trị viên</td>
<td>Xem danh sách và chọn thao tác (Rẽ nhánh: Chọn Xem chi tiết)</td>
</tr>
<tr>
<td style="text-align: center;">5a</td>
<td>Quản trị viên</td>
<td>Chọn một tài khoản cụ thể trong danh sách.</td>
</tr>
<tr>
<td style="text-align: center;">6a</td>
<td>Hệ thống</td>
<td>Tổng hợp thông tin chi tiết (hồ sơ, gói cước, đăng nhập cuối).</td>
</tr>
<tr>
<td style="text-align: center;">7a</td>
<td>Hệ thống</td>
<td>Hiển thị giao diện chi tiết hồ sơ người dùng. <em>(Sau bước này, luồng đi tiếp đến Bước 8 của luồng sự kiện chính)</em>.</td>
</tr>
</tbody>
</table></td>
</tr>
<tr>
<td style="text-align: center;"><strong>Hậu điều kiện</strong></td>
<td colspan="3">Quản trị viên trích xuất được danh sách người dùng theo đúng bộ lọc hoặc xem được thông tin hồ sơ chi tiết một cách chính xác để phục vụ cho các thao tác quản trị tiếp theo (như Khóa/Mở khóa tài khoản).</td>
</tr>
</tbody>
</table>

Khoá / Mở khoá tài khoản học viên

<img src=".\\srs-media/media/image6.png" style="width:6.26806in;height:4.48194in" />

<img src=".\\srs-media/media/image7.png" style="width:6.26806in;height:4.91667in" />

<table>
<colgroup>
<col style="width: 17%" />
<col style="width: 27%" />
<col style="width: 28%" />
<col style="width: 26%" />
</colgroup>
<thead>
<tr>
<th style="text-align: center;"><strong>Mã Use case</strong></th>
<th style="text-align: center;">UC15.1</th>
<th style="text-align: center;"><strong>Tên Use case</strong></th>
<th style="text-align: center;">Khóa / Mở khóa tài khoản học viên</th>
</tr>
</thead>
<tbody>
<tr>
<td style="text-align: center;"><strong>Tác nhân</strong></td>
<td colspan="3" style="text-align: center;">Quản trị viên</td>
</tr>
<tr>
<td style="text-align: center;"><strong>Sự kiện kích hoạt</strong></td>
<td colspan="3" style="text-align: left;">Quản trị viên phát hiện tài khoản học viên có dấu hiệu vi phạm cần xử lý, hoặc có yêu cầu khôi phục lại tài khoản đã bị khóa trước đó.</td>
</tr>
<tr>
<td style="text-align: center;"><strong>Tiền điều kiện</strong></td>
<td colspan="3" style="text-align: left;">Quản trị viên đã đăng nhập thành công vào hệ thống, được phân quyền quản trị và đang truy cập vào trang hồ sơ của một học viên cụ thể.</td>
</tr>
<tr>
<td style="text-align: center;"><p><strong>Luồng sự kiện chính</strong></p>
<p><strong>(Thành công)</strong></p></td>
<td colspan="3"><table style="width:84%;">
<colgroup>
<col style="width: 9%" />
<col style="width: 19%" />
<col style="width: 54%" />
</colgroup>
<thead>
<tr>
<th style="text-align: center;"><strong>STT</strong></th>
<th style="text-align: center;"><strong>Thực hiện bởi</strong></th>
<th style="text-align: center;"><strong>Hành động</strong></th>
</tr>
</thead>
<tbody>
<tr>
<td style="text-align: center;">1</td>
<td style="text-align: left;">Quản trị viên</td>
<td>Truy cập hồ sơ tài khoản học viên.</td>
</tr>
<tr>
<td style="text-align: center;">2</td>
<td style="text-align: left;">Quản trị viên</td>
<td>Kiểm tra tình trạng (Rẽ nhánh: Đang hoạt động) <math display="inline" xmlns="http://www.w3.org/1998/Math/MathML"><semantics><mo>→</mo><annotation encoding="application/x-tex">\rightarrow</annotation></semantics></math> Bấm nút "Khóa tài khoản" (Nhập lý do khóa).</td>
</tr>
<tr>
<td style="text-align: center;">3</td>
<td style="text-align: left;">Hệ thống</td>
<td>Cập nhật bảng users (is_active = false).</td>
</tr>
<tr>
<td style="text-align: center;">4</td>
<td style="text-align: left;">Hệ thống</td>
<td>Hủy phiên làm việc trên Redis (is_revoked = true).</td>
</tr>
<tr>
<td style="text-align: center;">5</td>
<td style="text-align: left;">Hệ thống</td>
<td>Ép đăng xuất khỏi tất cả thiết bị.</td>
</tr>
<tr>
<td style="text-align: center;">6</td>
<td style="text-align: left;">Hệ thống</td>
<td>Hiển thị thông báo cập nhật thành công.</td>
</tr>
</tbody>
</table></td>
</tr>
<tr>
<td style="text-align: center;"><strong>Luồng sự kiện thay thế</strong></td>
<td colspan="3"><table style="width:84%;">
<colgroup>
<col style="width: 8%" />
<col style="width: 21%" />
<col style="width: 53%" />
</colgroup>
<thead>
<tr>
<th style="text-align: center;"><strong>STT</strong></th>
<th style="text-align: center;"><strong>Thực hiện bởi</strong></th>
<th style="text-align: center;"><strong>Hành động</strong></th>
</tr>
</thead>
<tbody>
<tr>
<td style="text-align: center;">2a</td>
<td>Quản trị viên</td>
<td>Kiểm tra tình trạng (Rẽ nhánh: Đang bị khóa) <math display="inline" xmlns="http://www.w3.org/1998/Math/MathML"><semantics><mo>→</mo><annotation encoding="application/x-tex">\rightarrow</annotation></semantics></math> Bấm nút "Mở khóa tài khoản".</td>
</tr>
<tr>
<td style="text-align: center;">3a</td>
<td>Hệ thống</td>
<td>Cập nhật bảng users (is_active = true).</td>
</tr>
<tr>
<td style="text-align: center;">4a</td>
<td>Hệ thống</td>
<td><em>(Luồng hội tụ)</em> Hiển thị thông báo cập nhật thành công. <em>(Đi thẳng đến điểm kết thúc giống bước 6 của luồng chính).</em></td>
</tr>
</tbody>
</table></td>
</tr>
<tr>
<td style="text-align: center;"><strong>Hậu điều kiện</strong></td>
<td colspan="3">Trạng thái tài khoản được cập nhật chính xác. Nếu khóa, học viên bị hủy phiên làm việc trên Redis và đuổi khỏi hệ thống lập tức; nếu mở khóa, học viên đăng nhập lại bình thường.</td>
</tr>
</tbody>
</table>

Cấu hình hạn mức quota sử dụng AI

<img src=".\\srs-media/media/image8.png" style="width:6.26806in;height:7.13472in" />

<img src=".\\srs-media/media/image9.png" style="width:6.26806in;height:8.84514in" />

<table>
<colgroup>
<col style="width: 17%" />
<col style="width: 27%" />
<col style="width: 28%" />
<col style="width: 26%" />
</colgroup>
<thead>
<tr>
<th style="text-align: center;"><strong>Mã Use case</strong></th>
<th style="text-align: center;">UC15.3</th>
<th style="text-align: center;"><strong>Tên Use case</strong></th>
<th style="text-align: center;">Cấu hình Hạn mức Quota sử dụng AI</th>
</tr>
</thead>
<tbody>
<tr>
<td style="text-align: center;"><strong>Tác nhân</strong></td>
<td colspan="3" style="text-align: center;">Quản trị viên</td>
</tr>
<tr>
<td style="text-align: center;"><strong>Sự kiện kích hoạt</strong></td>
<td colspan="3" style="text-align: left;">Quản trị viên truy cập vào phân hệ Cấu hình Quota AI để thiết lập số lượt gọi AI tối đa cho các tính năng hệ thống đối với từng nhóm tài khoản.</td>
</tr>
<tr>
<td style="text-align: center;"><strong>Tiền điều kiện</strong></td>
<td colspan="3" style="text-align: left;">Quản trị viên đã đăng nhập thành công vào hệ thống và được cấp quyền cấu hình hệ thống.</td>
</tr>
<tr>
<td style="text-align: center;"><p><strong>Luồng sự kiện chính</strong></p>
<p><strong>(Thành công)</strong></p></td>
<td colspan="3"><table style="width:84%;">
<colgroup>
<col style="width: 9%" />
<col style="width: 19%" />
<col style="width: 54%" />
</colgroup>
<thead>
<tr>
<th style="text-align: center;"><strong>STT</strong></th>
<th style="text-align: center;"><strong>Thực hiện bởi</strong></th>
<th style="text-align: center;"><strong>Hành động</strong></th>
</tr>
</thead>
<tbody>
<tr>
<td style="text-align: center;">1</td>
<td style="text-align: left;">Quản trị viên</td>
<td>Truy cập phân hệ Cấu hình Quota AI.</td>
</tr>
<tr>
<td style="text-align: center;">2</td>
<td style="text-align: left;">Hệ thống</td>
<td>Truy vấn cấu hình hạn mức hiện tại (từ bảng user_quotas).</td>
</tr>
<tr>
<td style="text-align: center;">3</td>
<td style="text-align: left;">Hệ thống</td>
<td>Hiển thị giao diện thiết lập Hạn mức AI cho từng nhóm.</td>
</tr>
<tr>
<td style="text-align: center;">4</td>
<td style="text-align: left;">Quản trị viên</td>
<td>Chọn nhóm tài khoản (Free hoặc VIP).</td>
</tr>
<tr>
<td style="text-align: center;">5</td>
<td style="text-align: left;">Quản trị viên</td>
<td>Chọn loại tính năng AI (Ví dụ: Writing Grading, Dictionary...).</td>
</tr>
<tr>
<td style="text-align: center;">6</td>
<td style="text-align: left;">Quản trị viên</td>
<td>Nhập số lượt tối đa (max_limit) trong tuần/tháng.</td>
</tr>
<tr>
<td style="text-align: center;">7</td>
<td style="text-align: left;">Quản trị viên</td>
<td>Bấm nút "Lưu cấu hình".</td>
</tr>
<tr>
<td style="text-align: center;">8</td>
<td style="text-align: left;">Hệ thống</td>
<td>Kiểm tra tính hợp lệ của dữ liệu nhập (Rẽ nhánh: Dữ liệu hợp lệ <math display="inline" xmlns="http://www.w3.org/1998/Math/MathML"><semantics><mo>→</mo><annotation encoding="application/x-tex">\rightarrow</annotation></semantics></math> Đúng).</td>
</tr>
<tr>
<td style="text-align: center;">9</td>
<td style="text-align: left;">Hệ thống</td>
<td>Cập nhật tham số max_limit vào bảng user_quotas.</td>
</tr>
<tr>
<td style="text-align: center;">10</td>
<td style="text-align: left;">Hệ thống</td>
<td>Ghi nhật ký thay đổi vào bảng audit_logs.</td>
</tr>
<tr>
<td style="text-align: center;">11</td>
<td style="text-align: left;">Hệ thống</td>
<td>Hiển thị thông báo "Cập nhật thành công".</td>
</tr>
</tbody>
</table></td>
</tr>
<tr>
<td style="text-align: center;"><strong>Luồng sự kiện thay thế</strong></td>
<td colspan="3"><table style="width:84%;">
<colgroup>
<col style="width: 8%" />
<col style="width: 21%" />
<col style="width: 53%" />
</colgroup>
<thead>
<tr>
<th style="text-align: center;"><strong>STT</strong></th>
<th style="text-align: center;"><strong>Thực hiện bởi</strong></th>
<th style="text-align: center;"><strong>Hành động</strong></th>
</tr>
</thead>
<tbody>
<tr>
<td style="text-align: center;">8a</td>
<td>Hệ thống</td>
<td>Kiểm tra tính hợp lệ của dữ liệu (Rẽ nhánh: Dữ liệu hợp lệ <math display="inline" xmlns="http://www.w3.org/1998/Math/MathML"><semantics><mo>→</mo><annotation encoding="application/x-tex">\rightarrow</annotation></semantics></math> Sai) <math display="inline" xmlns="http://www.w3.org/1998/Math/MathML"><semantics><mo>→</mo><annotation encoding="application/x-tex">\rightarrow</annotation></semantics></math> Hiển thị cảnh báo lỗi (VD: Số lượt phải &gt; 0).</td>
</tr>
<tr>
<td style="text-align: center;">9a</td>
<td>Quản trị viên</td>
<td>Chỉnh sửa lại thông tin. <em>(Lưu ý: Mũi tên quay ngược</em> <math display="inline" xmlns="http://www.w3.org/1998/Math/MathML"><semantics><mo>→</mo><annotation encoding="application/x-tex">\rightarrow</annotation></semantics></math> <em>Luồng quay lại Bước 6 của luồng sự kiện chính)</em>.</td>
</tr>
</tbody>
</table></td>
</tr>
<tr>
<td style="text-align: center;"><strong>Hậu điều kiện</strong></td>
<td colspan="3">Tham số hạn mức (max_limit) mới của nhóm tài khoản được cập nhật chính xác vào cơ sở dữ liệu, có hiệu lực giới hạn lập tức đối với người dùng. Toàn bộ thao tác thay đổi cấu hình đều được ghi vết lại vào nhật ký kiểm toán (Audit Logs).</td>
</tr>
</tbody>
</table>

Xem nhật ký kiểm toán an ninh

<img src=".\\srs-media/media/image10.png" style="width:6.26806in;height:7.49722in" />

<img src=".\\srs-media/media/image11.png" style="width:5.58333in;height:8.38333in" />

<table>
<colgroup>
<col style="width: 17%" />
<col style="width: 27%" />
<col style="width: 28%" />
<col style="width: 26%" />
</colgroup>
<thead>
<tr>
<th><strong>Mã Use case</strong></th>
<th style="text-align: center;">UC15.4 (A_Audit)</th>
<th style="text-align: center;"><strong>Tên Use case</strong></th>
<th style="text-align: center;">Xem Nhật ký kiểm toán an ninh</th>
</tr>
</thead>
<tbody>
<tr>
<td style="text-align: center;"><strong>Tác nhân</strong></td>
<td colspan="3" style="text-align: center;">Quản trị viên</td>
</tr>
<tr>
<td style="text-align: center;"><strong>Sự kiện kích hoạt</strong></td>
<td colspan="3" style="text-align: left;">Quản trị viên truy cập trang Kiểm toán để xem vết thao tác (sửa/xóa đề thi, đổi quyền...) nhằm mục đích đối soát hoặc phân tích sự cố.</td>
</tr>
<tr>
<td style="text-align: center;"><strong>Tiền điều kiện</strong></td>
<td colspan="3" style="text-align: left;">Quản trị viên đã đăng nhập thành công vào hệ thống và được phân quyền truy cập phân hệ nhật ký kiểm toán (Audit Logs).</td>
</tr>
<tr>
<td style="text-align: center;"><p><strong>Luồng sự kiện chính</strong></p>
<p><strong>(Thành công)</strong></p></td>
<td colspan="3"><table style="width:84%;">
<colgroup>
<col style="width: 9%" />
<col style="width: 19%" />
<col style="width: 54%" />
</colgroup>
<thead>
<tr>
<th style="text-align: center;"><strong>STT</strong></th>
<th style="text-align: center;"><strong>Thực hiện bởi</strong></th>
<th style="text-align: center;"><strong>Hành động</strong></th>
</tr>
</thead>
<tbody>
<tr>
<td style="text-align: center;">1</td>
<td style="text-align: left;">Quản trị viên</td>
<td>Truy cập phân hệ Nhật ký Kiểm toán (Audit Logs).</td>
</tr>
<tr>
<td style="text-align: center;">2</td>
<td style="text-align: left;">Hệ thống</td>
<td>Truy vấn danh sách lịch sử thao tác (từ bảng audit_logs).</td>
</tr>
<tr>
<td style="text-align: center;">3</td>
<td style="text-align: left;">Hệ thống</td>
<td>Hiển thị danh sách log tổng quan (Hành động, Người thực hiện, Thời gian).</td>
</tr>
<tr>
<td style="text-align: center;">4</td>
<td style="text-align: left;">Quản trị viên</td>
<td>Lọc log theo mốc thời gian, loại hành động hoặc Entity ID.</td>
</tr>
<tr>
<td style="text-align: center;">5</td>
<td style="text-align: left;">Hệ thống</td>
<td>Truy vấn dữ liệu theo bộ lọc.</td>
</tr>
<tr>
<td style="text-align: center;">6</td>
<td style="text-align: left;">Hệ thống</td>
<td>Cập nhật danh sách nhật ký hiển thị.</td>
</tr>
<tr>
<td style="text-align: center;">7</td>
<td style="text-align: left;">Quản trị viên</td>
<td>Chọn một bản ghi log cụ thể (VD: DELETE_EXAM).</td>
</tr>
<tr>
<td style="text-align: center;">8</td>
<td style="text-align: left;">Hệ thống</td>
<td>Trích xuất dữ liệu Snapshot JSON (từ cột details).</td>
</tr>
<tr>
<td style="text-align: center;">9</td>
<td style="text-align: left;">Hệ thống</td>
<td>Hiển thị popup chi tiết: Dữ liệu trước và sau khi thao tác.</td>
</tr>
<tr>
<td style="text-align: center;">10</td>
<td style="text-align: left;">Quản trị viên</td>
<td>Đối soát dữ liệu và phân tích lỗi.</td>
</tr>
</tbody>
</table></td>
</tr>
<tr>
<td style="text-align: center;"><strong>Luồng sự kiện thay thế</strong></td>
<td colspan="3"><table style="width:84%;">
<colgroup>
<col style="width: 8%" />
<col style="width: 21%" />
<col style="width: 53%" />
</colgroup>
<thead>
<tr>
<th style="text-align: center;"><strong>STT</strong></th>
<th style="text-align: center;"><strong>Thực hiện bởi</strong></th>
<th style="text-align: center;"><strong>Hành động</strong></th>
</tr>
</thead>
<tbody>
<tr>
<td style="text-align: center;">4a</td>
<td>Hệ thống</td>
<td><em>(Trường hợp bộ lọc không khớp dữ liệu)</em>: Hệ thống hiển thị danh sách trống và thông báo không tìm thấy bản ghi phù hợp. <em>(Luồng quay lại Bước 4 để Quản trị viên đổi bộ lọc)</em>.</td>
</tr>
</tbody>
</table></td>
</tr>
<tr>
<td style="text-align: center;"><strong>Hậu điều kiện</strong></td>
<td colspan="3">Quản trị viên trích xuất thành công toàn bộ vết thao tác nhạy cảm trên hệ thống kèm theo dữ liệu bản chụp (snapshot JSON) để thực hiện đối soát, đánh giá an ninh một cách chính xác.</td>
</tr>
</tbody>
</table>

Báo cáo Vận hành & Doanh thu Tổng quan

<img src=".\\srs-media/media/image12.png" style="width:6.26806in;height:5.97153in" />

<img src=".\\srs-media/media/image13.png" style="width:6.26806in;height:5.60347in" />

<table>
<colgroup>
<col style="width: 17%" />
<col style="width: 27%" />
<col style="width: 28%" />
<col style="width: 26%" />
</colgroup>
<thead>
<tr>
<th style="text-align: center;"><strong>Mã Use case</strong></th>
<th style="text-align: center;">UC16</th>
<th style="text-align: center;"><strong>Tên Use case</strong></th>
<th style="text-align: center;">Báo cáo Vận hành &amp; Doanh thu Tổng quan</th>
</tr>
</thead>
<tbody>
<tr>
<td style="text-align: center;"><strong>Tác nhân</strong></td>
<td colspan="3" style="text-align: center;">Quản trị viên</td>
</tr>
<tr>
<td style="text-align: center;"><strong>Sự kiện kích hoạt</strong></td>
<td colspan="3" style="text-align: left;">Quản trị viên truy cập vào Dashboard để xem tình hình hoạt động của hệ thống, bao gồm số lượng người dùng truy cập, tỷ lệ chuyển đổi và doanh thu tài chính.</td>
</tr>
<tr>
<td style="text-align: center;"><strong>Tiền điều kiện</strong></td>
<td colspan="3" style="text-align: left;">Quản trị viên đã đăng nhập hệ thống thành công và được phân quyền xem báo cáo thống kê cấp cao.</td>
</tr>
<tr>
<td style="text-align: center;"><p><strong>Luồng sự kiện chính</strong></p>
<p><strong>(Thành công)</strong></p></td>
<td colspan="3"><table style="width:84%;">
<colgroup>
<col style="width: 9%" />
<col style="width: 19%" />
<col style="width: 54%" />
</colgroup>
<thead>
<tr>
<th style="text-align: center;"><strong>STT</strong></th>
<th style="text-align: center;"><strong>Thực hiện bởi</strong></th>
<th style="text-align: center;"><strong>Hành động</strong></th>
</tr>
</thead>
<tbody>
<tr>
<td style="text-align: center;">1</td>
<td style="text-align: left;">Quản trị viên</td>
<td>Truy cập phân hệ Báo cáo Vận hành &amp; Doanh thu.</td>
</tr>
<tr>
<td style="text-align: center;">2</td>
<td style="text-align: left;">Hệ thống</td>
<td>Truy xuất dữ liệu mặc định (Tháng hiện tại).</td>
</tr>
<tr>
<td style="text-align: center;">3</td>
<td style="text-align: left;">Hệ thống</td>
<td>Hiển thị Dashboard tổng quan.</td>
</tr>
<tr>
<td style="text-align: center;">4</td>
<td style="text-align: left;">Quản trị viên</td>
<td>Chọn tham số thời gian (Tuần / Tháng / Năm / Tùy chỉnh).</td>
</tr>
<tr>
<td style="text-align: center;">5</td>
<td style="text-align: left;">Hệ thống</td>
<td><p><em>(Kích hoạt 3 luồng xử lý song song)</em>:</p>
<p>- Luồng 1: Truy vấn login_history &amp; test_attempts <math display="inline" xmlns="http://www.w3.org/1998/Math/MathML"><semantics><mo>→</mo><annotation encoding="application/x-tex">\rightarrow</annotation></semantics></math> Tính toán chỉ số DAU/MAU (User hoạt động).</p>
<p>- Luồng 2: Truy vấn bảng transactions (status = SUCCESS) <math display="inline" xmlns="http://www.w3.org/1998/Math/MathML"><semantics><mo>→</mo><annotation encoding="application/x-tex">\rightarrow</annotation></semantics></math> Tổng hợp doanh thu theo chu kỳ.</p>
<p>- Luồng 3: Truy vấn bảng users (so sánh FREE vs PREMIUM) <math display="inline" xmlns="http://www.w3.org/1998/Math/MathML"><semantics><mo>→</mo><annotation encoding="application/x-tex">\rightarrow</annotation></semantics></math> Tính tỷ lệ chuyển đổi tài khoản VIP.</p></td>
</tr>
<tr>
<td style="text-align: center;">6</td>
<td style="text-align: left;">Hệ thống</td>
<td><em>(Hội tụ các luồng xử lý)</em>: Đóng gói dữ liệu và vẽ biểu đồ trực quan.</td>
</tr>
<tr>
<td style="text-align: center;">7</td>
<td style="text-align: left;">Hệ thống</td>
<td>Cập nhật hiển thị lên Dashboard.</td>
</tr>
<tr>
<td style="text-align: center;">8</td>
<td style="text-align: left;">Quản trị viên</td>
<td>Xem báo cáo phân tích và đưa ra quyết định.</td>
</tr>
</tbody>
</table></td>
</tr>
<tr>
<td style="text-align: center;"><strong>Hậu điều kiện</strong></td>
<td colspan="3">Báo cáo vận hành và doanh thu được kết xuất, đóng gói và hiển thị trực quan thành các biểu đồ trên Dashboard để Quản trị viên đối soát, đánh giá tình hình kinh doanh của nền tảng.</td>
</tr>
</tbody>
</table>

Tra cứu & Đối soát giao dịch VNPAY

<img src=".\\srs-media/media/image14.png" style="width:6.26806in;height:5.0375in" />

<img src=".\\srs-media/media/image15.png" style="width:6.26806in;height:5.23542in" />

<table>
<colgroup>
<col style="width: 17%" />
<col style="width: 27%" />
<col style="width: 28%" />
<col style="width: 26%" />
</colgroup>
<thead>
<tr>
<th style="text-align: center;"><strong>Mã Use case</strong></th>
<th style="text-align: center;">UC16.2</th>
<th style="text-align: center;"><strong>Tên Use case</strong></th>
<th style="text-align: center;">Tra cứu &amp; Đối soát giao dịch VNPAY</th>
</tr>
</thead>
<tbody>
<tr>
<td style="text-align: center;"><strong>Tác nhân</strong></td>
<td colspan="3" style="text-align: center;">Quản trị viên</td>
</tr>
<tr>
<td style="text-align: center;"><strong>Sự kiện kích hoạt</strong></td>
<td colspan="3" style="text-align: left;">Quản trị viên truy cập vào phân hệ đối soát để tra cứu các giao dịch thanh toán bị lỗi, có khiếu nại, hoặc cần kiểm tra dòng tiền định kỳ.</td>
</tr>
<tr>
<td style="text-align: center;"><strong>Tiền điều kiện</strong></td>
<td colspan="3" style="text-align: left;">Quản trị viên đã đăng nhập thành công và được phân quyền xem, quản lý các giao dịch tài chính của hệ thống.</td>
</tr>
<tr>
<td style="text-align: center;"><p><strong>Luồng sự kiện chính</strong></p>
<p><strong>(Thành công)</strong></p></td>
<td colspan="3"><table style="width:84%;">
<colgroup>
<col style="width: 9%" />
<col style="width: 19%" />
<col style="width: 54%" />
</colgroup>
<thead>
<tr>
<th style="text-align: center;"><strong>STT</strong></th>
<th style="text-align: center;"><strong>Thực hiện bởi</strong></th>
<th style="text-align: center;"><strong>Hành động</strong></th>
</tr>
</thead>
<tbody>
<tr>
<td style="text-align: center;">1</td>
<td style="text-align: left;">Quản trị viên</td>
<td>Truy cập phân hệ Đối soát Giao dịch VNPAY.</td>
</tr>
<tr>
<td style="text-align: center;">2</td>
<td style="text-align: left;">Hệ thống</td>
<td>Truy vấn danh sách giao dịch (từ bảng transactions).</td>
</tr>
<tr>
<td style="text-align: center;">3</td>
<td style="text-align: left;">Hệ thống</td>
<td>Hiển thị danh sách tổng quan (mới nhất lên đầu).</td>
</tr>
<tr>
<td style="text-align: center;">4</td>
<td style="text-align: left;">Quản trị viên</td>
<td>Nhập thông tin hoặc chọn bộ lọc tra cứu (Rẽ nhánh: Chọn Lọc theo Trạng thái / Ngày).</td>
</tr>
<tr>
<td style="text-align: center;">5</td>
<td style="text-align: left;">Quản trị viên</td>
<td>Chọn khoảng thời gian hoặc trạng thái (SUCCESS/FAILED).</td>
</tr>
<tr>
<td style="text-align: center;">6</td>
<td style="text-align: left;">Hệ thống</td>
<td>Truy vấn danh sách giao dịch theo điều kiện tương ứng.</td>
</tr>
<tr>
<td style="text-align: center;">7</td>
<td style="text-align: left;">Hệ thống</td>
<td><em>(Luồng hội tụ)</em> Cập nhật danh sách / Hiển thị chi tiết giao dịch tìm được.</td>
</tr>
<tr>
<td style="text-align: center;">8</td>
<td style="text-align: left;">Quản trị viên</td>
<td>Đối soát dữ liệu tài chính (Số tiền, Gói cước, Thời gian).</td>
</tr>
<tr>
<td style="text-align: center;">9</td>
<td style="text-align: left;">Quản trị viên</td>
<td>Xử lý khiếu nại học viên (nếu có).</td>
</tr>
</tbody>
</table></td>
</tr>
<tr>
<td style="text-align: center;"><strong>Luồng sự kiện thay thế</strong></td>
<td colspan="3"><table style="width:84%;">
<colgroup>
<col style="width: 8%" />
<col style="width: 21%" />
<col style="width: 53%" />
</colgroup>
<thead>
<tr>
<th style="text-align: center;"><strong>STT</strong></th>
<th style="text-align: center;"><strong>Thực hiện bởi</strong></th>
<th style="text-align: center;"><strong>Hành động</strong></th>
</tr>
</thead>
<tbody>
<tr>
<td style="text-align: center;">4a</td>
<td>Quản trị viên</td>
<td><em>Nhập thông tin hoặc chọn bộ lọc tra cứu (Rẽ nhánh: Chọn Tra cứu chính xác).</em></td>
</tr>
<tr>
<td style="text-align: center;">5a</td>
<td>Quản trị viên</td>
<td>Nhập chính xác Mã đơn hàng hoặc Email học viên.</td>
</tr>
<tr>
<td style="text-align: center;">6a</td>
<td>Hệ thống</td>
<td>Truy vấn thông tin chi tiết của giao dịch (bảng transactions).</td>
</tr>
<tr>
<td style="text-align: center;">7a</td>
<td>Hệ thống</td>
<td><em>(Luồng hội tụ)</em> Hiển thị chi tiết giao dịch tìm được. <em>(Sau bước này, luồng đi tiếp đến Bước 8 của luồng sự kiện chính).</em></td>
</tr>
</tbody>
</table></td>
</tr>
<tr>
<td style="text-align: center;"><strong>Hậu điều kiện</strong></td>
<td colspan="3">Quản trị viên tra cứu thành công thông tin giao dịch, thực hiện đối soát giữa dữ liệu trên hệ thống (transactions) với dữ liệu từ cổng thanh toán VNPAY, đồng thời hoàn tất việc xử lý khiếu nại của học viên (nếu có).</td>
</tr>
</tbody>
</table>

Xuất báo cáo tài chính định kỳ

<img src=".\\srs-media/media/image16.png" style="width:6.26806in;height:5.79514in" />

<img src=".\\srs-media/media/image17.png" style="width:5.49167in;height:8.24167in" />

<table>
<colgroup>
<col style="width: 17%" />
<col style="width: 27%" />
<col style="width: 28%" />
<col style="width: 26%" />
</colgroup>
<thead>
<tr>
<th style="text-align: center;"><strong>Mã Use case</strong></th>
<th style="text-align: center;">UC16.3</th>
<th style="text-align: center;"><strong>Tên Use case</strong></th>
<th style="text-align: center;">Xuất báo cáo tài chính định kỳ</th>
</tr>
</thead>
<tbody>
<tr>
<td style="text-align: center;"><strong>Tác nhân</strong></td>
<td colspan="3" style="text-align: center;">Quản trị viên</td>
</tr>
<tr>
<td style="text-align: center;"><strong>Sự kiện kích hoạt</strong></td>
<td colspan="3" style="text-align: left;">Quản trị viên có nhu cầu trích xuất dữ liệu doanh thu và lịch sử giao dịch ra tệp tin ngoại tuyến để báo cáo hoặc lưu trữ định kỳ.</td>
</tr>
<tr>
<td style="text-align: center;"><strong>Tiền điều kiện</strong></td>
<td colspan="3" style="text-align: left;">Quản trị viên đã đăng nhập thành công vào hệ thống và được phân quyền xem, xuất báo cáo giao dịch tài chính.</td>
</tr>
<tr>
<td style="text-align: center;"><p><strong>Luồng sự kiện chính</strong></p>
<p><strong>(Thành công)</strong></p></td>
<td colspan="3"><table style="width:84%;">
<colgroup>
<col style="width: 9%" />
<col style="width: 19%" />
<col style="width: 54%" />
</colgroup>
<thead>
<tr>
<th style="text-align: center;"><strong>STT</strong></th>
<th style="text-align: center;"><strong>Thực hiện bởi</strong></th>
<th style="text-align: center;"><strong>Hành động</strong></th>
</tr>
</thead>
<tbody>
<tr>
<td style="text-align: center;">1</td>
<td style="text-align: left;">Quản trị viên</td>
<td>Truy cập phân hệ Báo cáo Giao dịch.</td>
</tr>
<tr>
<td style="text-align: center;">2</td>
<td style="text-align: left;">Quản trị viên</td>
<td>Chọn khoảng thời gian (Từ ngày - Đến ngày).</td>
</tr>
<tr>
<td style="text-align: center;">3</td>
<td style="text-align: left;">Quản trị viên</td>
<td>Chọn định dạng file (Excel hoặc PDF).</td>
</tr>
<tr>
<td style="text-align: center;">4</td>
<td style="text-align: left;">Quản trị viên</td>
<td>Bấm nút "Xuất báo cáo".</td>
</tr>
<tr>
<td style="text-align: center;">5</td>
<td style="text-align: left;">Hệ thống</td>
<td>Tiếp nhận yêu cầu.</td>
</tr>
<tr>
<td style="text-align: center;">6</td>
<td style="text-align: left;">Hệ thống</td>
<td>Truy vấn bảng transactions (Lọc theo thời gian &amp; status = SUCCESS).</td>
</tr>
<tr>
<td style="text-align: center;">7</td>
<td style="text-align: left;">Hệ thống</td>
<td>Tổng hợp dữ liệu doanh thu và danh sách giao dịch chi tiết.</td>
</tr>
<tr>
<td style="text-align: center;">8</td>
<td style="text-align: left;">Hệ thống</td>
<td>Sinh file báo cáo chuẩn (.xlsx hoặc .pdf)</td>
</tr>
<tr>
<td style="text-align: center;">9</td>
<td style="text-align: left;">Hệ thống</td>
<td>Trả luồng dữ liệu file (Download stream) về Client.</td>
</tr>
<tr>
<td style="text-align: center;">10</td>
<td style="text-align: left;">Quản trị viên</td>
<td>Nhận hộp thoại lưu file và tải về thiết bị nội bộ.</td>
</tr>
</tbody>
</table></td>
</tr>
<tr>
<td style="text-align: center;"><strong>Hậu điều kiện</strong></td>
<td colspan="3">File báo cáo tài chính (định dạng Excel hoặc PDF) chứa dữ liệu doanh thu chính xác được sinh ra và tải xuống thành công về thiết bị của Quản trị viên.</td>
</tr>
</tbody>
</table>
