# 🔄 Deployment Strategies (Chiến lược Triển khai)

> **Category**: CI/CD Pipelines | **Complexity**: Advanced | **Architecture**: Kubernetes / Nginx

---

## 📖 Core Technical Mechanics & Deep-Dive

### Nỗi đau của "Big Bang Deployment" (Triển khai truyền thống)
Cách đây 10 năm, khi update Web: 
1. Treo biển "Bảo trì hệ thống từ 0h đến 2h sáng".
2. Tắt toàn bộ Server cũ.
3. Chép code mới lên. Khởi động lại.
4. Nếu code mới có Bug sập DB? Down luôn nguyên ngày để sửa (Downtime thảm họa).

### Cuộc cách mạng Zero-Downtime
Hôm nay, Facebook hay Shopee update code hàng chục lần một ngày mà bạn không hề hay biết. Đó là nhờ các chiến lược triển khai không gián đoạn. Bản chất của chúng dựa trên khái niệm **Load Balancer (Bộ cân bằng tải)** đứng trước, âm thầm thay đổi luồng giao thông (Traffic Routing) xuống các máy chủ phía dưới.

1. **Rolling Update (Triển khai cuốn chiếu)**: Khởi động 1 Server mới -> Tắt 1 Server cũ -> Khởi động 1 Server mới -> Tắt 1 Server cũ. (Thích hợp cho cụm nhiều node, mặc định của Kubernetes).
2. **Blue/Green Deployment (Triển khai Xanh/Đỏ)**: Dựng sẵn toàn bộ hệ thống Mới (Green) chạy song song với hệ thống Cũ (Blue). Khi Green đã test kỹ, gạt cầu dao (Load Balancer) phát một chuyển 100% traffic sang Green.
3. **Canary Release (Triển khai chim Yến)**: Đẩy code mới lên 1 Server duy nhất, và chỉ lái 5% lượng user thực tế (hoặc chỉ nhân viên công ty) vào Server đó. Nếu 5% user này không chửi thề (không có lỗi 500 HTTP), tăng dần lên 20%, 50%, 100%.

---

## 🌐 Real-World GitHub Patterns & Industry Reference

- **[argoproj/argo-rollouts](https://github.com/argoproj/argo-rollouts)** — Controller nâng cao cho Kubernetes để quản lý Blue-Green và Canary.
- **[flagger/flagger](https://github.com/fluxcd/flagger)** — Tự động hóa Canary dựa trên Metrics (Tự Rollback nếu thấy Prometheus báo lỗi).

---

## 📐 System Design Blueprint & Setup Guide

### 1. Rolling Update (Chuẩn mực mặc định của K8s và Docker Swarm)

Giả sử bạn có 3 Pods (Containers) đang chạy App v1.
- K8s khởi động Pod 4 (App v2). Đợi Pod 4 báo `Ready` (Sẵn sàng phục vụ).
- K8s giết Pod 1 (App v1).
- K8s khởi động Pod 5 (App v2). Đợi `Ready`.
- K8s giết Pod 2.
- Cứ thế cuốn chiếu. Luôn luôn có 3 Pod phục vụ khách hàng!

**Cấu hình trong Kubernetes (Deployment.yaml)**:
```yaml
apiVersion: apps/v1
kind: Deployment
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      # Số Pod mới tối đa được phép tạo VƯỢT QUÁ số replicas lúc deploy
      maxSurge: 1       
      # Số Pod tối đa được phép CHẾT trong lúc deploy (Tuyệt đối không để 100%!)
      maxUnavailable: 0 
```

### 2. Blue-Green Deployment (Cho VPS dùng Nginx)

Rất phù hợp nếu bạn chỉ dùng 1 con VPS to và chạy Docker Compose.

1. **Trạng thái ban đầu**:
   - `App-Blue` (Port 8081) đang chạy Image v1.
   - Nginx Upstream trỏ 100% traffic vào `127.0.0.1:8081`.

2. **Bước Deploy**:
   - Chạy `docker compose up -d app-green` (Port 8082, Image v2).
   - DevOps tự test thử `curl localhost:8082` thấy ổn.

3. **Bước Cắt Switch (Gạt cầu dao)**:
   - Sửa file `nginx.conf`: Đổi upstream trỏ sang `127.0.0.1:8082`.
   - Chạy lệnh `nginx -s reload` (Reload Nginx không rớt mạng, mất 0.1s).
   - `App-Green` chính thức lên sóng.
   - Xóa (Kill) `App-Blue`.

### 3. Canary Release (Sử dụng Nginx Ingress trên K8s)

Chỉ lái 10% traffic vào phiên bản V2 (Phiên bản Canary - Chuột bạch).

**K8s Ingress (Canary):**
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: app-ingress-canary
  annotations:
    # Báo cho Nginx Ingress biết đây là cấu hình phân luồng Canary
    nginx.ingress.kubernetes.io/canary: "true"
    # Lái đúng 10% traffic ngẫu nhiên vào đây
    nginx.ingress.kubernetes.io/canary-weight: "10"
spec:
  rules:
  - host: api.mycompany.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: backend-v2-service
            port:
              number: 80
```
*Sau 1 ngày theo dõi Grafana thấy V2 không có lỗi 5xx, sửa số `10` thành `100`, kết thúc quá trình Canary.*

---

## ⚡ Best Practices & Anti-Patterns

### ✅ Best Practices
1. **Liveness & Readiness Probes**: Mọi chiến lược Deploy (Kể cả Rolling, Canary) sẽ THẤT BẠI THẢM HẠI nếu K8s/Nginx không biết cái App Java đó ĐÃ SẴN SÀNG chưa! Spring Boot mất 10s để khởi động. Nếu vừa bật Container lên mà Nginx dội traffic vào ngay -> Lỗi 502 Bad Gateway. Bắt buộc phải có `/actuator/health/readiness` (Xem bài sau).
2. **Backward Compatible Database (Tương thích ngược CSDL)**: Trong lúc Rolling Update hoặc Blue-Green, có 1 khoảng thời gian 2 phút mà BẢN CŨ và BẢN MỚI CÙNG CHẠY và CÙNG GHI vào 1 DB. Nếu bản MỚI tự ý `RENAME COLUMN` hoặc Xóa cột -> Bản CŨ sẽ chết ngay lập tức (Crash toàn hệ thống). **Luôn làm Database Migration theo phương pháp Zero-Downtime (Đã đề cập ở phần Database)**.

### ❌ Anti-Patterns

| Anti-Pattern | Problem | Fix |
|-------------|---------|-----|
| Chọn Blue-Green Deployment cho hệ thống có Database quá lớn (Stateful) | Blue-Green hoàn hảo cho Stateless App (Chỉ xử lý logic). Nhưng nếu App V2 đổi cấu trúc DB, và bạn gạt cầu dao sang V2. Khi V2 bị lỗi, bạn gạt cầu dao về V1 (Rollback). Lúc này DB đã mang Data cấu trúc mới, App V1 không đọc được! Vỡ trận. | Phải dùng kỹ thuật **Expand-and-Contract (Mở rộng và Thu hẹp)** ở tầng DB trước khi Deploy App (xem tài liệu Migration). |
| Dùng `maxUnavailable: 100%` trong Rolling Update K8s | Đây thực chất là hành động Big Bang Deploy: Giết sạch Pod cũ rồi mới khởi động Pod mới. Downtime 100% trong 10-20 giây. | Luôn để `maxUnavailable: 0` hoặc tối đa 25%. `maxSurge: 1` hoặc 25%. K8s sẽ tạo thêm máy chủ tạm thời để gánh tải. |
| Test Canary bằng mắt | Dẫn 5% traffic vào V2 xong Dev rảnh rỗi lên ngó màn hình xem có lỗi không. Nếu đang ngủ đêm thì sao? | Dùng Argo Rollouts hoặc Flagger để **Tự động hóa Canary**. Nếu Error Rate > 2%, nó tự động kill V2 và khôi phục V1 trong 1 giây mà không cần con người can thiệp. |
