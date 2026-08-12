package com.app.common.concurrent;

import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.StructuredTaskScope;

/**
 * VirtualThreadExecutorConfig — Java 21 Virtual Threads (Project Loom) configuration.
 * 
 * Virtual threads are lightweight threads managed by the JVM, not OS threads.
 * They excel at IO-bound work (DB queries, HTTP calls) allowing massive concurrency.
 * 
 * Spring Boot 3.2+ automatically uses virtual threads when spring.threads.virtual.enabled=true.
 */
@Configuration
@Slf4j
@SuppressWarnings("all")
public class VirtualThreadExecutorConfig {

    /**
     * ExecutorService backed by virtual threads — for manual task submission.
     * Use for CPU-light, IO-heavy tasks (DB queries, external API calls, etc.)
     */
    @SuppressWarnings("all")
    @Bean(name = "virtualThreadExecutor", destroyMethod = "shutdown")
    public ExecutorService virtualThreadExecutor() {
        log.info("Configuring virtual thread executor (Java 21 Project Loom)");
        return Executors.newVirtualThreadPerTaskExecutor();
    }

    /**
     * Example: Structured Concurrency — run multiple IO tasks in parallel,
     * collect all results, cancel remaining if one fails.
     * 
     * This demonstrates the ShutdownOnFailure scope from Java 21.
     */
    public record ParallelResult<T1, T2>(T1 result1, T2 result2) {}

    /**
     * Execute two tasks in parallel using Structured Concurrency.
     * If either fails, the other is cancelled automatically.
     */
    public static <T1, T2> ParallelResult<T1, T2> runParallel(
            java.util.concurrent.Callable<T1> task1,
            java.util.concurrent.Callable<T2> task2) throws Exception {

        try (var scope = new StructuredTaskScope.ShutdownOnFailure()) {
            var fork1 = scope.fork(task1);
            var fork2 = scope.fork(task2);

            scope.join();           // Wait for both
            scope.throwIfFailed();  // Propagate any failure

            return new ParallelResult<>(fork1.get(), fork2.get());
        }
    }
}
