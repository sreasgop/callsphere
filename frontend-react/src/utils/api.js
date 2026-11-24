const API_BASE = window.location.origin;

export const api = {
    async register(fullName, email, password) {
        try {
            const res = await fetch(`${API_BASE}/api/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ full_name: fullName, email, password })
            });
            const data = await res.json();
            if (!res.ok) {
                return { error: data.detail || data.message || "Registration failed" };
            }
            return data;
        } catch (e) {
            return { error: "Server offline or unreachable" };
        }
    },

    async login(email, password) {
        try {
            const res = await fetch(`${API_BASE}/api/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await res.json();
            if (!res.ok) {
                return { error: data.detail || data.message || "Invalid email or password" };
            }
            if (data.user) {
                localStorage.setItem('voip_user', JSON.stringify(data.user));
                if (data.token) localStorage.setItem('voip_token', data.token);
            }
            return data;
        } catch (e) {
            return { error: "Server offline or unreachable" };
        }
    },

    async addContact(targetUid, nickname) {
        const user = JSON.parse(localStorage.getItem('voip_user'));
        if (!user) return { error: "Auth Error" };
        try {
            const res = await fetch(`${API_BASE}/api/contacts/add`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: user.id || user.sip_uid, target_uid: targetUid, nickname })
            });
            return await res.json();
        } catch (e) {
            return { error: "Network Error" };
        }
    },

    async getContacts() {
        const user = JSON.parse(localStorage.getItem('voip_user'));
        if (!user) return [];
        try {
            const param = user.id || user.sip_uid;
            const res = await fetch(`${API_BASE}/api/contacts/${param}`);
            if (!res.ok) return [];
            return await res.json();
        } catch (e) {
            return [];
        }
    },

    async getAllUsers() {
        try {
            const res = await fetch(`${API_BASE}/api/users/all`);
            if (!res.ok) return [];
            return await res.json();
        } catch (e) {
            return [];
        }
    },

    async getCallHistory() {
        const user = JSON.parse(localStorage.getItem('voip_user'));
        if (!user) return [];
        try {
            const res = await fetch(`${API_BASE}/api/calls/history/${user.sip_uid}`);
            if (!res.ok) return [];
            return await res.json();
        } catch (e) {
            return [];
        }
    },

    async logCall(caller, callee, status, duration) {
        try {
            await fetch(`${API_BASE}/api/calls/log`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ caller_uid: caller, callee_uid: callee, status, duration })
            });
        } catch (e) {
            console.error("Failed to log call", e);
        }
    },

    async createGroup(name, description = "") {
        const user = JSON.parse(localStorage.getItem('voip_user'));
        if (!user) return { error: "Auth Error" };
        try {
            const res = await fetch(`${API_BASE}/api/groups/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: user.id, group_name: name, description })
            });
            return await res.json();
        } catch (e) {
            return { error: "Network Error" };
        }
    },

    async getMyGroups() {
        const user = JSON.parse(localStorage.getItem('voip_user'));
        if (!user) return [];
        try {
            const res = await fetch(`${API_BASE}/api/groups/${user.sip_uid}`);
            if (!res.ok) return [];
            return await res.json();
        } catch (e) {
            return [];
        }
    },

    async joinGroup(groupUid) {
        const user = JSON.parse(localStorage.getItem('voip_user'));
        if (!user) return { error: "Auth Error" };
        try {
            const res = await fetch(`${API_BASE}/api/groups/join`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_uid: user.sip_uid, group_uid: groupUid })
            });
            const data = await res.json();
            if (!res.ok) return { error: data.detail || "Failed to join group" };
            return data;
        } catch (e) {
            return { error: "Network Error" };
        }
    },

    async getGroupDetails(groupUid) {
        try {
            const res = await fetch(`${API_BASE}/api/groups/details/${groupUid}`);
            if (!res.ok) return { error: "Failed to load group details" };
            return await res.json();
        } catch (e) {
            return { error: "Network Error" };
        }
    },

    async updateGroup(groupUid, groupName) {
        try {
            const res = await fetch(`${API_BASE}/api/groups/update`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ group_uid: groupUid, group_name: groupName })
            });
            const data = await res.json();
            if (!res.ok) return { error: data.detail || "Failed to update group" };
            return data;
        } catch (e) {
            return { error: "Network Error" };
        }
    },

    async deleteGroup(groupUid) {
        try {
            const res = await fetch(`${API_BASE}/api/groups/${groupUid}`, {
                method: 'DELETE'
            });
            const data = await res.json();
            if (!res.ok) return { error: data.detail || "Failed to delete group" };
            return data;
        } catch (e) {
            return { error: "Network Error" };
        }
    },

    async addGroupMember(groupUid, userUid) {
        try {
            const res = await fetch(`${API_BASE}/api/groups/members/add`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ group_uid: groupUid, user_uid: userUid })
            });
            const data = await res.json();
            if (!res.ok) return { error: data.detail || "Failed to add member" };
            return data;
        } catch (e) {
            return { error: "Network Error" };
        }
    },

    async removeGroupMember(groupUid, userUid) {
        try {
            const res = await fetch(`${API_BASE}/api/groups/members/remove`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ group_uid: groupUid, user_uid: userUid })
            });
            const data = await res.json();
            if (!res.ok) return { error: data.detail || "Failed to remove member" };
            return data;
        } catch (e) {
            return { error: "Network Error" };
        }
    },

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
        } catch (e) {
            console.error(e);
        }
    },

    async getConversations(myUid) {
        try {
            const res = await fetch(`${API_BASE}/api/messages/conversations/${myUid}`);
            if (!res.ok) return [];
            const data = await res.json();
            return data.conversations || [];
        } catch (e) {
            return [];
        }
    },

    async getMessages(myUid, targetUid) {
        try {
            const res = await fetch(`${API_BASE}/api/messages/history/${myUid}/${targetUid}`);
            if (!res.ok) return [];
            const data = await res.json();
            return data.messages || [];
        } catch (e) {
            return [];
        }
    },

    async sendMessage(senderUid, receiverUid, text) {
        try {
            const res = await fetch(`${API_BASE}/api/messages/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sender_uid: senderUid, receiver_uid: receiverUid, text })
            });
            if (!res.ok) return null;
            return await res.json();
        } catch (e) {
            return null;
        }
    },

    async markMessagesRead(myUid, senderUid) {
        try {
            await fetch(`${API_BASE}/api/messages/read`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ my_uid: myUid, sender_uid: senderUid })
            });
        } catch (e) {}
    }
};
