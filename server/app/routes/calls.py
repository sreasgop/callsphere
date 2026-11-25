from __future__ import annotations

from flask import Blueprint, Response, current_app, g, jsonify, request
from pydantic import ValidationError

from app.config import Settings
from app.db import DBBackend
from app.schemas import LogCallRequest
from app.security import require_auth

calls_bp = Blueprint("calls", __name__, url_prefix="/api/v1")


def _db() -> DBBackend:
    return current_app.config["DB"]


def _settings() -> Settings:
    return current_app.config["SETTINGS"]


@calls_bp.get("/health")
def health() -> tuple[Response, int]:
    return jsonify({"status": "online", "app": "CallSphere", "version": "1.0.0"}), 200


@calls_bp.get("/calls/history")
@require_auth
def call_history() -> tuple[Response, int]:
    uid = g.current_user["uid"]
    before_id = request.args.get("before_id", type=int)
    limit = min(max(request.args.get("limit", default=50, type=int), 1), 100)

    db = _db()
    if before_id is not None:
        rows = db.fetch_all(
            """
            SELECT id, caller_uid, callee_uid, started_at, duration, status,
                   CASE WHEN caller_uid = %s THEN 'outbound' ELSE 'inbound' END AS direction
            FROM call_logs
            WHERE (caller_uid = %s OR callee_uid = %s) AND id < %s
            ORDER BY id DESC
            LIMIT %s
            """,
            (uid, uid, uid, before_id, limit),
        )
    else:
        rows = db.fetch_all(
            """
            SELECT id, caller_uid, callee_uid, started_at, duration, status,
                   CASE WHEN caller_uid = %s THEN 'outbound' ELSE 'inbound' END AS direction
            FROM call_logs
            WHERE caller_uid = %s OR callee_uid = %s
            ORDER BY id DESC
            LIMIT %s
            """,
            (uid, uid, uid, limit),
        )

    return jsonify({"calls": rows}), 200


@calls_bp.post("/calls/log")
@require_auth
def log_call() -> tuple[Response, int]:
    try:
        body = LogCallRequest.model_validate(request.get_json(silent=True) or {})
    except ValidationError as exc:
        return jsonify({"error": exc.errors()[0]["msg"]}), 400

    caller_uid = g.current_user["uid"]
    _db().execute(
        "INSERT INTO call_logs (caller_uid, callee_uid, status, duration) VALUES (%s, %s, %s, %s)",
        (caller_uid, body.callee_uid, body.status, body.duration),
    )
    return jsonify({"success": True}), 201


@calls_bp.get("/calls/ice-servers")
@require_auth
def ice_servers() -> tuple[Response, int]:
    settings = _settings()
    servers: list[dict[str, object]] = [
        {"urls": settings.stun_url},
        {"urls": "stun:stun.l.google.com:19302"},
    ]

    has_custom_turn = (
        bool(settings.turn_url)
        and bool(settings.turn_username)
        and bool(settings.turn_credential)
        and "replace-with" not in settings.turn_username
        and "replace-with" not in settings.turn_credential
    )

    if has_custom_turn:
        servers.append(
            {
                "urls": settings.turn_url,
                "username": settings.turn_username,
                "credential": settings.turn_credential,
            }
        )
    elif settings.app_env != "production":
        # OpenRelay fallback for local/WAN testing when custom TURN credentials are not set
        servers.append(
            {
                "urls": [
                    "turn:openrelay.metered.ca:80",
                    "turn:openrelay.metered.ca:443",
                    "turn:openrelay.metered.ca:443?transport=tcp",
                    "turns:openrelay.metered.ca:443",
                    "turns:openrelay.metered.ca:443?transport=tcp",
                ],
                "username": "openrelayproject",
                "credential": "openrelayproject",
            }
        )

    return jsonify({"ice_servers": servers}), 200
