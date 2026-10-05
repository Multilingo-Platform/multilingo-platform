# TÀI LIỆU ĐẶC TẢ USE CASE HỆ THỐNG MULTILINGO
### Phân hệ: Không gian Thi thử, Luyện tập từng phần & Trợ lý AI (Gemini)
**Tác nhân thực hiện chính:** Người dùng (Học viên), Hệ thống, Hệ thống Gemini AI  
**Danh sách Use Case đặc tả:** `UC08`, `UC08.1`, `UC08.4`, `UC08.5`, `UC09`, `UC09.2`, `UC10`, `UC10.2`  
**Tài liệu căn cứ:** Biểu đồ Use Case (`ndt-usecase-diagram.drawio`), Biểu đồ Hoạt động (`ndt-activity-diagram.drawio`), Biểu đồ Tuần tự (`ndt-sequence-diagram.drawio`), Các bảng CSDL liên quan (`test_attempts`, `attempt_answers`).

---

## 1. UC08: Làm bài thi thử & luyện tập từng phần

<table border="1" cellpadding="6" cellspacing="0" style="width: 100%; border-collapse: collapse; border: 1px solid #000; font-family: 'Times New Roman', Times, serif, Arial, sans-serif; font-size: 15px; margin-bottom: 40px;">
  <tr>
    <td style="width: 18%; font-weight: bold; text-align: center; vertical-align: middle; border: 1px solid #000; padding: 7px 10px;">Mã Use case</td>
    <td style="width: 28%; text-align: center; vertical-align: middle; border: 1px solid #000; padding: 7px 10px;">UC08</td>
    <td style="width: 20%; font-weight: bold; text-align: center; vertical-align: middle; border: 1px solid #000; padding: 7px 10px;">Tên Use case</td>
    <td style="width: 34%; text-align: center; vertical-align: middle; border: 1px solid #000; padding: 7px 10px;">Làm bài thi thử & luyện tập từng phần</td>
  </tr>
  <tr>
    <td style="font-weight: bold; text-align: center; vertical-align: middle; border: 1px solid #000; padding: 7px 10px;">Tác nhân</td>
    <td colspan="3" style="border: 1px solid #000; padding: 7px 10px;">Người dùng (Học viên)</td>
  </tr>
  <tr>
    <td style="font-weight: bold; text-align: center; vertical-align: middle; border: 1px solid #000; padding: 7px 10px;">Sự kiện<br>kích hoạt</td>
    <td colspan="3" style="border: 1px solid #000; padding: 7px 10px;">Học viên chọn một đề thi và chọn chế độ làm bài từ Thư viện đề thi.</td>
  </tr>
  <tr>
    <td style="font-weight: bold; text-align: center; vertical-align: middle; border: 1px solid #000; padding: 7px 10px;">Tiền điều<br>kiện</td>
    <td colspan="3" style="border: 1px solid #000; padding: 7px 10px;">Học viên đã đăng nhập vào hệ thống; Đề thi ở trạng thái xuất bản.</td>
  </tr>
  <tr>
    <td style="font-weight: bold; text-align: center; vertical-align: middle; border: 1px solid #000; padding: 10px;">
      Luồng sự<br>kiện chính<br><br>(Thành<br>công)
    </td>
    <td colspan="3" style="border: 1px solid #000; padding: 8px 10px;">
      <table border="1" cellpadding="6" cellspacing="0" style="width: 100%; border-collapse: collapse; border: 1px solid #000;">
        <tr>
          <td style="width: 8%; font-weight: bold; text-align: center; border: 1px solid #000; padding: 6px 4px;">STT</td>
          <td style="width: 20%; font-weight: bold; text-align: center; border: 1px solid #000; padding: 6px 8px; white-space: nowrap;">Thực hiện bởi</td>
          <td style="font-weight: bold; text-align: center; border: 1px solid #000; padding: 6px 8px;">Hành động</td>
        </tr>
        <tr>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 4px;">1.</td>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 8px; white-space: nowrap;">Người dùng</td>
          <td style="border: 1px solid #000; padding: 6px 8px;">Truy cập Thư viện đề thi và chọn đề thi mong muốn.</td>
        </tr>
        <tr>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 4px;">2.</td>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 8px; white-space: nowrap;">Người dùng</td>
          <td style="border: 1px solid #000; padding: 6px 8px;">Chọn chế độ làm bài: Thi thử tính giờ (Mock Test) hoặc Luyện tập từng phần (Practice).</td>
        </tr>
        <tr>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 4px;">3.</td>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 8px; white-space: nowrap;">Hệ thống</td>
          <td style="border: 1px solid #000; padding: 6px 8px;">Khởi tạo phiên làm bài mới trong cơ sở dữ liệu.</td>
        </tr>
        <tr>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 4px;">4.</td>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 8px; white-space: nowrap;">Hệ thống</td>
          <td style="border: 1px solid #000; padding: 6px 8px;">Tải nội dung đề thi (bài đọc, hình ảnh, âm thanh, câu hỏi).</td>
        </tr>
        <tr>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 4px;">5.</td>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 8px; white-space: nowrap;">Hệ thống</td>
          <td style="border: 1px solid #000; padding: 6px 8px;">Hiển thị giao diện làm bài thi và kích hoạt đồng hồ đếm ngược (nếu thi thử).</td>
        </tr>
        <tr>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 4px;">6.</td>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 8px; white-space: nowrap;">Người dùng</td>
          <td style="border: 1px solid #000; padding: 6px 8px;">Thao tác làm bài: nghe audio, đọc đề và chọn/nhập câu trả lời.</td>
        </tr>
        <tr>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 4px;">7.</td>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 8px; white-space: nowrap;">Người dùng</td>
          <td style="border: 1px solid #000; padding: 6px 8px;">Bấm nút "Nộp bài" (hoặc "Chấm đáp án" nếu luyện tập).</td>
        </tr>
        <tr>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 4px;">8.</td>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 8px; white-space: nowrap;">Hệ thống</td>
          <td style="border: 1px solid #000; padding: 6px 8px;">Lưu câu trả lời của học viên vào cơ sở dữ liệu.</td>
        </tr>
        <tr>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 4px;">9.</td>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 8px; white-space: nowrap;">Hệ thống</td>
          <td style="border: 1px solid #000; padding: 6px 8px;">Chuyển tiếp sang tiến trình chấm điểm tự động (UC09).</td>
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td style="font-weight: bold; text-align: center; vertical-align: middle; border: 1px solid #000; padding: 10px;">
      Luồng sự<br>kiện thay<br>thế
    </td>
    <td colspan="3" style="border: 1px solid #000; padding: 8px 10px;">
      <table border="1" cellpadding="6" cellspacing="0" style="width: 100%; border-collapse: collapse; border: 1px solid #000;">
        <tr>
          <td style="width: 8%; font-weight: bold; text-align: center; border: 1px solid #000; padding: 6px 4px;">STT</td>
          <td style="width: 20%; font-weight: bold; text-align: center; border: 1px solid #000; padding: 6px 8px; white-space: nowrap;">Thực hiện bởi</td>
          <td style="font-weight: bold; text-align: center; border: 1px solid #000; padding: 6px 8px;">Hành động</td>
        </tr>
        <tr>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 4px;">6a.</td>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 8px; white-space: nowrap;">Người dùng</td>
          <td style="border: 1px solid #000; padding: 6px 8px;">Bôi đen đoạn văn bản bài đọc và bấm "Highlight" (kích hoạt UC08.1).</td>
        </tr>
        <tr>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 4px;">6b.</td>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 8px; white-space: nowrap;">Người dùng</td>
          <td style="border: 1px solid #000; padding: 6px 8px;">Bấm "💡 Gợi ý AI Hints" khi luyện tập phần Viết (kích hoạt UC08.4).</td>
        </tr>
        <tr>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 4px;">6c.</td>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 8px; white-space: nowrap;">Hệ thống</td>
          <td style="border: 1px solid #000; padding: 6px 8px;">Đồng hồ đếm ngược chạm mốc 00:00 mà học viên chưa nộp bài (kích hoạt UC08.5).</td>
        </tr>
        <tr>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 4px;">7a.</td>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 8px; white-space: nowrap;">Hệ thống</td>
          <td style="border: 1px solid #000; padding: 6px 8px;">(Nếu mất kết nối mạng khi nộp bài) Lưu tạm bài làm vào trình duyệt và hiển thị nút "Thử gửi lại".</td>
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td style="font-weight: bold; text-align: center; vertical-align: middle; border: 1px solid #000; padding: 7px 10px;">Hậu điều<br>kiện</td>
    <td colspan="3" style="border: 1px solid #000; padding: 7px 10px;">Bài làm của học viên được lưu vào hệ thống và chuyển sang tiến trình chấm điểm.</td>
  </tr>
</table>

---

## 2. UC08.1: Highlight đoạn văn bài đọc

<table border="1" cellpadding="6" cellspacing="0" style="width: 100%; border-collapse: collapse; border: 1px solid #000; font-family: 'Times New Roman', Times, serif, Arial, sans-serif; font-size: 15px; margin-bottom: 40px;">
  <tr>
    <td style="width: 18%; font-weight: bold; text-align: center; vertical-align: middle; border: 1px solid #000; padding: 7px 10px;">Mã Use case</td>
    <td style="width: 28%; text-align: center; vertical-align: middle; border: 1px solid #000; padding: 7px 10px;">UC08.1</td>
    <td style="width: 20%; font-weight: bold; text-align: center; vertical-align: middle; border: 1px solid #000; padding: 7px 10px;">Tên Use case</td>
    <td style="width: 34%; text-align: center; vertical-align: middle; border: 1px solid #000; padding: 7px 10px;">Highlight đoạn văn bài đọc</td>
  </tr>
  <tr>
    <td style="font-weight: bold; text-align: center; vertical-align: middle; border: 1px solid #000; padding: 7px 10px;">Tác nhân</td>
    <td colspan="3" style="border: 1px solid #000; padding: 7px 10px;">Người dùng (Học viên)</td>
  </tr>
  <tr>
    <td style="font-weight: bold; text-align: center; vertical-align: middle; border: 1px solid #000; padding: 7px 10px;">Sự kiện<br>kích hoạt</td>
    <td colspan="3" style="border: 1px solid #000; padding: 7px 10px;">Học viên bôi đen đoạn văn bản trong bài đọc hiểu và chọn "Highlight".</td>
  </tr>
  <tr>
    <td style="font-weight: bold; text-align: center; vertical-align: middle; border: 1px solid #000; padding: 7px 10px;">Tiền điều<br>kiện</td>
    <td colspan="3" style="border: 1px solid #000; padding: 7px 10px;">Học viên đang ở giao diện làm bài thi hoặc luyện tập có phần đọc hiểu.</td>
  </tr>
  <tr>
    <td style="font-weight: bold; text-align: center; vertical-align: middle; border: 1px solid #000; padding: 10px;">
      Luồng sự<br>kiện chính<br><br>(Thành<br>công)
    </td>
    <td colspan="3" style="border: 1px solid #000; padding: 8px 10px;">
      <table border="1" cellpadding="6" cellspacing="0" style="width: 100%; border-collapse: collapse; border: 1px solid #000;">
        <tr>
          <td style="width: 8%; font-weight: bold; text-align: center; border: 1px solid #000; padding: 6px 4px;">STT</td>
          <td style="width: 20%; font-weight: bold; text-align: center; border: 1px solid #000; padding: 6px 8px; white-space: nowrap;">Thực hiện bởi</td>
          <td style="font-weight: bold; text-align: center; border: 1px solid #000; padding: 6px 8px;">Hành động</td>
        </tr>
        <tr>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 4px;">1.</td>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 8px; white-space: nowrap;">Người dùng</td>
          <td style="border: 1px solid #000; padding: 6px 8px;">Bôi đen đoạn văn bản cần đánh dấu trong bài đọc.</td>
        </tr>
        <tr>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 4px;">2.</td>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 8px; white-space: nowrap;">Hệ thống</td>
          <td style="border: 1px solid #000; padding: 6px 8px;">Hiển thị nút công cụ "Highlight" tại vị trí con trỏ chuột.</td>
        </tr>
        <tr>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 4px;">3.</td>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 8px; white-space: nowrap;">Người dùng</td>
          <td style="border: 1px solid #000; padding: 6px 8px;">Bấm nút "Highlight".</td>
        </tr>
        <tr>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 4px;">4.</td>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 8px; white-space: nowrap;">Hệ thống</td>
          <td style="border: 1px solid #000; padding: 6px 8px;">Đổi màu nền đoạn văn bản được chọn sang màu vàng trực quan.</td>
        </tr>
        <tr>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 4px;">5.</td>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 8px; white-space: nowrap;">Hệ thống</td>
          <td style="border: 1px solid #000; padding: 6px 8px;">Lưu tọa độ đoạn highlight vào trạng thái phiên làm bài.</td>
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td style="font-weight: bold; text-align: center; vertical-align: middle; border: 1px solid #000; padding: 10px;">
      Luồng sự<br>kiện thay<br>thế
    </td>
    <td colspan="3" style="border: 1px solid #000; padding: 8px 10px;">
      <table border="1" cellpadding="6" cellspacing="0" style="width: 100%; border-collapse: collapse; border: 1px solid #000;">
        <tr>
          <td style="width: 8%; font-weight: bold; text-align: center; border: 1px solid #000; padding: 6px 4px;">STT</td>
          <td style="width: 20%; font-weight: bold; text-align: center; border: 1px solid #000; padding: 6px 8px; white-space: nowrap;">Thực hiện bởi</td>
          <td style="font-weight: bold; text-align: center; border: 1px solid #000; padding: 6px 8px;">Hành động</td>
        </tr>
        <tr>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 4px;">3a.</td>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 8px; white-space: nowrap;">Người dùng</td>
          <td style="border: 1px solid #000; padding: 6px 8px;">Nhấp vào đoạn văn bản đã highlight trước đó.</td>
        </tr>
        <tr>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 4px;">3a.1</td>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 8px; white-space: nowrap;">Hệ thống</td>
          <td style="border: 1px solid #000; padding: 6px 8px;">Hiển thị nút "Xóa highlight".</td>
        </tr>
        <tr>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 4px;">3a.2</td>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 8px; white-space: nowrap;">Người dùng</td>
          <td style="border: 1px solid #000; padding: 6px 8px;">Bấm nút "Xóa highlight".</td>
        </tr>
        <tr>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 4px;">3a.3</td>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 8px; white-space: nowrap;">Hệ thống</td>
          <td style="border: 1px solid #000; padding: 6px 8px;">Gỡ bỏ highlight và khôi phục màu nền ban đầu.</td>
        </tr>
        <tr>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 4px;">3b.</td>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 8px; white-space: nowrap;">Người dùng</td>
          <td style="border: 1px solid #000; padding: 6px 8px;">Bôi đen vùng chọn vượt ra ngoài bài đọc.</td>
        </tr>
        <tr>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 4px;">3b.1</td>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 8px; white-space: nowrap;">Hệ thống</td>
          <td style="border: 1px solid #000; padding: 6px 8px;">Tự động giới hạn vùng chọn trong phạm vi bài đọc.</td>
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td style="font-weight: bold; text-align: center; vertical-align: middle; border: 1px solid #000; padding: 7px 10px;">Hậu điều<br>kiện</td>
    <td colspan="3" style="border: 1px solid #000; padding: 7px 10px;">Đoạn văn bản được đánh dấu màu vàng trực quan và lưu trong phiên làm bài.</td>
  </tr>
</table>

---

## 3. UC08.4: Gợi ý dàn ý & Từ vựng từ AI (Writing Hints)

<table border="1" cellpadding="6" cellspacing="0" style="width: 100%; border-collapse: collapse; border: 1px solid #000; font-family: 'Times New Roman', Times, serif, Arial, sans-serif; font-size: 15px; margin-bottom: 40px;">
  <tr>
    <td style="width: 18%; font-weight: bold; text-align: center; vertical-align: middle; border: 1px solid #000; padding: 7px 10px;">Mã Use case</td>
    <td style="width: 28%; text-align: center; vertical-align: middle; border: 1px solid #000; padding: 7px 10px;">UC08.4</td>
    <td style="width: 20%; font-weight: bold; text-align: center; vertical-align: middle; border: 1px solid #000; padding: 7px 10px;">Tên Use case</td>
    <td style="width: 34%; text-align: center; vertical-align: middle; border: 1px solid #000; padding: 7px 10px;">Gợi ý dàn ý & Từ vựng từ AI (Writing Hints)</td>
  </tr>
  <tr>
    <td style="font-weight: bold; text-align: center; vertical-align: middle; border: 1px solid #000; padding: 7px 10px;">Tác nhân</td>
    <td colspan="3" style="border: 1px solid #000; padding: 7px 10px;">Người dùng (Học viên), Hệ thống Gemini AI</td>
  </tr>
  <tr>
    <td style="font-weight: bold; text-align: center; vertical-align: middle; border: 1px solid #000; padding: 7px 10px;">Sự kiện<br>kích hoạt</td>
    <td colspan="3" style="border: 1px solid #000; padding: 7px 10px;">Học viên bấm nút "💡 Gợi ý AI Hints" trong khung làm bài Writing.</td>
  </tr>
  <tr>
    <td style="font-weight: bold; text-align: center; vertical-align: middle; border: 1px solid #000; padding: 7px 10px;">Tiền điều<br>kiện</td>
    <td colspan="3" style="border: 1px solid #000; padding: 7px 10px;">Học viên đang ở chế độ luyện tập phần Writing; tài khoản còn hạn mức gọi AI.</td>
  </tr>
  <tr>
    <td style="font-weight: bold; text-align: center; vertical-align: middle; border: 1px solid #000; padding: 10px;">
      Luồng sự<br>kiện chính<br><br>(Thành<br>công)
    </td>
    <td colspan="3" style="border: 1px solid #000; padding: 8px 10px;">
      <table border="1" cellpadding="6" cellspacing="0" style="width: 100%; border-collapse: collapse; border: 1px solid #000;">
        <tr>
          <td style="width: 8%; font-weight: bold; text-align: center; border: 1px solid #000; padding: 6px 4px;">STT</td>
          <td style="width: 20%; font-weight: bold; text-align: center; border: 1px solid #000; padding: 6px 8px; white-space: nowrap;">Thực hiện bởi</td>
          <td style="font-weight: bold; text-align: center; border: 1px solid #000; padding: 6px 8px;">Hành động</td>
        </tr>
        <tr>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 4px;">1.</td>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 8px; white-space: nowrap;">Người dùng</td>
          <td style="border: 1px solid #000; padding: 6px 8px;">Bấm nút "💡 Gợi ý AI Hints" trên khung soạn thảo bài viết.</td>
        </tr>
        <tr>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 4px;">2.</td>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 8px; white-space: nowrap;">Hệ thống</td>
          <td style="border: 1px solid #000; padding: 6px 8px;">Trích xuất nội dung đề bài và gửi yêu cầu gợi ý tới Gemini AI.</td>
        </tr>
        <tr>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 4px;">3.</td>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 8px; white-space: nowrap;">Gemini AI</td>
          <td style="border: 1px solid #000; padding: 6px 8px;">Sinh dàn ý cấu trúc bài viết và danh sách 5–10 từ vựng chuyên đề.</td>
        </tr>
        <tr>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 4px;">4.</td>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 8px; white-space: nowrap;">Hệ thống</td>
          <td style="border: 1px solid #000; padding: 6px 8px;">Tiếp nhận và kiểm tra tính hợp lệ của dữ liệu phản hồi từ AI.</td>
        </tr>
        <tr>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 4px;">5.</td>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 8px; white-space: nowrap;">Hệ thống</td>
          <td style="border: 1px solid #000; padding: 6px 8px;">Hiển thị dàn ý và từ vựng gợi ý lên thanh bên cạnh bài viết.</td>
        </tr>
        <tr>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 4px;">6.</td>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 8px; white-space: nowrap;">Người dùng</td>
          <td style="border: 1px solid #000; padding: 6px 8px;">Tham khảo dàn ý, từ vựng và tiếp tục viết bài.</td>
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td style="font-weight: bold; text-align: center; vertical-align: middle; border: 1px solid #000; padding: 10px;">
      Luồng sự<br>kiện thay<br>thế
    </td>
    <td colspan="3" style="border: 1px solid #000; padding: 8px 10px;">
      <table border="1" cellpadding="6" cellspacing="0" style="width: 100%; border-collapse: collapse; border: 1px solid #000;">
        <tr>
          <td style="width: 8%; font-weight: bold; text-align: center; border: 1px solid #000; padding: 6px 4px;">STT</td>
          <td style="width: 20%; font-weight: bold; text-align: center; border: 1px solid #000; padding: 6px 8px; white-space: nowrap;">Thực hiện bởi</td>
          <td style="font-weight: bold; text-align: center; border: 1px solid #000; padding: 6px 8px;">Hành động</td>
        </tr>
        <tr>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 4px;">2a.</td>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 8px; white-space: nowrap;">Hệ thống</td>
          <td style="border: 1px solid #000; padding: 6px 8px;">(Nếu tài khoản hết lượt AI) Thông báo hết hạn mức và gợi ý nâng cấp gói.</td>
        </tr>
        <tr>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 4px;">2b.</td>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 8px; white-space: nowrap;">Hệ thống</td>
          <td style="border: 1px solid #000; padding: 6px 8px;">(Nếu kết nối Gemini AI bị gián đoạn hoặc quá thời gian) Báo lỗi và hiển thị nút "Thử lại".</td>
        </tr>
        <tr>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 4px;">4a.</td>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 8px; white-space: nowrap;">Hệ thống</td>
          <td style="border: 1px solid #000; padding: 6px 8px;">(Nếu định dạng phản hồi AI bị lỗi) Trích xuất văn bản thô hiển thị cho học viên.</td>
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td style="font-weight: bold; text-align: center; vertical-align: middle; border: 1px solid #000; padding: 7px 10px;">Hậu điều<br>kiện</td>
    <td colspan="3" style="border: 1px solid #000; padding: 7px 10px;">Dàn ý và từ vựng gợi ý được hiển thị cho học viên; cập nhật lượt sử dụng AI.</td>
  </tr>
</table>

---

## 4. UC08.5: Tự động thu bài khi hết giờ

<table border="1" cellpadding="6" cellspacing="0" style="width: 100%; border-collapse: collapse; border: 1px solid #000; font-family: 'Times New Roman', Times, serif, Arial, sans-serif; font-size: 15px; margin-bottom: 40px;">
  <tr>
    <td style="width: 18%; font-weight: bold; text-align: center; vertical-align: middle; border: 1px solid #000; padding: 7px 10px;">Mã Use case</td>
    <td style="width: 28%; text-align: center; vertical-align: middle; border: 1px solid #000; padding: 7px 10px;">UC08.5</td>
    <td style="width: 20%; font-weight: bold; text-align: center; vertical-align: middle; border: 1px solid #000; padding: 7px 10px;">Tên Use case</td>
    <td style="width: 34%; text-align: center; vertical-align: middle; border: 1px solid #000; padding: 7px 10px;">Tự động thu bài khi hết giờ</td>
  </tr>
  <tr>
    <td style="font-weight: bold; text-align: center; vertical-align: middle; border: 1px solid #000; padding: 7px 10px;">Tác nhân</td>
    <td colspan="3" style="border: 1px solid #000; padding: 7px 10px;">Hệ thống</td>
  </tr>
  <tr>
    <td style="font-weight: bold; text-align: center; vertical-align: middle; border: 1px solid #000; padding: 7px 10px;">Sự kiện<br>kích hoạt</td>
    <td colspan="3" style="border: 1px solid #000; padding: 7px 10px;">Đồng hồ đếm ngược của bài thi Mock Test chạm mốc 00:00.</td>
  </tr>
  <tr>
    <td style="font-weight: bold; text-align: center; vertical-align: middle; border: 1px solid #000; padding: 7px 10px;">Tiền điều<br>kiện</td>
    <td colspan="3" style="border: 1px solid #000; padding: 7px 10px;">Học viên đang làm bài thi ở chế độ thi thử tính giờ.</td>
  </tr>
  <tr>
    <td style="font-weight: bold; text-align: center; vertical-align: middle; border: 1px solid #000; padding: 10px;">
      Luồng sự<br>kiện chính<br><br>(Thành<br>công)
    </td>
    <td colspan="3" style="border: 1px solid #000; padding: 8px 10px;">
      <table border="1" cellpadding="6" cellspacing="0" style="width: 100%; border-collapse: collapse; border: 1px solid #000;">
        <tr>
          <td style="width: 8%; font-weight: bold; text-align: center; border: 1px solid #000; padding: 6px 4px;">STT</td>
          <td style="width: 20%; font-weight: bold; text-align: center; border: 1px solid #000; padding: 6px 8px; white-space: nowrap;">Thực hiện bởi</td>
          <td style="font-weight: bold; text-align: center; border: 1px solid #000; padding: 6px 8px;">Hành động</td>
        </tr>
        <tr>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 4px;">1.</td>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 8px; white-space: nowrap;">Hệ thống</td>
          <td style="border: 1px solid #000; padding: 6px 8px;">Ghi nhận thời gian làm bài đã kết thúc (00:00).</td>
        </tr>
        <tr>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 4px;">2.</td>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 8px; white-space: nowrap;">Hệ thống</td>
          <td style="border: 1px solid #000; padding: 6px 8px;">Khóa toàn bộ thao tác nhập liệu của học viên trên màn hình.</td>
        </tr>
        <tr>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 4px;">3.</td>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 8px; white-space: nowrap;">Hệ thống</td>
          <td style="border: 1px solid #000; padding: 6px 8px;">Hiển thị thông báo "Thời gian làm bài đã hết! Hệ thống đang tự động thu bài...".</td>
        </tr>
        <tr>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 4px;">4.</td>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 8px; white-space: nowrap;">Hệ thống</td>
          <td style="border: 1px solid #000; padding: 6px 8px;">Thu thập toàn bộ các câu trả lời hiện tại của học viên.</td>
        </tr>
        <tr>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 4px;">5.</td>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 8px; white-space: nowrap;">Hệ thống</td>
          <td style="border: 1px solid #000; padding: 6px 8px;">Lưu bài làm vào cơ sở dữ liệu và đóng phiên làm bài.</td>
        </tr>
        <tr>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 4px;">6.</td>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 8px; white-space: nowrap;">Hệ thống</td>
          <td style="border: 1px solid #000; padding: 6px 8px;">Chuyển hướng học viên sang giao diện kết quả bài thi (UC09, UC10).</td>
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td style="font-weight: bold; text-align: center; vertical-align: middle; border: 1px solid #000; padding: 10px;">
      Luồng sự<br>kiện thay<br>thế
    </td>
    <td colspan="3" style="border: 1px solid #000; padding: 8px 10px;">
      <table border="1" cellpadding="6" cellspacing="0" style="width: 100%; border-collapse: collapse; border: 1px solid #000;">
        <tr>
          <td style="width: 8%; font-weight: bold; text-align: center; border: 1px solid #000; padding: 6px 4px;">STT</td>
          <td style="width: 20%; font-weight: bold; text-align: center; border: 1px solid #000; padding: 6px 8px; white-space: nowrap;">Thực hiện bởi</td>
          <td style="font-weight: bold; text-align: center; border: 1px solid #000; padding: 6px 8px;">Hành động</td>
        </tr>
        <tr>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 4px;">4a.</td>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 8px; white-space: nowrap;">Hệ thống</td>
          <td style="border: 1px solid #000; padding: 6px 8px;">(Nếu học viên chưa chọn đáp án nào) Ghi nhận thu bài với kết quả 0 điểm.</td>
        </tr>
        <tr>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 4px;">5a.</td>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 8px; white-space: nowrap;">Hệ thống</td>
          <td style="border: 1px solid #000; padding: 6px 8px;">(Nếu mất kết nối mạng khi tự động nộp) Hiển thị overlay lỗi, hỗ trợ retry có backoff và nút "Thử nộp lại".</td>
        </tr>
        <tr>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 4px;">5b.</td>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 8px; white-space: nowrap;">Hệ thống</td>
          <td style="border: 1px solid #000; padding: 6px 8px;">(Nếu học viên đóng trình duyệt hoặc tắt máy trước khi hết giờ) Background Scheduler định kỳ quét các bài thi có thời gian quá hạn (sau grace window 15 giây) và tự động chốt bài với reason=TIMEOUT_SERVER.</td>
        </tr>
        <tr>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 4px;">5c.</td>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 8px; white-space: nowrap;">Hệ thống</td>
          <td style="border: 1px solid #000; padding: 6px 8px;">(Nếu học viên reload hoặc truy cập API sau deadline khi Scheduler chưa quét) Hệ thống kích hoạt cơ chế Lazy Finalize, ngay lập tức chốt bài, chấm điểm và trả trạng thái EXPIRED/SUBMITTED, ngăn chặn truy cập workspace để làm tiếp.</td>
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td style="font-weight: bold; text-align: center; vertical-align: middle; border: 1px solid #000; padding: 7px 10px;">Hậu điều<br>kiện</td>
    <td colspan="3" style="border: 1px solid #000; padding: 7px 10px;">Bài thi được tự động thu, lưu vào cơ sở dữ liệu và chuyển sang chấm điểm.</td>
  </tr>
</table>

---

## 5. UC09: Chấm điểm trắc nghiệm & điền từ tự động

<table border="1" cellpadding="6" cellspacing="0" style="width: 100%; border-collapse: collapse; border: 1px solid #000; font-family: 'Times New Roman', Times, serif, Arial, sans-serif; font-size: 15px; margin-bottom: 40px;">
  <tr>
    <td style="width: 18%; font-weight: bold; text-align: center; vertical-align: middle; border: 1px solid #000; padding: 7px 10px;">Mã Use case</td>
    <td style="width: 28%; text-align: center; vertical-align: middle; border: 1px solid #000; padding: 7px 10px;">UC09</td>
    <td style="width: 20%; font-weight: bold; text-align: center; vertical-align: middle; border: 1px solid #000; padding: 7px 10px;">Tên Use case</td>
    <td style="width: 34%; text-align: center; vertical-align: middle; border: 1px solid #000; padding: 7px 10px;">Chấm điểm trắc nghiệm & điền từ tự động</td>
  </tr>
  <tr>
    <td style="font-weight: bold; text-align: center; vertical-align: middle; border: 1px solid #000; padding: 7px 10px;">Tác nhân</td>
    <td colspan="3" style="border: 1px solid #000; padding: 7px 10px;">Hệ thống</td>
  </tr>
  <tr>
    <td style="font-weight: bold; text-align: center; vertical-align: middle; border: 1px solid #000; padding: 7px 10px;">Sự kiện<br>kích hoạt</td>
    <td colspan="3" style="border: 1px solid #000; padding: 7px 10px;">Học viên nộp bài thi hoặc hệ thống tự động thu bài khi hết giờ (UC08.5).</td>
  </tr>
  <tr>
    <td style="font-weight: bold; text-align: center; vertical-align: middle; border: 1px solid #000; padding: 7px 10px;">Tiền điều<br>kiện</td>
    <td colspan="3" style="border: 1px solid #000; padding: 7px 10px;">Bài làm đã được nộp có chứa câu hỏi trắc nghiệm hoặc điền từ.</td>
  </tr>
  <tr>
    <td style="font-weight: bold; text-align: center; vertical-align: middle; border: 1px solid #000; padding: 10px;">
      Luồng sự<br>kiện chính<br><br>(Thành<br>công)
    </td>
    <td colspan="3" style="border: 1px solid #000; padding: 8px 10px;">
      <table border="1" cellpadding="6" cellspacing="0" style="width: 100%; border-collapse: collapse; border: 1px solid #000;">
        <tr>
          <td style="width: 8%; font-weight: bold; text-align: center; border: 1px solid #000; padding: 6px 4px;">STT</td>
          <td style="width: 20%; font-weight: bold; text-align: center; border: 1px solid #000; padding: 6px 8px; white-space: nowrap;">Thực hiện bởi</td>
          <td style="font-weight: bold; text-align: center; border: 1px solid #000; padding: 6px 8px;">Hành động</td>
        </tr>
        <tr>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 4px;">1.</td>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 8px; white-space: nowrap;">Hệ thống</td>
          <td style="border: 1px solid #000; padding: 6px 8px;">Tiếp nhận danh sách câu trả lời từ bài nộp của học viên.</td>
        </tr>
        <tr>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 4px;">2.</td>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 8px; white-space: nowrap;">Hệ thống</td>
          <td style="border: 1px solid #000; padding: 6px 8px;">Truy vấn đáp án chuẩn của đề thi từ cơ sở dữ liệu.</td>
        </tr>
        <tr>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 4px;">3.</td>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 8px; white-space: nowrap;">Hệ thống</td>
          <td style="border: 1px solid #000; padding: 6px 8px;">Chuẩn hóa câu trả lời (xóa khoảng trắng thừa, chuẩn hóa chữ hoa/thường).</td>
        </tr>
        <tr>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 4px;">4.</td>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 8px; white-space: nowrap;">Hệ thống</td>
          <td style="border: 1px solid #000; padding: 6px 8px;">So khớp từng câu trả lời với đáp án chuẩn và ghi nhận kết quả Đúng/Sai.</td>
        </tr>
        <tr>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 4px;">5.</td>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 8px; white-space: nowrap;">Hệ thống</td>
          <td style="border: 1px solid #000; padding: 6px 8px;">Lưu chi tiết kết quả Đúng/Sai của từng câu vào cơ sở dữ liệu.</td>
        </tr>
        <tr>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 4px;">6.</td>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 8px; white-space: nowrap;">Hệ thống</td>
          <td style="border: 1px solid #000; padding: 6px 8px;">Tính tổng điểm và cập nhật điểm số vào phiên làm bài.</td>
        </tr>
        <tr>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 4px;">7.</td>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 8px; white-space: nowrap;">Hệ thống</td>
          <td style="border: 1px solid #000; padding: 6px 8px;">Hiển thị bảng điểm kết quả tức thì cho học viên.</td>
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td style="font-weight: bold; text-align: center; vertical-align: middle; border: 1px solid #000; padding: 10px;">
      Luồng sự<br>kiện thay<br>thế
    </td>
    <td colspan="3" style="border: 1px solid #000; padding: 8px 10px;">
      <table border="1" cellpadding="6" cellspacing="0" style="width: 100%; border-collapse: collapse; border: 1px solid #000;">
        <tr>
          <td style="width: 8%; font-weight: bold; text-align: center; border: 1px solid #000; padding: 6px 4px;">STT</td>
          <td style="width: 20%; font-weight: bold; text-align: center; border: 1px solid #000; padding: 6px 8px; white-space: nowrap;">Thực hiện bởi</td>
          <td style="font-weight: bold; text-align: center; border: 1px solid #000; padding: 6px 8px;">Hành động</td>
        </tr>
        <tr>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 4px;">4a.</td>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 8px; white-space: nowrap;">Hệ thống</td>
          <td style="border: 1px solid #000; padding: 6px 8px;">(Câu hỏi điền từ có nhiều đáp án chấp nhận) So khớp với từng phương án hợp lệ; ghi nhận Đúng nếu trùng bất kỳ phương án nào.</td>
        </tr>
        <tr>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 4px;">4b.</td>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 8px; white-space: nowrap;">Hệ thống</td>
          <td style="border: 1px solid #000; padding: 6px 8px;">(Câu hỏi bỏ trống) Ghi nhận kết quả Sai mà không cần so khớp chuỗi.</td>
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td style="font-weight: bold; text-align: center; vertical-align: middle; border: 1px solid #000; padding: 7px 10px;">Hậu điều<br>kiện</td>
    <td colspan="3" style="border: 1px solid #000; padding: 7px 10px;">Điểm số và trạng thái Đúng/Sai từng câu được lưu vào cơ sở dữ liệu.</td>
  </tr>
</table>

---

## 6. UC09.2: Chấm điểm Writing bằng Gemini AI

<table border="1" cellpadding="6" cellspacing="0" style="width: 100%; border-collapse: collapse; border: 1px solid #000; font-family: 'Times New Roman', Times, serif, Arial, sans-serif; font-size: 15px; margin-bottom: 40px;">
  <tr>
    <td style="width: 18%; font-weight: bold; text-align: center; vertical-align: middle; border: 1px solid #000; padding: 7px 10px;">Mã Use case</td>
    <td style="width: 28%; text-align: center; vertical-align: middle; border: 1px solid #000; padding: 7px 10px;">UC09.2</td>
    <td style="width: 20%; font-weight: bold; text-align: center; vertical-align: middle; border: 1px solid #000; padding: 7px 10px;">Tên Use case</td>
    <td style="width: 34%; text-align: center; vertical-align: middle; border: 1px solid #000; padding: 7px 10px;">Chấm điểm Writing bằng Gemini AI</td>
  </tr>
  <tr>
    <td style="font-weight: bold; text-align: center; vertical-align: middle; border: 1px solid #000; padding: 7px 10px;">Tác nhân</td>
    <td colspan="3" style="border: 1px solid #000; padding: 7px 10px;">Hệ thống, Hệ thống Gemini AI</td>
  </tr>
  <tr>
    <td style="font-weight: bold; text-align: center; vertical-align: middle; border: 1px solid #000; padding: 7px 10px;">Sự kiện<br>kích hoạt</td>
    <td colspan="3" style="border: 1px solid #000; padding: 7px 10px;">Học viên hoàn thành và nộp bài thi có phần tự luận (Writing).</td>
  </tr>
  <tr>
    <td style="font-weight: bold; text-align: center; vertical-align: middle; border: 1px solid #000; padding: 7px 10px;">Tiền điều<br>kiện</td>
    <td colspan="3" style="border: 1px solid #000; padding: 7px 10px;">Bài viết đạt độ dài tối thiểu theo quy định (> 10 từ).</td>
  </tr>
  <tr>
    <td style="font-weight: bold; text-align: center; vertical-align: middle; border: 1px solid #000; padding: 10px;">
      Luồng sự<br>kiện chính<br><br>(Thành<br>công)
    </td>
    <td colspan="3" style="border: 1px solid #000; padding: 8px 10px;">
      <table border="1" cellpadding="6" cellspacing="0" style="width: 100%; border-collapse: collapse; border: 1px solid #000;">
        <tr>
          <td style="width: 8%; font-weight: bold; text-align: center; border: 1px solid #000; padding: 6px 4px;">STT</td>
          <td style="width: 20%; font-weight: bold; text-align: center; border: 1px solid #000; padding: 6px 8px; white-space: nowrap;">Thực hiện bởi</td>
          <td style="font-weight: bold; text-align: center; border: 1px solid #000; padding: 6px 8px;">Hành động</td>
        </tr>
        <tr>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 4px;">1.</td>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 8px; white-space: nowrap;">Hệ thống</td>
          <td style="border: 1px solid #000; padding: 6px 8px;">Tiếp nhận văn bản bài viết tự luận từ bài nộp của học viên.</td>
        </tr>
        <tr>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 4px;">2.</td>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 8px; white-space: nowrap;">Hệ thống</td>
          <td style="border: 1px solid #000; padding: 6px 8px;">Xây dựng Prompt đánh giá theo 4 tiêu chí quốc tế (Nhiệm vụ, Mạch lạc, Từ vựng, Ngữ pháp).</td>
        </tr>
        <tr>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 4px;">3.</td>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 8px; white-space: nowrap;">Hệ thống</td>
          <td style="border: 1px solid #000; padding: 6px 8px;">Gửi đề bài và bài viết của học viên tới Gemini AI.</td>
        </tr>
        <tr>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 4px;">4.</td>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 8px; white-space: nowrap;">Gemini AI</td>
          <td style="border: 1px solid #000; padding: 6px 8px;">Chấm điểm 4 tiêu chí, nhận xét chi tiết và viết lại câu gợi ý sửa lỗi.</td>
        </tr>
        <tr>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 4px;">5.</td>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 8px; white-space: nowrap;">Hệ thống</td>
          <td style="border: 1px solid #000; padding: 6px 8px;">Tiếp nhận kết quả chấm điểm và phân tích cấu trúc phản hồi từ AI.</td>
        </tr>
        <tr>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 4px;">6.</td>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 8px; white-space: nowrap;">Hệ thống</td>
          <td style="border: 1px solid #000; padding: 6px 8px;">Lưu điểm số, nhận xét và danh sách câu sửa vào cơ sở dữ liệu.</td>
        </tr>
        <tr>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 4px;">7.</td>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 8px; white-space: nowrap;">Hệ thống</td>
          <td style="border: 1px solid #000; padding: 6px 8px;">Hiển thị kết quả chấm điểm Writing và giao diện Diff-View cho học viên (UC10.2).</td>
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td style="font-weight: bold; text-align: center; vertical-align: middle; border: 1px solid #000; padding: 10px;">
      Luồng sự<br>kiện thay<br>thế
    </td>
    <td colspan="3" style="border: 1px solid #000; padding: 8px 10px;">
      <table border="1" cellpadding="6" cellspacing="0" style="width: 100%; border-collapse: collapse; border: 1px solid #000;">
        <tr>
          <td style="width: 8%; font-weight: bold; text-align: center; border: 1px solid #000; padding: 6px 4px;">STT</td>
          <td style="width: 20%; font-weight: bold; text-align: center; border: 1px solid #000; padding: 6px 8px; white-space: nowrap;">Thực hiện bởi</td>
          <td style="font-weight: bold; text-align: center; border: 1px solid #000; padding: 6px 8px;">Hành động</td>
        </tr>
        <tr>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 4px;">1a.</td>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 8px; white-space: nowrap;">Hệ thống</td>
          <td style="border: 1px solid #000; padding: 6px 8px;">(Bài viết quá ngắn dưới 10 từ hoặc spam) Từ chối chấm, ghi nhận 0 điểm kèm thông báo nhắc nhở.</td>
        </tr>
        <tr>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 4px;">3a.</td>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 8px; white-space: nowrap;">Hệ thống</td>
          <td style="border: 1px solid #000; padding: 6px 8px;">(Lỗi mạng hoặc vượt hạn mức API) Đưa yêu cầu vào hàng đợi thử lại (tối đa 3 lần).</td>
        </tr>
        <tr>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 4px;">3a.1</td>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 8px; white-space: nowrap;">Hệ thống</td>
          <td style="border: 1px solid #000; padding: 6px 8px;">(Thử lại thất bại) Đặt trạng thái chờ xử lý và thông báo học viên xem lại sau.</td>
        </tr>
        <tr>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 4px;">5a.</td>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 8px; white-space: nowrap;">Hệ thống</td>
          <td style="border: 1px solid #000; padding: 6px 8px;">(Lỗi định dạng phản hồi AI) Lưu nhận xét dạng văn bản thô để đảm bảo an toàn dữ liệu.</td>
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td style="font-weight: bold; text-align: center; vertical-align: middle; border: 1px solid #000; padding: 7px 10px;">Hậu điều<br>kiện</td>
    <td colspan="3" style="border: 1px solid #000; padding: 7px 10px;">Điểm 4 tiêu chí, nhận xét và câu sửa từ AI được lưu vào cơ sở dữ liệu.</td>
  </tr>
</table>

---

## 7. UC10: Xem kết quả bài thi & Lời giải chi tiết

<table border="1" cellpadding="6" cellspacing="0" style="width: 100%; border-collapse: collapse; border: 1px solid #000; font-family: 'Times New Roman', Times, serif, Arial, sans-serif; font-size: 15px; margin-bottom: 40px;">
  <tr>
    <td style="width: 18%; font-weight: bold; text-align: center; vertical-align: middle; border: 1px solid #000; padding: 7px 10px;">Mã Use case</td>
    <td style="width: 28%; text-align: center; vertical-align: middle; border: 1px solid #000; padding: 7px 10px;">UC10</td>
    <td style="width: 20%; font-weight: bold; text-align: center; vertical-align: middle; border: 1px solid #000; padding: 7px 10px;">Tên Use case</td>
    <td style="width: 34%; text-align: center; vertical-align: middle; border: 1px solid #000; padding: 7px 10px;">Xem kết quả bài thi & Lời giải chi tiết</td>
  </tr>
  <tr>
    <td style="font-weight: bold; text-align: center; vertical-align: middle; border: 1px solid #000; padding: 7px 10px;">Tác nhân</td>
    <td colspan="3" style="border: 1px solid #000; padding: 7px 10px;">Người dùng (Học viên)</td>
  </tr>
  <tr>
    <td style="font-weight: bold; text-align: center; vertical-align: middle; border: 1px solid #000; padding: 7px 10px;">Sự kiện<br>kích hoạt</td>
    <td colspan="3" style="border: 1px solid #000; padding: 7px 10px;">Học viên hoàn thành nộp bài thi hoặc chọn xem lại bài thi từ trang Lịch sử làm bài.</td>
  </tr>
  <tr>
    <td style="font-weight: bold; text-align: center; vertical-align: middle; border: 1px solid #000; padding: 7px 10px;">Tiền điều<br>kiện</td>
    <td colspan="3" style="border: 1px solid #000; padding: 7px 10px;">Bài thi đã hoàn tất quá trình chấm điểm.</td>
  </tr>
  <tr>
    <td style="font-weight: bold; text-align: center; vertical-align: middle; border: 1px solid #000; padding: 10px;">
      Luồng sự<br>kiện chính<br><br>(Thành<br>công)
    </td>
    <td colspan="3" style="border: 1px solid #000; padding: 8px 10px;">
      <table border="1" cellpadding="6" cellspacing="0" style="width: 100%; border-collapse: collapse; border: 1px solid #000;">
        <tr>
          <td style="width: 8%; font-weight: bold; text-align: center; border: 1px solid #000; padding: 6px 4px;">STT</td>
          <td style="width: 20%; font-weight: bold; text-align: center; border: 1px solid #000; padding: 6px 8px; white-space: nowrap;">Thực hiện bởi</td>
          <td style="font-weight: bold; text-align: center; border: 1px solid #000; padding: 6px 8px;">Hành động</td>
        </tr>
        <tr>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 4px;">1.</td>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 8px; white-space: nowrap;">Người dùng</td>
          <td style="border: 1px solid #000; padding: 6px 8px;">Mở xem kết quả bài thi vừa hoàn thành hoặc chọn một bài từ Lịch sử làm bài.</td>
        </tr>
        <tr>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 4px;">2.</td>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 8px; white-space: nowrap;">Hệ thống</td>
          <td style="border: 1px solid #000; padding: 6px 8px;">Truy vấn thông tin tổng quan bài thi (điểm số, thời gian làm, số câu đúng/sai).</td>
        </tr>
        <tr>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 4px;">3.</td>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 8px; white-space: nowrap;">Hệ thống</td>
          <td style="border: 1px solid #000; padding: 6px 8px;">Truy vấn chi tiết câu trả lời, trạng thái Đúng/Sai, lời giải và bản dịch từ cơ sở dữ liệu.</td>
        </tr>
        <tr>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 4px;">4.</td>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 8px; white-space: nowrap;">Hệ thống</td>
          <td style="border: 1px solid #000; padding: 6px 8px;">Hiển thị bảng điểm tổng quan và biểu đồ phân tích kết quả.</td>
        </tr>
        <tr>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 4px;">5.</td>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 8px; white-space: nowrap;">Người dùng</td>
          <td style="border: 1px solid #000; padding: 6px 8px;">Bấm xem chi tiết từng câu hỏi hoặc chọn "Mở rộng toàn bộ lời giải".</td>
        </tr>
        <tr>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 4px;">6.</td>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 8px; white-space: nowrap;">Hệ thống</td>
          <td style="border: 1px solid #000; padding: 6px 8px;">Hiển thị chi tiết câu hỏi: đối chiếu đáp án, lời giải thích và bản dịch tiếng Việt.</td>
        </tr>
        <tr>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 4px;">7.</td>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 8px; white-space: nowrap;">Người dùng</td>
          <td style="border: 1px solid #000; padding: 6px 8px;">Đọc lời giải chi tiết và bản dịch để rút kinh nghiệm.</td>
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td style="font-weight: bold; text-align: center; vertical-align: middle; border: 1px solid #000; padding: 10px;">
      Luồng sự<br>kiện thay<br>thế
    </td>
    <td colspan="3" style="border: 1px solid #000; padding: 8px 10px;">
      <table border="1" cellpadding="6" cellspacing="0" style="width: 100%; border-collapse: collapse; border: 1px solid #000;">
        <tr>
          <td style="width: 8%; font-weight: bold; text-align: center; border: 1px solid #000; padding: 6px 4px;">STT</td>
          <td style="width: 20%; font-weight: bold; text-align: center; border: 1px solid #000; padding: 6px 8px; white-space: nowrap;">Thực hiện bởi</td>
          <td style="font-weight: bold; text-align: center; border: 1px solid #000; padding: 6px 8px;">Hành động</td>
        </tr>
        <tr>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 4px;">5a.</td>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 8px; white-space: nowrap;">Người dùng</td>
          <td style="border: 1px solid #000; padding: 6px 8px;">Chọn bộ lọc câu hỏi ("Chỉ xem câu Sai" hoặc "Chỉ xem câu Bỏ trống").</td>
        </tr>
        <tr>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 4px;">5a.1</td>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 8px; white-space: nowrap;">Hệ thống</td>
          <td style="border: 1px solid #000; padding: 6px 8px;">Lọc và hiển thị danh sách câu hỏi theo tiêu chí đã chọn.</td>
        </tr>
        <tr>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 4px;">5b.</td>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 8px; white-space: nowrap;">Người dùng</td>
          <td style="border: 1px solid #000; padding: 6px 8px;">Bấm chuyển sang tab "Kết quả Writing" (đối với bài có phần tự luận).</td>
        </tr>
        <tr>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 4px;">5b.1</td>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 8px; white-space: nowrap;">Hệ thống</td>
          <td style="border: 1px solid #000; padding: 6px 8px;">Chuyển sang giao diện nhận xét AI và Diff-View sửa lỗi (UC10.2).</td>
        </tr>
        <tr>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 4px;">2a.</td>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 8px; white-space: nowrap;">Hệ thống</td>
          <td style="border: 1px solid #000; padding: 6px 8px;">(Không tìm thấy dữ liệu bài thi) Thông báo lỗi và chuyển hướng về trang chủ.</td>
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td style="font-weight: bold; text-align: center; vertical-align: middle; border: 1px solid #000; padding: 7px 10px;">Hậu điều<br>kiện</td>
    <td colspan="3" style="border: 1px solid #000; padding: 7px 10px;">Học viên xem được bảng điểm tổng quan, chi tiết từng câu và lời giải tương ứng.</td>
  </tr>
</table>

---

## 8. UC10.2: Xem nhận xét AI & Giao diện Diff-View sửa lỗi

<table border="1" cellpadding="6" cellspacing="0" style="width: 100%; border-collapse: collapse; border: 1px solid #000; font-family: 'Times New Roman', Times, serif, Arial, sans-serif; font-size: 15px; margin-bottom: 40px;">
  <tr>
    <td style="width: 18%; font-weight: bold; text-align: center; vertical-align: middle; border: 1px solid #000; padding: 7px 10px;">Mã Use case</td>
    <td style="width: 28%; text-align: center; vertical-align: middle; border: 1px solid #000; padding: 7px 10px;">UC10.2</td>
    <td style="width: 20%; font-weight: bold; text-align: center; vertical-align: middle; border: 1px solid #000; padding: 7px 10px;">Tên Use case</td>
    <td style="width: 34%; text-align: center; vertical-align: middle; border: 1px solid #000; padding: 7px 10px;">Xem nhận xét AI & Giao diện Diff-View sửa lỗi</td>
  </tr>
  <tr>
    <td style="font-weight: bold; text-align: center; vertical-align: middle; border: 1px solid #000; padding: 7px 10px;">Tác nhân</td>
    <td colspan="3" style="border: 1px solid #000; padding: 7px 10px;">Người dùng (Học viên)</td>
  </tr>
  <tr>
    <td style="font-weight: bold; text-align: center; vertical-align: middle; border: 1px solid #000; padding: 7px 10px;">Sự kiện<br>kích hoạt</td>
    <td colspan="3" style="border: 1px solid #000; padding: 7px 10px;">Học viên mở tab kết quả bài Writing trên trang kết quả bài thi.</td>
  </tr>
  <tr>
    <td style="font-weight: bold; text-align: center; vertical-align: middle; border: 1px solid #000; padding: 7px 10px;">Tiền điều<br>kiện</td>
    <td colspan="3" style="border: 1px solid #000; padding: 7px 10px;">Bài viết Writing đã được Gemini AI hoàn tất chấm điểm.</td>
  </tr>
  <tr>
    <td style="font-weight: bold; text-align: center; vertical-align: middle; border: 1px solid #000; padding: 10px;">
      Luồng sự<br>kiện chính<br><br>(Thành<br>công)
    </td>
    <td colspan="3" style="border: 1px solid #000; padding: 8px 10px;">
      <table border="1" cellpadding="6" cellspacing="0" style="width: 100%; border-collapse: collapse; border: 1px solid #000;">
        <tr>
          <td style="width: 8%; font-weight: bold; text-align: center; border: 1px solid #000; padding: 6px 4px;">STT</td>
          <td style="width: 20%; font-weight: bold; text-align: center; border: 1px solid #000; padding: 6px 8px; white-space: nowrap;">Thực hiện bởi</td>
          <td style="font-weight: bold; text-align: center; border: 1px solid #000; padding: 6px 8px;">Hành động</td>
        </tr>
        <tr>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 4px;">1.</td>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 8px; white-space: nowrap;">Người dùng</td>
          <td style="border: 1px solid #000; padding: 6px 8px;">Chọn tab "Kết quả Writing" trên trang kết quả bài thi.</td>
        </tr>
        <tr>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 4px;">2.</td>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 8px; white-space: nowrap;">Hệ thống</td>
          <td style="border: 1px solid #000; padding: 6px 8px;">Truy vấn kết quả nhận xét AI và điểm 4 tiêu chí từ cơ sở dữ liệu.</td>
        </tr>
        <tr>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 4px;">3.</td>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 8px; white-space: nowrap;">Hệ thống</td>
          <td style="border: 1px solid #000; padding: 6px 8px;">Hiển thị bảng điểm 4 tiêu chí, Band Score tổng và nhận xét đánh giá tổng quan.</td>
        </tr>
        <tr>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 4px;">4.</td>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 8px; white-space: nowrap;">Hệ thống</td>
          <td style="border: 1px solid #000; padding: 6px 8px;">Hiển thị giao diện so sánh sửa lỗi (Diff-View): bôi đỏ lỗi sai ngữ pháp, gạch chân xanh câu đề xuất sửa từ AI.</td>
        </tr>
        <tr>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 4px;">5.</td>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 8px; white-space: nowrap;">Người dùng</td>
          <td style="border: 1px solid #000; padding: 6px 8px;">Rê chuột hoặc nhấp vào từng vị trí lỗi sai trên Diff-View để xem giải thích chi tiết.</td>
        </tr>
        <tr>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 4px;">6.</td>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 8px; white-space: nowrap;">Người dùng</td>
          <td style="border: 1px solid #000; padding: 6px 8px;">Đọc nhận xét và so sánh câu viết lại để trau dồi kỹ năng viết.</td>
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td style="font-weight: bold; text-align: center; vertical-align: middle; border: 1px solid #000; padding: 10px;">
      Luồng sự<br>kiện thay<br>thế
    </td>
    <td colspan="3" style="border: 1px solid #000; padding: 8px 10px;">
      <table border="1" cellpadding="6" cellspacing="0" style="width: 100%; border-collapse: collapse; border: 1px solid #000;">
        <tr>
          <td style="width: 8%; font-weight: bold; text-align: center; border: 1px solid #000; padding: 6px 4px;">STT</td>
          <td style="width: 20%; font-weight: bold; text-align: center; border: 1px solid #000; padding: 6px 8px; white-space: nowrap;">Thực hiện bởi</td>
          <td style="font-weight: bold; text-align: center; border: 1px solid #000; padding: 6px 8px;">Hành động</td>
        </tr>
        <tr>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 4px;">2a.</td>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 8px; white-space: nowrap;">Hệ thống</td>
          <td style="border: 1px solid #000; padding: 6px 8px;">(AI vẫn đang chấm điểm) Hiển thị biểu tượng đang tải và thông báo chờ ít giây.</td>
        </tr>
        <tr>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 4px;">2a.1</td>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 8px; white-space: nowrap;">Hệ thống</td>
          <td style="border: 1px solid #000; padding: 6px 8px;">Tự động cập nhật hiển thị kết quả ngay khi quá trình chấm hoàn tất.</td>
        </tr>
        <tr>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 4px;">4a.</td>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 8px; white-space: nowrap;">Người dùng</td>
          <td style="border: 1px solid #000; padding: 6px 8px;">Bấm chọn "Xem bài viết hoàn chỉnh đã sửa".</td>
        </tr>
        <tr>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 4px;">4a.1</td>
          <td style="text-align: center; border: 1px solid #000; padding: 6px 8px; white-space: nowrap;">Hệ thống</td>
          <td style="border: 1px solid #000; padding: 6px 8px;">Hiển thị toàn văn bài mẫu đã được AI chỉnh sửa hoàn thiện.</td>
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td style="font-weight: bold; text-align: center; vertical-align: middle; border: 1px solid #000; padding: 7px 10px;">Hậu điều<br>kiện</td>
    <td colspan="3" style="border: 1px solid #000; padding: 7px 10px;">Học viên xem được nhận xét chi tiết và giao diện sửa lỗi trực quan của AI.</td>
  </tr>
</table>
