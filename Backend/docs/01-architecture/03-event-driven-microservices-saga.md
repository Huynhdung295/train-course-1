# 🔄 Event-Driven Microservices & Saga Pattern

> **Category**: Architecture Patterns | **Complexity**: Expert | **Java**: 21+ | **Spring Boot**: 3.3+ | **Kafka**: 3.7+

---

## 📖 Core Technical Mechanics & Deep-Dive

### The Distributed Transaction Problem

In a microservices architecture, a business transaction like "Place Order" spans multiple services:
- **Order Service** — creates the order
- **Inventory Service** — reserves stock
- **Payment Service** — charges the customer
- **Notification Service** — sends email/SMS

Since each service has its own database (**Database-per-Service pattern**), traditional ACID transactions with two-phase commit (2PC/XA) are:
- Not supported by most modern databases/message brokers
- Performance killers (blocking locks across services)
- A single point of failure

**Saga Pattern** solves this by breaking the distributed transaction into a sequence of **local transactions**, each publishing an event or message to trigger the next step. If any step fails, **compensating transactions** are executed to undo previous steps.

### Saga Implementations: Two Strategies

#### Strategy 1: Choreography-Based Saga (Event-Driven)
Services react to events published by other services. No central coordinator.

```
Order Service          Inventory Service       Payment Service
     │                        │                      │
     │ 1. OrderCreated ──────►│                      │
     │                        │ 2. StockReserved ────►│
     │                        │                      │ 3. PaymentProcessed
     │◄─────────────────────────────────────────────  │
     │ 4. OrderConfirmed      │                      │
     │                        │                      │
     │  [FAILURE SCENARIO]    │                      │
     │ 1. OrderCreated ──────►│                      │
     │                        │ 2. StockReserved ────►│
     │                        │                      │ X PaymentFailed
     │                        │◄─────────────────────│
     │                        │ 3. StockReleased      │ (compensate)
     │◄────────────────────── │                      │
     │ 4. OrderFailed         │                      │
```

**Pros**: Simple, no single point of failure, services fully decoupled  
**Cons**: Hard to track state, cyclic dependency risk, hard to debug  
**Use when**: Up to 3-4 services involved, low complexity

#### Strategy 2: Orchestration-Based Saga (Command-Driven)
A central **Saga Orchestrator** coordinates the saga using commands and awaits responses.

```
                    Saga Orchestrator (Order Service)
                           │
                    ┌──────┴──────┐
                    │             │
              RESERVE_STOCK   CHARGE_PAYMENT
                    │             │
                    ▼             ▼
            Inventory         Payment
              Service          Service
                    │             │
             StockReserved  PaymentCharged
                    └──────┬──────┘
                           │
                    ┌──────┴──────┐
                    │             │
                CONFIRMED     ROLLBACK
```

**Pros**: Centralized state visibility, explicit coordination, easier to debug  
**Cons**: Saga orchestrator can become a god service  
**Use when**: Complex multi-step flows, regulatory audit requirements

---

## 🌐 Real-World GitHub Patterns & Industry Reference

### Reference Implementations
- **[eventuate-tram-sagas](https://github.com/eventuate-tram/eventuate-tram-sagas)** — Chris Richardson's Saga framework for Java
- **[microservices-demo by Google](https://github.com/GoogleCloudPlatform/microservices-demo)** — Choreography patterns at scale
- **[e-commerce-microservice-backend-app](https://github.com/sebasptsch/e-commerce-microservice-backend-app)** — Spring Boot Saga implementation with Kafka
- **[Order Saga Example](https://github.com/eventuate-tram/eventuate-tram-examples-customers-and-orders)** — Customer/Order choreography saga

### Production Saga State Machine Implementation

```java
// Saga state enum representing all possible states
public enum OrderSagaState {
    PENDING,
    STOCK_RESERVING,
    STOCK_RESERVED,
    PAYMENT_PROCESSING,
    PAYMENT_PROCESSED,
    COMPLETED,
    // Compensation states
    STOCK_RELEASING,
    PAYMENT_REFUNDING,
    FAILED
}

// Saga entity — persisted to track distributed transaction state
@Entity
@Table(name = "order_sagas")
public class OrderSaga {

    @Id
    private UUID sagaId;

    private UUID orderId;

    @Enumerated(EnumType.STRING)
    private OrderSagaState state;

    private String failureReason;

    @CreationTimestamp
    private Instant createdAt;

    @UpdateTimestamp
    private Instant updatedAt;

    // State transition methods
    public void stockReserved() {
        assertState(STOCK_RESERVING);
        this.state = STOCK_RESERVED;
    }

    public void paymentProcessed() {
        assertState(PAYMENT_PROCESSING);
        this.state = PAYMENT_PROCESSED;
    }

    public void fail(String reason) {
        this.failureReason = reason;
        this.state = FAILED;
    }

    private void assertState(OrderSagaState expected) {
        if (this.state != expected) {
            throw new InvalidSagaStateTransitionException(sagaId, state, expected);
        }
    }
}
```

---

## 🏷️ Framework Annotations, Components & Dependencies

### Maven Dependencies

```xml
<!-- Spring Kafka -->
<dependency>
    <groupId>org.springframework.kafka</groupId>
    <artifactId>spring-kafka</artifactId>
</dependency>

<!-- Spring Cloud Stream with Kafka binder -->
<dependency>
    <groupId>org.springframework.cloud</groupId>
    <artifactId>spring-cloud-starter-stream-kafka</artifactId>
</dependency>

<!-- Spring State Machine (for orchestration saga) -->
<dependency>
    <groupId>org.springframework.statemachine</groupId>
    <artifactId>spring-statemachine-core</artifactId>
    <version>4.0.0</version>
</dependency>

<!-- Spring State Machine with JPA persistence -->
<dependency>
    <groupId>org.springframework.statemachine</groupId>
    <artifactId>spring-statemachine-data-jpa</artifactId>
    <version>4.0.0</version>
</dependency>
```

---

## ⚙️ Production Configuration & Tuning Parameters

### Kafka Configuration for Saga Events

```yaml
spring:
  kafka:
    bootstrap-servers: ${KAFKA_BOOTSTRAP:localhost:9092}
    
    producer:
      # Ensure messages are not lost
      acks: all                    # All replicas must acknowledge
      retries: 2147483647          # Integer.MAX_VALUE — retry forever
      max-in-flight-requests-per-connection: 5
      enable-idempotence: true     # Exactly-once producer semantics
      batch-size: 16384            # 16KB batches
      linger-ms: 5                 # Wait 5ms for batch to fill
      compression-type: snappy
      key-serializer: org.apache.kafka.common.serialization.StringSerializer
      value-serializer: org.springframework.kafka.support.serializer.JsonSerializer
      properties:
        spring.json.add.type.headers: false
    
    consumer:
      group-id: order-saga-group
      auto-offset-reset: earliest
      enable-auto-commit: false    # Manual commit for exactly-once
      max-poll-records: 100
      key-deserializer: org.apache.kafka.common.serialization.StringDeserializer
      value-deserializer: org.springframework.kafka.support.serializer.JsonDeserializer
      properties:
        spring.json.trusted.packages: "com.company.events"
    
    listener:
      ack-mode: MANUAL_IMMEDIATE   # Commit after processing
      concurrency: 3               # 3 concurrent consumers per partition
      missing-topics-fatal: true

# Topic configuration
app:
  kafka:
    topics:
      order-commands: order-commands
      inventory-events: inventory-events
      payment-events: payment-events
      order-events: order-events
      saga-deadletter: saga-deadletter
```

---

## 📐 System Design Blueprint & Architecture Patterns

### Complete Choreography Saga Implementation

```java
// ---- ORDER SERVICE ----

// 1. Start saga when order is created
@Service
@Transactional
@RequiredArgsConstructor
@Slf4j
public class OrderSagaCoordinator {

    private final OrderRepository orderRepo;
    private final OrderSagaRepository sagaRepo;
    private final KafkaTemplate<String, Object> kafkaTemplate;

    public OrderId startSaga(PlaceOrderCommand cmd) {
        // Create order in PENDING state
        var order = Order.create(cmd);
        orderRepo.save(order);

        // Create saga tracking entity
        var saga = new OrderSaga(UUID.randomUUID(), order.getId(), PENDING);
        sagaRepo.save(saga);

        // Publish command to Inventory service
        var reserveCmd = new ReserveStockCommand(saga.getSagaId(), order.getId(), cmd.items());
        kafkaTemplate.send("inventory-commands", order.getId().toString(), reserveCmd);

        saga.setState(STOCK_RESERVING);
        sagaRepo.save(saga);

        log.info("Saga {} started for order {}", saga.getSagaId(), order.getId());
        return order.getId();
    }

    // 2. Listen to Inventory response
    @KafkaListener(topics = "inventory-events", groupId = "order-saga-group")
    @Transactional
    public void onInventoryEvent(InventoryEvent event, Acknowledgment ack) {
        var saga = sagaRepo.findBySagaId(event.sagaId())
            .orElseThrow(() -> new SagaNotFoundException(event.sagaId()));

        if (event instanceof StockReservedEvent reserved) {
            saga.stockReserved();
            sagaRepo.save(saga);

            // Move to next step — Payment
            var payCmd = new ProcessPaymentCommand(
                saga.getSagaId(), saga.getOrderId(), reserved.totalAmount()
            );
            kafkaTemplate.send("payment-commands", saga.getOrderId().toString(), payCmd);
            saga.setState(PAYMENT_PROCESSING);
            sagaRepo.save(saga);

        } else if (event instanceof StockReservationFailedEvent failed) {
            // Compensation: cancel order
            saga.fail(failed.reason());
            sagaRepo.save(saga);
            orderRepo.findById(saga.getOrderId()).ifPresent(Order::cancel);

            log.warn("Saga {} failed at stock reservation: {}", saga.getSagaId(), failed.reason());
        }

        ack.acknowledge();
    }

    // 3. Listen to Payment response
    @KafkaListener(topics = "payment-events", groupId = "order-saga-group")
    @Transactional
    public void onPaymentEvent(PaymentEvent event, Acknowledgment ack) {
        var saga = sagaRepo.findBySagaId(event.sagaId())
            .orElseThrow(() -> new SagaNotFoundException(event.sagaId()));

        if (event instanceof PaymentSucceededEvent) {
            saga.paymentProcessed();
            saga.setState(COMPLETED);
            sagaRepo.save(saga);

            orderRepo.findById(saga.getOrderId()).ifPresent(Order::confirm);
            log.info("Saga {} completed successfully", saga.getSagaId());

        } else if (event instanceof PaymentFailedEvent failed) {
            saga.fail(failed.reason());
            sagaRepo.save(saga);

            // Compensate: release stock
            var releaseCmd = new ReleaseStockCommand(saga.getSagaId(), saga.getOrderId());
            kafkaTemplate.send("inventory-commands", saga.getOrderId().toString(), releaseCmd);
            saga.setState(STOCK_RELEASING);
            sagaRepo.save(saga);

            log.warn("Saga {} failed at payment, releasing stock", saga.getSagaId());
        }

        ack.acknowledge();
    }
}

// ---- INVENTORY SERVICE ----

@Service
@Transactional
@RequiredArgsConstructor
public class InventoryCommandHandler {

    private final InventoryRepository inventoryRepo;
    private final KafkaTemplate<String, Object> kafkaTemplate;

    @KafkaListener(topics = "inventory-commands", groupId = "inventory-group")
    public void handleReserveStock(ReserveStockCommand cmd, Acknowledgment ack) {
        try {
            cmd.items().forEach(item -> {
                var stock = inventoryRepo.findByProductId(item.productId())
                    .orElseThrow(() -> new ProductNotFoundException(item.productId()));

                if (stock.getAvailable() < item.quantity()) {
                    throw new InsufficientStockException(item.productId(), item.quantity());
                }
                stock.reserve(item.quantity());
                inventoryRepo.save(stock);
            });

            var totalAmount = cmd.items().stream()
                .map(i -> i.price().multiply(i.quantity()))
                .reduce(Money.ZERO, Money::add);

            kafkaTemplate.send("inventory-events", cmd.orderId().toString(),
                new StockReservedEvent(cmd.sagaId(), cmd.orderId(), totalAmount));

        } catch (InsufficientStockException e) {
            kafkaTemplate.send("inventory-events", cmd.orderId().toString(),
                new StockReservationFailedEvent(cmd.sagaId(), cmd.orderId(), e.getMessage()));
        }

        ack.acknowledge();
    }
}
```

---

## 🧪 Verification, Testing & Infrastructure Commands

### Docker Infrastructure for Local Testing

```powershell
# Start Kafka + Zookeeper via Docker Compose
docker run -d --name zookeeper -p 2181:2181 `
  -e ZOOKEEPER_CLIENT_PORT=2181 `
  confluentinc/cp-zookeeper:7.6.0

docker run -d --name kafka -p 9092:9092 `
  -e KAFKA_BROKER_ID=1 `
  -e KAFKA_ZOOKEEPER_CONNECT=zookeeper:2181 `
  -e KAFKA_ADVERTISED_LISTENERS=PLAINTEXT://localhost:9092 `
  -e KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR=1 `
  --link zookeeper `
  confluentinc/cp-kafka:7.6.0

# OR use Kafka UI for monitoring
docker run -d --name kafka-ui -p 8090:8080 `
  -e KAFKA_CLUSTERS_0_NAME=local `
  -e KAFKA_CLUSTERS_0_BOOTSTRAPSERVERS=kafka:9092 `
  --link kafka `
  provectuslabs/kafka-ui:latest
```

### Create Kafka Topics
```powershell
# Create required topics
$topics = @("order-commands", "inventory-commands", "payment-commands", 
            "inventory-events", "payment-events", "order-events", "saga-deadletter")

foreach ($topic in $topics) {
    docker exec kafka kafka-topics `
        --create --if-not-exists `
        --bootstrap-server localhost:9092 `
        --partitions 3 `
        --replication-factor 1 `
        --topic $topic
}

# List topics to verify
docker exec kafka kafka-topics --list --bootstrap-server localhost:9092

# Monitor a topic in real-time
docker exec kafka kafka-console-consumer `
    --bootstrap-server localhost:9092 `
    --topic order-events `
    --from-beginning `
    --property print.key=true
```

### Saga Integration Test

```java
@SpringBootTest
@EmbeddedKafka(partitions = 1, topics = {
    "inventory-commands", "inventory-events",
    "payment-commands", "payment-events",
    "order-events"
})
@TestPropertySource(properties = {
    "spring.kafka.bootstrap-servers=${spring.embedded.kafka.brokers}"
})
class OrderSagaIntegrationTest {

    @Autowired
    private OrderSagaCoordinator sagaCoordinator;

    @Autowired
    private OrderRepository orderRepository;

    @Autowired
    private KafkaTemplate<String, Object> kafkaTemplate;

    @Test
    @Timeout(30)  // Saga must complete within 30 seconds
    void sagaShouldCompleteSuccessfully() throws Exception {
        var cmd = PlaceOrderCommand.builder()
            .customerId(CustomerId.of("cust-1"))
            .items(List.of(new OrderItem(ProductId.of("prod-1"), 2, Money.of(29.99))))
            .build();

        var orderId = sagaCoordinator.startSaga(cmd);

        // Simulate Inventory reserving stock
        Thread.sleep(500);
        kafkaTemplate.send("inventory-events", orderId.toString(),
            new StockReservedEvent(/* sagaId */ null, orderId, Money.of(59.98)));

        // Simulate Payment succeeding
        Thread.sleep(500);
        kafkaTemplate.send("payment-events", orderId.toString(),
            new PaymentSucceededEvent(/* sagaId */ null, orderId));

        // Wait for saga to complete
        await().atMost(10, SECONDS).until(() -> {
            var order = orderRepository.findById(orderId).orElseThrow();
            return order.getStatus() == OrderStatus.CONFIRMED;
        });
    }
}
```

---

## ⚡ Senior Best Practices & Critical Anti-Patterns

### ✅ Best Practices

1. **Always store saga state in a DB** — Never rely on in-memory state; services crash and restart. The `order_sagas` table is your audit log.

2. **Make all saga steps idempotent** — Kafka delivers at-least-once. Your inventory reservation handler MUST safely handle duplicate `ReserveStockCommand` messages.
   ```java
   // Check if already processed
   if (inventoryRepo.existsReservation(cmd.sagaId())) {
       ack.acknowledge();
       return;  // Already processed, skip
   }
   ```

3. **Use correlation IDs** — Always pass `sagaId` through every command/event to correlate across services.

4. **Implement a Saga timeout** — Use `@Scheduled` to scan for sagas stuck in non-terminal states for more than 5 minutes and trigger compensation:
   ```java
   @Scheduled(fixedDelay = 60_000)
   public void cleanupStaleSagas() {
       var stale = sagaRepo.findByStateInAndUpdatedAtBefore(
           List.of(STOCK_RESERVING, PAYMENT_PROCESSING),
           Instant.now().minus(Duration.ofMinutes(5))
       );
       stale.forEach(saga -> triggerCompensation(saga, "Saga timeout"));
   }
   ```

5. **Use Dead Letter Queue for poison pills** — Configure DLQ for events that fail processing repeatedly.

### ❌ Critical Anti-Patterns

| Anti-Pattern | Problem | Fix |
|-------------|---------|-----|
| **Distributed 2PC** | Locks across services → deadlocks, timeout cascades | Use Saga pattern — local transactions + compensation |
| **Synchronous saga steps** | HTTP call from Order to Inventory during saga — if Inventory is down, Order fails | Use async events/commands via Kafka |
| **Saga state in memory** | Service restart = saga lost, orders stuck in PENDING | Persist saga state to DB in every state transition |
| **Non-idempotent handlers** | Kafka redelivery causes double reservation/charge | Check for existing processing via `sagaId` before acting |
| **Missing compensation logic** | Payment fails but stock stays reserved forever | Every forward step must have a corresponding compensating transaction |
| **Too many saga steps** | 10+ step saga becomes unmanageable | Keep sagas to 3-5 steps maximum; use orchestration for complex flows |

---

*Previous: [02-modular-monolith-spring-modulith.md](./02-modular-monolith-spring-modulith.md) | Next: [04-cqrs-pattern-spring-kafka.md](./04-cqrs-pattern-spring-kafka.md)*
