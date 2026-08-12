# Contributing to Nexus Core API

Thank you for contributing! Please read this guide before opening a PR.

---

## 🌿 Branch Naming Convention

| Type | Format | Example |
|---|---|---|
| Feature | `feat/{ticket-id}-short-description` | `feat/NX-123-add-order-search` |
| Bug Fix | `fix/{ticket-id}-short-description` | `fix/NX-456-inventory-race-condition` |
| Hotfix | `hotfix/{ticket-id}-description` | `hotfix/NX-789-payment-timeout` |
| Refactor | `refactor/short-description` | `refactor/extract-kafka-config` |
| Chore | `chore/short-description` | `chore/update-spring-boot-3.4` |

---

## 📝 Commit Message Convention (Conventional Commits)

Format: `{type}({scope}): {short description}`

```
feat(orders): add bulk order cancellation endpoint
fix(inventory): prevent negative stock with distributed lock
refactor(security): extract JWT filter to separate class
docs(api): update swagger description for auth endpoints
test(orders): add integration test for order state machine
chore(deps): upgrade spring-boot to 3.4.0
```

Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `style`

---

## 🏗 Module Structure

Every new feature module must follow this structure:
```
com/app/{module}/
├── controller/     # @RestController — HTTP layer only, no business logic
├── service/        # Business logic — must use @Transactional appropriately
├── repository/     # Spring Data JPA repositories
├── entity/         # JPA entities extending BaseEntity
├── dto/            # Request/Response DTOs (records preferred)
└── {module}Events/ # Domain events (implements DomainEvent)
```

---

## ✅ Code Review Checklist

Before requesting a review, verify:

- [ ] No raw `double`/`float` for monetary values — use `BigDecimal`
- [ ] All new endpoints are documented with `@Operation` for Swagger
- [ ] `@Transactional(readOnly = true)` on all read-only service methods
- [ ] Sensitive data (passwords, tokens) never logged
- [ ] New dependencies justified and reviewed for security CVEs
- [ ] Integration test added for happy path + at least 1 error case
- [ ] `@Cacheable` methods use `keyGenerator = "tenantCacheKeyGenerator"`
- [ ] No hardcoded secrets or environment-specific values in code

---

## 🧪 Running Tests

```bash
# Unit tests only (fast, no Docker needed)
mvn test

# Integration tests (requires Docker for Testcontainers)
mvn verify -Pintegration-tests

# With specific profile
mvn test -Dspring.profiles.active=local
```

---

## 🐛 Reporting Issues

1. Check if the issue already exists
2. Include: Spring Boot version, Java version, steps to reproduce, expected vs actual behavior
3. Attach relevant log output with traceId for easier debugging
