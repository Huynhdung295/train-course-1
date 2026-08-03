# 🚀 Kafka & Spring Cloud Stream

> **Category**: Async & Messaging | **Complexity**: Expert | **Java**: 21+ | **Spring Boot**: 3.3+ | **Kafka**: 3.7+

---

## 📖 Core Technical Mechanics & Deep-Dive

### Spring Cloud Stream Architecture
Spring Cloud Stream provides a powerful abstraction over message brokers. It binds **Java Functions** (`java.util.function.Function`, `Supplier`, `Consumer`) to message broker destinations (topics/queues).
- **Binders**: Implementations for specific brokers (Kafka, RabbitMQ, Kinesis).
- **Bindings**: The bridge between your Java code and the external destination.
- **Consumer Groups**: Kafka consumer groups are mapped via the `group` property. This guarantees that only one instance of your service processes a specific message (competing consumers).

### Kafka Semantics
- **Partitions**: Topics are divided into partitions. Ordering is **only guaranteed within a single partition**.
- **Message Keys**: Kafka routes messages with the same key to the same partition. If you need all events for `order-123` processed in order, set the key to `order-123`.
- **Exactly-Once Semantics (EOS)**: Kafka supports idempotent producers and transactions. Spring Cloud Stream can wrap consumption and production in a single Kafka transaction.

---

## 🌐 Real-World GitHub Patterns & Industry Reference

- **[spring-cloud/spring-cloud-stream](https://github.com/spring-cloud/spring-cloud-stream)** — Official repository
- **[confluentinc/kafka-streams-examples](https://github.com/confluentinc/kafka-streams-examples)** — Deep Kafka Patterns from Confluent

---

## 🏷️ Framework Annotations & Dependencies

```xml
<!-- Spring Cloud Stream -->
<dependency>
    <groupId>org.springframework.cloud</groupId>
    <artifactId>spring-cloud-stream</artifactId>
</dependency>

<!-- Kafka Binder -->
<dependency>
    <groupId>org.springframework.cloud</groupId>
    <artifactId>spring-cloud-stream-binder-kafka</artifactId>
</dependency>

<!-- Optional: Kafka Streams (for stateful processing) -->
<dependency>
    <groupId>org.springframework.cloud</groupId>
    <artifactId>spring-cloud-stream-binder-kafka-streams</artifactId>
</dependency>
```

---

## ⚙️ Production Configuration

### application.yml

```yaml
spring:
  cloud:
    function:
      # Define which functions are exposed as stream endpoints
      definition: orderEventProcessor;paymentEventConsumer
      
    stream:
      kafka:
        binder:
          brokers: ${KAFKA_BROKERS:localhost:9092}
          auto-create-topics: false    # Disable in PROD. Let Terraform/Ops create topics.
          # EOS Configuration
          transaction:
            transactionIdPrefix: tx-service-
          producer-properties:
            enable.idempotence: true
            acks: all

      bindings:
        # Syntax: <functionName>-in-<index> or <functionName>-out-<index>
        
        # ── Processor (Consumes from 'orders', Produces to 'processed-orders') ──
        orderEventProcessor-in-0:
          destination: orders.v1
          group: order-service-group
          consumer:
            max-attempts: 3
            back-off-initial-interval: 1000
        orderEventProcessor-out-0:
          destination: processed.orders.v1

        # ── Consumer (Consumes from 'payments') ──
        paymentEventConsumer-in-0:
          destination: payments.v1
          group: order-service-payment-group
          consumer:
            concurrency: 3   # Run 3 consumer threads (ensure topic has >= 3 partitions)

        # ── Manual Producer (Using StreamBridge) ──
        notification-out:
          destination: notifications.v1
          producer:
            partition-key-expression: headers['userId'] # Route by userId header
```

---

## 📐 System Design Blueprint

### Complete Kafka Implementation

```java
// ═══════════════════════════════════════════════════
// 1. EVENT DEFINITIONS (Records)
// ═══════════════════════════════════════════════════

public record OrderEvent(Long orderId, String status, BigDecimal amount, UUID userId) {}
public record ProcessedOrderEvent(Long orderId, String status, String processingNode) {}
public record PaymentEvent(Long orderId, String paymentId, String status) {}

// ═══════════════════════════════════════════════════
// 2. FUNCTIONAL BINDINGS (Consumers & Processors)
// ═══════════════════════════════════════════════════

@Configuration
@Slf4j
public class KafkaStreamConfig {

    /**
     * PROCESSOR: Consumes OrderEvent, produces ProcessedOrderEvent.
     * Binding: orderEventProcessor-in-0 -> orderEventProcessor-out-0
     */
    @Bean
    public Function<Message<OrderEvent>, Message<ProcessedOrderEvent>> orderEventProcessor() {
        return message -> {
            var event = message.getPayload();
            var partitionId = message.getHeaders().get(KafkaHeaders.RECEIVED_PARTITION);
            
            log.info("Processing Order {} from partition {}", event.orderId(), partitionId);
            
            // Business logic
            var result = new ProcessedOrderEvent(
                event.orderId(), 
                "PROCESSED", 
                System.getenv("HOSTNAME")
            );

            // Return new message, preserving the Kafka key for downstream routing
            return MessageBuilder.withPayload(result)
                .setHeader(KafkaHeaders.KEY, event.orderId().toString().getBytes())
                .build();
        };
    }

    /**
     * CONSUMER: Consumes PaymentEvent, produces nothing.
     * Binding: paymentEventConsumer-in-0
     */
    @Bean
    public Consumer<Message<PaymentEvent>> paymentEventConsumer(PaymentService paymentService) {
        return message -> {
            var event = message.getPayload();
            log.info("Received Payment Event: {}", event);
            paymentService.handlePayment(event);
            
            // Manual ACKing (if configured with ack-mode: MANUAL)
            // Acknowledgment ack = message.getHeaders().get(KafkaHeaders.ACKNOWLEDGMENT, Acknowledgment.class);
            // if (ack != null) ack.acknowledge();
        };
    }
}

// ═══════════════════════════════════════════════════
// 3. DYNAMIC PRODUCER (StreamBridge)
// ═══════════════════════════════════════════════════

@Service
@RequiredArgsConstructor
@Slf4j
public class NotificationPublisher {

    // StreamBridge allows dynamic sending outside of the functional model
    private final StreamBridge streamBridge;

    public void sendNotification(UUID userId, String messageContent) {
        var message = MessageBuilder.withPayload(messageContent)
            // Set header so YAML partition-key-expression can route by userId
            .setHeader("userId", userId.toString())
            // Set Kafka native key for log compaction / strict ordering
            .setHeader(KafkaHeaders.KEY, userId.toString().getBytes())
            .build();

        // Send to the binding name defined in YAML: 'notification-out'
        boolean sent = streamBridge.send("notification-out", message);
        log.info("Notification sent: {}", sent);
    }
}
```

---

## 🧪 Verification Commands

```powershell
# Start Kafka & Zookeeper using Docker Compose
docker run -d --name zookeeper -p 2181:2181 -e ALLOW_ANONYMOUS_LOGIN=yes bitnami/zookeeper:3.9
docker run -d --name kafka -p 9092:9092 `
  -e KAFKA_CFG_ZOOKEEPER_CONNECT=zookeeper:2181 `
  -e ALLOW_PLAINTEXT_LISTENER=yes `
  -e KAFKA_CFG_LISTENERS=PLAINTEXT://:9092 `
  -e KAFKA_CFG_ADVERTISED_LISTENERS=PLAINTEXT://127.0.0.1:9092 `
  bitnami/kafka:3.7

# Create Topics
docker exec kafka kafka-topics.sh --create --topic orders.v1 --bootstrap-server localhost:9092 --partitions 3
docker exec kafka kafka-topics.sh --create --topic processed.orders.v1 --bootstrap-server localhost:9092 --partitions 3
docker exec kafka kafka-topics.sh --create --topic notifications.v1 --bootstrap-server localhost:9092 --partitions 3

# Send a test message via CLI
docker exec -it kafka /bin/bash -c "echo '{\"orderId\": 100, \"status\": \"NEW\", \"amount\": 50.0, \"userId\": \"123e4567-e89b-12d3-a456-426614174000\"}' | kafka-console-producer.sh --topic orders.v1 --bootstrap-server localhost:9092"

# Tail the output topic
docker exec kafka kafka-console-consumer.sh --topic processed.orders.v1 --bootstrap-server localhost:9092 --from-beginning
```

---

## ⚡ Best Practices & Anti-Patterns

### ✅ Best Practices
1. **Always set `group` in configuration**: If omitted, Spring Cloud Stream creates an anonymous, auto-deleting queue. You will lose messages if your app restarts!
2. **Use Kafka Keys for Ordering**: If order updates must be processed sequentially, set `KafkaHeaders.KEY` to the `orderId`.
3. **Idempotent Consumers**: Always design consumers to be idempotent. Network glitches *will* cause duplicate deliveries (At-Least-Once delivery).

### ❌ Anti-Patterns

| Anti-Pattern | Problem | Fix |
|-------------|---------|-----|
| Using `@StreamListener` | Deprecated and removed in Spring Cloud Stream 3.x+ | Use `java.util.function` (`Function`, `Consumer`, `Supplier`) |
| Concurrency > Partitions | If you have 3 partitions and `concurrency: 5`, 2 threads will sit idle doing nothing. | Set `concurrency` ≤ number of partitions. |
| Blocking the Consumer Thread | If you make a slow HTTP call in the consumer, Kafka may assume the consumer is dead and rebalance. | Increase `max.poll.interval.ms` or hand off to a Virtual Thread executor. |
