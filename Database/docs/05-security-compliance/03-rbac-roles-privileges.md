# 🛂 RBAC (Role-Based Access Control) & Privileges

> **Category**: Security & Compliance | **Complexity**: Intermediate | **PostgreSQL**: 16+

---

## 📖 Core Technical Mechanics & Deep-Dive

### The Superuser Anti-Pattern
Trong môi trường phát triển (Local/Dev), lập trình viên thường dùng user `postgres` (Superuser) để kết nối vào Database.
Nếu thói quen này lọt lên Production, hậu quả sẽ cực kỳ thảm khốc:
- Lỗ hổng SQL Injection từ một đoạn code cẩu thả có thể cho phép Hacker dùng quyền superuser để DROP toàn bộ Database.
- Hacker có thể gọi các hàm `COPY` của postgres để đọc trộm các file nhạy cảm trên hệ điều hành Linux (`/etc/passwd`).

### Triết lý "Principle of Least Privilege" (PoLP)
Mỗi User/Role trong Database chỉ được cấp ĐÚNG quyền cần thiết để làm việc của nó, không hơn một chút nào.
- Ứng dụng Backend (API): Chỉ được `SELECT`, `INSERT`, `UPDATE`, `DELETE` trên bảng dữ liệu. **Không được** chạy lệnh `DROP TABLE` hay `ALTER TABLE`.
- Công cụ Migration (Flyway/Liquibase): Cần quyền DDL (`CREATE`, `ALTER`, `DROP`). Chạy xong thì ngắt kết nối.
- Developer/Data Analyst: Chỉ được cấp quyền **READ-ONLY**. Không được phép Sửa/Xóa.

---

## 🌐 Real-World GitHub Patterns & Industry Reference

- **[PostgreSQL Docs: Roles & Privileges](https://www.postgresql.org/docs/current/user-manag.html)** — Tài liệu chính thức về phân quyền trong Postgres.

---

## 📐 System Design Blueprint

### 1. Kiến trúc phân quyền chuẩn Enterprise

Thay vì cấp quyền trực tiếp cho từng cá nhân (gắn quyền `SELECT` cho user `john`), hãy thiết lập CẤU TRÚC ROLE (Group).

```sql
-- ==========================================
-- BƯỚC 1: TẠO CÁC ROLE NHÓM (GROUPS)
-- ==========================================

-- Nhóm 1: Dành cho Backend API (Chỉ thao tác DML, không đổi được Schema)
CREATE ROLE group_app_backend NOLOGIN;

-- Nhóm 2: Dành cho Data Analysts / Developer (Chỉ xem)
CREATE ROLE group_read_only NOLOGIN;

-- Nhóm 3: Dành cho công cụ Migration / CI/CD Pipeline
CREATE ROLE group_schema_migrator NOLOGIN;


-- ==========================================
-- BƯỚC 2: CẤP QUYỀN (GRANTS) CHO TỪNG NHÓM
-- ==========================================

-- Rút toàn bộ quyền public mặc định (Bảo mật tối đa)
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON DATABASE app_db FROM PUBLIC;

-- Quyền cho group_app_backend
GRANT CONNECT ON DATABASE app_db TO group_app_backend;
GRANT USAGE ON SCHEMA public TO group_app_backend;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO group_app_backend;
-- Bắt buộc: Cấp quyền thao tác chuỗi (Sequence) để dùng cột AUTO_INCREMENT/SERIAL
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO group_app_backend;

-- Quyền cho group_read_only (Chỉ SELECT)
GRANT CONNECT ON DATABASE app_db TO group_read_only;
GRANT USAGE ON SCHEMA public TO group_read_only;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO group_read_only;

-- Quyền cho group_schema_migrator (Được làm mọi thứ trừ việc chiếm quyền admin)
GRANT ALL PRIVILEGES ON DATABASE app_db TO group_schema_migrator;
GRANT ALL PRIVILEGES ON SCHEMA public TO group_schema_migrator;


-- ==========================================
-- BƯỚC 3: ĐẢM BẢO QUYỀN TỰ ĐỘNG CHẤP NHẬN TRONG TƯƠNG LAI (DEFAULT PRIVILEGES)
-- ==========================================
-- Vấn đề: Khi Flyway tạo một cái BẢNG MỚI, bảng đó thuộc về Flyway. 
-- App_Backend sẽ không có quyền SELECT/INSERT trên cái bảng mới này nếu ta không khai báo trước!

ALTER DEFAULT PRIVILEGES FOR ROLE group_schema_migrator IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO group_app_backend;
    
ALTER DEFAULT PRIVILEGES FOR ROLE group_schema_migrator IN SCHEMA public
    GRANT SELECT ON TABLES TO group_read_only;


-- ==========================================
-- BƯỚC 4: TẠO USER THẬT VÀ GÁN VÀO NHÓM
-- ==========================================

-- Tạo user cho file application.yml của Spring Boot
CREATE USER srv_order_api WITH PASSWORD 'StrongPassword123' LOGIN;
GRANT group_app_backend TO srv_order_api;

-- Tạo user cho Developer
CREATE USER dev_john_doe WITH PASSWORD 'dev123' LOGIN;
GRANT group_read_only TO dev_john_doe;
```

---

## ⚡ Best Practices & Anti-Patterns

### ✅ Best Practices
1. **Rotate Passwords định kỳ**: Đổi mật khẩu của các service users ít nhất 3 tháng/lần thông qua Vault hoặc các secret manager (K8s Secrets).
2. **Theo dõi việc dùng quyền (Audit Logging)**: Sử dụng extension `pgaudit` để ghi log lại **tất cả** các thao tác DDL (Ai đã chạy lệnh Drop Table?) hoặc các câu SELECT dữ liệu nhạy cảm.

### ❌ Anti-Patterns

| Anti-Pattern | Problem | Fix |
|-------------|---------|-----|
| Dùng chung 1 tài khoản `postgres` cho Spring Boot, Flyway, và DBeaver. | Nếu DB sập vì 1 lệnh ALTER sai, bạn không thể biết là do Flyway chạy lỗi, hay do Dev gõ nhầm trên DBeaver, hay do Spring Boot sinh code bậy. | Phải tạo User riêng rẽ cho từng dịch vụ và từng mục đích. |
| Cấp quyền trực tiếp cho User (`GRANT SELECT TO john`) thay vì cho Role | Khi John nghỉ việc và Mary vào, bạn phải hì hục tìm lại xem John có những quyền gì để add cho Mary. | Tạo Role `group_read_only`. Gán John vào nhóm đó. Khi John nghỉ, chỉ việc DROP user john, các quyền của hệ thống không bị ảnh hưởng. |
| Quên thiết lập `ALTER DEFAULT PRIVILEGES` | Migration tạo bảng mới thành công, nhưng Website sập vì báo lỗi `Permission denied for table X` khi INSERT. | Bắt buộc phải cấu hình Default Privileges ngay từ lúc setup cụm DB. |
