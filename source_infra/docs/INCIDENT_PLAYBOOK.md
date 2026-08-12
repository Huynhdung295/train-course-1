# 🚨 Incident Playbook — Production Response Guide

Hướng dẫn xử lý sự cố Production. **Bình tĩnh. Đọc kỹ từng bước. Không panic.**

---

## Mức độ nghiêm trọng (Severity Levels)

| Level | Mô tả | Thời gian phản hồi | Ví dụ |
|---|---|---|---|
| **SEV-1** | Production hoàn toàn sập | 15 phút | App không truy cập được, DB sập |
| **SEV-2** | Ảnh hưởng một phần lớn users | 30 phút | Thanh toán lỗi, login không được |
| **SEV-3** | Tính năng phụ lỗi | 2 giờ | Export báo cáo lỗi, email không gửi |
| **SEV-4** | Vấn đề nhỏ, có workaround | Ngày làm việc tiếp | UI sai layout, sort không đúng |

---

## 🔴 SEV-1: Toàn bộ hệ thống không hoạt động

### Bước 1 — Xác nhận sự cố (< 5 phút)
```bash
# Kiểm tra nhanh
curl -f https://api.nexus.com/actuator/health || echo "API DOWN"
curl -f https://app.nexus.com || echo "FRONTEND DOWN"

# Kiểm tra containers
ssh root@vps-ip "cd /opt/nexus/source_infra && docker compose ps"
```

### Bước 2 — Alert team
- Ping channel `#incident-prod` ngay lập tức
- Tag: Tech Lead + DevOps Lead + Product Owner
- Format: `[SEV-1] Mô tả ngắn | Phát hiện lúc: HH:MM | Đang điều tra`

### Bước 3 — Triage nhanh
```bash
# Xem logs 5 phút gần nhất
ssh root@vps-ip "cd /opt/nexus/source_infra/vps_deploy && docker compose logs --tail=200 --since=5m"

# Kiểm tra disk
ssh root@vps-ip "df -h"

# Kiểm tra RAM
ssh root@vps-ip "free -h"

# Kiểm tra CPU
ssh root@vps-ip "top -bn1 | head -20"
```

### Bước 4 — Rollback (nếu sự cố sau deploy)
```bash
# Option A: Qua Makefile
ssh root@vps-ip "cd /opt/nexus/source_infra && make rollback"

# Option B: Manually restart với image cũ
ssh root@vps-ip "cd /opt/nexus/source_infra/vps_deploy && \
  docker compose stop backend && \
  docker compose run --rm backend docker tag registry.nexus.com/backend-api:previous registry.nexus.com/backend-api:latest && \
  docker compose up -d backend"
```

### Bước 5 — Post-incident
1. Viết Incident Report trong vòng 24 giờ
2. Update `docs/INCIDENT_LOG.md`
3. Họp post-mortem: Root cause + Action items

---

## 🟠 SEV-2: Thanh toán / Login lỗi

### Login không được
```bash
# Kiểm tra Keycloak
curl -f http://localhost:8180/health/ready || echo "Keycloak DOWN"
ssh root@vps-ip "docker restart nexus_keycloak"

# Kiểm tra JWT config
ssh root@vps-ip "docker exec nexus_backend env | grep JWT"
```

### Thanh toán lỗi
```bash
# Xem payment error logs cụ thể
ssh root@vps-ip "docker logs nexus_backend 2>&1 | grep -i 'payment\|vnpay\|momo' | tail -50"

# Kiểm tra kết nối đến payment gateway
curl -I https://sandbox.vnpayment.vn/paymentv2/Transaction/PaymentV2.asmx
```

---

## 🟡 Database Sự Cố Phổ Biến

Xem thêm: **`source_database/docs/RUNBOOK.md`**

```bash
# Restart DB container (chỉ khi thực sự cần!)
ssh root@vps-ip "docker restart nexus_postgres"

# Backup khẩn cấp trước khi làm gì đó nguy hiểm
ssh root@vps-ip "cd /opt/nexus/source_infra/vps_deploy && ./scripts/cronjob_backup.sh"
```

---

## ✅ Checklist sau khi xử lý xong

- [ ] Verify hệ thống hoạt động bình thường (test API health + login + 1 order)
- [ ] Alert channel `#incident-prod`: "Sự cố đã được khắc phục lúc HH:MM"
- [ ] Ghi log vào `INCIDENT_LOG.md`: Thời gian, nguyên nhân, giải pháp
- [ ] Tạo ticket để fix root cause (không chỉ hotfix triệu chứng)
- [ ] Nếu SEV-1/SEV-2: Lên kế hoạch post-mortem meeting

---

## Contacts

| Role | Liên hệ |
|---|---|
| Tech Lead | Slack: @techlead |
| DevOps Lead | Slack: @devops \| Phone: +84xxx |
| Product Owner | Slack: @po |
| Database DBA | Slack: @dba |
