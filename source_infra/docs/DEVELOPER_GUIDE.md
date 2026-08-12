# 📚 Developer Guide — Nexus ERP Platform

Tài liệu tổng hợp dành cho **tất cả members** trong team — Backend, Frontend, DevOps.

> **Bắt đầu tại đây nếu bạn mới join team.** Đọc hết file này + chạy `check_versions` trước khi làm bất cứ điều gì.

---

## 📋 Mục lục

1. [Cấu trúc repositories](#1-cấu-trúc-repositories)
2. [Bước đầu tiên — Kiểm tra phiên bản](#2-bước-đầu-tiên--kiểm-tra-phiên-bản)
3. [Cài đặt và thay đổi phiên bản công cụ](#3-cài-đặt-và-thay-đổi-phiên-bản-công-cụ)
4. [Hướng dẫn chạy từng repo](#4-hướng-dẫn-chạy-từng-repo)
5. [Quy trình làm việc hàng ngày](#5-quy-trình-làm-việc-hàng-ngày)
6. [Lỗi phổ biến và cách xử lý](#6-lỗi-phổ-biến-và-cách-xử-lý)

---

## 1. Cấu trúc repositories

```
DEV/
├── source_be/          ← Backend API (Java 21 + Spring Boot 3.x)
├── source_database/    ← Database Schema, Migrations, Docker Stack
├── source_infra/       ← CI/CD, Ansible, Ops Panel, Monitoring
└── source_fe/          ← Frontend (Next.js / React — nếu có)
```

**Thứ tự khởi động:**
```
source_database → source_be → source_fe
```

---

## 2. Bước đầu tiên — Kiểm tra phiên bản

> Chạy ngay script này trước khi setup bất cứ thứ gì!

**Linux / macOS:**
```bash
chmod +x source_infra/scripts/check_versions.sh
./source_infra/scripts/check_versions.sh
```

**Windows (PowerShell):**
```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\source_infra\scripts\check_versions.ps1
```

**Kết quả mong đợi:**
```
[Java]
  ✅ Java 21 (cần: 21+)
  ✅ JAVA_HOME được set
  ✅ Maven đang dùng Java 21

[Maven]
  ✅ Maven 3.9.6 (cần: 3.9+)

[Docker]
  ✅ Docker 26.1.0 (cần: 24+)
  ✅ Docker daemon đang chạy

[Docker Compose]
  ✅ Docker Compose: Docker Compose version v2.x.x

[Node.js (cho Frontend)]
  ✅ Node.js v20.x.x (cần: 18+)
  ✅ npm v10.x.x

[Git]
  ✅ git version 2.x.x
  ✅ Git identity: Nguyen Van A <a@company.com>
```

**Nếu có ❌:** Xem [Phần 3](#3-cài-đặt-và-thay-đổi-phiên-bản-công-cụ) để biết cách cài.

---

## 3. Cài đặt và thay đổi phiên bản công cụ

### ☕ Java 21

**Kiểm tra version hiện tại:**
```bash
java -version
# Mong đợi: openjdk version "21.0.x"
```

**Cài Java 21 (Temurin — Open Source, miễn phí):**

| Hệ điều hành | Cách cài |
|---|---|
| **Windows** | Vào [adoptium.net](https://adoptium.net) → Java 21 LTS → Windows x64 → Tải `.msi` → Cài |
| **macOS** | `brew install --cask temurin@21` |
| **Linux (Ubuntu)** | `sudo apt-get install -y temurin-21-jdk` |

**Quản lý nhiều Java version (Khuyến nghị dùng SDKMAN):**
```bash
# Cài SDKMAN
curl -s "https://get.sdkman.io" | bash
source ~/.sdkman/bin/sdkman-init.sh

# Xem các Java version có thể cài
sdk list java | grep "21.*tem"

# Cài Java 21 Temurin
sdk install java 21.0.3-tem

# Cài thêm Java 17 nếu cần project cũ
sdk install java 17.0.10-tem

# Chuyển đổi version cho session hiện tại
sdk use java 21.0.3-tem

# Đặt default
sdk default java 21.0.3-tem

# Kiểm tra
java -version
```

**Sửa Java version trong pom.xml (nếu cần):**
```xml
<properties>
    <java.version>21</java.version>
    <maven.compiler.source>21</maven.compiler.source>
    <maven.compiler.target>21</maven.compiler.target>
</properties>
```

---

### 📦 Maven 3.9+

**Kiểm tra:**
```bash
mvn -v
# Apache Maven 3.9.x
# Java version: 21.0.x   ← PHẢI là 21
```

**Nếu Maven dùng Java version sai:**
```bash
# Kiểm tra JAVA_HOME
echo $JAVA_HOME   # macOS/Linux
echo $env:JAVA_HOME  # Windows PowerShell

# Set đúng JAVA_HOME
# macOS:
export JAVA_HOME=$(/usr/libexec/java_home -v 21)

# Linux:
export JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64

# Windows — Tìm Java path:
where java
# Thêm vào System Environment Variables:
# JAVA_HOME = C:\Program Files\Eclipse Adoptium\jdk-21.0.3.9-hotspot
```

---

### 🐳 Docker & Docker Compose

**Kiểm tra:**
```bash
docker -v               # Docker version 24.x.x+
docker compose version  # Docker Compose version v2.x.x+
docker ps               # Nếu lỗi → Docker daemon chưa chạy
```

**Cập nhật Docker:**
- Windows / macOS: Mở Docker Desktop → Check for updates
- Linux: `sudo apt-get update && sudo apt-get install docker-ce`

**Tắt/bật service trong Docker Compose:**
```bash
docker compose stop postgres    # Dừng Postgres
docker compose start postgres   # Khởi động lại
docker compose restart backend  # Restart backend

docker compose logs -f backend  # Xem logs realtime
docker compose ps               # Xem status tất cả
```

---

### 🟢 Node.js (cho Frontend)

**Kiểm tra:**
```bash
node -v   # v20.x.x hoặc v18.x.x
npm -v    # 10.x.x
npx -v    # 10.x.x
```

**Quản lý version với nvm:**
```bash
# Cài nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc  # hoặc ~/.zshrc

# Xem version LTS có sẵn
nvm list-remote --lts

# Cài Node 20 LTS (khuyến nghị)
nvm install 20
nvm use 20
nvm alias default 20

# Kiểm tra
node -v    # v20.x.x
npm -v     # 10.x.x
```

---

## 4. Hướng dẫn chạy từng repo

Xem hướng dẫn chi tiết tại:

| Repo | File hướng dẫn |
|---|---|
| **source_be** (Backend Java) | [source_be/SETUP_AND_RUN.md](../../../source_be/SETUP_AND_RUN.md) |
| **source_database** (DB Stack) | [source_database/SETUP_AND_RUN.md](../../../source_database/SETUP_AND_RUN.md) |
| **source_infra** (Ops/Deploy) | [source_infra/SETUP_AND_RUN.md](../SETUP_AND_RUN.md) |

**Tóm tắt nhanh:**

```bash
# 1. Start DB stack
cd source_database/docker && docker compose up -d

# 2. Start Backend (local mode — không cần Docker)
cd source_be && mvn spring-boot:run -Dspring-boot.run.profiles=local

# Test: http://localhost:8080/swagger-ui.html
```

---

## 5. Quy trình làm việc hàng ngày

```bash
# Sáng: Sync code mới nhất
git fetch origin
git checkout develop
git pull origin develop

# Tạo branch mới cho task
git checkout -b feat/NX-123-ten-tinh-nang

# Viết code, test
mvn test   # Chạy unit tests

# Commit
git add .
git commit -m "feat(orders): add bulk cancellation endpoint"

# Push và tạo PR
git push origin feat/NX-123-ten-tinh-nang
# Vào GitHub/GitLab → New Pull Request
```

**Code Review:**
1. Assign reviewer
2. CI phải PASS (GitHub Actions)
3. Cần ít nhất 1 approval
4. Merge bằng Squash and Merge (giữ history clean)

---

## 6. Lỗi phổ biến và cách xử lý

### ❌ `java.lang.UnsupportedClassVersionError: Unsupported major.minor version 61`
**Nguyên nhân:** Class được compile bằng Java 17 nhưng JVM đang chạy Java 11 hoặc thấp hơn.
```bash
java -version   # Kiểm tra version đang chạy
mvn -v          # Kiểm tra Java mà Maven dùng
# → Nâng JDK lên 21
```

### ❌ `Port 8080/5432/6379 already in use`
```bash
# Tìm và kill process
lsof -ti:8080 | xargs kill -9   # macOS/Linux
netstat -aon | findstr :8080     # Windows (xem PID rồi dùng Task Manager)
```

### ❌ `Cannot connect to the Docker daemon`
- Mở Docker Desktop (Windows/Mac)
- Linux: `sudo systemctl start docker`

### ❌ Maven build `[ERROR] BUILD FAILURE`
```bash
# Xem lỗi cụ thể
mvn compile -e   # Verbose errors

# Clean build (xóa cache)
mvn clean compile

# IntelliJ: File → Invalidate Caches
```

### ❌ VS Code: "Text Blocks only available with source level 15"
```
Ctrl+Shift+P → Java: Clean Java Language Server Workspace → Restart and delete
```
_Đây là lỗi của IDE, không ảnh hưởng Maven build thực tế._

### ❌ `Caused by: org.flywaydb.core.api.FlywayException: Validate failed`
```bash
# Xem trạng thái migration
docker run --rm flyway/flyway:10 \
  -url="jdbc:postgresql://localhost:5432/nexus_erp" \
  -user=nexus_admin -password=nexus_secret info

# Repair nếu bị lỗi state
docker run --rm flyway/flyway:10 \
  -url="jdbc:postgresql://localhost:5432/nexus_erp" \
  -user=nexus_admin -password=nexus_secret repair
```

---

## Tài liệu bổ sung

| Tài liệu | Mô tả |
|---|---|
| [ONBOARDING.md](ONBOARDING.md) | Checklist đầy đủ cho member mới |
| [SECRETS_MANAGEMENT.md](SECRETS_MANAGEMENT.md) | Cách quản lý secrets an toàn |
| [INCIDENT_PLAYBOOK.md](INCIDENT_PLAYBOOK.md) | Xử lý sự cố Production |
| [source_database/docs/RUNBOOK.md](../../source_database/docs/RUNBOOK.md) | Database incident runbook |
| [source_database/docs/ERD.md](../../source_database/docs/ERD.md) | Entity Relationship Diagram |
| [source_be/CONTRIBUTING.md](../../source_be/CONTRIBUTING.md) | Quy tắc code & commit |
