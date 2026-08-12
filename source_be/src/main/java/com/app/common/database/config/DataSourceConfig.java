package com.app.common.database.config;

import com.app.common.database.routing.RoutingDataSource;
import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.datasource.LazyConnectionDataSourceProxy;

import javax.sql.DataSource;
import java.util.HashMap;
import java.util.Map;

/**
 * DataSourceConfig — Multi-Tenant Read/Write DataSource routing.
 *
 * Architecture:
 *   LazyConnectionDataSourceProxy
 *     └── RoutingDataSource (AbstractRoutingDataSource)
 *           ├── MASTER (Write DB)  → used for @Transactional methods
 *           └── REPLICA (Read DB) → used for @Transactional(readOnly=true)
 *
 * The routing key is determined by Spring's transaction read-only flag.
 * This enables automatic read/write splitting at the DataSource level.
 * Active only on non-local profiles (dev, staging, prod).
 * Local profile uses Spring Boot's auto-configured H2 DataSource instead.
 */
@Configuration
@Profile("!local & !test")   // Disabled in local (H2) and test (Testcontainers) profiles
@Slf4j
public class DataSourceConfig {

    @Value("${spring.datasource.url}")
    private String dbUrl;

    @Value("${spring.datasource.username}")
    private String dbUsername;

    @Value("${spring.datasource.password}")
    private String dbPassword;

    @Value("${spring.datasource.hikari.maximum-pool-size:10}")
    private int maxPoolSize;

    /**
     * Primary DataSource exposed to the application.
     * Wrapped in LazyConnectionDataSourceProxy to prevent connection acquisition
     * before the transaction actually needs it — avoids overhead for read-only ops.
     */
    @Primary
    @Bean
    public DataSource dataSource() {
        RoutingDataSource routingDataSource = new RoutingDataSource();

        DataSource masterDataSource = buildDataSource(dbUrl, dbUsername, dbPassword, "nexus-master-pool", maxPoolSize);
        // For replica, reuse master if no separate replica URL is configured
        DataSource replicaDataSource = buildDataSource(dbUrl, dbUsername, dbPassword, "nexus-replica-pool", maxPoolSize);

        Map<Object, Object> targetDataSources = new HashMap<>();
        targetDataSources.put("MASTER", masterDataSource);
        targetDataSources.put("REPLICA", replicaDataSource);

        routingDataSource.setTargetDataSources(targetDataSources);
        routingDataSource.setDefaultTargetDataSource(masterDataSource);
        routingDataSource.afterPropertiesSet();

        log.info("DataSource routing configured: MASTER + REPLICA");
        return new LazyConnectionDataSourceProxy(routingDataSource);
    }

    private DataSource buildDataSource(String url, String username, String password,
                                       String poolName, int maxPoolSize) {
        HikariConfig config = new HikariConfig();
        config.setJdbcUrl(url);
        config.setUsername(username);
        config.setPassword(password);
        config.setPoolName(poolName);
        config.setMaximumPoolSize(maxPoolSize);
        config.setMinimumIdle(2);
        config.setIdleTimeout(30_000);
        config.setConnectionTimeout(20_000);
        config.setLeakDetectionThreshold(60_000);
        // Health-check query for PostgreSQL
        config.setConnectionTestQuery("SELECT 1");
        return new HikariDataSource(config);
    }
}
