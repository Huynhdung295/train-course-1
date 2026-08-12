#!/bin/bash
# =================================================================
# 01_init_roles.sh — Postgres Initialization Script
# Runs automatically when the container starts for the first time.
# Creates dedicated DB for Keycloak and sets up roles.
# =================================================================

set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    -- Create a separate database for Keycloak IAM
    CREATE DATABASE keycloak;

    -- Create a read-only role for reporting / read-replica
    CREATE ROLE nexus_readonly;
    GRANT CONNECT ON DATABASE $POSTGRES_DB TO nexus_readonly;

    -- Grant schema usage will be done per-tenant by the create_new_tenant.sh script
    RAISE NOTICE 'Database initialization complete.';
EOSQL
