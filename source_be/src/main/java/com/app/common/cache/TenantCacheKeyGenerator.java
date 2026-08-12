package com.app.common.cache;

import com.app.common.database.multitenancy.TenantContextHolder;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.interceptor.KeyGenerator;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;

import java.lang.reflect.Method;
import java.util.Arrays;
import java.util.stream.Collectors;

/**
 * TenantCacheKeyGenerator — Cache key generator that automatically prefixes
 * every cache key with the current tenant ID.
 *
 * WHY THIS MATTERS: Without tenant-aware cache keys, Tenant A could accidentally
 * read Tenant B's cached data (cache poisoning between tenants).
 *
 * Key format: {tenantId}:{className}#{methodName}:{arg1}:{arg2}:...
 * Example:    "tenant_nike:ProductService#findById:uuid-123"
 *
 * Usage in @Cacheable:
 *   @Cacheable(value = "products", keyGenerator = "tenantCacheKeyGenerator")
 *   public ProductDto findById(UUID id) { ... }
 */
@Component("tenantCacheKeyGenerator")
@Slf4j
public class TenantCacheKeyGenerator implements KeyGenerator {

    @Override
    @NonNull
    public Object generate(@NonNull Object target, @NonNull Method method, @NonNull Object... params) {
        String tenantId = TenantContextHolder.getTenantId();
        if (tenantId == null || tenantId.isBlank()) {
            tenantId = "global";
        }

        String paramString = Arrays.stream(params)
            .map(p -> p != null ? p.toString() : "null")
            .collect(Collectors.joining(":"));

        String key = String.format("%s:%s#%s:%s",
            tenantId,
            target.getClass().getSimpleName(),
            method.getName(),
            paramString);

        log.trace("Generated cache key: {}", key);
        return key;
    }
}
