# 🗄️ BẢN ĐẶC TẢ KIẾN TRÚC DỮ LIỆU & INFRASTRUCTURE (DATABASE ARCHITECTURE DESIGN)

**Dự án:** Nexus POS & ERP (Enterprise B2B Multi-Tenant Platform)
**Mô-đun:** Database, Migrations & Infrastructure
**Mục tiêu:** Định nghĩa kiến trúc dữ liệu cốt lõi, chiến lược Multi-Tenancy, cấu hình hạ tầng (Infra-as-code) và luồng đồng bộ CQRS.

---

## 1. KIẾN TRÚC HỆ SINH THÁI DỮ LIỆU (DATA TOPOLOGY)

Hệ thống áp dụng mô hình phân tán (Polyglot Persistence) để tối ưu hóa từng loại nghiệp vụ cụ thể:

### 1.1. Hệ quản trị CSDL lõi (Primary Databases)
- **Write-DB (PostgreSQL 16):** Database chính xử lý toàn bộ các giao dịch tài chính, đơn hàng, người dùng. Hỗ trợ ACID tuyệt đối, sử dụng JSONB cho cấu hình linh hoạt.
- **IAM-DB (PostgreSQL):** Database độc lập dành riêng cho Keycloak để quản lý Identity và Access Token.

### 1.2. Hệ CSDL Truy vấn & Cache (Read-Models & Cache)
- **Read-DB (Elasticsearch):** Đồng bộ dữ liệu 1 chiều từ PostgreSQL để tối ưu hóa truy vấn tìm kiếm toàn văn bản (Full-text search) cho danh mục sản phẩm và danh sách đơn hàng lớn.
- **In-Memory Cache (Redis Stack):** 
  - Caching danh mục, phân quyền (Caffeine L1 + Redis L2).
  - Quản lý Distributed Lock bằng Redisson (chống race-condition khi thanh toán).

### 1.3. Hệ thống Message Broker
- **Apache Kafka:** Xử lý Event Sourcing và là xương sống cho Change Data Capture (CDC).
- **RabbitMQ:** Xử lý Asynchronous Task và Dead-Letter Queues (DLQ) cho việc gửi Email, SMS.

---

## 2. KIẾN TRÚC MULTI-TENANCY (CÁCH LY DỮ LIỆU)

### 2.1. Chiến lược "Shared Database, Separate Schema"
Tất cả các Tenants (khách hàng doanh nghiệp) đều nằm chung trong 1 Database PostgreSQL duy nhất, nhưng được cấp phát một `Schema` riêng biệt (ví dụ: `schema_nike`, `schema_adidas`).

**Ưu điểm:**
- Bảo mật dữ liệu tuyệt đối ở cấp độ Database (Role-based access theo schema).
- Khác với "Shared Table" (cột `tenant_id`), Dev không sợ truy vấn nhầm data của khách hàng khác.
- Dễ dàng quản lý connection pool (chung 1 DB endpoint).
- Hiệu suất tốt hơn "Separate Database" (khởi tạo hàng trăm DB rất nặng).

### 2.2. Luồng thực thi SQL (Migration Flow)
Dự án sử dụng **Flyway** kết hợp bash script để chia làm 2 cấp độ Migration:
1. **Master Migrations:** Các script chạy trên schema `public` chứa dữ liệu hệ thống lõi (Bảng Tenants, Global Users, Subscriptions).
2. **Tenant Migrations:** Script chạy đệ quy trên tất cả các schema của khách hàng (Bảng Orders, Products, Inventory).

---

## 3. CẤU TRÚC THƯ MỤC DỰ ÁN (PROJECT STRUCTURE)

Repo `source_database` tổ chức theo chuẩn Infra-as-Code:

```text
source_database/
├── docker/                           # Cấu hình containerization cho môi trường Dev/Staging
│   ├── docker-compose.yml            # Khởi chạy toàn bộ hạ tầng (Postgres, Redis, Kafka, Elasticsearch)
│   ├── keycloak/                     # Cấu hình Realm, Client, Users mẫu cho Keycloak
│   └── init-scripts/                 # Bash scripts tự động tạo DB, Role khi container khởi động
├── migrations/                       # Flyway SQL Scripts
│   ├── master/                       # Scripts cho cấu trúc Master Schema
│   │   ├── V1__init_master_schema.sql
│   │   └── V2__add_system_configs.sql
│   └── tenant/                       # Scripts định nghĩa cấu trúc cho từng Tenant
│       ├── V1__init_pos_schema.sql
│       └── V2__add_inventory_triggers.sql
├── scripts/                          # Scripts tự động hóa (Bash/Python)
│   ├── create_new_tenant.sh          # Khởi tạo Schema tự động cho khách hàng mới onboarding
│   └── run_migrations.sh             # Vận hành Flyway độc lập bằng Docker
├── etl-cdc/                          # Cấu hình luồng đồng bộ CQRS
│   └── debezium-connector.json       # Config Debezium Kafka Connect
└── data-seeding/                     # Sinh dữ liệu phục vụ Testing & QA
    ├── 01_seed_master_roles.sql
    └── generate_performance_data.py  # Sinh 10 triệu bản ghi cho K6 Load Testing
```

---

## 4. KIẾN TRÚC ĐỒNG BỘ DỮ LIỆU CQRS (CHANGE DATA CAPTURE)

Để giải quyết bài toán Data Inconsistency (Bất đồng bộ dữ liệu) trong kiến trúc CQRS, dự án áp dụng mô hình CDC:

1. **Debezium Connector:** Cắm trực tiếp vào file WAL (Write-Ahead Log) của PostgreSQL.
2. Bất cứ hành động `INSERT/UPDATE/DELETE` nào xảy ra tại Write-DB đều được Debezium bắt (Capture) ngay tại tầng Database.
3. Debezium biến thay đổi thành một Event và đẩy vào **Kafka Topic**.
4. ElasticSearch/MongoDB (Read-DB) Consume các Event này và cập nhật cấu trúc dữ liệu tối ưu cho việc đọc.
> **Lợi ích:** Tách biệt hoàn toàn việc đồng bộ dữ liệu khỏi Application Layer (Java). Đảm bảo Eventual Consistency 100% dù Application có bị sập mạng.

---

## 5. DBA OPERATIONS & PERFORMANCE TUNING

### 5.1. Database Partitioning (Phân mảnh dữ liệu)
Với các bảng phình to cực nhanh như `Orders`, `Transactions`:
- Áp dụng kỹ thuật **Partition by Range (Month)**.
- Khi truy vấn doanh thu tháng, PostgreSQL chỉ quét trên phân vùng của tháng đó thay vì Table Scan toàn bộ hàng chục triệu bản ghi, giảm thời gian truy vấn từ vài giây xuống dưới 10ms.

### 5.2. Backup & Disaster Recovery (Khôi phục thảm họa)
- Tích hợp công cụ `pgBackRest` lưu trực tiếp lên AWS S3.
- Bật tính năng **PITR (Point-in-Time Recovery)** thông qua lưu trữ WAL archiving, cho phép khôi phục Database về chính xác một mốc thời gian bất kỳ (ví dụ: 10:14:00 AM) để cứu dữ liệu nếu có thao tác UPDATE/DELETE nhầm lẫn nghiêm trọng.
