# Kế Hoạch Khắc Phục Lỗi Xác Thực Mật Khẩu PostgreSQL (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Khắc phục triệt để lỗi `PSQLException: FATAL: password authentication failed for user "postgres" (SQL State: 28P01)` gây crash backend và Flyway migration, đồng bộ hóa mật khẩu giữa PostgreSQL Container volume, cấu hình Docker Compose và Spring Boot `application.properties`.

**Architecture:** Đồng bộ hóa biến môi trường và mật khẩu nội tại của cơ sở dữ liệu PostgreSQL. Khi backend chạy trong Docker, biến `SPRING_DATASOURCE_PASSWORD` từ `docker-compose.yml` có độ ưu tiên cao hơn `application.properties`. Cần chuẩn hóa mật khẩu đồng nhất cho cả Docker Container và Local Run (cổng host 5434).

**Tech Stack:** Docker, Docker Compose, PostgreSQL 16 Alpine, Spring Boot 3.3.4, Flyway, HikariCP.

---

## 1. Phân Tích Nguyên Nhân Gốc Rễ (Root Cause Analysis)

Sau khi điều tra và kiểm tra trực tiếp trạng thái các container và volume Docker:
1. **Dữ liệu thực tế trong Volume Database:**
   - Volume `multilingo-platform_postgres_data` được khởi tạo từ ngày `11/09/2026`.
   - Trong bảng `pg_authid` của PostgreSQL hiện tại, user `postgres` đang lưu mật khẩu là **`123456`** (kiểm chứng thực tế: lệnh `PGPASSWORD=123456 psql` kết nối thành công, trong khi `PGPASSWORD=postgres` bị từ chối với mã lỗi `28P01`).
2. **Cơ chế nạp biến của Docker Compose:**
   - Trong `docker-compose.yml`, service `backend` khai báo:
     ```yaml
     SPRING_DATASOURCE_PASSWORD=${DB_PASSWORD:-postgres}
     ```
   - Do chưa có biến môi trường `DB_PASSWORD` hoặc file `.env`, Docker Compose đã gán giá trị mặc định `SPRING_DATASOURCE_PASSWORD=postgres` vào container `multilingo-backend`.
3. **Tại sao sửa `application.properties` chưa có tác dụng với container:**
   - Trong Spring Boot, biến môi trường hệ thống (`SPRING_DATASOURCE_PASSWORD`) có độ ưu tiên cao hơn giá trị fallback trong `application.properties` (`${SPRING_DATASOURCE_PASSWORD:${DB_PASSWORD:123456}}`).
   - Khi container khởi động, Spring Boot nhận mật khẩu `postgres` từ môi trường để kết nối, trong khi database thật sự trong volume lại yêu cầu `123456`, dẫn đến lỗi `FATAL: password authentication failed for user "postgres"`.

---

## 2. Các Hướng Giải Quyết (Options)

| Hướng | Giải pháp | Đánh giá |
| :--- | :--- | :--- |
| **Hướng 1 (Khuyến nghị chuẩn dự án)** | **Đổi mật khẩu trong DB về `postgres`** bằng lệnh SQL `ALTER USER postgres WITH PASSWORD 'postgres';` và giữ cấu hình chuẩn `postgres`. | ✅ Đồng bộ 100% với tài liệu dự án (`README.md`, `docs/TEAM_DEVELOPMENT_GUIDE.md`), không cần đổi config hay lo xung đột khi thành viên khác pull code. |
| **Hướng 2 (Giữ mật khẩu `123456`)** | Giữ mật khẩu `123456` trong DB, tạo file `.env` với `DB_PASSWORD=123456` và đồng bộ `docker-compose.yml`. | Phù hợp nếu máy local đang dùng chung Postgres 5432 ngoài host với mật khẩu `123456`. |

---

## 3. Chi Tiết Kế Hoạch Thực Hiện (Theo Hướng 1 - Khuyến Nghị)

### Task 1: Cập nhật mật khẩu user `postgres` trong PostgreSQL container về `postgres`

**Files:**
- Container: `multilingo-postgres`

- [x] **Step 1: Thực thi lệnh ALTER USER trong container**
```powershell
docker exec -i multilingo-postgres psql -U postgres -d multilingodb -c "ALTER USER postgres WITH PASSWORD 'postgres';"
```
Expected: `ALTER ROLE` trả về thành công.

- [x] **Step 2: Kiểm chứng kết nối TCP bằng mật khẩu `postgres`**
```powershell
docker exec -i multilingo-postgres sh -c "PGPASSWORD=postgres psql -h 172.20.0.3 -U postgres -d multilingodb -c 'SELECT 1;'"
```
Expected: Trả về `1` (kết nối thành công, không còn lỗi 28P01).

---

### Task 2: Đồng bộ cấu hình trong `backend/src/main/resources/application.properties`

**Files:**
- Modify: `backend/src/main/resources/application.properties`

- [x] **Step 1: Cập nhật fallback password về `postgres`**
Đảm bảo dòng 8 trong `application.properties`:
```properties
spring.datasource.password=${SPRING_DATASOURCE_PASSWORD:${DB_PASSWORD:postgres}}
```

- [x] **Step 2: Kiểm tra các cấu hình liên quan (URL, Port, Flyway)**
Kiểm tra dòng 6:
```properties
spring.datasource.url=${SPRING_DATASOURCE_URL:jdbc:postgresql://${DB_HOST:localhost}:${DB_PORT:5434}/${DB_NAME:multilingodb}}
```

---

### Task 3: Khởi động lại service Backend và kiểm chứng

**Files:**
- Container: `multilingo-backend`

- [x] **Step 1: Khởi động lại container backend**
```powershell
docker compose up -d --no-deps backend
```

- [x] **Step 2: Theo dõi log khởi động của `multilingo-backend`**
```powershell
docker logs multilingo-backend --tail 50
```
Expected:
- HikariPool kết nối thành công: `HikariPool-1 - Added connection org.postgresql.jdbc.PgConnection@...`
- Flyway thực thi schema migration thành công.
- Ứng dụng hiển thị `Started BackendApplication in X.XXX seconds`.

- [x] **Step 3: Kiểm tra trạng thái container**
```powershell
docker ps
```
Expected: `multilingo-backend` hiển thị trạng thái `Up` trên port `8080`.
