# ⚡ Spring Data JPA & Hibernate 6 — Production Tuning

> **Category**: Database | **Complexity**: Expert | **Java**: 21+ | **Spring Boot**: 3.3+ | **Hibernate**: 6.5+

---

## 📖 Core Technical Mechanics & Deep-Dive

### Hibernate 6 Architecture Changes

Hibernate 6 (bundled with Spring Boot 3.x) introduced significant internal changes:
- **New SQL AST** — Complete rewrite of SQL generation for better type safety
- **Jakarta EE namespace** — `javax.persistence.*` → `jakarta.persistence.*`
- **Improved statistics** — Better query plan cache, L2 cache hit/miss tracking
- **Virtual thread safety** — Improved session handling for Project Loom
- **UUID mapping** — Native UUID type support in PostgreSQL without `@Type`

### Hibernate Session Lifecycle

```
EntityManagerFactory (one per application — expensive to create)
    │
    └── EntityManager (one per request/transaction — lightweight)
             │
             ├── First-Level Cache (L1) — PersistenceContext
             │   └── All loaded entities cached for THIS session lifetime
             │   └── Dirty checking at flush time (before commit)
             │
             ├── Transaction management
             │   └── flush() called at: transaction commit, before query with JPQL
             │
             └── Close → entities become DETACHED (no session tracking)
```

### StatelessSession — For Batch Processing

```java
// Standard session has L1 cache overhead — bad for bulk processing
// StatelessSession bypasses L1 cache, dirty checking, interceptors
StatelessSession statelessSession = sessionFactory.openStatelessSession();
// Use for: bulk inserts, ETL processing, migrations
// Does NOT: track entities, fire events, use L1 cache
```

### Hibernate Statistics — Monitor in Development

```java
@Configuration
public class HibernateStatsConfig {

    @Bean
    public ApplicationListener<ApplicationReadyEvent> statisticsLogger(EntityManagerFactory emf) {
        return event -> {
            var statistics = emf.unwrap(SessionFactory.class).getStatistics();
            statistics.setStatisticsEnabled(true);
            log.info("Hibernate statistics enabled");
        };
    }
}

// Then check:
// statistics.getQueryExecutionCount()       ← total queries
// statistics.getSecondLevelCacheHitCount()  ← L2 cache hits
// statistics.getEntityLoadCount()           ← entities loaded
// statistics.getFlushCount()                ← session flushes
```

---

## 🌐 Real-World GitHub Patterns & Industry Reference

### Reference Resources
- **[vladmihalcea/high-performance-java-persistence](https://github.com/vladmihalcea/high-performance-java-persistence)** — The definitive performance book companion code
- **[Spring Data JPA Samples](https://github.com/spring-projects/spring-data-examples/tree/main/jpa)** — Official Spring Data JPA examples
- **[thorben-janssen/hibernate-tips](https://github.com/thjanssen/HibernateCoreTips)** — Thorben Janssen's Hibernate performance tips

---

## 🏷️ Framework Annotations, Components & Dependencies

### Maven Dependencies

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-data-jpa</artifactId>
</dependency>

<!-- PostgreSQL driver -->
<dependency>
    <groupId>org.postgresql</groupId>
    <artifactId>postgresql</artifactId>
    <scope>runtime</scope>
</dependency>

<!-- HikariCP (default in Spring Boot — no need to add explicitly) -->
<!-- Hibernate Validator -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-validation</artifactId>
</dependency>

<!-- Hibernate Envers for audit history -->
<dependency>
    <groupId>org.hibernate.orm</groupId>
    <artifactId>hibernate-envers</artifactId>
</dependency>
```

### Key JPA/Hibernate Annotations

| Annotation | Purpose | Key Parameters |
|-----------|---------|----------------|
| `@Entity` | Mark class as JPA entity | `name` |
| `@Table` | Map to DB table | `name`, `indexes`, `uniqueConstraints` |
| `@Id` | Primary key | - |
| `@GeneratedValue` | PK generation strategy | `strategy = IDENTITY/SEQUENCE/UUID` |
| `@Column` | Column mapping | `name`, `nullable`, `length`, `precision`, `scale`, `unique`, `updatable` |
| `@Enumerated` | Enum storage | `EnumType.STRING` (always use STRING) |
| `@Convert` | Custom type conversion | `converter = MyConverter.class` |
| `@DynamicUpdate` | Only UPDATE changed columns | - |
| `@DynamicInsert` | Only INSERT non-null columns | - |
| `@BatchSize` | Collection batch loading | `size = 25` |
| `@Transactional` | Transaction management | `isolation`, `propagation`, `readOnly`, `rollbackFor` |

---

## ⚙️ Production Configuration & Tuning Parameters

### application.yml — Comprehensive Hibernate Tuning

```yaml
spring:
  jpa:
    # CRITICAL: NEVER use create/update in production
    hibernate:
      ddl-auto: validate
    
    # CRITICAL: Disable OSIV — causes lazy loading outside transactions
    open-in-view: false
    
    show-sql: false    # true in dev only (use hibernate.format_sql)
    
    properties:
      hibernate:
        # Dialect (Hibernate 6 — often auto-detected from driver)
        dialect: org.hibernate.dialect.PostgreSQLDialect
        
        # SQL formatting (dev only)
        format_sql: false
        highlight_sql: false
        
        # ── CRITICAL PERFORMANCE: Batch Processing ──────────────────
        jdbc:
          batch_size: 50             # JDBC batch size (50-100 is sweet spot)
          fetch_size: 50             # Default JDBC fetch size
          batch_versioned_data: true # Enable batching for versioned entities
        
        order_inserts: true          # Reorder INSERTs for better batching
        order_updates: true          # Reorder UPDATEs for better batching
        
        # ── Default Fetch Size for Collections ─────────────────────
        default_batch_fetch_size: 25  # BatchSize for all collections unless overridden
        
        # ── Connection Handling ────────────────────────────────────
        connection:
          provider_disables_autocommit: true   # HikariCP handles autocommit
        
        # ── Second Level Cache (Caffeine + JCache) ────────────────
        cache:
          use_second_level_cache: true
          use_query_cache: true
          region.factory_class: org.hibernate.cache.jcache.JCacheRegionFactory
        javax.cache.provider: com.github.benmanes.caffeine.jcache.spi.CaffeineCachingProvider
        
        # ── Statistics (dev only) ─────────────────────────────────
        generate_statistics: false   # true only in dev/staging
        log_slow_query: 500          # Log queries slower than 500ms
        
        # ── Query Plan Cache ─────────────────────────────────────
        query.plan_cache_max_size: 2048  # Cache up to 2048 query plans
        
        # ── Physical Naming ──────────────────────────────────────
        physical_naming_strategy: org.hibernate.boot.model.naming.CamelCaseToUnderscoresNamingStrategy

  datasource:
    url: jdbc:postgresql://localhost:5432/app_db?reWriteBatchedInserts=true&prepareThreshold=5
    username: ${DB_USER}
    password: ${DB_PASS}
    
    hikari:
      # Pool size formula: (cores * 2) + effective_spindle_count
      # For 4-core server with SSD: (4 * 2) + 1 = 9 → round to 10-15
      maximum-pool-size: 15
      minimum-idle: 5
      
      # Timeouts
      connection-timeout: 30000       # 30s to acquire from pool
      idle-timeout: 600000            # 10min before idle conn closed
      max-lifetime: 1800000           # 30min max conn lifetime
      keepalive-time: 60000           # 60s keepalive query
      
      # Validation
      connection-test-query: SELECT 1  # PostgreSQL: prefer socket test
      validation-timeout: 5000
      
      # PostgreSQL optimization
      data-source-properties:
        prepareThreshold: 5              # Prepare statements after 5 uses
        preparedStatementCacheQueries: 256
        preparedStatementCacheSizeMiB: 5
      
      pool-name: AppHikariPool
      leak-detection-threshold: 60000   # Warn if conn held >60s (dev)
      
      auto-commit: false               # Let Spring manage transactions
```

---

## 📐 System Design Blueprint & Architecture Patterns

### Complete Entity Design with All Best Practices

```java
// ═══════════════════════════════════════════════════
// BASE ENTITY — All common fields in one place
// ═══════════════════════════════════════════════════

@MappedSuperclass
@EntityListeners(AuditingEntityListener.class)
@Getter
public abstract class BaseEntity {

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @LastModifiedDate
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @CreatedBy
    @Column(name = "created_by", updatable = false)
    private String createdBy;

    @LastModifiedBy
    @Column(name = "updated_by")
    private String updatedBy;
}

@MappedSuperclass
@Getter
public abstract class SoftDeletableEntity extends BaseEntity {

    @Column(name = "deleted_at")
    private Instant deletedAt;

    @Column(name = "deleted_by")
    private String deletedBy;

    public boolean isDeleted() { return deletedAt != null; }

    public void softDelete(String deletedBy) {
        this.deletedAt = Instant.now();
        this.deletedBy = deletedBy;
    }
}

// Auditing configuration
@Configuration
@EnableJpaAuditing(auditorAwareRef = "auditorProvider")
public class JpaAuditingConfig {

    @Bean
    public AuditorAware<String> auditorProvider() {
        return () -> Optional.ofNullable(SecurityContextHolder.getContext().getAuthentication())
            .filter(Authentication::isAuthenticated)
            .map(Authentication::getName);
    }
}

// ═══════════════════════════════════════════════════
// ENTITY DESIGN — Best Practices Showcase
// ═══════════════════════════════════════════════════

@Entity
@Table(
    name = "orders",
    indexes = {
        @Index(name = "idx_orders_user_id", columnList = "user_id"),
        @Index(name = "idx_orders_status", columnList = "status"),
        @Index(name = "idx_orders_placed_at", columnList = "placed_at DESC")
    }
)
@DynamicUpdate      // Only UPDATE changed fields — important for wide tables
@DynamicInsert      // Only INSERT non-null fields
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class OrderJpaEntity extends SoftDeletableEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // For UUID primary keys (PostgreSQL native)
    // @Id
    // @GeneratedValue(strategy = GenerationType.UUID)
    // @Column(name = "id", columnDefinition = "UUID")
    // private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Enumerated(EnumType.STRING)   // ALWAYS use STRING, never ORDINAL
    @Column(name = "status", nullable = false, length = 30)
    private OrderStatus status;

    @Column(name = "total_amount", nullable = false, precision = 19, scale = 4)
    private BigDecimal totalAmount;

    @Column(name = "currency", nullable = false, length = 3)
    private String currency = "USD";

    // Embedded value object
    @Embedded
    private ShippingAddressEmbeddable shippingAddress;

    // Optimistic locking — MANDATORY for any entity with concurrent updates
    @Version
    @Column(name = "version", nullable = false)
    private Integer version;

    // One-to-many: LAZY loading by default for collections
    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @BatchSize(size = 25)   // Override default batch size for this collection
    private List<OrderLineJpaEntity> lines = new ArrayList<>();

    // Timestamp columns
    @Column(name = "placed_at", nullable = false)
    private Instant placedAt;

    @Column(name = "confirmed_at")
    private Instant confirmedAt;

    // Computed column (PostgreSQL GENERATED)
    // @Column(name = "line_total", insertable = false, updatable = false)
    // private BigDecimal lineTotal;
}

// Embeddable for value objects
@Embeddable
@Getter
@Setter
public class ShippingAddressEmbeddable {

    @Column(name = "shipping_street")
    private String street;

    @Column(name = "shipping_city")
    private String city;

    @Column(name = "shipping_state")
    private String state;

    @Column(name = "shipping_postal", length = 20)
    private String postalCode;

    @Column(name = "shipping_country", length = 2)
    private String countryCode;
}

// ═══════════════════════════════════════════════════
// CUSTOM ATTRIBUTE CONVERTER — AES-256 Encryption
// ═══════════════════════════════════════════════════

@Converter
@Component
@RequiredArgsConstructor
public class AesEncryptionConverter implements AttributeConverter<String, String> {

    private static final String ALGORITHM = "AES/GCM/NoPadding";
    private static final int GCM_IV_LENGTH = 12;
    private static final int GCM_TAG_LENGTH = 16;

    @Value("${app.encryption.key}")  // 32-byte key from env/Vault
    private String encryptionKey;

    @Override
    public String convertToDatabaseColumn(String attribute) {
        if (attribute == null) return null;
        try {
            var key = new SecretKeySpec(encryptionKey.getBytes(StandardCharsets.UTF_8), "AES");
            var cipher = Cipher.getInstance(ALGORITHM);

            var iv = new byte[GCM_IV_LENGTH];
            new SecureRandom().nextBytes(iv);
            cipher.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(GCM_TAG_LENGTH * 8, iv));

            var encrypted = cipher.doFinal(attribute.getBytes(StandardCharsets.UTF_8));
            var combined = new byte[GCM_IV_LENGTH + encrypted.length];
            System.arraycopy(iv, 0, combined, 0, GCM_IV_LENGTH);
            System.arraycopy(encrypted, 0, combined, GCM_IV_LENGTH, encrypted.length);

            return Base64.getEncoder().encodeToString(combined);
        } catch (Exception e) {
            throw new EncryptionException("Failed to encrypt field", e);
        }
    }

    @Override
    public String convertToEntityAttribute(String dbData) {
        if (dbData == null) return null;
        try {
            var combined = Base64.getDecoder().decode(dbData);
            var iv = Arrays.copyOfRange(combined, 0, GCM_IV_LENGTH);
            var cipherText = Arrays.copyOfRange(combined, GCM_IV_LENGTH, combined.length);

            var key = new SecretKeySpec(encryptionKey.getBytes(StandardCharsets.UTF_8), "AES");
            var cipher = Cipher.getInstance(ALGORITHM);
            cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(GCM_TAG_LENGTH * 8, iv));

            return new String(cipher.doFinal(cipherText), StandardCharsets.UTF_8);
        } catch (Exception e) {
            throw new EncryptionException("Failed to decrypt field", e);
        }
    }
}

// Usage in entity:
// @Convert(converter = AesEncryptionConverter.class)
// @Column(name = "totp_secret")
// private String totpSecret;

// ═══════════════════════════════════════════════════
// REPOSITORY — Production-Grade Pattern
// ═══════════════════════════════════════════════════

@Repository
public interface OrderJpaRepository extends JpaRepository<OrderJpaEntity, Long>,
        JpaSpecificationExecutor<OrderJpaEntity> {

    // Projection-based query — only load needed fields
    @Query("SELECT new com.company.dto.OrderSummary(o.id, o.status, o.totalAmount, o.placedAt) " +
           "FROM OrderJpaEntity o WHERE o.userId = :userId AND o.deletedAt IS NULL " +
           "ORDER BY o.placedAt DESC")
    Page<OrderSummary> findSummariesByUserId(@Param("userId") UUID userId, Pageable pageable);

    // EntityGraph to avoid N+1 on specific endpoint
    @EntityGraph(attributePaths = {"lines"})
    Optional<OrderJpaEntity> findWithLinesById(Long id);

    // Batch status update — single UPDATE statement
    @Modifying
    @Query("UPDATE OrderJpaEntity o SET o.status = :status, o.updatedAt = CURRENT_TIMESTAMP " +
           "WHERE o.id IN :ids AND o.status = :currentStatus")
    int updateStatusBatch(@Param("ids") List<Long> ids,
                          @Param("status") OrderStatus newStatus,
                          @Param("currentStatus") OrderStatus currentStatus);

    // Exists check — avoids loading full entity
    boolean existsByUserIdAndStatus(UUID userId, OrderStatus status);

    // Count by criteria
    long countByStatusAndCreatedAtAfter(OrderStatus status, Instant since);
}

// ═══════════════════════════════════════════════════
// BULK INSERT — Using StatelessSession
// ═══════════════════════════════════════════════════

@Service
@RequiredArgsConstructor
@Slf4j
public class BulkOrderImportService {

    private final EntityManagerFactory entityManagerFactory;
    private static final int BATCH_SIZE = 50;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public int bulkInsert(List<OrderJpaEntity> orders) {
        var sessionFactory = entityManagerFactory.unwrap(SessionFactory.class);

        try (var session = sessionFactory.openStatelessSession()) {
            var tx = session.beginTransaction();
            try {
                int count = 0;
                for (var order : orders) {
                    session.insert(order);
                    count++;

                    if (count % BATCH_SIZE == 0) {
                        // Flush every BATCH_SIZE records
                        log.debug("Inserted {} records so far", count);
                    }
                }
                tx.commit();
                log.info("Bulk inserted {} orders", count);
                return count;
            } catch (Exception e) {
                tx.rollback();
                throw e;
            }
        }
    }
}
```

---

## 🧪 Verification, Testing & Infrastructure Commands

```powershell
# Start PostgreSQL
docker run -d --name postgres-dev -p 5432:5432 `
  -e POSTGRES_DB=app_db -e POSTGRES_USER=app -e POSTGRES_PASSWORD=secret `
  postgres:16-alpine

# Enable slow query logging in PostgreSQL (for tuning)
docker exec postgres-dev psql -U app -d app_db -c "
    ALTER SYSTEM SET log_min_duration_statement = 100;
    ALTER SYSTEM SET log_statement = 'all';
    SELECT pg_reload_conf();
"

# Monitor active queries
docker exec postgres-dev psql -U app -d app_db -c "
    SELECT pid, query_start, state, query
    FROM pg_stat_activity
    WHERE state = 'active' AND pid <> pg_backend_pid()
    ORDER BY query_start;
"

# Check for missing indexes
docker exec postgres-dev psql -U app -d app_db -c "
    SELECT schemaname, tablename, attname, n_distinct, correlation
    FROM pg_stats
    WHERE tablename = 'orders'
    ORDER BY n_distinct DESC;
"

# Enable Hibernate statistics via Actuator
Invoke-RestMethod -Uri "http://localhost:8080/actuator/metrics/hibernate.sessions" |
    ConvertTo-Json -Depth 3
```

---

## ⚡ Senior Best Practices & Critical Anti-Patterns

### ✅ Best Practices

1. **`@DynamicUpdate` for wide tables** — Tables with 30+ columns; only dirty fields sent in UPDATE.

2. **Always specify `@Column(nullable = false)` explicitly** — Don't rely on Hibernate defaults.

3. **Use `@Enumerated(EnumType.STRING)` always** — `ORDINAL` breaks if enum order changes.

4. **Set `reWriteBatchedInserts=true` in JDBC URL** — PostgreSQL-specific optimization that rewrites multiple `INSERT` statements into one multi-value `INSERT`.

5. **Monitor with Hibernate Statistics in staging** — Enable statistics, run load tests, inspect query counts. Every N+1 problem is visible here.

6. **Use interfaces for projections in Spring Data** — Spring generates proxies with only the required fields; no full entity loading.

### ❌ Critical Anti-Patterns

| Anti-Pattern | Problem | Fix |
|-------------|---------|-----|
| **`FetchType.EAGER` on collections** | Loads entire collection on every entity load | Always `LAZY`; load eagerly with `@EntityGraph` per use case |
| **`ddl-auto=update`** | Silently alters production schema | `validate` + Flyway for all changes |
| **`open-in-view=true`** | Lazy loading in views causes N+1 in presentation layer | `open-in-view=false` + explicit fetching strategy |
| **`@Transactional` on Repository** | Doubles transaction overhead | `@Transactional` at service layer only |
| **Returning entities from REST endpoints** | Exposes internal structure + lazy loading issues | Always map to DTOs before leaving service layer |
| **Missing `@Version`** | Lost updates in concurrent modification scenarios | Add `@Version Integer version` to every mutable entity |

---

*Previous: [01-flyway-liquibase-migration.md](./01-flyway-liquibase-migration.md) | Next: [03-n-plus-1-resolution-strategies.md](./03-n-plus-1-resolution-strategies.md)*
