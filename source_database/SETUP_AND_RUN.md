# 🗄️ Hướng Dẫn Chạy Database Stack (source_database) — Từ A đến Z

**Dành cho:** Developer cần setup Database lần đầu, hoặc onboard tenant mới.

---

## Bước 0: Kiểm tra phiên bản

```bash
docker -v              # Cần: 24+
docker compose version # Cần: v2+
psql --version         # Optional nhưng hữu ích

# Windows (PowerShell)
docker -v
docker compose version
```

---

## Kiến trúc Database

```
nexus_erp (PostgreSQL database)
├── public (Master Schema)     ← Dữ liệu chung: tenants, subscriptions, audit_log
├── tenant_demo                ← Dữ liệu riêng: Cửa hàng Demo
├── tenant_nike                ← Dữ liệu riêng: Cửa hàng Nike
└── tenant_xxx                 ← Một schema = một tenant
```

**Tại sao tách schema?** → Dữ liệu các tenant **hoàn toàn cô lập**. Tenant A không thể đọc dữ liệu Tenant B. Đây là mô hình **Schema-per-Tenant**.

---

## Bước 1: Khởi động toàn bộ stack

```bash
cd source_database/docker

# Khởi động tất cả services
docker compose up -d

# Chờ khoảng 30 giây rồi kiểm tra
docker compose ps
```

**Kết quả mong đợi:**
```
NAME                STATUS          PORTS
nexus_postgres      healthy         0.0.0.0:5432->5432/tcp
nexus_keycloak      running         0.0.0.0:8180->8080/tcp
nexus_kafka         running         0.0.0.0:9093->9093/tcp
nexus_kafka_ui      running         0.0.0.0:8082->8080/tcp
nexus_elasticsearch running         0.0.0.0:9200->9200/tcp
nexus_kibana        running         0.0.0.0:5601->5601/tcp
```

**Truy cập các services:**
| Service | URL | Login |
|---|---|---|
| **PostgreSQL** | `localhost:5432` | `nexus_admin` / `nexus_secret` |
| **Keycloak** (IAM) | http://localhost:8180 | `admin` / `admin123` |
| **Kafka UI** | http://localhost:8082 | — |
| **Elasticsearch** | http://localhost:9200 | — |
| **Kibana** | http://localhost:5601 | — |

---

## Bước 2: Chạy Database Migrations

### 2a. Master Schema (chỉ làm 1 lần)
```bash
cd source_database  # (quay về thư mục source_database)

docker run --rm --network host \
  -v $(pwd)/migrations/master:/flyway/sql \
  flyway/flyway:10 \
  -url="jdbc:postgresql://localhost:5432/nexus_erp" \
  -user=nexus_admin \
  -password=nexus_secret \
  migrate

# Verify: Phải thấy "Successfully applied X migration(s)"
```

**Windows (PowerShell):**
```powershell
docker run --rm --network host `
  -v "${PWD}/migrations/master:/flyway/sql" `
  flyway/flyway:10 `
  -url="jdbc:postgresql://localhost:5432/nexus_erp" `
  -user=nexus_admin -password=nexus_secret migrate
```

### 2b. Kiểm tra migration status
```bash
docker run --rm --network host \
  -v $(pwd)/migrations/master:/flyway/sql \
  flyway/flyway:10 \
  -url="jdbc:postgresql://localhost:5432/nexus_erp" \
  -user=nexus_admin -password=nexus_secret info

# Kết quả mong đợi:
# Version | Description      | State   |
# V1      | init master ...  | Success |
# V2      | add master index | Success |
```

---

## Bước 3: Onboard Tenant mới

```bash
cd source_database

# Cú pháp: ./scripts/create_new_tenant.sh <code> "<Tên đầy đủ>" <plan>
# plan: basic | professional | enterprise

# Tạo tenant demo
./scripts/create_new_tenant.sh demo "Nexus Demo Store" professional

# Tạo tenant thật
./scripts/create_new_tenant.sh acme "ACME Corporation" enterprise

# Script sẽ:
# 1. Tạo schema: tenant_demo
# 2. Chạy migrations trong schema đó
# 3. Insert record vào bảng tenants (master schema)
# 4. Tạo Keycloak group (nếu Keycloak đang chạy)
```

---

## Bước 4: Seed dữ liệu mẫu

```bash
# Seed master data (plans, system config)
psql -h localhost -U nexus_admin -d nexus_erp \
  -f data-seeding/01_seed_master_data.sql

# Seed demo tenant data (users, products, inventory)
psql -h localhost -U nexus_admin -d nexus_erp \
  -c "SET search_path TO tenant_demo;" \
  -f data-seeding/02_seed_tenant_demo.sql
```

---

## Kết nối Database bằng GUI tool

**DBeaver / DataGrip / TablePlus:**
- **Host:** `localhost`
- **Port:** `5432`
- **Database:** `nexus_erp`
- **Username:** `nexus_admin`
- **Password:** `nexus_secret`

**Chọn schema khi query:**
```sql
-- Xem dữ liệu tenant demo
SET search_path TO tenant_demo;
SELECT * FROM orders LIMIT 10;

-- Xem dữ liệu master
SET search_path TO public;
SELECT * FROM tenants;
```

---

## Thêm Migration mới

Khi cần thay đổi database schema:

```bash
# 1. Tạo file migration theo đúng format: V{số}__mô_tả.sql
touch migrations/tenant/V3__add_customer_tags.sql

# 2. Viết SQL trong file đó

# 3. Chạy cho tất cả tenants
./scripts/run_migrations.sh

# 4. Verify
./scripts/run_migrations.sh --dry-run  # Xem trước khi chạy
```

**Quy tắc QUAN TRỌNG:**
- ❌ KHÔNG bao giờ sửa file migration đã được chạy (Flyway kiểm tra checksum)
- ✅ Mỗi thay đổi = 1 file migration mới
- ✅ Tên file: `V{version}__{snake_case_description}.sql`

---

## Tạo Partition tháng mới

Partition được tạo tự động qua cron vào ngày 25 mỗi tháng. Nếu quên, chạy thủ công:

```bash
# Tạo partition cho tháng sau
./scripts/add_partition.sh

# Tạo cho tháng cụ thể (YYYY MM)
./scripts/add_partition.sh 2025 03
```

---

## Thay đổi phiên bản PostgreSQL

```bash
# Xem version hiện tại
docker exec nexus_postgres psql -U nexus_admin -c "SELECT version();"

# Để đổi version, sửa trong docker-compose.yml:
# image: postgres:16-alpine  ← Đổi thành postgres:17-alpine

# ⚠️ CẢNH BÁO: Cần pg_dump trước khi đổi version!
# 1. Backup
docker exec nexus_postgres pg_dumpall -U nexus_admin > backup_before_upgrade.sql

# 2. Sửa version trong docker-compose.yml

# 3. Restart (xóa volume cũ!)
docker compose down -v   # ⚠️ Xóa tất cả dữ liệu!
docker compose up -d

# 4. Restore
docker exec -i nexus_postgres psql -U nexus_admin < backup_before_upgrade.sql
```

---

## Backup và Restore

```bash
# Backup toàn bộ database
./scripts/cronjob_backup.sh   # (thực ra là trong vps_deploy, nhưng cú pháp tương tự)

# Backup thủ công
docker exec nexus_postgres pg_dumpall \
  -U nexus_admin \
  --clean \
  --if-exists \
  > "backup_$(date +%Y%m%d_%H%M%S).sql"

# Restore từ backup
cat backup_20240101_000000.sql | docker exec -i nexus_postgres \
  psql -U nexus_admin -d nexus_erp
```

---

## Lỗi thường gặp

### ❌ `Connection refused: localhost:5432`
```bash
docker compose ps | grep postgres  # Có running không?
docker compose logs postgres        # Xem log lỗi
docker compose restart postgres     # Restart
```

### ❌ `FATAL: password authentication failed for user "nexus_admin"`
```bash
# Kiểm tra password trong docker-compose.yml và .env
grep POSTGRES docker-compose.yml
```

### ❌ Flyway: `Validate failed: Migration checksum mismatch`
```bash
# ⚠️ KHÔNG sửa file SQL đã chạy!
# Chỉ dùng repair nếu bạn biết chắc đây là lỗi môi trường:
docker run --rm flyway/flyway:10 \
  -url="jdbc:postgresql://localhost:5432/nexus_erp" \
  -user=nexus_admin -password=nexus_secret repair
```

### ❌ Port 5432 đã bị chiếm (PostgreSQL khác đang chạy)
```bash
# Đổi port trong docker-compose.yml
# "5432:5432" → "5433:5432"
# Sau đó connect bằng port 5433
```
