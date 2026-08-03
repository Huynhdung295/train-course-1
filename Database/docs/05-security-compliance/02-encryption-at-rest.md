# 🛡️ Encryption at Rest & Data Masking

> **Category**: Security & Compliance | **Complexity**: Advanced | **PostgreSQL**: 16+

---

## 📖 Core Technical Mechanics & Deep-Dive

### The Threat Model (Mối đe dọa)
Dù ứng dụng của bạn bảo mật đến đâu, nếu Hacker (hoặc một nhân viên IT xấu tính) truy cập trực tiếp vào máy chủ Linux chứa Database và copy thư mục `/var/lib/postgresql/data` (hoặc chép file backup trên AWS S3) về máy cá nhân, họ có thể khởi động lại Postgres và đọc toàn bộ dữ liệu.
Hoặc, khi một Dev Junior cần data từ Production để debug lỗi, họ sẽ nhìn thấy toàn bộ CMND, Số điện thoại, Thẻ tín dụng của người dùng.

### Giải pháp 1: Encryption at Rest (TDE - Transparent Data Encryption)
Mã hóa tại chỗ nghỉ (Encryption at Rest) nghĩa là toàn bộ Data Files trên ổ cứng vật lý đều bị mã hóa. Chỉ khi Postgres engine (với khóa giải mã nằm trong RAM) đọc lên thì nó mới biến thành văn bản rõ (plaintext).
- Khác với SQL Server hay Oracle có sẵn TDE native, Postgres nguyên bản (Open Source) **không hỗ trợ TDE toàn phần**.
- Để đạt được Encryption at Rest trên Postgres, ta thường dựa vào các giải pháp Tầng Khối (Block-level) hoặc File-System Level (OS).

### Giải pháp 2: Application-Level Encryption & Masking
Ứng dụng (Spring Boot) tự động mã hóa dữ liệu nhạy cảm (PII) *trước khi* gửi xuống Postgres. Postgres chỉ nhìn thấy cục rác nhị phân (ciphertext).
Đồng thời, áp dụng Dynamic Data Masking để che dấu dữ liệu (ví dụ: `4532 **** **** 1234`) khi truy vấn, tùy theo role của người truy vấn.

---

## 🌐 Real-World GitHub Patterns & Industry Reference

- **[postgrespro/pgcrypto](https://www.postgresql.org/docs/current/pgcrypto.html)** — Extension mã hóa native bên trong Postgres.
- **[dalibo/postgresql_anonymizer](https://github.com/dalibo/postgresql_anonymizer)** — Extension chuẩn công nghiệp cho việc Masking và Anonymize dữ liệu PII.

---

## 📐 System Design Blueprint

### 1. Infrastructure-Level Encryption (Cloud / OS)

Trong môi trường Enterprise, cách dễ nhất và không ảnh hưởng code là mã hóa ổ cứng.
- **AWS RDS / Aurora**: Tích tick vào ô "Enable Encryption" (Dùng AWS KMS). Ổ đĩa EBS bên dưới sẽ bị mã hóa. Snapshot/Backup cũng tự động mã hóa.
- **On-Premise (Linux)**: Sử dụng LUKS (Linux Unified Key Setup) để mã hóa toàn bộ partition chứa `/var/lib/postgresql/data`.

### 2. Application-Level Encryption (Hibernate @ColumnTransformer)

Nếu bạn không tin tưởng Cloud Provider (AWS) hoặc DBA, hãy mã hóa cột PII ngay từ Java.

```java
@Entity
public class User {
    
    @Id
    private UUID id;

    // Email có thể search được
    private String email;

    // Số CMND (PII) - Bắt buộc mã hóa
    // ColumnTransformer yêu cầu extension pgcrypto trên Postgres
    @Column(name = "national_id")
    @ColumnTransformer(
        // Khi đọc lên: Giải mã bằng key
        read = "pgp_sym_decrypt(national_id::bytea, 'MY_SECRET_APP_KEY')",
        // Khi ghi xuống: Mã hóa bằng key
        write = "pgp_sym_encrypt(?, 'MY_SECRET_APP_KEY')"
    )
    private String nationalId;
}
```
*Nhược điểm: Bạn không thể dùng toán tử `LIKE` hoặc tạo Index thông thường trên cột bị mã hóa kiểu này.*

### 3. Dynamic Data Masking với `postgresql_anonymizer`

Khi bạn phải Dump DB Production mang về môi trường Staging/Dev cho lập trình viên test, bạn BẮT BUỘC phải che dữ liệu nhạy cảm.

```sql
-- 1. Kích hoạt Extension
CREATE EXTENSION IF NOT EXISTS anon;
SELECT anon.init();

-- 2. Định nghĩa các quy tắc ẩn danh (Masking Rules)
-- Ẩn tên thật, thay bằng tên fake ngẫu nhiên
SECURITY LABEL FOR anon ON COLUMN users.name 
IS 'MASKED WITH FUNCTION anon.fake_first_name()';

-- Ẩn thẻ tín dụng, chỉ giữ 4 số cuối
SECURITY LABEL FOR anon ON COLUMN users.credit_card 
IS 'MASKED WITH FUNCTION anon.partial(credit_card,2,$$******$$,4)';

-- Xóa hẳn email
SECURITY LABEL FOR anon ON COLUMN users.email 
IS 'MASKED WITH FUNCTION anon.random_email()';

-- 3. Tạo một View hoặc Role riêng để xuất dữ liệu
-- Khi Dev truy vấn vào bảng users (hoặc khi dump DB), họ sẽ chỉ thấy dữ liệu đã bị che!
SELECT anon.start_dynamic_masking();
```

---

## ⚡ Best Practices & Anti-Patterns

### ✅ Best Practices
1. **Quản lý Key (KMS)**: Đừng bao giờ lưu Key giải mã cứng trong source code. Sử dụng HashiCorp Vault hoặc AWS KMS.
2. **Nguyên tắc "Ít đặc quyền nhất" (Least Privilege)**: Tắt quyền truy cập của Developer vào DB Production. Mọi thao tác debug/query phải thông qua một tool trung gian có Audit Log và Data Masking.
3. **Mã hóa Backup**: Dữ liệu trong DB có thể được mã hóa ổ cứng, nhưng file Dump/WAL Archiving đẩy lên S3 cũng phải được mã hóa (Dùng cấu hình `repo1-cipher-type` của pgBackRest).

### ❌ Anti-Patterns

| Anti-Pattern | Problem | Fix |
|-------------|---------|-----|
| Lưu Password dạng Clear Text hoặc băm bằng MD5/SHA-256 cơ bản | DB rò rỉ, Hacker dùng kỹ thuật Rainbow Table dịch ngược ra password thật trong vài phút. | Bắt buộc dùng thuật toán băm có Salt và Work Factor (Chi phí CPU) như **Bcrypt** hoặc **Argon2**. |
| Mã hóa toàn bộ dữ liệu ở Tầng Code | DB mất khả năng tính toán. Không thể dùng `ORDER BY`, `SUM`, hay `JOIN` trên dữ liệu đã mã hóa. | Chỉ mã hóa các trường PII (PII fields) cực kỳ nhạy cảm (SSN, Thẻ tín dụng). Các trường hay dùng để JOIN/Search (Email, Tên) nên mã hóa ở tầng Ổ đĩa (TDE). |
