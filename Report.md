# CallSphere Engineering Report & Complete Codebase Walkthrough

This document explains how CallSphere works from top to bottom in plain, concrete terms: every design decision, why that choice was made, how data and media move across networks (LAN vs. WAN, STUN vs. TURN, WebRTC, WebSockets, and `cloudflared`), and how every file in `server/` and `apps/web/` fits together.

---

## 1. The Big Picture: How CallSphere Works

Think of CallSphere as a **software-defined telephone network** that lives in your browser. Instead of a SIM card and a telecom carrier giving you a 10-digit phone number, CallSphere creates an account from your email/password, assigns you a permanent random **10-digit UID**, and lets any two browsers call or message each other directly.

To understand the entire codebase, split it into **three separate planes** (paths of traffic):

1. **The Control Plane (REST API over HTTPS):**
   - Handles registration, login, cookies, contacts, call history logs, groups, settings, public E2EE key lookup, and encrypted file uploads/downloads.
   - Runs through Flask Blueprints in `server/app/routes/`.
2. **The Signaling Plane (Real-Time Events over Flask-SocketIO / WebSockets):**
   - Acts like a switchboard operator. It tells Browser B *"Browser A is calling you"*, forwards tiny text descriptions of each browser's media capabilities (**SDP**) and network addresses (**ICE candidates**), tracks who is online, and delivers encrypted chat messages in real time.
   - Lives in `server/app/sockets/signaling.py` and `apps/web/src/lib/socket.ts`.
3. **The Media Plane (Peer-to-Peer Audio/Video over WebRTC):**
   - Once the two browsers introduce themselves through the Signaling Plane, **audio and video do NOT pass through the Python Flask server**.
   - Media flows directly browser-to-browser (or through an external TURN relay when firewalls block direct connections).
   - **Why?** Proxying HD video through a local Python server would saturate CPU and bandwidth after just a couple of calls. Keeping media peer-to-peer keeps the server lightweight and latency low.

---

## 2. Networking Deep Dive: STUN, TURN, ICE, LAN vs. WAN, and `cloudflared`

This is one of the most important parts of a VoIP system. Here is exactly how CallSphere connects two browsers in different situations.

### How Two Browsers Find Each Other (ICE, STUN, and TURN)

When Browser A calls Browser B, neither browser initially knows how to reach the other across the internet because routers and mobile carriers hide devices behind **NAT (Network Address Translation)** and firewalls.

WebRTC solves this with **ICE (Interactive Connectivity Establishment)**. When `WebRTCController` (`apps/web/src/lib/webrtc.ts`) creates an `RTCPeerConnection`, it gathers a list of possible network paths ("ICE candidates") in three tiers:

1. **Host Candidates (Direct LAN IP, e.g., `192.168.0.105:54321`):**
   - **Used when:** Both devices are on the same local Wi-Fi/LAN (or the same computer).
   - **How it works:** No external server is needed for the media; packets travel straight across your Wi-Fi router.
2. **STUN Candidates (`srflx` — Server Reflexive, e.g., `stun:stun.relay.metered.ca:80`):**
   - **What STUN does:** Browser A sends a tiny packet to a STUN server on the internet. The STUN server replies: *"From the outside internet, your router's public IP and port look like `203.0.113.45:41234`."*
   - **Used when:** Browser A is on home Wi-Fi and Browser B is on another city's Wi-Fi (WAN) behind standard "Cone" NAT routers.
   - **Why it's great:** STUN is free/tiny (only a few packets during call setup). Once both peers know each other's public IP:port, media still flows **directly peer-to-peer**.
3. **TURN Candidates (`relay`, e.g., `turns:global.relay.metered.ca:443?transport=tcp`):**
   - **What TURN does:** Sometimes STUN is not enough. Corporate networks, university Wi-Fi, and many 4G/5G mobile carriers use **Symmetric NAT** (they change your port for every destination) or block UDP traffic completely. Direct P2P fails in those networks.
   - **How TURN fixes it:** Both browsers connect outbound to a **TURN relay server** over TLS on port `443` (which looks like normal HTTPS web traffic, so almost no firewall blocks it). The TURN server relays the already-encrypted WebRTC media packets between A and B.

### What CallSphere Actually Uses Right Now

Look at `server/app/routes/calls.py` (`ice_servers()`) and `.env.example`:
- **STUN is always enabled:** `STUN_URL` defaults to `stun:stun.relay.metered.ca:80`.
- **TURN is conditionally enabled:** `calls.py` adds the TURN server to the `ice_servers` array **only if** `TURN_URL`, `TURN_USERNAME`, and `TURN_CREDENTIAL` are all set in `.env`.
- **Security decision (`security.md`):** Legacy `Archive/frontend/js/webrtc.js` hardcoded Metered OpenRelay credentials right inside the JavaScript bundle (anyone inspecting DevTools could steal them). CallSphere 2.0 moved ICE configuration to an authenticated backend endpoint (`GET /api/v1/calls/ice-servers`) so TURN secrets never live in frontend source code.

### Will It Work on LAN Only, or Also on WAN?

- **On a LAN:** Yes, 100% out of the box (using Host candidates, no TURN needed).
- **On a WAN (across the internet / 4G/5G):**
  - Calls work across **standard home/broadband NATs** using the configured STUN server.
  - Calls across **strict Symmetric NATs or mobile carrier firewalls** will work **once you put valid `TURN_USERNAME` and `TURN_CREDENTIAL` values in `.env`** (for example from Metered's free TURN tier or a self-hosted Coturn server). Without TURN credentials, strict mobile/corporate firewalls may stall during ICE connection.
  - **Signaling on WAN:** Both browsers also need to reach the Flask server. Locally you expose `http://localhost:5173` over HTTPS using **Cloudflare Tunnel (`cloudflared tunnel --url http://localhost:5173`)**.

### Why `cloudflared` (HTTPS) Is Mandatory for Mobile Browsers

Modern browsers (Chrome, Safari, Firefox) enforce a strict **Secure Context** rule:
- `navigator.mediaDevices.getUserMedia` (microphone & camera) and `window.crypto.subtle` (Web Crypto E2EE) are **disabled by the browser** on plain `http://192.168.x.x` LAN IPs.
- They **only** work on `http://localhost` or `https://...`.
- Running `cloudflared tunnel --url http://localhost:5173` wraps your local app in a real `https://*.trycloudflare.com` TLS endpoint with zero router port-forwarding.
- **Why `vite.config.ts` and `server/app/__init__.py` were updated for it:**
  - Vite 7 blocks unknown `Host` headers by default; setting `allowedHosts: true` in `apps/web/vite.config.ts` lets `*.trycloudflare.com` reach Vite.
  - `vite.config.ts` sets `host: true` (binds `0.0.0.0:5173`) and proxies `/api` and `/socket.io` (`ws: true`, `changeOrigin: true`) to Flask on `127.0.0.1:5000` (or `VITE_API_TARGET`). Because API and WebSocket requests go through the **same origin** as the page, `SameSite=Lax` `HttpOnly` auth cookies work cleanly over `cloudflared` without cross-domain cookie headaches.
  - In `server/app/__init__.py`, `development` mode also permits `.trycloudflare.com` CORS origins just in case a request carries the tunnel origin header.

---

## 3. Configuration & Startup (`server/app/config.py`, `server/__init__.py`, `server/run.py`)

- **`server/app/config.py` (`Settings`):**
  - Reads `.env` from the repository root using `python-dotenv`.
  - Uses a frozen `@dataclass` (`Settings.from_env()`) so every subsystem (`DB`, `JWT`, `CORS`, `Redis`, `SMTP`, `Storage`, `STUN/TURN`) receives explicit, typed values instead of scattered `os.getenv()` calls.
  - `cookie_secure` is `True` when `APP_ENV=production` (requiring HTTPS for cookies) and `False` in local `development` so `http://localhost:5173` cookies work without SSL.
- **`server/app/__init__.py` (`create_app`):**
  - Uses the Flask **Application Factory** pattern (`create_app(settings=..., db_backend=..., store_backend=...)`).
  - **Why:** Passing optional `db_backend` and `store_backend` makes testing trivial—`pytest` injects an isolated in-memory SQLite database and an in-memory store without needing live MariaDB or Redis daemons.
  - Attaches security headers to every HTTP response (`after_request`):
    - `X-Content-Type-Options: nosniff` (stops MIME-type sniffing attacks)
    - `X-Frame-Options: DENY` (blocks clickjacking inside iframes)
    - `Referrer-Policy: no-referrer` (prevents leaking URLs/UIDs in `Referer` headers)
    - `Content-Security-Policy` (restricts script/connect sources)
  - Sets `MAX_CONTENT_LENGTH` from `MAX_UPLOAD_MB` so oversized uploads are rejected at the WSGI boundary before reading into memory.
  - Catches unhandled `500` errors with a clean JSON `{"error": "Internal server error"}` so Python stack traces and SQL errors are never leaked to clients.
- **`server/run.py`:**
  - Starts Flask-SocketIO (`socketio.run(app, host="0.0.0.0", port=PORT)`), using `async_mode="threading"` with `simple-websocket` so standard Python 3.14 works without legacy monkey-patching libraries like `eventlet`.

---

## 4. Database Layer (`server/app/db.py` & `server/migrations/`)

### How Persistence Works: MariaDB Pool vs. SQLite Dev Mode

1. **Production Mode (`DB_TYPE=mariadb`, the default):**
   - `MariaDBPool` (`server/app/db.py`) wraps `mysql.connector.pooling.MySQLConnectionPool` (`DB_POOL_SIZE=10`).
   - **Why connection pooling?** Opening a fresh TCP + MariaDB auth handshake on every HTTP request or Socket.IO event wastes milliseconds and exhausts file descriptors under load. A pool reuses warm connections and automatically commits on success or rolls back on exception via the `_cursor()` context manager.
2. **Zero-Setup Dev Mode (`DB_TYPE=sqlite`):**
   - `SQLiteDevDB` writes to `server/callsphere_dev.db` behind a `threading.Lock()` (`check_same_thread=False` is required because Flask's threaded server handles requests across worker threads).
   - It translates `%s` placeholders to `?` and backticked `` `groups` `` to `"groups"` so the **exact same parameterized SQL queries** in `routes/` and `sockets/` work on both MariaDB and SQLite without duplicating SQL strings (a major cleanup over the legacy `backend/app.py`).
   - `_init_schema()` also runs idempotent `PRAGMA table_info(users)` checks (e.g., adding `two_factor_enabled` if missing on an older dev `.db`).
3. **Rule against SQL Injection (`security.md §3`):**
   - Every query uses bound parameters (`%s` tuple). Zero string interpolation (`f"..."` or `+`) of user values ever touches SQL.

### Schema & Migrations (`server/migrations/`)

Never edit database tables ad hoc—every schema change is a numbered, idempotent SQL file:

- **`001_v1_baseline.sql`:**
  - `users`: `id`, `full_name`, `email` (UNIQUE), `password_hash`, `uid` (10-digit UNIQUE), `avatar_color`, `status_message`, `privacy_mode` (`ENUM('everyone', 'contacts_only', 'dnd')`), `created_at`, `updated_at`.
  - `contacts`: `id`, `user_id` (FK -> `users.id` CASCADE), `contact_uid`, `contact_name`, `notes`, `is_favorite`, `UNIQUE(user_id, contact_uid)`.
  - `call_logs`: `id`, `caller_uid`, `callee_uid`, `started_at`, `ended_at`, `duration`, `status`, with **composite indexes** `(caller_uid, started_at DESC)` and `(callee_uid, started_at DESC)` for fast cursor-paginated history.
  - `` `groups` ``: `id`, `group_uid` (10-digit UNIQUE starting with `9`), `group_name`, `description`, `created_by` (FK).
  - `group_members`: `id`, `group_id` (FK CASCADE), `user_uid`, `role` (`'admin'` or `'member'`), `UNIQUE(group_id, user_uid)`, `INDEX(user_uid)`.
  - `blocked_users`: `id`, `user_id` (FK CASCADE), `blocked_uid`, `UNIQUE(user_id, blocked_uid)`.
  - `v1_users_compat` view: Aliases `uid AS sip_uid` for backward compatibility.
- **`002_v2_auth_otp.sql`:**
  - Adds `two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE` to `users`.
- **`003_v2_e2ee_messages.sql`:**
  - `user_keys`: Stores each user's **public** ECDH P-256 key (`public_key_jwk` TEXT), one per user (`UNIQUE(user_id)`, `UNIQUE(uid)`).
  - `attachments`: Metadata for encrypted binary files (`id` UUID PK, `uploader_uid`, `storage_name` `<uuid>.bin`, `byte_size`).
  - `messages`: `id` (`BIGINT`), `conversation_id` (canonical sorted `min_uid:max_uid`), `sender_uid`, `recipient_uid`, `ciphertext`, `iv`, optional `attachment_id` / `attachment_meta_ct` / `attachment_meta_iv`, `is_read`, `created_at`, with composite index `idx_messages_conv_id (conversation_id, id DESC)` for fast cursor pagination (`WHERE id < before_id`).

### UID Generation (`generate_unique_uid`)
- Uses `secrets.randbelow()` (cryptographically secure OS randomness, never Python's `random` module) to pick a 10-digit number (`1000000000–8999999999` for users, `9000000000–9999999999` for groups) and verifies uniqueness against the DB before returning.

---

## 5. Ephemeral State Layer (`server/app/store.py`): Redis vs. In-Memory

Some data should **not** live in MariaDB because it changes every second and needs automatic expiration (TTLs):
- Which socket IDs (`sid`) a user currently has open across laptop/phone (`presence:uid:<uid>` Redis Set, 120s TTL refreshed every 45s by `presence:heartbeat`).
- Whether a user's line is currently ringing (`call:ringing:<uid>`, 60s TTL).
- Short-lived 2FA OTP hashes (`otp:2fa:<user_id>`, 300s / 5-minute TTL).
- Rate-limit counters (`ratelimit:<bucket>`, 60s window).

**Why Redis Sets (`RedisStore`)?**
- Checking if a user is online or finding all their devices is an **O(1)** Redis lookup (`SCARD` / `SMEMBERS`), instead of looping over every connected socket in Python.
- Emitting to Socket.IO room `uid:<10-digit-uid>` rings all of a user's logged-in devices at once.

**Why `InMemoryStore`?**
- Implements the exact same `EphemeralStore` Python `Protocol` using a `threading.Lock()` and `time.monotonic()` expiration timestamps.
- Selected automatically when `APP_ENV=test` or `USE_INMEMORY_STORE=true`, letting developers and CI run the full suite without installing Redis.

---

## 6. Security, Authentication & Email OTP (`security.py`, `otp_service.py`, `schemas.py`)

### Password Hashing (`security.py`)
- Uses **Argon2id** (`argon2.PasswordHasher()`), the winner of the Password Hashing Competition, with automatic per-user random salts. All legacy SHA-256 and plaintext fallbacks from v1 were removed.

### Cookie-Based JWT Sessions (`security.py`)
- **Access Token (`cs_access_token`):** Valid for **15 minutes** (`JWT_ACCESS_TTL_MINUTES`), sent on `Path=/` with `HttpOnly=True` and `SameSite=Lax`.
- **Refresh Token (`cs_refresh_token`):** Valid for **14 days** (`JWT_REFRESH_TTL_DAYS`), scoped strictly to `Path=/api/v1/auth` with `HttpOnly=True` and `SameSite=Lax`.
- **Why `HttpOnly` cookies instead of `localStorage`?** JavaScript cannot read an `HttpOnly` cookie (`document.cookie` hides it), so even if an XSS script ran on the page, it could not steal your JWT tokens.
- **Zero-Trust `@require_auth` decorator:** Every protected route derives `g.current_user = {"user_id": ..., "uid": ...}` exclusively from the verified JWT—never from `request.json["user_id"]` or URL parameters.

### Email OTP / 2FA (`otp_service.py` & `routes/auth_v2.py`)
When a user enables Email 2FA (`PATCH /api/v2/auth/2fa`) and signs in via `POST /api/v2/auth/login`:
1. Password is verified first.
2. Instead of setting auth cookies, the server generates a 6-digit OTP via `secrets.randbelow(1_000_000)`, computes an **HMAC-SHA256** digest keyed with `SECRET_KEY`, and stores it in `EphemeralStore` with a **5-minute TTL**.
3. The server returns `requires_otp: true` and a short-lived signed `challenge_token` (`type="otp_challenge"`).
4. **Non-blocking Email Dispatch:** If real `SMTP_USER`/`SMTP_PASS` are configured in `.env`, a daemon `threading.Thread` connects to `SMTP_HOST:SMTP_PORT` (`STARTTLS`) and sends the email without blocking Flask's request thread. If `.env` still has placeholder SMTP values in `development`, it prints `[CallSphere Dev OTP]` to server stdout.
5. On `POST /api/v2/auth/otp/verify`:
   - Attempts are incremented first and capped at **5 tries** (after 5 failures, the OTP is deleted).
   - Compares digests with constant-time `hmac.compare_digest` (prevents timing side-channel attacks).
   - Deletes the OTP immediately on success (**single-use**) and issues the `HttpOnly` access + refresh cookies.
6. Login and OTP verify endpoints are rate-limited (`10` requests per `60s` per IP).

### Input Validation (`schemas.py`)
- Every JSON request body is validated by **Pydantic v2** models (`RegisterRequest`, `LoginRequest`, `AddContactRequest`, `CreateGroupRequest`, etc.) enforcing `^\d{10}$` regex for UIDs, min/max lengths, email normalization, and `privacy_mode` enum values (`everyone`, `contacts_only`, `dnd`).

---

## 7. Backend Routes & Socket.IO Signaling (`server/app/routes/` & `sockets/`)

### REST Blueprints
- **`routes/auth.py` (`/api/v1/auth`):** `register` (201, returns new 10-digit UID), `login`, `refresh` (rotates cookie pair), `logout` (clears cookies), `me` (current profile), `settings` (updates `privacy_mode` & `status_message`).
- **`routes/auth_v2.py` (`/api/v2/auth`):** Rate-limited `login`, `otp/verify`, and `2fa` toggle.
- **`routes/contacts.py` (`/api/v1/contacts`):** `GET` list (enriched with live `is_online` from `EphemeralStore`), `POST` upsert contact (rejects self-add, verifies target UID exists), `GET /blocked`, `POST /block`, `DELETE /block/<uid>`.
- **`routes/groups.py` (`/api/v1/groups`):** `GET` user's groups, `POST` create group (creator becomes `'admin'`), `POST /join`, `GET /<group_uid>` (requires membership—returns `403` to non-members), `PATCH /<group_uid>` (admin only), `DELETE /<group_uid>` (admin only), `POST /<group_uid>/members` (admin only), `DELETE /<group_uid>/members/<user_uid>` (admin or self).
- **`routes/calls.py` (`/api/v1`):** `GET /health`, cursor-paginated `GET /calls/history` (`before_id`, `limit`), `POST /calls/log` (uses authenticated `caller_uid`), `GET /calls/ice-servers`.
- **`routes/keys.py` (`/api/v2/keys`):** `PUT /public` (validates `kty == "EC"`, `crv == "P-256"`, and explicitly rejects any payload containing a private `"d"` key), `GET /<target_uid>`.
- **`routes/messages.py` (`/api/v2`):**
  - `GET /messages/conversations`: Fetches latest message per conversation + unread counts + contact/user display names using batched `IN (...)` queries (**zero N+1 SQL loops**).
  - `GET /messages/history/<peer_uid>`: Cursor-paginated ciphertext history (`WHERE conversation_id = %s AND id < %s ORDER BY id DESC LIMIT %s`).
  - `POST /messages/read`: Marks incoming messages from `sender_uid` as read.
  - `POST /attachments` & `GET /attachments/<id>`: Rate-limited upload (`20/min`) storing random UUID `.bin` files inside `STORAGE_ROOT` with path-resolution containment verification (`root in target.parents`) to prevent `../` path traversal, served with `Content-Disposition: attachment` and `X-Content-Type-Options: nosniff`.

### Socket.IO Signaling (`server/app/sockets/signaling.py`)
- **`connect`:** Validates `cs_access_token` cookie (or `auth.token`). Rejects unauthenticated sockets immediately (`return False`). Adds `sid` to `store`, joins `uid:<uid>` and all `group:<group_uid>` rooms, and broadcasts `presence:update` (`online`) if this was the user's first active device.
- **`presence:heartbeat`:** Refreshes the 120s TTL in Redis/Store.
- **`disconnect`:** Removes `sid`; broadcasts `presence:update` (`offline`) only when the user's **last** device disconnects (`remaining == 0`).
- **`call:offer`:**
  - Derives `caller_uid` strictly from `_sid_sessions[request.sid]`.
  - If `target_uid` is a group: verifies caller is in `group_members` and emits `call:incoming` to `group:<group_uid>` (`skip_sid=request.sid`).
  - If `target_uid` is a user: checks `blocked_users` -> checks `privacy_mode` (`dnd` rejects; `contacts_only` requires caller in `contacts`) -> checks `store.is_uid_online(target_uid)` -> sets ringing state -> emits `call:incoming` to `uid:<target_uid>` (all active devices ring simultaneously).
- **`call:answer` / `call:reject`:** Clears ringing state, emits `call:cancelled` (`answered_elsewhere` / `rejected_elsewhere`) to `uid:<my_uid>` (`skip_sid=request.sid`) so sibling devices stop ringing, and routes `call:answered` / `call:rejected` to the caller.
- **`call:ice` / `call:end` / `group:signal`:** Relays ICE candidates, hangup (`call:ended` + `call:cancelled`), and verified group signals.
- **`chat:send` / `chat:typing` / `chat:read`:** Enforces `blocked_users`, persists ciphertext+IV in `messages`, emits `chat:message` to `uid:<target_uid>`, and sends `chat:ack` back to sender.

---

## 8. End-to-End Encryption (E2EE) Client (`apps/web/src/lib/cryptoClient.ts`)

1. **Key Generation & Non-Extractable Storage:**
   - When a user signs into `/app`, `e2eeClient.ensureIdentity(user.uid)` checks **IndexedDB** (`callsphere_e2ee_v2` -> `identity_keys`).
   - If none exists for that UID, the browser runs `crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveKey'])`.
   - Notice `false` (**non-extractable**): even client-side JavaScript cannot export or read the raw private key bytes—only `crypto.subtle` inside the browser can use it to derive shared keys.
   - Only the **public** key is exported as JWK and uploaded to `PUT /api/v2/keys/public`.
2. **Shared Key Derivation & In-Memory Cache:**
   - When opening a thread with `peerUid`, `e2eeClient.getSharedKey()` fetches the peer's public JWK, runs ECDH (`deriveKey`) to produce a **256-bit AES-GCM** `CryptoKey`, and caches it in a `Map<string, CryptoKey>` in memory so subsequent messages encrypt/decrypt instantly.
3. **Unique 96-bit IVs & Encrypted Attachments:**
   - Every call to `encryptText` or `encryptBytes` generates a brand-new 12-byte random IV (`crypto.getRandomValues(new Uint8Array(12))`).
   - For files, the browser encrypts the raw `ArrayBuffer` locally into an opaque `Blob`, uploads it to `POST /api/v2/attachments` (getting back `attachment_id`), and encrypts the original filename + file IV inside `attachment_meta_ct` before sending via `chat:send`.

---

## 9. Frontend Architecture (`apps/web/src/`)

### Design System & Styling (`apps/web/src/styles/tokens.css`)
- Uses **Tailwind CSS v4** configured purely with `@import "tailwindcss";` and `@theme { ... }` (zero `tailwind.config.js`, zero Bootstrap, zero SweetAlert2).
- **Obsidian Monochrome Palette:** `#070709` canvas, `#0F1014` surface, `#16181F` elevated, `1px` hairline borders (`rgba(255,255,255,0.07/0.12)`), `#FAFAFA` primary CTAs, `#6366F1` indigo reserved for active navigation/focus rings, and green/red/amber strictly for live telecom states.
- **Typography:** `Inter` for UI copy and `JetBrains Mono` with `tabular-nums` on every 10-digit UID (`XXX-XXX-XXXX`), call duration timer (`MM:SS`), and schema table so numbers never jitter.

### Client Libraries (`apps/web/src/lib/`)
- **`api.ts`:** Typed `fetch` wrapper with `credentials: 'include'`. On any `401` from a protected endpoint, it transparently calls `POST /api/v1/auth/refresh` once and retries the original request seamlessly.
- **`socket.ts`:** Creates the `socket.io-client` instance with `withCredentials: true` and automatic reconnection.
- **`webrtc.ts` (`WebRTCController`):**
  - Captures audio (with echo cancellation, noise suppression, auto gain control) and `720p` video (falling back cleanly to audio-only if no camera or permission is denied).
  - Buffers incoming ICE candidates until `setRemoteDescription` finishes so candidates arriving out of order are never lost.
  - Supports mid-call camera switching (`replaceTrack` on the active `RTCRtpSender` without dropping the call).
  - Strictly stops every `MediaStreamTrack` (`track.stop()`), closes `RTCPeerConnection`, and clears streams on hangup/error/unmount so camera/mic hardware lights turn off immediately.
- **`soundEngine.ts`:** Pure Web Audio API synthesizer for authentic dual-tone DTMF keypad frequencies, click feedback, ringtones, and `navigator.vibrate` haptics on mobile—zero external `.mp3`/`.wav` assets required.
- **`format.ts` & `useReveal.ts`:** UID/duration/time formatters and an `IntersectionObserver` scroll-reveal hook for public pages.

### Pages & App Components
- **UI Primitives (`components/ui/`):** `Button.tsx`, `Input.tsx`, `Modal.tsx` (backdrop click + `Escape` key), `Toast.tsx` (dark bottom-right notifications replacing browser `alert`/`confirm`), `Badge.tsx`, `SearchBar.tsx`.
- **Public Site (`components/public/PublicLayout.tsx` & `pages/`):**
  - `PublicLayout.tsx`: Sticky header with animated 3-bar hamburger <-> `X` mobile drawer and unified footer; `ScrollToTop` in `App.tsx` resets scroll on route change.
  - `LandingPage.tsx`: `100svh` hero (prevents mobile address-bar scroll recoil) with **Get Your Number** linking directly to `/auth?mode=register`, plus 4 interactive miniature UI vignettes.
  - `TeamPage.tsx`: Uniform cards with circular portrait frames and GPU-composited (`transform` + `scale`) slide-up metadata drawers.
  - `ArchitecturePage.tsx`: Interactive stack grid, animated 3-tier connector, schema cards, and live-ringing signal propagation timeline.
  - `ContactPage.tsx` & `AuthPage.tsx`: Direct dispatch form + clean Login / Register / 6-digit OTP verification flow.
- **Workspace Shell (`pages/AppPage.tsx` & `components/app/`):**
  - `AppPage.tsx`: Coordinates session state, Socket.IO lifecycle, 45s presence heartbeats, E2EE key publishing, incoming/active call state (isolated from tab lists), and hardware device enumeration.
  - `AppShell.tsx`: Desktop `w-16` left icon rail + full identity header (`Name`, copyable `XXX-XXX-XXXX` UID, live status pill); mobile compact network status bar + thumb-friendly 6-tab bottom dock (`Keypad`, `Recents`, `Messages`, `Contacts`, `Groups`, `Settings`).
  - `DialerView.tsx`: Vertically & horizontally centered keypad (`74px` mobile keys, physical keyboard `0-9*#`, `Backspace`, `Enter`, and contact autocomplete).
  - `RecentsView.tsx`: Searchable call history with `All` / `Missed` filter, readable stacked UID layout on mobile, and one-tap **Save to Contacts** (`UserPlus`) modal for unsaved callers.
  - `ChatView.tsx`: Consistent searchable capsule list of conversations (with live **Online** badges and unread counts) + Saved Contacts + `+ New` UID modal; tapping a thread opens a full-screen mobile / framed desktop E2EE chat stage with file attachments and debounced typing indicators.
  - `ContactsView.tsx` & `GroupsView.tsx` / `GroupManageModal.tsx`: Searchable contacts (call, message, block/unblock) and searchable groups (create, join by 10-digit ID, admin rename, add/remove member, and confirmed delete).
  - `IncomingCallOverlay.tsx` & `ActiveCallStage.tsx`: Full-focus incoming caller card (saved-contact badge, Accept/Decline) and `#050507` theater call stage (remote video or monogram audio fallback, corner mirrored local PiP, timer, Mute, Video Toggle, Switch Camera, Hangup).
  - `SettingsView.tsx`: Display name, copyable UID, email, active camera selector, sound/haptics toggles, `everyone`/`contacts_only`/`dnd` privacy rules, Email 2FA toggle, and Logout.

---

## 10. Verification & Automated Testing

- **Backend (`server/tests/`):**
  - `conftest.py` provides `SQLiteTestDB` (in-memory SQLite implementing `DBBackend`) and `InMemoryStore`, allowing `pytest` to exercise every SQL query, Flask route, cookie, Pydantic schema, and Socket.IO event in ~1.5 seconds.
  - Covers auth/cookies/refresh/ICE (`test_auth.py`), contacts/blocking/group RBAC/call logs (`test_contacts_groups.py`), Socket.IO JWT rejection + server-side `dnd`/`contacts_only`/`blocked_users` enforcement (`test_signaling.py`), 2FA Email OTP single-use + multi-device simultaneous ringing cancellation (`test_v2_auth_multidevice.py`), and E2EE public-key validation + ciphertext Socket.IO chat + encrypted `.bin` attachment upload/download (`test_v2_e2ee_chat.py`).
- **Static & Build Checks:**
  - `ruff check` & `ruff format --check` enforce Python style, imports, and correctness.
  - `tsc --noEmit`, `eslint`, and `vite build` enforce strict TypeScript types, React Hooks rules, and bundle integrity.
