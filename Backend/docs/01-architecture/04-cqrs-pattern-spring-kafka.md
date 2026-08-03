# ⚡ CQRS Pattern with Spring Data & Kafka

> **Category**: Architecture Patterns | **Complexity**: Expert | **Java**: 21+ | **Spring Boot**: 3.3+

---

## 📖 Core Technical Mechanics & Deep-Dive

### CQRS Fundamentals

**Command Query Responsibility Segregation (CQRS)** separates the write model (commands that change state) from the read model (queries that return data). This seemingly simple separation has profound architectural implications:

```
Write Side (Command Model)              Read Side (Query Model)
─────────────────────────              ───────────────────────
• Accepts Commands                     • Handles Queries
• Enforces business rules              • Returns DTOs/Projections
• Uses rich domain model               • Uses denormalized read models
• Persists to write DB                 • Reads from read DB (optimized)
• Publishes Domain Events              • Updated by event handlers
• Strong consistency                   • Eventual consistency acceptable
```

### Why CQRS?

1. **Performance**: Read and write models have radically different access patterns. CQRS lets you optimize each independently.
2. **Scale**: The read side (often 90%+ of traffic) can scale independently with read replicas.
3. **Simplicity**: Commands enforce invariants on clean domain models; queries use flat, denormalized projections.
4. **Event Sourcing compatibility**: CQRS is the natural partner of Event Sourcing.

### CQRS Spectrum — How Far You Go

```
Level 0: Single model, separate service methods       (no CQRS)
Level 1: Same DB, separate Query/Command objects      (logical CQRS)
Level 2: Same DB, separate read projections           (basic CQRS)
Level 3: Separate read/write databases                (full CQRS)
Level 4: Separate read/write DBs + Event Sourcing     (full CQRS + ES)
```

Most Spring Boot applications benefit from **Level 2 or Level 3**.

### Event Sourcing (Optional Extension)

Instead of storing current state, store the **sequence of events** that led to the current state:

```
Traditional: orders table has status = 'CONFIRMED'
Event Sourcing: event_store has:
    1. OrderPlacedEvent (2024-01-01 10:00)
    2. PaymentCapturedEvent (2024-01-01 10:01)
    3. OrderConfirmedEvent (2024-01-01 10:02)
```

Current state is **reconstructed** by replaying events:
```java
Order order = Order.empty();
eventStore.findByOrderId(orderId).forEach(order::apply);
// order.getStatus() = CONFIRMED
```

---

## 🌐 Real-World GitHub Patterns & Industry Reference

### Reference Projects
- **[AxonFramework/AxonFramework](https://github.com/AxonFramework/AxonFramework)** — Production CQRS + Event Sourcing framework for Java
- **[CQRS Journey (Microsoft)](https://github.com/microsoftarchive/cqrs-journey)** — The definitive CQRS + Saga reference
- **[eShopOnContainers](https://github.com/dotnet-architecture/eShopOnContainers)** — Enterprise CQRS patterns (C# but principles apply identically)
- **[spring-boot-cqrs-mediatr](https://github.com/springframeworkguru/spring-cqrs-mediatr)** — Spring Boot CQRS with MediatR-style bus

### Industry Pattern: MediatR-Style Command Bus in Spring

```java
// Command marker interface
public sealed interface Command<R> permits PlaceOrderCommand, CancelOrderCommand, UpdateProfileCommand {}

// Query marker interface
public sealed interface Query<R> permits GetOrderQuery, ListOrdersQuery, GetUserProfileQuery {}

// Generic command handler interface
public interface CommandHandler<C extends Command<R>, R> {
    R handle(C command);
}

// Generic query handler interface
public interface QueryHandler<Q extends Query<R>, R> {
    R handle(Q query);
}

// Command Bus — dispatches to the right handler
@Component
@RequiredArgsConstructor
public class CommandBus {

    private final ApplicationContext context;

    @SuppressWarnings("unchecked")
    public <R> R dispatch(Command<R> command) {
        // Find handler bean for this command type
        String handlerBeanName = StringUtils.uncapitalize(
            command.getClass().getSimpleName().replace("Command", "Handler")
        );
        var handler = (CommandHandler<Command<R>, R>) context.getBean(handlerBeanName);
        return handler.handle(command);
    }
}

// Usage in controller — controller only speaks in Commands and Queries
@RestController
@RequestMapping("/api/v1/orders")
@RequiredArgsConstructor
public class OrderController {

    private final CommandBus commandBus;
    private final QueryBus queryBus;

    @PostMapping
    public ResponseEntity<OrderResponse> placeOrder(@Valid @RequestBody PlaceOrderRequest request) {
        var command = new PlaceOrderCommand(request.customerId(), request.items());
        var orderId = commandBus.dispatch(command);
        return ResponseEntity.created(URI.create("/api/v1/orders/" + orderId))
            .body(new OrderResponse(orderId));
    }

    @GetMapping("/{id}")
    public OrderDetailView getOrder(@PathVariable String id) {
        return queryBus.dispatch(new GetOrderQuery(OrderId.of(id)));
    }
}
```

---

## 🏷️ Framework Annotations, Components & Dependencies

### Maven Dependencies

```xml
<!-- Spring Data JPA (write side) -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-data-jpa</artifactId>
</dependency>

<!-- Spring Kafka (event propagation to read model) -->
<dependency>
    <groupId>org.springframework.kafka</groupId>
    <artifactId>spring-kafka</artifactId>
</dependency>

<!-- QueryDSL for type-safe read queries -->
<dependency>
    <groupId>com.querydsl</groupId>
    <artifactId>querydsl-jpa</artifactId>
    <classifier>jakarta</classifier>
</dependency>
<dependency>
    <groupId>com.querydsl</groupId>
    <artifactId>querydsl-apt</artifactId>
    <classifier>jakarta</classifier>
    <scope>provided</scope>
</dependency>

<!-- Optional: MongoDB for read model (denormalized documents) -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-data-mongodb</artifactId>
</dependency>

<!-- Optional: Elasticsearch for full-text search read model -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-data-elasticsearch</artifactId>
</dependency>
```

### Key CQRS Annotations

| Annotation | Layer | Purpose |
|-----------|-------|---------|
| `@Transactional(readOnly = true)` | Query handlers | Skip dirty-check, use read-only connection |
| `@Transactional` | Command handlers | Full ACID for write operations |
| `@Service` | Command/Query handlers | Spring bean for handler discovery |
| `@KafkaListener` | Projection updaters | Consume events to update read model |
| `@Query` | Spring Data | Custom JPQL for projections |

---

## ⚙️ Production Configuration & Tuning Parameters

### application.yml for CQRS with Separate DBs

```yaml
spring:
  # Write database (PostgreSQL — normalized, ACID)
  datasource:
    write:
      url: jdbc:postgresql://postgres-primary:5432/orders_write
      username: ${WRITE_DB_USER}
      password: ${WRITE_DB_PASS}
      hikari:
        maximum-pool-size: 15
        minimum-idle: 5
        pool-name: WriteHikariPool

    # Read database (PostgreSQL read replica or separate DB)
    read:
      url: jdbc:postgresql://postgres-replica:5432/orders_read
      username: ${READ_DB_USER}
      password: ${READ_DB_PASS}
      hikari:
        maximum-pool-size: 30    # More connections — reads are frequent
        minimum-idle: 10
        pool-name: ReadHikariPool
        read-only: true          # Hint to driver

  jpa:
    open-in-view: false
    hibernate:
      ddl-auto: validate

  kafka:
    bootstrap-servers: ${KAFKA_BOOTSTRAP:localhost:9092}
    consumer:
      group-id: read-model-projector
      auto-offset-reset: earliest
      enable-auto-commit: false
```

---

## 📐 System Design Blueprint & Architecture Patterns

### Full CQRS with Kafka Event Propagation

```
WRITE SIDE                              READ SIDE
──────────                              ─────────

  REST API                                REST API
     │                                       │
     ▼                                       ▼
CommandBus                             QueryBus
     │                                       │
     ▼                                       ▼
PlaceOrder               ┌─────────► OrderDetailView
CommandHandler           │          (MongoDB / Postgres Read Replica)
     │                   │
     ▼                   │ Kafka Event
Order Domain Model       │ (OrderPlacedEvent)
     │                   │
     ▼                   │
Write DB (Postgres)      │
     │                   │
     └───── Event ───────┘
             │
             ▼
    OrderProjectionUpdater
    (KafkaListener)
             │
             ▼
    Update OrderReadModel
    in Read DB/MongoDB
```

### Complete CQRS Command/Query Implementation

```java
// ═══════════════════════════════════════════════════
// WRITE SIDE — Commands & Domain
// ═══════════════════════════════════════════════════

// Command
public record PlaceOrderCommand(
    CustomerId customerId,
    List<OrderItemDto> items
) implements Command<OrderId> {}

// Command Handler (Write Side)
@Service("placeOrderHandler")
@Transactional
@RequiredArgsConstructor
@Slf4j
public class PlaceOrderCommandHandler implements CommandHandler<PlaceOrderCommand, OrderId> {

    private final OrderWriteRepository writeRepo;
    private final ApplicationEventPublisher events;

    @Override
    public OrderId handle(PlaceOrderCommand cmd) {
        var lines = cmd.items().stream()
            .map(item -> new OrderLine(item.productId(), item.quantity(), item.unitPrice()))
            .toList();

        var order = Order.create(cmd.customerId(), lines);
        writeRepo.save(order);

        // Domain event will be published to Kafka via @TransactionalEventListener
        events.publishEvent(new OrderPlacedEvent(
            order.getId(),
            cmd.customerId(),
            lines,
            Instant.now()
        ));

        log.info("Order {} placed for customer {}", order.getId(), cmd.customerId());
        return order.getId();
    }
}

// ═══════════════════════════════════════════════════
// EVENT BRIDGE — Write → Kafka → Read
// ═══════════════════════════════════════════════════

@Component
@RequiredArgsConstructor
public class OrderEventKafkaBridge {

    private final KafkaTemplate<String, Object> kafkaTemplate;

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onOrderPlaced(OrderPlacedEvent event) {
        // Guaranteed: order is in DB before event is published to Kafka
        kafkaTemplate.send("order-events", event.orderId().toString(), event);
    }
}

// ═══════════════════════════════════════════════════
// READ SIDE — Projections & Query Handlers
// ═══════════════════════════════════════════════════

// Read Model (denormalized for query performance)
@Document(collection = "order_views")   // MongoDB document (OR @Entity for read DB)
@Data
public class OrderReadModel {
    @Id
    private String id;              // orderId
    private String customerId;
    private String customerName;    // Denormalized from User service
    private String customerEmail;   // Denormalized
    private String status;
    private BigDecimal totalAmount;
    private List<OrderLineView> lines;
    private Instant placedAt;
    private Instant lastUpdatedAt;
}

// Projection Updater (Event Consumer)
@Component
@RequiredArgsConstructor
@Slf4j
public class OrderProjectionUpdater {

    private final OrderReadRepository readRepo;
    private final CustomerQueryService customerService; // Read customer data

    @KafkaListener(topics = "order-events", groupId = "read-model-projector")
    @Transactional
    public void on(OrderPlacedEvent event, Acknowledgment ack) {
        try {
            var customer = customerService.findById(event.customerId());

            var readModel = new OrderReadModel();
            readModel.setId(event.orderId().toString());
            readModel.setCustomerId(event.customerId().toString());
            readModel.setCustomerName(customer.fullName());
            readModel.setCustomerEmail(customer.email());
            readModel.setStatus("PENDING");
            readModel.setTotalAmount(event.lines().stream()
                .map(l -> l.unitPrice().multiply(BigDecimal.valueOf(l.quantity())))
                .reduce(BigDecimal.ZERO, BigDecimal::add));
            readModel.setPlacedAt(event.occurredAt());
            readModel.setLastUpdatedAt(Instant.now());

            readRepo.save(readModel);
            ack.acknowledge();

            log.debug("Projection updated for order {}", event.orderId());
        } catch (Exception e) {
            log.error("Failed to update projection for order {}", event.orderId(), e);
            // Don't ack — Kafka will redeliver
        }
    }
}

// Query
public record GetOrderQuery(OrderId orderId) implements Query<OrderDetailView> {}

// Query Handler (Read Side — optimized for reads)
@Service("getOrderHandler")
@Transactional(readOnly = true)
@RequiredArgsConstructor
public class GetOrderQueryHandler implements QueryHandler<GetOrderQuery, OrderDetailView> {

    private final OrderReadRepository readRepo;
    private final OrderReadMapper mapper;

    @Override
    public OrderDetailView handle(GetOrderQuery query) {
        return readRepo.findById(query.orderId().toString())
            .map(mapper::toView)
            .orElseThrow(() -> new OrderNotFoundException(query.orderId()));
    }
}

// Advanced Read — with pagination and filtering
@Service("listOrdersHandler")
@Transactional(readOnly = true)
@RequiredArgsConstructor
public class ListOrdersQueryHandler implements QueryHandler<ListOrdersQuery, Page<OrderSummaryView>> {

    private final OrderReadRepository readRepo;

    @Override
    public Page<OrderSummaryView> handle(ListOrdersQuery query) {
        var pageable = PageRequest.of(query.page(), query.size(),
            Sort.by(Sort.Direction.DESC, "placedAt"));

        if (query.customerId() != null) {
            return readRepo.findByCustomerIdAndStatusIn(
                query.customerId().toString(),
                query.statuses(),
                pageable
            );
        }
        return readRepo.findAll(pageable).map(OrderSummaryView::from);
    }
}
```

---

## 🧪 Verification, Testing & Infrastructure Commands

### Docker Setup

```powershell
# Start PostgreSQL (write DB + read replica)
docker run -d --name postgres-write -p 5432:5432 `
  -e POSTGRES_DB=orders_write `
  -e POSTGRES_USER=writeuser `
  -e POSTGRES_PASSWORD=secret `
  postgres:16-alpine

# Start MongoDB (read model)
docker run -d --name mongodb -p 27017:27017 `
  -e MONGO_INITDB_ROOT_USERNAME=admin `
  -e MONGO_INITDB_ROOT_PASSWORD=secret `
  mongo:7

# Start Kafka (event bridge)
docker run -d --name kafka -p 9092:9092 `
  -e KAFKA_ENABLE_KRAFT=yes `
  -e KAFKA_CFG_NODE_ID=1 `
  -e KAFKA_CFG_PROCESS_ROLES=broker,controller `
  -e KAFKA_CFG_CONTROLLER_QUORUM_VOTERS=1@localhost:9093 `
  -e KAFKA_CFG_LISTENERS=PLAINTEXT://:9092,CONTROLLER://:9093 `
  -e KAFKA_CFG_ADVERTISED_LISTENERS=PLAINTEXT://localhost:9092 `
  -e KAFKA_CFG_LISTENER_SECURITY_PROTOCOL_MAP=CONTROLLER:PLAINTEXT,PLAINTEXT:PLAINTEXT `
  -e KAFKA_CFG_CONTROLLER_LISTENER_NAMES=CONTROLLER `
  bitnami/kafka:3.7
```

### API Test Commands

```powershell
# Place order (triggers command handler → write DB → Kafka → read projection)
$body = @{
    customerId = "cust-abc123"
    items = @(
        @{ productId = "prod-001"; quantity = 3; unitPrice = 19.99 }
    )
} | ConvertTo-Json -Depth 3

$response = Invoke-RestMethod -Method POST `
    -Uri "http://localhost:8080/api/v1/orders" `
    -ContentType "application/json" `
    -Body $body

Write-Host "Created order: $($response.orderId)"

# Wait for projection to update (eventual consistency)
Start-Sleep -Seconds 1

# Query from read model
Invoke-RestMethod -Uri "http://localhost:8080/api/v1/orders/$($response.orderId)" |
    ConvertTo-Json -Depth 5
```

---

## ⚡ Senior Best Practices & Critical Anti-Patterns

### ✅ Best Practices

1. **Mark query handlers `@Transactional(readOnly = true)`** — This uses read-only connections, skips dirty checking, and enables DB-level read optimizations.

2. **Design read models for the UI, not the domain** — The `OrderListView` should have exactly the fields the list page needs, pre-joined and pre-formatted.

3. **Handle eventual consistency explicitly** — Don't hide it; design UIs that show "Refreshing..." for operations in flight. Use polling or SSE to push updates.

4. **Rebuild projections from event store** — If read model gets corrupted or you add a new field, replay all historical events to rebuild it.

5. **Version your events** — `OrderPlacedEvent.v1`, `OrderPlacedEvent.v2` with schema migration strategies.

### ❌ Critical Anti-Patterns

| Anti-Pattern | Problem | Fix |
|-------------|---------|-----|
| **Querying write DB for reads** | Write DB has normalized, complex joins — slow at scale | Separate read model with denormalized data |
| **Eventual consistency for financial data** | Payment status showing "PENDING" after confirmation | Mark financial read models as requiring strong consistency; use write DB for those |
| **Fat command handlers** | Command handler doing 10 steps = business logic leak | Domain model owns business logic; command handler orchestrates only |
| **Projections updating state** | Read side projector that calls write side APIs | Read side is strictly read-only; it only consumes events to build read models |
| **Skipping event versioning** | Changing event schema breaks consumers | Use `@JsonTypeInfo` + event versions from day 1 |

---

*Previous: [03-event-driven-microservices-saga.md](./03-event-driven-microservices-saga.md) | Next: [05-domain-driven-design-ddd.md](./05-domain-driven-design-ddd.md)*
