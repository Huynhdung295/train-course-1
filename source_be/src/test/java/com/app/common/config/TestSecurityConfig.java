package com.app.common.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.provisioning.InMemoryUserDetailsManager;
import org.springframework.security.core.userdetails.User;

/**
 * TestSecurityConfig — Overrides security for integration tests.
 *
 * Provides in-memory user accounts so tests don't need a real Keycloak or DB.
 * Only active when profile=test.
 *
 * Test users:
 *   user@test.com / test123  → ROLE_USER
 *   admin@test.com / test123 → ROLE_ADMIN, ROLE_USER
 */
@Configuration
@Profile("test")
public class TestSecurityConfig {

    @Bean
    public UserDetailsService testUserDetailsService() {
        UserDetails normalUser = User.withDefaultPasswordEncoder()
            .username("user@test.com")
            .password("test123")
            .roles("USER")
            .build();

        UserDetails adminUser = User.withDefaultPasswordEncoder()
            .username("admin@test.com")
            .password("test123")
            .roles("ADMIN", "USER")
            .build();

        return new InMemoryUserDetailsManager(normalUser, adminUser);
    }
}
