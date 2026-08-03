# 🚦 Rate Limiting & Throttling (Redis + Bucket4j)

> **Category**: Resilience & Integration | **Complexity**: Intermediate | **Java**: 21+ | **Spring Boot**: 3.3+ | **Redis**

---

## 📖 Core Technical Mechanics & Deep-Dive

### Why Rate Limiting?
- **Prevent Abuse/DDoS**: Stop malicious users from taking down your service.
- **Fair Usage**: Ensure no single tenant/user monopolizes system resources.
- **Cost Control**: Limit calls to expensive downstream APIs (e.g., OpenAI, Twilio).

### Algorithms
1. **Fixed Window**: 100 requests per minute. (Flaw: A user can send 100 requests at 00:59 and 100 at 01:01, effectively doing 200 requests in 2 seconds).
2. **Sliding Window**: Smooths out bursts by tracking timestamps of recent requests. More memory intensive.
3. **Token Bucket (Bucket4j)**: Tokens are added to a bucket at a fixed rate. Requests consume tokens. Allows for controlled bursts while enforcing an average rate over time. **(Industry Standard)**.

### Why Bucket4j + Redis?
In a clustered microservices environment, rate limits must be shared across all JVM instances. Bucket4j provides a highly optimized implementation of the Token Bucket algorithm, and it integrates seamlessly with Redis to store the bucket state atomically using Lua scripts.

---

## 🌐 Real-World GitHub Patterns & Industry Reference

- **[bucket4j/bucket4j](https://github.com/bucket4j/bucket4j)** — The standard Java rate limiting library.
- **[MarcGiffing/bucket4j-spring-boot-starter](https://github.com/MarcGiffing/bucket4j-spring-boot-starter)** — Excellent Spring Boot auto-configuration for Bucket4j.

---

## 🏷️ Framework Annotations & Dependencies

```xml
<!-- Bucket4j Core + Redis integration -->
<dependency>
    <groupId>com.bucket4j</groupId>
    <artifactId>bucket4j-redis</artifactId>
    <version>8.10.0</version>
</dependency>
<dependency>
    <groupId>com.bucket4j</groupId>
    <artifactId>bucket4j-core</artifactId>
    <version>8.10.0</version>
</dependency>

<!-- Redis (Lettuce client) -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-data-redis</artifactId>
</dependency>
```
*Note: We are implementing this programmatically via an Interceptor, which provides more control than the Spring Boot Starter property files.*

---

## 📐 System Design Blueprint

### Complete Distributed Rate Limiter

```java
// ═══════════════════════════════════════════════════
// 1. REDIS BUCKET4J CONFIGURATION
// ═══════════════════════════════════════════════════

@Configuration
@RequiredArgsConstructor
public class RateLimitConfig {

    private final RedisConnectionFactory redisConnectionFactory;

    /**
     * Initializes the Bucket4j ProxyManager backed by Redis (Lettuce).
     * This manager handles the Lua scripts that atomically decrement tokens.
     */
    @Bean
    public ProxyManager<byte[]> bucketProxyManager() {
        // Use Lettuce-based Redis implementation for Bucket4j
        var lettuceClient = ((LettuceConnectionFactory) redisConnectionFactory).getNativeClient();
        
        if (lettuceClient instanceof RedisClient client) {
            return LettuceBasedProxyManager.builderFor(client).build();
        } else if (lettuceClient instanceof RedisClusterClient clusterClient) {
            return LettuceBasedProxyManager.builderFor(clusterClient).build();
        }
        throw new IllegalStateException("Unsupported Redis Client");
    }
}

// ═══════════════════════════════════════════════════
// 2. RATE LIMITING SERVICE (Dynamic Pricing Tiers)
// ═══════════════════════════════════════════════════

@Service
@RequiredArgsConstructor
public class RateLimitingService {

    private final ProxyManager<byte[]> proxyManager;

    /**
     * Resolves the bucket for a specific API Key.
     * Different pricing tiers get different bucket configurations.
     */
    public Bucket resolveBucket(String apiKey, Tier planTier) {
        Supplier<BucketConfiguration> configSupplier = () -> switch (planTier) {
            case FREE -> BucketConfiguration.builder()
                .addLimit(limit -> limit.capacity(10).refillGreedy(10, Duration.ofMinutes(1)))
                .build();
            case PRO -> BucketConfiguration.builder()
                .addLimit(limit -> limit.capacity(100).refillGreedy(100, Duration.ofMinutes(1)))
                .build();
            case ENTERPRISE -> BucketConfiguration.builder()
                .addLimit(limit -> limit.capacity(1000).refillGreedy(1000, Duration.ofMinutes(1)))
                .build();
        };

        // Get or create the bucket in Redis. Key is prefixed to avoid collisions.
        byte[] redisKey = ("rate_limit:" + apiKey).getBytes(StandardCharsets.UTF_8);
        return proxyManager.builder().build(redisKey, configSupplier);
    }
}

public enum Tier { FREE, PRO, ENTERPRISE }

// ═══════════════════════════════════════════════════
// 3. SPRING MVC INTERCEPTOR (Enforcement)
// ═══════════════════════════════════════════════════

@Component
@RequiredArgsConstructor
@Slf4j
public class RateLimitInterceptor implements HandlerInterceptor {

    private final RateLimitingService rateLimitingService;
    private final ApiKeyRepository apiKeyRepository; // Resolves Tier from API Key

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) 
            throws Exception {
            
        String apiKey = request.getHeader("X-API-Key");
        if (apiKey == null) {
            response.sendError(HttpStatus.UNAUTHORIZED.value(), "Missing X-API-Key header");
            return false;
        }

        // 1. Look up user tier (assume cached/fast)
        Tier tier = apiKeyRepository.findTierByApiKey(apiKey).orElse(Tier.FREE);

        // 2. Get the Redis-backed bucket
        Bucket bucket = rateLimitingService.resolveBucket(apiKey, tier);

        // 3. Try to consume 1 token
        ConsumptionProbe probe = bucket.tryConsumeAndReturnRemaining(1);

        if (probe.isConsumed()) {
            // Success! Add X-RateLimit headers (Standard API practice)
            response.addHeader("X-RateLimit-Remaining", String.valueOf(probe.getRemainingTokens()));
            return true;
        } else {
            // Failed! Rate limit exceeded.
            log.warn("Rate limit exceeded for API Key: {}", apiKey);
            
            // Calculate how long until the bucket has 1 token again
            long waitForRefill = probe.getNanosToWaitForRefill() / 1_000_000_000;
            
            response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value()); // 429
            response.addHeader("X-RateLimit-Retry-After-Seconds", String.valueOf(waitForRefill));
            response.getWriter().write("Too many requests. Please try again in " + waitForRefill + " seconds.");
            return false;
        }
    }
}

// ═══════════════════════════════════════════════════
// 4. REGISTER INTERCEPTOR
// ═══════════════════════════════════════════════════

@Configuration
@RequiredArgsConstructor
public class WebConfig implements WebMvcConfigurer {

    private final RateLimitInterceptor rateLimitInterceptor;

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(rateLimitInterceptor)
                .addPathPatterns("/api/v1/**")     // Apply to all API endpoints
                .excludePathPatterns("/api/v1/health"); // Exclude health checks
    }
}
```

---

## 🧪 Verification Commands

```powershell
# Setup: We assume the FREE tier allows 10 requests per minute.

# Run this loop to fire 12 requests instantly
1..12 | ForEach-Object {
    $response = Invoke-WebRequest -Uri "http://localhost:8080/api/v1/data" `
        -Headers @{ "X-API-Key" = "free-tier-user-123" } -SkipHttpErrorCheck
    
    Write-Host "Status: $($response.StatusCode) | Remaining: $($response.Headers['X-RateLimit-Remaining'])"
}

# Expected Output:
# Status: 200 | Remaining: 9
# Status: 200 | Remaining: 8
# ...
# Status: 200 | Remaining: 0
# Status: 429 | Remaining: 
# Status: 429 | Remaining: 

# Wait 6 seconds (if refill is 10/min, 1 token refills every 6 seconds)
Start-Sleep -Seconds 6

# Fire 1 more request. It should succeed (Status 200, Remaining: 0)
Invoke-WebRequest -Uri "http://localhost:8080/api/v1/data" `
    -Headers @{ "X-API-Key" = "free-tier-user-123" } -SkipHttpErrorCheck
```

---

## ⚡ Best Practices & Anti-Patterns

### ✅ Best Practices
1. **Always return `429 Too Many Requests`**. Never return `500` or `403` for rate limiting. 
2. **Provide `X-RateLimit` headers**. Let clients know exactly how many tokens they have left, and how long to wait if they hit zero. This prevents them from blinding hammering your API.
3. **Use Redis Lua Scripts (ProxyManager)**. Bucket4j does this automatically. Never attempt to read Redis, calculate tokens in Java, and write back to Redis (Race conditions will ruin the accuracy).

### ❌ Anti-Patterns

| Anti-Pattern | Problem | Fix |
|-------------|---------|-----|
| In-Memory Bucket in a Cluster | User has 10/min limit. App scales to 5 pods. User now has 50/min limit via round-robin. | Use Redis-backed Bucket4j (`bucket4j-redis`). |
| Rate Limiting by IP Address alone | Multiple users behind a corporate NAT share 1 IP and get blocked together. | Rate limit by `X-API-Key` or JWT Subject. Use IP only for unauthenticated public endpoints. |
| Global JVM Rate Limits for external APIs | If one thread hits the OpenAI API limit, it throws an exception and kills the request. | Use Resilience4j `@RateLimiter` to gracefully queue/block threads calling external APIs. Bucket4j is better for INBOUND requests. |
