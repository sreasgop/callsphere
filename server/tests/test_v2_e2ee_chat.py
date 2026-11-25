from __future__ import annotations

import io
from datetime import timedelta

from flask import Flask

from app import socketio
from app.config import Settings
from app.security import create_token
from tests.conftest import register_and_login


def test_e2ee_public_key_publish_and_reject_private_d(app: Flask) -> None:
    c1 = app.test_client()
    c2 = app.test_client()
    u1 = register_and_login(c1, full_name="Alice", email="alice_k@example.com")
    register_and_login(c2, full_name="Bob", email="bob_k@example.com")

    # Rejects private key component 'd'
    bad = c1.put(
        "/api/v2/keys/public",
        json={"public_key_jwk": {"kty": "EC", "crv": "P-256", "x": "abc", "y": "def", "d": "priv"}},
    )
    assert bad.status_code == 400

    # Accepts valid P-256 public JWK
    ok = c1.put(
        "/api/v2/keys/public",
        json={"public_key_jwk": {"kty": "EC", "crv": "P-256", "x": "abc", "y": "def"}},
    )
    assert ok.status_code == 200

    fetched = c2.get(f"/api/v2/keys/{u1['uid']}")
    assert fetched.status_code == 200
    assert fetched.get_json()["public_key_jwk"]["x"] == "abc"


def test_e2ee_socket_chat_cursor_history_and_attachment_upload(
    app: Flask, test_settings: Settings
) -> None:
    c1 = app.test_client()
    c2 = app.test_client()
    u1 = register_and_login(c1, full_name="Sender", email="sender@example.com")
    u2 = register_and_login(c2, full_name="Receiver", email="recv@example.com")

    # Upload encrypted blob attachment
    up = c1.post(
        "/api/v2/attachments",
        data={"file": (io.BytesIO(b"\x00\x01\x02encrypted-payload"), "cipher.bin")},
        content_type="multipart/form-data",
    )
    assert up.status_code == 201
    att_id = up.get_json()["attachment_id"]

    # Download requires auth and returns nosniff + attachment disposition
    dl = c2.get(f"/api/v2/attachments/{att_id}")
    assert dl.status_code == 200
    assert dl.headers.get("X-Content-Type-Options") == "nosniff"
    assert "attachment" in dl.headers.get("Content-Disposition", "")
    assert dl.data == b"\x00\x01\x02encrypted-payload"

    # Send encrypted message via Socket.IO
    t1 = create_token(u1["id"], u1["uid"], "access", timedelta(minutes=15), test_settings)
    t2 = create_token(u2["id"], u2["uid"], "access", timedelta(minutes=15), test_settings)
    s1 = socketio.test_client(app, auth={"token": t1})
    s2 = socketio.test_client(app, auth={"token": t2})
    s1.get_received()
    s2.get_received()

    s1.emit(
        "chat:send",
        {
            "target_uid": u2["uid"],
            "ciphertext": "base64ciphertext==",
            "iv": "base64iv1234==",
            "attachment_id": att_id,
        },
    )
    assert any(
        e["name"] == "chat:message" and e["args"][0]["ciphertext"] == "base64ciphertext=="
        for e in s2.get_received()
    )
    assert any(e["name"] == "chat:ack" for e in s1.get_received())

    # Conversations + cursor history + mark read
    convs = c2.get("/api/v2/messages/conversations").get_json()["conversations"]
    assert len(convs) == 1
    assert convs[0]["unread_count"] == 1

    hist = c2.get(f"/api/v2/messages/history/{u1['uid']}").get_json()["messages"]
    assert len(hist) == 1
    assert hist[0]["attachment_id"] == att_id

    c2.post("/api/v2/messages/read", json={"sender_uid": u1["uid"]})
    convs_after = c2.get("/api/v2/messages/conversations").get_json()["conversations"]
    assert convs_after[0]["unread_count"] == 0

    s1.disconnect()
    s2.disconnect()
