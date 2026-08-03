# ⚙️ Configuration Properties & Profiles

> **Category**: Production Boilerplate | **Complexity**: Foundation | **Java**: 21+ | **Spring Boot**: 3.3+

---

## 📖 Core Technical Mechanics & Deep-Dive

### The @Value Anti-Pattern
Historically, Spring developers injected configuration using `@Value("${my.property}")`.
This is brittle because:
1. It is untyped (everything is a String by default).
2. It scatters configuration keys throughout the codebase.
3. If a property is missing or misspelled in `application.yml`, the application crashes at runtime when the specific Bean is instantiated (or fails to start with a generic error).

### The Solution: @ConfigurationProperties
Spring Boot's `@ConfigurationProperties` binds hierarchical YAML/Properties data to strongly-typed Java POJOs (or Records in Java 16+).
- Validated on application startup using Jakarta Validation.
- IDE auto-completion support in `application.yml`.
- Centralized configuration management.

### Spring Profiles
Profiles (`spring.profiles.active=prod`) allow you to isolate configuration for different environments.
- `application.yml` (Common to all environments)
- `application-dev.yml` (Overrides common, used in local development)
- `application-prod.yml` (Overrides common, used in production Kubernetes)

---

## 🌐 Real-World GitHub Patterns & Industry Reference

- **[spring-projects/spring-boot](https://docs.spring.io/spring-boot/docs/current/reference/html/features.html#features.external-config.typesafe-configuration-properties)** — Official Configuration Properties Reference.

---

## 🏷️ Framework Annotations & Dependencies

```xml
<!-- Adds IDE auto-completion support when editing application.yml -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-configuration-processor</artifactId>
    <optional>true</optional>
</dependency>

<!-- Required if using @Validated with @ConfigurationProperties -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-validation</artifactId>
</dependency>
```

---

## 📐 System Design Blueprint

### Complete Type-Safe Configuration Implementation

```java
// ═══════════════════════════════════════════════════
// 1. DEFINE TYPE-SAFE CONFIGURATION (Java 21 Records)
// ═══════════════════════════════════════════════════

/**
 * @ConfigurationProperties binds properties starting with "app.payment" to this Record.
 * @Validated ensures the Jakarta constraints (@NotBlank, @Min, @Pattern) are enforced AT STARTUP.
 * 
 * If a required property is missing, the Spring Boot app WILL NOT START, 
 * which is exactly what you want in Production (Fail Fast).
 */
@Validated
@ConfigurationProperties(prefix = "app.payment")
public record PaymentProperties(
    
    @NotBlank
    String gatewayUrl,
    
    @NotNull
    @Pattern(regexp = "^sk_test_.*|^sk_live_.*", message = "Must be a valid Stripe secret key")
    String secretKey,
    
    @Min(1000)
    int timeoutMs,
    
    // Nested object binding
    RetryProperties retry,
    
    // List binding
    List<String> supportedCurrencies
) {
    public record Retry(
        @Min(1) int maxAttempts,
        @Min(100) int backoffMs
    ) {}
}

// ═══════════════════════════════════════════════════
// 2. ENABLE CONFIGURATION PROPERTIES
// ═══════════════════════════════════════════════════

@SpringBootApplication
// Enables binding for the specific Records/Classes
@EnableConfigurationProperties(PaymentProperties.class) 
public class Application {
    public static void main(String[] args) {
        SpringApplication.run(Application.class, args);
    }
}

// ═══════════════════════════════════════════════════
// 3. USAGE IN A SERVICE
// ═══════════════════════════════════════════════════

@Service
@RequiredArgsConstructor
@Slf4j
public class PaymentGatewayService {

    // Inject the strongly-typed Record instead of @Value
    private final PaymentProperties paymentProps;
    private final RestClient restClient;

    public void processPayment(BigDecimal amount, String currency) {
        
        // 1. Access validated list
        if (!paymentProps.supportedCurrencies().contains(currency)) {
            throw new IllegalArgumentException("Unsupported currency");
        }

        log.info("Connecting to gateway at {} with timeout {}", 
            paymentProps.gatewayUrl(), paymentProps.timeoutMs());
            
        // 2. Access nested config
        int attempts = paymentProps.retry().maxAttempts();
        
        // Execute API call...
    }
}
```

### The Environment Profile Strategy

#### `application.yml` (Common Defaults)
```yaml
spring:
  application:
    name: order-service
  profiles:
    active: ${SPRING_PROFILES_ACTIVE:local} # Default to 'local' if ENV var is missing

app:
  payment:
    timeoutMs: 5000
    retry:
      maxAttempts: 3
      backoffMs: 1000
    supportedCurrencies:
      - USD
      - EUR
```

#### `application-local.yml` (Local Dev - Git Ignored or Safe Defaults)
```yaml
app:
  payment:
    gatewayUrl: http://localhost:8081/mock-gateway
    secretKey: sk_test_123456789   # Safe test key
```

#### `application-prod.yml` (Production - Values injected via Kubernetes/Docker Secrets)
```yaml
app:
  payment:
    # URL is hardcoded for production
    gatewayUrl: https://api.stripe.com
    # Secret Key is NEVER hardcoded here! It is pulled from an Environment Variable injected by Vault/K8s.
    secretKey: ${STRIPE_SECRET_KEY} 
```

---

## 🧪 Verification Commands

```powershell
# 1. Test Fail-Fast Validation
# Run the app WITHOUT setting STRIPE_SECRET_KEY.
# Result: Application crashes on startup with:
# "Property: app.payment.secretKey / Reason: Must be a valid Stripe secret key"

# 2. Run with the 'prod' profile and inject the secret via ENV var
$env:SPRING_PROFILES_ACTIVE="prod"
$env:STRIPE_SECRET_KEY="sk_live_abcdef12345"
java -jar app.jar
```

---

## ⚡ Best Practices & Anti-Patterns

### ✅ Best Practices
1. **Use Records for `@ConfigurationProperties`**. They are immutable, concise, and natively supported in Spring Boot 3 for configuration binding.
2. **Always use `@Validated`**. Guarantee that your application will not start if ops forgets to provide a critical database password or API URL in the environment variables.
3. **Use kebab-case in YAML (`gateway-url`), camelCase in Java (`gatewayUrl`)**. Spring Boot automatically relaxes binding (Relaxed Binding) to map these perfectly.

### ❌ Anti-Patterns

| Anti-Pattern | Problem | Fix |
|-------------|---------|-----|
| Using `@Value("${prop}")` everywhere | No central validation. Typos cause runtime crashes long after deployment. | Migrate to `@ConfigurationProperties`. |
| Hardcoding Prod Secrets in `application-prod.yml` | Committing API keys or DB passwords to Git is a massive security breach. | Use `${ENV_VAR}` references in YAML, and inject the values at runtime via Kubernetes Secrets or Docker Compose. |
| Depending on `spring.profiles.active` in Java code | `if (environment.getActiveProfiles()[0].equals("prod"))` tightly couples logic to deployment environments. | Use Feature Flags (`app.features.new-ui=true`) and check the feature flag instead. |
