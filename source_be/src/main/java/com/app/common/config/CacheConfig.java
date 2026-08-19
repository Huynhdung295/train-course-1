package com.app.common.config;

import com.github.benmanes.caffeine.cache.Caffeine;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.caffeine.CaffeineCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.data.redis.cache.RedisCacheConfiguration;
import org.springframework.data.redis.cache.RedisCacheManager;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.serializer.GenericJackson2JsonRedisSerializer;
import org.springframework.data.redis.serializer.RedisSerializationContext;
import org.springframework.data.redis.serializer.StringRedisSerializer;

import java.time.Duration;
import java.util.Map;

/**
 * CacheConfig — Multi-level cache configuration.
 *
 * L1 (Near cache): Caffeine — in-JVM, ultra-fast (~1ms), 5 minute TTL
 * L2 (Distributed): Redis  — cross-node, ~5ms, 30 minute TTL
 *
 * Usage pattern:
 *   @Cacheable(value = "products", key = "#id", cacheManager = "caffeineCacheManager")
 *   @Cacheable(value = "products", key = "#id", cacheManager = "redisCacheManager")
 */
@Configuration
@EnableCaching
@SuppressWarnings("all")
public class CacheConfig {

    // ─── L1: Caffeine (In-JVM near-cache) ─────────────────────────────────────

    @Bean
    @Primary
    public CacheManager caffeineCacheManager() {
        CaffeineCacheManager manager = new CaffeineCacheManager();
        manager.setCaffeine(
            Caffeine.newBuilder()
                .maximumSize(500)
                .expireAfterWrite(Duration.ofMinutes(5))
                .recordStats()   // Enable hit/miss metrics
        );
        // Named caches with specific configurations
        manager.setCacheNames(java.util.List.of("products", "users", "orderSummaries"));
        return manager;
    }

    // ─── L2: Redis (Distributed cross-node cache) ──────────────────────────────

    @Bean
    public CacheManager redisCacheManager(RedisConnectionFactory connectionFactory) {
        var defaultConfig = RedisCacheConfiguration.defaultCacheConfig()
            .entryTtl(Duration.ofMinutes(30))
            .serializeKeysWith(
                RedisSerializationContext.SerializationPair.fromSerializer(new StringRedisSerializer())
            )
            .serializeValuesWith(
                RedisSerializationContext.SerializationPair.fromSerializer(
                    new GenericJackson2JsonRedisSerializer()
                )
            )
            .disableCachingNullValues();

        // Per-cache TTL overrides
        var cacheConfigs = Map.of(
            "products",        defaultConfig.entryTtl(Duration.ofMinutes(30)),
            "users",           defaultConfig.entryTtl(Duration.ofMinutes(15)),
            "orderSummaries",  defaultConfig.entryTtl(Duration.ofMinutes(5))
        );

        return RedisCacheManager.builder(connectionFactory)
            .cacheDefaults(defaultConfig)
            .withInitialCacheConfigurations(cacheConfigs)
            .build();
    }

    @Bean
    public org.springframework.data.redis.core.RedisTemplate<String, Object> redisTemplate(RedisConnectionFactory connectionFactory) {
        org.springframework.data.redis.core.RedisTemplate<String, Object> template = new org.springframework.data.redis.core.RedisTemplate<>();
        template.setConnectionFactory(connectionFactory);
        
        template.setKeySerializer(new StringRedisSerializer());
        template.setValueSerializer(new GenericJackson2JsonRedisSerializer());
        
        template.setHashKeySerializer(new StringRedisSerializer());
        template.setHashValueSerializer(new GenericJackson2JsonRedisSerializer());
        
        template.afterPropertiesSet();
        return template;
    }
}
