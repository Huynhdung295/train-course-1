# 🔍 N+1 Query Resolution Strategies

> **Category**: Database | **Complexity**: Advanced | **Java**: 21+ | **Hibernate**: 6.5+

---

## 📖 Core Technical Mechanics & Deep-Dive

### The N+1 Problem Explained

**N+1 queries** occur when loading a collection triggers one query per parent entity:

```sql
-- Query 1: Load all orders
SELECT * FROM orders WHERE user_id = 1;
-- Returns 10 orders

-- Then for EACH order (10 more queries = N+1):
SELECT * FROM order_lines WHERE order_id = 1;
SELECT * FROM order_lines WHERE order_id = 2;
-- ... 8 more times
```

Result: 1 + N queries (1 + 10 = 11 queries). For 1000 orders = 1001 queries.

### Detection Methods

```java
// Method 1: Hibernate Statistics
SessionFactory sf = emf.unwrap(SessionFactory.class);
Statistics stats = sf.getStatistics();
stats.setStatisticsEnabled(true);
// After request: stats.getQueryExecutionCount() should be 1 or 2, not 11

// Method 2: datasource-proxy (logs every SQL with stack trace)
// Method 3: Spring Boot Actuator metric: hibernate.query.executions
// Method 4: p6spy SQL logging library (development)
```

---

## 🌐 Real-World GitHub Patterns & Industry Reference

### Resolution Strategies Comparison

| Strategy | When to Use | Trade-off |
|----------|-------------|-----------|
| **JOIN FETCH** | Need full entity graph for complex logic | May cause Cartesian explosion with multiple collections |
| **@EntityGraph** | Per-method join fetch without JPQL | Cleaner than JPQL but still limited |
| **@BatchSize** | Large collections, paginated queries | Multiple batched queries (not 1, but not N) |
| **DTO Projection** | Read-only views, reporting | Flattened structure, no entity graph |
| **subselect fetching** | Medium collections, always needed | Two queries, no Cartesian explosion |

---

## 🏷️ Framework Annotations & Dependencies

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-data-jpa</artifactId>
</dependency>

<!-- For datasource-proxy N+1 detection (dev only) -->
<dependency>
    <groupId>net.ttddyy</groupId>
    <artifactId>datasource-proxy</artifactId>
    <version>1.10</version>
    <scope>test</scope>
</dependency>
```

---

## ⚙️ Production Configuration

```yaml
spring:
  jpa:
    properties:
      hibernate:
        default_batch_fetch_size: 25    # Global BatchSize for all collections
        jdbc.fetch_size: 50             # JDBC fetch size
```

---

## 📐 System Design Blueprint

### Complete N+1 Resolution Code

```java
// ═══════════════════════════════════════════════════
// STRATEGY 1: JOIN FETCH in JPQL
// ═══════════════════════════════════════════════════

@Repository
public interface OrderRepository extends JpaRepository<Order, Long> {

    // Single query with JOIN — loads orders + lines in one shot
    @Query("SELECT DISTINCT o FROM Order o " +
           "JOIN FETCH o.lines l " +
           "JOIN FETCH o.user u " +
           "WHERE o.user.id = :userId")
    List<Order> findWithLinesAndUserByUserId(@Param("userId") UUID userId);

    // ⚠️ CARTESIAN EXPLOSION WARNING:
    // JOIN FETCH two separate collections creates cross-product:
    // Order has 5 lines + 3 tags → 15 rows per order
    // SOLUTION: Use @EntityGraph or separate queries

    // ✅ CORRECT: For paginated queries use @EntityGraph (no Cartesian explosion)
    // ❌ WRONG:
    // @Query("SELECT o FROM Order o JOIN FETCH o.lines JOIN FETCH o.tags")
    // Page<Order> findAll(Pageable pageable);  // PAGINATION WRONG IN MEMORY!
}

// ═══════════════════════════════════════════════════
// STRATEGY 2: @EntityGraph — Named or Ad-hoc
// ═══════════════════════════════════════════════════

@Entity
@NamedEntityGraph(
    name = "Order.withLines",
    attributeNodes = {
        @NamedAttributeNode("lines"),
        @NamedAttributeNode(value = "user", subgraph = "user-details")
    },
    subgraphs = {
        @NamedSubgraph(name = "user-details", attributeNodes = {
            @NamedAttributeNode("email"),
            @NamedAttributeNode("firstName")
        })
    }
)
public class Order {
    // ...
}

@Repository
public interface OrderRepository extends JpaRepository<Order, Long> {

    // Use named EntityGraph
    @EntityGraph("Order.withLines")
    Optional<Order> findById(Long id);

    // Ad-hoc EntityGraph — no annotation on entity needed
    @EntityGraph(attributePaths = {"lines", "user"})
    List<Order> findByStatus(OrderStatus status);

    // For pagination with joins — EntityGraph handles N+1 WITHOUT Cartesian explosion
    @EntityGraph(attributePaths = {"lines"})
    Page<Order> findByUserId(UUID userId, Pageable pageable);
}

// ═══════════════════════════════════════════════════
// STRATEGY 3: @BatchSize — Batch Loading
// ═══════════════════════════════════════════════════

@Entity
public class Order {

    @OneToMany(mappedBy = "order", fetch = FetchType.LAZY)
    @BatchSize(size = 25)   // Load 25 order's lines in one SELECT ... WHERE order_id IN (?,?,...,?)
    private List<OrderLine> lines;
}

// This generates: SELECT * FROM order_lines WHERE order_id IN (1, 2, 3, ... 25)
// Then for next batch: SELECT * FROM order_lines WHERE order_id IN (26, 27, ... 50)
// Total queries: ceil(N / 25) instead of N

// ═══════════════════════════════════════════════════
// STRATEGY 4: DTO Projections — Most Efficient for Read
// ═══════════════════════════════════════════════════

// Interface projection — Spring generates proxy
public interface OrderSummaryProjection {
    Long getId();
    String getStatus();
    BigDecimal getTotalAmount();
    Instant getPlacedAt();
    String getUserEmail();   // From joined User.email
}

// Class-based projection (DTO constructor)
public record OrderSummaryDto(
    Long id,
    String status,
    BigDecimal totalAmount,
    Instant placedAt,
    String userEmail
) {}

@Repository
public interface OrderRepository extends JpaRepository<Order, Long> {

    // Interface projection — lazy proxy
    List<OrderSummaryProjection> findByUserId(UUID userId);

    // Constructor projection — explicit, type-safe
    @Query("SELECT new com.company.dto.OrderSummaryDto(" +
           "o.id, o.status, o.totalAmount, o.placedAt, u.email) " +
           "FROM Order o JOIN o.user u " +
           "WHERE o.userId = :userId AND o.deletedAt IS NULL")
    Page<OrderSummaryDto> findSummariesByUserId(@Param("userId") UUID userId, Pageable pageable);

    // Flat projection avoiding any joins issue
    @Query(value = """
        SELECT o.id, o.status, o.total_amount, o.placed_at,
               u.email as user_email,
               COUNT(ol.id) as line_count
        FROM orders o
        JOIN users u ON o.user_id = u.id
        LEFT JOIN order_lines ol ON ol.order_id = o.id
        WHERE o.user_id = :userId
        GROUP BY o.id, u.email
        """, nativeQuery = true)
    List<OrderSummaryProjection> findSummariesNative(@Param("userId") UUID userId);
}

// ═══════════════════════════════════════════════════
// STRATEGY 5: Subselect Fetching
// ═══════════════════════════════════════════════════

@Entity
public class Order {

    // Subselect: loads ALL lines for all previously loaded orders in ONE query
    // 2 queries total: 1 for orders, 1 for all their lines
    @OneToMany(mappedBy = "order", fetch = FetchType.LAZY)
    @Fetch(FetchMode.SUBSELECT)
    private List<OrderLine> lines;
}

// Generates:
// SELECT * FROM order_lines
// WHERE order_id IN (SELECT id FROM orders WHERE user_id = 1)
```

### Detection: datasource-proxy in Tests

```java
@Configuration
@Profile("test")
public class QueryCountTestConfig {

    @Bean
    @Primary
    public DataSource proxyDataSource(@Qualifier("originalDataSource") DataSource original) {
        var queryListener = new QueryCountLoggingListener();
        return ProxyDataSourceBuilder.create(original)
            .name("QueryCountProxy")
            .listener(queryListener)
            .build();
    }
}

// In test:
@Test
void shouldLoadOrdersWithoutNPlusOne() {
    QueryCountHolder.clear();

    // Execute
    var orders = orderService.findByUserId(userId);

    // Assert query count
    var queryCount = QueryCountHolder.getGrandTotal().getSelect();
    assertThat(queryCount)
        .withFailMessage("Expected 1-2 queries but got %d (N+1 detected!)", queryCount)
        .isLessThanOrEqualTo(2);
}
```

---

## 🧪 Verification Commands

```powershell
# Enable detailed SQL logging temporarily
./mvnw spring-boot:run -Dspring-boot.run.arguments=--logging.level.org.hibernate.SQL=DEBUG

# Check with actual query count — add to application.properties for dev:
# logging.level.org.hibernate.orm.jdbc.bind=TRACE
# spring.jpa.show-sql=true
# spring.jpa.properties.hibernate.format_sql=true
```

---

## ⚡ Best Practices & Anti-Patterns

### ✅ Best Practices
1. **`@EntityGraph` for detail endpoints** — Single-record with full graph; JOIN FETCH in DTO query
2. **DTO projections for list endpoints** — Never load full entities for list/search results
3. **`default_batch_fetch_size: 25`** — Global safety net reduces accidental N+1 impact

### ❌ Anti-Patterns

| Anti-Pattern | Fix |
|-------------|-----|
| `FetchType.EAGER` on `@OneToMany` | `LAZY` + explicit fetch per use case |
| JOIN FETCH with pagination | Use `@EntityGraph` or subquery |
| Loading full entity for single field | Use projection: `findEmailById(id)` |
| Not testing query counts | Add datasource-proxy assertion in integration tests |
