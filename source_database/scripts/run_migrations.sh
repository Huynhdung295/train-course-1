#!/bin/bash
# =================================================================
# run_migrations.sh — Run Flyway migrations for all active tenants
#
# Use this when a new SQL migration file is added to migrations/tenant/
# and you need to apply it to ALL existing tenant schemas at once.
#
# Usage:
#   ./scripts/run_migrations.sh           # Apply pending migrations to all tenants
#   ./scripts/run_migrations.sh --dry-run # Show what would be applied (no changes)
# =================================================================

set -e

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-nexus_erp}"
DB_USER="${DB_USER:-nexus_admin}"
PGPASSWORD="${DB_PASSWORD:-nexus_secret}"
export PGPASSWORD

DRY_RUN=false
if [ "$1" = "--dry-run" ]; then
    DRY_RUN=true
    echo "⚠️  DRY RUN MODE — No changes will be applied"
fi

# Apply Master migrations first
echo "=================================================="
echo "  📦 Applying Master Schema Migrations..."
echo "=================================================="
docker run --rm \
    --network host \
    -v "$(pwd)/migrations/master:/flyway/sql" \
    flyway/flyway:latest \
    -url="jdbc:postgresql://${DB_HOST}:${DB_PORT}/${DB_NAME}" \
    -user="${DB_USER}" \
    -password="${PGPASSWORD}" \
    -schemas="public" \
    $([ "$DRY_RUN" = true ] && echo "info" || echo "migrate")
echo "  ✅ Master migrations complete."

# Get all active tenant schemas
TENANTS=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c \
    "SELECT schema_name FROM tenants WHERE status IN ('active', 'trial') ORDER BY created_at;")

TOTAL=$(echo "$TENANTS" | grep -c '[a-z]' || true)
echo ""
echo "=================================================="
echo "  🏢 Applying Tenant Migrations ($TOTAL tenants)..."
echo "=================================================="

SUCCESS=0
FAILED=0

for SCHEMA in $TENANTS; do
    SCHEMA=$(echo "$SCHEMA" | tr -d ' ')
    [ -z "$SCHEMA" ] && continue

    echo -n "  Migrating $SCHEMA ... "
    
    if docker run --rm \
        --network host \
        -v "$(pwd)/migrations/tenant:/flyway/sql" \
        flyway/flyway:latest \
        -url="jdbc:postgresql://${DB_HOST}:${DB_PORT}/${DB_NAME}?currentSchema=${SCHEMA}" \
        -user="${DB_USER}" \
        -password="${PGPASSWORD}" \
        -schemas="${SCHEMA}" \
        $([ "$DRY_RUN" = true ] && echo "info" || echo "migrate") 2>&1; then
        echo "✅"
        SUCCESS=$((SUCCESS + 1))
    else
        echo "❌ FAILED"
        FAILED=$((FAILED + 1))
    fi
done

echo ""
echo "=================================================="
echo "  📊 Migration Summary:"
echo "  ✅ Success: $SUCCESS"
echo "  ❌ Failed:  $FAILED"
echo "=================================================="

if [ "$FAILED" -gt 0 ]; then
    echo "WARNING: Some migrations failed. Check logs above."
    exit 1
fi
