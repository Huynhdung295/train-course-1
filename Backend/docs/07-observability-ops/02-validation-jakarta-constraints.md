# ✔️ Validation & Jakarta Constraints

> **Category**: Observability & Ops | **Complexity**: Intermediate | **Java**: 21+ | **Spring Boot**: 3.3+ | **Hibernate Validator**

---

## 📖 Core Technical Mechanics & Deep-Dive

### Jakarta Validation vs Spring Validation
- **Jakarta Validation API** (`jakarta.validation.constraints.*`): The standard Java specification (formerly `javax.validation`). Provides annotations like `@NotNull`, `@Size`, `@Email`.
- **Hibernate Validator**: The default reference implementation of Jakarta Validation in Spring Boot.
- **Spring Validation** (`org.springframework.validation.annotation.Validated`): Spring's integration layer that adds support for Validation Groups and Method-level validation.

### @Valid vs @Validated
- **`@Valid`** (Jakarta): Triggers validation on a nested object or method parameter. Cannot specify validation groups.
- **`@Validated`** (Spring): Triggers validation and allows you to specify **Validation Groups** (e.g., validate one set of fields on CREATE, and a different set on UPDATE). Also required at the class level to enable method validation.

---

## 🌐 Real-World GitHub Patterns & Industry Reference

- **[hibernate/hibernate-validator](https://github.com/hibernate/hibernate-validator)** — Reference implementation source code.
- **[spring-projects/spring-framework Validation](https://docs.spring.io/spring-framework/reference/core/validation.html)** — Spring's validation docs.

---

## 🏷️ Framework Annotations & Dependencies

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-validation</artifactId>
</dependency>
```

---

## 📐 System Design Blueprint

### Complete Validation Implementation

```java
// ═══════════════════════════════════════════════════
// 1. VALIDATION GROUPS (Marker Interfaces)
// ═══════════════════════════════════════════════════

public interface CreateGroup {}
public interface UpdateGroup {}

// ═══════════════════════════════════════════════════
// 2. DTO WITH CONSTRAINTS
// ═══════════════════════════════════════════════════

public record UserDto(

    // Must be null on Create (DB generates it), Must not be null on Update
    @Null(groups = CreateGroup.class)
    @NotNull(groups = UpdateGroup.class)
    UUID id,

    @NotBlank(message = "Username is required")
    @Size(min = 3, max = 50, message = "Username must be between 3 and 50 characters")
    String username,

    @NotBlank(message = "Email is required")
    @Email(message = "Must be a valid email format")
    String email,

    @Min(value = 18, message = "User must be at least 18 years old")
    @Max(value = 120, message = "Age cannot exceed 120")
    Integer age,

    // Nested object validation requires @Valid!
    @NotNull(message = "Address is required")
    @Valid 
    AddressDto address,

    // Custom Validation Annotation
    @StrongPassword(groups = CreateGroup.class) 
    String password
) {}

public record AddressDto(
    @NotBlank String street,
    @NotBlank String city,
    @Pattern(regexp = "^\\d{5}(-\\d{4})?$", message = "Invalid ZIP code format") String zipCode
) {}

// ═══════════════════════════════════════════════════
// 3. CUSTOM VALIDATOR IMPLEMENTATION
// ═══════════════════════════════════════════════════

// 1. Define Annotation
@Documented
@Constraint(validatedBy = StrongPasswordValidator.class)
@Target({ ElementType.FIELD, ElementType.PARAMETER })
@Retention(RetentionPolicy.RUNTIME)
public @interface StrongPassword {
    String message() default "Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character";
    Class<?>[] groups() default {};
    Class<? extends Payload>[] payload() default {};
}

// 2. Implement Validator Logic
public class StrongPasswordValidator implements ConstraintValidator<StrongPassword, String> {
    
    // Regex: Min 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special char
    private static final Pattern PATTERN = Pattern.compile(
        "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{8,}$"
    );

    @Override
    public boolean isValid(String value, ConstraintValidatorContext context) {
        if (value == null) {
            return false; // Let @NotBlank handle null checks if needed, or return true if password is optional
        }
        return PATTERN.matcher(value).matches();
    }
}

// ═══════════════════════════════════════════════════
// 4. CONTROLLER INTEGRATION
// ═══════════════════════════════════════════════════

@RestController
@RequestMapping("/api/v1/users")
@RequiredArgsConstructor
// Required to validate @PathVariable and @RequestParam directly on the method
@Validated 
public class UserController {

    // Validates using the CreateGroup rules
    @PostMapping
    public ResponseEntity<UserDto> createUser(
            @Validated(CreateGroup.class) @RequestBody UserDto request) {
        // Validation passed
        return ResponseEntity.status(HttpStatus.CREATED).body(request);
    }

    // Validates using the UpdateGroup rules
    @PutMapping("/{id}")
    public ResponseEntity<UserDto> updateUser(
            @PathVariable UUID id,
            @Validated(UpdateGroup.class) @RequestBody UserDto request) {
        // Validation passed
        return ResponseEntity.ok(request);
    }

    // Direct parameter validation (Requires @Validated on the class!)
    @GetMapping("/search")
    public ResponseEntity<List<UserDto>> searchUsers(
            @RequestParam @NotBlank @Size(min = 3) String query,
            @RequestParam @Min(1) @Max(100) int limit) {
        return ResponseEntity.ok(Collections.emptyList());
    }
}
```

---

## 🧪 Verification Commands

```powershell
# 1. Test Create Validation (Missing email, weak password, invalid age)
$badCreate = @{ 
    username = "ab" 
    age = 15
    password = "weak"
    address = @{ street = "123 Main"; city = "NY"; zipCode = "123" }
} | ConvertTo-Json
Invoke-RestMethod -Method POST -Uri "http://localhost:8080/api/v1/users" `
    -ContentType "application/json" -Body $badCreate -SkipHttpErrorCheck

# 2. Test Update Validation (ID must be provided in body based on @NotNull(groups = UpdateGroup.class))
$badUpdate = @{ 
    username = "john_doe" 
    email = "john@test.com"
    age = 25
    address = @{ street = "123 Main"; city = "NY"; zipCode = "10001" }
    # Missing ID!
} | ConvertTo-Json
Invoke-RestMethod -Method PUT -Uri "http://localhost:8080/api/v1/users/550e8400-e29b-41d4-a716-446655440000" `
    -ContentType "application/json" -Body $badUpdate -SkipHttpErrorCheck

# 3. Test Method Validation (@RequestParam)
Invoke-RestMethod -Uri "http://localhost:8080/api/v1/users/search?query=a&limit=500" -SkipHttpErrorCheck
```

---

## ⚡ Best Practices & Anti-Patterns

### ✅ Best Practices
1. **Always handle `MethodArgumentNotValidException` globally**. Return a formatted `ProblemDetail` payload listing exactly which fields failed (as shown in the Global Error Handling doc).
2. **Use `@Valid` on nested DTOs**. If a DTO contains another object or a List of objects, Jakarta will NOT validate the internals unless you explicitly add `@Valid` to the field.
3. **Fail Fast at the Controller**. Never write `if (dto.getEmail() == null)` in your Service layer. Use annotations to guarantee the Service layer only receives structurally valid data.

### ❌ Anti-Patterns

| Anti-Pattern | Problem | Fix |
|-------------|---------|-----|
| Putting `@Validated` on Service classes | Validation runs on every method call, adding heavy reflection overhead internally. | Validate at the system edge (Controller layer). |
| Writing complex DB logic in Custom Validators | Validators execute BEFORE the Hibernate transaction opens. DB queries inside validators can cause connection leaks or lazy init exceptions. | Keep validators pure (Regex, Math). Put DB checks (e.g., `isEmailUnique`) in the Service layer. |
| Using `@NotNull` on a `String` expecting it not to be empty | `""` (empty string) passes `@NotNull`. | Use `@NotBlank` for Strings. |
