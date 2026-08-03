# 🐳 Docker Compose: Quản lý Đa Môi Trường (Dev/Stg/Prod)

> **Category**: Docker Containerization | **Complexity**: Intermediate | **Docker Compose**: V2

---

## 📖 Core Technical Mechanics & Deep-Dive

### The Multi-Environment Problem
Trong một dự án thực tế, bạn không bao giờ đẩy thẳng code lên Production. Bạn có 3 môi trường:
1. **Local (Dev)**: Máy cá nhân. Chạy DB rỗng, bật Debug, hở port lung tung để dễ test.
2. **Staging (Stg)**: Máy chủ mô phỏng Prod để QA test. DB có data mẫu, cấu hình gần giống Prod.
3. **Production (Prod)**: Máy chủ thật. Bảo mật tuyệt đối, giới hạn RAM/CPU chặt chẽ, không bao giờ lộ port DB ra ngoài.

**Anti-Pattern (Lỗi Dev hay gặp)**: Tạo 3 file riêng biệt (`docker-compose-dev.yml`, `docker-compose-prod.yml`...) và copy/paste trùng lặp 90% nội dung (như tên image, biến môi trường cơ bản). Sửa ở Dev thì quên sửa ở Prod -> Lỗi deploy.

### Giải pháp: Compose Overrides & Merge
Docker Compose hỗ trợ tính năng ghi đè (Merge) nhiều file YAML lại với nhau.
Cơ chế: Bạn tạo 1 file `compose.yaml` (Base) chứa 90% cấu hình dùng chung. Sau đó tạo các file `compose.override.yaml` (hoặc `compose-prod.yaml`) chỉ chứa 10% sự khác biệt của môi trường đó. Docker sẽ trộn (merge) chúng lại lúc chạy.

---

## 🌐 Real-World GitHub Patterns & Industry Reference

- **[Docker Compose Profiles](https://docs.docker.com/compose/profiles/)** — Kỹ thuật chọn lọc service cần chạy.
- **[Docker Compose Multiple Files](https://docs.docker.com/compose/multiple-compose-files/)** — Kỹ thuật merge file chuẩn hãng.

---

## 📐 System Design Blueprint & Setup Guide

### 1. File Base (Dùng chung cho mọi môi trường)
**Tệp: `compose.yaml`** (Chỉ định nghĩa Image, Volumes, và các biến môi trường không nhạy cảm).

```yaml
services:
  backend-api:
    image: my-company/backend-api:${APP_VERSION:-latest}
    restart: always
    environment:
      - DB_HOST=postgres-db
      - REDIS_HOST=redis-cache
    # Không khai báo 'ports' ở đây! Vì Dev cần port khác Prod.
    # Không khai báo 'resources' ở đây!

  postgres-db:
    image: postgres:16-alpine
    restart: always
    volumes:
      - pg_data:/var/lib/postgresql/data
    environment:
      - POSTGRES_DB=app_db
    # Passwords lấy từ file .env, không hardcode!
    
  redis-cache:
    image: redis:7-alpine
    restart: always

volumes:
  pg_data:
```

### 2. Môi trường Local (Dev)
**Tệp: `compose.override.yaml`** (Theo chuẩn Docker, file này sẽ TỰ ĐỘNG được merge với `compose.yaml` nếu bạn chỉ gõ `docker compose up` mà không truyền cờ gì thêm).

```yaml
services:
  backend-api:
    environment:
      - SPRING_PROFILES_ACTIVE=dev
      - DEBUG=true
    ports:
      - "8080:8080" # Mở port API ra cho máy cá nhân gọi

  postgres-db:
    ports:
      - "5432:5432" # Mở port DB ra để dùng DBeaver connect vào debug!
      
  # Dev cần thêm công cụ PgAdmin để xem DB cho dễ
  pgadmin:
    image: dpage/pgadmin4
    ports:
      - "5050:80"
    environment:
      - PGADMIN_DEFAULT_EMAIL=dev@local.com
      - PGADMIN_DEFAULT_PASSWORD=dev
```

### 3. Môi trường Production
**Tệp: `compose.prod.yaml`** (Phải chạy bằng cờ thủ công, tập trung vào Bảo mật & Giới hạn tài nguyên).

```yaml
services:
  backend-api:
    environment:
      - SPRING_PROFILES_ACTIVE=prod
      # Ghi đè JAVA_OPTS để giới hạn RAM
      - JAVA_OPTS=-XX:MaxRAMPercentage=75.0 -XX:+UseZGC
    ports:
      - "127.0.0.1:8080:8080" # Cực kỳ bảo mật: Chỉ cho phép Nginx ở localhost gọi tới, chặn public
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 2G
    logging:
      driver: "json-file"
      options:
        max-size: "50m"
        max-file: "3"

  postgres-db:
    # Ở Prod, KHÔNG KHAI BÁO CỔNG 'ports' NÀO CHO DB CẢ! Nó chỉ giao tiếp nội bộ trong mạng Docker.
    deploy:
      resources:
        limits:
          cpus: '4.0'
          memory: 4G
```

---

## 🧪 Verification Commands

```bash
# ==========================================
# GÓC NHÌN LẬP TRÌNH VIÊN Ở MÁY LOCAL
# ==========================================
# Dev chỉ cần gõ 1 lệnh duy nhất. Docker sẽ tự trộn compose.yaml và compose.override.yaml
docker compose up -d

# Xem log xem port 5432 đã mở chưa
docker compose ps


# ==========================================
# GÓC NHÌN DEVOPS Ở MÁY PRODUCTION
# ==========================================
# Trên VPS Prod, bắt buộc dùng cờ -f để chỉ định file Base và file Prod. 
# Nó sẽ BỎ QUA file override.yaml của Dev.
docker compose -f compose.yaml -f compose.prod.yaml up -d

# Có thể kiểm tra xem file cấu hình cuối cùng (sau khi trộn) trông như thế nào trước khi chạy:
docker compose -f compose.yaml -f compose.prod.yaml config
```

---

## ⚡ Best Practices & Anti-Patterns

### ✅ Best Practices
1. **Dùng biến môi trường `.env`**: Mọi Passwords, Secret Keys, API Tokens KHÔNG ĐƯỢC GHI vào file `compose.yaml`. Hãy tạo file `.env` chứa `DB_PASSWORD=secret`. File `compose.yaml` sẽ tự động đọc (Ví dụ: `POSTGRES_PASSWORD=${DB_PASSWORD}`). Đừng quên cho `.env` vào `.gitignore`!
2. **Dùng thẻ Profiles**: Nếu dự án có 10 service (Ví dụ: Frontend, Backend, AI Model). Khi ông Dev làm Frontend, ông ý không muốn tải cục AI Model 5GB về máy chạy cho nặng. Dùng Profile của docker compose (Ví dụ: `profiles: ["ai"]`). 

### ❌ Anti-Patterns

| Anti-Pattern | Problem | Fix |
|-------------|---------|-----|
| Bind mount mã nguồn thay vì build Image trên Prod | Dùng `volumes: - ./src:/app/src` trên Prod để "sửa code trực tiếp trên server cho nhanh". Mất hoàn toàn tính Immutable Infrastructure, không thể rollback. | Bind mount code chỉ dùng ở Local Dev để Hot-reload. Trên Prod BẮT BUỘC dùng Image (như `my-app:v1.2`). |
| Chạy `docker-compose down` khi Deploy bản mới | Lệnh `down` sẽ giết mạng (Network) của Docker, làm cho Web bị rớt (Downtime 5-10 giây) trước khi Container mới kịp lên. | Khi deploy bản mới (đã đổi tên version của Image), chỉ cần chạy `docker compose up -d`. Docker sẽ tự nhận diện Image mới, tự tạo Container mới thay thế Container cũ, mà mạng không bị gián đoạn nhiều. |
| Hardcode IP `172.x.x.x` của DB vào file config Spring Boot | IP của container có thể thay đổi bất cứ lúc nào nó restart. App Java không tìm thấy DB. | Dùng tính năng Docker DNS. Trỏ `spring.datasource.url=jdbc:postgresql://postgres-db:5432/app_db`. Tên service (`postgres-db`) tự động biến thành IP đúng. |
