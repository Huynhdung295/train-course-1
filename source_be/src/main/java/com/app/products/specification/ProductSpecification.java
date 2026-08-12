package com.app.products.specification;

import com.app.products.entity.Product;
import org.springframework.data.jpa.domain.Specification;

public class ProductSpecification {

    public static Specification<Product> hasName(String name) {
        return (root, query, criteriaBuilder) -> 
            name == null ? null : criteriaBuilder.like(criteriaBuilder.lower(root.get("name")), "%" + name.toLowerCase() + "%");
    }

    public static Specification<Product> priceGreaterThan(Double price) {
        return (root, query, criteriaBuilder) -> 
            price == null ? null : criteriaBuilder.greaterThan(root.get("price"), price);
    }
}
