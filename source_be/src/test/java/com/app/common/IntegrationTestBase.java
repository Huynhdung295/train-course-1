package com.app.common;

import org.junit.jupiter.api.BeforeEach;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * IntegrationTestBase — Shared base class for all integration tests.
 *
 * Uses Testcontainers to spin up real PostgreSQL and Redis instances.
 * Containers are shared across all test classes (static) to minimize startup time.
 *
 * Profile "test" uses H2 for most tests; this base class provides real DB
 * for tests that need PostgreSQL-specific features (e.g., pg_trgm, partitioning).
 *
 * Usage:
 *   @SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
 *   class MyIntegrationTest extends IntegrationTestBase { ... }
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
@Testcontainers
public abstract class IntegrationTestBase {

    @SuppressWarnings("resource")
    @Container
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine")
        .withDatabaseName("nexus_test")
        .withUsername("test_user")
        .withPassword("test_password")
        .withReuse(true);

    @SuppressWarnings("resource")
    @Container
    static final GenericContainer<?> REDIS = new GenericContainer<>("redis:7-alpine")
        .withExposedPorts(6379)
        .withReuse(true);

    @DynamicPropertySource
    static void configureTestProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
        registry.add("spring.data.redis.host", REDIS::getHost);
        registry.add("spring.data.redis.port", () -> REDIS.getMappedPort(6379));
    }

    @LocalServerPort
    protected int port;

    @Autowired
    protected TestRestTemplate restTemplate;

    protected String baseUrl() {
        return "http://localhost:" + port;
    }
}
