# 🔐 Passkey / FIDO2 / WebAuthn — Passwordless Authentication

> **Category**: Security | **Complexity**: Expert | **Java**: 21+ | **Spring Boot**: 3.3+

---

## 📖 Core Technical Mechanics & Deep-Dive

### WebAuthn Protocol Fundamentals

**WebAuthn** (Web Authentication API) is a W3C standard that enables passwordless and hardware-bound authentication using **public key cryptography** instead of shared secrets (passwords).

**Key Actors**:
- **Relying Party (RP)** — Your web server (Spring Boot backend)
- **Authenticator** — Hardware (YubiKey, Touch ID, Face ID, Windows Hello, Android fingerprint)
- **User Agent** — Browser that mediates between RP and Authenticator

**Two Operations**:
1. **Registration** (Attestation) — Register a new credential/device
2. **Authentication** (Assertion) — Authenticate with a registered credential

### Registration Flow (Attestation)

```
Browser                    Spring Boot Server              Authenticator (Biometric)
   │                              │                               │
   │ 1. POST /auth/passkey/register/options ───────────────────► │
   │                              │ Generate:                     │
   │                              │  - challenge (32 random bytes)│
   │                              │  - user.id (opaque handle)    │
   │                              │  - rp.id (domain)             │
   │                              │  - pubKeyCredParams (algos)   │
   │◄── 2. PublicKeyCredentialCreationOptions ─────────────────   │
   │                              │                               │
   │ 3. navigator.credentials.create(options) ─────────────────► │
   │                              │ Touch ID / Face ID prompt     │
   │                              │ Generate key pair:            │
   │                              │  - Private key (NEVER leaves) │
   │                              │  - Public key (returned)      │
   │◄── 4. AuthenticatorAttestationResponse ───────────────────   │
   │                              │                               │
   │ 5. POST /auth/passkey/register/finish (attestation) ──────► │
   │                              │ Verify:                        │
   │                              │  - challenge matches           │
   │                              │  - rpId matches domain         │
   │                              │  - signature valid             │
   │                              │ Store: public key + credId     │
   │◄── 6. Registration complete ─────────────────────────────   │
```

### Authentication Flow (Assertion)

```
Browser                    Spring Boot Server              Authenticator
   │                              │                               │
   │ 1. POST /auth/passkey/login/options ──────────────────────► │
   │                              │ Generate:                     │
   │                              │  - challenge (32 random bytes)│
   │◄── 2. PublicKeyCredentialRequestOptions ──────────────────   │
   │                              │                               │
   │ 3. navigator.credentials.get(options) ────────────────────► │
   │                              │ User verifies (biometric)     │
   │                              │ Sign challenge with priv key  │
   │◄── 4. AuthenticatorAssertionResponse ─────────────────────   │
   │                              │                               │
   │ 5. POST /auth/passkey/login/finish (assertion) ───────────► │
   │                              │ Verify:                        │
   │                              │  - challenge matches           │
   │                              │  - Signature valid (pub key)   │
   │                              │  - Counter > stored counter    │
   │                              │ Issue JWT tokens               │
   │◄── 6. JWT Access + Refresh ──────────────────────────────   │
```

### FIDO2 vs WebAuthn vs Passkeys

| Term | Definition |
|------|-----------|
| **FIDO2** | FIDO Alliance umbrella: CTAP2 (authenticator protocol) + WebAuthn |
| **WebAuthn** | W3C Web API standard (JavaScript browser API + server protocol) |
| **Passkeys** | Google/Apple/Microsoft consumer branding for cross-device FIDO2 credentials |
| **Platform Authenticator** | Built-in: Touch ID, Face ID, Windows Hello, Android |
| **Roaming Authenticator** | External: YubiKey, Titan Key |

---

## 🌐 Real-World GitHub Patterns & Industry Reference

### Libraries
- **[webauthn4j/webauthn4j-spring-security](https://github.com/webauthn4j/webauthn4j-spring-security)** — The definitive WebAuthn Spring Security integration
- **[Yubico/java-webauthn-server](https://github.com/Yubico/java-webauthn-server)** — Yubico's Java WebAuthn server library
- **[passwordless/webauthn-demo](https://github.com/nicktacular/php-webauthn-demo)** — Reference implementation patterns

---

## 🏷️ Framework Annotations, Components & Dependencies

### Maven Dependencies

```xml
<!-- webauthn4j-spring-security — Spring Security integration -->
<dependency>
    <groupId>com.webauthn4j</groupId>
    <artifactId>webauthn4j-spring-security-core</artifactId>
    <version>0.9.5.RELEASE</version>
</dependency>

<!-- OR use Yubico's library (more actively maintained) -->
<dependency>
    <groupId>com.yubico</groupId>
    <artifactId>webauthn-server-core</artifactId>
    <version>2.5.0</version>
</dependency>
<dependency>
    <groupId>com.yubico</groupId>
    <artifactId>webauthn-server-attestation</artifactId>
    <version>2.5.0</version>
</dependency>

<!-- CBOR parsing for WebAuthn data -->
<dependency>
    <groupId>com.upokecenter</groupId>
    <artifactId>cbor</artifactId>
    <version>4.5.4</version>
</dependency>

<!-- Redis for challenge storage -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-data-redis</artifactId>
</dependency>
```

---

## ⚙️ Production Configuration & Tuning Parameters

### application.yml

```yaml
app:
  webauthn:
    rp-id: "company.com"                    # Domain (MUST match browser origin)
    rp-name: "Company App"                  # Human-readable name
    origins:
      - "https://app.company.com"
      - "https://company.com"
      - "http://localhost:3000"             # dev only
    
    # Challenge parameters
    challenge-ttl: PT5M                     # 5 minutes for challenge
    
    # Allowed algorithms: ES256 (-7), RS256 (-257)
    allowed-algorithms:
      - -7    # ES256 (ECDSA with P-256) — preferred
      - -257  # RS256 (RSASSA-PKCS1-v1_5) — for compatibility
    
    # Attestation
    attestation-conveyance: none            # direct | indirect | none | enterprise
    user-verification: preferred            # required | preferred | discouraged
    resident-keys: preferred                # required (passkeys) | preferred | discouraged
    
    # Authenticator attachment
    authenticator-attachment: platform      # platform (biometric) | cross-platform (key) | null (any)
```

---

## 📐 System Design Blueprint & Architecture Patterns

### Complete WebAuthn Implementation with Yubico Library

```java
// ═══════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════

@Configuration
@ConfigurationProperties(prefix = "app.webauthn")
@Validated
@Data
public class WebAuthnProperties {
    @NotBlank private String rpId;
    @NotBlank private String rpName;
    @NotEmpty private Set<String> origins;
    private Duration challengeTtl = Duration.ofMinutes(5);
}

@Configuration
@RequiredArgsConstructor
public class WebAuthnConfig {

    private final WebAuthnProperties props;

    @Bean
    public RelyingPartyIdentity relyingPartyIdentity() {
        return RelyingPartyIdentity.builder()
            .id(props.getRpId())
            .name(props.getRpName())
            .build();
    }

    @Bean
    public RelyingParty relyingParty(
            RelyingPartyIdentity rpIdentity,
            CredentialRepository credentialRepository) {

        return RelyingParty.builder()
            .identity(rpIdentity)
            .credentialRepository(credentialRepository)
            .origins(props.getOrigins())
            .attestationConveyancePreference(AttestationConveyancePreference.NONE)
            .allowUntrustedAttestation(true)
            .validateSignatureCounter(true)    // Detect cloned authenticators
            .build();
    }
}

// ═══════════════════════════════════════════════════
// CREDENTIAL REPOSITORY (JPA-backed)
// ═══════════════════════════════════════════════════

@Service
@RequiredArgsConstructor
public class JpaCredentialRepository implements CredentialRepository {

    private final PasskeyCredentialJpaRepository jpaRepo;
    private final UserRepository userRepo;

    @Override
    public Set<PublicKeyCredentialDescriptor> getCredentialIdsForUsername(String username) {
        return jpaRepo.findByUserEmail(username).stream()
            .map(cred -> PublicKeyCredentialDescriptor.builder()
                .id(new ByteArray(cred.getCredentialIdBytes()))
                .type(PublicKeyCredentialType.PUBLIC_KEY)
                .build())
            .collect(Collectors.toSet());
    }

    @Override
    public Optional<ByteArray> getUserHandleForUsername(String username) {
        return userRepo.findByEmail(username)
            .map(user -> new ByteArray(user.getId().toString().getBytes(StandardCharsets.UTF_8)));
    }

    @Override
    public Optional<String> getUsernameForUserHandle(ByteArray userHandle) {
        var userId = new String(userHandle.getBytes(), StandardCharsets.UTF_8);
        return userRepo.findById(UUID.fromString(userId)).map(User::getEmail);
    }

    @Override
    public Optional<RegisteredCredential> lookup(ByteArray credentialId, ByteArray userHandle) {
        return jpaRepo.findByCredentialId(credentialId.getBase64Url())
            .map(cred -> RegisteredCredential.builder()
                .credentialId(new ByteArray(cred.getCredentialIdBytes()))
                .userHandle(userHandle)
                .publicKeyCose(new ByteArray(cred.getPublicKeyCoseBytes()))
                .signatureCount(cred.getSignatureCount())
                .build());
    }

    @Override
    public Set<RegisteredCredential> lookupAll(ByteArray credentialId) {
        return jpaRepo.findByCredentialId(credentialId.getBase64Url())
            .map(cred -> (Set<RegisteredCredential>) Set.of(
                RegisteredCredential.builder()
                    .credentialId(new ByteArray(cred.getCredentialIdBytes()))
                    .userHandle(new ByteArray(cred.getUserHandleBytes()))
                    .publicKeyCose(new ByteArray(cred.getPublicKeyCoseBytes()))
                    .signatureCount(cred.getSignatureCount())
                    .build()
            ))
            .orElse(Set.of());
    }
}

// ═══════════════════════════════════════════════════
// WEBAUTHN SERVICE
// ═══════════════════════════════════════════════════

@Service
@RequiredArgsConstructor
@Slf4j
public class WebAuthnService {

    private final RelyingParty relyingParty;
    private final PasskeyCredentialJpaRepository credentialRepo;
    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;

    // ── Registration ─────────────────────────────

    public PublicKeyCredentialCreationOptions startRegistration(UUID userId, String email) {
        var userHandle = new ByteArray(userId.toString().getBytes(StandardCharsets.UTF_8));

        var options = relyingParty.startRegistration(
            StartRegistrationOptions.builder()
                .user(UserIdentity.builder()
                    .name(email)
                    .displayName(email)
                    .id(userHandle)
                    .build())
                .authenticatorSelection(AuthenticatorSelectionCriteria.builder()
                    .residentKey(ResidentKeyRequirement.REQUIRED)        // Passkey (discoverable)
                    .userVerification(UserVerificationRequirement.REQUIRED)  // Biometric
                    .authenticatorAttachment(AuthenticatorAttachment.PLATFORM)  // Built-in
                    .build())
                .timeout(Duration.ofMinutes(5))
                .build()
        );

        // Store registration challenge in Redis (5-minute TTL)
        var challengeKey = "webauthn:reg:" + userId;
        var json = objectMapper.writeValueAsString(options);
        redisTemplate.opsForValue().set(challengeKey, json, Duration.ofMinutes(5));

        return options;
    }

    @Transactional
    public boolean finishRegistration(UUID userId, String email, String credentialJson) {
        var challengeKey = "webauthn:reg:" + userId;
        var storedJson = redisTemplate.opsForValue().get(challengeKey);

        if (storedJson == null) {
            throw new WebAuthnChallengeExpiredException("Registration challenge expired");
        }

        var request = objectMapper.readValue(storedJson, PublicKeyCredentialCreationOptions.class);
        var credential = PublicKeyCredential.parseRegistrationResponseJson(credentialJson);

        var result = relyingParty.finishRegistration(
            FinishRegistrationOptions.builder()
                .request(request)
                .response(credential)
                .build()
        );

        // Store credential
        var entity = new PasskeyCredential();
        entity.setUserId(userId);
        entity.setCredentialId(result.getKeyId().getId().getBase64Url());
        entity.setCredentialIdBytes(result.getKeyId().getId().getBytes());
        entity.setPublicKeyCoseBytes(result.getPublicKeyCose().getBytes());
        entity.setSignatureCount(result.getSignatureCount());
        entity.setAaguid(result.getAaguid().getHex());
        entity.setUserVerified(result.isUserVerified());
        entity.setDeviceDisplayName("Passkey on " + result.getAaguid().getHex());
        entity.setCreatedAt(Instant.now());
        credentialRepo.save(entity);

        redisTemplate.delete(challengeKey);
        log.info("Passkey registered for user {}: credId={}", userId,
            entity.getCredentialId().substring(0, 10) + "...");
        return true;
    }

    // ── Authentication ────────────────────────────

    public AssertionRequest startAuthentication(String usernameHint) {
        var options = relyingParty.startAssertion(
            StartAssertionOptions.builder()
                .username(Optional.ofNullable(usernameHint))
                .userVerification(UserVerificationRequirement.REQUIRED)
                .timeout(Duration.ofMinutes(5))
                .build()
        );

        // Store challenge (keyed by challenge bytes for lookup)
        var challengeKey = "webauthn:auth:" + options.getPublicKeyCredentialRequestOptions()
            .getChallenge().getBase64Url();
        var json = objectMapper.writeValueAsString(options);
        redisTemplate.opsForValue().set(challengeKey, json, Duration.ofMinutes(5));

        return options;
    }

    @Transactional
    public String finishAuthentication(String credentialJson) {
        var credential = PublicKeyCredential.parseAssertionResponseJson(credentialJson);

        // Recover challenge from Redis
        var challenge = credential.getResponse().getClientData().getChallenge();
        var challengeKey = "webauthn:auth:" + challenge.getBase64Url();
        var storedJson = redisTemplate.opsForValue().get(challengeKey);

        if (storedJson == null) {
            throw new WebAuthnChallengeExpiredException("Authentication challenge expired");
        }

        var request = objectMapper.readValue(storedJson, AssertionRequest.class);

        var result = relyingParty.finishAssertion(
            FinishAssertionOptions.builder()
                .request(request)
                .response(credential)
                .build()
        );

        if (!result.isSuccess()) {
            throw new WebAuthnAuthenticationFailedException("WebAuthn assertion failed");
        }

        // Update signature counter (replay attack detection)
        credentialRepo.updateSignatureCount(
            credential.getId().getBase64Url(),
            result.getSignatureCount()
        );

        redisTemplate.delete(challengeKey);

        var username = result.getUsername();
        log.info("Passkey authentication successful for {}", username);
        return username;
    }
}

// ═══════════════════════════════════════════════════
// CONTROLLER
// ═══════════════════════════════════════════════════

@RestController
@RequestMapping("/api/v1/auth/passkey")
@RequiredArgsConstructor
public class PasskeyController {

    private final WebAuthnService webAuthnService;
    private final JwtTokenService jwtService;
    private final SecurityUserDetailsService userDetailsService;

    @PostMapping("/register/options")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<String> registrationOptions(@AuthenticationPrincipal SecurityUser user) {
        var options = webAuthnService.startRegistration(user.getUserId(), user.getUsername());
        return ResponseEntity.ok(options.toCredentialsCreateJson());
    }

    @PostMapping("/register/finish")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Map<String, Boolean>> finishRegistration(
            @AuthenticationPrincipal SecurityUser user,
            @RequestBody String credentialJson) {
        var success = webAuthnService.finishRegistration(
            user.getUserId(), user.getUsername(), credentialJson
        );
        return ResponseEntity.ok(Map.of("success", success));
    }

    @PostMapping("/login/options")
    public ResponseEntity<String> loginOptions(
            @RequestParam(required = false) String username) {
        var request = webAuthnService.startAuthentication(username);
        return ResponseEntity.ok(request.toCredentialsGetJson());
    }

    @PostMapping("/login/finish")
    public ResponseEntity<TokenResponse> finishLogin(@RequestBody String credentialJson) {
        var username = webAuthnService.finishAuthentication(credentialJson);
        var user = (SecurityUser) userDetailsService.loadUserByUsername(username);
        var tokenPair = jwtService.generateTokenPair(user);
        return ResponseEntity.ok(TokenResponse.from(tokenPair));
    }
}
```

---

## 🧪 Verification, Testing & Infrastructure Commands

```powershell
# Test passkey registration options (authenticated)
$regOptions = Invoke-RestMethod -Method POST `
    -Uri "http://localhost:8080/api/v1/auth/passkey/register/options" `
    -Headers @{ Authorization = "Bearer $accessToken" }

Write-Host "Challenge: $($regOptions.challenge)"
Write-Host "RP ID: $($regOptions.rp.id)"

# The actual credential creation happens in browser JavaScript:
# const credential = await navigator.credentials.create({ publicKey: regOptions })
# Then POST the credential JSON to /register/finish

# Test passkey login options
$loginOptions = Invoke-RestMethod -Method POST `
    -Uri "http://localhost:8080/api/v1/auth/passkey/login/options"

Write-Host "Authentication challenge: $($loginOptions.challenge)"
```

---

## ⚡ Senior Best Practices & Critical Anti-Patterns

### ✅ Best Practices

1. **Always validate signature counter** — Monotonically increasing counters detect cloned authenticators. `validateSignatureCounter(true)` is mandatory.

2. **Store challenges in Redis with short TTL** — 5-minute maximum. Challenges are single-use; delete after verification.

3. **Support both `platform` and `cross-platform` authenticators** — Don't force platform-only; enterprise users have YubiKeys.

4. **Provide passkey management UI** — Users must be able to list, name, and delete their registered passkeys.

5. **Allow multiple passkeys per account** — Users have multiple devices. Support at least 5 passkeys per user.

6. **Require `userVerification: required`** — This ensures biometric verification; `preferred` means it can be bypassed.

### ❌ Critical Anti-Patterns

| Anti-Pattern | Problem | Fix |
|-------------|---------|-----|
| **Not validating `rpId`** | FIDO2 attacks from different origins | Verify `rpId` matches your domain exactly |
| **Not storing signature counter** | Cloned authenticator attacks undetected | Persist and validate counter on every assertion |
| **Challenge reuse** | Replay attacks | Delete challenge from Redis immediately after use |
| **Allowing localhost in production** | Security boundary bypass | Only allow localhost in development profile |
| **Not implementing passkey recovery** | Users locked out after device loss | Always provide backup codes or alternative auth at enrollment |

---

*Previous: [05-mfa-totp-otp-implementation.md](./05-mfa-totp-otp-implementation.md) | Next: [07-abac-fine-grained-authorization.md](./07-abac-fine-grained-authorization.md)*
