# 🏛️ Base Entity & Audit Trail

> **Category**: Production Boilerplate | **Complexity**: Foundation | **Java**: 21+ | **Spring Boot**: 3.3+ | **Spring Data JPA**

---

## 📖 Core Technical Mechanics & Deep-Dive

### The Need for a Base Entity
Every table in a production database needs standard metadata columns:
- `id`: A consistent Primary Key type (usually UUID or Long/Snowflake).
- `created_at` / `updated_at`: Timestamps for record lifecycle.
- `created_by` / `updated_by`: Identity of the user who mutated the record.
- `version`: For Optimistic Locking (preventing lost updates).
- `is_deleted`: For Soft Deletes (preventing data loss and preserving foreign key integrity).

Writing these fields repeatedly in every `@Entity` violates DRY.
**Solution**: `@MappedSuperclass` + Spring Data JPA Auditing.

### Spring Data JPA Auditing
Spring can automatically populate audit fields using `@EntityListeners(AuditingEntityListener.class)`.
- `@CreatedDate`, `@LastModifiedDate` handle timestamps.
- `@CreatedBy`, `@LastModifiedBy` handle user identity (requires an `AuditorAware` bean hooked into Spring Security).

---

## 🌐 Real-World GitHub Patterns & Industry Reference

- **[spring-projects/spring-data-jpa](https://github.com/spring-projects/spring-data-jpa)** — Core framework supporting `@EnableJpaAuditing`.

---

## 🏷️ Framework Annotations & Dependencies

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-data-jpa</artifactId>
</dependency>
<!-- Required if using Spring Security to extract the current user for Auditing -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-security</artifactId>
</dependency>
```

---

## 📐 System Design Blueprint

### Complete Base Entity Implementation

```java
// ═══════════════════════════════════════════════════
// 1. THE BASE ENTITY (@MappedSuperclass)
// ═══════════════════════════════════════════════════

@MappedSuperclass // Marks this class as mapping information, not a table itself
@EntityListeners(AuditingEntityListener.class) // Enables automatic auditing
@Getter
@Setter
public abstract class BaseEntity implements Serializable {

    // UUIDs prevent enumeration attacks (unlike auto-incrementing Longs)
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    // Automatic timestamp insertion
    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    // Automatic timestamp update
    @LastModifiedDate
    @Column(name = "updated_at")
    private Instant updatedAt;

    // Hooked into AuditorAware (Security Context)
    @CreatedBy
    @Column(name = "created_by", updatable = false)
    private String createdBy;

    @LastModifiedBy
    @Column(name = "updated_by")
    private String updatedBy;

    // Optimistic Locking (Prevents concurrent modification overrides)
    @Version
    @Column(name = "version")
    private Integer version;

    // Soft Delete Flag
    @Column(name = "is_deleted", nullable = false)
    private boolean deleted = false;

    // --- Entity Lifecycle Callbacks (Optional hooks) ---
    
    @PrePersist
    protected void onPrePersist() {
        // Can be used if you don't want to rely on Spring Data Auditing
        // e.g., this.createdAt = Instant.now();
    }
    
    @PreUpdate
    protected void onPreUpdate() {
        // e.g., this.updatedAt = Instant.now();
    }
}

// ═══════════════════════════════════════════════════
// 2. CONCRETE ENTITY EXAMPLES
// ═══════════════════════════════════════════════════

@Entity
@Table(name = "users")
// SOFT DELETE: Whenever someone calls repository.delete(user), run an UPDATE instead
@SQLDelete(sql = "UPDATE users SET is_deleted = true WHERE id=? and version=?")
// READ FILTER: Whenever someone calls repository.findAll(), automatically append WHERE is_deleted = false
@SQLRestriction("is_deleted = false") 
public class User extends BaseEntity {

    @Column(nullable = false, unique = true)
    private String username;
    
    @Column(nullable = false)
    private String email;
    
    // Getters, Setters, Constructors...
}

// ═══════════════════════════════════════════════════
// 3. AUDITOR AWARE CONFIGURATION
// ═══════════════════════════════════════════════════

@Configuration
@EnableJpaAuditing(auditorAwareRef = "securityAuditorAware")
public class JpaAuditingConfig {

    /**
     * Tells Spring Data JPA how to look up the "current user"
     * when it needs to populate @CreatedBy or @LastModifiedBy.
     */
    @Bean
    public AuditorAware<String> securityAuditorAware() {
        return () -> {
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();

            if (authentication == null || 
                !authentication.isAuthenticated() || 
                authentication instanceof AnonymousAuthenticationToken) {
                // Return "SYSTEM" for background jobs or startup tasks
                return Optional.of("SYSTEM");
            }

            // Return the username/userId of the logged-in user
            return Optional.of(authentication.getName());
        };
    }
}
```

---

## 🧪 Verification Commands

```powershell
# Create a test entity to verify Auditing works
$body = @{ username = "testuser"; email = "test@example.com" } | ConvertTo-Json
Invoke-RestMethod -Method POST -Uri "http://localhost:8080/api/v1/users" `
    -Headers @{ Authorization = "Bearer your-jwt-token" } `
    -ContentType "application/json" -Body $body

# Verify the database directly
docker exec postgres psql -U app -d app_db -c "SELECT id, created_by, created_at, version, is_deleted FROM users;"

# Output should look like:
# id                                   | created_by | created_at                 | version | is_deleted
# -------------------------------------+------------+----------------------------+---------+-----------
# 550e8400-e29b-41d4-a716-446655440000 | admin_user | 2023-10-01 12:00:00.000+00 | 0       | f

# Test Soft Delete
Invoke-RestMethod -Method DELETE -Uri "http://localhost:8080/api/v1/users/550e8400-e29b-41d4-a716-446655440000"

# Verify Soft Delete bypassed JPA hard delete
docker exec postgres psql -U app -d app_db -c "SELECT is_deleted FROM users WHERE username = 'testuser';"
# Should return 't' (true)
```

---

## ⚡ Best Practices & Anti-Patterns

### ✅ Best Practices
1. **Use `Instant` for Timestamps**. Do not use `LocalDateTime`. `Instant` maps to `TIMESTAMPTZ` in PostgreSQL and always represents an absolute point in UTC, avoiding timezone translation bugs.
2. **Combine Soft Deletes with `UNIQUE` Constraints carefully**. If you soft-delete `testuser`, and they try to register again, a standard `UNIQUE (username)` index will fail. Fix: Use a partial index in PostgreSQL: `CREATE UNIQUE INDEX idx_uniq_username ON users (username) WHERE is_deleted = false;`.
3. **Use UUID (v4 or v7) for Primary Keys in microservices**. Auto-incrementing sequences (Long) require centralized coordination, allow enumeration attacks (`/users/1`, `/users/2`), and make data migration/merging difficult.

### ❌ Anti-Patterns

| Anti-Pattern | Problem | Fix |
|-------------|---------|-----|
| Not using `@Version` | Concurrent HTTP requests update the same entity, last one wins (Data Loss). | Use `@Version`. Let the loser fail fast and retry. |
| Hard Deletes (`DELETE FROM`) in Financial/Medical systems | Violates audit compliance and breaks foreign keys in reporting databases. | Use `@SQLDelete` (Soft Delete) or Event Sourcing. |
| Forgetting `@EnableJpaAuditing` | The `@CreatedDate` fields will silently remain `null`. | Add it to a `@Configuration` class. |
