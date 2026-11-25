-- CallSphere 2.0: E2EE Public Keys, Ciphertext Messages, and Encrypted Attachments
-- Idempotent migration for MariaDB

CREATE TABLE IF NOT EXISTS user_keys (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    uid VARCHAR(10) NOT NULL,
    public_key_jwk TEXT NOT NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_user_keys_user_id (user_id),
    UNIQUE KEY uq_user_keys_uid (uid),
    CONSTRAINT fk_user_keys_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS attachments (
    id VARCHAR(36) PRIMARY KEY,
    uploader_uid VARCHAR(10) NOT NULL,
    storage_name VARCHAR(64) NOT NULL,
    byte_size INT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_attachments_uploader (uploader_uid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS messages (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    conversation_id VARCHAR(32) NOT NULL,
    sender_uid VARCHAR(10) NOT NULL,
    recipient_uid VARCHAR(10) NOT NULL,
    ciphertext TEXT NOT NULL,
    iv VARCHAR(32) NOT NULL,
    attachment_id VARCHAR(36) NULL,
    attachment_meta_ct TEXT NULL,
    attachment_meta_iv VARCHAR(32) NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_messages_conv_id (conversation_id, id DESC),
    INDEX idx_messages_unread (recipient_uid, sender_uid, is_read)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
