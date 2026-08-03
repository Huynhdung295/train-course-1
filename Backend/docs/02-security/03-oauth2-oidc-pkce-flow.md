# 🔐 OAuth2 / OpenID Connect (OIDC) with PKCE Flow

> **Category**: Security | **Complexity**: Expert | **Java**: 21+ | **Spring Boot**: 3.3+

---

## 📖 Core Technical Mechanics & Deep-Dive

### OAuth2 Roles and Grant Types

**OAuth2** is an authorization framework, not an authentication protocol. **OIDC** (OpenID Connect) extends OAuth2 to add authentication via the **ID Token**.

**The Four Actors**:
- **Resource Owner** — The user who owns the data
- **Client** — The application requesting access (your SPA, mobile app)
- **Authorization Server** — Issues tokens (Keycloak, Spring Authorization Server, Auth0)
- **Resource Server** — Your Spring Boot API that validates tokens

### Authorization Code Flow with PKCE (Proof Key for Code Exchange)

PKCE was originally designed for mobile apps (cannot safely store secrets) but is now **mandatory** for all SPAs and the recommended flow for all public clients:

```
SPA/Mobile Client                  Authorization Server           Resource Server
       │                                    │                           │
       │ 1. Generate PKCE:                  │                           │
       │    code_verifier = random(32 bytes)│                           │
       │    code_challenge = BASE64(SHA256( │                           │
       │                     code_verifier))│                           │
       │                                    │                           │
       │ 2. GET /authorize?                 │                           │
       │    response_type=code              │                           │
       │    client_id=spa-client            │                           │
       │    redirect_uri=https://app.com/cb │                           │
       │    scope=openid profile email      │                           │
       │    code_challenge=<hash>           │                           │
       │    code_challenge_method=S256 ────►│                           │
       │                                    │                           │
       │ 3. User authenticates at AS        │                           │
       │    (login page, MFA, etc.)         │                           │
       │                                    │                           │
       │◄─── 4. Redirect to callback ───── │                           │
       │    ?code=AUTH_CODE                 │                           │
       │                                    │                           │
       │ 5. POST /token                     │                           │
       │    code=AUTH_CODE                  │                           │
       │    code_verifier=<original>        │                           │
       │    grant_type=authorization_code ─►│                           │
       │                                    │ Verify: SHA256(verifier)  │
       │                                    │ must equal stored challenge│
       │◄─── 6. Response ─────────────────│                           │
       │    access_token                    │                           │
       │    refresh_token                   │                           │
       │    id_token (OIDC)                 │                           │
       │                                    │                           │
       │ 7. GET /api/resource               │                           │
       │    Authorization: Bearer AT ───────┼──────────────────────────►│
       │                                    │  Validates JWT via JWKS    │
       │◄──────────────────────────────────│──────────────────────────  │
       │    Protected resource              │                           │
```

### Why PKCE Prevents Authorization Code Interception

Without PKCE:
- Attacker intercepts the authorization `code` (via URL leak, open redirect, etc.)
- Attacker exchanges code for tokens at `/token` endpoint
- Attack succeeds because no client secret needed for public clients

With PKCE:
- Even with the intercepted `code`, attacker doesn't have the `code_verifier`
- `/token` endpoint verifies: `SHA256(code_verifier) == stored code_challenge`
- Attack fails — code_verifier never leaves the client

### OIDC ID Token

The ID Token is a **JWT** that proves the user authenticated. It contains:
```json
{
  "iss": "https://accounts.company.com",
  "sub": "user-123",
  "aud": "spa-client-id",
  "exp": 1700001000,
  "iat": 1700000000,
  "auth_time": 1699999900,
  "nonce": "client-generated-nonce",
  "name": "Alice Smith",
  "email": "alice@company.com",
  "email_verified": true,
  "roles": ["user", "premium"]
}
```

---

## 🌐 Real-World GitHub Patterns & Industry Reference

### Reference Projects
- **[spring-projects/spring-security-samples/oauth2](https://github.com/spring-projects/spring-security-samples/tree/main/servlet/spring-boot/java/oauth2)** — Official Spring OAuth2 samples (client + resource server)
- **[eugenp/tutorials/spring-security-oauth](https://github.com/eugenp/tutorials/tree/master/spring-security-modules/spring-security-oauth2)** — Baeldung's comprehensive OAuth2 tutorials
- **[Keycloak Quickstarts](https://github.com/keycloak/keycloak-quickstarts)** — Official Keycloak + Spring integration examples

### Industry Pattern: Resource Server with Custom JWT Converter

```java
// Convert Keycloak roles structure to Spring Security authorities
@Component
public class KeycloakJwtGrantedAuthoritiesConverter implements Converter<Jwt, Collection<GrantedAuthority>> {

    @Override
    public Collection<GrantedAuthority> convert(Jwt jwt) {
        var authorities = new ArrayList<GrantedAuthority>();

        // Standard scopes
        var scopes = jwt.getClaimAsStringList("scope");
        if (scopes != null) {
            scopes.forEach(scope -> authorities.add(new SimpleGrantedAuthority("SCOPE_" + scope)));
        }

        // Keycloak realm roles
        var realmAccess = jwt.getClaimAsMap("realm_access");
        if (realmAccess != null) {
            var roles = (List<String>) realmAccess.get("roles");
            if (roles != null) {
                roles.forEach(role -> authorities.add(new SimpleGrantedAuthority("ROLE_" + role.toUpperCase())));
            }
        }

        // Keycloak resource (client) roles
        var resourceAccess = jwt.getClaimAsMap("resource_access");
        if (resourceAccess != null) {
            resourceAccess.forEach((resource, accessMap) -> {
                var roles = (List<String>) ((Map<String, Object>) accessMap).get("roles");
                if (roles != null) {
                    roles.forEach(role -> authorities.add(
                        new SimpleGrantedAuthority("ROLE_" + resource.toUpperCase() + "_" + role.toUpperCase())
                    ));
                }
            });
        }

        return authorities;
    }
}
```

---

## 🏷️ Framework Annotations, Components & Dependencies

### Maven Dependencies

```xml
<!-- OAuth2 Resource Server (validate tokens from external AS) -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-oauth2-resource-server</artifactId>
</dependency>

<!-- OAuth2 Client (for services that also call other protected APIs) -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-oauth2-client</artifactId>
</dependency>

<!-- Spring Authorization Server (if BUILDING your own OAuth2/OIDC server) -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-oauth2-authorization-server</artifactId>
</dependency>
```

---

## ⚙️ Production Configuration & Tuning Parameters

### application.yml — Resource Server (Keycloak)

```yaml
spring:
  security:
    oauth2:
      resourceserver:
        jwt:
          # JWKS endpoint: Spring fetches public keys to verify JWT signatures
          # Keys are cached and rotated automatically
          jwk-set-uri: ${KEYCLOAK_URL:http://localhost:8180}/realms/${KEYCLOAK_REALM:myapp}/protocol/openid-connect/certs
          
          # Optional: Validate issuer claim
          issuer-uri: ${KEYCLOAK_URL:http://localhost:8180}/realms/${KEYCLOAK_REALM:myapp}

# If using OIDC token introspection (opaque tokens) instead of JWT:
# spring.security.oauth2.resourceserver.opaquetoken:
#   introspection-uri: http://keycloak/realms/myapp/protocol/openid-connect/token/introspect
#   client-id: my-backend-client
#   client-secret: ${CLIENT_SECRET}
```

### application.yml — Authorization Server (Spring Authorization Server)

```yaml
spring:
  security:
    oauth2:
      authorizationserver:
        client:
          # SPA client — public client with PKCE (no secret)
          spa-client:
            registration:
              client-id: "spa-frontend"
              client-authentication-methods:
                - none    # Public client — no secret
              authorization-grant-types:
                - authorization_code
                - refresh_token
              redirect-uris:
                - "https://app.company.com/callback"
                - "http://localhost:3000/callback"   # dev only
              post-logout-redirect-uris:
                - "https://app.company.com"
              scopes:
                - openid
                - profile
                - email
                - orders:read
                - orders:write
            require-proof-key: true    # MANDATORY for PKCE
            require-authorization-consent: false   # Skip consent screen for internal apps

          # Machine-to-machine client — Client Credentials flow
          batch-service:
            registration:
              client-id: "batch-service"
              client-secret: "{argon2}$argon2id$..."  # Hashed secret
              client-authentication-methods:
                - client_secret_basic
              authorization-grant-types:
                - client_credentials
              scopes:
                - orders:write
                - inventory:admin
```

---

## 📐 System Design Blueprint & Architecture Patterns

### Complete Resource Server Configuration

```java
@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@RequiredArgsConstructor
public class ResourceServerConfig {

    private final KeycloakJwtGrantedAuthoritiesConverter authoritiesConverter;

    @Bean
    public SecurityFilterChain resourceServerFilterChain(HttpSecurity http) throws Exception {
        return http
            .sessionManagement(s -> s.sessionCreationPolicy(STATELESS))
            .csrf(AbstractHttpConfigurer::disable)
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))

            .authorizeHttpRequests(auth -> auth
                .requestMatchers(HttpMethod.GET, "/api/v1/products/**").permitAll()
                .requestMatchers("/api/v1/orders/**").hasAuthority("SCOPE_orders:read")
                .requestMatchers(HttpMethod.POST, "/api/v1/orders/**").hasAuthority("SCOPE_orders:write")
                .requestMatchers("/api/v1/admin/**").hasRole("ADMIN")
                .anyRequest().authenticated())

            .oauth2ResourceServer(oauth2 -> oauth2
                .jwt(jwt -> jwt
                    .jwtAuthenticationConverter(jwtAuthenticationConverter()))
                .authenticationEntryPoint(customEntryPoint()))

            .build();
    }

    @Bean
    public JwtAuthenticationConverter jwtAuthenticationConverter() {
        var converter = new JwtAuthenticationConverter();
        converter.setJwtGrantedAuthoritiesConverter(authoritiesConverter);

        // Extract user ID from 'sub' claim as principal name
        converter.setPrincipalClaimName(JwtClaimNames.SUB);

        return converter;
    }

    @Bean
    public JwtDecoder jwtDecoder(OAuth2ResourceServerProperties properties) {
        // With JWKS URI — Spring auto-caches and rotates keys
        var jwtDecoder = NimbusJwtDecoder
            .withJwkSetUri(properties.getJwt().getJwkSetUri())
            .jwsAlgorithm(SignatureAlgorithm.RS256)
            .cache(Cache.of(10, Duration.ofMinutes(5)))   // Cache JWKS for 5 min
            .build();

        // Add custom validators
        var validators = new ArrayList<OAuth2TokenValidator<Jwt>>();
        validators.add(new JwtTimestampValidator(Duration.ofSeconds(30))); // 30s clock skew
        validators.add(new JwtIssuerValidator(properties.getJwt().getIssuerUri()));
        validators.add(audienceValidator());

        jwtDecoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(validators));
        return jwtDecoder;
    }

    @Bean
    public OAuth2TokenValidator<Jwt> audienceValidator() {
        return new JwtClaimValidator<>(JwtClaimNames.AUD,
            aud -> aud != null && aud.contains("company-api"));
    }
}

// Controller accessing OAuth2 principal
@RestController
@RequestMapping("/api/v1/orders")
@RequiredArgsConstructor
public class OrderController {

    private final OrderService orderService;

    @GetMapping
    public Page<OrderSummary> getMyOrders(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {

        var userId = jwt.getSubject();
        var email = jwt.getClaimAsString("email");

        return orderService.findByUser(userId, page, size);
    }

    @PostMapping
    @PreAuthorize("hasAuthority('SCOPE_orders:write')")
    public OrderResponse createOrder(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody CreateOrderRequest request) {

        var userId = jwt.getSubject();
        return orderService.create(userId, request);
    }

    // Fine-grained: Only owner can access their own order
    @GetMapping("/{orderId}")
    @PreAuthorize("hasAuthority('SCOPE_orders:read') and @orderSecurity.canAccess(#orderId, authentication)")
    public OrderDetail getOrder(@PathVariable String orderId) {
        return orderService.findById(orderId);
    }
}

// Custom Spring Security SpEL bean for fine-grained access control
@Component("orderSecurity")
@RequiredArgsConstructor
public class OrderSecurityEvaluator {

    private final OrderRepository orderRepository;

    public boolean canAccess(String orderId, Authentication authentication) {
        var jwt = (Jwt) authentication.getPrincipal();
        var userId = jwt.getSubject();
        var isAdmin = authentication.getAuthorities().stream()
            .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));

        if (isAdmin) return true;

        return orderRepository.findById(orderId)
            .map(order -> order.getUserId().equals(userId))
            .orElse(false);
    }
}
```

### Service-to-Service: Client Credentials Flow

```java
// When your backend needs to call another protected backend API
@Configuration
public class ServiceClientConfig {

    @Bean
    public WebClient inventoryClient(OAuth2AuthorizedClientManager clientManager) {
        var oauth2 = new ServletOAuth2AuthorizedClientExchangeFilterFunction(clientManager);
        oauth2.setDefaultClientRegistrationId("inventory-service");  // auto-attach token

        return WebClient.builder()
            .baseUrl("http://inventory-service:8080")
            .apply(oauth2.oauth2Configuration())
            .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
            .build();
    }

    @Bean
    public OAuth2AuthorizedClientManager authorizedClientManager(
            ClientRegistrationRepository repo,
            OAuth2AuthorizedClientService service) {

        var provider = new AuthorizationCodeOAuth2AuthorizedClientProvider();
        var clientCredProvider = new ClientCredentialsOAuth2AuthorizedClientProvider();

        var manager = new AuthorizedClientServiceOAuth2AuthorizedClientManager(repo, service);
        manager.setAuthorizedClientProvider(
            OAuth2AuthorizedClientProviderBuilder.builder()
                .clientCredentials()
                .refreshToken()
                .build()
        );
        return manager;
    }
}

// spring.security.oauth2.client registration for service-to-service
// app:
//   inventory-service:
//     client-id: order-service-client
//     client-secret: ${INVENTORY_CLIENT_SECRET}
//     authorization-grant-type: client_credentials
//     scope: inventory:read,inventory:write
//     token-uri: http://keycloak/realms/myapp/protocol/openid-connect/token
```

---

## 🧪 Verification, Testing & Infrastructure Commands

### Docker: Start Keycloak

```powershell
docker run -d --name keycloak -p 8180:8080 `
  -e KEYCLOAK_ADMIN=admin `
  -e KEYCLOAK_ADMIN_PASSWORD=admin `
  quay.io/keycloak/keycloak:24.0.3 start-dev

# Create realm, client, and users via Keycloak Admin REST API
$adminToken = (Invoke-RestMethod -Method POST `
    -Uri "http://localhost:8180/realms/master/protocol/openid-connect/token" `
    -ContentType "application/x-www-form-urlencoded" `
    -Body "grant_type=password&client_id=admin-cli&username=admin&password=admin"
).access_token

# Create realm
$realm = @{
    realm = "myapp"
    enabled = $true
    accessTokenLifespan = 900        # 15 minutes
    ssoSessionMaxLifespan = 604800   # 7 days (refresh token)
} | ConvertTo-Json

Invoke-RestMethod -Method POST `
    -Uri "http://localhost:8180/admin/realms" `
    -Headers @{ Authorization = "Bearer $adminToken" } `
    -ContentType "application/json" `
    -Body $realm
```

### Test PKCE Flow

```powershell
# 1. Generate PKCE values
$codeVerifier = [Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32)) -replace '\+', '-' -replace '/', '_' -replace '='
$sha256 = [System.Security.Cryptography.SHA256]::Create()
$codeChallenge = [Convert]::ToBase64String($sha256.ComputeHash([System.Text.Encoding]::ASCII.GetBytes($codeVerifier))) -replace '\+', '-' -replace '/', '_' -replace '='

Write-Host "Code Verifier: $codeVerifier"
Write-Host "Code Challenge: $codeChallenge"

# 2. Build authorization URL
$authUrl = "http://localhost:8180/realms/myapp/protocol/openid-connect/auth?" +
    "response_type=code&" +
    "client_id=spa-frontend&" +
    "redirect_uri=http://localhost:3000/callback&" +
    "scope=openid profile email orders:read&" +
    "code_challenge=$codeChallenge&" +
    "code_challenge_method=S256&" +
    "state=random-state-value"

Write-Host "Open in browser: $authUrl"

# 3. After redirect, exchange code (replace AUTH_CODE with actual code)
$tokenBody = "grant_type=authorization_code" +
    "&code=AUTH_CODE" +
    "&redirect_uri=http://localhost:3000/callback" +
    "&client_id=spa-frontend" +
    "&code_verifier=$codeVerifier"

$tokens = Invoke-RestMethod -Method POST `
    -Uri "http://localhost:8180/realms/myapp/protocol/openid-connect/token" `
    -ContentType "application/x-www-form-urlencoded" `
    -Body $tokenBody

# 4. Call API with access token
Invoke-RestMethod -Uri "http://localhost:8080/api/v1/orders" `
    -Headers @{ Authorization = "Bearer $($tokens.access_token)" }
```

---

## ⚡ Senior Best Practices & Critical Anti-Patterns

### ✅ Best Practices

1. **Cache JWKS with a reasonable TTL** — Don't fetch public keys on every request. Cache for 5 minutes with Spring's built-in NimbusJwtDecoder cache support.

2. **Validate `aud` claim** — Without audience validation, a token issued for Service A could be used against Service B.

3. **Use `nonce` for OIDC authentication** — Include a random `nonce` in the authorization request to prevent replay attacks on ID tokens.

4. **Implement token binding** — Bind access tokens to client TLS certificates (mTLS) for high-security APIs.

5. **Monitor JWKS rotation** — Authorization servers rotate keys periodically. Ensure your JWKS fetching handles 404 on old key IDs by re-fetching.

### ❌ Critical Anti-Patterns

| Anti-Pattern | Problem | Fix |
|-------------|---------|-----|
| **Using Implicit Flow** | Deprecated by OAuth 2.1; access token in URL fragment is exposed | Always use Authorization Code + PKCE |
| **Client secrets in public clients** | SPAs and mobile apps cannot keep secrets secure | Use PKCE with `none` client authentication method |
| **Not validating `iss` and `aud`** | Tokens from other realms/issuers accepted | Always validate issuer and audience claims |
| **Trusting JWT without signature verification** | Forged tokens accepted | Always validate signature via JWKS |
| **Storing access token in localStorage** | XSS attack steals token | Use in-memory for access token; HttpOnly cookie for refresh |
| **Not implementing PKCE `state` parameter** | CSRF attack during authorization flow | Always include and validate `state` parameter |

---

*Previous: [02-jwt-dual-token-architecture.md](./02-jwt-dual-token-architecture.md) | Next: [04-keycloak-spring-authorization-server.md](./04-keycloak-spring-authorization-server.md)*
