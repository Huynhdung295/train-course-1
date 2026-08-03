# 📚 MASTER CHECKLIST — Java 21+ & Spring Boot 3+ Complete Knowledge Base
> **Principal Architect Reference** | Production-Grade Enterprise Documentation Suite  
> Status: 🔴 In Progress | Last Updated: 2026-08-02

---

## 🗺️ Documentation Taxonomy & Directory Map

This index defines the **complete self-designed taxonomy** for mastering the entire Java 21+ and Spring Boot 3+ ecosystem. Every file listed below will be generated with exhaustive, production-grade content following the mandatory 7-section structure.

---

## 📁 DIRECTORY STRUCTURE

```
docs/
├── 00-MASTER-CHECKLIST.md                          ← You are here
│
├── 01-architecture/
│   ├── 01-clean-hexagonal-architecture.md
│   ├── 02-modular-monolith-spring-modulith.md
│   ├── 03-event-driven-microservices-saga.md
│   ├── 04-cqrs-pattern-spring-kafka.md
│   ├── 05-domain-driven-design-ddd.md
│   └── 06-api-gateway-service-mesh.md
│
├── 02-security/
│   ├── 01-spring-security-fundamentals.md
│   ├── 02-jwt-dual-token-architecture.md
│   ├── 03-oauth2-oidc-pkce-flow.md
│   ├── 04-keycloak-spring-authorization-server.md
│   ├── 05-mfa-totp-otp-implementation.md
│   ├── 06-passkey-fido2-webauthn.md
│   └── 07-abac-fine-grained-authorization.md
│
├── 03-database/
│   ├── 01-flyway-liquibase-migration.md
│   ├── 02-spring-data-jpa-hibernate6-tuning.md
│   ├── 03-n-plus-1-resolution-strategies.md
│   ├── 04-querydsl-jooq-specifications.md
│   ├── 05-multi-tenancy-architecture.md
│   ├── 06-read-write-splitting-routing.md
│   └── 07-jpa-annotations-deep-dive.md
│
├── 04-caching-concurrency/
│   ├── 01-multilevel-cache-caffeine-redis.md
│   ├── 02-cache-antipatterns-mitigation.md
│   ├── 03-optimistic-pessimistic-locking.md
│   ├── 04-distributed-locking-redisson.md
│   └── 05-java21-virtual-threads-loom.md
│
├── 05-async-messaging/
│   ├── 01-spring-events-async-transactional.md
│   ├── 02-kafka-spring-cloud-stream.md
│   ├── 03-transactional-outbox-debezium.md
│   ├── 04-rabbitmq-dlq-retry-patterns.md
│   ├── 05-websocket-stomp-redis-pubsub.md
│   └── 06-sse-reactive-webflux.md
│
├── 06-resilience-integration/
│   ├── 01-restclient-webclient-spring6.md
│   ├── 02-resilience4j-circuit-breaker.md
│   ├── 03-spring-batch-enterprise.md
│   └── 04-rate-limiting-throttling.md
│
├── 07-observability-ops/
│   ├── 01-global-error-handling-rfc7807.md
│   ├── 02-validation-jakarta-constraints.md
│   ├── 03-actuator-micrometer-prometheus.md
│   ├── 04-distributed-tracing-opentelemetry.md
│   └── 05-structured-logging-elk-stack.md
│
├── 08-production-boilerplate/
│   ├── 01-base-entity-audit-trail.md
│   ├── 02-custom-jackson-serializers.md
│   ├── 03-aop-custom-annotations.md
│   ├── 04-configuration-properties-profiles.md
│   └── 05-docker-compose-infrastructure.md
│
└── 09-testing/
    ├── 01-unit-testing-mockito-junit5.md
    ├── 02-integration-testing-testcontainers.md
    ├── 03-security-testing-spring-security-test.md
    └── 04-performance-testing-jmeter-k6.md
```

---

## ✅ FILE GENERATION CHECKLIST

### 📁 01-architecture/ — Enterprise Architecture Patterns
| # | File | Status | Core Topics |
|---|------|--------|-------------|
| 1 | `01-clean-hexagonal-architecture.md` | ✅ Done | Ports & Adapters, Domain isolation, Dependency Inversion |
| 2 | `02-modular-monolith-spring-modulith.md` | ✅ Done | Spring Modulith, @ApplicationModule, module boundaries |
| 3 | `03-event-driven-microservices-saga.md` | ✅ Done | Choreography vs Orchestration, Saga state machine |
| 4 | `04-cqrs-pattern-spring-kafka.md` | ✅ Done | Command/Query separation, Event Sourcing, projections |
| 5 | `05-domain-driven-design-ddd.md` | ✅ Done | Aggregates, Value Objects, Bounded Contexts, Ubiquitous Language |
| 6 | `06-api-gateway-service-mesh.md` | ✅ Done | Spring Cloud Gateway, load balancing, service discovery |

### 📁 02-security/ — Authentication, Authorization & Identity
| # | File | Status | Core Topics |
|---|------|--------|-------------|
| 7 | `01-spring-security-fundamentals.md` | ✅ Done | Security filter chain, AuthenticationManager, SecurityContext |
| 8 | `02-jwt-dual-token-architecture.md` | ✅ Done | Access/Refresh tokens, JTI blacklist, Redis revocation |
| 9 | `03-oauth2-oidc-pkce-flow.md` | ✅ Done | PKCE flow, resource server, token introspection |
| 10 | `04-keycloak-spring-authorization-server.md` | ✅ Done | Keycloak realm setup, Spring AS, JWKS verification |
| 11 | `05-mfa-totp-otp-implementation.md` | ✅ Done | TOTP HOTP, Google Authenticator, Redis OTP rate limiting |
| 12 | `06-passkey-fido2-webauthn.md` | ✅ Done | WebAuthn protocol, webauthn4j-spring-security |
| 13 | `07-abac-fine-grained-authorization.md` | ✅ Done | ABAC vs RBAC, custom PermissionEvaluator, SpEL policies |

### 📁 03-database/ — Data Architecture & ORM
| # | File | Status | Core Topics |
|---|------|--------|-------------|
| 14 | `01-flyway-liquibase-migration.md` | ✅ Done | Versioned migrations, rollback, baseline, checksums |
| 15 | `02-spring-data-jpa-hibernate6-tuning.md` | ✅ Done | Hibernate 6 internals, StatelessSession, batch insert |
| 16 | `03-n-plus-1-resolution-strategies.md` | ✅ Done | EntityGraph, JOIN FETCH, BatchSize, projection DTOs |
| 17 | `04-querydsl-jooq-specifications.md` | ✅ Done | JPAQueryFactory, dynamic predicates, jOOQ code gen |
| 18 | `05-multi-tenancy-architecture.md` | ✅ Done | Schema-per-tenant, DB-per-tenant, TenantContext |
| 19 | `06-read-write-splitting-routing.md` | ✅ Done | AbstractRoutingDataSource, HikariCP tuning |
| 20 | `07-jpa-annotations-deep-dive.md` | ✅ Done | @Transactional internals, @Convert, @Audited (Envers) |

### 📁 04-caching-concurrency/ — Performance & Concurrency
| # | File | Status | Core Topics |
|---|------|--------|-------------|
| 21 | `01-multilevel-cache-caffeine-redis.md` | ✅ Done | L1+L2 hierarchy, Lettuce vs Redisson, cache coherence |
| 22 | `02-cache-antipatterns-mitigation.md` | ✅ Done | Bloom filter, null caching, Redisson lock on stampede |
| 23 | `03-optimistic-pessimistic-locking.md` | ✅ Done | @Version, FOR UPDATE, StaleObjectStateException handling |
| 24 | `04-distributed-locking-redisson.md` | ✅ Done | RLock, RFairLock, lease renewal, Redlock algorithm |
| 25 | `05-java21-virtual-threads-loom.md` | ✅ Done | Project Loom, carrier thread pinning, VT executor |

### 📁 05-async-messaging/ — Event-Driven & Realtime
| # | File | Status | Core Topics |
|---|------|--------|-------------|
| 26 | `01-spring-events-async-transactional.md` | ✅ Done | ApplicationEventPublisher, @TransactionalEventListener |
| 27 | `02-kafka-spring-cloud-stream.md` | ✅ Done | Producers, consumers, partitioning, exactly-once semantics |
| 28 | `03-transactional-outbox-debezium.md` | ✅ Done | CDC pattern, Debezium, Kafka Connect outbox routing |
| 29 | `04-rabbitmq-dlq-retry-patterns.md` | ✅ Done | DLQ, retry template, x-death headers, poison pill handling |
| 30 | `05-websocket-stomp-redis-pubsub.md` | ✅ Done | STOMP broker relay, Redis Pub/Sub for horizontal scaling |
| 31 | `06-sse-reactive-webflux.md` | ✅ Done | Flux<ServerSentEvent>, backpressure, reactive pipelines |

### 📁 06-resilience-integration/ — Integration & Fault Tolerance
| # | File | Status | Core Topics |
|---|------|--------|-------------|
| 32 | `01-restclient-webclient-spring6.md` | ✅ Done | RestClient builder, interceptors, exchange strategies |
| 33 | `02-resilience4j-circuit-breaker.md` | ✅ Done | @CircuitBreaker, @Retry, @RateLimiter, @Bulkhead states |
| 34 | `03-spring-batch-enterprise.md` | ✅ Done | Job/Step/Chunk, parallel steps, remote partitioning |
| 35 | `04-rate-limiting-throttling.md` | ✅ Done | Redis sliding window, token bucket, API gateway throttle |

### 📁 07-observability-ops/ — Monitoring & Operations
| # | File | Status | Core Topics |
|---|------|--------|-------------|
| 36 | `01-global-error-handling-rfc7807.md` | ✅ Done | @RestControllerAdvice, ProblemDetail, error taxonomy |
| 37 | `02-validation-jakarta-constraints.md` | ✅ Done | @Valid vs @Validated, custom validators, constraint groups |
| 38 | `03-actuator-micrometer-prometheus.md` | ✅ Done | Custom metrics, Gauge, Counter, Timer, health indicators |
| 39 | `04-distributed-tracing-opentelemetry.md` | ✅ Done | TraceId/SpanId propagation, OTLP export, Zipkin/Jaeger |
| 40 | `05-structured-logging-elk-stack.md` | ✅ Done | Logback JSON, MDC context, Logstash, ELK dashboards |

### 📁 08-production-boilerplate/ — Reusable Enterprise Utilities
| # | File | Status | Core Topics |
|---|------|--------|-------------|
| 41 | `01-base-entity-audit-trail.md` | ✅ Done | @MappedSuperclass, @CreatedDate, @CreatedBy, Envers |
| 42 | `02-custom-jackson-serializers.md` | ✅ Done | StdSerializer, StdDeserializer, @JsonComponent, modules |
| 43 | `03-aop-custom-annotations.md` | ✅ Done | @Aspect, @Around, @Before, execution pointcut, @Retention |
| 44 | `04-configuration-properties-profiles.md` | ✅ Done | @ConfigurationProperties, @Profile, Spring Cloud Config |
| 45 | `05-docker-compose-infrastructure.md` | ✅ Done | Compose for all middleware: Postgres, Redis, Kafka, Keycloak |

### 📁 09-testing/ — Quality Assurance & Testing
| # | File | Status | Core Topics |
|---|------|--------|-------------|
| 46 | `01-unit-testing-mockito-junit5.md` | ✅ Done | @ExtendWith, @Mock, @InjectMocks, ArgumentCaptor, BDD |
| 47 | `02-integration-testing-testcontainers.md` | ✅ Done | @Testcontainers, @Container, @DynamicPropertySource |
| 48 | `03-security-testing-spring-security-test.md` | ✅ Done | @WithMockUser, @WithSecurityContext, MockMvc security |
| 49 | `04-performance-testing-jmeter-k6.md` | ✅ Done | k6 scripts, JMeter thread groups, baseline benchmarking |

---

## 🎯 CORE PHILOSOPHY & PRINCIPLES

### Architecture North Star
```
Domain Model (Pure Java) 
    → Application Services (Use Cases)
        → Ports (Interfaces) 
            → Adapters (Spring, JPA, REST, Kafka, Redis)
```

### The 12 Commandments of Production Spring Boot
1. **Never leak domain objects** across layer boundaries — use DTOs + Mappers
2. **Always use `@Transactional` at the service layer**, never at the repository layer
3. **Never call `@Async` methods from within the same class** (self-invocation proxy bypass)
4. **Resolve N+1 before it hits production** — use `@EntityGraph` on repository method level
5. **Implement JTI blacklist** for any JWT invalidation use case
6. **Use `@TransactionalEventListener(AFTER_COMMIT)`** to avoid phantom events on rollback
7. **Always configure `spring.jpa.open-in-view=false`** — anti-pattern in production
8. **Tune `HikariCP` pool size** = (Core count * 2) + effective spindle count
9. **Use `@ConditionalOnProperty`** for feature flags rather than hard-coded if-else
10. **Never log sensitive data** — use Masked MDC context for PII fields
11. **Always implement idempotency keys** for payment and critical mutation endpoints
12. **Use Virtual Threads** for all blocking I/O in Java 21+ deployments

### Version Matrix
| Component | Version |
|-----------|---------|
| Java | 21 LTS (Virtual Threads, Pattern Matching, Records) |
| Spring Boot | 3.3.x (Spring Framework 6.1.x) |
| Spring Security | 6.3.x |
| Hibernate | 6.5.x |
| Spring Cloud | 2023.0.x (Leyton) |
| Spring Batch | 5.1.x |
| Spring Modulith | 1.2.x |
| Kafka | 3.7.x |
| Resilience4j | 2.2.x |
| Testcontainers | 1.19.x |
| Micrometer | 1.13.x |

---

> 💡 **Generation Note**: Every file in this suite is written to production-grade standards with real code samples, Docker commands, `curl`/PowerShell test scripts, and architecture diagrams. No placeholders. No pseudocode.
