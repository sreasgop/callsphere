from __future__ import annotations

import json
import re

from flask import Blueprint, Response, current_app, g, jsonify, request
from pydantic import ValidationError

from app.db import DBBackend
from app.schemas import PublishKeyRequest
from app.security import require_auth

keys_bp = Blueprint("keys", __name__, url_prefix="/api/v2/keys")
UID_RE = re.compile(r"^\d{10}$")


def _db() -> DBBackend:
    return current_app.config["DB"]


@keys_bp.put("/public")
@require_auth
def publish_public_key() -> tuple[Response, int]:
    try:
        body = PublishKeyRequest.model_validate(request.get_json(silent=True) or {})
    except ValidationError as exc:
        return jsonify({"error": exc.errors()[0]["msg"]}), 400

    jwk = body.public_key_jwk
    if jwk.get("kty") != "EC" or jwk.get("crv") != "P-256" or "d" in jwk:
        return jsonify({"error": "Invalid ECDH P-256 public key JWK"}), 400
    if not jwk.get("x") or not jwk.get("y"):
        return jsonify({"error": "Public key coordinates missing"}), 400

    jwk_str = json.dumps(jwk, separators=(",", ":"))
    db = _db()
    existing = db.fetch_one(
        "SELECT id FROM user_keys WHERE user_id = %s LIMIT 1",
        (g.current_user["user_id"],),
    )
    if existing is not None:
        db.execute(
            "UPDATE user_keys SET public_key_jwk = %s WHERE id = %s",
            (jwk_str, existing["id"]),
        )
    else:
        db.execute(
            "INSERT INTO user_keys (user_id, uid, public_key_jwk) VALUES (%s, %s, %s)",
            (g.current_user["user_id"], g.current_user["uid"], jwk_str),
        )
    return jsonify({"success": True}), 200


@keys_bp.get("/<target_uid>")
@require_auth
def get_public_key(target_uid: str) -> tuple[Response, int]:
    if not UID_RE.match(target_uid):
        return jsonify({"error": "Invalid 10-digit UID"}), 400

    row = _db().fetch_one(
        "SELECT uid, public_key_jwk FROM user_keys WHERE uid = %s LIMIT 1",
        (target_uid,),
    )
    if row is None:
        return jsonify({"error": "Recipient has not published an E2EE key yet"}), 404

    return (
        jsonify(
            {
                "uid": row["uid"],
                "public_key_jwk": json.loads(row["public_key_jwk"]),
            }
        ),
        200,
    )
