# 📊 Database Monitoring & Metrics

> **Category**: Database Operations | **Complexity**: Intermediate | **PostgreSQL**: 16+ | **Prometheus/Grafana**

---

## 📖 Core Technical Mechanics & Deep-Dive

### Bạn không thể tối ưu thứ mà bạn không thể đo lường
PostgreSQL là một "Hộp đen" nếu bạn không bật các công cụ giám sát (Monitoring). Khác với Web Server (chỉ cần đo CPU/RAM), Database Monitoring đòi hỏi việc bóc tách thông tin từ sâu bên trong Engine:
- Tỉ lệ Cache Hit/Miss.
- Các câu truy vấn chậm (Slow Queries).
- Khóa (Locks) gây nghẽn cổ chai.
- Dung lượng phân mảnh (Table Bloat).

### Bộ 3 Công cụ Giám sát Chuẩn Enterprise
1. **`pg_stat_statements`**: Extension tích hợp sẵn cực kỳ mạnh mẽ của Postgres. Ghi nhận thời gian chạy, CPU, I/O của *tất cả* các query từng chạy.
2. **`postgres_exporter`**: Một tool viết bằng Go, đứng ngoài kết nối vào Postgres, dịch các thông số của Postgres thành format để Prometheus lấy (scrape).
3. **`Grafana`**: Hiển thị Dashboards theo thời gian thực (Real-time).

---

## 🌐 Real-World GitHub Patterns & Industry Reference

- **[prometheus-community/postgres_exporter](https://github.com/prometheus-community/postgres_exporter)** — Exporter chính thức do cộng đồng duy trì.
- **[percona/grafana-dashboards](https://github.com/percona/grafana-dashboards)** — Các dashboard Grafana mẫu chuẩn xịn nhất cho CSDL.

---

## 📐 System Design Blueprint

### 1. Bật `pg_stat_statements`
*Lưu ý: Bạn phải thêm nó vào `shared_preload_libraries` trong `postgresql.conf` và khởi động lại Server mới có tác dụng!*

```ini
# postgresql.conf
shared_preload_libraries = 'pg_stat_statements'
pg_stat_statements.max = 10000        # Lưu thông tin của tối đa 10000 query khác nhau
pg_stat_statements.track = all        # Theo dõi cả các lệnh bên trong Functions/Procedures
```

Khởi động lại DB, rồi chạy lệnh SQL bằng tài khoản superuser:
```sql
CREATE EXTENSION pg_stat_statements;
```

### 2. Thiết lập Postgres Exporter (Docker Compose)

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: admin
      POSTGRES_PASSWORD: secretpassword

  postgres-exporter:
    image: prometheuscommunity/postgres-exporter
    environment:
      # DATA_SOURCE_NAME (DSN) để exporter connect vào DB
      DATA_SOURCE_NAME: "postgresql://admin:secretpassword@postgres:5432/postgres?sslmode=disable"
    ports:
      - "9187:9187" # Port để Prometheus vào cào (scrape) metrics
```

### 3. Cấu hình Prometheus Scrape

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres-exporter:9187']
```

---

## 🧪 Top 3 Queries "Sống Còn" cho Database Admin (DBA)

Nếu không có Grafana, bạn vẫn phải thuộc nằm lòng 3 câu SQL này để cứu server khi có biến:

**1. Tìm 5 câu Query ngốn nhiều thời gian nhất tổng cộng (Cần Tối Ưu Nhất)**
```sql
SELECT 
    calls, 
    total_exec_time / 1000 / 60 AS total_min, 
    mean_exec_time AS avg_ms, 
    query 
FROM pg_stat_statements 
ORDER BY total_exec_time DESC 
LIMIT 5;
```

**2. Tìm ai đang "Khóa" (Lock) các tác vụ khác (Deadlocks/Blocking)**
```sql
SELECT 
    blocked_locks.pid AS blocked_pid,
    blocked_activity.usename AS blocked_user,
    blocking_locks.pid AS blocking_pid,
    blocking_activity.usename AS blocking_user,
    blocked_activity.query AS blocked_statement,
    blocking_activity.query AS current_statement_in_blocking_process
FROM pg_catalog.pg_locks blocked_locks
JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
JOIN pg_catalog.pg_locks blocking_locks 
    ON blocking_locks.locktype = blocked_locks.locktype
    AND blocking_locks.DATABASE IS NOT DISTINCT FROM blocked_locks.DATABASE
    AND blocking_locks.relation IS NOT DISTINCT FROM blocked_locks.relation
    AND blocking_locks.page IS NOT DISTINCT FROM blocked_locks.page
    AND blocking_locks.tuple IS NOT DISTINCT FROM blocked_locks.tuple
    AND blocking_locks.virtualxid IS NOT DISTINCT FROM blocked_locks.virtualxid
    AND blocking_locks.transactionid IS NOT DISTINCT FROM blocked_locks.transactionid
    AND blocking_locks.classid IS NOT DISTINCT FROM blocked_locks.classid
    AND blocking_locks.objid IS NOT DISTINCT FROM blocked_locks.objid
    AND blocking_locks.objsubid IS NOT DISTINCT FROM blocked_locks.objsubid
    AND blocking_locks.pid != blocked_locks.pid
JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
WHERE NOT blocked_locks.GRANTED;
```
*(Nếu phát hiện `blocking_pid` nào đó treo quá lâu, hãy dùng lệnh `SELECT pg_terminate_backend(blocking_pid);` để KILLS nó, giải phóng hệ thống).*

**3. Xem các kết nối đang làm gì ngay lúc này (Active Connections)**
```sql
SELECT pid, usename, state, wait_event_type, wait_event, query 
FROM pg_stat_activity 
WHERE state != 'idle';
```

---

## ⚡ Best Practices & Anti-Patterns

### ✅ Best Practices
1. **Thiết lập Cảnh báo (Alerting) trên Prometheus AlertManager**: Đừng nhìn Dashboard thụ động. Hãy set rule: Nếu `Connections > 90% Max` hoặc `Replication Lag > 5 phút` hoặc `Disk Space < 10%`, bắn Slack/PagerDuty gọi Dev dậy xử lý ngay!
2. **Giám sát thư mục `pg_wal`**: Lỗi tồi tệ nhất là DB sập vì đầy ổ cứng. Thư mục `/var/lib/postgresql/data/pg_wal` có thể phình to rất nhanh nếu Replica bị rớt mạng (Replication Slots giữ lại WAL). Phải set Alert riêng cho dung lượng thư mục này.

### ❌ Anti-Patterns

| Anti-Pattern | Problem | Fix |
|-------------|---------|-----|
| Mở `pg_stat_statements` nhưng không bao giờ Reset | Sau vài tháng, con số `total_exec_time` cộng dồn khổng lồ, bạn không thể biết query nào ĐANG chậm trong tuần này. | Chạy lệnh `SELECT pg_stat_statements_reset();` tự động mỗi tháng 1 lần. |
| Chỉ đo CPU và RAM của máy chủ | CPU 10% nhưng DB vẫn chết vì Disk I/O (IOPS) đạt đỉnh. | Trên AWS/Cloud, BẮT BUỘC phải vẽ biểu đồ đo đạc Disk IOPS và Disk Throughput. |
| Dùng lệnh `VACUUM FULL` vào giờ cao điểm để giảm Bloat | `VACUUM FULL` khóa cứng (AccessExclusiveLock) toàn bộ bảng, chép lại dữ liệu ra một file mới. Web sẽ sập hoàn toàn. | Dùng Autovacuum (chạy ngầm). Nếu bắt buộc dọn dẹp bảng lớn, dùng tool `pg_repack` (Dọn rác nhưng không khóa bảng). |
