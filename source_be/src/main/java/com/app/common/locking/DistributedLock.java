package com.app.common.locking;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;
import java.util.concurrent.TimeUnit;

/**
 * @DistributedLock — Custom annotation for Redisson distributed locking.
 * 
 * Usage:
 * <pre>
 *   @DistributedLock(key = "#productId", waitTime = 5, leaseTime = 30)
 *   public InventoryReservation reserve(String productId, int quantity) { ... }
 * </pre>
 */
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface DistributedLock {

    /**
     * SpEL expression for the lock key. Can reference method parameters.
     * e.g. "#productId", "'order:' + #orderId", "#cmd.orderId.value()"
     */
    String key();

    /** Time unit for waitTime and leaseTime */
    TimeUnit timeUnit() default TimeUnit.SECONDS;

    /** Max time to wait to acquire the lock (default: 5s) */
    long waitTime() default 5L;

    /** Auto-release the lock after this time, even if not explicitly unlocked (default: 30s) */
    long leaseTime() default 30L;

    /** Prefix for the Redis lock key to avoid collisions */
    String prefix() default "lock:";
}
