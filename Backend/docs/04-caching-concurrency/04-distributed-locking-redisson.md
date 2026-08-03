# 🔒 Distributed Locking with Redisson

> **Category**: Caching & Concurrency | **Complexity**: Expert | **Java**: 21+ | **Redisson**: 3.32+

---

## 📖 Core Technical Mechanics & Deep-Dive

### Why Distributed Locking?

JVM-level synchronization (`synchronized`, `ReentrantLock`) only works within a single JVM. In a clustered environment with multiple application instances, you need a lock that is **visible across all instances** — this requires an external coordinator like Redis.

### Redisson Lock Algorithms

#### RLock (Single Redis Instance Lock)
```
Client acquires lock:
  SET lock:key {uuid} NX PX 30000   ← NX=only if not exists, PX=30s TTL
  
  → If "OK" returned: lock acquired
  → If null returned: lock is held by another client; retry or fail

Lease renewal (Watchdog mechanism):
  Every 10s (TTL/3): PEXPIRE lock:key 30000  ← Reset TTL while client holds lock
  
  If client dies: Watchdog stops → lock expires after TTL naturally

Client releases lock:
  Eval Lua: if GET(key) == uuid then DEL(key) end  ← Atomic check-and-delete
```

#### RedLock Algorithm (Multiple Redis Instances — High Availability)
```
5 independent Redis masters (N=5, quorum = N/2+1 = 3)

Client attempts to SET lock on all 5 instances sequentially:
  Time budget = min(TTL / 10, 50ms) per instance

  Count successful acquisitions:
  ≥ 3 acquired within total time < TTL → SUCCESS
  < 3 acquired → FAIL → release all acquired locks

Effective lock TTL = originalTTL - elapsed_time
```

**Note**: RedLock is controversial (Martin Kleppmann critique). For most applications, single-instance RLock with Redis Sentinel HA is sufficient and safer.

### Watchdog Mechanism — Preventing Premature Release

Redisson's watchdog is a background task that automatically extends lock TTL while the application is still holding the lock:

```
Client acquires lock (TTL=30s)
  │
  ├── Task starts executing (may take >30s!)
  │
  ├── [t=10s] Watchdog: PEXPIRE lock 30000 (reset to 30s)
  ├── [t=20s] Watchdog: PEXPIRE lock 30000
  ├── [t=25s] Task completes → release lock
  │
  └── Lock released (DEL key)

If client crashes at t=15s:
  └── Watchdog dies → TTL counts down → lock expires at t=30s
```

---

## 🌐 Real-World GitHub Patterns & Industry Reference

- **[redisson/redisson](https://github.com/redisson/Redisson)** — Production-grade Redis Java client
- **[spring-boot/redisson integration](https://github.com/redisson/redisson/tree/master/redisson-spring-boot-starter)** — Spring Boot starter

---

## 🏷️ Framework Annotations & Dependencies

```xml
<dependency>
    <groupId>org.redisson</groupId>
    <artifactId>redisson-spring-boot-starter</artifactId>
    <version>3.32.0</version>
</dependency>
```

---

## ⚙️ Production Configuration

```yaml
# redisson.yml (referenced by spring.redis.redisson.file)
singleServerConfig:
  address: "redis://${REDIS_HOST:localhost}:${REDIS_PORT:6379}"
  password: ${REDIS_PASSWORD:}
  database: 0
  connectionPoolSize: 10
  connectionMinimumIdleSize: 5
  connectTimeout: 10000
  timeout: 3000
  retryAttempts: 3
  retryInterval: 1500

# For Sentinel HA:
# sentinelServersConfig:
#   masterName: "mymaster"
#   sentinelAddresses:
#     - "redis://sentinel1:26379"
#     - "redis://sentinel2:26379"
#     - "redis://sentinel3:26379"

# Lock configuration
app:
  distributed-lock:
    default-lease-time: 30s     # Lock TTL (watchdog keeps renewing)
    default-wait-time: 10s      # Max time to wait for lock acquisition
    watchdog-timeout: 30s       # Time before watchdog renewal (lease/3 internally)
```

---

## 📐 System Design Blueprint

### Complete Distributed Lock Implementation

```java
// ═══════════════════════════════════════════════════
// LOCK SERVICE — Clean Abstraction
// ═══════════════════════════════════════════════════

@Service
@RequiredArgsConstructor
@Slf4j
public class DistributedLockService {

    private final RedissonClient redisson;

    /**
     * Execute a function while holding a distributed lock.
     * Automatically releases lock even if function throws.
     */
    public <T> T withLock(String lockKey, Duration waitTime, Duration leaseTime,
                           Callable<T> action) throws Exception {
        var lock = redisson.getLock("lock:" + lockKey);

        boolean acquired = lock.tryLock(waitTime.toMillis(), leaseTime.toMillis(), TimeUnit.MILLISECONDS);

        if (!acquired) {
            throw new LockAcquisitionException(
                "Could not acquire lock for: " + lockKey + " within " + waitTime
            );
        }

        log.debug("Lock acquired: {}", lockKey);
        try {
            return action.call();
        } finally {
            if (lock.isHeldByCurrentThread()) {
                lock.unlock();
                log.debug("Lock released: {}", lockKey);
            }
        }
    }

    /**
     * Execute with lock — returns Optional (empty if can't acquire lock).
     * Non-blocking: returns immediately if lock is held.
     */
    public <T> Optional<T> tryWithLock(String lockKey, Callable<T> action) {
        var lock = redisson.getLock("lock:" + lockKey);

        if (!lock.tryLock()) {
            log.debug("Lock unavailable, skipping: {}", lockKey);
            return Optional.empty();
        }

        try {
            return Optional.ofNullable(action.call());
        } catch (Exception e) {
            throw new RuntimeException("Error executing under lock: " + lockKey, e);
        } finally {
            if (lock.isHeldByCurrentThread()) {
                lock.unlock();
            }
        }
    }

    /**
     * Fair lock: threads acquire in FIFO order (prevents starvation).
     * More expensive than regular lock — use only when fairness matters.
     */
    public <T> T withFairLock(String lockKey, Duration waitTime, Callable<T> action) throws Exception {
        var lock = redisson.getFairLock("fairlock:" + lockKey);

        boolean acquired = lock.tryLock(waitTime.toMillis(), TimeUnit.MILLISECONDS);
        if (!acquired) throw new LockAcquisitionException("Could not acquire fair lock: " + lockKey);

        try {
            return action.call();
        } finally {
            if (lock.isHeldByCurrentThread()) lock.unlock();
        }
    }

    /**
     * Multi-lock: acquire multiple locks atomically (for operations touching multiple resources).
     */
    public <T> T withMultiLock(List<String> lockKeys, Duration waitTime, Callable<T> action)
            throws Exception {
        var locks = lockKeys.stream()
            .map(key -> (RLock) redisson.getLock("lock:" + key))
            .toArray(RLock[]::new);

        var multiLock = redisson.getMultiLock(locks);
        boolean acquired = multiLock.tryLock(waitTime.toMillis(), TimeUnit.MILLISECONDS);

        if (!acquired) throw new LockAcquisitionException("Could not acquire multi-lock: " + lockKeys);

        try {
            return action.call();
        } finally {
            multiLock.unlock();
        }
    }
}

// ═══════════════════════════════════════════════════
// ANNOTATION-DRIVEN DISTRIBUTED LOCK
// ═══════════════════════════════════════════════════

@Target({ElementType.METHOD})
@Retention(RetentionPolicy.RUNTIME)
@Documented
public @interface DistributedLock {
    String key();                      // SpEL expression for key
    long waitTime() default 5000;      // ms to wait for lock
    long leaseTime() default 30000;    // ms for auto-release
    boolean fair() default false;
}

@Aspect
@Component
@RequiredArgsConstructor
@Slf4j
public class DistributedLockAspect {

    private final RedissonClient redisson;
    private final ExpressionParser parser = new SpelExpressionParser();

    @Around("@annotation(distributedLock)")
    public Object around(ProceedingJoinPoint pjp, DistributedLock distributedLock) throws Throwable {
        var lockKey = "lock:" + resolveKey(pjp, distributedLock.key());
        var lock = distributedLock.fair()
            ? redisson.getFairLock(lockKey)
            : redisson.getLock(lockKey);

        boolean acquired = lock.tryLock(
            distributedLock.waitTime(),
            distributedLock.leaseTime(),
            TimeUnit.MILLISECONDS
        );

        if (!acquired) {
            throw new LockAcquisitionException("Could not acquire distributed lock: " + lockKey);
        }

        log.debug("Distributed lock acquired: {}", lockKey);
        try {
            return pjp.proceed();
        } finally {
            if (lock.isHeldByCurrentThread()) {
                lock.unlock();
                log.debug("Distributed lock released: {}", lockKey);
            }
        }
    }

    private String resolveKey(ProceedingJoinPoint pjp, String keyExpression) {
        var method = ((MethodSignature) pjp.getSignature()).getMethod();
        var paramNames = new StandardReflectionParameterNameDiscoverer().getParameterNames(method);
        var context = new StandardEvaluationContext();

        if (paramNames != null) {
            var args = pjp.getArgs();
            for (int i = 0; i < paramNames.length; i++) {
                context.setVariable(paramNames[i], args[i]);
            }
        }

        return parser.parseExpression(keyExpression).getValue(context, String.class);
    }
}

// ═══════════════════════════════════════════════════
// USAGE EXAMPLES
// ═══════════════════════════════════════════════════

@Service
@RequiredArgsConstructor
@Slf4j
public class OrderProcessingService {

    private final DistributedLockService lockService;
    private final InventoryService inventoryService;
    private final OrderRepository orderRepo;

    // Method 1: Annotation-driven (cleaner)
    @DistributedLock(
        key = "'order:' + #orderId",  // SpEL expression
        waitTime = 5000,
        leaseTime = 30000
    )
    @Transactional
    public Order processOrder(Long orderId) {
        log.info("Processing order {} (under distributed lock)", orderId);
        var order = orderRepo.findById(orderId).orElseThrow();

        // This critical section is safe across all instances
        inventoryService.reserve(order.getItems());
        order.confirm();
        return orderRepo.save(order);
    }

    // Method 2: Programmatic (more control)
    @Transactional
    public Order processOrderProgrammatic(Long orderId) throws Exception {
        return lockService.withLock(
            "order:" + orderId,
            Duration.ofSeconds(5),     // wait
            Duration.ofSeconds(30),    // lease
            () -> {
                var order = orderRepo.findById(orderId).orElseThrow();
                inventoryService.reserve(order.getItems());
                order.confirm();
                return orderRepo.save(order);
            }
        );
    }

    // Method 3: Try without blocking (for optional operations)
    public boolean tryProcessOrder(Long orderId) {
        return lockService.tryWithLock("order:" + orderId, () -> {
            // Process if lock available; skip if another instance is processing
            var order = orderRepo.findById(orderId).orElseThrow();
            if (order.getStatus() != OrderStatus.PENDING) return null;
            order.confirm();
            return orderRepo.save(order);
        }).isPresent();
    }

    // Multi-resource lock: atomically lock two accounts for transfer
    @Transactional
    public void transferBalance(Long fromAccountId, Long toAccountId, BigDecimal amount) throws Exception {
        // Always acquire locks in consistent order to prevent deadlock
        var lockKeys = Stream.of(fromAccountId, toAccountId)
            .sorted()
            .map(id -> "account:" + id)
            .toList();

        lockService.withMultiLock(lockKeys, Duration.ofSeconds(10), () -> {
            accountService.debit(fromAccountId, amount);
            accountService.credit(toAccountId, amount);
            return null;
        });
    }

    // Idempotent processing with lock (prevent duplicate processing)
    @DistributedLock(key = "'payment:' + #paymentId", leaseTime = 60000)
    public PaymentResult processPayment(String paymentId, PaymentRequest request) {
        // Check idempotency key
        var existing = paymentRepo.findByIdempotencyKey(paymentId);
        if (existing.isPresent()) {
            log.info("Idempotent: payment {} already processed", paymentId);
            return existing.get().toResult();
        }

        // Process payment
        var result = paymentGateway.charge(request);
        paymentRepo.save(Payment.from(paymentId, result));
        return result;
    }
}
```

---

## 🧪 Verification Commands

```powershell
# Start Redis with Sentinel for HA
docker run -d --name redis-main -p 6379:6379 redis:7-alpine
docker run -d --name redis-sentinel -p 26379:26379 `
  -v ${PWD}/sentinel.conf:/etc/redis/sentinel.conf `
  redis:7-alpine redis-sentinel /etc/redis/sentinel.conf

# Test distributed lock with concurrent requests
$jobs = 1..5 | ForEach-Object {
    $id = $_
    Start-Job {
        Write-Host "Job $using:id: attempting order processing"
        Invoke-RestMethod -Method POST `
            -Uri "http://localhost:8080/api/v1/orders/100/process" `
            -Headers @{ Authorization = "Bearer $using:token" }
        Write-Host "Job $using:id: completed"
    }
}
$jobs | Wait-Job | Receive-Job

# Check Redis for active locks
docker exec redis-main redis-cli KEYS "lock:*"
docker exec redis-main redis-cli TTL "lock:order:100"

# Monitor lock acquisition events
docker exec redis-main redis-cli MONITOR | Select-String "lock:"
```

---

## ⚡ Best Practices & Anti-Patterns

### ✅ Best Practices
1. **Watchdog = don't set explicit leaseTime** — If you use `lock.lock()` (without timeout), watchdog auto-renews. If you use `lock.tryLock(waitTime, leaseTime)`, watchdog is disabled — you're responsible for leaseTime being long enough.
2. **Always unlock in `finally`** — `if (lock.isHeldByCurrentThread()) lock.unlock()` — the `isHeldByCurrentThread()` check prevents unlocking a lock you don't hold (if it auto-expired).
3. **Order multi-lock keys consistently** — `sort(lockKeys)` before acquiring multi-lock prevents deadlock (Thread A: lock(1,2); Thread B: lock(2,1) → deadlock).

### ❌ Anti-Patterns

| Anti-Pattern | Fix |
|-------------|-----|
| Lock without `isHeldByCurrentThread()` check | If lock TTL expires during long operation, unlock() throws exception |
| Very long leaseTime (hours) | If app crashes, DB is locked for hours. Use watchdog instead |
| Locking too coarsely (entire resource type) | Lock `"order:123"` not `"orders"` — fine-grained keys maximize throughput |
| Using JVM lock (`synchronized`) in clustered app | Use Redisson for cluster-wide locking |
| Network call inside locked section | Keep locked sections minimal; no HTTP calls inside critical section |
