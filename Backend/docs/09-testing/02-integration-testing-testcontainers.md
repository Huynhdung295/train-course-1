# 🏗️ Integration Testing with Testcontainers

> **Category**: Testing & QA | **Complexity**: Advanced | **Java**: 21+ | **Spring Boot**: 3.3+ | **Testcontainers**: 1.19+

---

## 📖 Core Technical Mechanics & Deep-Dive

### The Integration Testing Problem
Unit tests mock out databases, Kafka, and Redis. But what if your native SQL query has a syntax error? What if your Kafka consumer group is misconfigured? 
Integration tests spin up the Spring Context to test these real interactions.
Historically, developers used H2 (In-Memory DB) for testing. **H2 is an anti-pattern today** because it doesn't support advanced PostgreSQL features (JSONB, native queries, specific locking semantics), leading to false positives where tests pass but production fails.

### The Solution: Testcontainers
Testcontainers is a Java library that uses Docker API to automatically spin up *real*, disposable databases, message brokers, and caches in Docker containers *before* your tests run, and tears them down after.
- You test against real PostgreSQL, not H2.
- You test against real Kafka, not an embedded mock.

### Spring Boot 3.1+ ConnectionDetails (The Game Changer)
Before Boot 3.1, you had to use `@DynamicPropertySource` to manually extract the random port Testcontainers generated and inject it into `spring.datasource.url`.
Spring Boot 3.1 introduced `@ServiceConnection`. You just annotate the container bean, and Spring automatically configures the Hikari pool, Redis Template, or Kafka properties to use it!

---

## 🌐 Real-World GitHub Patterns & Industry Reference

- **[testcontainers/testcontainers-java](https://github.com/testcontainers/testcontainers-java)** — Official Testcontainers Java implementation.

---

## 🏷️ Framework Annotations & Dependencies

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-test</artifactId>
    <scope>test</scope>
</dependency>
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-testcontainers</artifactId>
    <scope>test</scope>
</dependency>

<!-- Specific Container Modules -->
<dependency>
    <groupId>org.testcontainers</groupId>
    <artifactId>postgresql</artifactId>
    <scope>test</scope>
</dependency>
<dependency>
    <groupId>org.testcontainers</groupId>
    <artifactId>kafka</artifactId>
    <scope>test</scope>
</dependency>
<dependency>
    <groupId>org.testcontainers</groupId>
    <artifactId>junit-jupiter</artifactId>
    <scope>test</scope>
</dependency>
```

---

## 📐 System Design Blueprint

### Complete Testcontainers Setup (Spring Boot 3.1+ Style)

```java
// ═══════════════════════════════════════════════════
// 1. BASE INTEGRATION TEST CLASS
// ═══════════════════════════════════════════════════

/**
 * Base class for all integration tests.
 * Spins up one set of containers for the entire test suite (Singleton Pattern)
 * to avoid the massive overhead of starting Docker containers for every single test class.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Testcontainers // Tells JUnit 5 to manage the lifecycle of @Container fields (if not static)
public abstract class AbstractIntegrationTest {

    // --- 1. Define Containers (Static = Shared across all test classes) ---
    
    @Container
    @ServiceConnection // Magic! Auto-configures spring.datasource.*
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("test_db")
            .withUsername("test")
            .withPassword("test");

    @Container
    @ServiceConnection // Auto-configures spring.data.redis.*
    static GenericContainer<?> redis = new GenericContainer<>(DockerImageName.parse("redis:7-alpine"))
            .withExposedPorts(6379);

    @Container
    @ServiceConnection // Auto-configures spring.kafka.*
    static KafkaContainer kafka = new KafkaContainer(DockerImageName.parse("confluentinc/cp-kafka:7.4.0"));

    // --- 2. Inject Random Port WebTestClient ---
    
    // Used to make real HTTP calls to the running application
    @Autowired
    protected WebTestClient webTestClient;

    // --- 3. Optional: Dynamic Properties for things without @ServiceConnection ---
    /*
    @DynamicPropertySource
    static void configureProperties(DynamicPropertyRegistry registry) {
        registry.add("custom.redis.port", () -> redis.getFirstMappedPort());
    }
    */
}

// ═══════════════════════════════════════════════════
// 2. THE INTEGRATION TEST
// ═══════════════════════════════════════════════════

class OrderControllerIntegrationTest extends AbstractIntegrationTest {

    @Autowired
    private OrderRepository orderRepository;

    @Autowired
    private KafkaTemplate<String, String> kafkaTemplate;

    // Clean up DB before each test so they run in isolation
    @BeforeEach
    void setUp() {
        orderRepository.deleteAll();
    }

    @Test
    @DisplayName("Should create order, save to DB, and publish to Kafka")
    void createOrderFlow() throws Exception {
        
        // 1. GIVEN: Create payload
        var requestBody = """
            {
                "userId": "550e8400-e29b-41d4-a716-446655440000",
                "amount": 150.50
            }
        """;

        // 2. WHEN: Call the real HTTP endpoint
        webTestClient.post()
            .uri("/api/v1/orders")
            .contentType(MediaType.APPLICATION_JSON)
            .bodyValue(requestBody)
            .exchange()
            // 3. THEN: Assert HTTP response
            .expectStatus().isCreated()
            .expectBody()
            .jsonPath("$.orderId").isNotEmpty()
            .jsonPath("$.status").isEqualTo("PENDING");

        // 4. THEN: Assert DB state
        var orders = orderRepository.findAll();
        assertThat(orders).hasSize(1);
        assertThat(orders.get(0).getAmount()).isEqualByComparingTo("150.50");

        // 5. THEN: Assert Kafka Message (Requires a test consumer to catch the message, 
        // or Awaitility to wait for async processing)
        // Awaitility.await().atMost(Duration.ofSeconds(5)).untilAsserted(() -> { ... });
    }
}
```

---

## 🧪 Verification Commands

```powershell
# Ensure Docker Desktop (or Colima/Rancher) is running locally!
docker ps

# Run the integration tests
mvn verify -P integration-test

# Behind the scenes, Testcontainers will:
# 1. Pull the Docker images (if not cached)
# 2. Start PostgreSQL on a random port (e.g., 55321)
# 3. Start Redis on a random port
# 4. Inject jdbc:postgresql://localhost:55321/test_db into Spring
# 5. Run the tests
# 6. Destroy the containers via the Ryuk sidecar container
```

---

## ⚡ Best Practices & Anti-Patterns

### ✅ Best Practices
1. **Use `@ServiceConnection`**. It replaces hundreds of lines of brittle `@DynamicPropertySource` setup.
2. **Use the Singleton Container Pattern (Static Fields)**. If you don't make your `@Container` fields `static`, Testcontainers will start a fresh PostgreSQL container for *every single test class*. Your test suite will take 10 minutes instead of 30 seconds.
3. **Use Awaitility for Async/Kafka asserts**. Don't use `Thread.sleep(2000)`. Use Awaitility to poll gracefully up to a timeout.

### ❌ Anti-Patterns

| Anti-Pattern | Problem | Fix |
|-------------|---------|-----|
| Testing with H2 database | H2 syntax differs from PostgreSQL. Tests pass, but prod breaks on native queries or specific JSONB features. | Always use Testcontainers with the exact same DB image version as production. |
| Hardcoding Testcontainer ports (`.withPortBinding(5432)`) | If you have a real Postgres running on 5432 on your laptop, the test fails to start. | Let Testcontainers pick random ephemeral ports. `@ServiceConnection` will handle the routing. |
| Not cleaning up DB state | Test A inserts data. Test B fails because it expects an empty table. | Use `@BeforeEach` to `repository.deleteAll()` or `@Sql(scripts="/cleanup.sql")`. Don't rely on `@Transactional` in integration tests if you use `WebTestClient` (separate threads). |
