# CallSphere

CallSphere is a SIM-free, cross-platform VoIP and unified communication system. Users register with an email and password to receive a permanent 10-digit User Identifier (UID) that acts as a virtual phone number for peer-to-peer WebRTC audio/video calling and end-to-end encrypted (E2EE) messaging.

---

## How the Codebase Works

CallSphere is organized as a two-part monorepo (`server/` + `apps/web/`):

```text
callsphere/
├── apps/web/                 # React 19 + TypeScript + Vite + Tailwind CSS v4 SPA
│   ├── public/images/        # Static team portraits
│   └── src/
│       ├── components/app/   # Dialer, Recents, Messages (E2EE), Contacts, Groups, Call Stage, Settings
│       ├── components/public/# Landing, Team, Architecture, Contact layout
│       ├── components/ui/    # Reusable obsidian UI primitives (Button, Input, Modal, Toast, SearchBar)
│       ├── lib/              # api.ts, socket.ts, webrtc.ts, cryptoClient.ts, soundEngine.ts
│       ├── pages/            # Route-level pages
│       └── styles/tokens.css # Tailwind CSS v4 @theme design tokens
├── server/                   # Python Flask + Flask-SocketIO backend
│   ├── app/
│   │   ├── routes/           # REST blueprints (auth, auth_v2, contacts, groups, calls, keys, messages)
│   │   ├── sockets/          # Socket.IO signaling, presence, multi-device ringing, and E2EE chat
│   │   ├── config.py         # Typed .env configuration
│   │   ├── db.py             # MariaDB connection pool + SQLite dev backend
│   │   ├── security.py       # Argon2id hashing + PyJWT HttpOnly cookie auth
│   │   ├── otp_service.py    # 6-digit Email OTP generation, HMAC hashing & background SMTP
│   │   └── store.py          # Redis / In-Memory store for multi-device presence, OTPs & rate limits
│   ├── migrations/           # Numbered idempotent MariaDB SQL migrations (001, 002, 003)
│   ├── tests/                # Pytest integration suite
│   ├── pyproject.toml        # Ruff & Pytest configuration
│   ├── requirements.txt      # Python dependencies
│   └── run.py                # Server entrypoint
├── .env.example              # Environment configuration template
├── .gitignore
├── README.md                 # Setup & overview
└── Report.md                 # In-depth engineering & architecture walkthrough
```

### Architecture & Request Flow
1. **Authentication & Security:**
   - Passwords are hashed with **Argon2id** (`argon2-cffi`).
   - Sessions use short-lived **JWT access tokens (15 min)** and **refresh tokens (14 days)** stored in `HttpOnly`, `SameSite=Lax` cookies (`cs_access_token`, `cs_refresh_token`), never in `localStorage`.
   - Optional **Email OTP 2FA** (`/api/v2/auth/login`, `/api/v2/auth/otp/verify`) generates a `secrets`-backed 6-digit code, stores its HMAC-SHA256 hash with a 5-minute TTL (5-attempt cap, single-use deletion), and dispatches email in a background thread.
2. **WebRTC Calling & Multi-Device Signaling:**
   - Authenticated browsers connect over **Socket.IO** (`/socket.io`), validated via JWT on `connect`, and join `uid:<10-digit-uid>` and `group:<group_uid>` rooms.
   - `call:offer` checks `blocked_users` and the recipient's `privacy_mode` (`everyone`, `contacts_only`, `dnd`) server-side before ringing all active devices of the target UID simultaneously.
   - When one device answers or declines, `call:cancelled` dismisses the incoming overlay on all sibling devices.
   - Media (Opus audio / VP8-H.264 video) flows peer-to-peer via **WebRTC** with trickle ICE and STUN/TURN servers fetched from `GET /api/v1/calls/ice-servers` (automatically falling back to OpenRelay TURN over TCP/TLS 443 in development when custom `.env` TURN credentials are not set).
3. **End-to-End Encrypted Messaging & File Sharing:**
   - Each browser generates a non-extractable **ECDH (P-256)** keypair via the Web Crypto API (`crypto.subtle`), stores the private key locally in **IndexedDB** (keyed per origin), and publishes the public JWK to `PUT /api/v2/keys/public`.
   - Shared **AES-GCM (256-bit)** session keys are derived on-device, cached in memory by peer public key fingerprint, and use a fresh 12-byte random IV for every message and file.
   - The server stores only ciphertext, IVs, and encrypted `.bin` attachment blobs in `STORAGE_ROOT`—never plaintext.
   - Desktop renders a 2-pane split view for Messages, while mobile opens threads full-screen; all list views (Recent Calls, Messages, Contacts, Groups) include client-side search, and Web Audio provides incoming/outbound ringtones and message notification chimes.

---

## Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 19, TypeScript, Vite 7, Tailwind CSS v4 (`@tailwindcss/vite`), React Router 7, Lucide React, Socket.IO Client, WebRTC, Web Crypto API |
| **Backend** | Python 3.11+, Flask 3, Flask-SocketIO, Pydantic v2, Argon2id (`argon2-cffi`), PyJWT, `python-dotenv` |
| **Database & Store** | MariaDB (`mysql-connector-python` connection pool) or SQLite (zero-setup local dev), Redis (`redis-py`) or In-Memory store |
| **Quality & Testing** | Ruff (lint + format), Pytest, TypeScript (`tsc --noEmit`), ESLint 9 |

---

## Getting Started (From a Fresh Git Clone)

### 1. Clone the Repository & Configure `.env`

```bash
git clone <your-repo-url> callsphere
cd callsphere
```

Create `.env` from `.env.example`:
- **Linux / macOS:**
  ```bash
  cp .env.example .env
  ```
- **Windows (PowerShell):**
  ```powershell
  Copy-Item .env.example .env
  ```

Open `.env` and replace `SECRET_KEY` and `JWT_SECRET_KEY` with two distinct random strings (64+ hex characters). You can generate them with Python:
```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

> **Quick Local Dev Mode (Zero External Database Setup):**
> You can run CallSphere immediately using SQLite (`server/callsphere_dev.db`) and the in-memory presence/OTP store by setting `DB_TYPE=sqlite` and `USE_INMEMORY_STORE=true` when starting the server (shown below).
>
> **Full MariaDB + Redis Mode:**
> Install MariaDB and Redis for your OS, create the `callsphere_v2` database and `callsphere_app` user matching `.env`, and apply the migrations in order:
> `server/migrations/001_v1_baseline.sql`, `002_v2_auth_otp.sql`, `003_v2_e2ee_messages.sql`.

---

### 2. OS-Specific Setup & Run Instructions

#### Prerequisites (All Platforms)
- **Python 3.11+** (with `pip` and `venv`)
- **Node.js 20+** (with `npm`)

---

#### Linux (Ubuntu / Debian / Arch)

1. **Install prerequisites (if missing):**
   ```bash
   # Ubuntu / Debian
   sudo apt update && sudo apt install -y python3 python3-venv python3-pip nodejs npm

   # Arch / Omarchy
   sudo pacman -S --needed python nodejs npm
   ```
2. **Set up Python virtual environment & install backend dependencies:**
   ```bash
   python3 -m venv .venv
   .venv/bin/pip install -r server/requirements.txt
   ```
3. **Install frontend dependencies:**
   ```bash
   npm --prefix apps/web install
   ```
4. **Start the backend (Terminal 1):**
   ```bash
   DB_TYPE=sqlite USE_INMEMORY_STORE=true PYTHONPATH=server .venv/bin/python server/run.py
   ```
   *(If using MariaDB + Redis instead, omit `DB_TYPE=sqlite USE_INMEMORY_STORE=true`.)*
5. **Start the frontend (Terminal 2):**
   ```bash
   npm --prefix apps/web run dev
   ```
   Open **`http://localhost:5173/`**.

---

#### macOS (Apple Silicon / Intel)

1. **Install prerequisites via Homebrew:**
   ```bash
   brew install python node
   ```
2. **Set up Python virtual environment & install backend dependencies:**
   ```bash
   python3 -m venv .venv
   .venv/bin/pip install -r server/requirements.txt
   ```
3. **Install frontend dependencies:**
   ```bash
   npm --prefix apps/web install
   ```
4. **Start the backend (Terminal 1):**
   ```bash
   DB_TYPE=sqlite USE_INMEMORY_STORE=true PYTHONPATH=server .venv/bin/python server/run.py
   ```
5. **Start the frontend (Terminal 2):**
   ```bash
   npm --prefix apps/web run dev
   ```
   Open **`http://localhost:5173/`**.

---

#### Windows (PowerShell)

1. **Install prerequisites:**
   - Install **Python 3.11+** from [python.org](https://www.python.org/downloads/) (check **"Add python.exe to PATH"**).
   - Install **Node.js 20+ LTS** from [nodejs.org](https://nodejs.org/).
2. **Set up Python virtual environment & install backend dependencies:**
   ```powershell
   python -m venv .venv
   .\.venv\Scripts\pip install -r server\requirements.txt
   ```
3. **Install frontend dependencies:**
   ```powershell
   npm --prefix apps\web install
   ```
4. **Start the backend (PowerShell Terminal 1):**
   ```powershell
   $env:DB_TYPE="sqlite"
   $env:USE_INMEMORY_STORE="true"
   $env:PYTHONPATH="server"
   .\.venv\Scripts\python server\run.py
   ```
5. **Start the frontend (PowerShell Terminal 2):**
   ```powershell
   npm --prefix apps\web run dev
   ```
   Open **`http://localhost:5173/`**.

---

### 3. Optional Tools

#### Exposing via Cloudflare Tunnel (Required for Mobile Mic/Camera & E2EE)
Browsers block `getUserMedia` (mic/camera) and `crypto.subtle` (Web Crypto E2EE) on plain HTTP LAN IPs (`http://192.168.x.x`). Use `cloudflared` to get an instant HTTPS URL that proxies both the frontend and backend:
```bash
cloudflared tunnel --url http://localhost:5173
```

#### Inspecting the SQLite Dev Database (phpMyAdmin-style UI)
```bash
# Linux / macOS
.venv/bin/pip install sqlite-web
.venv/bin/sqlite_web server/callsphere_dev.db --host 127.0.0.1 --port 8080

# Windows (PowerShell)
.\.venv\Scripts\pip install sqlite-web
.\.venv\Scripts\sqlite_web server\callsphere_dev.db --host 127.0.0.1 --port 8080
```
Open **`http://127.0.0.1:8080/`**.

#### Email 2FA (Gmail SMTP)
To receive real 6-digit OTP emails when 2FA is enabled in **Control Center**:
1. Enable 2-Step Verification on your Google Account and create a **16-character App Password**.
2. Set `SMTP_USER` and `SMTP_PASS` in `.env` and restart the backend.
*(When SMTP credentials are left as placeholders in development, OTP codes print to the backend terminal stdout.)*

---

## Verification & Checks

Run all backend and frontend checks from the repository root:

```bash
# Backend lint, format check & tests (Linux / macOS)
.venv/bin/ruff check --config server/pyproject.toml server/
.venv/bin/ruff format --config server/pyproject.toml --check server/
PYTHONPATH=server .venv/bin/pytest server/tests/ -v

# Frontend typecheck, lint & production build
npm --prefix apps/web run typecheck
npm --prefix apps/web run lint
npm --prefix apps/web run build
```
