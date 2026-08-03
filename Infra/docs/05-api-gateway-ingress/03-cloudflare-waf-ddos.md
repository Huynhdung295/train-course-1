# 🛡️ Cloudflare Proxy, WAF & Chống DDoS

> **Category**: API Gateway & Ingress | **Complexity**: Intermediate | **Cloudflare**

---

## 📖 Core Technical Mechanics & Deep-Dive

### Bài toán: Sập Web vì Botnet
Bạn vừa thiết lập xong Nginx Ingress trên K8s và mua một tên miền `mycompany.com` trỏ DNS thẳng về IP của K8s Cluster (`1.2.3.4`).
- Một hacker rảnh rỗi quét thấy IP `1.2.3.4` của bạn đang mở port 80/443.
- Hacker thuê một mạng Botnet (50.000 thiết bị IoT/Camera bị nhiễm mã độc trên toàn thế giới), đồng loạt bắn gói tin UDP rác (UDP Flood) hoặc gửi liên tục HTTP GET `/api/v1/search` (Layer 7 DDoS) vào IP `1.2.3.4`.
- Máy chủ của bạn băng thông bị nghẽn (Cáp mạng 1Gbps bị nghẽn toàn bộ). Server sập. Khách hàng thật không thể vào được.
- Rate Limit của Nginx (giới hạn request) vô dụng trong trường hợp UDP Flood vì gói tin làm nghẽn từ ngoài Card mạng vật lý.

### Giải pháp: Đứng sau cái ô khổng lồ (Cloudflare)
Cloudflare là hệ thống Proxy lớn nhất thế giới.
Thay vì trỏ Tên miền thẳng về IP gốc (Origin IP), bạn cấu hình Tên miền trỏ về IP của Cloudflare (Đám mây màu cam bọc DNS).
Khách hàng -> (Gặp Cloudflare) -> (Cloudflare dọn rác, lọc traffic) -> (Cloudflare gọi về IP gốc của bạn).

1. **Chống DDoS Layer 3/4**: Cloudflare có băng thông tổng lên tới hàng trăm Tbps. Vài đợt UDP Flood không bằng cái hắt hơi của họ. Băng thông bẩn bị rớt hết ở biên giới quốc gia của Cloudflare, không bao giờ tới được cáp mạng VPS của bạn.
2. **WAF (Web Application Firewall)**: Lọc các cuộc gọi HTTP dính mã độc (SQL Injection, XSS) trước cả khi chạm vào Nginx của bạn.

---

## 🌐 Real-World Industry Reference

- **[Cloudflare DDoS Protection](https://www.cloudflare.com/ddos/)** — Hệ thống chặn DDoS không độ trễ.
- **[Cloudflare WAF](https://www.cloudflare.com/waf/)** — Tường lửa ứng dụng web.

---

## 📐 System Design Blueprint & Setup Guide

### 1. Bật Proxy (Đám mây màu cam) trên Cloudflare

1. Vào Dashboard Cloudflare, phần DNS.
2. Tại bản ghi `A` của `api.mycompany.com`, bật trạng thái Proxy status từ **DNS only (màu xám)** sang **Proxied (màu cam)**.
3. IP gốc của bạn (`1.2.3.4`) sẽ bị ẩn khỏi mọi công cụ tra cứu DNS (`nslookup` sẽ ra IP của Cloudflare).

### 2. Thiết lập WAF (Firewall Rules) cơ bản

Vào phần **Security > WAF > Custom rules**, tạo các luật (Rule) chống hack:

- **Rule 1: Block Bad Bots (Chặn Bot tự động)**
  - Field: `Known Bots`
  - Operator: `equals`
  - Value: `Off` (Hoặc dùng tính năng Bot Fight Mode có sẵn).
- **Rule 2: Restrict Admin Panel (Chặn người ngoài vào trang quản trị)**
  - Kịch bản: Bạn có API `/api/admin/login`. Bạn chỉ muốn IP của Công ty (VD: `103.55.x.x`) mới được gọi.
  - Field: `URI Path` -> `starts with` -> `/api/admin`
  - AND: `IP Source Address` -> `is not` -> `103.55.x.x`
  - Action: **Block**.
- **Rule 3: Rate Limiting chống cào dữ liệu (Scraping)**
  - Action: **Managed Challenge (Bắt giải CAPTCHA)** nếu một IP gửi quá 100 requests / phút vào trang Xem Sản Phẩm.

### 3. Bảo mật IP Gốc (CỰC KỲ QUAN TRỌNG)

Bật đám mây màu cam là chưa đủ. Vì IP gốc `1.2.3.4` của bạn đã từng công khai, hacker vẫn lưu IP đó. Họ sẽ bỏ qua Cloudflare và bắn thẳng DDoS vào IP `1.2.3.4`. 

**Nhiệm vụ của bạn**: Phải thiết lập Firewall (UFW) trên VPS gốc để **Chỉ cho phép duy nhất dải IP của Cloudflare được kết nối vào port 80/443 của bạn. Chặn toàn bộ thế giới còn lại!**

*Script cấu hình UFW dành riêng cho Cloudflare:*
```bash
# Xóa bỏ các rule cho phép 80/443 public cũ
sudo ufw delete allow 80/tcp
sudo ufw delete allow 443/tcp

# Lấy dải IP thật của Cloudflare từ API
curl -s https://www.cloudflare.com/ips-v4 -o /tmp/cf_ips

# Thêm từng dải IP vào UFW
for ip in $(cat /tmp/cf_ips); do sudo ufw allow from $ip to any port 80,443 proto tcp; done

sudo ufw reload
```

---

## ⚡ Best Practices & Anti-Patterns

### ✅ Best Practices
1. **Dùng Authenticated Origin Pulls (AOP)**: Thiết lập UFW như trên vẫn có 1 rủi ro nhỏ: Hacker cũng dùng Cloudflare, họ trỏ tên miền rác của họ qua Cloudflare rồi gọi vào IP của bạn. UFW của bạn thấy IP đến từ Cloudflare nên mở cửa! Hãy bật tính năng AOP (Yêu cầu Cloudflare cung cấp chứng chỉ client TLS). Nginx của bạn chỉ mở cửa nếu Cloudflare xòe ra đúng cái chìa khóa mộc đó.
2. **Luật "Under Attack Mode"**: Khi bạn nhận được tin nhắn hệ thống đang bị DDoS cực mạnh ở Layer 7 (bất thường). Đừng hốt hoảng, lên app điện thoại Cloudflare, gạt nút "I'm Under Attack". Ngay lập tức mọi khách hàng vào web sẽ bị trì hoãn 5 giây để máy học của CF kiểm tra trình duyệt ảo. Hệ thống của bạn sẽ được cứu ngay lập tức.

### ❌ Anti-Patterns

| Anti-Pattern | Problem | Fix |
|-------------|---------|-----|
| Mở proxy (đám mây cam) cho cổng SSH hoặc Database | SSH (Port 22) hoặc Postgres (Port 5432) bị lỗi không truy cập được nữa. | Cloudflare Proxy MẶC ĐỊNH chỉ proxy traffic HTTP/HTTPS (Port 80/443...). Nó KHÔNG proxy TCP traffic thuần. Đừng bao giờ bật mây cam cho cái Subdomain dùng để SSH. (Trừ phi bạn xài Cloudflare Zero Trust / Tunnels). |
| Mất IP thật của khách hàng trong Spring Boot | Spring Boot nhận request từ Cloudflare, nên cái IP được lưu toàn là IP của server Cloudflare (Ví dụ 104.21.x.x), làm hỏng bộ check gian lận của cty. | Đọc IP từ Header `CF-Connecting-IP` thay vì `X-Forwarded-For`. CF luôn gài IP thật của khách vào Header này. |
| Bật mây cam cho API upload File (S3) | Giới hạn upload của bản Free CF là 100MB. File to hơn sẽ bị cắt ngang (Error 413). | Tách luồng Upload ra một domain khác (Ví dụ `upload.mycompany.com`) và tắt mây cam đi (báo màu xám), hoặc dùng Pre-signed URL đẩy thẳng lên AWS S3. |
