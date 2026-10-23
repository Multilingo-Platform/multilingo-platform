# Đặc Tả Kiến Trúc & Triển Khai Hạ Tầng DevOps: Render, Vercel, Cloud DB, Redis & CI/CD

- **Mã tài liệu:** `SPEC-DEVOPS-DEPLOY-01`
- **Dự án:** Multilingo Platform
- **Ngày lập:** 23/10/2026
- **Trạng thái:** Chờ phê duyệt (Pending Review)
- **Mục tiêu:** Chuẩn hóa toàn bộ quy trình đóng gói, triển khai hạ tầng cloud phân tán (Decoupled Architecture), thiết lập CI/CD Quality Gates, cơ chế bảo mật mạng, và hệ thống giám sát vận hành (Observability) cho dự án Multilingo Platform.

---

## 1. Bối cảnh & Phạm vi (Scope & Context)

### 1.1 Hiện trạng hệ thống
* **Backend:** Java 21, Spring Boot 3.x, Spring Data JPA, Hibernate, Flyway Migration (15 migration scripts), Spring Security (Stateless JWT), Redis (blacklist tokens, sessions), Gemini AI API, VNPay Sandbox. Đã có Multi-stage `Dockerfile`.
* **Frontend:** Vite + React 19, TypeScript, TailwindCSS v4, React Router 7, Redux Toolkit, Axios. Đã có multi-stage `Dockerfile` (Nginx) cho môi trường container nội bộ.
* **Database & Cache Local:** Đang dùng `docker-compose.yml` gồm PostgreSQL 16 và Redis 7.

### 1.2 Mục tiêu kiến trúc Cloud
Triển khai hệ thống lên hạ tầng điện toán đám mây tối ưu chi phí (0$ - $10/tháng), độ sẵn sàng cao, và tự động hóa 100%:
1. **Frontend:** Triển khai trên **Vercel** tận dụng Global Edge Network (CDN), tự động build từ Git, quản trị SSL miễn phí.
2. **Backend:** Triển khai dạng Docker Container trên **Render Web Service**, tích hợp Health Check Probe `/api/health`, tự động khởi động lại khi crash.
3. **Database:** Sử dụng Cloud Managed PostgreSQL (**Neon.tech** hoặc **Render Postgres**), tự động chạy migration qua Flyway khi boot.
4. **Cache / In-Memory:** Sử dụng Cloud Redis Serverless (**Upstash Redis**), mã hóa TLS/SSL.
5. **CI/CD:** Xây dựng Pipeline 3 tầng trên **GitHub Actions** đảm bảo Quality Gate (Unit Test Backend + Lint/Build Frontend) trước khi kích hoạt Deploy Hook sang Render và Vercel.
6. **Observability & Logging:** Thiết lập stream log từ Render sang Better Stack / Papertrail, cấu hình Sentry bắt lỗi phía Client.

---

## 2. Sơ đồ Kiến trúc & Luồng Dữ liệu (Architecture Topology)

```
                                    ┌────────────────────────┐
                                    │      END USER BROWSER  │
                                    └───────────┬────────────┘
                                                │
                 ┌──────────────────────────────┴──────────────────────────────┐
                 │ (1) HTTPS Static Bundle                                     │ (2) HTTPS REST Calls
                 │     (index.html, assets)                                    │     (Bearer JWT, withCredentials)
                 ▼                                                             ▼
  ┌──────────────────────────────┐                             ┌──────────────────────────────┐
  │         VERCEL HOST          │                             │         RENDER HOST          │
  │   Frontend (React 19 SPA)    │                             │    Backend (Java 21 Docker)  │
  │                              │                             │                              │
  │  • Global Edge CDN           │                             │  • Spring Boot 3             │
  │  • SPA Rewrite (vercel.json) │                             │  • Health Check /api/health  │
  │  • HTTPS Zero-Config         │                             │  • Port 8080                 │
  └──────────────────────────────┘                             └──────────────┬───────────────┘
                                                                              │
                                               ┌──────────────────────────────┴──────────────────────────────┐
                                               ▼                                                             ▼
                                ┌──────────────────────────────┐                             ┌──────────────────────────────┐
                                │      CLOUD POSTGRESQL        │                             │         CLOUD REDIS          │
                                │   (Neon.tech / Render DB)    │                             │      (Upstash Serverless)    │
                                │                              │                             │                              │
                                │  • Port 5432 (SSL Required)  │                             │  • Port 6379 (TLS/SSL)       │
                                │  • Flyway Auto-Migration     │                             │  • JWT Blacklist Tokens      │
                                │  • 15 Versioned SQL Files    │                             │  • Session Revocation        │
                                └──────────────────────────────┘                             └──────────────────────────────┘
```

---

## 3. Các Điểm Kỹ Thuật Bắt Buộc Hiệu Chỉnh Mã Nguồn (Prerequisites)

### 3.1 Backend: Cấu hình CORS Động theo Biến Môi Trường
* **File:** `backend/src/main/java/com/multilingo/backend/config/SecurityConfig.java`
* **Vấn đề:** Hiện tại `SecurityConfig` đang hardcode `List.of("http://localhost", "http://localhost:80", "http://localhost:5173", "http://localhost:3000")`. Khi client gọi từ Vercel (`https://*.vercel.app`), trình duyệt sẽ chặn request do CORS header không khớp.
* **Giải pháp:** Cho phép cấu hình qua danh sách mẫu (Origin Patterns) hoặc biến môi trường `app.cors.allowed-origins`:
  ```java
  @Value("${app.cors.allowed-origins:http://localhost:5173,http://localhost:3000}")
  private String allowedOrigins;

  @Bean
  public CorsConfigurationSource corsConfigurationSource() {
      CorsConfiguration configuration = new CorsConfiguration();
      List<String> origins = Arrays.stream(allowedOrigins.split(","))
                                   .map(String::trim)
                                   .toList();
      configuration.setAllowedOriginPatterns(List.of(
          "http://localhost:*",
          "https://*.vercel.app",
          "https://*.onrender.com"
      ));
      configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"));
      configuration.setAllowedHeaders(List.of("*"));
      configuration.setAllowCredentials(true);
      
      UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
      source.registerCorsConfiguration("/**", configuration);
      return source;
  }
  ```

### 3.2 Backend: Hỗ trợ Redis Password & SSL/TLS
* **File:** `backend/src/main/resources/application.properties`
* **Vấn đề:** Chỉ có cấu hình `spring.data.redis.host` và `port`. Các dịch vụ Serverless Redis như Upstash bắt buộc kết nối có TLS/SSL và mật khẩu xác thực.
* **Giải pháp:** Bổ sung các thuộc tính có fallback an toàn:
  ```properties
  spring.data.redis.host=${SPRING_DATA_REDIS_HOST:${REDIS_HOST:localhost}}
  spring.data.redis.port=${SPRING_DATA_REDIS_PORT:${REDIS_PORT:6379}}
  spring.data.redis.password=${SPRING_DATA_REDIS_PASSWORD:}
  spring.data.redis.ssl.enabled=${SPRING_DATA_REDIS_SSL_ENABLED:false}
  ```

### 3.3 Backend: Tối ưu Cấp Phát Bộ Nhớ JVM Container trên Render (Tránh OOMKilled)
* **Vấn đề:** Render Free/Starter cấp 512MB RAM. Java 21 mặc định với G1GC và dynamic heap sizing dễ chạm trần 512MB và bị hệ thống hạ sát (`Exit code 137 / OOMKilled`).
* **Giải pháp:** Thiết lập biến môi trường JVM bắt buộc trên Render:
  ```bash
  JAVA_TOOL_OPTIONS="-XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0 -XX:+UseSerialGC -XX:+TieredCompilation -XX:TieredStopAtLevel=1"
  ```
  * *Giải thích:* `-XX:MaxRAMPercentage=75.0` giới hạn Max Heap ở mức 384MB (nhường 128MB cho metaspace, native memory, thread stacks); `-XX:+UseSerialGC` giảm tải CPU và RAM cho GC luồng phụ.

### 3.4 Frontend: Cấu hình SPA Rewrite Routing trên Vercel
* **File mới:** `frontend/vercel.json`
* **Vấn đề:** Ứng dụng là Client-Side Routing (React Router 7). Khi F5 trên đường dẫn như `/student/dashboard` hay `/exam/1`, Vercel sẽ tìm file tĩnh tương ứng và báo 404.
* **Giải pháp:**
  ```json
  {
    "rewrites": [
      {
        "source": "/(.*)",
        "destination": "/index.html"
      }
    ]
  }
  ```

---

## 4. Đặc Tả Từng Bước Triển Khai (Step-by-Step Execution Plan)

### Bước 1: Khởi tạo Dịch vụ Cơ sở Dữ liệu & Cache
1. **PostgreSQL (Neon.tech):**
   * Tạo database `multilingodb`.
   * Lấy JDBC URL: `jdbc:postgresql://<host>:5432/<dbname>?sslmode=require`.
   * Tạo tài khoản chuyên dụng với quyền `CREATE EXTENSION` (để hỗ trợ `uuid-ossp` nếu cần).
2. **Redis (Upstash):**
   * Tạo database `multilingo-redis` tại khu vực gần backend nhất.
   * Lấy Hostname, Port 6379, Password bí mật và cờ bật SSL/TLS.

### Bước 2: Triển khai Backend lên Render
1. Tạo **Web Service** trên Render kết nối với nhánh `main`.
2. Đặt **Root Directory:** `backend`.
3. Đặt **Environment:** `Docker`.
4. Cấu hình **Health Check Path:** `/api/health`.
5. Điền đầy đủ bộ biến môi trường (xem Mục 6).
6. Render tự động thực thi `backend/Dockerfile` multi-stage build, cache dependency Maven, và run container trên cổng `8080`.
7. Kiểm tra log khởi động: Xác nhận Flyway đã migrate 15 scripts thành công và Health Check trả về `status: UP`.

### Bước 3: Triển khai Frontend lên Vercel
1. Import repository vào Vercel.
2. Chọn **Root Directory:** `frontend`.
3. Chọn **Framework Preset:** `Vite`.
4. Thiết lập biến môi trường:
   * `VITE_API_URL`: URL public của backend trên Render (dạng `https://multilingo-backend.onrender.com/api`).
   * `VITE_GOOGLE_CLIENT_ID`: Khóa Google OAuth2 Web Client.
5. Vercel tự động chạy `npm install` và `npm run build`, sau đó publish `dist/` lên mạng lưới CDN toàn cầu.

### Bước 4: Thiết lập CI/CD Pipeline (GitHub Actions)
1. Tạo Render Deploy Hook URL từ Render Dashboard.
2. Đưa Hook URL vào GitHub Repository Secrets với tên `RENDER_DEPLOY_HOOK_URL`.
3. Cập nhật `.github/workflows/deploy.yml`:
   * **Job 1 (backend-ci):** Cài đặt JDK 21, chạy `mvn clean test` (sử dụng H2 Database in-memory).
   * **Job 2 (frontend-ci):** Cài đặt Node 20, chạy `npm ci`, kiểm tra `npm run lint`, chạy `npm run test`, kiểm tra `npm run build`.
   * **Job 3 (deploy):** Chỉ chạy khi push nhánh `main` VÀ cả 2 Job 1 + 2 đều PASS ➔ Gọi `curl -X POST $RENDER_DEPLOY_HOOK_URL`.

### Bước 5: Giám sát Vận hành (Observability & Anti-Sleep)
1. **Render Log Streams:** Kết nối Render log streams tới **Better Stack (Logtail)** để tìm kiếm log và cảnh báo Exception theo thời gian thực.
2. **Cơ chế chống ngủ đông (Anti-Cold Start):** Tạo monitor trên **UptimeRobot** ping định kỳ 10 phút/lần tới `https://multilingo-backend.onrender.com/api/health` nhằm duy trì instance backend ở trạng thái sẵn sàng, loại bỏ độ trễ khởi động của gói Free.

---

## 5. Tiêu Chí Kiểm Tra & Nghiệm Thu Vận Hành (Verification Checklist)

Hệ thống được xác nhận triển khai thành công khi đáp ứng đầy đủ các tiêu chuẩn kiểm tra thực tế sau:

- [ ] **Health Check Probe:** Endpoint `GET /api/health` trả về HTTP `200 OK` với body `{"status": "UP", "service": "multilingo-backend"}`.
- [ ] **Flyway Migration:** Backend kết nối thành công tới Neon PostgreSQL và tự động chạy đủ các script migration từ `V1` đến phiên bản mới nhất khi khởi động lần đầu.
- [ ] **CORS Preflight & Security:** Trình duyệt truy cập từ `https://*.vercel.app` gửi request có `withCredentials = true` tới `https://*.onrender.com` nhận được header `Access-Control-Allow-Origin` và `Access-Control-Allow-Credentials: true` mà không bị chặn.
- [ ] **Redis Blacklist & Session:** Đăng nhập và đăng xuất thành công; sau khi logout, token cũ bị thu hồi qua Upstash Redis (gọi API tiếp theo trả về `401 Unauthorized`).
- [ ] **Vercel SPA Routing:** Truy cập trực tiếp hoặc bấm F5 ở đường dẫn con (`/student/dashboard`, `/exam/1`) trên domain Vercel không bị lỗi 404.
- [ ] **JVM Container Stability:** Ứng dụng Backend chạy ổn định trong giới hạn 512MB RAM của Render, không bị khởi động lại do lỗi `OOMKilled (Exit code 137)`.
- [ ] **Quality Gate CI/CD:** GitHub Actions tự động kiểm thử Backend và Frontend khi có Pull Request / Push; chỉ kích hoạt Render Deploy Hook khi tất cả bài kiểm tra đều pass.


---

## 6. Ma Trận Biến Môi Trường Chi Tiết (Environment Variables Matrix)

### 6.1 Backend (Thiết lập trên Render Dashboard)

| Tên biến | Kiểu giá trị | Mô tả & Mục đích | Bắt buộc |
| :--- | :--- | :--- | :---: |
| `SPRING_PROFILES_ACTIVE` | String | Đặt là `prod` để kích hoạt cấu hình tối ưu production | Có |
| `PORT` | Integer | Cổng cổng dịch vụ (Render mặc định cấp, map vào `8080`) | Có |
| `SERVER_PORT` | Integer | Giá trị `8080` khớp với container | Có |
| `SPRING_DATASOURCE_URL` | String | `jdbc:postgresql://<host>:5432/<dbname>?sslmode=require` | Có |
| `SPRING_DATASOURCE_USERNAME`| String | User database Neon | Có |
| `SPRING_DATASOURCE_PASSWORD`| Secret | Mật khẩu database Neon | Có |
| `SPRING_DATA_REDIS_HOST` | String | Host Upstash Redis (`*.upstash.io`) | Có |
| `SPRING_DATA_REDIS_PORT` | Integer | `6379` | Có |
| `SPRING_DATA_REDIS_PASSWORD`| Secret | Mật khẩu Upstash Redis | Có |
| `SPRING_DATA_REDIS_SSL_ENABLED`| Boolean | `true` (Upstash bắt buộc SSL) | Có |
| `SPRING_JWT_SECRET` | Secret | Khóa HMAC-SHA256 ký JWT (tối thiểu 64 ký tự) | Có |
| `SPRING_JWT_EXPIRATION_MS` | Integer | `1800000` (30 phút) | Có |
| `SPRING_JWT_REFRESH_EXPIRATION_MS` | Integer | `604800000` (7 ngày) | Có |
| `GOOGLE_CLIENT_ID` | String | Khóa Google Client ID xác thực OAuth2 | Không |
| `GEMINI_API_KEY` | Secret | API Key Google Gemini (cho AI Dictionary / Writing Hints) | Không |
| `GEMINI_MODEL` | String | `gemini-3.8-flash` | Không |
| `VNPAY_TMN_CODE` | String | Mã định danh Merchant VNPay Sandbox | Không |
| `VNPAY_HASH_SECRET` | Secret | Khóa bí mật tạo Checksum VNPay | Không |
| `VNPAY_RETURN_URL` | String | `https://<vercel-url>/student/payment/result` | Không |
| `JAVA_TOOL_OPTIONS` | String | `-XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0 -XX:+UseSerialGC` | Có |

### 6.2 Frontend (Thiết lập trên Vercel Dashboard)

| Tên biến | Kiểu giá trị | Mô tả & Mục đích | Bắt buộc |
| :--- | :--- | :--- | :---: |
| `VITE_API_URL` | String | URL backend Render (ví dụ: `https://multilingo-backend.onrender.com/api`) | Có |
| `VITE_GOOGLE_CLIENT_ID` | String | Khóa Google Client ID đồng bộ với backend | Không |

---

## 7. Đánh Giá Rủi Ro & Kế Hoạch Ứng Phó (Risk & Rollback Strategy)

1. **Rủi ro Render Cold Start (30-50s trễ ở request đầu tiên):**
   * *Giải pháp:* Thiết lập UptimeRobot hoặc Cronjob ping `/api/health` mỗi 10 phút.
2. **Rủi ro Lỗi Flyway Migration khi nâng cấp DB:**
   * *Giải pháp:* Không bao giờ sửa các file migration đã commit (`V1` -> `V15`). Mọi thay đổi schema mới luôn tạo file mới với timestamp `VYYYYMMDDHHMMSS__<mo_ta>.sql`. Nếu migration lỗi, Render sẽ không thể start container mới, container cũ vẫn phục vụ.
3. **Rủi ro Rollback khẩn cấp:**
   * **Frontend:** Vercel hỗ trợ **Instant Rollback** với 1 click trong mục Deployments về phiên bản trước mà không cần build lại.
   * **Backend:** Render cho phép Rollback về commit trước đó trong tab **Deploys**.
