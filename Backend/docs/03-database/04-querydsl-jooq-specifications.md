# 🔎 QueryDSL, jOOQ & Spring Data Specifications

> **Category**: Database | **Complexity**: Advanced | **Java**: 21+

---

## 📖 Core Technical Mechanics & Deep-Dive

### The Problem with String-Based Queries

Standard JPQL and SQL strings have critical problems:
- **No type safety** — Typos compile fine, fail at runtime
- **No refactoring support** — Rename a column → find all string references manually
- **No IDE completion** — No autocompletion for field names
- **Hard to compose** — Dynamic WHERE clauses require `StringBuilder` gymnastics

### Solution Comparison

| Approach | Type Safety | Dynamic Queries | SQL Access | Complexity |
|----------|------------|-----------------|------------|------------|
| **JPQL strings** | ❌ None | ❌ Hard | ❌ No | Low |
| **Spring Data Specifications** | ✅ Partial | ✅ Good | ❌ No | Medium |
| **QueryDSL** | ✅ Full | ✅ Excellent | ❌ JPA only | Medium |
| **jOOQ** | ✅ Full | ✅ Excellent | ✅ Full SQL | High |

### QueryDSL Code Generation

QueryDSL reads your JPA entities and generates `Q` classes at compile time:
```
@Entity class Order → QOrder class
@Entity class User  → QUser class
```

These Q classes let you write:
```java
QOrder order = QOrder.order;
// Compile-time safe — if you rename Order.status, QOrder.order.status won't compile
query.where(order.status.eq(OrderStatus.PENDING))
```

### jOOQ Code Generation

jOOQ reads your actual database schema (or Flyway migrations) and generates:
```
Table ORDERS → Tables.ORDERS record + DSL methods
Column STATUS → Field<String> with type-safe operations
```

---

## 🏷️ Framework Annotations & Dependencies

### QueryDSL Maven Setup

```xml
<dependencies>
    <dependency>
        <groupId>com.querydsl</groupId>
        <artifactId>querydsl-jpa</artifactId>
        <classifier>jakarta</classifier>
        <version>5.1.0</version>
    </dependency>
    <dependency>
        <groupId>com.querydsl</groupId>
        <artifactId>querydsl-apt</artifactId>
        <classifier>jakarta</classifier>
        <version>5.1.0</version>
        <scope>provided</scope>
    </dependency>
</dependencies>

<build>
    <plugins>
        <plugin>
            <groupId>com.mysema.maven</groupId>
            <artifactId>apt-maven-plugin</artifactId>
            <version>1.1.3</version>
            <executions>
                <execution>
                    <goals><goal>process</goal></goals>
                    <configuration>
                        <outputDirectory>target/generated-sources/java</outputDirectory>
                        <processor>com.querydsl.apt.jpa.JPAAnnotationProcessor</processor>
                    </configuration>
                </execution>
            </executions>
        </plugin>
    </plugins>
</build>
```

### jOOQ Maven Setup

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-jooq</artifactId>
</dependency>

<build>
    <plugins>
        <plugin>
            <groupId>org.jooq</groupId>
            <artifactId>jooq-codegen-maven</artifactId>
            <configuration>
                <jdbc>
                    <driver>org.postgresql.Driver</driver>
                    <url>jdbc:postgresql://localhost:5432/app_db</url>
                    <user>app_user</user>
                    <password>secret</password>
                </jdbc>
                <generator>
                    <database>
                        <name>org.jooq.meta.postgres.PostgresDatabase</name>
                        <includes>.*</includes>
                        <inputSchema>public</inputSchema>
                    </database>
                    <generate>
                        <records>true</records>
                        <daos>false</daos>
                        <fluentSetters>true</fluentSetters>
                    </generate>
                    <target>
                        <packageName>com.company.generated</packageName>
                        <directory>target/generated-sources/jooq</directory>
                    </target>
                </generator>
            </configuration>
        </plugin>
    </plugins>
</build>
```

---

## 📐 System Design Blueprint

### QueryDSL — Dynamic Predicates

```java
// ═══════════════════════════════════════════════════
// QUERYDSL REPOSITORY EXTENSION
// ═══════════════════════════════════════════════════

// Extend repository with QueryDSL support
public interface OrderRepository extends JpaRepository<Order, Long>,
        QuerydslPredicateExecutor<Order> {
}

// Service building dynamic queries
@Service
@RequiredArgsConstructor
public class OrderQueryService {

    private final OrderRepository orderRepo;
    private final JPAQueryFactory queryFactory;

    @Bean
    public JPAQueryFactory jpaQueryFactory(EntityManager em) {
        return new JPAQueryFactory(em);
    }

    // Dynamic filtering with QueryDSL predicates
    public Page<Order> findOrders(OrderFilterRequest filter, Pageable pageable) {
        var order = QOrder.order;

        // Build predicates conditionally
        var predicate = new BooleanBuilder();

        if (filter.userId() != null) {
            predicate.and(order.userId.eq(filter.userId()));
        }

        if (filter.status() != null && !filter.status().isEmpty()) {
            predicate.and(order.status.in(filter.status()));
        }

        if (filter.minAmount() != null) {
            predicate.and(order.totalAmount.goe(filter.minAmount()));
        }

        if (filter.maxAmount() != null) {
            predicate.and(order.totalAmount.loe(filter.maxAmount()));
        }

        if (filter.fromDate() != null) {
            predicate.and(order.placedAt.goe(filter.fromDate()));
        }

        if (filter.toDate() != null) {
            predicate.and(order.placedAt.loe(filter.toDate()));
        }

        if (filter.searchTerm() != null) {
            // Full text search across multiple fields
            predicate.and(
                order.user.email.containsIgnoreCase(filter.searchTerm())
                    .or(order.id.stringValue().contains(filter.searchTerm()))
            );
        }

        // Soft delete filter
        predicate.and(order.deletedAt.isNull());

        return orderRepo.findAll(predicate, pageable);
    }

    // Complex join query with JPAQueryFactory
    public List<OrderWithUserDto> findOrdersWithUserDetails(
            OrderStatus status, Instant since) {

        var order = QOrder.order;
        var user  = QUser.user;

        return queryFactory
            .select(Projections.constructor(OrderWithUserDto.class,
                order.id,
                order.status,
                order.totalAmount,
                user.email,
                user.firstName.concat(" ").concat(user.lastName),
                order.placedAt
            ))
            .from(order)
            .join(user).on(user.id.eq(order.userId))
            .where(
                order.status.eq(status),
                order.placedAt.goe(since),
                order.deletedAt.isNull()
            )
            .orderBy(order.placedAt.desc())
            .fetch();
    }

    // Grouping and aggregation
    public List<OrderStatsByStatus> getOrderStats() {
        var order = QOrder.order;

        return queryFactory
            .select(Projections.constructor(OrderStatsByStatus.class,
                order.status,
                order.count(),
                order.totalAmount.sum(),
                order.totalAmount.avg()
            ))
            .from(order)
            .where(order.deletedAt.isNull())
            .groupBy(order.status)
            .fetch();
    }
}

// ═══════════════════════════════════════════════════
// SPRING DATA SPECIFICATIONS — Composable Predicates
// ═══════════════════════════════════════════════════

public class OrderSpecifications {

    public static Specification<Order> byUserId(UUID userId) {
        return (root, query, cb) -> userId == null
            ? cb.conjunction()
            : cb.equal(root.get("userId"), userId);
    }

    public static Specification<Order> byStatus(List<OrderStatus> statuses) {
        return (root, query, cb) -> statuses == null || statuses.isEmpty()
            ? cb.conjunction()
            : root.get("status").in(statuses);
    }

    public static Specification<Order> placedBetween(Instant from, Instant to) {
        return (root, query, cb) -> {
            var predicates = new ArrayList<Predicate>();
            if (from != null) predicates.add(cb.greaterThanOrEqualTo(root.get("placedAt"), from));
            if (to != null) predicates.add(cb.lessThanOrEqualTo(root.get("placedAt"), to));
            return predicates.isEmpty() ? cb.conjunction() : cb.and(predicates.toArray(new Predicate[0]));
        };
    }

    public static Specification<Order> notDeleted() {
        return (root, query, cb) -> cb.isNull(root.get("deletedAt"));
    }

    public static Specification<Order> withUserEmail(String email) {
        return (root, query, cb) -> {
            if (email == null) return cb.conjunction();
            var userJoin = root.join("user", JoinType.INNER);
            return cb.like(cb.lower(userJoin.get("email")), "%" + email.toLowerCase() + "%");
        };
    }
}

// Composing specifications in service
@Service
@RequiredArgsConstructor
public class OrderService {

    private final OrderRepository orderRepo;

    public Page<Order> findOrders(OrderFilterRequest filter, Pageable pageable) {
        var spec = Specification.where(OrderSpecifications.notDeleted())
            .and(OrderSpecifications.byUserId(filter.userId()))
            .and(OrderSpecifications.byStatus(filter.statuses()))
            .and(OrderSpecifications.placedBetween(filter.fromDate(), filter.toDate()))
            .and(OrderSpecifications.withUserEmail(filter.userEmail()));

        return orderRepo.findAll(spec, pageable);
    }
}

// ═══════════════════════════════════════════════════
// jOOQ — Full SQL Power with Type Safety
// ═══════════════════════════════════════════════════

@Repository
@RequiredArgsConstructor
public class OrderJooqRepository {

    private final DSLContext dsl;

    // Generated table references (from schema)
    // Tables.ORDERS, Tables.USERS, Tables.ORDER_LINES

    public List<OrderSummaryRecord> findOrdersWithStats(UUID userId) {
        return dsl
            .select(
                ORDERS.ID,
                ORDERS.STATUS,
                ORDERS.TOTAL_AMOUNT,
                ORDERS.PLACED_AT,
                USERS.EMAIL,
                count(ORDER_LINES.ID).as("line_count"),
                sum(ORDER_LINES.LINE_TOTAL).as("lines_total")
            )
            .from(ORDERS)
            .join(USERS).on(USERS.ID.eq(ORDERS.USER_ID))
            .leftJoin(ORDER_LINES).on(ORDER_LINES.ORDER_ID.eq(ORDERS.ID))
            .where(
                ORDERS.USER_ID.eq(userId),
                ORDERS.DELETED_AT.isNull()
            )
            .groupBy(ORDERS.ID, USERS.EMAIL)
            .orderBy(ORDERS.PLACED_AT.desc())
            .fetchInto(OrderSummaryRecord.class);
    }

    // Window functions (not possible in JPQL)
    public List<OrderRankRecord> findTopOrdersByRevenue() {
        var ranked = dsl
            .select(
                ORDERS.ID,
                ORDERS.TOTAL_AMOUNT,
                rowNumber().over(
                    partitionBy(ORDERS.STATUS)
                        .orderBy(ORDERS.TOTAL_AMOUNT.desc())
                ).as("rank"),
                sum(ORDERS.TOTAL_AMOUNT).over(
                    partitionBy(ORDERS.STATUS)
                ).as("status_total")
            )
            .from(ORDERS)
            .where(ORDERS.DELETED_AT.isNull())
            .asTable("ranked");

        return dsl
            .selectFrom(ranked)
            .where(field("rank").le(10))
            .fetchInto(OrderRankRecord.class);
    }

    // Upsert with PostgreSQL ON CONFLICT
    public void upsertOrderView(OrderViewRecord record) {
        dsl.insertInto(ORDER_VIEWS)
            .set(ORDER_VIEWS.ORDER_ID, record.orderId())
            .set(ORDER_VIEWS.STATUS, record.status())
            .set(ORDER_VIEWS.LAST_UPDATED, OffsetDateTime.now())
            .onConflict(ORDER_VIEWS.ORDER_ID)
            .doUpdate()
            .set(ORDER_VIEWS.STATUS, record.status())
            .set(ORDER_VIEWS.LAST_UPDATED, OffsetDateTime.now())
            .execute();
    }

    // CTE (Common Table Expressions)
    public List<CategorySalesRecord> getCategorySales(YearMonth period) {
        var monthlySales = dsl.with("monthly_sales").as(
            select(
                PRODUCTS.CATEGORY_ID,
                sum(ORDER_LINES.LINE_TOTAL).as("total")
            )
            .from(ORDER_LINES)
            .join(PRODUCTS).on(PRODUCTS.ID.eq(ORDER_LINES.PRODUCT_ID))
            .join(ORDERS).on(ORDERS.ID.eq(ORDER_LINES.ORDER_ID))
            .where(
                ORDERS.PLACED_AT.between(
                    period.atDay(1).atStartOfDay().toInstant(ZoneOffset.UTC),
                    period.atEndOfMonth().atTime(23, 59, 59).toInstant(ZoneOffset.UTC)
                )
            )
            .groupBy(PRODUCTS.CATEGORY_ID)
        );

        return monthlySales
            .select(CATEGORIES.NAME, field("total", BigDecimal.class))
            .from("monthly_sales")
            .join(CATEGORIES).on(CATEGORIES.ID.eq(field("category_id", UUID.class)))
            .fetchInto(CategorySalesRecord.class);
    }
}
```

---

## 🧪 Verification Commands

```powershell
# Generate QueryDSL Q-classes
./mvnw generate-sources -pl domain

# Generate jOOQ classes from DB (requires running PostgreSQL)
./mvnw jooq-codegen:generate

# Verify generated sources exist
ls target/generated-sources/java/com/company/generated/
ls target/generated-sources/jooq/com/company/generated/
```

---

## ⚡ Best Practices & Anti-Patterns

### ✅ Best Practices
1. **QueryDSL for JPA domain queries** — Best for entity-centric, moderately complex queries
2. **jOOQ for reporting and analytics** — CTEs, window functions, ON CONFLICT, full SQL power
3. **Specifications for reusable filter predicates** — Compose independently-testable specs

### ❌ Anti-Patterns

| Anti-Pattern | Fix |
|-------------|-----|
| String concatenation for dynamic WHERE | Use QueryDSL `BooleanBuilder` |
| JPQL with 5+ joins | Switch to jOOQ or native SQL with projections |
| Not caching QueryDSL factory | Inject `JPAQueryFactory` as `@Bean` (thread-safe) |
| Running jOOQ codegen against prod DB | Use Flyway-managed test DB or Docker for codegen |
