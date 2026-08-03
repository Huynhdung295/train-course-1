# 🔪 Partitioning & Sharding (Citus)

> **Category**: PostgreSQL | **Complexity**: Expert | **PostgreSQL**: 16+

---

## 📖 Core Technical Mechanics & Deep-Dive

### B-Tree Degradation
Khi một bảng trong PostgreSQL vượt qua ngưỡng 10-50 triệu dòng, hoặc dung lượng Index B-Tree vượt quá dung lượng RAM (`shared_buffers`), hiệu năng của các tác vụ `INSERT`, `UPDATE` sẽ giảm đột ngột (Degradation). Lý do: Postgres liên tục phải đọc/ghi Index từ đĩa cứng (Disk I/O) thay vì RAM.

### Giải pháp 1: Native Table Partitioning (Chia bảng)
Tính năng native (có sẵn) của PostgreSQL cho phép chia 1 bảng vật lý khổng lồ thành nhiều bảng con (partitions) nhỏ hơn dựa trên một tiêu chí (thường là **Thời gian** hoặc **ID**).
Ứng dụng vẫn query trên 1 bảng mẹ duy nhất (Master Table). Postgres sẽ tự động định tuyến query xuống bảng con tương ứng.
- **Range Partitioning**: Chia theo mốc (Ví dụ: Tháng 1, Tháng 2). Thường dùng cho Data dạng Timeseries (Log, Order, Audit).
- **Hash Partitioning**: Chia đều data theo mã băm của ID. Thường dùng cho Multi-tenant hoặc CSDL Users.

### Giải pháp 2: Sharding / Distributed SQL (Citus)
Nếu Server 1 của bạn đã hết CPU và RAM để chứa bảng đó (kể cả đã chia Partition), bạn cần **Sharding** (Chia bảng ra nhiều máy chủ vật lý khác nhau).
PostgreSQL nguyên bản không có Sharding tự động. Ta dùng Extension **Citus** (Sở hữu bởi Microsoft).
- Biến Postgres thành Distributed Database.
- Có 1 Coordinator Node (nhận query) và nhiều Worker Nodes (chứa data thật).
- Coordinator sẽ chia nhỏ query (Map-Reduce style) đẩy xuống các Worker chạy song song rồi gom kết quả lại.

---

## 🌐 Real-World GitHub Patterns & Industry Reference

- **[citusdata/citus](https://github.com/citusdata/citus)** — Extension mạnh nhất biến Postgres thành Distributed DB (Giờ đã open-source 100%).
- **[pgpartman/pg_partman](https://github.com/pgpartman/pg_partman)** — Extension tự động tạo partition mới theo thời gian (Tránh việc DB admin phải tạo bằng tay mỗi tháng).

---

## 📐 System Design Blueprint

### 1. Native Table Partitioning (Range by Date)

Bài toán: Lưu trữ hàng tỷ dòng log truy cập (`access_logs`). 

```sql
-- 1. Tạo bảng mẹ (Master Table), CHỈ ĐỊNH rõ Partition Key là cột created_at
CREATE TABLE access_logs (
    id UUID NOT NULL,
    ip_address VARCHAR(45) NOT NULL,
    endpoint VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- TRỌNG TÂM: PRIMARY KEY phải bao gồm cả Partition Key!
    PRIMARY KEY (id, created_at) 
) PARTITION BY RANGE (created_at);

-- 2. Tạo các bảng con (Partitions) thủ công cho các tháng
CREATE TABLE access_logs_2023_10 PARTITION OF access_logs 
    FOR VALUES FROM ('2023-10-01 00:00:00Z') TO ('2023-11-01 00:00:00Z');

CREATE TABLE access_logs_2023_11 PARTITION OF access_logs 
    FOR VALUES FROM ('2023-11-01 00:00:00Z') TO ('2023-12-01 00:00:00Z');

-- Tạo Index trên bảng mẹ, Postgres sẽ tự động đẩy index này xuống các bảng con
CREATE INDEX idx_access_logs_ip ON access_logs (ip_address);
```

**Cách hoạt động của Query (Partition Pruning):**
```sql
-- Nếu query CHỨA partition key:
SELECT * FROM access_logs WHERE created_at = '2023-10-15' AND ip_address = '192.168.1.1';
-- Postgres sẽ BỎ QUA (Prune) tất cả các tháng khác, CHỈ quét bảng access_logs_2023_10! Tốc độ x100.

-- Nếu query KHÔNG CHỨA partition key:
SELECT * FROM access_logs WHERE ip_address = '192.168.1.1';
-- Postgres buộc phải quét TẤT CẢ các bảng con. Rất chậm!
```

### 2. Tự động hóa với pg_partman
Việc tạo bảng thủ công mỗi tháng rất nguy hiểm (Nếu quên, `INSERT` vào tháng mới sẽ báo lỗi `no partition of relation found`).
Dùng `pg_partman` để tự động hóa:

```sql
CREATE EXTENSION pg_partman;

-- Cấu hình partman tự động tạo partition theo từng NGÀY (daily)
SELECT partman.create_parent(
    p_parent_table => 'public.access_logs',
    p_control => 'created_at',
    p_type => 'native',
    p_interval=> 'daily',
    p_premake => 3 -- Luôn tạo sẵn trước 3 ngày
);

-- Hàng ngày, chạy cronjob hoặc dùng pg_cron để gọi hàm bảo trì
-- SELECT partman.run_maintenance();
```

---

## 🧪 Verification Commands

```sql
-- Kiểm tra xem Query Planner có thực sự loại bỏ được các bảng con không (Partition Pruning)
EXPLAIN ANALYZE 
SELECT * FROM access_logs WHERE created_at = '2023-10-15';

-- Nếu output CÓ dòng này: `Subplans Removed: 11` (Bỏ qua 11 tháng kia) => Pruning hoạt động tốt.

-- Xóa dữ liệu cũ siêu tốc (Drop Partition thay vì DELETE)
-- Xóa bảng con chỉ mất 0.01 giây và thu hồi được 100% không gian đĩa!
DROP TABLE access_logs_2020_01;
```

---

## ⚡ Best Practices & Anti-Patterns

### ✅ Best Practices
1. **Dùng Partitioning cho Data vòng đời ngắn (Logs, Events)**. Lợi ích lớn nhất của việc chia theo mốc thời gian là bạn có thể `DROP TABLE` bảng của tháng cũ để dọn rác ngay lập tức (Chỉ 1ms). Nếu dùng lệnh `DELETE FROM`, DB sẽ phình to và tốn rất nhiều I/O.
2. **Luôn filter theo Partition Key**. Mọi API/Query query vào bảng Partition phải yêu cầu user cung cấp mốc thời gian (VD: `start_date`, `end_date`) để tận dụng Partition Pruning.

### ❌ Anti-Patterns

| Anti-Pattern | Problem | Fix |
|-------------|---------|-----|
| Lạm dụng Partitioning cho bảng quá nhỏ (< 10GB) | Tốn CPU để Planner phân tích bảng mẹ, làm query chậm hơn bảng thường. | Chỉ bắt đầu tính tới Partitioning khi bảng đạt mốc 10-20GB. |
| Global Unique ID trên bảng Partition | Postgres NATIVE Partitioning KHÔNG hỗ trợ UNIQUE/PRIMARY KEY nếu key đó không chứa Partition Key. (Ví dụ bạn không thể set `id` là UNIQUE duy nhất được, phải là `(id, created_at)`). | Sinh UUID từ Application (Java) để đảm bảo Unique, không phụ thuộc vào cơ chế Constraint của Postgres. |
| Dùng Citus (Sharding) khi chưa tối ưu Query/Index | Distributed SQL cực kỳ tốn chi phí hạ tầng và phức tạp hóa JOIN (Chỉ Join được các bảng cùng Shard Key, nếu không phải broadcast data qua network rất chậm). | Tune RAM, thêm Index, đổi ổ NVMe SSD, Partition Table trước khi tính tới Sharding! |
