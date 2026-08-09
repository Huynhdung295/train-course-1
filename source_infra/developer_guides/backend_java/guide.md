# 🚀 HƯỚNG DẪN KHỞI TẠO BACKEND JAVA (SPRING BOOT)
Dành cho: Các Microservice Lõi (Tài chính, Đơn hàng, Tồn kho) yêu cầu tính toàn vẹn dữ liệu (ACID) tuyệt đối và chịu tải cao.

---

## 1. KHỞI TẠO KHUNG DỰ ÁN (SCAFFOLDING)
Copy lệnh `curl` sau để tải trực tiếp file zip cấu hình chuẩn từ Spring Initializr. (Đảm bảo máy đã cài JDK 17 hoặc 21).

```bash
curl https://start.spring.io/starter.zip \
  -d dependencies=web,data-jpa,postgresql,validation,lombok,security,actuator \
  -d type=maven-project \
  -d language=java \
  -d bootVersion=3.2.3 \
  -d javaVersion=21 \
  -d groupId=com.nexus \
  -d artifactId=core-service \
  -d name=core-service \
  -o core-service.zip

unzip core-service.zip -d nexus-backend
cd nexus-backend
```

## 2. BỔ SUNG CÁC THƯ VIỆN ENTERPRISE (POM.XML)
Mở file `pom.xml` và dán thêm các "vũ khí" phân tán vào block `<dependencies>`:

```xml
<!-- 1. Flyway cho Database Migration -->
<dependency>
    <groupId>org.flywaydb</groupId>
    <artifactId>flyway-core</artifactId>
</dependency>

<!-- 2. Redisson cho Distributed Lock & Caching -->
<dependency>
    <groupId>org.redisson</groupId>
    <artifactId>redisson-spring-boot-starter</artifactId>
    <version>3.27.0</version>
</dependency>

<!-- 3. RFC 7807 Problem Details (Chuẩn hóa lỗi) -->
<dependency>
    <groupId>org.zalando</groupId>
    <artifactId>problem-spring-web-starter</artifactId>
    <version>0.27.0</version>
</dependency>
```

## 3. CẤU HÌNH THẦN TỐC (APPLICATION.YML)
Đổi tên `application.properties` thành `application.yml` và copy paste cấu hình cơ bản sau:

```yaml
spring:
  datasource:
    url: jdbc:postgresql://localhost:5432/nexus_db
    username: postgres
    password: mysecretpassword
  jpa:
    hibernate:
      ddl-auto: validate # Tuyệt đối không dùng update ở Enterprise
    show-sql: true
  flyway:
    enabled: true

server:
  port: 8080
```

## 4. KÍCH HOẠT VÀ CHẠY
1. Khởi động PostgreSQL Local qua Docker:
```bash
docker run --name nexus-postgres -e POSTGRES_PASSWORD=mysecretpassword -p 5432:5432 -d postgres:16
```
2. Chạy Spring Boot:
```bash
./mvnw spring-boot:run
```
> API sẽ đón request tại `http://localhost:8080`.
