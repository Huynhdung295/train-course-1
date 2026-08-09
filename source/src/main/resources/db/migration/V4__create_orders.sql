-- V4__create_orders.sql
CREATE TABLE orders (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id),
    tenant_id       VARCHAR(100),
    status          VARCHAR(30) NOT NULL DEFAULT 'PENDING'
                    CHECK (status IN ('PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 
                                      'DELIVERED', 'CANCELLED', 'REFUNDED')),
    total_amount    DECIMAL(19, 4) NOT NULL CHECK (total_amount >= 0),
    currency        VARCHAR(3) NOT NULL DEFAULT 'USD',
    shipping_street VARCHAR(255),
    shipping_city   VARCHAR(100),
    shipping_state  VARCHAR(100),
    shipping_postal VARCHAR(20),
    shipping_country VARCHAR(2),
    notes           TEXT,
    version         INTEGER NOT NULL DEFAULT 0,   -- optimistic locking
    placed_at       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    confirmed_at    TIMESTAMPTZ,
    shipped_at      TIMESTAMPTZ,
    delivered_at    TIMESTAMPTZ,
    cancelled_at    TIMESTAMPTZ,
    cancellation_reason TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at      TIMESTAMPTZ
);

CREATE TABLE order_lines (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id        UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id      UUID NOT NULL,
    product_name    VARCHAR(255) NOT NULL,  -- denormalized for order history
    quantity        INTEGER NOT NULL CHECK (quantity > 0),
    unit_price      DECIMAL(19, 4) NOT NULL CHECK (unit_price >= 0),
    line_total      DECIMAL(19, 4) GENERATED ALWAYS AS (quantity * unit_price) STORED,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER orders_updated_at
    BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX idx_orders_user_id ON orders(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_orders_status ON orders(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_orders_tenant_id ON orders(tenant_id);
CREATE INDEX idx_orders_placed_at ON orders(placed_at DESC);
CREATE INDEX idx_order_lines_order_id ON order_lines(order_id);
