# ⚡ Read/Write Splitting & Dynamic DataSource Routing

> **Category**: Database | **Complexity**: Advanced | **Java**: 21+ | **Spring Boot**: 3.3+

---

## 📖 Core Technical Mechanics & Deep-Dive

### Why Read/Write Splitting?

In production systems with heavy read traffic (typically 80-90% reads):
- **Write DB (Primary)** — Handles all INSERTs, UPDATEs, DELETEs. Strict durability.
- **Read DBs (Replicas)** — Handle SELECT queries. Can be multiple, horizontally scalable.
- **Replication** — PostgreSQL streaming replication keeps replicas in sync (typically <100ms lag)

```
Application Layer
      │
      ├── @Transactional           → Primary (write DB)
      └── @Transactional(readOnly=true) → Replica (read DB, round-robin)

Primary DB ──── Streaming Replication ───► Replica 1
                                       ───► Replica 2
                                       ───► Replica 3
```

### AbstractRoutingDataSource Internals

Spring's `AbstractRoutingDataSource` holds a **map of DataSources** and routes each connection request to the correct one based on the `determineCurrentLookupKey()` result. The routing decision happens at the moment `getConnection()` is called — just before transaction start.

```java
// Spring calls this before every connection acquisition:
protected Object determineCurrentLookupKey() {
    // Returns: "READ" or "WRITE" based on transaction context
}
```

**Critical timing**: The routing key is determined when the connection is first acquired in a transaction. If the same `@Service` method is called within a `@Transactional` context already started by a caller, it reuses the existing connection — no re-routing.

---

## 🌐 Real-World GitHub Patterns & Industry Reference

- **[baomidou/dynamic-datasource-spring-boot-starter](https://github.com/baomidou/dynamic-datasource-spring-boot-starter)** — Popular Chinese Spring Boot dynamic datasource library with 5k+ stars
- **[vlad/flexy-pool](https://github.com/vladmihalcea/flexy-pool)** — Adaptive connection pool sizing with metrics (Vlad Mihalcea)

---

## 🏷️ Framework Annotations & Dependencies

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-data-jpa</artifactId>
</dependency>

<!-- For aspect-based routing annotation support -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-aop</artifactId>
</dependency>

<!-- HikariCP (bundled with Spring Boot) -->
<!-- Multiple datasource connections managed by separate HikariCP pools -->
```

---

## ⚙️ Production Configuration

```yaml
spring:
  datasource:
    # Primary write datasource
    primary:
      jdbc-url: jdbc:postgresql://postgres-primary:5432/app_db
      username: ${DB_WRITE_USER}
      password: ${DB_WRITE_PASS}
      hikari:
        pool-name: WritePrimary
        maximum-pool-size: 15
        minimum-idle: 5
        auto-commit: false

    # Read replicas
    replicas:
      - jdbc-url: jdbc:postgresql://postgres-replica-1:5432/app_db
        username: ${DB_READ_USER}
        password: ${DB_READ_PASS}
        hikari:
          pool-name: ReadReplica1
          maximum-pool-size: 25
          minimum-idle: 10
          auto-commit: true   # read-only sessions

      - jdbc-url: jdbc:postgresql://postgres-replica-2:5432/app_db
        username: ${DB_READ_USER}
        password: ${DB_READ_PASS}
        hikari:
          pool-name: ReadReplica2
          maximum-pool-size: 25
          minimum-idle: 10
          auto-commit: true

  jpa:
    open-in-view: false
    hibernate:
      ddl-auto: validate

app:
  datasource:
    routing:
      replica-load-balance: round-robin   # round-robin | random | least-connections
      failover-to-primary: true           # Fall back to primary if all replicas down
```

---

## 📐 System Design Blueprint

### Complete Read/Write Routing Implementation

```java
// ═══════════════════════════════════════════════════
// 1. ROUTING KEY ENUM & CONTEXT
// ═══════════════════════════════════════════════════

public enum DataSourceType { READ, WRITE }

public class DataSourceContext {

    private static final ThreadLocal<DataSourceType> CONTEXT = new InheritableThreadLocal<>();

    public static void setReadMode()  { CONTEXT.set(DataSourceType.READ); }
    public static void setWriteMode() { CONTEXT.set(DataSourceType.WRITE); }
    public static DataSourceType get() {
        return CONTEXT.get() == null ? DataSourceType.WRITE : CONTEXT.get();
    }
    public static void clear() { CONTEXT.remove(); }
}

// ═══════════════════════════════════════════════════
// 2. ROUTING DATASOURCE
// ═══════════════════════════════════════════════════

@Slf4j
public class RoutingDataSource extends AbstractRoutingDataSource {

    private final List<DataSource> readSources;
    private final AtomicInteger readIndex = new AtomicInteger(0);

    public RoutingDataSource(DataSource writeSource, List<DataSource> readSources) {
        this.readSources = readSources;

        // Build the lookup map
        var dataSources = new HashMap<Object, Object>();
        dataSources.put(DataSourceType.WRITE, writeSource);
        // Each replica gets its own key
        for (int i = 0; i < readSources.size(); i++) {
            dataSources.put("READ_" + i, readSources.get(i));
        }

        setTargetDataSources(dataSources);
        setDefaultTargetDataSource(writeSource);
    }

    @Override
    protected Object determineCurrentLookupKey() {
        if (DataSourceContext.get() == DataSourceType.READ && !readSources.isEmpty()) {
            // Round-robin across replicas
            var idx = Math.abs(readIndex.getAndIncrement() % readSources.size());
            log.trace("Routing to READ replica #{}", idx);
            return "READ_" + idx;
        }
        log.trace("Routing to WRITE primary");
        return DataSourceType.WRITE;
    }
}

// ═══════════════════════════════════════════════════
// 3. DATASOURCE CONFIGURATION
// ═══════════════════════════════════════════════════

@Configuration
@RequiredArgsConstructor
public class DataSourceConfig {

    private final DataSourceProperties primaryProps;
    private final List<DataSourceProperties> replicaProps;

    @Bean(name = "writeDataSource")
    public DataSource writeDataSource() {
        return HikariDataSource.create(primaryProps);
    }

    @Bean(name = "readDataSources")
    public List<DataSource> readDataSources() {
        return replicaProps.stream()
            .map(HikariDataSource::create)
            .collect(Collectors.toList());
    }

    @Bean
    @Primary
    public DataSource routingDataSource(
            @Qualifier("writeDataSource") DataSource write,
            @Qualifier("readDataSources") List<DataSource> reads) {

        var routing = new RoutingDataSource(write, reads);
        routing.afterPropertiesSet();
        return new LazyConnectionDataSourceProxy(routing);
        // LazyConnectionDataSourceProxy: delays actual connection acquisition until first SQL
        // This allows routing AFTER @Transactional annotation is processed
    }
}

// ═══════════════════════════════════════════════════
// 4. AOP-BASED ROUTING — @ReadOnly annotation
// ═══════════════════════════════════════════════════

@Target({ElementType.METHOD, ElementType.TYPE})
@Retention(RetentionPolicy.RUNTIME)
@Transactional(readOnly = true)
public @interface ReadOnlyTransaction {}

@Aspect
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)   // Must run BEFORE @Transactional opens connection
@Slf4j
public class ReadWriteRoutingAspect {

    @Around("@annotation(com.company.annotation.ReadOnlyTransaction)")
    public Object routeToReplica(ProceedingJoinPoint pjp) throws Throwable {
        DataSourceContext.setReadMode();
        try {
            return pjp.proceed();
        } finally {
            DataSourceContext.clear();
        }
    }

    // Also intercept @Transactional(readOnly = true) from Spring
    @Around("@annotation(transactional) && @annotation(transactional).readOnly()")
    public Object routeReadOnlyTransactions(ProceedingJoinPoint pjp,
                                             Transactional transactional) throws Throwable {
        if (transactional.readOnly()) {
            DataSourceContext.setReadMode();
        }
        try {
            return pjp.proceed();
        } finally {
            if (transactional.readOnly()) {
                DataSourceContext.clear();
            }
        }
    }
}

// ═══════════════════════════════════════════════════
// 5. USAGE — Clean service-level routing
// ═══════════════════════════════════════════════════

@Service
@RequiredArgsConstructor
public class OrderService {

    private final OrderRepository orderRepo;

    // Routes to PRIMARY (write DB)
    @Transactional
    public OrderId createOrder(CreateOrderCommand cmd) {
        var order = Order.create(cmd);
        return orderRepo.save(order).getId();
    }

    // Routes to REPLICA (read DB) — automatic via @Transactional(readOnly=true)
    @Transactional(readOnly = true)
    public Page<OrderSummary> listOrders(UUID userId, Pageable pageable) {
        return orderRepo.findByUserId(userId, pageable);
    }

    // Custom annotation
    @ReadOnlyTransaction
    public OrderDetail getOrderDetail(String orderId) {
        return orderRepo.findDetailById(orderId)
            .orElseThrow(() -> new OrderNotFoundException(orderId));
    }

    // Mixed — write then read (all on primary due to write contamination)
    @Transactional
    public OrderDetail createAndReturn(CreateOrderCommand cmd) {
        var orderId = createOrder(cmd);  // Write on primary
        return getOrderDetail(orderId.toString());  // Still on primary (same TX)
    }
}
```

### HikariCP Pool Monitoring

```java
@Component
@RequiredArgsConstructor
public class HikariPoolMetrics {

    private final DataSource routingDataSource;
    private final MeterRegistry meterRegistry;

    @PostConstruct
    public void registerMetrics() {
        // Extract underlying HikariCP pools and register metrics
        getHikariPools(routingDataSource).forEach(pool -> {
            var poolName = pool.getPoolName();
            Gauge.builder("hikari.connections.active", pool, HikariDataSource::getHikariPoolMXBean)
                .tags("pool", poolName)
                .description("Active connections")
                .register(meterRegistry);

            Gauge.builder("hikari.connections.pending", pool, HikariDataSource::getHikariPoolMXBean)
                .tags("pool", poolName)
                .description("Pending connection requests")
                .register(meterRegistry);
        });
    }
}
```

---

## 🧪 Verification Commands

```powershell
# Start primary + replica with replication
docker network create pg-network

docker run -d --name postgres-primary --network pg-network -p 5432:5432 `
  -e POSTGRES_USER=admin -e POSTGRES_PASSWORD=secret -e POSTGRES_DB=app_db `
  -e POSTGRES_REPLICATION_USER=replicator -e POSTGRES_REPLICATION_PASSWORD=rep_secret `
  bitnami/postgresql:16

docker run -d --name postgres-replica1 --network pg-network -p 5433:5432 `
  -e POSTGRESQL_REPLICATION_MODE=slave `
  -e POSTGRESQL_MASTER_HOST=postgres-primary `
  -e POSTGRESQL_REPLICATION_USER=replicator `
  -e POSTGRESQL_REPLICATION_PASSWORD=rep_secret `
  bitnami/postgresql:16

# Test routing — observe which pool is used
Invoke-RestMethod -Uri "http://localhost:8080/actuator/metrics/hikari.connections.active" |
    ConvertTo-Json -Depth 5

# Write request (should use WritePrimary pool)
$body = @{ item = "test" } | ConvertTo-Json
Invoke-RestMethod -Method POST -Uri "http://localhost:8080/api/v1/orders" `
    -ContentType "application/json" -Body $body

# Read request (should use ReadReplica pool)
Invoke-RestMethod -Uri "http://localhost:8080/api/v1/orders"
```

---

## ⚡ Best Practices & Anti-Patterns

### ✅ Best Practices
1. **`LazyConnectionDataSourceProxy` is mandatory** — Without it, Spring opens the connection before `@Transactional` processes `readOnly`, defeating routing
2. **Aspect `@Order(HIGHEST_PRECEDENCE)`** — Routing context must be set BEFORE `@Transactional` acquires connection
3. **Monitor replica lag** — In PostgreSQL: `SELECT now() - pg_last_xact_replay_timestamp()` to check replication lag

### ❌ Anti-Patterns

| Anti-Pattern | Fix |
|-------------|-----|
| `@Transactional` calling another `@Transactional(readOnly)` | Outer TX controls connection; inner readOnly is ignored — flatten or use `REQUIRES_NEW` |
| Missing `LazyConnectionDataSourceProxy` | Without it, routing never works |
| Not monitoring replica lag | Stale reads can cause incorrect behavior — alert if lag > 500ms |
| One giant HikariCP pool for all | Separate pools allow independent tuning for reads vs writes |
