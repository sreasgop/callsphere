/* =========================================
   CALLSPHERE API BRIDGE CLIENT
   Handles dynamic host resolution, auth tokens, REST calls
   ========================================= */

const getApiBase = () => {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return `${window.location.protocol}//localhost:5000`;
    }
    return window.location.origin;
};

const API_BASE = getApiBase();

const api = {
    // --- AUTH ---
    async register(fullName, email, password) {
        try {
            const res = await fetch(`${API_BASE}/api/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ full_name: fullName, email, password })
            });
            return await res.json();
        } catch (e) { return { error: "Server offline or unreachable" }; }
    },

    async login(email, password) {
        try {
            const res = await fetch(`${API_BASE}/api/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await res.json();
            if (res.ok && data.user) {
                localStorage.setItem('voip_user', JSON.stringify(data.user));
                if (data.token) localStorage.setItem('voip_token', data.token);
            }
            return data;
        } catch (e) { return { error: "Server offline or unreachable" }; }
    },

    // --- CONTACTS ---
    async addContact(targetUid, nickname) {
        const user = JSON.parse(localStorage.getItem('voip_user'));
        if (!user) return { error: "Auth Error" };
        try {
            const res = await fetch(`${API_BASE}/api/contacts/add`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: user.id, target_uid: targetUid, nickname: nickname })
            });
            return await res.json();
        } catch (e) { return { error: "Network Error" }; }
    },

    async getContacts() {
        const user = JSON.parse(localStorage.getItem('voip_user'));
        if (!user) return [];
        try {
            const res = await fetch(`${API_BASE}/api/contacts/${user.id}`);
            if (!res.ok) return [];
            return await res.json();
        } catch (e) { return []; }
    },

    // --- CALL HISTORY ---
    async getCallHistory() {
        const user = JSON.parse(localStorage.getItem('voip_user'));
        if (!user) return [];
        try {
            const res = await fetch(`${API_BASE}/api/calls/history/${user.sip_uid}`);
            if (!res.ok) return [];
            return await res.json();
        } catch (e) { return []; }
    },

    async logCall(caller, callee, status, duration) {
        try {
            await fetch(`${API_BASE}/api/calls/log`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ caller_uid: caller, callee_uid: callee, status, duration })
            });
        } catch (e) { console.error("Failed to log call", e); }
    },

    // --- GROUPS ---
    async createGroup(name, description = "") {
        const user = JSON.parse(localStorage.getItem('voip_user'));
        if (!user) return { error: "Auth Error" };
        try {
            const res = await fetch(`${API_BASE}/api/groups/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: user.id, group_name: name, description: description })
            });
            return await res.json();
        } catch (e) { return { error: "Network Error" }; }
    },

    async getMyGroups() {
        const user = JSON.parse(localStorage.getItem('voip_user'));
        if (!user) return [];
        try {
            const res = await fetch(`${API_BASE}/api/groups/${user.sip_uid}`);
            if (!res.ok) return [];
            return await res.json();
        } catch (e) { return []; }
    },

    // --- SETTINGS ---
    async updateSettings(privacyMode, statusMessage = "Available") {
        const user = JSON.parse(localStorage.getItem('voip_user'));
        if (!user) return;
        try {
            await fetch(`${API_BASE}/api/settings/update`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: user.id, privacy_mode: privacyMode, status_message: statusMessage })
            });
            user.privacy_mode = privacyMode;
            user.status_message = statusMessage;
            localStorage.setItem('voip_user', JSON.stringify(user));
        } catch (e) { console.error(e); }
    },

    // --- MESSAGING ---
    async getConversations(myUid) {
        try {
            const res = await fetch(`${API_BASE}/api/messages/conversations/${myUid}`);
            if (!res.ok) return [];
            const data = await res.json();
            return data.conversations || [];
        } catch (e) { return []; }
    },

    async getMessages(myUid, targetUid) {
        try {
            const res = await fetch(`${API_BASE}/api/messages/history/${myUid}/${targetUid}`);
            if (!res.ok) return [];
            const data = await res.json();
            return data.messages || [];
        } catch (e) { return []; }
    },

    async sendMessage(senderUid, receiverUid, text) {
        try {
            const res = await fetch(`${API_BASE}/api/messages/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sender_uid: senderUid, receiver_uid: receiverUid, text: text })
            });
            if (!res.ok) return null;
            return await res.json();
        } catch (e) { return null; }
    },

    async markMessagesRead(myUid, senderUid) {
        try {
            await fetch(`${API_BASE}/api/messages/read`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ my_uid: myUid, sender_uid: senderUid })
            });
        } catch (e) { }
    }
};

window.api = api;