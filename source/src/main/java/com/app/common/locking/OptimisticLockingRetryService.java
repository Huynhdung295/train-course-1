package com.app.common.locking;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.retry.annotation.Backoff;
import org.springframework.retry.annotation.Recover;
import org.springframework.retry.annotation.Retryable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ConcurrentModificationException;
import java.util.function.Supplier;

/**
 * OptimisticLockingRetryService — Handles optimistic lock failures with retry.
 *
 * Pattern: @Retryable with exponential backoff on OptimisticLockingFailureException
 * Usage: Wrap any service operation that needs optimistic lock protection.
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class OptimisticLockingRetryService {

    /**
     * Execute a transactional operation with automatic retry on optimistic lock failure.
     * Retries up to 3 times with exponential backoff (100ms, 200ms, 400ms).
     */
    @Retryable(
        retryFor = { OptimisticLockingFailureException.class,
                     ObjectOptimisticLockingFailureException.class },
        maxAttempts = 3,
        backoff = @Backoff(delay = 100, multiplier = 2)
    )
    @Transactional
    public <T> T executeWithRetry(Supplier<T> operation) {
        log.debug("Executing operation with optimistic lock retry");
        return operation.get();
    }

    /**
     * Recovery: called when all retries are exhausted.
     */
    @Recover
    public <T> T recoverFromOptimisticLock(ObjectOptimisticLockingFailureException ex) {
        log.error("All optimistic lock retries exhausted: entity={}, id={}",
            ex.getPersistentClassName(), ex.getIdentifier());
        throw new ConcurrentModificationException(
            "Resource was modified by another user. Please refresh and retry.", ex);
    }
}
