# 🗄️ Nexus Database Repository (source_database)

Quản lý toàn bộ database schema, migration scripts, và data pipeline (CQRS/CDC).

## 🚀 Khởi động nhanh

```bash
# Khởi chạy toàn bộ hạ tầng Database
cd docker && docker compose up -d

# Các dịch vụ sẽ bật lên tại:
# - PostgreSQL:     localhost:5432
# - Keycloak Admin: http://localhost:8180 (admin/admin123)
# - Kafka UI:       http://localhost:8082
# - Kibana:         http://localhost:5601
```

## 📂 Cấu trúc Repository

```
source_database/
├── docker/
│   ├── docker-compose.yml          # Full infra stack (Postgres, Kafka, Keycloak, ES)
│   ├── keycloak/realm-export.json  # Keycloak realm config (import khi khởi tạo)
│   └── init-scripts/
│       └── 01_init_roles.sh        # Tự động tạo DB Keycloak + roles khi Postgres start
├── migrations/
│   ├── master/                     # Scripts cho schema 'public' (tenants, system_users)
│   │   └── V1__init_master_schema.sql
│   └── tenant/                     # Scripts cho mỗi tenant schema
│       └── V1__init_tenant_schema.sql
├── scripts/
│   └── create_new_tenant.sh        # ⚡ Tự động onboard khách hàng mới A-Z
├── etl-cdc/
│   └── debezium-connector.json     # Cấu hình Debezium CDC → Kafka
└── data-seeding/
    └── 01_seed_master_data.sql     # Dữ liệu mẫu (tenants, admin users)
```

## 📋 Quy trình Migration

### Chạy lần đầu (Bootstrap)
```bash
# 1. Apply Master Schema (chạy 1 lần duy nhất)
docker run --rm --network host \
  -v ./migrations/master:/flyway/sql \
  flyway/flyway:latest \
  -url="jdbc:postgresql://localhost:5432/nexus_erp" \
  -user=nexus_admin -password=nexus_secret migrate

# 2. Seed dữ liệu mẫu
psql -h localhost -U nexus_admin -d nexus_erp -f data-seeding/01_seed_master_data.sql
```

### Onboard Khách hàng mới (Tenant Onboarding)
```bash
# Tạo schema + chạy migration + đăng ký vào master table
./scripts/create_new_tenant.sh <tenant_code> "<tenant_name>" <plan>

# Ví dụ:
./scripts/create_new_tenant.sh nike "Nike Vietnam" professional
./scripts/create_new_tenant.sh acme "ACME Corp" enterprise
```

## 🔄 CQRS / Change Data Capture

Sau khi Kafka Connect đang chạy, đăng ký Debezium connector:
```bash
curl -X POST http://localhost:8083/connectors \
  -H "Content-Type: application/json" \
  -d @etl-cdc/debezium-connector.json
```

Kiểm tra connector status:
```bash
curl http://localhost:8083/connectors/nexus-postgres-cdc/status
```

## 🗂️ Thiết kế Schema

| Layer | Công nghệ | Mục đích |
|---|---|---|
| **Write DB** | PostgreSQL 16 (WAL logical) | ACID transactions, multi-tenant schemas |
| **Read DB** | Elasticsearch 8 | Full-text search, aggregation queries |
| **CDC** | Debezium + Kafka Connect | Tự động đồng bộ Write → Read model |
| **Cache** | Redis Stack | L2 cache, Distributed Lock (Redisson) |
| **IAM** | Keycloak | OAuth2 / OIDC identity provider |
