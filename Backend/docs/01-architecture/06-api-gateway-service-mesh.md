# 🌐 API Gateway & Service Mesh with Spring Cloud Gateway

> **Category**: Architecture Patterns | **Complexity**: Advanced | **Java**: 21+ | **Spring Boot**: 3.3+ | **Spring Cloud**: 2023.0+

---

## 📖 Core Technical Mechanics & Deep-Dive

### API Gateway Role in Microservices

The **API Gateway** is the single entry point for all client requests in a microservices architecture. It handles:
- **Routing** — Routes requests to appropriate downstream services
- **Cross-Cutting Concerns** — Authentication, authorization, rate limiting, logging, tracing
- **Protocol Translation** — HTTP/REST to gRPC, WebSocket
- **Aggregation** — Combine responses from multiple services (Backend for Frontend pattern)
- **SSL Termination** — TLS at the edge; plain HTTP internally

**Spring Cloud Gateway** (built on Spring WebFlux + Reactor Netty) is the official Spring replacement for Netflix Zuul, providing non-blocking, reactive routing with significantly higher throughput.

### Request Processing Pipeline

```
Client Request
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│                    SPRING CLOUD GATEWAY                      │
│                                                              │
│  GlobalFilter Chain (runs for ALL routes):                   │
│  1. RemoveHopByHopHeadersFilter                              │
│  2. NettyWriteResponseFilter                                 │
│  3. RouteToRequestUrlFilter                                  │
│  4. LoadBalancerClientFilter (if Eureka registered)          │
│  5. WebsocketRoutingFilter                                   │
│  6. NettyRoutingFilter (actual HTTP routing)                 │
│  7. ForwardRoutingFilter (for local forwards)                │
│                                                              │
│  Route-specific Filter Chain:                                │
│  ├── Pre-filters (before routing)                            │
│  │   ├── JwtAuthenticationFilter (custom)                    │
│  │   ├── RateLimiterFilter (Redis-based)                     │
│  │   ├── RequestLoggingFilter                                │
│  │   └── AddRequestHeaderFilter                              │
│  └── Post-filters (after response)                           │
│      ├── ResponseHeaderFilter                                │
│      └── ResponseLoggingFilter                               │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
Downstream Microservices
(Order, Inventory, Payment, Notification, User)
```

### Gateway vs Service Mesh Distinction

| Aspect | API Gateway | Service Mesh (Istio/Linkerd) |
|--------|-------------|------------------------------|
| **Level** | North-South (external → internal) | East-West (service → service) |
| **Responsibility** | Auth, rate limiting, routing | mTLS, observability, circuit breaking |
| **Implementation** | App-level (Spring Cloud Gateway) | Infrastructure-level (sidecar proxy) |
| **Protocol** | HTTP/1.1, HTTP/2, WebSocket | All TCP protocols |
| **Use together?** | Yes — complementary, not competing | Yes — Gateway at edge, mesh internally |

---

## 🌐 Real-World GitHub Patterns & Industry Reference

### Reference Projects
- **[spring-cloud/spring-cloud-gateway](https://github.com/spring-cloud/spring-cloud-gateway)** — Official Spring Cloud Gateway with samples
- **[Netflix/zuul](https://github.com/Netflix/zuul)** — Zuul 2 (predecessor pattern reference)
- **[alibaba/spring-cloud-alibaba](https://github.com/alibaba/spring-cloud-alibaba)** — Nacos + Sentinel + SCG patterns at Alibaba scale
- **[microservices.io patterns](https://microservices.io/patterns/apigateway.html)** — Canonical pattern documentation

### Industry Pattern: Backend for Frontend (BFF)

Instead of a single monolithic gateway, each frontend (mobile, web, 3rd-party) gets its own BFF:

```
Mobile App ──► Mobile BFF (gateway) ──► Microservices
Web App    ──► Web BFF (gateway)    ──► Microservices
3rd Party  ──► Partner BFF          ──► Microservices (limited)
```

This allows each BFF to aggregate, transform, and cache data optimally for its client.

---

## 🏷️ Framework Annotations, Components & Dependencies

### Maven Dependencies (Gateway Service — separate Spring Boot app)

```xml
<!-- Spring Cloud Gateway (reactive, NOT spring-boot-starter-web) -->
<dependency>
    <groupId>org.springframework.cloud</groupId>
    <artifactId>spring-cloud-starter-gateway</artifactId>
</dependency>

<!-- Service Discovery with Eureka -->
<dependency>
    <groupId>org.springframework.cloud</groupId>
    <artifactId>spring-cloud-starter-netflix-eureka-client</artifactId>
</dependency>

<!-- Redis-based Rate Limiting -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-data-redis-reactive</artifactId>
</dependency>

<!-- Circuit Breaker via Resilience4j -->
<dependency>
    <groupId>org.springframework.cloud</groupId>
    <artifactId>spring-cloud-starter-circuitbreaker-reactor-resilience4j</artifactId>
</dependency>

<!-- Spring Security (OAuth2 Resource Server at gateway) -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-oauth2-resource-server</artifactId>
</dependency>

<!-- Actuator for health checks -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-actuator</artifactId>
</dependency>
```

---

## ⚙️ Production Configuration & Tuning Parameters

### application.yml — Complete Gateway Configuration

```yaml
server:
  port: 8080
  netty:
    connection-timeout: 2s
    idle-timeout: 15s

spring:
  application:
    name: api-gateway

  cloud:
    gateway:
      # Global CORS configuration
      globalcors:
        cors-configurations:
          '[/**]':
            allowedOriginPatterns:
              - "https://*.company.com"
              - "http://localhost:[*]"
            allowedMethods:
              - GET
              - POST
              - PUT
              - DELETE
              - PATCH
              - OPTIONS
            allowedHeaders: "*"
            allowCredentials: true
            maxAge: 3600

      # Default filters applied to ALL routes
      default-filters:
        - name: RequestRateLimiter
          args:
            redis-rate-limiter:
              replenishRate: 10       # tokens per second
              burstCapacity: 20       # max burst
              requestedTokens: 1
            key-resolver: "#{@userKeyResolver}"   # Rate limit per user

        - name: Retry
          args:
            retries: 3
            statuses: BAD_GATEWAY, SERVICE_UNAVAILABLE
            methods: GET, HEAD
            backoff:
              firstBackoff: 50ms
              maxBackoff: 500ms
              factor: 2

        - AddResponseHeader=X-Response-Time, "%{timestamp}"
        - AddResponseHeader=X-Gateway-Version, "1.0"

      routes:
        # Order Service route
        - id: order-service
          uri: lb://ORDER-SERVICE   # lb:// = Eureka load-balanced
          predicates:
            - Path=/api/v1/orders/**
            - Method=GET,POST,PUT,DELETE
          filters:
            - name: CircuitBreaker
              args:
                name: orderServiceCB
                fallbackUri: forward:/fallback/orders
            - RewritePath=/api/v1/orders/(?<segment>.*), /orders/${segment}
            - AddRequestHeader=X-Gateway-Request-Id, "#{T(java.util.UUID).randomUUID()}"

        # Inventory Service route
        - id: inventory-service
          uri: lb://INVENTORY-SERVICE
          predicates:
            - Path=/api/v1/inventory/**
          filters:
            - name: CircuitBreaker
              args:
                name: inventoryServiceCB
                fallbackUri: forward:/fallback/inventory

        # User Service route (public — no auth filter)
        - id: user-service-public
          uri: lb://USER-SERVICE
          predicates:
            - Path=/api/v1/auth/**   # Login, register — no JWT required
          filters:
            - RemoveRequestHeader=Cookie  # Don't forward cookies to auth service

        # User Service route (protected)
        - id: user-service-protected
          uri: lb://USER-SERVICE
          predicates:
            - Path=/api/v1/users/**
          metadata:
            requiresAuthentication: true

        # WebSocket route
        - id: notification-websocket
          uri: lb:ws://NOTIFICATION-SERVICE
          predicates:
            - Path=/ws/**

  # Redis for rate limiting
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

  # OAuth2 Resource Server (validate JWT at gateway)
  security:
    oauth2:
      resourceserver:
        jwt:
          jwk-set-uri: ${KEYCLOAK_URL:http://localhost:8180}/realms/myapp/protocol/openid-connect/certs

# Eureka client configuration
eureka:
  client:
    serviceUrl:
      defaultZone: ${EUREKA_URL:http://localhost:8761}/eureka/
    registry-fetch-interval-seconds: 5

# Resilience4j circuit breaker configuration
resilience4j:
  circuitbreaker:
    instances:
      orderServiceCB:
        slidingWindowType: COUNT_BASED
        slidingWindowSize: 10
        permittedNumberOfCallsInHalfOpenState: 3
        automaticTransitionFromOpenToHalfOpenEnabled: true
        waitDurationInOpenState: 10s
        failureRateThreshold: 50
        eventConsumerBufferSize: 10
      inventoryServiceCB:
        slidingWindowSize: 10
        failureRateThreshold: 60
        waitDurationInOpenState: 5s

management:
  endpoints:
    web:
      exposure:
        include: health, info, gateway, metrics, prometheus
  endpoint:
    gateway:
      enabled: true

logging:
  level:
    org.springframework.cloud.gateway: DEBUG   # dev only
    reactor.netty: DEBUG                       # dev only
```

---

## 📐 System Design Blueprint & Architecture Patterns

### Custom Global Filter — JWT Authentication + Tracing

```java
@Component
@Order(-1)   // Highest priority — runs first
@RequiredArgsConstructor
@Slf4j
public class JwtAuthenticationGlobalFilter implements GlobalFilter {

    private static final List<String> PUBLIC_PATHS = List.of(
        "/api/v1/auth/login",
        "/api/v1/auth/register",
        "/api/v1/auth/refresh",
        "/actuator/health"
    );

    private final JwtTokenValidator jwtValidator;

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        var request = exchange.getRequest();
        var path = request.getPath().value();

        // Skip authentication for public paths
        if (PUBLIC_PATHS.stream().anyMatch(path::startsWith)) {
            return chain.filter(exchange);
        }

        var authHeader = request.getHeaders().getFirst(HttpHeaders.AUTHORIZATION);
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            return onError(exchange, "Missing or invalid Authorization header",
                HttpStatus.UNAUTHORIZED);
        }

        var token = authHeader.substring(7);

        return jwtValidator.validateToken(token)
            .flatMap(claims -> {
                // Add user info to downstream request headers
                var mutatedRequest = exchange.getRequest().mutate()
                    .header("X-User-Id", claims.getSubject())
                    .header("X-User-Roles", String.join(",", claims.getRoles()))
                    .header("X-Tenant-Id", claims.getTenantId())
                    .header("X-Request-Id", UUID.randomUUID().toString())
                    .build();

                log.debug("Authenticated user {} for path {}", claims.getSubject(), path);

                return chain.filter(exchange.mutate().request(mutatedRequest).build());
            })
            .onErrorResume(JwtValidationException.class, e -> {
                log.warn("JWT validation failed: {}", e.getMessage());
                return onError(exchange, "Invalid token: " + e.getMessage(),
                    HttpStatus.UNAUTHORIZED);
            });
    }

    private Mono<Void> onError(ServerWebExchange exchange, String message, HttpStatus status) {
        var response = exchange.getResponse();
        response.setStatusCode(status);
        response.getHeaders().setContentType(MediaType.APPLICATION_JSON);

        var body = """
            {"error": "%s", "status": %d}
            """.formatted(message, status.value());

        var buffer = response.bufferFactory().wrap(body.getBytes(StandardCharsets.UTF_8));
        return response.writeWith(Mono.just(buffer));
    }
}

// Rate Limiter Key Resolver — limit by authenticated user
@Bean
public KeyResolver userKeyResolver() {
    return exchange -> {
        // Extract user ID from header (set by JWT filter)
        var userId = exchange.getRequest().getHeaders().getFirst("X-User-Id");
        if (userId != null) {
            return Mono.just("user:" + userId);
        }
        // Fall back to IP-based limiting for unauthenticated requests
        var remoteAddress = exchange.getRequest().getRemoteAddress();
        return Mono.just("ip:" + (remoteAddress != null ? remoteAddress.getHostString() : "unknown"));
    };
}

// Fallback controller for circuit breaker
@RestController
@RequestMapping("/fallback")
public class FallbackController {

    @GetMapping("/orders")
    public ResponseEntity<Map<String, String>> ordersFallback() {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
            .body(Map.of(
                "error", "Order service is temporarily unavailable",
                "message", "Please try again in a few moments",
                "retryAfter", "30"
            ));
    }

    @GetMapping("/inventory")
    public ResponseEntity<Map<String, String>> inventoryFallback() {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
            .body(Map.of("error", "Inventory service is temporarily unavailable"));
    }
}
```

---

## 🧪 Verification, Testing & Infrastructure Commands

### Docker Setup

```powershell
# Start Eureka Service Discovery
docker run -d --name eureka -p 8761:8761 `
  steeltoeoss/eureka-server

# Start Redis (for rate limiting)
docker run -d --name redis -p 6379:6379 `
  redis:7-alpine --requirepass "gateway-secret"

# Start API Gateway
./mvnw spring-boot:run -pl gateway-service
```

### Testing Gateway Routes

```powershell
# Test unauthenticated access (should return 401)
Invoke-RestMethod -Uri "http://localhost:8080/api/v1/orders" -Method GET

# Get JWT token
$loginBody = @{ username = "user@example.com"; password = "password" } | ConvertTo-Json
$token = (Invoke-RestMethod -Uri "http://localhost:8080/api/v1/auth/login" `
    -Method POST -ContentType "application/json" -Body $loginBody).accessToken

# Authenticated request
Invoke-RestMethod -Uri "http://localhost:8080/api/v1/orders" `
    -Method GET `
    -Headers @{ Authorization = "Bearer $token" }

# Test rate limiting (should return 429 after 20 requests)
1..25 | ForEach-Object {
    try {
        Invoke-RestMethod -Uri "http://localhost:8080/api/v1/orders" `
            -Headers @{ Authorization = "Bearer $token" }
        Write-Host "Request $_: OK"
    } catch {
        Write-Host "Request $_: $($_.Exception.Response.StatusCode)"
    }
}

# View gateway routes via Actuator
Invoke-RestMethod -Uri "http://localhost:8080/actuator/gateway/routes" | ConvertTo-Json -Depth 5

# Refresh gateway routes dynamically (without restart)
Invoke-RestMethod -Uri "http://localhost:8080/actuator/gateway/refresh" -Method POST
```

---

## ⚡ Senior Best Practices & Critical Anti-Patterns

### ✅ Best Practices

1. **Validate JWT at the gateway, not each service** — Services trust the `X-User-Id` header set by gateway. No JWT parsing overhead in downstream services.

2. **Use service discovery with health checks** — Configure Eureka health check handler; unhealthy instances are removed from routing automatically.

3. **Configure global timeout budgets**:
   ```yaml
   spring.cloud.gateway.httpclient:
     connect-timeout: 1000   # 1 second to connect
     response-timeout: 5s    # 5 seconds for response
   ```

4. **Use `StripPrefix` or `RewritePath` to decouple gateway paths from service paths** — Downstream services use `/orders/{id}` while clients use `/api/v1/orders/{id}`.

5. **Implement correlation IDs globally** — The gateway adds `X-Request-Id` header; MDC propagation ensures it appears in every downstream log entry.

### ❌ Critical Anti-Patterns

| Anti-Pattern | Problem | Fix |
|-------------|---------|-----|
| **Putting business logic in gateway** | Gateway becomes a monolith with routing AND logic | Gateway routes and cross-cuts; no business logic |
| **No circuit breaker on gateway** | One failing service cascades to all routes | Circuit breaker per service route with fallback |
| **Missing rate limiting** | DDoS or runaway client can overwhelm all services | Redis-based rate limiting at gateway per user + per IP |
| **Gateway as only auth point** | If bypassed (internal request), services are unprotected | Implement defense in depth: auth at gateway + service-level |
| **Too many routes per gateway** | >100 routes → hard to maintain | Split into domain-specific BFF gateways |
| **Spring WebMVC dependencies in Gateway** | Gateway is WebFlux; adding WebMVC breaks it | NEVER add `spring-boot-starter-web` to gateway service |

---

*Previous: [05-domain-driven-design-ddd.md](./05-domain-driven-design-ddd.md) | Next: [../02-security/01-spring-security-fundamentals.md](../02-security/01-spring-security-fundamentals.md)*
