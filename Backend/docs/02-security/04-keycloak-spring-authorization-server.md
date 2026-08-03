# 🔑 Keycloak & Spring Authorization Server

> **Category**: Security | **Complexity**: Expert | **Java**: 21+ | **Spring Boot**: 3.3+

---

## 📖 Core Technical Mechanics & Deep-Dive

### Spring Authorization Server Architecture

**Spring Authorization Server (SAS)** is the official Spring implementation of an OAuth2/OIDC authorization server. It builds on Spring Security 6 and supports:
- Authorization Code Flow (+ PKCE)
- Client Credentials Flow
- Device Authorization Flow
- Token Exchange (RFC 8693)
- Dynamic Client Registration

```
Spring Authorization Server Internal Architecture:
─────────────────────────────────────────────────
AuthorizationServerSecurityFilterChain
  └── AuthorizationEndpointFilter         (/oauth2/authorize)
  └── TokenEndpointFilter                 (/oauth2/token)
  └── TokenRevocationEndpointFilter       (/oauth2/revoke)
  └── TokenIntrospectionEndpointFilter    (/oauth2/introspect)
  └── JwkSetEndpointFilter               (/.well-known/jwks.json)
  └── OidcUserInfoEndpointFilter         (/userinfo)
  └── OidcLogoutEndpointFilter           (/connect/logout)
  └── OAuth2AuthorizationServerMetadataFilter (/.well-known/oauth-authorization-server)
```

### Keycloak Architecture

Keycloak provides a complete identity and access management solution:
- **Realm** — Isolated tenant; contains users, clients, roles, identity providers
- **Client** — Application registered in Keycloak
- **User Federation** — LDAP/AD integration
- **Identity Brokers** — Social login (Google, GitHub, etc.)
- **Fine-grained Authorization** — Resource server with scopes and policies

### JWKS (JSON Web Key Set) — How Public Key Verification Works

When a Resource Server receives a JWT:
1. Decode header to get `kid` (Key ID)
2. Fetch JWKS from `/.well-known/jwks.json` (cached)
3. Find the key matching `kid`
4. Verify JWT signature using the public key
5. Validate claims (exp, iss, aud)

This means the **authorization server's private key never leaves it** — resource servers only need the public key via JWKS URI.

---

## 🌐 Real-World GitHub Patterns & Industry Reference

### Reference Projects
- **[spring-projects/spring-authorization-server](https://github.com/spring-projects/spring-authorization-server)** — Official SAS samples
- **[keycloak/keycloak](https://github.com/keycloak/keycloak)** — Keycloak source + docs
- **[thomasdarimont/keycloak-project-example](https://github.com/thomasdarimont/keycloak-project-example)** — Enterprise Keycloak patterns

---

## 🏷️ Framework Annotations, Components & Dependencies

### Maven Dependencies — Spring Authorization Server

```xml
<!-- Spring Authorization Server -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-oauth2-authorization-server</artifactId>
</dependency>

<!-- Web, Security, JPA for user management -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-web</artifactId>
</dependency>
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-data-jpa</artifactId>
</dependency>
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-data-redis</artifactId>
</dependency>
```

---

## ⚙️ Production Configuration & Tuning Parameters

### application.yml — Spring Authorization Server

```yaml
spring:
  application:
    name: authorization-server
  
  # JPA for persisting registered clients, authorizations, consent
  datasource:
    url: jdbc:postgresql://localhost:5432/auth_db
    username: ${DB_USER}
    password: ${DB_PASS}
  
  jpa:
    hibernate:
      ddl-auto: none    # Flyway handles the oauth2 schema tables

server:
  port: 9000

# Custom configuration
app:
  authorization-server:
    issuer-url: https://auth.company.com
    access-token-ttl: PT15M      # 15 minutes
    refresh-token-ttl: P7D       # 7 days
    auth-code-ttl: PT5M          # 5 minutes
    device-code-ttl: PT30M       # 30 minutes
    
    # RSA key pair for JWT signing (loaded from keystore)
    keystore:
      location: classpath:keys/authserver.jks
      password: ${KEYSTORE_PASS}
      alias: auth-server-key
```

### Flyway Migration — OAuth2 Tables

```sql
-- V10__oauth2_authorization_server_schema.sql

-- Registered clients
CREATE TABLE oauth2_registered_client (
    id                            varchar(100) NOT NULL,
    client_id                     varchar(100) NOT NULL,
    client_id_issued_at           timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
    client_secret                 varchar(200) DEFAULT NULL,
    client_secret_expires_at      timestamp DEFAULT NULL,
    client_name                   varchar(200) NOT NULL,
    client_authentication_methods varchar(1000) NOT NULL,
    authorization_grant_types     varchar(1000) NOT NULL,
    redirect_uris                 varchar(1000) DEFAULT NULL,
    post_logout_redirect_uris     varchar(1000) DEFAULT NULL,
    scopes                        varchar(1000) NOT NULL,
    client_settings               varchar(2000) NOT NULL,
    token_settings                varchar(2000) NOT NULL,
    PRIMARY KEY (id)
);

-- Active authorizations
CREATE TABLE oauth2_authorization (
    id                            varchar(100) NOT NULL,
    registered_client_id          varchar(100) NOT NULL,
    principal_name                varchar(200) NOT NULL,
    authorization_grant_type      varchar(100) NOT NULL,
    authorized_scopes             varchar(1000) DEFAULT NULL,
    attributes                    text DEFAULT NULL,
    state                         varchar(500) DEFAULT NULL,
    authorization_code_value      text DEFAULT NULL,
    authorization_code_issued_at  timestamp DEFAULT NULL,
    authorization_code_expires_at timestamp DEFAULT NULL,
    authorization_code_metadata   text DEFAULT NULL,
    access_token_value            text DEFAULT NULL,
    access_token_issued_at        timestamp DEFAULT NULL,
    access_token_expires_at       timestamp DEFAULT NULL,
    access_token_metadata         text DEFAULT NULL,
    access_token_type             varchar(100) DEFAULT NULL,
    access_token_scopes           varchar(1000) DEFAULT NULL,
    oidc_id_token_value           text DEFAULT NULL,
    oidc_id_token_issued_at       timestamp DEFAULT NULL,
    oidc_id_token_expires_at      timestamp DEFAULT NULL,
    oidc_id_token_metadata        text DEFAULT NULL,
    refresh_token_value           text DEFAULT NULL,
    refresh_token_issued_at       timestamp DEFAULT NULL,
    refresh_token_expires_at      timestamp DEFAULT NULL,
    refresh_token_metadata        text DEFAULT NULL,
    user_code_value               text DEFAULT NULL,
    user_code_issued_at           timestamp DEFAULT NULL,
    user_code_expires_at          timestamp DEFAULT NULL,
    user_code_metadata            text DEFAULT NULL,
    device_code_value             text DEFAULT NULL,
    device_code_issued_at         timestamp DEFAULT NULL,
    device_code_expires_at        timestamp DEFAULT NULL,
    device_code_metadata          text DEFAULT NULL,
    PRIMARY KEY (id)
);

-- Consent
CREATE TABLE oauth2_authorization_consent (
    registered_client_id varchar(100) NOT NULL,
    principal_name       varchar(200) NOT NULL,
    authorities          varchar(1000) NOT NULL,
    PRIMARY KEY (registered_client_id, principal_name)
);
```

---

## 📐 System Design Blueprint & Architecture Patterns

### Complete Spring Authorization Server Setup

```java
@Configuration
@EnableWebSecurity
public class AuthorizationServerConfig {

    @Bean
    @Order(1)   // Highest priority — auth server endpoints
    public SecurityFilterChain authorizationServerSecurityFilterChain(
            HttpSecurity http,
            AuthorizationServerSettings settings) throws Exception {

        OAuth2AuthorizationServerConfiguration.applyDefaultSecurity(http);

        http.getConfigurer(OAuth2AuthorizationServerConfigurer.class)
            .oidc(Customizer.withDefaults())  // Enable OpenID Connect
            .tokenEndpoint(token -> token
                .accessTokenRequestConverter(
                    new DelegatingAuthenticationConverter(List.of(
                        new OAuth2AuthorizationCodeAuthenticationConverter(),
                        new OAuth2RefreshTokenAuthenticationConverter(),
                        new OAuth2ClientCredentialsAuthenticationConverter()
                    ))
                )
            )
            .authorizationEndpoint(auth -> auth
                .consentPage("/oauth2/consent")  // Custom consent page
            );

        // Resource server for /userinfo endpoint
        http.oauth2ResourceServer(oauth2 -> oauth2.jwt(Customizer.withDefaults()));

        return http
            .exceptionHandling(ex -> ex
                .defaultAuthenticationEntryPointFor(
                    new LoginUrlAuthenticationEntryPoint("/login"),
                    new MediaTypeRequestMatcher(MediaType.TEXT_HTML)
                ))
            .build();
    }

    @Bean
    @Order(2)   // Login page and user security
    public SecurityFilterChain defaultSecurityFilterChain(HttpSecurity http) throws Exception {
        return http
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/actuator/health").permitAll()
                .anyRequest().authenticated())
            .formLogin(form -> form.loginPage("/login").permitAll())
            .build();
    }

    // RSA Key Source (asymmetric keys for RS256 JWT signing)
    @Bean
    public JWKSource<SecurityContext> jwkSource(
            @Value("${app.authorization-server.keystore.location}") Resource keystoreLocation,
            @Value("${app.authorization-server.keystore.password}") String keystorePassword,
            @Value("${app.authorization-server.keystore.alias}") String alias) throws Exception {

        var keyStore = KeyStore.getInstance("JKS");
        keyStore.load(keystoreLocation.getInputStream(), keystorePassword.toCharArray());

        var rsaKey = RSAKey.load(keyStore, alias, keystorePassword.toCharArray());

        return new ImmutableJWKSet<>(new JWKSet(rsaKey));
    }

    @Bean
    public JwtDecoder jwtDecoder(JWKSource<SecurityContext> jwkSource) {
        return OAuth2AuthorizationServerConfiguration.jwtDecoder(jwkSource);
    }

    @Bean
    public AuthorizationServerSettings authorizationServerSettings(
            @Value("${app.authorization-server.issuer-url}") String issuerUrl) {
        return AuthorizationServerSettings.builder()
            .issuer(issuerUrl)
            .authorizationEndpoint("/oauth2/authorize")
            .tokenEndpoint("/oauth2/token")
            .jwkSetEndpoint("/oauth2/jwks")
            .tokenRevocationEndpoint("/oauth2/revoke")
            .tokenIntrospectionEndpoint("/oauth2/introspect")
            .oidcLogoutEndpoint("/connect/logout")
            .oidcUserInfoEndpoint("/userinfo")
            .build();
    }

    // Token customization — add custom claims to JWT
    @Bean
    public OAuth2TokenCustomizer<JwtEncodingContext> tokenCustomizer(UserRepository userRepo) {
        return context -> {
            if (OidcParameterNames.ID_TOKEN.equals(context.getTokenType().getValue())
                    || OAuth2TokenType.ACCESS_TOKEN.equals(context.getTokenType())) {

                var principal = context.getPrincipal();
                var username = principal.getName();

                userRepo.findByEmail(username).ifPresent(user -> {
                    context.getClaims()
                        .claim("userId", user.getId().toString())
                        .claim("tenantId", user.getTenantId())
                        .claim("roles", user.getRoles().stream()
                            .map(Role::name).toList())
                        .claim("firstName", user.getFirstName())
                        .claim("lastName", user.getLastName());
                });
            }
        };
    }

    // Registered Client Repository — DB-backed
    @Bean
    public RegisteredClientRepository registeredClientRepository(JdbcTemplate jdbcTemplate) {
        return new JdbcRegisteredClientRepository(jdbcTemplate);
    }

    // Authorization service — DB-backed
    @Bean
    public OAuth2AuthorizationService authorizationService(
            JdbcTemplate jdbcTemplate,
            RegisteredClientRepository repo) {
        return new JdbcOAuth2AuthorizationService(jdbcTemplate, repo);
    }

    // Consent service — DB-backed
    @Bean
    public OAuth2AuthorizationConsentService authorizationConsentService(
            JdbcTemplate jdbcTemplate,
            RegisteredClientRepository repo) {
        return new JdbcOAuth2AuthorizationConsentService(jdbcTemplate, repo);
    }
}

// ═══════════════════════════════════════════════════
// Register clients programmatically (or via DB)
// ═══════════════════════════════════════════════════

@Component
@RequiredArgsConstructor
public class ClientRegistrationInitializer implements ApplicationRunner {

    private final RegisteredClientRepository clientRepository;

    @Override
    public void run(ApplicationArguments args) {
        // SPA client — PKCE, no secret
        registerIfAbsent(RegisteredClient.withId("spa-client")
            .clientId("spa-frontend")
            .clientName("Company Web App")
            .clientAuthenticationMethod(ClientAuthenticationMethod.NONE)
            .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
            .authorizationGrantType(AuthorizationGrantType.REFRESH_TOKEN)
            .redirectUri("https://app.company.com/callback")
            .redirectUri("http://localhost:3000/callback")
            .postLogoutRedirectUri("https://app.company.com")
            .scope(OidcScopes.OPENID)
            .scope(OidcScopes.PROFILE)
            .scope(OidcScopes.EMAIL)
            .scope("orders:read")
            .scope("orders:write")
            .clientSettings(ClientSettings.builder()
                .requireProofKey(true)                   // PKCE mandatory
                .requireAuthorizationConsent(false)
                .build())
            .tokenSettings(TokenSettings.builder()
                .accessTokenTimeToLive(Duration.ofMinutes(15))
                .refreshTokenTimeToLive(Duration.ofDays(7))
                .reuseRefreshTokens(false)               // RTR — don't reuse
                .build())
            .build());

        // Backend service — Client Credentials
        registerIfAbsent(RegisteredClient.withId("batch-service-client")
            .clientId("batch-service")
            .clientSecret("{argon2}$argon2id$v=19$m=65536,t=2,p=1$..." )
            .clientAuthenticationMethod(ClientAuthenticationMethod.CLIENT_SECRET_BASIC)
            .authorizationGrantType(AuthorizationGrantType.CLIENT_CREDENTIALS)
            .scope("orders:admin")
            .scope("inventory:read")
            .tokenSettings(TokenSettings.builder()
                .accessTokenTimeToLive(Duration.ofHours(1))
                .build())
            .build());
    }

    private void registerIfAbsent(RegisteredClient client) {
        if (clientRepository.findByClientId(client.getClientId()) == null) {
            clientRepository.save(client);
        }
    }
}
```

### Keycloak Realm Export (Import-Ready JSON structure)

```json
{
  "realm": "myapp",
  "enabled": true,
  "sslRequired": "external",
  "accessTokenLifespan": 900,
  "ssoSessionMaxLifespan": 604800,
  "ssoSessionIdleTimeout": 1800,
  "roles": {
    "realm": [
      { "name": "user", "description": "Regular user" },
      { "name": "admin", "description": "Administrator" },
      { "name": "premium", "description": "Premium subscriber" }
    ]
  },
  "clients": [
    {
      "clientId": "spa-frontend",
      "name": "Company Web Application",
      "protocol": "openid-connect",
      "publicClient": true,
      "standardFlowEnabled": true,
      "implicitFlowEnabled": false,
      "directAccessGrantsEnabled": false,
      "serviceAccountsEnabled": false,
      "attributes": {
        "pkce.code.challenge.method": "S256"
      },
      "redirectUris": ["https://app.company.com/*", "http://localhost:3000/*"],
      "webOrigins": ["https://app.company.com", "http://localhost:3000"],
      "defaultClientScopes": ["openid", "profile", "email"],
      "optionalClientScopes": ["orders:read", "orders:write"]
    }
  ],
  "requiredCredentials": ["password"],
  "passwordPolicy": "length(12) and upperCase(1) and lowerCase(1) and digits(1) and specialChars(1) and notUsername() and passwordHistory(5)",
  "bruteForceProtected": true,
  "failureFactor": 5,
  "waitIncrementSeconds": 60,
  "maxWaitSeconds": 900,
  "minimumQuickLoginWaitSeconds": 60
}
```

---

## 🧪 Verification, Testing & Infrastructure Commands

### Docker: Keycloak with PostgreSQL

```powershell
# Keycloak with PostgreSQL backend (production-grade)
docker network create keycloak-net

docker run -d --name postgres-keycloak --network keycloak-net `
  -e POSTGRES_DB=keycloak `
  -e POSTGRES_USER=keycloak `
  -e POSTGRES_PASSWORD=keycloak-secret `
  postgres:16-alpine

docker run -d --name keycloak --network keycloak-net -p 8180:8080 `
  -e KC_DB=postgres `
  -e KC_DB_URL=jdbc:postgresql://postgres-keycloak:5432/keycloak `
  -e KC_DB_USERNAME=keycloak `
  -e KC_DB_PASSWORD=keycloak-secret `
  -e KC_HOSTNAME=localhost `
  -e KC_HOSTNAME_PORT=8180 `
  -e KC_HOSTNAME_STRICT_BACKCHANNEL=true `
  -e KC_HTTP_ENABLED=true `
  -e KEYCLOAK_ADMIN=admin `
  -e KEYCLOAK_ADMIN_PASSWORD=admin `
  quay.io/keycloak/keycloak:24.0.3 start

# Check Keycloak OIDC discovery endpoint
Invoke-RestMethod -Uri "http://localhost:8180/realms/myapp/.well-known/openid-configuration" |
    ConvertTo-Json -Depth 3

# Check JWKS (public keys for JWT verification)
Invoke-RestMethod -Uri "http://localhost:8180/realms/myapp/protocol/openid-connect/certs" |
    ConvertTo-Json -Depth 5

# Generate access token via Client Credentials (for testing)
$tokenResponse = Invoke-RestMethod -Method POST `
    -Uri "http://localhost:8180/realms/myapp/protocol/openid-connect/token" `
    -ContentType "application/x-www-form-urlencoded" `
    -Body "grant_type=client_credentials&client_id=batch-service&client_secret=secret"

Write-Host "Token: $($tokenResponse.access_token.Substring(0, 30))..."
Write-Host "Expires in: $($tokenResponse.expires_in) seconds"

# Import realm from JSON file
Invoke-RestMethod -Method POST `
    -Uri "http://localhost:8180/admin/realms" `
    -Headers @{ Authorization = "Bearer $adminToken" } `
    -ContentType "application/json" `
    -Body (Get-Content -Raw .\realm-export.json)
```

---

## ⚡ Senior Best Practices & Critical Anti-Patterns

### ✅ Best Practices

1. **Use RSA keys (RS256) for JWT signing** — Asymmetric; resource servers only need public key. Rotate private keys without impacting resource servers.

2. **Enable Keycloak brute-force protection** — Automatically in Keycloak Admin > Realm Settings > Security Defenses. Set failure factor, wait times.

3. **Store registered clients in DB, not config** — `JdbcRegisteredClientRepository` allows runtime client management without restarts.

4. **Implement custom consent pages** — Default consent page is ugly; custom consent page improves UX significantly.

5. **Use `reuseRefreshTokens(false)` always** — This enforces Refresh Token Rotation in Spring Authorization Server.

6. **Monitor token issuance via Actuator** — Spring AS exposes metrics for tokens issued, revoked, introspected.

### ❌ Critical Anti-Patterns

| Anti-Pattern | Problem | Fix |
|-------------|---------|-----|
| **Keycloak in development mode in production** | `start-dev` disables HTTPS, uses H2 — completely insecure | Use `start` with PostgreSQL and configure SSL |
| **Hardcoded client secrets** | Secrets in application.yml committed to Git | Use environment variables or Spring Cloud Config/Vault |
| **Symmetric keys (HS256) shared across services** | Every service has the signing key; compromise = full breach | Use RS256 with JWKS; only AS has private key |
| **Not setting token TTLs** | Default long-lived tokens stay valid after user revocation | Configure short access token TTL (15min) + refresh rotation |
| **Not exporting/backing up Keycloak realm** | Disaster recovery impossible without realm config backup | Export realm JSON and store in version control |

---

*Previous: [03-oauth2-oidc-pkce-flow.md](./03-oauth2-oidc-pkce-flow.md) | Next: [05-mfa-totp-otp-implementation.md](./05-mfa-totp-otp-implementation.md)*
