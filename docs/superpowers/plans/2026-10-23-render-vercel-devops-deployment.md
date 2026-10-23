# Kế Hoạch Triển Khai Hạ Tầng DevOps & Cloud Deployment (Render, Vercel, Neon DB, Upstash Redis, CI/CD)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Triển khai toàn diện hệ thống Multilingo Platform lên hạ tầng Cloud Decoupled (Vercel cho Frontend SPA, Render cho Backend Docker Container, Neon PostgreSQL, Upstash Redis), đồng thời thiết lập CI/CD Quality Gates và hệ thống giám sát log tập trung.

**Architecture:** Frontend React 19 SPA chạy trên Vercel Edge CDN kết nối qua HTTPS/RESTful tới Backend Spring Boot 3 chạy trên Render Web Service. Cơ sở dữ liệu và Cache được quản trị độc lập trên Neon PostgreSQL và Upstash Serverless Redis với kết nối mã hóa SSL/TLS. Quy trình deploy được bảo vệ bởi GitHub Actions Quality Gates.

**Tech Stack:** Java 21, Spring Boot 3, Maven, Spring Security, Flyway, PostgreSQL 16, Redis 7, React 19, Vite, TypeScript, Docker, Render, Vercel, GitHub Actions.

**Spec:** [`docs/superpowers/specs/2026-10-23-render-vercel-devops-deployment-spec.md`](file:///F:/Working/JavaBackend/multilingo-platform/docs/superpowers/specs/2026-10-23-render-vercel-devops-deployment-spec.md)

## Global Constraints
- Tất cả các endpoint gọi cross-origin giữa Vercel (`https://*.vercel.app`) và Render (`https://*.onrender.com`) phải hỗ trợ CORS với `allowCredentials = true`.
- Kết nối PostgreSQL trên Cloud bắt buộc có tham số `sslmode=require`.
- Kết nối Redis trên Cloud (Upstash) bắt buộc hỗ trợ xác thực mật khẩu và TLS/SSL.
- Container JVM Backend trên Render không được vượt quá 384MB heap để tránh OOMKilled trên gói 512MB RAM (`-XX:MaxRAMPercentage=75.0 -XX:+UseSerialGC`).
- Mọi routing trên Vercel phải được rewrite về `/index.html` để phục vụ React Router 7.
- Không được bypass Quality Gate: Unit Test Backend và Lint/Build Frontend phải PASS 100% trước khi deploy.

## Review Focus
1. **Lỗi chặn CORS preflight:** Gọi request từ domain Vercel tới Render bị chặn bởi trình duyệt nếu `SecurityConfig` không cho phép pattern `https://*.vercel.app`.
2. **Lỗi 404 Vercel khi F5:** Người dùng reload trang chi tiết bài thi hoặc dashboard bị lỗi 404 do thiếu `frontend/vercel.json`.
3. **Lỗi OOMKilled (Exit code 137) trên Render:** Khởi động JVM Java 21 ngốn vượt mức 512MB RAM dẫn đến Render tự động kill container.
4. **Lỗi kết nối SSL PostgreSQL:** Thiếu `?sslmode=require` trong JDBC URL khiến driver từ chối kết nối tới Neon DB.
5. **Lỗi xác thực Redis NOAUTH:** Upstash Redis yêu cầu password nhưng backend gửi request nặc danh.

---

### Task 1: Cấu hình CORS Động & Cho Phép Domain Vercel trong Backend

**Files:**
- Modify: `backend/src/main/java/com/multilingo/backend/config/SecurityConfig.java:57-68`
- Modify: `backend/src/main/resources/application.properties:28-35`

**Interfaces:**
- Consumes: Thuộc tính `app.cors.allowed-origins` từ `application.properties`
- Produces: `CorsConfigurationSource` bean hỗ trợ cả localhost và pattern `https://*.vercel.app`, `https://*.onrender.com`

- [ ] **Step 1: Cập nhật biến cấu hình CORS trong application.properties**
Thêm thuộc tính vào `backend/src/main/resources/application.properties`:
```properties
# CORS Configuration
app.cors.allowed-origins=${CORS_ALLOWED_ORIGINS:http://localhost,http://localhost:80,http://localhost:5173,http://localhost:3000}
```

- [ ] **Step 2: Cập nhật SecurityConfig để cho phép các domain Cloud**
Cập nhật `backend/src/main/java/com/multilingo/backend/config/SecurityConfig.java`:
```java
    @org.springframework.beans.factory.annotation.Value("${app.cors.allowed-origins:http://localhost,http://localhost:80,http://localhost:5173,http://localhost:3000}")
    private String allowedOrigins;

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        
        // Hỗ trợ cả danh sách cấu hình và các mẫu wildcard cho Vercel / Render
        configuration.setAllowedOriginPatterns(List.of(
                "http://localhost:*",
                "http://localhost",
                "https://*.vercel.app",
                "https://*.onrender.com"
        ));
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"));
        configuration.setAllowedHeaders(List.of("*"));
        configuration.setAllowCredentials(true);
        configuration.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }
```

- [ ] **Step 3: Kiểm tra biên dịch Backend**
Chạy: `cd backend && ./mvnw test-compile`
Kỳ vọng: Biên dịch thành công không có lỗi cú pháp.

- [ ] **Step 4: Commit thay đổi**
```bash
git add backend/src/main/java/com/multilingo/backend/config/SecurityConfig.java backend/src/main/resources/application.properties
git commit -m "feat(security): configure dynamic cors and vercel domain origins"
```

---

### Task 2: Cấu hình Hỗ trợ Redis Password & SSL/TLS cho Cloud Cache

**Files:**
- Modify: `backend/src/main/resources/application.properties:24-27`

**Interfaces:**
- Consumes: Biến môi trường `SPRING_DATA_REDIS_PASSWORD` và `SPRING_DATA_REDIS_SSL_ENABLED`
- Produces: Spring Boot Lettuce Connection Factory kết nối mã hóa TLS tới Upstash Redis

- [ ] **Step 1: Bổ sung cấu hình Redis vào application.properties**
Mở `backend/src/main/resources/application.properties` và sửa đoạn cấu hình Redis:
```properties
# Redis configuration (hỗ trợ cả Local Docker và Cloud Upstash TLS)
spring.data.redis.host=${SPRING_DATA_REDIS_HOST:${REDIS_HOST:localhost}}
spring.data.redis.port=${SPRING_DATA_REDIS_PORT:${REDIS_PORT:6379}}
spring.data.redis.password=${SPRING_DATA_REDIS_PASSWORD:}
spring.data.redis.ssl.enabled=${SPRING_DATA_REDIS_SSL_ENABLED:false}
spring.data.redis.timeout=5000ms
```

- [ ] **Step 2: Commit thay đổi**
```bash
git add backend/src/main/resources/application.properties
git commit -m "fix(redis): add password and ssl support for cloud redis connectivity"
```

---

### Task 3: Cấu hình Frontend Routing cho Vercel (`vercel.json`) & Kiểm tra Axios Client

**Files:**
- Create: `frontend/vercel.json`
- Review: `frontend/src/core/api/axiosClient.ts`

**Interfaces:**
- Consumes: Biến môi trường `VITE_API_URL` khi build production
- Produces: Quy tắc Rewrite toàn bộ đường dẫn con về `index.html` cho Vercel Edge Server

- [ ] **Step 1: Tạo file vercel.json**
Tạo file `frontend/vercel.json`:
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

- [ ] **Step 2: Kiểm tra cấu hình baseURL trong axiosClient.ts**
Đảm bảo file `frontend/src/core/api/axiosClient.ts` đã có:
```typescript
baseURL: import.meta.env.VITE_API_URL || '/api',
```
*(Hiện tại code dự án đã hỗ trợ sẵn thuộc tính này).*

- [ ] **Step 3: Kiểm tra quá trình Build tĩnh của Frontend**
Chạy: `cd frontend && npm run build`
Kỳ vọng: Thư mục `frontend/dist` được tạo thành công, không có lỗi TypeScript hay cú pháp.

- [ ] **Step 4: Commit thay đổi**
```bash
git add frontend/vercel.json
git commit -m "chore(frontend): add vercel.json routing rewrite configuration"
```

---

### Task 4: Nâng cấp GitHub Actions CI/CD Pipeline (Quality Gates)

**Files:**
- Modify: `.github/workflows/cicd-pipeline.yml`

**Interfaces:**
- Consumes: Secret `RENDER_DEPLOY_HOOK_URL` từ GitHub Repo Secrets
- Produces: Pipeline tự động hóa kiểm thử Backend, kiểm thử Frontend và kích hoạt Deploy Hook chỉ khi tất cả PASS

- [ ] **Step 1: Cập nhật file `.github/workflows/cicd-pipeline.yml`**
Thay thế nội dung bằng cấu hình Quality Gate 3 tầng:
```yaml
name: Multilingo CI/CD Pipeline

on:
  push:
    branches: [ "main", "develop" ]
  pull_request:
    branches: [ "main", "develop" ]
  workflow_dispatch:

jobs:
  # =======================================================
  # 1. CI BACKEND (Unit Test H2 in-memory độc lập)
  # =======================================================
  backend-ci:
    name: Backend Test & Verification
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Set up JDK 21
        uses: actions/setup-java@v4
        with:
          java-version: '21'
          distribution: 'temurin'
          cache: maven

      - name: Run Backend Tests
        working-directory: ./backend
        run: mvn clean test

  # =======================================================
  # 2. CI FRONTEND (Lint, Typecheck & Vitest)
  # =======================================================
  frontend-ci:
    name: Frontend Lint & Build
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Set up Node.js 20
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: './frontend/package-lock.json'

      - name: Install Dependencies
        working-directory: ./frontend
        run: npm ci

      - name: Check Lint (Oxlint)
        working-directory: ./frontend
        run: npm run lint

      - name: Run Unit Tests (Vitest)
        working-directory: ./frontend
        run: npm run test

      - name: Build Frontend
        working-directory: ./frontend
        run: npm run build

  # =======================================================
  # 3. CD DEPLOY (Chỉ chạy khi push vào main & CI PASS 100%)
  # =======================================================
  deploy:
    name: Trigger Render Deploy
    needs: [backend-ci, frontend-ci]
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main' && github.event_name == 'push' && success()
    steps:
      - name: Trigger Render Deploy Hook
        if: env.RENDER_HOOK != ''
        env:
          RENDER_HOOK: ${{ secrets.RENDER_DEPLOY_HOOK_URL }}
        run: |
          echo "Kích hoạt triển khai Render Web Service..."
          curl -X POST "$RENDER_HOOK"
```

- [ ] **Step 2: Commit thay đổi**
```bash
git add .github/workflows/cicd-pipeline.yml
git commit -m "ci(github-actions): modernize pipeline with quality gates and render webhook"
```

---

### Task 5: Hướng dẫn Khởi Tạo Database (Neon) & Cache (Upstash)

**Files:**
- Không chỉnh sửa code; thực hiện qua Cloud Dashboard

- [ ] **Step 1: Tạo PostgreSQL trên Neon.tech**
1. Truy cập [https://console.neon.tech](https://console.neon.tech) và đăng nhập bằng GitHub.
2. Nhấn **Create Project**:
   * Name: `multilingo-db`
   * Region: `Singapore (ap-southeast-1)` hoặc khu vực gần nhất
   * PostgreSQL Version: `16`
3. Trong Dashboard của Neon, tại mục **Connection Details**, chọn tab **Connection string** và tích chọn **Pooled connection**.
4. Chọn dropdown **Java / JDBC**:
   * Sao chép URL dạng:
     `jdbc:postgresql://ep-xxxx-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require`
   * Ghi lại User, Password và Host.

- [ ] **Step 2: Tạo Redis trên Upstash**
1. Truy cập [https://console.upstash.com](https://console.upstash.com) và đăng nhập bằng GitHub.
2. Nhấn **Create Database**:
   * Name: `multilingo-redis`
   * Type: `Regional`
   * Region: `ap-southeast-1 (Singapore)`
   * TLS (SSL): **Enabled** (Mặc định bật)
3. Trong trang chi tiết Database:
   * **Host:** `ap1-xxxx.upstash.io`
   * **Port:** `6379`
   * **Password:** Bấm copy chuỗi token bí mật trong phần `Details`.

---

### Task 6: Triển Khai Backend lên Render (Docker Service)

**Files:**
- Dashboard Render

- [ ] **Step 1: Tạo Web Service mới**
1. Truy cập [https://dashboard.render.com](https://dashboard.render.com) ➔ Chọn **New +** ➔ **Web Service**.
2. Chọn **Build and deploy from a Git repository** ➔ Chọn repo `multilingo-platform`.
3. Điền thông tin dịch vụ:
   * **Name:** `multilingo-backend`
   * **Region:** `Singapore` (hoặc cùng region với Neon/Upstash)
   * **Branch:** `main`
   * **Root Directory:** `backend` *(Rất quan trọng!)*
   * **Runtime:** `Docker`
   * **Instance Type:** `Free`

- [ ] **Step 2: Cấu hình Health Check & Advanced**
Mở mục **Advanced**:
* **Health Check Path:** `/api/health`
* **Auto-Deploy:** `Yes` (hoặc `No` nếu muốn chỉ deploy qua GitHub Actions hook)

- [ ] **Step 3: Nhập danh sách Biến Môi Trường (Environment Variables)**
Trong tab **Environment**, bấm **Add Environment Variable** cho từng cặp:

```ini
SPRING_PROFILES_ACTIVE=prod
SERVER_PORT=8080
PORT=8080
SPRING_DATASOURCE_URL=jdbc:postgresql://<neon_host>:5432/<neon_dbname>?sslmode=require
SPRING_DATASOURCE_USERNAME=<neon_user>
SPRING_DATASOURCE_PASSWORD=<neon_password>
SPRING_DATA_REDIS_HOST=<upstash_host>.upstash.io
SPRING_DATA_REDIS_PORT=6379
SPRING_DATA_REDIS_PASSWORD=<upstash_password>
SPRING_DATA_REDIS_SSL_ENABLED=true
SPRING_JWT_SECRET=DayLaMotSecretKeyRatDaiVaPhucTapDungDeKiJWTVaGiaiMa2026MultilingoPlatform!
SPRING_JWT_EXPIRATION_MS=1800000
SPRING_JWT_REFRESH_EXPIRATION_MS=604800000
GOOGLE_CLIENT_ID=111894131359-h2127ekqta6v4navl7n8pqolm55nqr22.apps.googleusercontent.com
GEMINI_API_KEY=<your_gemini_api_key_optional>
GEMINI_MODEL=gemini-3.8-flash
JAVA_TOOL_OPTIONS=-XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0 -XX:+UseSerialGC
```

- [ ] **Step 4: Khởi động Deploy và Lấy Deploy Hook**
1. Bấm **Create Web Service**.
2. Theo dõi tab **Logs**:
   * Kiểm tra log Maven tải dependency và build jar.
   * Kiểm tra log Flyway: `Successfully applied 15 migrations to schema "public"`.
   * Kiểm tra dòng log: `Tomcat started on port 8080 (http)`.
3. Vào **Settings** ➔ Cuộn xuống **Deploy Hook** ➔ Bấm **Create Deploy Hook** ➔ Copy URL và dán vào GitHub Repo Secret `RENDER_DEPLOY_HOOK_URL`.
4. Ghi nhận URL Backend: `https://multilingo-backend.onrender.com`.

---

### Task 7: Triển Khai Frontend lên Vercel

**Files:**
- Dashboard Vercel

- [ ] **Step 1: Import Project vào Vercel**
1. Truy cập [https://vercel.com/new](https://vercel.com/new) ➔ Chọn repo `multilingo-platform`.
2. Trong phần **Project Configuration**:
   * **Framework Preset:** `Vite`
   * **Root Directory:** Bấm **Edit** ➔ Chọn thư mục `frontend`.
   * **Build Command:** `npm run build`
   * **Output Directory:** `dist`
   * **Install Command:** `npm install`

- [ ] **Step 2: Thêm Biến Môi Trường trên Vercel**
Trong mục **Environment Variables**:
* `VITE_API_URL` = `https://multilingo-backend.onrender.com/api`
* `VITE_GOOGLE_CLIENT_ID` = `111894131359-h2127ekqta6v4navl7n8pqolm55nqr22.apps.googleusercontent.com`

- [ ] **Step 3: Bấm Deploy & Ghi nhận Domain**
1. Bấm **Deploy**. Vercel sẽ tự động build Vite trong khoảng 30–60 giây.
2. Nhận domain chính thức: `https://multilingo-platform.vercel.app`.

---

### Task 8: Thiết Lập Quản Trị Log, Giám Sát & Chống Ngủ Đông (Anti-Sleep)

**Files:**
- Better Stack & UptimeRobot Dashboards

- [ ] **Step 1: Thiết lập Chống Ngủ Đông (UptimeRobot - Miễn Phí)**
1. Đăng ký tài khoản miễn phí tại [https://uptimerobot.com](https://uptimerobot.com).
2. Chọn **Add New Monitor**:
   * Monitor Type: `HTTP(s)`
   * Friendly Name: `Multilingo Backend Health`
   * URL (or IP): `https://multilingo-backend.onrender.com/api/health`
   * Monitoring Interval: `10 minutes` (Vì Render Free sẽ sleep sau 15 phút không có traffic)
3. Nhấn **Create Monitor**. Giờ đây backend sẽ luôn luôn giữ trạng thái "ấm" (Warm instance) 24/7.

- [ ] **Step 2: Kết nối Render Log Stream sang Better Stack (Tùy chọn nâng cao)**
1. Đăng ký tài khoản tại [https://betterstack.com](https://betterstack.com) ➔ Chọn **Telemetry (Logs)**.
2. Tạo **Source** mới với nguồn `Render` ➔ Lấy `Ingesting Host` và `Token`.
3. Trong Render Dashboard ➔ Chọn service `multilingo-backend` ➔ **Settings** ➔ **Log Streams** ➔ Dán thông tin Better Stack.
4. Kiểm tra trên Better Stack để xem log thời gian thực, lọc lỗi `ERROR` và cấu hình cảnh báo về Email khi có sự cố.

---

### Task 9: Nghiệm Thu Đầu Cuối (End-to-End Verification)

- [ ] **Step 1: Kiểm thử Health Check Endpoint**
Chạy trên terminal:
```bash
curl -I https://multilingo-backend.onrender.com/api/health
```
Kỳ vọng: HTTP `200 OK`, JSON `{"status": "UP"}`.

- [ ] **Step 2: Kiểm thử CORS từ Trình duyệt**
1. Mở trang web Vercel `https://multilingo-platform.vercel.app`.
2. Mở F12 DevTools ➔ Tab **Console** và **Network**.
3. Thử đăng nhập hoặc gọi bất kỳ API nào ➔ Xác nhận không có lỗi đỏ `Blocked by CORS policy`.

- [ ] **Step 3: Kiểm thử Single Page App Routing**
1. Trên trình duyệt, gõ trực tiếp URL `https://multilingo-platform.vercel.app/student/dashboard` hoặc nhấn F5.
2. Xác nhận không gặp lỗi 404 Vercel, ứng dụng hiển thị giao diện bình thường.

- [ ] **Step 4: Kiểm thử Session & Blacklist Token qua Redis**
1. Đăng nhập vào hệ thống ➔ Đăng xuất (Logout).
2. Thử dùng Access Token cũ gọi lại API ➔ Xác nhận API trả về `401 Unauthorized` do token đã bị blacklist trên Upstash Redis.
