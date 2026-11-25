from __future__ import annotations

from flask import Flask

from tests.conftest import register_and_login


def test_contacts_and_blocking_flow(app: Flask) -> None:
    c1 = app.test_client()
    c2 = app.test_client()

    u1 = register_and_login(c1, full_name="User One", email="u1@example.com")
    u2 = register_and_login(c2, full_name="User Two", email="u2@example.com")

    # Cannot add self
    self_add = c1.post("/api/v1/contacts", json={"contact_uid": u1["uid"]})
    assert self_add.status_code == 400

    # Add u2 as contact with nickname
    add = c1.post(
        "/api/v1/contacts",
        json={"contact_uid": u2["uid"], "contact_name": "Buddy"},
    )
    assert add.status_code == 201
    assert add.get_json()["contact"]["contact_name"] == "Buddy"

    listed = c1.get("/api/v1/contacts")
    assert listed.status_code == 200
    assert len(listed.get_json()["contacts"]) == 1

    # Block and unblock
    blk = c1.post("/api/v1/contacts/block", json={"blocked_uid": u2["uid"]})
    assert blk.status_code == 200
    assert len(c1.get("/api/v1/contacts/blocked").get_json()["blocked"]) == 1

    unblk = c1.delete(f"/api/v1/contacts/block/{u2['uid']}")
    assert unblk.status_code == 200
    assert len(c1.get("/api/v1/contacts/blocked").get_json()["blocked"]) == 0


def test_groups_rbac_and_call_logs(app: Flask) -> None:
    admin_client = app.test_client()
    member_client = app.test_client()

    register_and_login(admin_client, full_name="Admin", email="admin@example.com")
    member = register_and_login(member_client, full_name="Member", email="member@example.com")

    created = admin_client.post(
        "/api/v1/groups",
        json={"group_name": "Study Buddies", "description": "Exam prep"},
    )
    assert created.status_code == 201
    group_uid = created.get_json()["group_uid"]
    assert group_uid.startswith("9") and len(group_uid) == 10

    # Non-member cannot inspect group details
    assert member_client.get(f"/api/v1/groups/{group_uid}").status_code == 403

    # Join as member
    joined = member_client.post("/api/v1/groups/join", json={"group_uid": group_uid})
    assert joined.status_code == 200

    # Member can read details but cannot rename or delete
    assert member_client.get(f"/api/v1/groups/{group_uid}").status_code == 200
    assert (
        member_client.patch(
            f"/api/v1/groups/{group_uid}", json={"group_name": "Hijacked"}
        ).status_code
        == 403
    )
    assert member_client.delete(f"/api/v1/groups/{group_uid}").status_code == 403

    # Admin can rename, remove member, and delete group
    assert (
        admin_client.patch(
            f"/api/v1/groups/{group_uid}", json={"group_name": "Study Core"}
        ).status_code
        == 200
    )
    assert (
        admin_client.delete(f"/api/v1/groups/{group_uid}/members/{member['uid']}").status_code
        == 200
    )
    assert admin_client.delete(f"/api/v1/groups/{group_uid}").status_code == 200

    # Call log uses authenticated caller_uid
    log_resp = admin_client.post(
        "/api/v1/calls/log",
        json={"callee_uid": member["uid"], "status": "completed", "duration": 42},
    )
    assert log_resp.status_code == 201
    history = member_client.get("/api/v1/calls/history").get_json()["calls"]
    assert len(history) == 1
    assert history[0]["direction"] == "inbound"
    assert history[0]["duration"] == 42
