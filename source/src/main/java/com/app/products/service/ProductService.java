package com.app.products.service;

import com.app.products.entity.Product;
import com.app.products.repository.ProductRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
@RequiredArgsConstructor
@SuppressWarnings("all")
public class ProductService {

    private final ProductRepository productRepository;

    @Cacheable(value = "products", key = "#id")
    public Product getProductById(UUID id) {
        return productRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Product not found"));
    }
}
