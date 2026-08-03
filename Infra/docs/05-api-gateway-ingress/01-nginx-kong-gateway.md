# 🚪 API Gateway & Ingress (Nginx / Kong)

> **Category**: API Gateway & Ingress | **Complexity**: Intermediate | **Nginx** / **Kong API Gateway**

---

## 📖 Core Technical Mechanics & Deep-Dive

### Bài toán của Microservices (Không có cổng bảo vệ)
Khi bạn có 10 Microservices (Order, User, Inventory...), nếu không có Cổng (Gateway):
1. **Frontend khốn khổ**: Phải nhớ 10 cái IP hoặc Domain khác nhau để gọi API. Lỡ Service đổi IP, Frontend tạch.
2. **Bảo mật thủng lỗ chỗ**: Hacker gọi thẳng vào IP của Service Inventory và thoải mái dò API.
3. **Mã hóa SSL/TLS mệt mỏi**: Mỗi Service phải tự ôm 1 cái Certificate chứng chỉ số SSL, tự cấu hình HTTPS.

### Giải pháp: Reverse Proxy & API Gateway
Xây dựng một "Trạm thu phí" (Reverse Proxy) duy nhất đứng ở biên giới mạng (Edge). Tất cả khách hàng (Frontend, Mobile) đều phải đi qua Trạm này.
Trạm này nhận mọi cuộc gọi HTTP/HTTPS, sau đó kiểm tra vé (Authentication), kiểm tra tốc độ (Rate Limiting), rồi mới lái xe (Routing) vào Service tương ứng ở mạng nội bộ.

1. **Nginx / Nginx Ingress**: Tuyệt vời cho Reverse Proxy cơ bản, Load Balancing.
2. **Kong / Apache APISIX**: Các API Gateway thế hệ mới (dựa trên Nginx/OpenResty). Có thể cài Plugin dễ dàng (Ví dụ: Plugin check JWT Token, Plugin giới hạn 100 request/phút, Plugin thu thập Metrics).

---

## 🌐 Real-World GitHub Patterns & Industry Reference

- **[kubernetes/ingress-nginx](https://github.com/kubernetes/ingress-nginx)** — Ingress Controller phổ biến nhất trong thế giới K8s.
- **[Kong/kong](https://github.com/Kong/kong)** — The Cloud-Native API Gateway (Cực mạnh cho Microservices).

---

## 📐 System Design Blueprint & Setup Guide

### 1. Cấu hình Nginx cơ bản (VPS Baremetal / Docker Compose)

Tạo file `nginx.conf`:

```nginx
# Cấu hình Cân bằng tải (Load Balancing) cho Backend
upstream backend_cluster {
    # Thuật toán mặc định là Round Robin (Xoay vòng đều)
    # Có thể đổi thành 'ip_hash' (Dính session) hoặc 'least_conn'
    server 127.0.0.1:8081; 
    server 127.0.0.1:8082;
}

server {
    listen 80;
    server_name api.mycompany.com;

    # 1. Bảo mật: Ẩn version Nginx 
    server_tokens off;

    # 2. Điều hướng (Routing) API
    location /api/v1/orders {
        # Chuyển traffic vào cụm backend
        proxy_pass http://backend_cluster;
        
        # Chuyển tiếp các thông tin gốc của Khách hàng (IP thật) cho Spring Boot biết
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_addrs;
        
        # Tùy chỉnh Timeout (Tránh bị Nginx cắt ngang khi API chạy lâu)
        proxy_connect_timeout 5s;
        proxy_read_timeout 30s;
    }
}
```

### 2. Cấu hình Nginx Ingress (Môi trường Kubernetes)

Thay vì viết file `.conf`, trên K8s bạn khai báo một Manifest YAML. Nginx Ingress Controller sẽ tự động dịch nó thành `nginx.conf` bên trong Pod của nó.

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: main-api-ingress
  annotations:
    # Rewrite URL: /api/v1/users/(.*) -> /$1
    # Khách gọi /api/v1/users/123 -> Spring Boot nhận được /123
    nginx.ingress.kubernetes.io/rewrite-target: /$2
    
    # Kích hoạt Rate Limiting (Giới hạn tốc độ) ngay tại biên giới K8s
    # Chặn đứng DDoS ở tầng Ingress, không cho lọt vào App Java!
    nginx.ingress.kubernetes.io/limit-rps: "10" # Max 10 request/giây trên 1 IP
    nginx.ingress.kubernetes.io/limit-burst-multiplier: "2"
spec:
  rules:
  - host: api.mycompany.com
    http:
      paths:
      - path: /api/v1/users(/|$)(.*)
        pathType: Prefix
        backend:
          service:
            name: user-service
            port:
              number: 8080
```

### 3. Khi nào cần nâng cấp lên Kong API Gateway?
Nginx Ingress giải quyết bài toán Routing và Load Balancing. Nhưng nếu bạn cần:
- Authentication tập trung (Check JWT token ở biên giới, nếu token hết hạn chặn luôn, Spring Boot không cần phải chạy thư viện JWT nữa).
- Định tuyến động (Thêm/xóa Service không cần reload file config).
- Tích hợp với Keycloak (OIDC/OAuth2).
-> Lúc này, hãy thay Ingress Nginx bằng **Kong Ingress Controller**. (Cấu hình qua Custom Resource Definitions - CRDs của K8s).

---

## ⚡ Best Practices & Anti-Patterns

### ✅ Best Practices
1. **Truyền đúng IP của khách hàng**: App Spring Boot của bạn có chức năng "Lưu log IP người mua hàng". Nhưng khi lấy `request.getRemoteAddr()`, toàn ra IP `127.0.0.1` hoặc IP cục bộ `10.x.x.x` của Nginx! 
   -> Hãy đảm bảo Nginx có `proxy_set_header X-Forwarded-For` và bật cấu hình `server.forward-headers-strategy=framework` trong `application.yml` của Spring Boot.
2. **Terminate SSL ở Gateway**: Không bao giờ cấu hình file SSL/TLS (HTTPS) bên trong Spring Boot (Tomcat). SSL rất tốn CPU để giải mã. Hãy để Nginx xử lý việc giải mã HTTPS thành HTTP (SSL Termination). Từ Nginx đi vào Spring Boot chỉ dùng HTTP nội bộ (Clear text). Tốc độ sẽ tăng gấp bội!

### ❌ Anti-Patterns

| Anti-Pattern | Problem | Fix |
|-------------|---------|-----|
| Mở cổng Spring Boot (8080) ra Internet song song với Nginx (80) | Dùng Nginx nhưng lại hớ hênh để lộ cổng 8080 của Docker. Khách hàng lách qua cổng 8080, né được toàn bộ luật giới hạn tốc độ (Rate Limit) và bảo mật của Nginx. | Đóng chặt cổng 8080 bằng tường lửa UFW (hoặc chỉ bind docker port vào `127.0.0.1:8080`). Chỉ duy nhất Nginx được nói chuyện với App. |
| Để Timeout mặc định của Nginx là 60s | Một API Xuất báo cáo Excel chạy mất 90s. Web load đến giây 61 thì Nginx cắt bụp cái rụp văng lỗi `504 Gateway Timeout`. Kêu Oai Oái. | Tìm API nào chạy lâu, tách riêng `location` đó trong Nginx và tăng `proxy_read_timeout 120s`. Tốt hơn nữa: Đổi luồng Xuất Excel thành Bất đồng bộ (Async Kafka) trả về link tải sau. |
| Lưu Log ở Ingress nhưng không có RequestID (TraceID) | Web lỗi 500, nhưng hệ thống có 100 API. Làm sao biết dòng log Nginx này khớp với dòng Exception nào trong file log của Java? | Nginx phải tự sinh ra `$request_id` (TraceID) và đính vào Header truyền xuống Java. Java nhét ID đó vào Slf4j MDC để in log. Trace lỗi siêu tốc. |
