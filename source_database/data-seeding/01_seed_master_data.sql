-- =================================================================
-- 01_seed_master_roles.sql — Seed data for testing
-- Populate the master schema with sample tenants and system users.
-- Run AFTER V1__init_master_schema.sql
-- =================================================================

-- ─── System super-admin user ─────────────────────────────────────────────────
INSERT INTO system_users (email, hashed_password, role)
VALUES (
    'superadmin@nexus.com',
    -- BCrypt hash of 'Admin@123456' (cost=12)
    '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewJQvlqn7WjFivaa',
    'superadmin'
) ON CONFLICT (email) DO NOTHING;

-- ─── Sample Tenants ───────────────────────────────────────────────────────────
INSERT INTO tenants (code, name, plan, schema_name, status, config) VALUES
(
    'demo',
    'Nexus Demo Store',
    'professional',
    'tenant_demo',
    'trial',
    '{"currency": "VND", "timezone": "Asia/Ho_Chi_Minh", "language": "vi"}'
),
(
    'acme',
    'ACME Corporation',
    'enterprise',
    'tenant_acme',
    'active',
    '{"currency": "USD", "timezone": "America/New_York", "language": "en"}'
) ON CONFLICT (code) DO NOTHING;
