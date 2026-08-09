package com.app.common.database.specification;

import com.app.common.database.entity.OrderJpaEntity;
import com.app.common.database.entity.OrderStatus;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.jpa.domain.Specification;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

public class OrderSpecifications {

    public static Specification<OrderJpaEntity> byUserId(UUID userId) {
        return (root, query, cb) -> userId == null
            ? cb.conjunction()
            : cb.equal(root.get("userId"), userId);
    }

    public static Specification<OrderJpaEntity> byStatus(List<OrderStatus> statuses) {
        return (root, query, cb) -> statuses == null || statuses.isEmpty()
            ? cb.conjunction()
            : root.get("status").in(statuses);
    }

    public static Specification<OrderJpaEntity> placedBetween(Instant from, Instant to) {
        return (root, query, cb) -> {
            var predicates = new ArrayList<Predicate>();
            if (from != null) predicates.add(cb.greaterThanOrEqualTo(root.get("placedAt"), from));
            if (to != null) predicates.add(cb.lessThanOrEqualTo(root.get("placedAt"), to));
            return predicates.isEmpty() ? cb.conjunction() : cb.and(predicates.toArray(new Predicate[0]));
        };
    }

    public static Specification<OrderJpaEntity> notDeleted() {
        return (root, query, cb) -> cb.isNull(root.get("deletedAt"));
    }

}
