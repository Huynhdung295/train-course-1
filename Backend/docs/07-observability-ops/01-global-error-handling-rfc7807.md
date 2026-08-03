# 🚨 Global Error Handling & RFC 7807 (ProblemDetail)

> **Category**: Observability & Ops | **Complexity**: Intermediate | **Java**: 21+ | **Spring Boot**: 3.2+

---

## 📖 Core Technical Mechanics & Deep-Dive

### The Problem with Custom Error Responses
Historically, every Spring API had its own custom error JSON structure:
`{"error": "Not Found", "message": "User 123 missing", "code": 404}`
This made it impossible for generic frontend clients or API gateways to reliably parse error payloads.

### The Standard: RFC 7807 (Problem Details for HTTP APIs)
RFC 7807 defines a standardized JSON structure for HTTP errors. Spring Framework 6 (Spring Boot 3) introduced first-class support via the `ProblemDetail` class.

**RFC 7807 Standard Fields:**
- `type`: A URI reference that identifies the problem type (e.g., `https://api.mycompany.com/errors/user-not-found`).
- `title`: A short, human-readable summary of the problem type.
- `status`: The HTTP status code (`404`).
- `detail`: A human-readable explanation specific to this occurrence of the problem.
- `instance`: A URI reference that identifies the specific occurrence of the problem (e.g., `/api/users/123`).

Spring Boot 3 can automatically format all MVC errors as RFC 7807 `ProblemDetail` payloads.

---

## 🌐 Real-World GitHub Patterns & Industry Reference

- **[RFC 7807 Specification](https://datatracker.ietf.org/doc/html/rfc7807)** — The IETF Standard.
- **[zalando/problem-spring-web](https://github.com/zalando/problem-spring-web)** — Zalando's popular library that pioneered this before Spring Boot 3 made it native. (Deprecated now that Spring supports it natively).

---

## 🏷️ Framework Annotations & Dependencies

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-web</artifactId>
</dependency>
```

---

## ⚙️ Production Configuration

### application.yml

```yaml
spring:
  mvc:
    problemdetails:
      enabled: true     # CRITICAL: Enables RFC 7807 globally for all Spring internal exceptions (400, 404, 405, etc)
```

---

## 📐 System Design Blueprint

### Complete Global Exception Handler

```java
// ═══════════════════════════════════════════════════
// 1. DOMAIN EXCEPTIONS
// ═══════════════════════════════════════════════════

// Base exception for all business logic errors
public abstract class BusinessException extends RuntimeException {
    private final String errorTypeUri;
    
    public BusinessException(String message, String errorTypeUri) {
        super(message);
        this.errorTypeUri = errorTypeUri;
    }
    
    public String getErrorTypeUri() { return errorTypeUri; }
}

public class ResourceNotFoundException extends BusinessException {
    private final String resourceId;
    
    public ResourceNotFoundException(String resourceName, String resourceId) {
        super(resourceName + " not found with ID: " + resourceId, "https://api.company.com/errors/not-found");
        this.resourceId = resourceId;
    }
    
    public String getResourceId() { return resourceId; }
}

public class InsufficientFundsException extends BusinessException {
    private final BigDecimal currentBalance;
    private final BigDecimal requiredBalance;
    
    public InsufficientFundsException(BigDecimal currentBalance, BigDecimal requiredBalance) {
        super("Insufficient funds to complete transaction.", "https://api.company.com/errors/insufficient-funds");
        this.currentBalance = currentBalance;
        this.requiredBalance = requiredBalance;
    }
    
    public BigDecimal getCurrentBalance() { return currentBalance; }
    public BigDecimal getRequiredBalance() { return requiredBalance; }
}

// ═══════════════════════════════════════════════════
// 2. GLOBAL CONTROLLER ADVICE
// ═══════════════════════════════════════════════════

/**
 * @RestControllerAdvice applies these exception handlers to all @RestControllers.
 * Extending ResponseEntityExceptionHandler gives us free handling of internal 
 * Spring exceptions (e.g., HttpMessageNotReadableException, MethodArgumentNotValidException)
 * formatted as ProblemDetail (because spring.mvc.problemdetails.enabled=true).
 */
@RestControllerAdvice
@Slf4j
public class GlobalExceptionHandler extends ResponseEntityExceptionHandler {

    // --- 1. Handle Custom 404 (Not Found) ---
    @ExceptionHandler(ResourceNotFoundException.class)
    public ProblemDetail handleResourceNotFound(ResourceNotFoundException ex, HttpServletRequest request) {
        // Create standard ProblemDetail
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, ex.getMessage());
        pd.setType(URI.create(ex.getErrorTypeUri()));
        pd.setTitle("Resource Not Found");
        pd.setInstance(URI.create(request.getRequestURI()));
        
        // Add custom properties (RFC 7807 allows extending the payload)
        pd.setProperty("resource_id", ex.getResourceId());
        pd.setProperty("timestamp", Instant.now());
        
        log.warn("404 Not Found: {}", ex.getMessage());
        return pd;
    }

    // --- 2. Handle Custom 409 (Conflict / Business Rule Violation) ---
    @ExceptionHandler(InsufficientFundsException.class)
    public ProblemDetail handleInsufficientFunds(InsufficientFundsException ex, HttpServletRequest request) {
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, ex.getMessage());
        pd.setType(URI.create(ex.getErrorTypeUri()));
        pd.setTitle("Business Rule Violation");
        pd.setInstance(URI.create(request.getRequestURI()));
        
        // Extended properties crucial for frontend debugging
        pd.setProperty("current_balance", ex.getCurrentBalance());
        pd.setProperty("required_balance", ex.getRequiredBalance());
        
        log.warn("409 Conflict: {}", ex.getMessage());
        return pd;
    }

    // --- 3. Override Validation Errors (400 Bad Request) ---
    // If a @Valid annotation fails, Spring calls this method. We override it to add custom field errors.
    @Override
    protected ResponseEntity<Object> handleMethodArgumentNotValid(
            MethodArgumentNotValidException ex, 
            HttpHeaders headers, 
            HttpStatusCode status, 
            WebRequest request) {
            
        ProblemDetail pd = ex.getBody(); // Gets the default Spring ProblemDetail
        pd.setType(URI.create("https://api.company.com/errors/validation-failed"));
        pd.setTitle("Validation Failed");
        
        // Extract field-level errors
        List<Map<String, String>> fieldErrors = ex.getBindingResult().getFieldErrors().stream()
            .map(error -> Map.of(
                "field", error.getField(),
                "message", error.getDefaultMessage(),
                "rejected_value", String.valueOf(error.getRejectedValue())
            ))
            .toList();
            
        pd.setProperty("invalid_fields", fieldErrors);
        
        log.warn("400 Validation Error: {}", fieldErrors);
        return ResponseEntity.status(status).headers(headers).body(pd);
    }

    // --- 4. Catch-All for Unhandled 500s (Internal Server Error) ---
    @ExceptionHandler(Exception.class)
    public ProblemDetail handleAllUncaughtException(Exception ex, HttpServletRequest request) {
        // ALWAYS log the full stack trace for 500 errors!
        log.error("500 Internal Server Error: {}", ex.getMessage(), ex);
        
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(
            HttpStatus.INTERNAL_SERVER_ERROR, 
            "An unexpected error occurred. Please contact support."
        );
        pd.setType(URI.create("https://api.company.com/errors/internal-server-error"));
        pd.setTitle("Internal Server Error");
        pd.setInstance(URI.create(request.getRequestURI()));
        
        // Include a Trace ID so the user can give it to support (requires Micrometer Tracing)
        String traceId = MDC.get("traceId");
        if (traceId != null) {
            pd.setProperty("trace_id", traceId);
        }
        
        return pd;
    }
}
```

---

## 🧪 Verification Commands

```powershell
# 1. Trigger a 404 (ResourceNotFoundException)
Invoke-RestMethod -Uri "http://localhost:8080/api/v1/users/999" -SkipHttpErrorCheck

# Expected Output:
# {
#   "type": "https://api.company.com/errors/not-found",
#   "title": "Resource Not Found",
#   "status": 404,
#   "detail": "User not found with ID: 999",
#   "instance": "/api/v1/users/999",
#   "resource_id": "999",
#   "timestamp": "2023-10-01T12:00:00Z"
# }

# 2. Trigger a 400 Validation Error (MethodArgumentNotValidException)
$badBody = @{ email = "not-an-email"; age = -5 } | ConvertTo-Json
Invoke-RestMethod -Method POST -Uri "http://localhost:8080/api/v1/users" `
    -ContentType "application/json" -Body $badBody -SkipHttpErrorCheck

# Expected Output:
# {
#   "type": "https://api.company.com/errors/validation-failed",
#   "title": "Validation Failed",
#   "status": 400,
#   "detail": "Invalid request content.",
#   "instance": "/api/v1/users",
#   "invalid_fields": [
#     { "field": "email", "message": "must be a well-formed email address", "rejected_value": "not-an-email" },
#     { "field": "age", "message": "must be greater than 0", "rejected_value": "-5" }
#   ]
# }
```

---

## ⚡ Best Practices & Anti-Patterns

### ✅ Best Practices
1. **Never leak stack traces or internal technical details in 500 errors.** Return a generic message and a `trace_id`. Log the full stack trace internally.
2. **Extend `ResponseEntityExceptionHandler`**. If you only use `@ExceptionHandler`, you miss Spring's internal exceptions (like 405 Method Not Allowed or 415 Unsupported Media Type), resulting in inconsistent payloads.
3. **Use `.setProperty()` for context**. If a payment fails, add the required amount and current balance to the JSON so the frontend doesn't have to parse a raw string message.

### ❌ Anti-Patterns

| Anti-Pattern | Problem | Fix |
|-------------|---------|-----|
| Returning `ResponseEntity<String>` on errors | Clients cannot parse plain text programmatically. | Always return `ProblemDetail`. |
| Returning HTTP 200 OK with `{"error": "failed"}` | Breaks HTTP semantics, caching, API Gateways, and monitoring tools. | Use proper HTTP Status Codes (4xx, 5xx). |
| Catching exceptions in the Controller layer | Leads to massive duplication (`try-catch` in every method). | Let exceptions bubble up to the `@RestControllerAdvice`. |
