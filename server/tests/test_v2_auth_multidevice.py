from __future__ import annotations

from datetime import timedelta

from flask import Flask

from app import socketio
from app.config import Settings
from app.otp_service import hash_otp
from app.security import create_token
from tests.conftest import register_and_login


def test_v2_2fa_otp_login_and_single_use_enforcement(app: Flask, test_settings: Settings) -> None:
    client = app.test_client()
    user = register_and_login(client, full_name="OTP User", email="otp@example.com")

    # Enable 2FA
    toggle = client.patch("/api/v2/auth/2fa", json={"enabled": True})
    assert toggle.status_code == 200
    assert toggle.get_json()["two_factor_enabled"] is True
    client.post("/api/v1/auth/logout")

    # v2 login now returns requires_otp + challenge_token without setting auth cookies
    login_resp = client.post(
        "/api/v2/auth/login",
        json={"email": "otp@example.com", "password": "StrongPass123!"},
    )
    assert login_resp.status_code == 200
    body = login_resp.get_json()
    assert body["requires_otp"] is True
    challenge_token = body["challenge_token"]
    assert client.get("/api/v1/auth/me").status_code == 401

    # Inject known hashed OTP in store for deterministic verification
    store = app.config["STORE"]
    store.set_otp(f"2fa:{user['id']}", hash_otp("123456", test_settings.secret_key), 300)

    # Wrong OTP fails
    bad = client.post(
        "/api/v2/auth/otp/verify",
        json={"challenge_token": challenge_token, "otp": "000000"},
    )
    assert bad.status_code == 401

    # Correct OTP succeeds and sets cookies
    ok = client.post(
        "/api/v2/auth/otp/verify",
        json={"challenge_token": challenge_token, "otp": "123456"},
    )
    assert ok.status_code == 200
    assert ok.get_json()["user"]["email"] == "otp@example.com"
    assert client.get("/api/v1/auth/me").status_code == 200

    # Single-use: replaying the same OTP fails
    replay = client.post(
        "/api/v2/auth/otp/verify",
        json={"challenge_token": challenge_token, "otp": "123456"},
    )
    assert replay.status_code == 401


def test_multi_device_simultaneous_ringing_and_cancellation(
    app: Flask, test_settings: Settings
) -> None:
    c1 = app.test_client()
    c2 = app.test_client()

    u1 = register_and_login(c1, full_name="Caller", email="c1@example.com")
    u2 = register_and_login(c2, full_name="MultiDevice", email="c2@example.com")

    t1 = create_token(u1["id"], u1["uid"], "access", timedelta(minutes=15), test_settings)
    t2 = create_token(u2["id"], u2["uid"], "access", timedelta(minutes=15), test_settings)

    s_caller = socketio.test_client(app, auth={"token": t1})
    s_laptop = socketio.test_client(app, auth={"token": t2})
    s_phone = socketio.test_client(app, auth={"token": t2})

    s_caller.get_received()
    s_laptop.get_received()
    s_phone.get_received()

    # Offer rings both laptop and phone simultaneously
    s_caller.emit("call:offer", {"target_uid": u2["uid"], "offer": {"sdp": "v=0", "type": "offer"}})
    assert any(e["name"] == "call:incoming" for e in s_laptop.get_received())
    assert any(e["name"] == "call:incoming" for e in s_phone.get_received())

    # Laptop answers -> phone receives call:cancelled
    s_laptop.emit(
        "call:answer", {"target_uid": u1["uid"], "answer": {"sdp": "v=0", "type": "answer"}}
    )
    assert any(
        e["name"] == "call:cancelled" and e["args"][0]["reason"] == "answered_elsewhere"
        for e in s_phone.get_received()
    )
    assert any(e["name"] == "call:answered" for e in s_caller.get_received())

    s_caller.disconnect()
    s_laptop.disconnect()
    s_phone.disconnect()
