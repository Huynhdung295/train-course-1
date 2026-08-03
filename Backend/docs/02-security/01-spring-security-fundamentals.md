# 🔒 Spring Security Fundamentals

> **Category**: Security | **Complexity**: Advanced | **Java**: 21+ | **Spring Boot**: 3.3+ | **Spring Security**: 6.3+

---

## 📖 Core Technical Mechanics & Deep-Dive

### The Security Filter Chain — How It Really Works

Spring Security's core is a **chain of `Filter` objects** that intercepts every HTTP request **before** it reaches your controllers. Understanding this chain is essential for customizing security correctly.

```
HTTP Request
    │
    ▼
DelegatingFilterProxy (Servlet container bridge)
    │ delegates to ↓
    ▼
FilterChainProxy (Spring Security entry point)
    │
    ▼ iterates through registered SecurityFilterChains
    │
SecurityFilterChain (matches if path matches)
    │
    ├── DisableEncodeUrlFilter
    ├── WebAsyncManagerIntegrationFilter
    ├── SecurityContextHolderFilter         ← Loads SecurityContext from storage
    ├── HeaderWriterFilter                  ← X-XSS-Protection, X-Content-Type-Options
    ├── CorsFilter                          ← Cross-origin headers
    ├── CsrfFilter                          ← CSRF token validation
    ├── LogoutFilter                        ← Handles /logout
    ├── UsernamePasswordAuthenticationFilter← Form login
    ├── BearerTokenAuthenticationFilter     ← JWT / OAuth2 token
    ├── BasicAuthenticationFilter           ← HTTP Basic auth
    ├── RequestCacheAwareFilter
    ├── SecurityContextHolderAwareRequestFilter
    ├── AnonymousAuthenticationFilter       ← Sets anonymous user if no auth found
    ├── ExceptionTranslationFilter          ← Converts security exceptions to HTTP responses
    └── AuthorizationFilter                 ← Enforces access rules
```

### Authentication Flow Deep Dive

```java
// Step 1: Filter extracts credentials from request
// Step 2: Creates unauthenticated Authentication token
UsernamePasswordAuthenticationToken unauthenticated =
    UsernamePasswordAuthenticationToken.unauthenticated(username, password);

// Step 3: Delegates to AuthenticationManager
Authentication result = authenticationManager.authenticate(unauthenticated);
// ProviderManager iterates its AuthenticationProvider list

// Step 4: AuthenticationProvider validates
// DaoAuthenticationProvider:
//   - Loads UserDetails via UserDetailsService
//   - Verifies password with PasswordEncoder
//   - Creates authenticated token with authorities

// Step 5: Authenticated token stored in SecurityContext
SecurityContextHolder.getContext().setAuthentication(result);
// For stateless (JWT): SecurityContextRepository = NullSecurityContextRepository
// For stateful (session): SecurityContextRepository = HttpSessionSecurityContextRepository
```

### SecurityContext Storage Strategies

```
STATEFUL (Traditional Session)
Client → Request with JSESSIONID cookie
    → HttpSessionSecurityContextRepository loads SecurityContext from HTTP session
    → SecurityContextHolder.setContext(loaded)
    → Request processed with authentication
    → SecurityContext saved back to session

STATELESS (JWT/OAuth2)
Client → Request with Authorization: Bearer <token>
    → BearerTokenAuthenticationFilter validates JWT
    → Creates SecurityContext in memory for THIS request only
    → NullSecurityContextRepository — nothing saved
    → SecurityContextHolder cleared after request
```

---

## 🌐 Real-World GitHub Patterns & Industry Reference

### Reference Projects
- **[spring-projects/spring-security-samples](https://github.com/spring-projects/spring-security-samples)** — Official comprehensive samples
- **[beer-works/spring-security-workshop](https://github.com/bkpathak/spring-security-workshop)** — Workshop with all auth patterns
- **[jhipster/jhipster-bom](https://github.com/jhipster/jhipster-bom)** — JHipster's security configuration (widely used template)
- **[RealWorld Spring Boot API](https://github.com/gothinkster/spring-boot-realworld-example-app)** — Production JWT + Spring Security example

### Industry Security Configuration Pattern

```java
@Configuration
@EnableWebSecurity
@EnableMethodSecurity(prePostEnabled = true, securedEnabled = true)
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtFilter;
    private final CustomAuthenticationEntryPoint entryPoint;
    private final CustomAccessDeniedHandler accessDeniedHandler;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        return http
            // Session management
            .sessionManagement(session ->
                session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))

            // CSRF: disabled for stateless JWT APIs
            .csrf(AbstractHttpConfigurer::disable)

            // CORS
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))

            // Headers (security hardening)
            .headers(headers -> headers
                .frameOptions(HeadersConfigurer.FrameOptionsConfig::deny)
                .xssProtection(xss -> xss.headerValue(XXssProtectionHeaderWriter.HeaderValue.ENABLED_MODE_BLOCK))
                .contentSecurityPolicy(csp ->
                    csp.policyDirectives("default-src 'self'; script-src 'self'; object-src 'none'")))

            // Authorization rules
            .authorizeHttpRequests(auth -> auth
                // Public endpoints
                .requestMatchers("/api/v1/auth/**").permitAll()
                .requestMatchers("/actuator/health", "/actuator/info").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/v1/products/**").permitAll()
                // Authenticated endpoints
                .requestMatchers("/api/v1/orders/**").authenticated()
                .requestMatchers("/api/v1/admin/**").hasRole("ADMIN")
                .anyRequest().authenticated())

            // Exception handling
            .exceptionHandling(ex -> ex
                .authenticationEntryPoint(entryPoint)
                .accessDeniedHandler(accessDeniedHandler))

            // JWT filter runs before UsernamePasswordAuthenticationFilter
            .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class)

            .build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        // BCrypt with cost factor 12 (2^12 = 4096 iterations)
        return new BCryptPasswordEncoder(12);
    }

    @Bean
    public AuthenticationManager authenticationManager(
            AuthenticationConfiguration authConfig) throws Exception {
        return authConfig.getAuthenticationManager();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        var config = new CorsConfiguration();
        config.setAllowedOriginPatterns(List.of("https://*.company.com", "http://localhost:*"));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        config.setAllowCredentials(true);
        config.setMaxAge(3600L);

        var source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}
```

---

## 🏷️ Framework Annotations, Components & Dependencies

### Maven Dependencies

```xml
<!-- Spring Security core (included by starter-web in most cases) -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-security</artifactId>
</dependency>

<!-- OAuth2 Resource Server (JWT validation) -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-oauth2-resource-server</artifactId>
</dependency>

<!-- For JWT generation/validation (JJWT library) -->
<dependency>
    <groupId>io.jsonwebtoken</groupId>
    <artifactId>jjwt-api</artifactId>
    <version>0.12.6</version>
</dependency>
<dependency>
    <groupId>io.jsonwebtoken</groupId>
    <artifactId>jjwt-impl</artifactId>
    <version>0.12.6</version>
    <scope>runtime</scope>
</dependency>
<dependency>
    <groupId>io.jsonwebtoken</groupId>
    <artifactId>jjwt-jackson</artifactId>
    <version>0.12.6</version>
    <scope>runtime</scope>
</dependency>

<!-- Argon2 (requires Bouncy Castle) -->
<dependency>
    <groupId>org.springframework.security</groupId>
    <artifactId>spring-security-crypto</artifactId>
</dependency>
<dependency>
    <groupId>org.bouncycastle</groupId>
    <artifactId>bcpkix-jdk18on</artifactId>
    <version>1.78.1</version>
</dependency>
```

### Key Security Annotations

| Annotation | Layer | Purpose |
|-----------|-------|---------|
| `@EnableWebSecurity` | Config | Activates Spring Security |
| `@EnableMethodSecurity` | Config | Enables `@PreAuthorize`, `@PostAuthorize`, `@Secured` |
| `@PreAuthorize("hasRole('ADMIN')")` | Method | Pre-invocation authorization check |
| `@PostAuthorize("returnObject.userId == principal.id")` | Method | Post-invocation check on return value |
| `@Secured({"ROLE_USER", "ROLE_ADMIN"})` | Method | Simple role-based check |
| `@RolesAllowed` | Method | JSR-250 standard role check |
| `@WithMockUser` | Test | Test with mock authenticated user |
| `@WithSecurityContext` | Test | Test with custom security context |

---

## ⚙️ Production Configuration & Tuning Parameters

### application.yml Security Configuration

```yaml
spring:
  security:
    # For form-based login (if applicable)
    user:
      name: ${ADMIN_USER:admin}
      password: ${ADMIN_PASSWORD}    # Never hardcode
      roles: ADMIN

# Password encoding work factors (tune based on target latency)
app:
  security:
    password:
      # BCrypt: target ~200ms verification time
      # On modern hardware: strength 12 ≈ 200ms
      bcrypt-strength: 12
      
      # Argon2id (more memory-hard than BCrypt — better for GPUs)
      # Argon2id parameters: memory=65536KB, iterations=2, parallelism=1
      argon2-memory: 65536
      argon2-iterations: 2
      argon2-parallelism: 1

    jwt:
      # Use environment variables for secrets
      access-token-secret: ${JWT_ACCESS_SECRET}   # min 256-bit / 32 chars
      access-token-expiry: 15m                    # SHORT — 15 minutes
      refresh-token-expiry: 7d                    # Longer — 7 days

    cors:
      allowed-origins:
        - https://app.company.com
        - https://admin.company.com
```

### Custom Authentication Entry Point & Access Denied Handler

```java
@Component
public class CustomAuthenticationEntryPoint implements AuthenticationEntryPoint {

    private final ObjectMapper objectMapper;

    @Override
    public void commence(HttpServletRequest request, HttpServletResponse response,
                         AuthenticationException authException) throws IOException {
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);

        var problem = ProblemDetail.forStatusAndDetail(
            HttpStatus.UNAUTHORIZED,
            "Authentication required: " + authException.getMessage()
        );
        problem.setTitle("Unauthorized");
        problem.setProperty("timestamp", Instant.now());

        objectMapper.writeValue(response.getOutputStream(), problem);
    }
}

@Component
public class CustomAccessDeniedHandler implements AccessDeniedHandler {

    private final ObjectMapper objectMapper;

    @Override
    public void handle(HttpServletRequest request, HttpServletResponse response,
                       AccessDeniedException accessDeniedException) throws IOException {
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setStatus(HttpServletResponse.SC_FORBIDDEN);

        var problem = ProblemDetail.forStatusAndDetail(
            HttpStatus.FORBIDDEN,
            "Access denied: insufficient permissions"
        );
        problem.setTitle("Forbidden");
        problem.setProperty("timestamp", Instant.now());
        problem.setProperty("path", request.getRequestURI());

        objectMapper.writeValue(response.getOutputStream(), problem);
    }
}
```

---

## 📐 System Design Blueprint & Architecture Patterns

### Custom UserDetails Implementation

```java
// Custom UserDetails — wraps your User domain object
@Data
@AllArgsConstructor
public class SecurityUser implements UserDetails {

    private final User user;

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return user.getRoles().stream()
            .map(role -> new SimpleGrantedAuthority("ROLE_" + role.name()))
            .collect(Collectors.toList());
    }

    @Override
    public String getPassword() {
        return user.getPasswordHash();
    }

    @Override
    public String getUsername() {
        return user.getEmail();
    }

    // Account status checks
    @Override
    public boolean isAccountNonExpired() { return !user.isExpired(); }

    @Override
    public boolean isAccountNonLocked() { return !user.isLocked(); }

    @Override
    public boolean isCredentialsNonExpired() { return !user.isPasswordExpired(); }

    @Override
    public boolean isEnabled() { return user.isActive(); }

    // Convenience accessors
    public UUID getUserId() { return user.getId(); }
    public String getTenantId() { return user.getTenantId(); }
}

// UserDetailsService implementation
@Service
@RequiredArgsConstructor
public class SecurityUserDetailsService implements UserDetailsService {

    private final UserRepository userRepository;

    @Override
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
        return userRepository.findByEmail(email)
            .map(SecurityUser::new)
            .orElseThrow(() -> new UsernameNotFoundException("User not found: " + email));
    }
}

// Password encoding strategy
@Configuration
public class PasswordEncoderConfig {

    @Bean
    public PasswordEncoder passwordEncoder() {
        // DelegatingPasswordEncoder — supports multiple encoders + migration
        var encoders = new HashMap<String, PasswordEncoder>();
        encoders.put("bcrypt", new BCryptPasswordEncoder(12));
        encoders.put("argon2", new Argon2PasswordEncoder(
            16,   // salt length
            32,   // hash length
            1,    // parallelism
            65536, // memory (KB)
            2     // iterations
        ));

        // New passwords use argon2; existing bcrypt passwords still work
        var delegating = new DelegatingPasswordEncoder("argon2", encoders);
        delegating.setDefaultPasswordEncoderForMatches(new BCryptPasswordEncoder(12));
        return delegating;
    }
}
```

### Multiple SecurityFilterChain for Different Routes

```java
@Configuration
@EnableWebSecurity
public class MultiSecurityConfig {

    // Chain 1: API routes — stateless JWT
    @Bean
    @Order(1)
    public SecurityFilterChain apiSecurityFilterChain(HttpSecurity http) throws Exception {
        return http
            .securityMatcher("/api/**")
            .sessionManagement(s -> s.sessionCreationPolicy(STATELESS))
            .csrf(AbstractHttpConfigurer::disable)
            .oauth2ResourceServer(oauth2 -> oauth2.jwt(Customizer.withDefaults()))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/v1/public/**").permitAll()
                .anyRequest().authenticated())
            .build();
    }

    // Chain 2: Admin console — form login with sessions
    @Bean
    @Order(2)
    public SecurityFilterChain adminSecurityFilterChain(HttpSecurity http) throws Exception {
        return http
            .securityMatcher("/admin/**")
            .formLogin(form -> form
                .loginPage("/admin/login")
                .defaultSuccessUrl("/admin/dashboard", true))
            .logout(logout -> logout.logoutUrl("/admin/logout"))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/admin/login").permitAll()
                .anyRequest().hasRole("ADMIN"))
            .build();
    }

    // Chain 3: Actuator — HTTP Basic
    @Bean
    @Order(3)
    public SecurityFilterChain actuatorSecurityFilterChain(HttpSecurity http) throws Exception {
        return http
            .securityMatcher("/actuator/**")
            .httpBasic(Customizer.withDefaults())
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/actuator/health", "/actuator/info").permitAll()
                .anyRequest().hasRole("MONITORING"))
            .build();
    }
}
```

---

## 🧪 Verification, Testing & Infrastructure Commands

### Security Tests

```java
@SpringBootTest
@AutoConfigureMockMvc
class SecurityConfigTest {

    @Autowired
    MockMvc mockMvc;

    @Test
    void unauthenticatedRequestShouldReturn401() throws Exception {
        mockMvc.perform(get("/api/v1/orders"))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.title").value("Unauthorized"));
    }

    @Test
    @WithMockUser(username = "user@example.com", roles = {"USER"})
    void authenticatedUserCanAccessOrders() throws Exception {
        mockMvc.perform(get("/api/v1/orders"))
            .andExpect(status().isOk());
    }

    @Test
    @WithMockUser(username = "user@example.com", roles = {"USER"})
    void regularUserCannotAccessAdminEndpoints() throws Exception {
        mockMvc.perform(get("/api/v1/admin/users"))
            .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(roles = {"ADMIN"})
    void adminCanAccessAdminEndpoints() throws Exception {
        mockMvc.perform(get("/api/v1/admin/users"))
            .andExpect(status().isOk());
    }
}
```

### PowerShell Testing

```powershell
# Test public endpoint
Invoke-RestMethod -Uri "http://localhost:8080/api/v1/auth/login" -Method GET

# Test protected endpoint without token (should get 401)
try {
    Invoke-RestMethod -Uri "http://localhost:8080/api/v1/orders" -Method GET
} catch {
    Write-Host "Status: $($_.Exception.Response.StatusCode)"  # 401
}

# Login and get token
$creds = @{ email = "user@example.com"; password = "Password123!" } | ConvertTo-Json
$auth = Invoke-RestMethod -Uri "http://localhost:8080/api/v1/auth/login" `
    -Method POST -ContentType "application/json" -Body $creds

# Use token
Invoke-RestMethod -Uri "http://localhost:8080/api/v1/orders" `
    -Headers @{ Authorization = "Bearer $($auth.accessToken)" }

# Check security headers
$response = Invoke-WebRequest -Uri "http://localhost:8080/api/v1/orders" `
    -Headers @{ Authorization = "Bearer $($auth.accessToken)" }
$response.Headers | Format-Table Name, Value
```

---

## ⚡ Senior Best Practices & Critical Anti-Patterns

### ✅ Best Practices

1. **Use `DelegatingPasswordEncoder`** — Supports algorithm migration. Start with bcrypt, migrate to Argon2 without breaking existing passwords.

2. **Tune BCrypt work factor to target ~200ms** — Too fast = weak; too slow = DoS risk on login endpoint. Benchmark on your production hardware.

3. **`@EnableMethodSecurity` over `@EnableGlobalMethodSecurity`** — The latter is deprecated in Spring Security 6.

4. **Never store raw passwords** — Even in logs. Use `{noop}password` ONLY in tests.

5. **SecurityContextHolder strategy for virtual threads** — In Java 21 with virtual threads, use `MODE_INHERITABLETHREADLOCAL`:
   ```java
   SecurityContextHolder.setStrategyName(SecurityContextHolder.MODE_INHERITABLETHREADLOCAL);
   ```

6. **Implement security headers exhaustively** — Use `headers.defaultsDisabled()` and explicitly enable each header for fine-grained control.

### ❌ Critical Anti-Patterns

| Anti-Pattern | Problem | Fix |
|-------------|---------|-----|
| **Catching `AccessDeniedException` in controllers** | Bypasses Spring Security's access denied handling | Let it propagate to `AccessDeniedHandler` |
| **`antMatchers` in Spring Boot 3+** | Removed — compilation error | Use `requestMatchers()` instead |
| **`BCryptPasswordEncoder(4)` in production** | Strength 4 is for testing only — too weak | Use strength ≥ 10 (12 recommended) |
| **Storing JWT in localStorage** | XSS attack can steal tokens | Use `HttpOnly` + `Secure` cookies for refresh tokens |
| **`permitAll()` for all actuator endpoints** | `/actuator/env`, `/actuator/heapdump` expose secrets | Only permit `/health` and `/info` publicly |
| **Same CSRF token for all users** | Token fixation attack | Spring Security's default per-session CSRF is correct — don't override |
| **`.csrf().disable()` for session-based apps** | CSRF attacks possible | Only disable CSRF for stateless REST APIs; keep for web apps |

---

*Next: [02-jwt-dual-token-architecture.md](./02-jwt-dual-token-architecture.md)*
