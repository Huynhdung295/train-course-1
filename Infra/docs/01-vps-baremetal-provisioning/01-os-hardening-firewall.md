# 🛡️ OS Hardening, SSH Security & Firewall (UFW)

> **Category**: VPS & Baremetal | **Complexity**: Intermediate | **OS**: Ubuntu 22.04+ / Debian 12+

---

## 📖 Core Technical Mechanics & Deep-Dive

### Vấn đề: VPS Mặc định là một "Miếng mồi ngon"
Khi bạn thuê một con VPS (DigitalOcean, AWS EC2, Linode), mặc định nó mở cổng 22 (SSH) ra toàn cầu và cho phép đăng nhập bằng tài khoản `root` + Mật khẩu. 
Chỉ 5 phút sau khi VPS được khởi tạo, hàng chục ngàn con Botnet trên toàn thế giới sẽ quét IP của bạn và thử tấn công Brute-Force (Thử hàng ngàn mật khẩu `/root/123456`). Nếu mật khẩu yếu, bạn sẽ mất server ngay lập tức (Bị biến thành máy đào Bitcoin hoặc phát tán mã độc).

### Các nguyên tắc vàng (OS Hardening)
1. **Tuyệt đối không dùng Password cho SSH**: Bắt buộc phải dùng SSH Keys (RSA 4096 hoặc ED25519).
2. **Cấm đăng nhập bằng user `root` qua SSH**: Tạo một user thường (VD: `deployer`), cấp quyền `sudo`. Chỉ user này mới được SSH.
3. **Đổi cổng SSH mặc định (Port 22 -> Port tuỳ chọn)**: Tránh được 99% các con Botnet quét port quét bậy bạ.
4. **Firewall (Tường lửa) là bắt buộc**: Mặc định chặn mọi traffic (Deny All Inbound). Chỉ đục lỗ cho những port thực sự cần thiết (VD: 80, 443).
5. **Fail2Ban**: Phần mềm tự động theo dõi file Log của hệ thống. Nếu thấy 1 IP gõ sai mật khẩu/key quá 5 lần, nó lập tức cấu hình Firewall block IP đó vĩnh viễn.

---

## 🌐 Real-World GitHub Patterns & Industry Reference

- **[CIS Benchmarks](https://www.cisecurity.org/cis-benchmarks/)** — Tiêu chuẩn cấu hình an toàn hệ thống cấp độ Doanh nghiệp và Chính phủ.
- **[fail2ban/fail2ban](https://github.com/fail2ban/fail2ban)** — Tool ngăn chặn Intrusion phổ biến nhất thế giới Linux.

---

## 📐 System Design Blueprint & Setup Guide

Dưới đây là kịch bản (Bash Script) chuẩn chỉnh để bảo mật 1 con VPS mới tinh.

### 1. Tạo User mới và Phân quyền sudo

```bash
# Đăng nhập vào VPS bằng root (Chỉ làm lần đầu tiên)
ssh root@YOUR_VPS_IP

# 1. Tạo user tên 'deployer'
adduser deployer

# 2. Thêm deployer vào nhóm sudo (Được quyền chạy lệnh admin)
usermod -aG sudo deployer

# 3. Setup thư mục chứa SSH Key cho user mới
su - deployer
mkdir ~/.ssh
chmod 700 ~/.ssh
touch ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
# (Dán Public Key của bạn từ máy tính cá nhân (id_rsa.pub) vào file authorized_keys này)
```

### 2. Cấu hình SSH Daemon (Chống hack)

Trở lại quyền root, mở file `/etc/ssh/sshd_config`:

```ini
# --- BẮT BUỘC ĐỔI ---
Port 2244                   # Đổi port 22 thành một số ngẫu nhiên (Ví dụ 2244)
PermitRootLogin no          # Tuyệt đối cấm root login từ xa!
PasswordAuthentication no   # Tuyệt đối cấm gõ mật khẩu! Chỉ dùng File Key.
PubkeyAuthentication yes    # Cho phép đăng nhập bằng SSH Key.
AllowUsers deployer         # CHỈ cho phép user deployer được phép login qua mạng.
```

Sau khi sửa file: `systemctl restart sshd`. 
*(Chú ý: Mở sẵn 1 terminal cũ ở quyền root, mở thêm 1 terminal mới test đăng nhập. Nếu cấu hình sai bạn tự nhốt mình ở ngoài luôn).*

### 3. Thiết lập Tường lửa UFW (Uncomplicated Firewall)

```bash
# Cài đặt
sudo apt update && sudo apt install ufw -y

# 1. Mặc định chặn TẤT CẢ các kết nối đi vào (Inbound), cho phép TẤT CẢ đi ra (Outbound)
sudo ufw default deny incoming
sudo ufw default allow outgoing

# 2. Đục lỗ cho Port SSH MỚI (Cực kỳ quan trọng, nếu quên lệnh này, bật ufw lên bạn sẽ bị văng khỏi VPS vĩnh viễn!)
sudo ufw allow 2244/tcp

# 3. Mở port cho Web (Nginx/API Gateway)
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# 4. Kích hoạt Firewall
sudo ufw enable

# 5. Xem trạng thái
sudo ufw status numbered
```

### 4. Cài đặt Fail2Ban (Tự động cấm IP kẻ tấn công)

```bash
sudo apt install fail2ban -y
sudo systemctl enable fail2ban
sudo systemctl start fail2ban

# Fail2Ban tự động bảo vệ SSH theo mặc định. Kẻ nào thử login sai 5 lần, IP sẽ bị ban 10 phút (hoặc vĩnh viễn tuỳ config).
# Kiểm tra danh sách các IP đang bị cấm:
sudo fail2ban-client status sshd
```

---

## ⚡ Best Practices & Anti-Patterns

### ✅ Best Practices
1. **Cập nhật Hệ Điều Hành định kỳ**: Đừng để server 3 năm không update Linux Kernel. Lỗ hổng Zero-day có thể chiếm quyền Root dễ dàng. Chạy `sudo apt update && sudo apt upgrade -y` (hoặc thiết lập unattended-upgrades).
2. **Ẩn phiên bản phần mềm**: Hacker hay dùng script quét phiên bản Nginx hoặc SSH (Banner grabbing). Hãy cấu hình ẩn version info (`server_tokens off;` trong Nginx).
3. **Mạng LAN nội bộ (VPC)**: Nếu bạn có cụm 3 con VPS (1 Nginx, 1 App, 1 Database). Chỉ mở port 80/443 ở con Nginx ra Internet. App và Database giao tiếp với nhau bằng Private IP nội bộ, KHÔNG MỞ ra mạng Public!

### ❌ Anti-Patterns

| Anti-Pattern | Problem | Fix |
|-------------|---------|-----|
| Mở cổng Database (3306/5432) hoặc Redis (6379) ra Public Internet | Hacker sẽ thử Bruteforce mật khẩu DB của bạn. Redis nếu quên gán pass sẽ bị dính mã độc tống tiền (Ransomware) trong vòng 5 phút! | Luôn bind DB vào IP `127.0.0.1` hoặc VPC IP nội bộ. Nếu muốn dùng DBeaver connect vào để debug, hãy dùng **SSH Tunneling**. |
| Đặt password của user Root là '123456' vì nghĩ "Mình đổi port 22 rồi ai mà biết" | Port scanning (Nmap) có thể quét tìm port thật của SSH trong 1 giây. | Luôn disable password authentication hoàn toàn. |
| Dùng FTP thuần để upload code lên server | Dữ liệu truyền qua mạng không được mã hóa (Clear text). Bất cứ ai nghe lén mạng đều thấy cả Source code và Password DB của bạn. | Dùng `SFTP` (FTP over SSH) hoặc `rsync` hoặc CI/CD Pipeline. |
