# ☁️ Infrastructure & DevOps Master Checklist

> **Mục tiêu**: Đây là trung tâm tri thức tối cao (Knowledge Base) về toàn bộ Vận hành (Operations), CI/CD, Containerization, và Hạ tầng (Infrastructure) chuẩn Enterprise. Mọi kỹ sư DevOps, Backend, và AI Agents phải tuân thủ nghiêm ngặt các cấu trúc này khi deploy hệ thống lên Production.

---

## 📑 MỤC LỤC & TIẾN ĐỘ TÀI LIỆU

### 01. 🛡️ VPS & Baremetal Provisioning (Nền tảng OS)
- [ ] `01-os-hardening-firewall.md`: Bảo mật SSH (Key-based, đổi port), cấu hình UFW Firewall, chống Brute-force với Fail2Ban.
- [ ] `02-java-jvm-tuning-vps.md`: Tối ưu JVM trên môi trường giới hạn RAM (Container/VPS), chọn đúng Garbage Collector (ZGC, G1GC), xử lý OOM Killer.
- [ ] `03-systemd-vs-docker.md`: Phân tích ưu/nhược điểm khi chạy trực tiếp file `.jar` bằng Systemd so với Docker Container.

### 02. 🐳 Docker Containerization (Đóng gói Ứng dụng)
- [ ] `01-spring-boot-dockerfile.md`: Viết Dockerfile chuẩn: Multi-stage build, trích xuất lớp (Layered Jars), CDS (Class Data Sharing), và Rootless Security.
- [ ] `02-graalvm-native-image.md`: Biến ứng dụng Spring Boot thành file nhị phân (Native Executable) khởi động trong vài mili-giây với GraalVM.
- [ ] `03-docker-compose-environments.md`: Quản lý `compose.yml` cho nhiều môi trường (Dev, Staging, Prod) thông qua override files.

### 03. 🚀 CI/CD Pipelines (Tự động hóa Tích hợp & Triển khai)
- [ ] `01-github-actions-gitlab-ci.md`: Thiết kế Pipeline tự động Build, Test, Cache Maven dependencies, và Build Docker Image.
- [ ] `02-security-scanning-trivy.md`: Tích hợp SonarQube (Static Code Analysis) và Trivy (Quét lỗ hổng Container) vào Pipeline.
- [ ] `03-deployment-strategies.md`: Các chiến lược triển khai không gián đoạn: Blue-Green Deployment, Canary Release, Rolling Update.

### 04. ☸️ Kubernetes Orchestration (Quản lý Cụm)
- [ ] `01-k8s-spring-boot-helm.md`: Đóng gói ứng dụng Spring Boot thành Helm Chart để deploy nhất quán qua nhiều môi trường.
- [ ] `02-probes-graceful-shutdown.md`: Thiết lập Liveness/Readiness Probes (tích hợp Spring Actuator) và xử lý SIGTERM (Graceful Shutdown).
- [ ] `03-resource-limits-qos.md`: Định nghĩa Requests/Limits chuẩn xác, Quality of Service (QoS), tránh bị K8s Evict pod vô cớ.
- [ ] `04-secrets-management.md`: Xử lý dữ liệu nhạy cảm (Passwords/Tokens) với HashiCorp Vault hoặc SealedSecrets, tuyệt đối không dùng ConfigMap dạng Base64 thô.

### 05. 🌐 API Gateway, Ingress & WAF (Cửa ngõ Hệ thống)
- [ ] `01-nginx-kong-gateway.md`: Thiết lập Load Balancer, SSL Termination, và API Gateway (Kong/Nginx) ở biên mạng (Edge).
- [ ] `02-tls-ssl-letsencrypt.md`: Tự động cấp phát và gia hạn chứng chỉ HTTPS miễn phí với Cert-Manager (Let's Encrypt).
- [ ] `03-cloudflare-waf-ddos.md`: Cấu hình DNS, Proxy, Web Application Firewall (WAF) và chống DDoS bằng Cloudflare.

### 06. 👁️ Infrastructure Observability (Giám sát Hạ tầng)
- [ ] `01-node-exporter-cadvisor.md`: Giám sát tài nguyên phần cứng (CPU/RAM/Disk) của Host OS và Container bằng Node Exporter + cAdvisor (Prometheus).
- [ ] `02-centralized-logging-loki.md`: Thu thập toàn bộ log phân tán từ nhiều VPS/Pods bằng Promtail đẩy về kho chứa tập trung Grafana Loki.
- [ ] `03-alerting-pagerduty.md`: Thiết lập Alertmanager: Cấu hình rule cảnh báo khi CPU quá tải, Disk sắp đầy, hoặc Pod crash loop, tự động gọi điện cho Dev/Ops (PagerDuty).

---

## 🎯 QUY TẮC TỐI THƯỢNG (GOLDEN RULES) DÀNH CHO AI & DEVOPS
1. **Infrastructure as Code (IaC)**: Không bao giờ SSH vào server để click, gõ lệnh bằng tay hay cài đặt thủ công. Mọi thứ phải được định nghĩa bằng Code (Dockerfile, Compose, Helm, Terraform) và push lên Git!
2. **Immutable Infrastructure**: Đừng bao giờ chui vào Container đang chạy để `apt-get install` hay update file config. Nếu có thay đổi, phải sửa file cấu trúc và Build lại Image mới hoàn toàn.
3. **Mọi Container đều là Disposable (Dùng một lần)**: Ứng dụng phải được thiết kế dạng Stateless (Phi trạng thái). Container có thể bị sập, xóa, khởi động lại bất kỳ lúc nào mà không làm mất dữ liệu người dùng (Dữ liệu phải lưu ở Database/S3).
4. **Không bao giờ push Secret lên Git**: Mọi thông tin nhạy cảm phải lấy từ Environment Variables lúc Runtime.
