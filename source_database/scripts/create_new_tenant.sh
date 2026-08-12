#!/bin/bash
# =================================================================
# create_new_tenant.sh — Onboard a New B2B Customer (Tenant)
# 
# Usage:
#   ./scripts/create_new_tenant.sh <tenant_code> <tenant_name> <plan>
#
# Example:
#   ./scripts/create_new_tenant.sh nike "Nike Vietnam" professional
# =================================================================

set -e

TENANT_CODE="${1:?Usage: $0 <tenant_code> <tenant_name> <plan>}"
TENANT_NAME="${2:?Please provide a tenant display name}"
PLAN="${3:-basic}"
SCHEMA_NAME="tenant_${TENANT_CODE}"

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-nexus_erp}"
DB_USER="${DB_USER:-nexus_admin}"
PGPASSWORD="${DB_PASSWORD:-nexus_secret}"
export PGPASSWORD

echo "======================================================"
echo "  🚀 Onboarding New Tenant: ${TENANT_NAME} (${TENANT_CODE})"
echo "  Schema: ${SCHEMA_NAME} | Plan: ${PLAN}"
echo "======================================================"

# STEP 1: Create the dedicated schema
echo "[1/4] Creating PostgreSQL schema '${SCHEMA_NAME}'..."
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" <<-SQL
    CREATE SCHEMA IF NOT EXISTS ${SCHEMA_NAME};
    
    -- Grant the app user access to this schema
    GRANT USAGE ON SCHEMA ${SCHEMA_NAME} TO ${DB_USER};
    GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA ${SCHEMA_NAME} TO ${DB_USER};
    ALTER DEFAULT PRIVILEGES IN SCHEMA ${SCHEMA_NAME} GRANT ALL ON TABLES TO ${DB_USER};
SQL
echo "  ✅ Schema created."

# STEP 2: Run Flyway migrations on the new schema
echo "[2/4] Running Flyway migrations on schema '${SCHEMA_NAME}'..."
docker run --rm \
    --network host \
    -v "$(pwd)/migrations/tenant:/flyway/sql" \
    flyway/flyway:latest \
    -url="jdbc:postgresql://${DB_HOST}:${DB_PORT}/${DB_NAME}?currentSchema=${SCHEMA_NAME}" \
    -user="${DB_USER}" \
    -password="${PGPASSWORD}" \
    -schemas="${SCHEMA_NAME}" \
    migrate
echo "  ✅ Migrations applied."

# STEP 3: Register tenant in the master table
echo "[3/4] Registering tenant in master 'tenants' table..."
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" <<-SQL
    INSERT INTO tenants (code, name, plan, schema_name, status)
    VALUES ('${TENANT_CODE}', '${TENANT_NAME}', '${PLAN}', '${SCHEMA_NAME}', 'active')
    ON CONFLICT (code) DO NOTHING;
SQL
echo "  ✅ Tenant registered."

# STEP 4: Register Debezium to watch the new schema
echo "[4/4] Configuring Debezium CDC connector for schema '${SCHEMA_NAME}'..."
# (Debezium auto-detects new schemas with schema.include.list pattern)
echo "  ✅ CDC connector will pick up '${SCHEMA_NAME}' automatically (wildcard filter)."

echo ""
echo "======================================================"
echo "  🎉 Tenant '${TENANT_NAME}' onboarded successfully!"
echo "  Schema: ${SCHEMA_NAME}"
echo "======================================================"
