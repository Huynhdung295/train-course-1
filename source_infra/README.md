# 🌟 NEXUS INFRASTRUCTURE & DEVOPS REPOSITORY

Chào mừng bạn đến với Repository trung tâm quản lý toàn bộ Hạ tầng, CI/CD, và Môi trường vận hành của dự án Nexus POS & ERP.

## 📂 Cấu trúc Repository

Mọi thư mục trong này đều được tổ chức theo tiêu chuẩn Infrastructure as Code (IaC):

1. **`plan_project.md`**
   - Bản thiết kế kiến trúc hạ tầng siêu chi tiết (> 1400 dòng). Đọc cái này để hiểu rõ Topology, Auto-Scaling, và Observability của toàn hệ thống.

2. **`vps_deploy/`**
   - Bộ cấu hình dùng để triển khai lên môi trường VPS (Virtual Private Server) thật. 
   - Có sẵn kịch bản `setup-vps.sh` cài Docker, Nginx, SSL tự động.
   - Quản lý toàn bộ 5 dịch vụ (PostgreSQL, Kafka, Redis, FE, BE) bằng `docker-compose.yml`.

3. **`developer_guides/`**
   - Kho "Vũ khí" (Boilerplates) dành cho các Team Dev (Frontend, Backend).
   - Trong này chứa các file cấu hình CI/CD Pipeline (Gitlab-CI, GitHub Actions), `Dockerfile` đa bước, và các file `docker-compose.local.yml`. 
   - Team Dev chỉ việc lấy code này ném vào repo của họ là ứng dụng tự động ăn khớp với luồng Pipeline của Hạ tầng.

4. **`docs/`**
   - Hướng dẫn step-by-step để build image và upgrade Helm Chart nếu hệ thống sau này nâng cấp lên Kubernetes.

---
**Quy tắc vận hành:** Tuyệt đối không lưu mật khẩu thật (Database Password, API Keys) vào repo này. Mật khẩu phải được truyền qua file `.env` trên Server hoặc Secret Manager.
