# 🐳 Multilingo Platform - Quy Tắc Docker & Hạ Tầng

## Docker Compose
- File `docker-compose.yml` tại gốc dự án quản lý 4 services: `postgres_db`, `redis_cache`, `backend`, `frontend`.
- Mạng nội bộ: `multilingo-net` (bridge).
- PostgreSQL map ra host port `5434` (tránh xung đột port `5432` cục bộ).
- Redis map ra host port `6379`.

## Biến Môi trường Backend
- `application.properties` sử dụng cú pháp `${ENV_VAR:default}` cho mọi thông tin kết nối.
- Mặc định Local Dev: `localhost:5434` (PostgreSQL), `localhost:6379` (Redis), User/Pass: `postgres/postgres`.
- Trong Docker Network: Backend trỏ `postgres_db:5432` và `redis_cache:6379` (qua biến `SPRING_DATASOURCE_URL`, `SPRING_DATA_REDIS_HOST`).

## Healthcheck
- `postgres_db`: `pg_isready -U postgres -d multilingodb`.
- `redis_cache`: `redis-cli ping`.
- `backend` chỉ khởi động khi cả `postgres_db` và `redis_cache` ở trạng thái `healthy` (condition: `service_healthy`).

## Nginx Frontend (Production)
- File `frontend/nginx.conf` bắt buộc có `try_files $uri $uri/ /index.html;` cho SPA routing.
- `frontend/Dockerfile` phải copy `nginx.conf` vào `/etc/nginx/conf.d/default.conf`.

## Test Profile
- Backend test dùng H2 in-memory (profile `test`, file `application-test.properties`).
- `./mvnw clean test` phải chạy thành công 100% mà KHÔNG cần Docker/PostgreSQL/Redis.
