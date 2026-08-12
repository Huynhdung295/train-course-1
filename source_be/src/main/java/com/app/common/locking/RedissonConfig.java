package com.app.common.locking;

import org.redisson.Redisson;
import org.redisson.api.RedissonClient;
import org.redisson.config.Config;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * RedissonConfig — Redisson distributed lock client configuration.
 * If redisson-spring-boot-starter is on classpath, this config supplements it
 * with a named bean for direct use.
 */
@Configuration
public class RedissonConfig {

    @Value("${spring.data.redis.host:localhost}")
    private String redisHost;

    @Value("${spring.data.redis.port:6379}")
    private int redisPort;

    @Value("${spring.data.redis.password:}")
    private String redisPassword;

    /**
     * Provides a RedissonClient if not already configured by redisson-spring-boot-starter.
     * In production, configure redisson via redisson.yaml or application.yml.
     */
    @Bean
    @ConditionalOnMissingBean(RedissonClient.class)
    public RedissonClient redissonClient() {
        Config config = new Config();
        String address = "redis://" + redisHost + ":" + redisPort;

        if (redisPassword != null && !redisPassword.isBlank()) {
            config.useSingleServer()
                .setAddress(address)
                .setPassword(redisPassword)
                .setConnectionPoolSize(10)
                .setConnectionMinimumIdleSize(2)
                .setConnectTimeout(3000)
                .setTimeout(3000);
        } else {
            config.useSingleServer()
                .setAddress(address)
                .setConnectionPoolSize(10)
                .setConnectionMinimumIdleSize(2)
                .setConnectTimeout(3000)
                .setTimeout(3000);
        }

        return Redisson.create(config);
    }
}
