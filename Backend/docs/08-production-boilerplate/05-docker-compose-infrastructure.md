# 🐳 Docker Compose Local Infrastructure

> **Category**: Production Boilerplate | **Complexity**: Foundation | **DevOps**

---

## 📖 Core Technical Mechanics & Deep-Dive

### The Local Development Problem
A modern Spring Boot microservice depends on numerous external systems:
- PostgreSQL (Database)
- Redis (Caching & Rate Limiting)
- Kafka & Zookeeper (Messaging)
- Keycloak (Authentication / OAuth2)
- Jaeger / OpenTelemetry (Tracing)

Expecting every developer to manually install and configure these services natively on their macOS/Windows machine is a recipe for the "Works on my machine" anti-pattern.

### The Solution: Docker Compose
`docker-compose.yml` provides a single-command (`docker-compose up -d`) declarative environment. It guarantees that every developer runs the exact same versions of the exact same infrastructure, with the exact same passwords, ports, and initialized databases.

### Spring Boot 3 & Testcontainers
Spring Boot 3 introduced `@ServiceConnection` and Docker Compose integration natively. If a `compose.yaml` file exists in the root of your project, Spring Boot will automatically start it when you run the application and inject the correct ports into your application context without needing `application-local.yml` property overrides!

---

## 🌐 Real-World GitHub Patterns & Industry Reference

- **[spring-projects/spring-boot-docker-compose](https://docs.spring.io/spring-boot/docs/current/reference/htmlsingle/#features.docker-compose)** — Spring Boot 3's native compose integration.

---

## 🏷️ Framework Dependencies

*For automatic Compose startup and property injection in Dev:*
```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-docker-compose</artifactId>
    <scope>runtime</scope>
    <optional>true</optional>
</dependency>
```

---

## 📐 System Design Blueprint

### Complete Enterprise `compose.yaml`

Place this in the root of your Spring Boot project (`/compose.yaml`).

```yaml
version: '3.8'

# Defines the isolated network for all containers to communicate
networks:
  backend-net:
    driver: bridge

# Persist DB/Cache data across container restarts
volumes:
  pg_data:
  redis_data:
  kafka_data:
  zookeeper_data:

services:
  # ═══════════════════════════════════════════════════
  # 1. POSTGRESQL (Database)
  # ═══════════════════════════════════════════════════
  postgres:
    image: postgres:16-alpine
    container_name: dev-postgres
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: app_user
      POSTGRES_PASSWORD: app_password
      POSTGRES_DB: app_db
    volumes:
      - pg_data:/var/lib/postgresql/data
    networks:
      - backend-net
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U app_user -d app_db"]
      interval: 5s
      timeout: 5s
      retries: 5

  # ═══════════════════════════════════════════════════
  # 2. REDIS (Caching, Rate Limiting, Pub/Sub)
  # ═══════════════════════════════════════════════════
  redis:
    image: redis:7-alpine
    container_name: dev-redis
    ports:
      - "6379:6379"
    command: redis-server --requirepass "redis_password"
    volumes:
      - redis_data:/data
    networks:
      - backend-net
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "redis_password", "ping"]
      interval: 5s
      timeout: 3s
      retries: 3

  # ═══════════════════════════════════════════════════
  # 3. KAFKA & ZOOKEEPER (Messaging)
  # ═══════════════════════════════════════════════════
  zookeeper:
    image: bitnami/zookeeper:3.9
    container_name: dev-zookeeper
    ports:
      - "2181:2181"
    environment:
      ALLOW_ANONYMOUS_LOGIN: "yes"
    volumes:
      - zookeeper_data:/bitnami/zookeeper
    networks:
      - backend-net

  kafka:
    image: bitnami/kafka:3.7
    container_name: dev-kafka
    ports:
      - "9092:9092"   # Internal Docker port
      - "29092:29092" # External host port (for Spring Boot running on localhost)
    environment:
      ALLOW_PLAINTEXT_LISTENER: "yes"
      KAFKA_CFG_ZOOKEEPER_CONNECT: zookeeper:2181
      # IMPORTANT: Listeners configure how clients connect. 
      # INTERNAL is for containers in the same network. EXTERNAL is for your IDE on localhost.
      KAFKA_CFG_LISTENERS: INTERNAL://:9092,EXTERNAL://:29092
      KAFKA_CFG_ADVERTISED_LISTENERS: INTERNAL://kafka:9092,EXTERNAL://localhost:29092
      KAFKA_CFG_LISTENER_SECURITY_PROTOCOL_MAP: INTERNAL:PLAINTEXT,EXTERNAL:PLAINTEXT
      KAFKA_CFG_INTER_BROKER_LISTENER_NAME: INTERNAL
    volumes:
      - kafka_data:/bitnami/kafka
    networks:
      - backend-net
    depends_on:
      - zookeeper

  # ═══════════════════════════════════════════════════
  # 4. KEYCLOAK (OIDC Authentication Provider)
  # ═══════════════════════════════════════════════════
  keycloak:
    image: quay.io/keycloak/keycloak:24.0
    container_name: dev-keycloak
    ports:
      - "8081:8080" # Maps to 8081 to avoid conflict with Spring Boot on 8080
    environment:
      KEYCLOAK_ADMIN: admin
      KEYCLOAK_ADMIN_PASSWORD: admin
    command: start-dev # Runs Keycloak in dev mode (in-memory DB, no HTTPS required)
    networks:
      - backend-net
    healthcheck:
      test: ["CMD-SHELL", "exec 3<>/dev/tcp/127.0.0.1/8080;echo -e 'GET /health/ready HTTP/1.1\r\nhost: localhost:8080\r\nConnection: close\r\n\r\n' >&3;grep '200 OK' <&3"]
      interval: 10s
      timeout: 5s
      retries: 5

  # ═══════════════════════════════════════════════════
  # 5. JAEGER (Distributed Tracing / OpenTelemetry)
  # ═══════════════════════════════════════════════════
  jaeger:
    image: jaegertracing/all-in-one:1.55
    container_name: dev-jaeger
    ports:
      - "16686:16686" # UI
      - "4317:4317"   # OTLP gRPC receiver
      - "4318:4318"   # OTLP HTTP receiver
    environment:
      COLLECTOR_OTLP_ENABLED: "true"
    networks:
      - backend-net
```

---

## 🧪 Verification Commands

```powershell
# 1. Start all infrastructure in the background
docker-compose up -d

# 2. Check the status of all containers
docker-compose ps

# 3. View logs of a specific service if it failed to start
docker-compose logs -f kafka

# 4. Tear down everything and DELETE volumes (fresh start)
docker-compose down -v
```

---

## ⚡ Best Practices & Anti-Patterns

### ✅ Best Practices
1. **Name it `compose.yaml` (not `docker-compose.yml`)**. The modern Docker specification prefers `compose.yaml`. Spring Boot 3 auto-detects this.
2. **Always include `healthcheck` blocks**. If your Spring Boot app starts faster than Postgres, it will crash. Healthchecks allow you to use `depends_on: postgres: condition: service_healthy`.
3. **Use `.env` files for secrets if committing to a public repo**. (Though for local development, hardcoded passwords like `app_password` in the `compose.yaml` are generally accepted as they are only used locally).

### ❌ Anti-Patterns

| Anti-Pattern | Problem | Fix |
|-------------|---------|-----|
| Putting the Spring Boot application itself in the dev `compose.yaml` | Developers lose hot-reloading and IDE debugger attachment. | Keep Spring Boot running natively in the IDE. Only put *dependencies* in `compose.yaml`. |
| Not mapping external Kafka listeners | Spring Boot running on `localhost` cannot resolve the internal Docker hostname `kafka`. | Configure `KAFKA_CFG_ADVERTISED_LISTENERS` with both internal and external (localhost) routes. |
| Forgetting to map volumes | If you restart Docker, you lose all database tables, Kafka topics, and Keycloak realms. | Always declare `volumes:` for stateful services. |
