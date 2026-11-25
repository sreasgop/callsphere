from __future__ import annotations

from flask import Blueprint, Response, current_app, g, jsonify, request
from pydantic import ValidationError

from app.config import Settings
from app.db import DBBackend, generate_unique_uid
from app.schemas import LoginRequest, RegisterRequest, UpdateSettingsRequest
from app.security import (
    REFRESH_COOKIE_NAME,
    clear_auth_cookies,
    decode_token,
    hash_password,
    issue_token_pair,
    require_auth,
    set_auth_cookies,
    verify_password,
)

auth_bp = Blueprint("auth", __name__, url_prefix="/api/v1/auth")


def _db() -> DBBackend:
    return current_app.config["DB"]


def _settings() -> Settings:
    return current_app.config["SETTINGS"]


@auth_bp.post("/register")
def register() -> tuple[Response, int]:
    try:
        body = RegisterRequest.model_validate(request.get_json(silent=True) or {})
    except ValidationError as exc:
        return jsonify({"error": exc.errors()[0]["msg"]}), 400

    db = _db()
    existing = db.fetch_one("SELECT id FROM users WHERE email = %s LIMIT 1", (body.email,))
    if existing is not None:
        return jsonify({"error": "Email is already registered"}), 409

    uid = generate_unique_uid(db, group=False)
    pwd_hash = hash_password(body.password)

    db.execute(
        "INSERT INTO users (full_name, email, password_hash, uid) VALUES (%s, %s, %s, %s)",
        (body.full_name, body.email, pwd_hash, uid),
    )

    return (
        jsonify(
            {
                "success": True,
                "uid": uid,
                "full_name": body.full_name,
                "email": body.email,
            }
        ),
        201,
    )


@auth_bp.post("/login")
def login() -> tuple[Response, int]:
    try:
        body = LoginRequest.model_validate(request.get_json(silent=True) or {})
    except ValidationError as exc:
        return jsonify({"error": exc.errors()[0]["msg"]}), 400

    db = _db()
    user = db.fetch_one(
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


@auth_bp.post("/refresh")
def refresh() -> tuple[Response, int]:
    settings = _settings()
    token = request.cookies.get(REFRESH_COOKIE_NAME)
    if not token:
        return jsonify({"error": "Refresh token missing"}), 401

    payload = decode_token(token, "refresh", settings)
    if payload is None:
        return jsonify({"error": "Invalid or expired refresh token"}), 401

    user_id = int(payload["sub"])
    uid = str(payload["uid"])
    access_token, refresh_token = issue_token_pair(user_id, uid, settings)

    resp = jsonify({"success": True})
    set_auth_cookies(resp, access_token, refresh_token, settings)
    return resp, 200


@auth_bp.post("/logout")
def logout() -> tuple[Response, int]:
    resp = jsonify({"success": True})
    clear_auth_cookies(resp, _settings())
    return resp, 200


@auth_bp.get("/me")
@require_auth
def me() -> tuple[Response, int]:
    user = _db().fetch_one(
        """
        SELECT id, full_name, email, uid, avatar_color, status_message,
               privacy_mode, two_factor_enabled
        FROM users
        WHERE id = %s
        LIMIT 1
        """,
        (g.current_user["user_id"],),
    )
    if user is None:
        return jsonify({"error": "User not found"}), 404
    user["two_factor_enabled"] = bool(user.get("two_factor_enabled", False))
    return jsonify({"user": user}), 200


@auth_bp.patch("/settings")
@require_auth
def update_settings() -> tuple[Response, int]:
    try:
        body = UpdateSettingsRequest.model_validate(request.get_json(silent=True) or {})
    except ValidationError as exc:
        return jsonify({"error": exc.errors()[0]["msg"]}), 400

    _db().execute(
        "UPDATE users SET status_message = %s, privacy_mode = %s WHERE id = %s",
        (body.status_message, body.privacy_mode, g.current_user["user_id"]),
    )
    return (
        jsonify(
            {
                "success": True,
                "status_message": body.status_message,
                "privacy_mode": body.privacy_mode,
            }
        ),
        200,
    )
