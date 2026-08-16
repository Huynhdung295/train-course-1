package com.app.common.async;

import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.concurrent.Executor;

/**
 * AsyncConfig — @EnableAsync and thread pool configuration.
 * 
 * Used by @Async annotated methods for non-blocking event processing.
 * Also enables @Scheduled tasks.
 */
@Configuration
@EnableAsync
@EnableScheduling
@Slf4j
public class AsyncConfig {

    /**
     * Main async thread pool for @Async methods.
     * Using virtual threads if Java 21+.
     */
    @Bean(name = "asyncTaskExecutor")
    public Executor asyncTaskExecutor() {
        var executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(4);
        executor.setMaxPoolSize(20);
        executor.setQueueCapacity(200);
        executor.setThreadNamePrefix("async-");
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.setAwaitTerminationSeconds(30);
        executor.initialize();
        log.info("Configured asyncTaskExecutor: core=4, max=20, queue=200");
        return executor;
    }

    /**
     * Dedicated executor for event listeners (@ApplicationModuleListener).
     * Isolated from main async pool to prevent event processing from blocking app tasks.
     */
    @Bean(name = "eventExecutor")
    public Executor eventExecutor() {
        var executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(2);
        executor.setMaxPoolSize(10);
        executor.setQueueCapacity(100);
        executor.setThreadNamePrefix("event-");
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.setAwaitTerminationSeconds(30);
        executor.initialize();
        return executor;
    }

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
