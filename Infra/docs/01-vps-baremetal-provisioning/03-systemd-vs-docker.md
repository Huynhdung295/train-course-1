# ⚙️ Systemd vs Docker Container cho Spring Boot

> **Category**: VPS & Baremetal | **Complexity**: Intermediate | **Linux**: Ubuntu/Debian

---

## 📖 Core Technical Mechanics & Deep-Dive

Khi bạn có một VPS Linux thuần (Baremetal/VM), bạn có 2 cách chính để chạy file `.jar` của Spring Boot:
1. **Chạy trực tiếp trên máy host qua Systemd Service**.
2. **Đóng gói file `.jar` thành Docker Image và chạy bằng Docker Engine**.

### 1. Phân tích Systemd (Baremetal)
**Systemd** là trình quản lý hệ thống mặc định của mọi distro Linux hiện đại. Nó quản lý các "daemon" (dịch vụ chạy ngầm).
- **Ưu điểm**: 
  - Hiệu năng tối đa (Baremetal performance). Không có overhead của ảo hóa mạng (Bridge network) hay cgroups. Băng thông mạng, I/O ổ đĩa, CPU đều chạy ở tốc độ cao nhất của máy vật lý.
  - Cực kỳ nhẹ, không tốn RAM chạy Docker Daemon.
- **Nhược điểm**: 
  - Phụ thuộc môi trường: Bạn phải tự cài JRE 21 lên OS. Lỡ OS update làm hỏng Java thì app chết. 
  - Thiếu cô lập: App có thể đọc/ghi bất kỳ đâu trên ổ cứng nếu bị hack (nếu không set User Permission kỹ).
  - Khó rollback và khó deploy tự động (Phải copy file jar đè lên, restart service).

### 2. Phân tích Docker Containerization
- **Ưu điểm**:
  - Tính cô lập (Isolation): App chạy trong môi trường Alpine Linux riêng biệt, JRE riêng biệt. Code chạy ở máy dev như thế nào, lên server chạy y chang 100%.
  - Triển khai siêu mượt: Chỉ cần `docker pull` image mới, `docker stop` image cũ, `docker start` image mới. Tích hợp CI/CD tuyệt vời. Rollback trong 1 giây.
  - Quản lý tài nguyên: Dễ dàng giới hạn RAM/CPU qua file `compose.yml`.
- **Nhược điểm**:
  - Mạng bridge của Docker làm chậm I/O Network đi 3-5% (Dù khó nhận ra).
  - Tốn thêm vài trăm MB RAM cho Docker Engine và các Container image.

---

## 🌐 Lời khuyên chuẩn Enterprise

1. **Với Backend App / Web Service**: **100% sử dụng DOCKER**. Sự tiện lợi của CI/CD, tính tái sử dụng, khả năng đóng gói môi trường bù đắp hoàn toàn cho 3% hiệu năng bị mất.
2. **Với Database (PostgreSQL / ScyllaDB) / Message Broker (Kafka)**: **CÂN NHẮC dùng Baremetal (Systemd)** trên các cụm Production lớn. Database khao khát tốc độ I/O ổ cứng tối đa và RAM vật lý tối đa. Đặt Database trong Docker trên Production (đặc biệt nếu mount volume sai cách) có thể làm giảm hiệu suất nghiêm trọng. 
*(Tuy nhiên, với công ty nhỏ, tiện lợi ưu tiên hàng đầu, cứ bỏ cả Postgres vào Docker Compose).*

---

## 📐 Cấu hình Mẫu

### Mẫu 1: Systemd Service cho Spring Boot (Dành cho ai thích Baremetal)

Nếu bạn chọn chạy trực tiếp, BẮT BUỘC phải tạo 1 user riêng (VD: `myapp`) để chạy, không được chạy file `.jar` bằng `root`.

Tạo file: `/etc/systemd/system/myapp.service`

```ini
[Unit]
Description=My Spring Boot Application
After=syslog.target network.target

[Service]
# Chạy app bằng tài khoản không có đặc quyền root
User=myapp
Group=myapp

# Định nghĩa RAM và các cờ tối ưu
Environment="JAVA_OPTS=-Xmx1024m -XX:+UseG1GC -Djava.security.egd=file:/dev/./urandom"

# Đường dẫn file jar
WorkingDirectory=/opt/myapp
ExecStart=/usr/bin/java $JAVA_OPTS -jar myapp.jar

# Tự động restart nếu app bị sập (OOM hoặc Exception)
SuccessExitStatus=143
Restart=always
RestartSec=10

# Bật bảo mật OS (Quan trọng: chặn app ghi lung tung ra ngoài thư mục của nó)
ProtectSystem=full
ProtectHome=true
NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
```

**Cách quản lý:**
```bash
sudo systemctl daemon-reload
sudo systemctl enable myapp    # Khởi động cùng HĐH
sudo systemctl start myapp     # Bật app
sudo journalctl -u myapp -f    # Xem log (thay cho log file)
```

### Mẫu 2: Docker Compose (Chuẩn hiện đại)

Thay vì viết bash script phức tạp, mọi thứ nằm trong `compose.yml`.

```yaml
services:
  myapp:
    image: myregistry.com/myapp:1.0.0
    restart: always  # Tương đương Restart=always của Systemd
    ports:
      - "8080:8080"
    environment:
      - SPRING_PROFILES_ACTIVE=prod
      # Thiết lập RAM thông qua cờ JDK container support
      - JAVA_OPTS=-XX:MaxRAMPercentage=75.0 -XX:+UseZGC
    deploy:
      resources:
        limits:
          memory: 2G  # Giới hạn RAM cứng từ bên ngoài Docker
```

---

## ⚡ Best Practices & Anti-Patterns

### ✅ Best Practices
1. **Dùng Log Rotation cho Docker**: Mặc định Docker lưu log của container vào file json cục bộ mãi mãi. Một ngày đẹp trời, VPS bạn sẽ báo đầy ổ cứng vì file log dài 100GB! Hãy thêm vào `docker-compose.yml`:
   ```yaml
   logging:
     driver: "json-file"
     options:
       max-size: "50m" # Cắt file khi đạt 50MB
       max-file: "3"   # Chỉ giữ 3 file cũ nhất
   ```
2. **Mount Volume cho Database (Nếu chạy DB bằng Docker)**: Tuyệt đối không lưu dữ liệu trong ruột container. Luôn mount ra ngoài thư mục vật lý (Bind mount hoặc Docker Volume) để bảo toàn data khi xóa container.

### ❌ Anti-Patterns

| Anti-Pattern | Problem | Fix |
|-------------|---------|-----|
| Mở cổng `8080` của Docker app thẳng ra mạng Internet | Lỗ hổng bảo mật. Bypass Firewall UFW (Docker tự chọc UFW rule riêng, nên bạn chặn ở UFW nó vẫn lọt). Không có SSL/TLS. | Bind cổng docker vào IP `127.0.0.1:8080`. Sau đó cài Nginx (Reverse Proxy) chạy trên port 80/443 để hứng traffic rồi trỏ vào `127.0.0.1:8080`. |
| Cài JDK 1.8 bằng `apt-get` lên Ubuntu 24.04 để chạy code cũ | Tạo "Bãi rác" hệ thống. Xung đột phiên bản nếu app khác đòi JDK 21. | Đóng gói app cũ vào Docker image (VD: `openjdk:8-jre-alpine`). VPS luôn sạch sẽ. |
