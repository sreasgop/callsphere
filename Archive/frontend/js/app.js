/* =========================================
   CALLSPHERE MAIN APPLICATION LOGIC (Production Ready V3)
   Integrates REST API, WebRTC Engine, WebSockets Signaling, SoundEngine,
   Glassmorphism UI, Full-Screen Incoming Ringing Overlay & Camera Selector
   ========================================= */

// --- STATE MANAGEMENT ---
const state = {
    user: null,
    contacts: [],
    recents: [],
    groups: [],
    currentGroupUid: null,
    activeCallStartTime: null,
    pendingIncomingCall: null
};

// Global WebRTC Engine Instance
let rtcEngine = null;

// --- GLOBAL UI HELPERS ---

function getModal(id) {
    const el = document.getElementById(id);
    if (!el) return null;
    let instance = bootstrap.Modal.getInstance(el);
    if (!instance) {
        instance = new bootstrap.Modal(el, { backdrop: 'static', keyboard: true });
    }
    return instance;
}

// Contact resolution helper - NEVER returns "Unknown"
function resolveCallerInfo(uidOrName, defaultHint = null) {
    if (!uidOrName) return { name: 'User', isSaved: false, uid: '' };
    const str = String(uidOrName).trim();

    // Check if matching current logged-in user
    if (state.user && (String(state.user.sip_uid).trim() === str || state.user.full_name.trim().toLowerCase() === str.toLowerCase())) {
        return { name: state.user.full_name, isSaved: true, uid: state.user.sip_uid };
    }

    // Match in contacts by contact_uid OR contact_name
    const contact = state.contacts.find(c => 
        String(c.contact_uid).trim() === str || 
        (c.contact_name && c.contact_name.trim().toLowerCase() === str.toLowerCase())
    );

    if (contact && contact.contact_name) {
        return { name: contact.contact_name, isSaved: true, uid: contact.contact_uid };
    }

    // Check defaultHint against contacts
    if (defaultHint) {
        const hintStr = String(defaultHint).trim();
        const hintContact = state.contacts.find(c => 
            String(c.contact_uid).trim() === hintStr || 
            (c.contact_name && c.contact_name.trim().toLowerCase() === hintStr.toLowerCase())
        );
        if (hintContact && hintContact.contact_name) {
            return { name: hintContact.contact_name, isSaved: true, uid: hintContact.contact_uid };
        }
    }

    if (defaultHint && defaultHint !== 'Unknown' && defaultHint !== 'Unknown Caller') {
        const cleanedHint = defaultHint.replace(/^User\s+/i, '');
        return { name: cleanedHint, isSaved: false, uid: str };
    }

    return { name: str, isSaved: false, uid: str };
}

window.toggleAuth = function (view) {
    if (window.soundEngine) soundEngine.playClickSound();
    const loginForm = document.getElementById('form-login');
    const regForm = document.getElementById('form-register');

    if (!loginForm || !regForm) return;
    if (view === 'register') {
        loginForm.style.display = 'none';
        regForm.style.display = 'block';
    } else {
        regForm.style.display = 'none';
        loginForm.style.display = 'block';
    }
};

function safeCopy(text, elementId) {
    if (window.soundEngine) soundEngine.playClickSound();
    const copyLogic = (t) => {
        if (navigator.clipboard && window.isSecureContext) {
            return navigator.clipboard.writeText(t);
        } else {
            let textArea = document.createElement("textarea");
            textArea.value = t;
            textArea.style.position = "fixed";
            textArea.style.left = "-9999px";
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            return new Promise((res, rej) => {
                document.execCommand('copy') ? res() : rej();
                textArea.remove();
            });
        }
    };

    copyLogic(text).then(() => {
        const el = document.getElementById(elementId);
        if (el) {
            const original = el.innerText;
            el.innerText = "Copied!";
            el.classList.add('text-success');
            setTimeout(() => {
                el.innerText = original;
                el.classList.remove('text-success');
            }, 1500);
        }
    }).catch(err => console.error("Copy failed", err));
}

window.copyUid = function () {
    const uid = document.getElementById('display-uid').innerText;
    safeCopy(uid, 'display-uid');
};

window.copyGroupUid = function () {
    let text = document.getElementById('manage-group-uid').innerText;
    text = text.replace("ID: ", "").trim();
    safeCopy(text, 'manage-group-uid');
};

// --- DIALER FUNCTIONS ---

window.dialKey = function (k) {
    if (window.soundEngine) soundEngine.playKeypadTone(k);
    const input = document.getElementById('dial-input');
    if (input) {
        input.value += k;
        updateSuggestions(input.value);
    }
};

window.backspaceDial = function () {
    if (window.soundEngine) soundEngine.playClickSound();
    const input = document.getElementById('dial-input');
    if (input && input.value.length > 0) {
        input.value = input.value.slice(0, -1);
        updateSuggestions(input.value);
    }
};

window.clearDial = function () {
    if (window.soundEngine) soundEngine.playClickSound();
    const input = document.getElementById('dial-input');
    if (input) {
        input.value = '';
        updateSuggestions('');
    }
};

window.initiateManualCall = function () {
    if (window.soundEngine) soundEngine.playClickSound();
    const uid = document.getElementById('dial-input').value.trim();
    if (uid.length >= 3) {
        const resolved = resolveCallerInfo(uid);
        startCall(uid, resolved.name);
    } else {
        Swal.fire('Invalid UID', 'Please enter a valid 10-digit UID', 'warning');
    }
};

function updateSuggestions(query) {
    const container = document.getElementById('dialer-suggestions');
    if (!query || query.length < 2) {
        container.style.display = 'none';
        return;
    }
    const matches = state.contacts.filter(c => c.contact_uid.startsWith(query));
    if (matches.length > 0) {
        container.innerHTML = matches.map(c => `
            <div class="suggestion-item" onclick="fillDialer('${c.contact_uid}')">
                <span>${c.contact_name}</span>
                <span class="text-muted">${c.contact_uid}</span>
            </div>
        `).join('');
        container.style.display = 'block';
    } else {
        container.style.display = 'none';
    }
}

window.fillDialer = function (uid) {
    if (window.soundEngine) soundEngine.playClickSound();
    document.getElementById('dial-input').value = uid;
    document.getElementById('dialer-suggestions').style.display = 'none';
};

// --- TAB SWITCHING ---
window.switchTab = function (tabName) {
    if (window.soundEngine) soundEngine.playClickSound();
    document.querySelectorAll('.tab-view').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));

    const target = document.getElementById(`tab-${tabName}`);
    if (target) target.classList.add('active');

    // Activate corresponding nav button if triggered programmatically
    const navBtn = document.querySelector(`.nav-btn[onclick*="${tabName}"]`);
    if (navBtn) navBtn.classList.add('active');

    const appContent = document.querySelector('.app-content');
    if (appContent) {
        if (tabName === 'dialer') {
            appContent.classList.remove('hide-mobile-header');
        } else {
            appContent.classList.add('hide-mobile-header');
        }
    }

    if (tabName === 'messages') {
        loadConversations();
    }
};

// --- GROUP MODALS & ACTIONS ---

window.openCreateGroupModal = () => {
    if (window.soundEngine) soundEngine.playClickSound();
    getModal('createGroupModal').show();
};
window.openJoinModal = () => {
    if (window.soundEngine) soundEngine.playClickSound();
    getModal('joinGroupModal').show();
};

window.createGroup = async function () {
    if (window.soundEngine) soundEngine.playClickSound();
    const nameEl = document.getElementById('input-group-name');
    if (!nameEl || !nameEl.value) {
        Swal.fire('Error', 'Please enter a group name', 'warning');
        return;
    }

    const res = await api.createGroup(nameEl.value);
    if (res.success) {
        getModal('createGroupModal').hide();
        Swal.fire('Created', `Group Created! ID: ${res.group_uid}`, 'success');
        refreshGroups();
        nameEl.value = '';
    } else {
        Swal.fire('Error', res.error, 'error');
    }
};

window.joinGroup = async function () {
    if (window.soundEngine) soundEngine.playClickSound();
    const gid = document.getElementById('input-join-gid').value.trim();
    if (!gid) return;

    const res = await api.joinGroup(gid);
    if (res.success) {
        getModal('joinGroupModal').hide();
        Swal.fire('Joined', 'Joined group successfully', 'success');
        refreshGroups();
    } else {
        Swal.fire('Error', res.error, 'error');
    }
};

window.manageGroup = async function (groupUid) {
    if (window.soundEngine) soundEngine.playClickSound();
    const res = await api.getGroupDetails(groupUid);
    if (res.error) return Swal.fire('Error', 'Could not load group details', 'error');

    const group = res.group;
    const members = res.members;
    const myUid = state.user.sip_uid;

    document.getElementById('manage-group-name').innerText = group.group_name;
    document.getElementById('manage-group-uid').innerText = `ID: ${group.group_uid}`;

    const countEl = document.getElementById('member-count');
    if (countEl) countEl.innerText = members.length;

    state.currentGroupUid = group.group_uid;

    const myRecord = members.find(m => m.user_uid === myUid);
    const isAdmin = myRecord && myRecord.role === 'admin';

    const adminPanel = document.getElementById('admin-controls');
    if (isAdmin) {
        adminPanel.style.display = 'block';
        document.getElementById('edit-group-name').value = group.group_name;

        const select = document.getElementById('group-add-contact-select');
        select.innerHTML = '<option value="">Select from Contacts...</option>';
        const nonMembers = state.contacts.filter(c => !members.some(m => m.user_uid === c.contact_uid));
        nonMembers.forEach(c => {
            select.innerHTML += `<option value="${c.contact_uid}">${c.contact_name} (${c.contact_uid})</option>`;
        });
    } else {
        adminPanel.style.display = 'none';
    }

    const list = document.getElementById('group-members-list');
    list.innerHTML = '';

    members.forEach(m => {
        const isMe = m.user_uid === myUid;
        let actions = '';
        if (isAdmin && !isMe) {
            actions = `<button class="btn btn-sm btn-outline-danger ms-2" onclick="removeMember('${m.user_uid}')">Remove</button>`;
        } else if (isMe) {
            actions = `<span class="badge bg-secondary">You</span>`;
        }

        const roleBadge = m.role === 'admin' ? '<i class="bi bi-star-fill text-warning me-1"></i>' : '';

        list.innerHTML += `
            <div class="d-flex justify-content-between align-items-center p-2 border-bottom border-secondary">
                <div>
                    <div class="fw-bold text-white">${roleBadge}${m.full_name || 'Member'}</div>
                    <div class="small text-muted">${m.user_uid}</div>
                </div>
                <div>${actions}</div>
            </div>`;
    });

    getModal('groupManageModal').show();
};

window.renameGroup = async function () {
    if (window.soundEngine) soundEngine.playClickSound();
    const newName = document.getElementById('edit-group-name').value;
    const res = await api.updateGroup(state.currentGroupUid, newName);
    if (res.success) {
        Swal.fire('Updated', 'Group name updated', 'success');
        refreshGroups();
        document.getElementById('manage-group-name').innerText = newName;
    }
};

window.deleteGroup = async function () {
    if (window.soundEngine) soundEngine.playClickSound();
    const result = await Swal.fire({
        title: 'Delete Group?',
        text: "This group will be deleted permanently.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ff7675',
        cancelButtonColor: '#636e72',
        confirmButtonText: 'Yes, delete it!',
        background: '#1a1d21',
        color: '#fff'
    });

    if (!result.isConfirmed) return;

    const res = await api.deleteGroup(state.currentGroupUid);
    if (res.success) {
        getModal('groupManageModal').hide();
        Swal.fire('Deleted!', 'Group deleted.', 'success');
        refreshGroups();
    } else {
        Swal.fire('Error', res.error, 'error');
    }
};

window.addMemberToGroup = async function () {
    if (window.soundEngine) soundEngine.playClickSound();
    const selectVal = document.getElementById('group-add-contact-select').value;
    const inputVal = document.getElementById('add-member-uid').value;
    const targetUid = selectVal || inputVal;

    if (!targetUid) {
        Swal.fire('Warning', 'Please select a contact or enter a UID', 'warning');
        return;
    }

    const res = await api.addGroupMember(state.currentGroupUid, targetUid);
    if (res.success) {
        Swal.fire('Added', 'User added to group', 'success');
        document.getElementById('add-member-uid').value = '';
        window.manageGroup(state.currentGroupUid);
    } else {
        Swal.fire('Error', res.error, 'error');
    }
};

window.removeMember = async function (targetUid) {
    if (window.soundEngine) soundEngine.playClickSound();
    const res = await api.removeGroupMember(state.currentGroupUid, targetUid);
    if (res.success) {
        window.manageGroup(state.currentGroupUid);
    }
};

// --- INITIALIZATION & AUTH ---

document.addEventListener('DOMContentLoaded', () => {
    checkSession();

    // Login Form Handler
    const loginForm = document.getElementById('form-login');
    if (loginForm) {
        loginForm.onsubmit = async (e) => {
            e.preventDefault();
            if (window.soundEngine) soundEngine.playClickSound();
            const res = await api.login(
                document.getElementById('login-email').value,
                document.getElementById('login-pass').value
            );
            if (res.success && res.user) {
                loadDashboard(res.user);
            } else {
                Swal.fire('Login Failed', res.error || 'Invalid credentials', 'error');
            }
        };
    }

    // Register Form Handler
    const regForm = document.getElementById('form-register');
    if (regForm) {
        regForm.onsubmit = async (e) => {
            e.preventDefault();
            if (window.soundEngine) soundEngine.playClickSound();
            const res = await api.register(
                document.getElementById('reg-name').value,
                document.getElementById('reg-email').value,
                document.getElementById('reg-pass').value
            );
            if (res.success && res.uid) {
                Swal.fire({
                    title: 'Account Created!',
                    html: `Your 10-digit UID is: <b class="text-primary fs-3">${res.uid}</b><br>Use your email & password to login.`,
                    icon: 'success'
                });
                toggleAuth('login');
            } else {
                Swal.fire('Registration Error', res.detail || res.error, 'error');
            }
        };
    }

    // Save Contact Handler
    const btnSaveFriend = document.getElementById('btn-save-friend');
    if (btnSaveFriend) {
        btnSaveFriend.onclick = async () => {
            if (window.soundEngine) soundEngine.playClickSound();
            const uid = document.getElementById('input-friend-uid').value.trim();
            const nick = document.getElementById('input-friend-nick').value.trim();
            const res = await api.addContact(uid, nick);
            if (res.success) {
                getModal('addFriendModal').hide();
                Swal.fire('Contact Saved', `Saved contact for ${res.contact.contact_name}`, 'success');
                refreshContacts();
                document.getElementById('input-friend-uid').value = '';
                document.getElementById('input-friend-nick').value = '';
            } else {
                Swal.fire('Error', res.detail || res.error, 'error');
            }
        };
    }

    // Save Settings Handler
    const btnSaveSettings = document.getElementById('btn-save-settings');
    if (btnSaveSettings) {
        btnSaveSettings.onclick = async () => {
            if (window.soundEngine) soundEngine.playClickSound();
            
            // Privacy mode
            const selected = document.querySelector('input[name="privacyRadio"]:checked');
            if (selected) await api.updateSettings(selected.value);

            // Audio & Haptic prefs
            const soundChecked = document.getElementById('pref-sound-effects')?.checked ?? true;
            const hapticsChecked = document.getElementById('pref-haptic-feedback')?.checked ?? true;
            if (window.soundEngine) {
                soundEngine.savePrefs(soundChecked, hapticsChecked);
            }

            Swal.fire('Saved', 'Control center preferences updated', 'success');
        };
    }

    // Logout Button
    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) btnLogout.onclick = () => {
        if (window.soundEngine) soundEngine.playClickSound();
        localStorage.removeItem('voip_user');
        localStorage.removeItem('voip_token');
        location.reload();
    };

    // Keyboard Dialing
    document.addEventListener('keydown', (e) => {
        const appView = document.getElementById('view-app');
        if (!appView || appView.style.display === 'none') return;
        if (e.target.tagName === 'INPUT') return;

        if (/^[0-9*#]$/.test(e.key)) {
            dialKey(e.key);
        } else if (e.key === 'Backspace') {
            backspaceDial();
        } else if (e.key === 'Enter') {
            initiateManualCall();
        }
    });
});

function checkSession() {
    const saved = localStorage.getItem('voip_user');
    if (saved) {
        try {
            loadDashboard(JSON.parse(saved));
        } catch (e) {
            localStorage.removeItem('voip_user');
        }
    }
}

async function loadDashboard(user) {
    state.user = user;
    document.getElementById('view-auth').classList.remove('active');
    document.getElementById('view-auth').style.display = 'none';
    document.getElementById('view-app').style.display = 'flex';

    document.getElementById('display-name').innerText = user.full_name;
    document.getElementById('display-uid').innerText = user.sip_uid;

    const setUid = document.getElementById('settings-uid');
    if (setUid) setUid.innerText = user.sip_uid;
    const setEmail = document.getElementById('settings-email');
    if (setEmail) setEmail.innerText = user.email;

    // Detect Haptic Feedback support (Only show on Mobile Devices with Vibration API)
    const hapticsRow = document.getElementById('row-haptics-setting');
    if (hapticsRow) {
        if ('vibrate' in navigator && navigator.vibrate) {
            hapticsRow.style.display = 'flex';
        } else {
            hapticsRow.style.display = 'none';
        }
    }

    // Prefill Audio / Haptic switches
    if (window.soundEngine) {
        const soundEl = document.getElementById('pref-sound-effects');
        const hapticEl = document.getElementById('pref-haptic-feedback');
        if (soundEl) soundEl.checked = soundEngine.soundEnabled;
        if (hapticEl) hapticEl.checked = soundEngine.hapticsEnabled;
    }

    // Populate camera hardware devices in Settings & Modal
    populateCameraDevices();

    // Initialize WebRTC Engine & WebSockets Signaling
    initWebRTC(user);

    await Promise.all([refreshContacts(), refreshRecents(), refreshGroups()]);
}

async function populateCameraDevices() {
    if (!rtcEngine) return;
    const devices = await rtcEngine.enumerateVideoDevices();
    
    const settingsSelect = document.getElementById('setting-camera-select');
    const modalSelect = document.getElementById('modal-camera-select');

    if (devices.length > 0) {
        const optionsHtml = devices.map((d, i) => `<option value="${d.deviceId}">${d.label || `Camera ${i + 1}`}</option>`).join('');
        if (settingsSelect) settingsSelect.innerHTML = optionsHtml;
        if (modalSelect) modalSelect.innerHTML = optionsHtml;
    } else {
        if (settingsSelect) settingsSelect.innerHTML = '<option value="">Default Camera</option>';
        if (modalSelect) modalSelect.innerHTML = '<option value="">Default Camera</option>';
    }
}

window.changeActiveCameraDevice = async function(deviceId) {
    if (rtcEngine) {
        await rtcEngine.switchCamera(deviceId);
    }
};

window.switchCameraSource = async function() {
    if (!rtcEngine) return;
    if (window.soundEngine) soundEngine.playClickSound();

    const devices = await rtcEngine.enumerateVideoDevices();

    // If on Mobile or only 2 cameras (front/back), toggle directly
    if (devices.length <= 2) {
        await rtcEngine.switchCamera();
    } else {
        // On PC with multiple camera inputs, open selector modal
        populateCameraDevices();
        getModal('cameraSelectModal').show();
    }
};

window.applyCameraSelection = async function() {
    if (window.soundEngine) soundEngine.playClickSound();
    const selectedDeviceId = document.getElementById('modal-camera-select').value;
    if (rtcEngine && selectedDeviceId) {
        await rtcEngine.switchCamera(selectedDeviceId);
    }
    getModal('cameraSelectModal').hide();
};

// --- WEBRTC ENGINE INITIALIZATION ---

function initWebRTC(user) {
    rtcEngine = new WebRTCManager();

    // Handle remote media stream binding for both video and audio
    rtcEngine.onRemoteStreamAdded = (remoteStream) => {
        if (window.soundEngine) soundEngine.stopRingtone();

        const remoteVideo = document.getElementById('remote-video');
        const remoteAudio = document.getElementById('remote-audio');

        if (remoteVideo) {
            remoteVideo.srcObject = remoteStream;
            remoteVideo.play().catch(e => console.warn("Autoplay remote video catch:", e));
        }
        if (remoteAudio) {
            remoteAudio.srcObject = remoteStream;
            remoteAudio.play().catch(e => console.warn("Autoplay remote audio catch:", e));
        }
    };

    // MODERN FULL-SCREEN INCOMING CALL OVERLAY TRIGGER
    rtcEngine.onIncomingCall = ({ fromUid, callerName, offer }) => {
        state.pendingIncomingCall = { fromUid, callerName, offer };

        if (window.soundEngine) soundEngine.startIncomingRingtone();

        // Resolve display name and saved contact status
        const resolved = resolveCallerInfo(fromUid, callerName);

        document.getElementById('incoming-caller-name').innerText = resolved.name;
        document.getElementById('incoming-caller-uid').innerText = `UID ${fromUid}`;
        document.getElementById('incoming-avatar-text').innerText = resolved.name.charAt(0).toUpperCase();

        const badgeEl = document.getElementById('incoming-contact-badge');
        if (badgeEl) {
            if (resolved.isSaved) {
                badgeEl.innerText = 'Saved Contact';
                badgeEl.className = 'badge bg-success mb-4';
            } else {
                badgeEl.innerText = 'Not in Contacts';
                badgeEl.className = 'badge bg-secondary mb-4';
            }
        }

        // Show Modern Full-Screen Ringing Overlay
        document.getElementById('state-incoming-call').style.display = 'flex';
    };

    // Handle call answered
    rtcEngine.onCallAnswered = () => {
        if (window.soundEngine) soundEngine.stopRingtone();
    };

    // Handle call ended from remote peer
    rtcEngine.onCallEnded = () => {
        if (window.soundEngine) soundEngine.stopRingtone();
        Swal.fire({ title: 'Call Ended', icon: 'info', timer: 1500, showConfirmButton: false });
        endCallUI();
    };

    rtcEngine.onCallError = (msg) => {
        if (window.soundEngine) soundEngine.stopRingtone();
        Swal.fire('Call Error', msg, 'error');
        endCallUI();
    };

    // Handle presence updates
    rtcEngine.onPresenceUpdate = (presence) => {
        console.log("[Presence Update]", presence);
        refreshContacts();
    };

    // Handle real-time chat messages and typing indicators
    rtcEngine.onChatMessage = (data) => {
        if (data.type === 'chat-message') {
            const fromUid = data.from;
            if (state.activeChatUid === fromUid) {
                appendChatMessage({ sender_uid: fromUid, text: data.text, created_at: data.created_at || new Date().toISOString() });
                handleTypingSignal(fromUid, false);
            }
            loadConversations();
            if (window.soundEngine) soundEngine.playMessageNotification();
        } else if (data.type === 'chat-message-ack') {
            if (data.message && state.activeChatUid === data.message.receiver_uid) {
                appendChatMessage(data.message);
            }
            loadConversations();
        } else if (data.type === 'typing') {
            handleTypingSignal(data.from, data.isTyping);
        }
    };

    // Connect WebSockets signaling connection
    rtcEngine.connectSocket(user.sip_uid, user.full_name);
    
    // Update connection status label
    const connLabel = document.querySelector('.connection-status');
    if (connLabel) {
        connLabel.textContent = "VoIP Ready • Online";
        connLabel.classList.remove('text-muted');
        connLabel.classList.add('text-success');
    }
}

// INCOMING OVERLAY ACTIONS

window.acceptIncomingCall = async function () {
    if (window.soundEngine) soundEngine.stopRingtone();
    document.getElementById('state-incoming-call').style.display = 'none';

    if (!state.pendingIncomingCall) return;
    const { fromUid, callerName, offer } = state.pendingIncomingCall;

    const resolved = resolveCallerInfo(fromUid, callerName);
    showCallScreen(resolved.name);

    // Explicitly unlock mobile media autoplay restrictions
    const remoteVideo = document.getElementById('remote-video');
    const remoteAudio = document.getElementById('remote-audio');
    if (remoteVideo) remoteVideo.play().catch(() => {});
    if (remoteAudio) remoteAudio.play().catch(() => {});

    try {
        const localStream = await rtcEngine.getLocalMedia(true);
        const localVideo = document.getElementById('local-video');
        if (localVideo) {
            localVideo.srcObject = localStream;
            localVideo.play().catch(e => console.warn("Local video play exception:", e));
        }

        await rtcEngine.answerCall(offer, true);
    } catch (err) {
        Swal.fire('Call Answer Failed', err.message, 'error');
        endCallUI();
    }
    state.pendingIncomingCall = null;
};

window.rejectIncomingCall = function () {
    if (window.soundEngine) soundEngine.stopRingtone();
    document.getElementById('state-incoming-call').style.display = 'none';

    if (state.pendingIncomingCall && rtcEngine) {
        rtcEngine.rejectCall(state.pendingIncomingCall.fromUid);
        api.logCall(state.pendingIncomingCall.fromUid, state.user.sip_uid, 'rejected', 0);
        refreshRecents();
    }
    state.pendingIncomingCall = null;
};

// --- CALL FLOW GLUE ---

window.startCall = async function (targetUid, nameHint) {
    if (!rtcEngine) return Swal.fire('Error', 'VoIP Engine not initialized', 'error');

    const resolved = resolveCallerInfo(targetUid, nameHint);
    showCallScreen(resolved.name);
    state.activeCallStartTime = new Date();

    if (window.soundEngine) soundEngine.startOutboundRingtone();

    try {
        const localStream = await rtcEngine.getLocalMedia(true);
        const localVideo = document.getElementById('local-video');
        if (localVideo) {
            localVideo.srcObject = localStream;
            localVideo.play().catch(e => console.warn("Local video play exception:", e));
        }

        await rtcEngine.startCall(targetUid, true);
    } catch (err) {
        if (window.soundEngine) soundEngine.stopRingtone();
        console.error("Start call error:", err);
        Swal.fire('Call Failed', err.message || 'Could not connect call', 'error');
        endCallUI();
    }
};

window.endCall = function () {
    if (window.soundEngine) soundEngine.stopRingtone();

    if (rtcEngine) {
        rtcEngine.endCall();
    }

    if (state.activeCallStartTime) {
        const duration = Math.round((new Date() - state.activeCallStartTime) / 1000);
        const partner = document.getElementById('call-partner').innerText;
        api.logCall(state.user.sip_uid, partner, 'completed', duration);
        state.activeCallStartTime = null;
    }

    endCallUI();
    setTimeout(refreshRecents, 1000);
};

function endCallUI() {
    if (window.soundEngine) soundEngine.stopRingtone();
    if (rtcEngine) rtcEngine.stopCallTimer();

    const timerEl = document.getElementById('call-timer');
    if (timerEl) timerEl.innerText = "00:00";

    document.getElementById('state-incoming-call').style.display = 'none';
    const overlay = document.getElementById('state-incall');
    if (overlay) overlay.style.display = 'none';

    const remoteVideo = document.getElementById('remote-video');
    if (remoteVideo) remoteVideo.srcObject = null;

    const remoteAudio = document.getElementById('remote-audio');
    if (remoteAudio) remoteAudio.srcObject = null;

    const localVideo = document.getElementById('local-video');
    if (localVideo) localVideo.srcObject = null;
}

function showCallScreen(name) {
    if (rtcEngine) rtcEngine.stopCallTimer();

    const timerEl = document.getElementById('call-timer');
    if (timerEl) timerEl.innerText = "00:00";

    document.getElementById('state-incall').style.display = 'flex';
    document.getElementById('call-partner').innerText = name;
}

// --- REFRESH RENDERERS ---

async function refreshContacts() {
    state.contacts = await api.getContacts();
    const list = document.getElementById('contact-list-ul');
    if (!list) return;
    list.innerHTML = state.contacts.length ? '' : '<div class="text-center text-muted mt-5">No saved contacts yet.</div>';

    state.contacts.forEach(c => {
        const name = c.contact_name || c.contact_uid;
        const statusBadge = c.is_online ? '<span class="badge bg-success ms-2">Online</span>' : '<span class="badge bg-secondary ms-2">Offline</span>';
        list.innerHTML += `
            <div class="list-item">
                <div class="item-info">
                    <div class="item-avatar">${name.charAt(0).toUpperCase()}</div>
                    <div class="item-text">
                        <h4>${name}${statusBadge}</h4>
                        <p class="text-muted">${c.contact_uid}</p>
                    </div>
                </div>
                <div class="contact-actions">
                    <button class="btn-icon-action contact-msg-btn" onclick="openChatWithContact('${c.contact_uid}', '${name}')" title="Message Contact">
                        <i class="bi bi-chat-dots-fill"></i>
                    </button>
                    <button class="btn-icon-action contact-call-btn" onclick="startCall('${c.contact_uid}', '${name}')" title="Call Contact">
                        <i class="bi bi-telephone-fill"></i>
                    </button>
                </div>
            </div>`;
    });
}

async function refreshRecents() {
    state.recents = await api.getCallHistory();
    filterRecents('all');
}

// --- TIME FORMATTING UTILITY (INDIAN STANDARD TIME - IST) ---
function formatISTTime(dateInput) {
    if (!dateInput) return '';
    let d;
    if (dateInput instanceof Date) {
        d = dateInput;
    } else if (typeof dateInput === 'number') {
        d = new Date(dateInput);
    } else if (typeof dateInput === 'string') {
        let str = dateInput.trim();
        str = str.replace(' ', 'T');
        if (!str.endsWith('Z') && !/[+-]\d{2}:?\d{2}$/.test(str)) {
            str += 'Z';
        }
        d = new Date(str);
    } else {
        d = new Date(dateInput);
    }

    if (isNaN(d.getTime())) return '';

    return d.toLocaleTimeString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });
}

window.filterRecents = function (filter) {
    const list = document.getElementById('recents-list-ul');
    if (!list) return;

    document.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
    if (event && event.currentTarget) event.currentTarget.classList.add('active');

    const data = filter === 'missed' ? state.recents.filter(r => r.status === 'missed') : state.recents;
    list.innerHTML = data.length ? '' : '<div class="text-center text-muted mt-5">No recent calls.</div>';

    data.forEach(r => {
        const isOutbound = r.direction === 'outbound';
        const icon = isOutbound ? '<i class="bi bi-arrow-up-right text-success"></i>' : '<i class="bi bi-arrow-down-left text-danger"></i>';
        const partnerUid = isOutbound ? r.callee_uid : r.caller_uid;
        
        // Resolve contact name dynamically - NEVER Unknown!
        const resolved = resolveCallerInfo(partnerUid);
        const unsavedTag = !resolved.isSaved ? `<span class="badge bg-dark border border-secondary text-muted ms-2" style="font-size: 0.7rem;">Unsaved</span>` : '';
        const date = formatISTTime(r.start_time);

        list.innerHTML += `
            <div class="list-item">
                <div class="item-info">
                    <div class="item-avatar"><i class="bi bi-clock"></i></div>
                    <div class="item-text">
                        <h4>${resolved.name}${unsavedTag}</h4>
                        <p class="small text-muted">${icon} ${r.status} • ${partnerUid} • ${date}</p>
                    </div>
                </div>
                <button class="icon-btn" onclick="startCall('${partnerUid}', '${resolved.name}')">
                    <i class="bi bi-telephone-fill"></i>
                </button>
            </div>`;
    });
};

async function refreshGroups() {
    state.groups = await api.getMyGroups();
    const list = document.getElementById('group-list-ul');
    if (!list) return;
    list.innerHTML = state.groups.length ? '' : '<div class="text-center text-muted mt-5">No groups created or joined.</div>';

    state.groups.forEach(g => {
        list.innerHTML += `
            <div class="list-item" style="cursor: pointer;" onclick="manageGroup('${g.group_uid}')">
                <div class="item-info">
                    <div class="item-avatar" style="border-radius:12px"><i class="bi bi-people-fill"></i></div>
                    <div class="item-text">
                        <h4>${g.group_name}</h4>
                        <p class="text-muted">ID: ${g.group_uid}</p>
                    </div>
                </div>
                <button class="icon-btn" onclick="event.stopPropagation(); startCall('${g.group_uid}', '${g.group_name}')">
                    <i class="bi bi-telephone-fill"></i>
                </button>
            </div>`;
    });
}

window.toggleMic = function () {
    if (window.soundEngine) soundEngine.playClickSound();
    if (rtcEngine) {
        const muted = rtcEngine.toggleMute();
        const btn = document.getElementById('btn-toggle-mic');
        if (btn) {
            btn.querySelector('i').className = muted ? 'bi bi-mic-mute-fill' : 'bi bi-mic-fill';
            if (muted) btn.classList.add('btn-danger'); else btn.classList.remove('btn-danger');
        }
    }
};

window.toggleCamera = function () {
    if (window.soundEngine) soundEngine.playClickSound();
    if (rtcEngine) {
        const videoOn = rtcEngine.toggleVideo();
        const btn = document.getElementById('btn-toggle-cam');
        if (btn) {
            btn.querySelector('i').className = videoOn ? 'bi bi-camera-video-fill' : 'bi bi-camera-video-off-fill';
            if (!videoOn) btn.classList.add('btn-danger'); else btn.classList.remove('btn-danger');
        }
    }
};

// --- CHAT & MESSAGING FUNCTIONS ---

state.activeChatUid = null;
state.activeChatName = null;

async function loadConversations() {
    if (!state.user) return;
    const convs = await api.getConversations(state.user.sip_uid);
    state.conversations = convs;
    const container = document.getElementById('conversations-list');

    let totalUnread = 0;

    if (!container) return;

    if (!convs || convs.length === 0) {
        container.innerHTML = '<div class="text-center text-muted py-5">No active conversations</div>';
        updateUnreadNavBadge(0);
        return;
    }

    container.innerHTML = convs.map(c => {
        const peerUid = c.peer_uid;
        const contact = state.contacts.find(x => x.contact_uid === peerUid);
        const name = contact ? contact.contact_name : `User ${peerUid}`;
        const lastMsg = c.text || '';
        const timeStr = formatISTTime(c.created_at);
        const isActive = state.activeChatUid === peerUid ? 'active' : '';
        const unread = c.unread_count || 0;
        totalUnread += unread;

        const unreadBadge = unread > 0 ? `<span class="badge bg-danger rounded-pill ms-2">${unread}</span>` : '';

        return `
            <div class="conversation-item ${isActive}" onclick="openChat('${peerUid}', '${name}')">
                <div class="conversation-avatar">${name.charAt(0).toUpperCase()}</div>
                <div class="conversation-info">
                    <div class="d-flex justify-content-between align-items-center mb-1">
                        <div class="conversation-name">${name}</div>
                        <div class="conversation-time">${timeStr}</div>
                    </div>
                    <div class="d-flex justify-content-between align-items-center">
                        <div class="conversation-last-msg">${lastMsg}</div>
                        ${unreadBadge}
                    </div>
                </div>
            </div>
        `;
    }).join('');

    updateUnreadNavBadge(totalUnread);
}

function updateUnreadNavBadge(totalUnread) {
    const badge = document.getElementById('nav-msg-badge');
    if (!badge) return;
    if (totalUnread > 0) {
        badge.innerText = totalUnread > 99 ? '99+' : totalUnread;
        badge.style.display = 'inline-block';
    } else {
        badge.style.display = 'none';
    }
}

window.filterConversationsList = function (query) {
    const q = query.toLowerCase();
    document.querySelectorAll('.conversation-item').forEach(item => {
        const name = item.querySelector('.conversation-name')?.innerText.toLowerCase() || '';
        const msg = item.querySelector('.conversation-last-msg')?.innerText.toLowerCase() || '';
        if (name.includes(q) || msg.includes(q)) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
};

window.openChat = async function (peerUid, nameHint = '') {
    state.activeChatUid = peerUid;
    const contact = state.contacts.find(x => x.contact_uid === peerUid);
    const name = contact ? contact.contact_name : (nameHint || `User ${peerUid}`);
    state.activeChatName = name;

    const emptyState = document.getElementById('chat-empty-state');
    const activeWindow = document.getElementById('chat-active-window');
    const mainPanel = document.getElementById('chat-main-panel');
    const sidebar = document.getElementById('conversations-sidebar');

    if (emptyState) emptyState.style.display = 'none';
    if (activeWindow) activeWindow.style.display = 'flex';

    if (mainPanel) mainPanel.classList.add('mobile-active');
    if (sidebar) sidebar.classList.add('mobile-hidden');

    document.getElementById('active-chat-name').innerText = name;
    document.getElementById('active-chat-uid').innerText = `UID ${peerUid}`;
    document.getElementById('active-chat-avatar').innerText = name.charAt(0).toUpperCase();

    // Mark messages as read
    await api.markMessagesRead(state.user.sip_uid, peerUid);

    // Load message history
    const messages = await api.getMessages(state.user.sip_uid, peerUid);
    renderMessages(messages);
    loadConversations();
};

window.openChatWithContact = function (contactUid, contactName) {
    switchTab('messages');
    openChat(contactUid, contactName);
};

function renderMessages(messages) {
    const body = document.getElementById('chat-messages-body');
    if (!body) return;
    body.innerHTML = '';
    messages.forEach(msg => appendChatMessage(msg, false));
    body.scrollTop = body.scrollHeight;
}

function appendChatMessage(msg, autoScroll = true) {
    const body = document.getElementById('chat-messages-body');
    if (!body) return;
    const isOutgoing = msg.sender_uid === state.user.sip_uid;
    const timeStr = formatISTTime(msg.created_at || new Date());

    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${isOutgoing ? 'outgoing' : 'incoming'}`;
    bubble.innerHTML = `
        <div>${msg.text}</div>
        <div class="chat-bubble-time">${timeStr}</div>
    `;
    body.appendChild(bubble);
    if (autoScroll) body.scrollTop = body.scrollHeight;
}

// --- REAL-TIME TYPING INDICATOR UTILITIES ---
const activeTypingUsers = new Set();
const typingTimeouts = {};
let localTypingTimer = null;

function handleTypingSignal(fromUid, isTyping) {
    if (isTyping) {
        activeTypingUsers.add(fromUid);
        if (typingTimeouts[fromUid]) clearTimeout(typingTimeouts[fromUid]);
        typingTimeouts[fromUid] = setTimeout(() => {
            handleTypingSignal(fromUid, false);
        }, 3500);
    } else {
        activeTypingUsers.delete(fromUid);
        if (typingTimeouts[fromUid]) {
            clearTimeout(typingTimeouts[fromUid]);
            delete typingTimeouts[fromUid];
        }
    }
    updateTypingUI(fromUid);
}

function updateTypingUI(fromUid) {
    const isCurrentActive = state.activeChatUid === fromUid;
    const headerStatus = document.getElementById('active-chat-typing');
    const typingBubble = document.getElementById('chat-typing-bubble');

    if (isCurrentActive) {
        const isTyping = activeTypingUsers.has(fromUid);
        if (headerStatus) headerStatus.style.display = isTyping ? 'inline-flex' : 'none';
        if (typingBubble) typingBubble.style.display = isTyping ? 'block' : 'none';
        if (isTyping) {
            const body = document.getElementById('chat-messages-body');
            if (body) body.scrollTop = body.scrollHeight;
        }
    }

    // Update conversation item list in sidebar
    const convItems = document.querySelectorAll('.conversation-item');
    convItems.forEach(item => {
        if (item.getAttribute('onclick')?.includes(fromUid)) {
            const lastMsgEl = item.querySelector('.conversation-last-msg');
            if (lastMsgEl) {
                if (activeTypingUsers.has(fromUid)) {
                    if (!lastMsgEl.dataset.originalText) {
                        lastMsgEl.dataset.originalText = lastMsgEl.innerText;
                    }
                    lastMsgEl.innerHTML = `<span class="text-success fw-medium"><i class="bi bi-pencil-fill me-1"></i> typing...</span>`;
                } else if (lastMsgEl.dataset.originalText) {
                    lastMsgEl.innerText = lastMsgEl.dataset.originalText;
                    delete lastMsgEl.dataset.originalText;
                }
            }
        }
    });
}

window.sendChatMessage = async function () {
    const input = document.getElementById('chat-input-text');
    if (!input || !input.value.trim() || !state.activeChatUid) return;
    const text = input.value.trim();
    input.value = '';

    // Clear local typing indicator state immediately upon sending
    if (state.activeChatUid && window.rtcEngine) {
        rtcEngine.sendTypingSignal(state.activeChatUid, false);
        if (localTypingTimer) clearTimeout(localTypingTimer);
    }

    if (rtcEngine && rtcEngine.socket && rtcEngine.socket.readyState === WebSocket.OPEN) {
        rtcEngine.socket.send(JSON.stringify({
            type: 'chat-message',
            targetUid: state.activeChatUid,
            text: text
        }));
    } else {
        const res = await api.sendMessage(state.user.sip_uid, state.activeChatUid, text);
        if (res && res.message) {
            appendChatMessage(res.message);
            loadConversations();
        }
    }
};

window.handleChatKeyPress = function (e) {
    if (e.key === 'Enter') {
        sendChatMessage();
    } else {
        // Send typing signal to active chat partner
        if (state.activeChatUid && window.rtcEngine) {
            rtcEngine.sendTypingSignal(state.activeChatUid, true);
            if (localTypingTimer) clearTimeout(localTypingTimer);
            localTypingTimer = setTimeout(() => {
                if (state.activeChatUid && window.rtcEngine) {
                    rtcEngine.sendTypingSignal(state.activeChatUid, false);
                }
            }, 2500);
        }
    }
};

window.closeMobileChat = function () {
    const mainPanel = document.getElementById('chat-main-panel');
    const sidebar = document.getElementById('conversations-sidebar');
    if (mainPanel) mainPanel.classList.remove('mobile-active');
    if (sidebar) sidebar.classList.remove('mobile-hidden');
    state.activeChatUid = null;
};

window.initiateChatCall = function () {
    if (state.activeChatUid) {
        startCall(state.activeChatUid, state.activeChatName || state.activeChatUid);
    }
};