# 🚀 MASTER BOOTSTRAP: INIT_PROJECT

> **Mục đích**: Đây là tệp lệnh Tối cao (Root Script) dùng để hướng dẫn bất kỳ Lập trình viên hay AI Agent nào cách thức Đọc Tri Thức và Khởi tạo Source Code dự án từ con số 0.

---

## 🛑 BƯỚC 1: KHỞI TẠO HẠ TẦNG (INFRASTRUCTURE & DATABASE LOCAL)

Bạn không thể code Backend nếu không có CSDL. Do đó, phải dựng Infra trước.
1. Đọc tài liệu: `APP.md` và `Infra/docs/02-docker-containerization/03-docker-compose-environments.md`.
2. Tạo thư mục `Infra/local-env/` và viết tệp `docker-compose.yml`.
3. Trong tệp đó, khai báo các container cần thiết:
   - **PostgreSQL 16** (Tham khảo `Database/docs/01-postgresql-architecture/`).
   - **Redis 7** (Tham khảo `Database/docs/02-nosql-caching/01-redis-cluster-ha.md`).
   - **Kafka** (Nếu dự án có Event-Driven, tham khảo `Database/docs/04-data-streaming-cdc/`).
4. Khởi chạy bằng lệnh: `docker compose up -d`.
5. Dùng **TablePlus** hoặc **DBeaver** kết nối vào `localhost:5432` để đảm bảo CSDL đã sẵn sàng.

---

## 🛑 BƯỚC 2: KHỞI TẠO SOURCE CODE BACKEND (SPRING BOOT)

Sau khi CSDL đã chạy, tiến hành tạo khung dự án Backend.

1. Sử dụng Spring Initializr (qua Web hoặc lệnh `curl`) để tạo dự án với Java 21, Spring Boot 3.3+.
   - Cần import các Dependencies: `Web, Data JPA, PostgreSQL, Validation, Lombok, Actuator, Flyway`.
2. Tạo cấu trúc thư mục theo chuẩn **Modular Monolith** hoặc **Clean Architecture**:
   - Tham khảo `Backend/docs/01-architecture/02-modular-monolith-spring-modulith.md`
   - Hoặc `Backend/docs/01-architecture/01-clean-hexagonal-architecture.md`
3. Cấu hình file `application.yml` theo chuẩn:
   - Tham khảo `Backend/docs/08-production-boilerplate/04-configuration-properties-profiles.md`
   - Cấu hình HikariCP, JPA Hibernate Tuning (`Backend/docs/03-database/02-spring-data-jpa-hibernate6-tuning.md`).
4. Viết kịch bản khởi tạo DB bằng Flyway:
   - Tham khảo `Backend/docs/03-database/01-flyway-liquibase-migration.md`.
   - Tạo file `V1__init_schema.sql`.

---

## 🛑 BƯỚC 3: ÁP DỤNG CÁC BEST PRACTICES (SKILLS)

Trong quá trình Code, AI Agent BẮT BUỘC phải tham chiếu và sử dụng các thư mục SKILLS (Là các đoạn code mẫu tốt nhất):
1. Khi thiết kế Bảng CSDL (Entity): Bắt buộc đọc `Backend/skills/spring-jpa-entity/SKILL.md` để biết cách tạo BaseEntity có Audit, dùng UUID làm khóa chính.
2. Khi thiết kế API (Controller): Bắt buộc đọc `Backend/skills/spring-rest-controller/SKILL.md` để biết cách gói Response theo chuẩn RFC 7807, dùng DTO thay cho Entity.
3. Khi viết Unit Test: Bắt buộc đọc `Backend/skills/spring-junit-test/SKILL.md`.

---

## 🛑 BƯỚC 4: TRIỂN KHAI PRODUCTION (CI/CD & DEPLOYMENT)

Sau khi code xong 1 tính năng và muốn đưa lên máy chủ thật (VPS / Kubernetes):
1. Bọc Source code vào Dockerfile:
   - Tham khảo `Infra/docs/02-docker-containerization/01-spring-boot-dockerfile.md` (Dùng kỹ thuật Layered Jars, Rootless User).
2. Tạo GitHub Actions Pipeline để tự động build và push image.
   - Tham khảo `Infra/docs/03-ci-cd-pipelines/01-github-actions-gitlab-ci.md`.
3. Khởi tạo Metrics cho Prometheus & Grafana:
   - Đọc `Infra/docs/06-monitoring-observability/01-node-exporter-cadvisor.md`.

---

> **LỜI NHẮC GỬI AI AGENT**:
> Khi nhận được lệnh "Hãy code cho tôi tính năng X", trước tiên hãy đối chiếu với tệp `INIT_PROJECT.md` này để xác định vị trí của tính năng X trong kiến trúc tổng thể, sau đó mới bắt đầu viết code!
