from __future__ import annotations

import re
from typing import Any

from flask import current_app, request
from flask_socketio import SocketIO, emit, join_room

from app.config import Settings
from app.db import DBBackend
from app.security import ACCESS_COOKIE_NAME, decode_token
from app.store import EphemeralStore

UID_RE = re.compile(r"^\d{10}$")

# Maps local socket SID to its authenticated user context
_sid_sessions: dict[str, dict[str, Any]] = {}


def clear_presence_state() -> None:
    _sid_sessions.clear()


def _store() -> EphemeralStore:
    return current_app.config["STORE"]


def _extract_socket_token(auth_payload: Any) -> str | None:
    cookie_token = request.cookies.get(ACCESS_COOKIE_NAME)
    if cookie_token:
        return cookie_token
    if isinstance(auth_payload, dict) and isinstance(auth_payload.get("token"), str):
        return auth_payload["token"]
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        return auth_header[7:].strip()
    return None


def _current_session() -> dict[str, Any] | None:
    return _sid_sessions.get(request.sid)


def register_signaling_handlers(socketio: SocketIO) -> None:
    @socketio.on("connect")
    def handle_connect(auth: Any = None) -> bool:
        settings: Settings = current_app.config["SETTINGS"]
        db: DBBackend = current_app.config["DB"]
        store = _store()

        token = _extract_socket_token(auth)
        if not token:
            return False

        payload = decode_token(token, "access", settings)
        if payload is None:
            return False

        user_id = int(payload["sub"])
        uid = str(payload["uid"])

        user = db.fetch_one(
            "SELECT id, full_name, uid FROM users WHERE id = %s LIMIT 1",
            (user_id,),
        )
        if user is None:
            return False

        was_offline = not store.is_uid_online(uid)
        _sid_sessions[request.sid] = {
            "user_id": user_id,
            "uid": uid,
            "full_name": user["full_name"],
        }
        store.add_device_sid(uid, request.sid)

        join_room(f"uid:{uid}")

        groups = db.fetch_all(
            """
            SELECT g.group_uid
            FROM `groups` g
            JOIN group_members gm ON g.id = gm.group_id
            WHERE gm.user_uid = %s
            """,
            (uid,),
        )
        for g_row in groups:
            join_room(f"group:{g_row['group_uid']}")

        if was_offline:
            emit(
                "presence:update",
                {"uid": uid, "status": "online"},
                broadcast=True,
                include_self=False,
            )
        return True

    @socketio.on("presence:heartbeat")
    def handle_heartbeat() -> None:
        session = _current_session()
        if session is not None:
            _store().add_device_sid(session["uid"], request.sid)

    @socketio.on("disconnect")
    def handle_disconnect() -> None:
        session = _sid_sessions.pop(request.sid, None)
        if session is None:
            return
        uid = session["uid"]
        remaining = _store().remove_device_sid(uid, request.sid)
        if remaining == 0:
            emit(
                "presence:update",
                {"uid": uid, "status": "offline"},
                broadcast=True,
                include_self=False,
            )

    @socketio.on("call:offer")
    def handle_call_offer(data: dict[str, Any]) -> None:
        session = _current_session()
        if session is None or not isinstance(data, dict):
            return

        caller_uid = session["uid"]
        caller_name = session["full_name"]
        target_uid = str(data.get("target_uid", ""))
        offer = data.get("offer")

        if not UID_RE.match(target_uid) or offer is None:
            emit("call:error", {"message": "Invalid target UID or offer"})
            return

        if target_uid == caller_uid:
            emit("call:error", {"message": "Cannot call yourself"})
            return

        db: DBBackend = current_app.config["DB"]
        store = _store()

        # Check if target is a group
        group = db.fetch_one(
            "SELECT id, group_name FROM `groups` WHERE group_uid = %s LIMIT 1",
            (target_uid,),
        )
        if group is not None:
            member = db.fetch_one(
                "SELECT id FROM group_members WHERE group_id = %s AND user_uid = %s LIMIT 1",
                (group["id"], caller_uid),
            )
            if member is None:
                emit("call:error", {"message": "You are not a member of this group"})
                return
            emit(
                "call:incoming",
                {
                    "from_uid": caller_uid,
                    "caller_name": caller_name,
                    "group_uid": target_uid,
                    "group_name": group["group_name"],
                    "offer": offer,
                },
                to=f"group:{target_uid}",
                skip_sid=request.sid,
            )
            return

        target_user = db.fetch_one(
            "SELECT id, privacy_mode FROM users WHERE uid = %s LIMIT 1",
            (target_uid,),
        )
        if target_user is None:
            emit("call:error", {"message": f"UID {target_uid} not found"})
            return

        blocked = db.fetch_one(
            "SELECT id FROM blocked_users WHERE user_id = %s AND blocked_uid = %s LIMIT 1",
            (target_user["id"], caller_uid),
        )
        if blocked is not None:
            emit("call:error", {"message": "Call declined by recipient"})
            return

        privacy = target_user["privacy_mode"]
        if privacy == "dnd":
            emit("call:error", {"message": "User is in Do Not Disturb mode"})
            return
        if privacy == "contacts_only":
            in_contacts = db.fetch_one(
                "SELECT id FROM contacts WHERE user_id = %s AND contact_uid = %s LIMIT 1",
                (target_user["id"], caller_uid),
            )
            if in_contacts is None:
                emit("call:error", {"message": "User only accepts calls from contacts"})
                return

        if not store.is_uid_online(target_uid):
            emit("call:error", {"message": f"User {target_uid} is offline"})
            return

        store.set_ringing_call(target_uid, caller_uid)
        emit(
            "call:incoming",
            {
                "from_uid": caller_uid,
                "caller_name": caller_name,
                "offer": offer,
            },
            to=f"uid:{target_uid}",
        )

    @socketio.on("call:answer")
    def handle_call_answer(data: dict[str, Any]) -> None:
        session = _current_session()
        if session is None or not isinstance(data, dict):
            return
        target_uid = str(data.get("target_uid", ""))
        answer = data.get("answer")
        if not UID_RE.match(target_uid) or answer is None:
            return

        my_uid = session["uid"]
        _store().clear_ringing_call(my_uid)

        # Cancel ringing on all other logged-in devices of this user
        emit(
            "call:cancelled",
            {"reason": "answered_elsewhere"},
            to=f"uid:{my_uid}",
            skip_sid=request.sid,
        )
        emit(
            "call:answered",
            {"from_uid": my_uid, "answer": answer},
            to=f"uid:{target_uid}",
        )

    @socketio.on("call:ice")
    def handle_call_ice(data: dict[str, Any]) -> None:
        session = _current_session()
        if session is None or not isinstance(data, dict):
            return
        target_uid = str(data.get("target_uid", ""))
        candidate = data.get("candidate")
        if not UID_RE.match(target_uid) or candidate is None:
            return
        emit(
            "call:ice",
            {"from_uid": session["uid"], "candidate": candidate},
            to=f"uid:{target_uid}",
        )

    @socketio.on("call:end")
    def handle_call_end(data: dict[str, Any]) -> None:
        session = _current_session()
        if session is None or not isinstance(data, dict):
            return
        target_uid = str(data.get("target_uid", ""))
        if not UID_RE.match(target_uid):
            return
        _store().clear_ringing_call(target_uid)
        emit("call:ended", {"from_uid": session["uid"]}, to=f"uid:{target_uid}")
        emit(
            "call:cancelled",
            {"reason": "caller_hung_up"},
            to=f"uid:{target_uid}",
        )

    @socketio.on("call:reject")
    def handle_call_reject(data: dict[str, Any]) -> None:
        session = _current_session()
        if session is None or not isinstance(data, dict):
            return
        target_uid = str(data.get("target_uid", ""))
        if not UID_RE.match(target_uid):
            return
        my_uid = session["uid"]
        _store().clear_ringing_call(my_uid)
        emit(
            "call:cancelled",
            {"reason": "rejected_elsewhere"},
            to=f"uid:{my_uid}",
            skip_sid=request.sid,
        )
        emit("call:rejected", {"from_uid": my_uid}, to=f"uid:{target_uid}")

    @socketio.on("group:signal")
    def handle_group_signal(data: dict[str, Any]) -> None:
        session = _current_session()
        if session is None or not isinstance(data, dict):
            return
        group_uid = str(data.get("group_uid", ""))
        if not UID_RE.match(group_uid):
            return

        db: DBBackend = current_app.config["DB"]
        group = db.fetch_one("SELECT id FROM `groups` WHERE group_uid = %s LIMIT 1", (group_uid,))
        if group is None:
            return
        member = db.fetch_one(
            "SELECT id FROM group_members WHERE group_id = %s AND user_uid = %s LIMIT 1",
            (group["id"], session["uid"]),
        )
        if member is None:
            return

        emit(
            "group:signal",
            {
                "from_uid": session["uid"],
                "group_uid": group_uid,
                "payload": data.get("payload"),
            },
            to=f"group:{group_uid}",
            skip_sid=request.sid,
        )

    @socketio.on("chat:send")
    def handle_chat_send(data: dict[str, Any]) -> None:
        session = _current_session()
        if session is None or not isinstance(data, dict):
            return

        sender_uid = session["uid"]
        target_uid = str(data.get("target_uid", ""))
        ciphertext = data.get("ciphertext")
        iv = data.get("iv")
        attachment_id = data.get("attachment_id")
        attachment_meta_ct = data.get("attachment_meta_ct")
        attachment_meta_iv = data.get("attachment_meta_iv")

        if (
            not UID_RE.match(target_uid)
            or not isinstance(ciphertext, str)
            or not ciphertext
            or not isinstance(iv, str)
            or not iv
        ):
            emit("chat:error", {"message": "Invalid encrypted message payload"})
            return

        db: DBBackend = current_app.config["DB"]
        target_user = db.fetch_one(
            "SELECT id FROM users WHERE uid = %s LIMIT 1",
            (target_uid,),
        )
        if target_user is None:
            emit("chat:error", {"message": "Recipient not found"})
            return

        blocked = db.fetch_one(
            "SELECT id FROM blocked_users WHERE user_id = %s AND blocked_uid = %s LIMIT 1",
            (target_user["id"], sender_uid),
        )
        if blocked is not None:
            emit("chat:error", {"message": "Recipient has blocked messages from you"})
            return

        low, high = sorted((sender_uid, target_uid))
        conv_id = f"{low}:{high}"

        msg_id = db.execute(
            """
            INSERT INTO messages (
                conversation_id, sender_uid, recipient_uid, ciphertext, iv,
                attachment_id, attachment_meta_ct, attachment_meta_iv, is_read
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 0)
            """,
            (
                conv_id,
                sender_uid,
                target_uid,
                ciphertext,
                iv,
                attachment_id,
                attachment_meta_ct,
                attachment_meta_iv,
            ),
        )
        saved = db.fetch_one(
            """
            SELECT id, conversation_id, sender_uid, recipient_uid, ciphertext, iv,
                   attachment_id, attachment_meta_ct, attachment_meta_iv, is_read, created_at
            FROM messages
            WHERE id = %s
            LIMIT 1
            """,
            (msg_id,),
        )
        if saved is None:
            return

        emit("chat:message", saved, to=f"uid:{target_uid}")
        emit("chat:ack", saved)

    @socketio.on("chat:typing")
    def handle_chat_typing(data: dict[str, Any]) -> None:
        session = _current_session()
        if session is None or not isinstance(data, dict):
            return
        target_uid = str(data.get("target_uid", ""))
        if not UID_RE.match(target_uid):
            return
        emit(
            "chat:typing",
            {"from_uid": session["uid"], "is_typing": bool(data.get("is_typing", False))},
            to=f"uid:{target_uid}",
        )

    @socketio.on("chat:read")
    def handle_chat_read(data: dict[str, Any]) -> None:
        session = _current_session()
        if session is None or not isinstance(data, dict):
            return
        sender_uid = str(data.get("sender_uid", ""))
        if not UID_RE.match(sender_uid):
            return
        my_uid = session["uid"]
        current_app.config["DB"].execute(
            "UPDATE messages SET is_read = 1 "
            "WHERE recipient_uid = %s AND sender_uid = %s AND is_read = 0",
            (my_uid, sender_uid),
        )
        emit("chat:read", {"by_uid": my_uid}, to=f"uid:{sender_uid}")
