# 🏛️ Clean / Hexagonal Architecture in Spring Boot 3+

> **Category**: Architecture Patterns | **Complexity**: Advanced | **Java**: 21+ | **Spring Boot**: 3.3+

---

## 📖 Core Technical Mechanics & Deep-Dive

### The Conceptual Foundation

**Hexagonal Architecture** (also called **Ports & Adapters**, coined by Alistair Cockburn) and **Clean Architecture** (Robert C. Martin) share a fundamental axiom: **the domain model must have zero dependencies on infrastructure frameworks**. This is enforced through a strict **Dependency Inversion** — all outer layers depend inward; the domain core depends on nothing external.

```
┌─────────────────────────────────────────────────────────────┐
│                    OUTER WORLD                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              INFRASTRUCTURE LAYER                    │   │
│  │  (Spring MVC Controllers, JPA Repos, Kafka, REST)   │   │
│  │  ┌───────────────────────────────────────────────┐  │   │
│  │  │           APPLICATION LAYER                    │  │   │
│  │  │    (Use Cases / Application Services)          │  │   │
│  │  │  ┌─────────────────────────────────────────┐  │  │   │
│  │  │  │         DOMAIN LAYER (CORE)              │  │  │   │
│  │  │  │  Entities, Aggregates, Domain Services,  │  │  │   │
│  │  │  │  Value Objects, Domain Events, Ports     │  │  │   │
│  │  │  └─────────────────────────────────────────┘  │  │   │
│  │  └───────────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘

Dependency Rule: All arrows point INWARD only.
```

### The Three Layers Explained

#### 1. Domain Layer (The Core — Zero Dependencies)
The innermost ring. Contains:
- **Entities** — Objects with identity (`OrderId`, `UserId`)
- **Value Objects** — Immutable, identity-less objects (`Money`, `Address`, `Email`)
- **Aggregates** — Consistency boundaries; the root is the only entry point
- **Domain Services** — Logic that doesn't belong to a single entity
- **Domain Events** — Things that happened in the domain
- **Ports (Interfaces)** — Abstract contracts that the domain defines but infrastructure implements

```java
// Pure domain entity — NO Spring annotations, NO JPA, NO framework imports
public class Order {
    private final OrderId id;
    private final CustomerId customerId;
    private OrderStatus status;
    private final List<OrderLine> lines;
    private final List<DomainEvent> domainEvents = new ArrayList<>();

    public static Order create(CustomerId customerId, List<OrderLine> lines) {
        var order = new Order(OrderId.generate(), customerId, OrderStatus.PENDING, lines);
        order.domainEvents.add(new OrderCreatedEvent(order.id, customerId));
        return order;
    }

    public void confirm() {
        if (this.status != OrderStatus.PENDING) {
            throw new OrderAlreadyProcessedException(this.id);
        }
        this.status = OrderStatus.CONFIRMED;
        this.domainEvents.add(new OrderConfirmedEvent(this.id));
    }

    public List<DomainEvent> pullDomainEvents() {
        var events = List.copyOf(this.domainEvents);
        this.domainEvents.clear();
        return events;
    }
}
```

```java
// Port — Interface defined BY the domain, implemented BY infrastructure
public interface OrderRepository {                    // OUTPUT PORT
    void save(Order order);
    Optional<Order> findById(OrderId id);
    List<Order> findByCustomer(CustomerId customerId);
}

public interface PaymentGateway {                    // OUTPUT PORT
    PaymentResult charge(CustomerId customerId, Money amount);
}

public interface OrderUseCase {                      // INPUT PORT
    OrderId placeOrder(PlaceOrderCommand command);
    void confirmOrder(ConfirmOrderCommand command);
}
```

#### 2. Application Layer (Use Cases — Orchestration)
Coordinates domain objects to fulfill use cases. Depends only on the domain layer. Annotated with `@Service` but **never exposes JPA entities** to controllers.

```java
@Service
@Transactional
@RequiredArgsConstructor
public class OrderApplicationService implements OrderUseCase {

    private final OrderRepository orderRepository;     // Injected PORT
    private final PaymentGateway paymentGateway;       // Injected PORT
    private final ApplicationEventPublisher eventPublisher;

    @Override
    public OrderId placeOrder(PlaceOrderCommand cmd) {
        // 1. Load or create domain objects
        var lines = cmd.items().stream()
            .map(item -> new OrderLine(item.productId(), item.quantity(), item.price()))
            .toList();

        // 2. Execute domain logic
        var order = Order.create(cmd.customerId(), lines);

        // 3. Coordinate with external ports
        var payment = paymentGateway.charge(cmd.customerId(), order.totalAmount());
        if (payment.failed()) {
            throw new PaymentFailedException(payment.reason());
        }

        // 4. Persist via domain port
        orderRepository.save(order);

        // 5. Publish domain events
        order.pullDomainEvents().forEach(eventPublisher::publishEvent);

        return order.getId();
    }
}
```

#### 3. Infrastructure Layer (Adapters — Framework Code)
Implements the ports using real frameworks. This is where Spring, JPA, Kafka, Redis live.

```java
// JPA Adapter implementing the domain's OrderRepository port
@Repository
@RequiredArgsConstructor
public class JpaOrderRepositoryAdapter implements OrderRepository {

    private final SpringDataOrderRepository jpaRepo;   // Spring Data JPA
    private final OrderMapper mapper;

    @Override
    public void save(Order order) {
        OrderJpaEntity entity = mapper.toEntity(order);
        jpaRepo.save(entity);
    }

    @Override
    public Optional<Order> findById(OrderId id) {
        return jpaRepo.findById(id.value())
            .map(mapper::toDomain);
    }
}

// REST Adapter (Controller) — Input Adapter
@RestController
@RequestMapping("/api/v1/orders")
@RequiredArgsConstructor
public class OrderController {

    private final OrderUseCase orderUseCase;   // Uses INPUT PORT, not service directly

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public OrderResponse placeOrder(@Valid @RequestBody PlaceOrderRequest request) {
        var command = PlaceOrderCommand.from(request);
        var orderId = orderUseCase.placeOrder(command);
        return new OrderResponse(orderId.value());
    }
}
```

### The Dependency Inversion Principle in Action

The key mechanism is **interface injection** through Spring's IoC container:

```
Domain defines:       OrderRepository (interface)
Infrastructure has:   JpaOrderRepositoryAdapter implements OrderRepository
Spring wires:         @Autowire finds JpaOrderRepositoryAdapter → injects into service

Result: Service only sees the interface. Domain never knows JPA exists.
```

---

## 🌐 Real-World GitHub Patterns & Industry Reference

### Reference Implementations
- **[thombergs/buckpal](https://github.com/thombergs/buckpal)** — The canonical Hexagonal Architecture example for Java, used in the book "Get Your Hands Dirty on Clean Architecture"
- **[hgraca/explicit-architecture-php](https://github.com/hgraca/explicit-architecture-php)** — Cross-language explicit architecture reference
- **[mkopylec/project-manager](https://github.com/mkopylec/project-manager)** — Modular monolith with hexagonal architecture in Spring Boot
- **Netflix DGS + Hexagonal** — Netflix uses ports-and-adapters for their GraphQL federation services

### Industry Pattern: Package Organization

Two dominant conventions in open-source Spring Boot projects:

#### Convention 1: Package by Layer (AVOID — violates encapsulation)
```
com.company.app
├── controller/   ← all controllers mixed together
├── service/      ← all services mixed together
├── repository/   ← all repos mixed
└── model/        ← all entities
```

#### Convention 2: Package by Feature + Layer (PREFERRED — used by buckpal, PiggyMetrics)
```
com.company.app
├── order/
│   ├── domain/
│   │   ├── Order.java
│   │   ├── OrderId.java
│   │   ├── OrderStatus.java
│   │   ├── OrderRepository.java          ← Port
│   │   └── events/OrderCreatedEvent.java
│   ├── application/
│   │   ├── OrderApplicationService.java
│   │   ├── port/
│   │   │   ├── in/OrderUseCase.java      ← Input Port
│   │   │   └── out/PaymentGateway.java   ← Output Port
│   │   └── command/PlaceOrderCommand.java
│   └── adapter/
│       ├── in/web/OrderController.java   ← Input Adapter
│       ├── out/persistence/
│       │   ├── JpaOrderRepositoryAdapter.java
│       │   ├── OrderJpaEntity.java
│       │   └── SpringDataOrderRepository.java
│       └── out/messaging/
│           └── KafkaOrderEventPublisher.java
├── payment/
│   └── ...
└── shared/
    └── domain/Money.java
```

### Real-World Pattern: Mapper Strategy (MapStruct)
```java
@Mapper(componentModel = "spring")
public interface OrderMapper {
    
    @Mapping(target = "customerId", expression = "java(entity.getCustomerId().toString())")
    OrderResponse toResponse(Order domain);
    
    @Mapping(target = "id", expression = "java(OrderId.of(entity.getId()))")
    Order toDomain(OrderJpaEntity entity);
    
    OrderJpaEntity toEntity(Order domain);
}
```

---

## 🏷️ Framework Annotations, Components & Dependencies

### Maven Dependencies (pom.xml)

```xml
<properties>
    <java.version>21</java.version>
    <spring-boot.version>3.3.2</spring-boot.version>
    <mapstruct.version>1.5.5.Final</mapstruct.version>
    <lombok.version>1.18.32</lombok.version>
</properties>

<dependencies>
    <!-- Spring Boot Core -->
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-web</artifactId>
    </dependency>
    
    <!-- Data (JPA Adapter) -->
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-data-jpa</artifactId>
    </dependency>
    
    <!-- Validation -->
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-validation</artifactId>
    </dependency>

    <!-- MapStruct for domain↔DTO mapping -->
    <dependency>
        <groupId>org.mapstruct</groupId>
        <artifactId>mapstruct</artifactId>
        <version>${mapstruct.version}</version>
    </dependency>
    <dependency>
        <groupId>org.mapstruct</groupId>
        <artifactId>mapstruct-processor</artifactId>
        <version>${mapstruct.version}</version>
        <scope>provided</scope>
    </dependency>
    
    <!-- Lombok -->
    <dependency>
        <groupId>org.projectlombok</groupId>
        <artifactId>lombok</artifactId>
        <optional>true</optional>
    </dependency>
</dependencies>

<!-- CRITICAL: annotation processor order matters -->
<build>
    <plugins>
        <plugin>
            <groupId>org.apache.maven.plugins</groupId>
            <artifactId>maven-compiler-plugin</artifactId>
            <configuration>
                <annotationProcessorPaths>
                    <!-- Lombok MUST come before MapStruct -->
                    <path>
                        <groupId>org.projectlombok</groupId>
                        <artifactId>lombok</artifactId>
                    </path>
                    <path>
                        <groupId>org.mapstruct</groupId>
                        <artifactId>mapstruct-processor</artifactId>
                    </path>
                </annotationProcessorPaths>
                <compilerArgs>
                    <arg>-Amapstruct.defaultComponentModel=spring</arg>
                </compilerArgs>
            </configuration>
        </plugin>
    </plugins>
</build>
```

### Key Annotations by Layer

| Layer | Annotation | Purpose |
|-------|-----------|---------|
| Domain | *(none)* | Zero framework dependencies |
| Application | `@Service`, `@Transactional`, `@RequiredArgsConstructor` | Use case beans |
| Input Adapters | `@RestController`, `@RequestMapping`, `@Valid` | HTTP entry points |
| Output Adapters | `@Repository`, `@Component` | Persistence, messaging |
| Config | `@Configuration`, `@Bean` | Wire ports to adapters |
| Mapper | `@Mapper(componentModel="spring")` | MapStruct |

---

## ⚙️ Production Configuration & Tuning Parameters

### application.yml
```yaml
spring:
  application:
    name: order-service
  
  jpa:
    # CRITICAL: Disable open-in-view in hexagonal arch (breaks layer isolation)
    open-in-view: false
    hibernate:
      ddl-auto: validate   # Flyway handles schema, not Hibernate
    properties:
      hibernate:
        dialect: org.hibernate.dialect.PostgreSQLDialect
        format_sql: true
        jdbc:
          batch_size: 50
          order_inserts: true
          order_updates: true
  
  datasource:
    url: jdbc:postgresql://localhost:5432/orders_db
    username: ${DB_USER:orders_user}
    password: ${DB_PASS:secret}
    hikari:
      maximum-pool-size: 20        # (cores * 2) + 1 spindle
      minimum-idle: 5
      connection-timeout: 30000
      idle-timeout: 600000
      max-lifetime: 1800000
      pool-name: OrderHikariPool

# Domain configuration as typed properties
app:
  order:
    max-items-per-order: 50
    payment-timeout-seconds: 30
  payment:
    retry-attempts: 3
```

### Archunit — Enforce Architecture Rules in Tests
```java
@AnalyzeClasses(packages = "com.company.app")
public class HexagonalArchitectureTest {

    // Domain must not depend on Spring
    @ArchTest
    static ArchRule domainMustNotDependOnSpring =
        noClasses().that().resideInAPackage("..domain..")
            .should().dependOnClassesThat()
            .resideInAPackage("org.springframework..");

    // Domain must not depend on JPA
    @ArchTest
    static ArchRule domainMustNotUseJpa =
        noClasses().that().resideInAPackage("..domain..")
            .should().dependOnClassesThat()
            .resideInAnyPackage("jakarta.persistence..", "javax.persistence..");

    // Controllers must not access repositories directly
    @ArchTest
    static ArchRule controllersMustNotAccessRepos =
        noClasses().that().resideInAPackage("..adapter.in.web..")
            .should().dependOnClassesThat()
            .resideInAPackage("..adapter.out.persistence..");

    // Services must only depend on ports
    @ArchTest
    static ArchRule servicesMustOnlyDependOnDomain =
        classes().that().resideInAPackage("..application..")
            .should().onlyDependOnClassesThat()
            .resideInAnyPackage("..domain..", "..application..", "java..", "org.springframework.context..");
}
```

---

## 📐 System Design Blueprint & Architecture Patterns

### Complete Request Flow (HTTP → Domain → DB → Response)

```
HTTP Request
    │
    ▼
┌─────────────────────────────┐
│  OrderController            │  ← Input Adapter (Infrastructure)
│  @RestController            │
│  Validates: @Valid          │
│  Maps: Request → Command    │
└─────────┬───────────────────┘
          │ PlaceOrderCommand (plain POJO)
          ▼
┌─────────────────────────────┐
│  OrderApplicationService    │  ← Application Layer
│  @Service @Transactional    │
│  Orchestrates domain objects│
│  Calls: OrderRepository port│
│  Calls: PaymentGateway port │
│  Publishes: Domain Events   │
└─────────┬───────────────────┘
          │ Domain Objects (Order, Money)
          ▼
┌─────────────────────────────┐
│  Domain Layer               │  ← Pure Java, No Frameworks
│  Order.confirm()            │
│  Validates: Business rules  │
│  Emits: OrderConfirmedEvent │
└─────────────────────────────┘
          │
          ▼
┌─────────────────────────────┐
│  JpaOrderRepositoryAdapter  │  ← Output Adapter (Infrastructure)
│  @Repository                │
│  Maps: Domain → JPA Entity  │
│  Spring Data JPA → DB       │
└─────────────────────────────┘
          │
          ▼
     PostgreSQL DB
```

### Design Patterns Applied

| Pattern | Where | Purpose |
|---------|-------|---------|
| **Dependency Inversion** | Ports & Adapters | Domain defines contracts, infra implements |
| **Strategy** | PaymentGateway | Swap Stripe ↔ PayPal without domain change |
| **Factory Method** | `Order.create()` | Encapsulate construction with invariants |
| **Repository** | `OrderRepository` | Abstract persistence behind interface |
| **CQRS (light)** | Separate read/write models | Use JPA projections for queries |
| **Observer** | Domain Events | Loose coupling via `ApplicationEventPublisher` |
| **Mapper** | MapStruct | Transform between layers without coupling |

---

## 🧪 Verification, Testing & Infrastructure Commands

### Docker Infrastructure Setup (PowerShell)
```powershell
# Start PostgreSQL
docker run -d `
  --name postgres-orders `
  -e POSTGRES_DB=orders_db `
  -e POSTGRES_USER=orders_user `
  -e POSTGRES_PASSWORD=secret `
  -p 5432:5432 `
  postgres:16-alpine

# Start the application
./mvnw spring-boot:run -Dspring-boot.run.profiles=local
```

### REST API Testing (PowerShell / Invoke-RestMethod)
```powershell
# Place an order
$body = @{
    customerId = "cust-123"
    items = @(
        @{ productId = "prod-456"; quantity = 2; price = 29.99 }
    )
} | ConvertTo-Json -Depth 3

Invoke-RestMethod -Uri "http://localhost:8080/api/v1/orders" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body

# Get order by ID
Invoke-RestMethod -Uri "http://localhost:8080/api/v1/orders/ord-789" `
    -Method GET
```

### ArchUnit Dependency (Testing)
```xml
<dependency>
    <groupId>com.tngtech.archunit</groupId>
    <artifactId>archunit-junit5</artifactId>
    <version>1.3.0</version>
    <scope>test</scope>
</dependency>
```

### Run Architecture Tests
```powershell
./mvnw test -Dtest=HexagonalArchitectureTest -pl order-service
```

---

## ⚡ Senior Best Practices & Critical Anti-Patterns

### ✅ Best Practices

1. **Use Value Objects for IDs** — Never use `Long` or `UUID` directly. Create `OrderId`, `CustomerId` as records:
   ```java
   public record OrderId(UUID value) {
       public static OrderId generate() { return new OrderId(UUID.randomUUID()); }
       public static OrderId of(String value) { return new OrderId(UUID.fromString(value)); }
   }
   ```

2. **Aggregate roots pull domain events** — Don't publish events inside the domain; collect them and publish in the application service after successful persistence.

3. **Commands are plain POJOs** — Never let HTTP request objects leak into the application layer. Always map to Command objects.

4. **One repository per Aggregate Root** — Never inject `ProductRepository` into `Order`. Cross-aggregate access goes through Application Services.

5. **Keep Use Case interfaces narrow** — Prefer `PlaceOrderUseCase` over a giant `OrderService` interface.

### ❌ Critical Anti-Patterns

| Anti-Pattern | Problem | Fix |
|-------------|---------|-----|
| **Anemic Domain Model** | Business logic scattered in Services; entities are just data bags | Move behavior INTO entities: `order.confirm()` not `orderService.confirmOrder(order)` |
| **Fat Service** | Single `OrderService` with 30+ methods | Split by use case: `PlaceOrderUseCase`, `CancelOrderUseCase`, `QueryOrderUseCase` |
| **Direct JPA Entity in Controller** | Leaks persistence details (lazy loading, internal IDs) to API consumers | Always map to DTOs in the adapter layer |
| **Self-invocation in @Transactional** | Calling `placeOrder()` from within same class bypasses Spring proxy | Extract to separate `@Service` bean or use `ApplicationContext.getBean()` |
| **Domain importing Spring** | `@Component` on domain entities breaks portability | Domain layer should be a plain Maven module with zero Spring dependencies |
| **Repository in Controller** | Bypasses domain logic and business rule enforcement | All mutation must pass through Application Services |
| **Ignoring ArchUnit** | Architecture erosion — shortcuts become the norm within months | Enforce layering rules as CI-breaking tests from day 1 |

### 🔒 Security Anti-Pattern
Never return domain entities directly from REST endpoints — it exposes internal structure, database IDs, and potentially sensitive fields (`passwordHash`, internal audit timestamps).

```java
// ❌ WRONG — exposes OrderJpaEntity directly
@GetMapping("/{id}")
public OrderJpaEntity getOrder(@PathVariable Long id) {
    return jpaRepo.findById(id).orElseThrow();
}

// ✅ CORRECT — maps to response DTO via application port
@GetMapping("/{id}")
public OrderResponse getOrder(@PathVariable String id) {
    return orderQueryUseCase.findById(OrderId.of(id));
}
```

---

*Next: [02-modular-monolith-spring-modulith.md](./02-modular-monolith-spring-modulith.md)*
