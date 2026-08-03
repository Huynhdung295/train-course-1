# 🗄️ Flyway & Liquibase — Database Schema Migration

> **Category**: Database | **Complexity**: Advanced | **Java**: 21+ | **Spring Boot**: 3.3+

---

## 📖 Core Technical Mechanics & Deep-Dive

### Why Schema Migration Tools?

Running `spring.jpa.hibernate.ddl-auto=create-drop` is acceptable in development but catastrophic in production:
- **Data Loss** — Drops tables → destroys data
- **No History** — No record of what changed or when
- **No Rollback** — Can't undo a bad change
- **No CI/CD** — Can't automate schema deployment

**Flyway** and **Liquibase** solve this by treating database schema as **code** — versioned, tested, and deployed through the same pipeline as application code.

### Flyway Internals

Flyway stores its state in a `flyway_schema_history` table:

```sql
-- Flyway tracks every applied migration
SELECT * FROM flyway_schema_history;

-- version | description        | type | script              | checksum    | installed_on | success
-- 1       | init               | SQL  | V1__init.sql        | -123456789  | 2024-01-01   | true
-- 2       | add users          | SQL  | V2__add_users.sql   | 987654321   | 2024-01-02   | true
-- 3       | add orders         | SQL  | V3__add_orders.sql  | 111222333   | 2024-01-03   | true
```

**Migration Types**:
- `V{version}__{description}.sql` — Versioned (runs once)
- `R__{description}.sql` — Repeatable (reruns when checksum changes)
- `U{version}__{description}.sql` — Undo (requires Flyway Teams)

**Flyway Migration Lifecycle**:
```
On application startup:
1. Connect to database
2. Create flyway_schema_history if not exists
3. Scan configured locations for migration scripts
4. Compare pending migrations with schema_history
5. Apply pending migrations IN VERSION ORDER
6. Record each migration (success or failure)
7. Application context continues startup if all succeed
```

### Liquibase Architecture

Liquibase uses **changeSets** (XML, YAML, JSON, or SQL format) tracked in `DATABASECHANGELOG` table. More complex but more powerful:
- **Rollback support** — Built-in rollback for every changeSet
- **Multiple formats** — XML, YAML, JSON, SQL
- **Context & labels** — Conditionally apply migrations
- **Diff & generate** — Generate changeLog from existing database

---

## 🌐 Real-World GitHub Patterns & Industry Reference

### Reference Projects
- **[flyway/flyway-spring-boot-quickstart](https://github.com/flyway/flyway/tree/main/flyway-spring-boot-sample)** — Official Flyway Spring Boot integration
- **[liquibase/liquibase-spring-boot](https://github.com/liquibase/liquibase)** — Official Liquibase samples
- **[jhipster database migrations](https://github.com/jhipster)** — JHipster uses Liquibase extensively

### Industry Best Practice: Naming Conventions

```
Flyway (preferred for most projects):
src/main/resources/db/migration/
├── V1__create_schema.sql
├── V2__create_users.sql
├── V3__create_orders.sql
├── V4__add_index_orders_user_id.sql
├── V5__add_payments.sql
├── V6__alter_orders_add_tenant.sql
├── R__create_views.sql            ← Repeatable: recreated when changed
└── R__create_functions.sql

Liquibase (better for enterprise multi-DB support):
src/main/resources/db/changelog/
├── db.changelog-master.yaml       ← Master include file
├── migrations/
│   ├── 001-create-schema.yaml
│   ├── 002-create-users.yaml
│   └── 003-create-orders.yaml
└── rollbacks/                     ← Optional rollback scripts
```

---

## 🏷️ Framework Annotations, Components & Dependencies

### Maven Dependencies

```xml
<!-- Flyway (pick ONE: flyway OR liquibase) -->
<dependency>
    <groupId>org.flywaydb</groupId>
    <artifactId>flyway-core</artifactId>
</dependency>

<!-- Flyway PostgreSQL support (required for PG 12+) -->
<dependency>
    <groupId>org.flywaydb</groupId>
    <artifactId>flyway-database-postgresql</artifactId>
</dependency>

<!-- OR Liquibase -->
<dependency>
    <groupId>org.liquibase</groupId>
    <artifactId>liquibase-core</artifactId>
</dependency>

<!-- PostgreSQL driver -->
<dependency>
    <groupId>org.postgresql</groupId>
    <artifactId>postgresql</artifactId>
    <scope>runtime</scope>
</dependency>
```

---

## ⚙️ Production Configuration & Tuning Parameters

### application.yml — Flyway Configuration

```yaml
spring:
  jpa:
    hibernate:
      ddl-auto: validate    # CRITICAL: validate only, never create/update
    open-in-view: false

  flyway:
    enabled: true
    locations:
      - classpath:db/migration
      - classpath:db/migration/{vendor}   # DB-vendor specific migrations
    baseline-on-migrate: false            # Only true for first migration on existing DB
    baseline-version: "0"
    validate-on-migrate: true             # Validate checksum on each run
    out-of-order: false                   # Reject out-of-order migrations in production
    
    # Repair: checksum mismatch fix (use carefully)
    # spring.flyway.repair-on-migrate: false
    
    # Locking: prevents concurrent migrations in multi-instance deployments
    lock-retry-count: 50
    
    # Connection info (can use separate user with DDL privileges)
    url: ${spring.datasource.url}
    user: ${DB_MIGRATION_USER:${spring.datasource.username}}
    password: ${DB_MIGRATION_PASSWORD:${spring.datasource.password}}
    
    # Schemas to manage
    schemas: public
    
    # Table name for version history
    table: flyway_schema_history
    
    # Encoding
    encoding: UTF-8
    
    # Placeholders in SQL scripts (e.g., ${schema})
    placeholders:
      schema: public
      environment: ${spring.profiles.active:prod}

  # application.yml for Liquibase (alternative)
  liquibase:
    enabled: true
    change-log: classpath:db/changelog/db.changelog-master.yaml
    contexts: ${spring.profiles.active:prod}
    default-schema: public
    liquibase-schema: liquibase_meta
    drop-first: false             # NEVER true in production
    test-rollback-on-update: false

# Separate DB credentials for migrations (principle of least privilege)
# Migration user needs DDL (CREATE, ALTER, DROP)
# Application user needs only DML (SELECT, INSERT, UPDATE, DELETE)
```

---

## 📐 System Design Blueprint & Architecture Patterns

### Complete Migration Suite

#### Flyway Migration Scripts

```sql
-- V1__create_schema.sql
-- Initial database setup

-- Extension for UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Audit trigger function (shared by all tables)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- V2__create_users.sql
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(255) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    first_name      VARCHAR(100),
    last_name       VARCHAR(100),
    phone_number    VARCHAR(20),
    phone_verified  BOOLEAN DEFAULT FALSE,
    status          VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
                    CHECK (status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING_VERIFICATION')),
    tenant_id       VARCHAR(100),
    totp_secret     BYTEA,             -- AES-256 encrypted
    totp_enabled    BOOLEAN DEFAULT FALSE,
    failed_login_attempts  INTEGER DEFAULT 0,
    locked_until    TIMESTAMPTZ,
    last_login_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at      TIMESTAMPTZ           -- soft delete
);

CREATE TRIGGER users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Indexes
CREATE INDEX idx_users_email ON users(email) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_tenant_id ON users(tenant_id);
CREATE INDEX idx_users_status ON users(status) WHERE deleted_at IS NULL;

-- V3__create_roles.sql
CREATE TABLE roles (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(50) NOT NULL UNIQUE,
    description VARCHAR(200),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_roles (
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id     UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    granted_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    granted_by  UUID REFERENCES users(id),
    PRIMARY KEY (user_id, role_id)
);

INSERT INTO roles (name, description) VALUES
    ('USER', 'Standard authenticated user'),
    ('ADMIN', 'System administrator'),
    ('SUPPORT', 'Customer support staff'),
    ('PREMIUM', 'Premium subscription user');

-- V4__create_orders.sql
CREATE TABLE orders (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id),
    tenant_id       VARCHAR(100),
    status          VARCHAR(30) NOT NULL DEFAULT 'PENDING'
                    CHECK (status IN ('PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 
                                      'DELIVERED', 'CANCELLED', 'REFUNDED')),
    total_amount    DECIMAL(19, 4) NOT NULL CHECK (total_amount >= 0),
    currency        VARCHAR(3) NOT NULL DEFAULT 'USD',
    shipping_street VARCHAR(255),
    shipping_city   VARCHAR(100),
    shipping_state  VARCHAR(100),
    shipping_postal VARCHAR(20),
    shipping_country VARCHAR(2),
    notes           TEXT,
    version         INTEGER NOT NULL DEFAULT 0,   -- optimistic locking
    placed_at       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    confirmed_at    TIMESTAMPTZ,
    shipped_at      TIMESTAMPTZ,
    delivered_at    TIMESTAMPTZ,
    cancelled_at    TIMESTAMPTZ,
    cancellation_reason TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at      TIMESTAMPTZ
);

CREATE TABLE order_lines (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id        UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id      UUID NOT NULL,
    product_name    VARCHAR(255) NOT NULL,  -- denormalized for order history
    quantity        INTEGER NOT NULL CHECK (quantity > 0),
    unit_price      DECIMAL(19, 4) NOT NULL CHECK (unit_price >= 0),
    line_total      DECIMAL(19, 4) GENERATED ALWAYS AS (quantity * unit_price) STORED,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER orders_updated_at
    BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX idx_orders_user_id ON orders(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_orders_status ON orders(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_orders_tenant_id ON orders(tenant_id);
CREATE INDEX idx_orders_placed_at ON orders(placed_at DESC);
CREATE INDEX idx_order_lines_order_id ON order_lines(order_id);

-- V5__create_outbox.sql (Transactional Outbox Pattern)
CREATE TABLE outbox_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aggregate_type  VARCHAR(100) NOT NULL,
    aggregate_id    VARCHAR(100) NOT NULL,
    event_type      VARCHAR(200) NOT NULL,
    payload         JSONB NOT NULL,
    headers         JSONB,
    status          VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                    CHECK (status IN ('PENDING', 'SENT', 'FAILED')),
    retry_count     INTEGER NOT NULL DEFAULT 0,
    next_retry_at   TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    sent_at         TIMESTAMPTZ
);

CREATE INDEX idx_outbox_status_retry ON outbox_events(status, next_retry_at)
    WHERE status IN ('PENDING', 'FAILED');
CREATE INDEX idx_outbox_aggregate ON outbox_events(aggregate_type, aggregate_id);
```

#### Liquibase YAML Format (Alternative)

```yaml
# db.changelog-master.yaml
databaseChangeLog:
  - includeAll:
      path: migrations/
      relativeToChangelogFile: true

# migrations/001-create-users.yaml
databaseChangeLog:
  - changeSet:
      id: 001-create-users
      author: dev-team
      context: "!test"   # Skip in test context
      labels: users, schema
      changes:
        - createTable:
            tableName: users
            columns:
              - column:
                  name: id
                  type: UUID
                  defaultValueComputed: gen_random_uuid()
                  constraints:
                    primaryKey: true
              - column:
                  name: email
                  type: VARCHAR(255)
                  constraints:
                    nullable: false
                    unique: true
              - column:
                  name: status
                  type: VARCHAR(20)
                  defaultValue: ACTIVE
                  constraints:
                    nullable: false
        - createIndex:
            tableName: users
            indexName: idx_users_email
            columns:
              - column:
                  name: email
      rollback:
        - dropTable:
            tableName: users
```

---

## 🧪 Verification, Testing & Infrastructure Commands

### Docker: PostgreSQL for Migration Testing

```powershell
# Start PostgreSQL
docker run -d --name postgres-dev -p 5432:5432 `
  -e POSTGRES_DB=app_db `
  -e POSTGRES_USER=app_user `
  -e POSTGRES_PASSWORD=app_secret `
  postgres:16-alpine

# Wait for PG to be ready
Start-Sleep -Seconds 2

# Run migrations
./mvnw spring-boot:run -Dspring-boot.run.profiles=migrate-only

# OR use Flyway Maven plugin directly
./mvnw flyway:migrate -Dflyway.url="jdbc:postgresql://localhost:5432/app_db" `
    -Dflyway.user=app_user `
    -Dflyway.password=app_secret

# Check Flyway status
./mvnw flyway:info -Dflyway.url="jdbc:postgresql://localhost:5432/app_db" `
    -Dflyway.user=app_user `
    -Dflyway.password=app_secret

# Validate checksums (useful after repo clone)
./mvnw flyway:validate

# Repair checksum mismatches (CAREFUL — only in dev)
./mvnw flyway:repair

# View schema history directly
docker exec postgres-dev psql -U app_user -d app_db `
    -c "SELECT version, description, installed_on, success FROM flyway_schema_history ORDER BY installed_rank"
```

### Testcontainers with Flyway

```java
@SpringBootTest
@Testcontainers
class FlywayMigrationTest {

    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine")
        .withDatabaseName("test_db")
        .withUsername("test_user")
        .withPassword("test_pass");

    @DynamicPropertySource
    static void postgresProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
    }

    @Autowired
    private DataSource dataSource;

    @Test
    void allMigrationsShouldApplySuccessfully() {
        // If context loads, all migrations succeeded
        assertDoesNotThrow(() -> {
            try (var conn = dataSource.getConnection()) {
                assertTrue(conn.isValid(1));
            }
        });
    }

    @Test
    void schemaHistoryShouldContainAllExpectedMigrations() {
        var flyway = Flyway.configure()
            .dataSource(dataSource)
            .load();

        var info = flyway.info();
        var applied = Arrays.stream(info.applied()).toList();

        assertThat(applied).isNotEmpty();
        assertThat(applied).allMatch(m -> m.getState() == MigrationState.SUCCESS);
    }
}
```

---

## ⚡ Senior Best Practices & Critical Anti-Patterns

### ✅ Best Practices

1. **Separate migration user from application user** — Migration user needs DDL (CREATE, ALTER, DROP); app user needs only DML (SELECT, INSERT, UPDATE, DELETE). Principle of least privilege.

2. **Never modify applied migrations** — Once a migration is applied and deployed, it is immutable. Create a new migration to undo or modify.

3. **Test rollback in staging** — Run migrations, then rollback, then re-migrate before promoting to production.

4. **Use Flyway callbacks for complex scenarios**:
   ```java
   @Component
   public class FlywayCallback implements Callback {
       @Override
       public boolean supports(Event event, Context context) {
           return event == Event.AFTER_EACH_MIGRATE;
       }
       @Override
       public void handle(Event event, Context context) {
           // Refresh materialized views, update statistics, etc.
       }
   }
   ```

5. **Use `baseline-on-migrate: true` ONLY ONCE** — When first adopting Flyway on an existing database. Never leave it on.

6. **Include both DDL and required DML in migrations** — Reference data (roles, permissions, config) should be part of versioned migrations.

### ❌ Critical Anti-Patterns

| Anti-Pattern | Problem | Fix |
|-------------|---------|-----|
| **`ddl-auto=update` in production** | Hibernate drops and recreates columns unexpectedly | Always `validate`; use Flyway for all schema changes |
| **Modifying applied migration scripts** | Checksum mismatch → startup failure in all environments | Never modify; create new migration to fix |
| **Shared migration user = app user** | If app user is compromised, attacker can DROP TABLE | Separate DDL user for migrations |
| **No baseline on existing DB** | Flyway fails with "schema history table empty" | Run `flyway baseline` once with current version before enabling |
| **Giant monolithic V1__init.sql** | Hard to review, debug, and rollback | Split into focused, single-concern migrations |
| **SQL without `IF NOT EXISTS`** | Re-running repair or failed migration fails | Always use `IF NOT EXISTS` / `IF EXISTS` for safety |
| **Not testing migrations in CI** | Migration failures discovered in production | Use Testcontainers to run real migration in CI pipeline |

---

*Next: [02-spring-data-jpa-hibernate6-tuning.md](./02-spring-data-jpa-hibernate6-tuning.md)*
