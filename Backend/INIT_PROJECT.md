# 🚀 INITIALIZE PROJECT (MASTER BOOTSTRAP GUIDE)

> **Mục tiêu**: Đây là tài liệu tối cao (Master Guide) dành cho AI Agent hoặc Developer để khởi tạo toàn bộ source code của dự án Spring Boot từ con số 0 vào thư mục `source`. Mọi dòng code được sinh ra phải tuân thủ tuyệt đối 49 tệp tài liệu trong thư mục `docs/` và các luật trong `skills/`.

---

## 🤖 CHỈ THỊ DÀNH CHO AI AGENT (AI SYSTEM PROMPT)

**Gửi AI Agent (như Cursor, Windsurf, Cline, v.v.):** 
Nếu bạn được yêu cầu "Khởi tạo dự án", bạn **KHÔNG ĐƯỢC PHÉP** tự ý sinh code theo ý mình. Bạn **BẮT BUỘC** phải thực hiện theo đúng trình tự các pha (Phases) dưới đây. Trước khi code bất kỳ module nào, bạn phải đọc tài liệu tương ứng trong thư mục `docs/`.

---

## 📋 TRÌNH TỰ KHỞI TẠO DỰ ÁN (PROJECT INITIALIZATION WORKFLOW)

### Phase 1: Bootstrapping (Tạo khung xương dự án)
1. Chuyển vào thư mục `source`.
2. Sử dụng Spring Initializr (thông qua lệnh `curl` hoặc tạo file `pom.xml` trực tiếp) để tạo dự án với các thông số:
   - **Java Version**: 21
   - **Spring Boot Version**: 3.3.x (hoặc mới nhất)
   - **Build Tool**: Maven (hoặc Gradle tùy quyết định của User)
   - **Dependencies cơ bản**: Web, Data JPA, PostgreSQL, Validation, Security, Actuator, Testcontainers.
3. Tổ chức cấu trúc Package theo chuẩn **Package by Feature** (Đọc lại: `docs/01-architecture/02-package-by-feature.md`).

### Phase 2: Hạ tầng Local & Database (Local Infrastructure)
1. Tạo file `compose.yaml` tại thư mục gốc của `source` (Đọc lại: `docs/08-production-boilerplate/05-docker-compose-infrastructure.md`).
   - Đảm bảo có PostgreSQL, Redis, Kafka, Jaeger.
2. Thiết lập Flyway/Liquibase migration script đầu tiên: `V1__init_schema.sql` (Đọc lại: `docs/03-database/01-flyway-liquibase.md`).

### Phase 3: Production Boilerplate (Các tệp nền tảng bắt buộc)
AI bắt buộc phải tạo các class nền tảng sau trước khi viết bất kỳ Business Logic nào:
1. **BaseEntity**: Tạo class `@MappedSuperclass` với JPA Auditing & Soft Delete (Đọc lại: `docs/08-production-boilerplate/01-base-entity-audit-trail.md`).
2. **Global Exception Handler**: Tạo `@RestControllerAdvice` trả về định dạng RFC 7807 (Đọc lại: `docs/07-observability-ops/01-global-error-handling-rfc7807.md`).
3. **Type-safe Properties**: Xóa `@Value`, thay bằng `@ConfigurationProperties` Records (Đọc lại: `docs/08-production-boilerplate/04-configuration-properties-profiles.md`).
4. **Jackson Customizer**: Cấu hình ObjectMapper (Đọc lại: `docs/08-production-boilerplate/02-custom-jackson-serializers.md`).

### Phase 4: Security & Observability (Bảo mật & Theo dõi)
1. **Security Filter Chain**: Thiết lập Stateless JWT Security (Đọc lại: `docs/02-security/04-jwt-stateless-sessions.md`).
2. **Logging**: Thiết lập `logback-spring.xml` để in ra JSON Format (Đọc lại: `docs/07-observability-ops/05-structured-logging-elk-stack.md`).
3. **Metrics/Tracing**: Kích hoạt OpenTelemetry trong `application.yml` (Đọc lại: `docs/07-observability-ops/04-distributed-tracing-opentelemetry.md`).

---

## 🛠️ CÁCH SỬ DỤNG FILE NÀY (CHO USER)

Khi bạn muốn bắt đầu code thật, bạn chỉ cần gõ vào khung chat của AI câu lệnh sau:

> *"Hãy đọc kỹ file `Backend/INIT_PROJECT.md` và bắt đầu thực hiện Phase 1 và Phase 2 để khởi tạo mã nguồn vào folder `Backend/source` cho tôi. Hãy hỏi tôi các thông tin cần thiết (như tên package, maven/gradle) trước khi chạy lệnh."*

Sau khi AI hoàn thành Phase 1 & 2, bạn tiếp tục ra lệnh:

> *"Tốt lắm, tiếp tục thực hiện Phase 3 và Phase 4. Nhớ đọc kỹ các file tham chiếu trong thư mục `docs/` trước khi tạo các class Boilerplate."*

---

## 🚫 NHỮNG LỖI CẦN TRÁNH (ANTI-PATTERNS)
- Tuyệt đối không dùng `java.util.Date`, bắt buộc dùng `java.time.Instant`.
- Tuyệt đối không dùng `@Data` cho JPA Entity.
- Tuyệt đối không bỏ logic nghiệp vụ (Business logic) vào Controller. Controller chỉ có nhiệm vụ Validate DTO và điều phối.
- Mọi API phải trả về `ResponseEntity`.
- Mọi ngoại lệ (Exceptions) không được dùng `try-catch` trong Controller, hãy quăng (throw) ra ngoài để `GlobalExceptionHandler` xử lý.
