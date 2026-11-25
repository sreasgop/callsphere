from __future__ import annotations

from datetime import timedelta

from flask import Blueprint, Response, current_app, g, jsonify, request
from pydantic import ValidationError

from app.config import Settings
from app.db import DBBackend
from app.otp_service import dispatch_otp_email, generate_otp, hash_otp, verify_otp_code
from app.schemas import LoginRequest, OtpVerifyRequest, TwoFactorToggleRequest
from app.security import (
    create_token,
    decode_token,
    issue_token_pair,
    require_auth,
    set_auth_cookies,
    verify_password,
)
from app.store import EphemeralStore

auth_v2_bp = Blueprint("auth_v2", __name__, url_prefix="/api/v2/auth")


def _db() -> DBBackend:
    return current_app.config["DB"]


def _store() -> EphemeralStore:
    return current_app.config["STORE"]


def _settings() -> Settings:
    return current_app.config["SETTINGS"]


@auth_v2_bp.post("/login")
def login_v2() -> tuple[Response, int]:
    ip = request.remote_addr or "unknown"
    if not _store().check_rate_limit(f"login:{ip}", max_requests=10, window_seconds=60):
        return jsonify({"error": "Too many login attempts; try again shortly"}), 429

    try:
        body = LoginRequest.model_validate(request.get_json(silent=True) or {})
    except ValidationError as exc:
        return jsonify({"error": exc.errors()[0]["msg"]}), 400

    user = _db().fetch_one(
        """
        SELECT id, full_name, email, password_hash, uid,
               avatar_color, status_message, privacy_mode, two_factor_enabled
        FROM users
        WHERE email = %s
        LIMIT 1
        """,
        (body.email,),
    )
    if user is None or not verify_password(body.password, user["password_hash"]):
        return jsonify({"error": "Invalid email or password"}), 401

    settings = _settings()
    if bool(user.get("two_factor_enabled", False)):
        otp = generate_otp()
        otp_key = f"2fa:{user['id']}"
        _store().set_otp(otp_key, hash_otp(otp, settings.secret_key), ttl_seconds=300)
        delivery = dispatch_otp_email(user["email"], otp, settings)
        challenge_token = create_token(
            user["id"],
            user["uid"],
            "otp_challenge",
            timedelta(minutes=5),
            settings,
        )
        return (
            jsonify(
                {
                    "requires_otp": True,
                    "challenge_token": challenge_token,
                    "delivery": delivery,
                }
            ),
            200,
        )

    access_token, refresh_token = issue_token_pair(user["id"], user["uid"], settings)
    user_payload = {
        "id": user["id"],
        "full_name": user["full_name"],
        "email": user["email"],
        "uid": user["uid"],
        "avatar_color": user["avatar_color"],
        "status_message": user["status_message"],
        "privacy_mode": user["privacy_mode"],
        "two_factor_enabled": False,
    }
    resp = jsonify({"success": True, "requires_otp": False, "user": user_payload})
    set_auth_cookies(resp, access_token, refresh_token, settings)
    return resp, 200


@auth_v2_bp.post("/otp/verify")
def verify_otp_v2() -> tuple[Response, int]:
    ip = request.remote_addr or "unknown"
    if not _store().check_rate_limit(f"otp_verify:{ip}", max_requests=10, window_seconds=60):
        return jsonify({"error": "Too many verification attempts; try again shortly"}), 429

    try:
        body = OtpVerifyRequest.model_validate(request.get_json(silent=True) or {})
    except ValidationError as exc:
        return jsonify({"error": exc.errors()[0]["msg"]}), 400

    settings = _settings()
    payload = decode_token(body.challenge_token, "otp_challenge", settings)
    if payload is None:
        return jsonify({"error": "Verification session expired; please sign in again"}), 401

    user_id = int(payload["sub"])
    ok, msg = verify_otp_code(_store(), f"2fa:{user_id}", body.otp, settings.secret_key)
    if not ok:
        return jsonify({"error": msg}), 401

    user = _db().fetch_one(
        """
        SELECT id, full_name, email, uid, avatar_color, status_message,
               privacy_mode, two_factor_enabled
        FROM users
        WHERE id = %s
        LIMIT 1
        """,
        (user_id,),
    )
    if user is None:
        return jsonify({"error": "User not found"}), 404

    access_token, refresh_token = issue_token_pair(user["id"], user["uid"], settings)
    user_payload = {
        "id": user["id"],
        "full_name": user["full_name"],
        "email": user["email"],
        "uid": user["uid"],
        "avatar_color": user["avatar_color"],
        "status_message": user["status_message"],
        "privacy_mode": user["privacy_mode"],
        "two_factor_enabled": bool(user.get("two_factor_enabled", False)),
    }
    resp = jsonify({"success": True, "user": user_payload})
    set_auth_cookies(resp, access_token, refresh_token, settings)
    return resp, 200


@auth_v2_bp.patch("/2fa")
@require_auth
def toggle_two_factor() -> tuple[Response, int]:
    try:
        body = TwoFactorToggleRequest.model_validate(request.get_json(silent=True) or {})
    except ValidationError as exc:
        return jsonify({"error": exc.errors()[0]["msg"]}), 400

    _db().execute(
        "UPDATE users SET two_factor_enabled = %s WHERE id = %s",
        (1 if body.enabled else 0, g.current_user["user_id"]),
    )
    return jsonify({"success": True, "two_factor_enabled": body.enabled}), 200
