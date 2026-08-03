# 🔑 JWT Dual-Token Architecture with Redis Revocation

> **Category**: Security | **Complexity**: Expert | **Java**: 21+ | **Spring Boot**: 3.3+ | **Redis**

---

## 📖 Core Technical Mechanics & Deep-Dive

### JWT Structure Internals

A JWT is three Base64URL-encoded segments separated by dots: `header.payload.signature`

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.
eyJzdWIiOiJ1c2VyLTEyMyIsImVtYWlsIjoiYWxpY2VAY29tcGFueS5jb20iLCJyb2xlcyI6WyJVU0VSIl0sImp0aSI6ImFiYzEyMyIsImlhdCI6MTcwMDAwMDAwMCwiZXhwIjoxNzAwMDAwOTAwfQ.
signature
```

**Header**:
```json
{ "alg": "HS256", "typ": "JWT" }
```

**Payload (Claims)**:
```json
{
  "sub": "user-123",                    // Subject (user ID)
  "email": "alice@company.com",         // Custom claim
  "roles": ["USER"],                    // Authorization
  "jti": "abc123",                      // JWT ID (for revocation)
  "iat": 1700000000,                    // Issued At (Unix timestamp)
  "exp": 1700000900,                    // Expiry = iat + 15 minutes
  "iss": "https://auth.company.com",   // Issuer
  "aud": "company-api"                  // Audience
}
```

**Signature**: `HMACSHA256(base64(header) + "." + base64(payload), secret)`

### Why Dual-Token Architecture?

**Single-token problem**: If you set a long expiry (e.g., 30 days), a stolen token gives an attacker 30 days of access. If you set a short expiry (e.g., 5 minutes), users must re-login every 5 minutes.

**Dual-token solution**:
```
Access Token  → Short-lived (5-15 min), sent with every API request
Refresh Token → Long-lived (7-30 days), sent ONLY to /auth/refresh endpoint
```

### Refresh Token Rotation (RTR) — The Security Mechanism

Every time the client uses a refresh token, a NEW refresh token is issued and the OLD one is invalidated. This means:
- Stolen refresh tokens can only be used **once** before detection
- If attacker uses a stolen refresh token, the legitimate user's refresh also fails → **automatic breach detection**

```
Client                    Server                    Redis
  │                          │                        │
  │── POST /auth/refresh ───►│                        │
  │   (with refresh_token_v1)│                        │
  │                          │── Check JTI in ──────►│
  │                          │   blacklist            │
  │                          │◄── Not blacklisted ───│
  │                          │── Validate signature   │
  │                          │── Generate new pair    │
  │                          │── Blacklist old JTI ──►│
  │                          │   (TTL = remaining     │
  │                          │    lifetime of old RT) │
  │◄── New access_token ────│                        │
  │    + refresh_token_v2   │                        │
  │                          │                        │
  │  [ATTACKER uses same RT] │                        │
  │── POST /auth/refresh ───►│                        │
  │   (with refresh_token_v1)│                        │
  │                          │── Check JTI in ──────►│
  │                          │   blacklist            │
  │                          │◄── BLACKLISTED! ──────│
  │◄── 401 Unauthorized ────│                        │
  │   (attack detected)      │                        │
```

---

## 🌐 Real-World GitHub Patterns & Industry Reference

### Reference Projects
- **[Coding with John — JWT in Spring Boot](https://github.com/CodingWithJohn/spring-boot-jwt-tutorial)** — Clean JWT implementation
- **[JHipster security module](https://github.com/jhipster/jhipster-bom/tree/main/jhipster-framework/src/main/java/tech/jhipster/security)** — Production JWT patterns used by JHipster
- **[Spring Boot OAuth2 Resource Server](https://github.com/spring-projects/spring-security-samples/tree/main/servlet/spring-boot/java/oauth2/resource-server)** — Official Spring samples

---

## 🏷️ Framework Annotations, Components & Dependencies

### Maven Dependencies

```xml
<!-- JJWT — most popular JWT library for Java -->
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

<!-- Redis for JTI blacklist + refresh token storage -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-data-redis</artifactId>
</dependency>

<!-- Connection pooling for Redis (Lettuce) -->
<dependency>
    <groupId>io.lettuce</groupId>
    <artifactId>lettuce-core</artifactId>
</dependency>
```

---

## ⚙️ Production Configuration & Tuning Parameters

### application.yml

```yaml
app:
  security:
    jwt:
      # PRODUCTION: Use environment variables, never hardcode
      # Generate: openssl rand -base64 64
      access-token-secret: ${JWT_ACCESS_SECRET:dev-access-secret-min-256-bits-change-in-prod}
      refresh-token-secret: ${JWT_REFRESH_SECRET:dev-refresh-secret-min-256-bits-change-in-prod}
      
      # Token lifetimes
      access-token-expiry: PT15M      # ISO 8601: 15 minutes
      refresh-token-expiry: P7D       # ISO 8601: 7 days
      
      # Issuer for validation
      issuer: https://auth.company.com
      audience: company-api

spring:
  data:
    redis:
      host: ${REDIS_HOST:localhost}
      port: ${REDIS_PORT:6379}
      password: ${REDIS_PASSWORD:}
      database: 0
      timeout: 2000ms
      lettuce:
        pool:
          max-active: 8
          max-idle: 8
          min-idle: 2
          max-wait: 1000ms
        shutdown-timeout: 100ms
```

---

## 📐 System Design Blueprint & Architecture Patterns

### Complete JWT Dual-Token Implementation

```java
// ═══════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════

@ConfigurationProperties(prefix = "app.security.jwt")
@Validated
public record JwtProperties(
    @NotBlank String accessTokenSecret,
    @NotBlank String refreshTokenSecret,
    @NotNull Duration accessTokenExpiry,
    @NotNull Duration refreshTokenExpiry,
    @NotBlank String issuer,
    @NotBlank String audience
) {}

// ═══════════════════════════════════════════════════
// TOKEN SERVICE
// ═══════════════════════════════════════════════════

@Service
@RequiredArgsConstructor
@Slf4j
public class JwtTokenService {

    private final JwtProperties jwtProperties;
    private final StringRedisTemplate redisTemplate;

    // Cache key prefixes
    private static final String BLACKLIST_PREFIX = "jwt:blacklist:";
    private static final String REFRESH_PREFIX   = "jwt:refresh:";

    // ── Token Generation ──────────────────────────
    public TokenPair generateTokenPair(SecurityUser user) {
        var accessJti  = UUID.randomUUID().toString();
        var refreshJti = UUID.randomUUID().toString();
        var now        = Instant.now();

        var accessToken = buildToken(
            user, accessJti, now,
            now.plus(jwtProperties.accessTokenExpiry()),
            jwtProperties.accessTokenSecret(),
            "access"
        );

        var refreshToken = buildToken(
            user, refreshJti, now,
            now.plus(jwtProperties.refreshTokenExpiry()),
            jwtProperties.refreshTokenSecret(),
            "refresh"
        );

        // Store refresh JTI in Redis (allows lookup and invalidation)
        var refreshKey = REFRESH_PREFIX + user.getUserId() + ":" + refreshJti;
        redisTemplate.opsForValue().set(
            refreshKey,
            refreshJti,
            jwtProperties.refreshTokenExpiry()
        );

        return new TokenPair(accessToken, refreshToken, jwtProperties.accessTokenExpiry());
    }

    private String buildToken(SecurityUser user, String jti, Instant iat, Instant exp,
                               String secret, String tokenType) {
        var key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));

        return Jwts.builder()
            .id(jti)
            .subject(user.getUserId().toString())
            .issuer(jwtProperties.issuer())
            .audience().add(jwtProperties.audience()).and()
            .issuedAt(Date.from(iat))
            .expiration(Date.from(exp))
            .claim("email", user.getUsername())
            .claim("roles", user.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority).toList())
            .claim("tenantId", user.getTenantId())
            .claim("type", tokenType)
            .signWith(key)
            .compact();
    }

    // ── Token Validation ──────────────────────────
    public Claims validateAccessToken(String token) {
        var claims = parseToken(token, jwtProperties.accessTokenSecret());

        // Verify token type
        if (!"access".equals(claims.get("type", String.class))) {
            throw new JwtValidationException("Not an access token");
        }

        // Check JTI blacklist
        var jti = claims.getId();
        if (isBlacklisted(jti)) {
            throw new JwtRevokedException("Token has been revoked: " + jti);
        }

        return claims;
    }

    public Claims validateRefreshToken(String token) {
        var claims = parseToken(token, jwtProperties.refreshTokenSecret());

        if (!"refresh".equals(claims.get("type", String.class))) {
            throw new JwtValidationException("Not a refresh token");
        }

        return claims;
    }

    private Claims parseToken(String token, String secret) {
        try {
            var key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
            return Jwts.parser()
                .verifyWith(key)
                .requireIssuer(jwtProperties.issuer())
                .requireAudience(jwtProperties.audience())
                .build()
                .parseSignedClaims(token)
                .getPayload();
        } catch (ExpiredJwtException e) {
            throw new JwtExpiredException("Token expired", e);
        } catch (MalformedJwtException | SignatureException e) {
            throw new JwtValidationException("Invalid token signature or format", e);
        }
    }

    // ── Refresh Token Rotation ────────────────────
    public TokenPair rotateTokens(String refreshToken, SecurityUser user) {
        var claims = validateRefreshToken(refreshToken);
        var oldJti = claims.getId();

        // Calculate remaining lifetime of old refresh token
        var remainingTtl = Duration.between(
            Instant.now(),
            claims.getExpiration().toInstant()
        );

        // Blacklist old refresh token JTI
        blacklistToken(oldJti, remainingTtl);

        // Remove old refresh token from Redis
        var oldKey = REFRESH_PREFIX + user.getUserId() + ":" + oldJti;
        redisTemplate.delete(oldKey);

        // Generate new token pair (RTR)
        log.debug("Rotating tokens for user {}", user.getUserId());
        return generateTokenPair(user);
    }

    // ── Token Revocation ─────────────────────────
    public void revokeAllUserTokens(UUID userId) {
        // Scan and delete all refresh tokens for this user
        var pattern = REFRESH_PREFIX + userId + ":*";
        var keys = redisTemplate.keys(pattern);
        if (keys != null && !keys.isEmpty()) {
            redisTemplate.delete(keys);
        }
        log.info("Revoked all tokens for user {}", userId);
    }

    public void blacklistToken(String jti, Duration ttl) {
        // Use remaining TTL so Redis auto-expires the blacklist entry
        if (ttl.isPositive()) {
            redisTemplate.opsForValue().set(
                BLACKLIST_PREFIX + jti,
                "revoked",
                ttl
            );
        }
    }

    public boolean isBlacklisted(String jti) {
        return Boolean.TRUE.equals(redisTemplate.hasKey(BLACKLIST_PREFIX + jti));
    }
}

// ═══════════════════════════════════════════════════
// JWT AUTHENTICATION FILTER
// ═══════════════════════════════════════════════════

@Component
@RequiredArgsConstructor
@Slf4j
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtTokenService tokenService;
    private final SecurityUserDetailsService userDetailsService;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {

        var authHeader = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            filterChain.doFilter(request, response);
            return;
        }

        var token = authHeader.substring(7);

        try {
            var claims = tokenService.validateAccessToken(token);
            var userId = claims.getSubject();

            // Only set authentication if not already set
            if (SecurityContextHolder.getContext().getAuthentication() == null) {
                var userDetails = userDetailsService.loadUserByUsername(
                    claims.get("email", String.class)
                );

                var authentication = new UsernamePasswordAuthenticationToken(
                    userDetails,
                    null,                           // credentials cleared
                    userDetails.getAuthorities()
                );
                authentication.setDetails(
                    new WebAuthenticationDetailsSource().buildDetails(request)
                );

                SecurityContextHolder.getContext().setAuthentication(authentication);
                log.debug("Authenticated user {} for {}", userId, request.getRequestURI());
            }
        } catch (JwtExpiredException e) {
            log.debug("JWT expired: {}", e.getMessage());
            // Don't set authentication; let 401 flow through ExceptionTranslationFilter
        } catch (JwtValidationException | JwtRevokedException e) {
            log.warn("JWT validation failed: {}", e.getMessage());
        }

        filterChain.doFilter(request, response);
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        // Skip JWT filter for auth endpoints
        var path = request.getServletPath();
        return path.startsWith("/api/v1/auth/") || path.startsWith("/actuator/");
    }
}

// ═══════════════════════════════════════════════════
// AUTH CONTROLLER
// ═══════════════════════════════════════════════════

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
@Slf4j
public class AuthController {

    private final AuthenticationManager authenticationManager;
    private final JwtTokenService tokenService;
    private final SecurityUserDetailsService userDetailsService;

    @PostMapping("/login")
    public ResponseEntity<TokenResponse> login(@Valid @RequestBody LoginRequest request,
                                               HttpServletResponse response) {
        // Authenticate credentials
        var authentication = authenticationManager.authenticate(
            UsernamePasswordAuthenticationToken.unauthenticated(
                request.email(), request.password()
            )
        );

        var user = (SecurityUser) authentication.getPrincipal();
        var tokenPair = tokenService.generateTokenPair(user);

        // Return access token in body; refresh token as HttpOnly cookie
        setRefreshTokenCookie(response, tokenPair.refreshToken());

        return ResponseEntity.ok(new TokenResponse(
            tokenPair.accessToken(),
            tokenPair.expiresIn().getSeconds()
        ));
    }

    @PostMapping("/refresh")
    public ResponseEntity<TokenResponse> refresh(
            @CookieValue(name = "refresh_token", required = false) String refreshToken,
            HttpServletResponse response) {

        if (refreshToken == null) {
            throw new RefreshTokenMissingException("Refresh token cookie not found");
        }

        var claims = tokenService.validateRefreshToken(refreshToken);
        var user = (SecurityUser) userDetailsService.loadUserByUsername(
            claims.get("email", String.class)
        );

        var newTokenPair = tokenService.rotateTokens(refreshToken, user);

        setRefreshTokenCookie(response, newTokenPair.refreshToken());

        return ResponseEntity.ok(new TokenResponse(
            newTokenPair.accessToken(),
            newTokenPair.expiresIn().getSeconds()
        ));
    }

    @PostMapping("/logout")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Void> logout(
            @CookieValue(name = "refresh_token", required = false) String refreshToken,
            @AuthenticationPrincipal SecurityUser user,
            HttpServletResponse response) {

        // Blacklist current access token (get JTI from context if needed)
        if (refreshToken != null) {
            try {
                var claims = tokenService.validateRefreshToken(refreshToken);
                tokenService.revokeAllUserTokens(user.getUserId());
            } catch (JwtValidationException e) {
                log.warn("Could not validate refresh token during logout");
            }
        }

        // Clear cookie
        var cookie = new Cookie("refresh_token", null);
        cookie.setMaxAge(0);
        cookie.setPath("/api/v1/auth");
        response.addCookie(cookie);

        return ResponseEntity.noContent().build();
    }

    private void setRefreshTokenCookie(HttpServletResponse response, String refreshToken) {
        ResponseCookie cookie = ResponseCookie.from("refresh_token", refreshToken)
            .httpOnly(true)           // Cannot be accessed by JavaScript (XSS protection)
            .secure(true)             // HTTPS only
            .sameSite("Strict")       // CSRF protection
            .path("/api/v1/auth")     // Only sent to /auth endpoints
            .maxAge(Duration.ofDays(7))
            .build();
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
    }
}

// Records for request/response DTOs
public record LoginRequest(
    @NotBlank @Email String email,
    @NotBlank @Size(min = 8) String password
) {}

public record TokenResponse(String accessToken, long expiresIn) {}

public record TokenPair(String accessToken, String refreshToken, Duration expiresIn) {}
```

---

## 🧪 Verification, Testing & Infrastructure Commands

### Docker: Start Redis

```powershell
docker run -d --name redis-auth -p 6379:6379 `
  redis:7-alpine `
  redis-server --requirepass "auth-secret" --save 60 1000 --appendonly yes
```

### Test the Complete Auth Flow

```powershell
# 1. Login
$loginBody = @{
    email = "alice@example.com"
    password = "SecurePass123!"
} | ConvertTo-Json

$loginResponse = Invoke-RestMethod -Method POST `
    -Uri "http://localhost:8080/api/v1/auth/login" `
    -ContentType "application/json" `
    -Body $loginBody `
    -SessionVariable session

$accessToken = $loginResponse.accessToken
Write-Host "Access Token (first 20 chars): $($accessToken.Substring(0, 20))..."
Write-Host "Expires in: $($loginResponse.expiresIn) seconds"

# 2. Use access token
Invoke-RestMethod -Uri "http://localhost:8080/api/v1/orders" `
    -Headers @{ Authorization = "Bearer $accessToken" }

# 3. Refresh (using session cookies for refresh_token cookie)
$newTokens = Invoke-RestMethod -Method POST `
    -Uri "http://localhost:8080/api/v1/auth/refresh" `
    -WebSession $session

Write-Host "New access token received"

# 4. Verify old refresh token is now invalid (blacklisted via RTR)
# (Attempting to refresh again with old cookie should return 401)

# 5. Logout
Invoke-RestMethod -Method POST `
    -Uri "http://localhost:8080/api/v1/auth/logout" `
    -Headers @{ Authorization = "Bearer $($newTokens.accessToken)" } `
    -WebSession $session

# 6. Verify token is now invalid
try {
    Invoke-RestMethod -Uri "http://localhost:8080/api/v1/orders" `
        -Headers @{ Authorization = "Bearer $($newTokens.accessToken)" }
} catch {
    Write-Host "Expected 401: $($_.Exception.Response.StatusCode)"
}

# Check Redis blacklist
docker exec redis-auth redis-cli -a "auth-secret" KEYS "jwt:blacklist:*"
docker exec redis-auth redis-cli -a "auth-secret" KEYS "jwt:refresh:*"
```

---

## ⚡ Senior Best Practices & Critical Anti-Patterns

### ✅ Best Practices

1. **Use RS256 (RSA asymmetric) for multi-service architectures** — Services verify tokens with public key without knowing the private key. Only auth service needs the private key.

2. **Never put sensitive data in JWT payload** — JWT payload is Base64-encoded, NOT encrypted. Anyone can decode it. Only put non-sensitive identifiers.

3. **Store refresh tokens as `HttpOnly; Secure; SameSite=Strict` cookies** — Not in localStorage (XSS) or regular cookies (CSRF). This combination is optimal.

4. **JTI blacklist TTL = remaining token lifetime** — Don't set arbitrary TTLs; use the exact remaining lifetime so Redis auto-cleans expired entries.

5. **Implement `jti` clock skew tolerance** — Allow 30s of clock skew between issuer and verifier in distributed systems.

6. **Log token events without logging tokens** — Log `{action: "TOKEN_ISSUED", jti: "abc", userId: "user-123"}` but NEVER the full token string.

### ❌ Critical Anti-Patterns

| Anti-Pattern | Problem | Fix |
|-------------|---------|-----|
| **Long-lived access tokens (>1 hour)** | Stolen tokens remain valid for too long | 5-15 minute access tokens + refresh rotation |
| **Refresh token in URL params** | Appears in server logs, browser history, Referer headers | Always use `POST` body or `HttpOnly` cookie |
| **No JTI tracking** | No way to revoke individual tokens (only blacklist = "logout works everywhere") | Track JTI per user; revoke by JTI |
| **Symmetric key for multi-service** | Every service has the signing secret; compromise of any service = all tokens compromised | Use RS256 with asymmetric keys |
| **Returning refresh token in JSON body** | Client stores in localStorage = XSS vulnerable | Refresh token ONLY in `HttpOnly` cookie |
| **Not invalidating refresh token on password change** | Attacker who compromised account retains access | Call `revokeAllUserTokens()` on password change, email change, suspicious activity |
| **MD5/SHA1 for JWT signing** | Cryptographically broken | Use HS256 minimum; HS512 or RS256 preferred |

---

*Previous: [01-spring-security-fundamentals.md](./01-spring-security-fundamentals.md) | Next: [03-oauth2-oidc-pkce-flow.md](./03-oauth2-oidc-pkce-flow.md)*
