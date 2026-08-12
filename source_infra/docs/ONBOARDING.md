# 🚀 Developer Onboarding Guide — Nexus ERP

Chào mừng bạn gia nhập team! Hướng dẫn này giúp bạn setup môi trường và bắt đầu contribute trong vòng **< 30 phút**.

---

## Yêu cầu cơ bản

| Tool | Phiên bản | Cách cài |
|---|---|---|
| Docker Desktop | Latest | https://www.docker.com/products/docker-desktop |
| Java JDK | 21+ | https://adoptium.net/ |
| Node.js | 18+ | https://nodejs.org |
| Git | 2.40+ | https://git-scm.com |
| VS Code hoặc IntelliJ | Latest | IDE tuỳ chọn |

---

## Bước 1: Clone tất cả 3 repos

```bash
mkdir nexus-workspace && cd nexus-workspace

git clone https://github.com/nexus-company/source_infra.git
git clone https://github.com/nexus-company/source_be.git
git clone https://github.com/nexus-company/source_database.git
git clone https://github.com/nexus-company/source_fe.git  # (nếu làm FE)
```

---

## Bước 2: Khởi động hạ tầng Database

```bash
cd source_database/docker

# Copy và chỉnh sửa biến môi trường nếu cần
cp .env.example .env  # (nếu có)

# Khởi động tất cả: Postgres, Keycloak, Kafka, Elasticsearch
docker compose up -d

# Đợi khoảng 30s để tất cả services healthy
docker compose ps   # Status phải là "healthy" hoặc "running"
```

**Verify:**
- Postgres: `psql -h localhost -U nexus_admin -d nexus_erp` → kết nối thành công
- Keycloak: http://localhost:8180 (admin / admin123)
- Kafka UI: http://localhost:8082

---

## Bước 3: Chạy Database Migrations

```bash
cd source_database

# Chạy Master migrations
docker run --rm --network host \
  -v ./migrations/master:/flyway/sql flyway/flyway:10 \
  -url="jdbc:postgresql://localhost:5432/nexus_erp" \
  -user=nexus_admin -password=nexus_secret migrate

# Onboard tenant demo
./scripts/create_new_tenant.sh demo "Nexus Demo Store" professional

# Seed dữ liệu mẫu
psql -h localhost -U nexus_admin -d nexus_erp \
  -f data-seeding/01_seed_master_data.sql

# Set search_path rồi seed tenant demo data
psql -h localhost -U nexus_admin -d nexus_erp \
  -c "SET search_path TO tenant_demo;" \
  -f data-seeding/02_seed_tenant_demo.sql
```

---

## Bước 4: Chạy Backend (source_be)

```bash
cd source_be

# Copy env template
cp .env.example .env

# Option A: Local mode (H2 in-memory, không cần Postgres)
mvn spring-boot:run -Dspring-boot.run.profiles=local

# Option B: Dev mode (dùng Postgres vừa khởi động ở Bước 2)
mvn spring-boot:run -Dspring-boot.run.profiles=dev
```

**Verify:**
- API Health: http://localhost:8080/actuator/health → `{"status": "UP"}`
- Swagger UI: http://localhost:8080/swagger-ui.html
- H2 Console (local mode): http://localhost:8080/h2-console

---

## Bước 5: Test đăng nhập lần đầu

```bash
# Lấy JWT token từ demo admin
curl -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: tenant_demo" \
  -d '{"email": "admin@demo.nexus.com", "password": "Demo@123456"}'

# Copy access_token và dùng trong Swagger UI
```

---

## IntelliJ IDEA Setup

1. **Import Maven Project:** File → Open → chọn thư mục `source_be`
2. **Set JDK 21:** File → Project Structure → SDK → Java 21
3. **Reload Maven:** Maven panel (phải) → 🔁 Reload All Maven Projects
4. **Enable Annotation Processing:** Settings → Build → Compiler → Annotation Processors → ✅ Enable

---

## VS Code Setup

1. Install Extension Pack for Java
2. Mở thư mục `source_be`
3. `Ctrl+Shift+P` → "Java: Clean Java Language Server Workspace" → "Restart and delete"
4. `Ctrl+Shift+P` → "Java: Force Java Compilation" → "Full"

---

## Cấu trúc commit đầu tiên

```bash
git checkout -b feat/NX-XXX-ten-tinh-nang
# Code...
git add .
git commit -m "feat(module): mô tả thay đổi"
git push origin feat/NX-XXX-ten-tinh-nang
# Tạo Pull Request trên GitHub/GitLab
```

---

## Hỏi ai khi gặp vấn đề?

| Vấn đề | Hỏi ai |
|---|---|
| Setup môi trường | DevOps / Infra Lead |
| Architecture / Design | Tech Lead |
| Business logic / Nghiệp vụ | Product Owner |
| Code review | Assigned reviewer trên PR |
| Khẩn cấp Production | Theo INCIDENT_PLAYBOOK.md |
