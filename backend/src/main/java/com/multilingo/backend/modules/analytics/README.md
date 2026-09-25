# 📊 MODULE ANALYTICS & AUDIT (GIÁM SÁT, TRACKING & KIỂM TOÁN)

**Thành viên phụ trách:** Thành viên 4 (TV4)  
**Package:** `com.multilingo.backend.modules.analytics`  
**Tài liệu phân công chi tiết:** [docs/md/PHAN_CONG_NHIEM_VU_5_NGUOI.md](file:///f:/Working/JavaBackend/multilingo-platform/docs/md/PHAN_CONG_NHIEM_VU_5_NGUOI.md)

---

## 1. PHẠM VI NGHIỆP VỤ & DANH MỤC USE CASE (8 AD / 8 SD)

1. **A_Tracking - Theo dõi hành vi người dùng & Đề thi:** Thống kê: "Đề này có bao nhiêu người làm" (lượt làm, điểm trung bình) và "Người này làm bao nhiêu đề" (tiến trình học viên, thiết bị).
2. **UC15 - Quản trị Người dùng Tổng quan:** Tra cứu danh sách người dùng, lọc theo vai trò, trạng thái kích hoạt.
3. **UC15.1 - Khóa / Mở khóa tài khoản học viên:** Đổi cờ `is_active = false` khi vi phạm, thu hồi phiên làm việc trên Redis.
4. **UC15.3 - Cấu hình hạn mức Quota sử dụng AI:** Thiết lập số lượt gọi AI tối đa trong tuần/tháng cho nhóm tài khoản Free và VIP trong `user_quotas`.
5. **UC15.4 / A_Audit - Xem Nhật ký kiểm toán an ninh:** Quản lý `audit_logs`, lưu vết thao tác thêm/sửa/xóa của Admin kèm bản chụp JSON dữ liệu cũ để Rollback/đối soát.
6. **UC16 - Báo cáo Vận hành & Doanh thu Tổng quan:** Thống kê DAU/MAU, tăng trưởng người dùng mới, tỷ lệ chuyển đổi Free -> VIP.
7. **UC16.2 - Tra cứu & Đối soát giao dịch VNPAY:** Lọc danh sách giao dịch, đối soát mã đơn hàng, trạng thái thanh toán.
8. **UC16.3 - Xuất báo cáo tài chính định kỳ:** Tổng hợp dữ liệu và xuất file báo cáo Excel / PDF.

---

## 2. CÁC BẢNG CƠ SỞ DỮ LIỆU PHỤ TRÁCH

- `audit_logs`: Bảng nhật ký kiểm toán ghi vết thao tác nhạy cảm kèm JSON snapshot.
- `login_history`: Lịch sử các lần đăng nhập (IP, thiết bị, thời gian, trạng thái thành công/thất bại).
- `user_quotas`: Quản lý định mức sử dụng AI cho từng nhóm người dùng.
- *Khối dữ liệu phân tích:* Truy vấn tổng hợp từ `test_attempts`, `users`, `exams`, `transactions`.

---

## 3. CẤU TRÚC GÓI MÃ NGUỒN NỘI BỘ

```text
com.multilingo.backend.modules.analytics
├── controller/          # AdminTrackingController, AdminUserController, AuditLogController, ReportController
├── dto/                 # Data Transfer Objects
│   ├── request/         # LockUserRequest, UpdateQuotaRequest, ReportFilterRequest
│   └── response/        # DashboardStatsResponse, AuditLogResponse, ExamTrackingResponse, DauMauResponse
├── entity/              # AuditLog, LoginHistory, UserQuota
├── repository/          # AuditLogRepository, LoginHistoryRepository, UserQuotaRepository
└── service/             # AnalyticsService, AuditService, UserManagementService, ExcelExportService
    └── impl/            # AnalyticsServiceImpl, AuditServiceImpl,...
```

---

## 4. QUY CHUẨN KỸ THUẬT BẮT BUỘC

1. **Entity:** Kế thừa `BaseEntity`.
2. **Controller:** Trả về `ResponseEntity<ApiResponse<T>>`.
3. **Phân trang:** Áp dụng `Pageable` và bọc kết quả danh sách trong `PageResponse<T>`.
4. **Audit Logging:** Chụp snapshot đối tượng trước khi thay đổi và lưu dưới dạng JSONB.
