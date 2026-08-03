# 🚀 PostgreSQL Performance Tuning & EXPLAIN ANALYZE

> **Category**: PostgreSQL | **Complexity**: Advanced | **PostgreSQL**: 16+

---

## 📖 Core Technical Mechanics & Deep-Dive

### RAM Tuning (postgresql.conf)
Mặc định, Postgres cấu hình cho một máy chủ rất yếu (vì mục tiêu là chạy được trên mọi thiết bị). Nếu bạn có một server 64GB RAM, bạn phải cấu hình lại các thông số sau:

1. **`shared_buffers`**: Dung lượng RAM dùng để cache dữ liệu (tables, indexes) trong bộ nhớ. 
   - *Chuẩn*: 25% tổng RAM (Ví dụ máy 64GB -> set 16GB). Không set quá cao vì Postgres còn dựa vào OS Cache (Page Cache).
2. **`work_mem`**: RAM cấp cho MỖI thao tác SORT, HASH JOIN trong 1 query.
   - Nếu query có `ORDER BY` cần 50MB, nhưng `work_mem` = 4MB, Postgres sẽ đẩy data ra đĩa cứng (Temp Files) -> Query cực chậm!
   - *Cẩn thận*: Nếu bạn có 200 connections, mỗi connection chạy 1 query có 3 Sort operations, RAM tiêu thụ = `200 * 3 * work_mem`.
3. **`maintenance_work_mem`**: RAM dùng cho các tác vụ bảo trì (VACUUM, CREATE INDEX).
   - Set cao (ví dụ 1GB - 2GB) để `CREATE INDEX` nhanh hơn.
4. **`effective_cache_size`**: Tham số "gợi ý" cho Query Planner biết OS còn khoảng bao nhiêu RAM trống để cache. Không cấp phát RAM thật.
   - *Chuẩn*: 50% - 75% tổng RAM.

### Autovacuum & MVCC
Postgres sử dụng Multi-Version Concurrency Control (MVCC). Khi bạn `UPDATE` hoặc `DELETE` 1 row, Postgres không xóa row cũ ngay lập tức (để đảm bảo các transaction khác đang đọc không bị gián đoạn). Nó đánh dấu row cũ là "Dead Tuple".
- **Autovacuum** là tiến trình chạy ngầm dọn dẹp các Dead Tuples này để tái sử dụng không gian đĩa.
- Nếu tắt Autovacuum, database sẽ phình to (Bloat) và query sẽ quét qua hàng triệu row rác -> Cực chậm.

---

## 🌐 Real-World GitHub Patterns & Industry Reference

- **[PGTune (Web Tool)](https://pgtune.leopard.in.ua/)** — Công cụ chuẩn công nghiệp để generate file `postgresql.conf` dựa trên cấu hình phần cứng.
- **[dalibo/pev2](https://github.com/dalibo/pev2)** — UI tuyệt vời để trực quan hóa cây `EXPLAIN ANALYZE`.

---

## ⚙️ Production Configuration (postgresql.conf)

```ini
# --- MACHINE: 64GB RAM, 16 Cores, SSD ---

# Memory Configuration
shared_buffers = 16GB                  # 25% of RAM
work_mem = 32MB                        # Start small, increase if logs show Temp File usage
maintenance_work_mem = 2GB
effective_cache_size = 48GB            # 75% of RAM

# Write-Ahead Log
wal_buffers = 16MB                     
checkpoint_completion_target = 0.9     # Trải đều I/O của checkpoint ra, tránh giật lag (Spike)
max_wal_size = 4GB                     
min_wal_size = 1GB

# Query Planner
random_page_cost = 1.1                 # Mặc định là 4.0 (Tối ưu cho HDD quay). Với SSD, set 1.1 để Postgres ưu tiên dùng Index thay vì Sequential Scan.

# Logging (Quan trọng để Debug)
log_min_duration_statement = 1000      # Ghi log mọi query chạy quá 1 giây (Slow Query Log)
log_temp_files = 0                     # Ghi log nếu query bị tràn RAM phải ghi ra đĩa (giúp tune work_mem)

# Autovacuum Tuning (Đẩy nhanh tốc độ dọn rác)
autovacuum_vacuum_scale_factor = 0.05  # Chạy vacuum khi 5% table thay đổi (Mặc định 20% là quá chậm cho bảng lớn)
autovacuum_analyze_scale_factor = 0.02 # Cập nhật statistics thường xuyên hơn
```

---

## 📐 System Design Blueprint

### Đọc hiểu EXPLAIN ANALYZE

`EXPLAIN` chỉ là kế hoạch lý thuyết (Planner's guess).
`EXPLAIN ANALYZE` thực thi câu lệnh thật và đo lường thời gian (Thực tế).

```sql
EXPLAIN ANALYZE 
SELECT * FROM orders WHERE customer_id = 123 ORDER BY created_at DESC;
```

**Output mẫu:**
```text
Sort  (cost=15.54..15.55 rows=5 width=104) (actual time=0.043..0.044 rows=5 loops=1)
  Sort Key: created_at DESC
  Sort Method: quicksort  Memory: 25kB
  ->  Index Scan using idx_orders_customer on orders  (cost=0.29..15.48 rows=5 width=104) (actual time=0.015..0.021 rows=5 loops=1)
        Index Cond: (customer_id = 123)
Planning Time: 0.125 ms
Execution Time: 0.065 ms
```

**Cách đọc:**
1. **Đọc từ TRONG ra NGOÀI, từ DƯỚI lên TRÊN**. (Index Scan chạy trước, sau đó đẩy data lên Sort).
2. **`cost`**: Con số tưởng tượng của Planner (đừng quan tâm nhiều).
3. **`actual time=0.015..0.021`**: Lấy dòng đầu (0.015ms) để tìm dòng đầu tiên, dòng sau (0.021ms) là lấy xong toàn bộ dữ liệu.
4. **`rows=5`**: Trả về 5 dòng (Rất nhanh).
5. **`Memory: 25kB`**: Sort in-memory (Nằm trong RAM `work_mem`). Nếu ghi `Sort Method: external merge Disk: 15000kB`, có nghĩa là thiếu RAM -> Phải tăng `work_mem`!

---

## 🧪 Verification Commands

```sql
-- 1. Tìm các truy vấn tốn nhiều thời gian nhất (Yêu cầu extension pg_stat_statements)
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

SELECT 
    query, 
    calls, 
    total_exec_time / 1000 / 60 as total_minutes, 
    mean_exec_time as avg_ms
FROM pg_stat_statements 
ORDER BY total_exec_time DESC 
LIMIT 10;

-- 2. Kiểm tra Cache Hit Ratio (Mục tiêu > 99%)
SELECT 
    sum(heap_blks_read) as disk_reads,
    sum(heap_blks_hit) as cache_hits,
    sum(heap_blks_hit) / (sum(heap_blks_hit) + sum(heap_blks_read))::float as cache_hit_ratio
FROM pg_statio_user_tables;
```

---

## ⚡ Best Practices & Anti-Patterns

### ✅ Best Practices
1. **Dùng Partial Index cho các trường hợp cụ thể**: 
   `CREATE INDEX idx_active_users ON users (email) WHERE is_deleted = false;` (Giảm dung lượng index đáng kể, tăng tốc query).
2. **VACUUM ANALYZE sau khi Bulk Insert**: Nếu bạn vừa import 1 triệu dòng, Query Planner chưa cập nhật Statistics, nó sẽ chọn Seq Scan. Chạy `VACUUM ANALYZE table_name;` ngay lập tức!
3. **Sử dụng SSD và giảm `random_page_cost`**: `1.1` hoặc `1.0` trên NVMe.

### ❌ Anti-Patterns

| Anti-Pattern | Problem | Fix |
|-------------|---------|-----|
| Khuyên dùng "Tắt Autovacuum để đỡ tốn I/O" | DB bị phình to (Bloat) không kiểm soát, transaction ID wraparound sẽ làm DB ngừng hoạt động (read-only mode). | Tinh chỉnh Autovacuum cho nhẹ lại, tuyệt đối KHÔNG ĐƯỢC TẮT. |
| Hàm `COUNT(*)` trên bảng 100 triệu dòng | Postgres là MVCC, đếm rất chậm vì nó phải kiểm tra xem row đó có visibility với transaction hiện tại không. | Nếu cần ước lượng, dùng `SELECT reltuples FROM pg_class`. Dùng `COUNT(*)` chỉ với mệnh đề `WHERE` lọc ra tập nhỏ. |
| Lạm dụng Index (Mỗi cột 1 Index) | `UPDATE`/`INSERT` cực kỳ chậm vì phải cập nhật tất cả Index. Postgres Planner bối rối khi chọn index. | Tạo **Composite Index** (Index ghép nhiều cột) dựa trên điều kiện `WHERE` và `ORDER BY` thực tế. Xóa Index không sử dụng qua `pg_stat_user_indexes`. |
