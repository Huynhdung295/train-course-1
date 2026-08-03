# 📦 Transactional Outbox Pattern & Debezium CDC

> **Category**: Async & Messaging | **Complexity**: Expert | **Java**: 21+ | **Spring Boot**: 3.3+ | **Kafka/Debezium**

---

## 📖 Core Technical Mechanics & Deep-Dive

### The Dual-Write Problem
Microservices often need to update their own database AND publish an event to a message broker (e.g., Kafka).
```java
@Transactional
public void createOrder() {
    orderRepo.save(order);       // 1. DB write
    kafkaTemplate.send(event);   // 2. Broker write
}
```
**If step 1 succeeds and step 2 fails (network glitch), the system is permanently inconsistent.**
If you reverse the order (Kafka first, DB second) and the DB commit fails, Kafka has published a phantom event.
**Two-Phase Commit (2PC / XA)** is the traditional solution, but it is slow, blocks resources, and is unsupported by modern brokers like Kafka.

### The Transactional Outbox Solution
Instead of dual-writing, we write the domain entity AND the event to the **same database** in a single local transaction.

```
1. Application Layer:
   @Transactional {
       INSERT INTO orders (id, status) VALUES (1, 'NEW');
       INSERT INTO outbox_events (aggregate_id, payload) VALUES (1, '{"status":"NEW"}');
   } // Atomic commit!

2. Relay Layer (Polling or CDC):
   Reads from outbox_events table and publishes to Kafka reliably.
```

### Debezium (Change Data Capture)
Polling the outbox table (`SELECT * FROM outbox_events WHERE status = 'PENDING'`) puts heavy load on the database.
**Debezium** solves this by reading the database's transaction log (WAL in PostgreSQL, binlog in MySQL) directly.
- **Zero performance impact** on DB queries.
- **Real-time** event capture (< 50ms latency).
- Kafka Connect streams the WAL directly into Kafka topics.

---

## 🌐 Real-World GitHub Patterns & Industry Reference

- **[debezium/debezium-examples](https://github.com/debezium/debezium-examples)** — Official Outbox pattern examples from Debezium.
- **[microservices-patterns/microservices-patterns](https://github.com/microservices-patterns/microservices-patterns)** — Chris Richardson's reference implementation for the Outbox Pattern.

---

## 🏷️ Framework Annotations & Dependencies

If you are implementing the polling approach (not Debezium):
```xml
<!-- Spring Data JPA -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-data-jpa</artifactId>
</dependency>
<!-- Spring Kafka -->
<dependency>
    <groupId>org.springframework.kafka</groupId>
    <artifactId>spring-kafka</artifactId>
</dependency>
<!-- Schedlock (Prevents duplicate polling across cluster instances) -->
<dependency>
    <groupId>net.javacrumbs.shedlock</groupId>
    <artifactId>shedlock-spring</artifactId>
    <version>5.13.0</version>
</dependency>
```

---

## 📐 System Design Blueprint

### 1. Database Schema (Flyway)

```sql
CREATE TABLE outbox_events (
    id UUID PRIMARY KEY,
    aggregate_type VARCHAR(255) NOT NULL, -- e.g., 'Order'
    aggregate_id VARCHAR(255) NOT NULL,   -- e.g., '123'
    event_type VARCHAR(255) NOT NULL,     -- e.g., 'OrderCreated'
    payload JSONB NOT NULL,               -- The actual event data
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- If polling: add 'status' column and index it.
-- If Debezium: Debezium can automatically delete rows after reading them.
```

### 2. Application Layer (Outbox Insertion)

```java
@Entity
@Table(name = "outbox_events")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class OutboxEvent {
    @Id
    private UUID id = UUID.randomUUID();
    private String aggregateType;
    private String aggregateId;
    private String eventType;
    
    @JdbcTypeCode(SqlTypes.JSON)
    private JsonNode payload;
    
    private Instant createdAt = Instant.now();

    public OutboxEvent(String aggregateType, String aggregateId, String eventType, JsonNode payload) {
        this.aggregateType = aggregateType;
        this.aggregateId = aggregateId;
        this.eventType = eventType;
        this.payload = payload;
    }
}

@Service
@RequiredArgsConstructor
public class OrderService {

    private final OrderRepository orderRepo;
    private final OutboxEventRepository outboxRepo;
    private final ObjectMapper objectMapper;

    @Transactional
    public Order createOrder(CreateOrderCommand cmd) {
        // 1. Business Logic
        var order = new Order(cmd.userId(), cmd.amount());
        orderRepo.save(order);

        // 2. Outbox Event Creation
        var payload = objectMapper.valueToTree(
            new OrderCreatedEvent(order.getId(), order.getTotalAmount())
        );
        
        var outboxEvent = new OutboxEvent(
            "Order", 
            order.getId().toString(), 
            "OrderCreated", 
            payload
        );
        
        // 3. Save Outbox Event (Both save() calls are in the SAME transaction)
        outboxRepo.save(outboxEvent);

        return order;
    }
}
```

### 3. Debezium Kafka Connect Configuration

Deploy a Kafka Connect cluster with the Debezium PostgreSQL connector.
Post this JSON to Kafka Connect's REST API (`POST http://kafka-connect:8083/connectors`):

```json
{
  "name": "outbox-connector",
  "config": {
    "connector.class": "io.debezium.connector.postgresql.PostgresConnector",
    "tasks.max": "1",
    "database.hostname": "postgres",
    "database.port": "5432",
    "database.user": "debezium_user",
    "database.password": "debezium_pass",
    "database.dbname": "orders_db",
    "database.server.name": "order_srv",
    "plugin.name": "pgoutput",
    "table.include.list": "public.outbox_events",
    
    "tombstones.on.delete": "false",
    
    // Outbox Event Router (Transforms DB row into standard Kafka Message)
    "transforms": "outbox",
    "transforms.outbox.type": "io.debezium.transforms.outbox.EventRouter",
    "transforms.outbox.route.topic.replacement": "${routedByValue}",
    "transforms.outbox.table.field.event.id": "id",
    "transforms.outbox.table.field.event.key": "aggregate_id",
    "transforms.outbox.table.field.event.type": "event_type",
    "transforms.outbox.table.field.event.payload": "payload",
    "transforms.outbox.route.by.field": "aggregate_type",
    "transforms.outbox.table.fields.additional.placement": "created_at:header:event_timestamp"
  }
}
```
**Result**: Debezium reads the WAL, parses the `outbox_events` insert, and publishes a Kafka message to the topic `Order` (because `aggregate_type` = "Order"), with Kafka Key = `aggregate_id`, and Kafka Value = `payload`.

---

### Alternative: Polling Implementation (If Debezium is unavailable)

```java
@Component
@RequiredArgsConstructor
@Slf4j
public class OutboxPollingRelay {

    private final OutboxEventRepository outboxRepo;
    private final KafkaTemplate<String, String> kafkaTemplate;

    // Run every 2 seconds. Use ShedLock to ensure only ONE pod runs this at a time.
    @Scheduled(fixedDelay = 2000)
    @SchedulerLock(name = "OutboxRelayLock", lockAtMostFor = "10s", lockAtLeastFor = "1s")
    public void processOutbox() {
        // Fetch up to 100 pending events
        List<OutboxEvent> events = outboxRepo.findTop100ByStatusOrderByCreatedAtAsc("PENDING");

        for (OutboxEvent event : events) {
            try {
                // Topic name based on aggregate type
                String topic = event.getAggregateType().toLowerCase() + "-events";
                
                // Send to Kafka with key = aggregateId (ensures ordering)
                kafkaTemplate.send(topic, event.getAggregateId(), event.getPayload().toString())
                    .get(); // Block to ensure send succeeds

                // Mark as processed (or DELETE to save space)
                event.setStatus("PROCESSED");
                outboxRepo.save(event);
                
            } catch (Exception e) {
                log.error("Failed to publish outbox event {}", event.getId(), e);
                // Stop processing batch on first failure to maintain strict ordering
                break; 
            }
        }
    }
}
```

---

## 🧪 Verification Commands

```powershell
# Pre-requisite for Debezium on PostgreSQL:
# postgresql.conf MUST have: wal_level = logical
docker exec postgres psql -U postgres -c "SHOW wal_level;"

# Create the Debezium Connector via REST API
$config = Get-Content -Raw ./debezium-connector.json
Invoke-RestMethod -Method POST -Uri "http://localhost:8083/connectors" `
    -ContentType "application/json" -Body $config

# Check connector status
Invoke-RestMethod -Uri "http://localhost:8083/connectors/outbox-connector/status" | ConvertTo-Json

# Listen to the Kafka topic to verify Debezium is routing the Outbox events
docker exec kafka kafka-console-consumer.sh --topic Order --bootstrap-server localhost:9092 --from-beginning --property print.key=true
```

---

## ⚡ Best Practices & Anti-Patterns

### ✅ Best Practices
1. **Prefer Debezium over Polling**: Polling is a hack that adds DB load and latency. Debezium reading the WAL is the industry standard for Outbox.
2. **Delete Processed Rows**: Outbox tables grow infinitely. Debezium can be configured to delete the row automatically after reading, or a cron job should prune `PROCESSED` rows daily.
3. **Always use Kafka Keys**: Route by `aggregate_id`. If user `123` updates their profile 5 times, all 5 outbox events MUST have Kafka Key `123` so they hit the same partition in order.

### ❌ Anti-Patterns

| Anti-Pattern | Problem | Fix |
|-------------|---------|-----|
| Dual-Writing | Permanent data inconsistency on partial failures. | Use Transactional Outbox. |
| Polling without ShedLock/Quartz | Multiple microservice replicas poll the same rows, sending duplicates to Kafka. | Add `@SchedulerLock` or `SELECT FOR UPDATE SKIP LOCKED`. |
| Modifying Entity + Sending Kafka Event in `@AfterCommit` | If Kafka is down, the DB committed but the event is lost forever. | `@AfterCommit` is NOT a replacement for Outbox. |
