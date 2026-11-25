from __future__ import annotations

import sqlite3
from typing import Any

import pytest
from flask import Flask
from flask.testing import FlaskClient

from app import create_app, socketio
from app.config import Settings


class SQLiteTestDB:
    """In-memory SQLite backend implementing DBBackend for fast isolated tests."""

    def __init__(self) -> None:
        self._conn = sqlite3.connect(":memory:", check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        self._conn.execute("PRAGMA foreign_keys = ON;")
        self._init_schema()

    def _init_schema(self) -> None:
        self._conn.executescript(
            """
            CREATE TABLE users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                full_name TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                uid TEXT NOT NULL UNIQUE,
                avatar_color TEXT NOT NULL DEFAULT '#6366F1',
                status_message TEXT NOT NULL DEFAULT 'Available',
                privacy_mode TEXT NOT NULL DEFAULT 'everyone',
                two_factor_enabled INTEGER NOT NULL DEFAULT 0,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE contacts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                contact_uid TEXT NOT NULL,
                contact_name TEXT NOT NULL,
                notes TEXT,
                is_favorite INTEGER NOT NULL DEFAULT 0,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, contact_uid),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
            CREATE TABLE call_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                caller_uid TEXT NOT NULL,
                callee_uid TEXT NOT NULL,
                started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                ended_at TIMESTAMP,
                duration INTEGER NOT NULL DEFAULT 0,
                status TEXT NOT NULL
            );
            CREATE TABLE "groups" (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                group_uid TEXT NOT NULL UNIQUE,
                group_name TEXT NOT NULL,
                description TEXT NOT NULL DEFAULT '',
                created_by INTEGER NOT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
            );
            CREATE TABLE group_members (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                group_id INTEGER NOT NULL,
                user_uid TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'member',
                joined_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(group_id, user_uid),
                FOREIGN KEY (group_id) REFERENCES "groups"(id) ON DELETE CASCADE
            );
            CREATE TABLE blocked_users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                blocked_uid TEXT NOT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, blocked_uid),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
            CREATE TABLE user_keys (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL UNIQUE,
                uid TEXT NOT NULL UNIQUE,
                public_key_jwk TEXT NOT NULL,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
            CREATE TABLE attachments (
                id TEXT PRIMARY KEY,
                uploader_uid TEXT NOT NULL,
                storage_name TEXT NOT NULL,
                byte_size INTEGER NOT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                conversation_id TEXT NOT NULL,
                sender_uid TEXT NOT NULL,
                recipient_uid TEXT NOT NULL,
                ciphertext TEXT NOT NULL,
                iv TEXT NOT NULL,
                attachment_id TEXT,
                attachment_meta_ct TEXT,
                attachment_meta_iv TEXT,
                is_read INTEGER NOT NULL DEFAULT 0,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            """
        )

    @staticmethod
    def _adapt_sql(query: str) -> str:
        return query.replace("%s", "?").replace("`groups`", '"groups"')

    def fetch_one(self, query: str, params: tuple[Any, ...] = ()) -> dict[str, Any] | None:
        cur = self._conn.execute(self._adapt_sql(query), params)
        row = cur.fetchone()
        return dict(row) if row is not None else None

    def fetch_all(self, query: str, params: tuple[Any, ...] = ()) -> list[dict[str, Any]]:
        cur = self._conn.execute(self._adapt_sql(query), params)
        return [dict(r) for r in cur.fetchall()]

    def execute(self, query: str, params: tuple[Any, ...] = ()) -> int:
        cur = self._conn.execute(self._adapt_sql(query), params)
        self._conn.commit()
        return int(cur.lastrowid or cur.rowcount)


@pytest.fixture()
def test_settings(tmp_path) -> Settings:
    return Settings(
        app_env="test",
        secret_key="test-secret-key-at-least-32-bytes-long",
        jwt_secret_key="test-jwt-secret-key-at-least-32-bytes-long",
        jwt_access_ttl_minutes=15,
        jwt_refresh_ttl_days=14,
        cors_allowed_origins=("http://localhost:5173",),
        db_type="sqlite",
        db_host="127.0.0.1",
        db_port=3306,
        db_name="callsphere_test",
        db_user="callsphere_app",
        db_password="",
        db_pool_size=2,
        sqlite_path=":memory:",
        redis_url="redis://127.0.0.1:6379/0",
        use_inmemory_store=True,
        smtp_host="smtp.example.com",
        smtp_port=587,
        smtp_user="",
        smtp_pass="",
        storage_root=str(tmp_path / "storage"),
        max_upload_mb=1,
        stun_url="stun:stun.l.google.com:19302",
        turn_url="turns:relay.example.com:443",
        turn_username="turnuser",
        turn_credential="turnpass",
    )


@pytest.fixture()
def db() -> SQLiteTestDB:
    return SQLiteTestDB()


@pytest.fixture()
def app(test_settings: Settings, db: SQLiteTestDB) -> Flask:
    return create_app(settings=test_settings, db_backend=db)


@pytest.fixture()
def client(app: Flask) -> FlaskClient:
    return app.test_client()


def register_and_login(
    client: FlaskClient,
    *,
    full_name: str,
    email: str,
    password: str = "StrongPass123!",
) -> dict[str, Any]:
    reg = client.post(
        "/api/v1/auth/register",
        json={"full_name": full_name, "email": email, "password": password},
    )
    assert reg.status_code == 201
    login = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    assert login.status_code == 200
    return login.get_json()["user"]


@pytest.fixture()
def sio_client(app: Flask):
    return lambda headers=None: socketio.test_client(app, headers=headers or {})
