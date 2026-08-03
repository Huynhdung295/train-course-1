# 🚑 Backup & Disaster Recovery (pgBackRest)

> **Category**: Database Operations | **Complexity**: Advanced | **PostgreSQL**: 16+ | **pgBackRest**

---

## 📖 Core Technical Mechanics & Deep-Dive

### Bài toán Backup Truyền thống (pg_dump)
Công cụ `pg_dump` tạo ra Logical Backup (Lưu dữ liệu dưới dạng các lệnh `INSERT`).
- *Nhược điểm 1*: Dump 1 DB 500GB tốn hàng tiếng đồng hồ, làm giảm nghiêm trọng hiệu năng DB (I/O & CPU) trong lúc chạy.
- *Nhược điểm 2*: Restore cũng tốn hàng tiếng.
- *Nhược điểm 3*: Chỉ backup được tại 1 thời điểm cố định (VD: 2h sáng). Nếu DB sập lúc 15:00, bạn mất toàn bộ dữ liệu từ 2h sáng đến 15:00!

### Giải pháp: Physical Backup + PITR (Point-In-Time Recovery)
Thay vì dùng `pg_dump`, Enterprise sử dụng Physical Backup (Copy trực tiếp các khối nhị phân Data Files của Postgres).
Hệ thống **PITR (Phục hồi tại một thời điểm bất kỳ)** hoạt động dựa trên 2 yếu tố:
1. **Base Backup (Full/Differential/Incremental)**: Copy toàn bộ cấu trúc vật lý của thư mục dữ liệu Postgres. Chạy định kỳ (Ví dụ: Chủ Nhật làm Full Backup, các ngày khác làm Incremental Backup).
2. **WAL Archiving (Lưu trữ log liên tục)**: Cấu hình Postgres tự động đẩy mọi file WAL (ghi nhận mọi thao tác `INSERT/UPDATE`) sinh ra lên một Object Storage (AWS S3, MinIO) theo thời gian thực.

**Khi thảm họa xảy ra (Ví dụ: Lúc 15:30, một dev lỡ tay chạy `DELETE FROM users;` mà quên WHERE):**
- Bạn không thể dùng bản backup lúc 2h sáng vì sẽ mất dữ liệu cả ngày.
- Bạn chạy lệnh Restore và chỉ định: Khôi phục lại Base Backup lúc 2h sáng, sau đó tải các file WAL trên S3 về và "tua" (replay) mọi thao tác **cho đến chính xác 15:29:59**.
- Kết quả: Dữ liệu lúc 15:29:59 sống lại hoàn chỉnh! Lệnh DELETE ngu ngốc lúc 15:30 không được thực thi.

---

## 🌐 Real-World GitHub Patterns & Industry Reference

- **[pgbackrest/pgbackrest](https://github.com/pgbackrest/pgbackrest)** — Công cụ sao lưu vật lý và PITR nhanh nhất, chuẩn công nghiệp cho PostgreSQL (Được hỗ trợ bởi Crunchy Data).

---

## 📐 System Design Blueprint

### Kiến trúc pgBackRest với AWS S3

```mermaid
graph TD
    subgraph Database Server
        PG[PostgreSQL Node]
        PGB[pgBackRest Agent]
        PG -. "Archive Command (Push WAL)" .-> PGB
        PG -. "Cronjob (Trigger Base Backup)" .-> PGB
    end
    
    subgraph Cloud Storage
        S3[(AWS S3 / MinIO Bucket)]
        B_Repo[Backup Repository]
        WAL_Repo[WAL Archives]
        B_Repo --- S3
        WAL_Repo --- S3
    end
    
    PGB === "Push/Pull (Parallel, Compressed, Encrypted)" === S3
```

---

## ⚙️ Production Configuration

### 1. postgresql.conf (Bật tính năng đẩy WAL đi)

```ini
# Bật cơ chế Archiving
archive_mode = on

# Khi một file WAL (16MB) đầy, Postgres sẽ gọi lệnh này để giao việc cho pgBackRest
# Cờ %p là đường dẫn file gốc, %f là tên file
archive_command = 'pgbackrest --stanza=my_app archive-push %p'

# Đảm bảo WAL chứa đủ thông tin để Replica hoặc Backup có thể chạy (Mặc định ở PG 16 là 'replica')
wal_level = replica 
```

### 2. /etc/pgbackrest.conf (Cấu hình pgBackRest)

```ini
[my_app]
pg1-path=/var/lib/postgresql/data

[global]
# Repository 1: Cấu hình lưu trữ lên AWS S3
repo1-type=s3
repo1-s3-endpoint=s3.amazonaws.com
repo1-s3-region=us-east-1
repo1-s3-bucket=my-company-db-backups
repo1-s3-key=AKIAIOSFODNN7EXAMPLE
repo1-s3-key-secret=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY

# Retention Policy (Chính sách lưu giữ để không bị tốn tiền S3 quá nhiều)
# Chỉ giữ lại 2 bản Full Backup gần nhất (Ví dụ 2 tuần gần nhất)
repo1-retention-full=2
# Giữ lại các bản Diff Backup trong 7 ngày
repo1-retention-diff=7

# Bật tính năng nén và mã hóa!
repo1-cipher-type=aes-256-cbc
repo1-cipher-pass=MY_SUPER_SECRET_ENCRYPTION_KEY
compress-type=lz4
process-max=4 # Dùng 4 luồng CPU để copy nhanh hơn
```

---

## 🧪 Verification Commands

```bash
# Lệnh tạo stanza (Khởi tạo repo trên S3) - Chỉ chạy 1 lần ban đầu
pgbackrest --stanza=my_app stanza-create

# Kiểm tra xem Postgres đẩy WAL lên S3 ổn không
pgbackrest --stanza=my_app check

# 1. Chạy Full Backup (Bằng tay hoặc qua Cronjob vào Chủ Nhật)
pgbackrest --stanza=my_app --type=full backup

# 2. Chạy Diff Backup (Vào các ngày trong tuần - Nhanh hơn Full Backup rất nhiều)
pgbackrest --stanza=my_app --type=diff backup

# 3. Lệnh Thần Thánh: POINT-IN-TIME RECOVERY (PITR)
# Dừng Postgres -> Xóa sạch Data folder cũ -> Chạy lệnh này:
pgbackrest --stanza=my_app --type=time --target="2023-10-15 15:29:59+00" restore
# Start Postgres lại -> Data hồi sinh!
```

---

## ⚡ Best Practices & Anti-Patterns

### ✅ Best Practices
1. **Lịch trình Backup Chuẩn (Grandfather-Father-Son)**: 
   - Chủ Nhật (2:00 AM): `type=full`
   - Thứ 2 đến Thứ 7 (2:00 AM): `type=diff` (Differential - Lưu những thay đổi so với bản Full gần nhất). Không nên dùng Incremental nếu không thực sự cạn kiệt dung lượng vì khi Restore sẽ phải chắp vá rất nhiều.
2. **Kiểm thử việc Restore định kỳ**: Một bản Backup không thể Restore thành công (ví dụ do sai pass giải mã, thiếu file WAL) thì coi như VÔ DỤNG. Hàng tháng, hãy kéo bản backup về một DB Staging và thử chạy PITR.
3. **Mã hóa (Encryption at Rest)**: Các file Backup trên S3 chứa toàn bộ PII (Mật khẩu, thông tin cá nhân). **BẮT BUỘC** phải bật tính năng mã hóa `repo1-cipher-type` của pgBackRest trước khi đẩy lên S3.

### ❌ Anti-Patterns

| Anti-Pattern | Problem | Fix |
|-------------|---------|-----|
| Dùng `pg_dump` bằng cronjob làm chiến lược backup duy nhất | Quá chậm, làm ảnh hưởng DB đang chạy, và mất dữ liệu trong ngày nếu sự cố xảy ra giữa 2 lần cronjob. | Chuyển sang Physical Backup (pgBackRest / WAL-G). Chỉ dùng `pg_dump` khi cần export 1 table duy nhất để test. |
| Lưu backup cùng Server hoặc cùng Data Center | Cháy Data Center hoặc bị Ransomware mã hóa server thì mất luôn cả DB lẫn Backup. | Luôn đẩy lên Cloud Object Storage (S3/GCS) khác khu vực vật lý. |
| Không set up Alert cho `archive_command` | Nếu AWS S3 bị lỗi mạng, `archive_command` bị fail liên tục, Postgres sẽ không dám xóa các file WAL cục bộ. Ổ cứng DB sẽ bị đầy (Disk Full) 100% trong vài giờ và DB sẽ SẬP! | Dùng Prometheus check xem thư mục `pg_wal` có bị phình to không. |
