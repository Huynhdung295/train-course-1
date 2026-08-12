package com.app.products.repository;

import com.app.products.entity.Product;
import org.springframework.data.jpa.domain.Specification;

public class ProductSpecification {

    public static Specification<Product> hasName(String name) {
        return (root, query, cb) -> name == null ? null : cb.like(cb.lower(root.get("name")), "%" + name.toLowerCase() + "%");
    }

    public static Specification<Product> priceGreaterThan(Double price) {
        return (root, query, cb) -> price == null ? null : cb.greaterThan(root.get("price"), price);
    }
}
