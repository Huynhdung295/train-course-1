# 🛡️ Resilience4j: Circuit Breakers, Retries, and Bulkheads

> **Category**: Resilience & Integration | **Complexity**: Advanced | **Java**: 21+ | **Spring Boot**: 3.3+

---

## 📖 Core Technical Mechanics & Deep-Dive

### Why Resilience4j over Hystrix?
Netflix Hystrix is officially deprecated. Resilience4j is a lightweight, modern fault tolerance library designed for Java 8+ functional programming. It doesn't rely on separate threads by default (unlike Hystrix), making it much faster and perfectly compatible with Virtual Threads.

### Core Modules
1. **Circuit Breaker**: Stops making requests to a failing service (State Machine: CLOSED → OPEN → HALF_OPEN).
2. **Retry**: Automatically retries failed requests based on conditions.
3. **Bulkhead**: Limits the number of concurrent executions to prevent one slow service from exhausting all resources (Thread Pool or Semaphore isolation).
4. **RateLimiter**: Limits the rate of calls to an external service over time.
5. **TimeLimiter**: Applies a timeout to an execution.

### The Circuit Breaker State Machine
- **CLOSED**: Everything is healthy. Requests flow normally. If failure rate > X%, transition to OPEN.
- **OPEN**: Requests are immediately rejected with `CallNotPermittedException` (fail fast). Protects downstream service.
- **HALF_OPEN**: After a wait duration, allow a limited number of test requests. If they succeed, transition to CLOSED. If they fail, transition back to OPEN.

---

## 🌐 Real-World GitHub Patterns & Industry Reference

- **[resilience4j/resilience4j](https://github.com/resilience4j/resilience4j)** — Official Resilience4j repository.

---

## 🏷️ Framework Annotations & Dependencies

```xml
<!-- Core Spring Boot integration -->
<dependency>
    <groupId>io.github.resilience4j</groupId>
    <artifactId>resilience4j-spring-boot3</artifactId>
    <version>2.2.0</version>
</dependency>

<!-- Required for AOP annotations (@CircuitBreaker, etc.) -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-aop</artifactId>
</dependency>

<!-- Expose metrics to Actuator/Prometheus -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-actuator</artifactId>
</dependency>
```

---

## ⚙️ Production Configuration

### application.yml

```yaml
resilience4j:
  circuitbreaker:
    instances:
      inventoryService:
        slidingWindowSize: 10              # Look at last 10 calls
        minimumNumberOfCalls: 5            # Must have 5 calls before calculating failure rate
        permittedNumberOfCallsInHalfOpenState: 3
        waitDurationInOpenState: 5000ms    # Wait 5s before entering HALF_OPEN
        failureRateThreshold: 50           # Open circuit if 50% of calls fail
        slowCallRateThreshold: 50          # Open circuit if 50% of calls are too slow
        slowCallDurationThreshold: 2000ms
        recordExceptions:
          - org.springframework.web.client.HttpServerErrorException
          - java.io.IOException
          - java.util.concurrent.TimeoutException
        ignoreExceptions:
          - com.company.exceptions.BusinessValidationException # Don't penalize circuit for user errors

  retry:
    instances:
      inventoryService:
        maxAttempts: 3
        waitDuration: 1000ms
        retryExceptions:
          - org.springframework.web.client.HttpServerErrorException
          - java.io.IOException

  bulkhead:
    instances:
      inventoryService:
        maxConcurrentCalls: 20             # Max 20 concurrent requests
        maxWaitDuration: 500ms             # Wait 500ms for a permit before throwing BulkheadFullException

  timelimiter:
    instances:
      inventoryService:
        timeoutDuration: 3000ms
        cancelRunningFuture: true
```

---

## 📐 System Design Blueprint

### Complete Resilience Implementation

```java
// ═══════════════════════════════════════════════════
// ANNOTATION-BASED IMPLEMENTATION
// ═══════════════════════════════════════════════════

@Service
@RequiredArgsConstructor
@Slf4j
public class InventoryClientService {

    private final RestClient restClient;

    /**
     * Stacking annotations: Order matters!
     * The innermost annotation is executed first.
     * Order of execution: Bulkhead -> TimeLimiter -> RateLimiter -> CircuitBreaker -> Retry.
     * 
     * Fallback methods MUST have the EXACT SAME signature as the original method,
     * plus an extra Exception parameter at the end.
     */
    @Retry(name = "inventoryService", fallbackMethod = "inventoryFallback")
    @CircuitBreaker(name = "inventoryService")
    @Bulkhead(name = "inventoryService", type = Bulkhead.Type.SEMAPHORE)
    public InventoryStatus checkStock(String productId) {
        log.info("Attempting to check stock for {}", productId);
        
        return restClient.get()
            .uri("/api/inventory/{id}", productId)
            .retrieve()
            .body(InventoryStatus.class);
    }

    /**
     * Fallback method.
     * If all retries fail, or the circuit breaker is OPEN, this executes immediately.
     */
    public InventoryStatus inventoryFallback(String productId, Throwable t) {
        log.warn("Fallback triggered for product {}. Reason: {}", productId, t.getMessage());
        
        // Option 1: Return a default/cached response (Graceful Degradation)
        return new InventoryStatus(productId, 0, "SYSTEM_UNAVAILABLE");
        
        // Option 2: Rethrow a custom business exception
        // throw new ServiceUnavailableException("Inventory service is currently down");
    }
}

// ═══════════════════════════════════════════════════
// PROGRAMMATIC (FUNCTIONAL) IMPLEMENTATION
// ═══════════════════════════════════════════════════

@Service
@RequiredArgsConstructor
public class ProgrammaticInventoryService {

    private final CircuitBreakerRegistry cbRegistry;
    private final RetryRegistry retryRegistry;
    private final RestClient restClient;

    public InventoryStatus checkStockProgrammatically(String productId) {
        // Retrieve configurations dynamically
        var circuitBreaker = cbRegistry.circuitBreaker("inventoryService");
        var retry = retryRegistry.retry("inventoryService");

        // Define the supplier (the action to execute)
        Supplier<InventoryStatus> supplier = () -> restClient.get()
            .uri("/api/inventory/{id}", productId)
            .retrieve()
            .body(InventoryStatus.class);

        // Decorate the supplier with Resilience4j patterns
        Supplier<InventoryStatus> decoratedSupplier = Decorators.ofSupplier(supplier)
            .withCircuitBreaker(circuitBreaker)
            .withRetry(retry)
            .withFallback(Arrays.asList(
                CallNotPermittedException.class, // Circuit breaker OPEN
                HttpServerErrorException.class   // Downstream 500
            ), throwable -> new InventoryStatus(productId, 0, "FALLBACK"))
            .decorate();

        // Execute
        return decoratedSupplier.get();
    }
}

// ═══════════════════════════════════════════════════
// EVENT LISTENER (For Monitoring/Alerting)
// ═══════════════════════════════════════════════════

@Component
@Slf4j
public class CircuitBreakerEventListener {

    public CircuitBreakerEventListener(CircuitBreakerRegistry registry) {
        registry.circuitBreaker("inventoryService").getEventPublisher()
            .onStateTransition(event -> {
                log.warn("Circuit Breaker '{}' transitioned from {} to {}",
                    event.getCircuitBreakerName(),
                    event.getStateTransition().getFromState(),
                    event.getStateTransition().getToState());
                    
                // e.g., trigger PagerDuty if state goes to OPEN
            })
            .onCallNotPermitted(event -> log.error("Request rejected by open circuit breaker"))
            .onError(event -> log.error("Circuit breaker recorded an error: {}", event.getThrowable().getMessage()));
    }
}
```

---

## 🧪 Verification Commands

```powershell
# Check Circuit Breaker metrics via Actuator
Invoke-RestMethod -Uri "http://localhost:8080/actuator/metrics/resilience4j.circuitbreaker.state" | ConvertTo-Json -Depth 5

# View all Circuit Breaker states in a UI format
Invoke-RestMethod -Uri "http://localhost:8080/actuator/circuitbreakers" | ConvertTo-Json

# To test:
# 1. Take down your downstream inventory service (e.g., docker stop inventory-svc).
# 2. Fire 5 requests to your service. Watch the logs.
# 3. You will see 3 Retries per request.
# 4. After 5 failed requests, the Circuit Breaker transitions to OPEN.
# 5. Fire a 6th request. It fails IMMEDIATELY without waiting for timeouts (Fast Fail), executing the fallback.
# 6. Start the downstream service.
# 7. Wait 5 seconds (waitDurationInOpenState).
# 8. Fire a request. Circuit Breaker is HALF_OPEN, lets request through. It succeeds. Transitions to CLOSED.
```

---

## ⚡ Best Practices & Anti-Patterns

### ✅ Best Practices
1. **Understand Annotation Ordering**. Spring AOP evaluates them in a specific order. Ensure `fallbackMethod` is on the annotation closest to the method execution (usually `@Retry` or `@CircuitBreaker`) to catch all failures.
2. **Ignore Business Exceptions**. An `IllegalArgumentException` (400 Bad Request) from the downstream service means the client sent bad data, *not* that the service is unhealthy. Add it to `ignoreExceptions` so it doesn't trip the circuit breaker.
3. **Always monitor states**. Bind `resilience4j-micrometer` to Prometheus and alert if a circuit stays OPEN for more than 5 minutes.

### ❌ Anti-Patterns

| Anti-Pattern | Problem | Fix |
|-------------|---------|-----|
| Using `@CircuitBreaker` without a Fallback | Unhandled exceptions bubble up to the user as generic 500 errors. | Always provide a `fallbackMethod` for graceful degradation. |
| TimeLimiter on synchronous blocking code | Doesn't actually interrupt the blocking thread; it just times out the caller while the thread remains stuck. | Virtual Threads solve this, or run blocking code inside `CompletableFuture`. |
| Sliding window too large (e.g., 1000) | Circuit takes too long to trip during an outage, overwhelming the downstream service. | Keep window small (10-50 calls). |
