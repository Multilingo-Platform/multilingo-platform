# Kế Hoạch Chuẩn Hóa Cấu Hình Docker & Frontend (Docker & Frontend Refactoring Plan)

> **Dành cho kỹ sư AI (Agentic Workers):** Áp dụng quy trình thực thi task tuần tự (`superpowers:executing-plans` hoặc `superpowers:subagent-driven-development`). Mỗi bước thực thi và kiểm thử độc lập, nghiệm thu bằng **`verification-before-completion`** (`mvn clean test` và `npm run build / docker compose config`).

**Mục tiêu:** Chuẩn hóa toàn bộ cấu hình Docker (Compose full-stack 4 services, Dockerfile, Nginx SPA config) và cấu hình Frontend dev proxy, biến môi trường Backend linh hoạt để toàn bộ hệ thống hoạt động liền mạch từ môi trường Local Dev đến Containerized Production.

**Kiến trúc:** Containerized Full-Stack Architecture kết nối thông qua Docker bridge network (`multilingo-net`). Tách bạch môi trường cấu hình thông qua Fallback Environment Variables. Frontend hỗ trợ SPA Routing qua Nginx `try_files`.

**Tech Stack:** Docker, Docker Compose v2, Nginx Alpine, Node 20 Alpine, Vite 8, React 19, Spring Boot 3.3.4, PostgreSQL 16, Redis 7.

---

## Global Constraints
- Nginx phục vụ Single Page Application (SPA): Phải cấu hình `try_files $uri $uri/ /index.html;` để tránh lỗi 404 khi người dùng refresh hoặc truy cập trực tiếp route con.
- Backend Database/Redis Connection: Phải sử dụng cú pháp placeholder có giá trị mặc định (`${ENV_VAR:default_value}`) để chạy được cả khi `docker compose up` lẫn chạy trực tiếp `./mvnw spring-boot:run`.
- Docker Compose Network: Tất cả các service (`postgres_db`, `redis_cache`, `backend`, `frontend`) phải nằm chung trong mạng bridge `multilingo-net`.
- Test Suite Backend: `mvn clean test` phải tiếp tục PASS 100% (9/9 tests) mà không bị ảnh hưởng bởi thay đổi cấu hình.
- Frontend Build: `npm run build` và `npm run lint` phải PASS 100% (0 errors, 0 warnings).

## Review Focus
1. **Lỗi 404 trên Nginx khi F5 trang React Router:** Khi truy cập trực tiếp `http://localhost/test-audio`, Nginx phải trả về `index.html` thay vì `404 Not Found`.
2. **Lỗi kết nối CSDL khi chạy Local vs Docker:** Backend không được hardcode credentials (`Son@2005` hay port cố định), phải fallback mượt mà giữa Docker (`postgres_db:5432`) và Local (`localhost:5432`).
3. **Lỗi thứ tự khởi động container (Startup Race Condition):** Backend container phụ thuộc vào DB và Cache; phải có `healthcheck` cho PostgreSQL (`pg_isready`) và Redis (`redis-cli ping`) trong `docker-compose.yml`.
4. **CORS và Dev Mode Proxy:** Frontend Vite dev server phải có proxy `/api` chuyển tiếp về `http://localhost:8080`.
5. **Cú pháp YAML Docker Compose:** File `docker-compose.yml` phải hoàn toàn hợp lệ khi kiểm tra bằng `docker compose config`.

---

## DANH SÁCH TASK CHI TIẾT (BITE-SIZED TASKS)

### Task 1: Cấu hình Nginx & Sửa Dockerfile Frontend (`frontend/nginx.conf`, `frontend/Dockerfile`)

**Mục tiêu:** Khắc phục triệt để lỗi 404 SPA routing bằng cách tạo file `nginx.conf` chuẩn và cập nhật `Dockerfile` của frontend.

**Files:**
- Tạo mới: `frontend/nginx.conf`
- Sửa: `frontend/Dockerfile`

- [x] **Bước 1.1:** Tạo file `frontend/nginx.conf` với nội dung cấu hình SPA fallback:
  ```nginx
  server {
      listen 80;
      server_name localhost;

      location / {
          root /usr/share/nginx/html;
          index index.html index.htm;
          try_files $uri $uri/ /index.html;
      }

      error_page 500 502 503 504 /50x.html;
      location = /50x.html {
          root /usr/share/nginx/html;
      }
  }
  ```
- [x] **Bước 1.2:** Sửa file `frontend/Dockerfile` bổ sung bước copy `nginx.conf`:
  ```dockerfile
  # frontend/Dockerfile
  FROM node:20-alpine AS build
  WORKDIR /app
  COPY package*.json ./
  RUN npm install
  COPY . .
  RUN npm run build

  FROM nginx:alpine
  COPY --from=build /app/dist /usr/share/nginx/html
  COPY nginx.conf /etc/nginx/conf.d/default.conf
  EXPOSE 80
  CMD ["nginx", "-g", "daemon off;"]
  ```
- [x] **Bước 1.3:** Kiểm tra build frontend tĩnh bằng lệnh:
  ```bash
  cd frontend && npm run build
  ```

---

### Task 2: Cấu hình Reverse Proxy cho Vite Dev Server (`frontend/vite.config.ts`)

**Mục tiêu:** Thêm reverse proxy cho môi trường dev cục bộ, giúp frontend gọi API không phụ thuộc vào CORS hoặc port cứng.

**Files:**
- Sửa: `frontend/vite.config.ts`

- [x] **Bước 2.1:** Cập nhật `frontend/vite.config.ts` thêm block `server.proxy`:
  ```typescript
  import { defineConfig } from 'vite'
  import react from '@vitejs/plugin-react'
  import tailwindcss from '@tailwindcss/vite'

  // https://vite.dev/config/
  export default defineConfig({
    plugins: [react(), tailwindcss()],
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: 'http://localhost:8080',
          changeOrigin: true,
          secure: false,
        },
      },
    },
  })
  ```
- [x] **Bước 2.2:** Chạy kiểm tra lint và build frontend:
  ```bash
  cd frontend && npm run lint && npm run build
  ```

---

### Task 3: Chuẩn hóa Biến Môi trường Backend (`backend/src/main/resources/application.properties`)

**Mục tiêu:** Loại bỏ cấu hình mật khẩu/port cứng trong `application.properties`, sử dụng biến môi trường linh hoạt có giá trị mặc định cho local dev.

**Files:**
- Sửa: `backend/src/main/resources/application.properties`

- [x] **Bước 3.1:** Cập nhật `backend/src/main/resources/application.properties`:
  ```properties
  spring.application.name=backend

  # Database configuration (hỗ trợ cả biến môi trường Docker và Local Fallback)
  spring.datasource.url=${SPRING_DATASOURCE_URL:jdbc:postgresql://${DB_HOST:localhost}:${DB_PORT:5432}/${DB_NAME:multilingodb}}
  spring.datasource.username=${SPRING_DATASOURCE_USERNAME:${DB_USER:postgres}}
  spring.datasource.password=${SPRING_DATASOURCE_PASSWORD:${DB_PASSWORD:postgres}}
  spring.datasource.driver-class-name=org.postgresql.Driver

  # Hibernate configuration
  spring.jpa.hibernate.ddl-auto=update
  spring.jpa.show-sql=true

  # Redis configuration
  spring.data.redis.host=${SPRING_DATA_REDIS_HOST:${REDIS_HOST:localhost}}
  spring.data.redis.port=${SPRING_DATA_REDIS_PORT:${REDIS_PORT:6379}}
  ```
- [x] **Bước 3.2:** Chạy lại test suite backend để kiểm chứng không bị ảnh hưởng:
  ```bash
  cd backend && ./mvnw test -Dtest=BackendApplicationTests
  ```

---

### Task 4: Nâng cấp Dockerfile Backend & Docker Compose Toàn diện (`backend/Dockerfile`, `docker-compose.yml`, `init.sql`)

**Mục tiêu:** Cấu hình `docker-compose.yml` đầy đủ 4 service (`postgres_db`, `redis_cache`, `backend`, `frontend`) kèm healthcheck và mạng chung.

**Files:**
- Sửa: `backend/Dockerfile`
- Sửa: `init.sql`
- Sửa: `docker-compose.yml`

- [x] **Bước 4.1:** Cập nhật `backend/Dockerfile` tối ưu layer cache và biến môi trường:
  ```dockerfile
  # backend/Dockerfile
  FROM maven:3.9.6-eclipse-temurin-21-alpine AS build
  WORKDIR /app

  # 1. Cache dependencies
  COPY pom.xml .
  RUN mvn dependency:go-offline -B

  # 2. Build source
  COPY src ./src
  RUN mvn clean package -DskipTests

  FROM eclipse-temurin:21-jre-alpine
  WORKDIR /app
  COPY --from=build /app/target/*.jar app.jar

  EXPOSE 8080
  ENTRYPOINT ["java", "-jar", "app.jar"]
  ```
- [x] **Bước 4.2:** Chuẩn hóa `init.sql`:
  ```sql
  -- init.sql: Cấu hình ban đầu cho PostgreSQL
  CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
  ```
- [x] **Bước 4.3:** Cập nhật `docker-compose.yml` đồng bộ 4 services:
  ```yaml
  version: '3.8'

  services:
    postgres_db:
      image: postgres:16-alpine
      container_name: multilingo-postgres
      ports:
        - "${DB_PORT:-5432}:5432"
      environment:
        - POSTGRES_DB=${DB_NAME:-multilingodb}
        - POSTGRES_USER=${DB_USER:-postgres}
        - POSTGRES_PASSWORD=${DB_PASSWORD:-postgres}
        - TZ=Asia/Ho_Chi_Minh
      volumes:
        - postgres_data:/var/lib/postgresql/data
        - ./init.sql:/docker-entrypoint-initdb.d/init.sql
      healthcheck:
        test: ["CMD-SHELL", "pg_isready -U ${DB_USER:-postgres} -d ${DB_NAME:-multilingodb}"]
        interval: 5s
        timeout: 5s
        retries: 5
      networks:
        - multilingo-net

    redis_cache:
      image: redis:7-alpine
      container_name: multilingo-redis
      ports:
        - "${REDIS_PORT:-6379}:6379"
      healthcheck:
        test: ["CMD", "redis-cli", "ping"]
        interval: 5s
        timeout: 5s
        retries: 5
      networks:
        - multilingo-net

    backend:
      build:
        context: ./backend
        dockerfile: Dockerfile
      container_name: multilingo-backend
      ports:
        - "8080:8080"
      environment:
        - SPRING_DATASOURCE_URL=jdbc:postgresql://postgres_db:5432/${DB_NAME:-multilingodb}
        - SPRING_DATASOURCE_USERNAME=${DB_USER:-postgres}
        - SPRING_DATASOURCE_PASSWORD=${DB_PASSWORD:-postgres}
        - SPRING_DATA_REDIS_HOST=redis_cache
        - SPRING_DATA_REDIS_PORT=6379
      depends_on:
        postgres_db:
          condition: service_healthy
        redis_cache:
          condition: service_healthy
      networks:
        - multilingo-net

    frontend:
      build:
        context: ./frontend
        dockerfile: Dockerfile
      container_name: multilingo-frontend
      ports:
        - "3000:80"
      depends_on:
        - backend
      networks:
        - multilingo-net

  volumes:
    postgres_data:

  networks:
    multilingo-net:
      driver: bridge
  ```
- [x] **Bước 4.4:** Kiểm tra cú pháp docker compose:
  ```bash
  docker compose config
  ```

---

### Task 5: Nghiệm thu Toàn diện (`verification-before-completion`)

**Mục tiêu:** Xác nhận toàn bộ kiểm thử backend và frontend pass 100%, cấu hình docker compose hợp lệ.

**Files:**
- Toàn bộ dự án

- [x] **Bước 5.1:** Chạy `docker compose config` xác nhận cú pháp compose chuẩn.
- [x] **Bước 5.2:** Chạy `npm run lint` và `npm run build` trong `frontend/`.
- [x] **Bước 5.3:** Chạy `mvn clean test` trong `backend/` chứng minh 100% tests PASS.
