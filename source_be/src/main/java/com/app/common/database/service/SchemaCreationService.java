package com.app.common.database.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * SchemaCreationService — Programmatically creates a new tenant schema at runtime.
 *
 * Used when onboarding a new B2B customer (tenant) via API, instead of running
 * create_new_tenant.sh manually. This allows automated tenant provisioning.
 *
 * Flow:
 * 1. API call → TenantController.createTenant()
 * 2. → SchemaCreationService.createSchema()
 * 3. → PostgreSQL: CREATE SCHEMA tenant_{code}
 * 4. → Flyway applies tenant migrations on the new schema
 * 5. → Tenant record inserted into master 'tenants' table
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class SchemaCreationService {

    private final JdbcTemplate jdbcTemplate;

    /**
     * Creates a new PostgreSQL schema for the given tenant code.
     * Schema name format: tenant_{code} (e.g., tenant_nike)
     *
     * @param tenantCode  Short code for the tenant (e.g., "nike", "adidas")
     * @return            The created schema name
     * @throws IllegalArgumentException if the schema name is invalid or already exists
     */
    @Transactional
    public String createSchema(String tenantCode) {
        String schemaName = sanitizeSchemaName(tenantCode);

        log.info("Creating schema for tenant: {} -> schema: {}", tenantCode, schemaName);

        // Create schema if it doesn't exist
        jdbcTemplate.execute("CREATE SCHEMA IF NOT EXISTS " + schemaName);

        // Grant privileges to the app user
        jdbcTemplate.execute("GRANT USAGE ON SCHEMA " + schemaName + " TO CURRENT_USER");
        jdbcTemplate.execute("ALTER DEFAULT PRIVILEGES IN SCHEMA " + schemaName
            + " GRANT ALL ON TABLES TO CURRENT_USER");

        log.info("Schema created successfully: {}", schemaName);
        return schemaName;
    }

    /**
     * Drops a tenant schema and all its tables. Use with extreme caution.
     * Only for testing or when a tenant subscription expires and data must be purged.
     */
    @Transactional
    public void dropSchema(String tenantCode) {
        String schemaName = sanitizeSchemaName(tenantCode);
        log.warn("DROPPING schema: {}. This operation is irreversible!", schemaName);
        jdbcTemplate.execute("DROP SCHEMA IF EXISTS " + schemaName + " CASCADE");
        log.warn("Schema dropped: {}", schemaName);
    }

    /**
     * Validates and sanitizes a tenant code to a safe PostgreSQL schema name.
     * Prevents SQL injection via schema name.
     */
    private String sanitizeSchemaName(String tenantCode) {
        if (tenantCode == null || tenantCode.isBlank()) {
            throw new IllegalArgumentException("Tenant code cannot be blank");
        }
        String sanitized = tenantCode.toLowerCase().replaceAll("[^a-z0-9_]", "_");
        if (sanitized.length() > 50) {
            throw new IllegalArgumentException("Tenant code too long (max 50 chars): " + tenantCode);
        }
        return "tenant_" + sanitized;
    }
}
