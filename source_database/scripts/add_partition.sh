#!/bin/bash
# =================================================================
# add_partition.sh — Automatically create the next month's partition
# for tables partitioned by RANGE (created_at).
#
# Run this script via Cron on the 25th of each month:
#   25 0 25 * * /opt/nexus/source_database/scripts/add_partition.sh
#
# Usage:
#   ./scripts/add_partition.sh [YEAR] [MONTH]
#   ./scripts/add_partition.sh          # Defaults to next month
#   ./scripts/add_partition.sh 2025 01  # Creates partition for Jan 2025
# =================================================================

set -e

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-nexus_erp}"
DB_USER="${DB_USER:-nexus_admin}"
PGPASSWORD="${DB_PASSWORD:-nexus_secret}"
export PGPASSWORD

# Default: next month
TARGET_YEAR="${1:-$(date -d '+1 month' '+%Y')}"
TARGET_MONTH="${2:-$(date -d '+1 month' '+%m')}"

# Calculate start and end dates for the partition
PARTITION_START="${TARGET_YEAR}-${TARGET_MONTH}-01"
NEXT_MONTH=$(date -d "${PARTITION_START} +1 month" '+%Y-%m-01')
PARTITION_SUFFIX="${TARGET_YEAR}_$(printf '%02d' ${TARGET_MONTH#0})"

echo "=================================================="
echo "  📅 Creating Partitions for: ${TARGET_YEAR}-${TARGET_MONTH}"
echo "  Range: ${PARTITION_START} to ${NEXT_MONTH}"
echo "=================================================="

# Get all tenant schemas
SCHEMAS=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c \
    "SELECT schema_name FROM tenants WHERE status = 'active';")

if [ -z "$SCHEMAS" ]; then
    echo "No active tenant schemas found. Creating only audit_log partition..."
fi

# Create audit_log partition in master schema (public)
echo "[1/2] Creating master audit_log partition..."
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" <<-SQL
DO \$\$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_tables
        WHERE schemaname = 'public'
        AND tablename = 'audit_log_${PARTITION_SUFFIX}'
    ) THEN
        EXECUTE 'CREATE TABLE public.audit_log_${PARTITION_SUFFIX}
            PARTITION OF public.audit_log
            FOR VALUES FROM (''${PARTITION_START}'') TO (''${NEXT_MONTH}'')';
        RAISE NOTICE 'Created partition: audit_log_${PARTITION_SUFFIX}';
    ELSE
        RAISE NOTICE 'Partition already exists: audit_log_${PARTITION_SUFFIX}';
    END IF;
END
\$\$;
SQL
echo "  ✅ audit_log partition done."

# Create orders partition for each active tenant
echo "[2/2] Creating tenant orders partitions..."
for SCHEMA in $SCHEMAS; do
    SCHEMA=$(echo "$SCHEMA" | tr -d ' ')
    [ -z "$SCHEMA" ] && continue
    
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" <<-SQL
DO \$\$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_tables
        WHERE schemaname = '${SCHEMA}'
        AND tablename = 'orders_${PARTITION_SUFFIX}'
    ) THEN
        EXECUTE 'CREATE TABLE ${SCHEMA}.orders_${PARTITION_SUFFIX}
            PARTITION OF ${SCHEMA}.orders
            FOR VALUES FROM (''${PARTITION_START}'') TO (''${NEXT_MONTH}'')';
        RAISE NOTICE 'Created partition: ${SCHEMA}.orders_${PARTITION_SUFFIX}';
    ELSE
        RAISE NOTICE 'Partition already exists: ${SCHEMA}.orders_${PARTITION_SUFFIX}';
    END IF;
END
\$\$;
SQL
    echo "  ✅ ${SCHEMA}.orders_${PARTITION_SUFFIX}"
done

echo ""
echo "=================================================="
echo "  🎉 All partitions created for ${TARGET_YEAR}-${TARGET_MONTH}!"
echo "=================================================="
