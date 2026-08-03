# 🧵 Java 21 Virtual Threads (Project Loom) in Spring Boot

> **Category**: Concurrency | **Complexity**: Advanced | **Java**: 21+ | **Spring Boot**: 3.2+

---

## 📖 Core Technical Mechanics & Deep-Dive

### The Problem: OS Threads are Expensive
Before Java 21, `java.lang.Thread` was a 1:1 wrapper over an OS thread.
- OS threads are heavy: ~1MB stack size, 1ms context switch time.
- A typical server can only handle a few thousand active threads before memory exhaustion or thrashing.
- Result: Reactive programming (WebFlux, RxJava) became necessary to handle 10k+ concurrent connections, but at the cost of extreme complexity (callback hell, impossible stack traces, `Mono/Flux` viral spread).

### The Solution: Virtual Threads (Project Loom)
Virtual Threads (VTs) are **lightweight threads managed by the JVM**, not the OS.
- JVM maps M virtual threads to N carrier threads (OS threads).
- **Yielding**: When a VT does a blocking I/O operation (DB call, HTTP request, sleep), the JVM automatically "unmounts" it from the carrier thread. The carrier thread is now free to execute another VT.
- When I/O completes, the VT is "remounted" on an available carrier thread.
- Memory: VTs start with just a few bytes. You can easily spawn millions of them.
- Result: **Write synchronous, blocking code — but get the scalability of reactive.**

```
Carrier Thread (OS) 1  ─────────── [VT 1 running] ─ [I/O wait.. unmount] ──────── [VT 3 running] ──
Carrier Thread (OS) 2  ─────────── [VT 2 running] ─────────── [I/O wait.. unmount] ──────── [VT 1 resumes] ──
```

### Carrier Thread Pinning (The Danger)
A VT cannot unmount (it "pins" the carrier OS thread) in two scenarios:
1. When executing inside a `synchronized` block or method.
2. When executing a native method or foreign function.
**Fix**: Replace `synchronized` with `ReentrantLock` for any blocks containing blocking I/O.

---

## 🌐 Real-World GitHub Patterns & Industry Reference

- **[spring-projects/spring-boot](https://github.com/spring-projects/spring-boot/wiki/Spring-Boot-3.2-Release-Notes#virtual-threads)** — Spring Boot 3.2+ Virtual Threads support
- **[JEP 444](https://openjdk.org/jeps/444)** — Official Virtual Threads specification

---

## 🏷️ Framework Annotations & Dependencies

*No special dependencies needed beyond Java 21 and Spring Boot 3.2+.*

---

## ⚙️ Production Configuration

```yaml
spring:
  threads:
    virtual:
      enabled: true     # Enable Virtual Threads globally in Spring Boot

server:
  tomcat:
    threads:
      max: 200          # Ignored when virtual threads are enabled
```

When `spring.threads.virtual.enabled=true`:
- Tomcat uses Virtual Threads to handle HTTP requests.
- `@Async` methods execute on Virtual Threads.
- RabbitMQ/Kafka listeners execute on Virtual Threads.
- Spring MVC executes concurrently without the typical 200-thread pool limit.

---

## 📐 System Design Blueprint

### Complete Virtual Threads Implementation

```java
// ═══════════════════════════════════════════════════
// 1. REPLACING SYNCHRONIZED (Fixing Carrier Thread Pinning)
// ═══════════════════════════════════════════════════

@Service
@Slf4j
public class LegacyService {

    // ❌ ANTI-PATTERN: synchronized + blocking I/O = Carrier Thread Pinned!
    // If 100 VTs do this, they consume 100 OS threads (defeating VT purpose)
    public synchronized String fetchDataPinned() {
        return restTemplate.getForObject("https://slow-api.com/data", String.class);
    }
}

@Service
@Slf4j
public class ModernService {

    // ✅ CORRECT: ReentrantLock allows VT to unmount during I/O
    private final ReentrantLock lock = new ReentrantLock();

    public String fetchDataUnpinned() {
        lock.lock();
        try {
            return restTemplate.getForObject("https://slow-api.com/data", String.class);
        } finally {
            lock.unlock();
        }
    }
}

// ═══════════════════════════════════════════════════
// 2. EXECUTOR SERVICES FOR VIRTUAL THREADS
// ═══════════════════════════════════════════════════

@Configuration
public class VirtualThreadConfig {

    /**
     * Custom executor for manual background tasks using Virtual Threads.
     * Note: Spring's @Async uses virtual threads automatically if spring.threads.virtual.enabled=true,
     * so this is only for manual ExecutorService usage.
     */
    @Bean(name = "vtExecutor")
    public ExecutorService virtualThreadExecutor() {
        // Never pool virtual threads! They are cheap to create and destroy.
        return Executors.newVirtualThreadPerTaskExecutor();
    }
}

// ═══════════════════════════════════════════════════
// 3. STRUCTURED CONCURRENCY (Preview feature in Java 21, stable in 22)
// Using standard CompletableFuture for now (Java 21 stable)
// ═══════════════════════════════════════════════════

@Service
@RequiredArgsConstructor
@Slf4j
public class AggregationService {

    private final ProductClient productClient;
    private final PricingClient pricingClient;
    private final ReviewClient reviewClient;
    
    @Qualifier("vtExecutor")
    private final ExecutorService vtExecutor;

    /**
     * Scatter-Gather pattern using Virtual Threads.
     * Instead of complex Mono.zip, just write blocking code wrapped in futures!
     */
    public ProductDashboard getDashboard(String productId) {
        // VTs make it cheap to block while waiting for CompletableFuture
        
        var productFuture = CompletableFuture.supplyAsync(
            () -> productClient.getProduct(productId), vtExecutor);
            
        var priceFuture = CompletableFuture.supplyAsync(
            () -> pricingClient.getPrice(productId), vtExecutor);
            
        var reviewsFuture = CompletableFuture.supplyAsync(
            () -> reviewClient.getReviews(productId), vtExecutor);

        // This join() blocks the VT, which is PERFECTLY FINE!
        // The underlying OS carrier thread immediately switches to do other work.
        CompletableFuture.allOf(productFuture, priceFuture, reviewsFuture).join();

        return new ProductDashboard(
            productFuture.join(),
            priceFuture.join(),
            reviewsFuture.join()
        );
    }
}
```

### Virtual Thread Factory Pattern

```java
// If you need custom naming or MDC propagation for raw Virtual Threads
var factory = Thread.ofVirtual()
    .name("order-processor-", 0)
    .factory();

var executor = Executors.newThreadPerTaskExecutor(factory);
```

---

## 🧪 Verification Commands

```powershell
# Verify that Tomcat is using Virtual Threads
# Send request to a blocking endpoint
Invoke-RestMethod -Uri "http://localhost:8080/api/v1/debug/thread-name"

# Expected Output:
# "VirtualThread[#143]/runnable@ForkJoinPool-1-worker-1"
# - It is a VirtualThread
# - Running on a ForkJoinPool worker (the carrier OS thread)

# Detect Carrier Thread Pinning in production/testing
# Add this JVM argument to print stack traces when a thread is pinned:
# -Djdk.tracePinnedThreads=full
```

---

## ⚡ Best Practices & Anti-Patterns

### ✅ Best Practices
1. **Never pool Virtual Threads** — Always use `newVirtualThreadPerTaskExecutor()`. Pooling defeats their purpose; they are designed to be disposable (created per request/task).
2. **Limit concurrency using Semaphores, not thread pools** — Since VTs aren't pooled, a runaway process could spawn 1,000,000 VTs and overwhelm your database connections. Use `Semaphore` to limit concurrent access to constrained resources.
3. **Keep ThreadLocals small** — If you spawn 1,000,000 VTs, and each holds a 1MB `ThreadLocal`, you need 1TB of RAM! Prefer passing context explicitly or use Scoped Values (preview).

### ❌ Anti-Patterns

| Anti-Pattern | Problem | Fix |
|-------------|---------|-----|
| `Executors.newFixedThreadPool(100)` | Uses heavy OS threads | Replace with `Executors.newVirtualThreadPerTaskExecutor()` |
| `synchronized` block around `restTemplate.get()` | Carrier thread gets pinned; throughput collapses | Use `ReentrantLock.lock()` |
| Reactive programming (`WebFlux`) in new projects | High learning curve, viral | Use Spring WebMVC + Virtual Threads |
| Limiting load by tuning Tomcat max-threads | Tomcat ignores max-threads with VTs | Limit load via Rate Limiters or Semaphores |
| Using VTs for heavy CPU-bound math tasks | VTs don't speed up CPU tasks; they excel at I/O waiting | Use normal `ForkJoinPool` for CPU-bound tasks |
