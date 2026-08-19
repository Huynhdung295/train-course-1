-- V14__create_order_views.sql

CREATE TABLE order_views (
    id              UUID PRIMARY KEY,
    customer_id     UUID NOT NULL,
    customer_name   VARCHAR(255),
    customer_email  VARCHAR(255),
    status          VARCHAR(50) NOT NULL,
    total_amount    DECIMAL(19, 4),
    placed_at       TIMESTAMPTZ,
    last_updated_at TIMESTAMPTZ
);
