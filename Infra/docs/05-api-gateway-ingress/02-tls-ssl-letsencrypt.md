# 🔐 TLS/SSL & Tự động Cấp Phát Chứng Chỉ (Let's Encrypt)

> **Category**: API Gateway & Ingress | **Complexity**: Intermediate | **Cert-Manager** / **Let's Encrypt**

---

## 📖 Core Technical Mechanics & Deep-Dive

### Thời kỳ Đồ đá của Chứng chỉ SSL
Cách đây vài năm, để Web có ổ khóa xanh (HTTPS), DevOps phải:
1. Trả tiền mua Chứng chỉ (SSL Certificate) cho Godaddy, Sectigo... (50$/năm).
2. Tải 2 file `cert.pem` và `key.pem` về máy.
3. SSH lên Server, copy vào thư mục Nginx, khởi động lại Nginx.
4. Tới năm sau, chứng chỉ hết hạn. DevOps quên không gia hạn. **Website sập toàn tập vào đúng ngày mùng 1 Tết!** 

### Cuộc cách mạng Let's Encrypt & Cert-Manager
Let's Encrypt là một tổ chức phi lợi nhuận cung cấp chứng chỉ SSL **Hoàn toàn miễn phí** và được tin tưởng bởi 100% trình duyệt.
**Nhược điểm duy nhất**: Nó chỉ có hạn dùng 90 ngày. Cứ 3 tháng bạn phải gia hạn 1 lần.
**Giải pháp**: Tự động hóa 100%. 
- **Trên VPS thường**: Dùng `certbot` (một cái Cronjob chạy ngầm, tự xin SSL mới rồi tự reload Nginx).
- **Trên Kubernetes**: Dùng `cert-manager`. Một controller của K8s chuyên lo việc xin SSL từ Let's Encrypt, tự động lưu vào K8s Secret, và cấp cho Nginx Ingress. DevOps không bao giờ phải quan tâm đến SSL nữa!

---

## 🌐 Real-World GitHub Patterns & Industry Reference

- **[cert-manager/cert-manager](https://github.com/cert-manager/cert-manager)** — Tiêu chuẩn vàng để quản lý TLS trên Kubernetes.
- **[certbot/certbot](https://github.com/certbot/certbot)** — Tool của EFF để tự động xin SSL cho VPS truyền thống.

---

## 📐 System Design Blueprint & Setup Guide

### 1. Cấp SSL Tự động trên VPS truyền thống (Nginx + Certbot)

Giả sử bạn đã cấu hình xong tên miền `api.mycompany.com` trỏ về IP của VPS và Nginx đang chạy HTTP (port 80).

```bash
# Cài đặt Certbot và plugin cho Nginx
sudo apt update
sudo apt install certbot python3-certbot-nginx -y

# Chạy lệnh xin SSL tự động (Certbot sẽ tự động đọc file nginx.conf của bạn 
# và sửa nó để thêm luồng HTTPS port 443 vào).
sudo certbot --nginx -d api.mycompany.com

# Kiểm tra xem Cronjob gia hạn tự động đã được cài đặt chưa (Certbot tự làm)
sudo systemctl status certbot.timer
```
*Vậy là xong, Web đã có HTTPS vĩnh viễn không bao giờ hết hạn (miễn là VPS còn chạy).*

### 2. Cấp SSL Tự động trên Kubernetes (Cert-Manager)

Trên K8s, mọi thứ phải cấu hình qua Manifest YAML.

**Bước 1: Cài đặt Cert-Manager** (Dùng Helm hoặc kubectl apply)
**Bước 2: Tạo Issuer (Người cấp chứng chỉ)**
Khai báo với K8s rằng tôi muốn xin SSL từ ai (Ở đây là Let's Encrypt).

```yaml
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    # Server API của Let's Encrypt
    server: https://acme-v02.api.letsencrypt.org/directory
    email: admin@mycompany.com # Email để nhận thông báo nếu SSL sắp hết hạn
    privateKeySecretRef:
      name: letsencrypt-prod-account-key
    solvers:
    - http01:
        ingress:
          class: nginx
```

**Bước 3: Gắn SSL vào Nginx Ingress**

Thêm một vài dòng `tls` và `annotations` vào file Ingress cũ của bạn.

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: main-api-ingress
  annotations:
    # Báo cho cert-manager biết: "Ê, cấp cho tôi chứng chỉ qua cái Issuer này"
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
    # Tự động ép tất cả HTTP redirect sang HTTPS
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
spec:
  tls:
  - hosts:
    - api.mycompany.com
    # Tên của K8s Secret nơi chứa 2 file cert và key (Cert-manager tự tạo Secret này)
    secretName: api-mycompany-tls-secret
  rules:
  - host: api.mycompany.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend: ... (như cũ)
```

---

## 🧪 Quá trình xin SSL (ACME HTTP-01 Challenge) diễn ra thế nào?

Khi bạn apply Ingress trên:
1. Cert-Manager gửi request lên Let's Encrypt: *"Cấp cho tôi SSL cho api.mycompany.com"*.
2. Let's Encrypt bảo: *"Anh phải chứng minh anh là chủ của tên miền đó. Hãy tạo 1 file ở đường dẫn `http://api.mycompany.com/.well-known/acme-challenge/abcxyz` chứa mã bí mật này"*.
3. Cert-Manager ngay lập tức sinh ra 1 cái Pod tạm thời và cấu hình Nginx Ingress để phản hồi đúng đường dẫn đó.
4. Let's Encrypt ping tới domain của bạn, thấy đúng mã số. Nó tin bạn là chủ sở hữu, nó trả file Cert về.
5. Cert-Manager lưu file Cert vào `Secret`, Nginx Ingress nạp Secret đó lên. Xong! (Toàn bộ quá trình tốn 10 giây).

---

## ⚡ Best Practices & Anti-Patterns

### ✅ Best Practices
1. **Dùng Staging Issuer để test trước**: Let's Encrypt có Rate Limit (Chỉ cho phép xin lỗi sai tối đa 5 lần/giờ). Nếu bạn config sai mà cứ cố xin liên tục, IP VPS của bạn sẽ bị block nguyên 1 tuần. Khi set up K8s mới, HÃY DÙNG `https://acme-staging-v02.api.letsencrypt.org/directory` để test thử. Test thành công mới chuyển qua Prod.
2. **DNS-01 Challenge cho Mạng nội bộ**: Challenge HTTP-01 yêu cầu Ingress của bạn phải Public ra Internet để Let's Encrypt gọi vào. Nếu bạn làm cho Ngân hàng (Mạng Private hoàn toàn), phải dùng **DNS-01 Challenge**. Cert-Manager sẽ không cần nhận HTTP, mà nó sẽ gọi API lên Cloudflare/Route53 để tạo một bản ghi DNS TXT chứng minh quyền sở hữu.

### ❌ Anti-Patterns

| Anti-Pattern | Problem | Fix |
|-------------|---------|-----|
| Khởi động Spring Boot bằng HTTPS port 8443 (Gắn file JKS vào java) | Rất phiền phức. Đổi SSL phải build lại Image hoặc mount file cực khổ. SSL Termination tốn CPU của Java (Đáng lẽ CPU đó dùng để xử lý Business Logic). | **Đừng bao giờ bật HTTPS trên Spring Boot trong môi trường Cloud.** Để Nginx/Ingress lo HTTPS. Từ Ingress chọc vào Pod Java chỉ dùng HTTP port 8080. |
| Mua chứng chỉ SSL Wildcard đắt tiền rồi add bằng tay vào K8s Secret | Mỗi khi thêm 1 subdomain mới phải chờ Sysadmin add thủ công. Lỗi con người (human error) làm rò rỉ file Wildcard key ra ngoài thì mất trắng nguyên cả công ty. | Chuyển sang Cert-Manager quản lý vòng đời tự động. Vừa miễn phí vừa không cần sự can thiệp của con người. |
