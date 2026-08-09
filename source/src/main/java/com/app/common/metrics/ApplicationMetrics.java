package com.app.common.metrics;

import io.micrometer.core.annotation.Counted;
import io.micrometer.core.annotation.Timed;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.concurrent.TimeUnit;

/**
 * ApplicationMetrics — Custom business metrics using Micrometer.
 *
 * These metrics are automatically exported to Prometheus via
 * spring-boot-actuator + micrometer-registry-prometheus.
 *
 * Access at: GET /actuator/prometheus
 */
@Component
@Slf4j
public class ApplicationMetrics {

    private final Counter orderPlacedCounter;
    private final Counter orderFailedCounter;
    private final Counter paymentSuccessCounter;
    private final Counter paymentFailedCounter;
    private final Timer orderProcessingTimer;
    private final MeterRegistry meterRegistry;

    public ApplicationMetrics(MeterRegistry meterRegistry) {
        this.meterRegistry = meterRegistry;

        this.orderPlacedCounter = Counter.builder("orders.placed.total")
            .description("Total number of orders placed successfully")
            .tag("type", "business")
            .register(meterRegistry);

        this.orderFailedCounter = Counter.builder("orders.failed.total")
            .description("Total number of orders that failed")
            .tag("type", "business")
            .register(meterRegistry);

        this.paymentSuccessCounter = Counter.builder("payments.success.total")
            .description("Total successful payments")
            .register(meterRegistry);

        this.paymentFailedCounter = Counter.builder("payments.failed.total")
            .description("Total failed payments")
            .register(meterRegistry);

        this.orderProcessingTimer = Timer.builder("orders.processing.duration")
            .description("Time spent processing an order")
            .publishPercentiles(0.5, 0.95, 0.99)    // p50, p95, p99
            .publishPercentileHistogram()
            .register(meterRegistry);
    }

    public void recordOrderPlaced() {
        orderPlacedCounter.increment();
        log.debug("Metric: orders.placed.total incremented");
    }

    public void recordOrderFailed(String reason) {
        orderFailedCounter.increment();
        meterRegistry.counter("orders.failed.total", "reason", reason).increment();
    }

    public void recordPaymentSuccess() { paymentSuccessCounter.increment(); }

    public void recordPaymentFailed(String errorCode) {
        paymentFailedCounter.increment();
        meterRegistry.counter("payments.failed.total", "error_code", errorCode).increment();
    }

    /** Record order processing duration in milliseconds */
    public void recordOrderProcessingTime(long durationMs) {
        orderProcessingTimer.record(durationMs, TimeUnit.MILLISECONDS);
    }

    // ─── @Counted and @Timed annotations (alternative to manual registration) ─

    /**
     * @Counted: automatically increments a counter each time method is called.
     * Requires micrometer-core + EnableAspectJAutoProxy.
     */
    @Counted(value = "api.requests.total", extraTags = {"endpoint", "create-order"})
    @Timed(value = "api.requests.duration", percentiles = {0.5, 0.95, 0.99})
    public void trackApiRequest() {
        // This is a demo method — the annotations track any annotated method
    }
}
