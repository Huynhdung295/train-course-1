# 🚀 Multi-Level Cache: Caffeine (L1) + Redis (L2)

> **Category**: Caching & Concurrency | **Complexity**: Advanced | **Java**: 21+ | **Spring Boot**: 3.3+

---

## 📖 Core Technical Mechanics & Deep-Dive

### Two-Level Cache Architecture

```
Request
  │
  ▼
L1 Cache (Caffeine — In-Process JVM Heap)
  ├── Hit → Return immediately (nanoseconds)
  └── Miss ↓
      │
      ▼
  L2 Cache (Redis — Network Call)
      ├── Hit → Store in L1, return (microseconds)
      └── Miss ↓
          │
          ▼
      Database / External API (milliseconds)
          └── Store result in L2 → Store in L1 → Return
```

**Why two levels?**
- **L1 (Caffeine)**: Sub-millisecond access, no network, bounded by JVM heap
- **L2 (Redis)**: Shared across multiple instances, survives app restart, larger capacity
- **Together**: L1 absorbs hot spots; L2 provides cluster-wide consistency

### Caffeine Cache Internals

Caffeine is a high-performance Java caching library implementing near-optimal eviction via **TinyLFU** (Window TinyLFU) algorithm:
- Tracks access frequency with minimal memory overhead
- Outperforms LRU for most workloads (handles recency AND frequency)
- Lock-free reads via ConcurrentHashMap with striped locks

### Cache Coherence Problem

In a multi-instance deployment with L1 caches:
```
Instance A: Updates user → invalidates L2 Redis → invalidates L1 Caffeine (Instance A only)
Instance B: Still has stale data in L1 Caffeine!

Solution: Redis Pub/Sub — broadcast cache invalidation to all instances
```

---

## 🌐 Real-World GitHub Patterns & Industry Reference

- **[ben-manes/caffeine](https://github.com/ben-manes/caffeine)** — Caffeine library (used by Spring Boot internally)
- **[redis/lettuce](https://github.com/lettuce-io/lettuce-core)** — Non-blocking Redis client used by Spring Data Redis
- **[redisson/redisson](https://github.com/redisson/Redisson)** — Redis Java client with distributed data structures

---

## 🏷️ Framework Annotations & Dependencies

```xml
<!-- Spring Cache abstraction (included in spring-boot-starter-web) -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-cache</artifactId>
</dependency>

<!-- L1: Caffeine -->
<dependency>
    <groupId>com.github.ben-manes.caffeine</groupId>
    <artifactId>caffeine</artifactId>
</dependency>

<!-- L2: Redis via Lettuce (recommended) -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-data-redis</artifactId>
</dependency>

<!-- OR Redisson (for distributed lock + cache combined) -->
<dependency>
    <groupId>org.redisson</groupId>
    <artifactId>redisson-spring-boot-starter</artifactId>
    <version>3.32.0</version>
</dependency>
```

### Key Cache Annotations

| Annotation | Purpose |
|-----------|---------|
| `@EnableCaching` | Activate Spring Cache AOP |
| `@Cacheable(value="orders", key="#id")` | Cache method result by key |
| `@CachePut(value="orders", key="#result.id")` | Update cache on write |
| `@CacheEvict(value="orders", key="#id")` | Remove from cache |
| `@CacheEvict(allEntries=true)` | Clear entire cache region |
| `@Caching(evict={...}, put={...})` | Combine multiple cache ops |
| `@CacheConfig(cacheNames="orders")` | Class-level cache name |

---

## ⚙️ Production Configuration

```yaml
spring:
  cache:
    type: caffeine    # L1 default; overridden by custom config below

  data:
    redis:
      host: ${REDIS_HOST:localhost}
      port: ${REDIS_PORT:6379}
      password: ${REDIS_PASSWORD:}
      lettuce:
        pool:
          max-active: 8
          max-idle: 8
          min-idle: 2
          max-wait: 100ms
        shutdown-timeout: 100ms

# Cache region configuration
app:
  cache:
    regions:
      # Frequently accessed, short TTL
      user-profiles:
        caffeine-max-size: 1000
        caffeine-expire-after-write: 5m
        redis-ttl: 30m

      # Less frequent, longer TTL
      product-catalog:
        caffeine-max-size: 500
        caffeine-expire-after-write: 10m
        redis-ttl: 2h

      # Very stable data, long TTL
      configuration:
        caffeine-max-size: 100
        caffeine-expire-after-write: 30m
        redis-ttl: 24h

      # High-churn data, very short TTL
      order-status:
        caffeine-max-size: 5000
        caffeine-expire-after-write: 30s
        redis-ttl: 5m
```

---

## 📐 System Design Blueprint

### Complete Two-Level Cache Implementation

```java
// ═══════════════════════════════════════════════════
// CACHE CONFIGURATION — L1 + L2 Setup
// ═══════════════════════════════════════════════════

@Configuration
@EnableCaching
@RequiredArgsConstructor
@Slf4j
public class CacheConfig {

    private final RedisConnectionFactory redisConnectionFactory;

    // L1: Caffeine local cache per region
    private CaffeineCache buildCaffeineCache(String name, int maxSize, Duration expiry) {
        return new CaffeineCache(name,
            Caffeine.newBuilder()
                .maximumSize(maxSize)
                .expireAfterWrite(expiry)
                .recordStats()           // Enable hit/miss stats for Micrometer
                .removalListener((key, val, cause) ->
                    log.debug("L1 cache eviction: cache={}, key={}, cause={}", name, key, cause))
                .build());
    }

    // L2: Redis cache per region with serialization
    private RedisCacheConfiguration buildRedisCacheConfig(Duration ttl) {
        return RedisCacheConfiguration.defaultCacheConfig()
            .entryTtl(ttl)
            .serializeKeysWith(RedisSerializationContext.SerializationPair.fromSerializer(
                new StringRedisSerializer()))
            .serializeValuesWith(RedisSerializationContext.SerializationPair.fromSerializer(
                new GenericJackson2JsonRedisSerializer()))
            .disableCachingNullValues();   // Don't cache nulls (use Bloom filter for that)
    }

    @Bean
    public CacheManager cacheManager() {
        // Build L1 Caffeine caches
        var caffeineCaches = Map.of(
            "user-profiles",  buildCaffeineCache("user-profiles",  1000, Duration.ofMinutes(5)),
            "product-catalog", buildCaffeineCache("product-catalog", 500, Duration.ofMinutes(10)),
            "configuration",  buildCaffeineCache("configuration",   100, Duration.ofMinutes(30)),
            "order-status",   buildCaffeineCache("order-status",   5000, Duration.ofSeconds(30))
        );

        // Build L2 Redis cache configs per region
        var redisCacheConfigs = Map.of(
            "user-profiles",   buildRedisCacheConfig(Duration.ofMinutes(30)),
            "product-catalog", buildRedisCacheConfig(Duration.ofHours(2)),
            "configuration",   buildRedisCacheConfig(Duration.ofHours(24)),
            "order-status",    buildRedisCacheConfig(Duration.ofMinutes(5))
        );

        // L2 Redis cache manager
        var redisCacheManager = RedisCacheManager.builder(redisConnectionFactory)
            .withInitialCacheConfigurations(redisCacheConfigs)
            .transactionAware()
            .build();

        // Compose: L1 checks first, then L2
        return new TwoLevelCacheManager(caffeineCaches, redisCacheManager);
    }
}

// ═══════════════════════════════════════════════════
// TWO-LEVEL CACHE MANAGER
// ═══════════════════════════════════════════════════

@Slf4j
public class TwoLevelCacheManager implements CacheManager {

    private final Map<String, CaffeineCache> l1Caches;
    private final CacheManager l2Manager;
    private final StringRedisTemplate redisTemplate;

    // Invalidation channel for cluster-wide L1 invalidation
    private static final String INVALIDATION_CHANNEL = "cache:invalidation";

    @Override
    public Cache getCache(String name) {
        var l1 = l1Caches.get(name);
        var l2 = l2Manager.getCache(name);

        if (l1 == null || l2 == null) {
            log.warn("No cache configured for region: {}", name);
            return l2;  // Fall back to L2 only
        }

        return new TwoLevelCache(name, l1, l2, redisTemplate);
    }

    @Override
    public Collection<String> getCacheNames() {
        return l1Caches.keySet();
    }
}

// ═══════════════════════════════════════════════════
// TWO-LEVEL CACHE IMPLEMENTATION
// ═══════════════════════════════════════════════════

@Slf4j
@RequiredArgsConstructor
public class TwoLevelCache implements Cache {

    private final String name;
    private final Cache l1;       // Caffeine
    private final Cache l2;       // Redis
    private final StringRedisTemplate redisTemplate;

    @Override
    public ValueWrapper get(Object key) {
        // Check L1 first
        var l1Value = l1.get(key);
        if (l1Value != null) {
            log.trace("L1 cache HIT: cache={}, key={}", name, key);
            return l1Value;
        }

        // L1 miss — check L2
        var l2Value = l2.get(key);
        if (l2Value != null) {
            log.debug("L2 cache HIT (L1 miss): cache={}, key={}", name, key);
            // Promote to L1
            l1.put(key, l2Value.get());
            return l2Value;
        }

        log.debug("Cache MISS (both levels): cache={}, key={}", name, key);
        return null;
    }

    @Override
    public void put(Object key, Object value) {
        l1.put(key, value);
        l2.put(key, value);
    }

    @Override
    public void evict(Object key) {
        l1.evict(key);
        l2.evict(key);
        // Broadcast invalidation to other instances
        broadcastInvalidation(key);
    }

    @Override
    public void clear() {
        l1.clear();
        l2.clear();
        broadcastInvalidation("*");
    }

    private void broadcastInvalidation(Object key) {
        var message = name + ":" + key.toString();
        redisTemplate.convertAndSend("cache:invalidation", message);
    }

    @Override
    public String getName() { return name; }

    @Override
    public Object getNativeCache() { return this; }

    @Override
    public <T> T get(Object key, Class<T> type) {
        var wrapper = get(key);
        return wrapper != null ? type.cast(wrapper.get()) : null;
    }

    @Override
    public <T> T get(Object key, Callable<T> valueLoader) {
        var wrapper = get(key);
        if (wrapper != null) return (T) wrapper.get();

        try {
            var value = valueLoader.call();
            put(key, value);
            return value;
        } catch (Exception e) {
            throw new ValueRetrievalException(key, valueLoader, e);
        }
    }
}

// ═══════════════════════════════════════════════════
// CLUSTER INVALIDATION — Redis Pub/Sub Listener
// ═══════════════════════════════════════════════════

@Component
@RequiredArgsConstructor
@Slf4j
public class CacheInvalidationListener {

    private final CacheManager cacheManager;

    @Bean
    public RedisMessageListenerContainer cacheInvalidationContainer(
            RedisConnectionFactory factory) {
        var container = new RedisMessageListenerContainer();
        container.setConnectionFactory(factory);
        container.addMessageListener(
            (message, pattern) -> handleInvalidation(new String(message.getBody())),
            new ChannelTopic("cache:invalidation")
        );
        return container;
    }

    private void handleInvalidation(String message) {
        var parts = message.split(":", 2);
        if (parts.length != 2) return;

        var cacheName = parts[0];
        var key = parts[1];

        var cache = cacheManager.getCache(cacheName);
        if (cache instanceof TwoLevelCache twoLevel) {
            // Only invalidate L1 (don't cascade — that triggered this message)
            if ("*".equals(key)) {
                twoLevel.getL1().clear();
            } else {
                twoLevel.getL1().evict(key);
            }
            log.debug("L1 invalidated by cluster broadcast: cache={}, key={}", cacheName, key);
        }
    }
}

// ═══════════════════════════════════════════════════
// USAGE — @Cacheable with Two-Level Cache
// ═══════════════════════════════════════════════════

@Service
@RequiredArgsConstructor
@CacheConfig(cacheNames = "user-profiles")
public class UserProfileService {

    private final UserRepository userRepo;

    // GET: Check L1 → L2 → DB
    @Cacheable(key = "#userId.toString()")
    public UserProfile getProfile(UUID userId) {
        log.info("Loading user profile from DB: {}", userId);
        return userRepo.findProfileById(userId)
            .orElseThrow(() -> new UserNotFoundException(userId));
    }

    // PUT: Update cache after write (keeps cache fresh)
    @CachePut(key = "#result.id.toString()")
    @Transactional
    public UserProfile updateProfile(UUID userId, UpdateProfileRequest request) {
        var user = userRepo.findById(userId).orElseThrow();
        user.updateProfile(request);
        return userRepo.save(user).toProfile();
    }

    // EVICT: Remove on delete
    @CacheEvict(key = "#userId.toString()")
    @Transactional
    public void deleteUser(UUID userId) {
        userRepo.deleteById(userId);
    }

    // EVICT ALL: Clear entire region
    @CacheEvict(allEntries = true)
    @Scheduled(cron = "0 0 3 * * *")   // 3 AM daily warm refresh
    public void warmUpCache() {
        log.info("Warming up user-profiles cache...");
        userRepo.findTop1000ByLastLoginAtAfter(Instant.now().minus(Duration.ofDays(7)))
            .forEach(user -> getProfile(user.getId()));
    }

    // Complex: multiple cache operations
    @Caching(
        evict = @CacheEvict(cacheNames = "user-profiles", key = "#userId.toString()"),
        put = @CachePut(cacheNames = "user-roles", key = "#userId.toString()")
    )
    public List<Role> changeUserRoles(UUID userId, List<Role> roles) {
        return userService.updateRoles(userId, roles);
    }
}
```

---

## 🧪 Verification Commands

```powershell
# Start Redis
docker run -d --name redis-cache -p 6379:6379 `
  redis:7-alpine --requirepass "cache-secret" --maxmemory 512mb --maxmemory-policy allkeys-lru

# Check cache metrics via Actuator
Invoke-RestMethod -Uri "http://localhost:8080/actuator/caches" | ConvertTo-Json -Depth 5

# Monitor cache hits
Invoke-RestMethod -Uri "http://localhost:8080/actuator/metrics/cache.gets" |
    ConvertTo-Json -Depth 3

# View Redis keys
docker exec redis-cache redis-cli -a "cache-secret" KEYS "*"
docker exec redis-cache redis-cli -a "cache-secret" TTL "user-profiles::user-123"

# Monitor Redis in real time
docker exec redis-cache redis-cli -a "cache-secret" MONITOR
```

---

## ⚡ Best Practices & Anti-Patterns

### ✅ Best Practices
1. **Cache cache-friendly, immutable-ish data** — User profiles, product details, config — not live financial balances
2. **Serialize with Jackson2 to Redis** — Readable JSON in Redis makes debugging trivial
3. **Register Caffeine stats with Micrometer** — `recordStats()` + Micrometer for Grafana dashboard

### ❌ Anti-Patterns

| Anti-Pattern | Fix |
|-------------|-----|
| `@Cacheable` on `@Transactional` methods | Cache is checked before TX opens; stale data can be returned during TX |
| Caching mutable security-sensitive data | User roles/permissions must never be cached without short TTL |
| Not setting max size on Caffeine | Unbounded growth → OOM |
| Cache key collisions across services | Prefix keys: `service-name:cache-region:actual-key` |
