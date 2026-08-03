# 🧪 Unit Testing with JUnit 5 & Mockito

> **Category**: Testing & QA | **Complexity**: Foundation | **Java**: 21+ | **Spring Boot**: 3.3+ | **JUnit 5**

---

## 📖 Core Technical Mechanics & Deep-Dive

### The Testing Pyramid
- **Unit Tests (70%)**: Test a single class in isolation. Fast, deterministic, no Spring Context.
- **Integration Tests (20%)**: Test how classes interact with databases/brokers. Slower, requires Spring Context & Testcontainers.
- **E2E / Performance Tests (10%)**: Test the full deployed system.

### JUnit 5 vs JUnit 4
JUnit 5 (Jupiter) is a complete rewrite.
- `@Test` comes from `org.junit.jupiter.api.Test` (not `org.junit.Test`).
- `@BeforeEach` replaces `@Before`.
- `@ExtendWith` replaces `@RunWith`.

### Mockito
Mockito creates dummy implementations (Mocks) of your dependencies so you can test your class in absolute isolation without needing a database or real network calls.

---

## 🌐 Real-World GitHub Patterns & Industry Reference

- **[mockito/mockito](https://github.com/mockito/mockito)** — Official Mockito framework.
- **[junit-team/junit5](https://github.com/junit-team/junit5)** — Official JUnit 5 repository.

---

## 🏷️ Framework Annotations & Dependencies

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-test</artifactId>
    <scope>test</scope>
    <!-- Excludes JUnit 4 (Vintage) to ensure pure JUnit 5 -->
    <exclusions>
        <exclusion>
            <groupId>org.junit.vintage</groupId>
            <artifactId>junit-vintage-engine</artifactId>
        </exclusion>
    </exclusions>
</dependency>
```
*Note: `spring-boot-starter-test` automatically includes JUnit 5, Mockito, AssertJ, and JSONassert.*

---

## 📐 System Design Blueprint

### Complete Unit Testing Implementation

```java
// ═══════════════════════════════════════════════════
// 1. THE CLASS UNDER TEST
// ═══════════════════════════════════════════════════

@Service
@RequiredArgsConstructor
public class OrderService {
    
    private final OrderRepository orderRepository;
    private final PaymentGateway paymentGateway;
    private final EmailClient emailClient;

    public OrderResult processOrder(OrderRequest request) {
        if (request.getAmount().compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Amount must be positive");
        }

        // 1. Payment
        boolean paymentSuccess = paymentGateway.charge(request.getUserId(), request.getAmount());
        if (!paymentSuccess) {
            return OrderResult.failed("Payment declined");
        }

        // 2. DB Save
        Order order = new Order(request.getUserId(), request.getAmount(), "CONFIRMED");
        order = orderRepository.save(order);

        // 3. Email
        emailClient.sendConfirmation(request.getUserId(), order.getId());

        return OrderResult.success(order.getId());
    }
}

// ═══════════════════════════════════════════════════
// 2. THE UNIT TEST (BDD Style)
// ═══════════════════════════════════════════════════

// Enables Mockito annotations (@Mock, @InjectMocks) in JUnit 5
@ExtendWith(MockitoExtension.class) 
class OrderServiceTest {

    // 1. Create Mocks for all dependencies
    @Mock
    private OrderRepository orderRepository;
    
    @Mock
    private PaymentGateway paymentGateway;
    
    @Mock
    private EmailClient emailClient;

    // 2. Inject Mocks into the class we are testing
    @InjectMocks
    private OrderService orderService;

    // Optional: Capture arguments passed to mocks for deep assertion
    @Captor
    private ArgumentCaptor<Order> orderCaptor;

    // --- TEST 1: Happy Path ---
    
    @Test
    @DisplayName("Should process order successfully when payment is approved")
    void processOrder_Success() {
        // GIVEN (Arrange)
        var request = new OrderRequest(UUID.randomUUID(), new BigDecimal("100.00"));
        var savedOrder = new Order(request.getUserId(), request.getAmount(), "CONFIRMED");
        ReflectionTestUtils.setField(savedOrder, "id", UUID.randomUUID()); // Set private ID for testing

        // BDD Mockito syntax is cleaner than standard Mockito (given vs when)
        given(paymentGateway.charge(any(UUID.class), any(BigDecimal.class))).willReturn(true);
        given(orderRepository.save(any(Order.class))).willReturn(savedOrder);

        // WHEN (Act)
        OrderResult result = orderService.processOrder(request);

        // THEN (Assert)
        
        // 1. Assert standard outcomes (Using AssertJ fluent API)
        assertThat(result.isSuccess()).isTrue();
        assertThat(result.getOrderId()).isEqualTo(savedOrder.getId());
        
        // 2. Verify interactions (Ensure email was actually sent!)
        verify(emailClient, times(1)).sendConfirmation(request.getUserId(), savedOrder.getId());
        
        // 3. Deep assertion using ArgumentCaptor (Ensure the order saved to DB was constructed correctly)
        verify(orderRepository).save(orderCaptor.capture());
        Order capturedOrder = orderCaptor.getValue();
        assertThat(capturedOrder.getStatus()).isEqualTo("CONFIRMED");
        assertThat(capturedOrder.getAmount()).isEqualTo(new BigDecimal("100.00"));
    }

    // --- TEST 2: Exception Handling ---
    
    @Test
    @DisplayName("Should throw exception when amount is negative")
    void processOrder_NegativeAmount() {
        // GIVEN
        var request = new OrderRequest(UUID.randomUUID(), new BigDecimal("-50.00"));

        // WHEN / THEN
        assertThatThrownBy(() -> orderService.processOrder(request))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("Amount must be positive");
            
        // Verify dependencies were NEVER called since it failed fast
        verifyNoInteractions(paymentGateway, orderRepository, emailClient);
    }

    // --- TEST 3: Edge Case / Business Logic Failure ---
    
    @Test
    @DisplayName("Should return failed result when payment is declined")
    void processOrder_PaymentDeclined() {
        // GIVEN
        var request = new OrderRequest(UUID.randomUUID(), new BigDecimal("100.00"));
        given(paymentGateway.charge(any(), any())).willReturn(false);

        // WHEN
        OrderResult result = orderService.processOrder(request);

        // THEN
        assertThat(result.isSuccess()).isFalse();
        assertThat(result.getErrorMessage()).isEqualTo("Payment declined");
        
        // Ensure we didn't save to DB or send email
        verifyNoInteractions(orderRepository, emailClient);
    }
}
```

---

## 🧪 Verification Commands

```powershell
# Run all unit tests via Maven
mvn test

# Run a specific test class
mvn test -Dtest=OrderServiceTest

# Run tests and generate Jacoco Code Coverage report (requires jacoco-maven-plugin)
mvn clean test jacoco:report
# View report at target/site/jacoco/index.html
```

---

## ⚡ Best Practices & Anti-Patterns

### ✅ Best Practices
1. **Use BDDMockito (`given/willReturn`) and AssertJ (`assertThat`)**. The BDD (Behavior-Driven Development) aliases read much closer to natural English than standard Mockito (`when/thenReturn`) and JUnit (`assertEquals`).
2. **Use `@ExtendWith(MockitoExtension.class)`**. Do NOT use `@SpringBootTest` for Unit Tests! `@SpringBootTest` boots up the entire Spring Context, taking 5+ seconds. Unit tests should run in milliseconds.
3. **Use `ArgumentCaptor`**. Instead of just verifying a method was called, capture the object passed to it and assert its internal state.

### ❌ Anti-Patterns

| Anti-Pattern | Problem | Fix |
|-------------|---------|-----|
| Using `@SpringBootTest` when you only need to test one class | Slows down the build pipeline significantly. | Use pure JUnit + Mockito `@InjectMocks`. |
| Mocking data objects (DTOs/Entities) | You don't need to mock a POJO. It makes tests brittle and verbose. | Only mock *Services* and *Repositories*. Instantiate DTOs/Entities normally with `new`. |
| Ignoring `verifyNoMoreInteractions` | If an edge case fails, you want to ensure the system didn't accidentally send a payment anyway. | Use `verifyNoInteractions()` to guarantee side effects didn't occur. |
