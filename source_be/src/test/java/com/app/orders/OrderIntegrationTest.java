package com.app.orders;

import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Tag;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.containers.KafkaContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

/**
 * OrderIntegrationTest — Integration tests with Testcontainers.
 *
 * Uses real PostgreSQL and Kafka containers (auto-started by Testcontainers).
 * Flyway migrations run automatically at startup.
 *
 * Tag: "integration" — run separately with: mvn test -Dgroups=integration
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@Testcontainers
@Tag("integration")
class OrderIntegrationTest {

    @Container
    @SuppressWarnings("all")
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>(
            DockerImageName.parse("postgres:16-alpine"))
        .withDatabaseName("ecommerce_test")
        .withUsername("test_user")
        .withPassword("test_pass");

    @Container
    @SuppressWarnings("all")
    static KafkaContainer kafka = new KafkaContainer(
            DockerImageName.parse("confluentinc/cp-kafka:7.6.0"));

    @DynamicPropertySource
    static void configureTestProperties(DynamicPropertyRegistry registry) {
        // Override application datasource with Testcontainers connection
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
        registry.add("spring.kafka.bootstrap-servers", kafka::getBootstrapServers);

        // Use in-memory Redis for tests (or add RedisContainer)
        registry.add("spring.data.redis.host", () -> "localhost");
        registry.add("spring.data.redis.port", () -> "6379");
    }

    @BeforeAll
    static void beforeAll() {
        // Containers start automatically via @Testcontainers + @Container
        // Flyway migrations run at Spring Boot startup
    }

    // ─── Test Methods ────────────────────────────────────────────────────────

    // NOTE: Add @Test methods that exercise full stack:
    // - POST /api/v1/orders → verifies order persisted in PostgreSQL
    // - GET /api/v1/orders/{id} → verifies Kafka event emitted
    // - etc.
    //
    // Example:
    // @Test
    // void placeOrder_ShouldPersistToDatabase() throws Exception {
    //     mockMvc.perform(post("/api/v1/orders")
    //             .contentType(MediaType.APPLICATION_JSON)
    //             .content("{\"productId\": \"...\", \"quantity\": 1}"))
    //         .andExpect(status().isCreated())
    //         .andExpect(jsonPath("$.id").isNotEmpty());
    // }
}
