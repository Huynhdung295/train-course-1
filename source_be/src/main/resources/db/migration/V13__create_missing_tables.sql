-- V13__create_missing_tables.sql

-- passkey_credentials table
CREATE TABLE passkey_credentials (
    credential_id         VARCHAR(255) PRIMARY KEY,
    user_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    credential_id_bytes   BYTEA NOT NULL,
    public_key_cose_bytes BYTEA NOT NULL,
    signature_count       BIGINT NOT NULL DEFAULT 0,
    aaguid                VARCHAR(255),
    user_verified         BOOLEAN NOT NULL DEFAULT FALSE,
    device_display_name   VARCHAR(255),
    created_at            TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- order_sagas table
CREATE TABLE order_sagas (
    saga_id               UUID PRIMARY KEY,
    order_id              UUID NOT NULL,
    state                 VARCHAR(50) NOT NULL,
    failure_reason        TEXT,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER order_sagas_updated_at
    BEFORE UPDATE ON order_sagas
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
