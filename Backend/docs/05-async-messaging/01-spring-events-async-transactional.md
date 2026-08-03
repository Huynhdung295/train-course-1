# 📬 Spring Events, @Async, and @TransactionalEventListener

> **Category**: Async & Messaging | **Complexity**: Intermediate | **Java**: 21+ | **Spring Boot**: 3.3+

---

## 📖 Core Technical Mechanics & Deep-Dive

### Spring ApplicationEvent Publisher
Spring's internal event bus allows components to communicate synchronously or asynchronously without tight coupling (Publish-Subscribe pattern inside the JVM).

### The Phantom Event Problem
If you publish an event inside a database transaction, and the event listener triggers an external action (e.g., sends an email), what happens if the database transaction subsequently **rolls back**?
- The database insert is reverted.
- But the email was **already sent**! (Phantom action for data that doesn't exist).

### @TransactionalEventListener to the Rescue
`@TransactionalEventListener` delays the execution of the listener until the transaction reaches a specific phase:
- `AFTER_COMMIT` (default): Execute only if the transaction commits successfully.
- `AFTER_ROLLBACK`: Execute only if it rolls back.
- `BEFORE_COMMIT`: Execute just before commit (useful for auditing within the same TX).

By combining `@TransactionalEventListener` with `@Async`, you ensure the event is processed **asynchronously, but only if the primary transaction succeeded**.

---

## 🌐 Real-World GitHub Patterns & Industry Reference

- **[spring-projects/spring-framework](https://github.com/spring-projects/spring-framework)** — Core event infrastructure
- **[maciejwalkowiak/spring-boot-startup-report](https://github.com/maciejwalkowiak/spring-boot-startup-report)** — Heavy use of Spring application events

---

## 🏷️ Framework Annotations & Dependencies

*Built into `spring-context` and `spring-tx`; no extra dependencies required.*

| Annotation | Purpose |
|------------|---------|
| `@EventListener` | Synchronous event listener (blocks publisher) |
| `@TransactionalEventListener` | Binds listener to transaction phase (default: AFTER_COMMIT) |
| `@Async` | Executes listener in a separate thread |
| `@EnableAsync` | Required on config to activate `@Async` |

---

## ⚙️ Production Configuration

```yaml
spring:
  task:
    execution:
      # If spring.threads.virtual.enabled=true, these pool settings are ignored
      # and @Async uses Virtual Threads automatically.
      pool:
        core-size: 10
        max-size: 50
        queue-capacity: 10000
      thread-name-prefix: async-task-
```

---

## 📐 System Design Blueprint

### Complete Event-Driven Internal Architecture

```java
// ═══════════════════════════════════════════════════
// 1. EVENT DEFINITION (Immutable Record)
// ═══════════════════════════════════════════════════

public record OrderCreatedEvent(
    Long orderId,
    UUID userId,
    BigDecimal totalAmount,
    String customerEmail
) {}

// ═══════════════════════════════════════════════════
// 2. PUBLISHER (Service Layer)
// ═══════════════════════════════════════════════════

@Service
@RequiredArgsConstructor
@Slf4j
public class OrderService {

    private final OrderRepository orderRepo;
    private final ApplicationEventPublisher eventPublisher;

    @Transactional
    public Order createOrder(CreateOrderCommand cmd) {
        // 1. Save to database
        var order = new Order(cmd.userId(), cmd.amount(), cmd.email());
        orderRepo.save(order);

        // 2. Publish event (Does NOT block or send immediately if listener is transactional)
        log.info("Publishing OrderCreatedEvent for order {}", order.getId());
        
        eventPublisher.publishEvent(new OrderCreatedEvent(
            order.getId(),
            order.getUserId(),
            order.getTotalAmount(),
            order.getCustomerEmail()
        ));

        // 3. Return. If an exception happens here, TX rolls back, and event is DISCARDED!
        return order;
    }
}

// ═══════════════════════════════════════════════════
// 3. ASYNC CONFIGURATION
// ═══════════════════════════════════════════════════

@Configuration
@EnableAsync
@Slf4j
public class AsyncConfig implements AsyncConfigurer {

    // Global exception handler for @Async methods (since they return void, 
    // exceptions get swallowed without this)
    @Override
    public AsyncUncaughtExceptionHandler getAsyncUncaughtExceptionHandler() {
        return (ex, method, params) -> {
            log.error("Async error in method {} with params {}: {}", 
                method.getName(), params, ex.getMessage(), ex);
        };
    }
}

// ═══════════════════════════════════════════════════
// 4. LISTENERS (Handling the Event)
// ═══════════════════════════════════════════════════

@Component
@RequiredArgsConstructor
@Slf4j
public class OrderNotificationListener {

    private final EmailService emailService;
    private final OrderRepository orderRepo;

    /**
     * ✅ BEST PRACTICE: @Async + @TransactionalEventListener(AFTER_COMMIT)
     * - Does not block the main transaction.
     * - Only runs if the order was ACTUALLY saved to the DB.
     */
    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void sendOrderConfirmationEmail(OrderCreatedEvent event) {
        log.info("Async processing confirmation email for order {}", event.orderId());
        
        // Note: Because this runs AFTER_COMMIT and in a new thread (@Async),
        // we are outside the original transaction. If we need to fetch data,
        // we must start a new transaction.
        emailService.sendConfirmation(event.customerEmail(), event.orderId());
    }

    /**
     * BEFORE_COMMIT: Runs in the SAME thread, BEFORE the transaction commits.
     * Useful for synchronous auditing or modifying data before commit.
     * ⚠️ WARNING: If this throws an exception, the entire transaction ROLLS BACK.
     */
    @TransactionalEventListener(phase = TransactionPhase.BEFORE_COMMIT)
    public void auditOrderCreation(OrderCreatedEvent event) {
        log.info("Sync auditing order {} before commit", event.orderId());
        // Do local auditing
    }

    /**
     * AFTER_ROLLBACK: Useful for cleanup or alerting.
     */
    @TransactionalEventListener(phase = TransactionPhase.AFTER_ROLLBACK)
    public void alertOnOrderFailure(OrderCreatedEvent event) {
        log.warn("Order TX rolled back! Order {} was NOT created.", event.orderId());
    }
}
```

### The "Stale Data" Trap in AFTER_COMMIT
When a listener runs `AFTER_COMMIT` without `@Async`, it runs in the original thread, but the original transaction has committed and is **closed**.
If the listener tries to lazily load a Hibernate collection, it will throw `LazyInitializationException`.
**Fix**: Pass all required data inside the Event object itself (as done with the `OrderCreatedEvent` record above), or open a `@Transactional(propagation = Propagation.REQUIRES_NEW)` in the listener to fetch data freshly.

---

## 🧪 Verification Commands

```powershell
# Watch application logs to observe thread names and timing:
# 1. Main thread [http-nio-8080-exec-1] saves order
# 2. Main thread publishes event
# 3. Main thread commits transaction
# 4. Async thread [virtual-thread-X] executes sendOrderConfirmationEmail

# Trigger the flow:
$body = @{ userId = "123e4567-e89b-12d3-a456-426614174000"; amount = 99.99; email = "test@example.com" } | ConvertTo-Json
Invoke-RestMethod -Method POST -Uri "http://localhost:8080/api/v1/orders" `
    -ContentType "application/json" -Body $body
```

---

## ⚡ Best Practices & Anti-Patterns

### ✅ Best Practices
1. **Combine `@Async` + `@TransactionalEventListener(AFTER_COMMIT)`** for side-effects (emails, push notifications, calling external APIs).
2. **Use Immutable Records for Events** to prevent accidental modification of state by listeners.
3. **Configure `AsyncUncaughtExceptionHandler`** to prevent silent failures in background threads.

### ❌ Anti-Patterns

| Anti-Pattern | Problem | Fix |
|-------------|---------|-----|
| Standard `@EventListener` for side-effects inside TX | Email sends, but TX rolls back → Phantom email | Use `@TransactionalEventListener` |
| Calling `@Async` method from same class | Proxy is bypassed, runs synchronously | Move `@Async` method to a separate `@Component` |
| Passing raw JPA Entities in Events | `LazyInitializationException` in async thread | Pass raw IDs and flattened data via Records |
| Throwing Exception in `AFTER_COMMIT` sync listener | TX is already committed; exception is swallowed or corrupts thread state | Use `@Async` or handle explicitly |
