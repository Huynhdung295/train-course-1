package com.app.products.repository;

import com.app.products.entity.Product;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import java.util.UUID;

public interface ProductRepository extends JpaRepository<Product, UUID> {
    @org.springframework.data.jpa.repository.EntityGraph(attributePaths = {"category"})
    Optional<Product> findBySku(String sku);
}
