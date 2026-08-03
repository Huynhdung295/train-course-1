# 🧩 Modular Monolith with Spring Modulith

> **Category**: Architecture Patterns | **Complexity**: Advanced | **Java**: 21+ | **Spring Boot**: 3.3+ | **Spring Modulith**: 1.2+

---

## 📖 Core Technical Mechanics & Deep-Dive

### Why Modular Monolith?

The **Modular Monolith** is the architectural sweet spot between a Big Ball of Mud monolith and a premature microservices decomposition. It provides:
- **Team scalability** — Teams own modules with enforced boundaries
- **Deployment simplicity** — Single deployable unit
- **Migration path** — Extract module to microservice when justified by actual load data
- **Testability** — Module interactions are local method calls, not network calls

**Spring Modulith** (GA since Spring Boot 3.1) is the official Spring implementation that enforces module boundaries at the **application level** via package conventions, and provides tooling for documentation, testing, and observability.

### How Spring Modulith Works Internally

Spring Modulith scans your application's packages and treats **direct subpackages of the root package** as application modules. It enforces that:
1. The module's **internal packages** (`internal/`) are not accessible from other modules
2. Modules can only communicate via:
   - **Public APIs** (interfaces/classes in the module root package)
   - **Spring Application Events** (for loose coupling)
   - **Shared kernel** (common module accessible to all)

```
com.company.app                          ← Root package
├── order/                               ← Module: order
│   ├── OrderModule.java                 ← Public API surface (optional)
│   ├── OrderManagement.java             ← Public service interface
│   ├── OrderCreatedEvent.java           ← Public event
│   └── internal/                        ← PRIVATE — inaccessible from outside
│       ├── OrderEntity.java
│       ├── OrderRepository.java
│       ├── OrderService.java
│       └── OrderController.java
├── inventory/                           ← Module: inventory
│   ├── InventoryManagement.java         ← Public interface
│   └── internal/
│       └── ...
├── payment/                             ← Module: payment
│   └── ...
└── shared/                              ← Shared Kernel (accessible to all)
    ├── Money.java
    └── CustomerId.java
```

### Module Bootstrap Lifecycle

When Spring Boot starts with Spring Modulith:
1. `ApplicationModules.of(App.class)` is invoked
2. Classpath is scanned for module packages
3. Dependency graph is verified (no cycles, no internal access)
4. Module metadata is computed for documentation generation
5. Normal Spring context startup proceeds

---

## 🌐 Real-World GitHub Patterns & Industry Reference

### Reference Projects
- **[spring-projects-experimental/spring-modulith](https://github.com/spring-projects/spring-modulith)** — Official Spring Modulith with sample application
- **[odrotbohm/sos](https://github.com/odrotbohm/sos)** — Oliver Drotbohm's (Modulith lead) sample application "Starbucks on Spring"
- **[e-commerce-microservices → modulith pattern](https://github.com/chrisgleissner/microservice)** — Real migration example from microservices back to modular monolith

### Industry Pattern: Event-Based Module Communication

The recommended pattern for inter-module communication in Spring Modulith is **domain events via Spring's `ApplicationEventPublisher`**:

```java
// In Order module — publishes event after successful order placement
@Service
@Transactional
@RequiredArgsConstructor
class OrderService implements OrderManagement {

    private final OrderRepository orderRepo;
    private final ApplicationEventPublisher events;

    @Override
    public Order place(PlaceOrderCommand cmd) {
        var order = Order.create(cmd);
        orderRepo.save(order);

        // Publish domain event — Inventory module listens
        events.publishEvent(new OrderPlacedEvent(order.getId(), order.getItems()));
        return order;
    }
}
```

```java
// In Inventory module — listens to Order module's event WITHOUT importing internals
@Component
@RequiredArgsConstructor
class InventoryReservationListener {

    private final InventoryManagement inventory;

    @ApplicationModuleListener   // Spring Modulith annotation = @Async + @Transactional + @EventListener
    void on(OrderPlacedEvent event) {
        event.items().forEach(item ->
            inventory.reserve(item.productId(), item.quantity())
        );
    }
}
```

---

## 🏷️ Framework Annotations, Components & Dependencies

### Maven Dependencies

```xml
<dependencyManagement>
    <dependencies>
        <dependency>
            <groupId>org.springframework.modulith</groupId>
            <artifactId>spring-modulith-bom</artifactId>
            <version>1.2.2</version>
            <type>pom</type>
            <scope>import</scope>
        </dependency>
    </dependencies>
</dependencyManagement>

<dependencies>
    <!-- Core Modulith runtime -->
    <dependency>
        <groupId>org.springframework.modulith</groupId>
        <artifactId>spring-modulith-starter-core</artifactId>
    </dependency>

    <!-- Modulith with JPA (Outbox support) -->
    <dependency>
        <groupId>org.springframework.modulith</groupId>
        <artifactId>spring-modulith-starter-jpa</artifactId>
    </dependency>

    <!-- Actuator endpoint for module metadata -->
    <dependency>
        <groupId>org.springframework.modulith</groupId>
        <artifactId>spring-modulith-actuator</artifactId>
        <optional>true</optional>
    </dependency>

    <!-- Observability: module spans in traces -->
    <dependency>
        <groupId>org.springframework.modulith</groupId>
        <artifactId>spring-modulith-observability</artifactId>
    </dependency>

    <!-- Testing support -->
    <dependency>
        <groupId>org.springframework.modulith</groupId>
        <artifactId>spring-modulith-starter-test</artifactId>
        <scope>test</scope>
    </dependency>
</dependencies>
```

### Spring Modulith Annotations

| Annotation | Package | Purpose |
|-----------|---------|---------|
| `@ApplicationModule` | `o.s.modulith.core` | Explicitly names a module (optional) |
| `@ApplicationModuleListener` | `o.s.modulith.events` | Combined `@EventListener` + `@Async` + `@Transactional` |
| `@ApplicationModule(allowedDependencies = {...})` | - | Whitelist which modules this module can access |
| `@NamedInterface` | `o.s.modulith.core` | Expose a subpackage as named interface |
| `@Sharedkernel` | `o.s.modulith.core` | Mark a package accessible to all modules |

---

## ⚙️ Production Configuration & Tuning Parameters

### application.yml

```yaml
spring:
  modulith:
    # Publish events to the application_module_event_publication table
    # Enables reliable event delivery with retry
    events:
      jdbc:
        schema-initialization:
          enabled: true      # Let Modulith create its outbox table

  # Async executor for @ApplicationModuleListener
  task:
    execution:
      pool:
        core-size: 10
        max-size: 50
        queue-capacity: 100
        thread-name-prefix: modulith-async-

# Actuator: expose modulith endpoint
management:
  endpoints:
    web:
      exposure:
        include: health, info, modulith, metrics
```

### Event Persistence Strategy

Spring Modulith supports **durable event publication** — events are written to a DB table **within the same transaction** as the business data, then asynchronously dispatched. This prevents event loss on application crash.

```yaml
# Enable event publication persistence (critical for production)
spring:
  modulith:
    republish-outstanding-events-on-restart: true  # Replay undelivered events on startup
```

---

## 📐 System Design Blueprint & Architecture Patterns

### Module Interaction Patterns

```
┌─────────────────┐      Domain Event      ┌────────────────────┐
│  ORDER MODULE   │ ─────────────────────► │  INVENTORY MODULE  │
│                 │   OrderPlacedEvent     │                    │
│ Public API:     │                        │ Public API:        │
│ OrderManagement │                        │ InventoryManagement│
│                 │      Domain Event      │                    │
│                 │ ◄─────────────────────│                    │
│                 │  InventoryReservedEvent│                    │
└─────────────────┘                        └────────────────────┘
        │                                          │
        │         Direct Dependency (allowed)      │
        ▼                                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    SHARED KERNEL                             │
│          Money, CustomerId, ProductId, Address              │
└─────────────────────────────────────────────────────────────┘
```

### Complete Module Structure

```java
// 1. Module public API interface (in module root package)
package com.company.app.order;

public interface OrderManagement {
    Order place(PlaceOrderCommand cmd);
    Optional<Order> findById(OrderId id);
    void cancel(OrderId id);
}

// 2. Module event (public - in module root package)
package com.company.app.order;

public record OrderPlacedEvent(
    OrderId orderId,
    List<OrderItem> items,
    CustomerId customerId,
    Instant occurredAt
) {}

// 3. Named interfaces for sub-packages (when needed)
@NamedInterface("reporting")
package com.company.app.order.reporting;   // package-info.java

// 4. Module metadata declaration (optional explicit naming)
@ApplicationModule(
    displayName = "Order Management",
    allowedDependencies = { "inventory", "payment", "shared" }
)
package com.company.app.order;             // package-info.java

// 5. Spring Boot main application
@SpringBootApplication
public class ECommerceApplication {
    public static void main(String[] args) {
        SpringApplication.run(ECommerceApplication.class, args);
    }
}
```

### Durable Event Publication Flow

```
Business Transaction
    ├── Save Order to orders table
    ├── Save event to event_publication table (same TX)
    └── TX commits

After TX commit:
    ├── @ApplicationModuleListener fires asynchronously
    ├── Inventory reserves stock
    └── Event marked COMPLETED in event_publication table

On Failure:
    ├── Event stays in INCOMPLETE state
    └── On restart: republish-outstanding-events-on-restart replays it
```

---

## 🧪 Verification, Testing & Infrastructure Commands

### Module Structure Verification Tests

```java
@SpringBootTest
class ModularityTests {

    ApplicationModules modules = ApplicationModules.of(ECommerceApplication.class);

    @Test
    void verifyModularStructure() {
        // Verifies: no cycles, no internal access, allowed deps respected
        modules.verify();
    }

    @Test
    void generateModuleDocumentation() {
        new Documenter(modules)
            .writeModulesAsPlantUml()         // generates UML diagram
            .writeIndividualModulesAsPlantUml()
            .writeAggregatingDocument();       // combined documentation
    }

    @Test
    void displayModuleInformation() {
        modules.forEach(System.out::println);
    }
}
```

### Integration Slice Testing (Module in Isolation)

```java
@ApplicationModuleTest   // ← Only loads beans from THIS module
class OrderModuleTests {

    @Autowired
    OrderManagement orderManagement;

    @MockitoBean   // Mock external module dependencies
    InventoryManagement inventoryManagement;

    @Test
    void placeOrderPublishesDomainEvent(PublishedEvents events) {
        var cmd = new PlaceOrderCommand(
            CustomerId.of("cust-1"),
            List.of(new OrderItem(ProductId.of("prod-1"), 2, Money.of(29.99)))
        );

        orderManagement.place(cmd);

        // Assert event was published
        var orderPlaced = events.ofType(OrderPlacedEvent.class)
            .matching(e -> e.customerId().equals(CustomerId.of("cust-1")));
        assertThat(orderPlaced).hasSize(1);
    }
}
```

### PowerShell Commands

```powershell
# Run only modularity verification tests
./mvnw test -Dtest=ModularityTests

# Check actuator module endpoint
Invoke-RestMethod -Uri "http://localhost:8080/actuator/modulith" | ConvertTo-Json -Depth 5

# View generated PlantUML diagrams (after running generateModuleDocumentation)
ls target/generated-docs/*.uml
```

---

## ⚡ Senior Best Practices & Critical Anti-Patterns

### ✅ Best Practices

1. **Start with the `internal/` convention from day 1** — Retrofitting module boundaries is expensive. Enforce packaging from the first commit.

2. **Prefer events over direct calls for state-changing cross-module operations** — Reduces coupling and enables independent module evolution.

3. **Use `@ApplicationModuleTest` for every module** — These tests boot only the relevant slice, making them 3-5x faster than full `@SpringBootTest`.

4. **Keep the shared kernel minimal** — Only truly ubiquitous concepts (`Money`, `CustomerId`) belong there. Module-specific concepts should stay in their module.

5. **Use durable events in production** — Always configure `spring.modulith.events.jdbc` for production. Volatile (in-memory) events are lost on crash.

6. **Generate documentation as part of CI** — Run `Documenter.writeModulesAsPlantUml()` in tests; check generated `.uml` files into source control as living architecture documentation.

### ❌ Critical Anti-Patterns

| Anti-Pattern | Problem | Fix |
|-------------|---------|-----|
| **Bypassing modules via `internal/` access** | Breaks encapsulation; `modules.verify()` will fail as a CI-breaking test | Keep all cross-module access through public APIs or events |
| **Circular module dependencies** | A→B→A creates tight coupling | Introduce a shared event or an `anti-corruption` module |
| **Using `@EventListener` instead of `@ApplicationModuleListener`** | Synchronous execution blocks the publishing transaction; event loss on failure | Always use `@ApplicationModuleListener` for cross-module events |
| **Too many modules** | 20+ modules = premature decomposition; better off as microservices | Aim for 5-10 domain-aligned modules in a monolith |
| **Shared database tables between modules** | Schema coupling prevents module extraction | Each module owns its tables; cross-module data access is via API or events only |
| **Module that depends on everything** | Utility module becomes a "god" module | Split utilities by domain concern; restrict allowedDependencies |

### 🔄 Migration Path: Modulith → Microservices

When a module needs to be extracted:
1. The module already has a clean public API — this becomes the **service interface**
2. Replace `ApplicationEventPublisher` calls with **Kafka/RabbitMQ** producers
3. Replace `@ApplicationModuleListener` with **message consumers**
4. Replace internal calls with **REST/gRPC** client to new service
5. Move module's database tables to the **new service's database**

The modular monolith makes this migration **surgical** rather than a full rewrite.

---

*Previous: [01-clean-hexagonal-architecture.md](./01-clean-hexagonal-architecture.md) | Next: [03-event-driven-microservices-saga.md](./03-event-driven-microservices-saga.md)*
