# 🐳 Spring Boot Dockerfile Chuẩn Enterprise

> **Category**: Docker Containerization | **Complexity**: Advanced | **Java**: 21+ | **Spring Boot**: 3.3+

---

## 📖 Core Technical Mechanics & Deep-Dive

### The "Fat Jar" Problem
Mặc định, lệnh `mvn clean package` sinh ra một cái "Fat Jar" chứa tất cả mọi thứ: Code của bạn (~1MB) và đống Dependencies (Spring, Hibernate, Tomcat... ~50MB).
Nếu bạn copy nguyên cục 51MB này vào Docker Image mỗi lần build:
- Docker Image sẽ phình to rất nhanh qua các phiên bản.
- Thời gian push/pull Image lên Docker Registry rất lâu.
- Không tận dụng được cơ chế caching Layer của Docker. Thực tế, thư viện Spring Boot hiếm khi thay đổi, thứ thay đổi hàng ngày là Code của bạn!

### Giải pháp: Layered Jars (Kỹ thuật bóc tách lớp)
Từ Spring Boot 2.3, tính năng **Layered Jars** ra đời. Thay vì nhét chung 1 cục, nó bóc tách file `.jar` thành 4 thư mục (layers):
1. `dependencies` (Thư viện ít đổi nhất)
2. `spring-boot-loader`
3. `snapshot-dependencies`
4. `application` (Code của bạn - thay đổi nhiều nhất)

Khi build Docker, ta đưa 4 thư mục này vào 4 lớp `COPY` khác nhau. Khi code thay đổi, Docker chỉ build lại đúng cái layer số 4 (nặng 1MB), tiết kiệm 99% thời gian build!

---

## 🌐 Real-World GitHub Patterns & Industry Reference

- **[spring-projects/spring-boot-docker](https://spring.io/guides/topicals/spring-boot-docker/)** — Hướng dẫn tối ưu Docker từ chính cha đẻ Spring Boot.
- **[Google Distroless](https://github.com/GoogleContainerTools/distroless)** — Các Image Docker bảo mật nhất thế giới (không có bash/sh, không có wget/curl, hacker chui vào cũng không làm gì được).

---

## 📐 System Design Blueprint & Setup Guide

### Mẫu Dockerfile Tối Ưu (Multi-stage + Layered + JRE 21 + Non-root)

Dưới đây là một Dockerfile "Đỉnh cao" nhất bạn có thể tìm thấy để chạy Spring Boot trên Production. Nó giải quyết 3 bài toán: Tối ưu dung lượng, Tối ưu tốc độ Build, và Bảo mật tuyệt đối.

```dockerfile
# ==========================================
# STAGE 1: BULD (Chỉ dùng để lấy file jar)
# ==========================================
# Dùng Image Maven có đủ JDK 21 (Nặng ~400MB) để compile code
FROM eclipse-temurin:21-jdk-alpine AS builder
WORKDIR /workspace/app

# Bước 1.1: Copy pom.xml và tải dependencies (Tận dụng Docker cache)
COPY pom.xml .
COPY .mvn .mvn
COPY mvnw .
# Lệnh go-offline tải toàn bộ thư viện về để build nhanh hơn ở các lần sau
RUN ./mvnw dependency:go-offline

# Bước 1.2: Copy source code và Build
COPY src src
RUN ./mvnw clean package -DskipTests

# Bước 1.3: Bóc tách Fat Jar thành các Layers (Sử dụng công cụ layertools của Spring Boot)
RUN java -Djarmode=layertools -jar target/*.jar extract

# ==========================================
# STAGE 2: PRODUCTION RUNTIME (Siêu nhẹ, Siêu bảo mật)
# ==========================================
# Dùng JRE (Java Runtime Environment) thay vì JDK. Bản Alpine cực nhẹ (~50MB)
FROM eclipse-temurin:21-jre-alpine

WORKDIR /app

# 1. BẢO MẬT: Chạy app dưới quyền User thường (Không dùng root)
# Tạo user 'spring' và group 'spring'
RUN addgroup -S spring && adduser -S spring -G spring
USER spring:spring

# 2. COPY 4 lớp từ STAGE 1 sang STAGE 2 (Thứ tự từ ít thay đổi nhất đến hay thay đổi nhất)
COPY --from=builder /workspace/app/dependencies/ ./
COPY --from=builder /workspace/app/spring-boot-loader/ ./
COPY --from=builder /workspace/app/snapshot-dependencies/ ./
COPY --from=builder /workspace/app/application/ ./

# 3. Mở cổng 8080
EXPOSE 8080

# 4. Định nghĩa EntryPoint chạy app bằng Spring Boot Loader (Thay vì chạy -jar)
# Việc này khởi động nhanh hơn một chút và dùng ít RAM hơn.
ENTRYPOINT ["java", "org.springframework.boot.loader.launch.JarLauncher"]
```

---

## 🧪 Verification Commands

```bash
# Build Image và xem thời gian
docker build -t my-spring-app:latest .

# Xem dung lượng Image (Sẽ thấy nó cực kỳ nhỏ, khoảng ~150MB thay vì 500MB)
docker images my-spring-app

# Thử truy cập vào bên trong Container để test quyền Rootless
docker run -it --rm --entrypoint /bin/sh my-spring-app:latest
# Bên trong shell gõ: whoami 
# KẾT QUẢ: 'spring' (Nếu hacker exploit được app, nó cũng không có quyền root OS)
```

---

## ⚡ Best Practices & Anti-Patterns

### ✅ Best Practices
1. **Spring Boot 3.3 CDS (Class Data Sharing)**: Để tăng tốc độ khởi động cực nhanh (x2 tốc độ), bạn có thể chạy thêm lệnh sinh file CDS Archive lúc build. Ở ENTRYPOINT, thêm cờ `-XX:SharedArchiveFile=application.jsa`.
2. **Alpine vs Distroless**: Bản Alpine (như trên) vẫn còn Shell (`/bin/sh`). Nếu hệ thống Y Tế / Tài Chính yêu cầu bảo mật cấp quân sự, đổi base image của Stage 2 sang `gcr.io/distroless/java21-debian12`. Image này không có Shell, Hacker nếu tìm được lỗ hổng Remote Code Execution (RCE) cũng không có `/bin/bash` để chạy lệnh!

### ❌ Anti-Patterns

| Anti-Pattern | Problem | Fix |
|-------------|---------|-----|
| Dùng JDK để chạy App (Ví dụ `FROM openjdk:21`) | Kích thước Image lên tới ~500MB. Chứa cả trình biên dịch (javac) và công cụ debug, giúp hacker dễ dàng viết mã độc trên server bị hack. | BẮT BUỘC dùng JRE (Java Runtime Environment) cho Production (`eclipse-temurin:21-jre-alpine`). |
| Chạy `COPY . .` và `mvn package` trong cùng 1 RUN layer | Mỗi lần bạn đổi 1 dấu chấm phẩy trong code Java, Docker sẽ tải lại toàn bộ Internet (Maven dependencies) mất 5 phút. | Dùng kỹ thuật copy `pom.xml` trước, chạy `dependency:go-offline`, rồi mới copy thư mục `src`. |
| Chạy Container bằng user `root` (Mặc định của Docker) | Lỗ hổng Container Breakout: Nếu Docker Engine bị lỗi, tiến trình root trong container có thể trở thành root của máy chủ Host thật sự -> Mất trắng VPS. | Luôn khai báo `RUN adduser` và `USER spring` ở cuối Dockerfile. |
