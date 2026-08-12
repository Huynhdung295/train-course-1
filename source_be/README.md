# Nexus Core API — Backend (source_be)

Spring Boot 3.3 | Java 21 | Modular Monolith

## 🚀 Chạy nhanh (Quick Start)

### Option 1: Local — H2 In-Memory (Không cần Docker)
```bash
mvn spring-boot:run -Dspring-boot.run.profiles=local
```
- App: http://localhost:8080
- Swagger UI: http://localhost:8080/swagger-ui.html
- H2 Console: http://localhost:8080/h2-console

### Option 2: Dev — PostgreSQL + Redis + Kafka (Cần Docker)
```bash
# 1. Khởi động hạ tầng local
docker compose up -d

# 2. Chạy app với profile dev
mvn spring-boot:run -Dspring-boot.run.profiles=dev
```
- Kafka UI: http://localhost:8082
- MailHog: http://localhost:8025
- RedisInsight: http://localhost:8001

### Option 3: Dùng biến môi trường
```bash
cp .env.example .env
# Chỉnh sửa .env theo môi trường
SPRING_PROFILES_ACTIVE=prod java -jar target/core-api.jar
```

---

## 🗂 Cấu trúc Package

```
com/app/
├── common/               # Shared infrastructure (Config, Security, Utils)
│   ├── config/           # SecurityConfig, WebMvcConfig, AsyncConfig, OpenApiConfig
│   ├── domain/           # AggregateRoot interface (DDD)
│   ├── dto/              # ApiResponse<T>, PageResponse<T>
│   ├── entity/           # BaseEntity (UUID PK, Audit, @Version)
│   ├── event/            # DomainEvent interface
│   ├── exception/        # GlobalExceptionHandler (RFC 7807)
│   ├── security/         # JWT, ABAC, MFA, OAuth2, WebAuthn
│   └── tenant/           # TenantInterceptor, TenantContextHolder
├── orders/               # Orders Bounded Context
├── products/             # Products Bounded Context
├── inventory/            # Inventory Bounded Context
└── users/                # Users Bounded Context
```

---

## 🔐 Xác thực API (Swagger)

1. Mở http://localhost:8080/swagger-ui.html
2. Gọi `POST /api/v1/auth/login` → copy `access_token`
3. Bấm nút **Authorize** (🔒) ở góc phải
4. Paste: `Bearer <access_token>`
5. Tất cả API call tự động gắn token!

---

## 📋 Cấu hình theo môi trường

| Profile | DB | Redis/Kafka | Mục đích |
|---|---|---|---|
| `local` | H2 In-Memory | Tắt | Dev nhanh, không cần Docker |
| `dev` | PostgreSQL Local | Docker | Phát triển đầy đủ tính năng |
| `staging` | PostgreSQL Remote | Cloud | Test UAT trước khi lên Prod |
| `prod` | PgBouncer → PostgreSQL | VPS | Production |
