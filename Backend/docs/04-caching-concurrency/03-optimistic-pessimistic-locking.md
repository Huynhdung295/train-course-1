# 🔐 Optimistic & Pessimistic Locking in JPA

> **Category**: Caching & Concurrency | **Complexity**: Advanced | **Java**: 21+ | **Hibernate**: 6.5+

---

## 📖 Core Technical Mechanics & Deep-Dive

### The Lost Update Problem

Without locking, concurrent updates to the same record can cause data loss:

```
Time    Thread A                    Thread B
t1      Read: balance = 1000
t2                                  Read: balance = 1000
t3      Update: balance = 1000 - 200 = 800
t4      COMMIT (balance = 800)
t5                                  Update: balance = 1000 - 300 = 700  ← WRONG! Should be 500
t6                                  COMMIT (balance = 700)   ← Thread A's update is LOST!
```

### Optimistic Locking — @Version

**Mechanism**: Each entity has a `version` column. On UPDATE, Hibernate includes `WHERE version = expectedVersion`. If no rows updated → another transaction updated it → throw `OptimisticLockingFailureException`.

```sql
-- Hibernate generates:
UPDATE orders SET status = 'CONFIRMED', version = 2
WHERE id = 123 AND version = 1    -- version check!

-- If another TX already incremented version to 2:
-- 0 rows affected → OptimisticLockingFailureException
```

**Characteristics**:
- No DB-level locking → high throughput
- Conflict detection at COMMIT time (not read time)
- Best for: low-conflict scenarios (most web apps)
- Failure rate increases with: high concurrency + long transactions

### Pessimistic Locking — SELECT FOR UPDATE

**Mechanism**: Acquires a DB-level lock at SELECT time. Other transactions attempting to SELECT or UPDATE the same row block until the lock is released.

```sql
-- PESSIMISTIC_WRITE:
SELECT * FROM products WHERE id = 456 FOR UPDATE;
-- All other transactions: BLOCKED until this TX commits/rollbacks

-- PESSIMISTIC_READ:
SELECT * FROM products WHERE id = 456 FOR SHARE;
-- Other reads: allowed; other writes: BLOCKED
```

**Characteristics**:
- DB-level lock → blocks other transactions → lower throughput
- Conflict prevention at READ time (not commit time)
- Best for: high-conflict scenarios (inventory, seats, payments)

---

## 🌐 Real-World GitHub Patterns & Industry Reference

- **[vlad/high-performance-java-persistence locking](https://github.com/vladmihalcea/high-performance-java-persistence)** — Comprehensive locking chapter
- **[baeldung/spring-data-jpa-locking](https://www.baeldung.com/jpa-optimistic-locking)** — Practical Spring examples

---

## 🏷️ Framework Annotations & Dependencies

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-data-jpa</artifactId>
</dependency>

<!-- For retry on OptimisticLockingFailureException -->
<dependency>
    <groupId>org.springframework.retry</groupId>
    <artifactId>spring-retry</artifactId>
</dependency>
```

| Annotation/Enum | Purpose |
|----------------|---------|
| `@Version` | Enable optimistic locking on entity |
| `@Lock(LockModeType.OPTIMISTIC)` | Explicit optimistic lock on repository method |
| `@Lock(LockModeType.PESSIMISTIC_WRITE)` | Exclusive write lock |
| `@Lock(LockModeType.PESSIMISTIC_READ)` | Shared read lock |
| `@Lock(LockModeType.OPTIMISTIC_FORCE_INCREMENT)` | Force version increment even on read |

---

## 📐 System Design Blueprint

### Complete Locking Implementation

```java
// ═══════════════════════════════════════════════════
// OPTIMISTIC LOCKING — Best for most use cases
// ═══════════════════════════════════════════════════

@Entity
@Table(name = "orders")
public class Order {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    private OrderStatus status;

    private BigDecimal totalAmount;

    // MANDATORY for optimistic locking
    @Version
    @Column(name = "version", nullable = false)
    private Integer version = 0;
}

// Repository with explicit lock modes
@Repository
public interface OrderRepository extends JpaRepository<Order, Long> {

    // Default: OPTIMISTIC lock (version check on commit)
    @Lock(LockModeType.OPTIMISTIC)
    Optional<Order> findById(Long id);

    // Force version increment even if no fields changed (used for aggregate root)
    @Lock(LockModeType.OPTIMISTIC_FORCE_INCREMENT)
    @Query("SELECT o FROM Order o WHERE o.id = :id")
    Optional<Order> findForceVersion(@Param("id") Long id);

    // Pessimistic write lock
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT o FROM Order o WHERE o.id = :id")
    Optional<Order> findForUpdate(@Param("id") Long id);
}

// Service with retry on optimistic lock failure
@Service
@RequiredArgsConstructor
@Slf4j
public class OrderConcurrencyService {

    private final OrderRepository orderRepo;

    // Retry up to 3 times on optimistic lock failure
    @Retryable(
        retryFor = { OptimisticLockingFailureException.class,
                     ObjectOptimisticLockingFailureException.class },
        maxAttempts = 3,
        backoff = @Backoff(delay = 100, multiplier = 2)   // 100ms, 200ms, 400ms
    )
    @Transactional
    public Order confirmOrder(Long orderId) {
        var order = orderRepo.findById(orderId)
            .orElseThrow(() -> new OrderNotFoundException(orderId));

        order.confirm();   // Updates status field → marks entity dirty
        // On save: Hibernate executes UPDATE ... WHERE id=? AND version=?
        // If version mismatch → OptimisticLockingFailureException → @Retryable retries
        return orderRepo.save(order);
    }

    @Recover
    public Order recoverConfirmOrder(OptimisticLockingFailureException ex, Long orderId) {
        log.error("All retries exhausted for order {}: {}", orderId, ex.getMessage());
        throw new ConcurrentModificationException(
            "Order " + orderId + " was modified by another user. Please retry.", ex);
    }
}

// ═══════════════════════════════════════════════════
// PESSIMISTIC LOCKING — For inventory / seats / payments
// ═══════════════════════════════════════════════════

@Service
@RequiredArgsConstructor
@Slf4j
public class InventoryLockingService {

    private final ProductRepository productRepo;

    /**
     * Pessimistic locking for high-contention inventory reservation.
     * Lock acquired at SELECT; held until transaction commits.
     */
    @Transactional(timeout = 10)   // Force timeout to prevent lock-holding forever
    public InventoryReservation reserveStock(UUID productId, int quantity) {
        // PESSIMISTIC_WRITE = SELECT ... FOR UPDATE
        // All other threads attempting to reserve the same product will BLOCK here
        var product = productRepo.findForUpdate(productId)
            .orElseThrow(() -> new ProductNotFoundException(productId));

        log.debug("Acquired pessimistic lock for product {}", productId);

        if (product.getAvailableQuantity() < quantity) {
            throw new InsufficientStockException(productId, quantity, product.getAvailableQuantity());
        }

        product.reserve(quantity);
        productRepo.save(product);

        return new InventoryReservation(productId, quantity, Instant.now());
        // Lock released here when TX commits
    }

    /**
     * Skip locked: don't block, just skip already-locked rows.
     * Useful for batch processing: each worker grabs different rows.
     */
    @Transactional
    public List<Order> claimPendingOrders(int batchSize) {
        // SKIP_LOCKED: each worker thread gets different orders (no blocking)
        return orderRepo.findPendingOrdersForProcessing(batchSize);
    }
}

// Repository with SKIP LOCKED (PostgreSQL-specific native query)
@Repository
public interface OrderRepository extends JpaRepository<Order, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @QueryHints(value = @QueryHint(name = "jakarta.persistence.lock.timeout", value = "0"))
    // timeout=0 → NOWAIT (fail immediately if locked instead of blocking)
    @Query("SELECT o FROM Order o WHERE o.id = :id")
    Optional<Order> findForUpdateNoWait(@Param("id") Long id);

    // SKIP LOCKED for competitive consumers (job queue pattern)
    @Query(value = """
        SELECT * FROM orders
        WHERE status = 'PENDING'
        ORDER BY placed_at ASC
        LIMIT :batchSize
        FOR UPDATE SKIP LOCKED
        """, nativeQuery = true)
    List<Order> findPendingOrdersForProcessing(@Param("batchSize") int batchSize);
}

// ═══════════════════════════════════════════════════
// HANDLING OPTIMISTIC LOCK FAILURES
// ═══════════════════════════════════════════════════

// Global exception handler for optimistic lock failures
@RestControllerAdvice
@Slf4j
public class ConcurrencyExceptionHandler {

    @ExceptionHandler(ObjectOptimisticLockingFailureException.class)
    public ResponseEntity<ProblemDetail> handleOptimisticLock(
            ObjectOptimisticLockingFailureException ex) {
        log.warn("Optimistic lock failure: entity={}, id={}",
            ex.getPersistentClassName(), ex.getIdentifier());

        var problem = ProblemDetail.forStatusAndDetail(
            HttpStatus.CONFLICT,
            "The resource was modified by another user. Please refresh and try again."
        );
        problem.setTitle("Concurrent Modification");
        problem.setProperty("entityType", ex.getPersistentClassName());
        return ResponseEntity.status(HttpStatus.CONFLICT).body(problem);
    }

    @ExceptionHandler(PessimisticLockingFailureException.class)
    public ResponseEntity<ProblemDetail> handlePessimisticLock(
            PessimisticLockingFailureException ex) {
        log.warn("Pessimistic lock failure: {}", ex.getMessage());

        var problem = ProblemDetail.forStatusAndDetail(
            HttpStatus.CONFLICT,
            "Resource is temporarily locked. Please try again in a moment."
        );
        return ResponseEntity.status(HttpStatus.CONFLICT).body(problem);
    }
}
```

### Decision Flow: When to Use Which Lock

```
Is the operation in a high-contention scenario?
(inventory, seats, payment capture, counter updates)
    │
    ├── YES → Use Pessimistic Locking (SELECT FOR UPDATE)
    │         Short transaction duration is critical
    │         Set @Transactional(timeout = 10) to prevent lock hoarding
    │
    └── NO  → Use Optimistic Locking (@Version)
              Add @Retryable with exponential backoff
              Handle OptimisticLockingFailureException in @RestControllerAdvice

Low contention + long processing time → Optimistic
High contention + short processing time → Pessimistic
High contention + long processing time → Redesign! (queue, event-driven)
```

---

## 🧪 Verification Commands

```powershell
# Test concurrent requests — optimistic lock failure scenario
$jobs = 1..10 | ForEach-Object {
    Start-Job {
        Invoke-RestMethod -Method POST `
            -Uri "http://localhost:8080/api/v1/orders/123/confirm" `
            -Headers @{ Authorization = "Bearer $using:token" }
    }
}
$results = $jobs | Wait-Job | Receive-Job
$results | Group-Object { $_.StatusCode ?? "OK" } | Format-Table Name, Count

# Test inventory with pessimistic locking (only one should succeed for last item)
$lastItemJobs = 1..5 | ForEach-Object {
    Start-Job {
        $body = @{ productId = "prod-001"; quantity = 100 } | ConvertTo-Json
        Invoke-RestMethod -Method POST -Uri "http://localhost:8080/api/v1/inventory/reserve" `
            -ContentType "application/json" -Body $body `
            -Headers @{ Authorization = "Bearer $using:token" }
    }
}
```

---

## ⚡ Best Practices & Anti-Patterns

### ✅ Best Practices
1. **`@Version` on every mutable entity** — Even if you think it won't be concurrently modified. Future features may require it.
2. **`@Retryable` for optimistic lock on write paths** — 3 retries with exponential backoff handles transient conflicts gracefully.
3. **Set `@Transactional(timeout)` with pessimistic locks** — Prevent runaway transactions from holding locks forever.

### ❌ Anti-Patterns

| Anti-Pattern | Fix |
|-------------|-----|
| Pessimistic lock on entire table | Lock only the specific row(s) you need |
| No retry for optimistic lock | Users get confusing errors; add `@Retryable` |
| Long business logic inside pessimistic lock | Get lock → execute → commit FAST; no network calls inside locked TX |
| `@Version Long` instead of `@Version Integer` | Both work; Integer is conventional and sufficient |
