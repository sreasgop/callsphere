from __future__ import annotations

from flask import Blueprint, Response, current_app, g, jsonify, request
from pydantic import ValidationError

from app.db import DBBackend, generate_unique_uid
from app.schemas import CreateGroupRequest, GroupMemberRequest, JoinGroupRequest, UpdateGroupRequest
from app.security import require_auth

groups_bp = Blueprint("groups", __name__, url_prefix="/api/v1/groups")


def _db() -> DBBackend:
    return current_app.config["DB"]


def _get_group_and_role(
    db: DBBackend, group_uid: str, user_uid: str
) -> tuple[dict | None, str | None]:
    group = db.fetch_one(
        "SELECT id, group_uid, group_name, description, created_by, created_at "
        "FROM `groups` WHERE group_uid = %s LIMIT 1",
        (group_uid,),
    )
    if group is None:
        return None, None
    membership = db.fetch_one(
        "SELECT role FROM group_members WHERE group_id = %s AND user_uid = %s LIMIT 1",
        (group["id"], user_uid),
    )
    return group, (membership["role"] if membership else None)


@groups_bp.get("")
@require_auth
def list_my_groups() -> tuple[Response, int]:
    rows = _db().fetch_all(
        """
        SELECT g.group_uid, g.group_name, g.description, gm.role
        FROM `groups` g
        JOIN group_members gm ON g.id = gm.group_id
        WHERE gm.user_uid = %s
        ORDER BY g.id DESC
        """,
        (g.current_user["uid"],),
    )
    return jsonify({"groups": rows}), 200


@groups_bp.post("")
@require_auth
def create_group() -> tuple[Response, int]:
    try:
        body = CreateGroupRequest.model_validate(request.get_json(silent=True) or {})
    except ValidationError as exc:
        return jsonify({"error": exc.errors()[0]["msg"]}), 400

    db = _db()
    group_uid = generate_unique_uid(db, group=True)
    group_id = db.execute(
        "INSERT INTO `groups` (group_uid, group_name, description, created_by) "
        "VALUES (%s, %s, %s, %s)",
        (group_uid, body.group_name.strip(), body.description.strip(), g.current_user["user_id"]),
    )
    db.execute(
        "INSERT INTO group_members (group_id, user_uid, role) VALUES (%s, %s, 'admin')",
        (group_id, g.current_user["uid"]),
    )
    return (
        jsonify(
            {
                "success": True,
                "group_uid": group_uid,
                "group_name": body.group_name.strip(),
            }
        ),
        201,
    )


@groups_bp.post("/join")
@require_auth
def join_group() -> tuple[Response, int]:
    try:
        body = JoinGroupRequest.model_validate(request.get_json(silent=True) or {})
    except ValidationError as exc:
        return jsonify({"error": exc.errors()[0]["msg"]}), 400

    db = _db()
    group, role = _get_group_and_role(db, body.group_uid, g.current_user["uid"])
    if group is None:
        return jsonify({"error": "Group not found"}), 404
    if role is not None:
        return jsonify({"success": True, "group_name": group["group_name"]}), 200

    db.execute(
        "INSERT INTO group_members (group_id, user_uid, role) VALUES (%s, %s, 'member')",
        (group["id"], g.current_user["uid"]),
    )
    return jsonify({"success": True, "group_name": group["group_name"]}), 200


@groups_bp.get("/<group_uid>")
@require_auth
def get_group_details(group_uid: str) -> tuple[Response, int]:
    db = _db()
    group, role = _get_group_and_role(db, group_uid, g.current_user["uid"])
    if group is None:
        return jsonify({"error": "Group not found"}), 404
    if role is None:
        return jsonify({"error": "Forbidden"}), 403

    members = db.fetch_all(
        """
        SELECT gm.user_uid, gm.role, gm.joined_at, u.full_name
        FROM group_members gm
        LEFT JOIN users u ON gm.user_uid = u.uid
        WHERE gm.group_id = %s
        ORDER BY gm.role ASC, gm.joined_at ASC
        """,
        (group["id"],),
    )
    return jsonify({"success": True, "group": group, "members": members}), 200


@groups_bp.patch("/<group_uid>")
@require_auth
def update_group(group_uid: str) -> tuple[Response, int]:
    payload = request.get_json(silent=True) or {}
    payload["group_uid"] = group_uid
    try:
        body = UpdateGroupRequest.model_validate(payload)
    except ValidationError as exc:
        return jsonify({"error": exc.errors()[0]["msg"]}), 400

    db = _db()
    group, role = _get_group_and_role(db, body.group_uid, g.current_user["uid"])
    if group is None:
        return jsonify({"error": "Group not found"}), 404
    if role != "admin":
        return jsonify({"error": "Admin privileges required"}), 403

    db.execute(
        "UPDATE `groups` SET group_name = %s WHERE id = %s",
        (body.group_name.strip(), group["id"]),
    )
    return jsonify({"success": True, "group_name": body.group_name.strip()}), 200


@groups_bp.delete("/<group_uid>")
@require_auth
def delete_group(group_uid: str) -> tuple[Response, int]:
    db = _db()
    group, role = _get_group_and_role(db, group_uid, g.current_user["uid"])
    if group is None:
        return jsonify({"error": "Group not found"}), 404
    if role != "admin":
        return jsonify({"error": "Admin privileges required"}), 403

    db.execute("DELETE FROM group_members WHERE group_id = %s", (group["id"],))
    db.execute("DELETE FROM `groups` WHERE id = %s", (group["id"],))
    return jsonify({"success": True}), 200


@groups_bp.post("/<group_uid>/members")
@require_auth
def add_member(group_uid: str) -> tuple[Response, int]:
    payload = request.get_json(silent=True) or {}
    payload["group_uid"] = group_uid
    try:
        body = GroupMemberRequest.model_validate(payload)
    except ValidationError as exc:
        return jsonify({"error": exc.errors()[0]["msg"]}), 400

    db = _db()
    group, role = _get_group_and_role(db, body.group_uid, g.current_user["uid"])
    if group is None:
        return jsonify({"error": "Group not found"}), 404
    if role != "admin":
        return jsonify({"error": "Admin privileges required"}), 403

    target_user = db.fetch_one("SELECT id FROM users WHERE uid = %s LIMIT 1", (body.user_uid,))
    if target_user is None:
        return jsonify({"error": "Target UID not found"}), 404

    existing = db.fetch_one(
        "SELECT id FROM group_members WHERE group_id = %s AND user_uid = %s LIMIT 1",
        (group["id"], body.user_uid),
    )
    if existing is None:
        db.execute(
            "INSERT INTO group_members (group_id, user_uid, role) VALUES (%s, %s, 'member')",
            (group["id"], body.user_uid),
        )
    return jsonify({"success": True}), 200


@groups_bp.delete("/<group_uid>/members/<user_uid>")
@require_auth
def remove_member(group_uid: str, user_uid: str) -> tuple[Response, int]:
    db = _db()
    group, role = _get_group_and_role(db, group_uid, g.current_user["uid"])
    if group is None:
        return jsonify({"error": "Group not found"}), 404
    if role != "admin" and user_uid != g.current_user["uid"]:
        return jsonify({"error": "Admin privileges required"}), 403

    db.execute(
        "DELETE FROM group_members WHERE group_id = %s AND user_uid = %s",
        (group["id"], user_uid),
    )
    return jsonify({"success": True}), 200
