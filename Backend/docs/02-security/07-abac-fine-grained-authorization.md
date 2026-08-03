# 🛡️ ABAC — Attribute-Based Access Control & Fine-Grained Authorization

> **Category**: Security | **Complexity**: Expert | **Java**: 21+ | **Spring Boot**: 3.3+ | **Spring Security**: 6.3+

---

## 📖 Core Technical Mechanics & Deep-Dive

### RBAC vs ABAC vs ReBAC

| Approach | Decision Based On | Example |
|----------|------------------|---------|
| **RBAC** (Role-Based) | Roles assigned to user | ADMIN can delete any order |
| **ABAC** (Attribute-Based) | User attrs + resource attrs + environment | User can edit document IF owner AND status=DRAFT AND within business hours |
| **ReBAC** (Relationship-Based) | Graph relationships between entities | User can view post IF follows the post's author |

**ABAC** is the most powerful and flexible. It evaluates:
- **Subject attributes** — user.department, user.clearanceLevel, user.tenantId
- **Resource attributes** — document.status, document.ownerId, document.classification
- **Action attributes** — HTTP method, operation type
- **Environment attributes** — time of day, IP address, geographic location

### Spring Security Authorization Architecture

```
Request arrives at AuthorizationFilter
    │
    ▼
AuthorizationManager<HttpRequestHandler>  (for HTTP requests)
AuthorizationManager<MethodInvocation>    (for method security)
    │
    ▼
One of:
  ├── AuthorityAuthorizationManager      (@PreAuthorize("hasRole('X')"))
  ├── AuthenticatedAuthorizationManager  (@PreAuthorize("isAuthenticated()"))
  ├── RequestMatcherDelegatingAuthorizationManager
  └── MethodSecurityExpressionHandler    (SpEL evaluation)
         │
         └── PermissionEvaluator         (hasPermission() in SpEL)
                  │
                  └── YOUR Custom Implementation
                         evaluates ABAC policies
```

---

## 🌐 Real-World GitHub Patterns & Industry Reference

### Reference Projects
- **[eugenp/tutorials/spring-security-abac](https://github.com/eugenp/tutorials/tree/master/spring-security-modules/spring-security-abac)** — Baeldung ABAC with Spring Security
- **[open-policy-agent/opa](https://github.com/open-policy-agent/opa)** — Industry-standard policy engine (Rego language)
- **[Netflix Conductor ACL](https://github.com/Netflix/conductor)** — Fine-grained permission model at Netflix scale

---

## 🏷️ Framework Annotations, Components & Dependencies

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-security</artifactId>
</dependency>

<!-- For OPA (Open Policy Agent) integration -->
<dependency>
    <groupId>com.bisnode.opa</groupId>
    <artifactId>opa-filter-spring-boot-starter</artifactId>
    <version>0.3.8</version>
</dependency>
```

### Key Security SpEL Annotations

| Expression | Meaning |
|-----------|---------|
| `hasRole('ADMIN')` | Has `ROLE_ADMIN` authority |
| `hasAuthority('orders:write')` | Has specific authority string |
| `isAuthenticated()` | Any non-anonymous user |
| `isFullyAuthenticated()` | Not anonymous, not remember-me |
| `hasPermission(#id, 'Order', 'READ')` | Custom permission evaluator |
| `@orderSecurity.canAccess(#id, authentication)` | Custom Spring Bean method |
| `principal.username == #username` | SpEL comparing principal attribute |
| `#order.ownerId == authentication.principal.id` | Object-level comparison |

---

## ⚙️ Production Configuration & Tuning Parameters

```yaml
spring:
  security:
    method:
      # Enable @PreAuthorize, @PostAuthorize, @PreFilter, @PostFilter
      pre-post-enabled: true

app:
  security:
    abac:
      cache-policies: true
      policy-cache-ttl: PT5M      # Cache evaluated policies for 5 minutes
      
    # OPA (Open Policy Agent) if using external policy engine
    opa:
      enabled: false
      base-url: http://opa-server:8181
      policy-path: /v1/data/company/authz/allow
```

---

## 📐 System Design Blueprint & Architecture Patterns

### Complete ABAC Implementation

```java
// ═══════════════════════════════════════════════════
// 1. PERMISSION EVALUATOR — Custom hasPermission() support
// ═══════════════════════════════════════════════════

@Component("permissionEvaluator")
@RequiredArgsConstructor
@Slf4j
public class DomainPermissionEvaluator implements PermissionEvaluator {

    private final Map<String, DomainObjectPermissionEvaluator<?>> evaluators;

    // hasPermission(targetDomainObject, permission)
    @Override
    public boolean hasPermission(Authentication authentication, Object targetDomainObject,
                                  Object permission) {
        if (authentication == null || !authentication.isAuthenticated()) return false;
        if (targetDomainObject == null) return false;

        var targetType = targetDomainObject.getClass().getSimpleName().toUpperCase();
        var evaluator = evaluators.get(targetType);

        if (evaluator == null) {
            log.warn("No permission evaluator for type: {}", targetType);
            return false;
        }

        return evaluator.hasPermission(authentication, targetDomainObject, permission.toString());
    }

    // hasPermission(targetId, targetType, permission)
    @Override
    public boolean hasPermission(Authentication authentication, Serializable targetId,
                                  String targetType, Object permission) {
        if (authentication == null || !authentication.isAuthenticated()) return false;

        var evaluator = evaluators.get(targetType.toUpperCase());
        if (evaluator == null) return false;

        return evaluator.hasPermissionById(authentication, targetId, permission.toString());
    }
}

// ── Interface for domain-specific evaluators ──
interface DomainObjectPermissionEvaluator<T> {
    boolean hasPermission(Authentication auth, T object, String permission);
    boolean hasPermissionById(Authentication auth, Serializable id, String permission);
}

// ── Order-specific permission evaluator ──
@Component("ORDER")
@RequiredArgsConstructor
@Slf4j
public class OrderPermissionEvaluator implements DomainObjectPermissionEvaluator<Order> {

    private final OrderRepository orderRepository;

    @Override
    public boolean hasPermission(Authentication auth, Order order, String permission) {
        var principal = extractPrincipal(auth);

        return switch (permission.toUpperCase()) {
            case "READ" -> canRead(principal, order);
            case "WRITE" -> canWrite(principal, order);
            case "DELETE" -> canDelete(principal, order);
            case "CANCEL" -> canCancel(principal, order);
            default -> {
                log.warn("Unknown permission: {} for ORDER", permission);
                yield false;
            }
        };
    }

    @Override
    public boolean hasPermissionById(Authentication auth, Serializable orderId, String permission) {
        return orderRepository.findById(orderId.toString())
            .map(order -> hasPermission(auth, order, permission))
            .orElse(false);
    }

    private boolean canRead(SecurityPrincipal principal, Order order) {
        // ADMIN can read anything
        if (principal.hasRole("ADMIN")) return true;
        // Owner can read their own order
        if (order.getUserId().equals(principal.userId())) return true;
        // Support staff can read any order
        if (principal.hasRole("SUPPORT")) return true;
        // Multi-tenant: user from same tenant with READ permission
        if (order.getTenantId().equals(principal.tenantId())
                && principal.hasAuthority("orders:read:tenant")) return true;
        return false;
    }

    private boolean canWrite(SecurityPrincipal principal, Order order) {
        if (principal.hasRole("ADMIN")) return true;
        // Owner can only modify PENDING orders
        return order.getUserId().equals(principal.userId())
            && order.getStatus() == OrderStatus.PENDING;
    }

    private boolean canDelete(SecurityPrincipal principal, Order order) {
        // Only ADMIN can delete orders
        return principal.hasRole("ADMIN");
    }

    private boolean canCancel(SecurityPrincipal principal, Order order) {
        if (principal.hasRole("ADMIN")) return true;
        if (principal.hasRole("SUPPORT")) return true;
        // Owner can cancel own PENDING orders only
        return order.getUserId().equals(principal.userId())
            && order.getStatus() == OrderStatus.PENDING;
    }

    private SecurityPrincipal extractPrincipal(Authentication auth) {
        if (auth.getPrincipal() instanceof SecurityUser user) {
            return new SecurityPrincipal(
                user.getUserId(),
                user.getTenantId(),
                auth.getAuthorities().stream()
                    .map(GrantedAuthority::getAuthority)
                    .collect(Collectors.toSet())
            );
        }
        if (auth.getPrincipal() instanceof Jwt jwt) {
            return SecurityPrincipal.fromJwt(jwt);
        }
        throw new IllegalStateException("Unknown principal type: " + auth.getPrincipal().getClass());
    }
}

record SecurityPrincipal(UUID userId, String tenantId, Set<String> authorities) {

    boolean hasRole(String role) { return authorities.contains("ROLE_" + role); }
    boolean hasAuthority(String authority) { return authorities.contains(authority); }

    static SecurityPrincipal fromJwt(Jwt jwt) {
        return new SecurityPrincipal(
            UUID.fromString(jwt.getSubject()),
            jwt.getClaimAsString("tenantId"),
            new HashSet<>(jwt.getClaimAsStringList("roles"))
        );
    }
}

// ═══════════════════════════════════════════════════
// 2. METHOD SECURITY CONFIGURATION
// ═══════════════════════════════════════════════════

@Configuration
@EnableMethodSecurity(
    prePostEnabled = true,    // @PreAuthorize, @PostAuthorize
    securedEnabled = true,    // @Secured
    jsr250Enabled = true      // @RolesAllowed
)
public class MethodSecurityConfig {

    @Bean
    public MethodSecurityExpressionHandler expressionHandler(
            PermissionEvaluator permissionEvaluator) {
        var handler = new DefaultMethodSecurityExpressionHandler();
        handler.setPermissionEvaluator(permissionEvaluator);
        return handler;
    }
}

// ═══════════════════════════════════════════════════
// 3. CONTROLLER — Using All SpEL Authorization Methods
// ═══════════════════════════════════════════════════

@RestController
@RequestMapping("/api/v1/orders")
@RequiredArgsConstructor
public class OrderController {

    private final OrderService orderService;

    // Simple role check
    @GetMapping
    @PreAuthorize("hasRole('USER') or hasRole('ADMIN')")
    public Page<OrderSummary> listOrders(@AuthenticationPrincipal SecurityUser user,
                                          Pageable pageable) {
        return orderService.findByUser(user.getUserId(), pageable);
    }

    // Object-level hasPermission check
    @GetMapping("/{orderId}")
    @PreAuthorize("hasPermission(#orderId, 'Order', 'READ')")
    public OrderDetail getOrder(@PathVariable String orderId) {
        return orderService.findById(orderId);
    }

    // PostAuthorize on returned object
    @GetMapping("/{orderId}/detail")
    @PostAuthorize("hasPermission(returnObject, 'READ')")
    public Order getOrderDomain(@PathVariable String orderId) {
        return orderService.findDomainById(orderId);
    }

    // Custom bean method in SpEL
    @PutMapping("/{orderId}")
    @PreAuthorize("hasPermission(#orderId, 'Order', 'WRITE')")
    public OrderDetail updateOrder(@PathVariable String orderId,
                                    @Valid @RequestBody UpdateOrderRequest request) {
        return orderService.update(orderId, request);
    }

    // Combining conditions
    @DeleteMapping("/{orderId}")
    @PreAuthorize("hasRole('ADMIN') and hasAuthority('orders:delete')")
    public ResponseEntity<Void> deleteOrder(@PathVariable String orderId) {
        orderService.delete(orderId);
        return ResponseEntity.noContent().build();
    }

    // Environment-based: business hours only
    @PostMapping("/bulk-cancel")
    @PreAuthorize("""
        hasRole('ADMIN') and
        T(java.time.LocalTime).now().isAfter(T(java.time.LocalTime).of(8,0)) and
        T(java.time.LocalTime).now().isBefore(T(java.time.LocalTime).of(18,0))
        """)
    public void bulkCancel(@RequestBody List<String> orderIds) {
        orderService.bulkCancel(orderIds);
    }

    // Tenant isolation
    @GetMapping("/tenant")
    @PreAuthorize("""
        hasRole('TENANT_ADMIN') and
        #tenantId == authentication.principal.tenantId
        """)
    public List<OrderSummary> getOrdersByTenant(@RequestParam String tenantId) {
        return orderService.findByTenant(tenantId);
    }
}

// ═══════════════════════════════════════════════════
// 4. ABAC POLICY ENGINE (Alternative: Rule-based)
// ═══════════════════════════════════════════════════

// Define policies as composable predicates
@Component
@RequiredArgsConstructor
public class OrderPolicies {

    // Policy: User can access order
    public Predicate<PolicyContext<Order>> canReadOrder() {
        return isAdmin()
            .or(isOwner())
            .or(isSupportStaff())
            .or(isTenantAdmin().and(hasTenantMatch()));
    }

    public Predicate<PolicyContext<Order>> canCancelOrder() {
        return isAdmin()
            .or(isSupportStaff())
            .or(isOwner().and(ctx -> ctx.resource().getStatus() == OrderStatus.PENDING));
    }

    private Predicate<PolicyContext<Order>> isAdmin() {
        return ctx -> ctx.authentication().getAuthorities().stream()
            .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));
    }

    private Predicate<PolicyContext<Order>> isOwner() {
        return ctx -> ctx.resource().getUserId().toString()
            .equals(ctx.authentication().getName());
    }

    private Predicate<PolicyContext<Order>> isSupportStaff() {
        return ctx -> ctx.authentication().getAuthorities().stream()
            .anyMatch(a -> a.getAuthority().equals("ROLE_SUPPORT"));
    }

    private Predicate<PolicyContext<Order>> isTenantAdmin() {
        return ctx -> ctx.authentication().getAuthorities().stream()
            .anyMatch(a -> a.getAuthority().equals("ROLE_TENANT_ADMIN"));
    }

    private Predicate<PolicyContext<Order>> hasTenantMatch() {
        return ctx -> {
            var principal = (SecurityUser) ctx.authentication().getPrincipal();
            return ctx.resource().getTenantId().equals(principal.getTenantId());
        };
    }
}

record PolicyContext<R>(Authentication authentication, R resource, String action) {}
```

### Row-Level Security with Spring Data Specifications

```java
// Enforce data visibility at the query level (not just method level)
@Component
@RequiredArgsConstructor
public class OrderSecuritySpecification {

    public Specification<OrderJpaEntity> visibleTo(Authentication auth) {
        var principal = extractPrincipal(auth);

        if (principal.hasRole("ADMIN")) {
            return Specification.where(null);  // Admin sees everything
        }

        if (principal.hasRole("SUPPORT")) {
            // Support sees all, but not soft-deleted
            return (root, query, cb) -> cb.isNull(root.get("deletedAt"));
        }

        if (principal.hasRole("TENANT_ADMIN")) {
            // Tenant admin sees all orders in their tenant
            return (root, query, cb) -> cb.and(
                cb.equal(root.get("tenantId"), principal.tenantId()),
                cb.isNull(root.get("deletedAt"))
            );
        }

        // Regular user sees only their own orders
        return (root, query, cb) -> cb.and(
            cb.equal(root.get("userId"), principal.userId().toString()),
            cb.isNull(root.get("deletedAt"))
        );
    }
}

// Repository using specification for implicit row-level security
@Repository
public interface OrderJpaRepository extends JpaRepository<OrderJpaEntity, String>,
        JpaSpecificationExecutor<OrderJpaEntity> {}

// Service applying row-level filtering
@Service
@RequiredArgsConstructor
public class SecureOrderQueryService {

    private final OrderJpaRepository orderRepo;
    private final OrderSecuritySpecification securitySpec;

    public Page<OrderSummary> findOrders(Pageable pageable) {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        var visibilitySpec = securitySpec.visibleTo(auth);
        return orderRepo.findAll(visibilitySpec, pageable).map(OrderSummary::from);
    }
}
```

---

## 🧪 Verification, Testing & Infrastructure Commands

```java
// Test ABAC policies
@SpringBootTest
class OrderPermissionEvaluatorTest {

    @Autowired
    private OrderPermissionEvaluator evaluator;

    @Test
    @WithMockUser(roles = "USER")
    void ownerCanReadOwnOrder() {
        var owner = ((SecurityUser) SecurityContextHolder.getContext()
            .getAuthentication().getPrincipal());
        var order = buildOrder(owner.getUserId()); // same userId

        assertTrue(evaluator.hasPermission(
            SecurityContextHolder.getContext().getAuthentication(),
            order,
            "READ"
        ));
    }

    @Test
    @WithMockUser(username = "other-user", roles = "USER")
    void nonOwnerCannotReadOrder() {
        var ownerOrder = buildOrder(UUID.randomUUID()); // different userId

        assertFalse(evaluator.hasPermission(
            SecurityContextHolder.getContext().getAuthentication(),
            ownerOrder,
            "READ"
        ));
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void adminCanDeleteAnyOrder() {
        var anyOrder = buildOrder(UUID.randomUUID());

        assertTrue(evaluator.hasPermission(
            SecurityContextHolder.getContext().getAuthentication(),
            anyOrder,
            "DELETE"
        ));
    }
}
```

```powershell
# Test fine-grained access (as regular user)
$token = ... # regular user token

# Should return 200 for own orders
Invoke-RestMethod -Uri "http://localhost:8080/api/v1/orders/my-order-id" `
    -Headers @{ Authorization = "Bearer $token" }

# Should return 403 for another user's order
try {
    Invoke-RestMethod -Uri "http://localhost:8080/api/v1/orders/other-users-order-id" `
        -Headers @{ Authorization = "Bearer $token" }
} catch {
    Write-Host "Expected 403: $($_.Exception.Response.StatusCode)"
}

# Admin can access any order
$adminToken = ... # admin token
Invoke-RestMethod -Uri "http://localhost:8080/api/v1/orders/any-order-id" `
    -Headers @{ Authorization = "Bearer $adminToken" }
```

---

## ⚡ Senior Best Practices & Critical Anti-Patterns

### ✅ Best Practices

1. **Test EVERY permission combination** — Write a permission matrix test that exhaustively tests all role × resource × action combinations.

2. **Use `@PostAuthorize` for filtering returned objects** — Prevents information disclosure even when the request itself is allowed.

3. **Cache permission decisions for read-heavy APIs** — `@Cacheable` on permission evaluator methods with appropriate TTL.

4. **Implement audit logging for all authorization decisions** — Log `{userId, resource, action, decision, reason}` for SOC2/compliance.

5. **Use Spring Data Specifications for row-level security** — Filtering at the query level is more efficient than filtering in-memory after fetch.

### ❌ Critical Anti-Patterns

| Anti-Pattern | Problem | Fix |
|-------------|---------|-----|
| **Client-enforced permissions only** | Frontend hides buttons but API is still accessible | ALWAYS enforce on server; frontend is UI hint only |
| **Checking roles in business logic** | `if (user.hasRole("ADMIN"))` in service = hard to test and maintain | Use `@PreAuthorize` declaratively |
| **Fetching full object to check permission** | N+1 queries per authorization check on list endpoints | Use projections or IDs; lazy-load full object only when needed |
| **Using string comparison for role checks** | Typos like `"ROLE_ADMIN"` vs `"ADMIN"` create security gaps | Use constants or enums for role/permission names |
| **Ignoring method security on internal APIs** | Internal services bypass gateway; no security at service level | Apply `@PreAuthorize` at service layer too, not just controllers |

---

*Previous: [06-passkey-fido2-webauthn.md](./06-passkey-fido2-webauthn.md) | Next: [../03-database/01-flyway-liquibase-migration.md](../03-database/01-flyway-liquibase-migration.md)*
