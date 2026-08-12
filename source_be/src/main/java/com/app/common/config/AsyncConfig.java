package com.app.common.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.concurrent.Executor;

/**
 * AsyncConfig — Defines named thread pools for @Async task execution.
 *
 * Why named pools?
 * - Grafana/Prometheus can track thread pool saturation by name.
 * - Prevents the default single-shared thread pool from becoming a bottleneck.
 * - Allows different pools with different sizes for different workloads.
 */
@Configuration
@EnableAsync
public class AsyncConfig {

    /**
     * General-purpose async pool for lightweight background tasks
     * (e.g., sending notifications, audit log writes).
     */
    @Bean(name = "generalAsyncExecutor")
    public Executor generalAsyncExecutor() {
        var executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(5);
        executor.setMaxPoolSize(20);
        executor.setQueueCapacity(200);
        executor.setThreadNamePrefix("nexus-async-");
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.setAwaitTerminationSeconds(30);
        executor.initialize();
        return executor;
    }

    /**
     * Dedicated pool for CPU-intensive batch processing tasks
     * (e.g., report generation, data exports, bulk imports).
     */
    @Bean(name = "batchAsyncExecutor")
    public Executor batchAsyncExecutor() {
        var executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(2);
        executor.setMaxPoolSize(5);
        executor.setQueueCapacity(50);
        executor.setThreadNamePrefix("nexus-batch-");
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.setAwaitTerminationSeconds(120); // Batch tasks can take longer
        executor.initialize();
        return executor;
    }
}
