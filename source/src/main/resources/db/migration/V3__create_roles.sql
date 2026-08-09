-- V3__create_roles.sql
CREATE TABLE roles (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(50) NOT NULL UNIQUE,
    description VARCHAR(200),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_roles (
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id     UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    granted_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    granted_by  UUID REFERENCES users(id),
    PRIMARY KEY (user_id, role_id)
);

INSERT INTO roles (name, description) VALUES
    ('USER', 'Standard authenticated user'),
    ('ADMIN', 'System administrator'),
    ('SUPPORT', 'Customer support staff'),
    ('PREMIUM', 'Premium subscription user');
