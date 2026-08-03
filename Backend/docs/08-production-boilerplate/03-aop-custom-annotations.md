# 🪡 Aspect-Oriented Programming (AOP) & Custom Annotations

> **Category**: Production Boilerplate | **Complexity**: Intermediate | **Java**: 21+ | **Spring Boot**: 3.3+ | **Spring AOP**

---

## 📖 Core Technical Mechanics & Deep-Dive

### The Cross-Cutting Concern Problem
Logging execution time, auditing user actions, checking permissions, and opening database transactions are all "cross-cutting concerns". If you write this logic inside every Service method, your codebase becomes tangled, repetitive, and hard to maintain.

### Spring AOP
Aspect-Oriented Programming (AOP) solves this by injecting code *around* your business logic dynamically.
- **Aspect**: The module containing the cross-cutting logic (e.g., `LoggingAspect`).
- **Join Point**: A point during execution where the Aspect can be plugged in (in Spring AOP, this is always a method execution).
- **Pointcut**: A predicate that matches Join Points (e.g., "match all methods annotated with `@LogExecutionTime`").
- **Advice**: The actual action taken (e.g., `@Around`, `@Before`, `@After`).

*Note: Spring AOP is proxy-based. It creates a dynamic subclass (CGLIB) of your Spring Bean. If a method in `MyService` calls another method in `MyService` (`this.otherMethod()`), the proxy is bypassed, and the Aspect will NOT execute!*

---

## 🌐 Real-World GitHub Patterns & Industry Reference

- **[spring-projects/spring-framework AOP](https://docs.spring.io/spring-framework/reference/core/aop.html)** — Official Spring AOP Reference.

---

## 🏷️ Framework Annotations & Dependencies

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-aop</artifactId>
</dependency>
```

---

## 📐 System Design Blueprint

### Complete AOP Implementation

```java
// ═══════════════════════════════════════════════════
// 1. DEFINE CUSTOM ANNOTATIONS
// ═══════════════════════════════════════════════════

/**
 * Triggers execution time logging.
 */
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface LogExecutionTime {
    // Optional parameter to categorize the log
    String category() default "DEFAULT";
}

/**
 * Triggers an audit trail entry in the database.
 */
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface AuditAction {
    String actionName();
    String resourceType();
}

// ═══════════════════════════════════════════════════
// 2. THE ASPECT IMPLEMENTATION
// ═══════════════════════════════════════════════════

@Aspect
@Component
@RequiredArgsConstructor
@Slf4j
public class CommonAspects {

    private final AuditRepository auditRepository;

    // --- @Around Advice (Wraps the method execution) ---
    
    /**
     * Pointcut: Matches any method annotated with @LogExecutionTime.
     * The method must be executed, timed, and its result returned.
     */
    @Around("@annotation(annotation)")
    public Object logExecutionTime(ProceedingJoinPoint joinPoint, LogExecutionTime annotation) throws Throwable {
        long start = System.currentTimeMillis();
        
        try {
            // PROCEED: Execute the actual underlying method
            return joinPoint.proceed();
        } finally {
            long executionTime = System.currentTimeMillis() - start;
            String methodName = joinPoint.getSignature().toShortString();
            
            log.info("[{}] {} executed in {} ms", 
                annotation.category(), methodName, executionTime);
        }
    }

    // --- @AfterReturning Advice (Executes only on success) ---

    /**
     * Pointcut: Matches any method annotated with @AuditAction, 
     * but only runs if the method successfully returns (no exceptions).
     */
    @AfterReturning(
        pointcut = "@annotation(annotation)", 
        returning = "result"
    )
    public void auditSuccess(JoinPoint joinPoint, AuditAction annotation, Object result) {
        
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        String methodName = joinPoint.getSignature().getName();
        
        // Example: If the method returns an entity, we could extract its ID
        String entityId = extractIdIfPossible(result);

        log.info("AUDIT: User '{}' performed '{}' on resource type '{}'", 
            username, annotation.actionName(), annotation.resourceType());
            
        // Save to DB (Ideally, this should publish an event to avoid slowing down the API)
        auditRepository.save(new AuditLog(
            username, 
            annotation.actionName(), 
            annotation.resourceType(), 
            entityId,
            "SUCCESS"
        ));
    }
    
    // --- @AfterThrowing Advice (Executes only on exception) ---
    
    @AfterThrowing(
        pointcut = "@annotation(annotation)", 
        throwing = "ex"
    )
    public void auditFailure(JoinPoint joinPoint, AuditAction annotation, Exception ex) {
        String username = SecurityContextHolder.getContext().getAuthentication().getName();
        
        auditRepository.save(new AuditLog(
            username, 
            annotation.actionName(), 
            annotation.resourceType(), 
            null,
            "FAILED: " + ex.getMessage()
        ));
    }
    
    // Helper method for the example
    private String extractIdIfPossible(Object result) {
        if (result instanceof BaseEntity entity) {
            return entity.getId().toString();
        }
        return "UNKNOWN";
    }
}

// ═══════════════════════════════════════════════════
// 3. APPLYING THE ANNOTATIONS (Service Layer)
// ═══════════════════════════════════════════════════

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepo;

    @LogExecutionTime(category = "DATABASE_READ")
    public User findUser(UUID id) {
        return userRepo.findById(id).orElseThrow();
    }

    @Transactional
    @LogExecutionTime(category = "DATABASE_WRITE")
    @AuditAction(actionName = "CREATE_USER", resourceType = "USER")
    public User createUser(CreateUserCmd cmd) {
        User user = new User(cmd.getUsername());
        return userRepo.save(user);
    }
    
    // ❌ ANTI-PATTERN DEMONSTRATION
    public void selfInvocationFail() {
        // Calling an annotated method from WITHIN the same class bypasses the AOP proxy!
        // The @LogExecutionTime Aspect will NEVER trigger here.
        findUser(UUID.randomUUID()); 
    }
}
```

---

## 🧪 Verification Commands

```powershell
# Trigger the annotated method via REST Controller
$body = @{ username = "aop_test_user" } | ConvertTo-Json
Invoke-RestMethod -Method POST -Uri "http://localhost:8080/api/v1/users" -ContentType "application/json" -Body $body

# Check the application logs for the @Around advice output
# Output: [DATABASE_WRITE] UserService.createUser(..) executed in 42 ms

# Check the Database for the @AfterReturning audit trail output
docker exec postgres psql -U app -d app_db -c "SELECT username, action, resource_type, status FROM audit_logs ORDER BY created_at DESC LIMIT 1;"
```

---

## ⚡ Best Practices & Anti-Patterns

### ✅ Best Practices
1. **Combine AOP with Spring Events for heavy operations**. If your Aspect writes to a database (like the Audit example), it slows down the main thread. Instead, have the Aspect publish a Spring Event (`ApplicationEventPublisher`), and have an `@Async` listener perform the DB write.
2. **Use `@annotation()` pointcuts**. Defining pointcuts by package name (`execution(* com.company.services.*.*(..))`) is brittle and often applies advice to methods that shouldn't have it. Explicit custom annotations are robust and self-documenting.

### ❌ Anti-Patterns

| Anti-Pattern | Problem | Fix |
|-------------|---------|-----|
| Self-Invocation (Calling annotated method from same class) | AOP Proxies are bypassed. The aspect does not fire. | Move the method to a different Bean, or inject `ApplicationContext` to fetch the proxy (hacky). |
| Modifying method arguments in `@Around` | Extremely confusing for developers debugging the system. | Treat AOP as read-only observation logic. If you must mutate data, do it explicitly in the Service. |
| Catching exceptions in `@Around` without rethrowing | If an Aspect swallows an exception, Spring's `@Transactional` won't roll back the database! | Always `throw e;` after logging it in a catch block inside `@Around`. |
