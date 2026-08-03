# 🔒 Row Level Security (RLS) for Multi-Tenant Architectures

> **Category**: Security & Compliance | **Complexity**: Advanced | **PostgreSQL**: 16+

---

## 📖 Core Technical Mechanics & Deep-Dive

### Bài toán Multi-Tenant (BaaS/SaaS)
Trong các hệ thống SaaS (Software as a Service) như Shopify, Slack, hay Jira, bạn có hàng ngàn khách hàng (Tenants) sử dụng chung một phần mềm.
Có 3 mô hình Database cho SaaS:
1. **Database per Tenant**: Mỗi khách hàng 1 DB riêng. (An toàn tuyệt đối, nhưng tốn tiền và khó quản lý nếu có 10,000 khách hàng).
2. **Schema per Tenant**: Chung DB, mỗi khách hàng 1 Schema. (Tương đối tốt, nhưng vẫn gặp giới hạn khi số lượng schema quá lớn).
3. **Shared DB, Shared Schema**: Tất cả khách hàng nằm chung 1 bảng (Ví dụ bảng `orders`). Phân biệt bằng cột `tenant_id`.

**Nguy cơ của Shared DB:**
Lập trình viên backend viết sai code: `SELECT * FROM orders WHERE user_id = 1` (Quên mất điều kiện `AND tenant_id = 'company_A'`). 
Kết quả: User của Công ty A xem được hóa đơn của Công ty B! Lộ lọt dữ liệu (Data Breach) thảm họa.

### Giải pháp: PostgreSQL Row-Level Security (RLS)
RLS cho phép bạn thiết lập chính sách bảo mật **ngay ở tầng Database engine**.
Dù lập trình viên backend có viết code ngu ngốc `SELECT * FROM orders` (không có WHERE), PostgreSQL sẽ tự động chặn và CHỈ TRẢ VỀ những dòng dữ liệu mà `tenant_id` khớp với bối cảnh (context) hiện tại của connection.

---

## 🌐 Real-World GitHub Patterns & Industry Reference

- **[PostgreSQL Docs: Row Security Policies](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)** — Tài liệu chính thức về RLS.
- **[supabase/supabase](https://github.com/supabase/supabase)** — Firebase alternative xây dựng hoàn toàn dựa trên Postgres RLS để phân quyền Frontend trực tiếp xuống DB.

---

## 📐 System Design Blueprint

### Triển khai RLS cho bảng `orders`

```sql
-- 1. Tạo bảng với cột tenant_id
CREATE TABLE orders (
    id UUID PRIMARY KEY,
    tenant_id VARCHAR(50) NOT NULL,
    amount DECIMAL(10,2),
    status VARCHAR(20)
);

-- 2. BẬT TÍNH NĂNG RLS CHO BẢNG
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Cảnh báo: Ngay khi bật RLS, nếu bạn query bằng User bình thường (không phải superuser), 
-- Postgres sẽ trả về 0 dòng! (Mặc định là Deny All).

-- 3. TẠO CHÍNH SÁCH (POLICY)
-- Ý nghĩa: Chỉ cho phép thao tác (SELECT, INSERT, UPDATE, DELETE) 
-- trên những dòng mà tenant_id bằng với giá trị biến môi trường 'app.current_tenant'
CREATE POLICY tenant_isolation_policy ON orders
    AS PERMISSIVE
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant'));

-- 4. ÉP RLS LÊN CẢ SUPERUSER HOẶC TABLE OWNER (Tuỳ chọn)
ALTER TABLE orders FORCE ROW LEVEL SECURITY;
```

### Tích hợp RLS với Spring Boot / Hibernate
Làm sao để Spring Boot truyền cái biến `app.current_tenant` xuống cho Postgres biết trước khi query?
Ta sử dụng Hibernate Interceptor hoặc Spring AOP để chạy câu lệnh `SET` ngay khi mở Transaction.

```java
@Aspect
@Component
@RequiredArgsConstructor
public class TenantAspect {

    private final EntityManager entityManager;

    // Chạy Aspect này xung quanh các hàm có @Transactional
    @Around("@annotation(org.springframework.transaction.annotation.Transactional)")
    public Object setTenantContext(ProceedingJoinPoint pjp) throws Throwable {
        
        // 1. Lấy TenantID từ SecurityContext (Ví dụ lấy từ JWT Token của request hiện tại)
        String currentTenant = TenantContextHolder.getTenant(); 
        
        // 2. Mở một Hibernate Session và chạy lệnh SET biến môi trường cho Postgres
        Session session = entityManager.unwrap(Session.class);
        session.doWork(connection -> {
            try (PreparedStatement stmt = connection.prepareStatement("SET app.current_tenant = ?")) {
                stmt.setString(1, currentTenant);
                stmt.execute();
            }
        });

        try {
            // 3. Thực thi Business Logic (Ví dụ: orderRepo.findAll())
            return pjp.proceed();
        } finally {
            // 4. Cực kỳ quan trọng: Reset lại biến để chống rò rỉ sang Connection khác (trong Connection Pool)
            session.doWork(connection -> {
                try (PreparedStatement stmt = connection.prepareStatement("RESET app.current_tenant")) {
                    stmt.execute();
                }
            });
        }
    }
}
```

---

## 🧪 Verification Commands

```sql
-- Dưới góc nhìn của Database Client (DBeaver / DataGrip)

-- 1. Giả lập Backend báo với Postgres: "Tôi đang phục vụ cho tenant_A"
SET app.current_tenant = 'tenant_A';

-- 2. Thử truy vấn (Code backend ngu ngốc quên WHERE)
SELECT * FROM orders; 
-- KẾT QUẢ: Postgres tự động chỉ trả về các order của tenant_A. An toàn tuyệt đối!

-- 3. Thử Insert ăn gian (Backend của tenant_A cố tình tạo data cho tenant_B)
INSERT INTO orders (id, tenant_id, amount) VALUES ('uuid-1', 'tenant_B', 100);
-- KẾT QUẢ: Lỗi! Mệnh đề USING (tenant_id = current_setting) ngăn chặn việc Ghi sai tenant.
```

---

## ⚡ Best Practices & Anti-Patterns

### ✅ Best Practices
1. **Luôn tạo Index trên cột `tenant_id`**: Vì Postgres sẽ tự động gắn ngầm `WHERE tenant_id = ...` vào mọi câu query của bạn. Nếu không có Index, nó sẽ Full Table Scan.
2. **Reset State trong Connection Pool**: Spring Boot sử dụng HikariCP. Các DB connection được sử dụng lại nhiều lần. Nếu Request 1 set `app.current_tenant = 'A'`, sau đó Request 2 (của công ty B) dùng lại connection đó mà quên chạy lại lệnh `SET`, Công ty B sẽ nhìn thấy data của Công ty A! **Phải đảm bảo luôn `RESET` hoặc chạy `SET` ở mọi transaction.**
3. **Kết hợp PgBouncer**: Nếu dùng PgBouncer Transaction Pooling, cẩn thận với lệnh `SET`. Phải chắc chắn PgBouncer có cờ `server_reset_query = DISCARD ALL`.

### ❌ Anti-Patterns

| Anti-Pattern | Problem | Fix |
|-------------|---------|-----|
| Quên bật `FORCE ROW LEVEL SECURITY` | Mặc định Table Owner (ví dụ user `admin` mà backend hay dùng) SẼ KHÔNG BỊ ảnh hưởng bởi RLS (By-pass). Code backend vẫn lấy được toàn bộ data. | Luôn chạy `ALTER TABLE ... FORCE ROW LEVEL SECURITY` để RLS áp dụng cả với Owner. (Chỉ trừ superuser xịn mới thoát). |
| Hardcode TenantID trong Backend (Không dùng RLS) | Một ngày đẹp trời, Dev mới vào làm viết 1 API Export Excel báo cáo mà quên `WHERE tenant_id`, toàn bộ cty lên mặt báo vì lộ dữ liệu khách hàng. | RLS là lớp khiên bảo vệ cuối cùng ở tầng DB, không thể bị phá vỡ bởi sai lầm ở tầng Code. |
