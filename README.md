# 🌐 Multilingo Platform

> **Nền tảng Thi thử và Đánh giá Năng lực Đa ngôn ngữ tích hợp Trí tuệ Nhân tạo (AI).**

---

## 🚀 Khởi chạy nhanh (Quick Start)

### Cách 1: Chạy Full-Stack 1-Click bằng Docker Compose (Khuyên dùng)
Yêu cầu: Đã cài đặt [Docker Desktop](https://www.docker.com/products/docker-desktop/).

```bash
# Khởi động toàn bộ 4 dịch vụ: Database, Redis, Backend, Frontend
docker compose up -d --build
```

* **Frontend Web:** [http://localhost:3000](http://localhost:3000)
* **Backend API:** [http://localhost:8080](http://localhost:8080)
* **PostgreSQL:** `localhost:5434` (DB: `multilingodb`, User: `postgres`, Pass: `postgres`)
* **Redis Cache:** `localhost:6379`

Dừng hệ thống:
```bash
docker compose down
```

---

### Cách 2: Chạy Môi trường Phát triển Cục bộ (Local Dev)

1. **Khởi chạy CSDL & Cache:**
   ```bash
   docker compose up -d postgres_db redis_cache
   ```

2. **Khởi chạy Backend (Spring Boot 3.3.4 - Java 21):**
   ```bash
   cd backend
   ./mvnw spring-boot:run
   ```
   *API Test:* [http://localhost:8080/api/test/hello](http://localhost:8080/api/test/hello)

3. **Khởi chạy Frontend (React 19 + Vite 8 + TailwindCSS v4):**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
   *Giao diện Dev:* [http://localhost:5173](http://localhost:5173)

---

## 📂 Cấu trúc Dự án

```text
multilingo-platform/
├── backend/            # Mã nguồn Spring Boot (Java 21, Spring Data JPA, Security)
├── frontend/           # Mã nguồn React 19 (TypeScript, Vite, TailwindCSS v4, Redux)
├── .agents/            # Quy chuẩn Rules & Skills tự động nạp cho AI Pair Programmer
├── docs/               # Toàn bộ tài liệu đặc tả, thiết kế CSDL và quy trình
│   ├── DacTa/          # Đặc tả Use Cases chi tiết (SRS)
│   ├── superpowers/    # Tài liệu specs và implementation plans
│   ├── AI_AGENT_GUIDE.md          # 🤖 Hướng dẫn prompt & phối hợp hiệu quả với AI Agent
│   └── TEAM_DEVELOPMENT_GUIDE.md  # 📘 Hướng dẫn phát triển & quy chuẩn cho team
├── docker-compose.yml  # Orchestration toàn bộ hệ thống
├── GEMINI.md           # ⚡ Quy tắc cốt lõi kiến trúc và phương pháp luận Superpowers
└── README.md           # Tài liệu tổng quan dự án
```

---

## 📘 Tài liệu & Quy chuẩn dành cho Team

Mọi thành viên trong dự án và Agentic AI bắt buộc đọc và tuân thủ các quy tắc trong:
* **[Hướng dẫn Sử dụng AI Agent (`docs/AI_AGENT_GUIDE.md`)](docs/AI_AGENT_GUIDE.md)**: Cách prompt, các kịch bản mẫu, quy trình làm việc với tính năng đã có / chưa có đặc tả.
* **[Tài liệu Hướng dẫn Phát triển cho Team (`docs/TEAM_DEVELOPMENT_GUIDE.md`)](docs/TEAM_DEVELOPMENT_GUIDE.md)**: Chi tiết kiến trúc Base, cấu trúc `BaseEntity`, chuẩn hóa `ApiResponse<T>`, xử lý lỗi `AppException`, TDD, Git Rebase & Force Push.
* **[Quy tắc cốt lõi `GEMINI.md`](GEMINI.md)**: Tiêu chuẩn bắt buộc về ID Strategy `INT`, JPA Auditing, Error handling và nghiệm thu tự động.
* **[Đặc tả Cơ sở Dữ liệu (`docs/DATABASE_SPECIFICATION.md`)](docs/DATABASE_SPECIFICATION.md)**: Sơ đồ ERD và Data Dictionary toàn bộ bảng dữ liệu.

---

## 🧪 Kiểm thử Hệ thống (Verification)

Trước khi commit mã nguồn hoặc tạo Pull Request, bắt buộc chạy kiểm thử:

```bash
# Kiểm thử Backend (100% tests PASS)
cd backend && ./mvnw clean test

# Kiểm thử Frontend (0 lint errors & build thành công)
cd ../frontend && npm run lint && npm run build
```
