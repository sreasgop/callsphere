from __future__ import annotations

from flask.testing import FlaskClient

from tests.conftest import register_and_login


def test_health_and_security_headers(client: FlaskClient) -> None:
    resp = client.get("/api/v1/health", headers={"Origin": "http://localhost:5173"})
    assert resp.status_code == 200
    assert resp.get_json()["status"] == "online"
    assert resp.headers.get("Access-Control-Allow-Origin") == "http://localhost:5173"
    assert resp.headers.get("X-Content-Type-Options") == "nosniff"
    assert resp.headers.get("X-Frame-Options") == "DENY"


def test_register_login_me_refresh_logout_flow(client: FlaskClient) -> None:
    reg = client.post(
        "/api/v1/auth/register",
        json={
            "full_name": "Alice Tester",
            "email": "alice@example.com",
            "password": "Password123!",
        },
    )
    assert reg.status_code == 201
    uid = reg.get_json()["uid"]
    assert len(uid) == 10 and uid.isdigit()

    # Duplicate email returns 409
    dup = client.post(
        "/api/v1/auth/register",
        json={
            "full_name": "Alice Two",
            "email": "alice@example.com",
            "password": "Password123!",
        },
    )
    assert dup.status_code == 409

    # Login sets HttpOnly cookies and returns user without password_hash
    login = client.post(
        "/api/v1/auth/login",
        json={"email": "alice@example.com", "password": "Password123!"},
    )
    assert login.status_code == 200
    user = login.get_json()["user"]
    assert user["uid"] == uid
    assert "password_hash" not in user

    me = client.get("/api/v1/auth/me")
    assert me.status_code == 200
    assert me.get_json()["user"]["email"] == "alice@example.com"

    # Update settings
    upd = client.patch(
        "/api/v1/auth/settings",
        json={"privacy_mode": "contacts_only", "status_message": "In a meeting"},
    )
    assert upd.status_code == 200
    assert upd.get_json()["privacy_mode"] == "contacts_only"

    # Refresh token works
    ref = client.post("/api/v1/auth/refresh")
    assert ref.status_code == 200

    # Logout clears cookies
    out = client.post("/api/v1/auth/logout")
    assert out.status_code == 200
    assert client.get("/api/v1/auth/me").status_code == 401


def test_unauthenticated_endpoints_rejected(client: FlaskClient) -> None:
    assert client.get("/api/v1/auth/me").status_code == 401
    assert client.get("/api/v1/contacts").status_code == 401
    assert client.get("/api/v1/groups").status_code == 401
    assert client.get("/api/v1/calls/history").status_code == 401
    assert client.get("/api/v1/calls/ice-servers").status_code == 401


def test_ice_servers_requires_auth_and_returns_configured_servers(client: FlaskClient) -> None:
    register_and_login(client, full_name="Bob", email="bob@example.com")
    resp = client.get("/api/v1/calls/ice-servers")
    assert resp.status_code == 200
    servers = resp.get_json()["ice_servers"]
    assert len(servers) == 3
    assert servers[0]["urls"] == "stun:stun.l.google.com:19302"
    assert servers[2]["username"] == "turnuser"
