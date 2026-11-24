# 📞 CallSphere — SIM-Free Web-Based VoIP Network
> **College Final Year Major Project** | Internet Telephony Platform with 10-Digit UID Routing & WebRTC Calling

CallSphere is a modern, SIM-free Web-based VoIP (Voice over IP) application. Users register with an email address to automatically receive a **unique 10-digit Virtual Phone Number (UID)** (e.g. `4839201745`). People can dial any 10-digit UID to establish encrypted, real-time peer-to-peer audio and video calls over the internet.

---

## 🌟 Key Features

- 📱 **10-Digit Virtual Phone Numbers**: Automatic generation and assignment of unique 10-digit UIDs upon user sign-up.
- 🎙️ **Real-Time WebRTC Calling**: Encrypted Peer-to-Peer (P2P) audio/video communication with STUN NAT traversal support (`stun:stun.l.google.com:19302`).
- 🔐 **Secure Password Hashing & Auth**: Salted password hashing via `passlib[bcrypt]` and JSON Web Token (JWT) authorization.
- ⚡ **FastAPI & Async WebSockets Backend**: High-performance Python backend with native WebSocket signaling and auto-generated Swagger UI (`/docs`).
- 📖 **Contacts Book**: Save contacts with custom nicknames, view real-time online/offline presence status.
- 🕒 **Call History & Recents**: Track inbound, outbound, missed, and rejected calls with exact timestamps and durations.
- 👥 **Group Conference Rooms**: Create group rooms (starting with 9-digit UIDs) with admin permissions, contact inviting, and group management.
- 🎛️ **Control Center**: Privacy controls (Everyone, Contacts Only, Do Not Disturb), audio mixer controls, and security credentials update.
- 💾 **Dual-Database Layer**: Zero-config **SQLite** database out-of-the-box (creates `callsphere.db` automatically) + full **MySQL** schema support (`voip_app_new.sql`).

---

## 🛠️ Tech Stack

- **Backend**: Python 3.10+, FastAPI, Uvicorn, Native WebSockets, Pydantic
- **Security**: `passlib[bcrypt]`, `pyjwt`, SHA-256 fallback
- **Frontend**: HTML5, Vanilla JavaScript (ES6+), Glassmorphic CSS3, Bootstrap 5, SweetAlert2
- **VoIP Engine**: HTML5 WebRTC API (`RTCPeerConnection`, STUN ICE candidate gathering, getUserMedia)
- **Database**: SQLite3 (default zero-config) / MySQL

---

## 🏗️ Architecture & WebRTC Signaling Flow

```mermaid
sequenceDiagram
    autonumber
    participant ClientA as Caller (User A)
    participant Server as FastAPI Server (WebSockets)
    participant ClientB as Callee (User B)
    
    Note over ClientA,ClientB: 1. Presence & Registration
    ClientA->>Server: WebSocket Connect /ws/4839201745
    ClientB->>Server: WebSocket Connect /ws/9182736450

    Note over ClientA,ClientB: 2. WebRTC Call Handshake
    ClientA->>Server: Send 'make-offer' (Target: 9182736450, SDP Offer)
    Server->>ClientB: Relay 'incoming-call' (Caller: 4839201745, SDP Offer)
    ClientB->>Server: Send 'make-answer' (Target: 4839201745, SDP Answer)
    Server->>ClientA: Relay 'call-answered' (SDP Answer)

    Note over ClientA,ClientB: 3. ICE Candidate Exchange & P2P Stream
    ClientA->>Server: Send ICE Candidate
    Server->>ClientB: Relay ICE Candidate
    ClientB->>Server: Send ICE Candidate
    Server->>ClientA: Relay ICE Candidate
    
    Note over ClientA,ClientB: Direct DTLS-SRTP Media Stream (Audio/Video)
    ClientA<--P2P Direct Stream-->ClientB
```

---

## 🚀 Quick Start Guide (Local Setup)

### 1. Prerequisites
- **Python**: Version `3.10` or higher
- **Web Browser**: Chrome, Firefox, Edge, or Brave (Microphone/Camera access enabled)

### 2. Installation Steps

1. **Navigate to the Project Backend Directory**:
   ```bash
   cd callsphere/backend
   ```

2. **Create and Activate Virtual Environment**:
   - **Linux / macOS**:
     ```bash
     python3 -m venv .venv
     source .venv/bin/activate
     ```
   - **Windows (Command Prompt / PowerShell)**:
     ```cmd
     python -m venv .venv
     .venv\Scripts\activate
     ```

3. **Install Dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

4. **Launch the FastAPI Backend Server**:
   ```bash
   python3 app.py
   ```
   *Alternative launch via Uvicorn*:
   ```bash
   uvicorn app:app --host 0.0.0.0 --port 5000 --reload
   ```

5. **Open the Application**:
   Open your browser and navigate to:
   - **Web Application**: [http://localhost:5000/app](http://localhost:5000/app) or [http://localhost:5000](http://localhost:5000)
   - **Interactive API Documentation (Swagger)**: [http://localhost:5000/docs](http://localhost:5000/docs)

---

## 🧪 Testing 1-on-1 Internet Calls

1. Open **Tab 1** (or Browser 1): Go to `http://localhost:5000/app`.
   - Click **"New User? Get a UID"**.
   - Register User 1 (e.g. `Alice`, `alice@example.com`).
   - Copy the assigned **10-digit UID** (e.g. `4839201745`).

2. Open **Tab 2** (or Incognito / Browser 2): Go to `http://localhost:5000/app`.
   - Register User 2 (e.g. `Bob`, `bob@example.com`).
   - Copy Bob's **10-digit UID** (e.g. `9182736450`).

3. **Make a Call**:
   - In Alice's tab, enter Bob's UID (`9182736450`) into the dialpad or click the telephone icon.
   - Bob will receive a real-time ringing alert popup with **Answer** or **Reject** options.
   - Click **Answer** to start live audio/video communication!

---

## 🗄️ Database Configuration (Optional MySQL Mode)

By default, CallSphere uses zero-config **SQLite** (`callsphere.db`) created automatically in the `backend` folder.

To switch to **MySQL**:

1. Import `database/voip_app_new.sql` into your MySQL server:
   ```bash
   mysql -u root -p < database/voip_app_new.sql
   ```

2. Export Environment Variables before starting `app.py`:
   ```bash
   export DB_TYPE=mysql
   export DB_HOST=127.0.0.1
   export DB_USER=root
   export DB_PASSWORD=your_password
   export DB_NAME=voip_app
   ```

---

## 🎓 College Viva / Defense FAQ Guide

| Question | Answer for Project Panel |
| :--- | :--- |
| **How does 10-Digit UID routing work?** | When a user registers, the server generates a unique 10-digit random number stored in the DB. When a WebSocket connects (`/ws/{uid}`), the server maps the socket connection to that UID in memory (`ConnectionManager`). |
| **How is media transmitted?** | Media (audio & video) is transmitted **directly Peer-to-Peer** between browsers using WebRTC (`RTCPeerConnection`). The server only handles signaling (SDP Offer/Answer & ICE candidates). |
| **Why WebSockets instead of HTTP Polling?** | WebSockets provide full-duplex, real-time, low-latency communication required for instant call signaling, presence tracking, and ringing events. |
| **How are firewalls / NATs handled?** | The application configures public **STUN Servers** (`stun:stun.l.google.com:19302`) to discover public IP/port pairs for peers behind routers/NATs. |
| **Is authentication secure?** | Yes, passwords are hashed using `passlib[bcrypt]` before being stored in the database. JWT tokens authenticate API endpoints. |

---

## 📁 Directory Structure

```
callsphere/
├── backend/
│   ├── app.py              # FastAPI server & WebSockets WebRTC signaling
│   ├── db.py               # Database abstraction layer (SQLite + MySQL)
│   ├── requirements.txt    # Python dependencies
│   └── callsphere.db       # Auto-created SQLite DB
├── database/
│   ├── voip_app_new.sql    # Production MySQL schema & views
│   └── voip_app.sql        # Legacy schema
├── frontend/
│   ├── app.html            # Main VoIP phone web app UI
│   ├── index.html          # Product landing page
│   ├── css/                # Glassmorphic styles
│   └── js/
│       ├── api.js          # REST API bridge
│       ├── webrtc.js       # WebRTC client engine & STUN setup
│       └── app.js          # UI state manager & event listeners
├── README.md               # Documentation & setup guide
└── implementation_plan.md  # Project design document
```

---

## 📜 License
This project is developed for educational purposes as a College Final Year Degree Major Project.
