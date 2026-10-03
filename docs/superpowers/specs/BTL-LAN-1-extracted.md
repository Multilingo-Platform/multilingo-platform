# TOÀN BỘ NỘI DUNG ĐẶC TẢ TỪ FILE BTL-LAN-1.docx

UC tra cứu từ điển:

Biểu đồ hoạt động tra cứu từ điển


#### Bảng 1

| Mã Use case | UC011 | Tên Use case | Tra cứu từ điển |
| --- | --- | --- | --- |
| Tác nhân | Người dùng, Hệ thống AI | Người dùng, Hệ thống AI | Người dùng, Hệ thống AI |
| Sự kiện kích hoạt | Người dùng nhấp chọn hoặc bôi đen một từ vựng trong bài đọc Reading | Người dùng nhấp chọn hoặc bôi đen một từ vựng trong bài đọc Reading | Người dùng nhấp chọn hoặc bôi đen một từ vựng trong bài đọc Reading |
| Tiền điều kiện | Người dùng đang mở giao diện bài đọc Reading trong hệ thống | Người dùng đang mở giao diện bài đọc Reading trong hệ thống | Người dùng đang mở giao diện bài đọc Reading trong hệ thống |
| Luồng sự kiện chính <br> (Thành công) |  |  |  |
| Luồng sự kiện thay thế |  |  |  |
| Hậu điều kiện | Thông tin từ vựng hiển thị thành công cho Người dùng (hoặc đã được lưu vào Flashcard nếu chọn); từ mới từ AI (nếu có) được cập nhật vào kho từ điển; Người dùng tiếp tục làm bài đọc bình thường. | Thông tin từ vựng hiển thị thành công cho Người dùng (hoặc đã được lưu vào Flashcard nếu chọn); từ mới từ AI (nếu có) được cập nhật vào kho từ điển; Người dùng tiếp tục làm bài đọc bình thường. | Thông tin từ vựng hiển thị thành công cho Người dùng (hoặc đã được lưu vào Flashcard nếu chọn); từ mới từ AI (nếu có) được cập nhật vào kho từ điển; Người dùng tiếp tục làm bài đọc bình thường. |

Đặc tả UC tra cứu từ điển

UC lưu từ vựng


#### Bảng 2

| Mã Use case | UC011.1 | Tên Use case | Lưu từ vựng vào Sổ tay Flashcard cá nhân |
| --- | --- | --- | --- |
| Tác nhân | Người dùng | Người dùng | Người dùng |
| Sự kiện kích hoạt | Người dùng bấm nút "+ Lưu Flashcard" trên popup kết quả tra từ | Người dùng bấm nút "+ Lưu Flashcard" trên popup kết quả tra từ | Người dùng bấm nút "+ Lưu Flashcard" trên popup kết quả tra từ |
| Tiền điều kiện | Người dùng đã đăng nhập và đang mở popup kết quả tra từ vựng hợp lệ | Người dùng đã đăng nhập và đang mở popup kết quả tra từ vựng hợp lệ | Người dùng đã đăng nhập và đang mở popup kết quả tra từ vựng hợp lệ |
| Luồng sự kiện chính <br> (Thành công) |  |  |  |
| Luồng sự kiện thay thế |  |  |  |
| Hậu điều kiện | Thẻ Flashcard mới được tạo thành công trong sổ học tập cá nhân của Người dùng | Thẻ Flashcard mới được tạo thành công trong sổ học tập cá nhân của Người dùng | Thẻ Flashcard mới được tạo thành công trong sổ học tập cá nhân của Người dùng |

Quản lý Sổ tay và bộ thẻ từ vựng


#### Bảng 3

| Mã Use case | UC012 | Tên Use case | Quản lý Sổ tay và bộ thẻ từ vựng |
| --- | --- | --- | --- |
| Tác nhân | Người dùng | Người dùng | Người dùng |
| Sự kiện kích hoạt | Người dùng nhấp chọn menu "Sổ tay từ vựng" trên thanh điều hướng chính của hệ thống | Người dùng nhấp chọn menu "Sổ tay từ vựng" trên thanh điều hướng chính của hệ thống | Người dùng nhấp chọn menu "Sổ tay từ vựng" trên thanh điều hướng chính của hệ thống |
| Tiền điều kiện | Người dùng đã đăng nhập tài khoản thành công vào hệ thống | Người dùng đã đăng nhập tài khoản thành công vào hệ thống | Người dùng đã đăng nhập tài khoản thành công vào hệ thống |
| Luồng sự kiện chính <br> (Thành công) |  |  |  |
| Luồng sự kiện thay thế |  |  |  |
| Hậu điều kiện | Danh sách bộ thẻ hoặc danh sách thẻ từ trong bộ thẻ hiển thị chính xác; sẵn sàng kích hoạt các chế độ học. | Danh sách bộ thẻ hoặc danh sách thẻ từ trong bộ thẻ hiển thị chính xác; sẵn sàng kích hoạt các chế độ học. | Danh sách bộ thẻ hoặc danh sách thẻ từ trong bộ thẻ hiển thị chính xác; sẵn sàng kích hoạt các chế độ học. |

Tạo mới và chỉnh sửa Thẻ ghi nhớ


#### Bảng 4

| Mã Use case | UC012.1 | Tên Use case | Tạo mới và chỉnh sửa Thẻ ghi nhớ |
| --- | --- | --- | --- |
| Tác nhân | Người dùng | Người dùng | Người dùng |
| Sự kiện kích hoạt | Người dùng bấm nút "+ Thêm từ mới" hoặc biểu tượng "Sửa" trên thẻ | Người dùng bấm nút "+ Thêm từ mới" hoặc biểu tượng "Sửa" trên thẻ | Người dùng bấm nút "+ Thêm từ mới" hoặc biểu tượng "Sửa" trên thẻ |
| Tiền điều kiện | Người dùng đã đăng nhập và đang mở chi tiết một bộ thẻ | Người dùng đã đăng nhập và đang mở chi tiết một bộ thẻ | Người dùng đã đăng nhập và đang mở chi tiết một bộ thẻ |
| Luồng sự kiện chính <br> (Thành công) |  |  |  |
| Luồng sự kiện thay thế |  |  |  |
| Hậu điều kiện | Thẻ ghi nhớ được lưu thành công; danh sách từ vựng trong bộ thẻ được cập nhật tức thì. | Thẻ ghi nhớ được lưu thành công; danh sách từ vựng trong bộ thẻ được cập nhật tức thì. | Thẻ ghi nhớ được lưu thành công; danh sách từ vựng trong bộ thẻ được cập nhật tức thì. |


#### Bảng 5

| Mã Use case | UC012.2 | Tên Use case | Ôn tập flashcard |
| --- | --- | --- | --- |
| Tác nhân | Người dùng | Người dùng | Người dùng |
| Sự kiện kích hoạt | Người dùng nhấp chọn nút "Ôn tập Flashcard" từ màn hình chi tiết của một bộ thẻ ghi nhớ | Người dùng nhấp chọn nút "Ôn tập Flashcard" từ màn hình chi tiết của một bộ thẻ ghi nhớ | Người dùng nhấp chọn nút "Ôn tập Flashcard" từ màn hình chi tiết của một bộ thẻ ghi nhớ |
| Tiền điều kiện | Người dùng đã đăng nhập tài khoản vào hệ thống và bộ thẻ có ít nhất một thẻ từ vựng | Người dùng đã đăng nhập tài khoản vào hệ thống và bộ thẻ có ít nhất một thẻ từ vựng | Người dùng đã đăng nhập tài khoản vào hệ thống và bộ thẻ có ít nhất một thẻ từ vựng |
| Luồng sự kiện chính <br> (Thành công) |  |  |  |
| Luồng sự kiện thay thế |  |  |  |
| Hậu điều kiện | Lịch ôn tập tiếp theo của từ vựng được cập nhật; chuỗi ngày học và điểm kinh nghiệm được ghi nhận thành công. | Lịch ôn tập tiếp theo của từ vựng được cập nhật; chuỗi ngày học và điểm kinh nghiệm được ghi nhận thành công. | Lịch ôn tập tiếp theo của từ vựng được cập nhật; chuỗi ngày học và điểm kinh nghiệm được ghi nhận thành công. |


#### Bảng 6

| Mã Use case | UC012.3 | Tên Use case | Học từ vựng |
| --- | --- | --- | --- |
| Tác nhân | Người dùng | Người dùng | Người dùng |
| Sự kiện kích hoạt | Người dùng nhấp chọn nút "Học từ vựng" từ giao diện chi tiết của một bộ thẻ ghi nhớ | Người dùng nhấp chọn nút "Học từ vựng" từ giao diện chi tiết của một bộ thẻ ghi nhớ | Người dùng nhấp chọn nút "Học từ vựng" từ giao diện chi tiết của một bộ thẻ ghi nhớ |
| Tiền điều kiện | Người dùng đã đăng nhập tài khoản vào hệ thống và bộ thẻ có tối thiểu 4 thẻ từ vựng | Người dùng đã đăng nhập tài khoản vào hệ thống và bộ thẻ có tối thiểu 4 thẻ từ vựng | Người dùng đã đăng nhập tài khoản vào hệ thống và bộ thẻ có tối thiểu 4 thẻ từ vựng |
| Luồng sự kiện chính <br> (Thành công) |  |  |  |
| Luồng sự kiện thay thế |  |  |  |
| Hậu điều kiện | Kết quả học tập và tiến độ thuộc từ được lưu trữ; điểm kinh nghiệm của Người dùng được cộng thành công. | Kết quả học tập và tiến độ thuộc từ được lưu trữ; điểm kinh nghiệm của Người dùng được cộng thành công. | Kết quả học tập và tiến độ thuộc từ được lưu trữ; điểm kinh nghiệm của Người dùng được cộng thành công. |


#### Bảng 7

| Mã Use case | UC012.4 | Tên Use case | Kiểm tra từ vựng |
| --- | --- | --- | --- |
| Tác nhân | Người dùng | Người dùng | Người dùng |
| Sự kiện kích hoạt | Người dùng bấm nút "Kiểm tra" trên giao diện bộ thẻ | Người dùng bấm nút "Kiểm tra" trên giao diện bộ thẻ | Người dùng bấm nút "Kiểm tra" trên giao diện bộ thẻ |
| Tiền điều kiện | Người dùng đã đăng nhập và bộ thẻ có tối thiểu 4 từ vựng | Người dùng đã đăng nhập và bộ thẻ có tối thiểu 4 từ vựng | Người dùng đã đăng nhập và bộ thẻ có tối thiểu 4 từ vựng |
| Luồng sự kiện chính <br> (Thành công) |  |  |  |
| Luồng sự kiện thay thế |  |  |  |
| Hậu điều kiện | Kết quả bài kiểm tra được lưu trữ trong hồ sơ Người dùng; mức độ thành thạo bộ thẻ và điểm thưởng được cập nhật thành công. | Kết quả bài kiểm tra được lưu trữ trong hồ sơ Người dùng; mức độ thành thạo bộ thẻ và điểm thưởng được cập nhật thành công. | Kết quả bài kiểm tra được lưu trữ trong hồ sơ Người dùng; mức độ thành thạo bộ thẻ và điểm thưởng được cập nhật thành công. |


#### Bảng 8

| Mã Use case | UC012.5 | Tên Use case | Trò chơi Ghép thẻ tốc độ |
| --- | --- | --- | --- |
| Tác nhân | Người dùng | Người dùng | Người dùng |
| Sự kiện kích hoạt | Người dùng bấm nút "Ghép thẻ" trên màn hình chi tiết bộ thẻ | Người dùng bấm nút "Ghép thẻ" trên màn hình chi tiết bộ thẻ | Người dùng bấm nút "Ghép thẻ" trên màn hình chi tiết bộ thẻ |
| Tiền điều kiện | Người dùng đã đăng nhập và bộ thẻ có tối thiểu 6 từ vựng | Người dùng đã đăng nhập và bộ thẻ có tối thiểu 6 từ vựng | Người dùng đã đăng nhập và bộ thẻ có tối thiểu 6 từ vựng |
| Luồng sự kiện chính <br> (Thành công) |  |  |  |
| Luồng sự kiện thay thế |  |  |  |
| Hậu điều kiện | Điểm số và thứ hạng của Người dùng được cập nhật vào Bảng xếp hạng; Người dùng củng cố phản xạ nhận diện từ vựng. | Điểm số và thứ hạng của Người dùng được cập nhật vào Bảng xếp hạng; Người dùng củng cố phản xạ nhận diện từ vựng. | Điểm số và thứ hạng của Người dùng được cập nhật vào Bảng xếp hạng; Người dùng củng cố phản xạ nhận diện từ vựng. |


#### Bảng 9

| Mã Use case | UC012.6 | Tên Use case | Xóa Thẻ ghi nhớ Flashcard |
| --- | --- | --- | --- |
| Tác nhân | Người dùng | Người dùng | Người dùng |
| Sự kiện kích hoạt | Người dùng nhấp chọn biểu tượng Thùng rác ("Xóa") trên một thẻ từ vựng cụ thể | Người dùng nhấp chọn biểu tượng Thùng rác ("Xóa") trên một thẻ từ vựng cụ thể | Người dùng nhấp chọn biểu tượng Thùng rác ("Xóa") trên một thẻ từ vựng cụ thể |
| Tiền điều kiện | Người dùng đã đăng nhập và đang mở xem chi tiết một bộ thẻ có ít nhất một thẻ từ vựng | Người dùng đã đăng nhập và đang mở xem chi tiết một bộ thẻ có ít nhất một thẻ từ vựng | Người dùng đã đăng nhập và đang mở xem chi tiết một bộ thẻ có ít nhất một thẻ từ vựng |
| Luồng sự kiện chính <br> (Thành công) |  |  |  |
| Luồng sự kiện thay thế |  |  |  |
| Hậu điều kiện | Thẻ từ vựng được xóa vĩnh viễn khỏi bộ thẻ; các chỉ số thống kê và giao diện danh sách từ vựng được cập nhật lại chính xác. | Thẻ từ vựng được xóa vĩnh viễn khỏi bộ thẻ; các chỉ số thống kê và giao diện danh sách từ vựng được cập nhật lại chính xác. | Thẻ từ vựng được xóa vĩnh viễn khỏi bộ thẻ; các chỉ số thống kê và giao diện danh sách từ vựng được cập nhật lại chính xác. |


#### Bảng 10

| Mã Use case | UC013 | Tên Use case | Xem Bảng điều khiển |
| --- | --- | --- | --- |
| Tác nhân | Người dùng | Người dùng | Người dùng |
| Sự kiện kích hoạt | Người dùng nhấp chọn menu "Bảng điều khiển" (hoặc đăng nhập thành công vào hệ thống) | Người dùng nhấp chọn menu "Bảng điều khiển" (hoặc đăng nhập thành công vào hệ thống) | Người dùng nhấp chọn menu "Bảng điều khiển" (hoặc đăng nhập thành công vào hệ thống) |
| Tiền điều kiện | Người dùng đã đăng nhập tài khoản thành công | Người dùng đã đăng nhập tài khoản thành công | Người dùng đã đăng nhập tài khoản thành công |
| Luồng sự kiện chính <br> (Thành công) |  |  |  |
| Luồng sự kiện thay thế |  |  |  |
| Hậu điều kiện | Người dùng nắm bắt được toàn diện tiến độ học tập, chuỗi ngày học và định hướng hoạt động học tập tiếp theo. | Người dùng nắm bắt được toàn diện tiến độ học tập, chuỗi ngày học và định hướng hoạt động học tập tiếp theo. | Người dùng nắm bắt được toàn diện tiến độ học tập, chuỗi ngày học và định hướng hoạt động học tập tiếp theo. |

Thiết lập mục tiêu học tập


#### Bảng 11

| Mã Use case | UC005 | Tên Use case | Thiết lập mục tiêu học tập |
| --- | --- | --- | --- |
| Tác nhân | Người dùng (Học viên) | Người dùng (Học viên) | Người dùng (Học viên) |
| Sự kiện kích hoạt | Người dùng đăng nhập thành công vào hệ thống lần đầu tiên | Người dùng đăng nhập thành công vào hệ thống lần đầu tiên | Người dùng đăng nhập thành công vào hệ thống lần đầu tiên |
| Tiền điều kiện | Tài khoản hợp lệ và chưa từng khai báo mục tiêu học tập | Tài khoản hợp lệ và chưa từng khai báo mục tiêu học tập | Tài khoản hợp lệ và chưa từng khai báo mục tiêu học tập |
| Luồng sự kiện chính <br> (Thành công) |  |  |  |
| Luồng sự kiện thay thế |  |  |  |
| Hậu điều kiện | Mục tiêu học tập được lưu, thống kê người dùng được khởi tạo, người dùng có thể sử dụng hệ thống bình thường. | Mục tiêu học tập được lưu, thống kê người dùng được khởi tạo, người dùng có thể sử dụng hệ thống bình thường. | Mục tiêu học tập được lưu, thống kê người dùng được khởi tạo, người dùng có thể sử dụng hệ thống bình thường. |

Tra cứu đề thi


#### Bảng 12

| Mã Use case | UC007 | Tên Use case | Tra cứu đề thi |
| --- | --- | --- | --- |
| Tác nhân | Người dùng (Học viên) | Người dùng (Học viên) | Người dùng (Học viên) |
| Sự kiện kích hoạt | Người dùng truy cập vào trang Thư viện đề thi | Người dùng truy cập vào trang Thư viện đề thi | Người dùng truy cập vào trang Thư viện đề thi |
| Tiền điều kiện | Người dùng đã truy cập vào trang web của nền tảng | Người dùng đã truy cập vào trang web của nền tảng | Người dùng đã truy cập vào trang web của nền tảng |
| Luồng sự kiện chính <br> (Thành công) |  |  |  |
| Luồng sự kiện thay thế |  |  |  |
| Hậu điều kiện | Danh sách đề thi được hiển thị chính xác theo yêu cầu lọc/tìm kiếm của người dùng. | Danh sách đề thi được hiển thị chính xác theo yêu cầu lọc/tìm kiếm của người dùng. | Danh sách đề thi được hiển thị chính xác theo yêu cầu lọc/tìm kiếm của người dùng. |

Thêm mới đề thi


#### Bảng 13

| Mã Use case | UC014.1 | Tên Use case | Tạo đề thi mới |
| --- | --- | --- | --- |
| Tác nhân | Quản trị viên | Quản trị viên | Quản trị viên |
| Sự kiện kích hoạt | Admin nhấn vào nút "Thêm đề thi mới" trên giao diện quản lý | Admin nhấn vào nút "Thêm đề thi mới" trên giao diện quản lý | Admin nhấn vào nút "Thêm đề thi mới" trên giao diện quản lý |
| Tiền điều kiện | Tài khoản có quyền quản lý kho đề thi | Tài khoản có quyền quản lý kho đề thi | Tài khoản có quyền quản lý kho đề thi |
| Luồng sự kiện chính <br> (Thành công) |  |  |  |
| Luồng sự kiện thay thế |  |  |  |
| Hậu điều kiện | Một đề thi với cấu trúc JSONB hoàn chỉnh được tạo và lưu vào hệ thống. | Một đề thi với cấu trúc JSONB hoàn chỉnh được tạo và lưu vào hệ thống. | Một đề thi với cấu trúc JSONB hoàn chỉnh được tạo và lưu vào hệ thống. |

Chỉnh sửa đề thi


#### Bảng 14

| Mã Use case | UC014.2 | Tên Use case | Chỉnh sửa đề thi |
| --- | --- | --- | --- |
| Tác nhân | Quản trị viên | Quản trị viên | Quản trị viên |
| Sự kiện kích hoạt | Admin nhấn vào nút "Chỉnh sửa" tại dòng hiển thị của một đề thi cụ thể | Admin nhấn vào nút "Chỉnh sửa" tại dòng hiển thị của một đề thi cụ thể | Admin nhấn vào nút "Chỉnh sửa" tại dòng hiển thị của một đề thi cụ thể |
| Tiền điều kiện | Tài khoản có quyền quản lý kho đề thi và đề thi cần sửa đã tồn tại trong cơ sở dữ liệu | Tài khoản có quyền quản lý kho đề thi và đề thi cần sửa đã tồn tại trong cơ sở dữ liệu | Tài khoản có quyền quản lý kho đề thi và đề thi cần sửa đã tồn tại trong cơ sở dữ liệu |
| Luồng sự kiện chính <br> (Thành công) |  |  |  |
| Luồng sự kiện thay thế |  |  |  |
| Hậu điều kiện | Dữ liệu đề thi (JSONB) và trạng thái xuất bản được cập nhật thành công trong cơ sở dữ liệu. | Dữ liệu đề thi (JSONB) và trạng thái xuất bản được cập nhật thành công trong cơ sở dữ liệu. | Dữ liệu đề thi (JSONB) và trạng thái xuất bản được cập nhật thành công trong cơ sở dữ liệu. |

Xoá đề thi


#### Bảng 15

| Mã Use case | UC014.3 | Tên Use case | Xoá đề thi |
| --- | --- | --- | --- |
| Tác nhân | Quản trị viên | Quản trị viên | Quản trị viên |
| Sự kiện kích hoạt | Admin nhấn vào nút "Xoá" tại dòng hiển thị của một đề thi cụ thể | Admin nhấn vào nút "Xoá" tại dòng hiển thị của một đề thi cụ thể | Admin nhấn vào nút "Xoá" tại dòng hiển thị của một đề thi cụ thể |
| Tiền điều kiện | Tài khoản có quyền quản lý kho đề thi và đề thi cần xoá đã tồn tại trong cơ sở dữ liệu | Tài khoản có quyền quản lý kho đề thi và đề thi cần xoá đã tồn tại trong cơ sở dữ liệu | Tài khoản có quyền quản lý kho đề thi và đề thi cần xoá đã tồn tại trong cơ sở dữ liệu |
| Luồng sự kiện chính <br> (Thành công) |  |  |  |
| Luồng sự kiện thay thế |  |  |  |
| Hậu điều kiện | Đề thi bị xóa hoàn toàn (nếu chưa ai thi) hoặc bị ẩn (xóa mềm - nếu đã có người thi) để bảo vệ tính toàn vẹn dữ liệu kết quả thi. Hành động bị ghi log. | Đề thi bị xóa hoàn toàn (nếu chưa ai thi) hoặc bị ẩn (xóa mềm - nếu đã có người thi) để bảo vệ tính toàn vẹn dữ liệu kết quả thi. Hành động bị ghi log. | Đề thi bị xóa hoàn toàn (nếu chưa ai thi) hoặc bị ẩn (xóa mềm - nếu đã có người thi) để bảo vệ tính toàn vẹn dữ liệu kết quả thi. Hành động bị ghi log. |

Import đề thi từ file


#### Bảng 16

| Mã Use case | UC014.4 | Tên Use case | Nhập đề thi từ file |
| --- | --- | --- | --- |
| Tác nhân | Quản trị viên | Quản trị viên | Quản trị viên |
| Sự kiện kích hoạt | Admin chọn chức năng “Nhập đề thi” và chọn file tải lên | Admin chọn chức năng “Nhập đề thi” và chọn file tải lên | Admin chọn chức năng “Nhập đề thi” và chọn file tải lên |
| Tiền điều kiện | Tài khoản có quyền quản lý kho đề thi và file dữ liệu đề thi cần nhập. | Tài khoản có quyền quản lý kho đề thi và file dữ liệu đề thi cần nhập. | Tài khoản có quyền quản lý kho đề thi và file dữ liệu đề thi cần nhập. |
| Luồng sự kiện chính <br> (Thành công) |  |  |  |
| Luồng sự kiện thay thế |  |  |  |
| Hậu điều kiện | Đề thi được bóc tách từ file thành công, sinh ra JSONB lưu trữ vào hệ thống. | Đề thi được bóc tách từ file thành công, sinh ra JSONB lưu trữ vào hệ thống. | Đề thi được bóc tách từ file thành công, sinh ra JSONB lưu trữ vào hệ thống. |

Tra cứu lịch sử làm bài


#### Bảng 17

| Mã Use case | UC00 | Tên Use case | Tra cứu lịch sử làm bài |
| --- | --- | --- | --- |
| Tác nhân | Người dùng (Học viên) | Người dùng (Học viên) | Người dùng (Học viên) |
| Sự kiện kích hoạt | Người dùng truy cập vào trang "Lịch sử làm bài" | Người dùng truy cập vào trang "Lịch sử làm bài" | Người dùng truy cập vào trang "Lịch sử làm bài" |
| Tiền điều kiện | Người dùng đã đăng nhập vào hệ thống | Người dùng đã đăng nhập vào hệ thống | Người dùng đã đăng nhập vào hệ thống |
| Luồng sự kiện chính <br> (Thành công) |  |  |  |
| Luồng sự kiện thay thế |  |  |  |
| Hậu điều kiện | Người dùng có thể xem lại tổng quan lịch sử làm bài và chi tiết từng bài thi để đối chiếu đáp án, rút kinh nghiệm. | Người dùng có thể xem lại tổng quan lịch sử làm bài và chi tiết từng bài thi để đối chiếu đáp án, rút kinh nghiệm. | Người dùng có thể xem lại tổng quan lịch sử làm bài và chi tiết từng bài thi để đối chiếu đáp án, rút kinh nghiệm. |

Theo dõi hành vi người dùng và đề thi


#### Bảng 18

| Mã Use case | A_Tracking | Tên Use case | Theo dõi hành vi người dùng và Đề thi |
| --- | --- | --- | --- |
| Tác nhân | Quản trị viên | Quản trị viên | Quản trị viên |
| Sự kiện kích hoạt | Quản trị viên truy cập vào phân hệ Theo dõi và Phân tích để yêu cầu xem báo cáo. | Quản trị viên truy cập vào phân hệ Theo dõi và Phân tích để yêu cầu xem báo cáo. | Quản trị viên truy cập vào phân hệ Theo dõi và Phân tích để yêu cầu xem báo cáo. |
| Tiền điều kiện | Quản trị viên đã đăng nhập thành công vào hệ thống và được cấp quyền xem báo cáo. | Quản trị viên đã đăng nhập thành công vào hệ thống và được cấp quyền xem báo cáo. | Quản trị viên đã đăng nhập thành công vào hệ thống và được cấp quyền xem báo cáo. |
| Luồng sự kiện chính <br> (Thành công) |  |  |  |
| Luồng sự kiện thay thế |  |  |  |
| Hậu điều kiện | Dữ liệu hành vi của học viên hoặc hiệu quả của kho đề thi được trích xuất và hiển thị chính xác để quản trị viên đối soát, đánh giá tình hình vận hành của nền tảng. | Dữ liệu hành vi của học viên hoặc hiệu quả của kho đề thi được trích xuất và hiển thị chính xác để quản trị viên đối soát, đánh giá tình hình vận hành của nền tảng. | Dữ liệu hành vi của học viên hoặc hiệu quả của kho đề thi được trích xuất và hiển thị chính xác để quản trị viên đối soát, đánh giá tình hình vận hành của nền tảng. |

Quản trị người dùng tổng quan


#### Bảng 19

| Mã Use case | UC15 | Tên Use case | Quản trị Người dùng Tổng quan |
| --- | --- | --- | --- |
| Tác nhân | Quản trị viên | Quản trị viên | Quản trị viên |
| Sự kiện kích hoạt | Quản trị viên truy cập vào phân hệ Quản lý người dùng để tra cứu danh sách hoặc xem chi tiết tài khoản học viên. | Quản trị viên truy cập vào phân hệ Quản lý người dùng để tra cứu danh sách hoặc xem chi tiết tài khoản học viên. | Quản trị viên truy cập vào phân hệ Quản lý người dùng để tra cứu danh sách hoặc xem chi tiết tài khoản học viên. |
| Tiền điều kiện | Quản trị viên đã đăng nhập thành công vào hệ thống và được cấp quyền quản trị người dùng. | Quản trị viên đã đăng nhập thành công vào hệ thống và được cấp quyền quản trị người dùng. | Quản trị viên đã đăng nhập thành công vào hệ thống và được cấp quyền quản trị người dùng. |
| Luồng sự kiện chính <br> (Thành công) |  |  |  |
| Luồng sự kiện thay thế |  |  |  |
| Hậu điều kiện | Quản trị viên trích xuất được danh sách người dùng theo đúng bộ lọc hoặc xem được thông tin hồ sơ chi tiết một cách chính xác để phục vụ cho các thao tác quản trị tiếp theo (như Khóa/Mở khóa tài khoản). | Quản trị viên trích xuất được danh sách người dùng theo đúng bộ lọc hoặc xem được thông tin hồ sơ chi tiết một cách chính xác để phục vụ cho các thao tác quản trị tiếp theo (như Khóa/Mở khóa tài khoản). | Quản trị viên trích xuất được danh sách người dùng theo đúng bộ lọc hoặc xem được thông tin hồ sơ chi tiết một cách chính xác để phục vụ cho các thao tác quản trị tiếp theo (như Khóa/Mở khóa tài khoản). |

Khoá / Mở khoá tài khoản học viên


#### Bảng 20

| Mã Use case | UC15.1 | Tên Use case | Khóa / Mở khóa tài khoản học viên |
| --- | --- | --- | --- |
| Tác nhân | Quản trị viên | Quản trị viên | Quản trị viên |
| Sự kiện kích hoạt | Quản trị viên phát hiện tài khoản học viên có dấu hiệu vi phạm cần xử lý, hoặc có yêu cầu khôi phục lại tài khoản đã bị khóa trước đó. | Quản trị viên phát hiện tài khoản học viên có dấu hiệu vi phạm cần xử lý, hoặc có yêu cầu khôi phục lại tài khoản đã bị khóa trước đó. | Quản trị viên phát hiện tài khoản học viên có dấu hiệu vi phạm cần xử lý, hoặc có yêu cầu khôi phục lại tài khoản đã bị khóa trước đó. |
| Tiền điều kiện | Quản trị viên đã đăng nhập thành công vào hệ thống, được phân quyền quản trị và đang truy cập vào trang hồ sơ của một học viên cụ thể. | Quản trị viên đã đăng nhập thành công vào hệ thống, được phân quyền quản trị và đang truy cập vào trang hồ sơ của một học viên cụ thể. | Quản trị viên đã đăng nhập thành công vào hệ thống, được phân quyền quản trị và đang truy cập vào trang hồ sơ của một học viên cụ thể. |
| Luồng sự kiện chính <br> (Thành công) |  |  |  |
| Luồng sự kiện thay thế |  |  |  |
| Hậu điều kiện | Trạng thái tài khoản được cập nhật chính xác. Nếu khóa, học viên bị hủy phiên làm việc trên Redis và đuổi khỏi hệ thống lập tức; nếu mở khóa, học viên đăng nhập lại bình thường. | Trạng thái tài khoản được cập nhật chính xác. Nếu khóa, học viên bị hủy phiên làm việc trên Redis và đuổi khỏi hệ thống lập tức; nếu mở khóa, học viên đăng nhập lại bình thường. | Trạng thái tài khoản được cập nhật chính xác. Nếu khóa, học viên bị hủy phiên làm việc trên Redis và đuổi khỏi hệ thống lập tức; nếu mở khóa, học viên đăng nhập lại bình thường. |

Cấu hình hạn mức quota sử dụng AI


#### Bảng 21

| Mã Use case | UC15.3 | Tên Use case | Cấu hình Hạn mức Quota sử dụng AI |
| --- | --- | --- | --- |
| Tác nhân | Quản trị viên | Quản trị viên | Quản trị viên |
| Sự kiện kích hoạt | Quản trị viên truy cập vào phân hệ Cấu hình Quota AI để thiết lập số lượt gọi AI tối đa cho các tính năng hệ thống đối với từng nhóm tài khoản. | Quản trị viên truy cập vào phân hệ Cấu hình Quota AI để thiết lập số lượt gọi AI tối đa cho các tính năng hệ thống đối với từng nhóm tài khoản. | Quản trị viên truy cập vào phân hệ Cấu hình Quota AI để thiết lập số lượt gọi AI tối đa cho các tính năng hệ thống đối với từng nhóm tài khoản. |
| Tiền điều kiện | Quản trị viên đã đăng nhập thành công vào hệ thống và được cấp quyền cấu hình hệ thống. | Quản trị viên đã đăng nhập thành công vào hệ thống và được cấp quyền cấu hình hệ thống. | Quản trị viên đã đăng nhập thành công vào hệ thống và được cấp quyền cấu hình hệ thống. |
| Luồng sự kiện chính <br> (Thành công) |  |  |  |
| Luồng sự kiện thay thế |  |  |  |
| Hậu điều kiện | Tham số hạn mức (max_limit) mới của nhóm tài khoản được cập nhật chính xác vào cơ sở dữ liệu, có hiệu lực giới hạn lập tức đối với người dùng. Toàn bộ thao tác thay đổi cấu hình đều được ghi vết lại vào nhật ký kiểm toán (Audit Logs). | Tham số hạn mức (max_limit) mới của nhóm tài khoản được cập nhật chính xác vào cơ sở dữ liệu, có hiệu lực giới hạn lập tức đối với người dùng. Toàn bộ thao tác thay đổi cấu hình đều được ghi vết lại vào nhật ký kiểm toán (Audit Logs). | Tham số hạn mức (max_limit) mới của nhóm tài khoản được cập nhật chính xác vào cơ sở dữ liệu, có hiệu lực giới hạn lập tức đối với người dùng. Toàn bộ thao tác thay đổi cấu hình đều được ghi vết lại vào nhật ký kiểm toán (Audit Logs). |

Xem nhật ký kiểm toán an ninh


#### Bảng 22

| Mã Use case | UC15.4 (A_Audit) | Tên Use case | Xem Nhật ký kiểm toán an ninh |
| --- | --- | --- | --- |
| Tác nhân | Quản trị viên | Quản trị viên | Quản trị viên |
| Sự kiện kích hoạt | Quản trị viên truy cập trang Kiểm toán để xem vết thao tác (sửa/xóa đề thi, đổi quyền...) nhằm mục đích đối soát hoặc phân tích sự cố. | Quản trị viên truy cập trang Kiểm toán để xem vết thao tác (sửa/xóa đề thi, đổi quyền...) nhằm mục đích đối soát hoặc phân tích sự cố. | Quản trị viên truy cập trang Kiểm toán để xem vết thao tác (sửa/xóa đề thi, đổi quyền...) nhằm mục đích đối soát hoặc phân tích sự cố. |
| Tiền điều kiện | Quản trị viên đã đăng nhập thành công vào hệ thống và được phân quyền truy cập phân hệ nhật ký kiểm toán (Audit Logs). | Quản trị viên đã đăng nhập thành công vào hệ thống và được phân quyền truy cập phân hệ nhật ký kiểm toán (Audit Logs). | Quản trị viên đã đăng nhập thành công vào hệ thống và được phân quyền truy cập phân hệ nhật ký kiểm toán (Audit Logs). |
| Luồng sự kiện chính <br> (Thành công) |  |  |  |
| Luồng sự kiện thay thế |  |  |  |
| Hậu điều kiện | Quản trị viên trích xuất thành công toàn bộ vết thao tác nhạy cảm trên hệ thống kèm theo dữ liệu bản chụp (snapshot JSON) để thực hiện đối soát, đánh giá an ninh một cách chính xác. | Quản trị viên trích xuất thành công toàn bộ vết thao tác nhạy cảm trên hệ thống kèm theo dữ liệu bản chụp (snapshot JSON) để thực hiện đối soát, đánh giá an ninh một cách chính xác. | Quản trị viên trích xuất thành công toàn bộ vết thao tác nhạy cảm trên hệ thống kèm theo dữ liệu bản chụp (snapshot JSON) để thực hiện đối soát, đánh giá an ninh một cách chính xác. |

Báo cáo Vận hành & Doanh thu Tổng quan


#### Bảng 23

| Mã Use case | UC16 | Tên Use case | Báo cáo Vận hành & Doanh thu Tổng quan |
| --- | --- | --- | --- |
| Tác nhân | Quản trị viên | Quản trị viên | Quản trị viên |
| Sự kiện kích hoạt | Quản trị viên truy cập vào Dashboard để xem tình hình hoạt động của hệ thống, bao gồm số lượng người dùng truy cập, tỷ lệ chuyển đổi và doanh thu tài chính. | Quản trị viên truy cập vào Dashboard để xem tình hình hoạt động của hệ thống, bao gồm số lượng người dùng truy cập, tỷ lệ chuyển đổi và doanh thu tài chính. | Quản trị viên truy cập vào Dashboard để xem tình hình hoạt động của hệ thống, bao gồm số lượng người dùng truy cập, tỷ lệ chuyển đổi và doanh thu tài chính. |
| Tiền điều kiện | Quản trị viên đã đăng nhập hệ thống thành công và được phân quyền xem báo cáo thống kê cấp cao. | Quản trị viên đã đăng nhập hệ thống thành công và được phân quyền xem báo cáo thống kê cấp cao. | Quản trị viên đã đăng nhập hệ thống thành công và được phân quyền xem báo cáo thống kê cấp cao. |
| Luồng sự kiện chính <br> (Thành công) |  |  |  |
| Hậu điều kiện | Báo cáo vận hành và doanh thu được kết xuất, đóng gói và hiển thị trực quan thành các biểu đồ trên Dashboard để Quản trị viên đối soát, đánh giá tình hình kinh doanh của nền tảng. | Báo cáo vận hành và doanh thu được kết xuất, đóng gói và hiển thị trực quan thành các biểu đồ trên Dashboard để Quản trị viên đối soát, đánh giá tình hình kinh doanh của nền tảng. | Báo cáo vận hành và doanh thu được kết xuất, đóng gói và hiển thị trực quan thành các biểu đồ trên Dashboard để Quản trị viên đối soát, đánh giá tình hình kinh doanh của nền tảng. |

Tra cứu & Đối soát giao dịch VNPAY


#### Bảng 24

| Mã Use case | UC16.2 | Tên Use case | Tra cứu & Đối soát giao dịch VNPAY |
| --- | --- | --- | --- |
| Tác nhân | Quản trị viên | Quản trị viên | Quản trị viên |
| Sự kiện kích hoạt | Quản trị viên truy cập vào phân hệ đối soát để tra cứu các giao dịch thanh toán bị lỗi, có khiếu nại, hoặc cần kiểm tra dòng tiền định kỳ. | Quản trị viên truy cập vào phân hệ đối soát để tra cứu các giao dịch thanh toán bị lỗi, có khiếu nại, hoặc cần kiểm tra dòng tiền định kỳ. | Quản trị viên truy cập vào phân hệ đối soát để tra cứu các giao dịch thanh toán bị lỗi, có khiếu nại, hoặc cần kiểm tra dòng tiền định kỳ. |
| Tiền điều kiện | Quản trị viên đã đăng nhập thành công và được phân quyền xem, quản lý các giao dịch tài chính của hệ thống. | Quản trị viên đã đăng nhập thành công và được phân quyền xem, quản lý các giao dịch tài chính của hệ thống. | Quản trị viên đã đăng nhập thành công và được phân quyền xem, quản lý các giao dịch tài chính của hệ thống. |
| Luồng sự kiện chính <br> (Thành công) |  |  |  |
| Luồng sự kiện thay thế |  |  |  |
| Hậu điều kiện | Quản trị viên tra cứu thành công thông tin giao dịch, thực hiện đối soát giữa dữ liệu trên hệ thống (transactions) với dữ liệu từ cổng thanh toán VNPAY, đồng thời hoàn tất việc xử lý khiếu nại của học viên (nếu có). | Quản trị viên tra cứu thành công thông tin giao dịch, thực hiện đối soát giữa dữ liệu trên hệ thống (transactions) với dữ liệu từ cổng thanh toán VNPAY, đồng thời hoàn tất việc xử lý khiếu nại của học viên (nếu có). | Quản trị viên tra cứu thành công thông tin giao dịch, thực hiện đối soát giữa dữ liệu trên hệ thống (transactions) với dữ liệu từ cổng thanh toán VNPAY, đồng thời hoàn tất việc xử lý khiếu nại của học viên (nếu có). |

Xuất báo cáo tài chính định kỳ


#### Bảng 25

| Mã Use case | UC16.3 | Tên Use case | Xuất báo cáo tài chính định kỳ |
| --- | --- | --- | --- |
| Tác nhân | Quản trị viên | Quản trị viên | Quản trị viên |
| Sự kiện kích hoạt | Quản trị viên có nhu cầu trích xuất dữ liệu doanh thu và lịch sử giao dịch ra tệp tin ngoại tuyến để báo cáo hoặc lưu trữ định kỳ. | Quản trị viên có nhu cầu trích xuất dữ liệu doanh thu và lịch sử giao dịch ra tệp tin ngoại tuyến để báo cáo hoặc lưu trữ định kỳ. | Quản trị viên có nhu cầu trích xuất dữ liệu doanh thu và lịch sử giao dịch ra tệp tin ngoại tuyến để báo cáo hoặc lưu trữ định kỳ. |
| Tiền điều kiện | Quản trị viên đã đăng nhập thành công vào hệ thống và được phân quyền xem, xuất báo cáo giao dịch tài chính. | Quản trị viên đã đăng nhập thành công vào hệ thống và được phân quyền xem, xuất báo cáo giao dịch tài chính. | Quản trị viên đã đăng nhập thành công vào hệ thống và được phân quyền xem, xuất báo cáo giao dịch tài chính. |
| Luồng sự kiện chính <br> (Thành công) |  |  |  |
| Hậu điều kiện | File báo cáo tài chính (định dạng Excel hoặc PDF) chứa dữ liệu doanh thu chính xác được sinh ra và tải xuống thành công về thiết bị của Quản trị viên. | File báo cáo tài chính (định dạng Excel hoặc PDF) chứa dữ liệu doanh thu chính xác được sinh ra và tải xuống thành công về thiết bị của Quản trị viên. | File báo cáo tài chính (định dạng Excel hoặc PDF) chứa dữ liệu doanh thu chính xác được sinh ra và tải xuống thành công về thiết bị của Quản trị viên. |

TÀI LIỆU ĐẶC TẢ USE CASE HỆ THỐNG MULTILINGO

Phân hệ: Không gian Thi thử, Luyện tập từng phần & Trợ lý AI (Gemini)

UC08: Làm bài thi thử & luyện tập từng phần


#### Bảng 26

| Mã Use case | UC08 | Tên Use case | Làm bài thi thử & luyện tập từng phần |
| --- | --- | --- | --- |
| Tác nhân | Người dùng (Học viên) | Người dùng (Học viên) | Người dùng (Học viên) |
| Sự kiện <br> kích hoạt | Học viên chọn một đề thi và chọn chế độ làm bài từ Thư viện đề thi. | Học viên chọn một đề thi và chọn chế độ làm bài từ Thư viện đề thi. | Học viên chọn một đề thi và chọn chế độ làm bài từ Thư viện đề thi. |
| Tiền điều <br> kiện | Học viên đã đăng nhập vào hệ thống; Đề thi ở trạng thái xuất bản. | Học viên đã đăng nhập vào hệ thống; Đề thi ở trạng thái xuất bản. | Học viên đã đăng nhập vào hệ thống; Đề thi ở trạng thái xuất bản. |
| Luồng sự <br> kiện chính <br>  <br> (Thành <br> công) |  |  |  |
| Luồng sự <br> kiện thay <br> thế |  |  |  |
| Hậu điều <br> kiện | Bài làm của học viên được lưu vào hệ thống và chuyển sang tiến trình chấm điểm. | Bài làm của học viên được lưu vào hệ thống và chuyển sang tiến trình chấm điểm. | Bài làm của học viên được lưu vào hệ thống và chuyển sang tiến trình chấm điểm. |

2. UC08.1: Highlight đoạn văn bài đọc


#### Bảng 27

| Mã Use case | UC08.1 | Tên Use case | Highlight đoạn văn bài đọc |
| --- | --- | --- | --- |
| Tác nhân | Người dùng (Học viên) | Người dùng (Học viên) | Người dùng (Học viên) |
| Sự kiện <br> kích hoạt | Học viên bôi đen đoạn văn bản trong bài đọc hiểu và chọn "Highlight". | Học viên bôi đen đoạn văn bản trong bài đọc hiểu và chọn "Highlight". | Học viên bôi đen đoạn văn bản trong bài đọc hiểu và chọn "Highlight". |
| Tiền điều <br> kiện | Học viên đang ở giao diện làm bài thi hoặc luyện tập có phần đọc hiểu. | Học viên đang ở giao diện làm bài thi hoặc luyện tập có phần đọc hiểu. | Học viên đang ở giao diện làm bài thi hoặc luyện tập có phần đọc hiểu. |
| Luồng sự <br> kiện chính <br>  <br> (Thành <br> công) |  |  |  |
| Luồng sự <br> kiện thay <br> thế |  |  |  |
| Hậu điều <br> kiện | Đoạn văn bản được đánh dấu màu vàng trực quan và lưu trong phiên làm bài. | Đoạn văn bản được đánh dấu màu vàng trực quan và lưu trong phiên làm bài. | Đoạn văn bản được đánh dấu màu vàng trực quan và lưu trong phiên làm bài. |

3. UC08.4: Gợi ý dàn ý & Từ vựng từ AI (Writing Hints)


#### Bảng 28

| Mã Use case | UC08.4 | Tên Use case | Gợi ý dàn ý & Từ vựng từ AI (Writing Hints) |
| --- | --- | --- | --- |
| Tác nhân | Người dùng (Học viên), Hệ thống Gemini AI | Người dùng (Học viên), Hệ thống Gemini AI | Người dùng (Học viên), Hệ thống Gemini AI |
| Sự kiện <br> kích hoạt | Học viên bấm nút "💡 Gợi ý AI Hints" trong khung làm bài Writing. | Học viên bấm nút "💡 Gợi ý AI Hints" trong khung làm bài Writing. | Học viên bấm nút "💡 Gợi ý AI Hints" trong khung làm bài Writing. |
| Tiền điều <br> kiện | Học viên đang ở chế độ luyện tập phần Writing; tài khoản còn hạn mức gọi AI. | Học viên đang ở chế độ luyện tập phần Writing; tài khoản còn hạn mức gọi AI. | Học viên đang ở chế độ luyện tập phần Writing; tài khoản còn hạn mức gọi AI. |
| Luồng sự <br> kiện chính <br>  <br> (Thành <br> công) |  |  |  |
| Luồng sự <br> kiện thay <br> thế |  |  |  |
| Hậu điều <br> kiện | Dàn ý và từ vựng gợi ý được hiển thị cho học viên; cập nhật lượt sử dụng AI. | Dàn ý và từ vựng gợi ý được hiển thị cho học viên; cập nhật lượt sử dụng AI. | Dàn ý và từ vựng gợi ý được hiển thị cho học viên; cập nhật lượt sử dụng AI. |

4. UC08.5: Tự động thu bài khi hết giờ


#### Bảng 29

| Mã Use case | UC08.5 | Tên Use case | Tự động thu bài khi hết giờ |
| --- | --- | --- | --- |
| Tác nhân | Hệ thống | Hệ thống | Hệ thống |
| Sự kiện <br> kích hoạt | Đồng hồ đếm ngược của bài thi Mock Test chạm mốc 00:00. | Đồng hồ đếm ngược của bài thi Mock Test chạm mốc 00:00. | Đồng hồ đếm ngược của bài thi Mock Test chạm mốc 00:00. |
| Tiền điều <br> kiện | Học viên đang làm bài thi ở chế độ thi thử tính giờ. | Học viên đang làm bài thi ở chế độ thi thử tính giờ. | Học viên đang làm bài thi ở chế độ thi thử tính giờ. |
| Luồng sự <br> kiện chính <br>  <br> (Thành <br> công) |  |  |  |
| Luồng sự <br> kiện thay <br> thế |  |  |  |
| Hậu điều <br> kiện | Bài thi được tự động thu, lưu vào cơ sở dữ liệu và chuyển sang chấm điểm. | Bài thi được tự động thu, lưu vào cơ sở dữ liệu và chuyển sang chấm điểm. | Bài thi được tự động thu, lưu vào cơ sở dữ liệu và chuyển sang chấm điểm. |

5. UC09: Chấm điểm trắc nghiệm & điền từ tự động


#### Bảng 30

| Mã Use case | UC09 | Tên Use case | Chấm điểm trắc nghiệm & điền từ tự động |
| --- | --- | --- | --- |
| Tác nhân | Hệ thống | Hệ thống | Hệ thống |
| Sự kiện <br> kích hoạt | Học viên nộp bài thi hoặc hệ thống tự động thu bài khi hết giờ (UC08.5). | Học viên nộp bài thi hoặc hệ thống tự động thu bài khi hết giờ (UC08.5). | Học viên nộp bài thi hoặc hệ thống tự động thu bài khi hết giờ (UC08.5). |
| Tiền điều <br> kiện | Bài làm đã được nộp có chứa câu hỏi trắc nghiệm hoặc điền từ. | Bài làm đã được nộp có chứa câu hỏi trắc nghiệm hoặc điền từ. | Bài làm đã được nộp có chứa câu hỏi trắc nghiệm hoặc điền từ. |
| Luồng sự <br> kiện chính <br>  <br> (Thành <br> công) |  |  |  |
| Luồng sự <br> kiện thay <br> thế |  |  |  |
| Hậu điều <br> kiện | Điểm số và trạng thái Đúng/Sai từng câu được lưu vào cơ sở dữ liệu. | Điểm số và trạng thái Đúng/Sai từng câu được lưu vào cơ sở dữ liệu. | Điểm số và trạng thái Đúng/Sai từng câu được lưu vào cơ sở dữ liệu. |

6. UC09.2: Chấm điểm Writing bằng Gemini AI


#### Bảng 31

| Mã Use case | UC09.2 | Tên Use case | Chấm điểm Writing bằng Gemini AI |
| --- | --- | --- | --- |
| Tác nhân | Hệ thống, Hệ thống Gemini AI | Hệ thống, Hệ thống Gemini AI | Hệ thống, Hệ thống Gemini AI |
| Sự kiện <br> kích hoạt | Học viên hoàn thành và nộp bài thi có phần tự luận (Writing). | Học viên hoàn thành và nộp bài thi có phần tự luận (Writing). | Học viên hoàn thành và nộp bài thi có phần tự luận (Writing). |
| Tiền điều <br> kiện | Bài viết đạt độ dài tối thiểu theo quy định (> 10 từ). | Bài viết đạt độ dài tối thiểu theo quy định (> 10 từ). | Bài viết đạt độ dài tối thiểu theo quy định (> 10 từ). |
| Luồng sự <br> kiện chính <br>  <br> (Thành <br> công) |  |  |  |
| Luồng sự <br> kiện thay <br> thế |  |  |  |
| Hậu điều <br> kiện | Điểm 4 tiêu chí, nhận xét và câu sửa từ AI được lưu vào cơ sở dữ liệu. | Điểm 4 tiêu chí, nhận xét và câu sửa từ AI được lưu vào cơ sở dữ liệu. | Điểm 4 tiêu chí, nhận xét và câu sửa từ AI được lưu vào cơ sở dữ liệu. |

7. UC10: Xem kết quả bài thi & Lời giải chi tiết


#### Bảng 32

| Mã Use case | UC10 | Tên Use case | Xem kết quả bài thi & Lời giải chi tiết |
| --- | --- | --- | --- |
| Tác nhân | Người dùng (Học viên) | Người dùng (Học viên) | Người dùng (Học viên) |
| Sự kiện <br> kích hoạt | Học viên hoàn thành nộp bài thi hoặc chọn xem lại bài thi từ trang Lịch sử làm bài. | Học viên hoàn thành nộp bài thi hoặc chọn xem lại bài thi từ trang Lịch sử làm bài. | Học viên hoàn thành nộp bài thi hoặc chọn xem lại bài thi từ trang Lịch sử làm bài. |
| Tiền điều <br> kiện | Bài thi đã hoàn tất quá trình chấm điểm. | Bài thi đã hoàn tất quá trình chấm điểm. | Bài thi đã hoàn tất quá trình chấm điểm. |
| Luồng sự <br> kiện chính <br>  <br> (Thành <br> công) |  |  |  |
| Luồng sự <br> kiện thay <br> thế |  |  |  |
| Hậu điều <br> kiện | Học viên xem được bảng điểm tổng quan, chi tiết từng câu và lời giải tương ứng. | Học viên xem được bảng điểm tổng quan, chi tiết từng câu và lời giải tương ứng. | Học viên xem được bảng điểm tổng quan, chi tiết từng câu và lời giải tương ứng. |

8. UC10.2: Xem nhận xét AI & Giao diện Diff-View sửa lỗi


#### Bảng 33

| Mã Use case | UC10.2 | Tên Use case | Xem nhận xét AI & Giao diện Diff-View sửa lỗi |
| --- | --- | --- | --- |
| Tác nhân | Người dùng (Học viên) | Người dùng (Học viên) | Người dùng (Học viên) |
| Sự kiện <br> kích hoạt | Học viên mở tab kết quả bài Writing trên trang kết quả bài thi. | Học viên mở tab kết quả bài Writing trên trang kết quả bài thi. | Học viên mở tab kết quả bài Writing trên trang kết quả bài thi. |
| Tiền điều <br> kiện | Bài viết Writing đã được Gemini AI hoàn tất chấm điểm. | Bài viết Writing đã được Gemini AI hoàn tất chấm điểm. | Bài viết Writing đã được Gemini AI hoàn tất chấm điểm. |
| Luồng sự <br> kiện chính <br>  <br> (Thành <br> công) |  |  |  |
| Luồng sự <br> kiện thay <br> thế |  |  |  |
| Hậu điều <br> kiện | Học viên xem được nhận xét chi tiết và giao diện sửa lỗi trực quan của AI. | Học viên xem được nhận xét chi tiết và giao diện sửa lỗi trực quan của AI. | Học viên xem được nhận xét chi tiết và giao diện sửa lỗi trực quan của AI. |


#### Bảng 34

| Mã Use case | UC001 | Tên Use case | Đăng ký tài khoản |
| --- | --- | --- | --- |
| Tác nhân | User | User | User |
| Sự kiện kích hoạt | User click vào nút Đăng ký trên giao diện website | User click vào nút Đăng ký trên giao diện website | User click vào nút Đăng ký trên giao diện website |
| Tiền điều kiện | User chưa có tài khoản trong hệ thống | User chưa có tài khoản trong hệ thống | User chưa có tài khoản trong hệ thống |
| Luồng sự kiện chính <br> (Thành công) |  |  |  |
| Luồng sự kiện thay thế |  |  |  |
| Hậu điều kiện | Tài khoản mới được khởi tạo và lưu trữ thành công vào hệ thống, User được điều hướng đến trang Đăng nhập | Tài khoản mới được khởi tạo và lưu trữ thành công vào hệ thống, User được điều hướng đến trang Đăng nhập | Tài khoản mới được khởi tạo và lưu trữ thành công vào hệ thống, User được điều hướng đến trang Đăng nhập |

2) UC đăng nhập


#### Bảng 35

| Mã Use case | UC002 | Tên Use case | Đăng nhập |
| --- | --- | --- | --- |
| Tác nhân | User, Admin | User, Admin | User, Admin |
| Sự kiện kích hoạt | Admin, User chọn chức năng "Đăng nhập" trên giao diện. | Admin, User chọn chức năng "Đăng nhập" trên giao diện. | Admin, User chọn chức năng "Đăng nhập" trên giao diện. |
| Tiền điều kiện | User đã có tài khoản trong hệ thống | User đã có tài khoản trong hệ thống | User đã có tài khoản trong hệ thống |
| Luồng sự kiện chính <br> (Thành công) |  |  |  |
| Luồng sự kiện thay thế |  |  |  |
| Hậu điều kiện | Admin hoặc User đăng nhập thành công vào hệ thống và được phân quyền, điều hướng đến màn hình chức năng tương ứng của mình. | Admin hoặc User đăng nhập thành công vào hệ thống và được phân quyền, điều hướng đến màn hình chức năng tương ứng của mình. | Admin hoặc User đăng nhập thành công vào hệ thống và được phân quyền, điều hướng đến màn hình chức năng tương ứng của mình. |

3)UC quên mật khẩu


#### Bảng 36

| Mã Use case | UC003 | Tên Use case | Quên mật khẩu |
| --- | --- | --- | --- |
| Tác nhân | User | User | User |
| Sự kiện kích hoạt | User nhấn chọn "Quên mật khẩu" tại giao diện đăng nhập. | User nhấn chọn "Quên mật khẩu" tại giao diện đăng nhập. | User nhấn chọn "Quên mật khẩu" tại giao diện đăng nhập. |
| Tiền điều kiện | Người dùng đã đăng ký tài khoản bằng Email trong hệ thống. | Người dùng đã đăng ký tài khoản bằng Email trong hệ thống. | Người dùng đã đăng ký tài khoản bằng Email trong hệ thống. |
| Luồng sự kiện chính <br> (Thành công) |  |  |  |
| Luồng sự kiện thay thế |  |  |  |
| Hậu điều kiện | Mật khẩu mới của User được lưu thành công vào cơ sở dữ liệu. User có thể sử dụng mật khẩu mới để đăng nhập vào hệ thống. | Mật khẩu mới của User được lưu thành công vào cơ sở dữ liệu. User có thể sử dụng mật khẩu mới để đăng nhập vào hệ thống. | Mật khẩu mới của User được lưu thành công vào cơ sở dữ liệu. User có thể sử dụng mật khẩu mới để đăng nhập vào hệ thống. |

4) UC chỉnh sửa hồ sơ cá nhân


#### Bảng 37

| Mã Use case | UC001 | Tên Use case | Cập nhật hồ sơ cá nhân |
| --- | --- | --- | --- |
| Tác nhân | User | User | User |
| Sự kiện kích hoạt | User nhấn chọn mục "Hồ sơ cá nhân" trên giao diện | User nhấn chọn mục "Hồ sơ cá nhân" trên giao diện | User nhấn chọn mục "Hồ sơ cá nhân" trên giao diện |
| Tiền điều kiện | Người dùng đã đăng nhập thành công vào hệ thống. | Người dùng đã đăng nhập thành công vào hệ thống. | Người dùng đã đăng nhập thành công vào hệ thống. |
| Luồng sự kiện chính <br> (Thành công) |  |  |  |
| Luồng sự kiện thay thế |  |  |  |
| Hậu điều kiện | Thông tin cá nhân mới của User được cập nhật thành công trong cơ sở dữ liệu và được hiển thị trong hồ sơ của User ở các lần truy cập sau. | Thông tin cá nhân mới của User được cập nhật thành công trong cơ sở dữ liệu và được hiển thị trong hồ sơ của User ở các lần truy cập sau. | Thông tin cá nhân mới của User được cập nhật thành công trong cơ sở dữ liệu và được hiển thị trong hồ sơ của User ở các lần truy cập sau. |

5) UC đổi mật khẩu


#### Bảng 38

| Mã Use case | UC005 | Tên Use case | Đổi mật khẩu |
| --- | --- | --- | --- |
| Tác nhân | User | User | User |
| Sự kiện kích hoạt | User click vào nút Đăng ký trên giao diện website | User click vào nút Đăng ký trên giao diện website | User click vào nút Đăng ký trên giao diện website |
| Tiền điều kiện | User chưa có tài khoản trong hệ thống | User chưa có tài khoản trong hệ thống | User chưa có tài khoản trong hệ thống |
| Luồng sự kiện chính <br> (Thành công) |  |  |  |
| Luồng sự kiện thay thế |  |  |  |
| Hậu điều kiện | Mật khẩu mới của User được mã hoá và lưu thành công vào cơ sở dữ liệu. Từ lần đăng nhập kế tiếp, User bắt buộc phải sử dụng mật khẩu mới này. | Mật khẩu mới của User được mã hoá và lưu thành công vào cơ sở dữ liệu. Từ lần đăng nhập kế tiếp, User bắt buộc phải sử dụng mật khẩu mới này. | Mật khẩu mới của User được mã hoá và lưu thành công vào cơ sở dữ liệu. Từ lần đăng nhập kế tiếp, User bắt buộc phải sử dụng mật khẩu mới này. |

6) UC nâng cấp tài khoản premium


#### Bảng 39

| Mã Use case | UC006 | Tên Use case | Nâng cấp tài khoản Premium |
| --- | --- | --- | --- |
| Tác nhân | User, Cổng thanh toán (Hệ thống bên thứ 3) | User, Cổng thanh toán (Hệ thống bên thứ 3) | User, Cổng thanh toán (Hệ thống bên thứ 3) |
| Sự kiện kích hoạt | User nhấn chọn chức năng "Nâng cấp tài khoản" trên giao diện hệ thống. | User nhấn chọn chức năng "Nâng cấp tài khoản" trên giao diện hệ thống. | User nhấn chọn chức năng "Nâng cấp tài khoản" trên giao diện hệ thống. |
| Tiền điều kiện | Người dùng đã đăng nhập và đang sử dụng tài khoản thường (hoặc gói cước thấp hơn). | Người dùng đã đăng nhập và đang sử dụng tài khoản thường (hoặc gói cước thấp hơn). | Người dùng đã đăng nhập và đang sử dụng tài khoản thường (hoặc gói cước thấp hơn). |
| Luồng sự kiện chính <br> (Thành công) |  |  |  |
| Luồng sự kiện thay thế |  |  |  |
| Hậu điều kiện | Tài khoản của User được cập nhật thành công gói Premium trong hệ thống cơ sở dữ liệu. User có thể bắt đầu sử dụng các tính năng cao cấp của ứng dụng/website. | Tài khoản của User được cập nhật thành công gói Premium trong hệ thống cơ sở dữ liệu. User có thể bắt đầu sử dụng các tính năng cao cấp của ứng dụng/website. | Tài khoản của User được cập nhật thành công gói Premium trong hệ thống cơ sở dữ liệu. User có thể bắt đầu sử dụng các tính năng cao cấp của ứng dụng/website. |

Biểu đồ tuần tự

1.Biểu đồ tuần tự UC đổi mật khẩu

2. Biểu đồ tuần tự UC đăng nhập

3. Biểu đồ tuần tự UC nâng cấp tài khoản

4.Biểu đồ tuần tự UC quên mật khẩu

5. Biểu đồ tuần tự UC đăng kí

6. Biểu đồ tuần tự UC sửa hồ sơ cá nhân

