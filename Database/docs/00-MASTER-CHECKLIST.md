# 🗄️ Database Master Checklist & Architecture

> **Mục tiêu**: Đây là trung tâm tri thức (Knowledge Base) về mọi vấn đề liên quan đến Cơ sở dữ liệu (Database) trong hệ thống Production. Tất cả kỹ sư và AI Agents phải tuân thủ các tài liệu này khi thiết kế schema, tối ưu truy vấn, cấu hình kết nối, hoặc triển khai tính năng mới.

---

## 📑 MỤC LỤC & TIẾN ĐỘ TÀI LIỆU

*Tiến trình hoàn thiện tài liệu Knowledge Base:*

### 01. 🐘 PostgreSQL Architecture & Tuning
- [ ] `01-architecture-connections.md`: Kiến trúc đa lớp, PgBouncer, Connection Pooling, Max Connections tuning.
- [ ] `02-high-availability-replication.md`: Patroni, Streaming Replication, Write-Ahead Logging (WAL).
- [ ] `03-performance-tuning.md`: Tối ưu `shared_buffers`, `work_mem`, đọc hiểu `EXPLAIN ANALYZE`.
- [ ] `04-partitioning-sharding.md`: Table Partitioning (Range/Hash), Citus cho distributed SQL.
- [ ] `05-advanced-features.md`: JSONB indexing (GIN), Common Table Expressions (CTE), Window Functions.

### 02. ⚡ NoSQL & In-Memory Data Stores
- [ ] `01-redis-cluster-ha.md`: Redis Sentinel vs Cluster, Cache Eviction Policies (LRU/LFU), Persistence (RDB/AOF).
- [ ] `02-mongodb-data-modeling.md`: Mô hình hóa Document-oriented, Embedding vs Referencing.
- [ ] `03-mongodb-aggregation.md`: Aggregation Pipelines, Indexing strategy, Replica Sets.

### 03. 🛠️ Database Operations & Migrations
- [ ] `01-zero-downtime-migrations.md`: Kỹ thuật Alter Table, Tạo Concurrent Indexes không gây khóa bảng.
- [ ] `02-backup-disaster-recovery.md`: pgBackRest, PITR (Point In Time Recovery), RTO & RPO.
- [ ] `03-monitoring-metrics.md`: pg_stat_statements, Prometheus PostgreSQL Exporter, Grafana Dashboards.

### 04. 🔄 Data Streaming & CDC (Change Data Capture)
- [ ] `01-debezium-kafka-cdc.md`: Thiết lập Debezium đọc WAL log của Postgres để đẩy event vào Kafka.
- [ ] `02-outbox-pattern-cdc.md`: Triển khai Transactional Outbox pattern ở tầng Database.

### 05. 🛡️ Security & Compliance
- [ ] `01-row-level-security.md`: Ứng dụng PostgreSQL RLS cho kiến trúc Multi-tenant (SaaS).
- [ ] `02-encryption-at-rest.md`: TDE (Transparent Data Encryption), Mã hóa dữ liệu nhạy cảm (PII).
- [ ] `03-rbac-roles-privileges.md`: Quản lý User, Roles, và Grants chuẩn chỉ (Principle of Least Privilege).

---

## 🎯 QUY TẮC TỐI THƯỢNG (GOLDEN RULES) DÀNH CHO AI & DEVELOPER
1. **Không bao giờ dùng DELETE cứng**: Trừ những bảng log hoặc dữ liệu tạm, mọi dữ liệu nghiệp vụ phải dùng Soft Delete.
2. **PostgreSQL là "Chân Lý" (Source of Truth)**: Trừ phi có lý do đặc biệt (scale phi mã hoặc dữ liệu phi cấu trúc hoàn toàn), mặc định sử dụng PostgreSQL. Redis dùng làm Cache, MongoDB dùng làm Secondary Store hoặc Read-model.
3. **Mọi thao tác DDL phải là Zero-Downtime**: Khóa (Locking) một bảng lớn trong Production có thể đánh sập hệ thống. Tuyệt đối dùng `CREATE INDEX CONCURRENTLY`.
4. **Không kết nối trực tiếp vào Postgres**: Trong môi trường microservices, số lượng connection sẽ bùng nổ. Luôn kết nối thông qua PgBouncer.
