from __future__ import annotations

import re
import uuid
from pathlib import Path

from flask import Blueprint, Response, current_app, g, jsonify, request, send_file
from pydantic import ValidationError

from app.config import Settings
from app.db import DBBackend
from app.schemas import MarkReadRequest
from app.security import require_auth
from app.store import EphemeralStore

messages_bp = Blueprint("messages", __name__, url_prefix="/api/v2")
UID_RE = re.compile(r"^\d{10}$")


def _db() -> DBBackend:
    return current_app.config["DB"]


def _store() -> EphemeralStore:
    return current_app.config["STORE"]


def _settings() -> Settings:
    return current_app.config["SETTINGS"]


def canonical_conversation_id(uid_a: str, uid_b: str) -> str:
    low, high = sorted((uid_a, uid_b))
    return f"{low}:{high}"


def _resolve_storage_path(storage_root: Path, filename: str) -> Path:
    root = storage_root.resolve()
    root.mkdir(parents=True, exist_ok=True)
    target = (root / filename).resolve()
    if root not in target.parents:
        raise ValueError("Invalid storage path")
    return target


@messages_bp.get("/messages/conversations")
@require_auth
def list_conversations() -> tuple[Response, int]:
    my_uid = g.current_user["uid"]
    my_id = g.current_user["user_id"]
    db = _db()

    rows = db.fetch_all(
        """
        SELECT m.id, m.sender_uid, m.recipient_uid, m.ciphertext, m.iv,
               m.attachment_id, m.is_read, m.created_at,
               CASE WHEN m.sender_uid = %s THEN m.recipient_uid ELSE m.sender_uid END AS peer_uid
        FROM messages m
        INNER JOIN (
            SELECT MAX(id) AS max_id
            FROM messages
            WHERE sender_uid = %s OR recipient_uid = %s
            GROUP BY conversation_id
        ) latest ON m.id = latest.max_id
        ORDER BY m.id DESC
        LIMIT 50
        """,
        (my_uid, my_uid, my_uid),
    )

    if not rows:
        return jsonify({"conversations": []}), 200

    unread_rows = db.fetch_all(
        """
        SELECT sender_uid, COUNT(*) AS unread_count
        FROM messages
        WHERE recipient_uid = %s AND is_read = 0
        GROUP BY sender_uid
        """,
        (my_uid,),
    )
    unread_map = {r["sender_uid"]: int(r["unread_count"]) for r in unread_rows}

    contact_rows = db.fetch_all(
        "SELECT contact_uid, contact_name FROM contacts WHERE user_id = %s",
        (my_id,),
    )
    contact_map = {r["contact_uid"]: r["contact_name"] for r in contact_rows}

    peer_uids = [r["peer_uid"] for r in rows]
    placeholders = ", ".join(["%s"] * len(peer_uids))
    user_rows = db.fetch_all(
        f"SELECT uid, full_name FROM users WHERE uid IN ({placeholders})",
        tuple(peer_uids),
    )
    user_map = {r["uid"]: r["full_name"] for r in user_rows}

    for r in rows:
        peer = r["peer_uid"]
        r["peer_name"] = contact_map.get(peer) or user_map.get(peer) or peer
        r["unread_count"] = unread_map.get(peer, 0)

    return jsonify({"conversations": rows}), 200


@messages_bp.get("/messages/history/<peer_uid>")
@require_auth
def message_history(peer_uid: str) -> tuple[Response, int]:
    if not UID_RE.match(peer_uid):
        return jsonify({"error": "Invalid 10-digit UID"}), 400

    my_uid = g.current_user["uid"]
    conv_id = canonical_conversation_id(my_uid, peer_uid)
    before_id = request.args.get("before_id", type=int)
    limit = min(max(request.args.get("limit", default=30, type=int), 1), 100)

    db = _db()
    if before_id is not None:
        rows = db.fetch_all(
            """
            SELECT id, conversation_id, sender_uid, recipient_uid, ciphertext, iv,
                   attachment_id, attachment_meta_ct, attachment_meta_iv, is_read, created_at
            FROM messages
            WHERE conversation_id = %s AND id < %s
            ORDER BY id DESC
            LIMIT %s
            """,
            (conv_id, before_id, limit),
        )
    else:
        rows = db.fetch_all(
            """
            SELECT id, conversation_id, sender_uid, recipient_uid, ciphertext, iv,
                   attachment_id, attachment_meta_ct, attachment_meta_iv, is_read, created_at
            FROM messages
            WHERE conversation_id = %s
            ORDER BY id DESC
            LIMIT %s
            """,
            (conv_id, limit),
        )

    rows.reverse()
    return jsonify({"messages": rows}), 200


@messages_bp.post("/messages/read")
@require_auth
def mark_read() -> tuple[Response, int]:
    try:
        body = MarkReadRequest.model_validate(request.get_json(silent=True) or {})
    except ValidationError as exc:
        return jsonify({"error": exc.errors()[0]["msg"]}), 400

    _db().execute(
        """
        UPDATE messages
        SET is_read = 1
        WHERE recipient_uid = %s AND sender_uid = %s AND is_read = 0
        """,
        (g.current_user["uid"], body.sender_uid),
    )
    return jsonify({"success": True}), 200


@messages_bp.post("/attachments")
@require_auth
def upload_attachment() -> tuple[Response, int]:
    my_uid = g.current_user["uid"]
    if not _store().check_rate_limit(f"upload:{my_uid}", max_requests=20, window_seconds=60):
        return jsonify({"error": "Upload rate limit exceeded"}), 429

    uploaded = request.files.get("file")
    if uploaded is None:
        return jsonify({"error": "Encrypted file payload is required"}), 400

    raw_bytes = uploaded.read()
    max_bytes = _settings().max_upload_mb * 1024 * 1024
    if not raw_bytes or len(raw_bytes) > max_bytes:
        return jsonify(
            {"error": f"File must be between 1 byte and {_settings().max_upload_mb} MB"}
        ), 400

    att_id = str(uuid.uuid4())
    storage_name = f"{att_id}.bin"
    dest = _resolve_storage_path(Path(_settings().storage_root), storage_name)
    dest.write_bytes(raw_bytes)

    _db().execute(
        "INSERT INTO attachments (id, uploader_uid, storage_name, byte_size) "
        "VALUES (%s, %s, %s, %s)",
        (att_id, my_uid, storage_name, len(raw_bytes)),
    )
    return jsonify({"success": True, "attachment_id": att_id, "byte_size": len(raw_bytes)}), 201


@messages_bp.get("/attachments/<attachment_id>")
@require_auth
def download_attachment(attachment_id: str) -> Response | tuple[Response, int]:
    try:
        uuid.UUID(attachment_id)
    except ValueError:
        return jsonify({"error": "Invalid attachment ID"}), 400

    row = _db().fetch_one(
        "SELECT storage_name FROM attachments WHERE id = %s LIMIT 1",
        (attachment_id,),
    )
    if row is None:
        return jsonify({"error": "Attachment not found"}), 404

    path = _resolve_storage_path(Path(_settings().storage_root), row["storage_name"])
    if not path.is_file():
        return jsonify({"error": "Attachment file missing"}), 404

    resp = send_file(
        path,
        mimetype="application/octet-stream",
        as_attachment=True,
        download_name=f"{attachment_id}.bin",
    )
    resp.headers["X-Content-Type-Options"] = "nosniff"
    return resp
