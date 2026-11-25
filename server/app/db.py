from __future__ import annotations

import secrets
import sqlite3
import threading
from collections.abc import Iterator
from contextlib import contextmanager
from typing import Any, Protocol

from mysql.connector import pooling

from app.config import Settings


class DBBackend(Protocol):
    def fetch_one(self, query: str, params: tuple[Any, ...] = ()) -> dict[str, Any] | None: ...

    def fetch_all(self, query: str, params: tuple[Any, ...] = ()) -> list[dict[str, Any]]: ...

    def execute(self, query: str, params: tuple[Any, ...] = ()) -> int: ...


class MariaDBPool:
    """Pooled MariaDB access layer using parameterized queries only."""

    def __init__(self, settings: Settings) -> None:
        self._pool = pooling.MySQLConnectionPool(
            pool_name="callsphere_pool",
            pool_size=settings.db_pool_size,
            pool_reset_session=True,
            host=settings.db_host,
            port=settings.db_port,
            database=settings.db_name,
            user=settings.db_user,
            password=settings.db_password,
            autocommit=False,
        )

    @contextmanager
    def _cursor(self, *, dictionary: bool = True) -> Iterator[Any]:
        conn = self._pool.get_connection()
        cursor = conn.cursor(dictionary=dictionary)
        try:
            yield conn, cursor
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            cursor.close()
            conn.close()

    def fetch_one(self, query: str, params: tuple[Any, ...] = ()) -> dict[str, Any] | None:
        with self._cursor() as (_, cursor):
            cursor.execute(query, params)
            row = cursor.fetchone()
            return dict(row) if row is not None else None

    def fetch_all(self, query: str, params: tuple[Any, ...] = ()) -> list[dict[str, Any]]:
        with self._cursor() as (_, cursor):
            cursor.execute(query, params)
            return [dict(r) for r in cursor.fetchall()]

    def execute(self, query: str, params: tuple[Any, ...] = ()) -> int:
        with self._cursor(dictionary=False) as (_, cursor):
            cursor.execute(query, params)
            return int(cursor.lastrowid or cursor.rowcount)


class SQLiteDevDB:
    """Persistent SQLite backend used only when DB_TYPE=sqlite is explicitly set."""

    def __init__(self, db_path: str) -> None:
        self._lock = threading.Lock()
        self._conn = sqlite3.connect(db_path, check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        self._conn.execute("PRAGMA foreign_keys = ON;")
        self._init_schema()

    def _init_schema(self) -> None:
        self._conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
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
            CREATE TABLE IF NOT EXISTS contacts (
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
            CREATE TABLE IF NOT EXISTS call_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                caller_uid TEXT NOT NULL,
                callee_uid TEXT NOT NULL,
                started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                ended_at TIMESTAMP,
                duration INTEGER NOT NULL DEFAULT 0,
                status TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS "groups" (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                group_uid TEXT NOT NULL UNIQUE,
                group_name TEXT NOT NULL,
                description TEXT NOT NULL DEFAULT '',
                created_by INTEGER NOT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
            );
            CREATE TABLE IF NOT EXISTS group_members (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                group_id INTEGER NOT NULL,
                user_uid TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'member',
                joined_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(group_id, user_uid),
                FOREIGN KEY (group_id) REFERENCES "groups"(id) ON DELETE CASCADE
            );
            CREATE TABLE IF NOT EXISTS blocked_users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                blocked_uid TEXT NOT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, blocked_uid),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
            CREATE TABLE IF NOT EXISTS user_keys (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL UNIQUE,
                uid TEXT NOT NULL UNIQUE,
                public_key_jwk TEXT NOT NULL,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
            CREATE TABLE IF NOT EXISTS attachments (
                id TEXT PRIMARY KEY,
                uploader_uid TEXT NOT NULL,
                storage_name TEXT NOT NULL,
                byte_size INTEGER NOT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS messages (
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
        cols = {row["name"] for row in self._conn.execute("PRAGMA table_info(users)").fetchall()}
        if "two_factor_enabled" not in cols:
            self._conn.execute(
                "ALTER TABLE users ADD COLUMN two_factor_enabled INTEGER NOT NULL DEFAULT 0"
            )
            self._conn.commit()

    @staticmethod
    def _adapt_sql(query: str) -> str:
        return query.replace("%s", "?").replace("`groups`", '"groups"')

    def fetch_one(self, query: str, params: tuple[Any, ...] = ()) -> dict[str, Any] | None:
        with self._lock:
            cur = self._conn.execute(self._adapt_sql(query), params)
            row = cur.fetchone()
            return dict(row) if row is not None else None

    def fetch_all(self, query: str, params: tuple[Any, ...] = ()) -> list[dict[str, Any]]:
        with self._lock:
            cur = self._conn.execute(self._adapt_sql(query), params)
            return [dict(r) for r in cur.fetchall()]

    def execute(self, query: str, params: tuple[Any, ...] = ()) -> int:
        with self._lock:
            cur = self._conn.execute(self._adapt_sql(query), params)
            self._conn.commit()
            return int(cur.lastrowid or cur.rowcount)


def generate_unique_uid(db: DBBackend, *, group: bool = False) -> str:
    """Generate a cryptographically random 10-digit user or group UID."""
    table = "`groups`" if group else "users"
    column = "group_uid" if group else "uid"

    for _ in range(20):
        if group:
            candidate = str(9_000_000_000 + secrets.randbelow(1_000_000_000))
        else:
            candidate = str(1_000_000_000 + secrets.randbelow(8_000_000_000))
        existing = db.fetch_one(
            f"SELECT id FROM {table} WHERE {column} = %s LIMIT 1",
            (candidate,),
        )
        if existing is None:
            return candidate

    raise RuntimeError("Failed to generate a unique 10-digit UID after 20 attempts")
