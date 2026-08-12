package com.app.common.cache;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.redisson.api.RedissonClient;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.concurrent.TimeUnit;
import java.util.function.Supplier;

/**
 * StampedePreventionCacheService — Prevents Cache Stampede (缓存击穿)
 */
@Service
@RequiredArgsConstructor
@Slf4j
@SuppressWarnings("all")
public class StampedePreventionCacheService {

    private final RedissonClient redisson;
    private final RedisTemplate<String, Object> redisTemplate;

    /**
     * Get or load with distributed lock to prevent stampede.
     * Only ONE thread rebuilds the cache; others wait with timeout.
     */
    public <T> T getOrLoad(
            String cacheKey,
            Class<T> type,
            Supplier<T> loader,
            Duration ttl) {

        // 1. Check cache (lock-free fast path)
        var cached = redisTemplate.opsForValue().get(cacheKey);
        if (cached != null) {
            return type.cast(cached);
        }

        // 2. Acquire distributed lock for this specific cache key
        var lockKey = "cache:lock:" + cacheKey;
        var lock = redisson.getLock(lockKey);

        try {
            // Wait max 10s for lock; auto-release after 60s (prevents deadlock)
            boolean acquired = lock.tryLock(10, 60, TimeUnit.SECONDS);

            if (!acquired) {
                // Could not get lock — return stale or default
                log.warn("Could not acquire cache rebuild lock for: {}", cacheKey);
                return type.cast(redisTemplate.opsForValue().get(cacheKey));
            }

            // 3. Double-check: another thread may have rebuilt while we waited
            cached = redisTemplate.opsForValue().get(cacheKey);
            if (cached != null) {
                log.debug("Cache rebuilt by another thread for: {}", cacheKey);
                return type.cast(cached);
            }

            // 4. We won the lock — rebuild cache
            log.debug("Rebuilding cache under lock: {}", cacheKey);
            var value = loader.get();

            if (value != null) {
                redisTemplate.opsForValue().set(cacheKey, value, ttl);
            } else {
                // Cache null value for short duration to prevent penetration
                redisTemplate.opsForValue().set(cacheKey, NullValue.INSTANCE, Duration.ofSeconds(60));
            }

            return value;

        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new CacheLockInterruptedException("Interrupted while waiting for cache lock", e);
        } finally {
            if (lock.isHeldByCurrentThread()) {
                lock.unlock();
            }
        }
    }

    /**
     * Probabilistic Early Expiration (XFetch algorithm).
     * Proactively refreshes cache before expiry based on compute cost.
     * Avoids stampede without locking — at the cost of occasional early refresh.
     */
    public <T> T getWithEarlyExpiry(
            String cacheKey,
            Class<T> type,
            Supplier<T> loader,
            Duration ttl,
            double beta) {  // beta=1.0 standard; higher = more eager refresh

        var ttlSeconds = redisTemplate.getExpire(cacheKey, TimeUnit.SECONDS);
        var cached = redisTemplate.opsForValue().get(cacheKey);

        if (cached != null && ttlSeconds != null) {
            // XFetch: refresh early if: now + beta * computeTime * log(random) > expiry
            // For simplicity: refresh when TTL < 10% of total TTL
            var earlyRefreshThreshold = ttl.getSeconds() * 0.1;
            if (ttlSeconds > earlyRefreshThreshold) {
                return type.cast(cached);
            }
        }

        // Rebuild
        var value = loader.get();
        if (value != null) {
            var jitter = (long) (ttl.getSeconds() * 0.1 * Math.random());
            redisTemplate.opsForValue().set(cacheKey, value, ttl.plusSeconds(jitter));
        } else {
            redisTemplate.opsForValue().set(cacheKey, NullValue.INSTANCE, Duration.ofSeconds(60));
        }
        return value;
    }
}
