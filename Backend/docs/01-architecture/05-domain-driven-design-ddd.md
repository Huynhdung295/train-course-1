# 🎯 Domain-Driven Design (DDD) with Spring Boot

> **Category**: Architecture Patterns | **Complexity**: Expert | **Java**: 21+ | **Spring Boot**: 3.3+

---

## 📖 Core Technical Mechanics & Deep-Dive

### DDD Strategic Design

**Domain-Driven Design** aligns software structure with business domain structure. It operates at two levels:

**Strategic DDD** — How to divide a large domain into manageable parts:
- **Bounded Contexts** — Explicit boundary within which a domain model applies
- **Ubiquitous Language** — Shared vocabulary between developers and domain experts
- **Context Map** — How bounded contexts relate to each other

**Tactical DDD** — How to model a single bounded context:
- **Entities** — Objects with identity that persists over time
- **Value Objects** — Immutable, defined by their attributes
- **Aggregates** — Consistency boundary; only one entity per aggregate is the "root"
- **Domain Events** — Facts that something happened in the domain
- **Repositories** — Persistence abstraction for aggregates
- **Domain Services** — Operations that don't belong to a single entity
- **Application Services** — Orchestrate use cases using domain objects

### Bounded Context Decomposition

```
E-Commerce Platform — Strategic Design
═══════════════════════════════════════

┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  ORDER CONTEXT  │    │ CATALOG CONTEXT  │    │ IDENTITY CONTEXT│
│                 │    │                  │    │                  │
│ Order           │    │ Product          │    │ User            │
│ OrderLine       │    │ Category         │    │ Role            │
│ OrderStatus     │    │ Price            │    │ Permission      │
│ DeliveryAddress │    │ Inventory        │    │ Session         │
│                 │    │                  │    │                  │
│ Customer (stub) │    │ Customer (none)  │    │ Customer =User  │
└────────┬────────┘    └────────┬─────────┘    └────────┬────────┘
         │ Conformist/ACL       │ Published               │ Upstream
         │                      │ Language               │
         ▼                      ▼                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SHARED KERNEL                                  │
│              Money, CustomerId, ProductId, Email                  │
└─────────────────────────────────────────────────────────────────┘
```

**Key insight**: "Customer" means different things in different contexts:
- **Order Context**: Customer = shipping address + payment method
- **Identity Context**: Customer = User with credentials
- **Marketing Context**: Customer = demographic profile

These are **different models** for different purposes — DDD embraces this.

---

## 🌐 Real-World GitHub Patterns & Industry Reference

### Reference Projects
- **[ddd-by-examples/library](https://github.com/ddd-by-examples/library)** — The definitive Spring Boot DDD example (Polish DDD community)
- **[citerus/dddsample-core](https://github.com/citerus/dddsample-core)** — Cargo tracking from Eric Evans' DDD book, implemented in Java
- **[eventuate-tram examples](https://github.com/eventuate-tram)** — Microservices DDD with events
- **[VaughnVernon/IDDD_Samples](https://github.com/VaughnVernon/IDDD_Samples)** — Vaughn Vernon's "Implementing Domain-Driven Design" code samples

### Industry Standard: Aggregate Design Rules (Vernon's Rules)

1. **Design small aggregates** — An aggregate should be small enough to fit in memory easily
2. **Reference by ID only** — Aggregates reference other aggregates by ID, never by object reference
3. **Only modify one aggregate per transaction** — If you need to update two aggregates, use domain events
4. **Eventual consistency between aggregates** — `Order` doesn't directly modify `Inventory`; it publishes `OrderPlacedEvent`

---

## 🏷️ Framework Annotations, Components & Dependencies

### Maven Dependencies

```xml
<!-- MapStruct for mapping between domain and infrastructure -->
<dependency>
    <groupId>org.mapstruct</groupId>
    <artifactId>mapstruct</artifactId>
    <version>1.5.5.Final</version>
</dependency>

<!-- Spring Context for ApplicationEventPublisher -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-web</artifactId>
</dependency>

<!-- Spring Data JPA for Repository implementations -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-data-jpa</artifactId>
</dependency>

<!-- jMolecules: DDD annotations for Spring -->
<dependency>
    <groupId>org.jmolecules</groupId>
    <artifactId>jmolecules-ddd</artifactId>
    <version>1.8.0</version>
</dependency>
<dependency>
    <groupId>org.jmolecules.integrations</groupId>
    <artifactId>jmolecules-spring</artifactId>
    <version>0.19.0</version>
</dependency>
```

---

## ⚙️ Production Configuration & Tuning Parameters

```yaml
spring:
  jpa:
    open-in-view: false   # MANDATORY for DDD — prevents lazy loading across layers
    hibernate:
      ddl-auto: validate  # Flyway manages schema, not Hibernate
    properties:
      hibernate:
        # Optimize aggregate loading
        default_batch_fetch_size: 25
        jdbc.batch_size: 50
        order_inserts: true
        order_updates: true
        # Enable statistics in dev for query analysis
        generate_statistics: false   # true in dev only

  # Domain event async processing
  task:
    execution:
      pool:
        core-size: 5
        max-size: 20
        thread-name-prefix: domain-events-
```

---

## 📐 System Design Blueprint & Architecture Patterns

### Complete DDD Tactical Implementation

```java
// ═══════════════════════════════════════════════════
// VALUE OBJECTS — Immutable, defined by attributes
// ═══════════════════════════════════════════════════

// Strongly-typed IDs (prevent primitive obsession)
public record OrderId(UUID value) {
    public static OrderId generate() { return new OrderId(UUID.randomUUID()); }
    public static OrderId of(String value) { return new OrderId(UUID.fromString(value)); }
    public static OrderId of(UUID value) { return new OrderId(value); }

    @Override
    public String toString() { return value.toString(); }
}

public record Money(BigDecimal amount, Currency currency) {

    public static Money of(double amount) {
        return new Money(BigDecimal.valueOf(amount), Currency.getInstance("USD"));
    }

    public static Money of(BigDecimal amount, String currency) {
        return new Money(amount, Currency.getInstance(currency));
    }

    public Money add(Money other) {
        if (!this.currency.equals(other.currency)) {
            throw new CurrencyMismatchException(this.currency, other.currency);
        }
        return new Money(this.amount.add(other.amount), this.currency);
    }

    public Money multiply(int quantity) {
        return new Money(this.amount.multiply(BigDecimal.valueOf(quantity)), this.currency);
    }

    public boolean isGreaterThan(Money other) {
        return this.amount.compareTo(other.amount) > 0;
    }

    public static final Money ZERO = Money.of(0.0);
}

public record Address(
    String street,
    String city,
    String state,
    String postalCode,
    String countryCode
) {
    // Self-validating value object
    public Address {
        Objects.requireNonNull(street, "Street is required");
        Objects.requireNonNull(city, "City is required");
        Objects.requireNonNull(countryCode, "Country code is required");
        if (countryCode.length() != 2) {
            throw new IllegalArgumentException("Country code must be ISO 3166-1 alpha-2");
        }
    }

    public String format() {
        return "%s, %s, %s %s, %s".formatted(street, city, state, postalCode, countryCode);
    }
}

// ═══════════════════════════════════════════════════
// DOMAIN EVENTS
// ═══════════════════════════════════════════════════

public sealed interface OrderDomainEvent permits
    OrderPlacedEvent, OrderConfirmedEvent, OrderCancelledEvent, OrderShippedEvent {

    OrderId orderId();
    Instant occurredAt();
}

public record OrderPlacedEvent(
    OrderId orderId,
    CustomerId customerId,
    List<OrderLine> lines,
    Money totalAmount,
    Instant occurredAt
) implements OrderDomainEvent {}

public record OrderCancelledEvent(
    OrderId orderId,
    String reason,
    Instant occurredAt
) implements OrderDomainEvent {}

// ═══════════════════════════════════════════════════
// AGGREGATE ROOT — Order
// ═══════════════════════════════════════════════════

public class Order {

    private final OrderId id;
    private final CustomerId customerId;
    private OrderStatus status;
    private final List<OrderLine> lines;
    private Address shippingAddress;
    private final Instant placedAt;
    private Instant confirmedAt;
    private Instant cancelledAt;
    private String cancellationReason;

    // Domain events accumulated during the aggregate's lifecycle
    private final List<OrderDomainEvent> domainEvents = new ArrayList<>();

    // ── Factory method ────────────────────────────────────
    public static Order place(CustomerId customerId, List<OrderLine> lines, Address shippingAddress) {
        if (lines.isEmpty()) {
            throw new EmptyOrderException();
        }
        if (lines.size() > 50) {
            throw new OrderLineExceededException(50, lines.size());
        }

        var order = new Order(
            OrderId.generate(),
            customerId,
            OrderStatus.PENDING,
            new ArrayList<>(lines),
            shippingAddress,
            Instant.now()
        );

        // Record domain event
        order.domainEvents.add(new OrderPlacedEvent(
            order.id, customerId, List.copyOf(lines),
            order.calculateTotal(), Instant.now()
        ));

        return order;
    }

    // ── Business methods ──────────────────────────────────
    public void confirm() {
        if (status != OrderStatus.PENDING) {
            throw new InvalidOrderStateTransitionException(id, status, OrderStatus.CONFIRMED);
        }
        this.status = OrderStatus.CONFIRMED;
        this.confirmedAt = Instant.now();
        domainEvents.add(new OrderConfirmedEvent(id, confirmedAt));
    }

    public void cancel(String reason) {
        if (status == OrderStatus.SHIPPED || status == OrderStatus.DELIVERED) {
            throw new CannotCancelShippedOrderException(id);
        }
        this.status = OrderStatus.CANCELLED;
        this.cancellationReason = reason;
        this.cancelledAt = Instant.now();
        domainEvents.add(new OrderCancelledEvent(id, reason, cancelledAt));
    }

    public void updateShippingAddress(Address newAddress) {
        if (status != OrderStatus.PENDING) {
            throw new CannotModifyConfirmedOrderException(id);
        }
        this.shippingAddress = newAddress;
    }

    // ── Domain queries ────────────────────────────────────
    public Money calculateTotal() {
        return lines.stream()
            .map(line -> line.unitPrice().multiply(line.quantity()))
            .reduce(Money.ZERO, Money::add);
    }

    public boolean isEligibleForReturn() {
        return status == OrderStatus.DELIVERED &&
            Duration.between(confirmedAt, Instant.now()).toDays() <= 30;
    }

    // ── Event management ──────────────────────────────────
    public List<OrderDomainEvent> pullDomainEvents() {
        var events = List.copyOf(domainEvents);
        domainEvents.clear();
        return events;
    }

    // Getters (no setters — state changes only through business methods)
    public OrderId getId() { return id; }
    public CustomerId getCustomerId() { return customerId; }
    public OrderStatus getStatus() { return status; }
    public List<OrderLine> getLines() { return Collections.unmodifiableList(lines); }
}

// ═══════════════════════════════════════════════════
// DOMAIN SERVICE — Logic spanning multiple aggregates
// ═══════════════════════════════════════════════════

@Service   // Domain service — can have Spring annotation but no infra deps
public class OrderPricingService {

    public Money calculateFinalPrice(Order order, DiscountPolicy discountPolicy) {
        var baseTotal = order.calculateTotal();
        var discount = discountPolicy.calculate(baseTotal, order.getCustomerId());
        return baseTotal.subtract(discount);
    }
}

// ═══════════════════════════════════════════════════
// REPOSITORY PORT — Domain-defined persistence contract
// ═══════════════════════════════════════════════════

public interface OrderRepository {
    void save(Order order);
    Optional<Order> findById(OrderId id);
    List<Order> findByCustomerId(CustomerId customerId);
    List<Order> findPendingOrdersOlderThan(Duration age);
}

// ═══════════════════════════════════════════════════
// APPLICATION SERVICE — Use case orchestration
// ═══════════════════════════════════════════════════

@Service
@Transactional
@RequiredArgsConstructor
@Slf4j
public class OrderApplicationService {

    private final OrderRepository orderRepository;        // Port
    private final CustomerRepository customerRepository;  // Port
    private final OrderPricingService pricingService;     // Domain service
    private final ApplicationEventPublisher eventPublisher;

    public OrderId placeOrder(PlaceOrderCommand cmd) {
        // Validate customer exists
        var customer = customerRepository.findById(cmd.customerId())
            .orElseThrow(() -> new CustomerNotFoundException(cmd.customerId()));

        // Build domain objects
        var lines = cmd.items().stream()
            .map(item -> new OrderLine(item.productId(), item.quantity(), item.unitPrice()))
            .toList();

        var address = new Address(
            cmd.street(), cmd.city(), cmd.state(),
            cmd.postalCode(), cmd.countryCode()
        );

        // Execute domain logic
        var order = Order.place(customer.getId(), lines, address);

        // Persist
        orderRepository.save(order);

        // Publish domain events (after successful persistence)
        order.pullDomainEvents().forEach(eventPublisher::publishEvent);

        log.info("Order {} placed successfully", order.getId());
        return order.getId();
    }

    public void cancelOrder(CancelOrderCommand cmd) {
        var order = orderRepository.findById(cmd.orderId())
            .orElseThrow(() -> new OrderNotFoundException(cmd.orderId()));

        order.cancel(cmd.reason());
        orderRepository.save(order);
        order.pullDomainEvents().forEach(eventPublisher::publishEvent);
    }
}
```

---

## 🧪 Verification, Testing & Infrastructure Commands

### Domain Layer Unit Tests (No Spring Context Needed)

```java
// These tests are FAST — no Spring, no DB, pure domain logic
class OrderTest {

    @Test
    void shouldCalculateTotalCorrectly() {
        var lines = List.of(
            new OrderLine(ProductId.of("p1"), 2, Money.of(10.00)),
            new OrderLine(ProductId.of("p2"), 3, Money.of(5.00))
        );
        var order = Order.place(CustomerId.of("c1"), lines, validAddress());

        assertThat(order.calculateTotal()).isEqualTo(Money.of(35.00));
    }

    @Test
    void shouldPublishOrderPlacedEventWhenPlaced() {
        var order = Order.place(CustomerId.of("c1"), validLines(), validAddress());
        var events = order.pullDomainEvents();

        assertThat(events).hasSize(1);
        assertThat(events.get(0)).isInstanceOf(OrderPlacedEvent.class);
    }

    @Test
    void shouldNotCancelShippedOrder() {
        var order = Order.place(CustomerId.of("c1"), validLines(), validAddress());
        order.confirm();
        order.ship();

        assertThatThrownBy(() -> order.cancel("customer request"))
            .isInstanceOf(CannotCancelShippedOrderException.class);
    }

    @Test
    void shouldRejectOrderWithNoLines() {
        assertThatThrownBy(() -> Order.place(CustomerId.of("c1"), List.of(), validAddress()))
            .isInstanceOf(EmptyOrderException.class);
    }
}
```

---

## ⚡ Senior Best Practices & Critical Anti-Patterns

### ✅ Best Practices

1. **Protect invariants in the aggregate** — Never allow external code to put an aggregate in an invalid state. ALL state changes go through aggregate methods.

2. **Use `sealed` interfaces for domain events** — Java 21's sealed interfaces make event handling exhaustive:
   ```java
   switch (event) {
       case OrderPlacedEvent e -> handlePlaced(e);
       case OrderConfirmedEvent e -> handleConfirmed(e);
       case OrderCancelledEvent e -> handleCancelled(e);
   }
   ```

3. **Ubiquitous Language in code** — Method names should mirror business speech: `order.confirm()` not `order.setStatus(CONFIRMED)`.

4. **One aggregate per transaction** — If you find yourself saving two aggregates in one transaction, that's a signal you need a domain event.

5. **Validate in the domain** — Business rule violations throw domain exceptions (`InsufficientStockException`, `InvalidOrderStateTransitionException`), not generic `IllegalArgumentException`.

### ❌ Critical Anti-Patterns

| Anti-Pattern | Problem | Fix |
|-------------|---------|-----|
| **Anemic Domain Model** | `Order` has only getters/setters; logic in `OrderService` | Move `confirm()`, `cancel()`, `ship()` INTO `Order` |
| **Primitive Obsession** | Using `String orderId` everywhere | Use `OrderId`, `CustomerId` value objects |
| **Cross-aggregate object reference** | `Order` holds reference to `Product` object | `Order` holds only `ProductId`; app service loads `Product` separately |
| **Domain importing Spring** | `@Component` on `Order` aggregate | Domain layer = pure Java; infrastructure layer implements ports |
| **Repository returning JPA entities to controller** | Controller receives `OrderJpaEntity` with Hibernate proxies | Always map to DTOs/response records before returning from app service |
| **God aggregate** | One `Order` aggregate with 50 fields and methods | Split by subdomain: `Order`, `Shipment`, `Invoice` are separate aggregates |

---

*Previous: [04-cqrs-pattern-spring-kafka.md](./04-cqrs-pattern-spring-kafka.md) | Next: [06-api-gateway-service-mesh.md](./06-api-gateway-service-mesh.md)*
