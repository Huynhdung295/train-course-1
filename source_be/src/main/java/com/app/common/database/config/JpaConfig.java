package com.app.common.database.config;

import com.app.common.database.multitenancy.TenantContextHolder;
import jakarta.persistence.EntityManagerFactory;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.domain.AuditorAware;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.Optional;

/**
 * JpaConfig — Enables JPA Auditing for BaseEntity's @CreatedDate, @LastModifiedDate,
 * @CreatedBy, @LastModifiedBy fields.
 *
 * Without this, audit fields will always be NULL, which breaks the audit trail.
 */
@Configuration
@EnableJpaAuditing(auditorAwareRef = "auditorProvider")
@RequiredArgsConstructor
@Slf4j
public class JpaConfig {

    /**
     * AuditorAware — Provides the current user's identifier for @CreatedBy / @LastModifiedBy.
     *
     * Reads from Spring Security context. Falls back to "system" for background jobs
     * and "anonymous" when no authentication context is available.
     */
    @Bean
    public AuditorAware<String> auditorProvider() {
        return () -> {
            try {
                Authentication auth = SecurityContextHolder.getContext().getAuthentication();
                if (auth == null || !auth.isAuthenticated()
                        || "anonymousUser".equals(auth.getName())) {
                    return Optional.of("system");
                }
                return Optional.of(auth.getName());
            } catch (Exception e) {
                log.debug("Could not determine auditor from security context: {}", e.getMessage());
                return Optional.of("system");
            }
        };
    }
}
