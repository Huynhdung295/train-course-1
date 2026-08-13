# 🚀 Hướng Dẫn Cài Đặt & Chạy Dự Án (Cho New Members)

Chào mừng bạn đến với dự án **Nexus ERP & POS**. Tài liệu này sẽ hướng dẫn bạn chi tiết từ A-Z cách kiểm tra version, cài đặt môi trường và chạy toàn bộ hệ thống (Database, Backend, Frontend).

---

## 📌 1. Yêu cầu môi trường & Kiểm tra Version

Hệ thống yêu cầu các phiên bản cụ thể để đảm bảo hoạt động ổn định. Dưới đây là cách kiểm tra:

### 1.1. Frontend (Angular)
- **Node.js**: Phiên bản **24.15.0** hoặc **26.0.0** (Bắt buộc cho Angular 22)
- **NPM**: Phiên bản **10+**
- **Angular CLI**: Phiên bản **22.x**

**Cách kiểm tra:**
Mở terminal và gõ:
```bash
node -v      # Mong đợi: v24.15.0 trở lên
npm -v       # Mong đợi: 10.x.x
ng version   # Mong đợi: Angular CLI 22.x
```

**Cách thay đổi/cài đặt version (Khắc phục lỗi "The Angular CLI requires a minimum Node.js version"):**
- Bắt buộc sử dụng **NVM (Node Version Manager)** (hoặc `nvm-windows` trên Windows) để nâng cấp Node:
  ```bash
  nvm install 24.15.0
  nvm use 24.15.0
  ```

### 1.2. Backend (Spring Boot 3.x)
- **Java (JDK)**: Phiên bản **21**
- **Maven**: Phiên bản **3.9+**

**Cách kiểm tra:**
```bash
java -version   # Mong đợi: openjdk version "21.x.x"
mvn -v          # Mong đợi: Apache Maven 3.9.x
```

**Cách thay đổi/cài đặt version:**
- Khuyên dùng **SDKMAN!** (Linux/Mac) hoặc thiết lập `JAVA_HOME` thủ công trên Windows.

### 1.3. Database & Caching
- **Docker & Docker Compose**: Dùng để chạy Postgres, Redis, Kafka, Keycloak.
- **Cách kiểm tra:**
  ```bash
  docker -v           # Mong đợi: Docker version 24+
  docker-compose -v   # Mong đợi: Docker Compose version 2+
  ```

---

## 📌 2. Hướng Dẫn Chạy Hệ Thống

Bạn cần chạy theo thứ tự: **Database/Infra ➡️ Backend ➡️ Frontend**.

### Bước 1: Khởi động Database & Infra (Docker)
Thư mục: `source_database`

1. Mở terminal và di chuyển vào `source_database`.
2. Đảm bảo Docker Desktop (nếu dùng Windows/Mac) đang mở.
3. Chạy lệnh:
   ```bash
   cd source_database
   docker-compose up -d
   ```
4. Hệ thống sẽ pull images và chạy Postgres (5432), Redis (6379), Kafka (9092), Keycloak (8080).
5. Để tắt: `docker-compose down`.

### Bước 2: Chạy Backend (Spring Boot)
Thư mục: `source_be`

1. Di chuyển vào thư mục BE:
   ```bash
   cd source_be
   ```
2. Build và cài đặt các dependencies bằng Maven:
   ```bash
   mvn clean install -DskipTests
   ```
3. Chạy ứng dụng Spring Boot:
   ```bash
   mvn spring-boot:run
   ```
4. Backend sẽ chạy ở cổng `http://localhost:8081` (hoặc cổng được cấu hình trong `application.yml`).

### Bước 3: Chạy Frontend (Angular)
Thư mục: `source_fe`

1. Di chuyển vào thư mục FE:
   ```bash
   cd source_fe
   ```
2. Cài đặt các thư viện (Node modules):
   > **Lưu ý Quan Trọng:** Vì dự án đang giả định dùng Angular 22 và một số thư viện (như NgRx) có thể gặp lỗi conflict peer dependencies (như lỗi @angular/core version), bạn hãy cài đặt kèm cờ `--legacy-peer-deps`:
   ```bash
   npm install --legacy-peer-deps
   ```
   *Lưu ý: Nếu bạn gặp lỗi ERESOLVE khi chạy `npm i`, việc sử dụng `--legacy-peer-deps` sẽ bỏ qua các kiểm tra xung đột version và tiến hành cài đặt thành công.*

3. Khởi động môi trường phát triển:
   ```bash
   npm start
   # Hoặc: ng serve
   ```
4. Mở trình duyệt và truy cập: `http://localhost:4200`.

---

## 📌 3. Các Lệnh Hữu Ích Thường Dùng

- **Frontend:**
  - Build production: `npm run build:prod`
  - Chạy linter: `npm run lint`
  - Format code: `npm run format`
  
  **🛠 Hướng dẫn tạo Component (Angular 14+ / 22 chuẩn Senior):**
  - Tuyệt đối **không** dùng string template inline (template: \`...\`) cho các component lớn. Bắt buộc dùng file `.html` và `.scss` riêng biệt.
  - Sử dụng Angular CLI để tạo Component tự động (Standalone component):
    ```bash
    # Tạo component ở một thư mục cụ thể (VD: product-detail)
    npx ng generate component features/products/product-detail --standalone
    # Hoặc viết tắt:
    npx ng g c features/products/product-detail --standalone
    ```
    *Lệnh này sẽ tự động tạo file `.ts`, `.html`, `.scss` và kết nối chúng lại với nhau một cách chuyên nghiệp.*

- **Backend:**
  - Xóa build cũ và test: `mvn clean test`
  - Format code (nếu có spotless): `mvn spotless:apply`

- **Database:**
  - Xem log của Docker containers: `docker-compose logs -f`
  - Xem log của một service cụ thể: `docker-compose logs -f postgres`

---
*Chúc bạn có những trải nghiệm code tuyệt vời cùng Nexus ERP! Mọi thắc mắc vui lòng ping các senior trong team.*
