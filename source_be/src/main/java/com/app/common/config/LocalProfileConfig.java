package com.app.common.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.boot.autoconfigure.kafka.KafkaAutoConfiguration;
import org.springframework.boot.autoconfigure.data.redis.RedisAutoConfiguration;
import org.springframework.boot.autoconfigure.data.redis.RedisReactiveAutoConfiguration;

/**
 * LocalProfileConfig — Auto-configuration exclusions for the local dev profile.
 *
 * When running with profile=local (H2 in-memory), we don't want Spring Boot
 * to fail on startup because Kafka and Redis are not running locally.
 *
 * This is handled by application-local.yml spring.autoconfigure.exclude,
 * but this file provides additional documentation and safety for other beans
 * that might attempt connection in local mode.
 *
 * Profile: local only
 */
@Configuration
@Profile("local")
public class LocalProfileConfig {
    // Marker class — actual exclusions are in application-local.yml:
    // spring.autoconfigure.exclude:
    //   - org.springframework.boot.autoconfigure.kafka.KafkaAutoConfiguration
    //   - org.springframework.boot.autoconfigure.data.redis.RedisAutoConfiguration
    //   - org.springframework.boot.autoconfigure.data.redis.RedisReactiveAutoConfiguration
}
