# Nexus ERP - Routing & Infrastructure Guide

Dưới đây là danh sách toàn bộ các đường dẫn (Router/Endpoints) và Port quan trọng của hệ thống backend cũng như các dịch vụ hạ tầng đi kèm.

## 1. Ứng dụng Backend (Spring Boot)
- **Swagger UI (Xem & Test API):** [http://localhost:8080/swagger-ui.html](http://localhost:8080/swagger-ui.html)
- **OpenAPI Docs (dạng JSON):** [http://localhost:8080/v3/api-docs](http://localhost:8080/v3/api-docs)

## 2. Các dịch vụ hạ tầng (Docker Compose)
*(Thư mục chứa: `source_database/docker/docker-compose.yml`)*

- **Keycloak (Quản lý User & Auth):**
  - **1. Đăng nhập quản trị hệ thống (Master Realm):** [http://localhost:8180/](http://localhost:8180/)
    - *Tài khoản admin cao nhất:* `admin` / `admin123`
    - *(Lưu ý khắc phục lỗi sai pass: Hãy chạy lệnh `docker-compose down -v` ở thư mục chứa docker rồi `up -d` lại để reset Database xóa mật khẩu cũ).*
  - **2. Đăng nhập ứng dụng ERP (Nexus Realm):** [http://localhost:8180/realms/nexus/account](http://localhost:8180/realms/nexus/account)
    - *Tài khoản Demo/Test:* Khởi tạo tự động từ file `source_database/docker/keycloak/realm-export.json`.
    - `superadmin` / `Admin@123456` (email: superadmin@nexus.com)
    - `demo_admin` / `Demo@123456` (email: admin@demo.nexus.com)
    - *(Lưu ý: Mọi tài khoản test này CHỈ đăng nhập được vào Nexus Realm, KHÔNG đăng nhập được vào Master Admin).*
- **RabbitMQ (Giao diện quản lý Message Queue):** [http://localhost:15672](http://localhost:15672)
  - *Tài khoản mặc định:* `guest` / `guest`
  - *Giao thức AMQP (Backend kết nối):* Port `5672`
- **Kafka UI (Giao diện quản lý Event/Topic):** [http://localhost:8082](http://localhost:8082)
  - *Giao thức Kafka (Backend kết nối):* Port `9092` (bên trong docker) / `9093` (bên ngoài host)
- **Kibana (Xem log & Dữ liệu Elasticsearch):** [http://localhost:5601](http://localhost:5601)
  - *Elasticsearch API:* Port `9200`
- **PostgreSQL (Cơ sở dữ liệu chính):** Port `5432`
  - *Tài khoản:* `nexus_admin` / `nexus_secret`
  - *Tên Database:* `nexus_erp`
- **Redis (Cache & Distributed Lock):** Port `6379`
