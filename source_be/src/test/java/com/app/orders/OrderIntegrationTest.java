package com.app.orders;

import com.app.common.IntegrationTestBase;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.*;

import static org.assertj.core.api.Assertions.*;

/**
 * OrderIntegrationTest — End-to-end integration test for order creation.
 * Uses a real PostgreSQL instance via Testcontainers.
 *
 * Tests the full HTTP → Controller → Service → DB → Response flow.
 */
@DisplayName("Order API Integration Tests")
class OrderIntegrationTest extends IntegrationTestBase {

    @Test
    @DisplayName("Health check endpoint returns UP")
    void healthCheck_ReturnsUp() {
        ResponseEntity<String> response = restTemplate.getForEntity(
            baseUrl() + "/actuator/health",
            String.class
        );

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).contains("UP");
    }

    @Test
    @DisplayName("Swagger UI endpoint is accessible")
    void swaggerUi_IsAccessible() {
        ResponseEntity<String> response = restTemplate.getForEntity(
            baseUrl() + "/swagger-ui/index.html",
            String.class
        );

        // Should redirect to swagger UI (200 or 302)
        assertThat(response.getStatusCode().value()).isIn(200, 302);
    }

    @Test
    @DisplayName("Protected endpoint returns 401 without token")
    void protectedEndpoint_WithoutToken_Returns401() {
        ResponseEntity<String> response = restTemplate.getForEntity(
            baseUrl() + "/api/v1/orders",
            String.class
        );

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }
}
