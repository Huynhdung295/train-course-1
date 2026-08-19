-- V12__add_audit_columns_and_products.sql

-- users missing: version, created_by, updated_by, deleted_by
ALTER TABLE users ADD COLUMN version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN created_by VARCHAR(255);
ALTER TABLE users ADD COLUMN updated_by VARCHAR(255);
ALTER TABLE users ADD COLUMN deleted_by VARCHAR(255);

-- orders missing: created_by, updated_by, deleted_by
ALTER TABLE orders ADD COLUMN created_by VARCHAR(255);
ALTER TABLE orders ADD COLUMN updated_by VARCHAR(255);
ALTER TABLE orders ADD COLUMN deleted_by VARCHAR(255);

-- order_lines missing: updated_at, created_by, updated_by, version
ALTER TABLE order_lines ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE order_lines ADD COLUMN created_by VARCHAR(255);
ALTER TABLE order_lines ADD COLUMN updated_by VARCHAR(255);
ALTER TABLE order_lines ADD COLUMN version INTEGER NOT NULL DEFAULT 0;

CREATE TRIGGER order_lines_updated_at
    BEFORE UPDATE ON order_lines
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- products table
CREATE TABLE products (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(255) NOT NULL,
    sku             VARCHAR(255) NOT NULL UNIQUE,
    price           DECIMAL(19, 4) NOT NULL CHECK (price >= 0),
    stock_quantity  INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by      VARCHAR(255),
    updated_by      VARCHAR(255),
    version         BIGINT NOT NULL DEFAULT 0,
    is_deleted      BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TRIGGER products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
