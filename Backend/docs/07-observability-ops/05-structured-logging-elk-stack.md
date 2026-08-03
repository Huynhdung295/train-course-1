# 📋 Structured Logging & ELK Stack

> **Category**: Observability & Ops | **Complexity**: Intermediate | **Java**: 21+ | **Spring Boot**: 3.2+ | **Logback**

---

## 📖 Core Technical Mechanics & Deep-Dive

### The Problem with Plain Text Logs
Plain text logs (`2023-10-01 INFO [main] UserService: User 123 logged in`) are designed for human eyes. 
When you have 50 microservices generating 10,000 logs per second, you need machines to parse, index, and query them. Regex parsing plain text logs at scale is incredibly slow and brittle.

### The Solution: Structured Logging (JSON)
Logs should be emitted as JSON natively from the application.
```json
{
  "@timestamp": "2023-10-01T12:00:00.000Z",
  "level": "INFO",
  "thread_name": "main",
  "logger_name": "com.company.UserService",
  "message": "User logged in",
  "user_id": "123",
  "traceId": "80f198ee56343ba8"
}
```
Logstash or Fluent-bit can ingest JSON natively without parsing, and Elasticsearch indexes every key automatically.

### MDC (Mapped Diagnostic Context)
MDC is a `ThreadLocal` map provided by SLF4J. You can put key-value pairs into the MDC at the start of a request (e.g., `userId`, `tenantId`, `traceId`). Every log statement executed by that thread will automatically include those MDC fields.

---

## 🌐 Real-World GitHub Patterns & Industry Reference

- **[logstash/logstash-logback-encoder](https://github.com/logfellow/logstash-logback-encoder)** — The industry standard for JSON logging in Spring Boot.

---

## 🏷️ Framework Annotations & Dependencies

```xml
<!-- Replaces standard text logging with JSON formatted for Logstash/Elasticsearch -->
<dependency>
    <groupId>net.logstash.logback</groupId>
    <artifactId>logstash-logback-encoder</artifactId>
    <version>7.4</version>
</dependency>
```

---

## ⚙️ Production Configuration

### `src/main/resources/logback-spring.xml`
Spring Boot overrides standard Logback configuration if you name the file `logback-spring.xml`. This allows you to use Spring profiles to decide log formats.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<configuration>
    <!-- Include default Spring Boot log styles for the console -->
    <include resource="org/springframework/boot/logging/logback/defaults.xml"/>

    <springProperty scope="context" name="appName" source="spring.application.name"/>

    <!-- DEV PROFILE: Human readable console logs -->
    <springProfile name="dev | local">
        <appender name="CONSOLE" class="ch.qos.logback.core.ConsoleAppender">
            <encoder>
                <!-- Include MDC fields like traceId -->
                <pattern>%clr(%d{yyyy-MM-dd HH:mm:ss.SSS}){faint} %clr(${LOG_LEVEL_PATTERN:-%5p}) %clr([%X{traceId:-},%X{userId:-}]){yellow} %clr(---){faint} %clr([%15.15t]){faint} %clr(%-40.40logger{39}){cyan} %clr(:){faint} %m%n${LOG_EXCEPTION_CONVERSION_WORD:-%wEx}</pattern>
            </encoder>
        </appender>
        <root level="INFO">
            <appender-ref ref="CONSOLE" />
        </root>
    </springProfile>

    <!-- PROD PROFILE: JSON structured logs for ELK -->
    <springProfile name="prod | staging">
        <appender name="JSON_CONSOLE" class="ch.qos.logback.core.ConsoleAppender">
            <encoder class="net.logstash.logback.encoder.LogstashEncoder">
                <customFields>{"app_name":"${appName}"}</customFields>
                <!-- Omit massive stack traces if you use Sentry, or keep them if relying on ELK -->
                <shortenedLoggerNameLength>36</shortenedLoggerNameLength>
            </encoder>
        </appender>
        <root level="INFO">
            <appender-ref ref="JSON_CONSOLE" />
        </root>
    </springProfile>
</configuration>
```
*Note: We write JSON to stdout (ConsoleAppender). In modern containerized environments (Kubernetes/Docker), the container runtime captures stdout and forwards it to Fluent-bit/Logstash. Do not write logs to files in the container!*

---

## 📐 System Design Blueprint

### Complete Logging Context Implementation

```java
// ═══════════════════════════════════════════════════
// 1. POPULATING MDC (Web Filter)
// ═══════════════════════════════════════════════════

@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 10)
public class MdcLoggingFilter extends OncePerRequestFilter {

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain) 
            throws ServletException, IOException {
            
        try {
            // 1. Extract IP Address
            String ip = request.getHeader("X-Forwarded-For");
            if (ip == null) ip = request.getRemoteAddr();
            MDC.put("clientIp", ip);

            // 2. Extract Username/ID from Security Context (if available)
            var auth = SecurityContextHolder.getContext().getAuthentication();
            if (auth != null && auth.getName() != null) {
                MDC.put("userId", auth.getName());
            }
            
            // Note: traceId is automatically injected by Micrometer Tracing!

            chain.doFilter(request, response);
            
        } finally {
            // CRITICAL: Always clear the MDC in a finally block!
            // Tomcat thread pools reuse threads. If you don't clear it, 
            // the next request on this thread will inherit the previous user's ID!
            MDC.clear(); 
        }
    }
}

// ═══════════════════════════════════════════════════
// 2. LOGGING BUSINESS EVENTS (Structured Arguments)
// ═══════════════════════════════════════════════════
// Using logstash-logback-encoder's StructuredArguments for inline JSON fields

import static net.logstash.logback.argument.StructuredArguments.kv;
import static net.logstash.logback.argument.StructuredArguments.v;

@Service
@Slf4j
public class PaymentService {

    public void processPayment(String paymentId, BigDecimal amount) {
        // Anti-pattern: String concatenation parsing required by ELK
        log.info("Processing payment {} for amount {}", paymentId, amount);
        
        // Best Practice: Structured Arguments
        // The text log reads: "Processing payment paymentId=123 amount=50.0"
        // The JSON log includes specific fields: "paymentId": "123", "amount": 50.0
        log.info("Processing payment", 
            kv("paymentId", paymentId), 
            kv("amount", amount));
            
        try {
            // Processing...
        } catch (Exception e) {
            // Include contextual fields in the error log
            log.error("Payment failed", 
                kv("paymentId", paymentId), 
                kv("errorCode", "INSUFFICIENT_FUNDS"), 
                e);
            throw e;
        }
    }
}

// ═══════════════════════════════════════════════════
// 3. MASKING SENSITIVE DATA (PII / Passwords)
// ═══════════════════════════════════════════════════
// Configured in logback-spring.xml to prevent credentials from entering ELK

/*
In logback-spring.xml, inside the LogstashEncoder:
<jsonGeneratorDecorator class="net.logstash.logback.mask.MaskingJsonGeneratorDecorator">
    <valueMasker class="net.logstash.logback.mask.RegexValueMasker">
        <!-- Mask passwords, credit cards, emails -->
        <regex>(?i)"password"\s*:\s*"([^"]+)"</regex>
        <regex>(?i)"creditCard"\s*:\s*"([^"]+)"</regex>
    </valueMasker>
</jsonGeneratorDecorator>
*/
```

---

## 🧪 Verification Commands

```powershell
# 1. Run the app with the PROD profile to test JSON output
$env:SPRING_PROFILES_ACTIVE="prod"
# Run your Spring Boot app and observe the console output.
# You should see raw JSON lines instead of normal text logs.

# Example Output:
# {"@timestamp":"2023-10-01T12:00:00Z","level":"INFO","thread_name":"http-nio-8080-exec-1","logger_name":"com.company.PaymentService","message":"Processing payment","paymentId":"123","amount":50.0,"userId":"user456","traceId":"abcdef123456","app_name":"my-app"}

# 2. Local ELK Stack using Docker Compose
$dockerCompose = @"
version: '3'
services:
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.10.2
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
    ports:
      - "9200:9200"
  kibana:
    image: docker.elastic.co/kibana/kibana:8.10.2
    ports:
      - "5601:5601"
    environment:
      - ELASTICSEARCH_HOSTS=http://elasticsearch:9200
"@
Set-Content -Path docker-compose-elk.yml -Value $dockerCompose
docker-compose -f docker-compose-elk.yml up -d

# Visit Kibana at http://localhost:5601 to set up an index pattern and view logs.
```

---

## ⚡ Best Practices & Anti-Patterns

### ✅ Best Practices
1. **Containerize stdout**: In Kubernetes/Docker, your app should only log JSON to `System.out`. Let a DaemonSet (Fluentd/Fluent-bit) collect the stdout streams, attach Kubernetes metadata (pod name, namespace), and ship it to Elasticsearch.
2. **Always clear the MDC**: Use a `finally` block in your `Filter` or `Interceptor` to call `MDC.clear()`. Thread pools reuse threads; failure to clear MDC leaks context to other users' requests.
3. **Use Structured Arguments (`kv()`)**: When logging business events, pass variables as key-value pairs so they are indexed as separate fields in Elasticsearch, making them easily searchable.

### ❌ Anti-Patterns

| Anti-Pattern | Problem | Fix |
|-------------|---------|-----|
| FileAppender with rotation in Docker | Wastes disk space in the container, logs are lost on container restart. | Log to `CONSOLE`. Let the infrastructure handle log shipping. |
| Logging PII (Personally Identifiable Info) | Violates GDPR/CCPA. If an email/credit card enters ELK, you have a data breach. | Use `MaskingJsonGeneratorDecorator` in Logback to scrub PII before it leaves the JVM. |
| String concatenation: `log.info("User " + user.getId() + " failed")` | Allocates memory eagerly even if INFO level is disabled. | Use parameterized logging: `log.info("User {} failed", user.getId())`. |
