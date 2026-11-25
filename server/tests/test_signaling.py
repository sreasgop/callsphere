from __future__ import annotations

from datetime import timedelta

from flask import Flask

from app import socketio
from app.config import Settings
from app.security import create_token
from tests.conftest import register_and_login


def test_socket_rejects_unauthenticated_connection(app: Flask) -> None:
    client = socketio.test_client(app)
    assert not client.is_connected()


def test_socket_call_signaling_and_privacy_enforcement(app: Flask, test_settings: Settings) -> None:
    c1 = app.test_client()
    c2 = app.test_client()

    u1 = register_and_login(c1, full_name="Caller", email="caller@example.com")
    u2 = register_and_login(c2, full_name="Callee", email="callee@example.com")

    t1 = create_token(u1["id"], u1["uid"], "access", timedelta(minutes=15), test_settings)
    t2 = create_token(u2["id"], u2["uid"], "access", timedelta(minutes=15), test_settings)

    s1 = socketio.test_client(app, auth={"token": t1})
    s2 = socketio.test_client(app, auth={"token": t2})
    assert s1.is_connected()
    assert s2.is_connected()

    # Drain presence events
    s1.get_received()
    s2.get_received()

    # Standard offer succeeds
    s1.emit("call:offer", {"target_uid": u2["uid"], "offer": {"sdp": "v=0", "type": "offer"}})
    received_by_u2 = s2.get_received()
    assert any(
        evt["name"] == "call:incoming" and evt["args"][0]["from_uid"] == u1["uid"]
        for evt in received_by_u2
    )

    # Answer routes back to u1
    s2.emit("call:answer", {"target_uid": u1["uid"], "answer": {"sdp": "v=0", "type": "answer"}})
    received_by_u1 = s1.get_received()
    assert any(
        evt["name"] == "call:answered" and evt["args"][0]["from_uid"] == u2["uid"]
        for evt in received_by_u1
    )

    # Privacy mode: DND blocks offer server-side
    c2.patch("/api/v1/auth/settings", json={"privacy_mode": "dnd"})
    s1.emit("call:offer", {"target_uid": u2["uid"], "offer": {"sdp": "v=0", "type": "offer"}})
    err_events = s1.get_received()
    assert any(evt["name"] == "call:error" for evt in err_events)
    assert s2.get_received() == []

    # Privacy mode: contacts_only blocks non-contact, then allows once added
    c2.patch("/api/v1/auth/settings", json={"privacy_mode": "contacts_only"})
    s1.emit("call:offer", {"target_uid": u2["uid"], "offer": {"sdp": "v=0", "type": "offer"}})
    assert any(evt["name"] == "call:error" for evt in s1.get_received())

    c2.post("/api/v1/contacts", json={"contact_uid": u1["uid"]})
    s1.emit("call:offer", {"target_uid": u2["uid"], "offer": {"sdp": "v=0", "type": "offer"}})
    assert any(evt["name"] == "call:incoming" for evt in s2.get_received())

    # Blocked user cannot call even if in contacts
    c2.post("/api/v1/contacts/block", json={"blocked_uid": u1["uid"]})
    s1.emit("call:offer", {"target_uid": u2["uid"], "offer": {"sdp": "v=0", "type": "offer"}})
    assert any(evt["name"] == "call:error" for evt in s1.get_received())
    assert s2.get_received() == []

    s1.disconnect()
    s2.disconnect()
