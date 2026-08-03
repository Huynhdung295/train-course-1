# 🧠 Advanced PostgreSQL Features (JSONB, CTEs, Window Functions)

> **Category**: PostgreSQL | **Complexity**: Advanced | **PostgreSQL**: 16+

---

## 📖 Core Technical Mechanics & Deep-Dive

### JSON vs JSONB
PostgreSQL không chỉ là RDBMS, nó còn là một Document DB (NoSQL) cực mạnh nhờ kiểu dữ liệu JSON.
- `JSON`: Lưu dữ liệu dưới dạng text thô. Mỗi lần parse/query, Postgres phải đọc lại file text -> Chậm. Bù lại lưu rất nhanh vì không xử lý gì cả.
- **`JSONB`** (JSON Binary): Chuyển JSON thành dạng Binary Tree lưu trên đĩa. Ghi chậm hơn một chút nhưng đọc cực nhanh. **Hỗ trợ Indexing (GIN Index)**. Trong môi trường Production, **100% sử dụng JSONB**, không bao giờ dùng JSON.

### CTE (Common Table Expressions) - `WITH` Clause
Thay vì dùng Subqueries lồng nhau (nested subqueries) làm code SQL rối rắm như mì Ý, CTE giúp chia nhỏ câu query thành các biến tạm thời (temporary result sets), dễ đọc và dễ debug.

### Window Functions
Tính toán trên một tập hợp các dòng liên quan tới dòng hiện tại, nhưng KHÔNG nhóm chúng lại thành 1 dòng duy nhất (như `GROUP BY`). 
Ví dụ: Lấy top 3 sản phẩm bán chạy nhất CỦA MỖI danh mục. (Nếu dùng `GROUP BY` chỉ lấy được tổng số của danh mục, không liệt kê được sản phẩm).

---

## 🌐 Real-World GitHub Patterns & Industry Reference

- **[PostgreSQL Docs: JSON Types](https://www.postgresql.org/docs/current/datatype-json.html)** — Tài liệu chính thức về cú pháp truy vấn JSONB.
- **[PostgreSQL Docs: Window Functions](https://www.postgresql.org/docs/current/tutorial-window.html)** — Tài liệu về Window Functions.

---

## 📐 System Design Blueprint

### 1. JSONB & GIN Indexing

Sử dụng JSONB khi dữ liệu phi cấu trúc, schema thay đổi liên tục (Ví dụ: Cấu hình User, Metadata của Đơn hàng, Product Attributes).

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    preferences JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- Insert dữ liệu
INSERT INTO users (id, email, preferences) VALUES 
('uuid-1', 'a@test.com', '{"theme": "dark", "notifications": {"email": true, "sms": false}, "tags": ["vip", "tech"]}');

-- Truy vấn lấy giá trị Text (Dùng toán tử ->>)
SELECT email FROM users WHERE preferences->>'theme' = 'dark';

-- Truy vấn Boolean/JsonObject (Dùng toán tử ->)
SELECT email FROM users WHERE (preferences->'notifications'->>'email')::boolean = true;

-- TẠO GIN INDEX (Cực kỳ quan trọng để query JSONB nhanh)
-- Không có index, toán tử @> sẽ Sequential Scan toàn bộ bảng!
CREATE INDEX idx_users_prefs ON users USING GIN (preferences);

-- Truy vấn sử dụng toán tử Containment (@>) sẽ ăn vào GIN Index
-- Tìm tất cả user có tag 'vip'
SELECT email FROM users WHERE preferences @> '{"tags": ["vip"]}';
```

### 2. CTEs (Common Table Expressions)

```sql
-- Ví dụ: Tìm các User có tổng tiền mua hàng lớn hơn trung bình của toàn hệ thống
WITH UserTotals AS (
    SELECT user_id, SUM(amount) as total_spent
    FROM orders
    GROUP BY user_id
),
GlobalAvg AS (
    SELECT AVG(total_spent) as avg_spent
    FROM UserTotals
)
SELECT u.user_id, u.total_spent
FROM UserTotals u
CROSS JOIN GlobalAvg g
WHERE u.total_spent > g.avg_spent;
```

### 3. Window Functions (`OVER`, `PARTITION BY`, `RANK()`)

```sql
-- Bài toán: Trong mỗi phòng ban (department), lấy ra 2 nhân viên có mức lương (salary) cao nhất.
WITH RankedEmployees AS (
    SELECT 
        id,
        name,
        department_id,
        salary,
        -- Đánh số thứ tự lương giảm dần, chia nhóm (Partition) theo từng department
        RANK() OVER(PARTITION BY department_id ORDER BY salary DESC) as salary_rank
    FROM employees
)
SELECT * 
FROM RankedEmployees 
WHERE salary_rank <= 2;
```

---

## 🧪 Verification Commands

```sql
-- Kiểm tra GIN Index có được sử dụng không với EXPLAIN ANALYZE
EXPLAIN ANALYZE 
SELECT email FROM users WHERE preferences @> '{"theme": "dark"}';
-- Output mong muốn: Bitmap Heap Scan on users ... Bitmap Index Scan on idx_users_prefs

-- Cập nhật 1 field nhỏ trong JSONB (Dùng jsonb_set thay vì chép lại toàn bộ cục JSON)
UPDATE users 
SET preferences = jsonb_set(preferences, '{notifications,sms}', 'true'::jsonb)
WHERE id = 'uuid-1';
```

---

## ⚡ Best Practices & Anti-Patterns

### ✅ Best Practices
1. **Chỉ dùng JSONB cho dữ liệu linh động**. Cấu trúc chính (Tên, Email, ID, Trạng thái) bắt buộc phải là Column riêng biệt có kiểu dữ liệu (Varchar, UUID, Boolean). Đừng biến Postgres thành MongoDB 100% bằng cách nhét mọi thứ vào JSONB, bạn sẽ mất tính toàn vẹn dữ liệu (Constraints/Foreign Keys).
2. **Dùng toán tử `@>` thay vì `->>` khi query**. GIN Index mặc định (default ops class) chỉ hoạt động tốt với các phép kiểm tra sự tồn tại (Containment) như `@>`, `?`, `?|`. Phép toán `->>` (bóc tách chuỗi) sẽ không ăn GIN Index mặc định!

### ❌ Anti-Patterns

| Anti-Pattern | Problem | Fix |
|-------------|---------|-----|
| Lưu trữ Binary Files (PDF, Ảnh) vào DB (bytea / LOB) | Postgres phình to kích thước cực nhanh, RAM bị chiếm dụng để cache ảnh thay vì cache Data. Autovacuum bị nghẽn. | Lưu Ảnh/PDF lên AWS S3 / MinIO, chỉ lưu đường dẫn URL vào Postgres. |
| Sử dụng `OFFSET` lớn để phân trang (Pagination) | `SELECT * FROM orders OFFSET 1000000 LIMIT 10` sẽ bắt Postgres đọc và VỨT ĐI 1 triệu dòng đầu tiên -> Treo DB. | Sử dụng **Keyset Pagination (Cursor)**: `WHERE id > last_seen_id ORDER BY id LIMIT 10`. Tốc độ là <1ms dù ở trang 1 tỷ. |
| Nested Subqueries loạn cào cào | Rất khó review code, Planner có thể chọn plan không tối ưu. | Đưa ra các mảng CTE (`WITH`) ở trên cùng để làm phẳng cấu trúc query. |
