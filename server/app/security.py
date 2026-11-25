from __future__ import annotations

from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from functools import wraps
from typing import Any

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from flask import Response, current_app, g, jsonify, request

from app.config import Settings

ACCESS_COOKIE_NAME = "cs_access_token"
REFRESH_COOKIE_NAME = "cs_refresh_token"

_password_hasher = PasswordHasher()


def hash_password(password: str) -> str:
    return _password_hasher.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return _password_hasher.verify(hashed_password, plain_password)
    except (VerifyMismatchError, ValueError):
        return False


def create_token(
    user_id: int,
    uid: str,
    token_type: str,
    ttl: timedelta,
    settings: Settings,
) -> str:
    now = datetime.now(UTC)
    payload = {
        "sub": str(user_id),
        "uid": uid,
        "type": token_type,
        "iat": now,
        "exp": now + ttl,
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm="HS256")


def issue_token_pair(user_id: int, uid: str, settings: Settings) -> tuple[str, str]:
    access = create_token(
        user_id,
        uid,
        "access",
        timedelta(minutes=settings.jwt_access_ttl_minutes),
        settings,
    )
    refresh = create_token(
        user_id,
        uid,
        "refresh",
        timedelta(days=settings.jwt_refresh_ttl_days),
        settings,
    )
    return access, refresh


def decode_token(token: str, expected_type: str, settings: Settings) -> dict[str, Any] | None:
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=["HS256"])
    except jwt.PyJWTError:
        return None
    if payload.get("type") != expected_type:
        return None
    if not payload.get("sub") or not payload.get("uid"):
        return None
    return payload


def set_auth_cookies(
    response: Response,
    access_token: str,
    refresh_token: str,
    settings: Settings,
) -> None:
    response.set_cookie(
        ACCESS_COOKIE_NAME,
        access_token,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="Lax",
        max_age=settings.jwt_access_ttl_minutes * 60,
        path="/",
    )
    response.set_cookie(
        REFRESH_COOKIE_NAME,
        refresh_token,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="Lax",
        max_age=settings.jwt_refresh_ttl_days * 86400,
        path="/api/v1/auth",
    )


def clear_auth_cookies(response: Response, settings: Settings) -> None:
    response.delete_cookie(
        ACCESS_COOKIE_NAME,
        path="/",
        samesite="Lax",
        secure=settings.cookie_secure,
    )
    response.delete_cookie(
        REFRESH_COOKIE_NAME,
        path="/api/v1/auth",
        samesite="Lax",
        secure=settings.cookie_secure,
    )


def extract_access_token_from_request() -> str | None:
    cookie_token = request.cookies.get(ACCESS_COOKIE_NAME)
    if cookie_token:
        return cookie_token
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        return auth_header[7:].strip()
    return None


def require_auth(fn: Callable[..., Any]) -> Callable[..., Any]:
    @wraps(fn)
    def wrapper(*args: Any, **kwargs: Any) -> Any:
        settings: Settings = current_app.config["SETTINGS"]
        token = extract_access_token_from_request()
        if not token:
            return jsonify({"error": "Authentication required"}), 401
        payload = decode_token(token, "access", settings)
        if not payload:
            return jsonify({"error": "Invalid or expired token"}), 401
        g.current_user = {
            "user_id": int(payload["sub"]),
            "uid": str(payload["uid"]),
        }
        return fn(*args, **kwargs)

    return wrapper
