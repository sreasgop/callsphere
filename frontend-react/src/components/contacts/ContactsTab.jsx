import React, { useState, useEffect } from 'react';
import { UserPlus, MessageSquare, PhoneCall, Globe, UserCheck } from 'lucide-react';
import { api } from '../../utils/api';
import { useWebRTC } from '../../context/WebRTCContext';
import Swal from 'sweetalert2';

export const ContactsTab = ({ setActiveTab }) => {
    const [contacts, setContacts] = useState([]);
    const [allUsers, setAllUsers] = useState([]);
    const [viewMode, setViewMode] = useState('saved'); // saved or directory
    const { startCall, setActiveChatTarget, loadContacts, resolveContact } = useWebRTC();

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        const c = await api.getContacts();
        const u = await api.getAllUsers();
        setContacts(Array.isArray(c) ? c : []);
        setAllUsers(Array.isArray(u) ? u : []);
        if (loadContacts) loadContacts();
    };

    const handleAddContactModal = () => {
        Swal.fire({
            title: 'Add Contact',
            html: `
                <input id="swal-uid" class="swal2-input" placeholder="10-Digit UID">
                <input id="swal-nickname" class="swal2-input" placeholder="Nickname (Optional)">
            `,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: 'Add Contact',
            background: 'rgba(20, 22, 27, 0.95)',
            color: '#fff',
            preConfirm: () => {
                const uid = document.getElementById('swal-uid').value.trim();
                const nickname = document.getElementById('swal-nickname').value.trim();
                if (!uid) {
                    Swal.showValidationMessage('Please enter target 10-Digit UID');
                }
                return { uid, nickname };
            }
        }).then(async (result) => {
            if (result.isConfirmed) {
                const res = await api.addContact(result.value.uid, result.value.nickname || undefined);
                if (res.error) {
                    Swal.fire('Error', res.error, 'error');
                } else {
                    Swal.fire('Success', 'Contact added successfully', 'success');
                    loadData();
                }
            }
        });
    };

    const handleStartMessage = (peerUid) => {
        setActiveChatTarget(String(peerUid));
        setActiveTab('messages');
    };

    const safeContacts = Array.isArray(contacts) ? contacts : [];
    const safeAllUsers = Array.isArray(allUsers) ? allUsers : [];

    return (
        <div>
            <div className="section-header">
                <h3>Contacts & Directory</h3>
                <div className="d-flex align-items-center gap-2">
                    <div className="filter-pills me-2">
                        <div
                            className={`pill ${viewMode === 'saved' ? 'active' : ''}`}
                            onClick={() => setViewMode('saved')}
                        >
                            <UserCheck size={14} className="me-1" /> Saved
                        </div>
                        <div
                            className={`pill ${viewMode === 'directory' ? 'active' : ''}`}
                            onClick={() => setViewMode('directory')}
                        >
                            <Globe size={14} className="me-1" /> All Users
                        </div>
                    </div>
                    <button className="btn-action" onClick={handleAddContactModal}>
                        <UserPlus size={16} /> Add
                    </button>
                </div>
            </div>

            <div className="contacts-list">
                {viewMode === 'saved' ? (
                    safeContacts.length === 0 ? (
                        <div className="text-center text-muted my-5">No saved contacts yet</div>
                    ) : (
                        safeContacts.map((c, i) => {
                            const uidStr = String(c?.contact_uid || c?.target_uid || '');
                            const nameStr = String(c?.contact_name || c?.nickname || (resolveContact ? resolveContact(uidStr) : '') || 'Contact');
                            const isOnline = Boolean(c?.is_online);
                            return (
                                <div key={i} className="list-item">
                                    <div className="item-info">
                                        <div className="item-avatar">
                                            {nameStr.substring(0, 2).toUpperCase()}
                                        </div>
                                        <div className="item-text">
                                            <h4 className="d-flex align-items-center gap-2">
                                                {nameStr}
                                                {isOnline && (
                                                    <span className="badge bg-success rounded-pill" style={{ fontSize: '0.65rem' }}>
                                                        Online
                                                    </span>
                                                )}
                                            </h4>
                                            <p>{uidStr}</p>
                                        </div>
                                    </div>
                                    <div className="contact-actions">
                                        <button
                                            className="btn-icon-action contact-msg-btn"
                                            onClick={() => handleStartMessage(uidStr)}
                                            title="Message Contact"
                                        >
                                            <MessageSquare size={16} />
                                        </button>
                                        <button
                                            className="btn-icon-action contact-call-btn"
                                            onClick={() => startCall(uidStr, true)}
                                            title="Call Contact"
                                        >
                                            <PhoneCall size={16} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })
                    )
                ) : (
                    safeAllUsers.length === 0 ? (
                        <div className="text-center text-muted my-5">No users found</div>
                    ) : (
                        safeAllUsers.map((u, i) => {
                            const nameStr = String(u?.full_name || 'User');
                            const uidStr = String(u?.sip_uid || '');
                            const emailStr = String(u?.email || '');
                            return (
                                <div key={i} className="list-item">
                                    <div className="item-info">
                                        <div className="item-avatar">
                                            {nameStr.substring(0, 2).toUpperCase()}
                                        </div>
                                        <div className="item-text">
                                            <h4 className="d-flex align-items-center gap-2">
                                                {nameStr}
                                                {u?.is_online && (
                                                    <span className="badge bg-success rounded-pill" style={{ fontSize: '0.65rem' }}>
                                                        Online
                                                    </span>
                                                )}
                                            </h4>
                                            <p>{uidStr} • {emailStr}</p>
                                        </div>
                                    </div>
                                    <div className="contact-actions">
                                        <button
                                            className="btn-icon-action contact-msg-btn"
                                            onClick={() => handleStartMessage(uidStr)}
                                            title="Message User"
                                        >
                                            <MessageSquare size={16} />
                                        </button>
                                        <button
                                            className="btn-icon-action contact-call-btn"
                                            onClick={() => startCall(uidStr, true)}
                                            title="Call User"
                                        >
                                            <PhoneCall size={16} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })
                    )
                )}
            </div>
        </div>
    );
};
