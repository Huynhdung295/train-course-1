# 🕸️ Distributed Tracing with OpenTelemetry & Micrometer Tracing

> **Category**: Observability & Ops | **Complexity**: Advanced | **Java**: 21+ | **Spring Boot**: 3.2+ | **OpenTelemetry**

---

## 📖 Core Technical Mechanics & Deep-Dive

### The Microservice Visibility Problem
When User A clicks "Checkout", the request flows through the API Gateway → Order Service → Inventory Service → Payment Gateway → Kafka → Notification Service.
If the request takes 5 seconds, **where is the bottleneck?** If it fails, **which service caused the failure?** Logs alone cannot answer this because each service logs independently.

### Distributed Tracing Concepts
- **Trace**: Represents the entire journey of a single request across the entire distributed system. Identified by a unique `traceId` (e.g., `80f198ee56343ba864fe8b2a57d3eff7`).
- **Span**: A single unit of work within a trace (e.g., a DB query, an HTTP call). Identified by a `spanId` (e.g., `e457b5a2e4d86bd1`). Spans have a start time, end time, and a parent `spanId` to form a tree structure.
- **Context Propagation**: The mechanism of passing the `traceId` and `spanId` between services. Usually done via HTTP headers (W3C Trace Context: `traceparent`).

### Spring Cloud Sleuth is Dead
Spring Cloud Sleuth was deprecated in Spring Boot 3. It has been completely replaced by **Micrometer Tracing**.
Micrometer Tracing provides a facade for tracers (Brave or OpenTelemetry). OpenTelemetry (OTel) is the industry standard.

---

## 🌐 Real-World GitHub Patterns & Industry Reference

- **[open-telemetry/opentelemetry-java](https://github.com/open-telemetry/opentelemetry-java)** — Official OTel Java SDK.
- **[micrometer-metrics/tracing](https://github.com/micrometer-metrics/tracing)** — Micrometer Tracing core.

---

## 🏷️ Framework Dependencies

```xml
<!-- 1. Micrometer Tracing Facade -->
<dependency>
    <groupId>io.micrometer</groupId>
    <artifactId>micrometer-tracing</artifactId>
</dependency>

<!-- 2. OpenTelemetry Tracer Bridge -->
<dependency>
    <groupId>io.micrometer</groupId>
    <artifactId>micrometer-tracing-bridge-otel</artifactId>
</dependency>

<!-- 3. OTLP Exporter (Sends traces to Jaeger, Zipkin, or Datadog) -->
<dependency>
    <groupId>io.opentelemetry</groupId>
    <artifactId>opentelemetry-exporter-otlp</artifactId>
</dependency>
```

---

## ⚙️ Production Configuration

### application.yml

```yaml
management:
  tracing:
    enabled: true
    sampling:
      probability: 1.0          # 1.0 = Send 100% of traces (DEV only). In PROD, use 0.1 (10%) to save cost/network.
  
  otlp:
    tracing:
      endpoint: http://jaeger:4318/v1/traces  # The OpenTelemetry Collector or Jaeger endpoint
      export:
        step: 10s               # Batch traces and send every 10s
        
# Ensure Logback includes Trace ID in logs
logging:
  pattern:
    level: "%5p [${spring.application.name:},%X{traceId:-},%X{spanId:-}]"
```

---

## 📐 System Design Blueprint

### Complete OpenTelemetry Tracing Implementation

```java
// ═══════════════════════════════════════════════════
// 1. AUTOMATIC INSTRUMENTATION
// ═══════════════════════════════════════════════════
// Spring Boot 3 automatically instruments:
// - RestControllers (creates a Span for every incoming HTTP request)
// - RestClient / WebClient (propagates traceparent header to downstream HTTP calls)
// - Spring Kafka / RabbitMQ (propagates trace context in message headers)
// - @Async (propagates trace context to background threads)

// ═══════════════════════════════════════════════════
// 2. MANUAL SPAN CREATION & OBSERVATION API
// ═══════════════════════════════════════════════════

@Service
@RequiredArgsConstructor
@Slf4j
public class OrderProcessingService {

    // Inject the Micrometer ObservationRegistry (Replacement for Sleuth's Tracer)
    private final ObservationRegistry observationRegistry;
    private final PaymentClient paymentClient;

    /**
     * The Modern Way: Using the Observation API
     * Observations automatically create both Metrics (Timers) AND Traces (Spans)!
     */
    public void processOrder(Order order) {
        // Create an Observation named "order.process"
        Observation.createNotStarted("order.process", observationRegistry)
            .lowCardinalityKeyValue("orderType", order.getType().name()) // Added to Metrics & Traces
            .highCardinalityKeyValue("orderId", order.getId().toString()) // Added to Traces ONLY (prevents metric explosion)
            .observe(() -> {
                // This block is executed within the new Span context
                log.info("Processing order inside custom span"); // Log will have new spanId
                
                performComplexCalculation(order);
                paymentClient.charge(order);
            });
    }

    /**
     * Annotation-based Observation
     */
    @Observed(name = "order.calculate.tax", 
              contextualName = "calculate-tax", 
              lowCardinalityKeyValues = {"region", "US"})
    public BigDecimal performComplexCalculation(Order order) {
        // Automatically creates a span for this method execution
        return order.getAmount().multiply(new BigDecimal("0.05"));
    }
}

// Enable @Observed annotation processing
@Configuration
public class ObservationConfig {
    @Bean
    public ObservedAspect observedAspect(ObservationRegistry observationRegistry) {
        return new ObservedAspect(observationRegistry);
    }
}

// ═══════════════════════════════════════════════════
// 3. BAGGAGE (Cross-Service Custom Data)
// ═══════════════════════════════════════════════════
// Baggage allows you to attach a key-value pair to a trace and propagate it
// to ALL downstream services automatically via HTTP headers (e.g., baggage-tenant-id: 123)

@Configuration
public class TracingBaggageConfig {

    // Tell Micrometer to propagate the 'tenant-id' baggage field across network boundaries
    @Bean
    public BaggageField tenantIdBaggageField() {
        return BaggageField.create("tenant-id");
    }

    // Tell Micrometer to automatically copy the 'tenant-id' baggage into the MDC 
    // so it shows up in Logback!
    @Bean
    public CorrelationScopeCustomizer tenantIdCorrelationScopeCustomizer(BaggageField tenantIdBaggageField) {
        return builder -> builder.add(SingleBaggageField.customMDCScope(tenantIdBaggageField));
    }
}

// Usage in a Controller Filter:
@Component
@RequiredArgsConstructor
public class TenantBaggageFilter extends OncePerRequestFilter {

    private final BaggageField tenantIdBaggageField;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain) 
            throws ServletException, IOException {
            
        String tenant = request.getHeader("X-Tenant-ID");
        if (tenant != null) {
            // This propagates to all downstream HTTP/Kafka calls automatically!
            tenantIdBaggageField.updateValue(tenant); 
        }
        
        try (BaggageInScope scope = tenantIdBaggageField.makeCurrent()) {
            chain.doFilter(request, response);
        }
    }
}
```

---

## 🧪 Verification Commands

```powershell
# Run Jaeger all-in-one (Includes OTLP receiver on 4318 and UI on 16686)
docker run -d --name jaeger `
  -e COLLECTOR_OTLP_ENABLED=true `
  -p 16686:16686 `
  -p 4317:4317 `
  -p 4318:4318 `
  jaegertracing/all-in-one:latest

# Trigger a request to your Spring Boot app
Invoke-RestMethod -Uri "http://localhost:8080/api/v1/orders/test"

# View logs to verify TraceId exists:
# INFO [order-service,80f198ee56343ba864fe8b2a57d3eff7,e457b5a2e4d86bd1] ...

# Open Browser to view the trace waterfall UI
# http://localhost:16686 (Jaeger UI)
```

---

## ⚡ Best Practices & Anti-Patterns

### ✅ Best Practices
1. **Unify Metrics and Tracing with `Observation` API**. Stop using `@Timed` and `@NewSpan` separately. The Observation API does both natively.
2. **Propagate Context asynchronously**. If you use `CompletableFuture` or Virtual Threads, ensure the `ObservationRegistry` context is wrapped. (Spring Boot handles `@Async` automatically, but manual thread pools require wrappers like `ContextSnapshot`).
3. **Use W3C Trace Context**. It is the default in OTel. Do not use legacy B3 propagation unless you are integrating with legacy Zipkin systems.

### ❌ Anti-Patterns

| Anti-Pattern | Problem | Fix |
|-------------|---------|-----|
| Sampling 100% of traces in PROD | Tracing overhead will consume 10-20% of your CPU, and Jaeger storage will explode. | Use `sampling.probability: 0.1` (10%) or use tail-based sampling in the OTel Collector. |
| Putting PII in Baggage | Baggage is propagated via plain HTTP headers across the entire architecture. | Only use opaque IDs (tenantId, correlationId) in Baggage. |
| Depending on `spring-cloud-starter-sleuth` in Spring Boot 3 | It simply won't compile. Sleuth is dead. | Migrate to `micrometer-tracing-bridge-otel`. |
