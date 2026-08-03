# 🏷️ JPA Annotations Deep Dive — @Transactional, @Convert, @Audited

> **Category**: Database | **Complexity**: Expert | **Java**: 21+ | **Hibernate**: 6.5+

---

## 📖 Core Technical Mechanics & Deep-Dive

### @Transactional Internals — How Spring Manages Transactions

`@Transactional` works via **Spring AOP proxy**. When you call a `@Transactional` method, Spring intercepts the call through a CGLIB proxy:

```
Client Code calls service.saveOrder()
    │
    ▼
Spring CGLIB Proxy (TransactionInterceptor)
    ├── Look up transaction definition (propagation, isolation, readOnly, rollbackFor)
    ├── Get or create transaction (based on propagation)
    │   └── DataSourceTransactionManager.doBegin()
    │       └── connection = dataSource.getConnection()
    │           connection.setAutoCommit(false)
    │           connection.setTransactionIsolation(isolation.value())
    ├── Bind connection to current thread (TransactionSynchronizationManager)
    │
    ▼ → actual service.saveOrder() method executes
    │
    ├── If success: commit()
    └── If RuntimeException or specified exception: rollback()
        └── connection.rollback()
```

### Propagation Behaviors Explained

| Propagation | Behavior | Use Case |
|------------|---------|---------|
| `REQUIRED` (default) | Join existing TX; create new if none | Standard service methods |
| `REQUIRES_NEW` | Always create new TX, suspend existing | Audit logging (must persist even if outer TX rolls back) |
| `NESTED` | Savepoint in existing TX | Partial rollback capability |
| `SUPPORTS` | Join if exists; no TX if none | Read-only queries where TX is optional |
| `NOT_SUPPORTED` | Suspend existing TX, run without | Legacy code requiring no-TX environment |
| `MANDATORY` | Must have existing TX; throw if none | Sub-services that must be called from a TX |
| `NEVER` | Throw if TX exists | Code that must not run in TX (batch reporting) |

### Isolation Levels Explained

| Level | Dirty Read | Non-Repeatable Read | Phantom Read | Use Case |
|-------|-----------|--------------------|--------------|----|
| `READ_UNCOMMITTED` | ✅ Possible | ✅ Possible | ✅ Possible | Very rare; dirty reads allowed |
| `READ_COMMITTED` (default) | ❌ Prevented | ✅ Possible | ✅ Possible | Most web apps; PostgreSQL default |
| `REPEATABLE_READ` | ❌ | ❌ Prevented | ✅ Possible | Financial: re-reading same row must be consistent |
| `SERIALIZABLE` | ❌ | ❌ | ❌ Prevented | Highest safety; inventory checkout, seat booking |

---

## 🌐 Real-World GitHub Patterns & Industry Reference

- **[vlad/high-performance-java-persistence](https://github.com/vladmihalcea/high-performance-java-persistence)** — The canonical JPA performance book
- **[Hibernate Envers Wiki](https://hibernate.org/orm/envers/)** — Official Envers documentation with patterns

---

## 🏷️ Framework Annotations Reference

| Annotation | Package | Purpose |
|-----------|---------|---------|
| `@Transactional` | `o.s.transaction.annotation` | Transaction management |
| `@Entity` | `jakarta.persistence` | JPA entity |
| `@Table` | `jakarta.persistence` | Table metadata |
| `@Id` | `jakarta.persistence` | Primary key |
| `@GeneratedValue` | `jakarta.persistence` | PK generation |
| `@Column` | `jakarta.persistence` | Column mapping |
| `@Enumerated` | `jakarta.persistence` | Enum type |
| `@Convert` | `jakarta.persistence` | Custom AttributeConverter |
| `@Embedded` | `jakarta.persistence` | Embed value object |
| `@Version` | `jakarta.persistence` | Optimistic locking |
| `@CreatedDate` | `o.s.data.annotation` | Spring Data audit |
| `@LastModifiedDate` | `o.s.data.annotation` | Spring Data audit |
| `@Audited` | `o.h.envers` | Hibernate Envers history |
| `@NotAudited` | `o.h.envers` | Exclude field from history |
| `@DynamicUpdate` | `o.h.annotations` | Update only changed columns |
| `@BatchSize` | `o.h.annotations` | Collection batch loading |

---

## ⚙️ Production Configuration

```yaml
spring:
  jpa:
    properties:
      hibernate:
        # Envers audit table suffix
        org:
          hibernate:
            envers:
              audit_table_suffix: _history
              revision_field_name: revision_id
              revision_type_field_name: revision_type
              store_data_at_delete: true    # Store entity state at delete time
              do_not_audit_optimistic_locking_field: true  # Don't audit @Version
              global_with_modified_flag: true  # Track which fields changed
              modified_flag_suffix: _modified
```

---

## 📐 System Design Blueprint

### @Transactional — Production Patterns

```java
// ═══════════════════════════════════════════════════
// PROPAGATION PATTERNS
// ═══════════════════════════════════════════════════

@Service
@RequiredArgsConstructor
@Slf4j
public class OrderService {

    private final OrderRepository orderRepo;
    private final AuditLogService auditLogService;
    private final InventoryService inventoryService;
    private final EmailService emailService;

    // REQUIRED (default): Standard transactional method
    @Transactional
    public Order createOrder(CreateOrderCommand cmd) {
        var order = Order.create(cmd);
        orderRepo.save(order);

        // This runs in the SAME transaction as createOrder
        inventoryService.reserve(order.getItems());

        // REQUIRES_NEW: runs in SEPARATE transaction
        // If email fails, order is still saved (audit log persists separately)
        auditLogService.log("ORDER_CREATED", order.getId());

        return order;
    }

    // READ_COMMITTED (default for most DBs, explicit for clarity)
    @Transactional(isolation = Isolation.READ_COMMITTED, readOnly = true)
    public OrderDetail getOrderDetail(Long orderId) {
        return orderRepo.findDetailById(orderId)
            .orElseThrow(() -> new OrderNotFoundException(orderId));
    }

    // SERIALIZABLE: For inventory operations where phantom reads would cause overselling
    @Transactional(isolation = Isolation.SERIALIZABLE)
    public void reserveInventory(Long productId, int quantity) {
        var product = productRepo.findById(productId).orElseThrow();

        if (product.getAvailableQuantity() < quantity) {
            throw new InsufficientStockException(productId, quantity);
        }

        // With SERIALIZABLE: no other transaction can insert/update rows
        // matching this SELECT between our SELECT and UPDATE
        product.reserve(quantity);
        productRepo.save(product);
    }

    // REQUIRES_NEW: Always own transaction (used for audit that must persist on rollback)
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void logFailedPayment(Long orderId, String reason) {
        // Even if the outer transaction rolls back, this audit record is committed
        auditLogRepo.save(new AuditLog("PAYMENT_FAILED", orderId, reason));
    }

    // NESTED: Partial rollback with savepoint
    @Transactional(propagation = Propagation.NESTED)
    public void tryApplyPromoCode(Long orderId, String promoCode) {
        // If this fails, it rolls back to savepoint — outer TX continues
        var discount = promoService.validate(promoCode);
        orderRepo.applyDiscount(orderId, discount);
    }

    // rollbackFor: Roll back on checked exceptions too
    @Transactional(rollbackFor = {PaymentException.class, InventoryException.class})
    public void processOrderWithCheckedExceptions(Long orderId) throws PaymentException {
        var order = orderRepo.findById(orderId).orElseThrow();
        paymentService.charge(order);  // throws checked PaymentException
    }

    // noRollbackFor: Don't roll back on specific exceptions
    @Transactional(noRollbackFor = {OptimisticLockingFailureException.class})
    public void updateOrderStatus(Long orderId, OrderStatus status) {
        // Optimistic lock failure handled separately; don't roll back entire TX
        orderRepo.findById(orderId).ifPresent(order -> {
            order.setStatus(status);
            orderRepo.save(order);
        });
    }
}

// ═══════════════════════════════════════════════════
// HIBERNATE ENVERS — Entity History Tracking
// ═══════════════════════════════════════════════════

@Entity
@Table(name = "orders")
@Audited   // Track all changes to this entity
@EntityListeners(AuditingEntityListener.class)
public class Order {

    @Id
    private Long id;

    @Audited   // Default: track this field
    private OrderStatus status;

    @Audited
    private BigDecimal totalAmount;

    @NotAudited   // Don't track these fields (too noisy / sensitive)
    private String internalNotes;

    @NotAudited
    private byte[] reportCache;

    @Version   // Excluded from audit by default (do_not_audit_optimistic_locking_field=true)
    private Integer version;

    @CreatedDate
    @NotAudited   // Audit timestamps don't need to be audited themselves
    private Instant createdAt;
}

// Query audit history
@Service
@RequiredArgsConstructor
public class OrderHistoryService {

    private final AuditReader auditReader;

    @Bean
    public AuditReader auditReader(EntityManagerFactory emf) {
        return AuditReaderFactory.get(emf.createEntityManager());
    }

    // Get all revisions for an order
    public List<OrderRevision> getOrderHistory(Long orderId) {
        return auditReader.createQuery()
            .forRevisionsOfEntity(Order.class, false, true)  // include deleted
            .add(AuditEntity.id().eq(orderId))
            .addOrder(AuditEntity.revisionNumber().asc())
            .getResultList()
            .stream()
            .map(result -> {
                var array = (Object[]) result;
                var order = (Order) array[0];
                var revInfo = (DefaultRevisionEntity) array[1];
                var revType = (RevisionType) array[2];
                return new OrderRevision(order, revInfo.getRevisionDate(), revType);
            })
            .toList();
    }

    // Get order state at specific revision
    public Order getOrderAtRevision(Long orderId, int revisionNumber) {
        return auditReader.find(Order.class, orderId, revisionNumber);
    }

    // Find all orders modified by a specific user
    public List<Order> findOrdersModifiedByUser(String username, Date since) {
        return auditReader.createQuery()
            .forRevisionsOfEntity(Order.class, true, false)
            .add(AuditEntity.revisionProperty("modifiedBy").eq(username))
            .add(AuditEntity.revisionProperty("timestamp").gt(since.getTime()))
            .getResultList();
    }
}

// Custom revision entity with additional metadata
@Entity
@RevisionEntity(CustomRevisionListener.class)
@Table(name = "revisions")
public class CustomRevisionEntity extends DefaultRevisionEntity {

    @Column(name = "modified_by")
    private String modifiedBy;

    @Column(name = "ip_address")
    private String ipAddress;

    @Column(name = "request_id")
    private String requestId;
}

@Component
public class CustomRevisionListener implements RevisionListener {

    @Override
    public void newRevision(Object revisionEntity) {
        var revision = (CustomRevisionEntity) revisionEntity;
        var auth = SecurityContextHolder.getContext().getAuthentication();
        revision.setModifiedBy(auth != null ? auth.getName() : "system");
        // IP from MDC or RequestContextHolder
        revision.setRequestId(MDC.get("requestId"));
    }
}

// ═══════════════════════════════════════════════════
// @CONVERT — Custom AttributeConverter
// ═══════════════════════════════════════════════════

// JSON column converter (store complex object as JSONB in PostgreSQL)
@Converter
@Component
@RequiredArgsConstructor
public class JsonbConverter implements AttributeConverter<Map<String, Object>, String> {

    private final ObjectMapper objectMapper;

    @Override
    public String convertToDatabaseColumn(Map<String, Object> attribute) {
        if (attribute == null) return null;
        try {
            return objectMapper.writeValueAsString(attribute);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Cannot serialize to JSON", e);
        }
    }

    @Override
    public Map<String, Object> convertToEntityAttribute(String dbData) {
        if (dbData == null) return null;
        try {
            return objectMapper.readValue(dbData, new TypeReference<>() {});
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Cannot deserialize from JSON", e);
        }
    }
}

// Usage:
@Entity
public class Order {
    @Convert(converter = JsonbConverter.class)
    @Column(name = "metadata", columnDefinition = "jsonb")
    private Map<String, Object> metadata;

    @Convert(converter = AesEncryptionConverter.class)
    @Column(name = "payment_token")
    private String paymentToken;   // Encrypted in DB, plaintext in Java
}
```

---

## 🧪 Verification Commands

```powershell
# Check Envers audit tables created
docker exec postgres-dev psql -U app -d app_db `
    -c "SELECT tablename FROM pg_tables WHERE tablename LIKE '%_history'"

# Query audit history via REST endpoint
Invoke-RestMethod -Uri "http://localhost:8080/api/v1/orders/123/history" `
    -Headers @{ Authorization = "Bearer $adminToken" } |
    ConvertTo-Json -Depth 5

# Test SERIALIZABLE isolation — concurrent requests
# Start two concurrent PowerShell sessions and attempt inventory reservation
# With SERIALIZABLE, only one should succeed
$job1 = Start-Job { Invoke-RestMethod -Method POST `
    -Uri "http://localhost:8080/api/v1/inventory/reserve" `
    -Body '{"productId":"p1","quantity":100}' -ContentType "application/json" }

$job2 = Start-Job { Invoke-RestMethod -Method POST `
    -Uri "http://localhost:8080/api/v1/inventory/reserve" `
    -Body '{"productId":"p1","quantity":100}' -ContentType "application/json" }

Receive-Job $job1, $job2
```

---

## ⚡ Best Practices & Anti-Patterns

### ✅ Best Practices
1. **Default to `READ_COMMITTED`** — PostgreSQL's default; appropriate for 95% of use cases
2. **Use `REQUIRES_NEW` for audit logs** — They must persist even if business TX rolls back
3. **`@Transactional(readOnly = true)`** — Signals DB driver + ORM: skip dirty checking, use read-only connection

### ❌ Anti-Patterns

| Anti-Pattern | Fix |
|-------------|-----|
| `@Transactional` on `private` methods | Self-invocation bypasses proxy; only works on `public` methods via external call |
| Catching exceptions inside `@Transactional` and not rethrowing | Spring sees no exception → commits corrupted state |
| Using `SERIALIZABLE` everywhere | Performance killer; use only where phantom reads are a real business problem |
| Not annotating `@Transactional` on superclass methods | Annotations not inherited; re-annotate in concrete class |
| `@Audited` on every field including passwords | Audit table stores all versions — PII and secrets accumulate |
