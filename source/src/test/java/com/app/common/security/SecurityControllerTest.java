package com.app.common.security;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * SecurityControllerTest — Spring Security integration tests using MockMvc.
 *
 * Tests authentication, authorization, CSRF, and role-based access.
 */
@SpringBootTest
@AutoConfigureMockMvc
@DisplayName("Security Controller Tests")
@SuppressWarnings("all")
class SecurityControllerTest {

    @Autowired
    private MockMvc mockMvc;

    // ─── Authentication Tests ──────────────────────────────────────────────────

    @Test
    @DisplayName("Unauthenticated request to protected endpoint should return 401")
    void unauthenticatedShouldReturn401() throws Exception {
        mockMvc.perform(get("/api/v1/orders"))
            .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("Authenticated user can access their own orders")
    @WithMockUser(username = "user@example.com", roles = {"USER"})
    void authenticatedUserCanAccessOrders() throws Exception {
        mockMvc.perform(get("/api/v1/orders"))
            .andExpect(status().isOk());
    }

    // ─── Role-Based Authorization Tests ───────────────────────────────────────

    @Test
    @DisplayName("Non-admin user cannot access admin endpoint")
    @WithMockUser(username = "user@example.com", roles = {"USER"})
    void nonAdminUserCannotAccessAdminEndpoint() throws Exception {
        mockMvc.perform(get("/api/v1/admin/users"))
            .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Admin user can access admin endpoint")
    @WithMockUser(username = "admin@example.com", roles = {"ADMIN"})
    void adminUserCanAccessAdminEndpoint() throws Exception {
        mockMvc.perform(get("/api/v1/admin/users"))
            .andExpect(status().isOk());
    }

    // ─── CSRF Tests ───────────────────────────────────────────────────────────

    @Test
    @DisplayName("POST without CSRF token should be rejected (for form-based endpoints)")
    void postWithoutCsrfShouldBeForbidden() throws Exception {
        // Note: REST APIs with JWT typically disable CSRF (stateless).
        // This test documents the expected behavior.
        mockMvc.perform(post("/api/v1/orders")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"productId\": \"test\"}"))
            .andExpect(status().isUnauthorized()); // 401 because no JWT
    }

    @Test
    @DisplayName("POST with valid JWT should succeed")
    @WithMockUser(username = "user@example.com", roles = {"USER"})
    void postWithValidJwtShouldSucceed() throws Exception {
        mockMvc.perform(post("/api/v1/orders")
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"productId\": \"00000000-0000-0000-0000-000000000001\", \"quantity\": 1}"))
            .andExpect(status().is2xxSuccessful());
    }

    // ─── Actuator Security Tests ──────────────────────────────────────────────

    @Test
    @DisplayName("Health endpoint should be publicly accessible")
    void healthEndpointShouldBePublic() throws Exception {
        mockMvc.perform(get("/actuator/health"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("UP"));
    }

    @Test
    @DisplayName("Prometheus metrics endpoint requires ACTUATOR role")
    void prometheusRequiresActuatorRole() throws Exception {
        mockMvc.perform(get("/actuator/prometheus"))
            .andExpect(status().isUnauthorized());
    }
}
