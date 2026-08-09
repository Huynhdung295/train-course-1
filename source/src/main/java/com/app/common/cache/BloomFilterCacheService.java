package com.app.common.cache;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.redisson.api.RBloomFilter;
import org.redisson.api.RedissonClient;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.stereotype.Service;

/**
 * BloomFilterCacheService — Prevents Cache Penetration (缓存穿透)
 * Uses Redisson distributed Bloom Filter.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class BloomFilterCacheService {

    private final RBloomFilter<String> productIdFilter;

    public boolean mightContainProduct(String productId) {
        return productIdFilter.contains(productId);
    }

    public void addProduct(String productId) {
        productIdFilter.add(productId);
    }

    @Configuration
    public static class BloomFilterConfig {
        @Bean
        public RBloomFilter<String> productIdBloomFilter(RedissonClient redisson) {
            var filter = redisson.<String>getBloomFilter("product:exists");
            // Initialize with 10M expected elements and 0.01% false positive rate
            // tryInit returns true if initialized, false if already initialized
            filter.tryInit(10_000_000L, 0.0001);
            return filter;
        }
    }
}
