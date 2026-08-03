# 🔄 Zero-Downtime Database Migrations

> **Category**: Database Operations | **Complexity**: Advanced | **PostgreSQL**: 16+ | **Flyway/Liquibase**

---

## 📖 Core Technical Mechanics & Deep-Dive

### The DDL Lock Problem
Trong PostgreSQL, các câu lệnh DDL (Data Definition Language) như `ALTER TABLE`, `CREATE INDEX` thường yêu cầu khóa độc quyền (`AccessExclusiveLock`). 
Khi một bảng bị dính `AccessExclusiveLock`, toàn bộ các câu lệnh `SELECT`, `INSERT`, `UPDATE` của người dùng tới bảng đó sẽ bị chặn lại (hàng đợi) cho đến khi lệnh DDL chạy xong.
- Nếu bảng nhỏ (10MB): Lệnh chạy mất 0.1s -> Người dùng không nhận ra.
- Nếu bảng lớn (100GB): `CREATE INDEX` mất 30 phút -> Website "chết đứng" 30 phút. (Downtime).

### Triết lý Zero-Downtime Migration
Để triển khai hệ thống (Deploy) mà không gây Downtime, Database Schema phải **tương thích ngược (Backward Compatible) và tương thích xuôi (Forward Compatible)**.
Ứng dụng phiên bản cũ (v1) và ứng dụng phiên bản mới (v2) phải có khả năng chạy song song và kết nối cùng vào Database trong thời gian Rolling Update của Kubernetes.

---

## 🌐 Real-World GitHub Patterns & Industry Reference

- **[flyway/flyway](https://github.com/flyway/flyway)** — Công cụ Migration bằng SQL thuần.
- **[liquibase/liquibase](https://github.com/liquibase/liquibase)** — Công cụ Migration qua XML/YAML (Hỗ trợ sinh rollback script tự động).

---

## 📐 System Design Blueprint

### 1. Kỹ thuật tạo Index không khóa bảng (Concurrent Indexes)

Bình thường: `CREATE INDEX idx_user_email ON users(email);` (Khóa bảng toàn diện).
Giải pháp: Sử dụng `CONCURRENTLY`.

```sql
-- Flyway Migration Script: V2__Add_Email_Index.sql

-- LƯU Ý: CREATE INDEX CONCURRENTLY không thể chạy bên trong 1 Transaction Block (BEGIN...COMMIT)
-- Flyway mặc định bọc mọi script trong Transaction. 
-- Để tắt nó đi, ta phải dùng cờ đặc biệt của Flyway (Bỏ comment ở đầu file):
-- a) Flyway: Thêm /* block:false */ 
-- b) Hoặc thiết lập tiền tố file là 'N' thay vì 'V' (Non-transactional): N2__Add_Email_Index.sql

CREATE INDEX CONCURRENTLY idx_user_email ON users(email);
```
*Cơ chế: Postgres sẽ quét bảng 2 lần. Lần 1 quét data hiện có mà không khóa bảng. Lần 2 quét các data mới sinh ra trong quá trình quét lần 1. Thời gian tạo Index sẽ chậm hơn x2 lần, nhưng Ứng dụng vẫn chạy 100% mượt mà.*

### 2. Kỹ thuật Thêm Cột Mới (Add Column)

**Anti-Pattern (Downtime)**
```sql
-- Gây khóa bảng cực lâu vì Postgres phải ghi đè giá trị 'pending' xuống 10 triệu dòng hiện có.
ALTER TABLE orders ADD COLUMN status VARCHAR(20) DEFAULT 'pending';
```

**Best Practice (Zero Downtime)**
*Lưu ý: Từ Postgres 11, thêm cột có DEFAULT tĩnh đã được tối ưu (metadata-only), nhưng với Data types phức tạp hoặc DEFAULT động thì vẫn nên cẩn thận.*
```sql
-- BƯỚC 1: Thêm cột cho phép NULL (Chạy trong 1 miligiây)
ALTER TABLE orders ADD COLUMN status VARCHAR(20);

-- BƯỚC 2: Update Data ngầm từ từ (Batch Update) trong nền
-- Không chạy bằng script Flyway, mà viết một Job Java cập nhật dần dần 10,000 dòng/lần
-- UPDATE orders SET status = 'pending' WHERE status IS NULL;

-- BƯỚC 3: Đổi cấu trúc (Set Default và Not Null) sau khi data đã fill xong
ALTER TABLE orders ALTER COLUMN status SET DEFAULT 'pending';
-- (Lưu ý: SET NOT NULL vẫn yêu cầu check lại toàn bộ data, cần dùng Constraints an toàn hơn)
```

### 3. Kỹ thuật Đổi Tên Cột (Rename Column) - Triển khai nhiều bước

Bạn muốn đổi tên cột `first_name` thành `given_name`.
Nếu bạn chạy `ALTER TABLE users RENAME COLUMN first_name TO given_name;`, thì App v1 (đang chạy) sẽ lập tức sụp đổ vì không tìm thấy cột `first_name`!

**Chiến lược 3 Phase (Tương thích ngược & xuôi):**

- **Phase 1 (DB Migration)**:
  1. Thêm cột mới `given_name`.
  2. Tạo Trigger trong DB: Hễ App v1 Ghi/Update vào `first_name` thì tự động copy giá trị sang `given_name` và ngược lại.
  3. Update data cũ từ `first_name` sang `given_name`.
- **Phase 2 (App Code Deploy - v2)**:
  1. Deploy App v2. App v2 đã được code để chỉ Đọc/Ghi vào cột `given_name`.
  2. Suốt quá trình Kubernetes Rolling Update, App v1 và App v2 cùng chạy. Cả 2 đều trơn tru nhờ cái Trigger ở Phase 1.
- **Phase 3 (Cleanup - 1 tuần sau)**:
  1. Xóa cái DB Trigger.
  2. Drop cột cũ `first_name`.

---

## ⚡ Best Practices & Anti-Patterns

### ✅ Best Practices
1. **Chia nhỏ lệnh ALTER**: Tránh gộp 5 lệnh `ALTER TABLE` vào 1 câu query. Nếu 1 lệnh cần lock, nó sẽ kéo theo 4 lệnh kia.
2. **Set `lock_timeout` và `statement_timeout` trong Script**: Trước khi chạy DDL, luôn chạy `SET lock_timeout = '2s';`. Nếu không lấy được khóa độc quyền trong 2s, script sẽ tự hủy thay vì ngâm (hang) vô thời hạn và chặn hàng nghìn câu SELECT khác phía sau.

### ❌ Anti-Patterns

| Anti-Pattern | Problem | Fix |
|-------------|---------|-----|
| Dùng `CREATE INDEX` thường trên DB Production | Ứng dụng sập (Timeouts) vì bảng bị khóa hoàn toàn trong vài phút. | LUÔN LUÔN dùng `CREATE INDEX CONCURRENTLY` (và phải chạy ngoài Transaction block). |
| Bỏ Database Migrations vào lúc Khởi động App (Hibernate `update` hoặc Spring Boot tích hợp sẵn Flyway) | 1. Khi deploy 10 Pods cùng lúc, 10 Pods tranh nhau chạy Flyway gây Race Condition.<br/> 2. Ứng dụng không thể khởi động cho đến khi Migration chạy xong (có thể mất 1 tiếng nếu bảng lớn). | Chạy Migration như một bước **độc lập** trong Pipeline CI/CD (Ví dụ K8s Job) *trước* khi deploy Application Pods. Tắt tính năng tự migrate của Spring (`spring.flyway.enabled=false`). |
| Đổi kiểu dữ liệu trực tiếp (`ALTER TYPE`) | Khóa toàn bộ bảng và chép lại (rewrite) 100% dữ liệu từ đĩa. Cực chậm. | Thêm cột mới với Type mới -> Batch copy data sang -> Đổi tên cột. |
