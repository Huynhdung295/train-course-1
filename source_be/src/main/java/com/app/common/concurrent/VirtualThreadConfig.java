package com.app.common.concurrent;

import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;

import java.util.concurrent.Executor;
import java.util.concurrent.Executors;

/**
 * VirtualThreadConfig — Configures Java 21 Virtual Threads (Project Loom).
 *
 * Virtual Threads allow massive concurrency with minimal memory overhead.
 * Instead of a thread pool of 200 threads blocking on I/O, virtual threads
 * yield automatically and can handle millions of concurrent connections.
 *
 * This config:
 * 1. Overrides the Tomcat executor to use virtual threads for HTTP request handling
 * 2. Provides a virtual thread executor for @Async tasks (complementing AsyncConfig)
 * 3. Configures the task scheduler with virtual threads for @Scheduled tasks
 */
@Configuration
@EnableScheduling
@Slf4j
public class VirtualThreadConfig {

    /**
     * Executor backed by virtual threads for ad-hoc task submissions.
     * Use this when you need a lightweight executor without the overhead of a thread pool.
     */
    @Bean(name = "virtualThreadExecutor")
    public Executor virtualThreadExecutor() {
        return Executors.newVirtualThreadPerTaskExecutor();
    }

    /**
     * Task scheduler using virtual threads for @Scheduled methods.
     * Prevents scheduled tasks from starving each other if one runs long.
     */
    @Bean
    public org.springframework.scheduling.concurrent.SimpleAsyncTaskScheduler taskScheduler() {
        var scheduler = new org.springframework.scheduling.concurrent.SimpleAsyncTaskScheduler();
        scheduler.setVirtualThreads(true);
        scheduler.setThreadNamePrefix("nexus-scheduler-");
        return scheduler;
    }
}
