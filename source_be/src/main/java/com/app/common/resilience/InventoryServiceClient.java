package com.app.common.resilience;

import io.github.resilience4j.bulkhead.annotation.Bulkhead;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import io.github.resilience4j.ratelimiter.annotation.RateLimiter;
import io.github.resilience4j.retry.annotation.Retry;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.concurrent.CompletableFuture;

/**
 * InventoryServiceClient — Demonstrates Resilience4j patterns.
 *
 * Annotations apply in this order (innermost first):
 * TimeLimiter > Bulkhead > CircuitBreaker > Retry > RateLimiter
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class InventoryServiceClient {

    // ─── Circuit Breaker ─────────────────────────────────────────────────────

    /**
     * @CircuitBreaker: Opens after 50% failure rate over last 10 calls.
     * Open state: waits 30s then allows limited test calls through.
     * Configuration in application.yml: resilience4j.circuitbreaker.instances.inventoryService.*
     */
    @CircuitBreaker(name = "inventoryService", fallbackMethod = "reserveFallback")
    @Retry(name = "inventoryService")
    public boolean reserveStock(String productId, int quantity) {
        log.debug("Reserving stock: productId={}, quantity={}", productId, quantity);
        // NOTE: Real HTTP call to inventory service
        return true;
    }

    /**
     * Circuit breaker fallback — returns safe default when service is down.
     */
    public boolean reserveFallback(String productId, int quantity, Exception ex) {
        log.warn("Inventory service unavailable (CB open), using fallback. productId={}", productId);
        return false;  // Reject reservation when service is down
    }

    // ─── Retry ────────────────────────────────────────────────────────────────

    /**
     * @Retry: Retries 3 times with exponential backoff on any exception.
     * Configuration: resilience4j.retry.instances.inventoryService.*
     */
    @Retry(name = "inventoryService", fallbackMethod = "checkStockFallback")
    @CircuitBreaker(name = "inventoryService")
    public int checkStock(String productId) {
        log.debug("Checking stock for productId={}", productId);
        // NOTE: Real HTTP call
        return 100;
    }

    public int checkStockFallback(String productId, Exception ex) {
        log.warn("checkStock failed after retries for productId={}: {}", productId, ex.getMessage());
        return -1;  // Sentinel: unknown stock
    }

    // ─── Bulkhead (Thread Pool) ────────────────────────────────────────────────

    /**
     * @Bulkhead: Limits concurrent calls to this method (thread pool isolation).
     * Prevents inventory service issues from consuming all application threads.
     * Configuration: resilience4j.bulkhead.instances.inventoryService.*
     */
    @Bulkhead(name = "inventoryService", type = Bulkhead.Type.THREADPOOL, fallbackMethod = "releaseStockFallback")
    public CompletableFuture<Void> releaseStockAsync(String productId, int quantity) {
        log.debug("Releasing stock async: productId={}, quantity={}", productId, quantity);
        return CompletableFuture.runAsync(() -> {
            // NOTE: Real HTTP call
        });
    }

    public CompletableFuture<Void> releaseStockFallback(String productId, int quantity, Exception ex) {
        log.warn("Bulkhead full for releaseStock productId={}: {}", productId, ex.getMessage());
        return CompletableFuture.completedFuture(null);
    }

    // ─── Rate Limiter ─────────────────────────────────────────────────────────

    /**
     * @RateLimiter: Max 100 calls per second to inventory service.
     * Configuration: resilience4j.ratelimiter.instances.inventoryService.*
     */
    @RateLimiter(name = "inventoryService", fallbackMethod = "queryAllStockFallback")
    public String queryAllStock() {
        log.debug("Querying all stock");
        return "[]";
    }

    public String queryAllStockFallback(Exception ex) {
        log.warn("Rate limiter triggered for queryAllStock: {}", ex.getMessage());
        return "[]";
    }
}
