# 🚨 Database Runbook — Nexus ERP

Hướng dẫn xử lý các sự cố Database phổ biến. Đọc kỹ trước khi thực hiện bất kỳ lệnh nào!

> [!CAUTION]
> Mọi lệnh có dấu ⚠️ đều ảnh hưởng trực tiếp dữ liệu Production. Luôn backup trước!

---

## 🔴 SỰ CỐ 1: Partition tháng mới chưa được tạo

**Triệu chứng:** `ERROR: no partition of relation "orders" found for row`

**Nguyên nhân:** Cron job `add_partition.sh` không chạy vào ngày 25 tháng trước.

**Xử lý:**
```bash
# Tạo partition ngay lập tức cho tháng hiện tại
cd /opt/nexus/source_database
./scripts/add_partition.sh $(date '+%Y') $(date '+%m')

# Kiểm tra partition đã tạo thành công
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c \
    "SELECT tablename FROM pg_tables WHERE tablename LIKE 'orders_%' ORDER BY tablename;"
```

---

## 🔴 SỰ CỐ 2: Ổ cứng Database gần đầy (>80%)

**Triệu chứng:** Alert Grafana "Disk usage > 80%" hoặc `ERROR: could not extend file`

**Xử lý:**

```bash
# 1. Kiểm tra bảng nào đang chiếm dung lượng nhiều nhất
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "
SELECT schemaname, tablename,
       pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
LIMIT 20;"

# 2. Xóa audit_log cũ hơn 90 ngày (an toàn)
# ⚠️ Chỉ xóa partition, không xóa dữ liệu trực tiếp
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c \
    "DROP TABLE IF EXISTS public.audit_log_$(date -d '-3 months' '+%Y_%m');"

# 3. VACUUM để thu hồi không gian
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "VACUUM ANALYZE;"
```

---

## 🔴 SỰ CỐ 3: Migration Flyway bị lỗi giữa chừng

**Triệu chứng:** App không start, log: `FlywayException: Validate failed: Migration checksum mismatch`

**KHÔNG chỉnh sửa file SQL đã chạy!** Flyway kiểm tra checksum.

**Xử lý:**
```bash
# Kiểm tra trạng thái migration
docker run --rm --network host \
    -v ./migrations/tenant:/flyway/sql flyway/flyway:latest \
    -url="jdbc:postgresql://$DB_HOST:5432/$DB_NAME?currentSchema=tenant_demo" \
    -user=$DB_USER -password=$DB_PASSWORD info

# Nếu migration bị "failed", repair state
docker run --rm --network host \
    -v ./migrations/tenant:/flyway/sql flyway/flyway:latest \
    -url="jdbc:postgresql://$DB_HOST:5432/$DB_NAME?currentSchema=tenant_demo" \
    -user=$DB_USER -password=$DB_PASSWORD repair
```

---

## 🟠 SỰ CỐ 4: Kết nối Database bị từ chối (max_connections)

**Triệu chứng:** `FATAL: remaining connection slots are reserved for non-replication superuser connections`

**Nguyên nhân:** Quá nhiều connection từ app (PgBouncer không hoạt động).

**Xử lý:**
```bash
# Kiểm tra số connection hiện tại
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "
SELECT count(*), state, application_name
FROM pg_stat_activity
GROUP BY state, application_name
ORDER BY count DESC;"

# Hủy các connection idle > 10 phút
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state = 'idle'
AND query_start < NOW() - INTERVAL '10 minutes'
AND pid <> pg_backend_pid();"

# Restart PgBouncer nếu cần
docker restart nexus_pgbouncer
```

---

## 🟠 SỰ CỐ 5: Query chạy chậm bất thường

**Triệu chứng:** API timeout, Grafana hiển thị latency > 2s

**Xử lý:**
```bash
# Tìm các query đang chạy > 10 giây
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "
SELECT pid, now() - pg_stat_activity.query_start AS duration, query, state
FROM pg_stat_activity
WHERE (now() - pg_stat_activity.query_start) > INTERVAL '10 seconds'
AND state != 'idle';"

# Phân tích query chậm với EXPLAIN ANALYZE
# (Thay bằng query thực tế)
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT * FROM tenant_demo.orders WHERE status = 'pending' LIMIT 100;"

# Nếu thiếu index, chạy lại migration V2
./scripts/run_migrations.sh
```

---

## ✅ Kiểm tra sức khỏe hàng ngày (Routine Checks)

```bash
# 1. Replication lag (nếu có replica)
psql -c "SELECT now() - pg_last_xact_replay_timestamp() AS replication_lag;"

# 2. Dead tuples (cần VACUUM nếu > 10%)
psql -c "SELECT relname, n_dead_tup, n_live_tup,
    round(n_dead_tup * 100.0 / NULLIF(n_live_tup + n_dead_tup, 0), 1) AS dead_pct
FROM pg_stat_user_tables ORDER BY n_dead_tup DESC LIMIT 10;"

# 3. Kiểm tra partition tháng tới đã tồn tại chưa
psql -c "SELECT tablename FROM pg_tables
WHERE tablename LIKE 'orders_$(date -d '+1 month' '+%Y_%m')%';"
```
