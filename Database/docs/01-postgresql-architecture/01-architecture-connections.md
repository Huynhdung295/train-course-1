# 🐘 PostgreSQL Architecture & Connection Pooling

> **Category**: PostgreSQL | **Complexity**: Advanced | **PostgreSQL**: 16+ | **PgBouncer**: 1.22+

---

## 📖 Core Technical Mechanics & Deep-Dive

### The Process-per-Connection Model
Khác với MySQL (sử dụng thread-per-connection), PostgreSQL sử dụng mô hình **process-per-connection**. Mỗi khi có một connection mới, tiến trình `postmaster` sẽ `fork()` ra một process con.
- Ưu điểm: Lỗi ở một connection (ví dụ segment fault) không làm sập toàn bộ CSDL.
- Nhược điểm: Việc `fork()` rất tốn RAM (~10MB/connection) và CPU. 
Nếu bạn có 1000 Microservices (mỗi service mở pool 50 connection), bạn sẽ có 50,000 connections. Postgres sẽ chết vì hết RAM và CPU Context Switching trước khi kịp query data!

### Giải pháp: Connection Pooling (PgBouncer)
Để giải quyết bài toán trên, chúng ta sử dụng **PgBouncer**. PgBouncer là một lightweight connection pooler đứng giữa Ứng dụng và PostgreSQL.

1. **Ứng dụng** kết nối đến PgBouncer (mở hàng nghìn connection).
2. **PgBouncer** giữ một pool nhỏ (ví dụ 100-200 connection thật) đến PostgreSQL.
3. Khi Ứng dụng gửi query, PgBouncer mượn 1 connection thật để chạy, xong trả lại ngay.

#### Các chế độ của PgBouncer
- **Session Pooling**: 1 App Connection chiếm 1 DB Connection cho đến khi App ngắt kết nối. (Không giải quyết được bài toán scale vi dịch vụ).
- **Transaction Pooling (Khuyên dùng)**: 1 App Connection chỉ mượn DB Connection trong thời gian diễn ra 1 Transaction (BEGIN ... COMMIT). Nếu App nhàn rỗi (idle), DB Connection được nhả ra cho App khác mượn. (Scale tuyệt vời, chịu được 100,000 concurrent app connections).
- **Statement Pooling**: Trả connection ngay sau từng câu lệnh (Không dùng được các tính năng multi-statement transactions).

---

## 🌐 Real-World GitHub Patterns & Industry Reference

- **[pgbouncer/pgbouncer](https://github.com/pgbouncer/pgbouncer)** — Lightweight connection pooler for PostgreSQL.
- **[zalando/postgres-operator](https://github.com/zalando/postgres-operator)** — K8s operator tự động triển khai Postgres + PgBouncer chuẩn Enterprise.

---

## ⚙️ Production Configuration

### 1. PostgreSQL Cấu hình (postgresql.conf)

```ini
# Đừng set max_connections quá cao. Công thức chung: Số core * 4. 
# Ví dụ server 16 cores -> max_connections = 64 (tối đa 100-200).
max_connections = 200

# Dành riêng một vài connection cho superuser/admin để cứu hộ khi pool đầy
superuser_reserved_connections = 5
```

### 2. PgBouncer Cấu hình (pgbouncer.ini)

```ini
[databases]
# Forward connection tới db thực
app_db = host=127.0.0.1 port=5432 dbname=app_db

[pgbouncer]
listen_port = 6432
listen_addr = *
auth_type = md5
auth_file = users.txt

# BẮT BUỘC DÙNG transaction pooling cho microservices
pool_mode = transaction

# Tối đa bao nhiêu connection từ PgBouncer đến DB thực cho 1 database?
max_db_connections = 100

# Tối đa bao nhiêu connection từ Ứng dụng đến PgBouncer?
max_client_conn = 10000

# Tránh ứng dụng mượn connection quá lâu (chống transaction treo)
idle_transaction_timeout = 10.0
```

### 3. Cấu hình Spring Boot (HikariCP)
Khi dùng PgBouncer ở chế độ `Transaction Pooling`, bạn **bắt buộc** phải cấu hình HikariCP (Spring Boot) không sử dụng các tính năng phụ thuộc vào Session (như Prepared Statements cache trên session).

```yaml
spring:
  datasource:
    # Trỏ URL vào cổng 6432 của PgBouncer
    url: jdbc:postgresql://pgbouncer-host:6432/app_db
    hikari:
      maximum-pool-size: 20       # Mỗi pod backend giữ 20 connection đến PgBouncer
      minimum-idle: 5
      auto-commit: false          # Transaction pooling hoạt động tốt nhất khi auto-commit tắt ở level driver
      data-source-properties:
        # BẮT BUỘC khi dùng PgBouncer Transaction Pooling
        prepareThreshold: 0       # Tắt Server-side prepared statements
```

---

## 📐 System Design Blueprint

### Kiến trúc Luồng Dữ Liệu

```mermaid
graph TD
    App1[Order Service (20 connections)] --> PB[PgBouncer Port 6432]
    App2[User Service (20 connections)] --> PB
    App3[Inventory Service (20 connections)] --> PB
    AppN[... 100 Pods (2000 connections)] --> PB
    
    PB -- "Chỉ mở 100 thực DB Connections" --> PG[PostgreSQL Port 5432]
    
    style PB fill:#f9f,stroke:#333,stroke-width:2px
    style PG fill:#87CEEB,stroke:#333,stroke-width:2px
```

---

## ⚡ Best Practices & Anti-Patterns

### ✅ Best Practices
1. **Chia để trị**: Đặt PgBouncer như một sidecar container hoặc deployment độc lập trong Kubernetes (trước mặt DB).
2. **Tắt Server-side Prepared Statements trong JDBC**: Spring/Hibernate thường dùng Server-side prepared statements (`PREPARE stmt1 AS...`). Tính năng này gắn liền với Session. Khi dùng PgBouncer (Transaction pooling), transaction thứ 1 tạo `stmt1` trên connection A, transaction thứ 2 của cùng App lại được PgBouncer cấp connection B (nơi `stmt1` không tồn tại) -> Bắn lỗi `prepared statement "stmt1" does not exist`. Phải thêm `prepareThreshold=0` vào JDBC URL!
3. **Chỉ dùng PgBouncer để đọc/ghi Data**: Với các tool Migrate DB (như Flyway, Liquibase), hãy kết nối **trực tiếp** vào cổng 5432 của Postgres (vì Flyway cần lock tables, tạo objects... yêu cầu session pooling).

### ❌ Anti-Patterns

| Anti-Pattern | Problem | Fix |
|-------------|---------|-----|
| `max_connections = 10000` trong `postgresql.conf` | Out of Memory (OOM Killer) hoặc CPU quá tải do Context Switching. | Set max ~100-200. Dùng PgBouncer để hứng 10,000 connections. |
| Dùng PgBouncer Session Pooling cho Microservices | Trả về y chang bài toán ban đầu: 100 Pods mở 2000 connections, PgBouncer phải mở 2000 connections xuống DB. | Chuyển sang `Transaction Pooling`. |
| Chạy các câu lệnh SET ROLE, SET TIME ZONE ở đầu query | Trong Transaction Pooling, câu lệnh `SET` rác này có thể bị "rò rỉ" sang transaction của người dùng khác được cấp lại connection đó. | Tắt `SET` trong ứng dụng, hoặc cấu hình PgBouncer `server_reset_query = DISCARD ALL`. |
