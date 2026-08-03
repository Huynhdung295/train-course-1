# 📱 MFA: TOTP & OTP Implementation

> **Category**: Security | **Complexity**: Advanced | **Java**: 21+ | **Spring Boot**: 3.3+ | **Redis**

---

## 📖 Core Technical Mechanics & Deep-Dive

### TOTP Algorithm Internals (RFC 6238)

**TOTP (Time-based One-Time Password)** generates a 6-digit code that changes every 30 seconds, shared between the user's authenticator app and the server.

```
Algorithm:
1. Shared secret = random 20-byte key (Base32 encoded for QR code)
2. T = floor(Unix timestamp / 30)    ← time step (30 second window)
3. HMAC-SHA1(secret, T)              ← 20 byte HMAC
4. offset = last nibble of HMAC[19]
5. code = (HMAC[offset..offset+4] & 0x7FFFFFFF) % 10^6
6. Zero-pad to 6 digits

Window validation: Accept T-1, T, T+1 (90 second window for clock skew)
```

**HOTP (HMAC-based OTP)** — Same but uses an incrementing counter instead of time. Used for hardware tokens.

### SMS/WhatsApp OTP Flow

```
User requests OTP         Redis stores OTP            User submits OTP
      │                        │                            │
      ▼                        ▼                            ▼
Generate 6-digit OTP    SET otp:{userId}:{purpose}   GET otp:{userId}:{purpose}
   (SecureRandom)          value={otp}               Compare & delete (atomic)
      │                    TTL=5 minutes              Check attempt count
      ▼                        │                      Rate limit check
Send via SMS/WhatsApp          │                            │
   (Twilio/AWS SNS)            ▼                            ▼
                        SET otp:attempts:{userId}    Success → clear attempts
                           TTL=15 minutes            Fail → increment + lock
```

### Rate Limiting with Redis Atomic Counter

The critical security requirement is preventing brute-force OTP guessing (1,000,000 possible 6-digit combinations = trivially brute-forceable without rate limiting):

```java
// Atomic counter pattern using Redis INCR + EXPIRE
String key = "otp:attempts:" + userId;
Long attempts = redisTemplate.opsForValue().increment(key);

if (attempts == 1) {
    // First attempt — set TTL (don't reset TTL on subsequent attempts!)
    redisTemplate.expire(key, Duration.ofMinutes(15));
}

if (attempts > 5) {
    // Lock account for remaining TTL duration
    throw new OtpRateLimitExceededException(userId);
}
```

---

## 🌐 Real-World GitHub Patterns & Industry Reference

### Reference Libraries
- **[aerogear/aerogear-otp-java](https://github.com/aerogear/aerogear-otp-java)** — Java OTP library
- **[wstrange/GoogleAuth](https://github.com/wstrange/GoogleAuth)** — Google Authenticator Java implementation
- **[BastiaanJansen/otp-java](https://github.com/BastiaanJansen/otp-java)** — Modern OTP library for Java

### Maven Dependencies

```xml
<!-- Google Authenticator TOTP library -->
<dependency>
    <groupId>com.warrenstrange</groupId>
    <artifactId>googleauth</artifactId>
    <version>1.5.0</version>
</dependency>

<!-- ZXing for QR code generation -->
<dependency>
    <groupId>com.google.zxing</groupId>
    <artifactId>core</artifactId>
    <version>3.5.3</version>
</dependency>
<dependency>
    <groupId>com.google.zxing</groupId>
    <artifactId>javase</artifactId>
    <version>3.5.3</version>
</dependency>

<!-- Twilio for SMS/WhatsApp OTP -->
<dependency>
    <groupId>com.twilio.sdk</groupId>
    <artifactId>twilio</artifactId>
    <version>10.4.1</version>
</dependency>

<!-- Redis for OTP storage and rate limiting -->
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
  security:
    mfa:
      totp:
        issuer: "Company App"       # Shown in authenticator app
        window-size: 1              # Accept T-1, T, T+1 (3 codes × 30s = 90s window)
        secret-size: 20             # 20 bytes = 160-bit secret (RFC recommendation)
        algorithm: SHA1             # Google Authenticator uses SHA1

      otp:
        length: 6
        ttl-minutes: 5              # OTP expires in 5 minutes
        max-attempts: 5             # Max verification attempts before lockout
        lockout-minutes: 15         # Lock duration after max attempts exceeded
        
        sms:
          provider: twilio          # twilio | aws-sns | nexmo
          
      rate-limit:
        send-otp-per-hour: 3        # Max 3 SMS/WhatsApp per hour per user
        verify-attempts-per-window: 5

spring:
  data:
    redis:
      host: ${REDIS_HOST:localhost}
      port: 6379
      
twilio:
  account-sid: ${TWILIO_ACCOUNT_SID}
  auth-token: ${TWILIO_AUTH_TOKEN}
  from-number: ${TWILIO_FROM_NUMBER}
  messaging-service-sid: ${TWILIO_MESSAGING_SERVICE_SID}
```

---

## 📐 System Design Blueprint & Architecture Patterns

### Complete TOTP Implementation

```java
// ═══════════════════════════════════════════════════
// TOTP SERVICE
// ═══════════════════════════════════════════════════

@Service
@RequiredArgsConstructor
@Slf4j
public class TotpService {

    private final GoogleAuthenticator googleAuthenticator;
    private final UserRepository userRepository;
    private final StringRedisTemplate redisTemplate;

    // Step 1: Generate secret for enrollment
    public TotpEnrollmentData generateEnrollment(UUID userId, String userEmail) {
        // Generate cryptographically secure random secret
        var credentials = googleAuthenticator.createCredentials();
        var secret = credentials.getKey();    // Base32-encoded 20-byte secret

        // Temporarily store pending secret (not yet activated)
        var pendingKey = "totp:pending:" + userId;
        redisTemplate.opsForValue().set(pendingKey, secret, Duration.ofMinutes(10));

        // Generate otpauth:// URI for QR code scanning
        var otpauthUri = GoogleAuthenticatorQRGenerator.getOtpAuthTotpURL(
            "Company App",    // issuer
            userEmail,         // accountName
            credentials
        );

        // Generate QR code as Base64 PNG
        var qrCodeBase64 = generateQrCodeBase64(otpauthUri, 200, 200);

        return new TotpEnrollmentData(
            secret,
            otpauthUri,
            qrCodeBase64,
            List.of(generateBackupCode(), generateBackupCode(),
                    generateBackupCode(), generateBackupCode(),
                    generateBackupCode(), generateBackupCode(),
                    generateBackupCode(), generateBackupCode())  // 8 backup codes
        );
    }

    // Step 2: Verify enrollment code (user must enter one code from their app)
    @Transactional
    public boolean activateTotp(UUID userId, int verificationCode) {
        var pendingKey = "totp:pending:" + userId;
        var pendingSecret = redisTemplate.opsForValue().get(pendingKey);

        if (pendingSecret == null) {
            throw new TotpEnrollmentExpiredException("TOTP enrollment session expired");
        }

        // Verify the code against the pending secret
        if (!googleAuthenticator.authorize(pendingSecret, verificationCode)) {
            return false;
        }

        // Activate — save to user's profile
        var user = userRepository.findById(userId).orElseThrow();
        user.enableTotp(pendingSecret);   // store encrypted in DB
        userRepository.save(user);

        // Clean up pending key
        redisTemplate.delete(pendingKey);

        log.info("TOTP activated for user {}", userId);
        return true;
    }

    // Step 3: Verify TOTP code during login
    public boolean verifyCode(UUID userId, int code) {
        var user = userRepository.findById(userId).orElseThrow();

        if (!user.isTotpEnabled()) {
            throw new TotpNotEnabledException("TOTP not enabled for user " + userId);
        }

        // Check attempt rate limit
        checkRateLimit(userId);

        var secret = user.getTotpSecret();   // decrypt from DB
        var valid = googleAuthenticator.authorize(secret, code);

        if (!valid) {
            recordFailedAttempt(userId);
            log.warn("Invalid TOTP code for user {}, attempt tracked", userId);
        } else {
            clearFailedAttempts(userId);
        }

        return valid;
    }

    // Backup code verification
    @Transactional
    public boolean verifyBackupCode(UUID userId, String providedCode) {
        var user = userRepository.findById(userId).orElseThrow();
        var hashedProvided = hashBackupCode(providedCode);

        var matchedCode = user.getBackupCodes().stream()
            .filter(bc -> !bc.isUsed() && bc.getHash().equals(hashedProvided))
            .findFirst();

        if (matchedCode.isPresent()) {
            matchedCode.get().markUsed();
            userRepository.save(user);
            log.info("Backup code used for user {}, {} remaining",
                userId, user.getBackupCodes().stream().filter(bc -> !bc.isUsed()).count());
            return true;
        }
        return false;
    }

    private void checkRateLimit(UUID userId) {
        var attemptsKey = "totp:attempts:" + userId;
        var attempts = redisTemplate.opsForValue().get(attemptsKey);

        if (attempts != null && Long.parseLong(attempts) >= 5) {
            var ttl = redisTemplate.getExpire(attemptsKey, TimeUnit.SECONDS);
            throw new TotpRateLimitException(
                "Too many TOTP attempts. Try again in " + ttl + " seconds"
            );
        }
    }

    private void recordFailedAttempt(UUID userId) {
        var key = "totp:attempts:" + userId;
        var count = redisTemplate.opsForValue().increment(key);
        if (count == 1) {
            redisTemplate.expire(key, Duration.ofMinutes(15));
        }
    }

    private void clearFailedAttempts(UUID userId) {
        redisTemplate.delete("totp:attempts:" + userId);
    }

    private String generateBackupCode() {
        // Format: XXXX-XXXX-XXXX (12 character alphanumeric)
        var random = new SecureRandom();
        var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        var code = new StringBuilder();
        for (int i = 0; i < 12; i++) {
            if (i > 0 && i % 4 == 0) code.append('-');
            code.append(chars.charAt(random.nextInt(chars.length())));
        }
        return code.toString();
    }

    private String hashBackupCode(String code) {
        // SHA-256 of the normalized code
        var normalized = code.replace("-", "").toUpperCase();
        var digest = MessageDigest.getInstance("SHA-256");
        var hash = digest.digest(normalized.getBytes(StandardCharsets.UTF_8));
        return HexFormat.of().formatHex(hash);
    }

    private String generateQrCodeBase64(String content, int width, int height) {
        try {
            var hints = new HashMap<EncodeHintType, Object>();
            hints.put(EncodeHintType.CHARACTER_SET, "UTF-8");
            hints.put(EncodeHintType.ERROR_CORRECTION, ErrorCorrectionLevel.M);
            hints.put(EncodeHintType.MARGIN, 1);

            var bitMatrix = new QRCodeWriter().encode(content, BarcodeFormat.QR_CODE, width, height, hints);
            var outputStream = new ByteArrayOutputStream();
            MatrixToImageWriter.writeToStream(bitMatrix, "PNG", outputStream);
            return Base64.getEncoder().encodeToString(outputStream.toByteArray());
        } catch (Exception e) {
            throw new QrCodeGenerationException("Failed to generate QR code", e);
        }
    }
}

// ═══════════════════════════════════════════════════
// SMS OTP SERVICE
// ═══════════════════════════════════════════════════

@Service
@RequiredArgsConstructor
@Slf4j
public class SmsOtpService {

    private final StringRedisTemplate redisTemplate;
    private final TwilioSmsProvider smsProvider;

    private static final String OTP_KEY_PREFIX       = "otp:code:";
    private static final String ATTEMPT_KEY_PREFIX   = "otp:attempts:";
    private static final String SEND_RATE_KEY_PREFIX = "otp:send-rate:";
    private static final int OTP_LENGTH              = 6;
    private static final int OTP_TTL_MINUTES         = 5;
    private static final int MAX_VERIFY_ATTEMPTS     = 5;
    private static final int LOCKOUT_MINUTES         = 15;
    private static final int MAX_SENDS_PER_HOUR      = 3;

    // Send OTP (rate-limited)
    public void sendOtp(UUID userId, String phoneNumber, OtpPurpose purpose) {
        // Rate limit sends
        var sendRateKey = SEND_RATE_KEY_PREFIX + userId + ":" + purpose;
        var sendCount = redisTemplate.opsForValue().increment(sendRateKey);
        if (sendCount == 1) {
            redisTemplate.expire(sendRateKey, Duration.ofHours(1));
        }
        if (sendCount > MAX_SENDS_PER_HOUR) {
            throw new OtpSendRateLimitException(
                "Maximum OTP requests exceeded. Please wait before requesting another code."
            );
        }

        // Generate secure OTP
        var otp = generateSecureOtp();

        // Store in Redis with TTL
        var otpKey = OTP_KEY_PREFIX + userId + ":" + purpose;
        redisTemplate.opsForValue().set(
            otpKey,
            otp,
            Duration.ofMinutes(OTP_TTL_MINUTES)
        );

        // Send via SMS
        smsProvider.sendSms(
            phoneNumber,
            String.format("[Company] Your verification code is: %s. Valid for %d minutes.",
                otp, OTP_TTL_MINUTES)
        );

        log.info("OTP sent to phone {}*** for user {} purpose {}",
            phoneNumber.substring(0, 4), userId, purpose);
    }

    // Verify OTP
    public boolean verifyOtp(UUID userId, OtpPurpose purpose, String submittedOtp) {
        var attemptsKey = ATTEMPT_KEY_PREFIX + userId + ":" + purpose;

        // Check lockout
        var attempts = redisTemplate.opsForValue().get(attemptsKey);
        if (attempts != null && Long.parseLong(attempts) >= MAX_VERIFY_ATTEMPTS) {
            var ttl = redisTemplate.getExpire(attemptsKey, TimeUnit.SECONDS);
            throw new OtpLockedOutException(
                "Account locked. Try again in " + (ttl / 60) + " minutes"
            );
        }

        var otpKey = OTP_KEY_PREFIX + userId + ":" + purpose;
        var storedOtp = redisTemplate.opsForValue().get(otpKey);

        if (storedOtp == null) {
            throw new OtpExpiredException("OTP has expired. Please request a new code.");
        }

        // Constant-time comparison to prevent timing attacks
        if (!MessageDigest.isEqual(
                storedOtp.getBytes(StandardCharsets.UTF_8),
                submittedOtp.getBytes(StandardCharsets.UTF_8))) {

            // Increment failed attempts
            var newCount = redisTemplate.opsForValue().increment(attemptsKey);
            if (newCount == 1) {
                redisTemplate.expire(attemptsKey, Duration.ofMinutes(LOCKOUT_MINUTES));
            }
            log.warn("Invalid OTP attempt {} for user {}", newCount, userId);
            return false;
        }

        // Success — delete OTP (single-use) and clear attempts
        redisTemplate.delete(otpKey);
        redisTemplate.delete(attemptsKey);
        log.info("OTP verified successfully for user {} purpose {}", userId, purpose);
        return true;
    }

    private String generateSecureOtp() {
        var random = new SecureRandom();
        var digits = new StringBuilder();
        for (int i = 0; i < OTP_LENGTH; i++) {
            digits.append(random.nextInt(10));
        }
        return digits.toString();
    }
}

enum OtpPurpose { LOGIN, PHONE_VERIFICATION, PASSWORD_RESET, PAYMENT_CONFIRMATION }

// ═══════════════════════════════════════════════════
// MFA-AWARE AUTHENTICATION CONTROLLER
// ═══════════════════════════════════════════════════

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class MfaAuthController {

    private final AuthenticationManager authManager;
    private final TotpService totpService;
    private final JwtTokenService jwtTokenService;
    private final StringRedisTemplate redisTemplate;

    // Step 1: Initial password login
    @PostMapping("/login")
    public ResponseEntity<?> login(@Valid @RequestBody LoginRequest request) {
        var auth = authManager.authenticate(
            UsernamePasswordAuthenticationToken.unauthenticated(request.email(), request.password())
        );

        var user = (SecurityUser) auth.getPrincipal();

        if (user.getUser().isTotpEnabled()) {
            // Issue a temporary MFA challenge token
            var challengeId = UUID.randomUUID().toString();
            redisTemplate.opsForValue().set(
                "mfa:challenge:" + challengeId,
                user.getUserId().toString(),
                Duration.ofMinutes(5)
            );

            return ResponseEntity.ok(Map.of(
                "mfaRequired", true,
                "mfaChallengeId", challengeId,
                "mfaMethods", List.of("TOTP")
            ));
        }

        // No MFA — issue tokens directly
        var tokenPair = jwtTokenService.generateTokenPair(user);
        return ResponseEntity.ok(TokenResponse.from(tokenPair));
    }

    // Step 2: TOTP verification
    @PostMapping("/mfa/totp/verify")
    public ResponseEntity<TokenResponse> verifyTotp(
            @Valid @RequestBody TotpVerifyRequest request) {

        var userIdStr = redisTemplate.opsForValue().get(
            "mfa:challenge:" + request.challengeId()
        );

        if (userIdStr == null) {
            throw new MfaChallengeExpiredException("MFA challenge expired or invalid");
        }

        var userId = UUID.fromString(userIdStr);
        var valid = totpService.verifyCode(userId, request.code());

        if (!valid) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(null);
        }

        // Clean up challenge
        redisTemplate.delete("mfa:challenge:" + request.challengeId());

        // Load user and issue full tokens
        var user = userDetailsService.loadById(userId);
        var tokenPair = jwtTokenService.generateTokenPair(user);
        return ResponseEntity.ok(TokenResponse.from(tokenPair));
    }
}

record TotpVerifyRequest(@NotBlank String challengeId, int code) {}
record TotpEnrollmentData(String secret, String otpauthUri, String qrCodeBase64, List<String> backupCodes) {}
```

---

## 🧪 Verification, Testing & Infrastructure Commands

### Test TOTP Enrollment Flow

```powershell
# 1. Login with credentials
$loginBody = @{ email = "alice@example.com"; password = "Pass123!" } | ConvertTo-Json
$loginResponse = Invoke-RestMethod -Method POST `
    -Uri "http://localhost:8080/api/v1/auth/login" `
    -ContentType "application/json" -Body $loginBody

$token = $loginResponse.accessToken

# 2. Initiate TOTP enrollment
$enrollment = Invoke-RestMethod -Uri "http://localhost:8080/api/v1/mfa/totp/enroll" `
    -Method POST `
    -Headers @{ Authorization = "Bearer $token" }

# Display QR code URL (open in browser or scan with authenticator app)
Write-Host "OTP Auth URI: $($enrollment.otpauthUri)"
Write-Host "Secret (manual entry): $($enrollment.secret)"

# 3. After scanning QR, verify enrollment with first code
$verifyBody = @{ code = 123456 } | ConvertTo-Json  # Replace with actual code from app
Invoke-RestMethod -Uri "http://localhost:8080/api/v1/mfa/totp/activate" `
    -Method POST `
    -Headers @{ Authorization = "Bearer $token" } `
    -ContentType "application/json" -Body $verifyBody

# 4. Test MFA login flow
$mfaLoginResponse = Invoke-RestMethod -Method POST `
    -Uri "http://localhost:8080/api/v1/auth/login" `
    -ContentType "application/json" `
    -Body $loginBody

Write-Host "MFA Required: $($mfaLoginResponse.mfaRequired)"
Write-Host "Challenge ID: $($mfaLoginResponse.mfaChallengeId)"

# 5. Complete with TOTP code
$totpVerify = @{
    challengeId = $mfaLoginResponse.mfaChallengeId
    code = 654321   # Replace with actual TOTP code
} | ConvertTo-Json

Invoke-RestMethod -Method POST `
    -Uri "http://localhost:8080/api/v1/auth/mfa/totp/verify" `
    -ContentType "application/json" `
    -Body $totpVerify
```

---

## ⚡ Senior Best Practices & Critical Anti-Patterns

### ✅ Best Practices

1. **Encrypt TOTP secrets in the database** — Use AES-256 (via `@Convert` + `AttributeConverter`) to encrypt secrets at rest.

2. **Use `SecureRandom` for OTP generation, NEVER `Math.random()`** — `SecureRandom` is cryptographically secure; `Math.random()` is predictable.

3. **Constant-time comparison for OTP validation** — `MessageDigest.isEqual()` prevents timing attacks that leak OTP validity.

4. **Generate 8+ backup codes on TOTP enrollment** — Users WILL lose their phones. Backup codes are the recovery mechanism.

5. **Invalidate MFA challenge token immediately after use** — Single-use challenge tokens prevent replay attacks.

6. **Track OTP by `purpose`** — A login OTP and a password-reset OTP should be separate Redis keys; prevents cross-purpose token misuse.

### ❌ Critical Anti-Patterns

| Anti-Pattern | Problem | Fix |
|-------------|---------|-----|
| **Storing TOTP secrets in plaintext** | DB breach exposes all users' secrets | AES-256 encrypt secrets with master key from Vault/HSM |
| **No rate limiting on OTP verification** | 10^6 possible 6-digit codes brute-forceable in ~28 hours | Max 5 attempts; 15 minute lockout |
| **No rate limit on OTP send** | Attackers spam users with SMS flooding → charge + DoS | Max 3 OTP sends per hour per user |
| **Not using constant-time comparison** | Timing side-channel attack reveals whether code is partially correct | Always use `MessageDigest.isEqual()` |
| **Reusing OTP after first use** | OTP in transit can be captured and reused | Delete OTP from Redis immediately after successful verification |
| **OTP TTL > 10 minutes** | Larger time window = more brute-force opportunity | 5 minutes for SMS OTP; Google Authenticator's 90-second window is built in |
| **Not encrypting TOTP secret with AES** | If DB is compromised, all TOTP secrets are exposed | Encrypt at field level in DB |

---

*Previous: [04-keycloak-spring-authorization-server.md](./04-keycloak-spring-authorization-server.md) | Next: [06-passkey-fido2-webauthn.md](./06-passkey-fido2-webauthn.md)*
