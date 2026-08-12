package com.app.common.cache;

import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Component;

import java.security.SecureRandom;
import java.time.Duration;
import java.util.Random;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import java.util.function.Supplier;

/**
 * RandomizedTtlCacheService — Prevents Cache Avalanche
 */
@Component
@RequiredArgsConstructor
@SuppressWarnings("all")
public class RandomizedTtlCacheService {

    private final RedisTemplate<String, Object> redisTemplate;
    private final Random random = new SecureRandom();

    /**
     * Set value with randomized TTL to prevent avalanche.
     * baseTtl = 1 hour → actual TTL = 60-72 minutes (randomly)
     */
    public void setWithJitter(String key, Object value, Duration baseTtl) {
        // Add up to 20% random jitter
        var jitterSeconds = (long) (baseTtl.getSeconds() * 0.2 * random.nextDouble());
        var actualTtl = baseTtl.plusSeconds(jitterSeconds);

        redisTemplate.opsForValue().set(key, value, actualTtl);
    }

    /**
     * Background refresh: refresh cache entry BEFORE it expires.
     * Triggered when remaining TTL < threshold.
     */
    public <T> T getWithBackgroundRefresh(
            String key, Class<T> type,
            Supplier<T> dbLoader,
            Duration fullTtl,
            Duration refreshThreshold) {

        var ttl = redisTemplate.getExpire(key, TimeUnit.SECONDS);
        var value = redisTemplate.opsForValue().get(key);

        if (value != null) {
            // Trigger background refresh if approaching expiry
            if (ttl != null && ttl < refreshThreshold.getSeconds()) {
                CompletableFuture.runAsync(() -> {
                    var freshValue = dbLoader.get();
                    if (freshValue != null) {
                        setWithJitter(key, freshValue, fullTtl);
                    }
                });
            }
            return type.cast(value);
        }

        // Cache miss — load synchronously
        var freshValue = dbLoader.get();
        if (freshValue != null) {
            setWithJitter(key, freshValue, fullTtl);
        }
        return freshValue;
    }
}
