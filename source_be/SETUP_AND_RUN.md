# 🚀 Hướng Dẫn Chạy Backend (source_be) — Từ A đến Z

**Dành cho:** Developer mới, hoặc bất kỳ ai cần setup lại môi trường.

---

## Bước 0: Kiểm tra phiên bản công cụ

Trước khi làm gì hết, chạy lệnh sau để kiểm tra máy bạn đã đủ công cụ chưa:

```bash
# Kiểm tra tất cả cùng lúc
java -version && mvn -v && docker -v && docker compose version && git --version
```

**Kết quả bắt buộc phải thấy:**

| Công cụ | Lệnh kiểm tra | Phiên bản yêu cầu | Tải về tại |
|---|---|---|---|
| **Java JDK** | `java -version` | `21+` | [adoptium.net](https://adoptium.net) |
| **Maven** | `mvn -v` | `3.9+` | [maven.apache.org](https://maven.apache.org) |
| **Docker** | `docker -v` | `24+` | [docker.com](https://www.docker.com/products/docker-desktop) |
| **Git** | `git --version` | `2.40+` | [git-scm.com](https://git-scm.com) |

### ⚠️ Nếu Java version sai

```bash
# macOS — Dùng SDKMAN (dễ nhất để quản lý nhiều Java version)
curl -s "https://get.sdkman.io" | bash
source ~/.sdkman/bin/sdkman-init.sh
sdk install java 21.0.3-tem
sdk default java 21.0.3-tem

# Verify lại
java -version   # Phải ra: openjdk version "21.0.x"

# Windows — Tải và cài Java 21 từ:
# https://adoptium.net/ → chọn Java 21 LTS → Windows x64 Installer
```

### ⚠️ Nếu Maven báo Java version sai

```bash
# Kiểm tra JAVA_HOME mà Maven đang dùng
mvn -v
# Nếu "Java version: 17" hoặc thấp hơn, cần sửa JAVA_HOME:

export JAVA_HOME=$(/usr/libexec/java_home -v 21)  # macOS
# Linux: export JAVA_HOME=/usr/lib/jvm/java-21-openjdk
```

---

## Bước 1: Clone Repository

```bash
git clone https://github.com/your-org/source_be.git
cd source_be
```

---

## Bước 2: Cấu hình Environment

```bash
# Copy file template
cp .env.example .env
```

Mở file `.env` và kiểm tra các giá trị. Với **môi trường local**, bạn **không cần thay đổi gì** vì profile `local` dùng H2 in-memory database.

**Nội dung `.env` quan trọng:**
```bash
# DB sẽ không dùng khi chạy profile=local
DB_URL=jdbc:postgresql://localhost:5432/nexus_erp
DB_USERNAME=nexus_admin
DB_PASSWORD=nexus_secret

# JWT secret (chỉ cần khi test login thật)
JWT_SECRET=change-this-to-a-random-64-char-string-in-production
```

---

## Bước 3: Chọn cách chạy

### 🟢 Option A: Local Mode — NHANH NHẤT (không cần Docker)

Dùng H2 database in-memory. Không cần Postgres, Redis, Kafka.

```bash
mvn spring-boot:run -Dspring-boot.run.profiles=local
```

**Khi thành công bạn thấy:**
```
INFO  c.a.CoreApiApplication - Started CoreApiApplication in 4.2 seconds
INFO  o.s.b.w.e.t.TomcatWebServer - Tomcat started on port(s): 8080
```

**Truy cập ngay:**
- 📄 **Swagger UI** (test API): http://localhost:8080/swagger-ui.html
- 🏥 **Health check**: http://localhost:8080/actuator/health
- 🗄️ **H2 Console** (xem DB): http://localhost:8080/h2-console
  - JDBC URL: `jdbc:h2:mem:testdb`
  - Username: `sa` | Password: _(để trống)_

---

### 🐳 Option B: Dev Mode — Đầy đủ tính năng (cần Docker)

Dùng Postgres thật, Redis, Kafka. Gần giống Production nhất.

```bash
# Bước 1: Khởi động hạ tầng (chỉ cần làm lần đầu hoặc khi restart máy)
docker compose up -d

# Đợi 15 giây để Postgres khởi động xong
docker compose ps   # Tất cả phải là "healthy" hoặc "running"

# Bước 2: Chạy backend
mvn spring-boot:run -Dspring-boot.run.profiles=dev
```

**Verify hạ tầng đang chạy:**
```bash
docker compose ps
# Kết quả mong đợi:
# nexus_postgres    ... healthy
# nexus_redis       ... running
# nexus_kafka       ... running
# nexus_mailhog     ... running
```

**Nếu port bị conflict:**
```bash
# Kiểm tra ai đang dùng port
netstat -an | grep 5432   # Postgres
netstat -an | grep 6379   # Redis
netstat -an | grep 8080   # App

# Dừng container cụ thể
docker compose stop postgres
docker compose start postgres
```

---

### 🔧 Option C: Chạy bằng IDE (IntelliJ / VS Code)

**IntelliJ IDEA:**
1. `File → Open` → chọn thư mục `source_be`
2. Đợi IntelliJ import Maven project (thanh progress ở góc dưới phải)
3. `Settings → Build → Compiler → Annotation Processors` → ☑️ Enable annotation processing
4. Tìm file `CoreApiApplication.java` → Click `▶ Run`
5. Hoặc: `Edit Configurations → VM Options`: `-Dspring.profiles.active=local`

**VS Code:**
1. Install extension **"Extension Pack for Java"**
2. Mở thư mục `source_be`
3. Nếu IDE báo lỗi "Text Blocks only available with source level 15":
   ```
   Ctrl+Shift+P → Java: Clean Java Language Server Workspace → Restart and delete
   ```
4. Chạy từ file `.vscode/launch.json` đã được cấu hình sẵn

---

## Bước 4: Verify hệ thống hoạt động

```bash
# Test 1: Health check
curl http://localhost:8080/actuator/health
# Phải trả về: {"status":"UP"}

# Test 2: Swagger UI có load không
curl -I http://localhost:8080/swagger-ui.html
# Phải trả về: HTTP/1.1 302 (redirect sang swagger UI)

# Test 3: Protected endpoint phải yêu cầu login
curl http://localhost:8080/api/v1/orders
# Phải trả về: HTTP 401 Unauthorized
```

---

## Bước 5: Đăng nhập lần đầu (dev/staging mode)

```bash
# Login và lấy JWT token
curl -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: tenant_demo" \
  -d '{"email":"admin@demo.nexus.com","password":"Demo@123456"}'

# Copy "accessToken" từ kết quả
# Dùng trong Swagger UI: Click "Authorize" → paste vào Bearer token
```

---

## Bảng môi trường (Profiles)

| Profile | Lệnh kích hoạt | Database | Kafka | Redis | Khi nào dùng |
|---|---|---|---|---|---|
| `local` | `-Dspring-boot.run.profiles=local` | H2 In-Memory | ❌ | ❌ | Phát triển nhanh, debug |
| `dev` | `-Dspring-boot.run.profiles=dev` | PostgreSQL (Docker) | ✅ | ✅ | Phát triển đầy đủ |
| `staging` | `SPRING_PROFILES_ACTIVE=staging` | PostgreSQL (Server) | ✅ | ✅ | UAT trước khi lên prod |
| `prod` | `SPRING_PROFILES_ACTIVE=prod` | PostgreSQL + PgBouncer | ✅ | ✅ | Production |
| `test` | `@ActiveProfiles("test")` | Testcontainers | ❌ | ❌ | Unit/Integration tests |

---

## Thay đổi cấu hình theo môi trường

Mỗi môi trường có file YAML riêng, Spring sẽ merge với `application.yml`:

```
src/main/resources/
├── application.yml          ← Cấu hình chung (tất cả env)
├── application-local.yml    ← Override cho local
├── application-dev.yml      ← Override cho dev
├── application-staging.yml  ← Override cho staging
├── application-prod.yml     ← Override cho prod
└── logback-spring.xml       ← Cấu hình logging
```

**Ví dụ thay đổi database URL chỉ cho staging:**

```yaml
# src/main/resources/application-staging.yml
spring:
  datasource:
    url: ${DB_URL:jdbc:postgresql://staging-db.nexus.internal:5432/nexus_erp_staging}
```

---

## Chạy Tests

```bash
# Unit tests (nhanh, không cần Docker)
mvn test

# Tất cả tests + Integration tests (cần Docker cho Testcontainers)
mvn verify

# Chạy test cụ thể
mvn test -Dtest=UserServiceTest
mvn test -Dtest=SecurityControllerTest

# Test với coverage report
mvn test jacoco:report
# Xem report tại: target/site/jacoco/index.html
```

---

## Lỗi thường gặp

### ❌ `Port 8080 already in use`
```bash
# Windows
netstat -aon | findstr :8080
taskkill /PID <PID> /F

# macOS/Linux
lsof -ti:8080 | xargs kill -9
```

### ❌ `Cannot open Maven project` (IntelliJ)
```
File → Invalidate Caches → Clear caches and restart
```

### ❌ Maven download timeout (mạng chậm)
```bash
# Chạy với offline mode nếu đã download trước đó
mvn spring-boot:run -Dspring-boot.run.profiles=local -o
```

### ❌ `BeanDefinitionException: No qualifying bean of type 'DataSource'`
Đảm bảo đang dùng profile `local` hoặc đã khởi động Docker Compose.

### ❌ `Text Blocks only available with source level 15` (VS Code)
```
Ctrl+Shift+P → Java: Clean Java Language Server Workspace → Restart and delete
```
_Lỗi IDE, không ảnh hưởng đến Maven build thật sự._
