package com.app.common.metrics;

import com.app.common.database.multitenancy.TenantContextHolder;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.concurrent.TimeUnit;

/**
 * BusinessMetricsService — Records domain-specific metrics for Grafana dashboards.
 *
 * These metrics appear in Prometheus and can be visualized in Grafana
 * to answer business questions like:
 *   - "How many orders per minute for tenant Nike?"
 *   - "What's the payment success rate by gateway?"
 *   - "How long does order processing take on average?"
 *
 * All metrics are automatically tagged with tenantId for multi-tenant filtering.
 */
@Service
@RequiredArgsConstructor
public class BusinessMetricsService {

    private final MeterRegistry meterRegistry;

    private static final String TAG_TENANT = "tenant";
    private static final String TAG_STATUS = "status";
    private static final String TAG_CHANNEL = "channel";

    /**
     * Increments the order counter for the current tenant.
     *
     * @param channel The sales channel (pos, online, mobile)
     * @param status  The order status (created, completed, cancelled)
     */
    public void recordOrder(String channel, String status) {
        Counter.builder("nexus.orders.total")
            .tag(TAG_TENANT, currentTenant())
            .tag(TAG_CHANNEL, channel)
            .tag(TAG_STATUS, status)
            .description("Total number of orders by channel and status")
            .register(meterRegistry)
            .increment();
    }

    /**
     * Records a payment attempt and its outcome.
     *
     * @param gateway Payment gateway (vnpay, momo, zalopay, stripe)
     * @param success Whether the payment succeeded
     */
    public void recordPayment(String gateway, boolean success) {
        Counter.builder("nexus.payments.total")
            .tag(TAG_TENANT, currentTenant())
            .tag("gateway", gateway)
            .tag(TAG_STATUS, success ? "success" : "failure")
            .description("Total payment attempts by gateway and result")
            .register(meterRegistry)
            .increment();
    }

    /**
     * Records the time taken to process an order (from creation to confirmed).
     *
     * @param durationMs Processing time in milliseconds
     */
    public void recordOrderProcessingTime(long durationMs) {
        Timer.builder("nexus.order.processing.time")
            .tag(TAG_TENANT, currentTenant())
            .description("Order processing duration in milliseconds")
            .register(meterRegistry)
            .record(durationMs, TimeUnit.MILLISECONDS);
    }

    /**
     * Records a cache hit or miss event for monitoring cache effectiveness.
     */
    public void recordCacheEvent(String cacheName, boolean hit) {
        Counter.builder("nexus.cache.events")
            .tag(TAG_TENANT, currentTenant())
            .tag("cache", cacheName)
            .tag("result", hit ? "hit" : "miss")
            .register(meterRegistry)
            .increment();
    }

    private String currentTenant() {
        String tenant = TenantContextHolder.getTenantId();
        return tenant != null ? tenant : "global";
    }
}
