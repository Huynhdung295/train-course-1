# 🏗️ Hướng Dẫn Chạy Infra (source_infra) — Từ A đến Z

**Dành cho:** DevOps, Tech Lead, bất kỳ ai deploy hoặc quản lý hạ tầng.

---

## Bước 0: Kiểm tra phiên bản

```bash
# Linux/macOS
docker -v && docker compose version && ansible --version && ssh -V

# Windows (PowerShell)
docker -v
docker compose version
ssh -V   # SSH client cần thiết cho Ops Panel
```

| Công cụ | Lệnh kiểm tra | Yêu cầu | Dùng cho |
|---|---|---|---|
| **Docker** | `docker -v` | 24+ | Chạy containers |
| **Docker Compose** | `docker compose version` | v2+ | Quản lý multi-container |
| **Ansible** | `ansible --version` | 2.15+ | Provision VPS |
| **SSH Client** | `ssh -V` | Bất kỳ | Kết nối VPS |
| **PowerShell** | `$PSVersionTable` | 7+ | Windows Ops Panel |

**Cài Ansible (nếu chưa có):**
```bash
# macOS
brew install ansible

# Linux (Ubuntu)
pip3 install ansible

# Windows → Dùng WSL2
wsl --install
# Trong WSL2: sudo pip3 install ansible
```

---

## Phần 1: Ops Control Panel (Windows GUI)

Công cụ quản lý VPS thông qua menu tương tác — không cần nhớ lệnh SSH.

```powershell
# Mở PowerShell và chạy
cd source_infra\ops_panel
.\nexus_ops.ps1
```

**Menu chính:**
```
=== NEXUS OPS CONTROL PANEL ===
  1. Production-01 (1.2.3.4)
  2. Staging-01 (5.6.7.8)
  ─────────────────────────────
  A. Add New VPS
  0. Exit
```

**Thêm VPS đầu tiên:**
1. Chọn `A`
2. Nhập tên, IP, username, SSH port
3. VPS được lưu vào `ops_panel/vps_list.json`

**Menu VPS (sau khi chọn):**
```
  1. SSH Terminal          7. DEPLOY Nexus Ecosystem
  2. Docker List All       8. PUSH Nexus .env
  3. View Docker Logs      9. PULL Nexus .env
  4. SYNC Nginx (Push)     10. Setup GitHub SSH Key
  5. System Status         11. ISSUE SSL (Certbot)
  6. CLONE Repo (Apps)     12. ROLLBACK (Previous Image)
  ─────────────────────────────────────────────────────
  13. BACKUP Database (Manual)   14. View Backup History
  0. Back to VPS List
```

---

## Phần 2: Provision VPS mới (Ansible)

### Setup lần đầu (một lần duy nhất cho mỗi VPS)

```bash
cd source_infra/ansible

# 1. Cấu hình inventory — thêm IP VPS của bạn
nano inventory.ini
```

File `inventory.ini`:
```ini
[production]
prod-01 ansible_host=1.2.3.4 ansible_user=root ansible_port=22

[staging]
staging-01 ansible_host=5.6.7.8 ansible_user=root ansible_port=22

[all:vars]
ansible_ssh_private_key_file=~/.ssh/id_rsa
```

```bash
# 2. Tạo vault secrets
cp vars/vault.yml.example vars/vault.yml
nano vars/vault.yml  # Điền mật khẩu thật
ansible-vault encrypt vars/vault.yml

# 3. Test kết nối SSH
ansible all -i inventory.ini -m ping

# 4. Provision VPS (cài Docker, Nginx, cấu hình firewall,...)
ansible-playbook -i inventory.ini provision.yml --ask-vault-pass
# Nhập vault password khi được hỏi
```

---

## Phần 3: Deploy Application

### 3a. Deploy thủ công qua SSH

```bash
# Option 1: Dùng Makefile (khuyến nghị)
make deploy ENV=production

# Option 2: Dùng Ops Panel → chọn VPS → Option 7
.\nexus_ops.ps1

# Option 3: SSH trực tiếp
ssh root@1.2.3.4
cd /opt/nexus/source_infra/vps_deploy
docker compose pull
docker compose up -d --remove-orphans
docker compose ps
```

### 3b. Thứ tự khởi động services

```
1. nexus_postgres    ← Database (phải healthy trước)
2. nexus_redis       ← Cache
3. nexus_kafka       ← Message queue
4. nexus_backend     ← Spring Boot API (đợi Postgres healthy)
5. nexus_nginx       ← Reverse proxy (đợi backend healthy)
```

---

## Phần 4: Cập nhật Nginx Config

```bash
# Local: Sửa file config
# source_infra/ops_panel/nginx_configs/Production-01.conf

# Push lên VPS (Ops Panel → Option 4: SYNC Nginx)
# Hoặc dùng lệnh:
scp nginx_configs/Production-01.conf root@1.2.3.4:/tmp/nexus.conf
ssh root@1.2.3.4 "cp /tmp/nexus.conf /etc/nginx/nginx.conf && nginx -t && systemctl reload nginx"
```

---

## Phần 5: Cấp SSL Certificate

```bash
# Qua Ops Panel → Option 11: ISSUE SSL
# Hoặc trực tiếp:
ssh root@1.2.3.4 "certbot --nginx -d nexus.com -d www.nexus.com --non-interactive --agree-tos -m admin@nexus.com"

# Verify SSL
curl -I https://nexus.com
# Phải thấy: HTTP/2 200 và SSL certificate valid
```

**Tự động renew (đã được cấu hình bởi Ansible):**
```bash
# Kiểm tra cron job renew
ssh root@1.2.3.4 "crontab -l | grep certbot"
# 0 2 * * * certbot renew --quiet
```

---

## Phần 6: Monitoring

### Xem Grafana Dashboard

Grafana chạy tại: http://vps-ip:3001
- Username: `admin`
- Password: Xem trong `.env` hoặc hỏi DevOps Lead

**Dashboard có sẵn:**
- **Nexus Overview**: CPU, RAM, Disk, HTTP requests, Latency
- **JVM Metrics**: Heap, GC, Threads
- **Business Metrics**: Orders/phút, Payment success rate

### Xem logs theo thời gian thực

```bash
# Qua Ops Panel → Option 3: View Docker Logs
# Hoặc trực tiếp:
ssh root@1.2.3.4 "docker logs nexus_backend -f --tail 100"

# Filter lỗi
ssh root@1.2.3.4 "docker logs nexus_backend 2>&1 | grep ERROR"

# Tìm theo traceId (distributed tracing)
ssh root@1.2.3.4 "docker logs nexus_backend 2>&1 | grep 'abc123traceId'"
```

---

## Phần 7: Rollback khẩn cấp

```bash
# Cách 1: Qua Ops Panel → Option 12: ROLLBACK
.\nexus_ops.ps1

# Cách 2: Thủ công — rollback backend về image trước
ssh root@1.2.3.4 << 'EOF'
  cd /opt/nexus/source_infra/vps_deploy
  docker compose stop backend
  docker tag ghcr.io/your-org/nexus-backend:previous ghcr.io/your-org/nexus-backend:latest
  docker compose up -d backend
  docker compose ps backend
EOF
```

---

## Phần 8: Backup Database

```bash
# Backup thủ công (Ops Panel → Option 13)
# Hoặc:
ssh root@1.2.3.4 "/opt/nexus/source_infra/vps_deploy/scripts/cronjob_backup.sh"

# Backup tự động chạy lúc 2 AM hàng ngày (cron đã được cấu hình)
# File backup lưu tại: /opt/nexus/backups/

# Xem danh sách backup (Ops Panel → Option 14)
ssh root@1.2.3.4 "ls -lh /opt/nexus/backups/"
```

---

## Thay đổi phiên bản Docker image

```bash
# Xem phiên bản hiện tại đang chạy
ssh root@1.2.3.4 "docker ps --format 'table {{.Image}}\t{{.Status}}'"

# Cập nhật version trong vps_deploy/.env
BACKEND_IMAGE_TAG=v2.1.0   # Thay vì latest

# Kéo và restart
ssh root@1.2.3.4 "cd /opt/nexus/source_infra/vps_deploy && docker compose pull && docker compose up -d backend"
```

---

## Lỗi thường gặp

### ❌ Ansible: `UNREACHABLE! — Connection timed out`
```bash
# Test SSH kết nối trực tiếp
ssh -v root@1.2.3.4

# Kiểm tra firewall trên VPS
ssh root@1.2.3.4 "ufw status"
```

### ❌ Docker: `no space left on device`
```bash
ssh root@1.2.3.4 "df -h"              # Kiểm tra disk
ssh root@1.2.3.4 "docker system prune"  # Dọn image cũ (an toàn)
ssh root@1.2.3.4 "docker volume prune"  # ⚠️ Xóa volume không dùng
```

### ❌ Nginx: `502 Bad Gateway`
```bash
# Kiểm tra backend có chạy không
ssh root@1.2.3.4 "docker ps | grep backend"
ssh root@1.2.3.4 "docker logs nexus_backend --tail 50"

# Kiểm tra Nginx config
ssh root@1.2.3.4 "nginx -t"
```
