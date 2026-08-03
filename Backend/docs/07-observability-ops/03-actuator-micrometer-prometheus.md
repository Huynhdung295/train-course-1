# 📊 Actuator, Micrometer & Prometheus

> **Category**: Observability & Ops | **Complexity**: Intermediate | **Java**: 21+ | **Spring Boot**: 3.3+ | **Micrometer**: 1.13+

---

## 📖 Core Technical Mechanics & Deep-Dive

### The Observability Triad
1. **Metrics (This document)**: Aggregated data (Counters, Gauges, Timers). E.g., "CPU is at 90%", "We processed 10,000 orders/sec".
2. **Traces**: The lifecycle of a single request across multiple microservices.
3. **Logs**: Discrete events with high cardinality detail.

### Spring Boot Actuator
Provides production-ready endpoints (`/actuator/health`, `/actuator/metrics`, `/actuator/prometheus`) to monitor and manage your application.

### Micrometer (The SLF4J of Metrics)
Micrometer is a vendor-neutral metrics facade. You instrument your code with Micrometer APIs (`Counter`, `Timer`, `Gauge`), and Micrometer translates those into the specific format required by your monitoring system (Prometheus, Datadog, New Relic).

### Prometheus (Pull Model)
Unlike traditional monitoring systems where the app pushes metrics to a server, **Prometheus scrapes (pulls)** metrics from your app via the `/actuator/prometheus` HTTP endpoint at regular intervals (e.g., every 15s).

---

## 🌐 Real-World GitHub Patterns & Industry Reference

- **[micrometer-metrics/micrometer](https://github.com/micrometer-metrics/micrometer)** — The core metrics framework.
- **[prometheus/prometheus](https://github.com/prometheus/prometheus)** — The industry-standard TSDB (Time Series Database).

---

## 🏷️ Framework Annotations & Dependencies

```xml
<!-- Exposes /actuator endpoints -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-actuator</artifactId>
</dependency>

<!-- Translates Micrometer metrics to Prometheus format -->
<dependency>
    <groupId>io.micrometer</groupId>
    <artifactId>micrometer-registry-prometheus</artifactId>
</dependency>

<!-- Optional: AOP support for @Timed -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-aop</artifactId>
</dependency>
```

---

## ⚙️ Production Configuration

### application.yml

```yaml
management:
  endpoints:
    web:
      exposure:
        include: health, info, prometheus, metrics  # Expose Prometheus scraping endpoint
      base-path: /manage                            # Security Best Practice: obscure base path
  
  endpoint:
    health:
      show-details: always                          # Show DB/Disk health details
      probes:
        enabled: true                               # Enables Kubernetes Liveness/Readiness probes

  metrics:
    tags:
      application: ${spring.application.name}       # Tag every metric with the app name
    distribution:
      percentiles-histogram:
        http.server.requests: true                  # Needed for PromQL histogram_quantile()
      sla:
        http.server.requests: 50ms, 100ms, 500ms    # Define buckets for SLAs
```

---

## 📐 System Design Blueprint

### Complete Custom Metrics Implementation

```java
// ═══════════════════════════════════════════════════
// 1. AOP METRICS (@Timed / @Counted)
// ═══════════════════════════════════════════════════

@Configuration
public class MicrometerConfig {

    /**
     * Required to enable @Timed annotation.
     * Intercepts method calls and records execution time.
     */
    @Bean
    public TimedAspect timedAspect(MeterRegistry registry) {
        return new TimedAspect(registry);
    }
    
    /**
     * Required to enable @Counted annotation.
     */
    @Bean
    public CountedAspect countedAspect(MeterRegistry registry) {
        return new CountedAspect(registry);
    }
}

// ═══════════════════════════════════════════════════
// 2. INSTRUMENTING BUSINESS LOGIC
// ═══════════════════════════════════════════════════

@Service
@RequiredArgsConstructor
@Slf4j
public class OrderService {

    private final OrderRepository orderRepository;
    private final MeterRegistry meterRegistry;

    // --- Annotation Based (Timers & Counters) ---

    @Timed(value = "order.processing.time", description = "Time taken to process an order")
    @Counted(value = "order.processing.attempts", description = "Number of orders attempted")
    public void processOrder(Order order) {
        // Business logic...
    }

    // --- Programmatic Metrics (Complex Counters & Gauges) ---

    public void checkout(Order order) {
        try {
            // ... processing
            
            // 1. COUNTER: Monotonically increasing value (Good for tracking total events)
            meterRegistry.counter("business.orders.created", 
                    "type", order.getType().name(), 
                    "region", order.getRegion())
                .increment();
                
        } catch (Exception e) {
            meterRegistry.counter("business.orders.failed").increment();
            throw e;
        }
    }

    /**
     * 2. GAUGE: A value that goes up and down (e.g., Queue size, active users, DB size).
     * Gauges monitor state. You don't "set" a gauge; you pass it an object and a function
     * to evaluate its state when Prometheus scrapes it.
     */
    @PostConstruct
    public void registerGauges() {
        Gauge.builder("business.orders.pending", orderRepository, 
                repo -> repo.countByStatus(OrderStatus.PENDING))
             .description("Number of orders waiting to be processed")
             .register(meterRegistry);
    }
}

// ═══════════════════════════════════════════════════
// 3. CUSTOM HEALTH INDICATOR
// ═══════════════════════════════════════════════════

/**
 * Plugs into /actuator/health to report custom subsystem status.
 * Kubernetes uses this to decide if a pod should be restarted.
 */
@Component
@RequiredArgsConstructor
public class ExternalPaymentGatewayHealthIndicator implements HealthIndicator {

    private final RestClient restClient;

    @Override
    public Health health() {
        try {
            var response = restClient.get()
                .uri("https://api.stripe.com/health")
                .retrieve()
                .toBodilessEntity();
                
            if (response.getStatusCode().is2xxSuccessful()) {
                return Health.up().withDetail("stripe", "Available").build();
            }
            return Health.down().withDetail("stripe", "HTTP " + response.getStatusCode()).build();
        } catch (Exception e) {
            // DOWN indicates the application is fundamentally broken
            return Health.down().withDetail("stripe", e.getMessage()).build();
            
            // If the failure is non-critical, return UP with a warning detail,
            // or return OUT_OF_SERVICE.
        }
    }
}
```

---

## 🧪 Verification Commands

```powershell
# 1. Check standard Health Endpoint
Invoke-RestMethod -Uri "http://localhost:8080/manage/health" | ConvertTo-Json -Depth 5

# 2. Check Prometheus Scrape Endpoint (Outputs Prometheus text format)
Invoke-WebRequest -Uri "http://localhost:8080/manage/prometheus" | Select-Object -ExpandProperty Content

# Expected Prometheus Output:
# # HELP business_orders_pending Number of orders waiting to be processed
# # TYPE business_orders_pending gauge
# business_orders_pending{application="my-app",} 42.0
#
# # HELP business_orders_created_total  
# # TYPE business_orders_created_total counter
# business_orders_created_total{application="my-app",region="US",type="PREMIUM",} 15.0

# 3. Simulate Prometheus scraping locally via Docker
$promConfig = @"
global:
  scrape_interval: 5s
scrape_configs:
  - job_name: 'spring-boot-app'
    metrics_path: '/manage/prometheus'
    static_configs:
      - targets: ['host.docker.internal:8080']
"@
Set-Content -Path prometheus.yml -Value $promConfig

docker run -d -p 9090:9090 -v ${PWD}/prometheus.yml:/etc/prometheus/prometheus.yml prom/prometheus
# Open http://localhost:9090 in browser to query metrics
```

---

## ⚡ Best Practices & Anti-Patterns

### ✅ Best Practices
1. **Always use tags/labels**. Instead of `order.created.us` and `order.created.eu`, use metric `order.created` with tag `region=US`. This allows Grafana to aggregate correctly.
2. **Use `@Timed` on Web Controllers**. Spring Boot does this automatically for Spring MVC (`http.server.requests`), but you should add `@Timed` to important internal service methods.
3. **Secure the Actuator**. Never expose `/actuator` to the public internet. Use Spring Security to lock it down or run it on a separate internal management port (`management.server.port=8081`).

### ❌ Anti-Patterns

| Anti-Pattern | Problem | Fix |
|-------------|---------|-----|
| High Cardinality Tags | e.g., Tagging a metric with `user_id`. If you have 1M users, Prometheus tracks 1M distinct time series in RAM. It will crash. | Only use tags with finite, small sets of values (e.g., `status`, `region`, `error_code`). |
| Incrementing a Counter for state | E.g., `counter.increment()` on login, `counter.decrement()` on logout (Wait, counters can't decrement!). | Use a `Gauge` to track current state/size. Counters only go UP (until restart). |
| Complex DB queries in Health Indicators | Kubernetes hits `/health` every 5 seconds. A slow query will DDOS your own database. | Keep health checks incredibly fast (ping/select 1) or cache the result. |
