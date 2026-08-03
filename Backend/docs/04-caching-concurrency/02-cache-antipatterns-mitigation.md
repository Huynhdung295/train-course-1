# 🛡️ Cache Anti-Patterns & Mitigation Strategies

> **Category**: Caching | **Complexity**: Advanced | **Java**: 21+ | **Redis** | **Redisson**

---

## 📖 Core Technical Mechanics & Deep-Dive

### The Three Cache Nightmares

#### 1. Cache Avalanche (缓存雪崩)
**Problem**: Many cache entries expire simultaneously → massive spike of requests hitting the DB simultaneously → DB overload → cascade failure.

```
Time 00:00 — All cached at midnight with TTL = 1 hour
Time 01:00 — ALL entries expire at the SAME SECOND
              → 10,000 simultaneous DB queries
              → DB overwhelmed → timeouts → application down
```

**Solutions**:
- **Randomized TTL** — `baseTTL + random(0, baseTTL * 0.2)` — entries expire at different times
- **Staggered warm-up** — Pre-populate cache before expiry (background refresh)
- **Circuit Breaker on DB** — Prevent cascade: fail fast with cached/default response

#### 2. Cache Penetration (缓存穿透)
**Problem**: Requests for non-existent keys bypass cache and hit DB every time (attacker or bug sends random IDs).

```
Attacker sends: GET /api/products/nonexistent-id-1
                GET /api/products/nonexistent-id-2
                GET /api/products/nonexistent-id-3
                (10,000 requests/second with random IDs)

Cache: MISS (key doesn't exist) → DB query → No result → Cache MISS again next time
Result: DB receives 10,000 full queries for data that doesn't exist
```

**Solutions**:
- **Cache null values** — Store `null` result with short TTL (60s). Next request: cache HIT `null`
- **Bloom Filter** — Probabilistic filter: "definitely not in DB" → skip DB entirely

#### 3. Cache Stampede / Hotspot (缓存击穿)
**Problem**: Single highly-popular cache key expires → massive concurrent requests all try to rebuild the cache simultaneously → DB receives 1000 identical queries.

```
Popular product page: cached, TTL expires at 12:00:00.000

At 12:00:00.001:
  Thread 1: Cache MISS → query DB
  Thread 2: Cache MISS → query DB  (same key!)
  Thread 3: Cache MISS → query DB  (same key!)
  ...
  Thread 1000: Cache MISS → query DB  ← 1000 identical queries!
```

**Solutions**:
- **Distributed rebuild lock** — Only ONE thread rebuilds; others wait
- **Early expiry detection** — Rebuild before expiry (probabilistic early expiration)
- **Background refresh** — Async refresh while serving stale

---

## 🌐 Real-World GitHub Patterns & Industry Reference

- **[alibaba/RedisBloom](https://github.com/RedisBloom/RedisBloom)** — Redis Bloom Filter module
- **[google/guava BloomFilter](https://github.com/google/guava/wiki/HashingExplained)** — In-JVM Bloom Filter
- **[redisson/redisson](https://github.com/redisson/Redisson)** — `RBloomFilter`, `RLock` for stampede prevention

---

## 🏷️ Dependencies

```xml
<!-- Redisson (Bloom Filter + Distributed Lock) -->
<dependency>
    <groupId>org.redisson</groupId>
    <artifactId>redisson-spring-boot-starter</artifactId>
    <version>3.32.0</version>
</dependency>

<!-- Guava Bloom Filter (simpler, in-JVM) -->
<dependency>
    <groupId>com.google.guava</groupId>
    <artifactId>guava</artifactId>
    <version>33.2.1-jre</version>
</dependency>
```

---

## 📐 System Design Blueprint

### Complete Anti-Pattern Mitigation

```java
// ═══════════════════════════════════════════════════
// 1. CACHE AVALANCHE — Randomized TTL
// ═══════════════════════════════════════════════════

@Component
@RequiredArgsConstructor
public class RandomizedTtlCacheService {

    private final RedisTemplate<String, Object> redisTemplate;
    private final Random random = new SecureRandom();

    /**
     * Set value with randomized TTL to prevent avalanche.
     * baseTtl = 1 hour → actual TTL = 60-72 minutes (randomly)
     */
    public void setWithJitter(String key, Object value, Duration baseTtl) {
        // Add up to 20% random jitter
        var jitterSeconds = (long) (baseTtl.getSeconds() * 0.2 * random.nextDouble());
        var actualTtl = baseTtl.plusSeconds(jitterSeconds);

        redisTemplate.opsForValue().set(key, value, actualTtl);
    }

    /**
     * Background refresh: refresh cache entry BEFORE it expires.
     * Triggered when remaining TTL < threshold.
     */
    public <T> T getWithBackgroundRefresh(
            String key, Class<T> type,
            Supplier<T> dbLoader,
            Duration fullTtl,
            Duration refreshThreshold) {

        var ttl = redisTemplate.getExpire(key, TimeUnit.SECONDS);
        var value = (T) redisTemplate.opsForValue().get(key);

        if (value != null) {
            // Trigger background refresh if approaching expiry
            if (ttl != null && ttl < refreshThreshold.getSeconds()) {
                CompletableFuture.runAsync(() -> {
                    var freshValue = dbLoader.get();
                    setWithJitter(key, freshValue, fullTtl);
                });
            }
            return value;
        }

        // Cache miss — load synchronously
        var freshValue = dbLoader.get();
        setWithJitter(key, freshValue, fullTtl);
        return freshValue;
    }
}

// ═══════════════════════════════════════════════════
// 2. CACHE PENETRATION — Bloom Filter + Null Caching
// ═══════════════════════════════════════════════════

@Service
@RequiredArgsConstructor
@Slf4j
public class BloomFilterCacheService {

    private final RedissonClient redisson;
    private final ProductRepository productRepo;
    private final RedisTemplate<String, Object> redisTemplate;

    // In-memory Bloom Filter (use Redisson's RBloomFilter for cluster)
    private BloomFilter<String> productIdFilter;

    @PostConstruct
    public void initBloomFilter() {
        // Guava Bloom Filter: 10M expected insertions, 0.01% false positive rate
        productIdFilter = BloomFilter.create(
            Funnels.stringFunnel(StandardCharsets.UTF_8),
            10_000_000,    // expected elements
            0.0001          // false positive probability
        );

        // Load all existing product IDs from DB into Bloom Filter
        productRepo.findAllIds().forEach(id -> productIdFilter.put(id.toString()));
        log.info("Bloom filter initialized with {} products", productIdFilter.approximateElementCount());
    }

    // Or use Redisson's distributed Bloom Filter (cluster-safe)
    @Bean
    public RBloomFilter<String> redisBloomFilter() {
        var filter = redisson.<String>getBloomFilter("product:exists");
        filter.tryInit(10_000_000L, 0.0001);   // Init only if not already exists
        return filter;
    }

    public Optional<Product> findProduct(String productId) {
        // 1. Check Bloom Filter first — definitely NOT exists?
        if (!productIdFilter.mightContain(productId)) {
            log.debug("Bloom filter: product {} definitely does not exist", productId);
            return Optional.empty();  // Skip DB entirely
        }

        // 2. Check Redis cache (including null values)
        var cacheKey = "product:" + productId;
        var cached = redisTemplate.opsForValue().get(cacheKey);

        if (cached != null) {
            if (cached instanceof NullValue) {
                log.debug("Null-cached product: {}", productId);
                return Optional.empty();
            }
            return Optional.of((Product) cached);
        }

        // 3. Query DB
        var product = productRepo.findById(UUID.fromString(productId));

        if (product.isEmpty()) {
            // Cache null result with short TTL (60 seconds)
            // Prevents repeated DB queries for same non-existent ID
            redisTemplate.opsForValue().set(cacheKey, NullValue.INSTANCE, Duration.ofSeconds(60));
            log.debug("Caching null for non-existent product: {}", productId);
        } else {
            // Cache real product
            redisTemplate.opsForValue().set(cacheKey, product.get(), Duration.ofMinutes(30));
            // Add to Bloom Filter for future requests
            productIdFilter.put(productId);
        }

        return product;
    }
}

// Sentinel value for null caching
public final class NullValue implements Serializable {
    public static final NullValue INSTANCE = new NullValue();
    private NullValue() {}
    @Override public String toString() { return "NullValue"; }
}

// ═══════════════════════════════════════════════════
// 3. CACHE STAMPEDE — Distributed Rebuild Lock
// ═══════════════════════════════════════════════════

@Service
@RequiredArgsConstructor
@Slf4j
public class StampedePreventionCacheService {

    private final RedissonClient redisson;
    private final RedisTemplate<String, Object> redisTemplate;

    /**
     * Get or load with distributed lock to prevent stampede.
     * Only ONE thread rebuilds the cache; others wait with timeout.
     */
    public <T> T getOrLoad(
            String cacheKey,
            Class<T> type,
            Supplier<T> loader,
            Duration ttl) {

        // 1. Check cache (lock-free fast path)
        var cached = redisTemplate.opsForValue().get(cacheKey);
        if (cached != null) {
            return type.cast(cached);
        }

        // 2. Acquire distributed lock for this specific cache key
        var lockKey = "cache:lock:" + cacheKey;
        var lock = redisson.getLock(lockKey);

        try {
            // Wait max 10s for lock; auto-release after 60s (prevents deadlock)
            boolean acquired = lock.tryLock(10, 60, TimeUnit.SECONDS);

            if (!acquired) {
                // Could not get lock — return stale or default
                log.warn("Could not acquire cache rebuild lock for: {}", cacheKey);
                return type.cast(redisTemplate.opsForValue().get(cacheKey));
            }

            // 3. Double-check: another thread may have rebuilt while we waited
            cached = redisTemplate.opsForValue().get(cacheKey);
            if (cached != null) {
                log.debug("Cache rebuilt by another thread for: {}", cacheKey);
                return type.cast(cached);
            }

            // 4. We won the lock — rebuild cache
            log.debug("Rebuilding cache under lock: {}", cacheKey);
            var value = loader.get();

            if (value != null) {
                redisTemplate.opsForValue().set(cacheKey, value, ttl);
            }

            return value;

        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new CacheLockInterruptedException("Interrupted while waiting for cache lock", e);
        } finally {
            if (lock.isHeldByCurrentThread()) {
                lock.unlock();
            }
        }
    }

    /**
     * Probabilistic Early Expiration (XFetch algorithm).
     * Proactively refreshes cache before expiry based on compute cost.
     * Avoids stampede without locking — at the cost of occasional early refresh.
     */
    public <T> T getWithEarlyExpiry(
            String cacheKey,
            Class<T> type,
            Supplier<T> loader,
            Duration ttl,
            double beta) {  // beta=1.0 standard; higher = more eager refresh

        var ttlSeconds = redisTemplate.getExpire(cacheKey, TimeUnit.SECONDS);
        var cached = redisTemplate.opsForValue().get(cacheKey);

        if (cached != null && ttlSeconds != null) {
            // XFetch: refresh early if: now + beta * computeTime * log(random) > expiry
            // For simplicity: refresh when TTL < 10% of total TTL
            var earlyRefreshThreshold = ttl.getSeconds() * 0.1;
            if (ttlSeconds > earlyRefreshThreshold) {
                return type.cast(cached);
            }
        }

        // Rebuild
        var value = loader.get();
        if (value != null) {
            var jitter = (long) (ttl.getSeconds() * 0.1 * Math.random());
            redisTemplate.opsForValue().set(cacheKey, value, ttl.plusSeconds(jitter));
        }
        return value;
    }
}

// ═══════════════════════════════════════════════════
// USAGE IN SERVICE
// ═══════════════════════════════════════════════════

@Service
@RequiredArgsConstructor
public class ProductService {

    private final StampedePreventionCacheService stampedePrevention;
    private final BloomFilterCacheService bloomFilter;
    private final RandomizedTtlCacheService avalanchePrevention;

    public Product getProduct(String productId) {
        return stampedePrevention.getOrLoad(
            "product:" + productId,
            Product.class,
            () -> bloomFilter.findProduct(productId).orElseThrow(
                () -> new ProductNotFoundException(productId)
            ),
            Duration.ofMinutes(30)
        );
    }

    // New product: add to Bloom Filter
    @Transactional
    public Product createProduct(CreateProductCommand cmd) {
        var product = productRepo.save(Product.create(cmd));
        bloomFilter.getProductIdFilter().put(product.getId().toString());
        return product;
    }
}
```

---

## 🧪 Verification Commands

```powershell
# Start Redis
docker run -d --name redis-anti -p 6379:6379 redis:7-alpine

# Test Bloom Filter effectiveness
# Load 1M fake product IDs, query 1000 non-existent → expect all blocked by Bloom Filter
$body = @{ action = "init-bloom-filter" } | ConvertTo-Json
Invoke-RestMethod -Method POST -Uri "http://localhost:8080/api/v1/admin/cache/init-bloom-filter" `
    -Headers @{ Authorization = "Bearer $adminToken" } -ContentType "application/json" -Body $body

# Simulate cache penetration attack (non-existent IDs)
1..100 | ForEach-Object {
    try {
        Invoke-RestMethod -Uri "http://localhost:8080/api/v1/products/fake-id-$_"
    } catch { }
}

# Check Redis for null cache entries (should be 0 due to Bloom Filter)
docker exec redis-anti redis-cli KEYS "product:*" | Measure-Object
```

---

## ⚡ Best Practices & Anti-Patterns

### ✅ Best Practices
1. **Always set max TTL on null cache entries** — Never cache null without TTL; creates stale "doesn't exist" that persists after creation
2. **Bloom Filter false positive rate ~0.01%** — Acceptable; 0.01% of existing products may be wrongly excluded from fast path
3. **Redisson lock with lease renewal** — For long cache rebuilds, Redisson auto-renews lock before expiry

### ❌ Anti-Patterns

| Anti-Pattern | Fix |
|-------------|-----|
| Fixed TTL for all cache entries | Randomize TTL with ±20% jitter |
| No protection against stampede on popular keys | Add distributed lock or early expiry |
| Caching null without TTL | Short TTL (60s) for null values |
| Querying DB for obviously invalid IDs | Bloom Filter pre-check |
