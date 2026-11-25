from __future__ import annotations

from flask import Blueprint, Response, current_app, g, jsonify, request
from pydantic import ValidationError

from app.db import DBBackend
from app.schemas import AddContactRequest, BlockUidRequest
from app.security import require_auth
from app.store import EphemeralStore

contacts_bp = Blueprint("contacts", __name__, url_prefix="/api/v1/contacts")


def _db() -> DBBackend:
    return current_app.config["DB"]


def _store() -> EphemeralStore:
    return current_app.config["STORE"]


@contacts_bp.get("")
@require_auth
def list_contacts() -> tuple[Response, int]:
    rows = _db().fetch_all(
        """
        SELECT id, contact_uid, contact_name, is_favorite
        FROM contacts
        WHERE user_id = %s
        ORDER BY is_favorite DESC, contact_name ASC
        """,
        (g.current_user["user_id"],),
    )
    active = _store().online_uids()
    for row in rows:
        row["is_online"] = row["contact_uid"] in active
    return jsonify({"contacts": rows}), 200


@contacts_bp.post("")
@require_auth
def add_contact() -> tuple[Response, int]:
    try:
        body = AddContactRequest.model_validate(request.get_json(silent=True) or {})
    except ValidationError as exc:
        return jsonify({"error": exc.errors()[0]["msg"]}), 400

    user_id = g.current_user["user_id"]
    my_uid = g.current_user["uid"]
    if body.contact_uid == my_uid:
        return jsonify({"error": "Cannot add yourself as a contact"}), 400

    db = _db()
    target = db.fetch_one(
        "SELECT id, full_name FROM users WHERE uid = %s LIMIT 1",
        (body.contact_uid,),
    )
    if target is None:
        return jsonify({"error": "Target 10-digit UID not found"}), 404

    final_name = (
        body.contact_name.strip()
        if body.contact_name and body.contact_name.strip()
        else target["full_name"]
    )

    existing = db.fetch_one(
        "SELECT id FROM contacts WHERE user_id = %s AND contact_uid = %s LIMIT 1",
        (user_id, body.contact_uid),
    )
    if existing is not None:
        db.execute(
            "UPDATE contacts SET contact_name = %s WHERE id = %s",
            (final_name, existing["id"]),
        )
    else:
        db.execute(
            "INSERT INTO contacts (user_id, contact_uid, contact_name) VALUES (%s, %s, %s)",
            (user_id, body.contact_uid, final_name),
        )

    return (
        jsonify(
            {
                "success": True,
                "contact": {
                    "contact_uid": body.contact_uid,
                    "contact_name": final_name,
                    "is_online": _store().is_uid_online(body.contact_uid),
                },
            }
        ),
        201,
    )


@contacts_bp.get("/blocked")
@require_auth
def list_blocked() -> tuple[Response, int]:
    rows = _db().fetch_all(
        "SELECT blocked_uid, created_at FROM blocked_users WHERE user_id = %s ORDER BY id DESC",
        (g.current_user["user_id"],),
    )
    return jsonify({"blocked": rows}), 200


@contacts_bp.post("/block")
@require_auth
def block_uid() -> tuple[Response, int]:
    try:
        body = BlockUidRequest.model_validate(request.get_json(silent=True) or {})
    except ValidationError as exc:
        return jsonify({"error": exc.errors()[0]["msg"]}), 400

    if body.blocked_uid == g.current_user["uid"]:
        return jsonify({"error": "Cannot block yourself"}), 400

    db = _db()
    existing = db.fetch_one(
        "SELECT id FROM blocked_users WHERE user_id = %s AND blocked_uid = %s LIMIT 1",
        (g.current_user["user_id"], body.blocked_uid),
    )
    if existing is None:
        db.execute(
            "INSERT INTO blocked_users (user_id, blocked_uid) VALUES (%s, %s)",
            (g.current_user["user_id"], body.blocked_uid),
        )
    return jsonify({"success": True, "blocked_uid": body.blocked_uid}), 200


@contacts_bp.delete("/block/<blocked_uid>")
@require_auth
def unblock_uid(blocked_uid: str) -> tuple[Response, int]:
    _db().execute(
        "DELETE FROM blocked_users WHERE user_id = %s AND blocked_uid = %s",
        (g.current_user["user_id"], blocked_uid),
    )
    return jsonify({"success": True}), 200
