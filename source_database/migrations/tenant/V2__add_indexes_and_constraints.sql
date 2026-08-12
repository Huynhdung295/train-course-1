-- =================================================================
-- V2__add_indexes_and_constraints.sql
-- Additional performance indexes and data integrity constraints.
-- Run AFTER V1 in both master and tenant schemas as appropriate.
-- =================================================================

-- ─── MASTER SCHEMA INDEXES ────────────────────────────────────────────────────

-- Composite index: Look up active tenants by plan (billing dashboard)
CREATE INDEX IF NOT EXISTS idx_tenants_plan_status ON tenants(plan, status);

-- Partial index: Only active tenants (most queries filter by status=active)
CREATE INDEX IF NOT EXISTS idx_tenants_active ON tenants(code) WHERE status = 'active';

-- Fast lookup for domain-based routing (Nginx proxy)
CREATE INDEX IF NOT EXISTS idx_tenants_domain ON tenants(domain) WHERE domain IS NOT NULL;

-- Subscriptions: Expiry management (cron job checking expired subscriptions)
CREATE INDEX IF NOT EXISTS idx_subscriptions_status_expires ON subscriptions(status, expires_at)
    WHERE status = 'active';

-- ─── TENANT SCHEMA INDEXES ────────────────────────────────────────────────────

-- Orders: Most common query pattern (status filter + time sort)
CREATE INDEX IF NOT EXISTS idx_orders_created_status ON orders(created_at DESC, status);

-- Orders: Customer order history
CREATE INDEX IF NOT EXISTS idx_orders_customer_created ON orders(customer_id, created_at DESC)
    WHERE customer_id IS NOT NULL;

-- Orders: Channel + date analytics (sales report by channel)
CREATE INDEX IF NOT EXISTS idx_orders_channel_created ON orders(channel, created_at DESC);

-- Order Items: Fast join to orders
CREATE INDEX IF NOT EXISTS idx_order_items_order_product ON order_items(order_id, product_id);

-- Payments: Gateway reconciliation (match by external transaction ID)
CREATE INDEX IF NOT EXISTS idx_payments_gateway_status ON payments(gateway, status, created_at DESC)
    WHERE gateway IS NOT NULL;

-- Products: Full-text search already added in V1 (gin_trgm_ops)
-- Add BRIN index for time-series scans on large tables
CREATE INDEX IF NOT EXISTS idx_products_created_brin ON products USING BRIN (created_at);

-- Inventory: Products below reorder point (alert dashboard)
CREATE INDEX IF NOT EXISTS idx_inventory_low_stock ON inventory(product_id, warehouse_id)
    WHERE quantity <= reorder_point;

-- Users: Active users lookup
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status) WHERE status = 'ACTIVE';

-- ─── CHECK CONSTRAINTS ────────────────────────────────────────────────────────

-- Ensure total_amount is always non-negative
ALTER TABLE orders ADD CONSTRAINT chk_order_total_positive CHECK (total_amount >= 0);

-- Ensure payment amount is positive
ALTER TABLE payments ADD CONSTRAINT chk_payment_amount_positive CHECK (amount > 0);

-- Ensure order item quantity is positive
ALTER TABLE order_items ADD CONSTRAINT chk_order_item_qty_positive CHECK (quantity > 0);

-- Ensure unit price is non-negative
ALTER TABLE order_items ADD CONSTRAINT chk_order_item_price_positive CHECK (unit_price >= 0);
