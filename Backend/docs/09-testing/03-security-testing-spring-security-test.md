# 🔐 Security Testing with Spring Security Test

> **Category**: Testing & QA | **Complexity**: Intermediate | **Java**: 21+ | **Spring Boot**: 3.3+ | **Spring Security**

---

## 📖 Core Technical Mechanics & Deep-Dive

### The Problem with Testing Secured APIs
When you add Spring Security (JWT, OAuth2, or Form Login) to your application, suddenly all your existing integration tests fail with `401 Unauthorized`.
Generating a real, valid JWT token just for a test is incredibly difficult (requires mocking Keycloak/Auth0, dealing with RSA key pairs, and JWT signing).

### The Solution: Spring Security Test
Spring provides `spring-security-test` which bypasses the actual token decoding/validation process during tests, allowing you to inject a mock `Authentication` object directly into the `SecurityContext`.
This allows you to test your `@PreAuthorize` rules (RBAC - Role Based Access Control) and Controller logic without dealing with cryptographic signatures.

---

## 🌐 Real-World GitHub Patterns & Industry Reference

- **[spring-projects/spring-security](https://docs.spring.io/spring-security/reference/servlet/test/index.html)** — Official Spring Security Testing Docs.

---

## 🏷️ Framework Annotations & Dependencies

```xml
<dependency>
    <groupId>org.springframework.security</groupId>
    <artifactId>spring-security-test</artifactId>
    <scope>test</scope>
</dependency>
```

---

## 📐 System Design Blueprint

### Complete Security Testing Implementation

```java
// ═══════════════════════════════════════════════════
// 1. THE CONTROLLER TO TEST
// ═══════════════════════════════════════════════════

@RestController
@RequestMapping("/api/v1/admin")
public class AdminController {

    // Requires the user to have the 'ROLE_ADMIN' authority
    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/users")
    public List<String> getAllUsers() {
        return List.of("alice", "bob");
    }

    // Requires the user to be the owner of the resource OR an admin
    @PreAuthorize("#userId == authentication.name or hasRole('ADMIN')")
    @GetMapping("/users/{userId}/data")
    public String getUserData(@PathVariable String userId) {
        return "Secret Data for " + userId;
    }
}

// ═══════════════════════════════════════════════════
// 2. MOCKMVC TESTING (WebMvcTest)
// ═══════════════════════════════════════════════════
// @WebMvcTest only boots up the web layer (Controllers, Security, Filters)
// It is much faster than @SpringBootTest.

@WebMvcTest(AdminController.class)
@Import(SecurityConfig.class) // Import your custom security rules!
class AdminControllerSecurityTest {

    @Autowired
    private MockMvc mockMvc;

    // --- TEST 1: Unauthenticated (401) ---
    
    @Test
    @DisplayName("Should return 401 when unauthenticated")
    void shouldReturn401() throws Exception {
        mockMvc.perform(get("/api/v1/admin/users"))
               .andExpect(status().isUnauthorized());
    }

    // --- TEST 2: Authenticated but missing Roles (403) ---
    
    @Test
    @WithMockUser(username = "user1", roles = {"USER"}) // Injects a fake SecurityContext
    @DisplayName("Should return 403 when user lacks ADMIN role")
    void shouldReturn403ForNormalUser() throws Exception {
        mockMvc.perform(get("/api/v1/admin/users"))
               .andExpect(status().isForbidden());
    }

    // --- TEST 3: Authenticated with correct Roles (200) ---
    
    @Test
    @WithMockUser(username = "admin1", roles = {"ADMIN"})
    @DisplayName("Should return 200 when user has ADMIN role")
    void shouldReturn200ForAdmin() throws Exception {
        mockMvc.perform(get("/api/v1/admin/users"))
               .andExpect(status().isOk())
               .andExpect(jsonPath("$[0]").value("alice"));
    }

    // --- TEST 4: SpEL Authorization Logic (Owner check) ---
    
    @Test
    @WithMockUser(username = "bob")
    @DisplayName("Should return 200 when user accesses their own data")
    void shouldAllowOwnerAccess() throws Exception {
        // Bob requesting Bob's data
        mockMvc.perform(get("/api/v1/admin/users/bob/data"))
               .andExpect(status().isOk());
    }
    
    @Test
    @WithMockUser(username = "alice")
    @DisplayName("Should return 403 when user accesses someone else's data")
    void shouldDenyNonOwnerAccess() throws Exception {
        // Alice requesting Bob's data
        mockMvc.perform(get("/api/v1/admin/users/bob/data"))
               .andExpect(status().isForbidden());
    }
}

// ═══════════════════════════════════════════════════
// 3. TESTING OAUTH2 / JWT specifically
// ═══════════════════════════════════════════════════

@WebMvcTest(AdminController.class)
class JwtSecurityTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    @DisplayName("Testing with a mock JWT Token")
    void testWithJwt() throws Exception {
        
        // Sometimes @WithMockUser isn't enough, you need actual JWT claims
        mockMvc.perform(get("/api/v1/admin/users")
                .with(jwt() // Provided by spring-security-test
                    .jwt(builder -> builder.claim("custom_claim", "value"))
                    .authorities(new SimpleGrantedAuthority("ROLE_ADMIN"))
                ))
               .andExpect(status().isOk());
    }
}
```

---

## 🧪 Verification Commands

```powershell
# Run only the security tests
mvn test -Dtest=*SecurityTest*
```

---

## ⚡ Best Practices & Anti-Patterns

### ✅ Best Practices
1. **Use `@WebMvcTest` for Security**. Do not use `@SpringBootTest` unless you need to test database constraints. Security is a web-layer concern.
2. **Use `.with(jwt())` for Resource Servers**. If your application is an OAuth2 Resource Server validating JWTs, `@WithMockUser` creates a `UsernamePasswordAuthenticationToken`, which might crash your controller if you cast the principal to a `Jwt`. Use `.with(jwt())` instead.
3. **Always test the negative cases (401 and 403)**. Security bugs happen when you forget to secure an endpoint, not when you secure it too tightly. Test that a normal user *cannot* access admin resources.

### ❌ Anti-Patterns

| Anti-Pattern | Problem | Fix |
|-------------|---------|-----|
| Disabling Security for Tests (`@AutoConfigureMockMvc(addFilters = false)`) | Tests pass, but in production the endpoints are blocked. You aren't testing reality. | Leave security enabled and use `@WithMockUser`. |
| Hardcoding real JWT tokens in tests | Tokens expire. The test will start failing next hour. | Use `spring-security-test` mocking APIs. |
| Forgetting to `@Import` your custom SecurityConfig | `@WebMvcTest` scans for Controllers, but might miss your specific `SecurityFilterChain` bean if it's not explicitly imported. | Use `@Import(SecurityConfig.class)`. |
