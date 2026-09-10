# Hướng dẫn Cài đặt & Chạy Dự án cho Thành viên mới (Setup Guide)

Chào mừng bạn đến với dự án **Mock Test Platform** (Nền tảng Thi thử và Chấm điểm Ngoại ngữ tích hợp AI)! Tài liệu này sẽ hướng dẫn bạn các bước chi tiết để clone dự án về máy và chạy thử thành công trong lần đầu tiên.

---

## 1. Yêu cầu Hệ thống (Prerequisites)
Trước khi bắt đầu, hãy đảm bảo máy tính của bạn đã cài đặt sẵn các phần mềm sau:
1. **[Git](https://git-scm.com/)**: Dùng để quản lý mã nguồn.
2. **[Docker Desktop](https://www.docker.com/products/docker-desktop/)**: Bắt buộc để khởi chạy Database (PostgreSQL) và Redis một cách nhanh chóng.
3. **[Node.js](https://nodejs.org/)** (v20+): Bắt buộc để chạy Frontend.
4. **[Java JDK 21](https://adoptium.net/)**: Bắt buộc để chạy Backend.

---

## 2. Clone Dự án từ GitHub
Mở Terminal / Command Prompt và chạy lệnh sau:
```bash
git clone https://github.com/your-username/multilingo-platform.git
cd multilingo-platform
```

---

## 3. Khởi chạy Database & Redis (Bằng Docker)
Dự án sử dụng Docker để quản lý cơ sở dữ liệu giúp bạn không cần phải cài đặt chúng vào máy thật.

1. Khởi động Docker Desktop trên máy tính.
2. Mở Terminal tại thư mục gốc của dự án (`multilingo-platform`) và chạy lệnh:
   ```bash
   docker-compose up -d
   ```
   *(Docker sẽ tự động tải và khởi chạy PostgreSQL ở cổng `5433` và Redis ở cổng `6379`)*

---

## 4. Chạy Backend (Spring Boot)
1. Mở một Terminal mới, di chuyển vào thư mục `backend`:
   ```bash
   cd backend
   ```
2. Khởi động Backend bằng Maven:
   ```bash
   mvn spring-boot:run
   ```
👉 Backend sẽ chạy ở địa chỉ: `http://localhost:8080` (API test: `http://localhost:8080/api/test/hello`). Nó sẽ tự động kết nối vào Database và Redis đang chạy trên Docker.

---

## 5. Chạy Frontend (ReactJS)
1. Mở một Terminal mới, di chuyển vào thư mục `frontend`:
   ```bash
   cd frontend
   ```
2. Cài đặt các thư viện cần thiết:
   ```bash
   npm install
   ```
3. Khởi động môi trường lập trình:
   ```bash
   npm run dev
   ```
👉 Truy cập giao diện tại: `http://localhost:5173`

---

## 6. Kết nối Database (Dành cho pgAdmin / DBeaver / DataGrip)
Nếu bạn muốn xem cấu trúc các bảng hoặc dữ liệu, hãy kết nối phần mềm quản lý Database với thông tin sau:
- **Host:** `localhost`
- **Port:** `5433`
- **Database:** `multilingodb`
- **Username:** `postgres`
- **Password:** `postgres`

Chúc bạn làm việc hiệu quả và đóng góp được nhiều code chất lượng cho dự án! 🚀
