-- =================================================================
-- V1__init_tenant_schema.sql
-- Tenant Schema — Business tables for each individual tenant.
-- This script runs ONCE per tenant schema (e.g., tenant_nike, tenant_adidas).
-- Managed by create_new_tenant.sh via Flyway's --schemas flag.
-- =================================================================

-- =================================================================
-- USERS & AUTH (Per-tenant user accounts linked to Keycloak)
-- =================================================================
CREATE TABLE users (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    keycloak_id     UUID            UNIQUE,              -- Keycloak user sub claim
    email           VARCHAR(255)    NOT NULL UNIQUE,
    full_name       VARCHAR(255)    NOT NULL,
    phone           VARCHAR(20),
    avatar_url      TEXT,
    role            VARCHAR(50)     NOT NULL DEFAULT 'employee', -- owner | manager | employee | cashier
    is_active       BOOLEAN         NOT NULL DEFAULT true,
    version         BIGINT          NOT NULL DEFAULT 0,   -- Optimistic lock
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_keycloak ON users(keycloak_id);

-- =================================================================
-- PRODUCT CATALOG
-- =================================================================
CREATE TABLE categories (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id       UUID            REFERENCES categories(id),  -- Self-referential tree
    name            VARCHAR(255)    NOT NULL,
    slug            VARCHAR(255)    NOT NULL UNIQUE,
    sort_order      INT             NOT NULL DEFAULT 0,
    is_active       BOOLEAN         NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE TABLE products (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id     UUID            REFERENCES categories(id),
    sku             VARCHAR(100)    NOT NULL UNIQUE,
    name            VARCHAR(500)    NOT NULL,
    description     TEXT,
    base_price      NUMERIC(15,2)   NOT NULL,
    unit            VARCHAR(50),                         -- pcs, kg, litre
    barcode         VARCHAR(100)    UNIQUE,
    image_urls      TEXT[],                              -- Array of image URLs
    metadata        JSONB           NOT NULL DEFAULT '{}', -- Flexible attributes
    is_active       BOOLEAN         NOT NULL DEFAULT true,
    version         BIGINT          NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_name_trgm ON products USING GIN (name gin_trgm_ops); -- Full-text search

-- =================================================================
-- INVENTORY
-- =================================================================
CREATE TABLE warehouses (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(255)    NOT NULL,
    address         TEXT,
    is_default      BOOLEAN         NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE TABLE inventory (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id      UUID            NOT NULL REFERENCES products(id),
    warehouse_id    UUID            NOT NULL REFERENCES warehouses(id),
    quantity        INT             NOT NULL DEFAULT 0,
    reserved_qty    INT             NOT NULL DEFAULT 0,  -- Reserved by open orders
    reorder_point   INT             NOT NULL DEFAULT 0,  -- Alert threshold
    version         BIGINT          NOT NULL DEFAULT 0,   -- Optimistic lock for concurrent updates
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_inventory_product_warehouse UNIQUE (product_id, warehouse_id),
    CONSTRAINT chk_qty_non_negative CHECK (quantity >= 0)
);
CREATE INDEX idx_inventory_product ON inventory(product_id);

-- =================================================================
-- ORDERS (Partitioned by Month for Performance)
-- =================================================================
CREATE TABLE orders (
    id              UUID            NOT NULL DEFAULT gen_random_uuid(),
    order_number    VARCHAR(50)     NOT NULL UNIQUE,     -- Human-readable: ORD-20240101-001
    customer_id     UUID            REFERENCES users(id),
    cashier_id      UUID            REFERENCES users(id),
    status          VARCHAR(30)     NOT NULL DEFAULT 'pending',  -- pending|confirmed|shipped|delivered|cancelled|refunded
    channel         VARCHAR(30)     NOT NULL DEFAULT 'pos',      -- pos | online | mobile
    subtotal        NUMERIC(15,2)   NOT NULL,
    discount_amount NUMERIC(15,2)   NOT NULL DEFAULT 0,
    tax_amount      NUMERIC(15,2)   NOT NULL DEFAULT 0,
    total_amount    NUMERIC(15,2)   NOT NULL,
    currency        VARCHAR(3)      NOT NULL DEFAULT 'VND',
    notes           TEXT,
    metadata        JSONB           NOT NULL DEFAULT '{}',
    version         BIGINT          NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Create partitions for current and upcoming months
CREATE TABLE orders_2024_01 PARTITION OF orders FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
CREATE TABLE orders_2024_02 PARTITION OF orders FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');

CREATE INDEX idx_orders_status ON orders(status, created_at DESC);
CREATE INDEX idx_orders_customer ON orders(customer_id, created_at DESC);

CREATE TABLE order_items (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id        UUID            NOT NULL,
    product_id      UUID            NOT NULL REFERENCES products(id),
    product_name    VARCHAR(500)    NOT NULL,            -- Snapshot at time of order
    sku             VARCHAR(100)    NOT NULL,
    unit_price      NUMERIC(15,2)   NOT NULL,
    quantity        INT             NOT NULL,
    discount        NUMERIC(15,2)   NOT NULL DEFAULT 0,
    total_price     NUMERIC(15,2)   NOT NULL
);
CREATE INDEX idx_order_items_order ON order_items(order_id);

-- =================================================================
-- PAYMENTS
-- =================================================================
CREATE TABLE payments (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id        UUID            NOT NULL,
    method          VARCHAR(50)     NOT NULL,            -- cash | card | qr_code | bank_transfer
    gateway         VARCHAR(50),                         -- vnpay | momo | zalopay | stripe
    gateway_ref     VARCHAR(255),                        -- External transaction ID
    amount          NUMERIC(15,2)   NOT NULL,
    currency        VARCHAR(3)      NOT NULL DEFAULT 'VND',
    status          VARCHAR(30)     NOT NULL DEFAULT 'pending', -- pending|completed|failed|refunded
    metadata        JSONB           NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_payments_order ON payments(order_id);
CREATE INDEX idx_payments_gateway_ref ON payments(gateway_ref);
