# 🐇 RabbitMQ: DLQ, Retry Patterns & Poison Pill Handling

> **Category**: Async & Messaging | **Complexity**: Advanced | **Java**: 21+ | **Spring Boot**: 3.3+ | **RabbitMQ**: 3.13+

---

## 📖 Core Technical Mechanics & Deep-Dive

### Kafka vs RabbitMQ
- **Kafka**: Dumb broker, smart consumer. Log-based. Excellent for replay, event sourcing, stream processing.
- **RabbitMQ**: Smart broker, dumb consumer. Queue-based. Excellent for complex routing, priority queues, delayed messages, and strict DLQ (Dead Letter Queue) semantics.

### The Retry & Dead Letter Exchange (DLX) Architecture
If a consumer throws an exception while processing a message:
1. **Immediate Retry**: Spring AMPQ can retry instantly in memory (bad for DB deadlocks/transient network issues).
2. **Delayed Retry**: Send the message to a "Wait" queue with a TTL. When TTL expires, RabbitMQ routes it back to the main queue (exponential backoff).
3. **Dead Lettering**: If all retries fail (or if it's a fatal error like `IllegalArgumentException`), the message is routed to the DLX (Dead Letter Exchange) and stored in a DLQ (Dead Letter Queue) for manual human inspection.

### Poison Pills
A "poison pill" is a message that consistently crashes the consumer (e.g., malformed JSON). If not handled, it triggers infinite retries, blocking the entire queue queue. DLQs are the primary defense against poison pills.

---

## 🌐 Real-World GitHub Patterns & Industry Reference

- **[spring-projects/spring-amqp](https://github.com/spring-projects/spring-amqp)** — Official Spring AMQP framework
- **[rabbitmq/rabbitmq-delayed-message-exchange](https://github.com/rabbitmq/rabbitmq-delayed-message-exchange)** — Plugin for native delayed messaging (better than TTL queues)

---

## 🏷️ Framework Annotations & Dependencies

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-amqp</artifactId>
</dependency>
```

---

## ⚙️ Production Configuration

### application.yml

```yaml
spring:
  rabbitmq:
    host: ${RABBITMQ_HOST:localhost}
    port: 5672
    username: user
    password: password
    
    listener:
      simple:
        acknowledge-mode: auto          # Let Spring handle ACK/NACK based on Exceptions
        concurrency: 3                  # Initial consumer threads
        max-concurrency: 10             # Scale up to 10 under load
        prefetch: 50                    # Fetch 50 messages at a time (throughput vs fairness)
        default-requeue-rejected: false # CRITICAL: If processing fails, DO NOT requeue endlessly. Send to DLX.
        
        # In-memory Spring Retries (Not delayed via broker)
        retry:
          enabled: true
          initial-interval: 1000ms
          multiplier: 2.0
          max-interval: 10000ms
          max-attempts: 3
```

---

## 📐 System Design Blueprint

### Complete RabbitMQ DLQ Architecture

```java
// ═══════════════════════════════════════════════════
// 1. RABBITMQ TOPOLOGY CONFIGURATION (Exchanges, Queues, Bindings)
// ═══════════════════════════════════════════════════

@Configuration
public class RabbitMqConfig {

    public static final String EXCHANGE = "orders.exchange";
    public static final String QUEUE = "orders.queue";
    public static final String ROUTING_KEY = "order.created";

    // DLQ Constants
    public static final String DLX = "orders.dlx";
    public static final String DLQ = "orders.dlq";
    
    @Bean
    public DirectExchange orderExchange() {
        return new DirectExchange(EXCHANGE);
    }

    /**
     * The main processing queue.
     * Configured with x-dead-letter-exchange so that rejected messages flow to the DLX.
     */
    @Bean
    public Queue orderQueue() {
        return QueueBuilder.durable(QUEUE)
            .withArgument("x-dead-letter-exchange", DLX)
            .withArgument("x-dead-letter-routing-key", QUEUE) // Preserve original routing key
            .build();
    }

    @Bean
    public Binding orderBinding(Queue orderQueue, DirectExchange orderExchange) {
        return BindingBuilder.bind(orderQueue).to(orderExchange).with(ROUTING_KEY);
    }

    // --- Dead Letter Configuration ---

    @Bean
    public DirectExchange deadLetterExchange() {
        return new DirectExchange(DLX);
    }

    @Bean
    public Queue deadLetterQueue() {
        return QueueBuilder.durable(DLQ).build();
    }

    @Bean
    public Binding deadLetterBinding(Queue deadLetterQueue, DirectExchange deadLetterExchange) {
        // Bind using the name of the original queue so messages are routed here
        return BindingBuilder.bind(deadLetterQueue).to(deadLetterExchange).with(QUEUE);
    }
    
    // --- Message Converter (JSON) ---
    
    @Bean
    public MessageConverter jsonMessageConverter(ObjectMapper objectMapper) {
        return new Jackson2JsonMessageConverter(objectMapper);
    }
}

// ═══════════════════════════════════════════════════
// 2. EXCEPTION CLASSIFICATION & CUSTOM FATAL EXCEPTIONS
// ═══════════════════════════════════════════════════

@Configuration
public class RabbitRetryConfig {

    /**
     * By default, Spring AMQP retries ALL exceptions.
     * We don't want to retry business logic errors or bad JSON (Poison Pills).
     * We configure the ExceptionStrategy to immediately reject (DLQ) fatal errors.
     */
    @Bean
    public ConditionalRejectingErrorHandler errorHandler() {
        var strategy = new ConditionalRejectingErrorHandler.DefaultExceptionStrategy() {
            @Override
            protected boolean isUserCauseFatal(Throwable cause) {
                return cause instanceof IllegalArgumentException || 
                       cause instanceof ConstraintViolationException ||
                       cause instanceof JsonProcessingException;
            }
        };
        return new ConditionalRejectingErrorHandler(strategy);
    }
}

// ═══════════════════════════════════════════════════
// 3. PUBLISHER
// ═══════════════════════════════════════════════════

@Service
@RequiredArgsConstructor
@Slf4j
public class OrderEventPublisher {

    private final RabbitTemplate rabbitTemplate;

    public void publishOrderCreated(OrderEvent event) {
        log.info("Publishing event to RabbitMQ: {}", event.orderId());
        rabbitTemplate.convertAndSend(
            RabbitMqConfig.EXCHANGE, 
            RabbitMqConfig.ROUTING_KEY, 
            event
        );
    }
}

// ═══════════════════════════════════════════════════
// 4. CONSUMER
// ═══════════════════════════════════════════════════

@Component
@RequiredArgsConstructor
@Slf4j
public class OrderEventConsumer {

    private final OrderProcessor orderProcessor;

    @RabbitListener(queues = RabbitMqConfig.QUEUE)
    public void receiveMessage(OrderEvent event, Message message, Channel channel) {
        try {
            log.info("Received event for Order: {}", event.orderId());
            
            // Artificial Poison Pill simulation
            if (event.amount().compareTo(BigDecimal.ZERO) < 0) {
                // This is a FATAL exception. Because of ConditionalRejectingErrorHandler,
                // it skips in-memory retries and goes straight to DLQ.
                throw new IllegalArgumentException("Amount cannot be negative");
            }
            
            orderProcessor.process(event);
            
        } catch (Exception e) {
            // Log the "x-death" header to see how many times RabbitMQ routed this to a DLX
            List<Map<String, ?>> xDeath = message.getMessageProperties().getXDeathHeader();
            long retryCount = xDeath != null ? (Long) xDeath.get(0).get("count") : 0;
            
            log.error("Failed to process message (Retry Count: {}): {}", retryCount, e.getMessage());
            
            // Re-throw to let Spring AMQP handle retries or rejection (DLQ)
            throw e; 
        }
    }
}
```

---

## 🧪 Verification Commands

```powershell
# Start RabbitMQ with Management UI
docker run -d --name rabbitmq -p 5672:5672 -p 15672:15672 rabbitmq:3-management

# Open browser to http://localhost:15672 (guest/guest) to view Exchanges and Queues

# Use the REST API to trigger a successful event
$validBody = @{ orderId = 1; amount = 100.0 } | ConvertTo-Json
Invoke-RestMethod -Method POST -Uri "http://localhost:8080/api/v1/orders/publish" -ContentType "application/json" -Body $validBody

# Use the REST API to trigger a Poison Pill
$invalidBody = @{ orderId = 2; amount = -50.0 } | ConvertTo-Json
Invoke-RestMethod -Method POST -Uri "http://localhost:8080/api/v1/orders/publish" -ContentType "application/json" -Body $invalidBody

# Check DLQ depth via RabbitMQ Management API
Invoke-RestMethod -Uri "http://guest:guest@localhost:15672/api/queues/%2f/orders.dlq" | Select-Object messages
```

---

## ⚡ Best Practices & Anti-Patterns

### ✅ Best Practices
1. **Always configure a DLQ**. Never deploy a queue to production without a bound DLX.
2. **`default-requeue-rejected: false` is Mandatory**. If true (default in older versions), a poison pill causes an infinite loop of requeuing and CPU spiking.
3. **Classify Exceptions**. Network timeouts (`ResourceAccessException`) should be retried. Data validation errors (`IllegalArgumentException`) should go directly to DLQ without wasting 3 retries.

### ❌ Anti-Patterns

| Anti-Pattern | Problem | Fix |
|-------------|---------|-----|
| Infinite retries | Poison pill message blocks the consumer thread forever. | Set `max-attempts: 3` and use DLQ. |
| Catching generic `Exception` and not rethrowing | Message is considered successfully processed (ACKed) even though it failed. Data is lost. | Re-throw or manually `channel.basicNack(tag, false, false)`. |
| Huge `prefetch` values (e.g., 10,000) | One fast consumer hogs all messages in memory, starving other instances. | Use `prefetch: 50` for good throughput + fair distribution. |
