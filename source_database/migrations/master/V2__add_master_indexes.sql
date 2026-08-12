-- =================================================================
-- V2__add_master_indexes.sql
-- Additional indexes and constraints for the MASTER schema (public).
-- Run AFTER V1__init_master_schema.sql
-- =================================================================

-- Tenants: Composite index for billing dashboard queries
CREATE INDEX IF NOT EXISTS idx_tenants_plan_status
    ON tenants(plan, status);

-- Tenants: Partial index — only active tenants (most queries filter this)
CREATE INDEX IF NOT EXISTS idx_tenants_active
    ON tenants(code) WHERE status = 'active';

-- Tenants: Domain-based routing lookup (Nginx/Gateway)
CREATE INDEX IF NOT EXISTS idx_tenants_domain
    ON tenants(domain) WHERE domain IS NOT NULL;

-- Tenants: Expiry management (find tenants expiring soon)
CREATE INDEX IF NOT EXISTS idx_tenants_expires_at
    ON tenants(expires_at) WHERE status IN ('active', 'trial');

-- Subscriptions: Active subscription expiry management
CREATE INDEX IF NOT EXISTS idx_subscriptions_status_expires
    ON subscriptions(status, expires_at) WHERE status = 'active';

-- Subscriptions: Tenant history
CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant_created
    ON subscriptions(tenant_id, started_at DESC);

-- System Users: Active admin users
CREATE INDEX IF NOT EXISTS idx_system_users_role_active
    ON system_users(role, is_active) WHERE is_active = true;

-- ─── DATA CONSTRAINTS ────────────────────────────────────────────────────────

-- Enforce plan values
ALTER TABLE tenants
    ADD CONSTRAINT chk_tenant_plan
    CHECK (plan IN ('basic', 'professional', 'enterprise', 'custom'));

-- Ensure subscription amounts are positive
ALTER TABLE subscriptions
    ADD CONSTRAINT chk_subscription_amount_positive
    CHECK (amount > 0);

-- Ensure subscription dates are logical
ALTER TABLE subscriptions
    ADD CONSTRAINT chk_subscription_dates
    CHECK (expires_at > started_at);

-- ─── UPDATED_AT TRIGGER ──────────────────────────────────────────────────────
-- Auto-update updated_at column on any UPDATE

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tenants_updated_at
    BEFORE UPDATE ON tenants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
