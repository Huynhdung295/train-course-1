# 🔐 Secrets Management Guide

Hướng dẫn quản lý bí mật (API keys, passwords) một cách an toàn trong dự án Nexus.

> [!CAUTION]
> **TUYỆT ĐỐI KHÔNG commit file chứa password/token/secret thật lên Git.** Kể cả trong private repo. Lý do: Git history không thể xóa hoàn toàn và repo có thể bị leak.

---

## Nguyên tắc vàng

| ✅ Đúng | ❌ Sai |
|---|---|
| Lưu secret trong biến môi trường | Hardcode password trong code |
| Dùng Ansible Vault / `.env` file | Commit `.env` thật lên Git |
| Rotate secret định kỳ (3-6 tháng) | Dùng 1 secret mãi mãi |
| Secret khác nhau giữa các môi trường | Dùng cùng secret cho dev và prod |

---

## Tool 1: Ansible Vault (Cho Infra team — Production secrets)

Ansible Vault mã hóa toàn bộ file YAML bằng AES-256. An toàn nhất để lưu Production credentials.

```bash
# 1. Copy template
cp ansible/vars/vault.yml.example ansible/vars/vault.yml

# 2. Điền vào các giá trị thật
nano ansible/vars/vault.yml

# 3. Mã hóa file
ansible-vault encrypt ansible/vars/vault.yml
# → Nhập vault password (lưu vào password manager của team)

# 4. Deploy với vault (sẽ hỏi vault password)
ansible-playbook -i ansible/inventory.ini ansible/provision.yml --ask-vault-pass

# Xem/sửa secrets đã mã hóa
ansible-vault edit ansible/vars/vault.yml

# Xem nội dung mà không mở editor
ansible-vault view ansible/vars/vault.yml
```

**Lưu vault password ở đâu?**
- **1Password / Bitwarden Team**: Tạo secure note "Nexus Vault Password"
- Hoặc file `~/.vault_pass` trên máy của từng DevOps engineer (không commit!)

---

## Tool 2: .env file (Cho Dev team — Local/Staging)

```bash
# Copy template và điền thông tin
cp .env.example .env

# .env ĐÃ ĐƯỢC .gitignore bảo vệ, kiểm tra lại:
grep "\.env$" .gitignore  # Phải ra ".env"
```

---

## Tool 3: GitHub / GitLab CI Secrets (Cho CI/CD Pipeline)

**GitHub Actions:**
1. Settings → Secrets and variables → Actions → New repository secret
2. Tên theo convention: `PROD_DB_PASSWORD`, `STAGING_JWT_SECRET`
3. Dùng trong workflow: `${{ secrets.PROD_DB_PASSWORD }}`

**GitLab CI:**
1. Settings → CI/CD → Variables → Add variable
2. Tick "Masked" để ẩn khỏi logs
3. Tick "Protected" để chỉ dùng trong protected branches

---

## Rotate Secrets — Khi nào và làm thế nào?

**Bắt buộc rotate ngay khi:**
- Dev rời team (revoke access ngay lập tức!)
- Phát hiện secret bị lộ (kiểm tra GitHub → Settings → Exposed secrets)
- Sau security incident

**Định kỳ (3-6 tháng):**
- JWT Secret
- DB Password
- Registry credentials

**Cách rotate JWT Secret (không downtime):**
1. Thêm secret mới vào config (giữ secret cũ song song)
2. Deploy mới — app chấp nhận cả 2 secret
3. Chờ tất cả token cũ hết hạn (max 15 phút với prod config)
4. Remove secret cũ, deploy lần 2
