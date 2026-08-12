package com.app.common.config;

import com.app.common.tenant.TenantInterceptor;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * WebMvcConfig — Registers Spring MVC interceptors and configures global MVC settings.
 *
 * Key role: Wires the TenantInterceptor into the request pipeline so every
 * incoming HTTP request extracts and binds the X-Tenant-ID header before
 * reaching any controller method.
 */
@Configuration
@RequiredArgsConstructor
public class WebMvcConfig implements WebMvcConfigurer {

    private final TenantInterceptor tenantInterceptor;

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(tenantInterceptor)
            .addPathPatterns("/api/**")                  // Apply to all API routes
            .excludePathPatterns(
                "/api/v1/auth/**",                       // Auth endpoints don't need a tenant yet
                "/api/v1/public/**",
                "/actuator/**",
                "/swagger-ui/**",
                "/v3/api-docs/**"
            );
    }
}
