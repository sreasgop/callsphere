-- CallSphere 2.0: Email OTP / 2FA user column
-- Idempotent migration for MariaDB 10.5+ / 11+

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE AFTER privacy_mode;
