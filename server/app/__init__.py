from __future__ import annotations

from flask import Flask, Response, jsonify, request
from flask_socketio import SocketIO

from app.config import Settings
from app.db import DBBackend, MariaDBPool, SQLiteDevDB
from app.routes.auth import auth_bp
from app.routes.auth_v2 import auth_v2_bp
from app.routes.calls import calls_bp
from app.routes.contacts import contacts_bp
from app.routes.groups import groups_bp
from app.routes.keys import keys_bp
from app.routes.messages import messages_bp
from app.sockets.signaling import clear_presence_state, register_signaling_handlers
from app.store import EphemeralStore, InMemoryStore, RedisStore

socketio = SocketIO()


def create_app(
    settings: Settings | None = None,
    db_backend: DBBackend | None = None,
    store_backend: EphemeralStore | None = None,
) -> Flask:
    cfg = settings or Settings.from_env()
    app = Flask(__name__)
    app.config["SECRET_KEY"] = cfg.secret_key
    app.config["SETTINGS"] = cfg
    app.config["MAX_CONTENT_LENGTH"] = cfg.max_upload_mb * 1024 * 1024
    if db_backend is not None:
        app.config["DB"] = db_backend
    elif cfg.db_type == "sqlite":
        app.config["DB"] = SQLiteDevDB(cfg.sqlite_path)
    else:
        app.config["DB"] = MariaDBPool(cfg)

    if store_backend is not None:
        app.config["STORE"] = store_backend
    elif cfg.use_inmemory_store or cfg.app_env == "test":
        app.config["STORE"] = InMemoryStore()
    else:
        app.config["STORE"] = RedisStore(cfg.redis_url)

    app.config["STORE"].clear_all()
    clear_presence_state()

    allowed_origins = set(cfg.cors_allowed_origins)

    def _is_allowed_origin(origin: str | None) -> bool:
        if not origin:
            return False
        if origin in allowed_origins:
            return True
        return cfg.app_env == "development" and origin.endswith(".trycloudflare.com")

    @app.after_request
    def apply_cors_and_security_headers(response: Response) -> Response:
        origin = request.headers.get("Origin")
        if _is_allowed_origin(origin):
            response.headers["Access-Control-Allow-Origin"] = origin or ""
            response.headers["Vary"] = "Origin"
            response.headers["Access-Control-Allow-Credentials"] = "true"
            response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
            response.headers["Access-Control-Allow-Methods"] = (
                "GET, POST, PATCH, PUT, DELETE, OPTIONS"
            )

        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; connect-src 'self' ws: wss:; img-src 'self' data:;"
        )
        return response

    @app.errorhandler(500)
    def handle_internal_error(_err: Exception) -> tuple[Response, int]:
        return jsonify({"error": "Internal server error"}), 500

    app.register_blueprint(auth_bp)
    app.register_blueprint(auth_v2_bp)
    app.register_blueprint(calls_bp)
    app.register_blueprint(contacts_bp)
    app.register_blueprint(groups_bp)
    app.register_blueprint(keys_bp)
    app.register_blueprint(messages_bp)

    sio_origins = "*" if cfg.app_env == "development" else list(cfg.cors_allowed_origins)
    socketio.init_app(
        app,
        cors_allowed_origins=sio_origins,
        async_mode="threading",
    )
    register_signaling_handlers(socketio)

    return app
