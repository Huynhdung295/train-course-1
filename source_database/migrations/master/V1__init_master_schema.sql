-- =================================================================
-- V1__init_master_schema.sql
-- Master Schema (public) — System-level tables shared across all tenants.
-- Managed by Flyway. Run ONCE when the system is first deployed.
-- =================================================================

-- Bật extension UUID
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- Trigram index for full-text search

-- =================================================================
-- BẢNG TENANTS (Danh sách khách hàng doanh nghiệp)
-- =================================================================
CREATE TABLE tenants (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    code            VARCHAR(50)     NOT NULL UNIQUE,         -- Tên schema: 'nike', 'adidas'
    name            VARCHAR(255)    NOT NULL,                -- Tên hiển thị: 'Nike Vietnam'
    plan            VARCHAR(50)     NOT NULL DEFAULT 'basic', -- Gói dịch vụ: basic, professional, enterprise
    status          VARCHAR(20)     NOT NULL DEFAULT 'active', -- active | suspended | trial
    schema_name     VARCHAR(63)     NOT NULL UNIQUE,         -- Tên schema PostgreSQL thực tế
    domain          VARCHAR(255),                            -- Custom domain (optional): pos.nike.vn
    config          JSONB           NOT NULL DEFAULT '{}',   -- Cấu hình linh hoạt
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    expires_at      TIMESTAMPTZ,                             -- Ngày hết hạn subscription
    CONSTRAINT chk_tenant_status CHECK (status IN ('active', 'suspended', 'trial', 'deleted'))
);
CREATE INDEX idx_tenants_code ON tenants(code);
CREATE INDEX idx_tenants_status ON tenants(status);

COMMENT ON TABLE tenants IS 'Master list of all B2B customers (tenants) using the Nexus platform.';
COMMENT ON COLUMN tenants.schema_name IS 'PostgreSQL schema name, e.g., tenant_nike. Created automatically by create_new_tenant.sh.';

-- =================================================================
-- BẢNG SYSTEM_USERS (Super-admin accounts — cross-tenant)
-- =================================================================
CREATE TABLE system_users (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(255)    NOT NULL UNIQUE,
    hashed_password VARCHAR(255)    NOT NULL,
    role            VARCHAR(50)     NOT NULL DEFAULT 'support', -- superadmin | support | finance
    is_active       BOOLEAN         NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    last_login_at   TIMESTAMPTZ
);

-- =================================================================
-- BẢNG SUBSCRIPTIONS (Lịch sử thanh toán)
-- =================================================================
CREATE TABLE subscriptions (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID            NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    plan            VARCHAR(50)     NOT NULL,
    amount          NUMERIC(15,2)   NOT NULL,
    currency        VARCHAR(3)      NOT NULL DEFAULT 'VND',
    billing_cycle   VARCHAR(20)     NOT NULL DEFAULT 'monthly', -- monthly | yearly
    started_at      TIMESTAMPTZ     NOT NULL,
    expires_at      TIMESTAMPTZ     NOT NULL,
    status          VARCHAR(20)     NOT NULL DEFAULT 'active',  -- active | cancelled | expired
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_subscriptions_tenant ON subscriptions(tenant_id);
CREATE INDEX idx_subscriptions_expires ON subscriptions(expires_at);

-- =================================================================
-- BẢNG AUDIT_LOG (Master system audit trail)
-- =================================================================
CREATE TABLE audit_log (
    id              BIGSERIAL       PRIMARY KEY,
    tenant_id       UUID,                                       -- NULL = system-level action
    actor_id        UUID,
    actor_email     VARCHAR(255),
    action          VARCHAR(255)    NOT NULL,                   -- e.g., 'tenant.created', 'user.login'
    resource_type   VARCHAR(100),
    resource_id     VARCHAR(255),
    payload         JSONB,
    ip_address      INET,
    occurred_at     TIMESTAMPTZ     NOT NULL DEFAULT NOW()
) PARTITION BY RANGE (occurred_at);

-- Auto-create partitions: Current month + next month
CREATE TABLE audit_log_2024_01 PARTITION OF audit_log
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
CREATE TABLE audit_log_2024_02 PARTITION OF audit_log
    FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');

CREATE INDEX idx_audit_tenant ON audit_log(tenant_id, occurred_at DESC);
CREATE INDEX idx_audit_actor ON audit_log(actor_id, occurred_at DESC);
