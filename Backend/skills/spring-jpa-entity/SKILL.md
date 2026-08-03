---
name: spring-jpa-entity
description: Generates Spring Data JPA Entities and Repositories following production-grade standards (BaseEntity, Soft Deletes, UUIDs).
---

# Spring Data JPA Entity Generator Skill

When asked to create or modify a JPA Entity or Repository in this workspace, you MUST adhere to the following architectural standards:

## 1. Core Rules
- **Extend BaseEntity**: Every entity MUST extend `BaseEntity` (which provides `id`, `created_at`, `updated_at`, `version`, `is_deleted`). Do NOT define `id` on the entity itself.
- **Soft Deletes**: Use `@SQLDelete` and `@SQLRestriction` to implement soft deletes automatically.
- **Lombok**: Use `@Getter`, `@Setter`, and `@NoArgsConstructor(access = AccessLevel.PROTECTED)`. 
- **Avoid @Data on Entities**: `@Data` generates `equals()`, `hashCode()`, and `toString()` which cause severe performance issues and infinite recursion with lazy-loaded `@OneToMany` relationships.
- **Collections**: Initialize all `@OneToMany` and `@ManyToMany` collections to `new ArrayList<>()` or `new HashSet<>()`.

## 2. Standard Entity Template

```java
package com.company.feature.domain;

import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;
import jakarta.persistence.*;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "orders")
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED) // Required by JPA
@SQLDelete(sql = "UPDATE orders SET is_deleted = true WHERE id=? and version=?")
@SQLRestriction("is_deleted = false")
public class Order extends BaseEntity {

    @Column(nullable = false)
    private String customerEmail;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 50)
    private OrderStatus status;

    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<OrderItem> items = new ArrayList<>();

    // Business Constructor
    public Order(String customerEmail) {
        this.customerEmail = customerEmail;
        this.status = OrderStatus.PENDING;
    }
    
    // Helper method for Bidirectional sync
    public void addItem(OrderItem item) {
        items.add(item);
        item.setOrder(this);
    }
}
```

## 3. Standard Repository Template
Always extend `JpaRepository<T, UUID>`. 

```java
package com.company.feature.repository;

import com.company.feature.domain.Order;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.UUID;
import java.util.Optional;

@Repository
public interface OrderRepository extends JpaRepository<Order, UUID> {
    
    // Spring Data JPA derives the query automatically
    Optional<Order> findByCustomerEmail(String email);
}
```
