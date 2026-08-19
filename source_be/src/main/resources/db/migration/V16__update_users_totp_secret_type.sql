-- V16__update_users_totp_secret_type.sql
ALTER TABLE users ALTER COLUMN totp_secret TYPE VARCHAR(255) USING encode(totp_secret, 'escape');
