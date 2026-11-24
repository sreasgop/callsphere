import os
import json
import asyncio
import secrets
import hashlib
from typing import Dict, List, Optional
from datetime import datetime, timedelta

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Depends, status, Query, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, FileResponse
from pydantic import BaseModel, EmailStr

import db

# Initialize Database
db.init_db()

app = FastAPI(
    title="CallSphere VoIP Server",
    description="Real-time WebRTC Signaling Server & REST API for CallSphere Internet Phone System",
    version="2.0.0"
)

# CORS Setup - Allows access from any LAN IP or domain
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Password Hashing Helper
def hash_password(password: str) -> str:
    try:
        import bcrypt
        return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    except Exception:
        pass
    salt = "callsphere_secure_salt_2026"
    return hashlib.sha256((password + salt).encode('utf-8')).hexdigest()

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        import bcrypt
        if hashed_password.startswith("$2"):
            return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
    except Exception:
        pass
    try:
        from passlib.context import CryptContext
        pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
        if pwd_context.verify(plain_password, hashed_password):
            return True
    except Exception:
        pass
    salt = "callsphere_secure_salt_2026"
    expected = hashlib.sha256((plain_password + salt).encode('utf-8')).hexdigest()
    return expected == hashed_password or plain_password == hashed_password

# JWT Token Helper
JWT_SECRET = os.getenv("JWT_SECRET", "callsphere_super_secret_jwt_key_2026")

def create_token(data: dict) -> str:
    import base64
    payload = json.dumps({**data, "exp": (datetime.utcnow() + timedelta(days=7)).timestamp()})
    token_str = base64.urlsafe_b64encode(payload.encode()).decode()
    signature = hashlib.sha256((token_str + JWT_SECRET).encode()).hexdigest()[:16]
    return f"{token_str}.{signature}"

# --- WEBRTC SIGNALING & PRESENCE MANAGER ---
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}

    async def connect(self, uid: str, websocket: WebSocket):
        await websocket.accept()
        self.active_connections[uid] = websocket
        print(f"[WebSocket] User {uid} connected. Active online users: {list(self.active_connections.keys())}")
        await self.broadcast_presence(uid, is_online=True)

    def disconnect(self, uid: str):
        if uid in self.active_connections:
            del self.active_connections[uid]
            print(f"[WebSocket] User {uid} disconnected.")

    async def send_to_uid(self, uid: str, message: dict) -> bool:
        if uid in self.active_connections:
            await self.active_connections[uid].send_json(message)
            return True
        return False

    async def broadcast_presence(self, uid: str, is_online: bool):
        payload = {
            "type": "presence-update",
            "uid": uid,
            "status": "online" if is_online else "offline"
        }
        for user_uid, ws in list(self.active_connections.items()):
            if user_uid != uid:
                try:
                    await ws.send_json(payload)
                except Exception:
                    pass

manager = ConnectionManager()

# --- PYDANTIC SCHEMAS ---
class UserRegister(BaseModel):
    full_name: str
    email: str
    password: str

class UserLogin(BaseModel):
    email: str
    password: str

class AddContactRequest(BaseModel):
    user_id: int
    target_uid: str
    nickname: Optional[str] = None

class CreateGroupRequest(BaseModel):
    user_id: int
    group_name: str
    description: Optional[str] = ""

class JoinGroupRequest(BaseModel):
    user_uid: str
    group_uid: str

class UpdateGroupRequest(BaseModel):
    group_uid: str
    group_name: str

class GroupMemberRequest(BaseModel):
    group_uid: str
    user_uid: str

class LogCallRequest(BaseModel):
    caller_uid: str
    callee_uid: str
    status: str
    duration: int = 0

class UpdateSettingsRequest(BaseModel):
    user_id: int
    status_message: Optional[str] = "Available"
    privacy_mode: Optional[str] = "everyone"

class SendMessageRequest(BaseModel):
    sender_uid: str
    receiver_uid: str
    text: str

# --- REST API ROUTES ---

@app.get("/api/health")
def health_check():
    return {"status": "online", "app": "CallSphere VoIP Server", "version": "2.0.0"}

@app.post("/api/register")
def register(user: UserRegister):
    conn = db.get_db_connection()
    cursor = conn.cursor()

    try:
        if db.DB_TYPE == "sqlite":
            cursor.execute("SELECT id FROM users WHERE email = ?", (user.email,))
        else:
            cursor.execute("SELECT id FROM users WHERE email = %s", (user.email,))
        
        if cursor.fetchone():
            raise HTTPException(status_code=400, detail="Email is already registered")

        sip_uid = db.generate_10digit_uid()
        hashed_pwd = hash_password(user.password)

        if db.DB_TYPE == "sqlite":
            cursor.execute(
                "INSERT INTO users (full_name, email, password_hash, sip_uid) VALUES (?, ?, ?, ?)",
                (user.full_name, user.email, hashed_pwd, sip_uid)
            )
        else:
            cursor.execute(
                "INSERT INTO users (full_name, email, password_hash, sip_uid) VALUES (%s, %s, %s, %s)",
                (user.full_name, user.email, hashed_pwd, sip_uid)
            )
        conn.commit()

        return {
            "success": True,
            "message": "User registered successfully",
            "uid": sip_uid,
            "full_name": user.full_name,
            "email": user.email
        }
    finally:
        cursor.close()
        conn.close()

@app.post("/api/login")
def login(user: UserLogin):
    conn = db.get_db_connection()
    cursor = conn.cursor()

    try:
        if db.DB_TYPE == "sqlite":
            cursor.execute(
                "SELECT id, full_name, email, password_hash, sip_uid, avatar_color, status_message, privacy_mode FROM users WHERE email = ?",
                (user.email,)
            )
            row = cursor.fetchone()
            user_dict = dict(row) if row else None
        else:
            cursor.execute(
                "SELECT id, full_name, email, password_hash, sip_uid, avatar_color, status_message, privacy_mode FROM users WHERE email = %s",
                (user.email,)
            )
            user_dict = cursor.fetchone()

        if not user_dict or not verify_password(user.password, user_dict['password_hash']):
            raise HTTPException(status_code=401, detail="Invalid email or password")

        del user_dict['password_hash']
        token = create_token({"user_id": user_dict['id'], "uid": user_dict['sip_uid']})

        return {
            "success": True,
            "token": token,
            "user": user_dict,
            "online_users": list(manager.active_connections.keys())
        }
    finally:
        cursor.close()
        conn.close()

@app.get("/api/users/online")
def get_online_users():
    return {"online_uids": list(manager.active_connections.keys())}

@app.get("/api/users/all")
def get_all_users():
    conn = db.get_db_connection()
    cursor = conn.cursor()
    try:
        query = "SELECT id, full_name, email, sip_uid, avatar_color, status_message FROM users"
        cursor.execute(query)
        rows = cursor.fetchall()
        users = [dict(r) for r in rows] if db.DB_TYPE == "sqlite" else rows
        online_uids = set(manager.active_connections.keys())
        for u in users:
            u['is_online'] = str(u['sip_uid']) in online_uids
        return users
    except Exception as e:
        print("Error getting all users:", e)
        return []
    finally:
        conn.close()

@app.post("/api/contacts/add")
def add_contact(req: AddContactRequest):
    conn = db.get_db_connection()
    cursor = conn.cursor()

    try:
        # Resolve req.user_id to integer user id if sip_uid was provided
        user_id = req.user_id
        if str(user_id).isdigit():
            cursor.execute("SELECT id FROM users WHERE id = ? OR sip_uid = ?", (int(user_id), str(user_id)))
            u_row = cursor.fetchone()
            if u_row:
                user_id = dict(u_row)['id'] if db.DB_TYPE == "sqlite" else u_row[0]

        query_user = "SELECT id, full_name FROM users WHERE sip_uid = ?" if db.DB_TYPE == "sqlite" else "SELECT id, full_name FROM users WHERE sip_uid = %s"
        cursor.execute(query_user, (req.target_uid,))
        target = cursor.fetchone()

        if not target:
            raise HTTPException(status_code=404, detail="Target 10-digit UID not found")
        
        target_dict = dict(target) if db.DB_TYPE == "sqlite" else target
        if target_dict['id'] == user_id:
            raise HTTPException(status_code=400, detail="Cannot add yourself as a contact")

        final_name = req.nickname.strip() if req.nickname and req.nickname.strip() else target_dict['full_name']

        # Check if already in contacts, update if so
        cursor.execute("SELECT id FROM contacts WHERE user_id = ? AND contact_uid = ?", (user_id, req.target_uid))
        existing = cursor.fetchone()
        if existing:
            cursor.execute("UPDATE contacts SET contact_name = ? WHERE user_id = ? AND contact_uid = ?", (final_name, user_id, req.target_uid))
        else:
            query_ins = "INSERT INTO contacts (user_id, contact_uid, contact_name) VALUES (?, ?, ?)" if db.DB_TYPE == "sqlite" else "INSERT INTO contacts (user_id, contact_uid, contact_name) VALUES (%s, %s, %s)"
            cursor.execute(query_ins, (user_id, req.target_uid, final_name))
        conn.commit()

        return {"success": True, "contact": {"contact_uid": req.target_uid, "contact_name": final_name}}
    finally:
        cursor.close()
        conn.close()

@app.get("/api/contacts/{user_id_or_uid}")
def get_contacts(user_id_or_uid: str):
    conn = db.get_db_connection()
    cursor = conn.cursor()

    try:
        actual_user_id = None
        if user_id_or_uid.isdigit():
            val = int(user_id_or_uid)
            cursor.execute("SELECT id FROM users WHERE id = ? OR sip_uid = ?", (val, str(val)))
            row = cursor.fetchone()
            if row:
                actual_user_id = dict(row)['id'] if db.DB_TYPE == "sqlite" else row[0]
            else:
                actual_user_id = val
        else:
            cursor.execute("SELECT id FROM users WHERE sip_uid = ?", (user_id_or_uid,))
            row = cursor.fetchone()
            if row:
                actual_user_id = dict(row)['id'] if db.DB_TYPE == "sqlite" else row[0]
            else:
                return []

        query = "SELECT id, contact_uid, contact_name, is_favorite FROM contacts WHERE user_id = ? ORDER BY is_favorite DESC, contact_name ASC" if db.DB_TYPE == "sqlite" else "SELECT id, contact_uid, contact_name, is_favorite FROM contacts WHERE user_id = %s ORDER BY is_favorite DESC, contact_name ASC"
        cursor.execute(query, (actual_user_id,))
        rows = cursor.fetchall()
        
        contacts = [dict(r) for r in rows] if db.DB_TYPE == "sqlite" else rows
        for c in contacts:
            c['is_online'] = c['contact_uid'] in manager.active_connections

        return contacts
    finally:
        cursor.close()
        conn.close()

@app.post("/api/calls/log")
def log_call(req: LogCallRequest):
    conn = db.get_db_connection()
    cursor = conn.cursor()

    try:
        now_utc = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        query = "INSERT INTO call_logs (caller_uid, callee_uid, status, duration, start_time) VALUES (?, ?, ?, ?, ?)" if db.DB_TYPE == "sqlite" else "INSERT INTO call_logs (caller_uid, callee_uid, status, duration, start_time) VALUES (%s, %s, %s, %s, %s)"
        cursor.execute(query, (req.caller_uid, req.callee_uid, req.status, req.duration, now_utc))
        conn.commit()
        return {"success": True}
    finally:
        cursor.close()
        conn.close()

@app.get("/api/calls/history/{uid}")
def get_call_history(uid: str):
    conn = db.get_db_connection()
    cursor = conn.cursor()

    try:
        query = """
            SELECT caller_uid, callee_uid, start_time, duration, status,
            CASE WHEN caller_uid = ? THEN 'outbound' ELSE 'inbound' END as direction
            FROM call_logs
            WHERE caller_uid = ? OR callee_uid = ?
            ORDER BY start_time DESC LIMIT 50
        """ if db.DB_TYPE == "sqlite" else """
            SELECT caller_uid, callee_uid, start_time, duration, status,
            CASE WHEN caller_uid = %s THEN 'outbound' ELSE 'inbound' END as direction
            FROM call_logs
            WHERE caller_uid = %s OR callee_uid = %s
            ORDER BY start_time DESC LIMIT 50
        """
        cursor.execute(query, (uid, uid, uid))
        rows = cursor.fetchall()
        logs = [dict(r) for r in rows] if db.DB_TYPE == "sqlite" else rows
        return logs
    finally:
        cursor.close()
        conn.close()

@app.post("/api/groups/create")
def create_group(req: CreateGroupRequest):
    conn = db.get_db_connection()
    cursor = conn.cursor()

    try:
        group_uid = db.generate_group_uid()
        query_g = "INSERT INTO groups (group_uid, group_name, description, created_by) VALUES (?, ?, ?, ?)" if db.DB_TYPE == "sqlite" else "INSERT INTO groups (group_uid, group_name, description, created_by) VALUES (%s, %s, %s, %s)"
        cursor.execute(query_g, (group_uid, req.group_name, req.description, req.user_id))
        group_id = cursor.lastrowid

        q_u = "SELECT sip_uid FROM users WHERE id = ?" if db.DB_TYPE == "sqlite" else "SELECT sip_uid FROM users WHERE id = %s"
        cursor.execute(q_u, (req.user_id,))
        user = cursor.fetchone()
        user_dict = dict(user) if db.DB_TYPE == "sqlite" else user

        q_gm = "INSERT INTO group_members (group_id, user_uid, role) VALUES (?, ?, 'admin')" if db.DB_TYPE == "sqlite" else "INSERT INTO group_members (group_id, user_uid, role) VALUES (%s, %s, 'admin')"
        cursor.execute(q_gm, (group_id, user_dict['sip_uid']))
        
        conn.commit()
        return {"success": True, "group_uid": group_uid, "group_name": req.group_name}
    finally:
        cursor.close()
        conn.close()

@app.post("/api/groups/join")
def join_group(req: JoinGroupRequest):
    conn = db.get_db_connection()
    cursor = conn.cursor()
    try:
        q_g = "SELECT id, group_name FROM groups WHERE group_uid = ?" if db.DB_TYPE == "sqlite" else "SELECT id, group_name FROM groups WHERE group_uid = %s"
        cursor.execute(q_g, (req.group_uid,))
        group = cursor.fetchone()
        if not group:
            raise HTTPException(status_code=404, detail="Group not found")
        group_dict = dict(group) if db.DB_TYPE == "sqlite" else group
        group_id = group_dict['id']

        q_m = "SELECT id FROM group_members WHERE group_id = ? AND user_uid = ?" if db.DB_TYPE == "sqlite" else "SELECT id FROM group_members WHERE group_id = %s AND user_uid = %s"
        cursor.execute(q_m, (group_id, req.user_uid))
        if cursor.fetchone():
            return {"success": True, "message": "Already a member"}

        q_ins = "INSERT INTO group_members (group_id, user_uid, role) VALUES (?, ?, 'member')" if db.DB_TYPE == "sqlite" else "INSERT INTO group_members (group_id, user_uid, role) VALUES (%s, %s, 'member')"
        cursor.execute(q_ins, (group_id, req.user_uid))
        conn.commit()
        return {"success": True, "group_name": group_dict['group_name']}
    finally:
        cursor.close()
        conn.close()

@app.get("/api/groups/details/{group_uid}")
def get_group_details(group_uid: str):
    conn = db.get_db_connection()
    cursor = conn.cursor()
    try:
        q_g = "SELECT id, group_uid, group_name, description, created_by, created_at FROM groups WHERE group_uid = ?" if db.DB_TYPE == "sqlite" else "SELECT id, group_uid, group_name, description, created_by, created_at FROM groups WHERE group_uid = %s"
        cursor.execute(q_g, (group_uid,))
        group = cursor.fetchone()
        if not group:
            raise HTTPException(status_code=404, detail="Group not found")
        group_dict = dict(group) if db.DB_TYPE == "sqlite" else group

        q_m = """
            SELECT gm.user_uid, gm.role, gm.joined_at, u.full_name
            FROM group_members gm
            LEFT JOIN users u ON gm.user_uid = u.sip_uid
            WHERE gm.group_id = ?
            ORDER BY gm.role ASC, gm.joined_at ASC
        """ if db.DB_TYPE == "sqlite" else """
            SELECT gm.user_uid, gm.role, gm.joined_at, u.full_name
            FROM group_members gm
            LEFT JOIN users u ON gm.user_uid = u.sip_uid
            WHERE gm.group_id = %s
            ORDER BY gm.role ASC, gm.joined_at ASC
        """
        cursor.execute(q_m, (group_dict['id'],))
        members = cursor.fetchall()
        member_list = [dict(m) for m in members] if db.DB_TYPE == "sqlite" else members

        return {
            "success": True,
            "group": group_dict,
            "members": member_list
        }
    finally:
        cursor.close()
        conn.close()

@app.post("/api/groups/update")
def update_group(req: UpdateGroupRequest):
    conn = db.get_db_connection()
    cursor = conn.cursor()
    try:
        q = "UPDATE groups SET group_name = ? WHERE group_uid = ?" if db.DB_TYPE == "sqlite" else "UPDATE groups SET group_name = %s WHERE group_uid = %s"
        cursor.execute(q, (req.group_name, req.group_uid))
        conn.commit()
        return {"success": True}
    finally:
        cursor.close()
        conn.close()

@app.delete("/api/groups/{group_uid}")
def delete_group(group_uid: str):
    conn = db.get_db_connection()
    cursor = conn.cursor()
    try:
        q_g = "SELECT id FROM groups WHERE group_uid = ?" if db.DB_TYPE == "sqlite" else "SELECT id FROM groups WHERE group_uid = %s"
        cursor.execute(q_g, (group_uid,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Group not found")
        group_id = row[0] if isinstance(row, tuple) else row['id']

        q_del_m = "DELETE FROM group_members WHERE group_id = ?" if db.DB_TYPE == "sqlite" else "DELETE FROM group_members WHERE group_id = %s"
        cursor.execute(q_del_m, (group_id,))

        q_del_g = "DELETE FROM groups WHERE id = ?" if db.DB_TYPE == "sqlite" else "DELETE FROM groups WHERE id = %s"
        cursor.execute(q_del_g, (group_id,))
        conn.commit()
        return {"success": True}
    finally:
        cursor.close()
        conn.close()

@app.post("/api/groups/members/add")
def add_group_member(req: GroupMemberRequest):
    conn = db.get_db_connection()
    cursor = conn.cursor()
    try:
        q_g = "SELECT id FROM groups WHERE group_uid = ?" if db.DB_TYPE == "sqlite" else "SELECT id FROM groups WHERE group_uid = %s"
        cursor.execute(q_g, (req.group_uid,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Group not found")
        group_id = row[0] if isinstance(row, tuple) else row['id']

        q_m = "SELECT id FROM group_members WHERE group_id = ? AND user_uid = ?" if db.DB_TYPE == "sqlite" else "SELECT id FROM group_members WHERE group_id = %s AND user_uid = %s"
        cursor.execute(q_m, (group_id, req.user_uid))
        if cursor.fetchone():
            return {"success": True, "message": "Already member"}

        q_ins = "INSERT INTO group_members (group_id, user_uid, role) VALUES (?, ?, 'member')" if db.DB_TYPE == "sqlite" else "INSERT INTO group_members (group_id, user_uid, role) VALUES (%s, %s, 'member')"
        cursor.execute(q_ins, (group_id, req.user_uid))
        conn.commit()
        return {"success": True}
    finally:
        cursor.close()
        conn.close()

@app.post("/api/groups/members/remove")
def remove_group_member(req: GroupMemberRequest):
    conn = db.get_db_connection()
    cursor = conn.cursor()
    try:
        q_g = "SELECT id FROM groups WHERE group_uid = ?" if db.DB_TYPE == "sqlite" else "SELECT id FROM groups WHERE group_uid = %s"
        cursor.execute(q_g, (req.group_uid,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Group not found")
        group_id = row[0] if isinstance(row, tuple) else row['id']

        q_del = "DELETE FROM group_members WHERE group_id = ? AND user_uid = ?" if db.DB_TYPE == "sqlite" else "DELETE FROM group_members WHERE group_id = %s AND user_uid = %s"
        cursor.execute(q_del, (group_id, req.user_uid))
        conn.commit()
        return {"success": True}
    finally:
        cursor.close()
        conn.close()

@app.get("/api/groups/{uid}")
def get_user_groups(uid: str):
    conn = db.get_db_connection()
    cursor = conn.cursor()

    try:
        query = """
            SELECT g.group_uid, g.group_name, g.description, gm.role
            FROM groups g
            JOIN group_members gm ON g.id = gm.group_id
            WHERE gm.user_uid = ?
        """ if db.DB_TYPE == "sqlite" else """
            SELECT g.group_uid, g.group_name, g.description, gm.role
            FROM groups g
            JOIN group_members gm ON g.id = gm.group_id
            WHERE gm.user_uid = %s
        """
        cursor.execute(query, (uid,))
        rows = cursor.fetchall()
        return [dict(r) for r in rows] if db.DB_TYPE == "sqlite" else rows
    finally:
        cursor.close()
        conn.close()

@app.post("/api/settings/update")
def update_settings(req: UpdateSettingsRequest):
    conn = db.get_db_connection()
    cursor = conn.cursor()

    try:
        query = "UPDATE users SET status_message = ?, privacy_mode = ? WHERE id = ?" if db.DB_TYPE == "sqlite" else "UPDATE users SET status_message = %s, privacy_mode = %s WHERE id = %s"
        cursor.execute(query, (req.status_message, req.privacy_mode, req.user_id))
        conn.commit()
        return {"success": True}
    finally:
        cursor.close()
        conn.close()

# --- MESSAGING ENDPOINTS ---

@app.post("/api/messages/send")
async def api_send_message(req: SendMessageRequest):
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")
    msg = db.save_message(req.sender_uid, req.receiver_uid, req.text.strip())
    await manager.send_to_uid(req.receiver_uid, {
        "type": "chat-message",
        "from": req.sender_uid,
        "text": req.text.strip(),
        "created_at": msg.get("created_at")
    })
    return {"success": True, "message": msg}

@app.get("/api/messages/history/{my_uid}/{target_uid}")
def api_get_messages(my_uid: str, target_uid: str):
    messages = db.get_messages_between(my_uid, target_uid)
    return {"messages": messages}

@app.get("/api/messages/conversations/{my_uid}")
def api_get_conversations(my_uid: str):
    conversations = db.get_recent_conversations(my_uid)
    return {"conversations": conversations}

class MarkReadRequest(BaseModel):
    my_uid: str
    sender_uid: str

@app.post("/api/messages/read")
def api_mark_read(req: MarkReadRequest):
    db.mark_messages_read(req.my_uid, req.sender_uid)
    return {"success": True}

# --- WEBSOCKET REAL-TIME SIGNALING ROUTE ---

@app.websocket("/ws/{uid}")
async def websocket_endpoint(websocket: WebSocket, uid: str):
    await manager.connect(uid, websocket)
    try:
        while True:
            data = await websocket.receive_json()
            event_type = data.get("type")
            target_uid = data.get("targetUid")

            if event_type == "make-offer":
                offer = data.get("offer")
                caller_name = data.get("callerName", "Caller")
                delivered = await manager.send_to_uid(target_uid, {
                    "type": "incoming-call",
                    "offer": offer,
                    "from": uid,
                    "callerName": caller_name
                })
                if not delivered:
                    await websocket.send_json({
                        "type": "call-error",
                        "message": f"User {target_uid} is offline"
                    })

            elif event_type == "make-answer":
                answer = data.get("answer")
                await manager.send_to_uid(target_uid, {
                    "type": "call-answered",
                    "answer": answer,
                    "from": uid
                })

            elif event_type == "send-ice":
                candidate = data.get("candidate")
                await manager.send_to_uid(target_uid, {
                    "type": "remote-ice-candidate",
                    "candidate": candidate,
                    "from": uid
                })

            elif event_type == "end-call":
                await manager.send_to_uid(target_uid, {
                    "type": "call-ended",
                    "from": uid
                })

            elif event_type == "reject-call":
                await manager.send_to_uid(target_uid, {
                    "type": "call-rejected",
                    "from": uid
                })

            elif event_type == "chat-message":
                target_uid = data.get("targetUid")
                text = data.get("text", "").strip()
                if target_uid and text:
                    saved_msg = db.save_message(uid, target_uid, text)
                    # Send to target user if online
                    await manager.send_to_uid(target_uid, {
                        "type": "chat-message",
                        "from": uid,
                        "text": text,
                        "created_at": saved_msg.get("created_at")
                    })
                    # Confirm back to sender
                    await websocket.send_json({
                        "type": "chat-message-ack",
                        "message": saved_msg
                    })

            elif event_type == "typing":
                target_uid = data.get("targetUid")
                is_typing = data.get("isTyping", False)
                if target_uid:
                    await manager.send_to_uid(target_uid, {
                        "type": "typing",
                        "from": uid,
                        "isTyping": is_typing
                    })

            elif event_type == "group-signal":
                group_uid = data.get("groupUid")
                payload = data.get("payload")
                for u_uid, ws in list(manager.active_connections.items()):
                    if u_uid != uid:
                        await ws.send_json({
                            "type": "group-signal",
                            "from": uid,
                            "groupUid": group_uid,
                            "payload": payload
                        })

    except WebSocketDisconnect:
        manager.disconnect(uid)
        await manager.broadcast_presence(uid, is_online=False)
    except Exception as e:
        print(f"[WebSocket Error] {e}")
        manager.disconnect(uid)
        await manager.broadcast_presence(uid, is_online=False)

# Serve React SPA production build
react_dist_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend_dist"))

@app.get("/{full_path:path}")
def serve_react_app(full_path: str):
    # Ignore API or WebSocket routes
    if full_path.startswith("api/") or full_path.startswith("ws/"):
        raise HTTPException(status_code=404, detail="API route not found")
    
    # Serve requested static asset if it exists in react_dist_path
    if full_path:
        requested_file = os.path.join(react_dist_path, full_path)
        if os.path.isfile(requested_file):
            return FileResponse(requested_file, headers={"Cache-Control": "no-cache, no-store, must-revalidate"})
    
    # Catch-all: Return React SPA index.html with no-cache headers
    index_file = os.path.join(react_dist_path, "index.html")
    if os.path.exists(index_file):
        return FileResponse(index_file, headers={"Cache-Control": "no-cache, no-store, must-revalidate"})
    return {"message": "CallSphere React Build not found"}

if __name__ == "__main__":
    import uvicorn
    
    cert_path = os.path.join(os.path.dirname(__file__), "cert.pem")
    key_path = os.path.join(os.path.dirname(__file__), "key.pem")
    
    # Enable SSL only if requested via USE_SSL=true (defaulting to HTTP for seamless local testing without cert errors)
    use_ssl = os.getenv("USE_SSL", "false").lower() in ("true", "1", "yes") and os.path.exists(cert_path) and os.path.exists(key_path)
    protocol = "https" if use_ssl else "http"
    
    print("-------------------------------------------------------")
    print(f" CALLSPHERE WEBRTC SERVER RUNNING ON {protocol.upper()} PORT 5000")
    print(f" Web App: {protocol}://localhost:5000/app")
    print(f" API Docs: {protocol}://localhost:5000/docs")
    if use_ssl:
        print(" [SSL ENABLED] Mobile Chrome/Safari support activated!")
    else:
        print(" [HTTP MODE] Localhost Secure Context active (no SSL warnings)")
    print("-------------------------------------------------------")
    
    if use_ssl:
        uvicorn.run("app:app", host="0.0.0.0", port=5000, ssl_keyfile=key_path, ssl_certfile=cert_path, reload=True)
    else:
        uvicorn.run("app:app", host="0.0.0.0", port=5000, reload=True)