from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv


def _load_root_env() -> None:
    root_env = Path(__file__).resolve().parents[2] / ".env"
    if root_env.exists():
        load_dotenv(root_env, override=False)


@dataclass(frozen=True)
class Settings:
    app_env: str
    secret_key: str
    jwt_secret_key: str
    jwt_access_ttl_minutes: int
    jwt_refresh_ttl_days: int
    cors_allowed_origins: tuple[str, ...]
    db_type: str
    db_host: str
    db_port: int
    db_name: str
    db_user: str
    db_password: str
    db_pool_size: int
    sqlite_path: str
    redis_url: str
    use_inmemory_store: bool
    smtp_host: str
    smtp_port: int
    smtp_user: str
    smtp_pass: str
    storage_root: str
    max_upload_mb: int
    stun_url: str
    turn_url: str
    turn_username: str
    turn_credential: str

    @property
    def cookie_secure(self) -> bool:
        return self.app_env == "production"

    @classmethod
    def from_env(cls) -> Settings:
        _load_root_env()
        origins_raw = os.getenv("CORS_ALLOWED_ORIGINS", "http://localhost:5173")
        origins = tuple(o.strip() for o in origins_raw.split(",") if o.strip())

        return cls(
            app_env=os.getenv("APP_ENV", "development"),
            secret_key=os.getenv("SECRET_KEY", "dev-secret-change-in-production"),
            jwt_secret_key=os.getenv("JWT_SECRET_KEY", "dev-jwt-secret-change-in-production"),
            jwt_access_ttl_minutes=int(os.getenv("JWT_ACCESS_TTL_MINUTES", "15")),
            jwt_refresh_ttl_days=int(os.getenv("JWT_REFRESH_TTL_DAYS", "14")),
            cors_allowed_origins=origins,
            db_type=os.getenv("DB_TYPE", "mariadb").lower(),
            db_host=os.getenv("DB_HOST", "127.0.0.1"),
            db_port=int(os.getenv("DB_PORT", "3306")),
            db_name=os.getenv("DB_NAME", "callsphere_v2"),
            db_user=os.getenv("DB_USER", "callsphere_app"),
            db_password=os.getenv("DB_PASSWORD", ""),
            db_pool_size=int(os.getenv("DB_POOL_SIZE", "10")),
            sqlite_path=os.getenv(
                "SQLITE_PATH",
                str(Path(__file__).resolve().parents[1] / "callsphere_dev.db"),
            ),
            redis_url=os.getenv("REDIS_URL", "redis://127.0.0.1:6379/0"),
            use_inmemory_store=os.getenv("USE_INMEMORY_STORE", "false").lower()
            in ("1", "true", "yes"),
            smtp_host=os.getenv("SMTP_HOST", "smtp.gmail.com"),
            smtp_port=int(os.getenv("SMTP_PORT", "587")),
            smtp_user=os.getenv("SMTP_USER", ""),
            smtp_pass=os.getenv("SMTP_PASS", ""),
            storage_root=os.getenv(
                "STORAGE_ROOT",
                str(Path(__file__).resolve().parents[2] / "storage"),
            ),
            max_upload_mb=int(os.getenv("MAX_UPLOAD_MB", "10")),
            stun_url=os.getenv("STUN_URL", "stun:stun.relay.metered.ca:80"),
            turn_url=os.getenv("TURN_URL", ""),
            turn_username=os.getenv("TURN_USERNAME", ""),
            turn_credential=os.getenv("TURN_CREDENTIAL", ""),
        )
