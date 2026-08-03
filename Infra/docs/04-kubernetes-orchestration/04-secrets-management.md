# 🔑 Quản lý Bí mật (Secrets Management) chuẩn Enterprise

> **Category**: Kubernetes Orchestration | **Complexity**: Advanced | **Vault / SealedSecrets**

---

## 📖 Core Technical Mechanics & Deep-Dive

### Kubernetes Secret nguyên bản là một "Trò hề"
Nếu bạn học K8s cơ bản, ai cũng bảo bạn: *"Đừng lưu password Database vào ConfigMap, hãy lưu vào Kubernetes Secret"*.
Nghe chữ "Secret" có vẻ rất bảo mật. Nhưng sự thật là: Kubernetes Secret mặc định KHÔNG HỀ ĐƯỢC MÁH HOÁ (Encryption). Nó chỉ là một chuỗi văn bản được mã hoá Base64!
Bất kỳ ai (DevOps, Cấp trên, hay Hacker) đọc được file YAML đó, hoặc chọc được vào API của K8s, chỉ cần chạy lệnh `echo "bXlwYXNzd29yZA==" | base64 -d` là lấy được mật khẩu rõ ràng (Plain Text).

### Bài toán GitOps (Infrastructure as Code)
Với triết lý GitOps, MỌI THỨ phải nằm trên Github (Kể cả cấu hình Deploy). 
Nhưng bạn không thể đưa file `secret.yaml` (chứa Pass DB production đã base64) lên Github public được.
Vậy làm sao để hệ thống tự động deploy (CI/CD) lấy được mật khẩu Production mà lập trình viên không biết?

### Giải pháp Chuẩn Công nghiệp
1. **Bitnami Sealed Secrets**: Mã hóa một chiều file Secret bằng Public Key. Đẩy file đã mã hóa lên Git. Chỉ có Controller đang chạy trong cụm K8s (nắm Private Key) mới dịch ngược ra được.
2. **HashiCorp Vault (Tích hợp Spring Boot)**: Spring Boot KHÔNG lấy mật khẩu từ K8s nữa. Lúc app khởi động, nó mang theo 1 cái Token, chạy thẳng ra hỏi cái Két Sắt (Vault): *"Cho em xin password DB"*.

---

## 🌐 Real-World GitHub Patterns & Industry Reference

- **[bitnami-labs/sealed-secrets](https://github.com/bitnami-labs/sealed-secrets)** — Giải pháp mã hóa K8s Secret an toàn nhất để đẩy lên Git.
- **[hashicorp/vault](https://github.com/hashicorp/vault)** — Nền tảng quản lý danh tính và bí mật độc tôn của giới Enterprise.

---

## 📐 System Design Blueprint & Setup Guide

### Hướng tiếp cận 1: Sealed Secrets (Cách dễ nhất cho Startup)

1. Cài đặt Kubeseal CLI vào máy DevOps.
2. Bạn có file `my-secret.yaml` chứa password thô ở máy tính.
3. Dùng lệnh `kubeseal < my-secret.yaml > my-sealed-secret.json`.
4. Lệnh này sẽ mã hóa toàn bộ dữ liệu bằng RSA (Asymmetric Encryption). File JSON sinh ra chỉ toàn những đoạn mã hóa loằng ngoằng.
5. Bạn push file JSON này lên Github thoải mái.
6. Khi K8s đọc file JSON này, Sealed-Secret-Controller (Chỉ nó mới cầm chìa khóa Private) sẽ giải mã nó lại thành K8s Secret bình thường ở trong RAM của Node.
7. Spring Boot đọc K8s Secret bình thường thông qua Biến Môi Trường (Environment Variable).

### Hướng tiếp cận 2: HashiCorp Vault (Dành cho Ngân hàng / Hệ thống cực lớn)

Không lưu bất kỳ mật khẩu nào vào K8s Secret.

**Bước 1: Cấu hình Spring Boot (`application.yml` hoặc `bootstrap.yml`)**
```yaml
spring:
  cloud:
    vault:
      host: vault.mycompany.internal
      port: 8200
      scheme: https
      authentication: KUBERNETES # Sử dụng JWT Token của chính Pod K8s để xác thực với Vault
      kubernetes:
        role: my-spring-app-role
```

**Bước 2: Hoạt động**
- K8s sinh ra 1 cái Pod (Spring Boot). K8s tự động tiêm 1 cái file JWT Token (ServiceAccount Token) vào thư mục `/var/run/secrets/...` của Pod.
- Spring Boot khởi động, đọc cái Token đó, gửi API lên Vault Server: *"Tôi là Pod của K8s nè, Token của tôi đây, xin cấp quyền truy cập"*.
- Vault Server cầm Token đó đi gọi API của K8s để xác minh (Auth): *"Ê K8s, cái Pod này có đúng là của anh không?"*. K8s trả lời: *"Đúng"*.
- Vault đồng ý cấp quyền. Vault trả về `DB_PASSWORD`.
- Spring Boot nạp password vào bộ nhớ và kết nối Database.

**Lợi ích tuyệt đối:**
- Không một Dev, một Ops nào nhìn thấy password thật.
- Password có thể **Tự Động Đổi Hàng Ngày (Dynamic Secrets)**. Hôm nay Vault tự vào Postgres đổi pass, rồi báo lại cho Spring Boot. Hacker có ăn cắp được pass cũ thì ngày mai pass đó cũng vô dụng.

---

## ⚡ Best Practices & Anti-Patterns

### ✅ Best Practices
1. **Dùng Kustomize / Helm**: Kết hợp Sealed-Secrets với Helm. Render ra file Secret.yaml rồi bọc nó lại bằng Kubeseal trước khi đẩy lên Git.
2. **Rotate Secrets (Luân chuyển mật khẩu)**: Dù dùng Vault hay SealedSecrets, hãy tập thói quen thay đổi toàn bộ khóa truy cập định kỳ (3 tháng 1 lần).
3. **Mã hóa file Etcd**: Bản thân K8s lưu mọi cấu hình (kể cả Secret đã giải mã) vào CSDL `etcd`. Bắt buộc phải bật tính năng Encryption at Rest (TDE) cho cụm `etcd` để đề phòng hacker chép trộm ổ cứng của máy chủ K8s Master.

### ❌ Anti-Patterns

| Anti-Pattern | Problem | Fix |
|-------------|---------|-----|
| Lưu Secret bằng Base64 trên Github Public/Private repo | Github bị hack, hoặc nhân viên cũ nghỉ việc mang theo cả cục Source Code. Toàn bộ Production Server bị đánh sập trong 5 phút. | TUYỆT ĐỐI không bao giờ push K8s Secret (Dạng thô/Base64) lên Git. |
| Hardcode mật khẩu vào trong Image (Dockerfile) | Chạy lệnh `ENV DB_PASS=123` trong Dockerfile. Ai kéo Image về chạy lệnh `docker inspect` đều nhìn thấy pass mồn một. | Image phải 100% sạch (Stateless). Mật khẩu chỉ được nạp vào lúc Runtime (Khi Container chạy lên). |
| Gán quyền ServiceAccount "Admin" cho mọi Pod | Spring Boot gửi Token lên K8s/Vault. Nhưng vì Token này có quyền Admin cụm K8s, nếu App bị hack dính lỗ hổng RCE, Hacker lấy được Token và chiếm toàn quyền điều khiển toàn cụm K8s! | Mọi Pod phải chạy với `ServiceAccount` riêng biệt, không có quyền gì ngoài việc nhận diện thân phận. |
