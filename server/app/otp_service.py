from __future__ import annotations

import hashlib
import hmac
import secrets
import smtplib
import threading
from email.message import EmailMessage

from app.config import Settings
from app.store import EphemeralStore


def generate_otp() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def hash_otp(otp: str, secret_key: str) -> str:
    return hmac.new(secret_key.encode("utf-8"), otp.encode("utf-8"), hashlib.sha256).hexdigest()


def _smtp_configured(settings: Settings) -> bool:
    if not settings.smtp_user or not settings.smtp_pass:
        return False
    if "example.com" in settings.smtp_user or "replace-with" in settings.smtp_pass:
        return False
    return True


def _send_smtp_email(recipient: str, otp: str, settings: Settings) -> None:
    msg = EmailMessage()
    msg["Subject"] = "CallSphere Verification Code"
    msg["From"] = settings.smtp_user
    msg["To"] = recipient
    msg.set_content(
        f"Your CallSphere 2FA verification code is: {otp}\n\n"
        "This code expires in 5 minutes and can only be used once."
    )
    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as server:
            server.starttls()
            server.login(settings.smtp_user, settings.smtp_pass)
            server.send_message(msg)
    except Exception:
        # Non-blocking background thread; avoid crashing worker on transient SMTP errors
        pass


def dispatch_otp_email(recipient: str, otp: str, settings: Settings) -> str:
    if _smtp_configured(settings):
        thread = threading.Thread(
            target=_send_smtp_email,
            args=(recipient, otp, settings),
            daemon=True,
        )
        thread.start()
        return "smtp"
    if settings.app_env == "development":
        print(f"[CallSphere Dev OTP] {recipient} -> {otp}")
    return "dev_console"


def verify_otp_code(
    store: EphemeralStore, key: str, candidate: str, secret_key: str
) -> tuple[bool, str]:
    record = store.get_otp(key)
    if record is None:
        return False, "Verification code expired or not requested"

    attempts = store.increment_otp_attempts(key)
    if attempts > 5:
        store.delete_otp(key)
        return False, "Too many invalid attempts; request a new code"

    expected = hash_otp(candidate.strip(), secret_key)
    if not hmac.compare_digest(expected, record["hash"]):
        return False, "Invalid verification code"

    store.delete_otp(key)
    return True, "Verified"
