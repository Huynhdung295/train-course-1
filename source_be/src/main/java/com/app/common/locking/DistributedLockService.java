package com.app.common.locking;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.redisson.api.RLock;
import org.redisson.api.RedissonClient;
import org.springframework.stereotype.Service;

import java.util.concurrent.TimeUnit;
import java.util.function.Supplier;

/**
 * DistributedLockService — Wrapper around Redisson for distributed locking.
 *
 * Prevents race conditions across multiple server instances.
 * Use cases:
 *   - Inventory decrement (prevent overselling)
 *   - Payment processing (prevent double charge)
 *   - Scheduled job deduplication
 *
 * Usage:
 *   lockService.executeWithLock("inventory:product-uuid", () -> {
 *       inventoryService.decrement(productId, quantity);
 *   });
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class DistributedLockService {

    private static final long DEFAULT_WAIT_SECONDS = 3;
    private static final long DEFAULT_LEASE_SECONDS = 10;
    private static final String KEY_PREFIX = "nexus:lock:";

    private final RedissonClient redissonClient;

    /**
     * Executes the given action while holding a distributed lock.
     * Automatically releases the lock after execution.
     *
     * @param lockKey  Unique key for the lock (e.g., "inventory:product-123")
     * @param action   The business logic to execute exclusively
     * @throws LockAcquisitionException if the lock cannot be acquired within the wait time
     */
    public void executeWithLock(String lockKey, Runnable action) {
        executeWithLock(lockKey, DEFAULT_WAIT_SECONDS, DEFAULT_LEASE_SECONDS, () -> {
            action.run();
            return null;
        });
    }

    /**
     * Executes the given action while holding a distributed lock, and returns a result.
     */
    public <T> T executeWithLock(String lockKey, Supplier<T> action) {
        return executeWithLock(lockKey, DEFAULT_WAIT_SECONDS, DEFAULT_LEASE_SECONDS, action);
    }

    public <T> T executeWithLock(String lockKey, long waitSeconds, long leaseSeconds, Supplier<T> action) {
        String fullKey = KEY_PREFIX + lockKey;
        RLock lock = redissonClient.getLock(fullKey);
        boolean acquired = false;

        try {
            acquired = lock.tryLock(waitSeconds, leaseSeconds, TimeUnit.SECONDS);
            if (!acquired) {
                throw new LockAcquisitionException(
                    "Could not acquire lock for key: " + lockKey + " within " + waitSeconds + "s");
            }
            log.debug("Distributed lock acquired: {}", fullKey);
            return action.get();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new LockAcquisitionException("Interrupted while acquiring lock: " + lockKey);
        } finally {
            if (acquired && lock.isHeldByCurrentThread()) {
                lock.unlock();
                log.debug("Distributed lock released: {}", fullKey);
            }
        }
    }

    public static class LockAcquisitionException extends RuntimeException {
        public LockAcquisitionException(String message) { super(message); }
    }
}
