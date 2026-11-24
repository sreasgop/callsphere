import React, { useState, useEffect } from 'react';
import { Phone, PhoneOff } from 'lucide-react';
import { useWebRTC } from '../../context/WebRTCContext';
import { api } from '../../utils/api';

export const IncomingCallOverlay = () => {
    const { remoteUser, answerCall, rejectCall } = useWebRTC();
    const [contactName, setContactName] = useState(null);

    useEffect(() => {
        if (remoteUser?.sip_uid) {
            api.getContacts().then(contacts => {
                if (Array.isArray(contacts)) {
                    const found = contacts.find(c => (c.contact_uid || c.target_uid) === remoteUser.sip_uid);
                    if (found) setContactName(found.contact_name || found.nickname);
                }
            });
        }
    }, [remoteUser?.sip_uid]);

    const callerDisplayName = contactName || remoteUser?.callerName || 'Incoming Call';
    const isSavedContact = Boolean(contactName);

    return (
        <div className="incoming-call-overlay">
            <div className="incoming-card">
                <div className="incoming-avatar-wrapper mb-3">
                    <div className="pulse-ring"></div>
                    <div className="pulse-ring delay"></div>
                    <div className="incoming-avatar">
                        {callerDisplayName.substring(0, 2).toUpperCase()}
                    </div>
                </div>
                <h3 className="text-white fw-bold mb-1">{callerDisplayName}</h3>
                <div className="text-muted font-monospace small mb-2">UID: {remoteUser?.sip_uid}</div>
                <div className="mb-4">
                    {isSavedContact ? (
                        <span className="badge bg-primary px-3 py-1">In Contacts</span>
                    ) : (
                        <span className="badge bg-secondary px-3 py-1">Not in Contacts</span>
                    )}
                </div>

                <div className="incoming-actions">
                    <button className="call-action-btn reject" onClick={rejectCall}>
                        <i><PhoneOff size={24} /></i>
                        <span>Decline</span>
                    </button>
                    <button className="call-action-btn answer" onClick={answerCall}>
                        <i><Phone size={24} /></i>
                        <span>Answer</span>
                    </button>
                </div>
            </div>
        </div>
    );
};
