# 🏢 Multi-Tenancy Architecture in Spring Boot

> **Category**: Database | **Complexity**: Expert | **Java**: 21+ | **Hibernate**: 6.5+

---

## 📖 Core Technical Mechanics & Deep-Dive

### Multi-Tenancy Strategies

| Strategy | Isolation | Cost | Use Case |
|----------|-----------|------|----------|
| **Database-per-Tenant** | Highest | Highest | Enterprise / compliance-heavy |
| **Schema-per-Tenant** | High | Medium | SaaS with strong isolation needs |
| **Row-Discriminator** | Lowest | Lowest | SaaS with many small tenants |
| **Hybrid** | Variable | Variable | Different tiers (free/premium) |

### Tenant Context Propagation

```
HTTP Request
    │
    ▼
TenantResolutionFilter
    ├── Extract tenant from: Header (X-Tenant-Id) / Subdomain / JWT claim
    └── Set in TenantContext (ThreadLocal)
    │
    ▼
Business Logic (TenantContext.getCurrentTenant())
    │
    ▼
Database Layer
    └── DataSource routing or Hibernate filter applies tenant isolation
    │
    ▼
Response
    └── TenantContext.clear() (CRITICAL: prevent ThreadLocal leaks)
```

---

## 🏷️ Framework Annotations & Dependencies

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-data-jpa</artifactId>
</dependency>
<dependency>
    <groupId>org.flywaydb</groupId>
    <artifactId>flyway-core</artifactId>
</dependency>
```

---

## ⚙️ Production Configuration

```yaml
app:
  multitenancy:
    strategy: schema     # schema | database | row-discriminator
    default-tenant: public
    tenant-header: X-Tenant-Id

spring:
  jpa:
    properties:
      hibernate:
        multiTenancy: SCHEMA   # DATABASE | SCHEMA | DISCRIMINATOR
        tenant_identifier_resolver: com.company.MultiTenantIdentifierResolver
        multi_tenant_connection_provider: com.company.SchemaMultiTenantConnectionProvider
```

---

## 📐 System Design Blueprint

### Complete Schema-per-Tenant Implementation

```java
// ═══════════════════════════════════════════════════
// 1. TENANT CONTEXT — ThreadLocal storage
// ═══════════════════════════════════════════════════

public class TenantContext {

    private static final ThreadLocal<String> CURRENT_TENANT = new ThreadLocal<>();

    public static void setCurrentTenant(String tenantId) {
        if (tenantId == null) throw new IllegalArgumentException("Tenant ID cannot be null");
        CURRENT_TENANT.set(tenantId);
    }

    public static String getCurrentTenant() {
        var tenantId = CURRENT_TENANT.get();
        if (tenantId == null) throw new TenantNotSetException("No tenant in context");
        return tenantId;
    }

    public static void clear() {
        CURRENT_TENANT.remove();   // CRITICAL: prevent memory leaks
    }

    public static boolean isSet() {
        return CURRENT_TENANT.get() != null;
    }
}

// ═══════════════════════════════════════════════════
// 2. TENANT RESOLUTION FILTER
// ═══════════════════════════════════════════════════

@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 1)   // After security filter
@RequiredArgsConstructor
@Slf4j
public class TenantResolutionFilter extends OncePerRequestFilter {

    private final TenantRepository tenantRepo;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        try {
            var tenantId = resolveTenantId(request);
            if (tenantId != null) {
                // Validate tenant exists
                if (!tenantRepo.existsByTenantId(tenantId)) {
                    response.sendError(HttpServletResponse.SC_BAD_REQUEST,
                        "Invalid tenant: " + tenantId);
                    return;
                }
                TenantContext.setCurrentTenant(tenantId);
                log.debug("Resolved tenant: {}", tenantId);
            }
            chain.doFilter(request, response);
        } finally {
            TenantContext.clear();   // ALWAYS clear in finally
        }
    }

    private String resolveTenantId(HttpServletRequest request) {
        // Strategy 1: Header
        var header = request.getHeader("X-Tenant-Id");
        if (header != null) return header;

        // Strategy 2: Subdomain (tenant.app.com → "tenant")
        var host = request.getServerName();
        if (host.contains(".")) {
            var subdomain = host.split("\\.")[0];
            if (!subdomain.equals("www") && !subdomain.equals("api")) return subdomain;
        }

        // Strategy 3: JWT claim (extracted by security filter)
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof Jwt jwt) {
            return jwt.getClaimAsString("tenantId");
        }

        return null;
    }
}

// ═══════════════════════════════════════════════════
// 3A. SCHEMA-PER-TENANT — Hibernate MultiTenantConnectionProvider
// ═══════════════════════════════════════════════════

@Component
@RequiredArgsConstructor
public class SchemaMultiTenantConnectionProvider implements MultiTenantConnectionProvider<String> {

    private final DataSource dataSource;
    private final TenantSchemaManager schemaManager;

    @Override
    public Connection getAnyConnection() throws SQLException {
        return dataSource.getConnection();
    }

    @Override
    public void releaseAnyConnection(Connection connection) throws SQLException {
        connection.close();
    }

    @Override
    public Connection getConnection(String tenantIdentifier) throws SQLException {
        var conn = dataSource.getConnection();
        // Switch to tenant schema
        var schema = schemaManager.getSchemaName(tenantIdentifier);
        conn.createStatement().execute("SET search_path TO " + schema + ", public");
        return conn;
    }

    @Override
    public void releaseConnection(String tenantIdentifier, Connection connection) throws SQLException {
        // Reset schema before returning to pool
        connection.createStatement().execute("SET search_path TO public");
        connection.close();
    }

    @Override
    public boolean supportsAggressiveRelease() {
        return false;   // Don't close connection aggressively with multiple operations
    }

    @Override
    public boolean isUnwrappableAs(Class<?> unwrapType) {
        return unwrapType.isInstance(this);
    }

    @Override
    public <T> T unwrap(Class<T> unwrapType) {
        return unwrapType.cast(this);
    }
}

@Component
@RequiredArgsConstructor
public class TenantIdentifierResolver implements CurrentTenantIdentifierResolver<String> {

    @Override
    public String resolveCurrentTenantIdentifier() {
        return TenantContext.isSet() ? TenantContext.getCurrentTenant() : "public";
    }

    @Override
    public boolean validateExistingCurrentSessions() {
        return true;
    }
}

// ═══════════════════════════════════════════════════
// 3B. ROW-DISCRIMINATOR — Column-based isolation
// ═══════════════════════════════════════════════════

@Entity
@Table(name = "orders")
@FilterDef(
    name = "tenantFilter",
    parameters = @ParamDef(name = "tenantId", type = String.class)
)
@Filter(
    name = "tenantFilter",
    condition = "tenant_id = :tenantId"
)
public class Order extends BaseEntity {

    @Column(name = "tenant_id", nullable = false, updatable = false)
    private String tenantId;

    // ... other fields
}

// Enable filter in repository
@Repository
@RequiredArgsConstructor
public class TenantAwareOrderRepository {

    private final EntityManager entityManager;
    private final OrderJpaRepository jpaRepo;

    @Transactional(readOnly = true)
    public List<Order> findAll() {
        // Enable tenant filter for this session
        var session = entityManager.unwrap(Session.class);
        session.enableFilter("tenantFilter")
            .setParameter("tenantId", TenantContext.getCurrentTenant());

        return jpaRepo.findAll();   // Will automatically add WHERE tenant_id = ?
    }

    @Transactional
    public Order save(Order order) {
        order.setTenantId(TenantContext.getCurrentTenant());   // Auto-stamp
        return jpaRepo.save(order);
    }
}

// ═══════════════════════════════════════════════════
// 4. TENANT PROVISIONING — Create new tenant schema
// ═══════════════════════════════════════════════════

@Service
@RequiredArgsConstructor
@Slf4j
public class TenantProvisioningService {

    private final DataSource dataSource;
    private final TenantRepository tenantRepo;

    @Transactional
    public void provisionTenant(String tenantId, String displayName) {
        // Validate
        if (tenantRepo.existsByTenantId(tenantId)) {
            throw new TenantAlreadyExistsException(tenantId);
        }

        var schemaName = "tenant_" + tenantId.toLowerCase().replaceAll("[^a-z0-9]", "_");

        // Create schema
        createSchema(schemaName);

        // Run migrations for new schema
        runMigrationsForSchema(schemaName);

        // Register tenant
        var tenant = new Tenant(tenantId, displayName, schemaName, TenantStatus.ACTIVE);
        tenantRepo.save(tenant);

        log.info("Provisioned tenant {} with schema {}", tenantId, schemaName);
    }

    private void createSchema(String schemaName) {
        try (var conn = dataSource.getConnection();
             var stmt = conn.createStatement()) {
            stmt.execute("CREATE SCHEMA IF NOT EXISTS " + schemaName);
        } catch (SQLException e) {
            throw new TenantProvisioningException("Failed to create schema: " + schemaName, e);
        }
    }

    private void runMigrationsForSchema(String schemaName) {
        var flyway = Flyway.configure()
            .dataSource(dataSource)
            .schemas(schemaName)
            .locations("classpath:db/migration/tenant")
            .load();
        flyway.migrate();
    }

    @Transactional
    public void suspendTenant(String tenantId) {
        tenantRepo.findByTenantId(tenantId)
            .ifPresent(tenant -> {
                tenant.setStatus(TenantStatus.SUSPENDED);
                tenantRepo.save(tenant);
            });
    }
}
```

---

## 🧪 Verification Commands

```powershell
# Test multi-tenant routing
# Tenant A request
Invoke-RestMethod -Uri "http://localhost:8080/api/v1/orders" `
    -Headers @{ "X-Tenant-Id" = "tenant-a"; Authorization = "Bearer $token" }

# Tenant B request — should return ONLY tenant B's data
Invoke-RestMethod -Uri "http://localhost:8080/api/v1/orders" `
    -Headers @{ "X-Tenant-Id" = "tenant-b"; Authorization = "Bearer $token" }

# Provision new tenant
$body = @{ tenantId = "acme"; displayName = "Acme Corp" } | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:8080/api/v1/admin/tenants" `
    -Method POST -ContentType "application/json" `
    -Headers @{ Authorization = "Bearer $adminToken" } -Body $body

# Verify schema created in PostgreSQL
docker exec postgres-dev psql -U app -d app_db `
    -c "SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'tenant_%'"
```

---

## ⚡ Best Practices & Anti-Patterns

### ✅ Best Practices
1. **Always clear TenantContext in finally block** — ThreadLocal leaks in thread pools are invisible and dangerous
2. **Validate tenant on every request** — Even authenticated users should have their tenant validated
3. **Use Flyway per-tenant migration** — Run `flyway.migrate()` for each tenant schema independently

### ❌ Anti-Patterns

| Anti-Pattern | Fix |
|-------------|-----|
| Not clearing ThreadLocal | `try { setTenant() } finally { TenantContext.clear() }` |
| Cross-tenant data access without explicit override | Always default to tenant filter ON |
| Using `tenant_id = 'public'` as default | Use dedicated schema for shared data |
| Tenant in URL path (`/api/v1/{tenantId}/orders`) | Header or subdomain — keeps URL clean |
