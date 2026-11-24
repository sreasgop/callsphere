import os
import sqlite3
import random
import hashlib
from typing import Dict, Any, List, Optional

# Configuration
DB_TYPE = os.getenv("DB_TYPE", "sqlite").lower()
DB_FILE = os.getenv("DB_FILE", os.path.join(os.path.dirname(__file__), "callsphere.db"))

MYSQL_CONFIG = {
    'host': os.getenv("DB_HOST", "127.0.0.1"),
    'user': os.getenv("DB_USER", "root"),
    'password': os.getenv("DB_PASSWORD", ""),
    'database': os.getenv("DB_NAME", "voip_app"),
    'port': int(os.getenv("DB_PORT", "3306"))
}

def get_db_connection():
    if DB_TYPE == "mysql":
        import mysql.connector
        return mysql.connector.connect(**MYSQL_CONFIG)
    else:
        conn = sqlite3.connect(DB_FILE)
        conn.row_factory = sqlite3.Row
        return conn

def init_db():
    """Initializes the database schema if using SQLite, ensuring zero setup for local dev."""
    if DB_TYPE != "sqlite":
        return

    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    # 1. Users
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        full_name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        sip_uid TEXT NOT NULL UNIQUE,
        avatar_color TEXT DEFAULT '#6c5ce7',
        status_message TEXT DEFAULT 'Available for VoIP calls',
        privacy_mode TEXT DEFAULT 'everyone',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # 2. Contacts
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS contacts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        contact_uid TEXT NOT NULL,
        contact_name TEXT NOT NULL,
        notes TEXT,
        is_favorite INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    """)

    # 3. Call Logs
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS call_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        caller_uid TEXT NOT NULL,
        callee_uid TEXT NOT NULL,
        start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        duration INTEGER DEFAULT 0,
        status TEXT NOT NULL
    );
    """)

    # 4. Groups
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS groups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_uid TEXT NOT NULL UNIQUE,
        group_name TEXT NOT NULL,
        description TEXT,
        created_by INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # 5. Group Members
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS group_members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_id INTEGER NOT NULL,
        user_uid TEXT NOT NULL,
        role TEXT DEFAULT 'member',
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE
    );
    """)

    # 6. Blocked Users
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS blocked_users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        blocked_uid TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    """)

    # 7. Messages Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sender_uid TEXT NOT NULL,
        receiver_uid TEXT NOT NULL,
        text TEXT NOT NULL,
        is_read INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # Try adding is_read column if table existed without it
    try:
        cursor.execute("ALTER TABLE messages ADD COLUMN is_read INTEGER DEFAULT 0;")
    except Exception:
        pass

    conn.commit()
    conn.close()

def generate_10digit_uid() -> str:
    """Generates a unique 10-digit UID (e.g. 4839201745)"""
    return str(random.randint(1000000000, 9999999999))

def generate_group_uid() -> str:
    """Generates a Group UID starting with 9 (e.g. 9001234567)"""
    return str(random.randint(9000000000, 9999999999))

from datetime import datetime, timezone

def save_message(sender_uid: str, receiver_uid: str, text: str) -> dict:
    """Saves a text message between two UIDs."""
    conn = get_db_connection()
    cursor = conn.cursor()
    now_utc = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    cursor.execute(
        "INSERT INTO messages (sender_uid, receiver_uid, text, is_read, created_at) VALUES (?, ?, ?, 0, ?)",
        (sender_uid, receiver_uid, text, now_utc)
    )
    msg_id = cursor.lastrowid
    conn.commit()
    
    cursor.execute("SELECT id, sender_uid, receiver_uid, text, is_read, created_at FROM messages WHERE id = ?", (msg_id,))
    row = cursor.fetchone()
    conn.close()
    if row:
        return dict(row)
    return {"id": msg_id, "sender_uid": sender_uid, "receiver_uid": receiver_uid, "text": text, "is_read": 0, "created_at": now_utc}

def mark_messages_read(receiver_uid: str, sender_uid: str):
    """Marks all messages from sender_uid to receiver_uid as read."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE messages SET is_read = 1 WHERE receiver_uid = ? AND sender_uid = ? AND is_read = 0",
        (receiver_uid, sender_uid)
    )
    conn.commit()
    conn.close()

def get_unread_counts(my_uid: str) -> Dict[str, int]:
    """Returns unread message counts per sender for my_uid."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT sender_uid, COUNT(*) as unread_count
        FROM messages
        WHERE receiver_uid = ? AND is_read = 0
        GROUP BY sender_uid
    """, (my_uid,))
    rows = cursor.fetchall()
    conn.close()
    return {r["sender_uid"]: r["unread_count"] for r in rows}

def get_messages_between(uid1: str, uid2: str) -> List[dict]:
    """Retrieves all chat messages between two UIDs ordered by timestamp."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, sender_uid, receiver_uid, text, is_read, created_at 
        FROM messages 
        WHERE (sender_uid = ? AND receiver_uid = ?) OR (sender_uid = ? AND receiver_uid = ?)
        ORDER BY created_at ASC
    """, (uid1, uid2, uid2, uid1))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def get_recent_conversations(my_uid: str) -> List[dict]:
    """Returns unique contacts with whom user has messaged along with latest message and unread count."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT m1.id, m1.sender_uid, m1.receiver_uid, m1.text, m1.is_read, m1.created_at,
               CASE WHEN m1.sender_uid = ? THEN m1.receiver_uid ELSE m1.sender_uid END as peer_uid,
               (SELECT COUNT(*) FROM messages m3 WHERE m3.receiver_uid = ? AND m3.sender_uid = (CASE WHEN m1.sender_uid = ? THEN m1.receiver_uid ELSE m1.sender_uid END) AND m3.is_read = 0) as unread_count
        FROM messages m1
        INNER JOIN (
            SELECT MAX(id) as max_id
            FROM messages
            WHERE sender_uid = ? OR receiver_uid = ?
            GROUP BY CASE WHEN sender_uid = ? THEN receiver_uid ELSE sender_uid END
        ) m2 ON m1.id = m2.max_id
        ORDER BY m1.created_at DESC
    """, (my_uid, my_uid, my_uid, my_uid, my_uid, my_uid))
    rows = cursor.fetchall()
    
    result = []
    for r in rows:
        d = dict(r)
        peer = d["peer_uid"]
        # Lookup saved contact name first
        cursor.execute("""
            SELECT c.contact_name 
            FROM contacts c 
            JOIN users u ON c.user_id = u.id 
            WHERE u.sip_uid = ? AND c.contact_uid = ?
        """, (my_uid, peer))
        c_row = cursor.fetchone()
        if c_row and c_row["contact_name"]:
            d["peer_name"] = c_row["contact_name"]
        else:
            # Lookup registered user full_name
            cursor.execute("SELECT full_name FROM users WHERE sip_uid = ?", (peer,))
            u_row = cursor.fetchone()
            if u_row and u_row["full_name"]:
                d["peer_name"] = u_row["full_name"]
            else:
                d["peer_name"] = peer
        result.append(d)

    conn.close()
    return result
